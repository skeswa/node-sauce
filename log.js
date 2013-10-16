module.exports.e = function(msg, err) {
    var line = "[sauce:error][" + (new Date()).getTime() + "] " + msg;
    if (err) {
        line += " :: " + err.toString();
    }
    console.log(line);
}
module.exports.d = function(msg) {
    var line = "[sauce:debug][" + (new Date()).getTime() + "] " + msg;
    console.log(line);
}
module.exports.a = function(msg) {
    var line = "[sauce:alert][" + (new Date()).getTime() + "] " + msg;
    console.log(line);
}