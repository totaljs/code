NEWSCHEMA('Minify', function(schema) {
	schema.define('body', 'String', true);
	schema.define('type', ['js', 'css', 'html'], true);

	schema.addWorkflow('exec', function($) {
		var model = $.model;
		switch (model.type) {
			case 'js':
				model.body = U.minifyScript(model.body);
				break;
			case 'css':
				model.body = U.minifyStyle(model.body);
				break;
			case 'html':
				model.body = U.minifyHTML(model.body);
				break;
		}
		$.callback(model.body);
	});

});