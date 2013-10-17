var ex = require("./exception.js");
var log = require("./log.js");
var path = require("path");
var fs = require("fs");

var app = null; // The express app
var config = null; // General sauce configuration
var apis = null; // Map of apiName to api instance
var internalApiNameList = null; // List of internal apiNames

var INTERNAL_API_PATH = path.resolve(path.join(".", "lib", "apis")); // Path to internal APIs root directory

// Returns true if the provided name refers to an intenal API. False if it doesn't.
var isInternalApiName = function(name) {
    if (name.indexOf(".js") != -1 || name.indexOf(path.sep) != -1) return false;
    // If its empty load it
    if (!internalApiNameList) {
        internalApiNameList = [];
        var files = fs.readdirSync(INTERNAL_API_PATH);
        for (var i = 0; i < files.length; i++) {
            internalApiNameList.push(files[i].replace(".js", ""));
        }
    }
    // Check if its in the list
    if (internalApiNameList.indexOf(name) != -1) {
        return true;
    } else {
        return false;
    }
};
// Returns null if the provided apiName refers to a valid external API. Otherwise, it returns an exception.
var isValidExternalApiName = function(apiName) {
    if (path.extname(apiName) !== ".js") return new ex.IllegalArgumentException("Sauce apis must be individual javascript files. '" + apiName + "' didn't have the *.js file extension.");
    // We have to check this is legit first
    if (!fs.existsSync(apiName)) return new ex.IllegalArgumentException("'" + apiName + "' is not a nonexistent file.");
    var mod;
    try {
        mod = require(apiName);
    } catch (err) {
        throw new ex.IllegalArgumentException("'" + apiName + "' is not a valid Node.js module (could not require it).");
    }
    // Check that it has all the correct methods
    if (!(mod.register && getClass.call(mod.register) == "[object Function]")) return new ex.IllegalArgumentException("'" + apiName + "' is not a valid Sauce api: it does not have a *.register(...) function.");
    if (!(mod.isAuthed && getClass.call(mod.isAuthed) == "[object Function]")) return new ex.IllegalArgumentException("'" + apiName + "' is not a valid Sauce api: it does not have an *.authed(...) function.");
    if (!(mod.doAuth && getClass.call(mod.doAuth) == "[object Function]")) return new ex.IllegalArgumentException("'" + apiName + "' is not a valid Sauce api: it does not have an *.auth(...) function.");
    if (!(mod.getClient && getClass.call(mod.getClient) == "[object Function]")) return new ex.IllegalArgumentException("'" + apiName + "' is not a valid Sauce api: it does not have a *.makeClient(...) function.");
    // Good for now
    return null;
}

// The exports object
var exp = {};

var api = function(apiName, apiConfig) {
    if (!app) throw new ex.ExpressApplicationNotYetBoundException();
    if (!apiName) throw new ex.IllegalArgumentException("Sauce.api(...) requires the 'apiName' parameter.");
    if (!apiConfig) throw new ex.IllegalArgumentException("Sauce.api(...) requires the 'apiConfig' parameter.");
    if (!apis) apis = {};
    if (!apis[apiName]) {
        // First make sure that the express app has been loaded already
        if (!app) {
            log.e("Express application must be specified to load an API.");
            throw new ex.ExpressApplicationNotYetBoundException();
        }
        // Next, is it an external or internal api name
        if (isInternalApiName(apiName)) {
            apis[apiName] = require(path.join(INTERNAL_API_PATH, apiName + ".js"));
            if (!config) config = {};
            apis[apiName].register(app, config, apiConfig);
        } else {
            // We have to check this is legit first
            var problem;
            if (!(problem = isValidExternalApiName(apiName))) {
                var module = require(apiName);
                // Clean up the apiName
                apiName = path.basename(apiName, ".js");
                // Valid enough for now, lol
                apis[apiName] = mod;
                if (!config) config = {};
                apis[apiName].register(app, config, apiConfig);
            } else {
                // Yikes, ran into an issue
                throw problem;
            }
        }
    }
    // Next we build the return object
    var chainObj = {
        client: apis[apiName].getClient
    };
    for (var fieldName in exp) {
        chainObj[fieldName] = exp[fieldName];
    }
    return chainObj;
};
exp.api = api;

var bind = function(_app) {
    if (!app) {
        log.d("Express application bound successfully.");
        app = _app;
    } else {
        log.e("Express application has already been bound.");
        // We've already initialized the express app, so panic
        throw new ex.ExpressApplicationAlreadyBoundException();
    }
    // Returned for chaining purposes
    return exp;
};
exp.bind = bind;

var configure = function(_config) {
    if (!config) {
        log.d("Sauce configuration defined successfully.");
        config = _config;
    } else {
        // Update existing config
        for (var fieldName in _config) {
            config[fieldName] = _config[fieldName];
        }
        log.d("Sauce configuration updated successfully.");
    }
    // Returned for chaining purposes
    return exp;
};
exp.configure = configure;

var express = function() {
    if (!app) throw new ex.ExpressApplicationNotYetBoundException();
    // In the middleware function, do auth of all the necessary APIs
    return function(req, res) {
        if (!req.sauce) req.sauce = {};
        if (!req.sauce.apis) {
            req.sauce.apis = {};
            // Returns true if we had to execute OAuth roundtrip
            req.sauce.apis.auth = function() {
                for (var apiName in apis) {
                    if (!apis[apiName].authed(req)) {
                        apis[apiName].auth(req, res);
                        return true;
                    }
                }
                return false;
            }
        }
        // Add api wrappers if necessary
        for (var apiName in apis) {
            if (!req.sauce.apis[apiName]) {
                var apiWrapper = (req.sauce.apis[apiName] = {});
                var apiClient = null;
                apiWrapper.auth = function() {
                    if (!req.session) throw new ex.ExpressSessionUndefinedException();
                    if (!apis[apiName].authed(req.session)) {
                        apis[apiName].auth(req, res);
                        return true;
                    } else {
                        return false;
                    }
                };
                apiWrapper.client = function() {
                    if (!req.session) throw new ex.ExpressSessionUndefinedException();
                    if (!apiClient) {
                        apiClient = apis[apiName].makeClient(req.session);
                    }
                    return apiClient;
                };
            }
        }
    };
}
exp.express = express;
// Export our export object
module.exports = exp;