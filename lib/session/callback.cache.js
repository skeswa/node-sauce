var md5 = require("MD5");
var util = require("util");

var ex = require("../exception.js");
var log = require("../log.js");

var cache = {};

var CallbackTimeoutException = function(_message) {
    Error.captureStackTrace(this, this);
    this.message = _message;
}
util.inherits(CallbackTimeoutException, Error);
CallbackTimeoutException.prototype.name = "CallbackTimeoutException";
module.exports.CallbackTimeoutException = CallbackTimeoutException;

var push = function(callback, timeout) {
    if (!callback) throw new ex.IllegalArgumentException("The callback parameter was null.");

    var key = md5((new Date()).getTime() + ";" + Object.keys(cache).length + ";" + timeout);
    cache[key] = callback;
    if (timeout) {
        setTimeout(function() {
            if (cache[key]) {
                cache[key](new CallbackTimeoutException("This callback has timed out."));
                log.d("Callback in callback cache with key '" + key + "' just expired.");
            }
        }, timeout);
    }

    return key;
}

var pop = function(key) {
    var callback = cache[key];
    if (callback) {
        // Delete the callback from the cache
        cache[key] = null;
        delete cache[key];
    }
    return cache[key];
}

module.exports.push = push;
module.exports.pop = pop;