var sauce = require("../sauce.js");

// Library Imports
var express = require("express");
var app = express();

// Middleware
app.use(express.cookieParser());
var MemStore = express.session.MemoryStore;
app.use(express.session({
    secret: 'secret_key',
    store: MemStore({
        reapInterval: 60000 * 10
    })
}));
app.use(express.bodyParser());
app.use(express.static(__dirname + '/public'));

// Sauce
app.use(sauce.bind(app).configure({
    apiBaseRoute: "/sauce/apis/",
    sessionTimeout: 300000
}).api("google", {
    clientId: "987q243t32q76",
    clientSecret: "987q243t32q76987q243t32q76987q243t32q76"
}).api("facebook", {
    clientId: "76yui987ui98u",
    clientSecret: "76yui987ui98u76yui987ui98u76yui987ui98u"
}).api("github", {
    clientId: "ROMPPDasdasdas",
    clientSecret: "ROMPPDasdasdasROMPPDasdasdasROMPPDasdasdas"
}).express());