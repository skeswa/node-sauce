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
    clientId: "1073639428455-4i31qgcbhon7dvstd9r6efeo7rhcsedl.apps.googleusercontent.com",
    appSecret: "TdJQNp1INvQHdCINUiQbR6PZ",
    scopes: "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gcm_for_chrome",
}).api("facebook", {
    clientId: "76yui987ui98u",
    clientSecret: "76yui987ui98u76yui987ui98u76yui987ui98u"
}).api("github", {
    clientId: "ROMPPDasdasdas",
    clientSecret: "ROMPPDasdasdasROMPPDasdasdasROMPPDasdasdas"
}).express());

app.get("/", function (req, res) {
    if (req.sauce.apis.auth()) {
        res.send(200, "Nice work!");
    }
});