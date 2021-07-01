const CP = require('child_process');
const READDIROPTIONS = { withFileTypes: true };
const Path = require('path');
const Fs = require('fs');
const Exec = CP.exec;
const Spawn = CP.spawn;

exports.install = function() {

	ROUTE('+GET     /api/{schema}/                         *{schema}          --> @query');
	ROUTE('+GET     /api/{schema}/{id}/                    *{schema}          --> @read');
	ROUTE('+POST    /api/{schema}/                         *{schema}          --> @save');
	ROUTE('+DELETE  /api/{schema}/{id}/                    *{schema}          --> @remove');
	ROUTE('+POST    /api/{schema}/{id}/                    *{schema}          --> @save');

	// Files
	ROUTE('+POST    /api/files/{id}/rename/                *FilesRename       --> @exec');
	ROUTE('+POST    /api/files/{id}/remove/                *FilesRemove       --> @exec');
	ROUTE('+POST    /api/files/{id}/create/                *FilesCreate       --> @exec');

	// Projects
	ROUTE('+GET     /api/projects/{id}/changelog/          *Files             --> @changelog');
	ROUTE('+GET     /api/projects/{id}/review/             *Files             --> @review', [10000]);
	ROUTE('+GET     /api/projects/{id}/download/           *Files             --> @download', [10000]);
	ROUTE('+POST    /api/projects/{id}/upload/             *FilesUpload       --> @exec', ['upload'], 1024 * 50);
	ROUTE('+GET     /api/projects/{id}/files/              *Projects          --> @files');
	ROUTE('+GET     /api/projects/{id}/parts/              *Files             --> @parts');
	ROUTE('+GET     /api/projects/{id}/search/             *Files             --> @search');
	ROUTE('+DELETE  /api/projects/{id}/parts/              *FilesPartsClear   --> @remove');
	ROUTE('+GET     /api/projects/{id}/backups/            *Projects          --> @backups');
	ROUTE('+DELETE  /api/projects/{id}/backups/            *Projects          --> @backupsclear', [10000]);
	ROUTE('+DELETE  /api/projects/{id}/todo/               *FilesTodoClear    --> @remove');
	ROUTE('+GET     /api/projects/{id}/logfile/            *Projects',        files_logfile);
	ROUTE('+GET     /api/projects/{id}/logfile/clear/      *Projects          --> @logfileclear');
	ROUTE('+GET     /api/projects/{id}/restore/            *Projects',        files_restore);
	ROUTE('+GET     /api/projects/{id}/edit/               *Projects',        files_open);
	ROUTE('+GET     /api/projects/{id}/translate/          *Projects',        files_translate);
	ROUTE('+GET     /api/projects/{id}/changes/            *Projects',        files_changes);
	ROUTE('+POST    /api/projects/{id}/hours/              *Hours             --> @save');
	ROUTE('+GET     /api/projects/{id}/diff/',                                files_diff);
	ROUTE('+DELETE  /api/projects/{id}/diff/',                                files_diff_delete);
	ROUTE('+GET     /api/projects/{id}/changelogs/',                          changelogs);
	ROUTE('+GET     /api/projects/timespent/',                                timespent);
	ROUTE('+GET     /api/projects/{id}/modify/',                           	  files_modify);
	ROUTE('+GET     /api/projects/{id}/bundle/',                           	  makebundle, [10000]);
	ROUTE('+POST    /api/projects/{id}/wiki/              *Wiki               --> @save');
	ROUTE('+GET     /api/projects/{id}/localize/          *Projects           --> @localize', [30000]);
	ROUTE('+GET     /api/projects/discover/',                                 autodiscover);
	ROUTE('GET      /wiki/{id}/                           *Wiki               --> @read');

	ROUTE('+POST    /api/database/pg/                     *DBCommand          --> @exec', [10000]);

	// Branches
	ROUTE('+GET     /api/branches/{id}/                   *Branches           --> @query');
	ROUTE('+POST    /api/branches/{id}/                   *Branches           --> @save', [10000]);

	// Chat
	ROUTE('+GET     /api/chat/                            *Chat               --> @query');
	ROUTE('+POST    /api/chat/                            *Chat               --> @insert');
	ROUTE('+GET     /api/chat/users/                      *Chat               --> @users');

	// Clipboard
	ROUTE('+GET     /api/clipboard/                        *Clipboard         --> @get');
	ROUTE('+POST    /api/clipboard/                        *Clipboard         --> @save');

	// Other
	ROUTE('+GET     /api/templates/{id}/',                                    template);
	ROUTE('+GET     /api/download/{id}/',                                     files_download);
	ROUTE('+GET     /api/metainfo/{id}/',                                     files_metainfo);
	ROUTE('+POST    /api/files/minify/                     *Minify           --> @exec');
	ROUTE('+GET     /logout/',                                                redirect_logout);

	ROUTE('+GET    /api/users/online/',                                       users_online);
	ROUTE('+GET    /api/users/refresh/',                                      users_refresh);
	ROUTE('+GET    /api/users/export/',                                       users_export);
	ROUTE('+GET    /api/common/directories/',                                 directories);
	ROUTE('+GET    /api/common/uid/',                                         custom_uid);
	ROUTE('+GET    /api/common/uid16/',                                       custom_uid16);
	ROUTE('+GET    /api/common/ip/',                                          custom_ip);
	ROUTE('+GET    /api/common/ipserver/',                                    custom_ipsever);
	ROUTE('+POST   /api/common/encrypt/                   *Encoder            --> @exec');
	ROUTE('+GET    /api/componentator/download/           *Componentator      --> @download');
	ROUTE('+POST   /api/common/ping/                      *Hosts              --> @ping', [10000]);
	ROUTE('+POST   /api/common/resolve/                   *Hosts              --> @resolve', [10000]);

	ROUTE('+POST   /api/request/',                                            makerequest, [20000]);
	ROUTE('+GET    /api/request/{id}/',                                       makerequestscript, [20000]);

	ROUTE('+GET    /api/external/bundles/                 *ExternalBundle     --> @query');
	ROUTE('+POST   /api/external/bundles/{id}/            *ExternalBundle     --> @save', [4000]);
	ROUTE('+GET    /api/external/packages/                *ExternalPackage    --> @query');
	ROUTE('+POST   /api/external/packages/{id}/           *ExternalPackage    --> @save', [4000]);
	ROUTE('+GET    /api/external/templates/               *ExternalTemplate   --> @query');
	ROUTE('+POST   /api/external/templates/{id}/          *ExternalTemplate   --> @save', [4000]);
	ROUTE('+GET    /api/external/modules/                 *ExternalModule     --> @query');
	ROUTE('+POST   /api/external/modules/{id}/            *ExternalModule     --> @save', [4000]);
	ROUTE('+GET    /api/external/definitions/             *ExternalDefinition --> @query');
	ROUTE('+POST   /api/external/definitions/{id}/        *ExternalDefinition --> @save', [4000]);
	ROUTE('+GET    /api/external/schemas/                 *ExternalSchema     --> @query');
	ROUTE('+POST   /api/external/schemas/{id}/            *ExternalSchema     --> @save', [4000]);
	ROUTE('+GET    /api/external/operations/              *ExternalOperation  --> @query');
	ROUTE('+POST   /api/external/operations/{id}/         *ExternalOperation  --> @save', [4000]);

	ROUTE('-POST    /api/login/                           *Login              --> @save');
	ROUTE('-POST    /api/sign/                            *Users              --> @create');

	// Ping
	ROUTE('GET      /ping/', ping, ['cors']);
};

