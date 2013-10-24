/**************************** EXTERNAL IMPORTS *******************************/

/**************************** INTERNAL IMPORTS *******************************/

var assert = require("../assert.js");
var apiEx = require("./api.exceptions.js");
var OAuth2Api = require("../lib/api/type/oauth2.api.js");

/**************************** MODULE CONSTANTS *******************************/

var GOOGLE_API_NAME = "google";
var GITHUB_API_NAME = "github";
var DROPBOX_API_NAME = "dropbox";
var VENMO_API_NAME = "venmo";

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
constructors[GITHUB_API_NAME] = function(sauceConfigMap, apiConfigMap) {
    return new OAuth2Api(GITHUB_API_NAME, sauceConfigMap, apiConfigMap, {
        authUrl: "https://github.com/login/oauth/authorize",
        tokenUrl: "https://github.com/login/oauth/access_token",
        requestUrl: "https://api.github.com/",
        requiresScopes: false,
        authRequiresState: true,
        clientConfig: {
            authorizationHeaderPrefix: "token"
        }
    });
};
constructors[DROPBOX_API_NAME] = function(sauceConfigMap, apiConfigMap) {
    return new OAuth2Api(DROPBOX_API_NAME, sauceConfigMap, apiConfigMap, {
        authUrl: "https://www.dropbox.com/1/oauth2/authorize",
        tokenUrl: "https://api.dropbox.com/1/oauth2/token",
        requestUrl: null, // Keeping this null so that full urls must be specified in api requests
        requiresScopes: false,
        authRequiresState: true,
        clientConfig: {
            authorizationHeaderPrefix: "Bearer"
        }
    });
};
constructors[VENMO_API_NAME] = function(sauceConfigMap, apiConfigMap) {
    return new OAuth2Api(DROPBOX_API_NAME, sauceConfigMap, apiConfigMap, {
        authUrl: "https://api.venmo.com/oauth/authorize",
        tokenUrl: "https://api.venmo.com/oauth/access_token",
        requestUrl: "https://www.venmoapis.com/",
        requiresScopes: false,
        authRequiresState: false,
        excludesRedirectUri: true,
        clientConfig: {
            authorizationTokenParameterKey: "access_token"
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