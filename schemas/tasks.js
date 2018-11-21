NEWSCHEMA('Tasks', function(schema) {

	schema.define('path', 'String');
	schema.define('body', 'String', true);

	schema.setQuery(function($) {
		NOSQL($.id).find().where('type', 'task').where('path', $.query.path).sort('created', true).callback($.callback);
	});

	schema.setInsert(function($) {

		var project = MAIN.projects.findItem('id', $.id);
		if (project == null) {
			$.invalid('error-project');
			return;
		}

		var model = $.model;
		var op = 'tasks_save';

		model.id = UID();
		model.created = NOW;
		model.ip = $.ip;
		model.type = 'task';
		model.userid = $.user.id;
		model.solved = false;

		NOSQL($.id).insert(model).callback(function() {
			$.success();
			MAIN.send({ TYPE: op, projectid: $.id, taskid: $.params.taskid });
			MAIN.log($.user, op, $.id, model.path);
			EMIT(op, $.id, model.path);
		});

	});

	schema.addWorkflow('solved', function($) {

		var project = MAIN.projects.findItem('id', $.id);
		if (project == null) {
			$.invalid('error-project');
			return;
		}

		var op = 'tasks_solve';

		NOSQL($.id).modify({ '!solved': 1 }).make(function(builder) {

			builder.where('id', $.params.taskid);

			// Notifies clients
			MAIN.send({ TYPE: op, projectid: $.id, taskid: $.params.taskid });
			MAIN.log($.user, op, $.id, $.params.taskid);
		});

		$.success();
	});

});