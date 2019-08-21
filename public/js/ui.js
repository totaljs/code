COMPONENT('editor', function(self, config) {

	var editor = null;
	var skip = false;
	var markers = {};
	var fn = {};
	var autocomplete;
	var lorem = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'.split(' ');
	var HSM = { annotateScrollbar: true, delay: 100 };
	var cache_lines = null;
	var cache_lines_skip = false;
	var cache_diffs = {};
	var cache_diffs_checksum = 0;
	var cache_users = {};
	var checksum = -1;

	fn.lastIndexOf = function(str, chfrom) {
		for (var i = chfrom; i > 0; i--) {
			var c = str.substring(i - 1, i);
			for (var j = 1; j < arguments.length; j++)
				if (c === arguments[j])
					return i;
		}
		return 0;
	};

	self.difflines = function() {
		var arr = [];
		var tmp = Object.keys(cache_diffs);
		for (var i = 0; i < tmp.length; i++)
			arr.push((+tmp[i]) + 1);
		arr.quicksort();
		return arr;
	};

	self.getter = null;
	self.bindvisible();
	self.nocompile && self.nocompile();

	self.clearmarkers = function() {
		var m = editor.doc.getAllMarks();
		for (var i = 0; i < m.length; i++)
			m[i].clear();
		markers = {};
	};

	self.reload = function() {
		editor.refresh();
	};

	self.validate = function(value) {
		return (config.disabled || !config.required ? true : value && value.length > 0) === true;
	};

	self.insert = function(value) {
		editor.replaceSelection(value);
		self.change(true);
	};

	self.resize = function() {
		var h = $('#content').css('height').parseInt();
		self.find('.CodeMirror').css('height', h);
	};

	self.gotoline = function(line, ch) {
		var cur = { line: line, ch: ch || 0 };
		var t = editor.charCoords(cur, 'local').top;
		var mid = editor.getScrollerElement().offsetHeight / 2;
		cur.line--;
		editor.setCursor(cur);
		editor.scrollTo(null, t - mid - 5);
		editor.focus();
	};

	self.configure = function(key, value, init) {
		if (init)
			return;

		switch (key) {
			case 'powermode':
				editor.setOption('blastCode', value ? true : false);
				break;
			case 'mode':
				editor.setOption('mode', value);
				editor.setOption('lint', value === 'javascript' || value === 'xml' || value === 'totaljs' || value === 'html' ? { esversion: 6, expr: true, evil: true, unused: true, shadow: true } : false);
				editor.setOption('matchBrackets', value !== 'todo');
				editor.setOption('highlightSelectionMatches', value !== 'todo' ? HSM : false);
				break;
			case 'disabled':
				self.tclass('ui-disabled', value);
				editor.setOption('readOnly', value);
				editor.refresh();
				break;
		}
	};

	var GutterDiff = function() {
		var marker = document.createElement('div');
		var css = marker.style;
		css.color = '#3ed853';
		marker.className = 'cm-diff';
		marker.innerHTML = '+';
		return marker;
	};

	self.restore = function(value) {

		var current = editor.getValue().split('\n');
		var lines = value.split('\n');

		editor.setValue(value);
		self.diffgutterclear();

		for (var i = 0; i < lines.length; i++) {
			if (lines[i] !== current[i])
				self.diffgutter(i);
		}
	};

	self.diffgutterclear = function() {
		editor.doc.clearGutter('GutterDiff');
		cache_lines = editor.getValue().split('\n');
		cache_diffs = {};
		cache_diffs_checksum = 0;
	};

	self.diffuserclear = function() {
		editor.doc.clearGutter('GutterUser');
		cache_users = {};
	};

	var cache_diffs_interval = null;
	var cache_diffs_sum = function() {
		cache_diffs_interval = null;
		cache_diffs_checksum = HASH(cache_diffs);

		// because of prerender_colors:
		checksum = -1;
	};

	self.diffgutter = function(line, nullable) {
		var key = line + '';

		if (nullable)
			delete cache_diffs[key];
		else
			cache_diffs[key] = 1;

		cache_diffs_interval && clearTimeout(cache_diffs_interval);
		cache_diffs_interval = setTimeout(cache_diffs_sum, 200);
		editor.setGutterMarker(line, 'GutterDiff', nullable ? null : GutterDiff());

		var info = editor.lineInfo(line);
		var key = line + '';

		if (nullable) {
			// restore previous user
			var prev = cache_users[key];
			if (prev) {
				editor.setGutterMarker(line, 'GutterUser', prev.el);
				delete cache_users[key];
			} else if (!info || !info.text)
				editor.setGutterMarker(line, 'GutterUser', null);

		} else if (info && info.text) {

			var usr = user;
			if (code.SYNCUSER && code.SYNCUSER !== user.id) {
				usr = code.data.users.findItem('id', code.SYNCUSER);
				if (usr == null)
					return;
			}

			if (!cache_users[key])
				cache_users[key] = { el: info.gutterMarkers.GutterUser ? info.gutterMarkers.GutterUser.cloneNode(true) : null };

			self.diffuser(line, usr.id, usr.name, NOW);
		} else
			editor.setGutterMarker(line, 'GutterUser', null);
	};

	var GutterUser = function(userid, username, updated) {
		var marker = document.createElement('div');
		var css = marker.style;
		var usercolor = FUNC.usercolor(username);
		css['background-color'] = usercolor.color;
		marker.className = 'cm-diff-user';
		marker.setAttribute('data-title', usercolor.name + ': ' + Thelpers.time(updated));
		marker.setAttribute('data-userid', userid);
		marker.setAttribute('data-date', updated.getTime());
		marker.innerHTML = usercolor.initials;
		return marker;
	};

	self.diffuser = function(line, userid, name, updated) {
		editor.setGutterMarker(line, 'GutterUser', name ? GutterUser(userid, name, updated) : null);
	};

	self.make = function() {

		self.html('<div class="ui-editor"></div>');
		var container = self.find('.ui-editor');

		var shortcut = function(name) {
			return function() {
				EXEC(config.shortcut, name);
			};
		};

		var tabulator = function() {

			var cm = editor;
			var cur = cm.getCursor();
			var line = cm.getLine(cur.line);
			var loremcount = 0;
			var end = line.substring(cur.ch);

			line.substring(0, cur.ch).replace(/lorem\d+$/i, function(text) {
				loremcount = +text.match(/\d+/)[0];
				cur.ch -= text.length;
				return '';
			});

			if (loremcount) {
				var builder = lorem.slice(0, loremcount).join(' ').replace(/(,|\.)$/, '');
				cm.replaceRange(builder + (end || ''), { line: cur.line, ch: cur.ch }, { line: cur.line, ch: cur.cr });
				cm.doc.setCursor({ line: cur.line, ch: cur.ch + builder.length });
				return;
			}

			if (config.mode === 'totaljs' || config.mode === 'html') {

				var index = fn.lastIndexOf(line, cur.ch, '\t', '>', ' ');
				if (index === -1)
					return CodeMirror.Pass;

				var html = line.substring(index, cur.ch);
				if ((/(div|ul|address|li|span|table|strong|em|b|i|a|h|p|img|td|tr|th|hr|br|thead|tfoot|tbody|section|figure|section)+(\.[a-z0-9-_])*/).test(html) || (/(^|\s)\.[a-z0-9-_]*/).test(html)) {
					var cls = html.split('.');
					if (!cls[0]) {
						if (cls[1].substring(0, 2) === 'fa')
							cls[0] = 'i';
						else
							cls[0] = 'div';
					}
					var tag = cls[0] === 'hr' || cls[0] === 'br' ? '<{0} />'.format(cls[0]) : cls[0] === 'img' ? '<img src="" alt="" />' : ('<{0}{1}></{0}>'.format(cls[0], cls[1] ? (' class="' + cls[1] + '"') : ''));
					cm.replaceRange(line.substring(0, index) + tag + line.substring(cur.ch), { line: cur.line, ch: 0 }, { line: cur.line, ch: cur.cr });
					cm.doc.setCursor({ line: cur.line, ch: index + (cls[0] === 'img' ? (tag.indexOf('"') + 1) : (tag.indexOf('>') + 1)) });
					return;
				}
			}

			return CodeMirror.Pass;
		};

		self.todo_done = function() {

			var cursor = editor.getCursor();
			var current = editor.getLine(cursor.line);

			if (!current.match(/^(\s)*-\s/))
				return;

			var done = current.match(/@done(\(.*?\))?/gi);
			if (done)
				editor.doc.replaceRange(current.replace(done, '').replace(/\s+$/, ''), { line: cursor.line, ch: 0 }, { line: cursor.line, ch: current.length });
			else
				editor.doc.replaceRange(current.replace(/@(canceled|working)(\(.*?\))?/gi, '').replace(/\s+$/, '') + ' @done' + (user.istimestamp ? ('(' + NOW.format(user.format || 'yyyy-MM-dd') + ')') : ''), { line: cursor.line, ch: 0 }, { line: cursor.line, ch: current.length });

			return false;
		};

		var findmatch = function() {

			if (config.mode === 'todo') {
				self.todo_done();
				return;
			}

			var sel = editor.getSelections()[0];
			var cur = editor.getCursor();
			var count = editor.lineCount();
			var before = editor.getLine(cur.line).substring(cur.ch, cur.ch + sel.length) === sel;
			var beg = cur.ch + (before ? sel.length : 0);
			for (var i = cur.line; i < count; i++) {
				var ch = editor.getLine(i).indexOf(sel, beg);
				if (ch !== -1) {
					editor.doc.addSelection({ line: i, ch: ch }, { line: i, ch: ch + sel.length });
					break;
				}
				beg = 0;
			}
		};

		var clearsearch = function() {
			editor.execCommand('clearSearch');
			editor.execCommand('singleSelection');
			return CodeMirror.pass;
		};

		var findnext = function() {
			if (editor.state.search && editor.state.search.query) {
				editor.execCommand('findNext');
				return;
			}
		};

		var options = {};
		options.lineNumbers = true;
		options.mode = config.type || 'htmlmixed';
		options.indentUnit = 4;
		options.indentWithTabs = true;
		options.styleActiveLine = true;
		options.lineWrapping = false;
		options.matchBrackets = true;
		options.scrollbarStyle = 'simple';

		options.rulers = [{ column: 130, lineStyle: 'dashed' }];
		options.gutters = ['GutterUser', 'CodeMirror-lint-markers', 'CodeMirror-linenumbers', 'GutterDiff'];
		options.viewportMargin = 0;
		options.foldGutter = true;
		options.highlightSelectionMatches = HSM;
		options.phrases = {};
		options.matchTags = { bothTags: true };
		options.autoCloseTags = true;
		options.scrollPastEnd = true;
		options.lint = true;
		options.blastCode = true;
		options.autoCloseBrackets = true;
		options.extraKeys = { 'Alt-F': 'findPersistent', 'Ctrl-Enter': findnext, 'Cmd-Enter': findnext, 'Esc': clearsearch, 'Cmd-D': findmatch, 'Ctrl-D': findmatch, 'Cmd-S': shortcut('save'), 'Ctrl-S': shortcut('save'), 'Alt-W': shortcut('close'), 'Cmd-W': shortcut('close'), Enter: 'newlineAndIndentContinue', Tab: tabulator, 'Alt-Tab': shortcut('nexttab') };

		if (common.electron) {
			options.extraKeys['Cmd-Tab'] = shortcut('nexttab');
			options.extraKeys['Ctrl-Tab'] = shortcut('nexttab');
		}

		var GutterColor = function(color) {
			var marker = document.createElement('div');
			var css = marker.style;
			css.color = color;
			marker.className = 'cm-gutter-color';
			marker.innerHTML = '<i class="fa fa-fill"></i>';
			return marker;
		};

		editor = CodeMirror(container[0], options);
		self.editor = editor;

		self.event('contextmenu', function(e) {
			e.preventDefault();
			e.stopPropagation();
			config.contextmenu && EXEC(config.contextmenu, e, editor);
		});

		editor.on('keydown', function(editor, e) {
			if (e.shiftKey && e.ctrlKey && (e.keyCode === 40 || e.keyCode === 38)) {
				var tmp = editor.getCursor();
				editor.doc.addSelection({ line: tmp.line + (e.keyCode === 40 ? 1 : -1), ch: tmp.ch });
				e.stopPropagation();
				e.preventDefault();
			}

			if (e.keyCode === 13) {
				var tmp = editor.getCursor();
				var line = editor.lineInfo(tmp.line);
				if ((/^\t+$/).test(line.text))
					editor.replaceRange('', { line: tmp.line, ch: 0 }, { line: tmp.line, ch: line.text.length });
				return;
			}

		});

		editor.phrase = function(text) {
			return options.phrases[text] || text;
		};

		if (config.disabled) {
			self.aclass('ui-disabled');
			editor.setOption('readOnly', true);
			editor.refresh();
		}

		var can = {};
		can['+input'] = can['+delete'] = can.undo = can.redo = can.paste = can.cut = can.clear = true;

		var REGTODO = /@todo/i;
		var REGTODO2 = /^(\s)+-\s.*?/;
		var REGTODOREPLACE = /^@todo(:)(\s)|(\s)+-(\s)/i;
		var REGTODODONE = /@done|@canceled/i;
		var REGTODOCLEAN = /-->|\*\//g;
		var REGPART = /(COMPONENT|COMPONENT_EXTEND|EXTENSION|CONFIG|NEWSCHEMA|NEWOPERATION|NEWTASK|MIDDLEWARE|WATCH|ROUTE|(^|\s)ON|PLUGIN)+\(.*?\)/g;
		var REGPARTCLEAN = /('|").*?('|")/;
		var REGHELPER = /(Thelpers|FUNC|REPO|MAIN)\.[a-z0-9A-Z_$]+(\s)+=/g;
		var REGCONSOLE = /console\.\w+\(.*?\)/g;
		var REGSCHEMAOP = /\.(setQuery|setSave|setInsert|setUpdate|setPatch|setRead|setGet|setRemove|addWorkflow|addTransform|addOperation|addHook)\(.*?\)/g;
		var REGSCHEMAOP_REPLACE = /(\(|,(\s))function.*?$/g;
		var REGPLUGINOP_REPLACE = /(\s)+=(\s)+function/g;
		var REGFUNCTION = /((\s)+=(\s)+function)/;
		var REGTASKOP = /('|").*?('|")/g;

		var schemaoperation_replace = function(text) {
			return text.charAt(0) === '(' ? '()' : ')';
		};

		editor.on('renderLine', function(cm, line, el) {
			if (config.mode === 'totaljs' || config.mode === 'text/css') {
				var arr = el.querySelectorAll('.cm-atom');
				for (var i = 0; i < arr.length; i++) {
					el = arr[i];
					var html = el.innerHTML;
					if (html.charAt(0) === '#' && (html.length === 4 || html.length === 7))
						el.style = 'border-radius:2px;border:2px solid ' + html;
				}
			}
		});

		self.prerender_colors = function(changescount) {

			config.change && EXEC(config.change, changescount || 0);

			if (cache_diffs_checksum === checksum)
				return;

			checksum = cache_diffs_checksum;

			var todos = [];
			var components = [];
			var mode = editor.getMode().name;
			var is = null;
			var name, type, oldschema, oldplugin, pluginvariable, oldtask, taskvariable, tmp;

			if (mode === 'totaljsresources' || mode === 'javascript' || mode === 'totaljs' || mode === 'css' || mode === 'sass' || mode === 'html' || mode === 'todo') {
				var lines = editor.getValue().split('\n');
				for (var i = 0; i < lines.length; i++) {

					// if (mode !== 'todo') {
					// 	color = lines[i].match(REGHEXCOLOR);
					// 	color && editor.setGutterMarker(i, 'GutterColor', GutterColor(color.toString().replace(REGCOLORCLEAN, '')));
					// }

					var m = mode === 'todo' ? lines[i].match(REGTODO2) : lines[i].match(REGTODO);

					if (m && !REGTODODONE.test(lines[i]))
						todos.push({ line: i + 1, ch: m.index || 0, name: lines[i].substring(m.index, 200).replace(REGTODOREPLACE, '').replace(REGTODOCLEAN, '').trim() });

					if (mode === 'javascript' || mode === 'totaljs' || mode === 'html') {

						if (is != null && lines[i].substring(is, 3) === '});') {
							components[components.length - 1].lineto = i;
							is = null;
						}

						m = lines[i].match(REGPART);
						if (m) {
							name = m[0].match(REGPARTCLEAN);
							tmp = m[0].toLowerCase();

							if (tmp.substring(0, 16) === 'component_extend') {
								type = 'exten';
							} else
								type = tmp.substring(0, 5).trim();

							if (name) {
								name = name[0].replace(/'|"/g, '');
								var beg = m.index || 0;
								switch(type) {
									case 'newsc':
										oldschema = name;
										break;
									case 'newta':
										oldtask = name;
										taskvariable = m[0].substring(m[0].indexOf('(', 10) + 1, m[0].indexOf(')'));
										break;
									case 'plugi':
										oldplugin = name;
										pluginvariable = m[0].substring(m[0].indexOf('(', 10) + 1, m[0].indexOf(')'));
										break;
								}

								components.push({ line: i, ch: beg, name: name.trim(), type: type.substring(0, 3) === 'on(' ? 'event' : type === 'exten' ? 'extension' : type === 'compo' ? 'component' : type === 'newsc' ? 'schema' : type === 'confi' ? 'config' : type === 'newop' ? 'operation' : type === 'newta' ? 'task' : type === 'watch' ? 'watcher' : type === 'plugi' ? 'plugin' : type === 'middl' ? 'middleware' : type === 'route' ? 'route' : 'undefined' });
								is = beg;
							}
						}

						m = lines[i].match(REGHELPER);
						if (m) {
							var end = m[0].indexOf('=');
							if (end === -1)
								continue;
							type = m[0].substring(0, 4);
							name = m[0].substring(type === 'Thel' ? 9 : 5, end).trim();
							if (name) {

								if (type === 'Thel' || type === 'FUNC') {
									var subm = lines[i].match(REGFUNCTION);
									if (!subm)
										continue;
									name = name.trim() + lines[i].substring(lines[i].indexOf('(', subm.index), lines[i].indexOf(')', subm.index + 8) + 1);
								}

								var beg = m.index || 0;
								components.push({ line: i, ch: beg, name: (type === 'Thel' ? 'Thelpers' : type) + '.' + name.trim(), type: type === 'Thel' ? 'helper' : type.toUpperCase() });
							}
						}

						m = lines[i].match(REGCONSOLE);
						if (m) {
							name = m[0].length > 20 ? (m[0].substring(0, 30) + '...') : m[0];
							components.push({ line: i, ch: m.index || 0, name: name, type: 'console' });
						}

						if (oldschema) {
							m = lines[i].match(REGSCHEMAOP);
							if (m) {
								m = m[0].replace(REGSCHEMAOP_REPLACE, schemaoperation_replace);
								components.push({ line: i, ch: m.index || 0, name: oldschema + m, type: 'schema' });
							}
						}

						if (oldplugin) {
							if (pluginvariable.indexOf('(') == -1) {
								m = lines[i].match(new RegExp(pluginvariable + '.*?(\\s)=(\\s)function\\(.*?\\)'));
								if (m) {
									m = m[0].replace(REGPLUGINOP_REPLACE, '');
									m = m.substring(0, m.indexOf(')') + 1).trim().substring(pluginvariable.length);
									components.push({ line: i, ch: m.index || 0, name: oldplugin + m, type: 'plugin' });
								}
							}
						}

						if (oldtask) {
							m = lines[i].match(new RegExp(taskvariable + '\\(.*?,'));
							if (m) {
								m = m[0].match(REGTASKOP);
								if (m) {
									m = m[0].replace(/"|'/g, '');
									components.push({ line: i, ch: m.index || 0, name: oldtask + '.' + m, type: 'task' });
								}
							}
						}
					}
				}
			}

			EXEC(config.components, components);
			EXEC(config.todo, todos);
			setTimeout2(self.ID, self.rebuild_autocomplete, 5000);
		};

		var snippets = {};
		var cache_snip = {};
		var snippetsoptions = { completeSingle: false, hint: function(cm) {

			if (snippets.text.length < 2) {
				cache_snip.list = EMPTYARRAY;
				cache_snip.from = 0;
				cache_snip.to = 0;
				return cache_snip;
			}

			var cur = cm.getCursor();
			var start = snippets.index;
			var end = cur.ch;
			var tabs = ''.padLeft(snippets.index, '\t');
			var index = -1;

			for (var i = snippets.text.length - 1; i > 0; i--) {
				var c = snippets.text.charCodeAt(i);
				if ((c > 64 && c < 91) || (c > 96 && c < 123) || (c > 47 && c < 58) || c === 45 || c === 95)
					continue;
				index = i;
				break;
			}

			if (index > -1) {
				index++;
				snippets.text = snippets.text.substring(index);
				start += index;
				end += index;
			} else
				index = 0;

			cache_snip.from = CodeMirror.Pos(cur.line, start);
			cache_snip.to = CodeMirror.Pos(cur.line, end);

			if (snippets.text.length < 2)
				cache_snip.list = EMPTYARRAY;
			else
				cache_snip.list = FUNC.snippets(config.mode, snippets.text, tabs, cur.line, autocomplete, index);

			return cache_snip;
		}};

		editor.on('endCompletion', function(a, b) {
			b && editor.doc.setCursor({ line: b.line, ch: b.ch });
		});

		editor.on('cursorActivity', function() {
			EXEC(config.cursor, editor);
		});

		editor.on('drop', function(data, e) {
			var files = e.dataTransfer.files;
			if (files && files.length) {
				var reader = new FileReader();
				if (files[0].type.substring(0, 4) === 'text' || files[0].type.indexOf('svg') !== -1)
					reader.readAsText(files[0]);
				else
					reader.readAsDataURL(files[0]);
				reader.onload = function () {
					editor.doc.replaceSelection(reader.result);
				};
				e.preventDefault();
				e.stopPropagation();
				return false;
			}
		});

		var cache_sync = { from: {}, to: {} };
		var combo = GET(config.combo);

		editor.on('change', function(a, b) {

			if (b.origin === 'setValue') {
				if (!cache_lines_skip)
					cache_lines = editor.getValue().split('\n');
			} else {

				if (code.SYNC) {
					cache_sync.from.line = b.from.line;
					cache_sync.from.ch = b.from.ch;
					cache_sync.to.line = b.to.line;
					cache_sync.to.ch = b.to.ch;
					cache_sync.text = b.text;
					EXEC(config.sync, cache_sync);
				}

				var count = 0;

				for (var i = b.from.line; i < (b.from.line + b.text.length); i++) {
					var is = cache_lines && cache_lines[i] === editor.getLine(i);
					if (!is)
						count++;
					self.diffgutter(i, is);
				}

				if (b.origin && b.origin.charAt(1) !== 'd')
					combo && combo();
			}

			setTimeout2('EditorGutterColor', self.prerender_colors, 999, 20, count);

			if (config.disabled || !can[b.origin])
				return;

			setTimeout2(self.id, function() {

				var cur = editor.getCursor();
				var line = editor.getLine(cur.line);
				var index = fn.lastIndexOf(line, cur.ch, ' ', '>', '\t', ';', '.', '"', '\'', ')', '(', '<', ',');

				if (index !== -1) {
					var text = line.substring(index, cur.ch);
					if (text) {
						snippets.index = index;
						snippets.text = text;
						editor.showHint(snippetsoptions);
					}
				}

				var val = editor.getValue();
				if (config.trim) {
					var lines = val.split('\n');
					for (var i = 0, length = lines.length; i < length; i++)
						lines[i] = lines[i].replace(/\s+$/, '');
					val = lines.join('\n').trim();
				}

				self.getter2 && self.getter2(val);
				self.change(true);
				skip = true;
				self.set(val);
				config.required && self.validate2();
			}, 200);

		});

		self.resize();
	};

	var cache_mt_f = {};
	var cache_mt_t = {};
	var cache_mt_css = { css: {} };

	self.marker = function(id, fline, fch, tline, tch, color) {

		markers[id] && markers[id].clear();

		cache_mt_f.line = fline;
		cache_mt_f.ch = fline === tline && tch === fch ? (fch - 1) : fch;
		cache_mt_t.line = tline;
		cache_mt_t.ch = tch;

		if (cache_mt_f.ch < 0) {
			cache_mt_f.ch = 0;
			cache_mt_t.ch = 1;
		}

		cache_mt_css.css = 'background-color:' + hexrgba(color, 0.5);
		cache_mt_css.className = 'cm-user cm-user-' + id;
		cache_mt_css.title = id;

		markers[id] = editor.markText(cache_mt_f, cache_mt_t, cache_mt_css);
		self.find('.cm-uname-' + id).remove();
		self.find('.cm-user-' + id).eq(0).prepend('<span class="cm-uname cm-uname-{1}" style="border-left:1px solid {0}"><b style="background-color:{0}">{1}</b></span>'.format(hexrgba(color, 0.5), id));
	};

	self.copy = function(history) {
		var doc = editor.doc.copy(history);
		if (history) {
			doc.cachedlines = cache_lines;
			doc.cacheddiffs = cache_diffs;
			doc.cachedusers = cache_users;
		}
		return doc;
	};

	self.getDiff = function() {
		var arr = [];
		var count = editor.lineCount();
		for (var i = 0; i < count; i++) {
			var info = editor.lineInfo(i);
			if (info.text && info.gutterMarkers && info.gutterMarkers.GutterUser) {
				var el = $(info.gutterMarkers.GutterUser);
				arr.push({ userid: el.attrd('userid'), line: i + 1, updated: new Date(+el.attrd('date')) });
			}
		}
		return arr;
	};

	self.paste = function(doc) {

		cache_lines = doc.cachedlines || editor.getValue().split('\n');
		cache_diffs = doc.cacheddiffs || {};
		cache_users = doc.cachedusers || {};

		delete doc.cachedlines;
		delete doc.cacheddiffs;
		editor.swapDoc(doc);
		cache_lines_skip = true;
		editor.refresh();
		cache_lines_skip = false;
		checksum = -1;

		if (!cache_lines)
			return;

		var changes = 0;
		if (cache_diffs) {
			var keys = Object.keys(cache_diffs);
			for (var i = 0; i < keys.length; i++) {
				self.diffgutter(+keys[i], null, true);
				changes++;
			}
		}

		setTimeout2('EditorGutterColor', self.prerender_colors, 500, 20, changes);
	};

	self.clear = function(content) {
		content && editor.setValue('');
		editor.clearHistory();
	};

	self.setter = function(value, path, type) {

		if (skip && type !== 2) {
			skip = false;
			return;
		}

		if (type === 'skip')
			return;

		markers = {};
		editor.setValue(value || '');
		editor.refresh();

		setTimeout(function() {
			editor.refresh();
		}, 200);

		setTimeout(function() {
			editor.refresh();
		}, 1000);

		setTimeout(function() {
			editor.refresh();
		}, 2000);

		checksum = -1;
		setTimeout2('EditorGutterColor', self.prerender_colors, 999, 20, 0);
		self.resize();
	};

	self.flush = function() {
		clearTimeout2('EditorGutterColor');
		checksum = -1;
		self.prerender_colors(0);
	};

	self.state = function(type) {
		if (!type)
			return;
		var invalid = config.required ? self.isInvalid() : false;
		if (invalid === self.$oldstate)
			return;
		self.$oldstate = invalid;
		self.find('.ui-editor').tclass('ui-editor-invalid', invalid);
	};

	var BL = { 'data--': 1, 'data---': 1 };

	self.rebuild_autocomplete = function() {
		var words = editor.getValue();
		var max = 100000;
		if (words.length > max)
			words = words.substring(0, max);
		words = words.match(/[a-zA-Z0-9_-]{3,30}/g);
		if (words) {
			var unique = {};
			for (var i = 0; i < words.length; i++) {

				if (BL[words[i]])
					continue;

				var index = words[i].indexOf('__');
				if (index !== -1)
					words[i] = words[i].substring(0, index);
				unique[words[i]] = words[i];
			}

			autocomplete = Object.keys(unique);
			autocomplete.sort();

			for (var i = 0; i < autocomplete.length; i++) {
				var s = autocomplete[i];
				autocomplete[i] = { search: s, code: unique[s] };
			}

			if (code.componentsdb) {
				for (var i = 0; i < code.componentsdb.length; i++) {
					var item = code.componentsdb[i];
					for (var j = 0; j < item.items.length; j++) {
						var n = item.items[j].name;
						autocomplete.push({ search: n, code: n });
					}
				}
			}

		} else
			autocomplete = null;
	};

});

COMPONENT('exec', function(self, config) {
	self.readonly();
	self.blind();
	self.make = function() {

		var scope = null;

		var scopepath = function(el, val) {
			if (!scope)
				scope = el.scope();
			return scope ? scope.makepath ? scope.makepath(val) : val.replace(/\?/g, el.scope().path) : val;
		};

		var fn = function(plus) {
			return function(e) {

				var el = $(this);
				var attr = el.attrd('exec' + plus);
				var path = el.attrd('path' + plus);
				var href = el.attrd('href' + plus);
				var def = el.attrd('def' + plus);
				var reset = el.attrd('reset' + plus);

				scope = null;

				if (el.attrd('prevent' + plus) === 'true') {
					e.preventDefault();
					e.stopPropagation();
				}

				if (attr) {
					if (attr.indexOf('?') !== -1)
						attr = scopepath(el, attr);
					EXEC(attr, el, e);
				}

				href && NAV.redirect(href);

				if (def) {
					if (def.indexOf('?') !== -1)
						def = scopepath(el, def);
					DEFAULT(def);
				}

				if (reset) {
					if (reset.indexOf('?') !== -1)
						reset = scopepath(el, reset);
					RESET(reset);
				}

				if (path) {
					var val = el.attrd('value');
					if (val) {
						if (path.indexOf('?') !== -1)
							path = scopepath(el, path);
						var v = GET(path);
						SET(path, new Function('value', 'return ' + val)(v), true);
					}
				}
			};
		};

		self.event('dblclick', config.selector2 || '.exec2', fn('2'));
		self.event('click', config.selector || '.exec', fn(''));
	};
});

COMPONENT('tree', 'selected:selected;autoreset:false', function(self, config) {

	Thelpers.treefilecolor = function(filename) {
		if (filename.charAt(0) === '.' || filename.indexOf('-bk.') !== -1)
			return ' ui-tree-hiddenfile';
		return '';
	};

	Thelpers.fileicon = function(filename) {
		var ext = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();

		ext = ext.substring(ext.lastIndexOf('/') + 1);

		if (filename.charAt(0) === '.')
			return 'far fa-file-alt';

		switch (ext) {
			case 'api':
				return 'fa fa-broadcast-tower';
			case 'htm':
			case 'html':
				return 'fab fa-html5';
			case 'sitemap':
				return 'fa fa-code-branch';
			case 'versions':
				return 'fa fa-superscript';
			case 'css':
			case 'sass':
				return 'fab fa-css3';
			case 'py':
				return 'fab fa-python';
			case 'php':
				return 'fab fa-php';
			case 'pdf':
				return 'far fa-file-' + ext;
			case 'eot':
			case 'ttf':
			case 'woff':
			case 'woff2':
				return 'fa fa-font';
			case 'log':
				return 'fa fa-clipboard-list';
			case 'csv':
			case 'txt':
			case 'sh':
				return 'far fa-file-alt';
			case 'md':
				return 'fab fa-markdown';
			case 'bundle':
			case 'package':
				return 'fa fa-box';
			case 'url':
				return 'fa fa-link';
			case 'nosql':
			case 'table':
			case 'sql':
				return 'fa fa-database';
			case 'json':
				return 'fa fa-toolbox';
			case 'todo':
				return 'fa fa-check';
			case 'gif':
			case 'ico':
			case 'jpeg':
			case 'jpg':
			case 'png':
			case 'svg':
				return 'far fa-image';
			case 'pid':
				return 'fa fa-plug';
			case 'js':
				return 'fab fa-js';
			case 'config':
			case 'config-debug':
			case 'config-release':
			case 'config-test':
			case 'resource':
			case 'workflows':
				return 'fa fa-cog';
		}
		return 'fa-file-o far';
	};

	var cache = null;
	var counter = 0;
	var expanded = {};
	var selindex = -1;

	self.template = Tangular.compile('<div class="item{{ if children }} expand{{ fi }}{{ name | treefilecolor }}" data-index="{{ $pointer }}" title="{{ name }}"><i class="icon {{ if children }}fa fa-folder{{ if isopen }}-open {{ fi }}{{ else }}{{ name | fileicon }}{{ fi }}"></i><span class="options"><i class="fa fa-ellipsis-h"></i></span><div>{{ name }}</div></div>');
	self.readonly();

	self.make = function() {
		self.aclass('ui-tree');

		var ddfile = null;
		var ddtarget = null;

		self.event('click', '.extrabutton', function() {
			EXEC(config.extrabutton);
		});

		self.event('dragenter dragover dragexit drop dragleave', function (e) {

			e.stopPropagation();
			e.preventDefault();

			switch (e.type) {
				case 'drop':
					break;
				case 'dragenter':
				case 'dragover':

					if (e.target !== ddtarget || (ddtarget && e.target !== ddtarget.parentNode)) {
						ddtarget = e.target;
						ddfile && ddfile.rclass('item-ddhere');
						ddfile = $(ddtarget);
						if (!ddfile.hclass('item'))
							ddfile = ddfile.closest('.item');
						ddfile.aclass('item-ddhere');
					}

					return;
				case 'dragleave':
				case 'dragexit':
				default:
					setTimeout2(self.id, function() {
						ddfile && ddfile.rclass('item-ddhere');
						ddfile = null;
						ddtarget = null;
					}, 100);
					return;
			}

			var index = -1;

			if (ddfile)
				index = +ddfile.attrd('index');

			EXEC(config.upload, cache[index], e.originalEvent.dataTransfer.files);
		});

		self.event('focusout', 'input', function() {
			var input = $(this);
			var el = input.parent();
			el.html(el[0].$def);
			el[0].$def = null;
		});

		self.event('keydown', 'input', function(e) {
			if (e.which === 13 || e.which === 27) {
				var input = $(this);
				var el = input.parent();
				if (e.which === 27) {
					// cancel
					el.html(el[0].$def);
					el[0].$def = null;
				} else {
					var val = input.val().replace(/[^a-z0-9.\-_\\/]/gi, '');
					var index = +input.closest('.item').attrd('index');
					var item = cache[index];
					var newname = val.charAt(0) === '/' ? val : (item.path.substring(0, item.path.length - item.name.length - 1) + '/' + val);
					EXEC(config.rename, cache[index], newname, function(is) {
						el.html(is ? val : el[0].$def);
						if (is) {
							item.path = newname;
							item.name = val;
							self.select(index);
						}
					});
				}
			}
		});

		self.event('click', '.item', function(e) {
			var el = $(this);
			var target = $(e.target);
			var index;
			if (target.hclass('options') || target.parent().hclass('options')) {
				index = +el.closest('.item').attrd('index');
				config.options && EXEC(config.options, cache[index], el);
			} else {
				index = +el.attr('data-index');
				self.select(index);
			}
		});

		self.event('contextmenu', '.item', function(e) {
			e.preventDefault();
			var el = $(this);
			var index = el.attrd('index');
			config.options && EXEC(config.options, cache[index], el);
		});

	};

	self.select = function(index, noeval) {
		var cls = config.selected;
		var el = self.find('[data-index="{0}"]'.format(index));
		if (el.hclass('expand')) {
			var parent = el.parent();
			parent.tclass('show');

			var is = parent.hclass('show');
			var item = cache[index];

			if (config.pk)
				expanded[item[config.pk]] = is ? 1 : 0;
			else
				expanded[index] = is ? 1 : 0;

			el.find('.icon').tclass('fa-folder', !is).tclass('fa-folder-open', is);
			!noeval && config.exec && EXEC(config.exec, cache[index], true, is);
		} else {
			!el.hclass(cls) && self.find('.' + cls).rclass(cls);
			el.aclass(cls);
			!noeval && config.exec && EXEC(config.exec, cache[index], false);
			selindex = index;
		}
	};

	self.selectpath = function(path, noeval) {
		var index = FUNC.treeindex(self.get(), path);
		if (index !== -1 && index) {
			self.expand(index);
			self.select(index, noeval);
		}
	};

	self.select2 = function(index) {
		self.expand(index);
		self.select(index, true);
	};

	self.rename = function(index) {
		var div = self.find('[data-index="{0}"] div'.format(index));
		if (div[0].$def)
			return;
		div[0].$def = div.html();
		div.html('<input type="text" value="{0}" />'.format(div[0].$def));
		div.find('input').focus();
	};

	self.unselect = function() {
		var cls = config.selected;
		self.find('.' + cls).rclass(cls);
	};

	self.clear = function() {
		expanded = {};
		selindex = -1;
	};

	self.expand = function(index) {
		if (index == null) {
			self.find('.expand').each(function() {
				$(this).parent().aclass('show');
			});
		} else {
			self.find('[data-index="{0}"]'.format(index)).each(function() {
				var el = $(this);
				if (el.hclass('expand')) {
					// group
					el.parent().aclass('show');
				} else {
					// item
					while (true) {
						el = el.closest('.children').prev();
						if (!el.hclass('expand'))
							break;
						el.parent().aclass('show');
					}
				}
			});
		}
	};

	self.collapse = function(index) {
		if (index == null) {
			self.find('.expand').each(function() {
				$(this).parent().rclass('show');
			});
		} else {
			self.find('[data-index="{0}"]'.format(index)).each(function() {
				var el = $(this);
				if (el.hclass('expand')) {
					// group
					el.parent().rclass('show');
				} else {
					// item
					while (true) {
						el = el.closest('.children').prev();
						if (!el.hclass('expand'))
							break;
						el.parent().rclass('show');
					}
				}
			});
		}
	};

	self.renderchildren = function(builder, item, level, selected) {
		builder.push('<div class="children children{0}" data-level="{0}">'.format(level));
		item.children.forEach(function(item) {
			counter++;
			item.$pointer = counter;
			cache[counter] = item;

			var key = config.pk ? item[config.pk] : counter;
			if (key === selected)
				selindex = counter;

			item.isopen = !!(expanded[key] && item.children);
			builder.push('<div class="node{0}">'.format(item.isopen ? ' show' : ''));
			builder.push(self.template(item));
			item.children && self.renderchildren(builder, item, level + 1, selected);
			builder.push('</div>');
		});
		builder.push('</div>');
	};

	self.reset = function() {
		var cls = config.selected;
		self.find('.' + cls).rclass(cls);
	};

	self.first = function() {
		cache.first && self.select(cache.first.$pointer);
	};

	self.setter = function(value) {

		config.autoreset && self.clear();
		var builder = [];
		var selected = selindex === -1 ? -1 : config.pk ? cache[selindex][config.pk] : cache[selindex];

		selindex = -1;
		counter = 0;
		cache = {};

		var extra = true;
		if (value) {
			for (var i = 0; i < value.length; i++) {
				var key = value[i].name;
				if (key === 'controllers' || key === 'bundles' || key === 'packages') {
					extra = false;
					break;
				}
			}

			if (extra)
				builder.push('<div class="extrabutton"><i class="fa fa-cloud-download"></i>{0}</div>'.format(config.extralabel));
		}

		value && value.forEach(function(item) {
			counter++;
			item.$pointer = counter;
			cache[counter] = item;
			var key = config.pk ? item[config.pk] : counter;
			if (key === selected)
				selindex = counter;
			item.isopen = !!(expanded[key] && item.children);
			builder.push('<div class="node{0}">'.format(item.isopen ? ' show' : '') + self.template(item));
			if (item.children)
				self.renderchildren(builder, item, 1, selected);
			else if (!cache.first)
				cache.first = item;
			builder.push('</div>');
		});

		self.html(builder.join(''));

		if (selindex !== -1) {
			// Disables auto-select when is refreshed
			// self.select(selindex);
		} else
			config.first !== false && cache.first && setTimeout(self.first, 100);
	};
});

COMPONENT('part', 'hide:true', function(self, config) {

	var init = false;
	var clid = null;

	self.readonly();
	self.setter = function(value) {

		if (config.if !== value) {
			config.hidden && !self.hclass('hidden') && EXEC(config.hidden);
			config.hide && self.aclass('hidden');
			if (config.cleaner && init && !clid)
				clid = setTimeout(self.clean, config.cleaner * 60000);
			return;
		}

		config.hide && self.rclass('hidden');

		if (self.element[0].hasChildNodes()) {

			if (clid) {
				clearTimeout(clid);
				clid = null;
			}

			config.reload && EXEC(config.reload);
			config.default && DEFAULT(config.default, true);

		} else {
			SETTER('loading', 'show');
			setTimeout(function() {
				self.import(config.url, function() {
					if (!init) {
						config.init && EXEC(config.init);
						init = true;
					}
					config.reload && EXEC(config.reload);
					config.default && DEFAULT(config.default, true);
					SETTER('loading', 'hide', 500);
				});
			}, 200);
		}
	};

	self.configure = function(key, value) {
		switch (key) {
			case 'if':
				config.if = value + '';
				break;
		}
	};

	self.clean = function() {
		if (self.hclass('hidden')) {
			config.clean && EXEC(config.clean);
			setTimeout(function() {
				self.empty();
				init = false;
				clid = null;
				setTimeout(FREE, 1000);
			}, 1000);
		}
	};
});

COMPONENT('selected', 'class:selected;selector:a', function(self, config) {
	self.bindvisible();
	self.readonly();
	self.setter = function(value) {
		var cls = config.class;
		self.find(config.selector).each(function() {
			var el = $(this);
			if (el.attrd('if') === value)
				el.aclass(cls);
			else
				el.hclass(cls) && el.rclass(cls);
		});
	};
});

COMPONENT('tabmenu', 'class:selected;selector:li', function(self, config) {
	var old, oldtab;

	self.readonly();
	self.nocompile && self.nocompile();

	self.make = function() {
		self.event('click', config.selector, function(e) {
			if (!config.disabled && !$(e.target).hclass('exec')) {
				var el = $(this);
				var val = el.attrd('value');
				if (config.exec)
					EXEC(config.exec, val, e);
				else
					self.set(val);
			}
		});
		var scr = self.find('script');
		if (scr.length) {
			self.template = Tangular.compile(scr.html());
			scr.remove();
		}

		var drag = { el: null, x: 0, offset: 0 };

		self.event('mousedown', function(e) {
			if (e.target.nodeName === 'SPAN') {
				drag.el = $(e.target);
				drag.x = e.pageX;
				drag.offset = 0;
				drag.w = drag.el.width() >> 0;
			} else
				drag.el = null;
		});

		self.event('mousemove', function(e) {
			if (drag.el) {
				var diff = e.pageX - drag.x - drag.offset;
				if (diff < -80) {
					// right
					var arr = self.get(config.datasource);
					var index = arr.findIndex('path', drag.el.attrd('value'));
					if (index === -1 || index === 0) {
						drag.el = null;
						return;
					}
					drag.offset -= 120;
					var tmp = arr[index - 1];
					arr[index - 1] = arr[index];
					arr[index] = tmp;
					drag.el.prev().before(drag.el);
					EXEC(config.reorder);
				} else if (diff > 80) {
					// left
					var arr = self.get(config.datasource);
					var index = arr.findIndex('path', drag.el.attrd('value'));
					if (index === -1 || index === arr.length - 1) {
						drag.el = null;
						return;
					}
					drag.offset += 120;
					var tmp = arr[index + 1];
					arr[index + 1] = arr[index];
					arr[index] = tmp;
					drag.el.next().after(drag.el);
					EXEC(config.reorder);
				}
			}
		});

		self.event('mouseup', function() {
			drag.el = null;
		});
	};

	self.configure = function(key, value) {
		switch (key) {
			case 'disabled':
				self.tclass('ui-disabled', !!value);
				break;
			case 'datasource':
				self.datasource(value, function(path, value) {
					if (value instanceof Array) {
						var builder = [];
						for (var i = 0; i < value.length; i++)
							builder.push(self.template(value[i]));
						old = null;
						self.html(builder.join(''));
						self.refresh();
					}
				}, true);
				break;
		}
	};

	self.setter = function(value) {
		if (old === value)
			return;
		oldtab && oldtab.rclass(config.class);
		oldtab = self.find(config.selector + '[data-value="' + value + '"]').aclass(config.class);
		old = value;
	};
});

COMPONENT('datagrid', 'checkbox:true;colwidth:150;rowheight:27;limit:80;filterlabel:Filter;numbering:;height:auto;bottom:90;resize:true;reorder:true;sorting:true;boolean:true,on,yes;pluralizepages:# pages,# page,# pages,# pages;pluralizeitems:# items,# item,# items,# items;remember:true;highlight:false;unhighlight:true;autoselect:false;buttonapply:Apply;buttonreset:Reset;allowtitles:false;fullwidth_xs:true', function(self, config) {

	var opt = { filter: {}, filtercache: {}, filtervalues: {}, scroll: false, selected: {}, operation: '' };
	var header, vbody, footer, vcontainer, hcontainer, varea, hbody, vscrollbar, vscrollbararea, hscrollbar, hscrollbararea, ecolumns, isecolumns = false;
	var Theadercol = Tangular.compile('<div class="dg-hcol dg-col-{{ index }}{{ if sorting }} dg-sorting{{ fi }}" data-index="{{ index }}">{{ if sorting }}<i class="dg-sort fa fa-sort"></i>{{ fi }}<div class="dg-label{{ alignheader }}"{{ if labeltitle }} title="{{ labeltitle }}"{{ fi }}{{ if reorder }} draggable="true"{{ fi }}>{{ label | raw }}</div>{{ if filter }}<div class="dg-filter{{ alignfilter }}{{ if filterval != null && filterval !== \'\' }} dg-filter-selected{{ fi }}"><i class="fa dg-filter-cancel fa-times"></i>{{ if options }}<select class="dg-filter-input" data-name="{{ name }}" name="{{ name }}{{ index }}"><option value="">{{ filter }}</option></select>{{ else }}<input autocomplete="off" type="text" placeholder="{{ filter }}" class="dg-filter-input" name="{{ name }}{{ ts }}" data-name="{{ name }}" value="{{ filterval }}" />{{ fi }}</div>{{ else }}<div class="dg-filter-empty">&nbsp;</div>{{ fi }}</div>');
	var isIE = (/msie|trident/i).test(navigator.userAgent);
	var isredraw = false;
	var sv = { is: false };
	var sh = { is: false };
	var pos = {};

	self.meta = opt;

	function Cluster(el) {

		var self = this;
		var dom = el[0];

		self.el = el;
		self.row = config.rowheight;
		self.rows = [];
		self.limit = config.limit;
		self.pos = -1;

		self.render = function() {
			var t = self.pos * self.frame;
			var b = (self.rows.length * self.row) - (self.frame * 2) - t;
			var pos = self.pos * self.limit;
			var h = self.rows.slice(pos, pos + (self.limit * 2));
			self.el[0].innerHTML = '<div style="height:{0}px"></div>{2}<div style="height:{1}px"></div>'.format(t, b < 2 ? 2 : b, h.join(''));
		};

		self.scrolling = function() {

			var y = dom.scrollTop + 1;
			if (y < 0)
				return;

			var frame = Math.ceil(y / self.frame) - 1;
			if (frame === -1)
				return;

			if (self.pos !== frame) {
				if (self.max && frame >= self.max)
					frame = self.max;

				self.pos = frame;
				self.render();
				self.scroll && self.scroll();
				config.change && SEEX(config.change, null, null, self.grid);
			}
		};

		self.update = function(rows, noscroll) {

			if (noscroll != true)
				self.el[0].scrollTop = 0;

			self.limit = config.limit;
			self.pos = -1;
			self.rows = rows;
			self.max = Math.ceil(rows.length / self.limit) - 1;
			self.frame = self.limit * self.row;

			if (self.limit * 2 > rows.length) {
				self.limit = rows.length;
				self.frame = self.limit * self.row;
				self.max = 1;
			}

			self.scrolling();
		};

		self.destroy = function() {
			self.el.off('scroll');
			self.rows = null;
		};

		self.el.on('scroll', self.scrolling);
	}

	self.destroy = function() {
		opt.cluster && opt.cluster.destroy();
	};

	// opt.cols    --> columns
	// opt.rows    --> raw rendered data
	// opt.render  --> for cluster

	self.init = function() {
		$(window).on('resize', function() {
			setTimeout2('datagridresize', function() {
				SETTER('datagrid', 'resize');
			}, 500);
		});
	};

	self.readonly();
	self.bindvisible();
	self.nocompile();

	self.configure = function(key, value, init) {
		switch (key) {
			case 'checkbox':
			case 'numbering':
				!init && self.cols(NOOP);
				break;
			case 'pluralizepages':
				config.pluralizepages = value.split(',').trim();
				break;
			case 'pluralizeitems':
				config.pluralizeitems = value.split(',').trim();
				break;
			case 'checked':
			case 'button':
			case 'exec':
				if (value && value.SCOPE)
					config[key] = value.SCOPE(self, value);
				break;
			case 'click':
				if (value && value.SCOPE)
					config.click = value.SCOPE(self, value);
				self.tclass('dg-clickable', !!value);
				break;
			case 'columns':
				self.datasource(value, function(path, value, type) {
					if (value) {
						opt.sort = null;
						opt.filter = {};
						opt.scroll = false;
						opt.selected = {};
						self.rebind(value);
						type && self.setter(null);
					}
				});
				break;
		}
	};

	self.refresh = function() {
		self.refreshfilter();
	};

	self.applycolumns = function(use) {
		isecolumns = false;
		ecolumns.aclass('hidden');
		if (use) {
			var hidden = {};
			ecolumns.find('input').each(function() {
				hidden[this.value] = !this.checked;
			});
			self.cols(function(cols) {
				for (var i = 0; i < cols.length; i++) {
					var col = cols[i];
					col.hidden = hidden[col.id] === true;
				}
			});
		}
	};

	self.fn_in_changed = function(arr) {
		config.changed && SEEX(config.changed, arr || self.changed(), self);
	};

	self.fn_in_checked = function(arr) {
		config.checked && SEEX(config.checked, arr || self.checked(), self);
	};

	self.make = function() {

		self.IDCSS = GUID(5);
		self.aclass('dg dg-noscroll dg-' + self.IDCSS);

		var scr = self.find('script');
		var meta = scr.html();
		meta && self.rebind(meta);

		var pagination = '';

		if (config.exec)
			pagination = '<div class="dg-footer hidden"><div class="dg-pagination-items hidden-xs"></div><div class="dg-pagination"><button name="page-first" disabled><i class="fa fa-angle-double-left"></i></button><button name="page-prev" disabled><i class="fa fa-angle-left"></i></button><div><input type="text" name="page" maxlength="5" class="dg-pagination-input" /></div><button name="page-next" disabled><i class="fa fa-angle-right"></i></button><button name="page-last" disabled><i class="fa fa-angle-double-right"></i></button></div><div class="dg-pagination-pages"></div></div>';

		self.dom.innerHTML = '<div class="dg-btn-columns"><i class="fa fa-caret-left"></i><span class="fa fa-columns"></span></div><div class="dg-columns hidden"><div><div class="dg-columns-body"></div></div><button class="dg-columns-button" name="columns-apply"><i class="fa fa-columns"></i>{1}</button><span class="dt-columns-reset">{2}</span></div><div class="dg-scrollbar-container-v hidden"><div class="dg-scrollbar-v hidden"></div></div><div class="dg-h-container"><div class="dg-h-body"><div class="dg-v-container"><div class="dg-v-area"><div class="dg-header"></div><div class="dg-v-body"></div></div></div></div></div><div class="dg-scrollbar-container-h hidden"><div class="dg-scrollbar-h hidden"></div></div>{0}'.format(pagination, config.buttonapply, config.buttonreset);
		varea = self.find('.dg-v-area');
		vcontainer = self.find('.dg-v-container');
		header = self.find('.dg-header');
		vbody = self.find('.dg-v-body');
		footer = self.find('.dg-footer');
		hbody = self.find('.dg-h-body');
		hcontainer = self.find('.dg-h-container');
		ecolumns = self.find('.dg-columns');

		// Scrollbars
		vscrollbar = self.find('.dg-scrollbar-v');
		vscrollbararea = self.find('.dg-scrollbar-container-v');
		hscrollbar = self.find('.dg-scrollbar-h');
		hscrollbararea = self.find('.dg-scrollbar-container-h');

		opt.vbarsize = 30;
		opt.hbarsize = 30;

		// Gets a top/left position of vertical/horizontal scrollbar
		pos.vscroll = vscrollbararea.css('top').parseInt();
		pos.hscroll = hscrollbararea.css('left').parseInt();

		var events = {};

		events.mousemove = function(e) {
			var p, scroll, half, off;
			if (sv.is) {

				off = sv.offset;
				var y = (e.pageY - sv.y);

				if (e.pageY > sv.pos) {
					half = sv.size / 1.5 >> 0;
					if (off < half)
						off = half;
				}

				p = (y / (sv.h - off)) * 100;
				scroll = ((vbody[0].scrollHeight - opt.height) / 100) * (p > 100 ? 100 : p);
				vbody[0].scrollTop = Math.ceil(scroll);

				if (sv.counter++ > 10) {
					sv.counter = 0;
					sv.pos = e.pageY;
				}

				if (p < -20 || p > 120)
					sv.is = false;

			} else if (sh.is) {

				off = sh.offset;
				var x = (e.pageX - sh.x);

				if (e.pageX > sh.pos) {
					half = sh.size / 1.5 >> 0;
					if (off < half)
						off = half;
				}

				p = (x / (sh.w - off)) * 100;
				scroll = ((hbody[0].scrollWidth - opt.width2) / 100) * (p > 100 ? 100 : p);
				hbody[0].scrollLeft = Math.ceil(scroll);

				if (sh.counter++ > 10) {
					sh.counter = 0;
					sh.pos = e.pageX;
				}

				if (p < -20 || p > 120)
					sh.is = false;
			}
		};

		events.mouseup = function(e) {
			if (r.is) {
				r.is = false;
				r.el.css('height', r.h);
				var x = r.el.css('left').parseInt();
				var index = +r.el.attrd('index');
				var width = opt.cols[index].width + (x - r.x);
				self.resizecolumn(index, width);
				e.preventDefault();
				e.stopPropagation();
			} else if (sv.is) {
				sv.is = false;
				e.preventDefault();
				e.stopPropagation();
			} else if (sh.is) {
				sh.is = false;
				e.preventDefault();
				e.stopPropagation();
			}
			events.unbind();
		};

		events.unbind = function() {
			$(window).off('mouseup', events.mouseup);
			$(window).off('mousemove', events.mousemove);
		};

		events.bind = function() {
			$(window).on('mouseup', events.mouseup);
			$(window).on('mousemove', events.mousemove);
		};

		vscrollbararea.on('mousedown', function(e) {

			events.bind();

			var el = $(e.target);
			if (el.hclass('dg-scrollbar-v')) {
				sv.is = true;
				sv.y = self.element.offset().top + e.offsetY + 60;
				sv.h = vscrollbararea.height();
				sv.pos = e.pageY;
				sv.offset = e.offsetY;
				sv.counter = 0;
				e.preventDefault();
				e.stopPropagation();
			} else if (el.hclass('dg-scrollbar-container-v')) {
				sv.is = false;
				sv.y = self.element.offset().top + pos.vscroll;
				sv.h = vscrollbararea.height();
				var y = (e.pageY - sv.y);
				var p = (y / sv.h) * 100;
				var scroll = ((vbody[0].scrollHeight - opt.height) / 100) * p;
				var plus = (p / 100) * opt.vbarsize;
				vbody[0].scrollTop = Math.ceil(scroll + plus);
				e.preventDefault();
				e.stopPropagation();
			}
		});

		hscrollbararea.on('mousedown', function(e) {

			events.bind();

			var el = $(e.target);
			if (el.hclass('dg-scrollbar-h')) {
				sh.is = true;
				sh.x = self.element.offset().left + e.offsetX;
				sh.w = hscrollbararea.width();
				sh.pos = e.pageX;
				sh.offset = e.offsetX;
				sh.counter = 0;
				e.preventDefault();
				e.stopPropagation();
			} else if (el.hclass('dg-scrollbar-container-h')) {
				sh.is = false;
				sh.w = hscrollbararea.width();
				var x = e.offsetX;
				var p = (x / sh.w) * 100;
				var scroll = ((hbody[0].scrollWidth - opt.width2) / 100) * p;
				var plus = (p / 100) * opt.hbarsize;
				hbody[0].scrollLeft = Math.ceil(scroll + plus);
				e.preventDefault();
				e.stopPropagation();
			}
		});

		var scrollcache = {};

		scrollcache.scrollv = function() {
			vscrollbar.css('top', scrollcache.v + 'px');
		};

		scrollcache.scrollh = function() {
			hscrollbar.css('left', scrollcache.h + 'px');
		};

		vbody.on('scroll', function(e) {
			var el = e.target;
			var p = ((el.scrollTop / (el.scrollHeight - opt.height)) * 100) >> 0;
			var pos = (((opt.height - opt.vbarsize - (opt.hbar ? 10 : 0)) / 100) * p);
			if (pos < 0)
				pos = 0;
			else {
				var max = opt.height - opt.vbarsize;
				if (pos > max)
					pos = max;
			}
			scrollcache.v = pos;
			W.requestAnimationFrame(scrollcache.scrollv);
			isecolumns && self.applycolumns();
		});

		hbody.on('scroll', function(e) {

			var el = e.target;
			var p = ((el.scrollLeft / (el.scrollWidth - opt.width2)) * 100) >> 0;
			var pos = (((opt.width2 - opt.hbarsize) / 100) * p);
			if (pos < 0)
				pos = 0;
			else {
				var max = opt.width2 - opt.hbarsize;
				if (pos > max)
					pos = max;
			}

			scrollcache.h = pos;
			W.requestAnimationFrame(scrollcache.scrollh);
			isecolumns && self.applycolumns();
		});

		var r = { is: false };

		self.event('click', '.dg-btn-columns', function(e) {
			e.preventDefault();
			e.stopPropagation();

			var cls = 'hidden';
			if (isecolumns) {
				self.applycolumns();
			} else {
				var builder = [];

				for (var i = 0; i < opt.cols.length; i++) {
					var col = opt.cols[i];
					(col.listcolumn && !col.$hidden) && builder.push('<div><label><input type="checkbox" value="{0}"{1} /><span>{2}</span></label></div>'.format(col.id, col.hidden ? '' : ' checked', col.text));
				}

				ecolumns.find('.dg-columns-body')[0].innerHTML = builder.join('');
				ecolumns.rclass(cls);
				isecolumns = true;
			}
		});

		self.event('dblclick', '.dg-col', function(e) {
			self.editcolumn($(this));
			e.preventDefault();
			e.stopPropagation();
		});

		self.event('click', '.dg-row', function(e) {
			var el = $(this);
			var type = e.target.tagName;
			var target = $(e.target);
			switch (type) {
				case 'DIV':
				case 'SPAN':
					if (!target.closest('.dg-checkbox').length) {
						var elrow = el.closest('.dg-row');
						var index = +elrow.attrd('index');
						var row = opt.rows[index];
						if (row) {
							if (config.highlight) {
								var cls = 'dg-selected';
								opt.cluster.el.find('> .' + cls).rclass(cls);
								if (!config.unhighlight || self.selected !== row) {
									self.selected = row;
									elrow.aclass(cls);
								} else {
									self.selected = null;
									elrow = null;
									target = null;
									row = null;
								}
							}
							config.click && SEEX(config.click, row, self, elrow, target);
						}
					}
					break;
			}
		});

		self.released = function(is) {
			!is && setTimeout(self.resize, 500);
		};

		self.event('click', '.dg-filter-cancel,.dt-columns-reset', function() {
			var el = $(this);
			if (el.hclass('dt-columns-reset'))
				self.resetcolumns();
			else
				el.parent().find('input,select').val('').trigger('change');
		});

		self.event('click', '.dg-label,.dg-sort', function() {

			var el = $(this).closest('.dg-hcol');

			if (!el.find('.dg-sort').length)
				return;

			var index = +el.attrd('index');

			for (var i = 0; i < opt.cols.length; i++) {
				if (i !== index)
					opt.cols[i].sort = 0;
			}

			var col = opt.cols[index];
			switch (col.sort) {
				case 0:
					col.sort = 1;
					break;
				case 1:
					col.sort = 2;
					break;
				case 2:
					col.sort = 0;
					break;
			}

			opt.sort = col;
			opt.operation = 'sort';

			if (config.exec)
				self.operation(opt.operation);
			else
				self.refreshfilter(true);
		});

		isIE && self.event('keydown', 'input', function(e) {
			if (e.keyCode === 13)
				$(this).blur();
			else if (e.keyCode === 27)
				$(this).val('');
		});

		self.event('mousedown', function(e) {
			var el = $(e.target);

			if (!el.hclass('dg-resize'))
				return;

			events.bind();

			var offset = self.element.offset().left;
			r.el = el;
			r.offset = (hbody.scrollLeft() - offset) + 10;

			var prev = el.prev();

			r.min = (prev.length ? prev.css('left').parseInt() : (config.checkbox ? 70 : 30)) + 50;

			r.h = el.css('height');
			r.x = el.css('left').parseInt();
			el.css('height', opt.height + config.bottom);
			r.is = true;
			e.preventDefault();
			e.stopPropagation();
		});

		header.on('mousemove', function(e) {
			if (r.is) {
				var x = e.pageX + r.offset - 20;
				if (x < r.min)
					x = r.min;
				r.el.css('left', x);
				e.preventDefault();
				e.stopPropagation();
			}
		});

		var d = { is: false };

		self.event('dragstart', function(e) {
			!isIE && e.originalEvent.dataTransfer.setData('text/plain', GUID());
		});

		self.event('dragenter dragover dragexit drop dragleave', function (e) {

			e.stopPropagation();
			e.preventDefault();

			switch (e.type) {
				case 'drop':

					if (d.is) {
						var col = opt.cols[+$(e.target).closest('.dg-hcol').attrd('index')];
						col && self.reordercolumn(d.index, col.index);
					}

					d.is = false;
					break;

				case 'dragenter':
					if (!d.is) {
						d.index = +$(e.target).closest('.dg-hcol').attrd('index');
						d.is = true;
					}
					return;
				case 'dragover':
					return;
				default:
					return;
			}
		});

		self.event('change', '.dg-pagination-input', function() {

			var value = self.get();
			var val = +this.value;

			if (isNaN(val))
				return;

			if (val >= value.pages)
				val = value.pages;
			else if (val < 1)
				val = 1;

			value.page = val;
			opt.scroll = true;
			self.operation('page');
		});

		self.event('change', '.dg-filter-input', function() {

			var input = this;
			var $el = $(this);
			var el = $el.parent();
			var val = $el.val();
			var name = input.getAttribute('data-name');

			var col = opt.cols[+el.closest('.dg-hcol').attrd('index')];
			delete opt.filtercache[name];

			if (col.options) {
				if (val)
					val = (col.options instanceof Array ? col.options : GET(col.options))[+val][col.ovalue];
				else
					val = null;
			}

			var is = val != null && val !== '';

			if (col)
				opt.filtervalues[col.id] = val;

			if (is) {
				if (opt.filter[name] == val)
					return;
				opt.filter[name] = val;
			} else
				delete opt.filter[name];

			opt.scroll = true;
			opt.operation = 'filter';
			el.tclass('dg-filter-selected', is);

			setTimeout2(self.ID + 'filter', function() {
				if (config.exec)
					self.operation(opt.operation);
				else
					self.refreshfilter(true);
			}, 50);
		});

		self.select = function(row) {

			var index;

			if (typeof(row) === 'number') {
				index = row;
				row = opt.rows[index];
			} else if (row)
				index = opt.rows.indexOf(row);

			var cls = 'dg-selected';

			if (!row || index === -1) {
				opt.cluster && opt.cluster.el.find('.' + cls).rclass(cls);
				config.highlight && config.click && SEEX(config.click, null, self);
				return;
			}

			self.selected = row;

			var elrow = opt.cluster.el.find('.dg-row[data-index="{0}"]'.format(index));
			if (elrow && config.highlight) {
				opt.cluster.el.find('.' + cls).rclass(cls);
				elrow.aclass(cls);
			}

			config.click && SEEX(config.click, row, self, elrow, null);
		};

		self.event('click', '.dg-checkbox', function() {

			var t = $(this);

			t.tclass('dg-checked');

			var val = t.attrd('value');
			var checked = t.hclass('dg-checked');

			if (val === '-1') {
				if (checked) {
					opt.checked = {};
					for (var i = 0; i < opt.rows.length; i++)
						opt.checked[opt.rows[i].ROW] = 1;
				} else
					opt.checked = {};
				self.scrolling();
			} else if (checked)
				opt.checked[val] = 1;
			else
				delete opt.checked[val];

			self.fn_in_checked();
		});

		self.event('click', 'button', function(e) {
			switch (this.name) {
				case 'columns-apply':
					self.applycolumns(true);
					break;
				case 'page-first':
					opt.scroll = true;
					self.get().page = 1;
					self.operation('page');
					break;
				case 'page-last':
					opt.scroll = true;
					var tmp = self.get();
					tmp.page = tmp.pages;
					self.operation('page');
					break;
				case 'page-prev':
					opt.scroll = true;
					self.get().page -= 1;
					self.operation('page');
					break;
				case 'page-next':
					opt.scroll = true;
					self.get().page += 1;
					self.operation('page');
					break;
				default:
					var el = $(this);
					var row = opt.rows[+el.closest('.dg-row').attrd('index')];
					config.button && SEEX(config.button, this.name, row, el, e);
					break;
			}
		});

		config.exec && self.operation('init');
	};

	self.operation = function(type) {

		var value = self.get();

		if (value == null)
			value = {};

		if (type === 'filter' || type === 'init')
			value.page = 1;

		var keys = Object.keys(opt.filter);
		SEEX(config.exec, type, keys.length ? opt.filter : null, opt.sort && opt.sort.sort ? [(opt.sort.name + ' ' + (opt.sort.sort === 1 ? 'asc' : 'desc'))] : null, value.page, self);

		switch (type) {
			case 'sort':
				self.redrawsorting();
				break;
		}
	};

	function align(type) {
		return type === 1 ? 'center' : type === 2 ? 'right' : type;
	}

	self.clear = function() {
		for (var i = 0; i < opt.rows.length; i++)
			opt.rows[i].CHANGES = undefined;
		self.renderrows(opt.rows, true);
		opt.cluster && opt.cluster.update(opt.render);
		self.fn_in_changed();
	};

	self.editcolumn = function(rindex, cindex) {

		if (!config.change)
			return;

		var col;
		var row;

		if (cindex == null) {
			if (rindex instanceof jQuery) {
				cindex = rindex.attr('class').match(/\d+/);
				if (cindex)
					cindex = +cindex[0];
				else
					return;
				col = rindex;
			}
		} else
			row = opt.cluster.el.find('.dg-row-' + (rindex + 1));

		if (!col)
			col = row.find('.dg-col-' + cindex);

		var index = cindex;
		if (index == null)
			return;

		if (!row)
			row = col.closest('.dg-row');

		var data = {};

		data.rowindex = +row.attrd('index');
		data.row = opt.rows[data.rowindex];
		data.col = opt.cols[index];
		data.colindex = index;
		data.value = data.row[data.col.name];
		data.elrow = row;
		data.elcol = col;

		var clone = col.clone();

		EXEC(config.change, data, function(data) {

			if (data == null) {
				col.replaceWith(clone);
				return;
			}

			data.row[data.col.name] = data.value;

			if (opt.rows[data.rowindex] != data.row)
				opt.rows[data.rowindex] = data.row;

			if (!data.row.CHANGES)
				data.row.CHANGES = {};

			data.row.CHANGES[data.col.name] = true;
			opt.render[data.rowindex] = self.renderrow(data.rowindex, data.row);
			data.elrow.replaceWith(opt.render[data.rowindex]);
			self.fn_in_changed();

		}, self);
	};

	self.applyfilter = function(obj, add) {

		if (!add)
			opt.filter = {};

		header.find('input,select').each(function() {
			var t = this;
			var el = $(t);
			var val = obj[el.attrd('name')];
			if (val !== undefined) {
				if (t.tagName === 'SELECT') {
					var col = opt.cols.findItem('index', +el.closest('.dg-hcol').attrd('index'));
					if (col && col.options) {
						var index = col.options.findIndex(col.ovalue, val);
						if (index > -1)
							el.val(index);
					}
				} else
					el.val(val == null ? '' : val);
			}
		}).trigger('change');
	};

	self.rebind = function(code) {

		opt.declaration = code;

		var type = typeof(code);
		if (type === 'string') {
			code = code.trim();
			self.gridid = 'dg' + HASH(code);
		} else
			self.gridid = 'dg' + HASH(JSON.stringify(code));

		var cache = config.remember ? W.PREF ? W.PREF.get(self.gridid) : CACHE(self.gridid) : null;
		var cols = type === 'string' ? new Function('return ' + code)() : CLONE(code);
		var tmp;

		opt.search = false;

		for (var i = 0; i < cols.length; i++) {
			var col = cols[i];

			col.id = GUID(5);
			col.realindex = i;

			if (!col.name)
				col.name = col.id;

			if (col.listcolumn == null)
				col.listcolumn = true;

			if (col.hidden) {
				col.$hidden = FN(col.hidden)(col) === true;
				col.hidden = true;
			}

			if (col.hide) {
				col.hidden = col.hide === true;
				delete col.hide;
			}

			if (col.options) {
				!col.otext && (col.otext = 'text');
				!col.ovalue && (col.ovalue = 'value');
			}

			// SORT?
			if (col.sort != null)
				col.sorting = col.sort;

			if (cache) {
				var c = cache[i];
				if (c) {
					col.index = c.index;
					col.width = c.width;
					col.hidden = c.hidden;
				}
			}

			if (col.index == null)
				col.index = i;

			if (col.sorting == null)
				col.sorting = config.sorting;

			if (col.alignfilter != null)
				col.alignfilter = ' ' + align(col.alignfilter);

			if (col.alignheader != null)
				col.alignheader = ' ' + align(col.alignheader);

			col.sort = 0;

			if (col.search) {
				opt.search = true;
				col.search = col.search === true ? Tangular.compile(col.template) : Tangular.compile(col.search);
			}

			if (col.align && col.align !== 'left') {
				col.align = align(col.align);
				col.align = ' ' + col.align;
				if (!col.alignfilter)
					col.alignfilter = ' center';
				if (!col.alignheader)
					col.alignheader = ' center';
			}

			var cls = col.class ? (' ' + col.class) : '';

			if (col.template)
				col.template = Tangular.compile((col.template.indexOf('<button') === -1 ? ('<div class="dg-value' + cls + '">{0}</div>') : '{0}').format(col.template));
			else
				col.template = Tangular.compile(('<div class="dg-value' + cls + '"' + (config.allowtitles ? ' title="{{ {0} }}"' : '') + '>{{ {0} }}</div>').format(col.name + (col.format ? ' | format({0}) '.format(typeof(col.format) === 'string' ? ('\'' + col.format + '\'') : col.format) : '')));

			if (col.header)
				col.header = Tangular.compile(col.header);
			else
				col.header = Tangular.compile('{{ text | raw }}');

			if (!col.text)
				col.text = col.name;

			if (col.text.substring(0, 1) === '.')
				col.text = '<i class="{0}"></i>'.format(col.text.substring(1));

			if (col.filter !== false && !col.filter)
				col.filter = config.filterlabel;

			if (col.filtervalue != null) {
				tmp = col.filtervalue;
				if (typeof(tmp) === 'function')
					tmp = tmp(col);
				opt.filter[col.name] = opt.filtervalues[col.id] = tmp;
			}
		}

		cols.quicksort('index');
		opt.cols = cols;
		self.rebindcss();
		hbody && (hbody[0].scrollLeft = 0);
		vbody && (vbody[0].scrollTop = 0);
	};

	self.rebindcss = function() {

		var cols = opt.cols;
		var css = [];
		var indexes = {};

		opt.width = (config.numbering !== false ? 40 : 0) + (config.checkbox ? 40 : 0) + 30;

		for (var i = 0; i < cols.length; i++) {
			var col = cols[i];

			if (!col.width)
				col.width = config.colwidth;

			css.push('.dg-{2} .dg-col-{0}{width:{1}px}'.format(i, col.width, self.IDCSS));

			if (!col.hidden) {
				opt.width += col.width;
				indexes[i] = opt.width;
			}
		}

		CSS(css, self.ID);

		var w = self.width();
		if (w > opt.width)
			opt.width = w - 2;

		if (varea) {
			css = { width: opt.width };
			vcontainer.css(css);
			css.width += 50;
			varea.css(css);
		}

		header && header.find('.dg-resize').each(function() {
			var el = $(this);
			el.css('left', indexes[el.attrd('index')] - 39);
		});
	};

	self.cols = function(callback) {
		callback(opt.cols);
		opt.cols.quicksort('index');
		self.rebindcss();
		self.rendercols();
		opt.rows && self.renderrows(opt.rows);
		self.save();
		opt.cluster && opt.cluster.update(opt.render);
		self.resize();
	};

	self.rendercols = function() {

		var Trow = '<div class="dg-hrow dg-row-{0}">{1}</div>';
		var column = config.numbering !== false ? Theadercol({ index: -1, label: config.numbering, filter: false, name: '$', sorting: false }) : '';
		var resize = [];

		opt.width = (config.numbering !== false ? 40 : 0) + (config.checkbox ? 40 : 0) + 30;

		if (config.checkbox)
			column += Theadercol({ index: -1, label: '<div class="dg-checkbox" data-value="-1"><i class="fa fa-check"></i></div>', filter: false, name: '$', sorting: false });

		for (var i = 0; i < opt.cols.length; i++) {
			var col = opt.cols[i];
			if (!col.hidden) {
				var obj = { index: i, ts: NOW.getTime(), label: col.header(col), filter: col.filter, reorder: config.reorder, sorting: col.sorting, name: col.name, alignfilter: col.alignfilter, alignheader: col.alignheader, filterval: opt.filtervalues[col.id], labeltitle: col.title || col.text, options: col.options ? col.options instanceof Array ? col.options : GET(col.options) : null };
				opt.width += col.width;
				config.resize && resize.push('<span class="dg-resize" style="left:{0}px" data-index="{1}"></span>'.format(opt.width - 39, i));
				column += Theadercol(obj);
			}
		}

		column += '<div class="dg-hcol"></div>';
		header[0].innerHTML = resize.join('') + Trow.format(0, column);

		var w = self.width();
		if (w > opt.width)
			opt.width = w;

		var css = { width: opt.width };
		vcontainer.css(css);
		css.width += 50;
		varea.css(css);

		header.find('select').each(function() {
			var el = $(this);
			var index = +el.closest('.dg-hcol').attrd('index');
			var builder = [];
			var col = opt.cols[index];
			var opts = col.options instanceof Array ? col.options : GET(col.options);
			for (var i = 0; i < opts.length; i++) {
				var item = opts[i];
				builder.push('<option value="{0}"{1}>{2}</option>'.format(i, opt.filtervalues[col.id] === item[col.ovalue] ? ' selected' : '', item[col.otext]));
			}
			el.append(builder.join(''));
		});

		self.redrawsorting();
	};

	self.redraw = function(update) {
		var x = hbody[0].scrollLeft;
		var y = vbody[0].scrollTop;
		isredraw = update ? 2 : 1;
		self.refreshfilter();
		isredraw = 0;
		hbody[0].scrollLeft = x;
		vbody[0].scrollTop = y;
	};

	self.redrawrow = function(row) {
		var index = opt.rows.indexOf(row);
		if (index !== -1) {
			var el = vbody.find('.dg-row[data-index="{0}"]'.format(index));
			if (el.length) {
				opt.render[index] = self.renderrow(index, row);
				el.replaceWith(opt.render[index]);
			}
		}
	};

	self.appendrow = function(row, scroll) {
		var index = opt.rows.push(row) - 1;
		var model = self.get();

		if (model == null) {
			// bad
			return;
		} else {
			if (model.items)
				model.items.push(row);
			else
				model.push(row);
		}

		opt.render[index] = self.renderrow(index, row);
		opt.cluster && opt.cluster.update(opt.render, opt.scroll == false);
		if (scroll) {
			var el = opt.cluster.el[0];
			el.scrollTop = el.scrollHeight;
		}
		self.scrolling();
	};

	self.renderrow = function(index, row, plus) {

		if (plus === undefined && config.exec) {
			// pagination
			var val = self.get();
			plus = (val.page - 1) * val.limit;
		}

		var Trow = '<div class="dg-row dg-row-{0}{3}{4}" data-index="{2}">{1}</div>';
		var Tcol = '<div class="dg-col dg-col-{0}{2}{3}">{1}</div>';
		var column = '';

		if (config.numbering !== false)
			column += Tcol.format(-1, '<div class="dg-number">{0}</div>'.format(index + 1 + (plus || 0)));

		if (config.checkbox)
			column += Tcol.format(-1, '<div class="dg-checkbox{1}" data-value="{0}"><i class="fa fa-check"></i></div>'.format(row.ROW, opt.checked[row.ROW] ? ' dg-checked' : ''));

		for (var j = 0; j < opt.cols.length; j++) {
			var col = opt.cols[j];
			if (!col.hidden)
				column += Tcol.format(j, col.template(row), col.align, row.CHANGES && row.CHANGES[col.name] ? ' dg-col-changed' : '');
		}

		column += '<div class="dg-col">&nbsp;</div>';
		return Trow.format(index + 1, column, index, self.selected === row ? ' dg-selected' : '', row.CHANGES ? ' dg-row-changed' : '');
	};

	self.renderrows = function(rows, noscroll) {

		opt.rows = rows;

		var output = [];
		var plus = 0;

		if (config.exec) {
			// pagination
			var val = self.get();
			plus = (val.page - 1) * val.limit;
		}

		for (var i = 0, length = rows.length; i < length; i++)
			output.push(self.renderrow(i, rows[i], plus));

		var min = ((opt.height / config.rowheight) >> 0) + 1;
		var is = output.length < min;

		if (is) {
			for (var i = output.length; i < min + 1; i++)
				output.push('<div class="dg-row-empty">&nbsp;</div>');
		}

		if (noscroll) {
			self.tclass('dg-noscroll', is);
			hbody[0].scrollLeft = 0;
			vbody[0].scrollTop = 0;
		}

		opt.render = output;
		self.onrenderrows && self.onrenderrows(opt);
	};

	self.exportrows = function(page_from, pages_count, callback, reset_page_to, sleep) {

		var arr = [];
		var source = self.get();

		if (reset_page_to === true)
			reset_page_to = source.page;

		if (page_from === true)
			reset_page_to = source.page;

		pages_count = page_from + pages_count;

		if (pages_count > source.pages)
			pages_count = source.pages;

		for (var i = page_from; i < pages_count; i++)
			arr.push(i);

		!arr.length && arr.push(page_from);

		var index = 0;
		var rows = [];

		arr.wait(function(page, next) {
			opt.scroll = (index++) === 0;
			self.get().page = page;
			self.operation('page');
			self.onrenderrows = function(opt) {
				rows.push.apply(rows, opt.rows);
				setTimeout(next, sleep || 100);
			};
		}, function() {
			self.onrenderrows = null;
			callback(rows, opt);
			if (reset_page_to > 0) {
				self.get().page = reset_page_to;
				self.operation('page');
			}
		});
	};

	self.reordercolumn = function(index, position) {

		var col = opt.cols[index];
		if (!col)
			return;

		var old = col.index;

		opt.cols[index].index = position + (old < position ? 0.2 : -0.2);
		opt.cols.quicksort('index');

		for (var i = 0; i < opt.cols.length; i++) {
			col = opt.cols[i];
			col.index = i;
		}

		opt.cols.quicksort('index');

		self.rebindcss();
		self.rendercols();
		self.renderrows(opt.rows);

		opt.sort && opt.sort.sort && self.redrawsorting();
		opt.cluster && opt.cluster.update(opt.render, true);
		self.scrolling();

		config.remember && self.save();
	};

	self.resizecolumn = function(index, size) {
		opt.cols[index].width = size;
		self.rebindcss();
		config.remember && self.save();
		self.resize();
	};

	self.save = function() {

		var cache = {};

		for (var i = 0; i < opt.cols.length; i++) {
			var col = opt.cols[i];
			col.index = i;
			cache[col.realindex] = { index: col.index, width: col.width, hidden: col.hidden };
		}

		if (W.PREF)
			W.PREF.set(self.gridid, cache, '1 month');
		else
			CACHE(self.gridid, cache, '1 month');
	};

	self.rows = function() {
		return opt.rows.slice(0);
	};

	self.resize = function() {

		if (!opt.cols || self.dom.offsetParent == null)
			return;

		var el;
		var sbw = 10;

		switch (config.height) {
			case 'auto':
				el = self.element;
				opt.height = (WH - (el.offset().top + config.bottom) - (config.exec ? 30 : 0)) + sbw;
				vbody.css('height', opt.height);
				break;
			case 'parent':
				el = self.element.parent();
				opt.height = (el.height() - config.bottom - (config.exec ? 30 : 0)) + sbw;
				vbody.css('height', opt.height);
				break;
			default:
				if (config.height > 0) {
					vbody.css('height', config.height);
					opt.height = config.height;
				} else {
					el = self.element.closest(config.height);
					opt.height = (el.height() - config.bottom - (config.exec ? 30 : 0)) + sbw;
					vbody.css('height', opt.height);
				}
				break;
		}

		var w;

		if (config.fullwidth_xs && WIDTH() === 'xs' && isMOBILE) {
			var isfrm = false;
			try {
				isfrm = window.self !== window.top;
			} catch (e) {
				isfrm = true;
			}
			if (isfrm) {
				w = screen.width - (self.element.offset().left * 2);
				self.css('width', w);
			}
		}

		if (w == null)
			w = self.width();

		var width = (config.numbering !== false ? 40 : 0) + (config.checkbox ? 40 : 0) + 30;

		for (var i = 0; i < opt.cols.length; i++) {
			var col = opt.cols[i];
			if (!col.hidden)
				width += col.width;
		}

		if (w > width)
			width = w - 2;

		vcontainer.css('width', width);
		varea.css('width', width + 50);
		vscrollbararea.css('height', opt.height - 1);
		hscrollbararea.css('width', w);

		var plus = hbody.offset().top;

		if (plus < 24)
			plus = 24;

		hbody.css('height', opt.height + 50 + plus);
		hcontainer.css('height', opt.height + 50 + 7);

		opt.width2 = w;
		var hb = hbody[0];
		var issh = ((hb.scrollWidth - hb.clientWidth) < 5);

		hscrollbararea.tclass('hidden', issh);
		self.tclass('dg-scroll-h', !issh);

		if (!issh) {
			hbody.css('height', (opt.height + 50 + plus) - sbw);
			vbody.css('height', opt.height - sbw);
			hcontainer.css('height', (opt.height + 50 + 7) - sbw);
			vscrollbararea.css('height', opt.height - 1 - sbw);
		}

		setTimeout2(self.ID, function() {
			var vb = vbody[0];
			var hb = hbody[0];

			var ish = isMOBILE || (hb.scrollWidth - hb.clientWidth) < 5;
			if (!ish) {
				hbody.css('height', (opt.height + 50 + plus) - sbw);
				vbody.css('height', opt.height - sbw);
				hcontainer.css('height', (opt.height + 50 + 7) - sbw);
				vscrollbararea.css('height', opt.height - 1 - sbw);
			}

			hscrollbar.rclass('hidden');
			vscrollbar.rclass('hidden');

			// Scrollbars
			vscrollbararea.tclass('hidden', isMOBILE || (vb.scrollHeight - vb.clientHeight) < 5);
			hscrollbararea.tclass('hidden', ish);

			var barsize = (w * (w / width)) >> 0;
			if (barsize < 30)
				barsize = 30;

			hscrollbar.css('width', barsize);
			opt.hbarsize = barsize;
			opt.hbar = !ish;
			sh.size = barsize;

			barsize = (opt.height * (opt.height / vb.scrollHeight)) >> 0;
			if (barsize < 30)
				barsize = 30;

			sv.size = barsize;
			vscrollbar.css('height', barsize);
			opt.vbarsize = barsize;

			// Empty rows
			var min = ((opt.height / config.rowheight) >> 0) + 1;
			var is = (opt.rows ? opt.rows.length : 0) < min;
			self.tclass('dg-noscroll', is);

			// rescroll
			vbody[0].scrollTop = vbody[0].scrollTop - 1;
			hbody[0].scrollLeft = hbody[0].scrollLeft - 1;
		}, 500);
	};

	self.refreshfilter = function(useraction) {

		// Get data
		var obj = self.get() || EMPTYARRAY;
		var items = (obj instanceof Array ? obj : obj.items) || EMPTYARRAY;
		var output = [];

		if (isredraw) {
			if (isredraw === 2) {
				self.fn_in_checked();
				self.fn_in_changed();
			}
		} else {
			opt.checked = {};
			config.checkbox && header.find('.dg-checkbox').rclass('dg-checked');
			self.fn_in_checked(EMPTYARRAY);
		}

		for (var i = 0, length = items.length; i < length; i++) {
			var item = items[i];

			item.ROW = i;

			if (!config.exec) {
				if (opt.filter && !self.filter(item))
					continue;
				if (opt.search) {
					for (var j = 0; j < opt.cols.length; j++) {
						var col = opt.cols[j];
						if (col.search)
							item['$' + col.name] = col.search(item);
					}
				}
			}

			output.push(item);
		}

		if (!isredraw) {

			if (opt.scroll) {
				vbody[0].scrollTop = 0;
				if (useraction)	{
					var sl = hbody[0].scrollLeft;
					hbody[0].scrollLeft = sl ? sl - 1 : 0;
				} else
					hbody[0].scrollLeft = 0;
				opt.scroll = false;
			}

			if (opt.sort != null) {
				opt.sort.sort && output.quicksort(opt.sort.name, opt.sort.sort === 1);
				self.redrawsorting();
			}
		}

		self.resize();
		self.renderrows(output, isredraw);

		setTimeout(self.resize, 100);
		opt.cluster && opt.cluster.update(opt.render, opt.scroll == false);
		self.scrolling();

		if (isredraw) {
			if (isredraw === 2) {
				// re-update all items
				self.select(self.selected || null);
			}
		} else {
			if (config.autoselect && output && output.length) {
				setTimeout(function() {
					self.select(output[0]);
				}, 1);
			} else if (opt.operation !== 'sort')
				self.select(null);
		}
	};

	self.redrawsorting = function() {
		self.find('.dg-sorting').each(function() {
			var el = $(this);
			var col = opt.cols[+el.attrd('index')];
			if (col) {
				var fa = el.find('.dg-sort').rclass2('fa-');
				switch (col.sort) {
					case 1:
						fa.aclass('fa-arrow-up');
						break;
					case 2:
						fa.aclass('fa-arrow-down');
						break;
					default:
						fa.aclass('fa-sort');
						break;
				}
			}
		});
	};

	self.resetcolumns = function() {

		if (W.PREF)
			W.PREF.set(self.gridid);
		else
			CACHE(self.gridid, null, '-1 day');

		self.rebind(opt.declaration);
		self.cols(NOOP);
		ecolumns.aclass('hidden');
		isecolumns = false;
	};

	self.resetfilter = function() {
		opt.filter = {};
		opt.filtercache = {};
		opt.filtervalues = {};
		opt.cols && self.rendercols();
		if (config.exec)
			self.operation('refresh');
		else
			self.refresh();
	};

	self.redrawpagination = function() {

		if (!config.exec)
			return;

		var value = self.get();

		footer.find('button').each(function() {

			var el = $(this);
			var dis = true;

			switch (this.name) {
				case 'page-next':
					dis = value.page >= value.pages;
					break;
				case 'page-prev':
					dis = value.page === 1;
					break;
				case 'page-last':
					dis = value.page === value.pages;
					break;
				case 'page-first':
					dis = value.page === 1;
					break;
			}

			el.prop('disabled', dis);
		});

		footer.find('input')[0].value = value.page;
		footer.find('.dg-pagination-pages')[0].innerHTML = value.pages.pluralize.apply(value.pages, config.pluralizepages);
		footer.find('.dg-pagination-items')[0].innerHTML = value.count.pluralize.apply(value.count, config.pluralizeitems);
		footer.rclass('hidden');
	};

	self.setter = function(value) {

		if (!opt.cols)
			return;

		if (config.exec && value == null) {
			self.operation('refresh');
			return;
		}

		opt.checked = {};
		opt.scroll = true;

		self.applycolumns();
		self.refreshfilter();
		self.redrawsorting();
		self.redrawpagination();
		self.fn_in_changed();
		!config.exec && self.rendercols();
		setTimeout2(self.ID + 'resize', self.resize, 100);

		if (opt.cluster)
			return;

		config.exec && self.rendercols();
		opt.cluster = new Cluster(vbody);
		opt.cluster.grid = self;
		opt.cluster.scroll = self.scrolling;
		opt.render && opt.cluster.update(opt.render);

		self.aclass('dg-visible');
	};

	self.scrolling = function() {
		config.checkbox && setTimeout2(self.ID, function() {
			vbody.find('.dg-checkbox').each(function() {
				$(this).tclass('dg-checked', opt.checked[this.getAttribute('data-value')] == 1);
			});
		}, 80, 10);
	};

	var REG_STRING = /\/\|\\|,/;
	var REG_DATE1 = /\s-\s/;
	var REG_DATE2 = /\/|\||\\|,/;
	var REG_SPACE = /\s/g;

	self.filter = function(row) {
		var keys = Object.keys(opt.filter);
		for (var i = 0; i < keys.length; i++) {

			var column = keys[i];
			var filter = opt.filter[column];
			var val2 = opt.filtercache[column];
			var val = row['$' + column] || row[column];
			var type = typeof(val);

			if (val instanceof Array) {
				val = val.join(' ');
				type = 'string';
			} else if (val && type === 'object' && !(val instanceof Date)) {
				val = JSON.stringify(val);
				type = 'string';
			}

			if (type === 'number') {

				if (val2 == null)
					val2 = opt.filtercache[column] = self.parseNumber(filter);

				if (val2.length === 1 && val !== val2[0])
					return false;

				if (val < val2[0] || val > val2[1])
					return false;

			} else if (type === 'string') {

				if (val2 == null) {
					val2 = opt.filtercache[column] = filter.split(REG_STRING).trim();
					for (var j = 0; j < val2.length; j++)
						val2[j] = val2[j].toSearch();
				}

				var is = false;
				var s = val.toSearch();

				for (var j = 0; j < val2.length; j++) {
					if (s.indexOf(val2[j]) !== -1) {
						is = true;
						break;
					}
				}

				if (!is)
					return false;

			} else if (type === 'boolean') {
				if (val2 == null)
					val2 = opt.filtercache[column] = typeof(filter) === 'string' ? config.boolean.indexOf(filter.replace(REG_SPACE, '')) !== -1 : filter;
				if (val2 !== val)
					return false;
			} else if (val instanceof Date) {

				val.setHours(0);
				val.setMinutes(0);

				if (val2 == null) {

					val2 = filter.trim().replace(REG_DATE1, '/').split(REG_DATE2).trim();
					var arr = opt.filtercache[column] = [];

					for (var j = 0; j < val2.length; j++) {
						var dt = val2[j].trim();
						var a = self.parseDate(dt, j === 1);
						if (a instanceof Array) {
							if (val2.length === 2) {
								arr.push(j ? a[1] : a[0]);
							} else {
								arr.push(a[0]);
								if (j === val2.length - 1) {
									arr.push(a[1]);
									break;
								}
							}
						} else
							arr.push(a);
					}

					if (val2.length === 2 && arr.length === 2) {
						arr[1].setHours(23);
						arr[1].setMinutes(59);
						arr[1].setSeconds(59);
					}

					val2 = arr;
				}

				if (val2.length === 1) {
					if (val2[0].YYYYMM)
						return val.format('yyyyMM') === val2[0].format('yyyyMM');
					if (val.format('yyyyMMdd') !== val2[0].format('yyyyMMdd'))
						return false;
				}

				if (val < val2[0] || val > val2[1])
					return false;

			} else
				return false;
		}

		return true;
	};

	self.checked = function() {
		var arr = Object.keys(opt.checked);
		var output = [];
		var model = self.get() || EMPTYARRAY;
		var rows = model instanceof Array ? model : model.items;
		for (var i = 0; i < arr.length; i++) {
			var index = +arr[i];
			output.push(rows[index]);
		}
		return output;
	};

	self.changed = function() {
		var output = [];
		var model = self.get() || EMPTYARRAY;
		var rows = model instanceof Array ? model : model.items;
		for (var i = 0; i < rows.length; i++)
			rows[i].CHANGES && output.push(rows[i]);
		return output;
	};

	self.parseDate = function(val, second) {

		var index = val.indexOf('.');
		var m, y, d, a, special, tmp;

		if (index === -1) {
			if ((/[a-z]+/).test(val)) {
				var dt;
				try {
					dt = NOW.add(val);
				} catch (e) {
					return [0, 0];
				}
				return dt > NOW ? [NOW, dt] : [dt, NOW];
			}
			if (val.length === 4)
				return [new Date(+val, 0, 1), new Date(+val + 1, 0, 1)];
		} else if (val.indexOf('.', index + 1) === -1) {
			a = val.split('.');
			if (a[1].length === 4) {
				y = +a[1];
				m = +a[0] - 1;
				d = second ? new Date(y, m, 0).getDate() : 1;
				special = true;
			} else {
				y = NOW.getFullYear();
				m = +a[1] - 1;
				d = +a[0];
			}

			tmp = new Date(y, m, d);
			if (special)
				tmp.YYYYMM = true;
			return tmp;
		}
		index = val.indexOf('-');
		if (index !== -1 && val.indexOf('-', index + 1) === -1) {
			a = val.split('-');
			if (a[0].length === 4) {
				y = +a[0];
				m = +a[1] - 1;
				d = second ? new Date(y, m, 0).getDate() : 1;
				special = true;
			} else {
				y = NOW.getFullYear();
				m = +a[0] - 1;
				d = +a[1];
			}

			tmp = new Date(y, m, d);

			if (special)
				tmp.YYYYMM = true;

			return tmp;
		}

		return val.parseDate();
	};

	var REG_NUM1 = /\s-\s/;
	var REG_COMMA = /,/g;
	var REG_NUM2 = /\/|\|\s-\s|\\/;

	self.parseNumber = function(val) {
		var arr = [];
		var num = val.replace(REG_NUM1, '/').replace(REG_SPACE, '').replace(REG_COMMA, '.').split(REG_NUM2).trim();
		for (var i = 0, length = num.length; i < length; i++) {
			var n = num[i];
			arr.push(+n);
		}
		return arr;
	};
});

COMPONENT('panel', 'width:350;icon:circle-o;zindex:12;bg:true', function(self, config) {

	var W = window;

	if (!W.$$panel) {

		W.$$panel_level = W.$$panel_level || 1;
		W.$$panel = true;

		$(document).on('click touchend', '.ui-panel-button-close,.ui-panel-container', function(e) {
			var target = $(e.target);
			var curr = $(this);
			var main = target.hclass('ui-panel-container');
			if (curr.hclass('ui-panel-button-close') || main) {
				var parent = target.closest('.ui-panel-container');
				var com = parent.component();
				if (!main || com.config.bgclose) {

					if (config.close)
						EXEC(config.close, com);
					else
						com.hide();

					e.preventDefault();
					e.stopPropagation();
				}
			}
		});

		$(W).on('resize', function() {
			SETTER('panel', 'resize');
		});
	}

	self.readonly();

	self.hide = function() {
		self.set('');
	};

	self.resize = function() {
		var el = self.element.find('.ui-panel-body');
		var bottom = config.bottom || 0;
		var plus = 0; //common.META ? 21 : 0;
		if (plus)
			bottom += plus;
		el.height(WH - self.find('.ui-panel-header').height() - bottom);
		config.top && self.element.css('top', (config.top + (common.META ? (plus + 1) : 1) + 'px'));
	};

	self.icon = function(value) {
		var el = this.rclass2('fa');
		value.icon && el.aclass('fa fa-' + value.icon);
	};

	self.make = function() {
		$(document.body).append('<div id="{0}" class="hidden ui-panel-container{3}"><div class="ui-panel" style="max-width:{1}px"><div data-bind="@config__change .ui-panel-icon:@icon__html span:value.title" class="ui-panel-title"><button class="ui-panel-button-close{2}"><i class="fa fa-times"></i></button><i class="ui-panel-icon"></i><span></span></div><div class="ui-panel-header"></div><div class="ui-panel-body"></div></div>'.format(self.ID, config.width, config.closebutton == false ? ' hidden' : '', config.bg ? '' : ' ui-panel-inline'));
		var el = $('#' + self.ID);
		el.find('.ui-panel-body')[0].appendChild(self.dom);
		self.rclass('hidden');
		self.replace(el);
		self.find('button').on('click', function() {
			switch (this.name) {
				case 'cancel':
					self.hide();
					break;
			}
		});
	};

	self.configure = function(key, value, init) {
		switch (key) {
			case 'bg':
				self.tclass('ui-panel-inline', !value);
				self.element.css('max-width', config.bg ? 'inherit' : config.width);
				break;
			case 'closebutton':
				!init && self.find('.ui-panel-button-close').tclass(value !== true);
				break;
			case 'width':
				self.element.css('max-width', config.bg ? 'inherit' : value);
				break;
		}
	};

	self.setter = function(value) {

		setTimeout2('ui-panel-noscroll', function() {
			$('html').tclass('ui-panel-noscroll', !!$('.ui-panel-container').not('.hidden').length);
		}, 50);

		var isHidden = value !== config.if;

		if (self.hclass('hidden') === isHidden)
			return;

		setTimeout2('panelreflow', function() {
			EMIT('reflow', self.name);
		}, 10);

		if (isHidden) {
			self.aclass('hidden');
			self.release(true);
			self.rclass('ui-panel-animate');
			W.$$panel_level--;
			return;
		}

		if (W.$$panel_level < 1)
			W.$$panel_level = 1;

		W.$$panel_level++;

		var container = self.element.find('.ui-panel-body');

		self.css('z-index', W.$$panel_level * config.zindex);
		container.scrollTop(1);
		self.rclass('hidden');
		self.release(false);
		setTimeout(self.resize, 50);

		config.reload && EXEC(config.reload, self);
		config.default && DEFAULT(config.default, true);

		if (!isMOBILE && config.autofocus) {
			var el = self.find(config.autofocus === true ? 'input[type="text"],select,textarea' : config.autofocus);
			el.length && el[0].focus();
		}

		setTimeout(function() {
			container.scrollTop(0);
			self.aclass('ui-panel-animate');
		}, 100);

		// Fixes a problem with freezing of scrolling in Chrome
		setTimeout2(self.id, function() {
			self.css('z-index', (W.$$panel_level * config.zindex) + 1);
		}, 1000);
	};
});

COMPONENT('importer', function(self, config) {

	var init = false;
	var clid = null;
	var pending = false;
	var content = '';

	self.readonly();

	self.make = function() {
		var scr = self.find('script');
		content = scr.length ? scr.html() : '';
	};

	self.reload = function(recompile) {
		config.reload && EXEC(config.reload);
		recompile && COMPILE();
		pending = false;
	};

	self.setter = function(value) {

		if (pending)
			return;

		if (config.if !== value) {
			if (config.cleaner && init && !clid)
				clid = setTimeout(self.clean, config.cleaner * 60000);
			return;
		}

		pending = true;

		if (clid) {
			clearTimeout(clid);
			clid = null;
		}

		if (init) {
			self.reload();
			return;
		}

		init = true;

		if (content) {
			self.html(content);
			setTimeout(self.reload, 50, true);
		} else
			self.import(config.url, self.reload);
	};

	self.clean = function() {
		config.clean && EXEC(config.clean);
		setTimeout(function() {
			self.empty();
			init = false;
			clid = null;
		}, 1000);
	};
});

COMPONENT('selectbox', function(self, config) {

	var Eitems, Eselected, datasource, condition;

	self.datasource = EMPTYARRAY;
	self.template = Tangular.compile('<li data-search="{{ search }}" data-index="{{ index }}">{{ text }}</li>');
	self.nocompile && self.nocompile();

	self.validate = function(value) {
		return config.disabled || !config.required ? true : value && value.length > 0;
	};

	self.configure = function(key, value) {

		var redraw = false;

		switch (key) {
			case 'type':
				self.type = value;
				break;
			case 'disabled':
				self.tclass('ui-disabled', value);
				self.find('input').prop('disabled', value);
				if (value)
					self.rclass('ui-selectbox-invalid');
				else if (config.required)
					self.state(1, 1);
				break;
			case 'if':
				condition = value ? FN(value) : null;
				break;
			case 'required':
				!value && self.state(1, 1);
				break;
			case 'height':
			case 'search':
				redraw = true;
				break;
			case 'items':
				var arr = [];
				value.split(',').forEach(function(item) {
					item = item.trim().split('|');
					var obj = {};
					obj.name = item[0].trim();
					obj.id = (item[1] == null ? item[0] : item[1]).trim();
					if (config.type === 'number')
						obj.id = +obj.id;
					arr.push(obj);
				});
				self.bind('', arr);
				break;
			case 'datasource':
				datasource && self.unwatch(datasource, self.bind);
				self.watch(value, self.bind, true);
				datasource = value;
				break;
		}

		redraw && self.redraw();
	};

	self.search = function() {
		var search = config.search ? self.find('input').val().toSearch() : '';
		Eitems.find('li').each(function() {
			var el = $(this);
			el.tclass('hidden', el.attrd('search').indexOf(search) === -1);
		});
		self.find('.ui-selectbox-search-icon').tclass('fa-search', search.length === 0).tclass('fa-times', search.length > 0);
	};

	self.redraw = function() {
		self.html((typeof(config.search) === 'string' ? '<div class="ui-selectbox-search"><span><i class="fa fa-search ui-selectbox-search-icon"></i></span><div><input type="text" placeholder="{0}" /></div></div><div>'.format(config.search) : '') + '<div style="height:{0}px"><ul></ul><ul style="height:{0}px"></ul></div>'.format(config.height || '200'));
		self.find('ul').each(function(index) {
			if (index)
				Eselected = $(this);
			else
				Eitems = $(this);
		});
	};

	self.bind = function(path, value) {

		var kt = config.text || 'name';
		var kv = config.value || 'id';
		var builder = [];

		self.datasource = [];

		if (value) {
			var index = 0;
			for (var i = 0; i < value.length; i++) {
				var item = value[i];

				if (condition && !condition(item))
					continue;

				var text, val;

				if (typeof(item) === 'string') {
					text = item;
					val = self.parser(item);
				} else {
					text = item[kt];
					val = item[kv];
				}

				var item = { text: text, value: val, index: index++, search: text.toSearch() };
				self.datasource.push(item);
				builder.push(self.template(item));
			}
		}

		Eitems.empty().append(builder.join(''));
		self.refresh();
		self.search();
	};

	self.make = function() {

		self.aclass('ui-selectbox');
		self.redraw();

		self.event('click', 'li', function() {
			if (config.disabled)
				return;
			var selected = self.get() || [];
			var index = +this.getAttribute('data-index');
			var value = self.datasource[index];

			if (selected.indexOf(value.value) === -1)
				selected.push(value.value);
			else
				selected = selected.remove(value.value);

			self.set(selected);
			self.change(true);
		});

		self.event('click', '.fa-times', function() {
			if (!config.disabled) {
				self.find('input').val('');
				self.search();
			}
		});

		typeof(config.search) === 'string' && self.event('keydown', 'input', function() {
			!config.disabled && setTimeout2(self.id, self.search, 500);
		});
	};

	self.setter = function(value) {

		var selected = {};
		var builder = [];

		var ds = self.datasource;
		var dsl = ds.length;

		if (value) {
			for (var i = 0, length = value.length; i < length; i++) {
				for (var j = 0; j < dsl; j++) {
					if (ds[j].value === value[i]) {
						selected[j] = true;
						builder.push(self.template(ds[j]));
					}
				}
			}
		}

		Eitems.find('li').each(function() {
			var el = $(this);
			var index = +el.attrd('index');
			el.tclass('ui-selectbox-selected', selected[index] !== undefined);
		});

		Eselected.empty().append(builder.join(''));
		self.search();
	};

	self.state = function(type) {
		if (type) {
			var invalid = config.required ? self.isInvalid() : false;
			if (invalid !== self.$oldstate) {
				self.$oldstate = invalid;
				self.tclass('ui-selectbox-invalid', invalid);
			}
		}
	};
});

COMPONENT('textbox', function(self, config) {

	var input, content = null;

	self.nocompile && self.nocompile();

	self.validate = function(value) {

		if (!config.required || config.disabled)
			return true;

		if (self.type === 'date')
			return value instanceof Date && !isNaN(value.getTime());

		if (value == null)
			value = '';
		else
			value = value.toString();

		EMIT('reflow', self.name);

		if (config.minlength && value.length < config.minlength)
			return false;

		switch (self.type) {
			case 'email':
				return value.isEmail();
			case 'phone':
				return value.isPhone();
			case 'url':
				return value.isURL();
			case 'currency':
			case 'number':
				return value > 0;
		}

		return config.validation ? !!self.evaluate(value, config.validation, true) : value.length > 0;
	};

	self.make = function() {

		content = self.html();

		self.type = config.type;
		self.format = config.format;

		self.event('click', '.fa-calendar', function(e) {
			if (!config.disabled && !config.readonly && config.type === 'date') {
				e.preventDefault();
				SETTER('calendar', 'toggle', self.element, self.get(), function(date) {
					self.change(true);
					self.set(date);
				});
			}
		});

		self.event('click', '.fa-caret-up,.fa-caret-down', function() {
			if (!config.disabled && !config.readonly && config.increment) {
				var el = $(this);
				var inc = el.hclass('fa-caret-up') ? 1 : -1;
				self.change(true);
				self.inc(inc);
			}
		});

		self.event('click', '.ui-textbox-control-icon', function() {
			if (config.disabled || config.readonly)
				return;
			if (self.type === 'search') {
				self.$stateremoved = false;
				$(this).rclass('fa-times').aclass('fa-search');
				self.set('');
			} else if (config.icon2click)
				EXEC(config.icon2click, self);
		});

		self.event('focus', 'input', function() {
			if (!config.disabled && !config.readonly && config.autocomplete)
				EXEC(config.autocomplete, self);
		});

		self.redraw();
	};

	self.redraw = function() {

		var attrs = [];
		var builder = [];
		var tmp = 'text';

		switch (config.type) {
			case 'password':
				tmp = config.type;
				break;
			case 'number':
			case 'phone':
				isMOBILE && (tmp = 'tel');
				break;
		}

		self.tclass('ui-disabled', config.disabled === true);
		self.tclass('ui-textbox-required', config.required === true);
		self.type = config.type;
		attrs.attr('type', tmp);
		config.placeholder && attrs.attr('placeholder', config.placeholder);
		config.maxlength && attrs.attr('maxlength', config.maxlength);
		config.keypress != null && attrs.attr('data-jc-keypress', config.keypress);
		config.delay && attrs.attr('data-jc-keypress-delay', config.delay);
		config.disabled && attrs.attr('disabled');
		config.readonly && attrs.attr('readonly');
		config.error && attrs.attr('error');
		attrs.attr('data-jc-bind', '');

		config.autofill && attrs.attr('name', self.path.replace(/\./g, '_'));
		config.align && attrs.attr('class', 'ui-' + config.align);
		!isMOBILE && config.autofocus && attrs.attr('autofocus');

		builder.push('<div class="ui-textbox-input"><input {0} /></div>'.format(attrs.join(' ')));

		var icon = config.icon;
		var icon2 = config.icon2;

		if (!icon2 && self.type === 'date')
			icon2 = 'calendar';
		else if (self.type === 'search') {
			icon2 = 'search';
			self.setter2 = function(value) {
				if (self.$stateremoved && !value)
					return;
				self.$stateremoved = !value;
				self.find('.ui-textbox-control-icon').tclass('fa-times', !!value).tclass('fa-search', !value);
			};
		}

		icon2 && builder.push('<div class="ui-textbox-control"><span class="fa fa-{0} ui-textbox-control-icon"></span></div>'.format(icon2));
		config.increment && !icon2 && builder.push('<div class="ui-textbox-control"><span class="fa fa-caret-up"></span><span class="fa fa-caret-down"></span></div>');

		if (config.label)
			content = config.label;

		if (content.length) {
			var html = builder.join('');
			builder = [];
			builder.push('<div class="ui-textbox-label">');
			icon && builder.push('<i class="fa fa-{0}"></i> '.format(icon));
			builder.push('<span>' + content + (content.substring(content.length - 1) === '?' ? '' : ':') + '</span>');
			builder.push('</div><div class="ui-textbox">{0}</div>'.format(html));
			config.error && builder.push('<div class="ui-textbox-helper"><i class="fa fa-warning" aria-hidden="true"></i> {0}</div>'.format(config.error));
			self.html(builder.join(''));
			self.aclass('ui-textbox-container');
			input = self.find('input');
		} else {
			config.error && builder.push('<div class="ui-textbox-helper"><i class="fa fa-warning" aria-hidden="true"></i> {0}</div>'.format(config.error));
			self.aclass('ui-textbox ui-textbox-container');
			self.html(builder.join(''));
			input = self.find('input');
		}
	};

	self.configure = function(key, value, init) {

		if (init)
			return;

		var redraw = false;

		switch (key) {
			case 'readonly':
				self.find('input').prop('readonly', value);
				break;
			case 'disabled':
				self.tclass('ui-disabled', value);
				self.find('input').prop('disabled', value);
				self.reset();
				break;
			case 'format':
				self.format = value;
				self.refresh();
				break;
			case 'required':
				self.noValid(!value);
				!value && self.state(1, 1);
				self.tclass('ui-textbox-required', value === true);
				break;
			case 'placeholder':
				input.prop('placeholder', value || '');
				break;
			case 'maxlength':
				input.prop('maxlength', value || 1000);
				break;
			case 'autofill':
				input.prop('name', value ? self.path.replace(/\./g, '_') : '');
				break;
			case 'label':
				if (content && value)
					self.find('.ui-textbox-label span').html(value);
				else
					redraw = true;
				content = value;
				break;
			case 'type':
				self.type = value;
				if (value === 'password')
					value = 'password';
				else
					self.type = 'text';
				self.find('input').prop('type', self.type);
				break;
			case 'align':
				input.rclass(input.attr('class')).aclass('ui-' + value || 'left');
				break;
			case 'autofocus':
				input.focus();
				break;
			case 'icon':
				var tmp = self.find('.ui-textbox-label .fa');
				if (tmp.length)
					tmp.rclass2('fa-').aclass('fa-' + value);
				else
					redraw = true;
				break;
			case 'icon2':
			case 'increment':
				redraw = true;
				break;
		}

		redraw && setTimeout2('redraw.' + self.id, function() {
			self.redraw();
			self.refresh();
		}, 100);
	};

	self.formatter(function(path, value) {
		if (value) {
			switch (config.type) {
				case 'lower':
					value = value.toString().toLowerCase();
					break;
				case 'upper':
					value = value.toString().toUpperCase();
					break;
			}
		}
		return config.type === 'date' ? (value ? value.format(config.format || 'yyyy-MM-dd') : value) : value;
	});

	self.parser(function(path, value) {
		if (value) {
			switch (config.type) {
				case 'lower':
					value = value.toLowerCase();
					break;
				case 'upper':
					value = value.toUpperCase();
					break;
			}
		}
		return value ? config.spaces === false ? value.replace(/\s/g, '') : value : value;
	});

	self.state = function(type) {
		if (!type)
			return;
		var invalid = config.required ? self.isInvalid() : false;
		if (invalid === self.$oldstate)
			return;
		self.$oldstate = invalid;
		self.tclass('ui-textbox-invalid', invalid);
		config.error && self.find('.ui-textbox-helper').tclass('ui-textbox-helper-show', invalid);
	};
});

COMPONENT('menu', function(self) {

	self.singleton();
	self.readonly();
	self.nocompile && self.nocompile();

	var cls = 'ui-menu';
	var cls2 = '.' + cls;

	var is = false;
	var issubmenu = false;
	var isopen = false;
	var events = {};
	var ul, children, prevsub;

	self.make = function() {
		self.aclass(cls + ' hidden');
		self.append('<div class="{0}-items"><ul></ul></div><div class="{0}-submenu hidden"><ul></ul></div>'.format(cls));
		ul = self.find(cls2 + '-items').find('ul');
		children = self.find(cls2 + '-submenu');

		self.event('click', 'li', function(e) {

			clearTimeout2(self.ID);

			var el = $(this);
			if (el.hclass(cls + '-divider')) {
				e.preventDefault();
				e.stopPropagation();
			} else {

				var index = el.attrd('index').split('-');
				if (index.length > 1) {
					// submenu
					self.opt.callback(self.opt.items[+index[0]].children[+index[1]]);
					self.hide();
				} else if (!issubmenu) {
					self.opt.callback(self.opt.items[+index[0]]);
					self.hide();
				}
			}
		});

		events.hide = function() {
			is && self.hide();
		};

		self.event('scroll', events.hide);
		self.on('reflow', events.hide);
		self.on('scroll', events.hide);
		self.on('resize', events.hide);

		events.click = function(e) {
			if (is && !isopen && (!self.target || (self.target !== e.target && !self.target.contains(e.target))))
				setTimeout2(self.ID, self.hide, 300);
		};

		events.hidechildren = function() {
			if ($(this.parentNode.parentNode).hclass(cls + '-items')) {
				if (prevsub && prevsub[0] !== this) {
					prevsub.rclass(cls + '-selected');
					prevsub = null;
					children.aclass('hidden');
					issubmenu = false;
				}
			}
		};

		events.children = function() {

			if (prevsub && prevsub[0] !== this) {
				prevsub.rclass(cls + '-selected');
				prevsub = null;
			}

			issubmenu = true;
			isopen = true;

			setTimeout(function() {
				isopen = false;
			}, 500);

			var el = prevsub = $(this);
			var index = +el.attrd('index');
			var item = self.opt.items[index];

			el.aclass(cls + '-selected');

			var html = self.makehtml(item.children, index);
			children.find('ul').html(html);
			children.rclass('hidden');

			var css = {};
			var offset = el.position();

			css.left = ul.width() - 5;
			css.top = offset.top - 5;

			var offsetX = offset.left;

			offset = self.element.offset();

			var w = children.width();
			var left = offset.left + css.left + w;
			if (left > WW + 30)
				css.left = (offsetX - w) + 5;

			children.css(css);
		};
	};

	self.bindevents = function() {
		events.is = true;
		$(document).on('touchstart mouseenter mousedown', cls2 + '-children', events.children);
		$(document).on('touchstart mousedown', events.click);
		$(window).on('scroll', events.hide);
		self.element.on('mouseenter', 'li', events.hidechildren);
	};

	self.unbindevents = function() {
		events.is = false;
		$(document).off('touchstart mouseenter mousedown', cls2 + '-children', events.children);
		$(document).off('touchstart mousedown', events.click);
		$(window).off('scroll', events.hide);
		self.element.off('mouseenter', 'li', events.hidechildren);
	};

	self.showxy = function(x, y, items, callback) {
		var opt = {};
		opt.x = x;
		opt.y = y;
		opt.items = items;
		opt.callback = callback;
		self.show(opt);
	};

	self.makehtml = function(items, index) {
		var builder = [];
		var tmp;
		var shortcutsize = 0;

		for (var i = 0; i < items.length; i++) {
			if (typeof(items[i]) !== 'string' && items[i].shortcut) {
				var l = items[i].shortcut.length;
				if (l > shortcutsize)
					shortcutsize = l;
			}
		}

		if (l)
			l += 5;

		for (var i = 0; i < items.length; i++) {
			var item = items[i];

			if (typeof(item) === 'string') {
				// caption or divider
				if (item === '-')
					tmp = '<hr />';
				else
					tmp = '<span>{0}</span>'.format(item);
				builder.push('<li class="{0}-divider">{1}</li>'.format(cls, tmp));
				continue;
			}

			var cn = item.classname || '';
			var icon = '';

			if (item.icon)
				icon = '<i class="{0}"></i>'.format(item.icon.charAt(0) === '!' ? item.icon.substring(1) : ('fa fa-' + item.icon));
			else
				cn = (cn ? ' ' : '') + cls + '-nofa';

			tmp = '';

			if (index == null && item.children && item.children.length) {
				cn += (cn ? ' ' : '') + cls + '-children';
				tmp += '<i class="fa fa-play pull-right"></i>';
			}

			tmp += '<div class="{0}-name">{1}{2}{3}</div>'.format(cls, icon, item.name + (l ? ''.padLeft(l, '&nbsp;') : ''), item.shortcut ? '<b>{0}</b>'.format(item.shortcut) : '');

			if (item.note)
				tmp += '<div class="ui-menu-note">{0}</div>'.format(item.note);

			builder.push('<li class="{0}" data-index="{2}">{1}</li>'.format(cn, tmp, (index != null ? (index + '-') : '') + i));
		}

		return builder.join('');
	};

	self.show = function(opt) {

		if (typeof(opt) === 'string') {
			// old version
			opt = { align: opt };
			opt.element = arguments[1];
			opt.items = arguments[2];
			opt.callback = arguments[3];
			opt.offsetX = arguments[4];
			opt.offsetY = arguments[5];
		}

		var tmp = opt.element ? opt.element instanceof jQuery ? opt.element[0] : opt.element.element ? opt.element.dom : opt.element : null;

		if (is && tmp && self.target === tmp) {
			self.hide();
			return;
		}

		var tmp;

		self.target = tmp;
		self.opt = opt;

		isopen = false;
		issubmenu = false;
		prevsub = null;

		var css = {};
		children.aclass('hidden');
		children.find('ul').empty();
		clearTimeout2(self.ID);

		ul.html(self.makehtml(opt.items));

		if (is) {
			css.left = 0;
			css.top = 0;
			self.element.css(css);
		} else {
			self.rclass('hidden');
			self.aclass(cls + '-visible', 100);
			is = true;
			if (!events.is)
				self.bindevents();
		}

		var target = $(opt.element);
		var w = self.width();
		var offset = target.offset();

		if (opt.element) {
			switch (opt.align) {
				case 'center':
					css.left = Math.ceil((offset.left - w / 2) + (target.innerWidth() / 2));
					break;
				case 'right':
					css.left = (offset.left - w) + target.innerWidth();
					break;
				default:
					css.left = offset.left;
					break;
			}

			css.top = opt.position === 'bottom' ? (offset.top - self.element.height() - 10) : (offset.top + target.innerHeight() + 10);

		} else {
			css.left = opt.x;
			css.top = opt.y;
		}

		if (opt.offsetX)
			css.left += opt.offsetX;

		if (opt.offsetY)
			css.top += opt.offsetY;

		self.element.css(css);
	};

	self.hide = function() {
		events.is && self.unbindevents();
		is = false;
		self.opt && self.opt.hide && self.opt.hide();
		self.target = null;
		self.opt = null;
		self.aclass('hidden');
		self.rclass(cls + '-visible');
	};

});

COMPONENT('listmenu', 'class:selected;selector:a;property:id;click:true', function(self, config) {

	var old, oldvalue;

	self.readonly();
	self.nocompile && self.nocompile();

	self.make = function() {
		var scr = self.find('script');
		self.template = Tangular.compile(scr.html());
		scr.remove();
	};

	self.configure = function(name, value) {
		switch (name) {
			case 'datasource':
				self.datasource(value, self.rebind);
				break;
		}
	};

	self.rebind = function(path, value) {

		if (!value || !value.length) {
			self.empty();
			return;
		}

		var builder = [];
		var opt = { length: value.length };
		for (var i = 0; i < opt.length; i++) {
			var item = value[i];
			opt.index = i;
			builder.push(self.template(item, opt));
		}

		oldvalue = null;
		self.html(builder.join(''));

		config.click && self.find(config.selector).on('click', function() {
			var index = $(this).index();
			var item = self.get(config.datasource)[index];
			self.set(item[config.property]);
		});

		self.refresh();
	};

	self.setter = function(value) {
		var arr = GET(config.datasource);
		if (arr && arr.length) {
			if (value === oldvalue)
				return;
			oldvalue = value;
			var index = config.property ? arr.findIndex(config.property, value) : arr.indexOf(value);
			old && old.rclass(config.class);
			index !== -1 && (old = self.find(config.selector).eq(index).aclass(config.class));
		}
	};
});

COMPONENT('loading', function(self) {
	var pointer;

	self.readonly();
	self.singleton();
	self.nocompile();

	self.make = function() {
		self.aclass('ui-loading');
		self.append('<div><div class="ui-loading-text"></div></div>');
	};

	self.show = function(text) {
		clearTimeout(pointer);
		self.find('.ui-loading-text').html(text || '');
		self.rclass('hidden');
		return self;
	};

	self.hide = function(timeout) {
		clearTimeout(pointer);
		pointer = setTimeout(function() {
			self.aclass('hidden');
		}, timeout || 1);
		return self;
	};
});

COMPONENT('snackbar', 'timeout:4000;button:OK', function(self, config) {

	var cls = 'ui-snackbar';
	var cls2 = '.' + cls;
	var show = true;
	var callback;
	var delay;

	self.readonly();
	self.blind();
	self.nocompile && self.nocompile();

	self.make = function() {
		self.aclass(cls + ' hidden');
		self.append('<div><span class="{0}-dismiss"></span><span class="{0}-icon"></span><div class="{0}-body"></div></div>'.format(cls));
		self.event('click', cls2 + '-dismiss', function() {
			self.hide();
			callback && callback();
		});
	};

	self.hide = function() {
		clearTimeout2(self.ID);
		self.rclass(cls + '-visible');
		if (delay) {
			clearTimeout(delay);
			self.aclass('hidden');
			delay = null;
		} else {
			delay = setTimeout(function() {
				delay = null;
				self.aclass('hidden');
			}, 1000);
		}
		show = true;
	};

	self.waiting = function(message, button, close) {
		self.show(message, button, close, 'fa-spinner fa-pulse');
	};

	self.success = function(message, button, close) {
		self.show(message, button, close, 'fa-check-circle');
	};

	self.warning = function(message, button, close) {
		self.show(message, button, close, 'fa-times-circle');
	};

	self.show = function(message, button, close, icon) {

		if (typeof(button) === 'function') {
			close = button;
			button = null;
		}

		callback = close;

		self.find(cls2 + '-icon').html('<i class="fa {0}"></i>'.format(icon || 'fa-info-circle'));
		self.find(cls2 + '-body').html(message).attr('title', message);
		self.find(cls2 + '-dismiss').html(button || config.button);

		if (show) {
			self.rclass('hidden');
			setTimeout(function() {
				self.aclass(cls + '-visible');
			}, 50);
		}

		setTimeout2(self.ID, self.hide, config.timeout + 50);
		show = false;
	};
});

COMPONENT('websocket', 'reconnect:3000', function(self, config) {

	var ws, url;
	var queue = [];
	var sending = false;

	self.online = false;
	self.readonly();
	self.nocompile();

	self.make = function() {
		url = (config.url || '').env(true);
		if (!url.match(/^(ws|wss):\/\//))
			url = (location.protocol.length === 6 ? 'wss' : 'ws') + '://' + location.host + (url.substring(0, 1) !== '/' ? '/' : '') + url;
		setTimeout(self.connect, 500);
		self.destroy = self.close;
	};

	self.send = function(obj) {
		queue.push(encodeURIComponent(JSON.stringify(obj)));
		self.process();
		return self;
	};

	self.process = function(callback) {

		if (!ws || !ws.send || sending || !queue.length || ws.readyState !== 1) {
			callback && callback();
			return;
		}

		sending = true;
		var async = queue.splice(0, 3);

		async.wait(function(item, next) {
			if (ws) {
				ws.send(item);
				setTimeout(next, 5);
			} else {
				queue.unshift(item);
				next();
			}
		}, function() {
			callback && callback();
			sending = false;
			queue.length && self.process();
		});
	};

	self.close = function(isClosed) {
		if (!ws)
			return self;
		self.online = false;
		ws.onopen = ws.onclose = ws.onmessage = null;
		!isClosed && ws.close();
		ws = null;
		EMIT('online', false);
		return self;
	};

	function onClose(e) {

		SETTER('lodaing', 'show');

		if (e.code === 4001) {
			location.href = location.href + '';
			return;
		}

		e.reason && WARN('WebSocket:', decodeURIComponent(e.reason));
		self.close(true);
		setTimeout(self.connect, config.reconnect);
	}

	function onMessage(e) {
		var data;
		try {
			data = PARSE(decodeURIComponent(e.data));
			self.attrd('jc-path') && self.set(data);
		} catch (e) {
			WARN('WebSocket "{0}": {1}'.format(url, e.toString()));
		}
		data && EMIT('message', data);
	}

	function onOpen() {
		self.online = true;
		self.process(function() {
			EMIT('online', true);
		});
	}

	self.connect = function() {
		ws && self.close();
		setTimeout2(self.id, function() {
			ws = new WebSocket(url.env(true));
			ws.onopen = onOpen;
			ws.onclose = onClose;
			ws.onmessage = onMessage;
		}, 100);
		return self;
	};
});

COMPONENT('confirm', function(self) {

	var is, visible = false;

	self.readonly();
	self.singleton();
	self.nocompile && self.nocompile();

	self.make = function() {

		self.aclass('ui-confirm hidden');

		self.event('click', 'button', function() {
			self.hide($(this).attrd('index').parseInt());
		});

		self.event('click', function(e) {
			var t = e.target.tagName;
			if (t !== 'DIV')
				return;
			var el = self.find('.ui-confirm-body');
			el.aclass('ui-confirm-click');
			setTimeout(function() {
				el.rclass('ui-confirm-click');
			}, 300);
		});

		$(window).on('keydown', function(e) {
			if (!visible)
				return;
			var index = e.which === 13 ? 0 : e.which === 27 ? 1 : null;
			if (index != null) {
				self.find('button[data-index="{0}"]'.format(index)).trigger('click');
				e.preventDefault();
				e.stopPropagation();
			}
		});
	};

	self.show = self.confirm = function(message, buttons, fn) {
		self.callback = fn;

		var builder = [];

		for (var i = 0; i < buttons.length; i++) {
			var item = buttons[i];
			var icon = item.match(/"[a-z0-9-]+"/);
			if (icon) {
				item = item.replace(icon, '').trim();
				icon = '<i class="fa fa-{0}"></i>'.format(icon.toString().replace(/"/g, ''));
			} else
				icon = '';
			builder.push('<button data-index="{1}">{2}{0}</button>'.format(item, i, icon));
		}

		self.content('ui-confirm-warning', '<div class="ui-confirm-message">{0}</div>{1}'.format(message.replace(/\n/g, '<br />'), builder.join('')));
	};

	self.hide = function(index) {
		self.callback && self.callback(index);
		self.rclass('ui-confirm-visible');
		visible = false;
		setTimeout2(self.id, function() {
			$('html').rclass('ui-confirm-noscroll');
			self.aclass('hidden');
		}, 1000);
	};

	self.content = function(cls, text) {
		$('html').aclass('ui-confirm-noscroll');
		!is && self.html('<div><div class="ui-confirm-body"></div></div>');
		self.find('.ui-confirm-body').empty().append(text);
		self.rclass('hidden');
		visible = true;
		setTimeout2(self.id, function() {
			self.aclass('ui-confirm-visible');
		}, 5);
	};
});

COMPONENT('shortcuts', function(self) {

	var items = [];
	var length = 0;

	self.singleton();
	self.readonly();
	self.blind();
	self.nocompile && self.nocompile();

	self.make = function() {
		$(window).on('keydown', function(e) {
			if (length && !e.isPropagationStopped()) {
				for (var i = 0; i < length; i++) {
					var o = items[i];
					if (o.fn(e)) {
						if (o.prevent) {
							e.preventDefault();
							e.stopPropagation();
						}
						setTimeout(function(o, e) {
							o.callback(e);
						}, 100, o, e);
					}
				}
			}
		});
	};

	self.exec = function(shortcut) {
		var item = items.findItem('shortcut', shortcut.toLowerCase().replace(/\s/g, ''));
		item && item.callback(EMPTYOBJECT);
	};

	self.register = function(shortcut, callback, prevent) {
		shortcut.split(',').trim().forEach(function(shortcut) {
			var builder = [];
			var alias = [];
			shortcut.split('+').trim().forEach(function(item) {
				var lower = item.toLowerCase();
				alias.push(lower);
				switch (lower) {
					case 'ctrl':
					case 'alt':
					case 'shift':
						builder.push('e.{0}Key'.format(lower));
						return;
					case 'win':
					case 'meta':
					case 'cmd':
						builder.push('e.metaKey');
						return;
					case 'ins':
						builder.push('e.keyCode===45');
						return;
					case 'space':
						builder.push('e.keyCode===32');
						return;
					case 'tab':
						builder.push('e.keyCode===9');
						return;
					case 'esc':
						builder.push('e.keyCode===27');
						return;
					case 'enter':
						builder.push('e.keyCode===13');
						return;
					case 'backspace':
					case 'del':
					case 'delete':
						builder.push('(e.keyCode===8||e.keyCode===127)');
						return;
					case 'up':
						builder.push('e.keyCode===38');
						return;
					case 'down':
						builder.push('e.keyCode===40');
						return;
					case 'right':
						builder.push('e.keyCode===39');
						return;
					case 'left':
						builder.push('e.keyCode===37');
						return;
					case 'f1':
					case 'f2':
					case 'f3':
					case 'f4':
					case 'f5':
					case 'f6':
					case 'f7':
					case 'f8':
					case 'f9':
					case 'f10':
					case 'f11':
					case 'f12':
						var a = item.toUpperCase();
						builder.push('e.key===\'{0}\''.format(a));
						return;
					case 'capslock':
						builder.push('e.which===20');
						return;
				}

				var num = item.parseInt();
				if (num)
					builder.push('e.which===' + num);
				else
					builder.push('e.keyCode==={0}'.format(item.toUpperCase().charCodeAt(0)));
			});

			items.push({ shortcut: alias.join('+'), fn: new Function('e', 'return ' + builder.join('&&')), callback: callback, prevent: prevent });
			length = items.length;
		});
		return self;
	};
});

COMPONENT('features', 'height:37', function(self, config) {

	var cls = 'ui-features';
	var cls2 = '.' + cls;
	var container, timeout, input, search, scroller = null;
	var is = false, results = false, selectedindex = 0, resultscount = 0;

	self.oldsearch = '';
	self.items = null;
	self.template = Tangular.compile('<li data-search="{{ $.search }}" data-index="{{ $.index }}"{{ if selected }} class="selected"{{ fi }}>{{ if icon }}<i class="fa fa-{{ icon }}"></i>{{ fi }}{{ name | raw }}</li>');
	self.callback = null;
	self.readonly();
	self.singleton();
	self.nocompile && self.nocompile();

	self.configure = function(key, value, init) {
		if (init)
			return;
		switch (key) {
			case 'placeholder':
				self.find('input').prop('placeholder', value);
				break;
		}
	};

	self.make = function() {

		self.aclass(cls + '-layer hidden');
		self.append('<div class="{1}"><div class="{1}-search"><span><i class="fa fa-search"></i></span><div><input type="text" placeholder="{0}" class="{1}-search-input" /></div></div><div class="{1}-container noscrollbar"><ul></ul></div></div>'.format(config.placeholder, cls));

		container = self.find('ul');
		input = self.find('input');
		search = self.find(cls2);
		scroller = self.find(cls2 + '-container');

		self.event('touchstart mousedown', 'li[data-index]', function(e) {
			self.callback && self.callback(self.items[+this.getAttribute('data-index')]);
			self.hide();
			e.preventDefault();
			e.stopPropagation();
		});

		$(document).on('touchstart mousedown', function(e) {
			is && !$(e.target).hclass(cls + '-search-input') && self.hide(0);
		});

		$(window).on('resize', function() {
			is && self.hide(0);
		});

		self.event('keydown', 'input', function(e) {
			var o = false;
			switch (e.which) {
				case 27:
					o = true;
					self.hide();
					break;
				case 13:
					o = true;
					var sel = self.find('li.selected');
					if (sel.length && self.callback)
						self.callback(self.items[+sel.attrd('index')]);
					else
						self.fallback && self.fallback(input.val());
					self.hide();
					break;
				case 38: // up
					o = true;
					selectedindex--;
					if (selectedindex < 0)
						selectedindex = 0;
					else
						self.move();
					break;
				case 40: // down
					o = true;
					selectedindex++ ;
					if (selectedindex >= resultscount)
						selectedindex = resultscount;
					else
						self.move();
					break;
			}

			if (o && results) {
				e.preventDefault();
				e.stopPropagation();
			}
		});

		self.event('keyup', 'input', function() {
			setTimeout2(self.id, self.search, 100, null, this.value);
		});
	};

	self.search = function(value) {

		if (!value) {
			if (self.oldsearch === value)
				return;
			self.oldsearch = value;
			selectedindex = 0;
			results = true;
			resultscount = self.items.length;
			container.find('li').rclass('hidden selected');
			self.move();
			return;
		}

		if (self.oldsearch === value)
			return;

		self.oldsearch = value;
		value = value.toSearch().split(' ');
		results = false;
		resultscount = 0;
		selectedindex = 0;

		container.find('li').each(function() {
			var el = $(this);
			var val = el.attrd('search');
			var h = false;

			for (var i = 0; i < value.length; i++) {
				if (val.indexOf(value[i]) === -1) {
					h = true;
					break;
				}
			}

			if (!h) {
				results = true;
				resultscount++;
			}

			el.tclass('hidden', h);
			el.rclass('selected');
		});
		self.move();
	};

	self.move = function() {
		var counter = 0;
		var h = scroller.css('max-height').parseInt();

		container.find('li').each(function() {
			var el = $(this);
			if (el.hclass('hidden'))
				return;
			var is = selectedindex === counter;
			el.tclass('selected', is);
			if (is) {
				var t = (config.height * counter) - config.height;
				if ((t + config.height * 5) > h)
					scroller.scrollTop(t);
				else
					scroller.scrollTop(0);
			}
			counter++;
		});
	};

	self.show = function(items, callback, fallback) {

		if (is) {
			clearTimeout(timeout);
			self.hide(0);
			return;
		}

		var type = typeof(items);
		var item;

		if (type === 'string')
			items = self.get(items);

		if (!items) {
			self.hide(0);
			return;
		}

		self.items = items;
		self.callback = callback;
		self.fallback = fallback;
		results = true;
		resultscount = self.items.length;

		input.val('');

		var builder = [];
		var indexer = {};

		for (var i = 0, length = items.length; i < length; i++) {
			item = items[i];
			indexer.index = i;
			indexer.search = (item.name + ' ' + (item.keywords || '')).trim().toSearch();
			!item.value && (item.value = item.name);
			builder.push(self.template(item, indexer));
		}

		container.html(builder);

		var W = $(window);
		var top = ((W.height() / 2) - (search.height() / 2)) - scroller.css('max-height').parseInt();
		var options = { top: top, left: (W.width() / 2) - (search.width() / 2) };

		search.css(options);
		self.move();

		if (is)
			return;

		self.rclass('hidden');

		setTimeout(function() {
			self.aclass(cls + '-visible');
		}, 100);

		!isMOBILE && setTimeout(function() {
			input.focus();
		}, 500);

		is = true;
		$('html,body').aclass(cls + '-noscroll');
	};

	self.hide = function(sleep) {
		if (!is)
			return;
		clearTimeout(timeout);
		timeout = setTimeout(function() {
			self.aclass('hidden').rclass(cls + '-visible');
			self.callback = null;
			self.target = null;
			is = false;
			$('html,body').rclass(cls + '-noscroll');
		}, sleep ? sleep : 100);
	};
});

COMPONENT('statusform', function(self, config) {

	var el, input, formtype;

	self.singleton();

	self.make = function() {
		el = self.find('.statusform-item');
		self.event('keydown', 'input', function(e) {
			if (e.which === 13) {
				var input = $(this);
				EXEC(config.exec, input.parent().attrd('name'), input.val().toLowerCase().replace(/[^a-z0-9./\-_]/gi, ''), formtype);
				self.set('');
			}
		});
	};

	self.val = function(value, type) {
		input && input.val(value);
		formtype = type;
	};

	self.setter = function(value) {
		el.aclass('hidden');
		formtype = '';
		if (value) {
			input = el.filter('[data-name="{0}"]'.format(value)).rclass('hidden').find('input').val('');
			setTimeout(function() {
				input.focus();
			}, 300);
			self.rclass('hidden');
		} else
			self.aclass('hidden');
	};

});

COMPONENT('tasks', function(self, config) {

	self.readonly();

	var binder;

	self.make = function() {

		self.aclass('ui-tasks');
		self.append('<div class="ui-tasks-input"><input type="text" maxlength="1000" placeholder="{0}" /></div><div class="ui-tasks-items"></div>'.format(config.placeholder));

		binder = VBINDARRAY('<div class="ui-tasks-item" data-bind=".solved__.ui-tasks-solved:value"><span><i class="fa fa-check"></i></span><div><b data-bind=".userid__text:value"></b><span data-bind=".body__text:value"></span></div></div>', self.find('.ui-tasks-items'));

		self.event('keydown', 'input', function(e) {
			var t = this;
			if (e.which === 13) {
				EXEC(config.exec, t.value);
				t.value = '';
			} else if (e.which === 27)
				t.value = '';
		});

		self.event('click', '.ui-tasks-item', function() {
			var index = $(this).vbind().index;
			var item = self.get()[index];
			EXEC(config.solved, item);
		});
	};

	self.setter = function(value) {
		binder.set(value);
	};

});

COMPONENT('checkbox', function(self, config) {

	self.nocompile && self.nocompile();

	self.validate = function(value) {
		return (config.disabled || !config.required) ? true : (value === true || value === 'true' || value === 'on');
	};

	self.configure = function(key, value, init) {
		if (init)
			return;
		switch (key) {
			case 'label':
				self.find('span').html(value);
				break;
			case 'required':
				self.find('span').tclass('ui-checkbox-label-required', value);
				break;
			case 'disabled':
				self.tclass('ui-disabled', value);
				break;
			case 'checkicon':
				self.find('i').rclass2('fa-').aclass('fa-' + value);
				break;
		}
	};

	self.make = function() {
		self.aclass('ui-checkbox');
		self.html('<div><i class="fa fa-{2}"></i></div><span{1}>{0}</span>'.format(config.label || self.html(), config.required ? ' class="ui-checkbox-label-required"' : '', config.checkicon || 'check'));
		config.disabled && self.aclass('ui-disabled');
		self.event('click', function() {
			if (config.disabled)
				return;
			self.dirty(false);
			self.getter(!self.get());
		});
	};

	self.setter = function(value) {
		self.tclass('ui-checkbox-checked', !!value);
	};
});

COMPONENT('textarea', function(self, config) {

	var input, content = null;

	self.nocompile && self.nocompile();

	self.validate = function(value) {
		if (config.disabled || !config.required || config.readonly)
			return true;
		if (value == null)
			value = '';
		else
			value = value.toString();
		return value.length > 0;
	};

	self.configure = function(key, value, init) {
		if (init)
			return;

		var redraw = false;

		switch (key) {
			case 'readonly':
				self.find('textarea').prop('readonly', value);
				break;
			case 'disabled':
				self.tclass('ui-disabled', value);
				self.find('textarea').prop('disabled', value);
				self.reset();
				break;
			case 'required':
				self.noValid(!value);
				!value && self.state(1, 1);
				self.tclass('ui-textarea-required', value);
				break;
			case 'placeholder':
				input.prop('placeholder', value || '');
				break;
			case 'maxlength':
				input.prop('maxlength', value || 1000);
				break;
			case 'label':
				redraw = true;
				break;
			case 'autofocus':
				input.focus();
				break;
			case 'monospace':
				self.tclass('ui-textarea-monospace', value);
				break;
			case 'icon':
				redraw = true;
				break;
			case 'format':
				self.format = value;
				self.refresh();
				break;
			case 'height':
				self.find('textarea').css('height', (value > 0 ? value + 'px' : value));
				break;
		}

		redraw && setTimeout2('redraw' + self.id, function() {
			self.redraw();
			self.refresh();
		}, 100);
	};

	self.redraw = function() {

		var attrs = [];
		var builder = [];

		self.tclass('ui-disabled', config.disabled === true);
		self.tclass('ui-textarea-monospace', config.monospace === true);
		self.tclass('ui-textarea-required', config.required === true);

		config.placeholder && attrs.attr('placeholder', config.placeholder);
		config.maxlength && attrs.attr('maxlength', config.maxlength);
		config.error && attrs.attr('error');
		attrs.attr('data-jc-bind', '');
		config.height && attrs.attr('style', 'height:{0}px'.format(config.height));
		config.autofocus === 'true' && attrs.attr('autofocus');
		config.disabled && attrs.attr('disabled');
		config.readonly && attrs.attr('readonly');
		builder.push('<textarea {0}></textarea>'.format(attrs.join(' ')));

		var label = config.label || content;

		if (!label.length) {
			config.error && builder.push('<div class="ui-textarea-helper"><i class="fa fa-warning" aria-hidden="true"></i> {0}</div>'.format(config.error));
			self.aclass('ui-textarea ui-textarea-container');
			self.html(builder.join(''));
			input = self.find('textarea');
			return;
		}

		var html = builder.join('');

		builder = [];
		builder.push('<div class="ui-textarea-label">');
		config.icon && builder.push('<i class="fa fa-{0}"></i>'.format(config.icon));
		builder.push(label);
		builder.push(':</div><div class="ui-textarea">{0}</div>'.format(html));
		config.error && builder.push('<div class="ui-textarea-helper"><i class="fa fa-warning" aria-hidden="true"></i> {0}</div>'.format(config.error));

		self.html(builder.join(''));
		self.rclass('ui-textarea');
		self.aclass('ui-textarea-container');
		input = self.find('textarea');
	};

	self.make = function() {
		content = self.html();
		self.type = config.type;
		self.format = config.format;
		self.redraw();
	};

	self.state = function(type) {
		if (!type)
			return;
		var invalid = config.required ? self.isInvalid() : false;
		if (invalid === self.$oldstate)
			return;
		self.$oldstate = invalid;
		self.tclass('ui-textarea-invalid', invalid);
		config.error && self.find('.ui-textarea-helper').tclass('ui-textarea-helper-show', invalid);
	};
});

COMPONENT('error', function(self, config) {

	self.readonly();
	self.nocompile && self.nocompile();

	self.make = function() {
		self.aclass('ui-error hidden');
	};

	self.setter = function(value) {

		if (!(value instanceof Array) || !value.length) {
			self.tclass('hidden', true);
			return;
		}

		var builder = [];
		for (var i = 0, length = value.length; i < length; i++)
			builder.push('<div><span class="fa {1}"></span>{0}</div>'.format(value[i].error, 'fa-' + (config.icon || 'times-circle')));

		self.html(builder.join(''));
		self.tclass('hidden', false);
	};
});

COMPONENT('validation', 'delay:100;flags:visible', function(self, config) {

	var path, elements = null;
	var def = 'button[name="submit"]';
	var flags = null;

	self.readonly();

	self.make = function() {
		elements = self.find(config.selector || def);
		path = self.path.replace(/\.\*$/, '');
		setTimeout(function() {
			self.watch(self.path, self.state, true);
		}, 50);
	};

	self.configure = function(key, value, init) {
		switch (key) {
			case 'selector':
				if (!init)
					elements = self.find(value || def);
				break;
			case 'flags':
				if (value) {
					flags = value.split(',');
					for (var i = 0; i < flags.length; i++)
						flags[i] = '@' + flags[i];
				} else
					flags = null;
				break;
		}
	};

	self.state = function() {
		setTimeout2(self.id, function() {
			var disabled = DISABLED(path, flags);
			if (!disabled && config.if)
				disabled = !EVALUATE(self.path, config.if);
			elements.prop('disabled', disabled);
		}, config.delay);
	};
});

COMPONENT('infopanel', function(self) {

	var is = false;
	var cache;
	var tsshow;
	var tshide;

	// self.singleton();
	self.readonly();
	// self.bindchanges();
	// self.bindvisible();
	// self.bindexact();
	// self.blind();

	self.make = function() {
		self.aclass('ui-infopanel hidden invisible');
		$(document).on('click mousedown', self.hide);
	};

	self.hide = function(force) {
		if (is || force === true) {
			clearTimeout(tshide);
			tshide = setTimeout(function() {
				is = false;
				self.aclass('hidden invisible');
				cache = null;
			}, 100);
		}
	};

	self.show = function(el, render, offsetX, offsetY, top) {

		var main = self.element;

		if (!(el instanceof jQuery))
			el = $(el);

		if (cache === el[0]) {
			is = true;
			self.hide(true);
			return;
		}

		clearTimeout(tshide);
		clearTimeout(tsshow);
		is = false;

		cache = el[0];
		self.rclass('hidden');
		tsshow = setTimeout(function() {

			is = true;

			render(main);

			if (!self.html()) {
				self.hide(true);
				return;
			}

			// var w = main.width();
			var h = main.height();
			var off = el.offset();

			main.css({ left: off.left - (offsetX || 0), top: top ? (off.top + offsetY) : (off.top - h - (offsetY || 0) - el.height()) });
			main.rclass('invisible');
		}, 50);
	};

});

COMPONENT('suggestion', function(self, config) {

	var container, arrow, timeout, icon, input = null;
	var is = false, selectedindex = 0, resultscount = 0;

	self.items = null;
	self.template = Tangular.compile('<li data-index="{{ $.index }}"{{ if selected }} class="selected"{{ fi }}>{{ name | raw }}</li>');
	self.callback = null;
	self.readonly();
	self.singleton();
	self.nocompile && self.nocompile();

	self.configure = function(key, value, init) {
		if (init)
			return;
		switch (key) {
			case 'placeholder':
				self.find('input').prop('placeholder', value);
				break;
		}
	};

	self.make = function() {

		self.aclass('ui-suggestion hidden');
		self.append('<span class="ui-suggestion-arrow"></span><div class="ui-suggestion-search"><span class="ui-suggestion-button"><i class="fa fa-search"></i></span><div><input type="text" placeholder="{0}" class="ui-suggestion-search-input" /></div></div><div class="ui-suggestion-container"><ul></ul></div>'.format(config.placeholder));
		container = self.find('ul');
		arrow = self.find('.ui-suggestion-arrow');
		input = self.find('input');
		icon = self.find('.ui-suggestion-button').find('.fa');

		self.event('mouseenter mouseleave', 'li', function() {
			container.find('li.selected').rclass('selected');
			$(this).aclass('selected');
			var arr = container.find('li:visible');
			for (var i = 0; i < arr.length; i++) {
				if ($(arr[i]).hclass('selected')) {
					selectedindex = i;
					break;
				}
			}
		});

		self.event('click', '.ui-suggestion-button', function(e) {
			input.val('');
			self.search();
			e.stopPropagation();
			e.preventDefault();
		});

		self.event('touchstart mousedown', 'li', function(e) {
			self.callback && self.callback(self.items[+this.getAttribute('data-index')], $(self.target));
			self.hide();
			e.preventDefault();
			e.stopPropagation();
		});

		$(document).on('click', function(e) {
			is && !$(e.target).hclass('ui-suggestion-search-input') && self.hide(0);
		});

		$(window).on('resize', function() {
			is && self.hide(0);
		});

		self.event('keydown', 'input', function(e) {
			var o = false;
			switch (e.which) {
				case 27:
					o = true;
					self.hide();
					break;
				case 13:
					o = true;
					var sel = self.find('li.selected');
					if (sel.length && self.callback)
						self.callback(self.items[+sel.attrd('index')]);
					self.hide();
					break;
				case 38: // up
					o = true;
					selectedindex--;
					if (selectedindex < 0)
						selectedindex = 0;
					else
						self.move();
					break;
				case 40: // down
					o = true;
					selectedindex++ ;
					if (selectedindex >= resultscount)
						selectedindex = resultscount;
					else
						self.move();
					break;
			}

			if (o) {
				e.preventDefault();
				e.stopPropagation();
			}

		});

		self.event('input', 'input', function() {
			setTimeout2(self.ID, self.search, 100, null, this.value);
		});

		var fn = function() {
			is && self.hide(1);
		};

		self.on('reflow', fn);
		self.on('scroll', fn);
		$(window).on('scroll', fn);
	};

	self.move = function() {
		var counter = 0;
		var scroller = container.parent();
		var h = scroller.height();
		container.find('li').each(function() {
			var el = $(this);

			if (el.hclass('hidden')) {
				el.rclass('selected');
				return;
			}

			var is = selectedindex === counter;
			el.tclass('selected', is);
			if (is) {
				var t = (h * counter) - h;
				if ((t + h * 4) > h)
					scroller.scrollTop(t - h);
				else
					scroller.scrollTop(0);
			}
			counter++;
		});
	};

	self.search = function(value) {

		icon.tclass('fa-times', !!value).tclass('fa-search', !value);

		if (!value) {
			container.find('li').rclass('hidden');
			resultscount = self.items.length;
			selectedindex = 0;
			self.move();
			return;
		}

		resultscount = 0;
		selectedindex = 0;

		value = value.toSearch();
		container.find('li').each(function() {
			var el = $(this);
			var val = this.innerHTML.toSearch();
			var is = val.indexOf(value) === -1;
			el.tclass('hidden', is);
			if (!is)
				resultscount++;
		});

		self.move();
	};

	self.show = function(orientation, target, items, callback) {

		if (is) {
			clearTimeout(timeout);
			var obj = target instanceof jQuery ? target[0] : target;
			if (self.target === obj) {
				self.hide(0);
				return;
			}
		}

		target = $(target);
		var type = typeof(items);
		var item;

		if (type === 'string')
			items = self.get(items);
		else if (type === 'function') {
			callback = items;
			items = (target.attrd('options') || '').split(';');
			for (var i = 0, length = items.length; i < length; i++) {
				item = items[i];
				if (!item)
					continue;
				var val = item.split('|');
				items[i] = { name: val[0], value: val[2] == null ? val[0] : val[2] };
			}
		}

		if (!items) {
			self.hide(0);
			return;
		}

		self.items = items;
		self.callback = callback;
		input.val('');

		var builder = [];
		var indexer = {};

		for (var i = 0, length = items.length; i < length; i++) {
			item = items[i];
			indexer.index = i;
			!item.value && (item.value = item.name);
			builder.push(self.template(item, indexer));
		}

		self.target = target[0];
		var offset = target.offset();

		container.html(builder);

		switch (orientation) {
			case 'left':
				arrow.css({ left: '15px' });
				break;
			case 'right':
				arrow.css({ left: '210px' });
				break;
			case 'center':
				arrow.css({ left: '107px' });
				break;
		}

		var options = { left: orientation === 'center' ? Math.ceil((offset.left - self.element.width() / 2) + (target.innerWidth() / 2)) : orientation === 'left' ? offset.left - 8 : (offset.left - self.element.width()) + target.innerWidth(), top: offset.top + target.innerHeight() + 10 };
		self.css(options);

		if (is)
			return;

		selectedindex = 0;
		resultscount = items.length;
		self.move();
		self.search();

		self.rclass('hidden');
		setTimeout(function() {
			self.aclass('ui-suggestion-visible');
			self.emit('suggestion', true, self, self.target);
		}, 100);

		!isMOBILE && setTimeout(function() {
			input.focus();
		}, 500);

		setTimeout(function() {
			is = true;
		}, 50);
	};

	self.hide = function(sleep) {
		if (!is)
			return;
		clearTimeout(timeout);
		timeout = setTimeout(function() {
			self.rclass('ui-suggestion-visible').aclass('hidden');
			self.emit('suggestion', false, self, self.target);
			self.callback = null;
			self.target = null;
			is = false;
		}, sleep ? sleep : 100);
	};

});

COMPONENT('search', 'class:hidden;delay:50;attribute:data-search', function(self, config) {
	self.readonly();
	self.setter = function(value) {

		if (!config.selector || !config.attribute || value == null)
			return;

		setTimeout2('search' + self.ID, function() {

			var elements = self.find(config.selector);
			if (!value) {
				elements.rclass(config.class);
				return;
			}

			var search = value.toSearch();

			elements.each(function() {
				var el = $(this);
				var val = (el.attr(config.attribute) || '').toSearch();
				el.tclass(config.class, val.indexOf(search) === -1);
			});

		}, config.delay);
	};
});

COMPONENT('viewbox', 'margin:0;scroll:true;delay:100;scrollbar:0;visibleY:1;height:100', function(self, config) {

	var eld, elb;
	var scrollbar;
	var cls = 'ui-viewbox';
	var cls2 = '.' + cls;
	var init = false;

	self.readonly();

	self.init = function() {
		var obj;
		if (W.OP)
			obj = W.OP;
		else
			obj = $(W);

		var resize = function() {
			for (var i = 0; i < M.components.length; i++) {
				var com = M.components[i];
				if (com.name === 'viewbox' && com.dom.offsetParent && com.$ready && !com.$removed)
					com.resize();
			}
		};

		obj.on('resize', function() {
			setTimeout2('viewboxresize', resize, 200);
		});
	};

	self.configure = function(key, value, init) {
		switch (key) {
			case 'disabled':
				eld.tclass('hidden', !value);
				break;
			case 'minheight':
			case 'margin':
				!init && self.resize();
				break;
			case 'selector': // backward compatibility
				config.parent = value;
				self.resize();
				break;
		}
	};

	self.scrollbottom = function(val) {
		if (val == null)
			return elb[0].scrollTop;
		elb[0].scrollTop = (elb[0].scrollHeight - self.dom.clientHeight) - (val || 0);
		return elb[0].scrollTop;
	};

	self.scrolltop = function(val) {
		if (val == null)
			return elb[0].scrollTop;
		elb[0].scrollTop = (val || 0);
		return elb[0].scrollTop;
	};

	self.make = function() {
		self.aclass('invisible');
		config.scroll && MAIN.version > 17 && self.element.wrapInner('<div class="ui-viewbox-body"></div>');
		self.element.prepend('<div class="ui-viewbox-disabled hidden"></div>');
		eld = self.find('> .{0}-disabled'.format(cls)).eq(0);
		elb = self.find('> .{0}-body'.format(cls)).eq(0);
		self.aclass('{0} {0}-hidden'.format(cls));
		if (config.scroll) {
			if (config.scrollbar) {
				if (MAIN.version > 17) {
					scrollbar = window.SCROLLBAR(self.find(cls2 + '-body'), { visibleY: config.visibleY, visibleX: config.visibleX, parent: self.element });
					self.scrolltop = scrollbar.scrollTop;
					self.scrollbottom = scrollbar.scrollBottom;
				} else
					self.aclass(cls + '-scroll');
			} else {
				self.aclass(cls + '-scroll');
				self.find(cls2 + '-body').aclass('noscrollbar');
			}
		}
		self.resize();
	};

	self.released = function(is) {
		!is && self.resize();
	};

	var css = {};

	self.resize = function(scrolltop) {

		if (self.release())
			return;

		var el = config.parent ? config.parent === 'window' ? $(W) : config.parent === 'parent' ? self.parent() : self.element.closest(config.parent) : self.parent();
		var h = el.height();
		var w = el.width();

		if (h === 0 || w === 0) {
			self.$waiting && clearTimeout(self.$waiting);
			self.$waiting = setTimeout(self.resize, 234);
			return;
		}

		h = ((h / 100) * config.height) - config.margin;

		if (config.minheight && h < config.minheight)
			h = config.minheight;

		css.height = h;
		css.width = self.element.width();
		eld.css(css);

		css.width = null;
		self.css(css);
		elb.length && elb.css(css);
		self.element.SETTER('*', 'resize');
		var c = cls + '-hidden';
		self.hclass(c) && self.rclass(c, 100);
		scrollbar && scrollbar.resize();
		scrolltop && self.scrolltop(0);

		if (!init) {
			self.rclass('invisible', 250);
			init = true;
		}
	};

	self.setter = function() {
		setTimeout(self.resize, config.delay, config.scrolltop);
	};
});

COMPONENT('mainprogress', function(self) {

	var old = null;

	self.singleton();
	self.readonly();

	self.make = function() {
		self.aclass('ui-mainprogress hidden');
	};

	self.setter = function(value) {
		!value && (value = 0);

		if (old === value)
			return;

		if (value > 100)
			value = 100;
		else if (value < 0)
			value = 0;

		old = value >> 0;

		self.element.stop().animate({ width: old + '%' }, 80).show();
		self.tclass('hidden', old === 0 || old === 100);
	};
});

COMPONENT('directory', 'minwidth:200', function(self, config) {

	var cls = 'ui-directory';
	var cls2 = '.' + cls;
	var container, timeout, icon, plus, skipreset = false, skipclear = false, ready = false, input = null;
	var is = false, selectedindex = 0, resultscount = 0;
	var template = '<li data-index="{{ $.index }}" data-search="{{ name }}" {{ if selected }} class="current selected{{ if classname }} {{ classname }}{{ fi }}"{{ else if classname }} class="{{ classname }}"{{ fi }}>{{ name | encode | ui_directory_helper }}</li>';

	Thelpers.ui_directory_helper = function(val) {
		var t = this;
		return t.template ? (typeof(t.template) === 'string' ? t.template.indexOf('{{') === -1 ? t.template : Tangular.render(t.template, this) : t.render(this, val)) : self.opt.render ? self.opt.render(this, val) : val;
	};

	self.template = Tangular.compile(template);
	self.readonly();
	self.singleton();
	self.nocompile && self.nocompile();

	self.configure = function(key, value, init) {
		if (init)
			return;
		switch (key) {
			case 'placeholder':
				self.find('input').prop('placeholder', value);
				break;
		}
	};

	self.make = function() {

		self.aclass(cls + ' hidden');
		self.append('<div class="{1}-search"><span class="{1}-add hidden"><i class="fa fa-plus"></i></span><span class="{1}-button"><i class="fa fa-search"></i></span><div><input type="text" placeholder="{0}" class="{1}-search-input" name="dir{2}" autocomplete="dir{2}" /></div></div><div class="{1}-container"><ul></ul></div>'.format(config.placeholder, cls, Date.now()));
		container = self.find('ul');
		input = self.find('input');
		icon = self.find(cls2 + '-button').find('.fa');
		plus = self.find(cls2 + '-add');

		self.event('mouseenter mouseleave', 'li', function() {
			if (ready) {
				container.find('li.current').rclass('current');
				$(this).aclass('current');
				var arr = container.find('li:visible');
				for (var i = 0; i < arr.length; i++) {
					if ($(arr[i]).hclass('current')) {
						selectedindex = i;
						break;
					}
				}
			}
		});

		self.event('click', cls2 + '-button', function(e) {
			skipclear = false;
			input.val('');
			self.search();
			e.stopPropagation();
			e.preventDefault();
		});

		self.event('click', cls2 + '-add', function() {
			if (self.opt.callback) {
				self.opt.callback(input.val(), self.opt.element, true);
				self.hide();
			}
		});

		self.event('click', 'li', function(e) {
			self.opt.callback && self.opt.callback(self.opt.items[+this.getAttribute('data-index')], self.opt.element);
			self.hide();
			e.preventDefault();
			e.stopPropagation();
		});

		var e_click = function(e) {
			is && !$(e.target).hclass(cls + '-search-input') && self.hide(0);
		};

		var e_resize = function() {
			is && self.hide(0);
		};

		self.bindedevents = false;

		self.bindevents = function() {
			if (!self.bindedevents) {
				$(document).on('click', e_click);
				$(window).on('resize', e_resize);
				self.bindedevents = true;
			}
		};

		self.unbindevents = function() {
			if (self.bindedevents) {
				self.bindedevents = false;
				$(document).off('click', e_click);
				$(window).off('resize', e_resize);
			}
		};

		self.event('keydown', 'input', function(e) {
			var o = false;
			switch (e.which) {
				case 8:
					skipclear = false;
					break;
				case 27:
					o = true;
					self.hide();
					break;
				case 13:
					o = true;
					var sel = self.find('li.current');
					if (self.opt.callback) {
						if (sel.length)
							self.opt.callback(self.opt.items[+sel.attrd('index')], self.opt.element);
						else
							self.opt.callback(this.value, self.opt.element, true);
					}
					self.hide();
					break;
				case 38: // up
					o = true;
					selectedindex--;
					if (selectedindex < 0)
						selectedindex = 0;
					self.move();
					break;
				case 40: // down
					o = true;
					selectedindex++;
					if (selectedindex >= resultscount)
						selectedindex = resultscount;
					self.move();
					break;
			}

			if (o) {
				e.preventDefault();
				e.stopPropagation();
			}

		});

		self.event('input', 'input', function() {
			setTimeout2(self.ID, self.search, 100, null, this.value);
		});

		var fn = function() {
			is && self.hide(1);
		};

		self.on('reflow', fn);
		self.on('scroll', fn);
		self.on('resize', fn);
		$(window).on('scroll', fn);
	};

	self.move = function() {
		var counter = 0;
		var scroller = container.parent();
		var h = scroller.height();
		var li = container.find('li');
		var hli = li.eq(0).innerHeight() || 30;
		var was = false;
		var last = -1;
		var lastselected = 0;

		li.each(function(index) {
			var el = $(this);

			if (el.hclass('hidden')) {
				el.rclass('current');
				return;
			}

			var is = selectedindex === counter;
			el.tclass('current', is);

			if (is) {
				was = true;
				var t = (hli * (counter || 1));
				var f = Math.ceil((h / hli) / 2);
				if (counter > f)
					scroller[0].scrollTop = (t + f) - (h / 2.8 >> 0);
				else
					scroller[0].scrollTop = 0;
			}

			counter++;
			last = index;
			lastselected++;
		});

		if (!was && last >= 0) {
			selectedindex = lastselected;
			li.eq(last).aclass('current');
		}
	};

	self.search = function(value) {

		if (!self.opt)
			return;

		icon.tclass('fa-times', !!value).tclass('fa-search', !value);
		self.opt.custom && plus.tclass('hidden', !value);

		if (!value && !self.opt.ajax) {
			if (!skipclear)
				container.find('li').rclass('hidden');
			if (!skipreset)
				selectedindex = 0;
			resultscount = self.opt.items ? self.opt.items.length : 0;
			self.move();
			return;
		}

		resultscount = 0;
		selectedindex = 0;

		if (self.opt.ajax) {
			var val = value || '';
			if (self.ajaxold !== val) {
				self.ajaxold = val;
				setTimeout2(self.ID, function(val) {
					self.opt.ajax(val, function(items) {
						var builder = [];
						var indexer = {};
						for (var i = 0; i < items.length; i++) {
							var item = items[i];
							if (self.opt.exclude && self.opt.exclude(item))
								continue;
							indexer.index = i;
							resultscount++;
							builder.push(self.template(item, indexer));
						}
						skipclear = true;
						self.opt.items = items;
						container.html(builder);
						self.move();
					});
				}, 300, null, val);
			}
		} else if (value) {
			value = value.toSearch();
			container.find('li').each(function() {
				var el = $(this);
				var val = el.attrd('search').toSearch();
				var is = val.indexOf(value) === -1;
				el.tclass('hidden', is);
				if (!is)
					resultscount++;
			});
			skipclear = true;
			self.move();
		}
	};

	self.show = function(opt) {

		// opt.element
		// opt.items
		// opt.callback(value, el)
		// opt.offsetX     --> offsetX
		// opt.offsetY     --> offsetY
		// opt.offsetWidth --> plusWidth
		// opt.placeholder
		// opt.render
		// opt.custom
		// opt.minwidth
		// opt.maxwidth
		// opt.key
		// opt.exclude    --> function(item) must return Boolean
		// opt.search
		// opt.selected   --> only for String Array "opt.items"

		var el = opt.element instanceof jQuery ? opt.element[0] : opt.element;

		if (opt.items == null)
			opt.items = EMPTYARRAY;

		self.tclass(cls + '-default', !opt.render);

		if (!opt.minwidth)
			opt.minwidth = 200;

		if (is) {
			clearTimeout(timeout);
			if (self.target === el) {
				self.hide(1);
				return;
			}
		}

		self.initializing = true;
		self.target = el;
		opt.ajax = null;
		self.ajaxold = null;

		var element = $(opt.element);
		var callback = opt.callback;
		var items = opt.items;
		var type = typeof(items);
		var item;

		if (type === 'function' && callback) {
			opt.ajax = items;
			type = '';
			items = null;
		}

		if (type === 'string')
			items = self.get(items);

		if (!items && !opt.ajax) {
			self.hide(0);
			return;
		}

		self.bindevents();

		self.tclass(cls + '-search-hidden', opt.search === false);

		self.opt = opt;
		opt.class && self.aclass(opt.class);

		input.val('');
		var builder = [];
		var ta = opt.key ? Tangular.compile(template.replace(/\{\{\sname/g, '{{ ' + opt.key)) : self.template;
		var selected = null;

		if (!opt.ajax) {
			var indexer = {};
			for (var i = 0; i < items.length; i++) {
				item = items[i];

				if (typeof(item) === 'string')
					item = { name: item, id: item, selected: item === opt.selected };

				if (opt.exclude && opt.exclude(item))
					continue;

				if (item.selected) {
					selected = i;
					skipreset = true;
				}

				indexer.index = i;
				builder.push(ta(item, indexer));
			}

			if (opt.empty) {
				item = {};
				item[opt.key || 'name'] = opt.empty;
				item.template = '<b>{0}</b>'.format(opt.empty);
				indexer.index = -1;
				builder.unshift(ta(item, indexer));
			}
		}

		self.target = element[0];

		var w = element.width();
		var offset = element.offset();
		var width = w + (opt.offsetWidth || 0);

		if (opt.minwidth && width < opt.minwidth)
			width = opt.minwidth;
		else if (opt.maxwidth && width > opt.maxwidth)
			width = opt.maxwidth;

		ready = false;

		opt.ajaxold = null;
		plus.aclass('hidden');
		self.find('input').prop('placeholder', opt.placeholder || config.placeholder);
		var scroller = self.find(cls2 + '-container').css('width', width + 30);
		container.html(builder);

		var options = { left: 0, top: 0, width: width };

		switch (opt.align) {
			case 'center':
				options.left = Math.ceil((offset.left - width / 2) + (width / 2));
				break;
			case 'right':
				options.left = (offset.left - width) + w;
				break;
			default:
				options.left = offset.left;
				break;
		}

		options.top = opt.position === 'bottom' ? ((offset.top - self.height()) + element.height()) : offset.top;

		if (opt.offsetX)
			options.left += opt.offsetX;

		if (opt.offsetY)
			options.top += opt.offsetY;

		self.css(options);

		!isMOBILE && setTimeout(function() {
			ready = true;
			input.focus();
		}, 200);

		setTimeout(function() {
			self.initializing = false;
			is = true;
			if (selected == null)
				scroller[0].scrollTop = 0;
			else
				scroller[0].scrollTop = container.find('.selected').offset().top - (self.element.height() / 2 >> 0);
		}, 50);

		if (is) {
			self.search();
			return;
		}

		selectedindex = selected || 0;
		resultscount = items ? items.length : 0;
		skipclear = true;

		self.search();
		self.rclass('hidden');

		setTimeout(function() {
			if (self.opt && self.target && self.target.offsetParent)
				self.aclass(cls + '-visible');
			else
				self.hide(1);
		}, 100);

		skipreset = false;
	};

	self.hide = function(sleep) {
		if (!is || self.initializing)
			return;
		clearTimeout(timeout);
		timeout = setTimeout(function() {
			self.unbindevents();
			self.rclass(cls + '-visible').aclass('hidden');
			if (self.opt) {
				self.opt.close && self.opt.close();
				self.opt.class && self.rclass(self.opt.class);
				self.opt = null;
			}
			is = false;
		}, sleep ? sleep : 100);
	};
});

COMPONENT('input', 'maxlength:200;dirkey:name;dirvalue:id;increment:1;autovalue:name;direxclude:false;forcevalidation:1;searchalign:1;after:\\:', function(self, config) {

	var cls = 'ui-input';
	var cls2 = '.' + cls;
	var input, placeholder, dirsource, binded, customvalidator, mask, isdirvisible = false, nobindcamouflage = false, focused = false;

	self.nocompile();
	self.bindvisible(20);

	self.init = function() {
		Thelpers.ui_input_icon = function(val) {
			return val.charAt(0) === '!' ? ('<span class="ui-input-icon-custom">' + val.substring(1) + '</span>') : ('<i class="fa fa-' + val + '"></i>');
		};
		W.ui_input_template = Tangular.compile(('{{ if label }}<div class="{0}-label">{{ if icon }}<i class="fa fa-{{ icon }}"></i>{{ fi }}{{ label }}{{ after }}</div>{{ fi }}<div class="{0}-control{{ if licon }} {0}-licon{{ fi }}{{ if ricon || (type === \'number\' && increment) }} {0}-ricon{{ fi }}">{{ if ricon || (type === \'number\' && increment) }}<div class="{0}-icon-right{{ if type === \'number\' && increment }} {0}-increment{{ else if riconclick || type === \'date\' || type === \'time\' || (type === \'search\' && searchalign === 1) || type === \'password\' }} {0}-click{{ fi }}">{{ if type === \'number\' }}<i class="fa fa-caret-up"></i><i class="fa fa-caret-down"></i>{{ else }}{{ ricon | ui_input_icon }}{{ fi }}</div>{{ fi }}{{ if licon }}<div class="{0}-icon-left{{ if liconclick || (type === \'search\' && searchalign !== 1) }} {0}-click{{ fi }}">{{ licon | ui_input_icon }}</div>{{ fi }}<div class="{0}-input{{ if align === 1 || align === \'center\' }} center{{ else if align === 2 || align === \'right\' }} right{{ fi }}">{{ if placeholder && !innerlabel }}<div class="{0}-placeholder">{{ placeholder }}</div>{{ fi }}<input type="{{ if !dirsource && type === \'password\' }}password{{ else }}text{{ fi }}"{{ if autofill }} name="{{ PATH }}"{{ else }} name="input' + Date.now() + '" autocomplete="new-password"{{ fi }}{{ if dirsource }} readonly{{ else }} data-jc-bind=""{{ fi }}{{ if maxlength > 0}} maxlength="{{ maxlength }}"{{ fi }}{{ if autofocus }} autofocus{{ fi }} /></div></div>{{ if error }}<div class="{0}-error hidden"><i class="fa fa-warning"></i> {{ error }}</div>{{ fi }}').format(cls));
	};

	self.make = function() {

		if (!config.label)
			config.label = self.html();

		if (isMOBILE && config.autofocus)
			config.autofocus = false;

		config.PATH = self.path.replace(/\./g, '_');

		self.aclass(cls + ' invisible');
		self.rclass('invisible', 100);
		self.redraw();

		self.event('input change', function() {
			if (nobindcamouflage)
				nobindcamouflage = false;
			else
				self.check();
		});

		self.event('focus', 'input', function() {
			focused = true;
			self.camouflage(false);
			self.aclass(cls + '-focused');
			config.autocomplete && EXEC(self.makepath(config.autocomplete), self, input.parent());
			if (config.autosource) {
				var opt = {};
				opt.element = self.element;
				opt.search = GET(self.makepath(config.autosource));
				opt.callback = function(value) {
					var val = typeof(value) === 'string' ? value : value[config.autovalue];
					if (config.autoexec) {
						EXEC(self.makepath(config.autoexec), value, function(val) {
							self.set(val, 2);
							self.change();
							self.bindvalue();
						});
					} else {
						self.set(val, 2);
						self.change();
						self.bindvalue();
					}
				};
				SETTER('autocomplete', 'show', opt);
			} else if (config.mask) {
				setTimeout(function(input) {
					input.selectionStart = input.selectionEnd = 0;
				}, 50, this);
			} else if (config.dirsource && (config.autofocus != false && config.autofocus != 0)) {
				if (!isdirvisible)
					self.find(cls2 + '-control').trigger('click');
			}
		});

		self.event('paste', 'input', function(e) {
			if (config.mask) {
				var val = (e.originalEvent.clipboardData || window.clipboardData).getData('text');
				self.set(val.replace(/\s|\t/g, ''));
				e.preventDefault();
			}
		});

		self.event('keydown', 'input', function(e) {

			var t = this;
			var code = e.which;

			if (t.readOnly || config.disabled) {
				// TAB
				if (e.keyCode !== 9) {
					if (config.dirsource) {
						self.find(cls2 + '-control').trigger('click');
						return;
					}
					e.preventDefault();
					e.stopPropagation();
				}
				return;
			}

			if (!config.disabled && config.dirsource && (code === 13 || code > 30)) {
				self.find(cls2 + '-control').trigger('click');
				return;
			}

			if (config.mask) {

				if (e.metaKey) {
					if (code === 8 || code === 127) {
						e.preventDefault();
						e.stopPropagation();
					}
					return;
				}

				if (code === 32) {
					e.preventDefault();
					e.stopPropagation();
					return;
				}

				var beg = e.target.selectionStart;
				var end = e.target.selectionEnd;
				var val = t.value;
				var c;

				if (code === 8 || code === 127) {

					if (beg === end) {
						c = config.mask.substring(beg - 1, beg);
						t.value = val.substring(0, beg - 1) + c + val.substring(beg);
						self.curpos(beg - 1);
					} else {
						for (var i = beg; i <= end; i++) {
							c = config.mask.substring(i - 1, i);
							val = val.substring(0, i - 1) + c + val.substring(i);
						}
						t.value = val;
						self.curpos(beg);
					}

					e.preventDefault();
					return;
				}

				if (code > 40) {

					var cur = String.fromCharCode(code);

					if (mask && mask[beg]) {
						if (!mask[beg].test(cur)) {
							e.preventDefault();
							return;
						}
					}

					c = config.mask.charCodeAt(beg);
					if (c !== 95) {
						beg++;
						while (true) {
							c = config.mask.charCodeAt(beg);
							if (c === 95 || isNaN(c))
								break;
							else
								beg++;
						}
					}

					if (c === 95) {

						val = val.substring(0, beg) + cur + val.substring(beg + 1);
						t.value = val;
						beg++;

						while (beg < config.mask.length) {
							c = config.mask.charCodeAt(beg);
							if (c === 95)
								break;
							else
								beg++;
						}

						self.curpos(beg);
					} else
						self.curpos(beg + 1);

					e.preventDefault();
					e.stopPropagation();
				}
			}

		});

		self.event('blur', 'input', function() {
			focused = false;
			self.camouflage(true);
			self.rclass(cls + '-focused');
		});

		self.event('click', cls2 + '-control', function() {

			if (!config.dirsource || config.disabled || isdirvisible)
				return;

			isdirvisible = true;
			setTimeout(function() {
				isdirvisible = false;
			}, 500);

			var opt = {};
			opt.element = self.find(cls2 + '-control');
			opt.items = dirsource;
			opt.offsetY = -1 + (config.diroffsety || 0);
			opt.offsetX = 0 + (config.diroffsetx || 0);
			opt.placeholder = config.dirplaceholder;
			opt.render = config.dirrender ? GET(config.dirrender) : null;
			opt.custom = !!config.dircustom;
			opt.offsetWidth = 2;
			opt.minwidth = config.dirminwidth || 200;
			opt.maxwidth = config.dirmaxwidth;
			opt.key = config.dirkey || config.key;
			opt.empty = config.dirempty;

			if (config.dirsearch === false)
				opt.search = false;

			var val = self.get();
			opt.selected = val;

			if (config.direxclude === false) {
				for (var i = 0; i < dirsource.length; i++) {
					var item = dirsource[i];
					if (item)
						item.selected = typeof(item) === 'object' && item[config.dirvalue] === val;
				}
			} else {
				opt.exclude = function(item) {
					return item ? item[config.dirvalue] === val : false;
				};
			}

			opt.callback = function(item, el, custom) {

				// empty
				if (item == null) {
					input.val('');
					self.set(null, 2);
					self.change();
					self.check();
					return;
				}

				var val = custom || typeof(item) === 'string' ? item : item[config.dirvalue || config.value];
				if (custom && typeof(config.dircustom) === 'string') {
					var fn = GET(config.dircustom);
					fn(val, function(val) {
						self.set(val, 2);
						self.change();
						self.bindvalue();
					});
				} else if (custom) {
					if (val) {
						self.set(val, 2);
						self.change();
						self.bindvalue();
					}
				} else {
					self.set(val, 2);
					self.change();
					self.bindvalue();
				}
			};

			SETTER('directory', 'show', opt);
		});

		self.event('click', cls2 + '-placeholder,' + cls2 + '-label', function(e) {
			if (!config.disabled) {
				if (config.dirsource) {
					e.preventDefault();
					e.stopPropagation();
					self.find(cls2 + '-control').trigger('click');
				} else if (!config.camouflage || $(e.target).hclass(cls + '-placeholder'))
					input.focus();
			}
		});

		self.event('click', cls2 + '-icon-left,' + cls2 + '-icon-right', function(e) {

			if (config.disabled)
				return;

			var el = $(this);
			var left = el.hclass(cls + '-icon-left');
			var opt;

			if (config.dirsource && left && config.liconclick) {
				e.preventDefault();
				e.stopPropagation();
			}

			if (!left && !config.riconclick) {
				if (config.type === 'date') {
					opt = {};
					opt.element = self.element;
					opt.value = self.get();
					opt.callback = function(date) {
						self.change(true);
						self.set(date);
					};
					SETTER('datepicker', 'show', opt);
				} else if (config.type === 'time') {
					opt = {};
					opt.element = self.element;
					opt.value = self.get();
					opt.callback = function(date) {
						self.change(true);
						self.set(date);
					};
					SETTER('timepicker', 'show', opt);
				} else if (config.type === 'search')
					self.set('');
				else if (config.type === 'password')
					self.password();
				else if (config.type === 'number') {
					var n = $(e.target).hclass('fa-caret-up') ? 1 : -1;
					self.change(true);
					self.inc(config.increment * n);
				}
				return;
			}

			if (left && config.liconclick)
				EXEC(self.makepath(config.liconclick), self, el);
			else if (config.riconclick)
				EXEC(self.makepath(config.riconclick), self, el);
			else if (left && config.type === 'search')
				self.set('');

		});
	};

	self.camouflage = function(is) {
		if (config.camouflage) {
			if (is) {
				var t = input[0];
				var arr = t.value.split('');
				for (var i = 0; i < arr.length; i++)
					arr[i] = typeof(config.camouflage) === 'string' ? config.camouflage : '*';
				nobindcamouflage = true;
				t.value = arr.join('');
			} else {
				nobindcamouflage = true;
				input[0].value = self.get();
			}
		}
	};

	self.curpos = function(pos) {
		var el = input[0];
		if (el.createTextRange) {
			var range = el.createTextRange();
			range.move('character', pos);
			range.select();
		} else if (el.selectionStart) {
			el.focus();
			el.setSelectionRange(pos, pos);
		}
	};

	self.validate = function(value) {

		if ((!config.required || config.disabled) && !self.forcedvalidation())
			return true;

		if (config.dirsource)
			return !!value;

		if (customvalidator)
			return customvalidator(value);

		if (self.type === 'date')
			return value instanceof Date && !isNaN(value.getTime());

		if (value == null)
			value = '';
		else
			value = value.toString();

		if (config.mask && typeof(value) === 'string' && value.indexOf('_') !== -1)
			return false;

		if (config.minlength && value.length < config.minlength)
			return false;

		switch (self.type) {
			case 'email':
				return value.isEmail();
			case 'phone':
				return value.isPhone();
			case 'url':
				return value.isURL();
			case 'currency':
			case 'number':

				value = value.parseFloat();

				if (config.minvalue != null && value < config.minvalue)
					return false;

				if (config.maxvalue != null && value > config.maxvalue)
					return false;

				return value > 0;
		}

		return value.length > 0;
	};

	self.offset = function() {
		var offset = self.element.offset();
		var control = self.find(cls2 + '-control');
		var width = control.width() + 2;
		return { left: offset.left, top: control.offset().top + control.height(), width: width };
	};

	self.password = function(show) {
		var visible = show == null ? input.attr('type') === 'text' : show;
		input.attr('type', visible ? 'password' : 'text');
		self.find(cls2 + '-icon-right').find('i').tclass(config.ricon, visible).tclass('fa-eye-slash', !visible);
	};

	self.getterin = self.getter;
	self.getter = function(value, realtime, nobind) {

		if (nobindcamouflage)
			return;

		if (config.mask && config.masktidy) {
			var val = [];
			for (var i = 0; i < value.length; i++) {
				if (config.mask.charAt(i) === '_')
					val.push(value.charAt(i));
			}
			value = val.join('');
		}
		self.getterin(value, realtime, nobind);
	};

	self.setterin = self.setter;

	self.setter = function(value, path, type) {

		if (config.mask) {
			if (value) {
				if (config.masktidy) {
					var index = 0;
					var val = [];
					for (var i = 0; i < config.mask.length; i++) {
						var c = config.mask.charAt(i);
						if (c === '_')
							val.push(value.charAt(index++) || '_');
						else
							val.push(c);
					}
					value = val.join('');
				}

				// check values
				if (mask) {
					var arr = [];
					for (var i = 0; i < mask.length; i++) {
						var c = value.charAt(i);
						if (mask[i] && mask[i].test(c))
							arr.push(c);
						else
							arr.push(config.mask.charAt(i));
					}
					value = arr.join('');
				}
			} else
				value = config.mask;
		}

		self.setterin(value, path, type);
		self.bindvalue();

		config.camouflage && !focused && setTimeout(self.camouflage, type === 1 ? 1000 : 1, true);

		if (config.type === 'password')
			self.password(true);
	};

	self.check = function() {

		var is = !!input[0].value;

		if (binded === is)
			return;

		binded = is;
		placeholder && placeholder.tclass('hidden', is);
		self.tclass(cls + '-binded', is);

		if (config.type === 'search')
			self.find(cls2 + '-icon-' + (config.searchalign === 1 ? 'right' : 'left')).find('i').tclass(config.searchalign === 1 ? config.ricon : config.licon, !is).tclass('fa-times', is);
	};

	self.bindvalue = function() {
		if (dirsource) {

			var value = self.get();
			var item;

			for (var i = 0; i < dirsource.length; i++) {
				item = dirsource[i];
				if (typeof(item) === 'string') {
					if (item === value)
						break;
					item = null;
				} else if (item[config.dirvalue || config.value] === value) {
					item = item[config.dirkey || config.key];
					break;
				} else
					item = null;
			}

			if (value && item == null && config.dircustom)
				item = value;

			input.val(item || '');
		}
		self.check();
	};

	self.redraw = function() {

		if (!config.ricon) {
			if (config.dirsource)
				config.ricon = 'angle-down';
			else if (config.type === 'date') {
				config.ricon = 'calendar';
				if (!config.align && !config.innerlabel)
					config.align = 1;
			} else if (config.type === 'time') {
				config.ricon = 'clock-o';
				if (!config.align && !config.innerlabel)
					config.align = 1;
			} else if (config.type === 'search')
				if (config.searchalign === 1)
					config.ricon = 'search';
				else
					config.licon = 'search';
			else if (config.type === 'password')
				config.ricon = 'eye';
			else if (config.type === 'number') {
				if (!config.align && !config.innerlabel)
					config.align = 1;
			}
		}

		self.tclass(cls + '-masked', !!config.mask);
		self.html(W.ui_input_template(config));
		input = self.find('input');
		placeholder = self.find(cls2 + '-placeholder');
	};

	self.configure = function(key, value) {
		switch (key) {
			case 'dirsource':
				self.datasource(value, function(path, value) {
					dirsource = value;
					self.bindvalue();
				});
				self.tclass(cls + '-dropdown', !!value);
				break;
			case 'disabled':
				self.tclass('ui-disabled', value == true);
				input.prop('readonly', value === true);
				self.reset();
				break;
			case 'required':
				self.tclass(cls + '-required', value == true);
				self.reset();
				break;
			case 'type':
				self.type = value;
				break;
			case 'validate':
				customvalidator = value ? (/\(|=|>|<|\+|-|\)/).test(value) ? FN('value=>' + value) : (function(path) { return function(value) { return GET(path)(value); }; })(value) : null;
				break;
			case 'innerlabel':
				self.tclass(cls + '-inner', value);
				break;
			case 'maskregexp':
				if (value) {
					mask = value.toLowerCase().split(',');
					for (var i = 0; i < mask.length; i++) {
						var m = mask[i];
						if (!m || m === 'null')
							mask[i] = '';
						else
							mask[i] = new RegExp(m);
					}
				} else
					mask = null;
				break;
			case 'mask':
				config.mask = value.replace(/#/g, '_');
				break;
		}
	};

	self.formatter(function(path, value) {
		if (value) {
			switch (config.type) {
				case 'lower':
					return value.toString().toLowerCase();
				case 'upper':
					return value.toString().toUpperCase();
				case 'date':
					return value.format(config.format || 'yyyy-MM-dd');
				case 'time':
					return value.format(config.format || 'HH:mm');
				case 'number':
					return config.format ? value.format(config.format) : value;
			}
		}

		return value;
	});

	self.parser(function(path, value) {
		if (value) {
			var tmp;
			switch (config.type) {
				case 'date':
					tmp = self.get();
					if (tmp)
						tmp = tmp.format('HH:mm');
					else
						tmp = '';
					return value + (tmp ? (' ' + tmp) : '');
				case 'lower':
					value = value.toLowerCase();
					break;
				case 'upper':
					value = value.toUpperCase();
					break;
				case 'time':
					tmp = value.split(':');
					var dt = self.get();
					if (dt == null)
						dt = new Date();
					dt.setHours(+(tmp[0] || '0'));
					dt.setMinutes(+(tmp[1] || '0'));
					dt.setSeconds(+(tmp[2] || '0'));
					value = dt;
					break;
			}
		}
		return value ? config.spaces === false ? value.replace(/\s/g, '') : value : value;
	});

	self.state = function(type) {
		if (!type)
			return;
		var invalid = config.required ? self.isInvalid() : self.forcedvalidation() ? self.isInvalid() : false;
		if (invalid === self.$oldstate)
			return;
		self.$oldstate = invalid;
		self.tclass(cls + '-invalid', invalid);
		config.error && self.find(cls2 + '-error').tclass('hidden', !invalid);
	};

	self.forcedvalidation = function() {
		if (!config.forcevalidation)
			return false;
		var val = self.get();
		return (self.type === 'phone' || self.type === 'email') && (val != null && (typeof(val) === 'string' && val.length !== 0));
	};
});

COMPONENT('codemirror', 'linenumbers:false;required:false;trim:true;tabs:true', function(self, config) {

	var editor = null;
	var skip = false;

	self.getter = null;
	self.bindvisible();
	self.nocompile && self.nocompile();

	self.reload = function() {
		editor.refresh();
	};

	self.validate = function(value) {
		return (config.disabled || !config.required ? true : value && value.length > 0) === true;
	};

	self.insert = function(value) {
		editor.replaceSelection(value);
		self.change(true);
	};

	self.configure = function(key, value, init) {
		if (init)
			return;

		switch (key) {
			case 'disabled':
				self.tclass('ui-disabled', value);
				editor.setOption('readOnly', value);
				editor.refresh();
				break;
			case 'required':
				self.find('.ui-codemirror-label').tclass('ui-codemirror-label-required', value);
				self.state(1, 1);
				break;
			case 'icon':
				self.find('i').rclass().aclass('fa fa-' + value);
				break;
		}

	};

	self.make = function() {
		var content = config.label || self.html();
		self.html((content ? '<div class="ui-codemirror-label' + (config.required ? ' ui-codemirror-label-required' : '') + '">' + (config.icon ? '<i class="fa fa-' + config.icon + '"></i> ' : '') + content + ':</div>' : '') + '<div class="ui-codemirror"></div>');
		var container = self.find('.ui-codemirror');

		var options = {};
		options.lineNumbers = config.linenumbers;
		options.mode = config.type || 'htmlmixed';
		options.indentUnit = 4;
		options.scrollbarStyle = 'simple';

		if (config.tabs)
			options.indentWithTabs = true;

		if (config.type === 'markdown') {
			options.styleActiveLine = true;
			options.lineWrapping = true;
			options.matchBrackets = true;
		}

		editor = CodeMirror(container[0], options);
		self.editor = editor;

		if (config.height !== 'auto') {
			var is = typeof(config.height) === 'number';
			editor.setSize('100%', is ? (config.height + 'px') : (config.height || '200px'));
			!is && self.css('height', config.height);
		}

		if (config.disabled) {
			self.aclass('ui-disabled');
			editor.setOption('readOnly', true);
			editor.refresh();
		}

		var can = {};
		can['+input'] = can['+delete'] = can.undo = can.redo = can.paste = can.cut = can.clear = true;

		editor.on('change', function(a, b) {

			if (config.disabled || !can[b.origin])
				return;

			setTimeout2(self.id, function() {
				var val = editor.getValue();

				if (config.trim) {
					var lines = val.split('\n');
					for (var i = 0, length = lines.length; i < length; i++)
						lines[i] = lines[i].replace(/\s+$/, '');
					val = lines.join('\n').trim();
				}

				self.getter2 && self.getter2(val);
				self.change(true);
				skip = true;
				self.set(val);
				config.required && self.validate2();
			}, 200);

		});
	};

	self.setter = function(value) {

		if (skip) {
			skip = false;
			return;
		}

		editor.setValue(value || '');
		editor.refresh();

		setTimeout(function() {
			editor.refresh();
			editor.scrollTo(0, 0);
			editor.setCursor(0);
		}, 200);

		setTimeout(function() {
			editor.refresh();
		}, 1000);

		setTimeout(function() {
			editor.refresh();
		}, 2000);
	};

	self.state = function(type) {
		if (!type)
			return;
		var invalid = config.required ? self.isInvalid() : false;
		if (invalid === self.$oldstate)
			return;
		self.$oldstate = invalid;
		self.find('.ui-codemirror').tclass('ui-codemirror-invalid', invalid);
	};
});

COMPONENT('clipboard', function(self) {

	var container;

	self.singleton();
	self.readonly();
	self.nocompile && self.nocompile();

	self.copy = function(value) {
		container.val(value);
		container.focus();
		container.select();
		document.execCommand('copy');
		setTimeout(function() {
			container.blur();
		}, 100);
	};

	self.make = function() {
		var id = 'clipboard' + self.id;
		$(document.body).append('<textarea id="{0}" class="ui-clipboard"></textarea>'.format(id));
		container = $('#' + id);
	};

	self.setter = function(value) {
		value && self.copy(value);
	};
});

COMPONENT('fontawesomebox', 'height:300', function(self, config) {

	var cls = 'ui-fontawesomebox';
	var cls2 = '.' + cls;
	var container, input, icon, prev;
	var template = '<li data-search="{0}"><i class="{1}"></i></li>';
	var skip = false;
	var refresh = false;

	self.init = function() {
		W.fontawesomeicons = 'address-book,address-card,adjust,align-center,align-justify,align-left,align-right,allergies,ambulance,american-sign-language-interpreting,anchor,angle-double-down,angle-double-left,angle-double-right,angle-double-up,angle-down,angle-left,angle-right,angle-up,archive,arrow-alt-circle-down,arrow-alt-circle-left,arrow-alt-circle-right,arrow-alt-circle-up,arrow-circle-down,arrow-circle-left,arrow-circle-right,arrow-circle-up,arrow-down,arrow-left,arrow-right,arrow-up,arrows-alt,arrows-alt-h,arrows-alt-v,assistive-listening-systems,asterisk,at,audio-description,backward,balance-scale,ban,band-aid,barcode,bars,baseball-ball,basketball-ball,bath,battery-empty,battery-full,battery-half,battery-quarter,battery-three-quarters,bed,beer,bell,bell-slash,bicycle,binoculars,birthday-cake,blender,blind,bold,bolt,bomb,book,book-open,bookmark,bowling-ball,box,box-open,boxes,braille,briefcase,briefcase-medical,broadcast-tower,broom,bug,building,bullhorn,bullseye,burn,bus,calculator,calendar,calendar-alt,calendar-check,calendar-minus,calendar-plus,calendar-times,camera,camera-retro,capsules,car,caret-down,caret-left,caret-right,caret-square-down,caret-square-left,caret-square-right,caret-square-up,caret-up,cart-arrow-down,cart-plus,certificate,chalkboard,chalkboard-teacher,chart-area,chart-bar,chart-line,chart-pie,check,check-circle,check-square,chess,chess-bishop,chess-board,chess-king,chess-knight,chess-pawn,chess-queen,chess-rook,chevron-circle-down,chevron-circle-left,chevron-circle-right,chevron-circle-up,chevron-down,chevron-left,chevron-right,chevron-up,child,church,circle,circle-notch,clipboard,clipboard-check,clipboard-list,clock,clone,closed-captioning,cloud,cloud-download-alt,cloud-upload-alt,code,code-branch,coffee,cog,cogs,coins,columns,comment,comment-alt,comment-dots,comment-slash,comments,compact-disc,compass,compress,copy,copyright,couch,credit-card,crop,crosshairs,crow,crown,cube,cubes,cut,database,deaf,desktop,diagnoses,dice,dice-five,dice-four,dice-one,dice-six,dice-three,dice-two,divide,dna,dollar-sign,dolly,dolly-flatbed,donate,door-closed,door-open,dot-circle,dove,download,dumbbell,edit,eject,ellipsis-h,ellipsis-v,envelope,envelope-open,envelope-square,equals,eraser,euro-sign,exchange-alt,exclamation,exclamation-circle,exclamation-triangle,expand,expand-arrows-alt,external-link-alt,external-link-square-alt,eye,eye-dropper,eye-slash,fast-backward,fast-forward,fax,feather,female,fighter-jet,file,file-alt,file-archive,file-audio,file-code,file-excel,file-image,file-medical,file-medical-alt,file-pdf,file-powerpoint,file-video,file-word,film,filter,fire,fire-extinguisher,first-aid,flag,flag-checkered,flask,folder,folder-open,font,football-ball,forward,frog,frown,futbol,gamepad,gas-pump,gavel,gem,genderless,gift,glass-martini,glasses,globe,golf-ball,graduation-cap,greater-than,greater-than-equal,h-square,hand-holding,hand-holding-heart,hand-holding-usd,hand-lizard,hand-paper,hand-peace,hand-point-down,hand-point-left,hand-point-right,hand-point-up,hand-pointer,hand-rock,hand-scissors,hand-spock,hands,hands-helping,handshake,hashtag,hdd,heading,headphones,heart,heartbeat,helicopter,history,hockey-puck,home,hospital,hospital-alt,hospital-symbol,hourglass,hourglass-end,hourglass-half,hourglass-start,i-cursor,id-badge,id-card,id-card-alt,image,images,inbox,indent,industry,infinity,info,info-circle,italic,key,keyboard,kiwi-bird,language,laptop,leaf,lemon,less-than,less-than-equal,level-down-alt,level-up-alt,life-ring,lightbulb,link,lira-sign,list,list-alt,list-ol,list-ul,location-arrow,lock,lock-open,long-arrow-alt-down,long-arrow-alt-left,long-arrow-alt-right,long-arrow-alt-up,low-vision,magic,magnet,male,map,map-marker,map-marker-alt,map-pin,map-signs,mars,mars-double,mars-stroke,mars-stroke-h,mars-stroke-v,medkit,meh,memory,mercury,microchip,microphone,microphone-alt,microphone-alt-slash,microphone-slash,minus,minus-circle,minus-square,mobile,mobile-alt,money-bill,money-bill-alt,money-bill-wave,money-bill-wave-alt,money-check,money-check-alt,moon,motorcycle,mouse-pointer,music,neuter,newspaper,not-equal,notes-medical,object-group,object-ungroup,outdent,paint-brush,palette,pallet,paper-plane,paperclip,parachute-box,paragraph,parking,paste,pause,pause-circle,paw,pen-square,pencil-alt,people-carry,percent,percentage,phone,phone-slash,phone-square,phone-volume,piggy-bank,pills,plane,play,play-circle,plug,plus,plus-circle,plus-square,podcast,poo,portrait,pound-sign,power-off,prescription-bottle,prescription-bottle-alt,print,procedures,project-diagram,puzzle-piece,qrcode,question,question-circle,quidditch,quote-left,quote-right,random,receipt,recycle,redo,redo-alt,registered,reply,reply-all,retweet,ribbon,road,robot,rocket,rss,rss-square,ruble-sign,ruler,ruler-combined,ruler-horizontal,ruler-vertical,rupee-sign,save,school,screwdriver,search,search-minus,search-plus,seedling,server,share,share-alt,share-alt-square,share-square,shekel-sign,shield-alt,ship,shipping-fast,shoe-prints,shopping-bag,shopping-basket,shopping-cart,shower,sign,sign-in-alt,sign-language,sign-out-alt,signal,sitemap,skull,sliders-h,smile,smoking,smoking-ban,snowflake,sort,sort-alpha-down,sort-alpha-up,sort-amount-down,sort-amount-up,sort-down,sort-numeric-down,sort-numeric-up,sort-up,space-shuttle,spinner,square,square-full,star,star-half,step-backward,step-forward,stethoscope,sticky-note,stop,stop-circle,stopwatch,store,store-alt,stream,street-view,strikethrough,stroopwafel,subscript,subway,suitcase,sun,superscript,sync,sync-alt,syringe,table,table-tennis,tablet,tablet-alt,tablets,tachometer-alt,tag,tags,tape,tasks,taxi,terminal,text-height,text-width,th,th-large,th-list,thermometer,thermometer-empty,thermometer-full,thermometer-half,thermometer-quarter,thermometer-three-quarters,thumbs-down,thumbs-up,thumbtack,ticket-alt,times,times-circle,tint,toggle-off,toggle-on,toolbox,trademark,train,transgender,transgender-alt,trash,trash-alt,tree,trophy,truck,truck-loading,truck-moving,tshirt,tty,tv,umbrella,underline,undo,undo-alt,universal-access,university,unlink,unlock,unlock-alt,upload,user,user-alt,user-alt-slash,user-astronaut,user-check,user-circle,user-clock,user-cog,user-edit,user-friends,user-graduate,user-lock,user-md,user-minus,user-ninja,user-plus,user-secret,user-shield,user-slash,user-tag,user-tie,user-times,users,users-cog,utensil-spoon,utensils,venus,venus-double,venus-mars,vial,vials,video,video-slash,volleyball-ball,volume-down,volume-off,volume-up,walking,wallet,warehouse,weight,wheelchair,wifi,window-close,window-maximize,window-minimize,window-restore,wine-glass,won-sign,wrench,x-ray,yen-sign,fab 500px,fab accessible-icon,fab accusoft,fab adn,fab adversal,fab affiliatetheme,fab algolia,fab alipay,fab amazon,fab amazon-pay,fab amilia,fab android,fab angellist,fab angrycreative,fab angular,fab app-store,fab app-store-ios,fab apper,fab apple,fab apple-pay,fab asymmetrik,fab audible,fab autoprefixer,fab avianex,fab aviato,fab aws,fab bandcamp,fab behance,fab behance-square,fab bimobject,fab bitbucket,fab bitcoin,fab bity,fab black-tie,fab blackberry,fab blogger,fab blogger-b,fab bluetooth,fab bluetooth-b,fab btc,fab buromobelexperte,fab buysellads,fab cc-amazon-pay,fab cc-amex,fab cc-apple-pay,fab cc-diners-club,fab cc-discover,fab cc-jcb,fab cc-mastercard,fab cc-paypal,fab cc-stripe,fab cc-visa,fab centercode,fab chrome,fab cloudscale,fab cloudsmith,fab cloudversify,fab codepen,fab codiepie,fab connectdevelop,fab contao,fab cpanel,fab creative-commons,fab creative-commons-by,fab creative-commons-nc,fab creative-commons-nc-eu,fab creative-commons-nc-jp,fab creative-commons-nd,fab creative-commons-pd,fab creative-commons-pd-alt,fab creative-commons-remix,fab creative-commons-sa,fab creative-commons-sampling,fab creative-commons-sampling-plus,fab creative-commons-share,fab css3,fab css3-alt,fab cuttlefish,fab d-and-d,fab dashcube,fab delicious,fab deploydog,fab deskpro,fab deviantart,fab digg,fab digital-ocean,fab discord,fab discourse,fab dochub,fab docker,fab draft2digital,fab dribbble,fab dribbble-square,fab dropbox,fab drupal,fab dyalog,fab earlybirds,fab ebay,fab edge,fab elementor,fab ello,fab ember,fab empire,fab envira,fab erlang,fab ethereum,fab etsy,fab expeditedssl,fab facebook,fab facebook-f,fab facebook-messenger,fab facebook-square,fab firefox,fab first-order,fab first-order-alt,fab firstdraft,fab flickr,fab flipboard,fab fly,fab font-awesome,fab font-awesome-alt,fab font-awesome-flag,fab fonticons,fab fonticons-fi,fab fort-awesome,fab fort-awesome-alt,fab forumbee,fab foursquare,fab free-code-camp,fab freebsd,fab fulcrum,fab galactic-republic,fab galactic-senate,fab get-pocket,fab gg,fab gg-circle,fab git,fab git-square,fab github,fab github-alt,fab github-square,fab gitkraken,fab gitlab,fab gitter,fab glide,fab glide-g,fab gofore,fab goodreads,fab goodreads-g,fab google,fab google-drive,fab google-play,fab google-plus,fab google-plus-g,fab google-plus-square,fab google-wallet,fab gratipay,fab grav,fab gripfire,fab grunt,fab gulp,fab hacker-news,fab hacker-news-square,fab hackerrank,fab hips,fab hire-a-helper,fab hooli,fab hornbill,fab hotjar,fab houzz,fab html5,fab hubspot,fab imdb,fab instagram,fab internet-explorer,fab ioxhost,fab itunes,fab itunes-note,fab java,fab jedi-order,fab jenkins,fab joget,fab joomla,fab js,fab js-square,fab jsfiddle,fab kaggle,fab keybase,fab keycdn,fab kickstarter,fab kickstarter-k,fab korvue,fab laravel,fab lastfm,fab lastfm-square,fab leanpub,fab less,fab line,fab linkedin,fab linkedin-in,fab linode,fab linux,fab lyft,fab magento,fab mailchimp,fab mandalorian,fab markdown,fab mastodon,fab maxcdn,fab medapps,fab medium,fab medium-m,fab medrt,fab meetup,fab megaport,fab microsoft,fab mix,fab mixcloud,fab mizuni,fab modx,fab monero,fab napster,fab neos,fab nimblr,fab nintendo-switch,fab node,fab node-js,fab npm,fab ns8,fab nutritionix,fab odnoklassniki,fab odnoklassniki-square,fab old-republic,fab opencart,fab openid,fab opera,fab optin-monster,fab osi,fab page4,fab pagelines,fab palfed,fab patreon,fab paypal,fab periscope,fab phabricator,fab phoenix-framework,fab phoenix-squadron,fab php,fab pied-piper,fab pied-piper-alt,fab pied-piper-hat,fab pied-piper-pp,fab pinterest,fab pinterest-p,fab pinterest-square,fab playstation,fab product-hunt,fab pushed,fab python,fab qq,fab quinscape,fab quora,fab r-project,fab ravelry,fab react,fab readme,fab rebel,fab red-river,fab reddit,fab reddit-alien,fab reddit-square,fab renren,fab replyd,fab researchgate,fab resolving,fab rev,fab rocketchat,fab rockrms,fab safari,fab sass,fab schlix,fab scribd,fab searchengin,fab sellcast,fab sellsy,fab servicestack,fab shirtsinbulk,fab shopware,fab simplybuilt,fab sistrix,fab sith,fab skyatlas,fab skype,fab slack,fab slack-hash,fab slideshare,fab snapchat,fab snapchat-ghost,fab snapchat-square,fab soundcloud,fab speakap,fab spotify,fab squarespace,fab stack-exchange,fab stack-overflow,fab staylinked,fab steam,fab steam-square,fab steam-symbol,fab sticker-mule,fab strava,fab stripe,fab stripe-s,fab studiovinari,fab stumbleupon,fab stumbleupon-circle,fab superpowers,fab supple,fab teamspeak,fab telegram,fab telegram-plane,fab tencent-weibo,fab the-red-yeti,fab themeco,fab themeisle,fab trade-federation,fab trello,fab tripadvisor,fab tumblr,fab tumblr-square,fab twitch,fab twitter,fab twitter-square,fab typo3,fab uber,fab uikit,fab uniregistry,fab untappd,fab usb,fab ussunnah,fab vaadin,fab viacoin,fab viadeo,fab viadeo-square,fab viber,fab vimeo,fab vimeo-square,fab vimeo-v,fab vine,fab vk,fab vnv,fab vuejs,fab weebly,fab weibo,fab weixin,fab whatsapp,fab whatsapp-square,fab whmcs,fab wikipedia-w,fab windows,fab wix,fab wolf-pack-battalion,fab wordpress,fab wordpress-simple,fab wpbeginner,fab wpexplorer,fab wpforms,fab xbox,fab xing,fab xing-square,fab y-combinator,fab yahoo,fab yandex,fab yandex-international,fab yelp,fab yoast,fab youtube,fab youtube-square,fab zhihu'.split(',');
		$(W).on('resize', function() {
			SETTER('fontawesomebox', 'resize');
		});
	};

	self.readonly();
	self.nocompile();

	self.make = function() {

		self.aclass(cls);
		self.css('height', config.height + 'px');
		self.append('<div class="{2}-search"><span><i class="fa fa-search clearsearch"></i></span><div><input type="text" maxlength="50" placeholder="{0}" /></div></div><div class="{2}-search-empty"></div><div class="{2}-icons"><ul style="height:{1}px" class="noscrollbar"></ul></div>'.format(config.search, typeof(config.height) === 'string' ? (config.height - 40) : '100%', cls));
		container = $(self.find(cls2 + '-icons').find('ul')[0]);
		input = self.find('input');
		icon = self.find(cls2 + '-search').find('i');

		self.event('click', '.clearsearch', function() {
			input.val('').trigger('keydown');
		});

		self.event('click', 'li', function() {
			var el = $(this);
			var val = '';

			if (!el.hclass('selected'))
				val = el.find('i').attr('class');

			skip = true;
			config.exec && EXEC(config.exec, val, self);
			self.set(val);
			self.change(true);
		});

		self.event('keydown', 'input', function() {
			var self = this;
			setTimeout2(self.id, function() {
				var hide = [];
				var show = [];
				var value = self.value.toSearch();
				container.find('li').each(function() {
					if (value && this.getAttribute('data-search').toSearch().indexOf(value) === -1)
						hide.push(this);
					else
						show.push(this);
				});
				$(hide).aclass('hidden');
				$(show).rclass('hidden');
				icon.tclass('fa-times', !!value).tclass('fa-search', !value);
			}, 300);
		});

		setTimeout(self.resize, 500);
	};

	self.resize = function() {
		var value = config.height;
		if (typeof(value) === 'number') {
			self.css('height', value + 'px');
			container.css('height', (value - 38) + 'px');
		} else {
			var el = self.element.closest(value);
			var h = el.height() - (config.margin || 0);
			self.css('height', h + 'px');
			container.css('height', (h - 38) + 'px');
		}
	};

	self.configure = function (key, value, init) {

		if (init)
			return;

		switch (key) {
			case 'height':
				self.resize();
				break;
		}
	};

	self.released = function(is) {
		if (is) {
			container.empty();
		} else {
			self.render();
			refresh && self.refresh();
		}
	};

	self.render = function() {
		var builder = [];
		var icons = W.fontawesomeicons;
		for (var i = 0, length = icons.length; i < length; i++) {
			var icon = icons[i];
			builder.push(template.format(icon, icon.indexOf(' ') === -1 ? ('fa fa-' + icon) : icon.replace(' ', ' fa-')));
		}
		container.empty();
		input.val('').trigger('keydown');
		container.html(builder.join(''));
	};

	self.setter = function(value, path, type) {
		prev && prev.rclass('selected');
		if (value) {

			var skipped = skip;

			if (value.indexOf('fa-') === -1)
				value = 'fa-' + value;

			var index = value.indexOf(' ');
			if (index === -1)
				value = '.' + value;
			else
				value = '.' + value.substring(index + 1);

			var fa = container.find(value);
			prev = fa.parent().aclass('selected');
			setTimeout(function() {
				!skipped && prev.length && prev.rescroll(-40);
			}, 100);
		}

		if (type === 3) {
			setTimeout(function() {
				container[0].scrollTop = 0;
			}, 100);
		}

		skip = false;
		refresh = true;
	};
});

COMPONENT('message', function(self, config) {

	var cls = 'ui-message';
	var cls2 = '.' + cls;
	var is, visible = false;

	self.readonly();
	self.singleton();
	self.nocompile && self.nocompile();

	self.make = function() {
		self.aclass(cls + ' hidden');

		self.event('click', 'button', function() {
			self.hide();
		});

		$(window).on('keyup', function(e) {
			visible && e.which === 27 && self.hide();
		});
	};

	self.warning = function(message, icon, fn) {
		if (typeof(icon) === 'function') {
			fn = icon;
			icon = undefined;
		}
		self.callback = fn;
		self.content(cls + '-warning', message, icon || 'warning');
	};

	self.info = function(message, icon, fn) {
		if (typeof(icon) === 'function') {
			fn = icon;
			icon = undefined;
		}
		self.callback = fn;
		self.content(cls + '-info', message, icon || 'info-circle');
	};

	self.success = function(message, icon, fn) {

		if (typeof(icon) === 'function') {
			fn = icon;
			icon = undefined;
		}

		self.callback = fn;
		self.content(cls + '-success', message, icon || 'check-circle');
	};

	FUNC.messageresponse = function(success, callback) {
		return function(response, err) {
			if (err || response instanceof Array) {

				var msg = [];
				var template = '<div class="' + cls + '-error"><i class="fa fa-warning"></i>{0}</div>';

				if (response instanceof Array) {
					for (var i = 0; i < response.length; i++)
						msg.push(template.format(response[i].error));
					msg = msg.join('');
				} else
					msg = template.format(err.toString());

				self.warning(msg);
			} else {
				self.success(success);
				callback && callback(response);
			}
		};
	};

	self.hide = function() {
		self.callback && self.callback();
		self.aclass('hidden');
		visible = false;
	};

	self.content = function(classname, text, icon) {
		!is && self.html('<div><div class="ui-message-icon"><i class="fa fa-' + icon + '"></i></div><div class="ui-message-body"><div class="text"></div><hr /><button>' + (config.button || 'OK') + '</button></div></div>');
		visible = true;
		self.rclass2(cls + '-').aclass(classname);
		self.find(cls2 + '-body').rclass().aclass(cls + '-body');

		if (is)
			self.find(cls2 + '-icon').find('.fa').rclass2('fa-').aclass('fa-' + icon);

		self.find('.text').html(text);
		self.rclass('hidden');
		is = true;
		setTimeout(function() {
			self.aclass(cls + '-visible');
			setTimeout(function() {
				self.find(cls2 + '-icon').aclass(cls + '-icon-animate');
			}, 300);
		}, 100);
	};
});

COMPONENT('emoji', 'categories:128342,128578,128161,127944,128008,128690,128172,127828,127937;height:295;history:49;empty:No emoji match your search;emptyemoji:128557;speed:500;footer:Choose skin tone;toneemoji:9995', function(self, config) {

	var cls = 'ui-emoji';
	var cls2 = '.' + cls;
	var template = '<span data-id="{2}" {3}>{0}{1}</span>';
	var tone = ['', '&#127995;', '&#127996;', '&#127997;', '&#127998;', '&#127999;'];
	var toneclear = ['', '-127995', '-127996', '-127997', '-127998', '-127999'];
	var toneselected = 0;
	var allemoticons = [];
	var history = [];
	var categories = [];
	var is = false;
	var page = 0;
	var events = {};

	self.singleton();
	self.readonly();
	self.blind();
	self.nocompile();

	self.configure = function(name, value) {
		switch (name) {
			case 'categories':
				categories = value.split(',');
				for (var i = categories.length - 1; i >= 0; i--) {
					categories[i] = '&#{0};'.format(categories[i]);
				}
				self.redraw();
				break;
		}
	};

	self.changepage = function() {
		self.find(cls2 + '-search-input').val('');
		self.find('.clearsearch').rclass2('fa-').aclass('fa-search');
		self.find(cls2 + '-nav span').rclass('active');
		self.find(cls2 + '-nav span[data-type="' + page +'"]').tclass('active');
		self.find(cls2 + '-content').html(allemoticons[page]).scrollTop(0);
		$('.noscrollbar').noscrollbar();
	};

	self.redraw = function() {
		self.html('<div class="{12}"><div class="{12}-header"><div class="{12}-nav"><span data-type="0">{0}</span><span data-type="1">{1}</span><span data-type="2">{2}</span><span data-type="3">{3}</span><span data-type="4">{4}</span><span data-type="5">{5}</span><span data-type="6">{6}</span><span data-type="7">{7}</span><span data-type="8">{8}</span></div><div class="{12}-search"><span><i class="fa fa-search clearsearch"></i></span><div><input type="text" placeholder="Search" class="{12}-search-input"></div></div></div><div class="{12}-content noscrollbar" style="height:{9}px;"></div><div class="{12}-footer"><div class="{12}-footer-text">{10}</div><span data-type="0">&#{11};</span><span data-type="1">&#{11};&#127995;</span><span data-type="2">&#{11};&#127996;</span><span data-type="3">&#{11};&#127997;</span><span data-type="4">&#{11};&#127998;</span><span data-type="5">&#{11};&#127999;</span></div></div>'.format(categories[0], categories[1], categories[2], categories[3], categories[4], categories[5], categories[6], categories[7], categories[8], config.height, config.footer, config.toneemoji, cls));
		self.renderemoji();
		self.find('.noscrollbar').noscrollbar();
	};

	self.redrawhistory = function() {
		var html = '';

		html = '<div class="{0}-content-title" id="history">Frequently used</div>'.format(cls);
		for (var i = 0, len = history.length; i < len; i++) {
			html += template.format(self.parseemoji(history[i].id), '', history[i].id);
		}
		allemoticons[0] = html;
	};

	self.parseemoji = function(emoji) {

		var temp = emoji.split('-');
		var parsed = '';

		for (var i = 0, len = temp.length; i < len; i++) {
			parsed += '&#{0};'.format(temp[i]);
		}

		return parsed;
	};

	self.renderemoji = function(){
		var html = '';
		var code;

		html = '<div class="{0}-tab0"><div class="{0}-content-title" id="history">Frequently used</div>'.format(cls);
		for (var i = 0, len = history.length; i < len; i++) {
			html += template.format(self.parseemoji(history[i].id), '', history[i].id);
		}
		html += '</div>';
		allemoticons[0] = html;

		for (var i = 0, len = W.emoticonsdb.length; i < len; i++) {
			html = '';
			var emoticon = W.emoticonsdb[i];
			html += '<div class="{0}-tab{2}"><div class="{0}-content-title" id="{1}">{1}</div>'.format(cls, emoticon.name, i + 1);
			for (var item = 0, len2 = emoticon.emojis.length; item < len2; item++) {
				var emoji = emoticon.emojis[item];
				var editable = emoji.fitzpatrick || false;
				code = emoji.code_decimal.replace(/&#/g, '').replace(/;/g, '-').slice(0, -1);
				html += template.format(emoji.code_decimal, (editable ? tone[toneselected] : ''), code, (editable ? 'data-editable="1"' : ''));
			}
			html += '</div>';
			allemoticons[i + 1] = html;
		}
		page = 1;
		self.changepage();
	};

	self.search = function(value) {

		var search = self.find('.clearsearch');
		search.rclass2('fa-');

		if (!value.length) {
			search.aclass('fa-search');
			self.changepage();
			return;
		}

		var html = '';
		value = value.toSearch();
		self.find(cls2 + '-content').html('');
		search.aclass('fa-times');

		for (var i = 0, len = W.emoticons_search.length; i < len; i++) {
			if (W.emoticons_search[i].search.indexOf(value) !== -1) {
				var emoji = W.emoticons_search[i];
				html += template.format(emoji.decimal, (emoji.editable ? tone[toneselected] : ''), emoji.id, (emoji.editable ? 'data-editable="1"' : ''));
			}
		}


		if (html === '')
			html = '<div class="{0}-empty"><div>&#{1};</div>{2}</div>'.format(cls, config.emptyemoji, config.empty);

		self.find(cls2 + '-content').html(html)[0].scrollTop = 0;
	};

	self.make = function() {

		self.aclass(cls + '-container hidden');

		self.event('keydown', 'input', function() {
			var t = this;
			setTimeout2(self.id, function() {
				self.search(t.value);
			}, 300);
		});

		self.event('click', '.fa-times', function() {
			self.find(cls2 + '-search-input').val('');
			self.changepage();
			$(this).rclass2('fa-').aclass('fa-search');
		});

		self.event('click', cls2 + '-nav span', function() {
			page = parseInt($(this).data('type'));
			self.changepage();
		});

		self.event('click', cls2 + '-content span', function() {

			var t = $(this);
			var editable = t.attrd('editable') || 0;
			var icon = '{0}{1}'.format(t.data('id'), editable ? toneclear[toneselected] : '');
			var saved = CACHE(self.name) || {};

			if (saved.history == null)
				saved.history = [];

			var find = saved.history.findItem('id', icon);
			if (find) {
				find.count++;
				saved.history.quicksort('count', false);
			} else {
				saved.history.length > config.history && saved.history.pop();
				saved.history.push({ id: icon, count: 1 });
			}

			CACHE(self.name, saved, '1 month');

			var num = icon.split('-').trim().map(function(c) {
				return +c;
			});

			self.opt.callback(String.fromCodePoint.apply(null, num));
			self.hide();
		});

		self.event('click', cls2 + '-footer span', function() {
			var saved = CACHE(self.name) || {};
			toneselected = $(this).attrd('type');
			saved.tone = toneselected;
			CACHE(self.name, saved, '1 month');
			self.renderemoji();
		});

		events.click = function(e) {
			var el = e.target;
			var parent = self.dom;
			do {
				if (el == parent)
					return;
				el = el.parentNode;
			} while (el);
			self.hide();
		};

		self.on('reflow + scroll + resize', self.hide);
	};

	self.bindevents = function() {
		if (!events.is) {
			events.is = true;
			$(document).on('click', events.click);
		}
	};

	self.unbindevents = function() {
		if (events.is) {
			events.is = false;
			$(document).off('click', events.click);
		}
	};

	self.show = function(opt) {

		var tmp = opt.element ? opt.element instanceof jQuery ? opt.element[0] : opt.element.element ? opt.element.dom : opt.element : null;

		if (is && tmp && self.target === tmp) {
			self.hide();
			return;
		}

		self.target = tmp;
		self.opt = opt;
		var css = {};

		if (is) {
			css.left = 0;
			css.top = 0;
			self.element.css(css);
		} else
			self.rclass('hidden');

		var target = $(opt.element);
		var w = self.element.width();
		var offset = target.offset();

		if (opt.element) {
			switch (opt.align) {
				case 'center':
					css.left = Math.ceil((offset.left - w / 2) + (target.innerWidth() / 2));
					break;
				case 'right':
					css.left = (offset.left - w) + target.innerWidth();
					break;
				default:
					css.left = offset.left;
					break;
			}

			css.top = opt.position === 'bottom' ? (offset.top - self.element.height() - 10) : (offset.top + target.innerHeight() + 10);

		} else {
			css.left = opt.x;
			css.top = opt.y;
		}

		if (opt.offsetX)
			css.left += opt.offsetX;

		if (opt.offsetY)
			css.top += opt.offsetY;

		var saved = CACHE(self.name) || {};

		if (saved.tone != null)
			toneselected = saved.tone;

		if (saved.history != null)
			history = saved.history;

		page = 0;

		if (!history.length)
			page = 1;

		is = true;

		self.redrawhistory();
		self.changepage();
		self.element.css(css);
		setTimeout(self.bindevents, 50);
	};

	self.hide = function() {
		is = false;
		self.target = null;
		self.opt = null;
		self.unbindevents();
		self.aclass('hidden');
	};

	FUNC.parseASCII = function(value) {

		var db = { ':-)': '&#128517;', ':)': '&#128517;', ';)': '&#128521;', ':D': '&#128515;', '8)': '&#128515;', ';(': '&#128546;', ':(': '&#128531;', ':P': '&#128539;', ':O': '&#128558;', ':*': '&#128536;' };

		value = value.replace(/(^|\s):[a-z]+:(\s|$)|(-1|[:;8O\-)DP(|*]|\+1){1,3}/g, function(text) {

			var code = text;

			if (db[code])
				return db[code];

			var items = W.emoticons_search;
			code = code.trim();

			for (var i = 0; i < items.length; i++) {
				if (items[i].shortname === code)
					return text.replace(items[i].shortname, items[i].decimal);
			}

			return text;
		});

		return value;
	};

}, [function(next) {
	AJAX('GET /emoji.json', function(response) {

		W.emoticonsdb = response;
		W.emoticons_search = [];
		W.emoticons_ascii = {};

		for (var i = 0; i < response.length; i++) {

			var emoticon = response[i];

			for (var a = 0; a < emoticon.emojis.length; a++) {

				var emoji = emoticon.emojis[a];
				var name;
				var keywords = '';
				var code;

				for (var b = 0; b < emoji.keywords.length; b++)
					keywords += emoji.keywords[b];

				name = '{1}{2}{3}{4}'.format(emoji.category, emoji.name, emoji.shortname, keywords);
				code = emoji.code_decimal.replace(/&#/g, '').replace(/;/g, '-').slice(0, -1);

				W.emoticons_search.push({
					search: name.toSearch(),
					decimal: emoji.code_decimal,
					id: code,
					editable: emoji.fitzpatrick || false,
					shortname: emoji.shortname
				});
			}
		}
		next();
	});
}]);

COMPONENT('colorpicker', function(self) {

	var cls = 'ui-colorpicker';
	var cls2 = '.' + cls;
	var is = false;
	var events = {};
	var colors = [['e73323', 'ec8632', 'fffd54', '7bfa4c', '7cfbfd', '041ef5', 'e73cf7', '73197b', '91683c', 'ffffff', '808080', '000000'],['ffffff', 'e8e8e8', 'd1d1d1', 'b9b9b9', 'a2a2a2', '8b8b8b', '747474', '5d5d5d', '464646', '2e2e2e', '171717', '000000'],['5c0e07', '5e350f', '66651c', '41641a', '2d6419', '2d6438', '2d6465', '133363', '000662', '2d0962', '5c1262', '5c0f32', '8a1a11', '8e501b', '99982f', '62962b', '47962a', '479654', '479798', '214d94', '010e93', '451393', '8a2094', '8a1c4c', 'b9261a', 'bd6b27', 'cccb41', '83c83c', '61c83b', '61c871', '62c9ca', '2e67c5', '0216c4', '5c1dc4', 'b92ec5', 'b92865', 'e73323', 'ec8632', 'fffd54', 'a4fb4e', '7bfa4c', '7bfa8d', '7cfbfd', '3b80f7', '041ef5', '7327f5', 'e73cf7', 'e7357f', 'e8483f', 'ef9d4b', 'fffe61', 'b4fb5c', '83fa5a', '83faa2', '83fbfd', '5599f8', '343cf5', '8c42f6', 'e84ff7', 'e84a97', 'ea706b', 'f2b573', 'fffe7e', 'c5fc7c', '96fa7a', '96fbb9', '96fcfd', '7bb2f9', '666af6', 'a76ef7', 'eb73f8', 'ea71b0', 'f6cecd', 'fae6cf', 'fffed1', 'ebfed1', 'd7fdd0', 'd7fde7', 'd8fefe', 'd1e5fd', 'cccdfb', 'e1cefb', 'f6cffc', 'f6cee4']];

	self.singleton();
	self.readonly();
	self.blind();
	self.nocompile();

	self.make = function() {

		var html = '';
		for (var i = 0; i < colors.length; i++) {
			html += '<div>';
			for (var j = 0; j < colors[i].length; j++) {
				html += '<span class="{0}-cell"><span style="background-color:#{1}"></span></span>'.format(cls, colors[i][j]);
			}
			html += '</div>';
		}

		self.html('<div class="{0}"><div class="{0}-body">{1}</div></div>'.format(cls, html));
		self.aclass(cls + '-container hidden');

		self.event('click', cls2 + '-cell', function() {
			var el = $(this);
			self.opt.callback && self.opt.callback(el.find('span').attr('style').replace('background-color:', ''));
			self.hide();
		});

		events.click = function(e) {
			var el = e.target;
			var parent = self.dom;
			do {
				if (el == parent)
					return;
				el = el.parentNode;
			} while (el);
			self.hide();
		};

		self.on('scroll + reflow', self.hide);
	};

	self.bindevents = function() {
		if (!events.is) {
			events.is = true;
			$(document).on('click', events.click);
		}
	};

	self.unbindevents = function() {
		if (events.is) {
			events.is = false;
			$(document).off('click', events.click);
		}
	};

	self.show = function(opt) {

		var tmp = opt.element ? opt.element instanceof jQuery ? opt.element[0] : opt.element.element ? opt.element.dom : opt.element : null;

		if (is && tmp && self.target === tmp) {
			self.hide();
			return;
		}

		self.target = tmp;
		self.opt = opt;
		var css = {};

		if (is) {
			css.left = 0;
			css.top = 0;
			self.element.css(css);
		} else
			self.rclass('hidden');

		var target = $(opt.element);
		var w = self.element.width();
		var offset = target.offset();

		if (opt.element) {
			switch (opt.align) {
				case 'center':
					css.left = Math.ceil((offset.left - w / 2) + (target.innerWidth() / 2));
					break;
				case 'right':
					css.left = (offset.left - w) + target.innerWidth();
					break;
				default:
					css.left = offset.left;
					break;
			}

			css.top = opt.position === 'bottom' ? (offset.top - self.element.height() - 10) : (offset.top + target.innerHeight() + 10);

		} else {
			css.left = opt.x;
			css.top = opt.y;
		}

		if (opt.offsetX)
			css.left += opt.offsetX;

		if (opt.offsetY)
			css.top += opt.offsetY;

		is = true;
		self.element.css(css);
		setTimeout(self.bindevents, 50);
	};

	self.hide = function() {
		if (is) {
			is = false;
			self.target = null;
			self.opt = null;
			self.unbindevents();
			self.aclass('hidden');
		}
	};
});

COMPONENT('combo', function(self) {

	var rating, progress, count, sum = 0;

	self.singleton();
	self.readonly();

	self.make = function() {
		count = self.find('b');
		rating = self.find('.rating');
		progress = self.find('.progress');

		self.event('click', function() {
			var combo = GET('code.data.combo');
			combo && SETTER('infopanel', 'show', self.element, function(el) {

				// @ULTRA BAD HACK
				var builder = [];
				var keys = Object.keys(combo);
				var users = GET('code.usersproject');
				var votes = [];

				for (var i = 0; i < keys.length; i++) {
					var key = keys[i];
					votes.push({ name: users.findValue('id', key, 'name', key), combo: combo[key].max });
				}

				votes.quicksort('combo', true);

				for (var i = 0; i < votes.length; i++)
					builder.push('<div class="infopanel-combo"><b>{1}</b><span>{0}</span></div>'.format(votes[i].name, votes[i].combo));

				el.html(builder.join(''));
			}, 90, 50, true);
		});
	};

	function random() {
		return arguments[(Math.random() * arguments.length) >> 0];
	}

	self.text = function() {
		return random('Brutal', 'Awesome', 'Fantastic', 'Extreme', 'Stupendous', 'OMG', 'Impressive', 'Nice', 'Wild', 'Stupendous', 'Grand', 'Super', 'Splendid', 'Whoah', 'Nice', 'Total', 'Fatality');
	};

	self.summarize = function() {
		return sum;
	};

	self.combo = function() {

		sum++;

		var color = '';

		setTimeout2('comborating', function() {
			rating.html(self.text() + '!');
			rating.stop().css({ 'margin-top': 10, 'font-size': 20, opacity: 1 });
			setTimeout(function() {
				rating.animate({ 'margin-top': 25, opacity: 0, 'font-size': 12 }, 500);
			}, 200);
		}, 800, 20);

		if (sum > 80)
			color = '#E45A5A';
		else if (sum > 50)
			color = '#8CC152';
		else if (sum > 40)
			color = '#3BAFDA';
		else if (sum > 30)
			color = '#F6BB42';
		else if (sum > 20)
			color = '#FC6E51';
		else if (sum > 10)
			color = '#BD3BA5';
		else
			color = '';

		progress.css('background-color', color);
		rating.css('color', color);
		count.css('color', color);
		count.html(sum + '');

		count.stop().css('font-size', 24).animate({ 'font-size': 20 }, 300);

		progress.stop().animate({ width: '100%' }, 100, function() {
			progress.stop().animate({ width: '5%' }, 8000, function() {
				count.css('color', '').html('0');
				progress.css('background-color', '');
				rating.css('color', '');
				sum = 0;
			});
		});
	};
});

COMPONENT('radiobutton', 'inline:1', function(self, config) {

	var cls = 'ui-radiobutton';
	var cls2 = '.' + cls;
	var template = '<div data-value="{1}"><i></i><span>{0}</span></div>';

	self.nocompile();

	self.configure = function(key, value, init) {
		if (init)
			return;
		switch (key) {
			case 'disabled':
				self.tclass('ui-disabled', value);
				break;
			case 'required':
				self.find(cls2 + '-label').tclass(cls + '-label-required', value);
				break;
			case 'type':
				self.type = config.type;
				break;
			case 'label':
				self.find(cls2 + '-label').html(value);
				break;
			case 'items':
				self.find('div[data-value]').remove();
				var builder = [];
				value.split(',').forEach(function(item) {
					item = item.split('|');
					builder.push(template.format(item[0] || item[1], item[1] || item[0]));
				});
				self.append(builder.join(''));
				self.refresh();
				break;
			case 'datasource':
				self.datasource(value, self.bind);
				break;
		}
	};

	self.make = function() {
		var builder = [];
		var label = config.label || self.html();
		label && builder.push('<div class="' + cls + '-label{1}">{0}</div>'.format(label, config.required ? (' ' + cls + '-label-required') : ''));
		self.aclass(cls + (!config.inline ? (' ' + cls + '-block') : '') + (config.disabled ? ' ui-disabled' : ''));
		self.event('click', 'div', function() {
			if (config.disabled)
				return;
			var value = self.parser($(this).attrd('value'));
			self.set(value);
			self.change(true);
		});
		self.html(builder.join(''));
		html = self.html();
		config.items && self.reconfigure('items:' + config.items);
		config.datasource && self.reconfigure('datasource:' + config.datasource);
		config.type && (self.type = config.type);
	};

	self.validate = function(value) {
		return config.disabled || !config.required ? true : !!value;
	};

	self.setter = function(value) {
		self.find('div').each(function() {
			var el = $(this);
			var is = el.attrd('value') === (value == null ? null : value.toString());
			el.tclass(cls + '-selected', is);
			el.find('.fa').tclass('fa-circle-o', !is).tclass('fa-circle', is);
		});
	};

	self.bind = function(path, arr) {

		if (!arr)
			arr = EMPTYARRAY;

		var builder = [];
		var propText = config.text || 'name';
		var propValue = config.value || 'id';

		var type = typeof(arr[0]);
		var notObj = type === 'string' || type === 'number';

		for (var i = 0, length = arr.length; i < length; i++) {
			var item = arr[i];
			if (notObj)
				builder.push(template.format(item, item));
			else
				builder.push(template.format(item[propText], item[propValue]));
		}

		render = builder.join('');
		self.find('div[data-value]').remove();
		self.append(render);
		self.refresh();
	};
});

COMPONENT('tooltip', function(self) {

	var cls = 'ui-tooltip';
	var is = false;

	self.singleton();
	self.readonly();
	self.blind();
	self.nocompile && self.nocompile();

	self.make = function() {
		self.aclass(cls + ' hidden');
	};

	self.hide = function(force) {
		is && setTimeout2(self.ID, function() {
			self.aclass('hidden');
			self.rclass(cls + '-visible');
			is = false;
		}, force ? 1 : 200);
	};

	self.show = function(opt) {

		var tmp = opt.element ? opt.element instanceof jQuery ? opt.element[0] : opt.element.element ? opt.element.dom : opt.element : null;

		if (is && tmp && self.target === tmp) {
			self.hide();
			return;
		}

		clearTimeout2(self.ID);

		self.target = tmp;
		self.opt = opt;
		self.html('<div class="' + cls + '-body">' + opt.html + '</div>');

		var b = self.find('.' + cls + '-body');
		b.rclass2(cls + '-arrow-');
		b.aclass(cls + '-arrow-' + opt.align);

		var css = {};

		if (is) {
			css.left = 0;
			css.top = 0;
			self.element.css(css);
		} else {
			self.rclass('hidden');
			self.aclass(cls + '-visible', 100);
			is = true;
		}

		var target = $(opt.element);
		var w = self.width();
		var h = self.height();
		var offset = target.offset();

		switch (opt.align) {
			case 'left':
			case 'right':
				css.top = offset.top + (opt.center ? (h / 2 >> 0) : 0);
				css.left = opt.align === 'left' ? (offset.left - w - 10) : (offset.left + target.innerWidth() + 10);
				break;
			default:
				css.left = Math.ceil((offset.left - w / 2) + (target.innerWidth() / 2));
				css.top = opt.align === 'bottom' ? (offset.top + target.innerHeight() + 10) : (offset.top - h - 10);
				break;
		}

		if (opt.offsetX)
			css.left += opt.offsetX;

		if (opt.offsetY)
			css.top += opt.offsetY;

		opt.timeout && setTimeout2(self.ID, self.hide, opt.timeout - 200);
		self.element.css(css);
	};

});