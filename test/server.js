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
}).express());

app.get("/", function (req, res) {
    res.send(200);
})

/*
app.get("/", function (req, res) {
    if (req.sauce.apis.google.auth()) {
		var googleApi = req.sauce.apis.google.client();
		googleApi.get('oauth2/v1/userinfo').success(function(jsonBody){
			console.log(jsonBody);
		}).failure(function(error, response, body){
			console.log(error);
		}).call();
        res.send(200, "Nice work!");
    }
}); */

app.listen(7373, function() {
	console.log("Server started on port " + 7373);
});