var log = require("./log.js");
var path = require("path");
var fs = require("fs");

var context = null;

var loadApis = function(app, config, callback) {
    var apiPath = path.join(".", "lib", "apis");
    fs.readdir(apiPath, function(err, files) {
        if (err) {
            log.e("init-loadapis", "Could not load files in the api path ('" + apiPath + "').", err);
            callback(err);
            return;
        } else {
            log.d("init-loadapis", "Now loading " + files.length + " apis in path ('" + apiPath + "').");
            var apiMap = {};
            var currApi, finishCount = 0;
            if (files.length) {
                for (var i = 0; i < files.length; i++) {
                    if (files[i] && files[i].indexOf(".js") != -1) {
                        currApi = require(path.join(apiPath, files[i]));
                        currApi.bind(app, config, function(err) {
                            if (err) {
                                log.e("init-loadapis", "API in file '" + files[i] + "' could not be loaded.", err);
                            } else {
                                var apiName = file[i].replace(".js", "");
                                log.d("init-loadapis", "'" + apiName + "' API loaded successfully.");
                                apiMap[file[i].replace(".js", "")] = currApi;
                            }
                            // Count how many things are done
                            finishCount++;
                            // If we're done, finish
                            if (finishCount >= files.length) {
                                log.d("init-loadapis", "API loading complete.");
                                callback(null, apiMap);
                                return;
                            }
                        });
                    }
                }
            } else {
                log.d("init-loadapis", "API loading complete.");
                callback(null, apiMap);
                return;
            }
        }
    });
}

var init = function(app, config, callback) {
    context = {};
    context._app = app;
    context._config = config;
    // Load all the stuffs mang
    log.d("init", "Sauce now initializing.");
    loadApis(app, config, function(err, apiMap) {
        if (err) {
            log.e("init", "Sauce initialization failed.", err);
            callback(err);
        } else {
            context.apis = apiMap;
            // Finish
            log.d("init", "Sauce initialized successfully.");
            callback();
        }
    });
};

module.exports = function(app, config, callback) {
    if (!context) {
        init(app, config, function(err) {
            if (err) {
                callback(err);
            } else {
                callback(null, context);
            }
        })
    } else {
        callback(null, context);
    }
};