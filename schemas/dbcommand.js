const Database = require('pg');

NEWSCHEMA('DBCommand', function(schema) {

	schema.define('connection', 'String', true);
	schema.define('query', 'String', true);

	var makeclient = function($) {

		var model = $.model;
		var index = model.connection.indexOf('hex ');

		if (index !== -1)
			model.connection = Buffer.from(model.connection.substring(index + 4).trim(), 'hex').toString('utf8');
		else {
			index = model.connection.indexOf('base64 ');
			if (index !== -1)
				model.connection = Buffer.from(model.connection.substring(index + 7).trim(), 'base64').toString('utf8');
			else
				model.connection = model.connection.trim();
		}

		return new Database.Client(model.connection);
	};

	schema.addWorkflow('exec', function($) {

		if (!$.user.sa && !$.user.dbviewer) {
			$.invalid('error-permissions');
			return;
		}

		var model = $.model;
		var client = makeclient($);

		if (model.query[0] === '-')
			model.query = 'SELECT CASE WHEN table_schema=\'public\' THEN \'\' ELSE table_schema || \'.\' END || "table_name" as name, CASE WHEN table_type=\'BASE TABLE\' THEN \'TABLE\' ELSE table_type END as type FROM information_schema.tables WHERE table_schema NOT IN (\'pg_catalog\', \'information_schema\') UNION ALL SELECT "routine_name" as name, routine_type as type FROM information_schema.routines WHERE routines.specific_schema=\'public\' LIMIT 20';

		var callback = function(err, response) {
			client.end();
			if (err)
				$.invalid(err);
			else
				$.success(response.rows);
		};

		client.connect();

		var q = {};
		q.text = model.query;
		client.query(q, callback);
	});

});