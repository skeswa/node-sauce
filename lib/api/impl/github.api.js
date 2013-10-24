var request = require("request");
var qs = require("querystring");
var md5 = require("MD5");

var ex = require("../../exception.js");
var log = require("../../log.js");
var Client = require("../util/client.js");

var API_NAME = "github";
var DEFAULT_API_ROOT = "/sauce/apis";

var GITHUB_BASE_URL = "https://api.github.com/";
var GITHUB_OAUTH_AUTH_URL = "https://github.com/login/oauth/authorize";
var GITHUB_OAUTH_TOKEN_URL = "https://github.com/login/oauth/access_token";
var SESSION_TOKEN_ID = "githubApiToken";

var CLIENT_ID = null;
var CLIENT_SECRET = null;
var SCOPES = null;
var API_ROOT = null;
var API_REDIRECT_URL = null;

var initialized = false;
var routed = false;

var identity = function () {
    return API_NAME;
}

var init = function(config, apiConfig) {
    if (!initialized) {
        // Do parameter checks
        if (!config) throw new ex.IllegalArgumentException("The config parameter was null.");
        if (!apiConfig) throw new ex.IllegalArgumentException("The api config parameter was null.");
        // Get the shit we need
        CLIENT_ID = apiConfig.clientId;
        if (!CLIENT_ID) throw new ex.IllegalArgumentException("The api config map had a null 'clientId' parameter.");
        CLIENT_SECRET = apiConfig.clientSecret;
        if (!CLIENT_SECRET) throw new ex.IllegalArgumentException("The api config map had a null 'clientSecret' parameter.");
        SCOPES = apiConfig.scopes;
        if (!SCOPES) log.d("'" + API_NAME + "' API did not specify a scope. This is an ill-advised by the GitHub V3 spec.");
        // Optional shit
        API_ROOT = (config.apiRoot) ? config.apiRoot : DEFAULT_API_ROOT;
        if (API_ROOT.charAt(0) !== "/") API_ROOT = "/" + API_ROOT;
        if (API_ROOT.charAt(API_ROOT.length) === "/") API_ROOT = API_ROOT.slice(0, API_ROOT.length - 1);
        API_REDIRECT_URL = API_ROOT + "/" + API_NAME + "/redirect";
        // Init complete
        initialized = true;
        log.d("'" + API_NAME + "' API was initialized successfully.");
    } else {
        throw new ex.APIAlreadyInitializedException(API_NAME);
    }
}

var route = function(app) {
    if (!routed) {
        if (!initialized) throw new ex.APINotYetInitializedException(API_NAME);
        if (!app) throw new ex.IllegalArgumentException("The express app parameter was null.");

        app.get(API_REDIRECT_URL, function(req, res) {
            var code = req.param("code");
            if (!code) {
                log.e("The 'code' parameter from '" + API_NAME + "' API redirect was null.");
                if (req.session.returnUrl) res.redirect(req.session.returnUrl);
                else {
                    log.e("The return url for '" + API_NAME + "' API auth was null - sending 404.");
                    res.send(404);
                }
                return;
            } else {
                // Go ahead with REST logic
                request({
                    url: GITHUB_OAUTH_TOKEN_URL,
                    form: {
                        client_id: CLIENT_ID,
                        client_secret: CLIENT_SECRET,
                        redirect_uri: 'http://' + req.get("host") + API_REDIRECT_URL,
                        code: code
                    },
                    headers: {
                        Accept: "application/json"
                    },
                    method: "POST"
                }, function(error, response, body) {
                    if (error || response.statusCode > 299) {
                        if (!error) error = new ex.APICallFailureException("API call to URL '" + GITHUB_OAUTH_TOKEN_URL + "' failed with status code " + response.statusCode + ". The body was as follows: \n" + body);
                        log.e("'" + API_NAME + "' API authentication failed with status " + response.statusCode + ": " + error);
                    } else {
                        // Successfully got the token, lets boogie
                        var payload = JSON.parse(body);
                        req.session[SESSION_TOKEN_ID] = payload.access_token;
                        log.d("'" + API_NAME + "' API authentication token '" + payload.access_token + "' obtained successfully.");
                    }
                    // We're not in Kansas - gotta get back
                    if (req.session.returnUrl) {
                        res.redirect(req.session.returnUrl);
                        req.session.returnUrl = null;
                    } else {
                        log.e("The return url for '" + API_NAME + "' API auth was null - sending 404.");
                        res.send(404);
                    }
                });
            };
        });

        log.d("Authentication redirect for '" + API_NAME + "' API added: '" + API_REDIRECT_URL + "'.");
        routed = true;
        log.d("'" + API_NAME + "' routed successfully.");
    } else {
        throw new ex.APIAlreadyRoutedException(API_NAME);
    }
};

var authed = function(session) {
	//TODO: now variable was here but not used (see google api)
    if (session[SESSION_TOKEN_ID]) {
        return true;
    } else {
        return false;
    }
};

var auth = function(app, req, res, returnUrl) {
    if (!authed(req.session)) {
        if (!initialized) throw new ex.APINotYetInitializedException(API_NAME);
        if (!routed) route(app);
        if (!returnUrl) throw new ex.IllegalArgumentException("The returnUrl parameter was null.");
        // Define return URL for authentication
        req.session.returnUrl = returnUrl;
        var query = {
            client_id: CLIENT_ID,
            state: md5((new Date()).getTime() + Math.floor((Math.random() * 100) + 1) + API_NAME),
            redirect_uri: 'http://' + req.get("host") + API_REDIRECT_URL
        };
        if (SCOPES) query["scope"] = SCOPES;
        var queryString = qs.stringify(query);
        res.redirect(GITHUB_OAUTH_AUTH_URL + '?' + queryString);
    } else {
        log.d("Something tried to auth with '" + API_NAME + "' API even though we're already authed.");
    }
};

var makeClient = function(session) {
    if (!session) throw ex.ExpressSessionUndefinedException();
    if (!session[SESSION_TOKEN_ID]) throw ex.APINotAuthorizedException("'" + API_NAME + "' API authorization token was null.");
    return new Client(GITHUB_BASE_URL, session[SESSION_TOKEN_ID], {
        authorizationHeaderPrefix: "token"
    });
};

module.exports = {
    identity: identity,
    init: init,
    route: route,
    authed: authed,
    auth: auth,
    makeClient: makeClient
}