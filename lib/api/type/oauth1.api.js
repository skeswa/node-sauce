/**************************** EXTERNAL IMPORTS *******************************/

var md5 = require("MD5");
var request = require("request");
var underscore = require("underscore");
var qs = require("querystring");
var rs = require("randomstring");
var crypto = require("crypto");
var URL = require("url");

/**************************** INTERNAL IMPORTS *******************************/

var assert = require("../../assert.js");
var ex = require("../../exception.js");
var apiEx = require("../api.exceptions.js");
var log = require("../../log.js");
var callbackCache = require("../../session/callback.cache.js");
var Client = null; // TODO require("../client/oauth2.client.js");

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

/***************************** HELPER METHODS ********************************/

// Percent encodes an arbitrary string
var encode = function(str) {
    return encodeURIComponent(str).replace(/\!/g, "%21")
        .replace(/\'/g, "%27")
        .replace(/\(/g, "%28")
        .replace(/\)/g, "%29")
        .replace(/\*/g, "%2A");
}
// Builds the oauth_signature from the given parameters
var signature = function(method, url, params, signatureMethod, consumerSecret, tokenSecret) {
    // Got this from https://github.com/ciaranj/node-oauth/blob/master/lib/oauth.js
    var parsedUrl = URL.parse(url, true);
    var port = "";
    if (parsedUrl.port) {
        if ((parsedUrl.protocol == "http:" && parsedUrl.port != "80") ||
            (parsedUrl.protocol == "https:" && parsedUrl.port != "443")) {
            port = ":" + parsedUrl.port;
        }
    }
    var normalizedUrl = parsedUrl.protocol + "//" + parsedUrl.hostname + port + parsedUrl.pathname;
    // Make sure the strings are encoded
    normalizedUrl = encode(normalizedUrl);
    // We need to put together the signature query string
    var encodedParams = [];
    // Put all of the params into the encoded array
    for (var paramKey in params) {
        encodedParams.push(encode(paramKey) + "=" + encode(params[paramKey]));
    }
    // Sort the strings alphabetically
    encodedParams.sort();
    // Join the elements by '&'
    var paramQueryString = encode(encodedParams.join("&"));
    // Create the signature base
    var signatureBase = encode(method.toUpperCase()) + "&" + normalizedUrl + "&" + paramQueryString;
    // Time to play the crypto game
    if (!tokenSecret) tokenSecret = "";
    else tokenSecret = encode(tokenSecret);
    // To make the key, we smush consumerSecret and tokenSecret together
    var signingKey = encode(consumerSecret) + "&" + encode(tokenSecret);
    // The hash will become the signature that we're ultimately attempting to build
    var hash = "";
    if (signatureMethod === "PLAINTEXT") {
        hash = signingKey; // <3 plain text, too bad its the worst
    } else if (signatureMethod === "HMAC-SHA1") {
        // In place to flexible with different node versions
        if (crypto.Hmac) {
            hash = crypto.createHmac("sha1", signingKey).update(signatureBase).digest("base64");
        } else {
            hash = sha1.HMACSHA1(signingKey, signatureBase);
        }
    } else {
        throw new ex.UnsupportedOperationException("Cannot generate an oauth signature via method '" + signatureMethod + "' - its unsupported.");
    }
    // Return the hashed signature
    return hash;
}
/* Combines object fields into an auth header
 * @param args
 *      Properties of Args:
 *          - httpMethod - OPTIONAL - String - HTTP method for signature calculation (typically "POST")
 *          - headerPrefix - OPTIONAL - String - What precedes the auth header string (typically "OAuth")
 *          - nonceLength - OPTIONAL - Integer - Length of nonce (defaults to 32)
 *          - consumerKey - REQUIRED - String - The api consumer key
 *          - consumerSecret - REQUIRED - String - The api consumer secret
 *          - requestUrl - REQUIRED - String - The url that this header is ultimately being submitted to
 *          - redirectUrl - OPTIONAL - String - Full redirect url for this api
 *          - signatureMethod - OPTIONAL - String - Method for signature encyption; defaults to HMAC-SHA1
 *          - verifier - OPTIONAL - String - Used for extra security in some apis
 *          - token - OPTIONAL - String - The token obtained from the latest api request
 *          - tokenSecret - OPTIONAL - String - The token secret obtained from the latest api request
 */
var authHeader = function(args) {
    // Do check for required fields
    assert.string(args.consumerKey, "consumerKey");
    assert.string(args.requestUrl, "requestUrl");
    assert.string(args.consumerSecret, "consumerSecret");
    // First we make the map
    var headerMap = {};
    headerMap["oauth_consumer_key"] = args.consumerKey;
    if (underscore.isString(args.redirectUrl)) headerMap["oauth_callback"] = args.redirectUrl;
    headerMap["oauth_timestamp"] = Math.floor((new Date).getTime() / 1000);
    headerMap["oauth_nonce"] = rs.generate(args.nonceLength || 32);
    headerMap["oauth_version"] = "1.0";
    if (underscore.isString(args.token)) headerMap["oauth_token"] = args.token;
    // Now lets decide what signature method will look like
    if (!underscore.isString(args.signatureMethod)) {
        // Then we default to HMAC-SHA1
        args.signatureMethod = "HMAC-SHA1";
    }
    if (underscore.isString(args.verifier)) headerMap["oauth_verifier"] = args.verifier;
    headerMap["oauth_signature_method"] = args.signatureMethod;
    // Build the signature
    headerMap["oauth_signature"] = signature(args.httpMethod || "POST", args.requestUrl, headerMap, args.signatureMethod, args.consumerSecret, args.tokenSecret);
    // Poop it into a string
    var headerArray = [];
    // Put all of the headerMap into the encoded array
    for (var paramKey in headerMap) {
        headerArray.push(paramKey + "=\"" + encode(headerMap[paramKey]) + "\"");
    }
    // Sort the param array
    headerArray.sort();
    // Collapse the array into a string
    return (args.headerPrefix || "OAuth") + " " + headerArray.join(",");
}
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
 *          - excludesRedirectUri - OPTIONAL - Boolean - true if this api SHOULD NOT include redirect_uri in token request
 *          - authTokenGrantType - OPTIONAL - String - specifies the grant_type parameter for the token request
 *          - authResponseType - OPTIONAL - String - specifies the response_type paramter for the auth request
 *          - authRequiresState - OPTIONAL - Boolean - specifies whether this api needs the state string for the auth request
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
    // Ok, we got this far, sweet, we need soome basic state flags
    var routed = false;

    /********************** INSTANCE METHODS **********************/

    // Creates an api client for this api. This is implemented entirely by 
    // subtypes of OAuth1Api
    this.makeClient = function(session) {
        // TODO
        return null;
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
                        Authorization: authHeader({
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
                            Authorization: authHeader({
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