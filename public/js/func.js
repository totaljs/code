FUNC.cleancss = function(text) {
	return text.replace(/\n\n/g, '\0').replace(/\n|\t/g, '').replace(/:(\w|'|")/g, function(text) {
		return ': ' + text.substring(1);
	}).replace(/\}/g, '}\n').replace(/\s{2,}/g, ' ').replace(/(\w|'|"|;)\}/g, function(text) {
		var l = text.substring(text.length - 2, text.length - 1);
		return text.substring(0, text.length - 1) + (l !== ';' ? ';' : '') + ' ' + text.substring(text.length - 1);
	}).replace(/;(\w)/g, '; $1').replace(/"/g, '\'').replace(/(\w)\{/g, '$1 {').replace(/\{\w/g, function(text) {
		return text.substring(0, 1) + ' ' + text.substring(1);
	}).replace(/(\n)?.*?\{/g, function(text) {
		return text.replace(/:\s(\w)/g, ':$1');
	}).replace(/\0/g, '\n').trim();
};

FUNC.usercolor = function(value) {

	var index = value.indexOf('.');
	var arr = value.substring(index + 1).replace(/\s{2,}/g, ' ').trim().split(' ');
	var initials = (arr[0].substring(0, 1) + (arr[1] || '').substring(0, 1));
	var sum = 0;

	for (var i = 0; i < value.length; i++)
		sum += value.charCodeAt(i);

	return { color: TTIC[sum % value.length], name: value, initials: initials };
};

FUNC.getName = function(path) {
	var index = path.lastIndexOf('/');
	return path.substring(index + 1);
};

FUNC.getPath = function(path) {
	var index = path.lastIndexOf('/');
	return path.substring(0, index + 1);
};

