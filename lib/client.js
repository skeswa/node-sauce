var ex = require("./exception.js");
var request = require("request");

var Client = function(baseUrl, accessToken) {
	var endpoint = function(method, url) {
		if (!url) throw new ex.IllegalArgumentException("url was null");
		if (!method) throw new ex.IllegalArgumentException("method was null");

		var successCallback = null;
		var failureCallback = null;
		var payload = null;
		var chainObj = {
			payload: function(_payload) {
				if (!_payload) throw new ex.IllegalArgumentException("payload was null");
				payload = _payload;
				return chainObj;
			},
			success: function(_callback) {
				if (!_callback) throw new ex.IllegalArgumentException("success callback was null");
				successCallback = _callback;
				return chainObj;
			},
			failure: function(_callback) {
				if (!_callback) throw new ex.IllegalArgumentException("failure callback was null");
				failureCallback = _callback;
				return chainObj;
			},
			call: function() {
				if (!successCallback) throw new ex.IllegalStateException("call requires that at least success callback is specified");
				request({
					method: method,
					json: payload,
					headers: { //TODO: this only applies to google really
						"Content-Type": "application/json",
						"Authorization": "OAuth " + accessToken
					},
					url: baseUrl + url
				}, function(error, response, body) {
					if (error) {
						if (failureCallback) failureCallback(error, response, body);
					} else {
						var bodyJson = JSON.parse(body);
						successCallback(bodyJson);
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