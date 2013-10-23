var ex = require("../exception.js");
var log = require("../log.js");

const URL_PATH_SEPARATOR = "/"; // To reduce string creation ever so slightly - this may be a bit anal
const DEFAULT_API_ROOT = "/sauce/apis"; // What the api specific routes will get prepended with, if its not overridden
const DEFAULT_REDIRECT_ROUTE_SUFFIX = "/redirect"; // What we suffix redirect api routes with, if its not overridden

var Api = function(apiName, sauceConfig, apiConfig, baseUrl, authUrl, tokenUrl, expires, usesScope){

	this.apiName = apiName;
	this.baseUrl = baseUrl;
	this.authUrl = authUrl;
	this.tokenUrl = tokenUrl;
	this.sessionTokenId = apiName + "ApiToken";
	if(expires) this.sessionTimeoutId = apiName + "ApiTimeout";
	this.clientId;
	this.clientSecret;
	this.scopes;
	this.apiRoot;
	this.redirectRouteUrl;
	this.routed = false;
	
	this.clientId = apiConfig.clientId; // OAuth Client ID; everyone needs this
    this.clientSecret = apiConfig.clientSecret; // OAuth Client Secret; everyone needs this too
    this.scopes = apiConfig.scopes; // OAuth Scopes; not everyone needs this
    // We need to make sure we have at least id and secret
    if (!this.clientId) throw new ex.IllegalArgumentException("The api config map had a null 'clientId' parameter.");
    if (!this.clientSecret) throw new ex.IllegalArgumentException("The api config map had a null 'clientSecret' parameter.");
    // Slap them on the wrist for not having scopes
	if(usesScope){
		this.scopes = apiConfig.scopes;
		if (!this.scopes) log.w("The api config map for '" + apiName + "' api had a null 'scopes' parameter - with OAuth 2.0 this is generally ill-advised.");
    }
	// Moving on, lets create the more general config-specific instance variables
    this.apiRoot = (sauceConfig.apiRoot) ? sauceConfig.apiRoot : DEFAULT_API_ROOT;
    // Some api root corrections for later (never trust the user) - the root must start with a '/' but not end with one
    if (this.apiRoot.charAt(0) !== URL_PATH_SEPARATOR) this.apiRoot = URL_PATH_SEPARATOR + apiRoot;
    if (this.apiRoot.charAt(apiRoot.length) === URL_PATH_SEPARATOR) this.apiRoot = this.apiRoot.slice(0, apiRoot.length - 1);
    // Setup the redirect route url up here for ease of reuse
    this.redirectRouteUrl = this.apiRoot + URL_PATH_SEPARATOR + apiName + DEFAULT_REDIRECT_ROUTE_SUFFIX;
    // We're done with 'init'
    log.d("'" + apiName + "' api was initialized successfully.");
};

Api.prototype.route = function(app, requestHeaders, includeRedirectUrl, additionalPostValues){
	if (!this.routed) {
        if (!app) throw new ex.IllegalArgumentException("The express app parameter was null.");

        app.get(this.redirectRouteUrl, function(req, res) {
            var code = req.param("code");
            if (!code) {
                log.e("The 'code' parameter from '" + this.apiName + "' API redirect was null.");
                if (req.session.returnUrl) res.redirect(req.session.returnUrl);
                else {
                    log.e("The return url for '" + this.apiName + "' API auth was null - sending 404.");
                    res.send(404);
                }
                return;
            } else {
                // Go ahead with REST logic
				var requestOptions = {url: this.tokenUrl, method: "POST"};
				requestOptions.form = {
					client_id: this.clientId,
                    client_secret: this.clientSecret,
                    redirect_uri: 'http://' + req.get("host") + this.redirectRouteUrl,
                    code: code
				}
				if(includeRedirectUrl) requestOptions.form.redirect_uri = 'http://' + req.get("host") + this.redirectRouteUrl;
                if(requestHeaders) requestOptions.headers = requestHeaders;
				if(additionalPostValues){
					for(prop in additionalPostValues){
						requestOptions.form[prop] = additionalPostValues[prop];
					}
				}
				request(requestOptions, function(error, response, body) {
                    if (error || response.statusCode > 299) {
                        if (!error) error = new ex.APICallFailureException("API call to URL '" + GITHUB_OAUTH_TOKEN_URL + "' failed with status code " + response.statusCode + ". The body was as follows: \n" + body);
                        log.e("'" + this.apiName + "' API authentication failed with status " + response.statusCode + ": " + error);
                    } else {
                        // Successfully got the token, lets boogie
                        var payload = JSON.parse(body);
                        req.session[this.sessionTokenId] = payload.access_token;
                        log.d("'" + this.apiName + "' API authentication token '" + payload.access_token + "' obtained successfully.");
						if(this.expires){
							req.session[sessionTimeoutId] = (payload.expires_in * 1000) + (new Date()).getTime();
							log.d("'" + API_NAME + "' API authentication token expires in " + (payload.expires_in / 60) + " minutes.");
						}
					}
                    // We're not in Kansas - gotta get back
                    if (req.session.returnUrl) {
                        res.redirect(req.session.returnUrl);
                        req.session.returnUrl = null;
                    } else {
                        log.e("The return url for '" + this.apiName + "' API auth was null - sending 404.");
                        res.send(404);
                    }
                });
            };
        });

        log.d("Authentication redirect for '" + this.apiName + "' API added: '" + this.redirectRouteUrl + "'.");
        this.routed = true;
        log.d("'" + this.apiName + "' routed successfully.");
    } else {
        throw new ex.APIAlreadyRoutedException(this.apiName);
    }
};

Api.prototype.authed = function(session){
	if(this.expires){
		var now = (new Date()).getTime();
		if (session[this.sessionTokenId]) {
			if (now > session[this.sessionTimeoutId]) return false;
			else return true;
		} else return false;
	}else{
		if (session[this.sessionTokenId]) return true;
		else return false;
	}
};

Api.prototype.auth = function(app, req, res, returnUrl, includeState, extraQueries) {
    if (!authed(req.session)) {
        if (!this.routed) route(app);
        if (!returnUrl) throw new ex.IllegalArgumentException("The returnUrl parameter was null.");
        // Define return URL for authentication
        req.session.returnUrl = returnUrl;
        var query = {
            client_id: CLIENT_ID,
            redirect_uri: 'http://' + req.get("host") + API_REDIRECT_URL
        };
        if(this.scopes) query["scope"] = this.scopes;
		if(includeState) query.state = md5((new Date()).getTime() + Math.floor((Math.random() * 100) + 1) + API_NAME);
        if(extraQueries){
			for(prop in extraQueries){
				query[prop] = extraQueries[prop];
			}
		}
		var queryString = qs.stringify(query);
        res.redirect(this.authUrl + '?' + queryString);
    } else {
        log.d("Something tried to auth with '" + this.apiName + "' API even though we're already authed.");
    }
};

Api.prototype.makeClient = function(session, authHeaderPrefix) {
    if (!session) throw ex.ExpressSessionUndefinedException();
    if (!session[this.sessionTokenId]) throw ex.APINotAuthorizedException("'" + this.apiName + "' API authorization token was null.");
    return new Client(this.baseUrl, session[this.sessionTokenId], {
        authorizationHeaderPrefix: authHeaderPrefix
    });
};

Api.prototype.identity = function(){
	return this.apiName;
};