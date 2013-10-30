var express = require("express");
var reload = require("reload");
var http = require("http");
var app = express();

app.use(express.cookieParser());
var MemStore = express.session.MemoryStore;
app.use(express.session({
    secret: 'secret_key',
    store: MemStore({
        reapInterval: 60000 * 10
    })
}));
app.use(express.bodyParser());

var Api = require("../lib/api/type/oauth2.api.js");
var fakeGoogleApi = new Api("google", {}, {
    clientId: "1073639428455-4i31qgcbhon7dvstd9r6efeo7rhcsedl.apps.googleusercontent.com",
    clientSecret: "TdJQNp1INvQHdCINUiQbR6PZ",
    scopes: "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gcm_for_chrome",
}, {
    authUrl: "https://accounts.google.com/o/oauth2/auth",
    tokenUrl: "https://accounts.google.com/o/oauth2/token",
    requestUrl: "https://www.googleapis.com/",
    requiresScopes: true,
    authTokenGrantType: "authorization_code",
    authResponseType: "code",
    authRequiresState: true,
    clientConfig: {
        authorizationHeaderPrefix: "OAuth"
    }
});
var UglyApi = require("../lib/api/type/oauth1.api.js");
var fakeTwitterApi = new UglyApi("twitter", {}, {
    consumerKey: "T0WDNkpeP5vvuQCOCHz2Pw",
    consumerSecret: "4hNYlooQjuPRBjolol2QoAwny0CnWqn88XIuAj9d7v0"
}, {
    authUrl: "https://api.twitter.com/oauth/authorize",
    accessTokenUrl: "https://api.twitter.com/oauth/access_token",
    requestTokenUrl: "https://api.twitter.com/oauth/request_token",
    // requestTokenUrl: "http://localhost:7373/herp",
    requestUrl: "https://api.twitter.com/1.1/"
});

app.post("/herp", function(req, res) {
    console.log(req.headers);
    res.send(500, "nasty kid.");
});

app.get("/test", function(req, res) {
    if (!fakeGoogleApi.authed(req.session)) {
        fakeGoogleApi.auth(app, req, res, "/test").call(function(err, token) {
            if (err) {
                console.log("OH NO!");
            } else {
                console.log("yeah baby: " + token);
            }
        });
    } else {
        res.send(200);
    }
});

app.get("/ugh", function(req, res) {
    if (!fakeTwitterApi.authed(req.session)) {
        fakeTwitterApi.auth(app, req, res, "/ugh").call(function(err, token) {
            if (err) {
                console.log(JSON.stringify(err));
                console.log("OH NO!");
            } else {
                console.log("yeah baby: " + token);
            }
        });
    } else {
        var client = fakeTwitterApi.makeClient(req.session);
        client.get("statuses/retweets_of_me.json").receives("json").payload({
            count: 5
        }).call(function(err, result) {
            if (err) {
                res.json(500, err);
            } else {
                res.json(200, result);
            }
        });
    }
});

var server = http.createServer(app);

//reload code here
reload(server, app)

server.listen(7373, function() {
    console.log("Web server listening on port 7373");
});