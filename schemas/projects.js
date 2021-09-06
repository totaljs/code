const IS_WINDOWS = require('os').platform().substring(0, 3).toLowerCase() === 'win';
const SKIP = (IS_WINDOWS ? /\\\.git\// : /\/\.git\// );
const Path = require('path');
const Fs = require('fs');
const Internal = require('total4/internal');

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
	schema.define('token', 'String(50)');
	schema.define('icon', 'String(30)');
	schema.define('users', '[Lower(30)]');
	schema.define('backup', Boolean);
	schema.define('skipsrc', Boolean);
	schema.define('skiptmp', Boolean);
	schema.define('skipnm', Boolean);
	schema.define('allowbundle', Boolean);
	schema.define('allowscripts', Boolean);
	schema.define('servicemode', Boolean);
	schema.define('resetcombo', Boolean);
	schema.define('resettime', Boolean);
	schema.define('resetchangelog', Boolean);
	schema.define('allowlivereload', Boolean);

	// TMS
	schema.jsonschema_define('userid', 'String');
	schema.jsonschema_define('username', 'String');
	schema.jsonschema_define('ua', 'String');
	schema.jsonschema_define('ip', 'String');
	schema.jsonschema_define('dttms', 'String');
	schema.jsonschema_define('projectname', 'String');
	schema.jsonschema_define('projectid', 'String');
	schema.jsonschema_define('projectpath', 'String');

	schema.setGet(function($) {
		var item = MAIN.projects.findItem('id', $.id);
		if (item) {
			item = CLONE(item);
			item.combo = undefined;
			item.time = undefined;
			$.callback(item);
		} else
			$.invalid('error-project');
	});

	schema.addWorkflow('edit', function($) {

		var item = MAIN.projects.findItem('id', $.id);
		var filename = Path.join(item.path, $.query.path);

		MAIN.log($.user, 'files_read', item, filename);

		if (CONF.allow_tms) {
			var publish = {};
			publish.filename = filename;
			publish.project = item.name;
			publish.projectpath = item.path;
			publish.projectid = $.id;
			publish.name = publish.filename.split('/').slice(-1)[0];
			PUBLISH('files_read', FUNC.tms($, publish));
		}

		if (item.isexternal) {
			FUNC.external(item, 'load', $.query.path, null, $.callback);
			return;
		}

		Fs.readFile(filename, function(err, data) {

			if (err) {
				$.invalid(err);
				return;
			}

			var index = -1;

			while (true) {
				index += 1;
				if (data.length <= index || data[index] !== 0)
					break;
			}

			if (index !== -1)
				data = data.slice(index);

			$.callback(data.toString('utf8'));
		});
	});

	schema.addWorkflow('translate', function($) {

		var item = MAIN.projects.findItem('id', $.id);
		var filename = item.isexternal ? $.query.path : Path.join(item.path, $.query.path);

		MAIN.log($.user, 'files_translate', item, filename);

		var process = function(err, data) {

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

				var key = 'T' + command.command.makeid();
				text[key] = command.command;
				max = Math.max(max, key.length);
				command = Internal.findLocalization(content, command.end);
			}

			var output = [];
			var keys = Object.keys(text);

			for (var i = 0, length = keys.length; i < length; i++)
				output.push(keys[i].padRight(max + 5, ' ') + ': ' + text[keys[i]]);

			$.callback(output.join('\n'));
		};

		if (item.isexternal)
			FUNC.external(item, 'load', filename, null, process);
		else
			Fs.readFile(filename, process);

	});

	schema.addWorkflow('localize', function($) {

		var item = MAIN.projects.findItem('id', $.id);
		MAIN.log($.user, 'files_localize', item, item.path);

		var process = function(files) {

			var resource = {};
			var texts = {};
			var max = 0;
			var file;
			var key;

			var analyze = function(filename, content, ext) {

				var command = Internal.findLocalization(content, 0);
				while (command !== null) {

					// Skip for direct reading
					if (command.command[0] === '#' && command.command[1] !== ' ') {
						command = Internal.findLocalization(content, command.end);
						continue;
					}

					key = 'T' + command.command.makeid();
					file = filename.substring(item.isexternal ? 1 : item.path.length);

					texts[key] = command.command;

					if (resource[key]) {
						if (resource[key].indexOf(file) === -1)
							resource[key] += ', ' + file;
					} else
						resource[key] = file;

					max = Math.max(max, key.length);
					command = Internal.findLocalization(content, command.end);
				}

				if (ext === 'js') {
					// ErrorBuilder
					var tmp = content.match(/\.invalid\('[a-z-0-9]+'\)/gi);
					if (tmp) {
						for (var j = 0; j < tmp.length; j++) {
							var m = (tmp[j] + '');
							m = m.substring(10, m.length - 2);
							key = m;
							file = filename.substring(item.isexternal ? 1 : item.path.length);
							texts[key] = m;
							if (resource[key]) {
								if (resource[key].indexOf(file) === -1)
									resource[key] += ', ' + file;
							} else
								resource[key] = file;
							max = Math.max(max, key.length);
						}
					}

					// DBMS
					tmp = content.match(/\.(error|err)\('[a-z-0-9]+'/gi);
					if (tmp) {
						for (var j = 0; j < tmp.length; j++) {
							var m = (tmp[j] + '');
							m = m.substring(m.indexOf('(') + 2, m.length - 1);
							key = m;
							file = filename.substring(item.isexternal ? 1 : item.path.length);
							texts[key] = m;
							if (resource[key]) {
								if (resource[key].indexOf(file) === -1)
									resource[key] += ', ' + file;
							} else
								resource[key] = file;
							max = Math.max(max, key.length);
						}
					}
				}
			};

			files.wait(function(filename, next) {

				var ext = U.getExtension(filename);

				if (filename.indexOf('sitemap') === -1 && ext !== 'html' && ext !== 'js') {
					next();
					return;
				}

				if (item.isexternal) {
					FUNC.external(item, 'load', filename, null, function(err, response) {
						if (response)
							analyze(filename, response, ext);
						next();
					});
				} else {
					Fs.readFile(filename, function(err, data) {
						if (data)
							analyze(filename, data.toString('utf8'), ext);
						next();
					});
				}

			}, function() {

				var keys = Object.keys(resource);
				var builder = [];
				var output = {};

				for (var i = 0, length = keys.length; i < length; i++) {
					if (!output[resource[keys[i]]])
						output[resource[keys[i]]] = [];
					output[resource[keys[i]]].push(keys[i].padRight(max + 5, ' ') + ': ' + texts[keys[i]]);
				}

				keys = Object.keys(output);
				for (var i = 0, length = keys.length; i < length; i++)
					builder.push('\n// ' + keys[i] + '\n' + output[keys[i]].join('\n'));

				var data = '// Total.js localization file\n// Created by ' + $.user.name + ': ' + new Date().format('yyyy-MM-dd HH:mm') + '\n' + builder.join('\n');

				if (item.isexternal)
					FUNC.external(item, 'save', '/localization.resource', data, $.done());
				else
					Fs.writeFile(Path.join(item.path, 'localization.resource'), data, $.done());
			});

		};

		if (item.isexternal) {
			FUNC.external(item, 'browse', item.path, JSON.stringify({ type: 'localization' }), function(err, response) {
				process(response.files || EMPTYARRAY);
			});
		} else
			U.ls(item.path, process, (path, dir) => dir ? (path.endsWith('/node_modules') || path.endsWith('/tmp') || path.endsWith('/.git') || path.endsWith('/.src') || path.endsWith('/logs')) ? false : true : true);
	});

	schema.setSave(function($) {

		if ($.user && !$.user.sa) {
			$.invalid('error-permissions');
			return;
		}

		var model = $.clean();
		var users = [];

		model.isexternal = (/external:\/\//).test(model.path);

		if (!model.isexternal)
			model.path = U.path(model.path.replace(/\/\//g, '/').replace(/\\\\/g, '\\'));

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

				if (model.resetchangelog)
					NOSQL(model.id + '_changes').remove();

				model.resetcombo = undefined;
				model.resettime = undefined;
				model.resetchangelog = undefined;

				U.extend(item, model);
				item.updated = NOW;

				PUBLISH('projects_update', FUNC.tms($, model, item));
			}
		} else {
			model.id = UID();
			model.ownerid = $.user ? $.user.id : null;
			model.created = NOW;
			MAIN.projects.push(model);

			PUBLISH('projects_create', FUNC.tms($, model));
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
			data.isexternal = item.isexternal;
			data.users = item.users;

			if ($.user.sa) {
				data.path = item.path;
				items.push(data);
			} else if (item.users.indexOf($.user.id) !== -1)
				items.push(data);
		}

		items.quicksort('created', true);

		if ($.query.check) {
			items.wait(function(item, next) {
				if (item.isexternal) {
					// Check URL
					FUNC.external(item, 'ping', null, null, function(err, response) {
						item.notfound = err || response.success !== true;
					});
					next();
				} else {
					Fs.lstat(item.path, function(err) {
						item.notfound = err ? true : false;
						next();
					});
				}

			}, () => $.callback(items));
		} else
			$.callback(items);
	});

	schema.addWorkflow('files', function($) {

		var item = MAIN.projects.findItem('id', $.id);
		if (!item) {
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

		var skip = '\\.socket';

		if (item.skiptmp)
			skip += (skip ? '|' : '') + (IS_WINDOWS ? '\\\\tmp\\\\' : '\\/tmp\\/');

		if (item.skipsrc)
			skip += (skip ? '|' : '') + (IS_WINDOWS ? '\\\\.src\\\\' : '\\/\\.src\\/');

		if (item.skipnm)
			skip += (skip ? '|' : '') + (IS_WINDOWS ? '\\\\node_modules\\\\' : '\\/node_modules\\/');

		var process = function(files, directories) {

			if (!item.isexternal) {
				for (var i = 0, length = files.length; i < length; i++)
					files[i] = files[i].substring(path.length - 1);

				for (var i = 0, length = directories.length; i < length; i++)
					directories[i] = directories[i].substring(path.length - 1);
			}

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

			var users = [];

			for (var i = 0; i < MAIN.users.length; i++) {
				var tmpuser = MAIN.users[i];
				users.push({ id: tmpuser.id, name: tmpuser.name, collaborator: !!(item.time ? item.time[tmpuser.id] : 0) });
			}

			$.callback({ isexternal: item.isexternal, servicemode: item.servicemode, livereload: item.allowlivereload, branch: item.branch, allowbundle: item.allowbundle, review: !!PREF.token, files: files, directories: directories, url: item.url, name: item.name, icon: item.icon, repository: item.repository, id: item.id, documentation: item.documentation, support: item.support, pathsync: item.pathsync, combo: item.combo, time: item.time, todo: item.todo, users: users });
		};

		if (item.isexternal) {
			FUNC.external(item, 'browse', item.path, JSON.stringify({ skip: skip }), function(err, response) {
				if (err)
					$.invalid(err);
				else
					process(response.files, response.directories);
			});
		} else {

			if (skip)
				skip = new RegExp(skip);
			else
				skip = null;

			U.ls(path, process, n => !SKIP.test(n) && (!skip || !skip.test(n)));
		}
	});

	schema.setRemove(function($) {

		var id = $.id || $.options.id;

		if ($.user && !$.user.sa) {
			$.invalid('error-permissions');
			return;
		}

		$WORKFLOW('Projects', 'backupsclear', { id: id, internal: $.options.internal }, NOOP);

		var index = MAIN.projects.findIndex('id', id);
		var item = MAIN.projects[index];

		if (index !== -1) {
			MAIN.projects.splice(index, 1);
			MAIN.save(2);
		}

		MAIN.log($.user, 'projects_remove', item, null);
		NOSQL(id + '_parts').drop();

		PUBLISH('projects_emove', FUNC.tms($, null, item));

		$.success();
	});

	schema.addWorkflow('backupsclear', function($) {

		var id = $.id || $.options.id;

		if ($.user && !$.user.sa) {
			$.invalid('error-permissions');
			return;
		}

		var project = MAIN.projects.findItem('id', id);
		if (project == null) {
			$.invalid('error-project');
			return;
		}

		var path = Path.join(CONF.backup, project.isexternal ? FUNC.external_path(project) : project.path);

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

		var path = $.query.path || '';
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

		var name = U.getName(path);
		var dir = Path.dirname(path);
		var ext = '';

		path = Path.join(CONF.backup, project.isexternal ? FUNC.external_path(project) : project.path, dir);

		var extindex = name.lastIndexOf('.');
		if (extindex !== -1) {
			ext = name.substring(extindex);
			name = name.substring(0, extindex);
		}

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
				if (filename.substring(0, tmp.length) === tmp && filename.charCodeAt(tmp.length + 1) < 58) {
					var meta = filename.substring(tmp.length, filename.length - ext.length).split('_');
					var dt = meta[0];
					var index = meta[1].lastIndexOf('.');
					if (index !== -1)
						meta[1] = meta[1].substring(0, index);

					var usr = users[meta[1]];
					if (!usr) {
						usr = MAIN.users.findItem('id', meta[1]);
						users[meta[1]] = usr;
					}

					if (project.branch && meta[3] !== project.branch)
						continue;

					arr.push({ filename: Path.join(dir, filename), date: new Date(2000 + (+dt.substring(0, 2)), (+dt.substring(2, 4)) - 1, +dt.substring(4, 6), +dt.substring(6, 8), +dt.substring(8, 10)), id: meta[1], user: usr ? usr.name : meta[1], changes: +(meta[2] || 0) });
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

		var filename = Path.join(CONF.backup, project.isexternal ? FUNC.external_path(project) : project.path, path);

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

		var thread = $.query.thread;
		if (thread && (/\/|\./).test(thread))
			thread = null;

		var name = (thread ? ('/threads/' + thread + '/logs/debug.log') : 'logs/debug.log');

		if (project.isexternal) {
			FUNC.external(project, 'log', (thread ? '' : '/') + name, null, $.callback);
			return;
		}

		var filename = project.logfile ? project.logfile : Path.join(project.path, name);

		Fs.stat(filename, function(err, stats) {
			if (stats) {
				var start = stats.size - (1024 * 4); // Max. 4 kB
				if (start < 0)
					start = 0;
				var buffer = [];
				Fs.createReadStream(filename, { start: start < 0 ? 0 : start }).on('data', chunk => buffer.push(chunk)).on('end', function() {
					var buf = Buffer.concat(buffer);
					$.callback(buf.toString('utf8'));
				});
			} else
				$.callback('');
		});
	});

	schema.addWorkflow('logfileclear', function($) {

		var project = MAIN.projects.findItem('id', $.id);
		if (project == null) {
			$.invalid('error-project');
			return;
		}

		var thread = $.query.thread;
		if (thread && (/\/|\./).test(thread))
			thread = null;

		var name = (thread ? ('/threads/' + thread + '/logs/debug.log') : 'logs/debug.log');

		if (project.isexternal) {
			FUNC.external(project, 'logclear', project.logfile ? project.logfile : ((thread ? '' : '/') + name), null, $.callback);
			return;
		}

		var filename = project.logfile ? project.logfile : Path.join(project.path, name);
		Fs.truncate(filename, NOOP);
		PUBLISH('projects_debugclear', FUNC.tms($, null, project));
		$.success();
	});
});