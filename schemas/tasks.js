const RES_TASKS = {};

NEWSCHEMA('Tasks', function(schema) {

	schema.define('path', 'String');
	schema.define('body', 'String', true);

	schema.setQuery(function($) {
		NOSQL($.id + '_tasks').find().where('type', 'task').where('path', $.query.path).sort('created', true).callback(function(err, response) {
			TABLE('changelog').one().fields('user', 'updated').where('projectid', $.id).where('path', $.query.path).callback(function(err, modified) {
				RES_TASKS.tasks = response;
				RES_TASKS.modified = modified;
				if (modified) {
					var tmp = MAIN.users.findItem('id', modified.user);
					modified.user = tmp ? tmp.name : modified.user;
				}
				$.callback(RES_TASKS);
			});
		});
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

		NOSQL($.id + '_tasks').insert(model).callback(function() {
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

		NOSQL($.id + '_tasks').modify({ '!solved': 1 }).make(function(builder) {

			builder.where('id', $.params.taskid);

			// Notifies clients
			MAIN.send({ TYPE: op, projectid: $.id, taskid: $.params.taskid });
			MAIN.log($.user, op, $.id, $.params.taskid);
		});

		$.success();
	});

	schema.addWorkflow('uncomplete', function($) {

		var project = MAIN.projects.findItem('id', $.id);
		if (project == null) {
			$.invalid('error-project');
			return;
		}

		NOSQL($.id + '_tasks').scalar('group', 'path').make(function(builder) {
			builder.where('type', 'task');
			builder.where('solved', false);
			builder.callback(function(err, response) {
				$.callback(response || EMPTYARRAY);
			});
		});

	});

});