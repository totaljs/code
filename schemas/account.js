NEWSCHEMA('Accounts', function(schema) {

	schema.define('email', 'Email', true);
	schema.define('phone', 'Phone');
	schema.define('token', 'String(100)');
	schema.define('darkmode', Boolean);
	schema.define('localsave', Boolean);
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
		$.callback(data);
	});

	schema.setSave(function($) {

		var user = $.user;
		var model = $.model;

		user.email = model.email;
		user.phone = model.phone;
		user.darkmode = model.darkmode;
		user.localsave = model.localsave;

		if (model.password && model.password.substring(0, 3) !== '***')
			user.password = model.password.sha256();

		user.sa && PREF.set('token', model.token);

		MAIN.save(1);
		$.success();
	});


});