const Fs = require('fs');

NEWSCHEMA('Clipboard', function(schema) {

	schema.define('body', String);

	schema.setGet(function($) {
		Fs.readFile(PATH.databases($.user.id + '.txt'), function(err, buffer) {
			$.callback(buffer ? buffer.toString('utf8') : '');
		});
	});

	schema.setSave(function($) {
		Fs.writeFile(PATH.databases($.user.id + '.txt'), $.model.body, NOOP);
		$.success();
	});

});