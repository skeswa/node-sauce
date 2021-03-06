/**************************** EXTERNAL IMPORTS *******************************/

var request = require("request"); // For making REST calls
var underscore = require("underscore"); // For general utility methods
var qs = require("querystring"); // For reading authentication responses
var rs = require("randomstring"); // For nonce generation
var crypto = require("crypto"); // For signature generation
var URL = require("url"); // For url analysis

/**************************** INTERNAL IMPORTS *******************************/

var assert = require("../../assert.js");
var ex = require("../../exception.js");
var apiEx = require("../api.exceptions.js");
var log = require("../../log.js");
var callbackCache = require("../../session/callback.cache.js");
var apiUtil = require("../util/oauth1.util.js");
var Client = require("../client/oauth1.client.js");

/**************************** MODULE CONSTANTS *******************************/

var HTTP_PROTOCOL_PREFIX = "http://"; // Do I really need to explain this
var OAUTH_GRANT_TYPE = "grant_type";
var HTTP_POST_METHOD = "POST"; // Do I really need to explain this
var URL_PATH_SEPARATOR = "/"; // To reduce string creation ever so slightly - this may be a bit anal
var DEFAULT_API_ROOT = "/sauce/apis"; // What the api specific routes will get prepended with, if its not overridden
var DEFAULT_REDIRECT_ROUTE_SUFFIX = "/redirect"; // What we suffix redirect api routes with, if its not overridden
var SAUCE_SESSION_KEY_PREFIX = "_sauce";
var SAUCE_SESSION_AUTH_RETURN_URL_KEY = SAUCE_SESSION_KEY_PREFIX + "ApiAuthReturnUrl"; // This is where we go after OAuth loop has finished

/*************************** INSTANCE VARIABLES ******************************/

var _authRedirectUrl = null;

/**************************** INSTANCE METHODS *******************************/

// Returns the fully qualified redirect url
var authRedirectUrl = function(req, route) {
    if (!_authRedirectUrl) {
        _authRedirectUrl = HTTP_PROTOCOL_PREFIX + req.get("host") + route;
    }
    return _authRedirectUrl;
}

/*************************** OBJECT DEFINITIONS ******************************/

/* The base API type that specific implementations will extends. Supports all 
 * the methods required by Sauce Apis, but its specifically geared for OAuth
 * 1.0 compliance. <i>This function is a constructor</i>.
 *
 * @param apiName name of the api implementation e.g. 'google' or 'dropbox'
 * @param sauceConfigMap general sauce configuration object e.g. 'config.apiRoot' or 'config.isLoggingDebug'
 *      Properties of sauceConfigMap:
 *          - apiRoot - the url fragment that prepends api routes; defaults to '/sauce/apis'
 * @param apiConfigMap api-specific configuration object e.g. 'config.clientId' or 'config.clientSecret'
 *      Properties of apiConfigMap:
 *          - consumerKey - String - Consumer Key as defined by the api service
 *          - consumerSecret - String - Consumer Secret as defined by the api service
 * @param extensionMap settings for customization of functionality
 *      Properties of extensionMap:
 *          - authUrl - REQUIRED - String - url for api authentication redirect
 *          - accessTokenUrl - REQUIRED - String - url for fetching access token
 *          - requestTokenUrl - RECOMMENDED - String - url for fetching request token
 *          - requestUrl - RECOMMENDED - String - base url for submitting api requests after we're authed
 *          - authSignatureMethod - RECOMMENDED - String - signature method e.g. HMAC-SHA1, PLAINTEXT
 *          - authNonceLength - RECOMMENDED - Integer - how long the nonce string has to be, defaults to 32
 *          - clientExtensionMap - REQUIRED - Map/Object - specific map of properties for the api request client
 *              - authorizationHeaderPrefix - OPTIONAL - String - the string that prepends the auth token in the authorization header; authorization header is excluded if this is null
 *              - authorizationTokenParameterKey - OPTIONAL - String - if specified, auth token is included in api request query string - identified by the authorizationTokenParameterKey string
 *
 */
