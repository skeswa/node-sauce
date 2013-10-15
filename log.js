module.exports.e = function(tag, msg, err) {
    var line = "[sauce:error][" + tag + "] " + msg;
    if (err) {
        line += " :: " + err.toString();
    }
    console.log(line);
}
module.exports.d = function(tag, msg) {
    var line = "[sauce:debug][" + tag + "] " + msg;
    console.log(line);
}
module.exports.a = function(tag, msg) {
    var line = "[sauce:alert][" + tag + "] " + msg;
    console.log(line);
}