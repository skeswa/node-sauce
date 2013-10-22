/**************************** EXTERNAL IMPORTS *******************************/

/**************************** INTERNAL IMPORTS *******************************/

var ex = require("../exception.js");
var log = require("../log.js");

/**************************** MODULE CONSTANTS *******************************/

var URL_PATH_SEPARATOR = "/"; // To reduce string creation ever so slightly - this may be a bit anal
var DEFAULT_API_ROOT = "/sauce/apis"; // What the api specific routes will get prepended with, if its not overridden
var DEFAULT_REDIRECT_ROUTE_SUFFIX = "/redirect"; // What we suffix redirect api routes with, if its not overridden

/*************************** OBJECT DEFINITIONS ******************************/

/* The base API type that specific implementations will extends. Supports all 
 * the methods required by Sauce API's, but its specifically geared for OAuth 
 * 2.0 compliance. <i>This function is a constructor</i>.
 *
 * @param apiName name of the api implementation e.g. 'google' or 'dropbox'
 * @param sauceConfigMap general sauce configuration object e.g. 'config.apiRoot' or 'config.isLoggingDebug'
 * @param apiConfigMap api-specific configuration object e.g. 'config.clientId' or 'config.clientSecret'
 * @param customizationsMap settings for pseudo-inheritance - because javascript inheritance is junk e.g. 'config.additionalTokenRequestHeaders'
 *
 */
module.exports.OAuth2API = function(apiName, sauceConfigMap, apiConfigMap, customizationsMap) {
    /********************* INSTANCE VARIABLES *********************/

    var clientId = apiConfigMap.clientId; // OAuth Client ID; everyone needs this
    var clientSecret = apiConfigMap.clientSecret; // OAuth Client Secret; everyone needs this too
    var scopes = apiConfigMap.scopes; // OAuth Scopes; not everyone needs this
    // We need to make sure we have at least id and secret
    if (!clientId) throw new ex.IllegalArgumentException("The api config map had a null 'clientId' parameter.");
    if (!clientSecret) throw new ex.IllegalArgumentException("The api config map had a null 'clientSecret' parameter.");
    // Slap them on the wrist for not having scopes
    if (!scopes) log.w("The api config map for '" + apiName + "' api had a null 'scopes' parameter - with OAuth 2.0 this is generally ill-advised.");
    // Moving on, lets create the more general config-specific instance variables
    var apiRoot = (sauceConfigMap.apiRoot) ? sauceConfigMap.apiRoot : DEFAULT_API_ROOT;
    // Some api root corrections for later (never trust the user) - the root must start with a '/' but not end with one
    if (apiRoot.charAt(0) !== URL_PATH_SEPARATOR) apiRoot = URL_PATH_SEPARATOR + apiRoot;
    if (apiRoot.charAt(apiRoot.length) === URL_PATH_SEPARATOR) apiRoot = apiRoot.slice(0, apiRoot.length - 1);
    // Setup the redirect route url up here for ease of reuse
    var redirectRouteUrl = apiRoot + URL_PATH_SEPARATOR + apiName + DEFAULT_REDIRECT_ROUTE_SUFFIX;
    // The state machine flags
    var routed = false;

    /********************** INSTANCE METHODS **********************/

    // Identifies this API with a human readable string. Doesn't necessarily
    // have to be the apiName.
    this.identity = function() {
        return apiName;
    };

    this.route = function() {

    }

}