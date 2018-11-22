const Path = require('path');
const Exec = require('child_process').exec;

NEWSCHEMA('Git', function(schema) {

	schema.define('path', 'String(500)', true);
	schema.define('body', 'String(100)', true);

	schema.setSave(function($) {

		var project = MAIN.projects.findItem('id', $.id);
		if (project == null) {
			$.invalid('error-project');
			return;
		}

		var model = $.model;
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

		var filename = Path.join(project.path, model.path);
		var name = U.getName(filename);

		MAIN.log($.user, 'files_commit', project, filename, model.body);

		// @TODO: missing git integration
		// Performs commit

		$.success();
	});

});