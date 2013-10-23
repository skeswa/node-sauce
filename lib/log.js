function now() {
    // Create a date object with the current time
    var now = new Date();
    // Create an array with the current hour, minute and second
    var time = [now.getHours(), now.getMinutes(), now.getSeconds()];
    // Determine AM or PM suffix based on the hour
    var suffix = (time[0] < 12) ? "AM" : "PM";
    // Convert hour from military time
    time[0] = (time[0] < 12) ? time[0] : time[0] - 12;
    // If hour is 0, set it to 12
    time[0] = time[0] || 12;
    // If seconds and minutes are less than 10, add a zero
    for (var i = 1; i < 3; i++) {
        if (time[i] < 10) {
            time[i] = "0" + time[i];
        }
    }

    // Return the formatted string
    return time.join(":") + " " + suffix;
}

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
module.exports.w = function(msg) {
    var line = "[sauce:warn!][" + now() + "] " + msg;
    console.log(line);
}