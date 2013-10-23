var ex = require("../../exception.js");

var Wrapper = function(api, app, req, res) {
    var apiClient = null;

    this.identity = function() {
        return api.identity();
    };
    this.authed = function() {
        return api.authed(req.session);
    };
    this.auth = function(returnUrl) {
        api.auth(app, req, res, returnUrl);
    };
    this.client = function() {
        if (!req.session) throw new ex.ExpressSessionUndefinedException();
        if (!apiClient) {
            apiClient = api.makeClient(req.session);
        }
        return apiClient;
    };
}

module.exports = Wrapper;