const USER = { id: 'api', name: 'API', sa: true };

NEWSCHEMA('API', function(schema) {

	schema.action('create', {
		name: 'Create',
		input: 'name:String,*url:String,*template:String,compose:Boolean,release:boolean',
		action: function($, model) {

			var url = model.url.replace(/^(http|https):\/\//gi, '').replace(/\//g, '');
			var path = '';

			if (url) {
				var arr = url.split('.');
				arr.reverse();
				var tmp = arr[1];
				arr[1] = arr[0];
				arr[0] = tmp;
				path = arr.join('-').replace('-', '_') + (path ? path.replace(/\//g, '--').replace(/--$/g, '') : '');
			}

			model.path = '/www/www/' + (path ? (path + '/') : '');

			var project = MAIN.projects.findItem('path', model.path);
			if (project) {
				$.invalid('@(URL address is already used)');
				return;
			}

			if (!model.name)
				model.name = path;

			model.backup = true;
			model.maxupload = 0;
			model.customdocker = model.compose == true;
			model.allowbundle = true;
			model.releasemode = model.release == true;

			var template = model.template;

			delete model.compose;
			delete model.release;
			delete model.template;

			CALL('Projects --> save', model).user(USER).callback(function(err, response) {

				if (err) {
					$.invalid(err);
					return;
				}

				model.id = response.value;
				var filename = model.path + '/template.zip';

				var done = function(err) {

					if (err) {
						$.invalid(err);
						return;
					}

					// Unpack
					CALL('FilesUnpack --> exec', { filename: 'template.zip' }).user(USER).params({ id: model.id }).callback(function(err) {

						if (err) {
							$.invalid(err);
							return;
						}

						F.Fs.unlink(filename, NOOP);

						// Run docker
						CALL('Docker --> exec', { id: model.id, type: 'start' }).callback($.done(model.id));

					});

				};

				// Download template
				if (template.indexOf('://') === -1)
					F.Fs.copyFile(template, filename, done);
				else
					DOWNLOAD(template, filename, done);

			});

		}
	});

	schema.action('restart', {
		name: 'Restart container',
		input: '*id:String',
		action: function($, model) {

			var item = MAIN.projects.findItem('id', model.id);
			if (!item)
				item = MAIN.projects.findItem('url', model.id);

			if (!item) {
				$.invalid('@(Project not found)');
				return;
			}

			CALL('Docker --> exec', { id: item.id, type: 'restart' }, $.done(item.id));
		}
	});

	schema.action('stop', {
		name: 'Stop container',
		input: '*id:String',
		action: function($, model) {

			var item = MAIN.projects.findItem('id', model.id);
			if (!item)
				item = MAIN.projects.findItem('url', model.id);

			if (!item) {
				$.invalid('@(Project not found)');
				return;
			}

			CALL('Docker --> exec', { id: item.id, type: 'stop' }, $.done(item.id));
		}
	});

	schema.action('list', {
		name: 'List of apps',
		action: function($) {
			var arr = [];
			MAIN.projects.wait(function(m, next) {

				var item = {};

				item.id = m.id;
				item.name = m.name;
				item.url = m.url;
				item.running = m.running;
				item.created = m.created;
				item.isexternal = m.isexternal;
				item.stats = m.stats;
				item.logfile = MAIN.logs[m.id];

				arr.push(item);
				next();

			}, () => $.callback(arr));
		}
	});

	schema.action('remove', {
		name: 'Remove app',
		input: '*id:String',
		action: function($, model) {

			var item = MAIN.projects.findItem('id', model.id);
			if (!item)
				item = MAIN.projects.findItem('url', model.id);

			if (!item) {
				$.invalid('@(Project not found)');
				return;
			}

			CALL('Projects --> remove').params({ id: item.id }).query({ remove: '1' }).user(USER).callback($.done(item.id));
		}
	});

});