/**************************** EXTERNAL IMPORTS *******************************/

var underscore = require("underscore"); // For general utility methods
var qs = require("querystring"); // For reading authentication responses
var rs = require("randomstring"); // For nonce generation
var crypto = require("crypto"); // For signature generation
var URL = require("url"); // For url analysis

/**************************** INTERNAL IMPORTS *******************************/

var assert = require("../../assert.js");
var ex = require("../../exception.js");
var log = require("../../log.js");

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
/* Combines object fields into an authentication header which is comliant
 * with the OAuth 1.0 standard.
 *
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
 *          - queryParams - OPTIONAL - Map/Object - The parameters of api request (N/A for auth calls)
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
    // Add the query params (if there are any)
    if (underscore.isObject(args.queryParams)) {
        for (var queryParamKey in args.queryParams) {
            if (!underscore.isObject(args.queryParams[queryParamKey]) && !underscore.isFunction(args.queryParams[queryParamKey]))
                headerMap[queryParamKey] = args.queryParams[queryParamKey];
        }
    }
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

/***************************** MODULE EXPORTS ********************************/

module.exports.buildAuthHeader = authHeader;