const IS_WINDOWS = require('os').platform().substring(0, 3).toLowerCase() === 'win';
const SKIP = (IS_WINDOWS ? /\\\.git\// : /\/\.git\// );
const Path = require('path');
const Fs = require('fs');
const Internal = require('total.js/internal');

NEWSCHEMA('Projects', function(schema) {

	schema.define('id', 'UID');
	schema.define('name', 'String(50)', true);
	schema.define('repository', 'String(100)');
	schema.define('path', 'String(100)', true);
	schema.define('pathsync', 'String(100)');
	schema.define('permissions', String);
	schema.define('documentation', 'String(200)');
	schema.define('support', 'String(200)');
	schema.define('logfile', 'String(100)');
	schema.define('url', 'String(100)');
	schema.define('icon', 'String(30)');
	schema.define('users', '[Lower(30)]');
	schema.define('backup', Boolean);
	schema.define('skipsrc', Boolean);
	schema.define('skiptmp', Boolean);
	schema.define('skipnm', Boolean);
	schema.define('resetcombo', Boolean);
	schema.define('resettime', Boolean);

	schema.setGet(function($) {
		var item = MAIN.projects.findItem('id', $.id);
		if (item) {
			item = CLONE(item);
			item.combo = undefined;
			item.time = undefined;
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

	schema.addWorkflow('translate', function($) {

		var item = MAIN.projects.findItem('id', $.id);
		var filename = Path.join(item.path, $.query.path);

		MAIN.log($.user, 'files_translate', item, filename);
		Fs.readFile(filename, function(err, data) {

			if (err) {
				$.invalid(err);
				return;
			}

			var content = data.toString('utf8');
			var command = Internal.findLocalization(content, 0);
			var text = {};
			var max = 0;
			while (command !== null) {

				// Skip for direct reading
				if (command.command[0] === '#' && command.command[1] !== ' ') {
					command = Internal.findLocalization(content, command.end);
					continue;
				}

				var key = 'T' + command.command.hash();
				text[key] = command.command;
				max = Math.max(max, key.length);
				command = Internal.findLocalization(content, command.end);
			}

			var output = [];
			var keys = Object.keys(text);

			for (var i = 0, length = keys.length; i < length; i++)
				output.push(keys[i].padRight(max + 5, ' ') + ': ' + text[keys[i]]);

			$.callback(output.join('\n'));
		});
	});

	schema.setSave(function($) {

		if (!$.user.sa) {
			$.invalid('error-permissions');
			return;
		}

		var model = $.clean();
		var users = [];

		model.path = U.path(model.path);

		for (var i = 0; i < model.users.length; i++) {
			if (MAIN.users.findItem('id', model.users[i]))
				users.push(model.users[i]);
		}

		model.users = users;

		if (model.id) {
			var item = MAIN.projects.findItem('id', model.id);
			if (item) {

				if (model.resettime)
					item.time = {};

				if (model.resetcombo)
					item.combo = {};

				model.resetcombo = undefined;
				model.resettime = undefined;

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

		var skip = '';

		if (item.skiptmp)
			skip += (skip ? '|' : '') + (IS_WINDOWS ? '\\\\tmp\\\\' : '\\/tmp\\/');

		if (item.skipsrc)
			skip += (skip ? '|' : '') + (IS_WINDOWS ? '\\\\.src\\\\' : '\\/\\.src\\/');

		if (item.skipnm)
			skip += (skip ? '|' : '') + (IS_WINDOWS ? '\\\\node_modules\\\\' : '\\/node_modules\\/');

		if (skip)
			skip = new RegExp(skip);
		else
			skip = null;

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

			if (F.isWindows) {
				for (let i = 0; i < files.length; i++)
					files[i] = files[i].replace(/\\/g, '/');

				for (let i = 0; i < directories.length; i++)
					directories[i] = directories[i].replace(/\\/g, '/');
			}

			$.callback({ review: !!PREF.token, files: files, directories: directories, url: item.url, name: item.name, icon: item.icon, repository: item.repository, id: item.id, documentation: item.documentation, support: item.support, pathsync: item.pathsync, combo: item.combo, time: item.time, todo: item.todo });

		}, n => !SKIP.test(n) && (!skip || !skip.test(n)));
	});

	schema.setRemove(function($) {

		if (!$.user.sa) {
			$.invalid('error-permissions');
			return;
		}

		var index = MAIN.projects.findIndex('id', $.id);
		var item = MAIN.projects[index];

		if (index !== -1) {
			MAIN.projects.splice(index, 1);
			MAIN.save(2);
		}

		MAIN.log($.user, 'projects_remove', item, null);
		NOSQL($.id + '_parts').drop();

		// @TODO: update all projects sessions
		$.success();
	});

	schema.addWorkflow('backupsclear', function($) {

		if (!$.user.sa) {
			$.invalid('error-permissions');
			return;
		}

		var project = MAIN.projects.findItem('id', $.id);
		if (project == null) {
			$.invalid('error-project');
			return;
		}

		var path = Path.join(CONF.backup, project.path);

		U.ls(path, function(files, directories) {
			PATH.unlink(files, function() {
				directories.quicksort();
				directories.reverse();
				directories.wait(function(dir, next) {
					Fs.rmdir(dir, next);
				}, function() {
					$.success();
				});
			});
		});
	});

	schema.addWorkflow('backups', function($) {

		var project = MAIN.projects.findItem('id', $.id);
		if (project == null) {
			$.invalid('error-project');
			return;
		}

		var path = $.query.path;
		var user = $.user;

		if (!user.sa) {
			if (project.users.indexOf(user.id) === -1) {
				$.invalid('error-permissions');
				return;
			}

			if (!MAIN.authorize(project, $.user, path)) {
				$.invalid('error-permissions');
				return;
			}
		}

		var name = U.getName($.query.path);
		var dir = Path.dirname(path);
		path = Path.join(CONF.backup, project.path, dir);

		var index = name.lastIndexOf('.');
		if (index !== -1)
			name = name.substring(0, index);

		Fs.readdir(path, function(err, response) {

			if (err || !response || !response.length) {
				$.callback(EMPTYARRAY);
				return;
			}

			var tmp = name + '-';
			var arr = [];
			var users = {};

			for (var i = 0; i < response.length; i++) {
				var filename = response[i];
				if (filename.substring(0, tmp.length) === tmp) {
					var meta = filename.substring(tmp.length).split('_');
					var dt = meta[0];
					index = meta[1].lastIndexOf('.');
					if (index !== -1)
						meta[1] = meta[1].substring(0, index);

					var usr = users[meta[1]];
					if (!usr) {
						usr = MAIN.users.findItem('id', meta[1]);
						users[meta[1]] = usr;
					}

					arr.push({ filename: Path.join(dir, filename), date: new Date(2000 + (+dt.substring(0, 2)), (+dt.substring(2, 4)) - 1, +dt.substring(4, 6), +dt.substring(6, 8), +dt.substring(8, 10)), id: meta[1], user: usr ? usr.name : meta[1] });
				}
			}

			$.callback(arr);
		});
	});

	schema.addWorkflow('restore', function($) {

		var project = MAIN.projects.findItem('id', $.id);
		if (project == null) {
			$.invalid('error-project');
			return;
		}

		var user = $.user;
		var path = $.query.path;

		if (!user.sa) {

			if (project.users.indexOf(user.id) === -1) {
				$.invalid('error-permissions');
				return;
			}

			var pathtmp = path.replace(/-\d+_[a-z0-9]/, '');

			if (!MAIN.authorize(project, $.user, pathtmp)) {
				$.invalid('error-permissions');
				return;
			}
		}

		var filename = Path.join(CONF.backup, project.path, path);

		MAIN.log($.user, 'files_restore', project, filename);

		Fs.readFile(filename, function(err, data) {
			if (err)
				$.invalid(err);
			else
				$.callback(data.toString('utf8'));
		});
	});

	schema.addWorkflow('logfile', function($) {

		var project = MAIN.projects.findItem('id', $.id);
		if (project == null) {
			$.invalid('error-project');
			return;
		}

		var filename = project.logfile ? project.logfile : Path.join(project.path, 'logs/debug.log');

		Fs.stat(filename, function(err, stats) {
			if (stats) {
				var start = stats.size - (1024 * 4); // Max 4 kb
				Fs.createReadStream(filename, { start: start < 0 ? 0 : start }).once('data', chunk => $.callback(chunk.toString('utf8')));
			} else
				$.callback('');
		});
	});
});
