const Fs = require('fs');
const Promisify = require('util').promisify;

const ReadFile = Promisify(Fs.readFile);
const WriteFile = Promisify(Fs.writeFile);
const Exec = Promisify(require('child_process').exec);

NEWSCHEMA('Localhost', function(schema) {

	schema.define('id', 'UID', true);
	schema.define('type', ['start', 'stop'], true);

	schema.setRead(async function($) {

		if (!CONF.folder_npm || !CONF.folder_www) {
			$.invalid('@(Docker engine is not activated)');
			return;
		}

		var item = MAIN.projects.findItem('id', $.id);
		if (!item) {
			$.invalid('error-project');
			return;
		}

		var filename = PATH.join(item.path, 'index.yaml');
		await FUNC.preparedockerfile(item);

		item.running = false;

		try {
			var ps = await Exec('docker compose -f {0} ps --format json'.format(filename));
		} catch (e) {
			$.invalid(e);
			return;
		}

		var apps = JSON.parse(ps.stdout);
		var is = apps.length > 0;
		if (item.running !== is) {
			item.running = is;
			MAIN.save(2);
		}

		$.callback(apps);
	});

	schema.setSave(async function($) {

		if (!CONF.folder_npm || !CONF.folder_www) {
			$.invalid('@(Docker engine is not activated)');
			return;
		}

		var item = MAIN.projects.findItem('id', $.model.id);
		if (!item) {
			$.invalid('error-project');
			return;
		}

		PATH.unlink(item.path + 'logs/debug.log');

		var done = async function() {

			var start = $.model.type === 'start';
			var filename = PATH.join(item.path, 'index.yaml');

			try {
				await FUNC.preparedockerfile(item, start);
				item.running = false;
				await Exec('docker compose -f {0} {1}'.format(filename, start ? 'up -d' : 'down'));
				if (item.running !== start) {
					item.running = start;
					MAIN.save(2);
				}
			} finally {
				$.success();
			}
		};

		if ($.model.type === 'start') {
			await WriteFile(PATH.join(item.path, 'index.js'), `// Total.js start script\n// https://www.totaljs.com\n\nvar type = process.argv.indexOf('--release', 1) !== -1 ? 'release' : 'debug';
require('total4/' + type)({});`);
			done();
		} else
			done();
	});

});

FUNC.preparedockerfile = async function(item, run) {

	var host = item.url;
	var wwwfolder = item.path.replace('/www/www', CONF.folder_www);
	var nodemodules = CONF.folder_npm;

	wwwfolder = wwwfolder[wwwfolder.length - 1] === '/' ? wwwfolder.substr(0, wwwfolder.length - 1) : wwwfolder;
	nodemodules = nodemodules[nodemodules.length - 1] === '/' ? nodemodules.substr(0, nodemodules.length - 1) : nodemodules;

	var islocalhost = host.indexOf('.localhost') !== -1;
	var filename = PATH.join(item.path, 'index.yaml');

	host = host.replace('http://', '').replace('https://', '');

	var path = item.customdocker ? PATH.join(item.path, 'docker-compose.yaml') : PATH.root((islocalhost ? 'app-compose.yaml' : 'app-compose-https.yaml'));
	var content;

	if (run && !item.customdocker) {
		var package = PATH.join(item.path, 'package.json');
		try {
			content = await ReadFile(package);
			content = content.toString('utf8').parseJSON();
			if (!content.scripts)
				content.scripts = {};
			content.scripts.start = 'node index.js 8000' + (item.releasemode ? ' --release' : '');
			await WriteFile(package, JSON.stringify(content, null, '\t'));
		} catch (e) {
			// create new
			await WriteFile(package, JSON.stringify({ name: item.name.slug(), version: '1.0.0', scripts: { start: 'node index.js 8000' + (item.releasemode ? ' --release' : '') }}, null, '\t'));
		}
	}

	content = await ReadFile(path);
	content = content.toString('utf8').replace(/##ID##/g, item.id).replace(/##MAXUPLOAD##/g, item.maxupload || 50).replace(/##HOST##/g, host).replace(/##FOLDER_NPM##/g, nodemodules).replace(/##FOLDER_WWW##/g, wwwfolder);
	return WriteFile(filename, content);
};