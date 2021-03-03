const Fs = require('fs');

NEWSCHEMA('Wiki', function(schema) {

	schema.define('body', 'String');

	schema.setSave(function($, model) {
		var item = MAIN.projects.findItem('id', $.id);
		if (item)
			Fs.writeFile(PATH.databases('wiki_' + $.id + '.md'), model.body, $.done($.id));
		else
			$.invalid('error-project');
	});

	schema.setRead(function($) {
		$.controller.file('~' + PATH.databases('wiki_' + $.id + '.md'));
		$.cancel();
	});

});