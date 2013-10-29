var md5 = require("MD5");
var request = require("request");
var underscore = require("underscore");
var qs = require("querystring");
var rs = require("randomstring");
var crypto = require("crypto");
var URL = require("url");

// Percent encodes an arbitrary string
var encode = function(str) {
    return encodeURIComponent(str).replace(/!/g, "%21");
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
    console.log("before sort :: " + encodedParams);
    encodedParams.sort();
    console.log("after sort :: " + encodedParams);
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
        throw new Error("Cannot generate an oauth signature via method '" + signatureMethod + "' - its unsupported.");
    }
    // Return the hashed signature
    return hash;
}

console.log("signature = " + signature("POST", "https://api.twitter.com/1/statuses/update.json", {
    status: "Hello Ladies + Gentlemen, a signed OAuth request!",
    include_entities: true,
    oauth_consumer_key: "xvz1evFS4wEEPTGEFPHBog",
    oauth_nonce: "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg",
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: 1318622958,
    oauth_token: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb",
    oauth_version: "1.0"
}, "HMAC-SHA1", "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw", "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE"));