const SKIP = /\/\.git\//;
const Path = require('path');
const Fs = require('fs');

NEWSCHEMA('Projects', function(schema) {

	schema.define('id', 'UID');
	schema.define('name', 'String(50)', true);
	schema.define('repository', 'String(100)');
	schema.define('path', 'String(100)', true);
	schema.define('permissions', String);
	schema.define('url', 'String(100)');
	schema.define('icon', 'String(30)');
	schema.define('users', '[Lower(30)]');
	schema.define('backup', Boolean);
	schema.define('skipsrc', Boolean);
	schema.define('skiptmp', Boolean);

	schema.setGet(function($) {
		var item = MAIN.projects.findItem('id', $.id);
		if (item) {
			item = CLONE(item);
			$.callback(item);
		}
	});

	schema.addWorkflow('edit', function($) {

		var item = MAIN.projects.findItem('id', $.id);
		var filename = Path.join(item.path, $.query.path);

		MAIN.log($.user, 'files_read', item, filename);
		Fs.readFile(filename, function(err, data) {
			if (err)
				$.invalid(err);
			else
				$.callback(data.toString('utf8'));
		});
	});

	schema.setSave(function($) {

		if (!$.user.sa) {
			$.invalid('error-permissions');
			return;
		}

		var model = $.clean();

		if (model.id) {
			var item = MAIN.projects.findItem('id', model.id);
			if (item) {
				U.extend(item, model);
				item.updated = NOW;
			}
		} else {
			model.id = UID();
			model.ownerid = $.user.id;
			model.created = NOW;

			MAIN.projects.push(model);
		}

		MAIN.save(2);
		$.success();
	});

	schema.setQuery(function($) {

		var items = [];
		for (var i = 0; i < MAIN.projects.length; i++) {

			var item = MAIN.projects[i];
			var data = {};

			data.name = item.name;
			data.url = item.url;
			data.owner = item.ownerid === $.user.id;
			data.icon = item.icon;
			data.repository = item.repository;
			data.created = item.created;
			data.id = item.id;
			data.users = item.users;

			if ($.user.sa) {
				data.path = item.path;
				items.push(data);
			} else if (item.users.indexOf($.user.id) !== -1)
				items.push(data);
		}

		$.callback(items);
	});

	schema.addWorkflow('files', function($) {

		var item = MAIN.projects.findItem('id', $.id);
		if (item == null) {
			$.invalid('error-project');
			return;
		}

		var allowed = [];
		var path = item.path;

		if (!$.user.sa) {

			var user = item.users.indexOf($.user.id);
			if (user === -1) {
				$.invalid('error-permissions');
				return;
			}

			var permissions = item.permissions.split('\n');
			for (var i = 0; i < permissions.length; i++) {
				var permission = permissions[i].split(':').trim();
				if (permission[0] === $.user.id)
					allowed.push(permission[1]);
			}
		}

		if (allowed.length)
			allowed.quicksort(false);
		else
			allowed = null;

		var skip;

		if (item.skiptmp && item.skipsrc)
			skip = /\/tmp\/|\/\.src\//;
		else if (item.skiptmp)
			skip = /\/tmp\//;
		else if (skip.skipsrc)
			skip = /\/\.src\//;

		U.ls(path, function(files, directories) {

			for (var i = 0, length = files.length; i < length; i++)
				files[i] = files[i].substring(path.length - 1);

			for (var i = 0, length = directories.length; i < length; i++)
				directories[i] = directories[i].substring(path.length - 1);

			if (allowed) {
				var cleaner = (path) => MAIN.can(allowed, path) == false;
				files = files.remove(cleaner);
				directories = directories.remove(cleaner);
			}

			$.callback({ files: files, directories: directories, url: item.url, name: item.name, icon: item.icon, repository: item.repository, id: item.id });

		}, n => !SKIP.test(n) && (!skip || !skip.test(n)));
	});

	schema.setRemove(function($) {

		var index = MAIN.projects.findIndex('id', $.id);
		var item = MAIN.projects[index];

		if (index !== -1) {
			MAIN.projects.splice(index, 1);
			MAIN.save(2);
		}

		MAIN.log($.user, 'projects_remove', item, null);

		// @TODO: update all projects sessions
		$.success();
	});

});