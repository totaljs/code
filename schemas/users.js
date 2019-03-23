const WSBLOCKED = { TYPE: 'blocked' };

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
	schema.define('localsave', Boolean);

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
		} else
			$.invalid('error-users');
	});

	schema.setSave(function($) {

		var model = $.model.$clean();
		var tmp = model.name.split(' ');

		model.initials = tmp[0][0] + (tmp.length > 1 ? tmp[1][0] : '');

		var item = MAIN.users.findItem('id', model.id);
		if (item == null) {

			model.id = model.id.slug().replace(/-/g, '');
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
			item.localsave = model.localsave;
			item.initials = model.initials;

			if (model.password.substring(0, 3) !== '***')
				item.password = model.password.sha256();

			if (item.blocked && MAIN.ws)
				MAIN.ws.send2(WSBLOCKED, client => client.user.id === item.id);
		}


		MAIN.save(1);
		$.success();
	});

	schema.setRemove(function($) {

		var index = MAIN.users.findIndex('id', $.id);
		var item = MAIN.users[index];

		if (item) {

			for (var i = 0; i < MAIN.projects.length; i++) {
				var pro = MAIN.projects[i];
				if (pro.users)
					pro.users = pro.users.remove(item.id);
			}

			item.blocked = true;
			MAIN.ws.send2(WSBLOCKED, client => client.user.id === item.id);
			MAIN.users.splice(index, 1);
			MAIN.save();
		}

		$.success();
	});

});

NEWSCHEMA('Login', function(schema) {

	schema.define('email', 'Email', true);
	schema.define('password', 'String(50)', true);

	// Performs login
	schema.setSave(function($) {

		var user = MAIN.users.findItem('email', $.model.email);

		if (!user || user.password !== $.model.password.sha256()) {
			$.invalid('error-credentials');
			return;
		}

		if (user.blocked) {
			$.invalid('error-blocked');
			return;
		}

		var opt = {};
		opt.name = CONF.cookie;
		opt.key = CONF.authkey;
		opt.expire = '1 month';
		opt.data = user;
		opt.note = ($.headers['user-agent'] || '').parseUA();
		opt.options = { security: 'lax' };
		MAIN.session.setcookie($.controller, opt, $.done());
	});

});