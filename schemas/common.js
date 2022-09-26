const Path = require('path');
const Exec = require('child_process').exec;
const Dns = require('dns');

NEWSCHEMA('Hosts', function(schema) {

	schema.define('host', 'String(50)', true);

	schema.addWorkflow('ping', function($) {
		var host = $.model.host.replace(/\"|\n/g, '');
		Exec('ping -c 3 "{0}"'.format(host), $.done(true));
	});

	schema.addWorkflow('resolve', function($) {
		Dns.resolve4($.model.host, function(e, addresses) {
			if (e)
				$.invalid(e);
			else
				$.success(addresses[0]);
		});
	});

});

NEWSCHEMA('Download', function(schema) {

	schema.addWorkflow('download', function($) {

		var opt = {};
		opt.method = 'GET';
		opt.url = $.query.url;

		if (!opt.url) {
			$.invalid('@(Invalid URL address)');
			return;
		}

		opt.callback = function(err, response) {
			if (err)
				$.invalid(err);
			else
				$.success(response.body);
		};

		REQUEST(opt);
	});

});

NEWSCHEMA('Minify', function(schema) {

	schema.define('body', String, true);
	schema.define('type', ['js', 'css', 'html'], true);

	schema.addWorkflow('exec', function($) {
		var model = $.model;
		switch (model.type) {
			case 'js':
				model.body = U.minify_js(model.body);
				break;
			case 'css':
				model.body = U.minify_css(model.body);
				break;
			case 'html':
				model.body = U.minify_html(model.body);
				break;
		}

		$.controller.plain(model.body);
		$.cancel();
	});

});

NEWSCHEMA('Encoder', function(schema) {

	schema.define('type', ['crc32', 'crc32unsigned', 'md5', 'sha1', 'sha256', 'sha512', 'hexe', 'hexd'], true);
	schema.define('body', '[String]', true);

	schema.addWorkflow('exec', function($) {
		var model = $.model;
		var is16 = !!$.query.is16;
		for (var i = 0; i < model.body.length; i++) {
			if (model.type === 'hexe')
				model.body[i] = U.createBuffer(model.body[i]).toString('hex');
			else if (model.type === 'hexd')
				model.body[i] = U.createBuffer(model.body[i], 'hex').toString('utf8');
			else {
				var d = model.body[i].hash(model.type);
				model.body[i] = is16 ? d.toString(16) : d.toString();
			}
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
		if (!project) {
			$.invalid('error-project');
			return;
		}

		if (project.isexternal) {
			$.invalid('error-external');
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

		var p = Path.join('/bundles', model.name);
		MAIN.changelog($.user, $.id, p);
		MAIN.change('upload', $.user, project, p);

		if (project.isexternal)
			FUNC.external_upload(project, Path.join('/bundles', model.name), model.url, $.done());
		else
			DOWNLOAD(model.url, Path.join(project.path, 'bundles', model.name), $.done());
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

		var p = Path.join('/packages', model.name);
		MAIN.changelog($.user, $.id, p);
		MAIN.change('upload', $.user, project, p);

		if (project.isexternal)
			FUNC.external_upload(project, Path.join('/packages', model.name), model.url, $.done());
		else
			DOWNLOAD(model.url, Path.join(project.path, 'packages', model.name), $.done());
	});
});

NEWSCHEMA('ExternalModule', function(schema) {

	schema.define('url', 'String', true);
	schema.define('name', 'String', true);

	schema.setQuery(function($) {
		RESTBuilder.GET(CONF.cdn_modules || 'https://cdn.totaljs.com/code/modules.json').exec($.callback);
	});

	schema.setSave(function($) {

		var project = MAIN.projects.findItem('id', $.id);
		if (project == null) {
			$.invalid('error-project');
			return;
		}

		var model = $.model;
		MAIN.log($.user, 'download_module', project, model.url);

		var p = Path.join('/modules', model.name);
		MAIN.changelog($.user, $.id, p);
		MAIN.change('upload', $.user, project, p);

		if (project.isexternal)
			FUNC.external_upload(project, Path.join('/modules', model.name), model.url, $.done());
		else
			DOWNLOAD(model.url, Path.join(project.path, 'modules', model.name), $.done());
	});
});

NEWSCHEMA('ExternalSchema', function(schema) {

	schema.define('url', 'String', true);
	schema.define('name', 'String', true);

	schema.setQuery(function($) {
		RESTBuilder.GET(CONF.cdn_schemas || 'https://cdn.totaljs.com/code/schemas.json').exec($.callback);
	});

	schema.setSave(function($) {

		var project = MAIN.projects.findItem('id', $.id);
		if (project == null) {
			$.invalid('error-project');
			return;
		}

		var model = $.model;
		MAIN.log($.user, 'download_schema', project, model.url);

		var p = Path.join('/schemas', model.name);
		MAIN.changelog($.user, $.id, p);
		MAIN.change('upload', $.user, project, p);

		if (project.isexternal)
			FUNC.external_upload(project, Path.join('/schemas', model.name), model.url, $.done());
		else
			DOWNLOAD(model.url, Path.join(project.path, 'schemas', model.name), $.done());
	});
});

NEWSCHEMA('ExternalDefinition', function(schema) {

	schema.define('url', 'String', true);
	schema.define('name', 'String', true);

	schema.setQuery(function($) {
		RESTBuilder.GET(CONF.cdn_schemas || 'https://cdn.totaljs.com/code/definitions.json').exec($.callback);
	});

	schema.setSave(function($) {

		var project = MAIN.projects.findItem('id', $.id);
		if (project == null) {
			$.invalid('error-project');
			return;
		}

		var model = $.model;
		MAIN.log($.user, 'download_definition', project, model.url);

		var p = Path.join('/definitions', model.name);
		MAIN.changelog($.user, $.id, p);
		MAIN.change('upload', $.user, project, p);

		if (project.isexternal)
			FUNC.external_upload(project, Path.join('/definitions', model.name), model.url, $.done());
		else
			DOWNLOAD(model.url, Path.join(project.path, 'definitions', model.name), $.done());
	});
});

NEWSCHEMA('ExternalOperation', function(schema) {

	schema.define('url', 'String', true);
	schema.define('name', 'String', true);

	schema.setQuery(function($) {
		RESTBuilder.GET(CONF.cdn_schemas || 'https://cdn.totaljs.com/code/operations.json').exec($.callback);
	});

	schema.setSave(function($) {

		var project = MAIN.projects.findItem('id', $.id);
		if (project == null) {
			$.invalid('error-project');
			return;
		}

		var model = $.model;
		MAIN.log($.user, 'download_operation', project, model.url);

		var p = Path.join('/operations', model.name);
		MAIN.changelog($.user, $.id, p);
		MAIN.change('upload', $.user, project, p);

		if (project.isexternal)
			FUNC.external_upload(project, Path.join('/operations', model.name), model.url, $.done());
		else
			DOWNLOAD(model.url, Path.join(project.path, 'operations', model.name), $.done());
	});
});
