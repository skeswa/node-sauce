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
sauce.express(app).configure({
    one: 1,
    two: "2",
    three: "3",
    four: 4
}).api("google").api("facebook").api("github", {
    githubSetting1: 1,
    githubSetting2: 2,
    githubSetting3: 3
});