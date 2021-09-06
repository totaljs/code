const Fs = require('fs');
const Path = require('path');

FUNC.makeignore = function(arr) {

	var ext;
	var code = ['if (P.indexOf(\'-bk.\')!==-1)return;var path=P.substring(0,P.lastIndexOf(\'/\')+1);', 'var ext=U.getExtension(P);', 'var name=U.getName(P).replace(\'.\'+ext,\'\');'];

	for (var i = 0; i < arr.length; i++) {
		var item = arr[i];
		var index = item.lastIndexOf('*.');

		if (index !== -1) {
			// only extensions on this path
			ext = item.substring(index + 2);
			item = item.substring(0, index);
			code.push('tmp=\'{0}\';'.format(item));
			code.push('if((!tmp||path===tmp)&&ext===\'{0}\')return;'.format(ext));
			continue;
		}

		ext = U.getExtension(item);

		// only filename
		index = item.lastIndexOf('/');
		code.push('tmp=\'{0}\';'.format(item.substring(0, index + 1)));
		code.push('if(path===tmp&&U.getName(\'{0}\').replace(\'.{1}\', \'\')===name&&ext===\'{1}\')return;'.format(item.substring(index + 1), ext));

		// all nested path
		var val = item.replace('*', '');
		val && code.push('if(path.startsWith(\'{0}\'))return;'.format(val));
	}

	code.push('return true');
	return new Function('P', code.join(''));
};

FUNC.mkdir = function(path, callback) {
	var a = '/';
	path = path.split('/').trim();
	path.wait(function(p, next) {
		a = a + p + '/';
		Fs.lstat(a, function(err) {
			if (err)
				Fs.mkdir(a, next);
			else
				next();
		});
	}, callback);
};

FUNC.autodiscover = function(callback) {
	Fs.readdir(CONF.autodiscover || '/www/www/', function(err, directories) {

		if (err) {
			callback && callback();
			return;
		}

		var projects = MAIN.projects;
		var ischange = false;
		var cache = {};

		directories.wait(function(p, next) {

			p = U.path(p.replace(/\/\//g, '/').replace(/\\\\/g, '\\'));

			var model = {};
			model.path = Path.join(CONF.autodiscover, p);
			cache[model.path] = 1;

			Fs.stat(model.path, function(err, stat) {

				if (err || !stat.isDirectory()) {
					var index = projects.findIndex('path', model.path);
					if (index !== -1) {
						projects.splice(index, 1);
						ischange = true;
					}
					next();
					return;
				}

				var item = projects.findItem('path', model.path);
				if (item != null) {
					next();
					return;
				}

				model.name = p.substring(0, p.length - 1);

				var arr = model.name.replace(/_/g, '.').split('-');
				arr.reverse();

				model.url = 'https://' + arr.join('.');
				model.permissions = '';
				model.documentation = 'https://docs.totaljs.com';
				model.support = 'https://platform.totaljs.com';
				model.logfile = '';
				model.users = [];
				model.backup = true;
				model.skipsrc = true;
				model.skiptmp = true;
				model.skipnm = true;
				model.allowbundle = true;
				model.allowscripts = true;

				// new projects
				$SAVE('Projects', model, next);
			});
		}, function() {

			var remove;

			for (var i = 0; i < MAIN.projects.length; i++) {
				var project = MAIN.projects[i];
				if (project.path.substring(0, CONF.autodiscover.length) !== CONF.autodiscover)
					continue;
				if (!cache[project.path]) {
					if (!remove)
						remove = [];
					remove.push(project.id);
				}
			}

			if (remove) {
				remove.wait(function(id, next) {
					$REMOVE('Projects', { id: id, internal: true }, next);
				}, function() {
					MAIN.save(2);
					callback && callback();
				});
			} else {
				ischange && MAIN.save(2);
				callback && callback();
			}
		});
	});
};

FUNC.external_path = function(project, path) {
	var p = HASH(project.path, true).toString(36) + '_' + project.path.slug();
	return path ? Path.join(p, path) : p;
};

var EXTERNAL_JSON = { browse: 1, info: 1, save: 1, remove: 1, create: 1, logclear: 1, modify: 1, ping: 1 };

FUNC.external = function(project, type, path, data, callback) {
	var body = { TYPE: type, path: path, data: data instanceof Buffer ? data.toString('base64') : data };
	var socket = MAIN.external[project.id];
	if (socket) {
		if (type === 'save') {
			F.Zlib.deflate(Buffer.from(body.data, 'utf8'), function(err, buffer) {
				if (buffer) {
					body.data = buffer.toString('base64');
					socket.sendcode(body, callback, EXTERNAL_JSON[type] || 2);
				} else
					callback(err, { status: 400 });
			});
		} else
			socket.sendcode(body, callback, EXTERNAL_JSON[type] || (type === 'log' ? 4 : 2));
	} else {
		callback('offline', { status: 400 });
	}
};

FUNC.external_download = function(project, path, callback) {
	var body = { TYPE: 'download', path: path };
	var socket = MAIN.external[project.id];
	if (socket)
		socket.sendcode(body, callback, 3);
	else
		callback('offline', { status: 400 });
};

FUNC.external_upload = function(project, path, url, callback) {
	var opt = {};
	opt.url = url;
	opt.method = 'GET';
	opt.callback = function(err, response) {
		if (err)
			callback(err);
		else
			FUNC.external(project, 'save', path, response.body, callback);
	};
	REQUEST(opt);
};

if (CONF.autodiscover) {

	ON('service', function(counter) {
		if (counter % 5 === 0)
			FUNC.autodiscover();
	});

	setTimeout(function() {
		if (!PREF.autodiscover) {
			var counter = 0;
			var discover = function() {
				if (counter++ < 360)
					FUNC.autodiscover(() => setTimeout(discover, 10000));
			};
			discover();
			PREF.set('autodiscover', 1);
		} else
			FUNC.autodiscover();
	}, 5000);
}