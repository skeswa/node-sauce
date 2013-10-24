/**************************** EXTERNAL IMPORTS *******************************/

/**************************** INTERNAL IMPORTS *******************************/

var assert = require("../assert.js");
var OAuth2Api = require("../lib/api/type/oauth2.api.js");

/**************************** MODULE CONSTANTS *******************************/

var GOOGLE_API_EXTENSION_MAP = {
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
}

/*************************** INTERNAL VARIABLES ******************************/

var constructors = {
    google: function(sauceConfigMap, apiConfigMap) {
        assert.object("sauceConfigMap", sauceConfigMap);
        assert.object("sauceConfigMap", sauceConfigMap);

        return OAuth2Api("google", sauceConfigMap, apiConfigMap, GOOGLE_API_EXTENSION_MAP);
    }
};

/**************************** EXTERNAL METHODS *******************************/