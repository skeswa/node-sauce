var ex = require("../../exception.js");
var log = require("../../log.js");

var request = require("request");
var underscore = require("underscore");

var OAuth2Client = function(baseUrl, accessToken, config) {
	var apiRequest = function(method, url) {
		if (!url) throw new ex.IllegalArgumentException("url was null");
		if (!method) throw new ex.IllegalArgumentException("method was null");
		// We have to make sure that its a full URL if baseUrl is null
		if (!baseUrl && !isValidUrl(url)) {
			throw new IllegalArgumentException("This API's client requires a fully qualified URL to make an API call. '" + url + "' is not considered valid.");
		}

		var successCallback = null;
		var failureCallback = null;
		var payload = null;
		var contentType = null;
		var accept = null;
		var chainObj = {
			payload: function(_payload) {
				if (!_payload) throw new ex.IllegalArgumentException("payload was null");
				if (!underscore.isObject(_payload)) throw new ex.IllegalArgumentException("payload must be an object");

				payload = _payload;

				return chainObj;
			},
			success: function(_callback) {
				if (!_callback) throw new ex.IllegalArgumentException("success callback was null");
				if (!underscore.isFunction(_callback)) throw new ex.IllegalArgumentException("success callback must be a function");

				successCallback = _callback;

				return chainObj;
			},
			failure: function(_callback) {
				if (!_callback) throw new ex.IllegalArgumentException("failure callback was null");
				if (!underscore.isFunction(_callback)) throw new ex.IllegalArgumentException("failure callback must be a function");

				failureCallback = _callback;

				return chainObj;
			},
			sends: function(_contentType) {
				if (!_contentType) {
					contentType = null;
					return chainObj;
				}
				if (!underscore.isString(_contentType)) throw new ex.IllegalArgumentException("content type must be a string");

				contentType = convertContentTypeAbbreviation(_contentType);

				return chainObj;
			},
			receives: function(_accept) {
				if (!_accept) {
					accept = null;
					return chainObj;
				}
				if (!underscore.isString(_accept)) throw new ex.IllegalArgumentException("accept must be a string");

				accept = convertContentTypeAbbreviation(_accept);

				return chainObj;
			},
			call: function(cb) {
				// This block is everything to do with the HTTP headers for the request
				var headers = {};
				if (accept) headers["Accept"] = accept;
				if (contentType) headers["Content-Type"] = contentType;
				if (!config.excludeAuthorizationHeader)
					headers["Authorization"] = (config.authorizationHeaderPrefix ? config.authorizationHeaderPrefix : "OAuth") + " " + accessToken;

				// This block is everything to do with the query string for the request
				var qs = null;
				if (config.authorizationTokenParameterKey) {
					if (!qs) qs = {};
					qs[config.authorizationTokenParameterKey] = accessToken;
				}

				// This block is everything we need for the request(..) method
				var options = {};
				if (payload) {
					if (underscore.isString(payload)) {
						// Strings ae the body of the HTTP req - just makes sense
						options["body"] = payload;
					} else if (underscore.isObject(payload)) {
						if (!contentType || contentType === "application/json") {
							options["json"] = payload;
						}
						if (contentType === "application/x-www-form-urlencoded") {
							options["form"] = payload;
						} else {
							// TODO figure out a better strategy for figuring out what to do
							throw new ex.IllegalArgumentException("The payload must be a string for content type of '" + contentType + "'.");
						}
					}
				}
				// If there is a query string, include it
				if (qs) {
					options["qs"] = qs;
				}
				options["method"] = method;
				options["headers"] = headers;
				// If we have a baseUrl, add it to the 'url', if not just use the 'url'
				if (baseUrl) {
					if (baseUrl.charAt(baseUrl.length - 1) !== "/") baseUrl = "/" + baseUrl;
					if (url.charAt(0) === "/") url = url.slice(1);
					options["url"] = baseUrl + url;
				} else {
					options["url"] = url;
				}
				// Time to ship the request
				request(options, function(error, response, body) {
					if (error || response.statusCode > 299 || response.statusCode < 200) {
						if (!error) error = new ex.APICallFailureException("API call to URL '" + options["url"] + "' failed with status code " + response.statusCode + ". The body was as follows: \n" + body);
						// If .failure(..) was called, then we have to send the callback
						if (failureCallback) {
							failureCallback(error);
						}
						// Fire the prototypical callback if its defined
						if (cb) {
							cb(error);
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
						if (cb) {
							cb(null, result);
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

module.exports = OAuth2Client;