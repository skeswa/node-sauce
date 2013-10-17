var util = require("util");

var ExpressApplicationAlreadyBoundException = function() {
    Error.captureStackTrace(this, this);
    this.message = "The express application has already been bound. Sauce only allows a single express app to be bound to it.";
}
util.inherits(ExpressApplicationAlreadyBoundException, Error);
ExpressApplicationAlreadyBoundException.prototype.name = "ExpressApplicationAlreadyBoundException";
module.exports.ExpressApplicationAlreadyBoundException = ExpressApplicationAlreadyBoundException;

var ExpressApplicationNotYetBoundException = function() {
    Error.captureStackTrace(this, this);
    this.message = "The express application has not yet been specified. Sauce requires to be bound to one express application before functioning.";
}
util.inherits(ExpressApplicationNotYetBoundException, Error);
ExpressApplicationNotYetBoundException.prototype.name = "ExpressApplicationNotYetBoundException";
module.exports.ExpressApplicationNotYetBoundException = ExpressApplicationNotYetBoundException;

var ExpressSessionUndefinedException = function() {
    Error.captureStackTrace(this, this);
    this.message = "Sauce requires that the express application uses express.session(...).";
}
util.inherits(ExpressSessionUndefinedException, Error);
ExpressSessionUndefinedException.prototype.name = "ExpressSessionUndefinedException";
module.exports.ExpressSessionUndefinedException = ExpressSessionUndefinedException;

var IllegalArgumentException = function(_message) {
    Error.captureStackTrace(this, this);
    this.message = _message;
}
util.inherits(IllegalArgumentException, Error);
IllegalArgumentException.prototype.name = "IllegalArgumentException";
module.exports.IllegalArgumentException = IllegalArgumentException;