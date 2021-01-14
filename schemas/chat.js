NEWSCHEMA('Chat', function(schema) {

	schema.define('user', 'lower(30)');
	schema.define('body', 'String', true);

	schema.setQuery(function($) {
		var builder = TABLE('chat').find2().take(30);
		if ($.query.user) {
			var hash = ($.query.user + $.user.id).split('');
			hash.sort();
			hash = hash.join('').hash(true) + '';
			builder.where('hash', hash);
		} else
			builder.where('hash', '');

		builder.callback($.callback);

		var k = $.query.user || '_general';
		if ($.user.unread && $.user.unread[k]) {
			delete $.user.unread[k];
			MAIN.save(1);
		}

	});

	schema.setInsert(function($) {

		var model = $.clean();
		var hash = '';
		var user = model.user ? MAIN.users.findItem('id', model.user) : null;

		if (model.user && !user) {
			$.invalid('error-users-404');
			return;
		}

		model.id = UID();
		model.created = new Date();
		model.owner = $.user.id;

		if (model.user) {
			hash = (model.user + $.user.id).split('');
			hash.sort();
			hash = hash.join('').hash(true) + '';
		}

		model.hash = hash;
		TABLE('chat').insert(model);

		var msg = CLONE(model);
		msg.TYPE = 'chat';

		if (model.user) {

			if (!user.online) {
				if (!user.unread)
					user.unread = {};
				user.unread[model.owner] = (user.unread[model.owner] || 0) + 1;
				MAIN.save(1);
			}

			MAIN.ws && MAIN.ws.send(msg, client => client.user.id === msg.owner || client.user.id === msg.user);

		} else if (MAIN.ws) {

			MAIN.ws.send(msg);

			var offline = 0;

			for (var i = 0; i < MAIN.users.length; i++) {
				user = MAIN.users[i];
				if (user.id !== $.user.id && !user.online) {
					if (!user.online) {
						if (!user.unread)
							user.unread = {};
						user.unread['_general'] = (user.unread['_general'] || 0) + 1;
						offline++;
					}
				}
			}

			offline && MAIN.save(1);
		}

		$.success();
	});

	schema.addWorkflow('users', function($) {

		var users = [];

		for (var i = 0; i < MAIN.users.length; i++) {
			var user = MAIN.users[i];
			if ($.user.id !== user.id)
				users.push({ id: user.id, name: user.name, online: user.online, position: user.position });
		}

		$.callback(users);
	});

});