/**************************** EXTERNAL IMPORTS *******************************/

/**************************** INTERNAL IMPORTS *******************************/

var assert = require("../assert.js");
var apiEx = require("./api.exceptions.js");
var OAuth2Api = require("../lib/api/type/oauth2.api.js");

/**************************** MODULE CONSTANTS *******************************/

var GOOGLE_API_NAME = "google";

/*************************** INTERNAL VARIABLES ******************************/

var constructors = {};
// Entries for all internal apis
constructors[GOOGLE_API_NAME] = function(sauceConfigMap, apiConfigMap) {
    return new OAuth2Api(GOOGLE_API_NAME, sauceConfigMap, apiConfigMap, {
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
};

/**************************** EXTERNAL METHODS *******************************/

// Returns true if the factory is capable of building the api with the name 
// specified below, false otherwise.
var has = function(apiName) {
    assert.string(apiName, "apiName");
    if (constructors[apiName]) {
        return true;
    }
    return false;
};
// Creates a new instance of an internal Sauce Api, whose definition exists
// in the constructors map. The new api instance is returned by this function. 
var build = function(apiName, sauceConfigMap, apiConfigMap) {
    assert.string(apiName, "apiName");
    assert.object("sauceConfigMap", sauceConfigMap);
    assert.object("apiConfigMap", apiConfigMap);

    if (!constructors[apiName]) throw new apiEx.NoSuchApiException(apiName);
    return constructors[apiName](sauceConfigMap, apiConfigMap);
};
// Now we export those functions
module.exports.has = has;
module.exports.build = build;