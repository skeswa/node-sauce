var ExpressApplicationAlreadySpecifiedException = function() {
    Error.apply(this, ["The express application has already been specified. Sauce only allows a single express app to be specified."]);
}
ExpressApplicationAlreadySpecifiedException.prototype = new Error();
ExpressApplicationAlreadySpecifiedException.prototype.constructor = ExpressApplicationAlreadySpecifiedException;
ExpressApplicationAlreadySpecifiedException.prototype.name = "ExpressApplicationAlreadySpecifiedException";

module.exports.ExpressApplicationNotYetSpecifiedException = ExpressApplicationNotYetSpecifiedException;

var ExpressApplicationNotYetSpecifiedException = function() {
    Error.apply(this, ["The express application has not yet been specified. Sauce requires a single express app to be specified."]);
}
ExpressApplicationNotYetSpecifiedException.prototype = new Error();
ExpressApplicationNotYetSpecifiedException.prototype.constructor = ExpressApplicationNotYetSpecifiedException;
ExpressApplicationNotYetSpecifiedException.prototype.name = "ExpressApplicationNotYetSpecifiedException";

module.exports.ExpressApplicationNotYetSpecifiedException = ExpressApplicationNotYetSpecifiedException;

var IllegalArgumentException = function(message) {
    this.message = message;
    this.name = "IllegalArgumentException";
}

module.exports.IllegalArgumentException = IllegalArgumentException;