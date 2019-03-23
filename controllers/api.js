const READDIROPTIONS = { withFileTypes: true };
const Path = require('path');
const Fs = require('fs');

exports.install = function() {
	GROUP(['authorize'], function() {

		ROUTE('GET     /api/{schema}/                         *{schema}     --> @query');
		ROUTE('GET     /api/{schema}/{id}/                    *{schema}     --> @read');
		ROUTE('POST    /api/{schema}/                         *{schema}     --> @save');
		ROUTE('DELETE  /api/{schema}/{id}/                    *{schema}     --> @remove');
		ROUTE('POST    /api/{schema}/{id}/                    *{schema}     --> @save');

		// Files
		ROUTE('POST    /api/files/{id}/rename/                *FilesRename  --> @exec');
		ROUTE('POST    /api/files/{id}/remove/                *FilesRemove  --> @exec');
		ROUTE('POST    /api/files/{id}/create/                *FilesCreate  --> @exec');

		// Projects
		ROUTE('POST    /api/projects/{id}/tasks/              *Tasks        --> @insert');
		ROUTE('GET     /api/projects/{id}/tasks/              *Tasks        --> @query');
		ROUTE('GET     /api/projects/{id}/tasks/{taskid}/     *Tasks        --> @solved');
		ROUTE('GET     /api/projects/{id}/tasks/uncomplete/   *Tasks        --> @uncomplete');
		ROUTE('GET     /api/projects/{id}/changelog/          *Files        --> @changelog');
		ROUTE('POST    /api/projects/{id}/comments/           *Comments     --> @insert');
		ROUTE('GET     /api/projects/{id}/comments/           *Comments     --> @query');
		ROUTE('POST    /api/projects/{id}/upload/             *FilesUpload  --> @exec', ['upload'], 1024 * 50);
		ROUTE('GET     /api/projects/{id}/files/              *Projects     --> @files');
		ROUTE('GET     /api/projects/{id}/backups/            *Projects     --> @backups');
		ROUTE('DELETE  /api/projects/{id}/backups/            *Projects     --> @backupsclear', [10000]);
		ROUTE('GET     /api/projects/{id}/logfile/            *Projects',   files_logfile);
		ROUTE('GET     /api/projects/{id}/restore/            *Projects',   files_restore);
		ROUTE('GET     /api/projects/{id}/edit/               *Projects',   files_open);
		ROUTE('GET     /api/projects/{id}/translate/          *Projects',   files_translate);
		ROUTE('GET     /api/projects/{id}/changes/            *Projects',   files_changes);
		ROUTE('GET     /api/projects/{id}/changelogs/',                     changelogs);

		// Other
		ROUTE('GET     /api/download/{id}/',                                files_download);
		ROUTE('POST    /api/files/minify/                     *Minify',     files_minify);
		ROUTE('GET     /logout/', redirect_logout);

		ROUTE('GET    /api/users/online/',                                  users_online);
		ROUTE('GET    /api/users/refresh/',                                 users_refresh);
		ROUTE('GET    /api/common/directories/',                            directories);
		ROUTE('GET    /api/common/uid/',                                    custom_uid);
		ROUTE('GET    /api/common/ip/',                                     custom_ip);
		ROUTE('POST   /api/common/encrypt/                   *Encoder       --> @exec');
		ROUTE('GET    /api/componentator/download/           *Componentator --> @download');

	});

	GROUP(['unauthorize'], function() {
		ROUTE('POST    /api/login/                    *Login        --> @save');
	});

};

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

function files_download(id) {

	var self = this;
	var item = MAIN.projects.findItem('id', id);

	if (!item) {
		self.status = 400;
		self.invalid('error-project');
		return;
	}

	var path = self.query.path || '';
	var filename = Path.join(item.path, path);

	if (MAIN.authorize(item, self.user, path)) {
		Fs.lstat(filename, function(err, stats) {

			if (err || stats.isDirectory()) {
				self.status = 400;
				self.invalid('error-file');
				return;
			}

			var ext = U.getExtension(filename).toLowerCase();
			var meta = {};

			MAIN.log(self.user, 'files_read', item, filename);

			// Special
			if (ext === 'file' || ext === 'nosql-binary') {
				meta.start = 0;
				meta.end = 2000;
				Fs.createReadStream(filename, meta).on('data', function(buffer) {
					var data = buffer.toString('utf8');
					data = data.substring(0, data.lastIndexOf('}') + 1).parseJSON();
					meta.start = 2000;
					delete meta.end;
					self.stream(data.type, Fs.createReadStream(filename, meta));
				}).on('end', function() {
					// Fallback
					!meta.start && self.throw404();
				});
			} else
				self.stream(U.getContentType(ext), Fs.createReadStream(filename, meta));

		});
	} else {
		self.status = 401;
		self.invalid('error-permissions');
	}
}

function users_online() {

	var self = this;
	var arr = [];

	for (var i = 0; i < MAIN.users.length; i++) {
		var user = MAIN.users[i];
		if (user.online) {
			var item = {};
			var project = MAIN.projects.findItem('id', user.projectid);
			if (project)
				item.project = project.name + (user.fileid || '');
			item.name = user.name;
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

function files_minify() {
	var self = this;
	self.body.$workflow('exec', (err, response) => self.plain(response || ''));
}

function custom_uid() {
	this.plain(UID('custom'));
}

function custom_ip() {
	this.plain(this.ip);
}

function files_changes(id) {
	var self = this;
	NOSQL(id + '_changes').find2().take(50).callback(function(err, response) {
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