FUNC.mkdir = function(p) {

	var Fs = require('fs');

	var existsSync = function(filename, file) {
		try {
			var val = Fs.statSync(filename);
			return val ? (file ? val.isFile() : true) : false;
		} catch (e) {
			return false;
		}
	};

	var is = require('os').platform().substring(0, 3).toLowerCase() === 'win';
	var s = '';

	if (p[0] === '/') {
		s = is ? '\\' : '/';
		p = p.substring(1);
	}

	var l = p.length - 1;
	var beg = 0;

	if (is) {
		if (p[l] === '\\')
			p = p.substring(0, l);

		if (p[1] === ':')
			beg = 1;

	} else {
		if (p[l] === '/')
			p = p.substring(0, l);
	}

	if (existsSync(p))
		return;

	var arr = is ? p.replace(/\//g, '\\').split('\\') : p.split('/');
	var directory = s;

	for (var i = 0, length = arr.length; i < length; i++) {
		var name = arr[i];
		if (is)
			directory += (i && directory ? '\\' : '') + name;
		else
			directory += (i && directory ? '/' : '') + name;

		if (i >= beg && !existsSync(directory))
			Fs.mkdirSync(directory);
	}
};

FUNC.path = function(val) {
	return val.substring(val.length - 1) === '/' ? val : (val + '/');
};

FUNC.treeappend = function(tree, path, is) {

	var filename;

	if (is) {
		var index = path.lastIndexOf('/');
		filename = path.substring(index + 1);
		path = path.substring(0, index);
	}

	var arr = path.substring(1).split('/');

	if (!arr[0])
		arr[0] = '#';

	var item = tree.findItem('name', arr[0]);

	if (item == null) {
		item = { name: arr[0], children: [], path: '/' + FUNC.path(arr[0]) };
		tree.push(item);
	}

	var tmp = item;
	var apath = (arr[0] ? '/' : '') + arr[0];

	for (var i = 1, length = arr.length; i < length; i++) {
		var name = arr[i];
		if (!name)
			continue;

		apath += '/' + name;

		tmp = item.children.findItem('name', name);
		if (tmp == null) {
			tmp = { name: name, children: [], path: FUNC.path(apath) };
			item.children.push(tmp);
		}
		item = tmp;
	}

	is && tmp.children.push({ name: filename, path: path + '/' + filename, children: null });
};

FUNC.treeremove = function(tree, path) {
	tree = tree.remove('path', path);
	for (var i = 0; i < tree.length; i++) {
		var item = tree[i];
		if (item.children)
			item.children = FUNC.treeremove(item.children, path);
	}
	return tree;
};

FUNC.treeindex = function(tree, path) {
	var item = tree.findItem('path', path);
	if (item)
		return item.$pointer;
	for (var i = 0; i < tree.length; i++) {
		var item = tree[i];
		if (item.children) {
			var index = FUNC.treeindex(item.children, path);
			if (index != null)
				return index;
		}
	}
};

FUNC.rtrim = function(value) {
	var lines = value.split('\n');
	var reg = /\s+$/;
	for (var i = 0; i < lines.length; i++)
		lines[i] = lines[i].replace(reg, '');
	return lines.join('\n');
};

FUNC.wsopen = function(project, path, openid) {
	SETTER('websocket', 'send', { TYPE: 'edit', projectid: project, fileid: path, openid: openid });
};

FUNC.wssend = function(msg) {
	SETTER('websocket', 'send', msg);
};

FUNC.success = function(msg) {
	SETTER('snackbar', 'success', msg);
};

FUNC.warning = function(msg) {
	SETTER('snackbar', 'warning', msg instanceof Array ? msg[0].error : msg);
};

FUNC.info = function(msg) {
	SETTER('snackbar', 'show', msg);
};

FUNC.editor_reload = function() {

	if (!window.code || !window.code.current)
		return;

	var tab = code.open.findItem('path', code.current.path);
	if (tab) {
		tab.loaded = false;
		tab.doc = null;
		EXEC('code/open', tab);
	}
};

FUNC.spaces_to_tabs = function(value) {
	var lines = value.split('\n');
	for (var i = 0; i < lines.length; i++) {
		lines[i] = lines[i].replace(/^\s{1,}/, function(text) {

			var count = 0;
			var str = '';
			for (var j = 0; j < text.length; j++) {
				if (text.charCodeAt(j) === 32)
					count++;
				else
					str += text.charAt(j);
			}

			return count === 0 ? text : (''.padLeft(count / 4 >> 0, '\t') + str);
		});
	}
	return lines.join('\n');
};

FUNC.guid = function() {
	function s4() {
		return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
	}
	return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
};

FUNC.getext = function(syntax) {
	switch (syntax) {
		case 'totaljs':
		case 'text/html':
		case 'html':
			return 'html';
		case 'application/x-httpd-php':
			return 'php';
		case 'javascript':
			return 'js';
		case 'text/css':
			return 'css';
		case 'text/x-csrc':
		case 'text/x-c++src':
			return 'cpp';
		case 'text/x-sql':
			return 'sql';
		case 'application/ld+json':
			return 'json';
		case 'text/x-cython':
			return 'python';
		case 'text/x-sh':
			return 'bash';
		case 'text/x-sass':
			return 'sass';
		case 'text/x-yaml':
			return 'yaml';
		case 'application/xml':
			return 'xml';
	}
	return 'plain';
};

FUNC.comment = function(ext, sel) {
	for (var j = 0; j < sel.length; j++) {

		var line = sel[j].trimRight();
		if (!line)
			continue;

		var index = line.lastIndexOf('\t');
		switch (ext) {
			case 'js':
				if (line.indexOf('//') === -1) {
					if (index !== -1)
						index++;
					line = line.substring(0, index) + '// ' + line.substring(index);
				} else
					line = line.replace(/\/\/(\s)/g, '');
				break;

			case 'html':
				if (line.indexOf('<!--') === -1) {
					if (index !== -1)
						index++;
					line = line.substring(0, index) + '<!-- ' + line.substring(index) + ' -->';
				} else
					line = line.replace(/<!--(\s)|(\s)-->/g, '');
				break;
			case 'css':
				if (line.indexOf('/*') === -1) {
					if (index !== -1)
						index++;
					line = line.substring(0, index) + '/* ' + line.substring(index) + ' */';
				} else
					line = line.replace(/\/\*(\s)|(\s)\*\//g, '');
				break;
		}
		sel[j] = line;
	}
	return sel;
};

FUNC.alignsitemap = function(sel) {

	var data = [];
	var max1 = 0;
	var max2 = 0;
	var max3 = 0;
	var max4 = 0;

	for (var j = 0; j < sel.length; j++) {
		var line = sel[j];
		var index = line.indexOf(':');
		if (index === -1 || line.charAt(0) === '/') {
			data.push(line);
			continue;
		}

		var obj = {};
		obj.key = line.substring(0, index).trim();
		var arr = line.substring(index + 1).split('-->');
		obj.title = (arr[0] || '').trim();
		obj.url = (arr[1] || '').trim();
		obj.parent = (arr[2] || '').trim();

		max1 = Math.max(max1, obj.key.length);
		max2 = Math.max(max2, obj.title.length);
		max3 = Math.max(max3, obj.url.length);

		data.push(obj);
	}

	var padding = 10;

	for (var j = 0; j < sel.length; j++) {
		var obj = data[j];
		if (typeof(obj) === 'string')
			sel[j] = obj;
		else
			sel[j] = obj.key.padRight(max1 + padding, ' ') + ': ' + obj.title.padRight(max2 + padding, ' ') + ' --> ' + obj.url.padRight(max3 + padding, ' ') + (obj.parent ? (' --> ' + obj.parent) : '');
	}

	return sel;
};

FUNC.aligntext = function(sel) {

	var align = { ':': 1, '|': 1, '=': 1, '\'': 1, '"': 1, '{': 1 };
	var max = 0;
	var line, c, p;

	for (var j = 0; j < sel.length; j++) {
		var line = sel[j];
		for (var i = 1; i < line.length; i++) {
			c = line.charAt(i);
			p = line.charAt(i - 1);
			if (align[c] && (p === '\t' || p === ' ')) {
				var count = line.substring(0, i - 1).trim().length + 1;
				max = Math.max(count, max);
				break;
			}
		}
	}

	for (var j = 0; j < sel.length; j++) {
		var line = sel[j];
		for (var i = 1; i < line.length; i++) {
			c = line.charAt(i);
			p = line.charAt(i - 1);
			if (align[c] && (p === '\t' || p === ' ')) {
				var current = sel[j].substring(0, i - 1).trim();
				var plus = ''.padLeft(max - current.length, p);
				sel[j] = current + sel[j].substring(i - 1, i) + plus + sel[j].substring(i);
			}
		}
	}

	return sel;
};

FUNC.requestscript = function(id, path) {
	SETTER('loading', 'show');
	AJAX('GET /api/request/{0}/?path={1}'.format(id, encodeURIComponent(path)), function(response, err) {

		SETTER('loading', 'hide', 100);

		if (err) {
			SETTER('message', 'warning', err.toString());
			return;
		}

		if (response instanceof Array) {
			SETTER('message', 'warning', response[0].error);
			return;
		}

		var template = '<div class="output-response-header">{0}:</div><div class="output-response-header-value">{1}</div>';
		PUSH('^output', '<div class="output-response"><div class="output-response-caption" title="{0}">{0}</div>{1}</div>'.format(Thelpers.encode(response.url), template.format('Response (' + (response.duration / 1000) + ' s)', Thelpers.encode(response.response).replace(/\n/g, '<br />'))));
		SET('common.form', 'output');
	});
};

FUNC.request = function(text, body) {

	// Find variables
	var REG_VARIABLE = /^\$(\$)?[a-z0-9_\-.#]+/i;
	var variables = {};

	body = body.split('\n');
	for (var i = 0; i < body.length; i++) {
		var line = body[i];
		if (!REG_VARIABLE.test(line))
			continue;
		var index = line.indexOf(':');
		var key = line.substring(0, index).trim();
		var val = line.substring(index + 1).trim();
		variables[key] = val;
		variables['$' + key] = encodeURIComponent(val);
	}

	text = text.replace(/\$(\$)?[a-z0-9_\-.#]+/ig, function(text) {
		return variables[text] == null ? text : variables[text];
	});

	SETTER('loading', 'show');
	AJAX('POST /api/request/', { body: text }, function(response, err) {

		SETTER('loading', 'hide', 100);

		if (err) {
			SETTER('message', 'warning', err.toString());
			return;
		}

		if (response instanceof Array) {
			SETTER('message', 'warning', response[0].error);
			return;
		}

		var builder = [];
		var keys = Object.keys(response.headers);
		var skip = { server: 1, date: 1, 'transfer-encoding': 1, connection: 1, vary: 1, expires: 1, 'cache-control': 1 };
		var template = '<div class="output-response-header">{0}:</div><div class="output-response-header-value">{1}</div>';

		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			if (skip[key])
				continue;
			var val = response.headers[key];

			key = key.charAt(0).toUpperCase() + key.substring(1);

			var index = key.indexOf('-');
			if (index !== -1)
				key = key.substring(0, index + 1) + key.substring(index + 1, index + 2).toUpperCase() + key.substring(index + 2);

			if (val instanceof Array) {
				for (var j = 0; j < val.length; j++)
					builder.push(template.format(key, Thelpers.encode(val[j])));
			} else
				builder.push(template.format(key, Thelpers.encode(val)));
		}

		builder.push(template.format('Response (' + (response.duration / 1000) + ' s)', Thelpers.encode(response.response).replace(/\n/g, '<br />')));

		PUSH('^output', '<div class="output-response"><div class="output-response-caption" title="{0}">{0}</div>{1}</div>'.format(Thelpers.encode(response.url), builder.join('')));
		SET('common.form', 'output');
	});
};