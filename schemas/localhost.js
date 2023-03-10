const Fs = require('fs');
const Promisify = require('util').promisify;

const ReadFile = Promisify(Fs.readFile);
const WriteFile = Promisify(Fs.writeFile);
const Exec = Promisify(require('child_process').exec);

NEWSCHEMA('Localhost', function(schema) {

	schema.define('id', 'UID', true);
	schema.define('type', ['start', 'stop'], true);
	schema.define('iscustom', 'Boolean');

	schema.setRead(async function($) {

		if (!CONF.folder_npm || !CONF.folder_www) {
			$.invalid('Node modules folder is not set.');
			return;
		}

		var item = MAIN.projects.findItem('id', $.id);
		var filename = getfilename(item.path);

		PATH.mkdir(item.path);
		await copydockercompose(item.path, filename, item.url);

		try {
			var ps = await Exec('docker compose -f {0} ps --format json'.format(filename));
			PATH.unlink(filename);
		} catch (e) {
			$.invalid(e);
			return;
		}

		var apps = JSON.parse(ps.stdout);
		var appisonline = apps.filter(app => app.Image === 'totalplatform/run').length > 0;
		var customisonline = apps.filter(app => app.Image !== 'totalplatform/run').length > 0;

		$.callback({ app: appisonline, custom: customisonline, apps });
	});

	schema.setSave(async function($) {

		if (!CONF.folder_npm || !CONF.folder_www) {
			$.invalid('"node_modules" folder is not set');
			return;
		}

		var item = MAIN.projects.findItem('id', $.model.id);

		if ($.model.type === 'start')
			PATH.unlink(item.path + 'logs/debug.log');

		var done = async function() {
			var filename = getfilename(item.path, $.model.iscustom);

			if (!$.model.iscustom)
				await copydockercompose(item.path, filename, item.url);

			await Exec('docker compose -f {0} {1}'.format(filename, $.model.type === 'start' ? 'up -d' : 'down'));

			if (!$.model.iscustom)
				PATH.unlink(filename);

			$.success();
		};

		if ($.model.type === 'start')
			DOWNLOAD('https://cdn.totaljs.com/code/run.js', PATH.join(item.path, 'index.js'), done);
		else
			done();
	});

});

function getfilename(path, iscustom) {
	return path + (iscustom ? 'docker-compose.yaml' : 'app-compose.yaml');
}

async function copydockercompose(path, filename, host) {

	var wwwfolder = path.replace('/www/www', CONF.folder_www);
	var nodemodules = CONF.folder_npm;

	wwwfolder = wwwfolder[wwwfolder.length - 1] === '/' ? wwwfolder.substr(0, wwwfolder.length - 1) : wwwfolder;
	nodemodules = nodemodules[nodemodules.length - 1] === '/' ? nodemodules.substr(0, nodemodules.length - 1) : nodemodules;

	var islocalhost = host.indexOf('.localhost') !== -1;

	host = host.replace('http://', '').replace('https://', '');

	var content = await ReadFile(PATH.root(islocalhost ? 'app-compose.yaml' : 'app-compose-https.yaml'));
	content = content.toString('utf8').replace(/##HOST##/g, host).replace(/##FOLDER_NPM##/g, nodemodules).replace(/##FOLDER_WWW##/g, wwwfolder);

	return WriteFile(filename, content);
}