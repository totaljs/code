const Path = require('path');
const Fs = require('fs');

NEWSCHEMA('FilesTodo', function(schema) {
	schema.define('line', Number);
	schema.define('ch', Number);
	schema.define('name', 'String(70)');
});

NEWSCHEMA('FilesTodoClear', function(schema) {

	schema.define('path', 'String(500)');

	schema.setRemove(function($) {

		var project = MAIN.projects.findItem('id', $.id);
		if (project == null) {
			$.invalid('error-project');
			return;
		}

		var model = $.body;
		var user = $.user;

		if (!user.sa) {
			if (project.users.indexOf(user.id) === -1) {
				$.invalid('error-permissions');
				return;
			}

			if (!MAIN.authorize(project, $.user, model.path)) {
				$.invalid('error-permissions');
				return;
			}
		}

		var count = project.todo.length;
		project.todo = project.todo.remove('path', model.path);
		if (count !== project.todo.length)
			setTimeout2('combo', MAIN.save, 2000, null, 2);

		$.success();
	});

});


NEWSCHEMA('Files', function(schema) {

	schema.define('body', String);
	schema.define('path', 'String(500)', true);
	schema.define('sync', Boolean);
	schema.define('todo', '[FilesTodo]');
	schema.define('combo', Number); // Max. combo
	schema.define('time', Number);  // Spent time

	schema.trim = false;

	schema.setSave(function($) {

		var user = $.user;
		var model = $.model;

		var project = MAIN.projects.findItem('id', $.id);
		if (project == null) {
			$.invalid('error-project');
			return;
		}

		if (!user.sa) {
			if (project.users.indexOf(user.id) === -1) {
				$.invalid('error-permissions');
				return;
			}

			if (!MAIN.authorize(project, $.user, model.path)) {
				$.invalid('error-permissions');
				return;
			}
		}

		var filename = Path.join(project.path, model.path);
		var name = U.getName(filename);
		var is = false;

		var count = model.combo;
		if (count) {
			var combo = project.combo ? project.combo[user.id] : null;
			if (combo) {
				var max = Math.max(count, combo.max);
				if (max !== combo.max) {
					combo.max = max;
					combo.date = NOW;
					is = true;
				}
			} else {
				if (project.combo)
					combo = project.combo;
				else
					combo = project.combo = {};
				combo[user.id] = { max: count, date: NOW };
				is = true;
			}
		}

		if (model.time > 2700)
			model.time = 0;

		if (model.time) {
			if (!project.time)
				project.time = {};

			if (!project.time[user.id])
				project.time[user.id] = {};

			var time = project.time[user.id];
			var ym = NOW.format('yyyyMM');
			if (time[ym])
				time[ym] += model.time;
			else
				time[ym] = model.time;
			is = true;
		}

		if (project.todo)
			project.todo = project.todo.remove('path', model.path);
		else
			project.todo = [];

		if (model.todo && model.todo.length) {
			for (var i = 0; i < model.todo.length; i++) {
				var todo = model.todo[i].$clean();
				todo.path = model.path;
				project.todo.push(todo);
				is = true;
			}
		}

		is && setTimeout2('combo', MAIN.save, 2000, null, 2);

		MAIN.log($.user, 'files_save', project, filename, count, model.time);
		MAIN.change('save', $.user, project, model.path, count, model.time);

		// Tries to create a folder
		F.path.mkdir(filename.substring(0, filename.length - name.length));

		if (project.backup)
			MAIN.backup(user, filename, () => Fs.writeFile(filename, model.body, ERROR('files.write')), project);
		else
			Fs.writeFile(filename, model.body, ERROR('files.write'));

		if (model.sync && project.pathsync) {
			filename = Path.join(project.pathsync, model.path);
			F.path.mkdir(filename.substring(0, filename.length - name.length));
			Fs.writeFile(filename, model.body, ERROR('files.write'));
			$.success('synchronized');
		} else
			$.success();

		MAIN.changelog(user, $.id, model.path);
	});

	schema.addWorkflow('changelog', function($) {
		TABLE('changelog').one().fields('user', 'updated').where('projectid', $.id).where('path', $.query.path).callback(function(err, response) {
			if (response) {
				var tmp = MAIN.users.findItem('id', response.user);
				response.user = tmp ? tmp.name : response.user;
			}
			$.callback(response || null);
		});
	});

	schema.addWorkflow('review', function($) {

		var project = MAIN.projects.findItem('id', $.id);
		if (project == null) {
			$.invalid('error-project');
			return;
		}

		if (!user.sa) {
			if (project.users.indexOf(user.id) === -1) {
				$.invalid('error-permissions');
				return;
			}

			if (!MAIN.authorize(project, $.user, $.query.path)) {
				$.invalid('error-permissions');
				return;
			}
		}

		var filename = Path.join(project.path, $.query.path);
		var builder = RESTBuilder.url('https://review.totaljs.com/api/upload/review/');
		var data = {};
		var user = $.user;

		data.ip = $.ip;
		data.version = 1;
		data.path = $.query.path;
		data.token = PREF.token;
		data.project = project.name;
		data.projectid = project.id;
		data.userid = user.id;
		data.userposition = user.position;
		data.useremail = user.email;
		data.user = user.name;

		builder.post(data);
		builder.file('file', filename);
		builder.exec($.callback);

		MAIN.log($.user, 'files_review', project, filename);
	});

});

