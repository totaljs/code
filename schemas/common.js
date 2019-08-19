const Path = require('path');
const Exec = require('child_process').exec;

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

NEWSCHEMA('ExternalTemplate', function(schema) {

	schema.define('git', 'String', true);

	schema.setQuery(function($) {
		RESTBuilder.GET(CONF.cdn_templates || 'https://cdn.totaljs.com/code/templates.json').exec($.callback);
	});

	schema.setSave(function($) {

		var project = MAIN.projects.findItem('id', $.id);
		if (project == null) {
			$.invalid('error-project');
			return;
		}

		// clone repository
		// move repository
		// clean repository

		MAIN.log($.user, 'download_template', project, $.model.git);
		Exec('bash ' + PATH.root('clone.sh') + ' "{0}" "{1}"'.format($.model.git, project.path), $.done());
	});
});

NEWSCHEMA('ExternalBundle', function(schema) {

	schema.define('url', 'String', true);
	schema.define('name', 'String', true);

	schema.setQuery(function($) {
		RESTBuilder.GET(CONF.cdn_bundles || 'https://cdn.totaljs.com/code/bundles.json').exec($.callback);
	});

	schema.setSave(function($) {

		var project = MAIN.projects.findItem('id', $.id);
		if (project == null) {
			$.invalid('error-project');
			return;
		}

		var model = $.model;
		MAIN.log($.user, 'download_bundle', project, model.url);
		F.download(model.url, Path.join(project.path, 'bundles', model.name), $.done());
	});
});

NEWSCHEMA('ExternalPackage', function(schema) {

	schema.define('url', 'String', true);
	schema.define('name', 'String', true);

	schema.setQuery(function($) {
		RESTBuilder.GET(CONF.cdn_packages || 'https://cdn.totaljs.com/code/packages.json').exec($.callback);
	});

	schema.setSave(function($) {

		var project = MAIN.projects.findItem('id', $.id);
		if (project == null) {
			$.invalid('error-project');
			return;
		}

		var model = $.model;
		MAIN.log($.user, 'download_package', project, model.url);
		F.download(model.url, Path.join(project.path, 'packages', model.name), $.done());
	});
});