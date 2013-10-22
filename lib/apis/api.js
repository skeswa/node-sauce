/**************************** EXTERNAL IMPORTS *******************************/

var underscore = require("underscore");

/**************************** INTERNAL IMPORTS *******************************/

var ex = require("../exception.js");
var log = require("../log.js");

/**************************** MODULE CONSTANTS *******************************/

var HTTP_PROTOCOL_PREFIX = "http://"; // Do I really need to explain this
var OAUTH_GRANT_TYPE = "grant_type";
var HTTP_POST_METHOD = "POST"; // Do I really need to explain this
var URL_PATH_SEPARATOR = "/"; // To reduce string creation ever so slightly - this may be a bit anal
var DEFAULT_API_ROOT = "/sauce/apis"; // What the api specific routes will get prepended with, if its not overridden
var DEFAULT_REDIRECT_ROUTE_SUFFIX = "/redirect"; // What we suffix redirect api routes with, if its not overridden
var SAUCE_SESSION_KEY_PREFIX = "_sauce";
var SAUCE_SESSION_AUTH_RETURN_URL_KEY = SAUCE_SESSION_KEY_PREFIX + "ApiAuthReturnUrl"; // This is where we go after OAuth loop has finished

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
 *          - excludesRedirectUri - Boolean - true if this api SHOULD NOT include redirect_uri in token request
 *          - authTokenGrantType - String - Specifies the grant_type parameter for the token request
 *
 */
module.exports.OAuth2API = function(apiName, sauceConfigMap, apiConfigMap, extensionMap) {
    /********************* INSTANCE VARIABLES *********************/

    if (!apiName) throw new ex.IllegalArgumentException("The api name parameter was null.");
    // Lets put session keys together
    var authTokenSessionKey = SAUCE_SESSION_KEY_PREFIX + apiName.charAt(0).toUpperCase() + apiName.slice(1) + "AuthToken";
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
    this.route = function(app) {
        // Only route if its our first time
        if (!routed) {
            // Gotta make sure we have the app defined
            if (!app) throw new ex.IllegalArgumentException("The express app parameter was null.");
            // Now we register the redirect route
            app.get(redirectRouteUrl, function(req, res) {
                var code = req.param("code");
                // Make sure we have code before we go anywhere
                if (!code) {
                    // TODO we need failure callback here
                    log.e("The 'code' parameter received in '" + apiName + "' api redirect was null.");
                    // Go back to where we came from, because this didn't work
                    if (req.session[SAUCE_SESSION_AUTH_RETURN_URL_KEY]) res.redirect(req.session[SAUCE_SESSION_AUTH_RETURN_URL_KEY]);
                    else {
                        // Uh oh, return url wasn't provided - that's not fun
                        log.e("The sauce return url was null after finishing authnetication for '" + apiName + "' api, so we have to send a 404.");
                        res.send(404);
                    }
                    return;
                } else {
                    // Next, we need to make the form query tring map for the token request
                    var tokenRequestParams = {};
                    tokenRequestParams["code"] = code;
                    tokenRequestParams["client_id"] = clientId;
                    tokenRequestParams["client_secret"] = clientSecret;
                    // Means we need to define grant_type
                    if (!extensionMap.excludesRedirectUri) {
                        tokenRequestParams["redirect_uri"] = HTTP_PROTOCOL_PREFIX + req.get("host") + redirectRouteUrl;
                    }
                    if (extensionMap.authTokenGrantType) {
                        if (underscore.isString(extensionMap.authTokenGrantType)) {
                            tokenRequestParams[OAUTH_GRANT_TYPE] = extensionMap.authTokenGrantType;
                        } else {
                            log.w("The extension map 'authTokenGrantType' field was defined, but not as a string.");
                        }
                    }
                    // Time to make the request!
                    request({
                        url: tokenUrl,
                        form: tokenRequestParams,
                        method: HTTP_POST_METHOD
                    }, function(error, response, body) {
                        if (error || response.statusCode > 299) {
                            if (!error) error = new ex.APICallFailureException("API call to URL '" + tokenUrl + "' failed with status code " + response.statusCode + ". The body was as follows: \n" + body);
                            log.e("'" + apiName + "' api authentication failed: " + error);
                            // TODO we need failure callback here
                        } else {
                            // Successfully got the token, lets boogie
                            var payload = JSON.parse(body);
                            req.session[authTokenSessionKey] = payload.access_token;
                            // Check if there is a timeout, if so, we need to set a timer
                            if (payload.expires_in) {
                                setTimeout(function() {
                                    req.session[authTokenSessionKey] = null;
                                }, payload.expires_in * 1000);
                                log.d("'" + apiName + "' api authentication token expires in " + (payload.expires_in / 60) + " minutes.");
                            }
                            log.d("'" + apiName + "' api authentication token '" + payload.access_token + "' obtained successfully.");
                        }
                        // We're done, lets go home
                        if (req.session[SAUCE_SESSION_AUTH_RETURN_URL_KEY]) {
                            res.redirect(req.session[SAUCE_SESSION_AUTH_RETURN_URL_KEY]);
                            req.session[SAUCE_SESSION_AUTH_RETURN_URL_KEY] = null;
                        } else {
                            // Uh oh, return url wasn't provided - that's not fun
                            log.e("The sauce return url was null after finishing authnetication for '" + apiName + "' api, so we have to send a 404.");
                            res.send(404);
                        }
                    });
                };
            });
        } else {
            throw new ex.APIAlreadyRoutedException(apiName);
        }
    }

}