/**************************** EXTERNAL IMPORTS *******************************/

var request = require("request"); // For making REST calls
var underscore = require("underscore"); // For general utility methods
var qs = require("querystring");

/**************************** INTERNAL IMPORTS *******************************/

var assert = require("../../assert.js");
var ex = require("../../exception.js");
var apiEx = require("../api.exceptions.js");
var log = require("../../log.js");

/*************************** OBJECT DEFINITIONS ******************************/

/* Client makes requests against the api service provider. 
 *
 * @param baseUrl - NULLABLE - String - the url fragment consistent in every REST call
 * @param authHeaderFactory - REQUIRED - Function - a function that when invoked creates an up-to-date authorization header string; it should take the HTTP method and url as parameters
 * @param config - REQUIRED - Object/Map - configuration map for client
 *      Properties of Config:
 */
var OAuth1Client = function(baseUrl, authHeaderFactory, config) {
    // Do parameter checking
    assert.string(baseUrl, "baseUrl");
    assert.funktion(authHeaderFactory, "authHeaderFactory");
    assert.object(config, "config");
    // Action method
    var apiRequest = function(method, url) {
        // Do parameter checking
        assert.string(url, "url");
        assert.string(method, "method");
        // We have to make sure that its a full URL if baseUrl is null
        if (!baseUrl && !isValidUrl(url)) {
            throw new IllegalArgumentException("This api's client requires a fully qualified URL to make an API call. '" + url + "' is not considered valid.");
        }
        // Chain instance mthods
        var successCallback = null;
        var failureCallback = null;
        var payload = null;
        var contentType = null;
        var accept = null;
        // Chain object
        var chainObj = {
            payload: function(_payload) {
                assert.object(_payload, "payload");
                payload = _payload;
                return chainObj;
            },
            success: function(_callback) {
                assert.funktion(_callback, "callback");
                successCallback = _callback;
                return chainObj;
            },
            failure: function(_callback) {
                assert.funktion(_callback, "callback");
                failureCallback = _callback;
                return chainObj;
            },
            sends: function(_contentType) {
                if (!_contentType) {
                    contentType = null;
                    return chainObj;
                }
                if (!underscore.isString(_contentType)) throw new ex.IllegalArgumentException("The 'contentType' parameter must be a string.");
                contentType = convertContentTypeAbbreviation(_contentType);
                return chainObj;
            },
            receives: function(_accept) {
                if (!_accept) {
                    accept = null;
                    return chainObj;
                }
                if (!underscore.isString(_accept)) throw new ex.IllegalArgumentException("The 'accept' parameter must be a string.");
                accept = convertContentTypeAbbreviation(_accept);
                return chainObj;
            },
            call: function(_callback) {
                // This block is everything we need for the request(..) method
                var options = {};
                // If we have a baseUrl, add it to the 'url', if not just use the 'url'
                if (baseUrl) {
                    if (baseUrl.charAt(baseUrl.length - 1) !== "/") baseUrl = "/" + baseUrl;
                    if (url.charAt(0) === "/") url = url.slice(1);
                    options["url"] = baseUrl + url;
                } else {
                    options["url"] = url;
                }
                // This block is everything to do with the HTTP headers for the request
                var headers = {
                    Authorization: authHeaderFactory(method, options["url"], payload)
                };
                if (accept) headers["Accept"] = accept;
                if (contentType) headers["Content-Type"] = contentType;
                options["headers"] = headers;
                options["method"] = method;
                // Process the payload parameter
                if (payload) {
                    if (underscore.isString(payload)) {
                        // Strings ae the body of the HTTP req - just makes sense
                        options["body"] = payload;
                    } else if (underscore.isObject(payload)) {
                        if (!contentType) {
                            // Do HTTP method check
                            if (method.toUpperCase() === "GET") {
                                options["qs"] = payload;
                            } else {
                                // Treat everything else like POST - put the querystring in the body
                                options["body"] = qs.stringify(payload);
                            }
                        } else if (contentType === "application/json") {
                            options["json"] = payload;
                        } else if (contentType === "application/x-www-form-urlencoded") {
                            options["form"] = payload;
                        } else {
                            // TODO figure out a better strategy for figuring out what to do
                            throw new ex.IllegalArgumentException("The payload must be a string for content type of '" + contentType + "'.");
                        }
                    }
                }
                // Time to ship the request
                request(options, function(error, response, body) {
                    if (error || response.statusCode > 299 || response.statusCode < 200) {
                        if (!error) error = new apiEx.APICallFailureException("Api call to URL '" + options["url"] + "' failed with status code " + response.statusCode + ". The body was as follows: \n" + body);
                        // If .failure(..) was called, then we have to send the callback
                        if (failureCallback) {
                            failureCallback(error);
                        }
                        // Fire the prototypical callback if its defined
                        if (_callback) {
                            _callback(error);
                        }
                    } else {
                        var result = null;
                        // TODO add XML object reconstruction
                        if (response.headers["content-type"].toLowerCase().indexOf("application/json") !== -1) {
                            result = JSON.parse(body);
                        } else {
                            result = body;
                        }
                        // If .success(..) was called, then we have to send the callback
                        if (successCallback) {
                            successCallback(result);
                        }
                        // Fire the prototypical callback if its defined
                        if (_callback) {
                            _callback(null, result);
                        }
                    }
                });
            }
        }
        return chainObj;
    }

    this.get = function(url) {
        return apiRequest("GET", url);
    }

    this.post = function(url) {
        return apiRequest("POST", url);
    }

    this.put = function(url) {
        return apiRequest("PUT", url);
    }
}

var isValidUrl = function(str) {
    var pattern = new RegExp('^(https?:\/\/)?' + // protocol
        '((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|' + // domain name
        '((\d{1,3}\.){3}\d{1,3}))' + // OR ip (v4) address
        '(\:\d+)?(\/[-a-z\d%_.~+]*)*' + // port and path
        '(\?[;&a-z\d%_.~+=-]*)?' + // query string
        '(\#[-a-z\d_]*)?$', 'i'); // fragment locater
    if (!pattern.test(str)) {
        return false;
    } else {
        return true;
    }
}

var convertContentTypeAbbreviation = function(contentType) {
    if (contentType === "json") return "application/json";
    if (contentType === "xml") return "application/xml";
    if (contentType === "html") return "text/html";
    if (contentType === "text" || contentType === "plain") return "text/plain";
    if (contentType === "form") return "application/x-www-form-urlencoded";
    else return contentType;
}

module.exports = OAuth1Client;