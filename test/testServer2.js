var express = require("express");
var app = express();
var http = require('http');
var DataStorage = require('../lib/data/datastorage.js');

app.use(express.cookieParser());
var MemStore = express.session.MemoryStore;
app.use(express.session({
    secret: 'secret_key',
    store: MemStore({
        reapInterval: 60000 * 10
    })
}));
app.use(express.bodyParser());

app.get('/test', function(req, res){
	console.log('Hello World');
	res.send(200, 'Hello World');
});

var ds = new DataStorage(app, 'root', 'pass', 'mongodb://pooter.sandile.me:27017/data', '/root/sauce-test/test/certificate.pem', '/root/sauce-test/test/privatekey.pem');
ds.createUserDataRoutes('testData');

http.createServer(app).listen(7373);