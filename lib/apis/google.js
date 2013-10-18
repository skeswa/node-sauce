var request = require("request");
var qs = require("querystring");
var md5 = require("MD5");

var ex = require("../../exception.js");
var log = require("../../log.js");

var GOOGLE_OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/auth';
var GOOGLE_OAUTH_TOKEN_URL = 'https://accounts.google.com/o/oauth2/token';
var SESSION_TOKEN_ID = "googleApiToken";
var SESSION_TIMEOUT_ID = "googleApiTimeout";

var CLIENT_ID = null;
var APP_SECRET = null;
var SCOPES = null;
var API_ROUTE_ROOT = null;
var API_REDIRECT_URL = null;
var config = null;
var registered = false;

/* Binds the auth routes of this API to express. Does initialization. */
module.exports.register = function(app, config, apiConfig) {
    if (!registered) {
        // Do parameter checks
        if (!app) throw new ex.IllegalArgumentException("The express app parameter was null.");
        if (!config) throw new ex.IllegalArgumentException("The config parameter was null.");
        if (!apiConfig) throw new ex.IllegalArgumentException("The api config parameter was null.");
        // Get the shit we need
        CLIENT_ID = apiConfig.clientId;
        if (!CLIENT_ID) throw new ex.IllegalArgumentException("The api config map had a null 'clientId' parameter.");
        APP_SECRET = apiConfig.appSecret;
        if (!APP_SECRET) throw new ex.IllegalArgumentException("The api config map had a null 'appSecret' parameter.");
        SCOPES = apiConfig.scopes;
        if (!SCOPES) throw new ex.IllegalArgumentException("The api config map had a null 'scopes' parameter.");
        // Optional shit
        API_ROUTE_ROOT = (config.apiRootUrl) ? config.apiRootUrl : "/sauce/apis";
        if (API_ROUTE_ROOT.charAt(0) !== "/") API_ROUTE_ROOT = "/" + API_ROUTE_ROOT;
        if (API_ROUTE_ROOT.charAt(API_ROUTE_ROOT.length) === "/") API_ROUTE_ROOT = API_ROUTE_ROOT.slice(0, API_ROUTE_ROOT.length - 1);
        API_REDIRECT_URL = API_ROUTE_ROOT + "/sauce/apis"

        app.get(API_REDIRECT_URL, function(req, res) {
            var code = req.param("code");
            if (!code) {
                log.e("The 'code' parameter from google api redirect was null.");
                res.send(500);
                return;
            } else {
                // Go ahead with REST logic
                request({
                    url: GOOGLE_OAUTH_TOKEN_URL,
                    form: {
                        client_id: CLIENT_ID,
                        client_secret: APP_SECRET,
                        grant_type: "authorization_code",
                        redirect_uri: 'http://' + req.get("host") + API_REDIRECT_URL,
                        code: code
                    },
                    method: "POST"
                }, function(error, response, body) {
                    if (error || response.statusCode > 200) {
                        log.e("Google API authentication failed with status " + response.statusCode + ": " + error);
                        res.send(500);
                    } else {
                        // Successfully got the token, lets boogie
                        var payload = JSON.parse(body);
                        req.session[SESSION_TOKEN_ID] = payload.access_token;
                        req.session[SESSION_TIMEOUT_ID] = payload.expires_in + (new Date()).getTime();
                        log.d("Google API authentication token '" + payload.access_token + "' obtained successfully.");
                    }
                });
            };
        });
        registered = true;
    }
};
/* Returns true if this API is authed in this session */
module.exports.authed = function(session) {
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
/* Starts the OAuth roundtrip. Only gets called for HTTP GET in the browser. */
module.exports.auth = function(req, res) {
    if (!module.exports.authed(req.session)) {
        if (!registered) throw new ex.ExpressAPINotRegisteredException("google");
        // Define return URL for authentication
        req.session.returnUrl = req.protocol + "://" + req.get("host") + req.url;
        var queryString = qs.stringify({
            response_type: "code",
            client_id: CLIENT_ID,
            scope: SCOPES,
            state: md5((new Date()).getTime() + Math.floor((Math.random() * 100) + 1) + "google"),
            redirect_uri: 'http://' + req.get("host") + API_REDIRECT_URL
        });
        res.redirect(GOOGLE_OAUTH_AUTH_URL + '?' + queryString);
        return true;
    }
    return false;
};
/* Makes a new API client for this session. API clients are basically facades for the API. 
    Only gets called if this session is authed already. */
module.exports.makeClient = function(session) {
    // TODO
    return {}; // Returns a client
};