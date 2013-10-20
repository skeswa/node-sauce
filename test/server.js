var sauce = require("../lib.js");

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

// Sauce
app.use(sauce.bind(app).configure({
    apiBaseRoute: "/sauce/apis/",
    sessionTimeout: 300000
}).api("google", {
    clientId: "1073639428455-4i31qgcbhon7dvstd9r6efeo7rhcsedl.apps.googleusercontent.com",
    clientSecret: "TdJQNp1INvQHdCINUiQbR6PZ",
    scopes: "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gcm_for_chrome",
}).api("github", {
    clientId: "2e11a6de2de2a14d662e",
    clientSecret: "cd43e16431d35c234790705272d3962e10fb642e"
}).express());

// Test routes
app.get("/google", function(req, res) {
    if (!req.sauce.apis.google.authed()) {
        req.sauce.apis.google.auth("/google");
    } else {
        var client = req.sauce.apis.google.client();
        var userRequest = client.get("oauth2/v1/userinfo").success(function(user) {
            res.json(200, user);
        }).failure(function(err) {
            res.send(500, user);
        });
        userRequest.call();
    }
});
app.get("/github", function(req, res) {
    if (!req.sauce.apis.github.authed()) {
        req.sauce.apis.github.auth("/github");
    } else {
        var client = req.sauce.apis.github.client();
        var userRequest = client.get("user").success(function(user) {
            res.json(200, user);
        }).failure(function(err, resp, bod) {
            res.send(500, err);
            console.log(resp);
            console.log(bod);
        });
        userRequest.call();
    }
});

app.listen(7373, function() {
    console.log("Server started on port " + 7373);
});