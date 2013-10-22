var request = require("request");
var qs = require("querystring");
var md5 = require("MD5");

var ex = require("../exception.js");
var log = require("../log.js");
var Client = require("./client.js");

var API_NAME = "google";
var DEFAULT_API_ROOT = "/sauce/apis";

var GOOGLE_BASE_URL = "https://www.googleapis.com/";
var GOOGLE_OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/auth";
var GOOGLE_OAUTH_TOKEN_URL = "https://accounts.google.com/o/oauth2/token";
var SESSION_TOKEN_ID = "googleApiToken";
var SESSION_TIMEOUT_ID = "googleApiTimeout";

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
        if (!SCOPES) throw new ex.IllegalArgumentException("The api config map had a null 'scopes' parameter. You browse the scopes you can choose here: https://developers.google.com/oauthplayground.");
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
                    url: GOOGLE_OAUTH_TOKEN_URL,
                    form: {
                        client_id: CLIENT_ID,
                        client_secret: CLIENT_SECRET,
                        grant_type: "authorization_code",
                        redirect_uri: 'http://' + req.get("host") + API_REDIRECT_URL,
                        code: code
                    },
                    method: "POST"
                }, function(error, response, body) {
                    if (error || response.statusCode > 299) {
                        if (!error) error = new ex.APICallFailureException("API call to URL '" + GOOGLE_OAUTH_TOKEN_URL + "' failed with status code " + response.statusCode + ". The body was as follows: \n" + body);
                        log.e("'" + API_NAME + "' API authentication failed with status " + response.statusCode + ": " + error);
                    } else {
                        // Successfully got the token, lets boogie
                        var payload = JSON.parse(body);
                        req.session[SESSION_TOKEN_ID] = payload.access_token;
                        req.session[SESSION_TIMEOUT_ID] = (payload.expires_in * 1000) + (new Date()).getTime();
                        log.d("'" + API_NAME + "' API authentication token '" + payload.access_token + "' obtained successfully.");
                        log.d("'" + API_NAME + "' API authentication token expires in " + (payload.expires_in / 60) + " minutes.");
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
    var now = (new Date()).getTime();
    if (session[SESSION_TOKEN_ID]) {
        if (now > session[SESSION_TIMEOUT_ID]) {
            return false;
        } else {
            return true;
        }
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
        var queryString = qs.stringify({
            response_type: "code",
            client_id: CLIENT_ID,
            scope: SCOPES,
            state: md5((new Date()).getTime() + Math.floor((Math.random() * 100) + 1) + API_NAME),
            redirect_uri: 'http://' + req.get("host") + API_REDIRECT_URL
        });
        res.redirect(GOOGLE_OAUTH_AUTH_URL + '?' + queryString);
    } else {
        log.d("Something tried to auth with '" + API_NAME + "' API even though we're already authed.");
    }
};

var makeClient = function(session) {
    if (!session) throw ex.ExpressSessionUndefinedException();
    if (!session[SESSION_TOKEN_ID]) throw ex.APINotAuthorizedException("'" + API_NAME + "' API authorization token was null.");
    return new Client(GOOGLE_BASE_URL, session[SESSION_TOKEN_ID], {
        authorizationHeaderPrefix: "OAuth"
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