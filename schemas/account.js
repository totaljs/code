NEWSCHEMA('Accounts', function(schema) {

	schema.define('email', 'Email', true);
	schema.define('phone', 'Phone');
	schema.define('darkmode', 'Number');
	schema.define('localsave', 'Boolean');
	schema.define('password', 'String(30)');

	schema.setQuery(function($) {
		var user = $.user;
		var data = {};
		data.email = user.email;
		data.phone = user.phone;
		data.name = user.name;
		data.darkmode = user.darkmode;
		data.localsave = user.localsave;
		data.password = '*******';
		data.token = user.sa ? PREF.token : '';

		if (user.sa) {
			data.appname = CONF.name;
			data.superadmin = PREF.superadmin;
		}

		$.callback(data);
	});

	schema.setSave(function($) {

		var user = $.user;
		var model = $.model;

		if (!PREF.login) {
			user.email = model.email;
			user.phone = model.phone;
		}

		user.darkmode = model.darkmode;
		user.localsave = model.localsave;
		user.autodarkmode = model.autodarkmode;

		if (!PREF.login) {
			if (model.password && model.password.substring(0, 3) !== '***')
				user.password = model.password.sha256();
		}

		let item = MAIN.users.findItem('id', user.id);
		if (item) {

			if (user.email)
				item.email = user.email;

			if (user.phone)
				item.phone = user.phone;

			item.darkmode = user.darkmode;
			item.localsave = user.localsave;
			item.autodarkmode = user.autodarkmode;

			if (user.password)
				item.password = user.password;
		}

		MAIN.save(1);
		$.success();
	});


});