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
