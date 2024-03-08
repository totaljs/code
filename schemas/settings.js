NEWSCHEMA('Settings', function(schema) {

	schema.define('token', 'String');
	schema.define('name', 'String');
	schema.define('superadmin', 'String');
	schema.define('login', 'String');
	schema.define('accesstoken', 'String');
	schema.define('insecure', Boolean);

	schema.setQuery(function($) {

		if (!$.user.sa) {
			$.invalid(401);
			return;
		}

		var data = {};
		data.token = PREF.token;
		data.name = CONF.name;
		data.superadmin = PREF.superadmin;
		data.login = PREF.login;
		data.accesstoken = PREF.accesstoken;
		data.insecure = PREF.insecure;
		$.callback(data);

	});

	schema.setSave(function($) {

		if (!$.user.sa) {
			$.invalid(401);
			return;
		}

		var model = $.model;

		CONF.name = model.name;
		PREF.set('url', $.req.hostname());
		PREF.set('name', model.name);
		PREF.set('token', model.token);
		PREF.set('accesstoken', model.accesstoken);
		PREF.set('login', model.login);
		PREF.set('superadmin', model.superadmin);
		PREF.set('insecure', model.insecure);

		process.env.NODE_TLS_REJECT_UNAUTHORIZED = model.insecure ? '0' : '1';
		CONF.totalapi = model.token;

		$.success();
	});


});