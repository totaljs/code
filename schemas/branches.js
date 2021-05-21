const Path = require('path');
const Exec = require('child_process').execFile;
const Fs = require('fs');

NEWSCHEMA('Branches', function(schema) {

	schema.define('name', 'Lower(30)');

	var backup = function(project, branch, callback) {

		if (!branch)
			branch = '';

		var arg = [];
		arg.push(Path.join(CONF.backup, project.id + '_' + branch) + '.tar');
		arg.push(project.path);
		arg.push(PATH.databases(project.id + '_changes.nosql'));
		arg.push(PATH.databases(project.id + '_parts.nosql'));
		Exec(PATH.databases('branch_backup.sh') + ' ' + arg.join(' '), { shell: '/bin/sh' }, callback || NOOP);
	};

	var restore = function(project, branch, callback) {

		if (!branch)
			branch = '';

		var filename = Path.join(CONF.backup, project.id + '_' + branch) + '.tar';

		Fs.lstat(filename, function(err) {

			if (err) {
				// file not found
				// we keep the current branch
				callback && callback();
				return;
			}

			var meta = [];

			meta.push(PATH.databases(project.id + '_changes.nosql'));
			meta.push(PATH.databases(project.id + '_parts.nosql'));

			PATH.unlink(meta, function() {
				var arg = [];
				arg.push(filename);
				arg.push(project.path);
				Exec(PATH.databases('branch_restore.sh') + ' ' + arg.join(' '), { shell: '/bin/sh' }, callback || NOOP);
			});

		});
	};

	schema.setQuery(function($) {

		var project = MAIN.projects.findItem('id', $.id);
		if (project == null) {
			$.invalid('error-project');
			return;
		}

		if (project.isexternal) {
			$.invalid('error-external');
			return;
		}

		var user = $.user;

		if (!user.sa && project.users.indexOf(user.id) === -1) {
			$.invalid('error-permissions');
			return;
		}

		Fs.readdir(Path.join(CONF.backup), function(err, files) {

			var output = [];

			for (var i = 0; i < files.length; i++) {
				var name = files[i];
				var index = name.indexOf('_');
				if (index !== -1 && name.substring(0, index) === $.id)
					output.push({ name: name.substring(index + 1, name.length - 4) });
			}

			var current = output.findItem('name', project.branch);
			if (current)
				current.current = true;
			else
				output.push({ name: project.branch, current: true });

			$.callback(output);
		});

	});

	schema.setSave(function($) {

		// copy all files to the current branch
		//    backup files
		//    backup nosql
		//    update project branch

		// check if the new branch exists
		//    yes: remove all files in the current directory and copy all files from branch
		//    no: change only the branch

		var project = MAIN.projects.findItem('id', $.id);
		if (project == null) {
			$.invalid('error-project');
			return;
		}

		if (!project.isexternal) {
			$.invalid('error-external');
			return;
		}

		var user = $.user;

		if (!user.sa && project.users.indexOf(user.id) === -1) {
			$.invalid('error-permissions');
			return;
		}

		var name = $.model.name.replace(/[<>",]/g, '');

		if (project.branch === name) {
			$.success();
			return;
		}

		MAIN.log($.user, 'branches_switch', project, name || 'master');

		// Backup existing
		backup(project, project.branch, function() {
			// Restore a new branch
			project.branch = name;
			MAIN.save(2);
			restore(project, project.branch, $.done());
		});

	});

	schema.setRemove(function($) {

		var project = MAIN.projects.findItem('id', $.id);
		if (project == null) {
			$.invalid('error-project');
			return;
		}

		if (!project.isexternal) {
			$.invalid('error-external');
			return;
		}

		var user = $.user;

		if (!user.sa && project.users.indexOf(user.id) === -1) {
			$.invalid('error-permissions');
			return;
		}

		var branch = $.model.name;

		if (project.branch === branch) {
			$.invalid('error-branches-current');
			return;
		}

		var filename = Path.join(CONF.backup, project.id + '_' + branch) + '.tar';

		MAIN.log($.user, 'branches_remove', project, branch || 'master');

		Fs.lstat(filename, function(err) {
			if (err)
				$.invalid(err);
			else
				PATH.unlink([filename], $.done());
		});

	});

});