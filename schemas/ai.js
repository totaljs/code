NEWSCHEMA('AI', function(schema) {

	schema.define('type', ['backend', 'frontend', 'flow', 'cms', 'uibuilder', 'dashboard', 'iot', 'tables']);
	schema.define('prompt', 'String');
	schema.define('selection', 'String');
	schema.define('path', 'String');
	schema.define('action', ['code', 'review', 'explain', 'grammar', 'summarize', 'keywords', 'text', 'image'], true);

	schema.addWorkflow('exec', function($) {
		let model = $.model;

		if (CONF.totalapi)
			API('TAPI', 'code', model).callback($);
		else
			$.invalid("@(You don't have specified a Total.js API token)");

	});

});