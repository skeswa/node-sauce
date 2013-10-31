/**************************** EXTERNAL IMPORTS *******************************/

/**************************** INTERNAL IMPORTS *******************************/

var assert = require("../../assert.js");

/**************************** MODULE CONSTANTS *******************************/

const HTTP_GET = "GET";
const HTTP_POST = "POST";
const HTTP_PUT = "PUT";
const HTTP_DELETE = "DELETE";

const PARAM_APP = "app";
const PARAM_API = "api";
const PARAM_REQ = "req";
const PARAM_RES = "res";

/*************************** OBJECT DEFINITIONS ******************************/

var makeFacade = function (app, api, req, res) {
    // Do parameter checking
    assert.object(app, PARAM_APP);
    assert.object(api, PARAM_API);
    assert.object(req, PARAM_REQ);
    assert.object(res, PARAM_RES);
    // Lets make those fancy facade functions
    var facade = {};

    /* Updates the express request and response objects - this method makes
     * maintaining the same facade across multiple HTTP transactions possible. 
     */
    facade._update = function(req, res) {
        assert.object(req, PARAM_REQ);
        assert.object(res, PARAM_RES);
    }

    /* Returns a map of the authentication data for this session. If we aren't
     * authed yet, this method will return null.
     */
    facade.credentials = function() {
        return api.credentials(req.session);
    };

    /* Returns true if this api is currently authenticated, and false otherwise.
     */
    facade.authed = function() {
        return api.authed(req.session);
    };

    /* Authenticates against the api service provider with a server-side OAuth flow.
     * Authentication requires redirection, so the callback for this method cannot 
     * affect express' "response" object.
     *
     * @param returnUrl - REQUIRED - String - denotes the url to which we should return when 
     */
    facade.auth = function(returnUrl) {
        return api.auth(app, req, res, returnUrl);
    };

    /* Creates an API Request object which can be configured and subsequently used 
     * to call an api endpoint method. The HTTP method of the request is a an HTTP GET.
     * If the api has a static enpoint base url, only the endpoint stub need be provided
     * for the "url" parameter.
     *
     * @param url - REQUIRED - String - the api endpoint against which we are making a request
     */
    facade.get = function(url) {
        return api.request(req.session, HTTP_GET, url);
    };

    /* Creates an API Request object which can be configured and subsequently used 
     * to call an api endpoint method. The HTTP method of the request is a an HTTP POST.
     * If the api has a static enpoint base url, only the endpoint stub need be provided
     * for the "url" parameter.
     *
     * @param url - REQUIRED - String - the api endpoint against which we are making a request
     */
    facade.post = function(url) {
        return api.request(req.session, HTTP_POST, url);
    };

    /* Creates an API Request object which can be configured and subsequently used 
     * to call an api endpoint method. The HTTP method of the request is a an HTTP PUT.
     * If the api has a static enpoint base url, only the endpoint stub need be provided
     * for the "url" parameter.
     *
     * @param url - REQUIRED - String - the api endpoint against which we are making a request
     */
    facade.put = function(url) {
        return api.request(req.session, HTTP_PUT, url);
    };

    /* Creates an API Request object which can be configured and subsequently used 
     * to call an api endpoint method. The HTTP method of the request is a an HTTP DELETE.
     * If the api has a static enpoint base url, only the endpoint stub need be provided
     * for the "url" parameter.
     *
     * @param url - REQUIRED - String - the api endpoint against which we are making a request
     */
    facade.delete = function(url) {
        return api.request(req.session, HTTP_DELETE, url);
    };

    // Give the facade to the guy that called us
    return facade;
};

// Export the make method
module.exports.make = makeFacade;