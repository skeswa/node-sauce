var util = require("util");

var UserAlreadyRegisteredException = function(user) {
    Error.captureStackTrace(this, this);
    this.message = "The user name '" + user + "' is already being used. Please choose another name.";
}
util.inherits(UserAlreadyRegisteredException, Error);
UserAlreadyRegisteredException.prototype.name = "UserAlreadyRegisteredException";
module.exports.UserAlreadyRegisteredException = UserAlreadyRegisteredException;

var InvalidUserException = function() {
    Error.captureStackTrace(this, this);
    this.message = "Invalid username or password";
}
util.inherits(InvalidUserException, Error);
InvalidUserException.prototype.name = "InvalidUserException";
module.exports.InvalidUserException = InvalidUserException;

var RequiredFieldNotIncludedException = function(fieldName) {
    Error.captureStackTrace(this, this);
    this.message = "The required '" + fieldName + "' parameter was not included.";
}
util.inherits(RequiredFieldNotIncludedException, Error);
RequiredFieldNotIncludedException.prototype.name = "RequiredFieldNotIncludedException";
module.exports.RequiredFieldNotIncludedException = RequiredFieldNotIncludedException;

var AuthorizationHeaderNotIncludedException = function(fieldName) {
    Error.captureStackTrace(this, this);
    this.message = "The required '" + fieldName + "' header was not included.";
}
util.inherits(AuthorizationHeaderNotIncludedException, Error);
AuthorizationHeaderNotIncludedException.prototype.name = "AuthorizationHeaderNotIncludedException";
module.exports.AuthorizationHeaderNotIncludedException = AuthorizationHeaderNotIncludedException;

var UserNotLoggedInException = function() {
    Error.captureStackTrace(this, this);
    this.message = "The user was not logged in.";
}
util.inherits(UserNotLoggedInException, Error);
UserNotLoggedInException.prototype.name = "UserNotLoggedInException";
module.exports.UserNotLoggedInException = UserNotLoggedInException;

var BadHeaderFormatException = function(fieldName, expectedFormat) {
    Error.captureStackTrace(this, this);
    this.message = "The '" + fieldName + "' header must be of the format '" + expectedFormat + "'";
}
util.inherits(BadHeaderFormatException, Error);
BadHeaderFormatException.prototype.name = "BadHeaderFormatException";
module.exports.BadHeaderFormatException = BadHeaderFormatException;

var InvalidSauceAccessKeyException = function() {
    Error.captureStackTrace(this, this);
    this.message = "The provided access key was invalid.";
}
util.inherits(InvalidSauceAccessKeyException, Error);
InvalidSauceAccessKeyException.prototype.name = "InvalidSauceAccessKeyException";
module.exports.InvalidSauceAccessKeyException = InvalidSauceAccessKeyException;