function ping() {
	this.json({ version: MAIN.version });
}

function redirect_logout() {
	var self = this;
	MAIN.session.remove(self.sessionid);
	self.cookie(CONF.cookie, '', '-1 day');
	self.redirect('/');
}

function files_open(id) {
	var self = this;
	self.id = id;
	self.$workflow('edit', self.query, function(err, data) {
		if (err)
			self.invalid(err);
		else
			self.plain(data);
	});
}

function files_translate(id) {
	var self = this;
	self.id = id;
	self.$workflow('translate', self.query, function(err, data) {
		if (err)
			self.invalid(err);
		else
			self.plain(data);
	});
}

function files_logfile(id) {
	var self = this;
	self.id = id;
	self.$workflow('logfile', self.query, function(err, data) {
		if (err)
			self.invalid(err);
		else
			self.plain(data);
	});
}

function files_diff(id) {
	var self = this;
	var project = MAIN.projects.findItem('id', id);
	if (project == null) {
		self.invalid('error-project');
		return;
	}

	Fs.readFile(MAIN.diffpath(project, Path.join(project.path, self.query.path)), function(err, data) {
		self.content((data ? data.toString('utf8').trim() : null) || '[]', U.getContentType('json'));
	});
}

function files_diff_delete(id) {

	var self = this;
	var project = MAIN.projects.findItem('id', id);
	if (project == null) {
		self.invalid('error-project');
		return;
	}

	Fs.unlink(MAIN.diffpath(project, Path.join(project.path, self.query.path)), NOOP);
	self.success();
}

