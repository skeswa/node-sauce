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
    sauce.route(/* express route method */ "POST", /* express route path */ "/my/app/route", /* sauce apis required (optional parameter) */ ["google", "github"], function (req, res) {
         /* example api usage */
         var googleApiClient = req.sauce.apis.google;
         googleApiClient.getUser(...);
         /* this API usage might throw a NotYetAuthedException since we didn't put it in the required apis array */
         var customApiClient = req.sauce.apis["./custom-api.js"];
         customApiClient.twerk(...);
         /* this line would return null - mufasa was never loaded as an api*/
         var mufasaApiClient = req.sauce.apis.mufasa;
    });

DOOITZ!
