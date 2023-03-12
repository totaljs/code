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
			$.invalid('Node modules folder is not set.');
			return;
		}

		var item = MAIN.projects.findItem('id', $.id);
		if (!item) {
			$.invalid('error-project');
			return;
		}

		var filename = PATH.join(item.path, 'index.yaml');
		await FUNC.preparedockerfile(item);

		try {
			var ps = await Exec('docker compose -f {0} ps --format json'.format(filename));
			// PATH.unlink(filename);
		} catch (e) {
			$.invalid(e);
			return;
		}

		var apps = JSON.parse(ps.stdout);
		$.callback(apps);
	});

	schema.setSave(async function($) {

		if (!CONF.folder_npm || !CONF.folder_www) {
			$.invalid('"node_modules" folder is not set');
			return;
		}

		var item = MAIN.projects.findItem('id', $.model.id);
		if (!item) {
			$.invalid('error-project');
			return;
		}

		PATH.unlink(item.path + 'logs/debug.log');

		var done = async function() {
			var filename = PATH.join(item.path, 'index.yaml');
			await FUNC.preparedockerfile(item);
			try {
				await Exec('docker compose -f {0} {1}'.format(filename, $.model.type === 'start' ? 'up -d' : 'down'));
				// PATH.unlink(filename);
			} finally {
				$.success();
			}
		};

		if ($.model.type === 'start')
			DOWNLOAD('https://cdn.totaljs.com/code/run.js', PATH.join(item.path, 'index.js'), done);
		else
			done();
	});

});

FUNC.preparedockerfile = async function(item) {

	var host = item.url;
	var wwwfolder = item.path.replace('/www/www', CONF.folder_www);
	var nodemodules = CONF.folder_npm;

	wwwfolder = wwwfolder[wwwfolder.length - 1] === '/' ? wwwfolder.substr(0, wwwfolder.length - 1) : wwwfolder;
	nodemodules = nodemodules[nodemodules.length - 1] === '/' ? nodemodules.substr(0, nodemodules.length - 1) : nodemodules;

	var islocalhost = host.indexOf('.localhost') !== -1;
	var filename = PATH.join(item.path, 'index.yaml');

	host = host.replace('http://', '').replace('https://', '');

	var path = item.customdocker ? PATH.join(item.path, 'docker-compose.yaml') : PATH.root((islocalhost ? 'app-compose{0}.yaml' : 'app-compose-https{0}.yaml').format(item.releasemode ? '-release' : ''));

	var content = await ReadFile(path);
	content = content.toString('utf8').replace(/##MAXUPLOAD##/g, item.maxupload || 50).replace(/##HOST##/g, host).replace(/##FOLDER_NPM##/g, nodemodules).replace(/##FOLDER_WWW##/g, wwwfolder);
	return WriteFile(filename, content);
};