function files_restore(id) {
	var self = this;
	self.id = id;
	self.$workflow('restore', self.query, function(err, data) {
		if (err)
			self.invalid(err);
		else
			self.plain(data);
	});
}

function files_metainfo(id) {
	var self = this;
	var item = MAIN.projects.findItem('id', id);

	if (!item) {
		self.status = 400;
		self.invalid('error-project');
		return;
	}

	var path = self.query.path || '';
	var filename = Path.join(item.path, path);

	if (MAIN.authorize(item, self.user, path))
		Fs.lstat(filename, self.callback());
	else {
		self.status = 401;
		self.invalid('error-permissions');
	}
}

function files_download(id) {

	var self = this;
	var item = MAIN.projects.findItem('id', id);

	if (!item) {
		self.status = 400;
		self.invalid('error-project');
		return;
	}

	var path = self.query.path || '';

	if (MAIN.authorize(item, self.user, path)) {

		if (item.isexternal) {

			FUNC.external_download(item, path, function(err, response) {

				if (err) {
					$.invalid(err);
					return;
				}

				if (response.status >= 400) {
					$.invalid(response.status);
					return;
				}

				var ext = U.getExtension(path).toLowerCase();
				MAIN.log(self.user, 'files_read', item, path);
				PUBLISH('files_read', FUNC.tms(self, { path: path }, item));
				self.stream(U.getContentType(ext), response.stream, self.query.preview ? null : U.getName(path));
			});

			return;
		}

		var filename = Path.join(item.path, path);

		Fs.lstat(filename, function(err, stats) {

			if (err || stats.isDirectory()) {
				self.status = 400;
				self.invalid('error-file');
				return;
			}

			var ext = U.getExtension(filename).toLowerCase();
			var meta = {};

			MAIN.log(self.user, 'files_read', item, filename);
			PUBLISH('files_read', FUNC.tms(self, { filename: filename, path: item.path }, item));

			// Special
			if (ext === 'file' || ext === 'nosql-binary') {
				meta.start = 0;
				meta.end = 2000;
				Fs.createReadStream(filename, meta).on('data', function(buffer) {
					var data = buffer.toString('utf8');
					data = data.substring(0, data.lastIndexOf('}') + 1).parseJSON() || EMPTYOBJECT;
					meta.start = 2000;
					delete meta.end;
					self.stream(data.type || U.getExtension('unknown'), Fs.createReadStream(filename, meta), self.query.preview ? null : U.getName(data.name || 'unknown.bin'));
				}).on('end', function() {
					// Fallback
					!meta.start && self.throw404();
				});
			} else
				self.stream(U.getContentType(ext), Fs.createReadStream(filename, meta), self.query.preview ? null : U.getName(path));
		});

	} else {
		self.status = 401;
		self.invalid('error-permissions');
	}
}