NEWSCHEMA('FilesRename', function(schema) {

	schema.define('oldpath', 'String', true);
	schema.define('newpath', 'String', true);

	schema.addWorkflow('exec', function($) {

		var user = $.user;
		var model = $.model;
		var project = MAIN.projects.findItem('id', $.id);

		if (project == null) {
			$.invalid('error-project');
			return;
		}

		if (!user.sa) {
			if (project.users.indexOf(user.id) === -1) {
				$.invalid('error-permissions');
				return;
			}

			if (!MAIN.authorize(project, $.user, model.oldpath, model.newpath)) {
				$.invalid('error-permissions');
				return;
			}
		}

		model.oldpath = Path.join(project.path, model.oldpath);
		model.newpath = Path.join(project.path, model.newpath);

		if (model.newpath.substring(0, project.path.length) !== project.path) {
			// out of directory
			$.invalid('error-permissions');
			return;
		}

		F.path.mkdir(Path.dirname(model.newpath));

		MAIN.log($.user, 'files_rename', project, model.oldpath, model.newpath);
		MAIN.change('rename', $.user, project, model.oldpath + ' --> ' + model.newpath);

		Fs.rename(model.oldpath, model.newpath, function(err) {
			if (err)
				$.invalid(err);
			else
				$.success();
		});

	});
});

NEWSCHEMA('FilesRemove', function(schema) {
	schema.define('path', 'String', true);
	schema.addWorkflow('exec', function($) {

		var user = $.user;
		var model = $.model;
		var project = MAIN.projects.findItem('id', $.id);

		if (project == null) {
			$.invalid('error-project');
			return;
		}

		if (!user.sa) {
			if (project.users.indexOf(user.id) === -1) {
				$.invalid('error-permissions');
				return;
			}

			if (!MAIN.authorize(project, $.user, model.path)) {
				$.invalid('error-permissions');
				return;
			}
		}

		var filename = Path.join(project.path, model.path);
		MAIN.log($.user, 'files_remove', project, model.path);
		MAIN.change('remove', $.user, project, model.path);
		MAIN.changelog(user, $.id, model.path, true);

		try {
			var stats = Fs.lstatSync(filename);
			if (stats.isFile() && project.backup)
				MAIN.backup(user, filename, () => Fs.unlink(filename, ERROR('files.remove')), project);
			else {
				if (stats.isDirectory())
					F.path.rmdir(filename);
				else
					Fs.unlink(filename, ERROR('files.remove'));
			}
		} catch (e) {}

		$.success();
	});
});

NEWSCHEMA('FilesUpload', function(schema) {
	schema.define('path', 'String', true);
	schema.addWorkflow('exec', function($) {

		var user = $.user;
		var model = $.model;
		var project = MAIN.projects.findItem('id', $.id);

		if (project == null) {
			$.invalid('error-project');
			return;
		}

		if (!user.sa) {
			if (project.users.indexOf(user.id) === -1) {
				$.invalid('error-permissions');
				return;
			}

			if (!MAIN.authorize(project, $.user, model.path)) {
				$.invalid('error-permissions');
				return;
			}
		}

		$.files.wait(function(file, next) {
			var filename = Path.join(project.path, model.path, file.filename);
			MAIN.log($.user, 'files_upload', project, model.path + file.filename);
			MAIN.change('upload', $.user, project, model.path + file.filename);
			MAIN.changelog(user, $.id, model.path + file.filename);
			file.move(filename, next);
		}, $.done());

	});
});

NEWSCHEMA('FilesCreate', function(schema) {

	schema.define('path', 'String', true);
	schema.define('folder', Boolean);
	schema.define('clone', 'String');

	schema.addWorkflow('exec', function($) {

		var user = $.user;
		var model = $.model;
		var project = MAIN.projects.findItem('id', $.id);

		if (project == null) {
			$.invalid('error-project');
			return;
		}

		if (!user.sa) {
			if (project.users.indexOf(user.id) === -1) {
				$.invalid('error-permissions');
				return;
			}

			if (!MAIN.authorize(project, $.user, model.path)) {
				$.invalid('error-permissions');
				return;
			}
		}

		var filename = Path.join(project.path, model.path);

		MAIN.change('create', $.user, project, model.path);
		MAIN.changelog($.user, $.id, model.path);

		Fs.lstat(filename, function(err) {

			if (err) {
				// file not found
				// we can continue
				if (model.folder) {
					F.path.mkdir(filename);
					$.success();
				} else {
					var name = U.getName(filename);
					F.path.mkdir(filename.substring(0, filename.length - name.length));

					if (model.clone) {
						Fs.copyFile(Path.join(project.path, model.clone), filename, function(err) {
							if (err)
								$.invalid(err);
							else
								$.success();
						});
					} else {
						Fs.writeFile(filename, '', function(err) {
							if (err)
								$.invalid(err);
							else
								$.success();
						});
					}
				}
			} else
				$.invalid('path', model.path + ' already exists');
		});

	});
});
