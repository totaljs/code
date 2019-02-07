AUTH(function(req, res, flags, next) {

	var cookie = req.cookie(CONF.cookie);
	if (!cookie || cookie.length < 20)
		return next(false);

	var obj = F.decrypt(cookie, CONF.authkey);
	if (!obj)
		return next(false);

	var user = MAIN.users.findItem('id', obj.id);
	if (user) {
		user.ip = req.ip;
		user.logged = NOW;
		if (user.blocked) {
			res.cookie(CONF.cookie, '', '-1 day');
			user = null;
		} else
			res.cookie(CONF.cookie, cookie, '5 days'); // extend cookie
	}

	next(!!user, user);
});

ON('service', function(counter) {
	// Logged time
	if (counter % 10 === 0)
		MAIN.save(1);
});