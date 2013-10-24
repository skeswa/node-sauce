var util = require("util");

var APIAlreadyInitializedException = function(apiName) {
    Error.captureStackTrace(this, this);
    this.message = "The '" + apiName + "' API has already been initialized. Sauce initializes APIs with sauce.api(...).";
}
util.inherits(APIAlreadyInitializedException, Error);
APIAlreadyInitializedException.prototype.name = "APIAlreadyInitializedException";
module.exports.APIAlreadyInitializedException = APIAlreadyInitializedException;

var APINotYetInitializedException = function(apiName) {
    Error.captureStackTrace(this, this);
    this.message = "The '" + apiName + "' API hasn't been initialized yet. Sauce initializes APIs with sauce.api(...).";
}
util.inherits(APINotYetInitializedException, Error);
APINotYetInitializedException.prototype.name = "APINotYetInitializedException";
module.exports.APINotYetInitializedException = APINotYetInitializedException;

var APIAlreadyRoutedException = function(apiName) {
    Error.captureStackTrace(this, this);
    this.message = "The '" + apiName + "' API has already been routed. Sauce routes APIs when sauce.express() is called.";
}
util.inherits(APIAlreadyRoutedException, Error);
APIAlreadyRoutedException.prototype.name = "APIAlreadyRoutedException";
module.exports.APIAlreadyRoutedException = APIAlreadyRoutedException;

var APINotAuthorizedException = function(_message) {
    Error.captureStackTrace(this, this);
    this.message = _message;
}
util.inherits(APINotAuthorizedException, Error);
APINotAuthorizedException.prototype.name = "APINotAuthorizedException";
module.exports.APINotAuthorizedException = APINotAuthorizedException;

var APICallFailureException = function(_message) {
    Error.captureStackTrace(this, this);
    this.message = _message;
}
util.inherits(APICallFailureException, Error);
APICallFailureException.prototype.name = "APICallFailureException";
module.exports.APICallFailureException = APICallFailureException;

// Created 10.24.13 at 11:21 AM
var NoSuchApiException = function(apiName) {
    Error.captureStackTrace(this, this);
    this.message = "The '" + apiName + "' api is not internally defined by sauce.";
}
util.inherits(NoSuchApiException, Error);
NoSuchApiException.prototype.name = "NoSuchApiException";
module.exports.NoSuchApiException = NoSuchApiException;