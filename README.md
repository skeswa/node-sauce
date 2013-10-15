Sauce
=====

Sauce is library for Node.js to quickly put together server infrastructure at Hack-a-thons.

Desired Interaction:
--------------------

    // Setting sauce up
    var app = express();
    var sauce = require("sauce").express(app).configure({
        setting1: "settingValue1",
        setting2: "settingValue2"
    });
    // Load APIs (analagous to require(...))
    sauce.api("google").api("github").api("facebook").api("./custom-api.js");
    // Create routes
    sauce.route(/* express route method */ "POST", /* express route path */ "/my/app/route", /* sauce apis required */ ["google", "github"], function (req, res) {
         /* the contents of this callback will only be executed after the required apis are authed */
         this();
         is();
         app();
         logic();
         /* example api usage */
         var googleApiClient = sauce.api("google").client();
         googleApiClient.getUser(...);
         /* this API usage might throw a NotYetAuthedException since we didn't put it in the required apis array */
         var customApiClient = sauce.api("./custom-api.js").client();
         customApiClient.twerk(...);
         /* this line would throw a NoSuchApiException since we neever loaded this api */
         var mufasaApiClient = sauce.api("mufasa").client();
    });

DOOITZ!
