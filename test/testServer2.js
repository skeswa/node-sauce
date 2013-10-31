var express = require("express");
var app = express();
var http = require('http');
var https = require('https');
var fs = require('fs');

var sauce = require('../lib.js');

// Middleware
var app = express();
app.use(express.cookieParser());
app.use(express.session({
    secret: 'secret_key',
    store: express.session.MemoryStore({
        reapInterval: 60000 * 10
    })
}));
app.use(express.bodyParser());
app.use(sauce.bind(app).configure({
    apiBaseRoute: "/sauce/apis/",
    sessionTimeout: 300000
}).user('testData', {
	dbUser: 'root',
	dbPass: 'pass',
	dbUrl: 'pooter.sandile.me:27017'
}).express());

//start server
var options = {
	key : fs.readFileSync('./test/privatekey.pem').toString(),
	cert : fs.readFileSync('./test/certificate.pem').toString(),
	ca : fs.readFileSync('./test/certrequest.csr').toString(),
}

http.createServer(app).listen(7373);
https.createServer(options, app).listen(443);
console.log('servers started on ports 7373 and 443');