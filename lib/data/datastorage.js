var MongoClient = require('mongodb').MongoClient
var md5 = require('MD5');

var ex = require("./data.exceptions.js");
var generalEx = require("../exception.js");

const DATABASE_ROOT = '/data/';
const SSL_PORT = 443;
const HTTPS_PROTOCOL_PREFIX = 'https://';

module.exports = function(app, dbUser, dbPass, dbUrl, sslCertificatePath, sslPrivateKeyPath){

	var mongoUrl = 'mongodb://' + dbUser + ':' + dbPass + '@' + dbUrl;
	
	//create server for ssl requests
	const crypto = require('crypto'), fs = require("fs"), https = require('https');;
	if(!fs.existsSync(sslPrivateKeyPath)){
		throw new generalEx.IllegalAruementException('ssl private key file did not exist');
	}else if(!fs.existsSync(sslCertificatePath)){
		throw new generalEx.IllegalAruementException('ssl certificate file did not exist');
	}
	var privateKey = fs.readFileSync(sslPrivateKeyPath).toString();
	var certificate = fs.readFileSync(sslCertificatePath).toString();
	
	//var credentials = crypto.createCredentials();
	https.createServer({key: privateKey, cert: certificate}, app).listen(SSL_PORT);
	console.log('SSL server started on port ' + SSL_PORT);
	
	this.createUserDataRoutes = function(schemaName){
	
		//register
		/*
		Required fields
			user - the username
			pass - md5 hash of the password
			document - all other data to be stored
		*/
		console.log(DATABASE_ROOT + 'register');
		app.post(DATABASE_ROOT + 'register', function(req, res){
			console.log(req.secure);
			if(req.secure){
				MongoClient.connect(mongoUrl, function(err, db) {
					if(err) res.json(500, err);
					else if(!req.body.user){
						res.json(500, new RequiredFieldNotIncludedException('user'));
					}else if(!req.body.pass){
						res.json(500, new RequiredFieldNotIncludedException('pass'));
					}else{
						var collection = db.collection(schemaName);
						collection.findOne({user: req.body.user}, function(err, doc){
							if(err) res.json(500, err);
							else if(doc){
								res.json(500, new ex.UserAlreadyRegisteredException(req.body.user));
							}else{
								var passHash = md5(req.body.pass);
								collection.insert({user: req.body.user, passHash: passHash, document: req.body.document}, function(err, insertedDoc){
									if(err) res.json(500, err);
									else{
										db.close();
										delete insertedDoc.passHash;
										var accessKey = md5((new Date()).getTime() + Math.floor((Math.random() * 100) + 1) + req.body.user);
										req.session._sauceDataAccessKey = accessKey;
										res.send(200, {accessKey: accessKey, document: insertedDoc});
									}
								});
							}
						});
					}
				});
			}else {
				console.log('redirect:' + HTTPS_PROTOCOL_PREFIX + req.host + req.url);
				res.redirect(301, HTTPS_PROTOCOL_PREFIX + req.host + req.url);
			}
		});
	
		//login
		app.post(DATABASE_ROOT + 'login', function(req, res){
			if(req.secure){
				MongoClient.connect(mongoUrl, function(err, db) {
					if(err) res.json(500, err);
					else if(!req.body.user){
						res.json(500, new RequiredFieldNotIncludedException('user'));
					}else if(!req.body.pass){
						res.json(500, new RequiredFieldNotIncludedException('pass'));
					}else{
						var collection = db.collection(schemaName);
						var passHash = md5(req.body.pass);
						collection.findOne({user: req.body.user, passHash: passHash}, function(err, doc){
							db.close();
							if(err) res.json(500, err);
							else if(!doc){
								res.json(500, new ex.InvalidUserException(req.body.user));
							}else{
								delete doc.passHash;
								var accessKey = md5((new Date()).getTime() + Math.floor((Math.random() * 100) + 1) + req.body.user);
								req.session._sauceDataAccessKey = accessKey;
								res.send(200, {accessKey: accessKey, document: doc});
							}
						});
					}
				});
			}else res.redirect(301, HTTPS_PROTOCOL_PREFIX + req.host + DATABASE_ROOT + 'register');
		});
		
		/*
		//logout
		app.post(DATABASE_ROOT + 'logout', function(req, res){
			delete req.session._sauceDataAccessKey;
		});
		
		//update
		app.put(DATABASE_ROOT + schemaName, function(req, res){
			MongoClient.connect(mongoUrl, function(err, db) {
				if(err) res.json(500, err);
				else{
					var collection = db.collection(schemaName);
					collection.update(req.body.query, req.body.update, {upsert: req.body.upsert, multi: req.body.multi}, function(err, result){
						if(err) res.json(500, err);
						else{
							db.close();
							res.send(200, result);
						}
					});
				}
			});
		});
	
		//get
		app.get(DATABASE_ROOT + schemaName, function(req, res){
			MongoClient.connect(mongoUrl, function(err, db) {
				if(err) res.json(500, err);
				else{
					var collection = db.collection(schemaName);
					//get doc or docs
				}
			});
		});
		
		//delete
		app.delete(DATABASE_ROOT + schemaName, function(req, res){
			MongoClient.connect(mongoUrl, function(err, db) {
				if(err) res.json(500, err);
				else{
					var collection = db.collection(schemaName);
					collection.remove(req.body.query, req.body.justOne, function(err, result){
						if(err) res.json(500, err);
						else{
							db.close();
							res.send(200, result);
						}
					});
				}
			});
		});
		*/
	}
}