module.exports = function(apiName, sauceConfigMap, apiConfigMap, extensionMap) {

    /********************* INSTANCE VARIABLES *********************/

    // First, we preserve our context
    var $ = this;
    // Lets get started
    assert.string(apiName, "apiName");
    // Lets put session keys together
    var camelCaseApiName = apiName.charAt(0).toUpperCase() + apiName.slice(1);
    var authTokenSessionKey = SAUCE_SESSION_KEY_PREFIX + camelCaseApiName + "AuthToken";
    var authTokenSecretSessionKey = SAUCE_SESSION_KEY_PREFIX + camelCaseApiName + "AuthTokenSecret";
    var authTokenExpirationSessionKey = SAUCE_SESSION_KEY_PREFIX + camelCaseApiName + "AuthTokenExpiration";
    var authSuccessCallbackIdSessionKey = SAUCE_SESSION_KEY_PREFIX + camelCaseApiName + "SuccessCallbackId";
    var authFailureCallbackIdSessionKey = SAUCE_SESSION_KEY_PREFIX + camelCaseApiName + "FailureCallbackId";
    var authGeneralCallbackIdSessionKey = SAUCE_SESSION_KEY_PREFIX + camelCaseApiName + "CallbackId";
    // First check that apiConfigMap was defines
    assert.object(apiConfigMap, "apiConfigMap");
    // Create the standard auth params
    var consumerKey = apiConfigMap.consumerKey; // OAuth Consumer Key; everyone needs this
    var consumerSecret = apiConfigMap.consumerSecret; // OAuth Client Secret; everyone needs this too
    // We need to make sure we have at least id and secret
    assert.string(consumerKey, "consumerKey");
    assert.string(consumerSecret, "consumerSecret");
    // We need to check extension property for 'requiresScopes' - so, of course, the extensionMap has to exist first
    assert.object(extensionMap, "extensionMap");
    // Moving on, lets create the more general config-specific instance variables
    assert.object(sauceConfigMap, "sauceConfigMap");
    var apiRoot = (sauceConfigMap.apiRoot) ? sauceConfigMap.apiRoot : DEFAULT_API_ROOT;
    // Some api root corrections for later (never trust the user) - the root must start with a '/' but not end with one
    if (apiRoot.charAt(0) !== URL_PATH_SEPARATOR) apiRoot = URL_PATH_SEPARATOR + apiRoot;
    if (apiRoot.charAt(apiRoot.length) === URL_PATH_SEPARATOR) apiRoot = apiRoot.slice(0, apiRoot.length - 1);
    // Setup the redirect route url up here for ease of reuse
    var redirectRouteUrl = apiRoot + URL_PATH_SEPARATOR + apiName + DEFAULT_REDIRECT_ROUTE_SUFFIX;
    // Now we check the extension map for api urls: we need an 'authUrl', a 'tokenUrl' and, finally, a 'requestUrl'
    var authUrl = extensionMap.authUrl;
    var accessTokenUrl = extensionMap.accessTokenUrl;
    var requestTokenUrl = extensionMap.requestTokenUrl;
    var requestUrl = extensionMap.requestUrl;
    // Ugh, more parameter checking
    assert.string(authUrl, "authUrl");
    assert.string(accessTokenUrl, "accessTokenUrl");
    assert.string(requestTokenUrl, "requestTokenUrl");
    // assert.string(requestUrl, "requestUrl"); // Shouldn't be fixed for some apis e.g. dropbox
    // Ok, we got this far, sweet
    var routed = false; // Flag that indicates whether route(..) has already been invoked
    var client = null; // The instance of this api's client

    /********************** INSTANCE METHODS **********************/

    // Returns a configuration item by key. Returns null if the key could not be matched.
    this.config = function(key) {
        if (!key) return null;
        if (sauceConfigMap[key]) return sauceConfigMap[key];
        if (apiConfigMap[key]) return apiConfigMap[key];
        if (extensionMap[key]) return extensionMap[key];
        return null;
    };
    // Returns a map of the authentication data for this session. If we aren't 
    // authed yet, this method will return null.
    this.credentials = function(session) {
        // Do parameter checking
        assert.object(session, "session");
        if (session[authTokenSessionKey] && session[authTokenSecretSessionKey]) {
            // We appear to be authed at the moment
            return {
                token: session[authTokenSessionKey],
                tokenSecret: session[authTokenSecretSessionKey]
            };
        } 
        // We're not authed as it happens, so return null
        return null;
    };
    // Creates an api client for this api. This is implemented entirely by 
    // subtypes of OAuth1Api
    this.request = function(session, method, url) {
        // Do parameter check
        assert.string(method, "method");
        assert.string(url, "url");
        // Make the client if it doesn't already exist
        if (!client) {
            client = new Client(this, requestUrl);
        }
        // Use the client to poop out the request object
        return chain = client.request(session, method, url);
    };
    // Identifies this API with a human readable string. Doesn't necessarily
    // have to be the apiName.
    this.identity = function() {
        return apiName;
    };
    // Given the session, returns true if we have already authenticated 
    // against this api.
    this.authed = function(session) {
        // Make sure we have a session
        assert.object(session, "session");
        // First check if there is an expiration
        if (session[authTokenExpirationSessionKey] && session[authTokenExpirationSessionKey] <= (new Date()).getTime()) {
            // This token is no good anymore
            lod.w("'" + apiName + "' api authorization token has expired due to its age.");
            session[authTokenSessionKey] = null;
        }
        // We're authed if we have a token
        if (session[authTokenSessionKey]) {
            return true;
        } else {
            return false;
        }
    };
    // Executes actual authentication. Requires a return url so that we have 
    // somewhere to come back to when authentication is complete.
    this.auth = function(app, req, res, returnUrl) {
        if (!routed) $.route(app); // We route in auth() because this way it doen't interfere with the middleware loading order
        assert.object(app, "app");
        assert.object(req, "req");
        assert.object(res, "res");
        assert.string(returnUrl, "returnUrl");
        // We have to start the OAuth flow by requesting the token
        req.session[SAUCE_SESSION_AUTH_RETURN_URL_KEY] = returnUrl;
        // Build chain
        var chain = {
            success: function(callback) {
                // Put the callback in the cache so that we can call it way later
                assert.funktion("callback", callback);
                // We need to store the callbackCache
                successCallback = callback;
                var callbackId = callbackCache.push(callback, 60000);
                // Get rid of old orphan callbacks
                if (req.session[authSuccessCallbackIdSessionKey]) callbackCache.pop(req.session[authSuccessCallbackIdSessionKey]);
                // Store this new callback id
                req.session[authSuccessCallbackIdSessionKey] = callbackId;

                return chain;
            },
            failure: function(callback) {
                // Put the callback in the cache so that we can call it way later
                assert.funktion("callback", callback);
                // We need to store the callbackCache
                doFailure = callback;
                var callbackId = callbackCache.push(callback, 60000);
                // Get rid of old orphan callbacks
                if (req.session[authFailureCallbackIdSessionKey]) callbackCache.pop(req.session[authFailureCallbackIdSessionKey]);
                // Store this new callback id
                req.session[authFailureCallbackIdSessionKey] = callbackId;

                return chain;
            },
            call: function(callback) {
                if (callback) {
                    assert.funktion("callback", callback);
                    // We need to store the callbackCache
                    var callbackId = callbackCache.push(callback);
                    // Get rid of old orphan callbacks
                    if (req.session[authGeneralCallbackIdSessionKey]) callbackCache.pop(req.session[authGeneralCallbackIdSessionKey]);
                    // Store this new callback id
                    req.session[authGeneralCallbackIdSessionKey] = callbackId;
                }
                // Attempt to get request token
                request({
                    method: "POST",
                    headers: {
                        Authorization: apiUtil.buildAuthHeader({
                            headerPrefix: "OAuth",
                            nonceLength: 32,
                            consumerKey: consumerKey,
                            consumerSecret: consumerSecret,
                            requestUrl: requestTokenUrl,
                            redirectUrl: authRedirectUrl(req, redirectRouteUrl),
                            signatureMethod: extensionMap.authSignatureMethod
                        })
                    },
                    url: requestTokenUrl
                }, function(error, response, body) {
                    if (error || response.statusCode > 299) {
                        if (!error) error = new apiEx.APICallFailureException("Api call to URL '" + requestTokenUrl + "' failed with status code " + response.statusCode + ".\nThe body was as follows: \n" + body);
                        // Died violently - now to shout about it
                        var callback = null;
                        // Fire the fail callbacks
                        if (req.session[authFailureCallbackIdSessionKey]) {
                            callback = callbackCache.pop(req.session[authFailureCallbackIdSessionKey]);
                            req.session[authFailureCallbackIdSessionKey] = null;
                            if (callback) callback(error);
                        }
                        if (req.session[authGeneralCallbackIdSessionKey]) {
                            callback = callbackCache.pop(req.session[authGeneralCallbackIdSessionKey]);
                            req.session[authGeneralCallbackIdSessionKey] = null;
                            if (callback) callback(error);
                        }
                        // Send back a 500
                        res.json(500, error);
                    } else {
                        // Nothing broke - yet
                        var payload = qs.parse(body);
                        // Time to do the redirect
                        var args = {
                            oauth_token: payload.oauth_token
                        };
                        res.redirect(authUrl + "?" + qs.stringify(args));
                    }
                });
            }
        };
        return chain;
    }
    // Creates all routes required by the OAuth 1.0 roundtrip. This involves creating a redirect
    // route that requests the authentication token.
    this.route = function(app) {
        // Internal callback handlers
        // Only route if its our first time
        if (!routed) {
            // Convenience method to uniformly handle the positive case.
            var doSuccess = function(req, token) {
                if (req.session[authSuccessCallbackIdSessionKey]) {
                    var callback = callbackCache.pop(req.session[authSuccessCallbackIdSessionKey]);
                    if (callback) callback(token);
                    else log.w("The success callback for '" + apiName + "' api authentication expired.");
                    // Reset the session's callback memory
                    req.session[authSuccessCallbackIdSessionKey] = null;
                }
                if (req.session[authGeneralCallbackIdSessionKey]) {
                    var callback = callbackCache.pop(req.session[authGeneralCallbackIdSessionKey]);
                    if (callback) callback(null, token);
                    else log.w("The callback for '" + apiName + "' api authentication expired.");
                    // Reset the session's callback memory
                    req.session[authGeneralCallbackIdSessionKey] = null;
                }
            };
            // Convenience method to uniformly handle the negative case.
            var doFailure = function(req, err) {
                if (req.session[authFailureCallbackIdSessionKey]) {
                    var callback = callbackCache.pop(req.session[authFailureCallbackIdSessionKey]);
                    if (callback) callback(err);
                    else log.w("The failure callback for '" + apiName + "' api authentication expired.");
                    // Reset the session's callback memory
                    req.session[authFailureCallbackIdSessionKey] = null;
                }
                if (req.session[authGeneralCallbackIdSessionKey]) {
                    var callback = callbackCache.pop(req.session[authGeneralCallbackIdSessionKey]);
                    if (callback) callback(err);
                    else log.w("The callback for '" + apiName + "' api authentication expired.");
                    // Reset the session's callback memory
                    req.session[authGeneralCallbackIdSessionKey] = null;
                }
            };
            // Gotta make sure we have the app defined
            if (!app) throw new ex.IllegalArgumentException("The express app parameter was null.");
            // Now we register the redirect route
            app.get(redirectRouteUrl, function(req, res) {
                // Read input parameters from service provider
                var requestToken = req.param("oauth_token");
                var requestTokenSecret = req.param("oauth_token_secret");
                var oauthVerifier = req.param("oauth_verifier");
                // Make sure we have token before we go anywhere
                if (!requestToken) {
                    var msg;
                    // TODO we need failure callback here
                    msg = "The 'oauth_token' parameter received in '" + apiName + "' api redirect was null.";
                    log.e(msg);
                    // Let the caller know it didn't work out
                    doFailure(req, new apiEx.APICallFailureException(msg));
                    // Go back to wence we came from, because this didn't work
                    if (req.session[SAUCE_SESSION_AUTH_RETURN_URL_KEY]) res.redirect(req.session[SAUCE_SESSION_AUTH_RETURN_URL_KEY]);
                    else {
                        // Uh oh, return url wasn't provided - that's not fun
                        log.e("The sauce return url was null after finishing authentication for '" + apiName + "' api, so we have to send a 404.");
                        res.send(404);
                    }
                    return;
                } else {
                    // Attempt to get access token
                    request({
                        method: "POST",
                        headers: {
                            Authorization: apiUtil.buildAuthHeader({
                                headerPrefix: "OAuth",
                                nonceLength: 32,
                                consumerKey: consumerKey,
                                consumerSecret: consumerSecret,
                                requestUrl: accessTokenUrl,
                                signatureMethod: extensionMap.authSignatureMethod,
                                token: requestToken,
                                tokenSecret: requestTokenSecret,
                                verifier: oauthVerifier
                            })
                        },
                        url: accessTokenUrl
                    }, function(error, response, body) {
                        if (error || response.statusCode > 299) {
                            if (!error) error = new apiEx.APICallFailureException("Api call to URL '" + accessTokenUrl + "' failed with status code " + response.statusCode + ".\nThe body was as follows: \n" + body);
                            // So close, and yet, so far
                            doFailure(req, error);
                        } else {
                            // Got what we needed, lets finish up
                            var payload = qs.parse(body);
                            req.session[authTokenSessionKey] = payload.oauth_token;
                            req.session[authTokenSecretSessionKey] = payload.oauth_token_secret;
                            // Let's finish up
                            doSuccess(req, payload.oauth_token);
                        }
                        // Go back to wence we came from, because this didn't work
                        if (req.session[SAUCE_SESSION_AUTH_RETURN_URL_KEY]) res.redirect(req.session[SAUCE_SESSION_AUTH_RETURN_URL_KEY]);
                        else {
                            // Uh oh, return url wasn't provided - that's not fun
                            log.e("The sauce return url was null after finishing authentication for '" + apiName + "' api, so we have to send a 404.");
                            res.send(404);
                        }
                    });
                }
            });
        } else {
            throw new apiEx.APIAlreadyRoutedException(apiName);
        }
    };
    // Init is now complete
    log.d("'" + apiName + "' api was initialized successfully.");
};