AUTH(function(req, res, flags, next) {

	var cookie = req.cookie(CONF.cookie);
	if (!cookie || cookie.length < 20)
		return next(false);

	var obj = F.decrypt(cookie, CONF.authkey);
	if (!obj)
		return next(false);

	var user = MAIN.users.findItem('id', obj.id);
	if (user)
		user.ip = req.ip;

	next(!!user, user);
});

// Clears expired sessions
ON('service', function(counter) {
	if (counter % 5 !== 0)
		return;
	var keys = Object.keys(MAIN.sessions);
	for (var i = 0; i < keys.length; i++) {
		var id = keys[i];
		if (MAIN.sessions[id].expire < NOW)
			delete MAIN.sessions[id];
	}
});