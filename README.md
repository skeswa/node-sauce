Sauce
=====

Sauce is library for Node.js to quickly put together server infrastructure at Hack-a-thons.

Desired Interaction:
--------------------

    // Setting sauce up
    var app = express();
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

DOOITZ!
