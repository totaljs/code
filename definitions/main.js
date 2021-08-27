const Path = require('path');
const Fs = require('fs');

MAIN.version = '1.7.0';

// Projects
MAIN.projects = [];
MAIN.projectsonline = {};
MAIN.spawns = {};
MAIN.external = {};

// Users
MAIN.users = [];
MAIN.usersonline = {};

MAIN.session = SESSION();
MAIN.session.ondata = function(meta, next) {
	var user = MAIN.users.findItem('id', meta.id);
	if (user)
		user.logged = NOW;
	next(null, !user || user.blocked ? null : user);
};

MAIN.save = function(type) {

	MAIN.projects.quicksort('created', false);

	if (!type || type === 1)
		Fs.writeFile(PATH.databases('users.json'), JSON.stringify(MAIN.users), ERROR('users.json'));

	if (!type || type === 2)
		Fs.writeFile(PATH.databases('projects.json'), JSON.stringify(MAIN.projects), ERROR('projects.json'));
};

MAIN.can = function(allowed, path) {

	for (var i = 0; i < allowed.length; i++) {

		var rule = allowed[i];
		var skip = rule[0] === '^';

		if (skip)
			rule = rule.substring(1);

		if (path.startsWith(rule) || path === rule.substring(0, path.length) || path.substring(0, rule.length) === rule)
			return !skip;
	}

	return false;
};

MAIN.authorize = function(project, user) {

	var allowed = [];
	var permissions = (project.permissions || '').split('\n');

	for (var i = 0; i < permissions.length; i++) {
		var permission = permissions[i].split(':').trim();
		if (permission[0] === user.id)
			allowed.push(permission[1]);
	}

	if (allowed.length)
		allowed.quicksort(false);
	else
		return true;

	for (var i = 2; i < arguments.length; i++) {
		if (!MAIN.can(allowed, arguments[i]))
			return false;
	}

	return true;
};

MAIN.backup = function(user, path, callback, project, changescount) {

	var name = U.getName(path);
	var target = path.substring(0, path.length - name.length);
	var dir;

	if (F.isWindows)
		dir = Path.join(CONF.backup, project.name, target.replace(project.path.replace('/', ''), ''));
	else
		dir = Path.join(CONF.backup, target);

	// Creates directories
	FUNC.mkdir(dir, function() {

		var ext = U.getExtension(name);
		var add = '-' + NOW.format('yyMMddHHmm') + '_' + user.id + '_' + (changescount || 0) + (project.branch ? ('_' + project.branch) : '');

		if (ext)
			name = name.replace('.' + ext, add + '.' + ext);
		else
			name += add;

		// Copy files
		Fs.createReadStream(path).on('error', callback).pipe(Fs.createWriteStream(Path.join(dir, name))).on('error', callback).on('finish', callback);
	});
};

MAIN.backup2 = function(user, path, callback, project, changescount) {

	var name = U.getName(path);
	var id = FUNC.external_path(project);
	var target = path.substring(0, path.length - name.length);
	var dir = Path.join(CONF.backup, id, target);

	// Creates directories
	FUNC.mkdir(dir, function() {

		var ext = U.getExtension(name);
		var add = '-' + NOW.format('yyMMddHHmm') + '_' + user.id + '_' + (changescount || 0) + (project.branch ? ('_' + project.branch) : '');

		if (ext)
			name = name.replace('.' + ext, add + '.' + ext);
		else
			name += add;

		FUNC.external_download(project, path, function(err, response) {

			if (err) {
				callback(err);
				return;
			}

			var writer = Fs.createWriteStream(Path.join(dir, name));
			response.stream.pipe(writer);
			CLEANUP(writer, callback);
		});

	});
};

MAIN.diffpath = function(project, path) {

	var name = U.getName(path);
	var target = path.substring(0, path.length - name.length);

	if (project.isexternal)
		target = FUNC.external_path(project, target);

	var dir;

	if (F.isWindows)
		dir = Path.join(CONF.backup, project.name, target.replace(project.path.replace('/', ''), ''));
	else
		dir = Path.join(CONF.backup, target);

	// Creates directories
	PATH.mkdir(dir);

	var ext = U.getExtension(name);
	var add = '.diff';

	if (ext)
		name = name.replace('.' + ext, add);
	else
		name += add;

	return Path.join(dir, name);
};

MAIN.diff = function(project, path, diff) {
	var filename = MAIN.diffpath(project, path);
	Fs.writeFile(filename, JSON.stringify(diff), ERROR('MAIN.diff'));
};

MAIN.log = function(user, type, projectid, path) {
	if (typeof(projectid) === 'string')
		projectid = MAIN.projects.findItem('id', projectid);
	LOGGER(user ? user.id : 'root', user ? user.ip : 'localhost', type, projectid.name, path);
};

MAIN.change = function(type, user, project, path, combo, time, changes) {
	NOSQL(project.id + '_changes').insert({ type: type, userid: user.id, path: path, ip: user.ip, combo: combo, time: time, date: new Date(), changes: changes });
};

MAIN.changelog = function(user, project, path, removed) {

	// We expect existing of the project
	var pro = MAIN.projects.findItem('id', project);
	var builder = TABLE('changelog').modify({ user: user.id, updated: new Date(), removed: removed === true }, true);

	builder.where('projectid', project);
	builder.where('path', path);
	pro.branch && builder.where('branch', pro.branch);

	builder.insert(function(obj) {
		obj.projectid = project;
		obj.path = path;
		obj.branch = pro.branch;
	});
};

MAIN.send = function(msg, user) {
	if (MAIN.ws) {
		if (user)
			MAIN.ws.send(msg, client => client.user === user);
		else
			MAIN.ws.send(msg);
	}
};

Fs.readFile(PATH.databases('users.json'), function(err, data) {

	data && (MAIN.users = data.toString('utf8').parseJSON(true));

	for (var i = 0; i < MAIN.users.length; i++) {

		var user = MAIN.users[i];
		user.online = false;
		user.fileid = '';
		user.projectid = '';
		user.ts = 0;
		user.open = [];

		if (!user.unread)
			continue;

		// Clears unread message from removed users
		var keys = Object.keys(user.unread);
		for (var j = 0; j < keys.length; j++) {
			var key = keys[j];
			if (key === user.id)
				delete user.unread[key];
			else if (!MAIN.users.findItem('id', key))
				delete user.unread[key];
		}
	}
});

Fs.readFile(PATH.databases('projects.json'), function(err, data) {
	data && (MAIN.projects = data.toString('utf8').parseJSON(true));
	MAIN.projects.quicksort('created', false);
});

ON('ready', function() {

	if (!PREF.token)
		PREF.set('token', '1234567890');

	// Added permissions
	Fs.chmod(PATH.databases(), 0o700, NOOP);
	Fs.chmod(PATH.databases('branch_backup.sh'), 0o700, NOOP);
	Fs.chmod(PATH.databases('branch_restore.sh'), 0o700, NOOP);
	Fs.chmod(PATH.databases('source_backup.sh'), 0o700, NOOP);

	if (PREF.name)
		CONF.name = PREF.name;
});