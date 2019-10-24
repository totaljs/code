NEWSCHEMA('Hours', function(schema) {

	schema.define('value', Number);

	schema.setSave(function($) {

		var user = $.user;
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
		}

		if (!project.time)
			project.time = {};

		var value = $.model.value * 60 * 60;
		var time = project.time[user.id];
		var ym = NOW.format('yyyyMM');

		if (time == null)
			time = project.time[user.id] = {};

		if (time[ym])
			time[ym] += value;
		else
			time[ym] = value;

		if (time[ym] < 0)
			delete time[ym];

		setTimeout2('combo', MAIN.save, 2000, null, 2);
		$.success();
	});

});