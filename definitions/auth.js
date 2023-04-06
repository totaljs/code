var APIUSER = { id: 'api', name: 'API', sa: true };

(function() {

	var opt = {};
	opt.secret = CONF.authkey;
	opt.cookie = CONF.cookie;
	opt.ddos = 5;

	opt.onauthorize = function($) {
		if ($.url.substring(0, 6) === '/apps/') {
			var token = $.headers['x-token'] || $.query.token;
			if (PREF.accesstoken && token && PREF.accesstoken === token)
				$.success(APIUSER);
			else
				$.invalid();
			return true;
		}
	};

	opt.onread = function(meta, next) {
		var user = MAIN.users.findItem('id', meta.userid);
		if (user) {
			if (PREF.login) {

				var data = {};
				data.type = 'session';
				data.code = PREF.name;
				data.ua = meta.ua;
				data.ip = meta.ip;
				data.id = user.id;
				data.email = user.email;
				data.url = PREF.url;

				RESTBuilder.POST(PREF.login, data).callback(function(err, response) {

					if (err) {
						next(err);
						return;
					}

					if (!response || response instanceof Array || !response.id) {
						next('invalid');
						return;
					}

					var output = FUNC.syncuser(response);
					if (output.error) {
						next('invalid');
						return;
					}

					var user = CLONE(output.user);
					user.password = undefined;
					next(null, output.user);
				});

			} else {
				user.logged = NOW;
				user = CLONE(user);
				user.password = undefined;
				next(null, user);
			}
		} else
			next('invalid');
	};

	AUTH(opt);
	MAIN.auth = opt;

})();

ON('service', function(counter) {
	// Logged time
	if (counter % 10 === 0)
		MAIN.save(1);
});