function users_online() {

	var self = this;
	var arr = [];

	if (MAIN.ws && MAIN.ws.keys) {
		for (var i = 0; i < MAIN.ws.keys.length; i++) {
			var key = MAIN.ws.keys[i];
			var conn = MAIN.ws.connections[key];

			var item = {};

			var project = conn.code.projectid ? MAIN.projects.findItem('id', conn.code.projectid) : null;
			if (project)
				item.project = project.name + (conn.code.fileid || '');

			item.name = conn.user.name;
			item.ip = conn.ip;
			arr.push(item);
		}
	}

	self.json(arr);
}

function users_refresh() {
	var self = this;
	if (self.user.sa) {
		MAIN.send({ TYPE: 'refresh' });
		self.success();
	} else
		self.invalid('error-permissions');
}

function custom_uid() {
	this.plain(UID('custom'));
}

function custom_uid16() {
	this.plain(UID16('custom'));
}

function custom_ip() {
	this.plain(this.ip);
}

function custom_ipsever() {
	var self = this;

	if (self.query.projectid) {

		var project = MAIN.projects.findItem('id', self.query.projectid);
		if (!project) {
			self.invalid('error-project');
			return;
		}

		if (project.isexternal) {
			FUNC.external(project, 'ip', null, null, function(err, response) {
				if (err)
					self.invalid(err);
				else
					self.plain(response);
			});
			return;
		}
	}

	var opt = {};
	opt.url = 'https://ipecho.net/plain';
	opt.callback = function(err, response) {
		self.plain(response.body || 'undefined');
	};

	REQUEST(opt);
}

function files_changes(id) {

	var self = this;
	var builder = NOSQL(id + '_changes').find2();

	if (self.query.recent)
		builder.rule('doc.type===\'save\'||doc.type===\'save_sync\'');

	builder.take(self.query.recent ? 30 : 50).callback(function(err, response) {
		for (var i = 0; i < response.length; i++) {
			var item = response[i];
			var user = MAIN.users.findItem('id', item.userid);
			if (user)
				response[i].user = user.name;
		}
		self.json(response);
	});
}

function directories() {
	var self = this;
	var path = self.query.path || '/www/';
	Fs.readdir(path, READDIROPTIONS, function(err, list) {

		if (err) {
			self.json(EMPTYARRAY);
			return;
		}

		var arr = [];
		for (var i = 0; i < list.length; i++) {
			if (list[i].isDirectory())
				arr.push({ path: Path.join(path, list[i].name), name: list[i].name });
		}

		self.json(arr);
	});
}

function changelogs(id) {
	TABLE('changelog').find().take(100).where('projectid', id).callback(this.callback());
}

function template(id) {
	var self = this;
	Fs.readFile(PATH.public('templates/' + id + '.txt'), function(err, response) {
		if (err)
			self.invalid(err);
		else
			self.binary(response, 'text/plain');
	});
}

