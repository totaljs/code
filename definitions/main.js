const Path = require('path');
const Fs = require('fs');

var MAIN = global.MAIN = {};

// Projects
MAIN.projects = [];
MAIN.projectsonline = {};

// Users
MAIN.users = [];
MAIN.usersonline = {};

MAIN.save = function(type) {

	MAIN.projects.quicksort('created', false);

	if (!type || type === 1)
		Fs.writeFile(F.path.databases('users.json'), JSON.stringify(MAIN.users), ERROR('users.json'));

	if (!type || type === 2)
		Fs.writeFile(F.path.databases('projects.json'), JSON.stringify(MAIN.projects), ERROR('projects.json'));
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

MAIN.backup = function(user, path, callback) {

	var name = U.getName(path);
	var target = path.substring(0, path.length - name.length);

	var dir = Path.join(CONF.backup, target);

	// Creates directories
	F.path.mkdir(dir);

	var ext = U.getExtension(name);
	var add = '-' + NOW.format('yyMMddHHmm') + '_' + user.id;

	if (ext)
		name = name.replace('.' + ext, add + '.' + ext);
	else
		name += add;

	// Copy files
	Fs.createReadStream(path).on('error', callback).pipe(Fs.createWriteStream(Path.join(dir, name))).on('error', callback).on('finish', callback);
};

MAIN.log = function(user, type, projectid, path) {
	if (typeof(projectid) === 'string')
		projectid = MAIN.projects.findItem('id', projectid);
	LOGGER(user.id, user.ip, type, projectid.name, path);
};

MAIN.change = function(type, user, project, path) {
	NOSQL(project.id + '_changes').insert({ type: type, userid: user.id, path: path, ip: user.ip, date: new Date() });
};

MAIN.changelog = function(user, project, path, removed) {
	TABLE('changelog').modify({ user: user.id, updated: new Date(), removed: removed === true }, true).where('projectid', project).where('path', path).insert(function(obj) {
		obj.projectid = project;
		obj.path = path;
	});
};

MAIN.send = function(msg) {
	MAIN.ws && MAIN.ws.send(msg);
};

Fs.readFile(F.path.databases('users.json'), function(err, data) {
	data && (MAIN.users = data.toString('utf8').parseJSON(true));
	for (var i = 0; i < MAIN.users.length; i++) {
		var user = MAIN.users[i];
		user.online = false;
		user.fileid = '';
		user.projectid = '';
		user.ts = 0;
		user.open = [];
	}
});

Fs.readFile(F.path.databases('projects.json'), function(err, data) {
	data && (MAIN.projects = data.toString('utf8').parseJSON(true));
	MAIN.projects.quicksort('created', false);
});
