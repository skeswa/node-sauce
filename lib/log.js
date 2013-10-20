var now = function() {
    var currentdate = new Date();
    return currentdate.getHours() + ":" + currentdate.getMinutes() + ":" + currentdate.getSeconds();
};

module.exports.e = function(msg, err) {
    var line = "[sauce:error][" + now() + "] " + msg;
    if (err) {
        line += " :: " + err.toString();
    }
    console.log(line);
}
module.exports.d = function(msg) {
    var line = "[sauce:debug][" + now() + "] " + msg;
    console.log(line);
}
module.exports.a = function(msg) {
    var line = "[sauce:alert][" + now() + "] " + msg;
    console.log(line);
}