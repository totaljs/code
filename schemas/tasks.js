NEWSCHEMA('Tasks', function(schema) {

	schema.define('path', 'String');
	schema.define('body', 'String', true);

	schema.setInsert(function($) {

		var model = $.model;

		model.created = NOW;
		model.projectid = $.id;
		model.userid = $.user.id;

		NOSQL('tasks').insert(model);

		MAIN.log($.user, 'tasks_save', $.id, model.path);
		EMIT('tasks.save', $.id, model.path);

		$.success();
	});

});