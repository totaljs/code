const Fs = require('fs');
const Promisify = require('util').promisify;

const ReadFile = Promisify(Fs.readFile);
const WriteFile = Promisify(Fs.writeFile);
const Stat = Promisify(Fs.stat);
const Exec = Promisify(require('child_process').exec);

NEWSCHEMA('Docker', function(schema) {

	schema.define('id', 'String', true);
	schema.define('type', ['start', 'stop', 'restart'], true);

	schema.action('read', {
		name: 'Read docker information',
		action: async function($) {

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

			$.callback({ stats: item.stats, items: apps });
		}
	});

	schema.action('exec', {
		name: 'Exec docker operation',
		action: async function($) {

			if (!CONF.folder_npm || !CONF.folder_www) {
				$.invalid('@(Docker engine is not activated)');
				return;
			}

			var item = MAIN.projects.findItem('id', $.model.id);
			if (!item) {
				$.invalid('error-project');
				return;
			}

			if ($.model.type === 'restart') {

				if (!item.running) {
					$.invalid('@(Docker container is not running)');
					return;
				}

				if (!item.stats || !item.stats.id) {
					$.invalid('@(Try it a bit later to obtain the container ID)');
					return;
				}

				Exec('docker restart {0}'.format(item.stats.id), $.done());
				return;
			}

			PATH.unlink(item.path + 'logs/debug.log');

			var done = async function() {

				var start = $.model.type === 'start';
				var filename = PATH.join(item.path, 'index.yaml');

				try {
					await FUNC.preparedockerfile(item, start);
					item.running = false;
					await Exec('docker compose{3} -f {0} {1}'.format(filename, start ? 'up -d' : 'down', item.customdocker ? ' --build' : ''));
					if (item.running !== start) {
						item.running = start;
						MAIN.save(2);
					}
					$.success();
				} catch(e) {
					$.invalid(e);
				}
			};

			if ($.model.type === 'start') {
				let filename = PATH.join(item.path, 'index.js');
				try {
					await Stat(filename);
				} catch (e) {
					await WriteFile(filename, `// Total.js start script\n// https://www.totaljs.com\n\nvar type = process.argv.indexOf('--release', 1) !== -1 ? 'release' : 'debug';
require('total4/' + type)({});`);
				}
				done();
			} else
				done();
		}
	});

});

function stats() {

	if (!CONF.folder_npm || !CONF.folder_www)
		return;

	SHELL('docker stats --no-stream --format "table {{.ID}}\t{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"', function(err, response) {

		var toMB = function(val, unit) {
			return unit === 'gib' ? (val * 1000).floor(3) : unit === 'kb' ? (val / 1024).floor(3) : val;
		};

		var is = false;

		response.parseTerminal(function(line, index) {

			if (!index)
				return;

			var unit = '';
			var cpu = line[2].parseFloat();
			var mem = line[3];
			var net = line[6];

			unit = mem.replace(/[0-9.]/g, '').toLowerCase();
			mem = toMB(mem.parseFloat2(), unit);
			unit = net.replace(/[0-9.]/g, '').toLowerCase();
			net = toMB(net.parseFloat2(), unit);

			var id = line[1] || '';

			if (id.indexOf('-') !== -1)
				id = id.split('-')[1] || '';

			var project = MAIN.projects.findItem('id', id);

			if (project) {
				project.stats = { id: line[0], cpu: cpu, mem: mem, net: net };
				is = true;
			}

		});

		is && MAIN.save();
		setTimeout(stats, 20000);
	});

}

FUNC.preparedockerfile = async function(item, run) {

	var host = item.url;
	var wwwfolder = item.path.replace('/www/www', CONF.folder_www);
	var nodemodules = CONF.folder_npm;
	var id = (CONF.uid ? (CONF.uid + '-') : '') + item.id;

	wwwfolder = wwwfolder[wwwfolder.length - 1] === '/' ? wwwfolder.substr(0, wwwfolder.length - 1) : wwwfolder;
	nodemodules = nodemodules[nodemodules.length - 1] === '/' ? nodemodules.substr(0, nodemodules.length - 1) : nodemodules;
	wwwfolder = wwwfolder.replace(/\/\//g, '/');
	nodemodules = nodemodules.replace(/\/\//g, '/');

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
	var model = {};
	model.value = { id: id, maxupload: item.maxupload || 50, host: host, npm: nodemodules, www: wwwfolder, certname: item.certname };
	content = Tangular.render(content.toString('utf8'), model);
	return WriteFile(filename, content);
};

ON('ready', stats);
