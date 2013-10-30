var MongoClient = require('mongodb').MongoClient
var md5 = require('MD5');
var ex = require("../exception.js");
var dataEx = require('./data.exceptions.js');
var assert = require("../assert.js");

const DATABASE_ROOT = '/data/';
const HTTPS_PROTOCOL_PREFIX = 'https://';

module.exports.setupUserDataRoutes = function(app, schemaName, storageConfigs){

	assert.object('storageConfigs', storageConfigs);
	assert.string('storageConfigs.user', storageConfigs.user);
	assert.string('storageConfigs.pass', storageConfigs.pass);
	assert.string('storageConfigs.url', storageConfigs.url);
	var mongoUrl = 'mongodb://' + storageConfigs.user + ':' + storageConfigs.pass + '@' + storageConfigs.url;

	app.post(DATABASE_ROOT + schemaName + '/register', function(req, res){
		if(req.secure){
			MongoClient.connect(mongoUrl, function(err, db) {
				if(err) res.json(500, err);
				else if(!req.body.user)	res.json(500, new ex.IllegalArgumentException('user name not provided'));
				else if(!req.body.pass)	res.json(500, new ex.IllegalArgumentException('password not provided'));
				else{
					var collection = db.collection(schemaName);
					collection.findOne({user: req.body.user}, function(err, doc){
						if(err) res.json(500, err);
						else if(doc){
							res.json(500, new dataEx.UserAlreadyRegisteredException(req.body.user));
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
			res.redirect(301, HTTPS_PROTOCOL_PREFIX + req.host + req.url);
		}
	});
}