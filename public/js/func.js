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
		item = { name: arr[0], children: [], path: '/' + arr[0] };
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
			tmp = { name: name, children: [], path: apath };
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
	tab.loaded = false;
	tab.doc = null;
	EXEC('code/open', tab);
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