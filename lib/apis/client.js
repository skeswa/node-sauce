var ex = require("../exception.js");
var log = require("../log.js");

var request = require("request");
var underscore = require("underscore");

var Client = function(baseUrl, accessToken) {
	var endpoint = function(method, url) {
		if (!url) throw new ex.IllegalArgumentException("url was null");
		if (!method) throw new ex.IllegalArgumentException("method was null");

		var successCallback = null;
		var failureCallback = null;
		var payload = null;
		var contentType = "application/json";
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

				if (_contentType === "json") contentType = "application/json";
				if (_contentType === "xml") contentType = "application/xml";
				if (_contentType === "html") contentType = "text/html";
				if (_contentType === "text" || _contentType === "plain") contentType = "text/plain";
				if (_contentType === "form") contentType = "application/x-www-form-urlencoded";
				else contentType = _contentType;

				return chainObj;
			},
			receives: function(_accept) {
				if (!_accept) {
					accept = null;
					return chainObj;
				}
				if (!underscore.isString(_accept)) throw new ex.IllegalArgumentException("accept must be a string");

				if (_accept === "json") accept = "application/json";
				if (_accept === "xml") accept = "application/xml";
				if (_accept === "html") accept = "text/html";
				if (_accept === "text" || _accept === "plain") accept = "text/plain";
				if (_accept === "form") accept = "application/x-www-form-urlencoded";
				else accept = _accept;

				return chainObj;
			},
			call: function() {
				if (!successCallback) throw new ex.IllegalStateException("call requires that at least success callback is specified");
				var headers = {};
				if (accept) headers["Accept"] = accept;
				if (contentType) headers["Content-Type"] = contentType;
				headers["Authorization"] = "OAuth " + accessToken; // TODO, this is OAuth 2.0 specific

				var options = {};
				if (payload) {
					if (contentType === "application/json") {
						options["json"] = payload;
					} else if (contentType === "application/x-www-form-urlencoded") {
						options["form"] = payload;
					} else {
						options["qs"] = payload;
					}
				}
				options["method"] = method;
				options["headers"] = headers;
				if (baseUrl.charAt(baseUrl.length - 1) !== "/") baseUrl = "/" + baseUrl;
				if (url.charAt(0) === "/") url = url.slice(1);
				options["url"] = baseUrl + url;

				request(options, function(error, response, body) {
					if (error || response.statusCode > 299 || response.statusCode < 200) {
						if (failureCallback) {
							if (!error) error = new ex.APICallFailureException("API call to URL '" + options["url"] + "' failed with status code " + response.statusCode);
							failureCallback(error, response, body);
						}
					} else {
						var result = null;
						if (response.headers["content-type"].toLowerCase().indexOf("application/json") !== -1) {
							result = JSON.parse(body);
						} else {
							result = body;
						}
						successCallback(result);
					}
				});
			}
		}
		return chainObj;
	}

	this.get = function(url) {
		return endpoint("GET", url);
	}

	this.post = function(url) {
		return endpoint("POST", url);
	}

	this.put = function(url) {
		return endpoint("PUT", url);
	}
}

module.exports = Client;