NEWSCHEMA('Accounts', function(schema) {

	schema.define('email', 'Email', true);
	schema.define('phone', 'Phone');
	schema.define('token', 'String(100)');
	schema.define('appname', 'String(50)');
	schema.define('darkmode', 'Number');
	schema.define('localsave', 'Boolean');
	schema.define('password', 'String(30)');

	// TMS
	schema.jsonschema_define('username', 'String');
	schema.jsonschema_define('userid', 'String');
	schema.jsonschema_define('ip', 'String');
	schema.jsonschema_define('ua', 'String');
	schema.jsonschema_define('dttms', 'Date');

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

		if (user.sa)
			data.appname = CONF.name;

		$.callback(data);
	});

	schema.setSave(function($) {

		var user = $.user;
		var model = $.model;

		user.email = model.email;
		user.phone = model.phone;
		user.darkmode = model.darkmode;
		user.localsave = model.localsave;
		user.autodarkmode = model.autodarkmode;

		if (user.sa) {
			CONF.name = model.appname;
			PREF.set('name', model.appname);
			PREF.set('token', model.token);
		}

		if (model.password && model.password.substring(0, 3) !== '***')
			user.password = model.password.sha256();

		if (CONF.allow_tms) {
			var publish = {};
			publish.email = user.email;
			publish.phone = user.phone;
			publish.darkmode = user.darkmode;
			publish.localsave = user.localsave;
			publish.token = user.token;
			publish.appname = user.appname;
			PUBLISH('accounts_save', FUNC.tms($, publish));
		}

		MAIN.save(1);
		$.success();
	});


});