var MongoClient = require('mongodb').MongoClient
var md5 = require('MD5');
var ex = require("../exception.js");
var dataEx = require('./data.exceptions.js');
var assert = require("../assert.js");

const DATABASE_ROOT = '/data/';
const HTTPS_PROTOCOL_PREFIX = 'https://';

module.exports.setupUserDataRoutes = function(app, schemaName, storageConfigs){
	assert.object('storageConfigs', storageConfigs);
	assert.string('storageConfigs.dbUser', storageConfigs.dbUser);
	assert.string('storageConfigs.dbPass', storageConfigs.dbPass);
	assert.string('storageConfigs.dbUrl', storageConfigs.dbUrl);
	var mongoUrl = 'mongodb://' + storageConfigs.dbUser + ':' + storageConfigs.dbPass + '@' + storageConfigs.dbUrl;
	app.post(DATABASE_ROOT + schemaName + '/register', function(req, res){
		if(req.secure){
			if(!req.param('user')) res.json(500, new ex.IllegalArgumentException('user name not provided'));
			else if(!req.param('pass'))	res.json(500, new ex.IllegalArgumentException('password not provided'));
			else MongoClient.connect(mongoUrl, function(err, db) {
				if(err) {
					res.json(500, err);
					db.close();
				}else{
					var collection = db.collection(schemaName);
					collection.findOne({user: req.param('user')}, function(err, doc){
						if(err) {
							res.json(500, err);
							db.close();
						}else if(doc){
							res.json(500, new dataEx.UserAlreadyRegisteredException(req.param('user')));
							db.close();
						}else{
							var passHash = md5(req.param('pass'));
							var data = JSON.parse(req.param('data'));
							collection.insert({user: req.param('user'), passHash: passHash, data: data}, function(err, insertedDoc){
								if(err){
									res.json(500, err);
									db.close();
								}else{
									insertedDoc = insertedDoc[0];
									delete insertedDoc.passHash; //TODO: this still shows up in response
									console.log(insertedDoc);
									var accessKey = md5((new Date()).getTime() + Math.floor((Math.random() * 100) + 1) + req.param('user'));
									req.session._sauceUser = req.param('user');
									req.session._sauceDataAccessKey = accessKey;
									res.send(200, {accessKey: accessKey, document: insertedDoc});
									db.close();
								}
							});
						}
					});
				}
			});
		}else{
			res.redirect(301, HTTPS_PROTOCOL_PREFIX + req.host + req.url);
		}
	});
	
	app.get(DATABASE_ROOT + schemaName + '/login', function(req, res){
		if(req.secure){
			if(!req.param('user')) res.json(500, new ex.IllegalArgumentException('user name not provided'));
			else if(!req.param('pass'))	res.json(500, new ex.IllegalArgumentException('password not provided'));
			else MongoClient.connect(mongoUrl, function(err, db) {
				if(err) {
					res.json(500, err);
					db.close();
				}else{
					var collection = db.collection(schemaName);
					collection.findOne({user: req.param('user')}, function(err, doc){
						if(err) {
							res.json(500, err);
							db.close();
						}else if(!doc){
							res.json(500, new dataEx.InvalidUserException(req.param('user')));
							db.close();
						}else if(md5(req.param('pass')) !== doc.passHash){
							res.json(500, new dataEx.InvalidUserException(req.param('user')));
							db.close();
						}else{
							delete doc.passHash;
							var accessKey = md5((new Date()).getTime() + Math.floor((Math.random() * 100) + 1) + req.param('user'));
							req.session._sauceUser = req.param('user');
							req.session._sauceDataAccessKey = accessKey;
							res.send(200, {accessKey: accessKey, document: doc});
							db.close();
						}
					});
				}
			});
		}else{
			res.redirect(301, HTTPS_PROTOCOL_PREFIX + req.host + req.url);
		}
	});
	
	app.get(DATABASE_ROOT + schemaName + '/logout', function(req, res){
		delete req.session._sauceUser;
		delete req.session._sauceDataAccessKey;
		res.send(200, 'logout successful');
	});
	
	app.get(DATABASE_ROOT + schemaName, function(req, res){
		if(req.secure){
			if(checkAuthorizationHeader(req, res)){
				MongoClient.connect(mongoUrl, function(err, db) {
					if(err) {
						res.json(500, err);
						db.close();
					}else{
						var collection = db.collection(schemaName);
						collection.findOne({user: req.session._sauceUser}, function(err, doc){
							if(err) {
								res.json(500, err);
								db.close();
							}else{
								delete doc.passHash;
								res.send(200, {document: doc});
								db.close();
							}
						});
					}
				});
			}
		}else{
			res.redirect(301, HTTPS_PROTOCOL_PREFIX + req.host + req.url);
		}
	});
	
	app.post(DATABASE_ROOT + schemaName, function(req, res){
		if(req.secure){
			if(checkAuthorizationHeader(req, res)){
				MongoClient.connect(mongoUrl, function(err, db) {
					if(err) {
						res.json(500, err);
						db.close();
					}else{
						try{
							var update = JSON.parse(req.param('update'));
							var collection = db.collection(schemaName);
							var updateStmt = {};
							if(checkIfUpdateObject(update)){
								for(updateClause in update){
									updateStmt[updateClause] = {};
									for(updateField in update[updateClause]){
										updateStmt[updateClause]['data.' + updateField] = update[updateClause][updateField];
									}
								}
							}else updateStmt = { $set: { data: update }};
							collection.update({user: req.session._sauceUser}, updateStmt, {upsert: false, multi: false}, function(err, result){
								if(err) {
									res.json(500, err);
									db.close();
								}else{
									res.send(200, "update successful");
									db.close();
								}
							});
						}catch(err){
							res.json(500, err);
							db.close();
						}
					}
				});
			}
		}else{
			res.redirect(301, HTTPS_PROTOCOL_PREFIX + req.host + req.url);
		}
	});
	
	app.delete(DATABASE_ROOT + schemaName, function(req, res){
		if(req.secure){
			if(checkAuthorizationHeader(req, res)){
				MongoClient.connect(mongoUrl, function(err, db) {
					if(err) {
						res.json(500, err);
						db.close();
					}else{
						var collection = db.collection(schemaName);
						collection.remove({user: req.session._sauceUser}, true, function(err, result){
							if(err) {
								res.json(500, err);
								db.close();
							}else{
								delete req.session._sauceUser;
								delete req.session._sauceDataAccessKey;
								res.send(200, "user removed successfully");
								db.close();
							}
						});
					}
				});
			}
		}else{
			res.redirect(301, HTTPS_PROTOCOL_PREFIX + req.host + req.url);
		}
	});
}

var checkIfUpdateObject = function(update){
	for(field in update){
		if(field.indexOf('$') == -1) return false;
	}
	return true;
}

var checkAuthorizationHeader = function(req, res){
	if(!req.get('Authorization')) res.send(500, new dataEx.AuthorizationHeaderNotIncludedException('Authorization'));
	else if(!req.session._sauceDataAccessKey) res.send(500, new dataEx.UserNotLoggedInException());
	else if(req.get('Authorization').substring(0, 6) !== 'Sauce ') res.send(500, new dataEx.BadHeaderFormatException('Authorization', "Sauce <key>"));
	else if(req.get('Authorization').substring(6) !== req.session._sauceDataAccessKey) res.send(500, new InvalidSauceAccessKeyException());
	else return true;
	return false;
}