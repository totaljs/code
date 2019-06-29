NEWSCHEMA('Minify', function(schema) {
	schema.define('body', String, true);
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

NEWSCHEMA('Encoder', function(schema) {

	schema.define('type', ['crc32', 'crc32unsigned', 'md5', 'sha1', 'sha256', 'sha512', 'hexe', 'hexd'], true);
	schema.define('body', '[String]', true);

	schema.addWorkflow('exec', function($) {
		var model = $.model;
		for (var i = 0; i < model.body.length; i++) {
			if (model.type === 'hexe')
				model.body[i] = U.createBuffer(model.body[i]).toString('hex');
			else if (model.type === 'hexd')
				model.body[i] = U.createBuffer(model.body[i], 'hex').toString('utf8');
			else
				model.body[i] = model.body[i].hash(model.type).toString();
		}
		$.callback(model.body);
	});

});