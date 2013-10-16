/* Binds the auth routes of this API to express. Does initialization. */
module.exports.register = function (app /* Express application */, config /* General configuration */, apiConfig /* clientId, clientSecret etc. */) {
    // This method is synchronous
};
/* Returns true if this API is authed in this session */
module.exports.isAuthed = function (session) {
    return false;
};
/* Starts the OAuth roundtrip. Only gets called for HTTP GET in the browser. */
module.exports.doAuth = function (req, res) {
    res.send(500, "Not yet impleemented.");
};
/* Makes a new API client for this session. API clients are basically facades for the API. 
    Only gets called if this session is authed already. */
module.exports.makeClient = function (session) {
    return {}; // Returns a client
};