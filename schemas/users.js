const WSBLOCKED = { TYPE: 'blocked' };
var DDOS = {};

NEWSCHEMA('Users', function(schema) {

	schema.define('id', 'Lower(30)', true);
	schema.define('name', 'String(50)', true);
	schema.define('position', 'String(50)');
	schema.define('phone', 'Phone');
	schema.define('email', 'Email', true);
	schema.define('password', 'String(100)', true);
	schema.define('blocked', Boolean);
	schema.define('sa', Boolean);
	schema.define('dbviewer', Boolean);
	schema.define('darkmode', Number);
	schema.define('localsave', Boolean);

	schema.setQuery(function($) {

		var arr = [];

		for (var i = 0; i < MAIN.users.length; i++) {
			var user = CLONE(MAIN.users[i]);
			user.password = undefined;
			user.authtoken = undefined;
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

		var model = $.clean();
		var tmp = model.name.split(' ');

		model.initials = (tmp[0][0] + ((tmp.length > 1 ? tmp[1][0] : tmp[0].length > 1 ? tmp[0][tmp[0].length - 1] : '') || '')).toUpperCase();

		var item = MAIN.users.findItem('id', model.id);
		if (item == null) {

			model.id = model.id.slug().replace(/-/g, '');
			model.password = model.password.substring(0, 7) === 'sha256:' ? model.password.substring(7) : model.password.sha256();
			model.created = NOW;
			MAIN.users.push(model);

		} else {

			if (!item.external) {
				item.name = model.name;
				item.email = model.email;
				item.sa = model.sa;
				item.blocked = model.blocked;
				item.position = model.position;
				item.initials = model.initials;
			}

			item.darkmode = model.darkmode;
			item.localsave = model.localsave;
			item.dbviewer = model.dbviewer;

			if (!item.external) {
				if (model.password.substring(0, 3) !== '***') {
					if (model.password.substring(0, 7) === 'sha256:')
						item.password = model.password.substring(7);
					else
						item.password = model.password.sha256();
				}
			}

			if (item.blocked && MAIN.ws)
				MAIN.ws.send(WSBLOCKED, client => client.user.id === item.id);
		}

		MAIN.save(1);
		$.success();
	});

	schema.addWorkflow('create', function($) {

		if (MAIN.users.length) {
			$.invalid('error-permissions');
			return;
		}

		var model = $.clean();
		var tmp = model.name.split(' ');
		model.initials = (tmp[0][0] + (tmp.length > 1 ? tmp[1][0] : '')).toUpperCase();
		model.id = model.id.slug().replace(/-/g, '');
		model.password = model.password.sha256();
		model.created = NOW;
		model.sa = true;
		model.blocked = false;
		model.position = 'Administrator';
		model.darkmode = 2;
		model.localsave = true;
		model.dbviewer = true;

		MAIN.users.push(model);
		MAIN.save(1);

		login($, model);
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
			MAIN.ws.send(WSBLOCKED, client => client.user.id === item.id);
			MAIN.users.splice(index, 1);
			MAIN.save();
		}

		$.success();
	});

});

function login($, user) {
	MAIN.auth.authcookie($, UID(), user.id, '1 month');
	$.success();
}

(function() {

	var schema = '*id:lower,*name:string,*email:string,phone:string,position:string,sa:boolean,permissions:[string]'.toJSONSchema();

	FUNC.syncuser = function(response) {

		var output = schema.transform(response);
		if (output.error)
			return { error: output.error };

		var profile = output.response;
		var tmp = profile.name.split(' ');

		profile.id = profile.id.slug().replace(/-/g, '');
		profile.initials = (tmp[0][0] + (tmp.length > 1 ? tmp[1][0] : '')).toUpperCase();

		var user = MAIN.users.findItem('id', profile.id);
		if (user) {
			COPY(response, user);
			user.external = true;
		} else {
			user = response;
			user.created = NOW;
			user.blocked = false;
			user.darkmode = 2;
			user.localsave = true;
			user.dbviewer = true;
			user.external = true;
			MAIN.users.push(user);
		}

		if (profile.permissions && profile.permissions.includes('admin'))
			user.sa = true;

		MAIN.save(1);
		return { user: user };
	};

})();

NEWSCHEMA('Login', function(schema) {

	schema.define('email', 'Email', true);
	schema.define('password', 'String(50)', true);

	// Performs login
	schema.setSave(function($) {

		if (DDOS[$.ip] > 4) {
			$.invalid('error-blocked-ip');
			return;
		}

		if (DDOS[$.ip])
			DDOS[$.ip]++;
		else
			DDOS[$.ip] = 1;

		var user = MAIN.users.findItem('email', $.model.email);
		var signin = function() {

			if (!user || user.password !== $.model.password.sha256() || user.external) {
				$.invalid('error-credentials');
				return;
			}

			if (user.blocked) {
				$.invalid('error-blocked');
				return;
			}

			login($, user);

		};

		if (PREF.login) {

			$.model.type = 'login';
			$.model.code = PREF.name;
			$.model.url = PREF.url;

			RESTBuilder.POST(PREF.login, $.model).callback(function(err, response) {

				if (err) {
					if (!user || user.external)
						$.invalid(err);
					else
						signin();
					return;
				}

				if (response instanceof Array) {
					err = response[0];
					if (!user || user.external)
						$.invalid(err ? (err.error || err.message) : 'error-credentials');
					else
						signin();
					return;
				}

				if (typeof(response) === 'string') {
					if (!user || user.external)
						$.invalid(response);
					else
						signin();
					return;
				}

				if (!response || !response.id) {
					if (!user || user.external)
						$.invalid('error-credentials');
					else
						signin();
					return;
				}

				var output = FUNC.syncuser(response);
				if (output.error) {
					$.invalid(output.error);
					return;
				}

				login($, output.user);
			});

		} else
			signin();
	});

});

ON('service', function(counter) {
	if (counter % 15 === 0)
		DDOS = {};
});