function makerequest() {

	var self = this;
	var lines = (self.body.body || '').split('\n');
	var builder = new RESTBuilder();
	var regmethod = /^(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEADER)\s?.*?/i;
	var regheader = /^[a-z0-9_\-.#]+:\s/i;
	var skip = { '//': 1, '==': 1, '--': 1 };
	var index = -1;
	var method = 'GET';
	var url = '';
	var data = '';

	for (var i = 0; i < lines.length; i++) {

		var line = lines[i].trim();

		if (skip[line.substring(0, 2)])
			continue;

		// Method + URL address
		if (regmethod.test(line)) {
			index = line.indexOf(' ');
			method = line.substring(0, index);
			url = line.substring(index + 1).trim();
			continue;
		}

		// Header
		if (regheader.test(line)) {
			index = line.indexOf(':');
			builder.header(line.substring(0, index).trim(), line.substring(index + 1).trim());
			continue;
		}

		if (line)
			data += (data ? '\n' : '') + line;
	}

	if (!url || !method) {
		self.invalid('error-invalid');
		return;
	}

	builder.url(url);
	builder.method(method);

	if (data && method !== 'GET') {
		if (data[0] === '{' || data[0] === '[' || data[0] === '"')
			builder.json(data);
		else
			builder.urlencoded(data);
	}

	var beg = Date.now();

	builder.exec(function(err, response, output) {
		output.url = method + ' ' + url;
		output.value = undefined;
		output.duration = Date.now() - beg;
		output.statustext = U.httpstatus(output.status);
		self.json(output);
	});
}

function makerequestscript(id) {
	var self = this;
	var project = MAIN.projects.findItem('id', id);
	if (project == null) {
		self.invalid('error-project');
		return;
	}

	if (!self.query.path) {
		self.invalid('error-path');
		return;
	}

	if (!project.allowscripts) {
		self.invalid('error-project-scripts');
		return;
	}

	var user = self.user;
	if (!user.sa) {
		if (project.users.indexOf(user.id) === -1) {
			self.invalid('error-permissions');
			return;
		}
		if (!MAIN.authorize(project, self.user, self.query.path)) {
			self.invalid('error-permissions');
			return;
		}
	}

	var meta = {};
	var beg = Date.now();
	var id = self.query.id;

	meta.childtimeout = setTimeout(function() {
		meta.child.kill(9);
	}, id ? (60000 * 30) : 19000);

	var ext = U.getExtension(self.query.path);
	var can = { js: 1, sh: 1 };

	if (!can[ext]) {
		self.invalid('error-permissions');
		return;
	}

	if (id) {

		self.success();

		MAIN.spawns[id] = meta.child = Spawn((ext === 'sh' ? 'bash' : 'node'), [Path.join(project.path, self.query.path)], { detached: true, cwd: project.path });
		meta.child.on('close', function() {
			delete MAIN.spawns[id];
			MAIN.send({ TYPE: 'spawn', id: id, body: '\n--END--\n' + (Date.now() - beg) + ' ms' }, user);
			clearTimeout(meta.childtimeout);
			meta = null;
		});

		meta.child.stdout.on('data', function(data) {
			MAIN.send({ TYPE: 'spawn', id: id, body: data.toString('utf8') }, user);
		});

		meta.child.stderr.on('data', function(data) {
			MAIN.send({ TYPE: 'spawn', id: id, body: data.toString('utf8'), error: true }, user);
		});

	} else {
		meta.child = Exec((ext === 'sh' ? 'bash ' : 'node ') + Path.join(project.path, self.query.path), function(err, stdout, stderr) {
			clearTimeout(meta.childtimeout);
			var data = {};
			data.response = stderr || stdout;
			data.duration = Date.now() - beg;
			self.json(data);
		});
	}
}

function timespent() {
	var self = this;
	if (!self.user.sa) {
		self.invalid('error-permissions');
		return;
	}

	var projects = [];
	var users = [];

	for (var i = 0; i < MAIN.projects.length; i++) {
		var project = MAIN.projects[i];
		project.time && projects.push({ id: project.id, name: project.name, time: project.time });
	}

	for (var i = 0; i < MAIN.users.length; i++) {
		var user = MAIN.users[i];
		users.push({ id: user.id, name: user.name });
	}

	self.json({ projects: projects, users: users });
}

function files_modify(id) {
	var self = this;
	var project = MAIN.projects.findItem('id', id);
	if (project == null) {
		self.invalid('error-project');
		return;
	}

	if (!self.query.path) {
		self.invalid('error-path');
		return;
	}

	var user = self.user;
	if (!user.sa) {
		if (project.users.indexOf(user.id) === -1) {
			self.invalid('error-permissions');
			return;
		}
		if (!MAIN.authorize(project, self.user, self.query.path)) {
			self.invalid('error-permissions');
			return;
		}
	}

	if (project.isexternal) {
		FUNC.external(project, 'modify', self.query.path, null, self.callback());
		return;
	}

	var dt = new Date();
	var filename = Path.join(project.path, self.query.path);
	Fs.utimes(filename, dt, dt, NOOP);

	if (self.query.sync) {
		var name = U.getName(self.query.path);
		var target = Path.join(project.pathsync, self.query.path);
		FUNC.mkdir(target.substring(0, target.length - name.length), function() {
			Fs.createReadStream(filename).on('error', NOOP).pipe(Fs.createWriteStream(target).on('error', NOOP));
			self.success('synchronized');
		});
	} else
		self.success();
}

function makebundle(id) {

	var self = this;
	var project = MAIN.projects.findItem('id', id);

	if (project == null) {
		self.invalid('error-project');
		return;
	}

	if (!project.allowbundle) {
		self.invalid('error-bundles');
		return;
	}

	var user = self.user;
	var path = '/.bundleignore';

	if (!user.sa) {
		if (project.users.indexOf(user.id) === -1) {
			self.invalid('error-permissions');
			return;
		}
	}

	var makebundle = function(err, data) {
		data = (data ? data.toString('utf8') : '').split('\n');
		data.push('/.git/*');
		data.push('/.src/*');
		data.push('/tmp/*');
		data.push('/logs/*');
		data.push('/bundles/*');
		data.push('/debug.js');
		data.push('/index.js');
		data.push('/license.txt');
		data.push('/LICENSE');
		data.push('/localization.resource');
		data.push('/debug.pid');
		data.push('/release.js');
		data.push('/package.json');
		data.push('/package-lock.json');
		data.push('/openplatform.json');
		data.push('/readme.md');
		data.push('/bundle.json');
		data.push('/config');
		data.push('/debug.js.json');
		data.push('/release.js.json');
		data.push('/index.js.json');
		data.push('/bundle.sh');
		data.push('/config-release');
		data.push('/config-debug');
		data.push('/app.bundle');
		data.push('/.bundlesignore');
		data.push('/.bundleignore');
		data.push('/.gitignore');
		data.push('/.npmignore');
		data.push('/*.socket');
		data.push('/*.todo');
		data.push('/*.sql');
		data.push('/*.pid');
		data.push('/*.bundle');
		data.push('/*.overloaded');

		var ignore = FUNC.makeignore(data);
		var filename = Path.join(project.path, 'app.bundle');
		if (filename.toLowerCase().lastIndexOf('.bundle') === -1)
			filename += '.bundle';

		BACKUP(filename, project.path, function(err) {
			if (err)
				self.invalid(err);
			else {
				// Synchronize
				if (self.xhr) {
					FUNC.mkdir(Path.join(project.pathsync, 'bundles'), function() {
						Fs.rename(filename, Path.join(project.pathsync, 'bundles/app.bundle'), self.done());
					});
				} else
					self.file('~' + filename, 'app.bundle', null, () => Fs.unlink(filename, NOOP));
			}
		}, function(path, is) {

			if (is) {
				var index = path.indexOf('/databases/');
				if (index !== -1 && path.indexOf('/', index + 12) !== -1)
					return false;
			}

			return path === '/' || (ignore(path) === true);
		});
	};

	Fs.readFile(Path.join(project.path, path), function(err, data) {
		if (err)
			Fs.readFile(Path.join(project.path, '/.bundlesignore'), makebundle);
		else
			makebundle(err, data);
	});
}

function users_export() {

	var self = this;

	if (!self.user.sa) {
		self.invalid('error-permissions');
		return;
	}

	var arr = [];

	for (var i = 0; i < MAIN.users.length; i++) {
		var user = MAIN.users[i];
		if (!user.blocked)
			arr.push({ id: user.id, name: user.name, email: user.email, phone: user.phone, position: user.position, password: 'sha256:' + user.password, sa: user.sa, darkmode: user.darkmode, localsave: user.localsave });
	}

	self.json(arr);
}

function autodiscover() {
	var self = this;
	if (self.user.sa) {
		self.success(true);
		FUNC.autodiscover();
	} else
		self.invalid('error-permissions');
}