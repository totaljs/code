NEWSCHEMA('Componentator', function(schema) {

	schema.setQuery(function($) {
		RESTBuilder.make(function(builder) {
			builder.url('https://raw.githubusercontent.com/totaljs/components/master/components.json');
			builder.exec($.callback);
		});
	});

	schema.addWorkflow('download', function($) {
		RESTBuilder.make(function(builder) {
			var filename = $.query.ext === 'html' ? 'example.html' : ('component.' + $.query.ext);
			builder.url('https://raw.githubusercontent.com/totaljs/components/master/{0}/{1}'.format($.query.name, filename));
			builder.exec(function(err, response, output) {

				var content = output.response;

				if ($.query.ext === 'css' && $.query.darkmode !== 'true') {

					var lines = content.split('\n');
					var builder = [];

					for (var i = 0; i < lines.length; i++) {
						var line = lines[i];
						if (line.indexOf('.ui-dark') === -1) {
							if (!line && !builder[builder.length - 1])
								continue;
							builder.push(line);
						}
					}

					content = builder.join('\n').trim();
				}

				if ($.query.minify === 'true') {
					switch ($.query.ext) {
						case 'html':
							content = U.minify_html(content);
							break;
						case 'css':
							content = U.minify_css(content);
							break;
						case 'js':
							content = U.minify_js(content);
							break;
					}
				}

				$.callback(output.status === 404 ? '' : content);
			});
		});
	});

});