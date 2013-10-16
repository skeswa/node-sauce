var ex = require("./exception.js");
var log = require("./log.js");
var path = require("path");
var fs = require("fs");

var app = null;
var config = null;
var apis = null;
var internalApiNameList = null;

var INTERNAL_API_PATH = path.resolve(path.join(".", "lib", "apis"));

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
}

var route = function(method, routePath, apis, callback) {

}

module.exports = {
    express: function(_app) {
        if (!app) {
            log.d("Express application specified successfully.");
            app = _app;
        } else {
            log.e("Express application has already been specified.");
            // We've already initialized the express app, so panic
            throw new ex.ExpressApplicationAlreadySpecifiedException();
        }
        // Returned for chaining purposes
        return module.exports;
    },
    configure: function(_config) {
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
        return module.exports;
    },
    api: function(apiName, apiConfig) {
        if (!apiName) throw new ex.IllegalArgumentException("Sauce.api(...) requires the 'apiName' parameter.");
        if (!apis) apis = {};
        if (!apis[apiName]) {
            // First make sure that the express app has been loaded already
            if (!app) {
                log.e("Express application must be specified to load an API.");
                throw new ex.ExpressApplicationNotYetSpecifiedException();
            }
            // Next, is it an external or internal api name
            if (isInternalApiName(apiName)) {
                apis[apiName] = require(path.join(INTERNAL_API_PATH, apiName + ".js"));
                if (!config) config = {};
                apis[apiName].register(app, config, apiConfig);
            } else {
                // We have to check this is legit first
                if (!fs.existsSync(apiName)) throw new ex.IllegalArgumentException("'" + apiName + "' is not a valid file.");
                var mod;
                try {
                    mod = require(apiName);
                } catch (err) {
                    throw new ex.IllegalArgumentException("'" + apiName + "' is not a valid Node.js module (could not require it).");
                }
                // Check that it has all the correct methods
                if (!(mod.register && getClass.call(mod.register) == "[object Function]")) throw new ex.IllegalArgumentException("'" + apiName + "' is not a valid Sauce api: it does not have a *.register(...) function.");
                if (!(mod.isAuthed && getClass.call(mod.isAuthed) == "[object Function]")) throw new ex.IllegalArgumentException("'" + apiName + "' is not a valid Sauce api: it does not have a *.isAuthed(...) function.");
                if (!(mod.doAuth && getClass.call(mod.doAuth) == "[object Function]")) throw new ex.IllegalArgumentException("'" + apiName + "' is not a valid Sauce api: it does not have a *.doAuth(...) function.");
                if (!(mod.getClient && getClass.call(mod.getClient) == "[object Function]")) throw new ex.IllegalArgumentException("'" + apiName + "' is not a valid Sauce api: it does not have a *.getClient(...) function.");
                // Valid enough for now, lol
                apis[apiName] = mod;
                if (!config) config = {};
                apis[apiName].register(app, config, apiConfig);
            }
        }
        // Next we build the return object
        var chainObj = {
            client: apis[apiName].getClient
        };
        for (var fieldName in module.exports) {
            chainObj[fieldName] = module.exports[fieldName];
        }
        return chainObj;
    },
    route: route
}