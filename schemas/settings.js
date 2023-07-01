NEWSCHEMA('Settings', function(schema) {

	schema.define('token', 'String');
	schema.define('name', 'String');
	schema.define('superadmin', 'String');
	schema.define('login', 'String');
	schema.define('accesstoken', 'String');

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
		CONF.totalapi = model.token;

		$.success();
	});


});