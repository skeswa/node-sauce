/**************************** EXTERNAL IMPORTS *******************************/

var underscore = require("underscore");

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
 *      Properties of sauceConfigMap:
 *          - apiRoot - the url fragment that prepends api routes; defaults to '/sauce/apis'
 * @param apiConfigMap api-specific configuration object e.g. 'config.clientId' or 'config.clientSecret'
 *      Properties of apiConfigMap:
 *          - clientId - String - Client Secret as defined by the api service
 *          - clientSecret - String - Client Id as defined by the api service
 *          - scopes* - String - the permissions for api use; some apis don't use this
 * @param extensionMap settings for pseudo-inheritance - because javascript inheritance is junk e.g. 'config.additionalTokenRequestHeaders'
 *      Properties of extensionMap:
 *          - requiresScopes - Boolean - true if this api needs apiConfigMap.scopes to be defined
 *
 */
module.exports.OAuth2API = function(apiName, sauceConfigMap, apiConfigMap, extensionMap) {
    /********************* INSTANCE VARIABLES *********************/

    if (!apiName) throw new ex.IllegalArgumentException("The name parameter was null.");
    // First check that apiConfigMap was defines
    if (!apiConfigMap) throw new ex.IllegalArgumentException("The api config map parameter was null.");
    // Create the standard auth params
    var clientId = apiConfigMap.clientId; // OAuth Client ID; everyone needs this
    var clientSecret = apiConfigMap.clientSecret; // OAuth Client Secret; everyone needs this too
    var scopes = apiConfigMap.scopes; // OAuth Scopes; not everyone needs this
    // We need to make sure we have at least id and secret
    if (!clientId) throw new ex.IllegalArgumentException("The api config map had a null 'clientId' field.");
    if (!underscore.isString(clientId)) throw new ex.IllegalArgumentException("The api config map 'clientId' field must be a string.");
    if (!clientSecret) throw new ex.IllegalArgumentException("The api config map had a null 'clientSecret' field.");
    if (!underscore.isString(clientSecret)) throw new ex.IllegalArgumentException("The api config map 'clientSecret' field must be a string.");
    // We need to check extension property for 'requiresScopes' - so, of course, the extensionMap has to exist first
    if (!extensionMap) throw new ex.IllegalArgumentException("The extension map parameter was null.");
    // Slap them on the wrist for not having scopes
    if (extensionMap.requiresScopes) {
        if (!scopes) throw new ex.IllegalArgumentException("The '" + apiName + "' api requires the 'scopes' parameter in the api config map, but it was null.");
        else if (!underscore.isString(scopes)) throw new ex.IllegalArgumentException("The '" + apiName + "' api requires the 'scopes' parameter in the api config map, but it has to be a string.");
    }
    // Moving on, lets create the more general config-specific instance variables
    if (!sauceConfigMap) throw new ex.IllegalArgumentException("The sauce config map parameter was null.");
    var apiRoot = (sauceConfigMap.apiRoot) ? sauceConfigMap.apiRoot : DEFAULT_API_ROOT;
    // Some api root corrections for later (never trust the user) - the root must start with a '/' but not end with one
    if (apiRoot.charAt(0) !== URL_PATH_SEPARATOR) apiRoot = URL_PATH_SEPARATOR + apiRoot;
    if (apiRoot.charAt(apiRoot.length) === URL_PATH_SEPARATOR) apiRoot = apiRoot.slice(0, apiRoot.length - 1);
    // Setup the redirect route url up here for ease of reuse
    var redirectRouteUrl = apiRoot + URL_PATH_SEPARATOR + apiName + DEFAULT_REDIRECT_ROUTE_SUFFIX;
    // Now we check the extension map for api urls: we need an 'authUrl', a 'tokenUrl' and, finally, a 'requestUrl'
    var authUrl = extensionMap.authUrl;
    var tokenUrl = extensionMap.tokenUrl;
    var requestUrl = extensionMap.requestUrl;
    // Ugh, more parameter checking
    if (!authUrl) throw new ex.IllegalArgumentException("The extension map had a null 'authUrl' field.");
    if (!underscore.isString(authUrl)) throw new ex.IllegalArgumentException("The extension map 'authUrl' field must be a string.");
    if (!tokenUrl) throw new ex.IllegalArgumentException("The extension map had a null 'tokenUrl' field.");
    if (!underscore.isString(tokenUrl)) throw new ex.IllegalArgumentException("The extension map 'tokenUrl' field must be a string.");
    if (!requestUrl) throw new ex.IllegalArgumentException("The extension map had a null 'requestUrl' field.");
    if (!underscore.isString(authUrl)) throw new ex.IllegalArgumentException("The extension map 'requestUrl' field must be a string.");
    // Ok, we got this far, sweet, we need soome basic state flags
    var routed = false;

    /********************** INSTANCE METHODS **********************/

    // Identifies this API with a human readable string. Doesn't necessarily
    // have to be the apiName.
    this.identity = function() {
        return apiName;
    };
    // Creates all routes required by the OAuth 2.0 roundtrip. This involves creating a redirect
    // route that requests the authentication token.
    this.route = function() {}

}