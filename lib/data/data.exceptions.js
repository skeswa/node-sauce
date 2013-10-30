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