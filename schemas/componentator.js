NEWSCHEMA('Componenator', function(schema) {

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
				$.callback(output.response);
			});
		});
	});

});