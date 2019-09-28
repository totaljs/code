NEWSCHEMA('Snippets', function(schema) {

	schema.define('id', 'UID');
	schema.define('name', 'String(50)', true);
	schema.define('body', String, true);
	schema.define('group', 'String(50)');

	schema.setGet(function($) {
		TABLE('snippets').one().where('id', $.id).callback(function(err, response) {
			if ($.query.parse)
				response = FUNC.parsesnippet(response.body);
			$.callback(response);
		});
	});

	schema.setSave(function($) {

		if (!$.user.sa) {
			$.invalid('error-permissions');
			return;
		}

		var model = $.clean();
		if (model.id) {
			model.id = undefined;
			TABLE('snippets').modify(model).where('id', $.model.id).callback($.done());
		} else {
			model.id = UID();
			model.created = NOW;
			TABLE('snippets').insert(model).callback($.done());
		}
	});

	schema.setQuery(function($) {
		TABLE('snippets').find().fields('id', 'name', 'group', 'created').callback($.callback);
	});

});

FUNC.parsesnippet = function(html) {

	var beg = -1;
	var end = -1;
	var body_script = '';
	var body_style = '';
	var body_html = '';
	var raw = html;

	while (true) {

		beg = html.indexOf('<script', end);
		if (beg === -1)
			break;

		end = html.indexOf('</script>', beg);
		if (end === -1)
			break;

		var body = html.substring(beg, end);
		var beg = body.indexOf('>') + 1;
		var type = body.substring(0, beg);

		if (type.indexOf('html') !== -1 || type.indexOf('plain') !== -1) {
			end += 9;
			continue;
		}

		body = body.substring(beg);
		raw = raw.replace(type + body + '</script>', '');

		body = body.trim();

		if (type.indexOf('total') !== -1 || type.indexOf('totaljs') !== -1)
			body_total = body;
		else
			body_script = body;

		end += 9;
	}

	beg = raw.indexOf('<style');
	if (beg !== -1) {
		end = raw.indexOf('</style>');
		var tmp = raw.substring(raw.indexOf('>', beg) + 1, end);
		raw = raw.replace(raw.substring(beg, end + 8), '');
		body_style = tmp.trim();
	}

	if (!body_html) {
		raw = raw.trim();
		raw && (body_html = raw);
	}

	var obj = {};
	obj.js = body_script;
	obj.css = body_style;
	obj.html = body_html;
	// obj.jstotal = body_total;
	return obj;
};