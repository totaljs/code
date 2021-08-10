var TIDYUPWHITE = new RegExp(String.fromCharCode(160), 'g');

(function() {

	var TABSCOUNT = function(val) {
		var count = 0;
		for (var i = 0; i < val.length; i++) {
			if (val.charAt(i) === '\t')
				count++;
			else
				break;
		}
		return count;
	};

	var TABS = function(count) {
		var str = '';
		for (var i = 0; i < count; i++)
			str += '\t';
		return str;
	};

	FUNC.wrapbracket = function(cm, pos) {

		var line = cm.getLine(pos.line);

		if (!(/(function|switch|else|with|if|for|while)\s\(/).test(line) || (/\w/).test(line.substring(pos.ch)))
			return;

		var tabs = TABSCOUNT(line);
		var lines = cm.lineCount();
		var plus = '';
		var nl;

		if (line.indexOf('= function') !== -1)
			plus = ';';
		else if (line.indexOf(', function') !== -1 || line.indexOf('(function') !== -1)
			plus = ');';

		if (pos.line + 1 >= lines) {
			// end of value
			cm.replaceRange('\n' + TABS(tabs + 1) + '\n' + TABS(tabs) + '}' + plus, pos, null, '+input');
			pos.line++;
			pos.ch = tabs + 1;
			cm.setCursor(pos);
			return true;
		}

		if (plus) {
			var lchar = line.substring(line.length - 2);

			if (lchar !== ');') {
				lchar = line.charAt(line.length - 1);
				if (lchar !== ';' && lchar !== ')')
					lchar = '';
			}

			if (lchar) {
				pos.ch = line.length - lchar.length;
				var post = {};
				post.line = pos.line;
				post.ch = line.length;
				cm.replaceRange('', pos, post, '+move');
			}
		}

		for (var i = pos.line + 1; i < lines; i++) {

			var cl = cm.getLine(i);
			var tc = TABSCOUNT(cl);

			if (tc <= tabs) {
				var nl = cl && cl.indexOf('}') === -1 ? true : false;
				pos.line = i - 1;
				pos.ch = 10000;
				cm.replaceRange('\n' + TABS(tabs) + '}' + plus + (nl ? '\n' : ''), pos, null, '+input');
				pos.ch = tabs.length;
				cm.setCursor(pos);
				return true;
			}
		}
	};
})();


FUNC.createroutes = function(isapi, text) {

	var tmp = text.match(/NEWSCHEMA\(('|").*?,/);
	var name = tmp[0].substring(11, tmp[0].length - 2).replace(/'|"/g, '').trim();
	var linker = (name.indexOf('/') === -1 ? name : name.split('/')[1]).toLowerCase();

	var builder = [];

	if (text.indexOf('.setQuery') !== -1) {
		if (isapi)
			builder.push('+API  /api/  -' + linker + '_query  *' + name + ' --> query');
		else
			builder.push('+GET  /api/' + linker + '  *' + name + ' --> query');
	}

	if (text.indexOf('.setRead') !== -1) {
		if (isapi)
			builder.push('+API  /api/  -' + linker + '_read/{id}  *' + name + ' --> read');
		else
			builder.push('+GET  /api/' + linker + '/{id}/  *' + name + ' --> read');
	}

	if (text.indexOf('.setInsert') !== -1) {
		if (isapi)
			builder.push('+API  /api/  +' + linker + '_insert  *' + name + ' --> insert');
		else
			builder.push('+POST  /api/' + linker + '/  *' + name + ' --> insert');
	}

	if (text.indexOf('.setUpdate') !== -1) {
		if (isapi)
			builder.push('+API  /api/  +' + linker + '_update/{id}  *' + name + ' --> update');
		else
			builder.push('+POST  /api/' + linker + '/{id}/  *' + name + ' --> update');
	}

	if (text.indexOf('.setRemove') !== -1) {
		if (isapi)
			builder.push('+API  /api/  -' + linker + '_remove/{id}  *' + name + ' --> remove');
		else
			builder.push('+DELETE  /api/' + linker + '/{id}/  *' + name + ' --> remove');
	}

	var workflows = text.match(/\.addWorkflow\(.*?\)/g);
	if (workflows) {

		for (var i = 0; i < workflows.length; i++) {
			var wn = workflows[i].match(/('|")[a-z0-9_]+('|")+/i);
			if (wn) {
				wn = wn[0].replace(/'|"/g, '');
				if (isapi)
					builder.push('+API  /api/  -' + linker + '_' + wn + '  *' + name + ' --> ' + wn);
				else
					builder.push('+DELETE  /api/' + linker + '/' + wn + '/  *' + name + ' --> ' + wn);
			}
		}
	}

	for (var i = 0; i < builder.length; i++)
		builder[i] = 'ROUTE(\'' + builder[i] + '\');';

	return FUNC.alignrouting(builder.join('\n'));
};

FUNC.cleanpath = function(val) {
	return val.replace(/\/{2,}/g, '/');
};

FUNC.unlinkpath = function(path, callback) {

	var electronpath = require('electron').ipcRenderer.sendSync('getPath', { url: location.protocol + '//' + location.hostname + (location.port ? ':' + location.port : '') });
	if (!electronpath)
		return false;

	var Path = require('path');
	var Fs = require('fs');

	var async = function(arr, next, callback) {
		var item = arr.pop();
		if (item)
			next(item, () => async(arr, next, callback));
		else if (callback)
			callback();
	};

	var remove = function(path, callback) {
		Fs.stat(path, function(err, stat) {

			if (err) {
				callback && callback();
				return;
			}

			if (stat.isFile()) {
				Fs.unlink(path, () => callback && callback());
				return;
			}

			Fs.readdir(path, { withFileTypes: true }, function(err, items) {
				async(items, function(item, next) {
					var filename = Path.join(path, item.name);
					if (item.isDirectory())
						remove(filename, () => Fs.rmdir(filename, next));
					else
						Fs.unlink(filename, next);
				}, () => Fs.rmdir(path, () => callback && callback()));
			});
		});
	};

	remove(Path.join(electronpath, path), callback);
};

FUNC.newlineslength = function(str) {

	if (!str)
		return 0;

	var count = 0;
	var beg = 0;
	while (true) {
		var tmp = str.indexOf('\n', beg);
		if (tmp !== -1) {
			count++;
			beg = tmp + 1;
		} else
			break;
	}
	return count;
};

FUNC.bytelength = function(str) {

	if (!str)
		return 0;

	// returns the byte length of an utf8 string
	var s = str.length;
	for (var i = str.length - 1; i >= 0; i--) {
		var code = str.charCodeAt(i);
		if (code > 0x7f && code <= 0x7ff)
			s++;
		else if (code > 0x7ff && code <= 0xffff)
			s += 2;
		if (code >= 0xDC00 && code <= 0xDFFF)
			i--; //trail surrogate
	}
	return s;
};

FUNC.cleanduplicatedlines = function(val) {

	var output = [];
	var cache = [];

	val = val.split('\n');

	for (var i = 0; i < val.length; i++) {
		var line = val[i];
		if (!line) {
			output.push('');
			continue;
		}

		var k = line.trim();
		if (cache.indexOf(k) !== -1) {
			output.push(line);
			cache.push(k);
		}
	}

	return output.join('\n');
};

FUNC.tidyup = function(val) {
	var lines = val.split('\n');
	for (var i = 0, length = lines.length; i < length; i++)
		lines[i] = lines[i].replace(/\s+$/, '');
	return lines.join('\n').trim().replace(TIDYUPWHITE, ' ');
};

FUNC.formathtml = function(body) {

	var index = 0;
	var builder = [];
	var count = 0;
	var tmp;

	if (body.indexOf('\t') !== -1)
		return body;

	var pad = function(count) {
		return '\n'.padRight(count, '\t');
	};

	while (true) {

		var c = body[index++];
		var n = body[index];

		if (index > body.length)
			break;

		if (c === '<' && n === 'd' && body.substring(index, index + 3) === 'div') {
			tmp = index;
			index = body.indexOf('>', index + 3) + 1;
			builder.push(pad(count + 1) + body.substring(tmp - 1, index) + pad(count + 2));
			count++;
			continue;
		}

		if (c === '<' && n === '/' && body.substring(index, index + 4) === '/div') {
			count--;
			builder.push(pad(count + 1) + '</div>' + pad(count + 1));
			index += 5;
			continue;
		}

		builder.push(body.substring(index - 1, index));
	}

	for (var i = 0, length = builder.length; i < length; i++) {
		var line = builder[i];
		var next = builder[i + 1];
		if (!next)
			break;
		var a = line.indexOf('>');
		if (a === -1)
			continue;
		var b = next.indexOf('<');
		if (b === -1)
			continue;
		next = next.substring(0, b);
		if (line.indexOf('\n', a) === -1 || (next.indexOf('\n') === -1))
			continue;
		builder[i] = line.substring(0, a + 1) + line.substring(a + 2);
	}

	return builder.join('').replace(/\t{1,}\n/g, '\n').trim();
};

FUNC.sql2schema = function(text) {
	var arr = text.split('\n');
	var reg = /_varchar|varchar|int|json|double|float|timestamp|bool|text/;
	var beg = arr[0].indexOf('\t');
	var tab = beg === -1 ? '' : ''.padLeft(beg + 1, '\t');
	var builder = [];
	for (var i = 0; i < arr.length; i++) {
		var line = arr[i].trim();
		var type = line.match(reg);
		if (type) {
			var length = line.match(/\(\d+\)/);
			if (length) {
				length = (length + '');
				length = length.substring(1, length.length - 1);
			}
			type = type[0];
			var val = line.split(' ');
			var name = val[0].replace(/"|`/g, '');

			switch (type) {
				case 'text':
					type = 'String';
					break;
				case 'varchar':
					if (name.indexOf('email') !== -1)
						type = '\'Email\'';
					else if (name.indexOf('phone') !== -1)
						type = '\'Phone\'';
					else if (name.indexOf('url') !== -1)
						type = '\'URL\'';
					else if (name.indexOf('zip') !== -1)
						type = '\'Zip\'';
					else if (name.endsWith('id') && (length === '20' || length === '25' || length === '30'))
						type = 'UID';
					else
						type = length ? ('\'String({0})\''.format(length)) : 'String';
					break;
				case '_varchar':
					type = '\'[String]\'';
					break;
				case 'json':
					type = '\'json\'';
					break;
				case 'int':
				case 'tinyint':
					type = length === '1' ? 'Boolean' : 'Number';
					break;
				case 'mediumint':
				case 'longint':
				case 'double':
				case 'float':
					type = 'Number';
					break;
				case 'bool':
					type = 'Boolean';
					break;
				case 'timestamp':
					type = 'Date';
					break;
			}
			builder.push(tab + 'schema.define(\'{0}\', {1});'.format(name, type));
		}
	}
	return builder.join('\n');
};

FUNC.cleancss = function(text) {
	return text.replace(/\n\n/g, '\0').replace(/\n|\t/g, '').replace(/:(-\w|'|")/g, function(text) {
		return ': ' + text.substring(1);
	}).replace(/\}/g, '}\n').replace(/\s{2,}/g, ' ').replace(/(\w|'|"|;)\}/g, function(text) {
		var l = text.substring(text.length - 2, text.length - 1);
		return text.substring(0, text.length - 1) + (l !== ';' ? ';' : '') + ' ' + text.substring(text.length - 1);
	}).replace(/;(\w)/g, '; $1').replace(/"/g, '\'').replace(/(\w)\{/g, '$1 {').replace(/\{\w/g, function(text) {
		return text.substring(0, 1) + ' ' + text.substring(1);
	}).replace(/(\n)?.*?\{/g, function(text) {
		return text.replace(/:\s(\w)/g, ':$1');
	}).replace(/\0/g, '\n').replace(/:[a-z0-9#]/gi, function(text) {
		return ': ' + text.substring(1);
	}).replace(/:\s[a-f0-9#]{3,8}/gi, function(text) {
		text = text.toUpperCase();

		var prev = '';

		for (var i = 3; i < text.length; i++) {

			var c = text.charAt(i);

			if (i === 3) {
				prev = c;
				continue;
			}

			if (c !== prev)
				return text;

			prev = c;
		}

		return text.substring(0, 6);
	});
};

FUNC.usercolor = function(value) {

	var index = value.indexOf('.');
	var arr = value.substring(index + 1).replace(/\s{2,}/g, ' ').trim().split(' ');
	var initials = (arr[0].substring(0, 1) + (arr[1] || '').substring(0, 1));
	var sum = 0;

	if (initials.length === 1 && arr[0].length > 1)
		initials += arr[0].substring(arr[0].length - 1).toUpperCase();

	for (var i = 0; i < value.length; i++)
		sum += value.charCodeAt(i);

	return { color: TTIC[sum % value.length], name: value, initials: initials };
};

FUNC.sortcss = function(value) {
	var lines = value.split('\n');
	for (var i = 0; i < lines.length; i++) {
		var line = lines[i];
		var beg = line.indexOf('{');
		var end = line.indexOf('}');
		if (beg === -1 || end === -1)
			continue;
		var tmp = line.substring(beg + 1, end).trim().split(';').trim();
		tmp.quicksort();
		lines[i] = line.substring(0, beg + 1) + ' ' + tmp.join('; ') + '; ' + line.substring(end);
	}

	return lines.join('\n').replace(/:[a-z0-9#]/gi, function(text) {
		return ': ' + text.substring(1);
	});
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

FUNC.strim = function(value) {
	var c = value.charAt(0);
	if (c !== ' ' && c !== '\t')
		return value;

	for (var i = 0; i < value.length; i++) {
		c = value.charAt(i);
		if (c !== ' ' && c !== '\t')
			break;
	}

	var count = i;
	var lines = value.split('\n');

	for (var i = 0; i < lines.length; i++) {
		var line = lines[i];
		if (line.length > count)
			lines[i] = line.substring(count);
	}

	return lines.join('\n');
};

FUNC.rtrim = function(value) {
	var lines = value.split('\n');
	var reg = /\s+$/;
	for (var i = 0; i < lines.length; i++)
		lines[i] = lines[i].replace(reg, '');
	return lines.join('\n').replace(TIDYUPWHITE, ' ');
};

FUNC.wsopen = function(project, path, openid) {
	SETTER('websocket/send', { TYPE: 'edit', projectid: project, fileid: path, openid: openid });
};

FUNC.wssend = function(msg) {
	SETTER('websocket/send', msg);
};

FUNC.success = function(msg) {
	SETTER('notifybar/success', msg);
};

FUNC.warning = function(msg) {
	SETTER('notifybar/warning', msg instanceof Array ? msg[0].error : msg);
};

FUNC.info = function(msg) {
	SETTER('notifybar/info', msg);
};

FUNC.editor_reload = function(watcher) {

	if (!W.code || !W.code.current)
		return;

	if (!watcher)
		SETTER('loading/show');

	var tab = code.open.findItem('path', code.current.path);
	if (tab) {
		tab.loaded = false;
		tab.doc = null;
		tab.reload = true;
		tab.iswatcher = watcher;
		EXEC('code/open', tab);
		SETTER('loading/hide', 500);
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
		case 'php':
			return 'php';
		case 'javascript':
		case 'js':
			return 'js';
		case 'text/css':
		case 'css':
			return 'css';
		case 'text/x-csrc':
		case 'text/x-c++src':
		case 'cpp':
			return 'cpp';
		case 'text/x-sql':
		case 'sql':
			return 'sql';
		case 'application/ld+json':
		case 'application/json':
		case 'text/json':
		case 'json':
			return 'json';
		case 'text/x-cython':
		case 'python':
		case 'py':
			return 'python';
		case 'text/x-sh':
		case 'bash':
		case 'sh':
			return 'bash';
		case 'text/x-sass':
		case 'sass':
			return 'sass';
		case 'text/x-yaml':
		case 'yaml':
			return 'yaml';
		case 'application/xml':
		case 'text/xml':
		case 'xml':
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

FUNC.requestscriptspawn = function(id, path) {
	SETTER('loading/show');

	var winid = 'w' + GUID(10);
	AJAX('GET /api/request/{0}/?path={1}&id={2}'.format(id, encodeURIComponent(path), winid), function(response, err) {

		SETTER('loading/hide', 100);

		var obj = {};
		obj.id = winid;
		obj.cachekey = 'spawn';
		obj.offset = { x: 600, y: 400, width: 650, height: 300, minwidth: 200, minheight: 200 };
		obj.title = '<i class="fa fa-pulse fa-spinner"></i>' + Thelpers.encode(path);
		obj.html = '<div data---="viewbox__common.spawns.{0}__parent:.ui-windows-body;scrollbottom:1;scrollbar:1"><div class="padding"><pre data-bind="common.spawns.{0}__text:value?value.join(\'\'):\'\'" style="padding:0;margin:0;font-family:Menlo,Menlo2;font-size:14px"></pre></div></div>'.format(obj.id);
		obj.actions = { minimize: true, maximize: true, move: true, resize: true, close: true, autosave: true };
		obj.destroy = function() {
			SETTER('websocket/send', { TYPE: 'x', id: winid });
		};

		PUSH('windows', obj);
	});
};

FUNC.requestscript = function(id, path) {
	SETTER('loading/show');
	AJAX('GET /api/request/{0}/?path={1}'.format(id, encodeURIComponent(path)), function(response, err) {

		SETTER('loading/hide', 100);

		if (response instanceof Array) {
			SETTER('message/warning', response[0].error);
			return;
		}

		var template = '<div class="output-response-header">{0}:</div><div class="output-response-header-value">{1}</div>';
		PUSH('^output', '<div class="output-response">{0}</div>'.format(template.format('Response (' + (response.duration / 1000) + ' s)', Thelpers.encode(response.response).replace(/\n/g, '<br />'))));
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
	AJAX('POST /api/request/', { body: text }, function(response) {

		SETTER('loading', 'hide', 100);

		var builder = [];
		var keys = Object.keys(response.headers);
		var skip = { server: 1, date: 1, 'transfer-encoding': 1, connection: 1, vary: 1, expires: 1, 'cache-control': 1 };
		var template = '<div class="output-response-header">{0}:</div><div class="output-response-header-value">{1}</div>';

		builder.push(template.format('HTTP Status', response.statustext));

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


		var json = null;
		try {
			json = JSON.parse(response.response);
		} catch (e) {}

		builder.push(template.format('Response (' + (response.duration / 1000) + ' s)', json ? ('<pre>' + FUNC.formatjson(json) + '</pre>') : Thelpers.encode(response.response).replace(/\n/g, '<br />')));

		PUSH('^output', '<div class="output-response"><div class="output-response-caption" title="{0}">{0}</div>{1}</div>'.format(Thelpers.encode(response.url), builder.join('')));
		SET('common.form', 'output');
	});
};

FUNC.hex2rgba = function(hex) {
	var c = (hex.charAt(0) === '#' ? hex.substring(1) : hex).split('');
	if(c.length === 3)
		c = [c[0], c[0], c[1], c[1], c[2], c[2]];

	var a = c.splice(6);
	if (a.length)
		a = parseFloat(parseInt((parseInt(a.join(''), 16) / 255) * 1000) / 1000);
	else
		a = '1';

	c = '0x' + c.join('');
	return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + a + ')';
};

FUNC.rgba2hex = function(rgba) {
	var m = rgba.match(/\d+,(\s)?\d+,(\s)?\d+,(\s)?[.0-9]+/);
	if (m) {
		m = m[0].split(',').trim();

		var a = m[3];
		if (a) {
			if (a.charAt(0) === '.')
				a = '0' + a;
			a = a.parseFloat();
			a = ((a * 255) | 1 << 8).toString(16).slice(1);
		} else
			a = '';

		return '#' + ((m[0] | 1 << 8).toString(16).slice(1) + (m[1] | 1 << 8).toString(16).slice(1) + (m[2] | 1 << 8).toString(16).slice(1) + a).toUpperCase();

	} else
		return rgba;
};

FUNC.alignrouting = function(text) {

	var lines = text.split('\n');
	var maxmethod = 0;
	var maxurl = 0;
	var maxschema = 0;
	var maxid = 0;

	for (var i = 0; i < lines.length; i++) {
		var line = lines[i];

		if (!line || line.indexOf('ROUTE(\'') === -1)
			continue;

		var beg = line.indexOf('\'');
		var end = line.indexOf('\'', beg + 2);
		var str = line.substring(beg + 1, end);
		var data = str.split(/\s{1,}|\t/);

		if (data[0].length > maxmethod)
			maxmethod = data[0].length;

		if (data[1].length > maxurl)
			maxurl = data[1].length;

		if (line.indexOf('API') === -1) {

			if (data[2] && data[2].length > maxschema)
				maxschema = data[2].length;

		} else {

			if (data[2] && data[2].length > maxid)
				maxid = data[2].length;

			if (data[3] && data[3].length > maxschema)
				maxschema = data[3].length;

		}

		beg = line.indexOf(',');
	}

	maxmethod += 4;
	maxurl += 4;
	maxschema += 2;

	if (maxid)
		maxid += 4;

	for (var i = 0; i < lines.length; i++) {
		var line = lines[i];

		if (!line || line.indexOf('ROUTE(\'') === -1)
			continue;

		var beg = line.indexOf('\'');
		var end = line.indexOf('\'', beg + 2);
		var str = line.substring(beg + 1, end);
		var data = str.split(/\s{1,}|\t/);
		var builder = [];

		for (var j = 0; j < data.length; j++) {

			var c = data[j].charAt(0);

			// method
			switch (j) {

				case 0: // method
					builder.push(data[j].padRight(maxmethod, ' '));
					break;

				case 1: // url
					builder.push(data[j].padRight(maxurl, ' '));
					break;

				case 2: // schema

					if (c === '-' || c === '+' || c === '#') {
						builder.push(data[j].padRight(maxid, ' '));
					} else {
						maxid && builder.push(''.padRight(maxid, ' '));
						builder.push(data[j].padRight(maxschema, ' '));
					}

					break;

				case 3: // schema
					if (c === '-' || c === '+' || c === '#')
						builder.push(' ' + data[j]);
					else
						builder.push(data[j].padRight(maxschema, ' '));
					break;

				default: // operations
					builder.push(' ' + data[j]);
					break;

			}
		}

		var clean = line.substring(end).replace(/\s{2,}/, ' ');
		lines[i] = line.substring(0, beg) + '\'' + builder.join('').trim() + clean;
	}

	return lines.join('\n');
};

FUNC.colorize = function(css, cls) {
	var lines = css.split('\n');
	var builder = [];

	var findcolor = function(val) {
		var color = val.match(/#[0-9A-F]{1,6}/i);
		if (color)
			return color + '';
		var beg = val.indexOf('rgba(');
		if (beg === -1)
			return;
		return val.substring(beg, val.indexOf(')', beg) + 1);
	};

	for (var i = 0; i < lines.length; i++) {

		var line = lines[i];

		if (!line) {
			builder.push('');
			continue;
		}

		var beg = line.indexOf('{');
		if (beg === -1)
			continue;

		var end = line.lastIndexOf('}');
		if (end === -1)
			continue;

		var cmd = line.substring(beg + 1, end).split(';');
		var cmdnew = [];

		for (var j = 0; j < cmd.length; j++) {
			var c = cmd[j].trim().split(':').trim();
			switch (c[0]) {
				case 'border':
				case 'border-left':
				case 'border-top':
				case 'border-right':
				case 'border-bottom':
				case 'outline':
					var color = findcolor(c[1]);
					if (color)
						cmdnew.push(c[0] + '-color: ' + color);
					break;
				case 'background':
				case 'border-left-color':
				case 'border-right-color':
				case 'border-top-color':
				case 'border-bottom-color':
				case 'border-color':
				case 'background-color':
				case 'outline-color':
				case 'color':
				case 'stroke':
				case 'fill':
					cmdnew.push(c[0] + ': ' + c[1]);
					break;
			}
		}
		if (cmdnew.length) {
			var selector = line.substring(0, beg).trim();
			var sel = selector.split(',').trim();
			for (var k = 0; k < sel.length; k++)
				sel[k] = (cls ? (cls + ' ') : '') + sel[k].trim().replace(/\s{2,}/g, ' ');
			builder.push(sel.join(', ') + ' { ' + cmdnew.join('; ') + '; }');
		}
	}

	var arr = [];
	var prev = '';
	for (var i = 0; i < builder.length; i++) {
		var line = builder[i];
		if (prev === line)
			continue;
		prev = line;
		arr.push(line);
	}

	return arr.join('\n');
};

FUNC.responsive = function(css) {

	var lines = css.split('\n');
	var builder = [];

	for (var i = 0; i < lines.length; i++) {

		var line = lines[i];

		if (!line) {
			builder.push('');
			continue;
		}

		var beg = line.indexOf('{');
		if (beg === -1)
			continue;

		var end = line.lastIndexOf('}');
		if (end === -1)
			continue;

		var cmd = line.substring(beg + 1, end).split(';');
		var cmdnew = [];

		for (var j = 0; j < cmd.length; j++) {
			var c = cmd[j].trim().split(':').trim();
			switch (c[0]) {
				case 'margin':
				case 'left':
				case 'top':
				case 'right':
				case 'bottom':
				case 'padding':
				case 'max-width':
				case 'max-height':
				case 'position':
				case 'z-index':
				case 'min-width':
				case 'min-height':
				case 'margin-left':
				case 'margin-top':
				case 'margin-right':
				case 'margin-bottom':
				case 'padding-left':
				case 'padding-top':
				case 'padding-right':
				case 'padding-bottom':
				case 'width':
				case 'font':
				case 'font-size':
				case 'line-height':
				case 'height':
					cmdnew.push(c[0] + ': ' + c[1]);
					break;
			}
		}
		if (cmdnew.length) {
			var selector = line.substring(0, beg).trim();
			var sel = selector.split(',').trim();
			for (var k = 0; k < sel.length; k++)
				sel[k] = sel[k].trim().replace(/\s{2,}/g, ' ');
			builder.push(sel.join(', ') + ' { ' + cmdnew.join('; ') + '; }');
		}
	}

	var arr = [];
	var prev = '';
	for (var i = 0; i < builder.length; i++) {
		var line = builder[i];
		if (prev === line)
			continue;
		prev = line;
		arr.push(line);
	}

	return arr.join('\n');
};

FUNC.makejsonfromschema = function(val) {

	var model = [];
	var lines = val.split('\n');

	for (var i = 0; i < lines.length; i++) {
		var line = lines[i].trim();
		var beg = line.indexOf('\'');
		if (beg === -1)
			continue;

		var end = line.indexOf('\'', beg + 1);
		if (end === -1)
			continue;

		var key = line.substring(beg + 1, end).trim();

		beg = end + 3;
		end = line.lastIndexOf(',');

		if (end === -1 || end <= beg) {
			end = line.indexOf(')');
			if (end !== -1)
				end++;
		}

		if (end === -1)
			continue;

		var val = line.substring(beg, end).trim().replace(/^('|")|('|")$/g, '');

		if (val.charAt(val.length - 1) === ')' && val.lastIndexOf('(', val.length - 1) === -1)
			val = val.substring(0, val.length - 1);

		if (val.charAt(val.length - 1) === '\'')
			val = val.substring(0, val.length - 1);

		if (model[model.length - 1])
			model[model.length - 1] += ',';

		model.push('\t"' + key + '": ' + val.replace(/'/g, '"'));
	}

	return '{\n' + model.join('\n') + '\n}';
};

FUNC.makejsonschemafromschema = function(val) {

	var lines = val.split('\n');

	var obj = {};
	var p = 'https://schemas.totaljs.com/';

	if (p[p.length - 1] !== '/')
		p += '/';

	obj.$id = p + code.current.name.replace(/\.js$/, '') + '.json';
	obj.$schema = 'https://json-schema.org/draft/2020-12/schema';
	obj.required = [];
	obj.type = 'object';
	obj.properties = {};

	var define = function(name, type, required) {

		var meta = {};

		if (type === Number)
			meta.type = 'number';
		else if (type === Boolean)
			meta.type = 'boolean';
		else if (type === String)
			meta.type = 'string';
		else if (type === Date)
			meta.type = 'date';
		else if (type === Object)
			meta.type = 'object';
		else if (type instanceof Array) {
			// enum
			meta.type = typeof(type[0]);
			meta.isenum = true;
			meta.values = type;
		} else
			meta.type = (type + '').toLowerCase();

		meta.name = name;
		meta.isrequired = required;
		meta.isarray = meta.type.charAt(0) === '[';
		meta.length = 0;

		if (meta.isarray)
			meta.type = meta.type.substring(1, meta.type.length - 1);

		var index = meta.type.indexOf('(');
		if (index !== -1) {
			meta.length = +meta.type.substring(index + 1, meta.type.length - 1);
			meta.type = meta.type.substring(0, index);
		}

		return meta;
	};

	var run = function(val) {
		try {
			return new Function('define', 'return ' + val)(define);
		} catch (e) {}
	};

	for (var i = 0; i < lines.length; i++) {
		var line = lines[i].trim();
		var beg = line.indexOf('\'');
		if (beg === -1)
			continue;

		var end = line.indexOf('\'', beg + 1);
		if (end === -1)
			continue;

		beg = end + 3;
		end = line.lastIndexOf(',');

		if (end === -1 || end <= beg) {
			end = line.indexOf(')');
			if (end !== -1)
				end++;
		}

		if (end === -1)
			continue;

		var val = line.match(/\.define\(.*?\);/);
		if (!val)
			continue;

		val = val[0].substring(1);
		var meta = run(val);
		if (!meta)
			continue;

		var tmp;

		switch (meta.type) {
			case 'number':
			case 'float':
				tmp = {};
				if (meta.isarray) {
					tmp.type = 'array';
					tmp.items = { type: 'number' };
				} else {
					tmp.type = 'number';
					if (meta.isenum)
						tmp.enum = meta.values;
				}
				break;
			case 'string':
			case 'name':
			case 'uppercase':
			case 'lowercase':
			case 'capitalize':
			case 'capitalize2':
			case 'url':
			case 'email':
			case 'phone':
			case 'zip':
			case 'json':
			case 'base64':
			case 'uid':
				tmp = {};
				if (meta.isarray) {
					tmp.type = 'array';
					tmp.items = { type: 'string' };
					if (meta.length)
						tmp.items.maxLength = meta.length;
				} else {
					tmp.type = 'string';
					if (meta.length)
						tmp.maxLength = meta.length;
					if (meta.isenum)
						tmp.enum = meta.values;
				}
				break;
			case 'boolean':
				tmp = {};
				if (meta.isarray) {
					tmp.type = 'array';
					tmp.items = { type: 'boolean' };
				} else
					tmp.type = 'boolean';
				break;
			case 'date':
				tmp = {};
				if (meta.isarray) {
					tmp.type = 'array';
					tmp.items = { type: 'date' };
				} else
					tmp.type = 'date';
				break;
		}

		if (tmp) {
			if (meta.isrequired)
				obj.required.push(meta.name);
			obj.properties[meta.name] = tmp;
		}
	}

	return JSON.stringify(obj, null, '\t');
};

FUNC.parsekeys = function(value) {

	var lines = value.split('\n');
	var fields = {};
	var regnumber = /^\d+$/;
	var regchar = /["';,.()\[\]{}]/;
	var regcomma = /[.,]$/;
	var regsplit = /\t|\||\s|;/;

	for (var i = 0; i < lines.length; i++) {

		var line = lines[i].trim();
		var w;

		if (line[0] === '"') {
			w = line.substring(1, line.indexOf('"', 1));
			if (w && w.indexOf(' ') === -1 && !regchar.test(w))
				fields[w] = 1;
			continue;
		}

		var words = line.split(regsplit);
		var w;

		if (words[1] && words[2] && words[1].toLowerCase() === 'as')
			words[0] = words[2];

		if (regnumber.test(words[0])) {
			if (words[1])
				w = words[1];
		} else if (words[0])
			w = words[0];

		var index = w.indexOf('.');
		if (index !== -1)
			w = w.substring(index + 1);

		if (w) {
			w = w.replace(regcomma, '');
			if (w.indexOf(' ') === -1 && !regchar.test(w))
				fields[w] = 1;
		}
	}

	return Object.keys(fields);
};

FUNC.maketabname = function(path) {
	var index = path.lastIndexOf('/');
	return path.substring(index + 1);
};

FUNC.formatjson = function(obj) {
	var reguid2 = /"\d{14,}[a-z]{3}[01]{1}|"\d{9,14}[a-z]{2}[01]{1}a|"\d{4,18}[a-z]{2}\d{1}[01]{1}b|"[0-9a-f]{4,18}[a-z]{2}\d{1}[01]{1}c"/g;
	obj.HTML = undefined;
	return JSON.stringify(obj, null, '\t').replace(/\t.*?:\s/g, function(text) {
		return '<span class="db-object">' + text + '</span>';
	}).replace(/\/span>false/g, function() {
		return '/span><span class="db-string">false</span>';
	}).replace(/\/span>null/g, function() {
		return '/span><span class="db-null">null</span>';
	}).replace(reguid2, function(text) {
		return '<span class="db-uid">' + text + '</span>';
	});
};

FUNC.removecssclass = function(cls, value) {

	var lines = value.split('\n');
	var builder = [];
	var regwhite = (/\s$/);
	var index;
	var end;

	for (var i = 0; i < lines.length; i++) {
		var line = lines[i];
		var beg = 0;

		index = line.indexOf('{', beg);

		if (index === -1) {
			builder.push(line);
			continue;
		}

		var cmd = [];
		var subindex = 0;
		var end = 0;

		while (true) {
			end = line.indexOf('}', subindex + 1);

			if (end === -1) {
				cmd.push(line.substring(subindex));
				break;
			}

			cmd.push(line.substring(subindex, end + 1));
			subindex = end + 1;
		}

		var cleaned = [];

		for (var x = 0; x < cmd.length; x++) {

			if (cmd[x] === '{' || cmd[x] === '}') {
				cleaned.push(cmd[x]);
				continue;
			}

			subindex = cmd[x].indexOf('{');

			var selectors = cmd[x].substring(0, subindex);
			var plus = '';

			for (var j = 0; j < selectors.length; j++) {
				var c = selectors.charAt(j);
				if (c === '\t')
					plus += c;
				else
					break;
			}

			var sel = selectors.split(',');
			var upd = [];

			for (var j = 0; j < sel.length; j++) {
				var item = sel[j];
				var trimmed = item.trim();
				if (trimmed && trimmed.indexOf(cls) === -1)
					upd.push(trimmed);
			}

			if (upd.length) {
				var tmp = plus + upd.join(', ');
				cleaned.push(tmp + (regwhite.test(tmp) ? '' : ' ') + cmd[x].substring(subindex));
			}
		}

		if (cleaned.length)
			builder.push(cleaned.join(''));

		if (builder[builder.length - 1] === '')
			builder.pop();
	}

	return builder.join('\n');
};

FUNC.livereload = function(filename) {

	var timeout = 100;

	// Needs restaring of the server
	if (!(/\/(public|views)\//gi).test(filename))
		timeout = 2500;

	code.data && code.data.url && code.data.url.length > 3 && W.WSLIVERELOAD && setTimeout2('livereload', function(filename) {
		W.WSLIVERELOAD.send(code.data.url.replace(/^(https|http):\/\//g, '') + filename + ',' + user.id);
	}, timeout, null, filename || '');
};

FUNC.livereloadconnect = function() {

	if (W.WSLIVERELOAD)
		return;

	var ws = new WebSocket('wss://livereload.totaljs.com/?hostname=' + code.data.url.replace(/^(https|http):\/\//g, ''));
	ws.onopen = function() {
		W.WSLIVERELOAD = ws;
	};
	ws.onclose = function() {
		W.WSLIVERELOAD = null;
		if (code.data && code.data.livereload)
			setTimeout(FUNC.livereloadconnect, 3000);
	};
};

(function() {

	var lastusage;

	FUNC.totalcombat = function(name) {
		if (common.totalcombat) {

			var tmp = Date.now();
			if (name !== 'start' && name !== 'round' && lastusage) {
				if ((tmp - lastusage) < 3000)
					return;
			}

			lastusage = tmp;
			SETTER(true, 'audio/play', '/sounds/' + name + '.mp3');
		}
	};
})();

// Wiki
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
		var tmp;

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
				md.push('- [Make a request](#api_{0})'.format(btoa(encodeURIComponent(JSON.stringify(action, (k, v) => v ? v : undefined)))));

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

FUNC.jcomponent_update = function(name, type, content, body, meta) {

	var comment_beg = (type === 'css' ? '/* Component: {0} */' : '// Component: {0}').format(name) + '\n';
	var comment_end = (type === 'css' ? '/* End: {0} */' : '// End: {0}').format(name) + '\n';
	var version = (type === 'css' ? '/* Version: {0} */' : '// Version: {0}').format(meta.version) + '\n';
	var updated = (type === 'css' ? '/* Updated: {0} */' : '// Updated: {0}').format((meta.dateupdated || meta.datecreated).format('yyyy-MM-dd HH:mm')) + '\n';

	var code = '\n\n' + comment_beg + version + updated + body + '\n' + comment_end;
	content = content.trim();

	var beg = content.indexOf(comment_beg);
	if (beg === -1) {

		if (!body)
			return content.trim();

		content += code;
		return content.trim();
	}

	var end = (content + '\n').indexOf(comment_end, beg + comment_beg.length);
	return (content.substring(0, beg).trim() + (body ? code : '\n') + content.substring(end + comment_end.length)).trim();
};

(function() {

	var schemaoperation_replace = function(text) {
		return text.charAt(0) === '(' ? '()' : ')';
	};

	FUNC.parts_parser = function(val, mode) {

		var REGTODO = /@todo/i;
		var REGTODO2 = /^(\s)+-\s.*?/;
		var REGTODOREPLACE = /^@todo(:)(\s)|(\s)+-(\s)/i;
		var REGTODODONE = /@done|@canceled/i;
		var REGTODOCLEAN = /-->|\*\//g;
		var REGPART = /(COMPONENT|COMPONENT_EXTEND|EXTENSION|CONFIG|NEWSCHEMA|NEWCOMMAND|NEWOPERATION|NEWTASK|MIDDLEWARE|WATCH|ROUTE|(^|\s)ON|PLUGIN|PLUGINABLE)+\(.*?\)/g;
		var REGPARTCLEAN = /('|").*?('|")/;
		var REGHELPER = /(Thelpers|FUNC|REPO|MAIN)\.[a-z0-9A-Z_$]+(\s)+=/g;
		var REGCONSOLE = /console\.\w+\(.*?\)/g;
		var REGSCHEMAOP = /\.(setQuery|setSave|setInsert|setUpdate|setPatch|setRead|setGet|setRemove|addWorkflow|addTransform|addOperation|addHook)(Extension)?\(.*?\)/g;
		var REGSCHEMAOP_DEFINE = /\.define\(.*?\);/g;
		var REGSCHEMAOP_REPLACE = /(\(|,(\s))function.*?$/g;
		var REGPLUGINOP_REPLACE = /(\s)+=(\s)+function/g;
		var REGFUNCTION = /((\s)+=(\s)+function)/;
		var REGTASKOP = /('|").*?('|")/g;
		var REGVERSION = /version[":-='\s]+[a-z0-9."',\s]+/;
		var REGJC = /data---=".*?(__|")/g;
		var todos = [];
		var components = [];

		var is = null;
		var name, type, oldschema, oldplugin, pluginvariable, oldtask, taskvariable, tmp;
		var ispluginable = false;
		var version = '';
		var version_file = '';
		var lines = val.split('\n');

		for (var i = 0; i < lines.length; i++) {

			var line = lines[i];
			var m;

			if (mode === 'markdown') {
				if ((/^#{1,4}\s/).test(line))
					components.push({ line: i, ch: 0, name: line.trim(), type: 'markdown' });
				continue;
			}

			m = mode === 'todo' ? line.match(REGTODO2) : line.match(REGTODO);

			if (m && !REGTODODONE.test(line))
				todos.push({ line: i + 1, ch: m.index || 0, name: line.substring(m.index, 200).replace(REGTODOREPLACE, '').replace(REGTODOCLEAN, '').trim() });

			if (line && mode !== 'css') {
				m = line.match(REGVERSION);
				if (m) {
					version = m.toString().replace(/(version|\s|"|'|=|:)+/g, '').replace(/[^\d,.]+/g, '').replace(/(,|\.|-|"|')$/,'').trim().replace(/^[,.\-\s]+|[,.\-\s]+$/g, '');
					if (version && (/\d/g).test(version)) {
						version_file = version;
						components.push({ line: i, ch: m.index || 0, name: version, type: 'version' });
					}
				}
			}

			if (mode === 'javascript' || mode === 'totaljs' || mode === 'html' || mode === 'htmlmixed' || mode === 'totaljs_server') {

				if (is != null && line.substring(is, 3) === '});') {
					components[components.length - 1].lineto = i;
					is = null;
				}

				m = line.match(REGJC);
				if (m) {
					name = m[0].replace(/data---="|_{2,}|"/g, '').trim();
					if (components.findIndex('name', name ) === -1)
						components.push({ line: i, ch: m.index || 0, name: name, type: 'htmlcomponent' });
				}

				m = line.match(REGPART);
				if (m) {

					name = m[0].match(REGPARTCLEAN);
					tmp = m[0].toLowerCase();

					if (tmp.substring(0, 16) === 'component_extend') {
						type = 'exten';
					} else
						type = tmp.substring(0, 5).trim();

					if (name) {
						name = name[0].replace(/'|"/g, '');
						var beg = m.index || 0;
						switch(type) {
							case 'newsc':
								oldschema = name;
								break;
							case 'newta':
								oldtask = name;
								taskvariable = m[0].substring(m[0].indexOf('(', 10) + 1, m[0].indexOf(')'));
								break;
							case 'plugi':
								oldplugin = name;
								ispluginable = tmp.substring(0, 10) === 'pluginable';
								pluginvariable = m[0].substring(m[0].indexOf('(', ispluginable ? 20 : 10) + 1, m[0].indexOf(')'));
								break;
						}

						if (type === 'watch' && oldplugin)
							name = name.replace(/\?/g, oldplugin);

						components.push({ line: i, ch: beg, name: name.trim(), type: type.substring(0, 3) === 'on(' ? 'event' : type === 'exten' ? 'extension' : type === 'compo' ? 'component' : type === 'newsc' ? 'schema' : type === 'confi' ? 'config' : type === 'newop' ? 'operation' : type === 'newta' ? 'task' : type === 'newco' ? 'command' : type === 'watch' ? 'watcher' : type === 'plugi' ? ispluginable ? 'pluginable' : 'plugin' : type === 'middl' ? 'middleware' : type === 'route' ? 'route' : 'undefined' });
						is = beg;
					}
				}

				m = line.match(REGHELPER);
				if (m) {
					var end = m[0].indexOf('=');
					if (end === -1)
						continue;
					type = m[0].substring(0, 4);
					name = m[0].substring(type === 'Thel' ? 9 : 5, end).trim();
					if (name) {

						if (type === 'Thel' || type === 'FUNC') {
							var subm = line.match(REGFUNCTION);
							if (!subm)
								continue;
							name = name.trim() + line.substring(line.indexOf('(', subm.index), line.indexOf(')', subm.index + 8) + 1);
						}

						var beg = m.index || 0;
						components.push({ line: i, ch: beg, name: (type === 'Thel' ? 'Thelpers' : type) + '.' + name.trim(), type: type === 'Thel' ? 'helper' : type.toUpperCase() });
					}
				}

				m = line.match(REGCONSOLE);
				if (m) {
					name = m[0].length > 20 ? (m[0].substring(0, 30) + '...') : m[0];
					var tmpindex = line.indexOf('//');
					if (tmpindex === -1 || tmpindex > m.index)
						components.push({ line: i, ch: 0, name: name, type: 'console' });
				}

				if (oldschema) {
					m = line.match(REGSCHEMAOP);
					if (m) {
						m = m[0].replace(REGSCHEMAOP_REPLACE, schemaoperation_replace);
						components.push({ line: i, ch: 0, name: oldschema + m, type: 'schema' });
					}
					m = line.match(REGSCHEMAOP_DEFINE);
					if (m) {
						m = m[0].replace(REGSCHEMAOP_REPLACE, schemaoperation_replace);
						components.push({ line: i, ch: 0, name: oldschema + m, type: 'schema' });
					}
				}

				if (oldplugin) {
					if (pluginvariable.indexOf('(') == -1) {
						m = line.match(new RegExp(pluginvariable + '.*?(\\s)=(\\s)function\\(.*?\\)'));
						if (m) {
							m = m[0].replace(REGPLUGINOP_REPLACE, '');
							m = m.substring(0, m.indexOf(')') + 1).trim().substring(pluginvariable.length);
							components.push({ line: i, ch: 0, name: oldplugin + m, type: ispluginable ? 'pluginable' : 'plugin' });
						}
					}
				}

				if (oldtask) {
					m = line.match(new RegExp(taskvariable + '\\(.*?,'));
					if (m) {
						m = m[0].match(REGTASKOP);
						if (m) {
							m = m[0].replace(/"|'/g, '');
							components.push({ line: i, ch: 0, name: oldtask + '.' + m, type: 'task' });
						}
					}
				}
			}
		}

		for (var i = 0; i < components.length; i++) {
			var com = components[i];

			if (com.name.indexOf('.define(') !== -1) {
				com.lineto = com.line;
				continue;
			}

			var endWith = '';
			var begWith = 0;

			for (var j = com.line; j < (com.line + 6000); j++) {
				var line = lines[j];
				if (!line)
					continue;
				if (j === com.line) {
					begWith = line.length - line.trim().length;
					endWith = line.indexOf('=') === - 1 ? '});' : '};';
				} else {

					if (begWith) {
						if (line.substring(begWith) === endWith) {
							com.lineto = j;
							break;
						}
					} else {
						if (line === endWith) {
							com.lineto = j;
							break;
						}
					}

					if (com.type === 'component') {
						var c = line.substring(com.ch, com.ch + 1);
						if (c === '}') {
							com.lineto = j;
							break;
						}
					} else if (com.type === 'schema') {
						var c = line.substring(begWith, begWith + 1);
						if (c === '}' && line.charAt(line.length - 1) === ';') {
							tmp = line.indexOf('\'');
							if (tmp !== -1)
								com.filter = line.substring(tmp + 1, line.indexOf('\'', tmp + 2));
							com.lineto = j;
							break;
						}
					}
				}
			}
		}

		components = components.remove(function(item) {
			return item.name.indexOf('~PATH~') !== -1;
		});

		for (var i = 0; i < components.length; i++) {
			var com = components[i];

			if (com.name.indexOf('.define(') !== -1) {
				com.lineto = com.line;
				continue;
			}

			var endWith = '';
			var begWith = 0;

			for (var j = com.line; j < (com.line + 6000); j++) {
				var line = lines[j];
				if (!line)
					continue;
				if (j === com.line) {
					begWith = line.length - line.trim().length;
					endWith = line.indexOf('=') === - 1 ? '});' : '};';
				} else {

					if (begWith) {
						if (line.substring(begWith) === endWith) {
							com.lineto = j;
							break;
						}
					} else {
						if (line === endWith) {
							com.lineto = j;
							break;
						}
					}

					if (com.type === 'component') {
						var c = line.substring(com.ch, com.ch + 1);
						if (c === '}') {
							com.lineto = j;
							break;
						}
					} else if (com.type === 'schema') {
						var c = line.substring(begWith, begWith + 1);
						if (c === '}' && line.charAt(line.length - 1) === ';') {
							tmp = line.indexOf('\'');
							if (tmp !== -1)
								com.filter = line.substring(tmp + 1, line.indexOf('\'', tmp + 2));
							com.lineto = j;
							break;
						}
					}
				}
			}
		}

		return { todos: todos, components: components, version: version_file };
	};

})();