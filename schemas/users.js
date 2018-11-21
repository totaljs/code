NEWSCHEMA('Users', function(schema) {

	schema.define('id', 'Lower(30)', true);
	schema.define('name', 'String(50)', true);
	schema.define('position', 'String(50)');
	schema.define('phone', 'Phone');
	schema.define('email', 'Email', true);
	schema.define('password', 'String(40)', true);
	schema.define('blocked', Boolean);
	schema.define('sa', Boolean);
	schema.define('darkmode', Boolean);

	schema.setQuery(function($) {

		var arr = [];

		for (var i = 0; i < MAIN.users.length; i++) {
			var user = CLONE(MAIN.users[i]);
			user.password = undefined;
			arr.push(user);
		}

		$.callback(arr);
	});

	schema.setGet(function($) {
		var item = MAIN.users.findItem('id', $.id);
		if (item) {
			item = CLONE(item);
			item.password = '*******';
			$.callback(item);
		}
	});

	schema.setSave(function($) {

		var model = $.model.$clean();
		var tmp = model.name.split(' ');

		model.initials = tmp[0][0] + tmp[1][0];

		var item = MAIN.users.findItem('id', model.id);
		if (item == null) {

			model.password = model.password.sha256();
			model.created = NOW;
			MAIN.users.push(model);

		} else {

			item.name = model.name;
			item.email = model.email;
			item.sa = model.sa;
			item.blocked = model.blocked;
			item.position = model.position;
			item.darkmode = model.darkmode;

			if (item.password.substring(0, 3) !== '***')
				item.password = model.password.sha256();

			// @TODO: update all users sessions
		}


		MAIN.save(1);
		$.success();
	});

	schema.setRemove(function($) {

		var index = MAIN.users.findIndex('id', $.id);
		var item = MAIN.users[index];

		if (index !== -1) {
			MAIN.users.splice(index, 1);
			MAIN.save(1);
		}

		// @TODO: update all users sessions
		$.success();
	});

});

NEWSCHEMA('Login', function(schema) {

	schema.define('email', 'Email', true);
	schema.define('password', 'String(50)', true);

	schema.addWorkflow('exec', function($) {

		var user = MAIN.users.findItem('email', $.model.email);
		if (!user || user.password !== $.model.password.sha256()) {
			$.invalid('error-credentials');
			return;
		}

		var cookie = {};
		cookie.id = user.id;
		cookie.ip = $.ip;
		$.controller.cookie(CONF.cookie, F.encrypt(cookie, CONF.authkey), '1 week');
		$.success();
	});

});