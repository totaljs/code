const Fs = require('fs');
require('total4');

DEF.onError = function() {
	process.exit(1);
};

(function() {

	function analyze(body) {

		body = body.trim();

		var matches;
		var queries = [];
		var params = [];
		var filters = [];
		var isid = body.indexOf('$.id') !== -1;
		var autofill;
		var autoquery;
		var dbfields;
		var tmp;
		var arr;
		var issuccess = body.indexOf('$.success(') !== -1 || body.indexOf('$.done(') !== -1;

		matches = body.match(/query\.[a-z0-9_]+/gi);

		if (matches) {
			for (var i = 0; i < matches.length; i++) {
				tmp = matches[i].trim();
				var index = tmp.lastIndexOf('.');
				tmp = tmp.substring(index + 1);
				if (tmp && queries.indexOf(tmp) === -1)
					queries.push(tmp);
			}
		}

		matches = body.match(/filter\.[a-z0-9_]+/gi);
		if (matches) {
			for (var i = 0; i < matches.length; i++) {
				tmp = matches[i].trim();
				var index = tmp.lastIndexOf('.');
				tmp = tmp.substring(index + 1);
				if (tmp && filters.indexOf(tmp) == -1)
					filters.push(tmp);
			}
		}

		matches = body.match(/params\.[a-z0-9_]+/gi);
		if (matches) {
			for (var i = 0; i < matches.length; i++) {
				tmp = matches[i].trim();
				var index = tmp.lastIndexOf('.');
				tmp = tmp.substring(index + 1);
				if (tmp && params.indexOf(tmp) == -1)
					params.push(tmp);
			}
		}

		var index = body.indexOf('.fields(');
		if (index !== -1) {

			tmp = body.substring(index + 9, body.indexOf(')', index)).split(/'|"/);

			dbfields = [];

			if (tmp[0])
				dbfields = tmp[0].split(',').trim();

			dbfields = dbfields.remove(function(item) {
				return item.charAt(0) === '-';
			});

			if (tmp[3])
				autofill.skip = tmp[3].split(',').trim();

			if (tmp[5] && tmp[5].length > 2)
				autofill.sort = tmp[5];
		}

		var index = body.indexOf('.autofill(');
		if (index !== -1) {
			tmp = body.substring(index + 9, body.indexOf(')', index)).split(/'|"/);

			autofill = {};

			if (tmp[1]) {
				arr = tmp[1].split(',').trim();
				autofill.fields = [];
				for (var i = 0; i < arr.length; i++) {
					var item = arr[i].split(':');
					autofill.fields.push({ name: item[0], type: item[1] });
				}
			}

			if (tmp[3])
				autofill.skip = tmp[3].split(',').trim();

			if (tmp[5] && tmp[5].length > 2)
				autofill.sort = tmp[5];
		}

		var index = body.indexOf('.autoquery(');
		if (index !== -1) {
			tmp = body.substring(index + 10, body.indexOf(')', index)).split(/'|"/);

			autoquery = {};

			if (tmp[1]) {
				arr = tmp[1].split(',').trim();
				autoquery.fields = [];
				for (var i = 0; i < arr.length; i++) {
					var item = arr[i].split(':');
					autoquery.fields.push({ name: item[0], type: item[1] || 'String' });
				}
			}

			if (tmp[2] && tmp[2].length > 2)
				autoquery.sort = tmp[2];
		}

		var fields = {};

		if (autofill) {
			for (var i = 0; i < autofill.fields.length; i++) {
				var item = autofill.fields[i];
				if (item.name && item.name.charAt(0) !== '-' && !fields[item.name])
					fields[item.name] = item;
			}
		}

		if (autoquery) {
			for (var i = 0; i < autoquery.fields.length; i++) {
				var item = autoquery.fields[i];
				if (item.name && item.name.charAt(0) !== '-' && !fields[item.name])
					fields[item.name] = item;
			}
		}

		if (autofill && autofill.skip) {
			for (var i = 0; i < autofill.skip.length; i++) {
				var item = autofill.skip[i];
				delete fields[item];
			}
		}

		if (autoquery && autoquery.skip) {
			for (var i = 0; i < autoquery.skip.length; i++) {
				var item = autoquery.skip[i];
				delete fields[item];
			}
		}

		var model = {};
		model.query = [];
		model.params = params;
		model.success = issuccess;

		for (var i = 0; i < queries.length; i++) {
			if (model.query.indexOf(queries[i]) === -1)
				model.query.push(queries[i]);
		}

		for (var i = 0; i < filters.length; i++) {
			if (model.query.indexOf(filters[i]) === -1)
				model.query.push(filters[i]);
		}

		if (dbfields) {
			for (var i = 0; i < dbfields.length; i++) {
				if (!fields[dbfields[i]])
					fields[dbfields[i]] = { name: dbfields[i], type: 'String' };
			}
		}

		var keys = Object.keys(fields);
		model.fields = [];
		for (var i = 0; i < keys.length; i++) {
			model.fields.push(fields[keys[i]]);
		}

		model.id = isid;
		model.autofill = !!autofill;

		return model;
	}

	function findname(line) {
		var index = line.indexOf('(');
		return line.substring(index + 1, line.indexOf(',', index)).replace(/"|'/g, '');
	}

	function findscope(beg, lines) {

		var output = [];
		var count = 0;

		beg++;

		for (var i = beg; i < lines.length; i++) {

			var line = lines[i];

			output.push(line);
			for (var j = 0; j < line.length; j++) {

				if (line.charAt(j) === '{') {
					count++;
					continue;
				}

				if (line.charAt(j) === '}') {
					count--;
					if (count === -1)
						return { body: output.join('\n'), end: i };
					continue;
				}
			}
		}

		return { body: output.join('\n'), end: i };
	}

	function parse(text) {

		var lines = text.split('\n');
		var builder = [];
		var schema = null;

		for (var i = 0; i < lines.length; i++) {
			var line = lines[i];

			if (line.indexOf('ROUTE(') !== -1) {

				if (line.indexOf('*') === -1)
					continue;

				var route = {};
				var arr = line.trim().substring(7, line.lastIndexOf(')') - 1).replace(/(\s|\t){2,}|['"]/g, ' ').split(' ').trim();

				route.TYPE = 'route';
				route.method = arr[0].replace(/-|\+/g, '').toUpperCase();
				route.auth = arr[0].indexOf('+') !== -1;
				route.url = arr[1].trim();
				route.schema = ((route.method === 'API' ? arr[3] : arr[2]) || '').replace(/\*/g, '');

				var index = arr.findIndex('-->');
				if (index === -1)
					index = arr.findIndex('->');

				if (index) {
					for (var j = index; j < arr.length; j++) {
						if (arr[j] && arr[j].charAt(0) === '(') {
							// response
							route.action = arr[j - 1];
						}
					}
					if (!route.action)
						route.action = arr.splice(index + 1).join(' ');
				}

				if (route.action)
					route.action = route.action.replace(/@/g, '');

				if (route.method === 'API') {
					tmp = arr[2].split('/');
					for (var j = 1; j < tmp.length; j++) {
						if (tmp[j])
							tmp[j] = '{' + tmp[j] + '}';
					}
					arr[2] = tmp.join('/');
					route.operation = (arr[2] || '').replace(/\[|\]|,|\./g, '');
					var c = route.operation.charAt(0);
					route.operationtype = c === '+' ? 'POST' : c === '#' ? 'PATCH' : 'GET';
				}

				builder.push(route);

				// route
				continue;
			}

			if (line.indexOf('NEWSCHEMA(') !== -1) {

				var m = line.match(/'.*?'/);
				if (m == null)
					continue;

				schema = {};
				schema.TYPE = 'schema';
				schema.name = m.toString().replace(/'/g, '');
				schema.prop = [];
				builder.push(schema);
				continue;
			}

			var index = line.indexOf('define(');
			if (index !== -1) {

				var prop = line.substring(index + 7).trim().replace(/'|"/g, '').split(',').trim();
				var obj = { name: prop[0], type: prop[1].replace(/;/g, '').replace(/\)\)/g, ')'), required: !!prop[2] };

				if (obj.type.lastIndexOf(')') !== -1 && obj.type.lastIndexOf('(') === -1)
					obj.type = obj.type.replace(/\)/g, '');

				obj.type = obj.type.replace(/\)\(.*?\)/g, '');

				if (obj.type.charAt(0) === '[' && obj.type.charAt(obj.type.length - 1) !== ']')
					obj.type += ']';

				schema.prop.push(obj);
				// schema field
				continue;
			}

			if (line.indexOf('setSave(') !== -1) {
				var tmp = findscope(i, lines);
				schema.save = analyze(tmp.body);
				i = tmp.end;
				continue;
			}

			if (line.indexOf('addWorkflow(') !== -1) {
				var name = findname(line);
				var tmp = findscope(i, lines);
				if (!schema.workflows)
					schema.workflows = {};
				schema.workflows[name] = analyze(tmp.body);
				i = tmp.end;
				continue;
			}

			if (line.indexOf('setQuery(') !== -1) {
				var tmp = findscope(i, lines);
				schema.query = analyze(tmp.body);
				i = tmp.end;
				continue;
			}

			if (line.indexOf('setRead(') !== -1) {
				var tmp = findscope(i, lines);
				schema.read = analyze(tmp.body);
				i = tmp.end;
				continue;
			}

			if (line.indexOf('setRemove(') !== -1) {
				var tmp = findscope(i, lines);
				schema.remove = analyze(tmp.body);
				i = tmp.end;
				continue;
			}

			if (line.indexOf('setUpdate(') !== -1) {
				var tmp = findscope(i, lines);
				schema.update = analyze(tmp.body);
				i = tmp.end;
				continue;
			}

			if (line.indexOf('setInsert(') !== -1) {
				var tmp = findscope(i, lines);
				schema.insert = analyze(tmp.body);
				i = tmp.end;
				continue;
			}

			if (line.indexOf('setPatch(') !== -1) {
				var tmp = findscope(i, lines);
				schema.patch = analyze(tmp.body);
				i = tmp.end;
				continue;
			}

		}

		return builder;
	}

	FUNC.makedocs = function(body) {

		var items = parse(body);
		var schemas = {};
		var md = [];
		var groups = {};

		for (var i = 0; i < items.length; i++) {
			var item = items[i];

			if (item.TYPE === 'schema') {
				schemas[item.name] = item;
				continue;
			}

			if (groups[item.schema])
				groups[item.schema].push(item);
			else
				groups[item.schema] = [item];
		}

		items.quicksort('url,method');

		var gk = Object.keys(groups);
		for (var a = 0; a < gk.length; a++) {

			var gkk = gk[a].replace(/,|\./g, '');
			if (!gkk)
				continue;

			var gi = groups[gkk];
			if (!gi || !gi.length)
				continue;

			var mdindexer = md.length;
			var is = false;

			for (var i = 0; i < gi.length; i++) {
				var item = gi[i];

				if (item.TYPE !== 'route')
					continue;

				var schema = schemas[item.schema];

				if (!schema)
					continue;

				var op = schema[item.action] || (schema.workflows ? schema.workflows[item.action] : null);
				if (!op)
					continue;

				md.push('::: __`' + item.method.padRight(7, ' ') + '`__ `' + item.url + (item.method === 'API' ? ('  ' + item.operation) : '') + '`' + (item.auth ? ' {authorized}(flag)' : ''));
				md.push('');

				var tmpindex = md.length;
				var action = CLONE(item);

				is = true;

				if (op.query && op.query.length)
					action.query = op.query;

				if (schema.prop && schema.prop.length)
					action.fields = schema.prop;

				action.action = undefined;
				action.TYPE = undefined;

				md.push('__Notes__:');
				md.push('- [Make a request](#api_{0})'.format(Buffer.from(encodeURIComponent(JSON.stringify(action, (k, v) => v ? v : undefined)), 'utf8').toString('base64')));

				if (item.auth)
					md.push('- request __must be authorized__');

				if ((item.method !== 'GET' && item.method !== 'API' && item.method !== 'DELETE') || (item.method === 'API' && item.operationtype !== 'GET')) {

					if (!item.operationtype || item.operationtype === 'POST')
						md.push('- request __must contain data__ in JSON format');
					else
						md.push('- request __can contain partialled data__ in JSON format');

					if (schema.prop && schema.prop.findItem('required', true))
						md.push('- __fields marked as bold__ are required');
				}

				md.push('');

				if (op.query && op.query.length) {
					md.push('__Query arguments__:');
					for (var j = 0; j < op.query.length; j++) {
						var tmp = op.query[j];
						md.push('- `{0}`'.format(tmp));
					}
					md.push('');
				}

				if (schema.prop && schema.prop.length) {
					if ((item.method !== 'GET' && item.method !== 'DELETE') && (!item.operation || item.operationtype !== 'GET')) {
						md.push('__Request data__:');

						for (var j = 0; j < schema.prop.length; j++) {
							var tmp = schema.prop[j];
							md.push('- {2}`{0}`{2} {{1}}(type)'.format(tmp.name, tmp.type || 'String', tmp.required ? '__' : ''));

							var subschema = schemas[tmp.type.replace(/\(|\[|\]|\)/g, '')];
							if (subschema) {
								for (var x = 0; x < subschema.prop.length; x++) {
									tmp = subschema.prop[x];
									md.push('	- `{0}` {{1}}(type)'.format(tmp.name, tmp.type || 'String'));
								}
							}

						}
						md.push('');
					}
				}

				if (op.success) {
					md.push('__Output__:');
					md.push('```js\n{\n\t"success": true,\n\t["value": Object]\n}\n```');
				} else {

					tmpindex = md.length;

					if (op.autofill) {
						for (var j = 0; j < schema.prop.length; j++) {
							var tmp = schema.prop[j];
							md.push('- `{0}` {{1}}(type)'.format(tmp.name, tmp.type || 'String'));
						}
					}

					if (op.fields && op.fields.length && !op.success) {
						for (var j = 0; j < op.fields.length; j++) {
							var tmp = op.fields[j];
							md.push('- `{0}` {{1}}(type)'.format(tmp.name, tmp.type || 'String'));
						}
					}

					if (md.last() !== '') {
						md.push('');
						md.splice(tmpindex, 0, '__Response__:');
					}
				}

				md.push(':::');
				md.push('');

			}

			if (is)
				md.splice(mdindexer, 0, '#### ' + gk[a] + '\n');

		}

		return md.join('\n');
	};

})();

var path = process.argv[2];

U.ls(path, function(files) {

	var builder = [];

	files.wait(function(item, next) {

		if (item.substring(item.length - 3) === '.js') {
			Fs.readFile(item, function(err, buffer) {
				if (buffer) {
					builder.push(buffer.toString('utf8'));
					builder.push('');
				}
				next();
			});
		} else
			next();

	}, function() {
		console.log(FUNC.makedocs(builder.join('\n')));
		process.exit(0);
	});

}, path => (/schemas|controllers/).test(path));

// setTimeout(process.exit, 1000, 0);