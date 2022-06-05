NEWSCHEMA('Settings', function(schema) {

	schema.define('token', 'String(100)');
	schema.define('name', 'String(50)');
	schema.define('superadmin', 'String(200)');

	schema.setQuery(function($) {

		if (!$.user.sa) {
			$.invalid(401);
			return;
		}

		var data = {};
		data.token = PREF.token;
		data.name = CONF.name;
		data.superadmin = PREF.superadmin;
		$.callback(data);

	});

	schema.setSave(function($) {

		if (!$.user.sa) {
			$.invalid(401);
			return;
		}

		var model = $.model;

		CONF.name = model.name;
		PREF.set('name', model.name);
		PREF.set('token', model.token);
		PREF.set('superadmin', model.superadmin);

		$.success();
	});


});