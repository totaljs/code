COMPONENT('inputsearch', 'focus:true', function(self, config, cls) {

	var cls2 = '.' + cls;
	var placeholder;
	var isplaceholder = true;
	var icon;
	var input;

	// self.readonly();

	self.make = function() {
		self.aclass(cls);
		self.append('<div class="{0}-icon"><i class="fa fa-search"></i></div><div class="{0}-control"><span class="{0}-placeholder">{1}</span><input type="text" autocomplete="off" data-jc-bind="" /></div>'.format(cls, config.placeholder));

		input = self.find('input');

		self.event('click', cls2 + '-placeholder', function() {
			self.find('input').focus();
		});

		self.event('click', cls2 + '-icon', function() {
			var val = self.get();
			if (val) {
				icon.rclass('fa-times').aclass('fa-search');
				placeholder.rclass('hidden');
				isplaceholder = true;
				self.set('');
				self.find('input').val('');
			}
		});

		self.find('input').on('input', function() {
			self.placeholder();
		});

		placeholder = self.find(cls2 + '-placeholder');
		icon = self.find(cls2 + '-icon i');
	};

	self.placeholder = function() {
		var val = input.val();
		if (val) {
			if (isplaceholder) {
				icon.rclass('fa-search').aclass('fa-times');
				placeholder.aclass('hidden');
				isplaceholder = false;

			}
		} else if (!isplaceholder) {
			isplaceholder = true;
			icon.rclass('fa-times').aclass('fa-search');
			placeholder.rclass('hidden');
		}
	};

	self.focus = function() {
		input.focus();
	};

	self.getter2 = function() {
		self.placeholder();
	};

	self.setter2 = function() {
		self.placeholder();
	};

});

COMPONENT('editor', function(self, config) {

	var editor = null;
	var skip = false;
	var markers = {};
	var fn = {};
	var autocomplete;
	var lorem = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'.split(' ');
	var HSM = { annotateScrollbar: true, delay: 100 };
	var cache_lines = null;
	var cache_lines_body = '';
	var cache_lines_diff = false;
	var cache_lines_skip = false;
	var cache_diffs = {};
	var cache_diffs_highlight = {};
	var cache_diffs_checksum = 0;
	var cache_users = {};
	var checksum = -1;
	var autocomplete_unique;

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
		var h = self.element.closest('.ui-dockable-layout').height();
		$('#content').css('height', h - 133);
		self.find('.CodeMirror').css('height', h - 133);
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
				editor.setOption('lint', value === 'javascript' || value === 'xml' || value === 'totaljs' || value === 'totaljs_server' || value === 'html' ? { esversion: 8, expr: true, evil: true, unused: true, shadow: true, node: true, browser: true } : false);
				editor.setOption('matchBrackets', value !== 'todo');
				editor.setOption('lineWrapping', value === 'markdown');
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

		cache_lines_skip = true;
		cache_lines_diff = true;
		editor.setValue(value);
		self.diffgutterclear();
		cache_lines_skip = false;

		for (var i = 0; i < lines.length; i++) {
			if (lines[i] !== current[i])
				self.diffgutter(i);
		}

		setTimeout2('EditorGutterColor', self.prerender_colors, 999, 20);
	};

	self.diffgutterclear = function() {

		var count = editor.lineCount();
		for (var i = 0; i < count; i++)
			editor.removeLineClass(i, null, 'cm-changed-line');

		editor.doc.clearGutter('GutterDiff');
		cache_lines_body = editor.getValue();
		cache_lines = cache_lines_body.split('\n');
		cache_lines_diff = true;
		cache_diffs = {};
		cache_diffs_highlight = {};
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

	self.diffgutter = function(line, nullable, nochange, isdiffonly) {
		var key = line + '';

		if (nullable)
			delete cache_diffs[key];
		else
			cache_diffs[key] = 1;

		cache_diffs_interval && clearTimeout(cache_diffs_interval);
		cache_diffs_interval = setTimeout(cache_diffs_sum, 200);

		editor.setGutterMarker(line, 'GutterDiff', nullable ? null : GutterDiff());

		if (isdiffonly) {
			if (nullable) {
				delete cache_diffs_highlight[line];
				editor.removeLineClass(line, null, 'cm-changed-line');
			} else {
				cache_diffs_highlight[line] = 1;
				editor.addLineClass(line, null, 'cm-changed-line');
			}
		}

		var info = editor.lineInfo(line);
		var prev;

		if (nochange)
			return;

		var key = line + '';

		if (nullable) {
			// restore previous user
			prev = cache_users[key];
			if (prev) {
				editor.setGutterMarker(line, 'GutterUser', prev.el);
				delete cache_users[key];
			} else if (!info || !info.text)
				editor.setGutterMarker(line, 'GutterUser', null);

		} else if (info && info.text) {

			var usr = user;
			if (code.SYNCUSER && code.SYNCID !== common.id) {
				//  && code.SYNCUSER !== user.id
				usr = code.data.users.findItem('id', code.SYNCUSER);
				if (usr == null)
					return;
			}

			if (!cache_users[key])
				cache_users[key] = { el: info.gutterMarkers.GutterUser ? info.gutterMarkers.GutterUser.cloneNode(true) : null };

			self.diffuser(line, usr.id, usr.name, NOW);
		} else {
			editor.setGutterMarker(line, 'GutterUser', null);
		}
	};

	var GutterUser = function(userid, username, updated) {
		var marker = document.createElement('div');
		var css = marker.style;
		var usercolor = FUNC.usercolor(username);
		css.color = css['border-color'] = usercolor.color;
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
				EXEC(config.change, self.ismodified() ? 1 : 0);
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
				if ((/(div|ul|address|li|span|footer|header|main|table|strong|em|b|i|a|h|p|img|td|tr|th|hr|br|thead|tfoot|tbody|section|figure|section|dd|dl|dt)+(\.[a-z0-9-_])*/).test(html) || (/(^|\s)\.[a-z0-9-_]*/).test(html)) {
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

		var adddate = function() {
			var val = new Date().format('yyyy-MM-dd');
			var doc = editor.getDoc();
			var cursor = doc.getCursor();
			doc.replaceRange(val, cursor);
		};

		var comment = function() {
			var sel = editor.getSelections();
			var cur = editor.getCursor();
			var mode = editor.getModeAt(cur);
			var syntax = FUNC.getext(mode.helperType || mode.name);
			var iscurrent = false;

			if (sel.length === 1 && !sel[0]) {
				var line = editor.getLine(cur.line);
				sel[0] = line;
				iscurrent = true;
			}

			for (var i = 0; i < sel.length; i++) {
				sel[i] = sel[i].split('\n');
				sel[i] = FUNC.comment(syntax, sel[i]).join('\n');
			}

			if (iscurrent)
				editor.replaceRange(sel[0], { line: cur.line, ch: 0 }, { line: cur.line });
			else
				editor.replaceSelections(sel);
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
		options.rulers = [{ column: 130, lineStyle: 'dashed' }, { column: -1, lineStyle: 'dashed' }];
		options.gutters = ['GutterUser', 'CodeMirror-lint-markers', 'CodeMirror-linenumbers', 'GutterDiff'];
		options.viewportMargin = 50;
		options.foldGutter = true;
		options.highlightSelectionMatches = HSM;
		options.phrases = {};
		options.matchTags = { bothTags: true };
		options.autoCloseTags = true;
		options.doubleIndentSwitch = false;
		options.scrollPastEnd = true;
		options.lint = true;
		options.showCursorWhenSelecting = true;
		options.blastCode = true;
		options.autoCloseBrackets = true;
		// 'Alt-Up': shortcut('swaplineup'), 'Alt-Down': shortcut('swaplinedown')
		options.extraKeys = { 'Alt-F': 'findPersistent', 'Alt-Enter': adddate, 'Ctrl-Enter': findnext, 'Ctrl-/': comment, 'Cmd-/': comment, 'Ctrl--': comment, 'Cmd--': comment, 'Cmd-Enter': findnext, 'Esc': clearsearch, 'Cmd-D': findmatch, 'Ctrl-D': findmatch, 'Cmd-S': shortcut('save'), 'Ctrl-S': shortcut('save'), 'Alt-W': shortcut('close'), 'Cmd-W': shortcut('close'), Enter: 'newlineAndIndentContinue', Tab: tabulator, 'Alt-Tab': shortcut('nexttab') };

		if (common.electron) {
			options.extraKeys['Cmd-Tab'] = shortcut('nexttab');
			options.extraKeys['Ctrl-Tab'] = shortcut('nexttab');
		}

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

		editor.on('renderLine', function(cm, line, el) {
			if (config.mode === 'totaljs' || config.mode === 'text/css') {
				var arr = el.querySelectorAll('.cm-atom,.cm-builtin');
				for (var i = 0; i < arr.length; i++) {
					el = arr[i];
					var html = el.innerHTML;
					if (html.charAt(0) === '#' && (html.length === 4 || html.length === 7)) {
						el.style = 'border-bottom:4px solid {0}'.format(html);
						el.$color = html;
					}
				}
			}
		});

		self.refreshcolorpaletter = function() {
			var arr = document.querySelectorAll('.cm-atom,.cm-builtin');
			var colorpalette = {};
			for (var i = 0; i < arr.length; i++) {
				if (arr[i].offsetParent && arr[i].$color)
					colorpalette[arr[i].$color] = 1;
			}

			var keys = Object.keys(colorpalette);
			keys.sort();
			SET('code.colorpalette', keys);
		};

		var allowed_modes = { totaljsresources: 1, javascript: 1, totaljs_server: 1, totaljs: 1, css: 1, sass: 1, html: 1, todo: 1, bash: 1, python: 1, php: 1, shell: 1, htmlmixed: 1, 'null': 1, clike: 1, yaml: 1, markdown: 1 };
		var ismodifiedbody = false;

		self.ismodified = function() {
			var is = !HIDDEN(self.dom.querySelector('.cm-diff'));
			if (is)
				return is;
			if (!cache_lines_diff)
				return ismodifiedbody;
			ismodifiedbody = cache_lines.join('\n') !== editor.getValue();
			cache_lines_diff = false;
			return ismodifiedbody;
		};

		self.prerender_colors = function() {

			EXEC(config.change, self.ismodified() ? 1 : 0);

			if (cache_diffs_checksum === checksum)
				return;

			checksum = cache_diffs_checksum;

			var mode = editor.getMode().name;
			if (mode === 'totaljs_server')
				mode = 'javascript';

			var output;

			if (allowed_modes[mode])
				output = FUNC.parts_parser(editor.getValue(), mode);

			EXEC(config.components, output ? output.components : []);
			EXEC(config.todo, output ? output.todos : []);
			SET('code.fileversion', output ? output.version : '');
			setTimeout2(self.ID + 'colorpalette', self.refreshcolorpaletter, 1000);
		};

		var snippets = {};
		var cache_snip = {};
		var snippetsoptions = { completeSingle: false, supportsSelection: true, hint: function(cm) {

			if (snippets.text.length < 2 && snippets.text !== '#') {
				cache_snip.list = EMPTYARRAY;
				cache_snip.from = 0;
				cache_snip.to = 0;
				return cache_snip;
			}

			var cur = cm.getCursor();
			var mode = cm.getModeAt(cur);
			var start = snippets.index;
			var end = cur.ch;
			var tabs = '';

			for (var i = 0; i < snippets.index; i++) {
				if (snippets.line.charAt(i) !== '\t')
					break;
				tabs += '\t';
			}

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
				// reportsform/submit --> it doesn't work when typing "submit" and "/" was before
				// end += index;
			} else
				index = 0;

			cache_snip.from = CodeMirror.Pos(cur.line, start);
			cache_snip.to = CodeMirror.Pos(cur.line, end);

			if (snippets.text.length < 2 && snippets.text !== '#')
				cache_snip.list = EMPTYARRAY;
			else {
				var arr = FUNC.snippets(FUNC.getext(mode.helperType || mode.name), snippets.text, tabs, cur.line, autocomplete, (end - snippets.text.length - tabs.length), snippets.line);
				arr.sort(autocomplete_sort);
				cache_snip.list = arr.take(10);
			}

			return cache_snip;
		}};

		function autocomplete_sort(a, b) {

			var an = a.displayText || a.text;
			var bn = b.displayText || b.text;

			if (a.priority && !b.priority)
				return -1;

			if (!a.priority && b.priority)
				return 1;

			if (a.priority && b.priority) {
				if (a.priority > b.priority)
					return -1;
				else if (a.priority < b.priority)
					return 1;
				else
					return 0;
			}

			if (an.length < bn.length)
				return -1;
			else if (an.length > bn.length)
				return 1;

			return 0;
		}

		editor.on('endCompletion', function(a, b) {
			b && editor.doc.setCursor({ line: b.line, ch: b.ch });
		});

		var cursorfn = GET(config.cursor);

		self.toggleruler = function(islive) {

			if (!islive && editor.state.linerruler) {
				editor.state.linerruler = false;
				options.rulers[1].column = -1;
			} else {
				var cur = editor.getCursor();
				var line = editor.getLine(cur.line);
				var count = 0;
				for (var i = 0; i < cur.ch; i++) {
					if (line.charAt(i) === '\t')
						count++;
				}
				options.rulers[1].column = cur.ch + (count * 3);
				editor.state.linerruler = true;
			}

			editor.state.redrawrulers(editor);
		};

		editor.on('cursorActivity', function() {
			if (editor.state.linerruler)
				self.toggleruler(true);
			cursorfn(editor);
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

		var rebindvalue = function() {
			var cur = editor.getCursor();
			var line = editor.getLine(cur.line);
			var index = fn.lastIndexOf(line, cur.ch, ' ', '>', '\t', ';', '.', '"', '\'', ')', '(', '<', ',');

			if (index !== -1) {
				var text = line.substring(index, cur.ch);
				if (text) {
					snippets.index = index;
					snippets.text = text;
					snippets.line = line;
					editor.showHint(snippetsoptions);
				}
			}

			var val = editor.getValue();
			self.getter2 && self.getter2(val);
			self.change(true);
			skip = true;
			self.set(val);
			skip = true;
		};

		editor.on('change', function(a, b) {

			cache_lines_diff = true;

			if (b.origin === 'setValue') {
				if (!cache_lines_skip) {
					cache_lines_body = editor.getValue();
					cache_lines = cache_lines_body.split('\n');
				}
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
				var lf = b.from.line;
				var lt = b.from.line + b.text.length;
				var isremoved = -1;

				if (b.removed[0] || b.removed.length > 1) {
					isremoved = lt;
					lt = cache_lines.length;
				}

				for (var i = lf; i < lt; i++) {

					var is = false;
					var nochange = false;

					if (cache_lines) {
						var line = editor.getLine(i);

						if (isremoved && line == null)
							break;

						is = cache_lines[i] === line;

						if (line)
							line = line.trim();

						nochange = cache_lines[i] ? cache_lines[i].trim() === line : is;

						if (!nochange && isremoved > -1 && i >= isremoved) {
							nochange = true;
							lt = i;
						}
					}

					if (!is)
						count++;

					self.diffgutter(i, is, nochange, i < lt);
				}

				if (b.origin && b.origin.charAt(1) !== 'd')
					combo && combo();
			}

			setTimeout2('EditorGutterColor', self.prerender_colors, 999, 20);

			if (count)
				setTimeout2('EditorLineChange' + lf, self.rebuild_autocomplete2, 1000, null, lf);

			if (config.disabled || !can[b.origin])
				return;

			setTimeout2(self.id, rebindvalue, 100);
		});

		self.resize();
	};

	var cache_mt_f = {};
	var cache_mt_t = {};
	var cache_mt_css = { css: {} };

	self.marker = function(id, fline, fch, tline, tch, color, userid) {

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
		cache_mt_css.title = userid;

		markers[id] = editor.markText(cache_mt_f, cache_mt_t, cache_mt_css);
		self.find('.cm-uname-' + id).remove();
		self.find('.cm-user-' + id).eq(0).prepend('<span class="cm-uname cm-uname-{1}" style="border-left:1px solid {0}"><b style="background-color:{0}">{2}</b></span>'.format(hexrgba(color, 0.5), id, userid));
	};

	self.copy = function(history) {
		var doc = editor.doc.copy(history);
		if (history) {
			doc.cachedlines = cache_lines;
			doc.cachedbody = cache_lines_body;
			doc.cacheddiffs = cache_diffs;
			doc.cachediffshighlight = cache_diffs_highlight;
			doc.cachedusers = cache_users;
		}
		doc.cachedsearch = editor.state.search;
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

		cache_lines_diff = true;
		cache_lines_body = doc.cachedbody || editor.getValue();
		cache_lines = doc.cachedlines || cache_lines_body.split('\n');
		cache_diffs = doc.cacheddiffs || {};
		cache_diffs_highlight = doc.cachediffshighlight || {};
		cache_users = doc.cachedusers || {};

		delete doc.cachedbody;
		delete doc.cachedlines;
		delete doc.cacheddiffs;
		delete doc.cachediffshighlight;

		cache_lines_skip = true;
		editor.swapDoc(doc);
		editor.refresh();

		setTimeout(function() {
			cache_lines_skip = false;
		}, 100);

		checksum = -1;

		if ($('.search').find('input').val()) {
			editor.execCommand('findPersistentNext');
			editor.execCommand('countMatches');
		} else {
			setTimeout(function() {
				editor.execCommand('clearSearch');
				editor.execCommand('clearMatches');
			}, 200);
		}

		setTimeout(function() {
			EXEC(config.change, self.ismodified() ? 1 : 0);
		}, 50);

		if (!cache_lines)
			return;

		var keys;

		if (cache_diffs) {
			keys = Object.keys(cache_diffs);
			for (var i = 0; i < keys.length; i++)
				self.diffgutter(+keys[i], null, true, false);
		}

		if (cache_diffs_highlight) {
			keys = Object.keys(cache_diffs_highlight);
			for (var i = 0; i < keys.length; i++)
				editor.addLineClass(+keys[i], null, 'cm-changed-line');
		}

		autocomplete_unique = null;
		setTimeout2('EditorGutterColor', self.prerender_colors, 500, 20);
		setTimeout2('EditorRebuild', self.rebuild_autocomplete, 500);
	};

	self.clear = function(content) {
		SET('code.colorpalette', EMPTYARRAY);
		SET('code.fileversion');
		cache_lines_skip = true;
		content && editor.setValue('');
		editor.clearHistory();
		cache_lines_skip = false;
	};

	self.setter = function(value, path, type) {

		if (skip && type !== 2) {
			skip = false;
			return;
		}

		if (type === 'skip')
			return;

		markers = {};
		NUL('code.fileversion');
		SET('code.colorpalette', EMPTYARRAY);

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
		setTimeout2('EditorGutterColor', self.prerender_colors, 999, 20);
		self.resize();
	};

	self.flush = function() {
		clearTimeout2('EditorGutterColor');
		checksum = -1;
		self.prerender_colors();
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
	var REGAUTOCOMPLETE = /(#)?[a-zA-Z0-9_-]{3,30}/g;

	self.rebuild_autocomplete2 = function(index) {

		if (index == null || autocomplete_unique == null)
			return;

		var line = editor.getLine(index);
		if (!line)
			return;

		var words = line.match(REGAUTOCOMPLETE);
		if (words) {

			var unique = {};

			for (var i = 0; i < words.length; i++) {
				var w = words[i];

				if (BL[w])
					continue;

				var index = w.indexOf('__');
				if (index !== -1)
					w = w.substring(0, index);

				if (!autocomplete_unique[w])
					autocomplete_unique[w] = unique[w] = 1;
			}

			unique = Object.keys(unique);
			unique.sort();

			// adds new keywords
			for (var i = 0; i < unique.length; i++) {
				var s = unique[i];
				autocomplete.push({ search: s, text: (s.charAt(0) === '#' && s.length === 7 ? '<i class="fa fa-square mr5" style="color:{0}"></i>'.format(s) : '') + s, code: s });
			}
		}
	};

	self.rebuild_autocomplete = function(val) {
		var words = val || editor.getValue();
		var max = 100000;

		if (words.length > max)
			words = words.substring(0, max);

		words = words.match(REGAUTOCOMPLETE);
		if (words) {
			autocomplete_unique = {};
			for (var i = 0; i < words.length; i++) {
				var w = words[i];
				if (BL[w])
					continue;
				var index = w.indexOf('__');
				if (index !== -1)
					w = w.substring(0, index);
				autocomplete_unique[w] = 1;
			}

			autocomplete = Object.keys(autocomplete_unique);
			autocomplete.sort();

			for (var i = 0; i < autocomplete.length; i++) {
				var s = autocomplete[i];
				autocomplete[i] = { search: s, text: (s.charAt(0) === '#' && s.length === 7 ? '<i class="fa fa-square mr5" style="color:{0}"></i>'.format(s) : '') + s, code: s };
			}

			if (code.componentsdb) {
				for (var i = 0; i < code.componentsdb.length; i++) {
					var item = code.componentsdb[i];
					for (var j = 0; j < item.items.length; j++) {
						var t = item.items[j].type;
						if (t !== 'schema' && t !== 'route') {
							var n = item.items[j].name;
							var c = n;

							if (t === 'plugin') {
								n = c = c.replace('.', '/');
								var tmp = c.lastIndexOf('(');
								if (tmp !== -1)
									c = c.substring(0, tmp);
							}

							autocomplete.push({ html: '<i class="' + Thelpers.particon(item.items[j].type) + '"></i> <b>' + n + '</b>', search: n, code: c });
						}
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

	var REGBK = /(-|_)bk\.\w+$/i;
	var items = {};
	var nestedkey = null;
	var nesteditem = null;

	Thelpers.treefilecolor = function(filename) {
		return filename.charAt(0) === '.' || REGBK.test(filename) || filename === '/modules/code.js' ? ' ui-tree-hiddenfile' : '';
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
			case 'mp3':
			case 'ogg':
			case 'wav':
				return 'far fa-file-audio';
			case 'mp4':
			case 'avi':
			case 'mov':
				return 'far fa-file-video';
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
			case 'build':
				return 'fa fa-code-branch';
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
				return filename === 'tms.json' ? 'fa fa-cog' : 'fa fa-toolbox';
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
			case 'yaml':
				return 'fa fa-cog';
			case 'c':
			case 'wasm':
			case 'wat':
			case 'wast':
				return 'fa fa-code';
		}
		return 'fa-file-o far';
	};

	var cache = null;
	var counter = 0;
	var expanded = {};
	var selindex = -1;

	var renameid = null;
	var renameel = null;
	var renameblur = function() {
		renameid = null;
		if (renameel) {
			var input = $(renameel).find('input');
			var el = input.parent();
			el.html(renameel.$def);
			renameel.$def = null;
			renameel = null;
		}
	};

	self.template = Tangular.compile('<div class="item{{ if children }} expand{{ fi }}{{ path | treefilecolor }}" data-index="{{ $pointer }}" title="{{ name }}"><i class="icon {{ if children }}fa fa-folder{{ if isopen }}-open {{ fi }}{{ if name === \'threads\' || name === \'builds\' }} special{{ fi }}{{ else }}{{ name | fileicon }}{{ fi }}"></i><span class="options"><i class="fa fa-ellipsis-h"></i></span><div>{{ name }}</div></div>');
	self.readonly();

	self.resizescrollbar = function() {
		self.closest('.ui-viewbox').component().resizescrollbar();
	};

	self.shownested = function(item) {

		if (typeof(item) === 'string')
			item = items[item];

		if (!item)
			return;

		var builder = [];
		var selected = selindex === -1 ? -1 : config.pk ? cache[selindex][config.pk] : cache[selindex];

		var key = config.pk ? item[config.pk] : counter;
		if (key === selected)
			selindex = counter;

		builder.push('<div class="extrabutton" data-name="reset"><i class="fa fa-times red"></i>{0}</div>'.format(item.path));

		for (var i = 0; i < item.children.length; i++) {
			var child = item.children[i];
			builder.push('<div class="node{0}">'.format(child.isopen ? ' show' : '') + self.template(child));
			child.children && self.renderchildren(builder, child, 1, selected);
			builder.push('</div>');
		}

		nestedkey = key;
		self.html(builder.join(''));
		self.resizescrollbar();
	};

	self.make = function() {
		self.aclass('ui-tree');

		var ddfile = null;
		var ddtarget = null;

		self.event('click', '.extrabutton', function() {
			var name = $(this).attrd('name');
			if (name === 'reset') {
				nestedkey = null;
				self.refresh();
				self.resizescrollbar();
			} else
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

			EXEC(config.upload, cache[index], e.originalEvent);
		});

		self.event('focusout', 'input', function() {
			renameid && clearTimeout(renameid);
			renameid = setTimeout(renameblur, 500);
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

			if (renameid && renameel && renameel == el.find('> div')[0]) {
				clearTimeout(renameid);
				renameid = null;
				el.find('input').focus();
				return;
			}

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

	var resize = function() {
		var h = self.closest('.ui-viewbox-body').height() - self.element.parent().find('.changedfiles').height() - 20;
		self.css('min-height', h);
	};

	self.resize = function() {
		setTimeout2(self.ID + 'resize', resize, 500);
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
			self.resizescrollbar();
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
		renameel = div[0];
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
				var el = $(this);
				el.parent().aclass('show');
				el.find('> .icon').rclass('fa-folder').aclass('fa-folder-open');
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
						el.find('> .icon').rclass('fa-folder').aclass('fa-folder-open');
						var parent = el.parent().aclass('show');
						var tmp = +parent.find('> .item').attrd('index');
						var item = cache[tmp];
						var key = config.pk ? item[config.pk] : counter;
						expanded[key] = 1;
						item.isopen = true;
					}
				}
			});
		}
		self.resizescrollbar();
	};

	self.collapse = function(index) {
		if (index == null) {
			self.find('.expand').each(function() {
				var el = $(this);
				el.parent().rclass('show');
				el.find('> .icon').aclass('fa-folder').rclass('fa-folder-open');
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
						el.find('> .icon').aclass('fa-folder').rclass('fa-folder-open');
						el.parent().rclass('show');
					}
				}
			});
		}
		self.resizescrollbar();
	};

	self.renderchildren = function(builder, item, level, selected, addtocache) {
		builder.push('<div class="children children{0}" data-level="{0}">'.format(level));
		item.children.forEach(function(item) {
			counter++;
			item.$pointer = counter;
			cache[counter] = item;

			var key = config.pk ? item[config.pk] : counter;
			if (key === selected)
				selindex = counter;

			if (nestedkey && nestedkey === key)
				nesteditem = item;

			if (addtocache)
				items[key] = item;

			item.isopen = !!(expanded[key] && item.children);
			builder.push('<div class="node{0}">'.format(item.isopen ? ' show' : ''));
			builder.push(self.template(item));
			item.children && self.renderchildren(builder, item, level + 1, selected, addtocache);
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
		items = {};

		var extra = true;
		if (value && !code.data.isexternal) {
			for (var i = 0; i < value.length; i++) {
				var key = value[i].name;
				if (key === 'controllers' || key === 'bundles' || key === 'packages' || key === 'modules') {
					extra = false;
					break;
				}
			}
			extra && builder.push('<div class="extrabutton"><i class="fa fa-cloud-download"></i>{0}</div>'.format(config.extralabel));
		}

		value && value.forEach(function(item) {
			counter++;
			item.$pointer = counter;
			cache[counter] = item;
			var key = config.pk ? item[config.pk] : counter;
			if (key === selected)
				selindex = counter;

			if (nestedkey && nestedkey === key)
				nesteditem = item;

			items[key] = item;
			item.isopen = !!(expanded[key] && item.children);
			builder.push('<div class="node{0}">'.format(item.isopen ? ' show' : '') + self.template(item));
			if (item.children)
				self.renderchildren(builder, item, 1, selected, true);
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

		if (nesteditem) {
			self.shownested(nesteditem);
			nesteditem = null;
		}
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
			setTimeout(function() {
				self.import(config.url, function() {
					if (!init) {
						config.init && EXEC(config.init);
						init = true;
					}
					config.reload && EXEC(config.reload);
					config.default && DEFAULT(config.default, true);
					setTimeout(function() {
						self.rclass('invisible');
					}, 500);
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

COMPONENT('datagrid', 'checkbox:true;colwidth:150;rowheight:28;clusterize:true;limit:80;filterlabel:Filter;height:auto;margin:0;resize:true;reorder:true;sorting:true;boolean:true,on,yes;pluralizepages:# pages,# page,# pages,# pages;pluralizeitems:# items,# item,# items,# items;remember:true;highlight:false;unhighlight:true;autoselect:false;buttonapply:Apply;buttonreset:Reset;allowtitles:false;fullwidth_xs:true;clickid:id;dirplaceholder:Search', function(self, config) {

	var opt = { filter: {}, filtercache: {}, filtercl: {}, filtervalues: {}, scroll: false, selected: {}, operation: '' };
	var header, vbody, footer, container, ecolumns, isecolumns = false, ready = false;
	var sheader, sbody;
	var Theadercol = Tangular.compile('<div class="dg-hcol dg-col-{{ index }}{{ if sorting }} dg-sorting{{ fi }}" data-index="{{ index }}">{{ if sorting }}<i class="dg-sort fa fa-sort"></i>{{ fi }}<div class="dg-label{{ alignheader }}"{{ if labeltitle }} title="{{ labeltitle }}"{{ fi }}{{ if reorder }} draggable="true"{{ fi }}>{{ label | raw }}</div>{{ if filter }}<div class="dg-filter{{ alignfilter }}{{ if filterval != null && filterval !== \'\' }} dg-filter-selected{{ fi }}"><i class="fa dg-filter-cancel fa-times"></i>{{ if options }}<label data-name="{{ name }}">{{ if filterval }}{{ filterval }}{{ else }}{{ filter }}{{ fi }}</label>{{ else }}<input autocomplete="new-password" type="text" placeholder="{{ filter }}" class="dg-filter-input" name="{{ name }}{{ ts }}" data-name="{{ name }}" value="{{ filterval }}" />{{ fi }}</div>{{ else }}<div class="dg-filter-empty">&nbsp;</div>{{ fi }}</div>');
	var isIE = (/msie|trident/i).test(navigator.userAgent);
	var isredraw = false;
	var forcescroll = '';
	var schemas = {};

	self.meta = opt;

	function Cluster(el) {

		var self = this;
		var dom = el[0];
		var scrollel = el;

		self.row = config.rowheight;
		self.rows = [];
		self.limit = config.limit;
		self.pos = -1;
		self.enabled = !!config.clusterize;
		self.plus = 0;
		self.scrolltop = 0;
		self.prev = 0;

		var seh = '<div style="height:0"></div>';
		var set = $(seh);
		var seb = $(seh);

		var div = document.createElement('DIV');
		dom.appendChild(set[0]);
		dom.appendChild(div);
		dom.appendChild(seb[0]);
		self.el = $(div);

		self.render = function() {

			var t = self.pos * self.frame;
			var b = (self.rows.length * self.row) - (self.frame * 2) - t;
			var pos = self.pos * self.limit;
			var posto = pos + (self.limit * 2);

			set.css('height', t);
			seb.css('height', b < 2 ? isMOBILE ? (config.exec ? (self.row + 1) : (self.row * 2.25)) >> 0 : 3 : b);

			var tmp = self.scrollbar[0].scrollTop;
			var node = self.el[0];
			// node.innerHTML = '';

			var child = node.firstChild;

			while (child) {
				node.removeChild(child);
				child = node.firstChild;
			}

			for (var i = pos; i < posto; i++) {
				if (typeof(self.rows[i]) === 'string')
					self.rows[i] = $(self.rows[i])[0];

				if (self.rows[i])
					node.appendChild(self.rows[i]);
				else
					break;
			}

			if (self.prev < t)
				self.scrollbar[0].scrollTop = t;
			else
				self.scrollbar[0].scrollTop = tmp;

			self.prev = t;

			if (self.grid.selected) {
				var index = opt.rows.indexOf(self.grid.selected);
				if (index !== -1 && (index >= pos || index <= (pos + self.limit)))
					self.el.find('.dg-row[data-index="{0}"]'.format(index)).aclass('dg-selected');
			}
		};

		self.scrolling = function() {

			var y = self.scrollbar[0].scrollTop + 1;
			self.scrolltop = y;

			if (y < 0)
				return;

			var frame = Math.ceil(y / self.frame) - 1;
			if (frame === -1)
				return;

			if (self.pos !== frame) {

				// The content could be modified
				var plus = (self.el[0].offsetHeight / 2) - self.frame;
				if (plus > 0) {
					frame = Math.ceil(y / (self.frame + plus)) - 1;
					if (self.pos === frame)
						return;
				}

				if (self.max && frame >= self.max)
					frame = self.max;

				self.pos = frame;

				if (self.enabled)
					self.render();
				else {

					var node = self.el[0];
					var child = node.firstChild;

					while (child) {
						node.removeChild(child);
						child = node.firstChild;
					}

					for (var i = 0; i < self.rows.length; i++) {
						if (typeof(self.rows[i]) === 'string')
							self.rows[i] = $(self.rows[i])[0];
						self.el[0].appendChild(self.rows[i]);
					}
				}

				self.scroll && self.scroll();
				config.change && SEEX(self.makepath(config.change), null, null, self.grid);
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

			if (!self.enabled) {
				self.frame = 1000000;
			} else if (self.limit * 2 > rows.length) {
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

		self.scrollbar = scrollel.closest('.ui-scrollbar-area');
		self.scrollbar.on('scroll', self.scrolling);
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

		Thelpers.ui_datagrid_checkbox = function(val) {
			return '<div class="dg-checkbox' + (val ? ' dg-checked' : '') + '" data-custom="1"><i class="fa fa-check"></i></div>';
		};
	};

	self.readonly();
	self.bindvisible();
	self.nocompile();

	var reconfig = function() {
		self.tclass('dg-clickable', !!(config.click || config.dblclick));
	};

	self.configure = function(key, value, init) {
		switch (key) {
			case 'noborder':
				self.tclass('dg-noborder', !!value);
				break;
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
			case 'dblclick':
				if (value && value.SCOPE)
					config.dblclick = value.SCOPE(self, value);
				break;
			case 'click':
				if (value && value.SCOPE)
					config.click = value.SCOPE(self, value);
				break;
			case 'columns':
				self.datasource(value, function(path, value, type) {
					if (value) {
						opt.sort = null;
						opt.filter = {};
						opt.scroll = '';
						opt.selected = {};
						self.rebind(value);
						type && self.setter(null);
					}
				});
				break;
		}

		setTimeout2(self.ID + 'reconfigure', reconfig);
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
		config.changed && SEEX(self.makepath(config.changed), arr || self.changed(), self);
	};

	self.fn_in_checked = function(arr) {
		config.checked && SEEX(self.makepath(config.checked), arr || self.checked(), self);
	};

	self.fn_refresh = function() {
		setTimeout2(self.ID + 'filter', function() {
			if (config.exec)
				self.operation(opt.operation);
			else
				self.refreshfilter(true);
		}, 50);
	};

	self.make = function() {

		self.IDCSS = GUID(5);
		self.aclass('dg dg-noscroll dg-' + self.IDCSS);

		self.find('script').each(function() {
			var el = $(this);
			var id = el.attrd('id');

			if (id)
				schemas[id] = el.html();

			if (!schemas.default)
				schemas.default = el.html();
		});

		var pagination = '';

		if (config.exec)
			pagination = '<div class="dg-footer hidden"><div class="dg-pagination-items hidden-xs"></div><div class="dg-pagination"><button name="page-first" disabled><i class="fa fa-angle-double-left"></i></button><button name="page-prev" disabled><i class="fa fa-angle-left"></i></button><div><input type="text" name="page" maxlength="5" class="dg-pagination-input" /></div><button name="page-next" disabled><i class="fa fa-angle-right"></i></button><button name="page-last" disabled><i class="fa fa-angle-double-right"></i></button></div><div class="dg-pagination-pages"></div></div>';

		self.dom.innerHTML = '<div class="dg-btn-columns"><i class="fa fa-caret-left"></i><span class="fa fa-columns"></span></div><div class="dg-columns hidden"><div><div class="dg-columns-body"></div></div><button class="dg-columns-button" name="columns-apply"><i class="fa fa-columns"></i>{1}</button><span class="dt-columns-reset">{2}</span></div><div class="dg-container"><span class="dg-resize-line hidden"></span><div class="dg-header-scrollbar"><div class="dg-header"></div><div class="dg-body-scrollbar"><div class="dg-body"></div></div></div></div>{0}'.format(pagination, config.buttonapply, config.buttonreset);

		header = self.find('.dg-header');
		vbody = self.find('.dg-body');
		footer = self.find('.dg-footer');
		container = self.find('.dg-container');
		ecolumns = self.find('.dg-columns');

		sheader = self.find('.dg-header-scrollbar');
		sbody = self.find('.dg-body-scrollbar');

		self.scrollbarY = SCROLLBAR(sbody, { visibleY: true, orientation: 'y', controls: container, marginY: 58 });
		self.scrollbarX = SCROLLBAR(sheader, { visibleX: true, orientation: 'x', controls: container });

		// self.scrollbar.sync(sheader, 'x');

		if (schemas.default) {
			self.rebind(schemas.default);
			schemas.$current = 'default';
		}

		var events = {};

		events.mouseup = function(e) {
			if (r.is) {
				r.is = false;
				r.line.aclass('hidden');
				r.el.css('height', r.h);
				var x = r.el.css('left').parseInt();
				var index = +r.el.attrd('index');
				var width = opt.cols[index].width + (x - r.x);
				self.resizecolumn(index, width);
				e.preventDefault();
				e.stopPropagation();
			}
			events.unbind();
		};

		events.unbind = function() {
			$(W).off('mouseup', events.mouseup).off('mousemove', events.mousemove);
		};

		events.bind = function() {
			$(W).on('mouseup', events.mouseup).on('mousemove', events.mousemove);
		};

		var hidedir = function() {
			ishidedir = true;
			SETTER('!directory', 'hide');
			setTimeout(function() {
				ishidedir = false;
			}, 800);
		};

		var ishidedir = false;
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

		header.on('click', 'label', function() {

			var el = $(this);
			var index = +el.closest('.dg-hcol').attrd('index');
			var col = opt.cols[index];
			var opts = col.options instanceof Array ? col.options : GET(col.options);
			var dir = {};

			dir.element = el;
			dir.items = opts;
			dir.key = col.otext;
			dir.offsetX = -6;
			dir.offsetY = -2;
			dir.placeholder = config.dirplaceholder;

			dir.callback = function(item) {
				self.applyfilterdirectory(el, col, item);
			};

			SETTER('directory', 'show', dir);
		});

		self.event('dblclick', '.dg-col', function(e) {
			e.preventDefault();
			e.stopPropagation();
			self.editcolumn($(this));
		});

		var dblclick = { ticks: 0, id: null, row: null };
		r.line = container.find('.dg-resize-line');

		self.event('click', '.dg-row', function(e) {

			var now = Date.now();
			var el = $(this);
			var type = e.target.tagName;
			var target = $(e.target);

			if ((type === 'DIV' || type === 'SPAN') && !target.closest('.dg-checkbox').length) {

				var cls = 'dg-selected';
				var elrow = el.closest('.dg-row');
				var index = +elrow.attrd('index');
				var row = opt.rows[index];
				if (row == null)
					return;

				if (config.dblclick && dblclick.ticks && dblclick.ticks > now && dblclick.row === row) {
					config.dblclick && SEEX(self.makepath(config.dblclick), row, self, elrow, target);
					if (config.highlight && self.selected !== row) {
						opt.cluster.el.find('.' + cls).rclass(cls);
						self.selected = row;
						elrow.aclass(cls);
					}
					e.preventDefault();
					return;
				}

				dblclick.row = row;
				dblclick.ticks = now + 300;

				var rowarg = row;

				if (config.highlight) {
					opt.cluster.el.find('.' + cls).rclass(cls);
					if (!config.unhighlight || self.selected !== row) {
						self.selected = row;
						elrow.aclass(cls);
					} else
						rowarg = self.selected = null;
				}

				config.click && SEEX(self.makepath(config.click), rowarg, self, elrow, target);
			}
		});

		self.released = function(is) {
			!is && setTimeout(self.resize, 500);
		};

		self.event('click', '.dg-filter-cancel,.dt-columns-reset', function() {
			var el = $(this);
			if (el.hclass('dt-columns-reset'))
				self.resetcolumns();
			else {
				var tmp = el.parent();
				var input = tmp.find('input');
				if (input.length) {
					input.val('');
					input.trigger('change');
					return;
				}

				var label = tmp.find('label');
				if (label.length) {
					tmp.rclass('dg-filter-selected');
					var index = +el.closest('.dg-hcol').attrd('index');
					var col = opt.cols[index];
					var k = label.attrd('name');
					label.html(col.filter);
					forcescroll = opt.scroll = 'y';
					opt.operation = 'filter';
					delete opt.filter[k];
					delete opt.filtervalues[col.id];
					delete opt.filtercl[k];
					self.fn_refresh();
				}
			}
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
			forcescroll = '-';

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
			r.offset = offset; //offset;

			var prev = el.prev();
			r.min = (prev.length ? prev.css('left').parseInt() : (config.checkbox ? 70 : 30)) + 50;
			r.h = el.css('height');
			r.x = el.css('left').parseInt();
			r.line.css('height', opt.height);
			r.is = true;
			r.isline = false;
			e.preventDefault();
			e.stopPropagation();
		});

		header.on('mousemove', function(e) {
			if (r.is) {
				var x = (e.pageX - r.offset - 10);
				var x2 = self.scrollbarX.scrollLeft() + x;
				if (x2 < r.min)
					x2 = r.min;

				r.el.css('left', x2);
				r.line.css('left', x + 9);

				if (!r.isline) {
					r.isline = true;
					r.line.rclass('hidden');
				}

				e.preventDefault();
				e.stopPropagation();
			}
		});

		self.applyfilterdirectory = function(label, col, item) {

			var val = item[col.ovalue];
			var is = val != null && val !== '';
			var name = label.attrd('name');

			opt.filtervalues[col.id] = val;

			if (is) {
				if (opt.filter[name] == val)
					return;
				opt.filter[name] = val;
			} else
				delete opt.filter[name];

			delete opt.filtercache[name];
			opt.filtercl[name] = val;

			forcescroll = opt.scroll = 'y';
			opt.operation = 'filter';
			label.parent().tclass('dg-filter-selected', is);
			label.text(item[col.otext] || '');
			self.fn_refresh();
		};

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
			forcescroll = opt.scroll = 'y';
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
			delete opt.filtercl[name];

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

			forcescroll = opt.scroll = 'y';
			opt.operation = 'filter';
			el.tclass('dg-filter-selected', is);
			self.fn_refresh();
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
				self.selected = null;
				opt.cluster && opt.cluster.el.find('.' + cls).rclass(cls);
				config.highlight && config.click && SEEX(self.makepath(config.click), null, self);
				return;
			}

			self.selected = row;

			var elrow = opt.cluster.el.find('.dg-row[data-index="{0}"]'.format(index));
			if (elrow && config.highlight) {
				opt.cluster.el.find('.' + cls).rclass(cls);
				elrow.aclass(cls);
			}

			config.click && SEEX(self.makepath(config.click), row, self, elrow, null);
		};

		self.event('click', '.dg-checkbox', function() {

			var t = $(this);
			var custom = t.attrd('custom');

			if (custom === '1')
				return;

			t.tclass('dg-checked');

			if (custom === '2')
				return;

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
					forcescroll = opt.scroll = 'y';
					self.get().page = 1;
					self.operation('page');
					break;
				case 'page-last':
					forcescroll = opt.scroll = 'y';
					var tmp = self.get();
					tmp.page = tmp.pages;
					self.operation('page');
					break;
				case 'page-prev':
					forcescroll = opt.scroll = 'y';
					self.get().page -= 1;
					self.operation('page');
					break;
				case 'page-next':
					forcescroll = opt.scroll = 'y';
					self.get().page += 1;
					self.operation('page');
					break;
				default:
					var el = $(this);
					var row = opt.rows[+el.closest('.dg-row').attrd('index')];
					config.button && SEEX(self.makepath(config.button), this.name, row, el, e);
					break;
			}
		});

		self.scrollbarX.area.on('scroll', function() {
			!ishidedir && hidedir();
			isecolumns && self.applycolumns();
		});

		// config.exec && self.operation('init');
	};

	self.operation = function(type) {

		var value = self.get();

		if (value == null)
			value = {};

		if (type === 'filter' || type === 'init')
			value.page = 1;

		var keys = Object.keys(opt.filter);
		SEEX(self.makepath(config.exec), type, keys.length ? opt.filter : null, opt.sort && opt.sort.sort ? [(opt.sort.name + '_' + (opt.sort.sort === 1 ? 'asc' : 'desc'))] : null, value.page, self);

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
		data.col = opt.cols[index];
		if (!data.col.editable)
			return;

		data.rowindex = +row.attrd('index');
		data.row = opt.rows[data.rowindex];
		data.colindex = index;
		data.value = data.row[data.col.name];
		data.elrow = row;
		data.elcol = col;

		var clone = col.clone();
		var cb = function(data) {

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
			opt.render[data.rowindex] = $(self.renderrow(data.rowindex, data.row))[0];
			data.elrow.replaceWith(opt.render[data.rowindex]);
			self.fn_in_changed();

		};

		if (config.change)
			EXEC(self.makepath(config.change), data, cb, self);
		else
			self.datagrid_edit(data, cb);
	};

	self.applyfilter = function(obj, add) {


		if (!ready) {
			setTimeout(self.applyfilter, 100, obj, add);
			return;
		}

		if (!add)
			opt.filter = {};

		var keys = Object.keys(obj);

		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			var col = opt.cols.findItem('name', key);
			if (col.options) {
				var items = col.options instanceof Array ? col.options : GET(col.options);
				if (items instanceof Array) {
					var item = items.findItem(col.ovalue, obj[key]);
					if (item) {
						var el = header.find('.dg-hcol[data-index="{0}"] label'.format(col.index));
						if (el.length)
							self.applyfilterdirectory(el, col, item);
					}
				}
			}
		}

		header.find('input').each(function() {
			var t = this;
			var el = $(t);
			var val = obj[el.attrd('name')];
			if (val !== undefined)
				el.val(val == null ? '' : val);
		}).trigger('change');

	};

	self.rebind = function(code) {

		if (code.length < 30 && code.indexOf(' ') === -1) {
			schemas.$current = code;
			schemas[code] && self.rebind(schemas[code]);
			return;
		}

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

		opt.rowclasstemplate = null;
		opt.search = false;

		for (var i = 0; i < cols.length; i++) {
			var col = cols[i];

			if (typeof(col) === 'string') {
				opt.rowclasstemplate = Tangular.compile(col);
				cols.splice(i, 1);
				i--;
				continue;
			}

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

			if (col.editable) {
				cls += ' dg-editable';
				if (col.required)
					cls += ' dg-required';
			}

			var isbool = col.type && col.type.substring(0, 4) === 'bool';
			var TC = Tangular.compile;

			if (col.template) {
				col.templatecustom = true;
				col.template = TC((col.template.indexOf('<button') === -1 ? ('<div class="dg-value' + cls + '">{0}</div>') : '{0}').format(col.template));
			} else
				col.template = TC(('<div class="' + (isbool ? 'dg-bool' : 'dg-value') + cls + '"' + (config.allowtitles ? ' title="{{ {0} }}"' : '') + '>{{ {0} }}</div>').format(col.name + (col.format != null ? ' | format({0}) '.format(typeof(col.format) === 'string' ? ('\'' + col.format + '\'') : col.format) : '') + (col.empty ? ' | def({0})'.format(col.empty === true || col.empty == '1' ? '' : ('\'' + col.empty + '\'')) : '') + (isbool ? ' | ui_datagrid_checkbox' : '')));

			if (col.header)
				col.header = TC(col.header);
			else
				col.header = TC('{{ text | raw }}');

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

		// self.scrollbar.scroll(0, 0);
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

		if (sheader) {
			css = { width: opt.width };
			header.css(css);
			// vbody.css(css);
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
			column += Theadercol({ index: -1, label: '<div class="dg-checkbox dg-checkbox-main" data-value="-1"><i class="fa fa-check"></i></div>', filter: false, name: '$', sorting: false });

		for (var i = 0; i < opt.cols.length; i++) {
			var col = opt.cols[i];
			if (!col.hidden) {
				var filteritems = col.options ? col.options instanceof Array ? col.options : GET(col.options) : null;
				var filtervalue = opt.filtervalues[col.id];
				var obj = { index: i, ts: NOW.getTime(), label: col.header(col), filter: col.filter, reorder: config.reorder, sorting: col.sorting, name: col.name, alignfilter: col.alignfilter, alignheader: col.alignheader, filterval: filtervalue == null ? null : filteritems ? filteritems.findValue(col.ovalue, filtervalue, col.otext, '???') : filtervalue, labeltitle: col.title || col.text, options: filteritems };
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

		self.redrawsorting();
	};

	self.redraw = function(update) {
		var x = self.scrollbarX.scrollLeft();
		var y = self.scrollbarY.scrollTop();
		isredraw = update ? 2 : 1;
		self.refreshfilter();
		isredraw = 0;
		self.scrollbarX.scrollLeft(x);
		self.scrollbarY.scrollTop(y);
	};

	self.redrawrow = function(row) {
		var index = opt.rows.indexOf(row);
		if (index !== -1) {
			var el = vbody.find('.dg-row[data-index="{0}"]'.format(index));
			if (el.length) {
				opt.render[index] = $(self.renderrow(index, row))[0];
				el[0].parentNode.replaceChild(opt.render[index], el[0]);
			}
		}
	};

	self.appendrow = function(row, scroll, prepend) {

		var index = prepend ? 0 : (opt.rows.push(row) - 1);
		var model = self.get();

		if (model == null) {
			// bad
			return;
		} else {
			var arr = model.items ? model.items : model;
			if (prepend) {
				arr.unshift(row);
			} else if (model.items)
				arr.push(row);
			else
				arr.push(row);
		}

		if (prepend) {
			var tmp;
			// modifies all indexes
			for (var i = 0; i < opt.render.length; i++) {
				var node = opt.render[i];
				if (typeof(node) === 'string')
					node = opt.render[i] = $(node)[0];
				var el = $(node);
				var tmpindex = i + 1;
				tmp = el.rclass2('dg-row-').aclass('dg-row-' + tmpindex).attrd('index', tmpindex);
				tmp.find('.dg-number').html(tmpindex + 1);
				tmp.find('.dg-checkbox-main').attrd('value', tmpindex);
				if (opt.rows[i])
					opt.rows[i].ROW = tmpindex;
			}
			row.ROW = index;
			tmp = {};
			var keys = Object.keys(opt.checked);
			for (var i = 0; i < keys.length; i++)
				tmp[(+keys[i]) + 1] = 1;
			opt.checked = tmp;
			opt.render.unshift(null);
		}

		opt.render[index] = $(self.renderrow(index, row))[0];
		opt.cluster && opt.cluster.update(opt.render, !opt.scroll || opt.scroll === '-');
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

		var Trow = '<div><div class="dg-row dg-row-{0}{3}{4}" data-index="{2}">{1}</div></div>';
		var Tcol = '<div class="dg-col dg-col-{0}{2}{3}">{1}</div>';
		var column = '';

		if (config.numbering !== false)
			column += Tcol.format(-1, '<div class="dg-number">{0}</div>'.format(index + 1 + (plus || 0)));

		if (config.checkbox)
			column += Tcol.format(-1, '<div class="dg-checkbox-main dg-checkbox{1}" data-value="{0}"><i class="fa fa-check"></i></div>'.format(row.ROW, opt.checked[row.ROW] ? ' dg-checked' : ''));

		for (var j = 0; j < opt.cols.length; j++) {
			var col = opt.cols[j];
			if (!col.hidden)
				column += Tcol.format(j, col.template(row), col.align, row.CHANGES && row.CHANGES[col.name] ? ' dg-col-changed' : '');
		}

		column += '<div class="dg-col">&nbsp;</div>';
		var rowcustomclass = opt.rowclasstemplate ? opt.rowclasstemplate(row) : '';
		return Trow.format(index + 1, column, index, self.selected === row ? ' dg-selected' : '', (row.CHANGES ? ' dg-row-changed' : '') + (rowcustomclass || ''));
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

		var min = (((opt.height - 120) / config.rowheight) >> 0) + 1;
		var is = output.length < min;
		if (is) {
			for (var i = output.length; i < min + 1; i++)
				output.push('<div class="dg-row-empty">&nbsp;</div>');
		}

		self.tclass('dg-noscroll', is);

		if (noscroll) {
			self.scrollbarX.scrollLeft(0);
			self.scrollbarY.scrollTop(0);
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
			opt.scroll = (index++) === 0 ? 'xy' : '';
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

	var resizecache = {};

	self.resize = function() {

		if (!opt.cols || HIDDEN(self.dom))
			return;

		var el;
		var footerh = opt.footer = footer.length ? footer.height() : 0;

		switch (config.height) {
			case 'auto':
				el = self.element;
				opt.height = (WH - (el.offset().top + config.margin));
				break;
			case 'window':
				opt.height = WH - config.margin;
				break;
			case 'parent':
				el = self.element.parent();
				opt.height = (el.height() - config.margin);
				break;
			default:
				if (config.height > 0) {
					opt.height = config.height;
				} else {
					el = self.element.closest(config.height);
					opt.height = ((el.length ? el.height() : 200) - config.margin);
				}
				break;
		}

		var mr = (vbody.parent().css('margin-right') || '').parseInt();
		var h = opt.height - footerh;
		var sh = SCROLLBARWIDTH();

		var ismobile = isMOBILE && isTOUCH;

		if (resizecache.mobile !== ismobile && !config.noborder) {
			resizecache.mobile = ismobile;
			self.tclass('dg-mobile', ismobile);
		}

		if (resizecache.h !== h) {
			resizecache.h = h;
			sheader.css('height', h);
		}

		var tmpsh = h - (sh ? (sh + self.scrollbarX.thinknessX - 2) : (footerh - 2));

		resizecache.tmpsh = h;
		sbody.css('height', tmpsh + self.scrollbarX.marginY + (config.exec && self.scrollbarX.size.empty ? footerh : 0));

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
				if (resizecache.wmd !== w) {
					resizecache.wmd = w;
					self.css('width', w);
				}
			}
		}

		if (w == null)
			w = self.width();

		var emptyspace = 50 - mr;
		if (emptyspace < 50)
			emptyspace = 50;

		var width = (config.numbering !== false ? 40 : 0) + (config.checkbox ? 40 : 0) + emptyspace;

		for (var i = 0; i < opt.cols.length; i++) {
			var col = opt.cols[i];
			if (!col.hidden)
				width += col.width + 1;
		}

		if (w > width)
			width = w - 2;

		if (resizecache.hc !== h) {
			resizecache.hc = h;
			container.css('height', h);
		}

		if (resizecache.width !== width) {
			resizecache.width = width;
			header.css('width', width);
			vbody.css('width', width);
			self.find('.dg-body-scrollbar').css('width', width);
			opt.width2 = w;
		}

		self.scrollbarX.resize();
		self.scrollbarY.resize();

		ready = true;
		// header.parent().css('width', self.scrollbar.area.width());
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
			config.checkbox && header.find('.dg-checkbox-main').rclass('dg-checked');
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

				if ((/y/).test(opt.scroll))
					self.scrollbarY.scrollTop(0);

				if ((/x/).test(opt.scroll)) {
					if (useraction)	{
						var sl = self.scrollbarX.scrollLeft();
						self.scrollbarX.scrollLeft(sl ? sl - 1 : 0);
					} else
						self.scrollbarX.scrollLeft(0);
				}

				opt.scroll = '';
			}

			if (opt.sort != null) {
				if (!config.exec)
					opt.sort.sort && output.quicksort(opt.sort.name, opt.sort.sort === 1);
				self.redrawsorting();
			}
		}

		self.resize();
		self.renderrows(output, isredraw);

		setTimeout(self.resize, 100);
		opt.cluster && opt.cluster.update(opt.render, !opt.scroll || opt.scroll === '-');
		self.scrolling();

		if (isredraw) {
			if (isredraw === 2) {
				// re-update all items
				self.select(self.selected || null);
			}
		} else {
			var sel = self.selected;
			if (config.autoselect && output && output.length) {
				setTimeout(function() {
					self.select(sel ? output.findItem(config.clickid, sel.id) : output[0]);
				}, 1);
			} else if (opt.operation !== 'sort') {
				self.select(sel ? output.findItem(config.clickid, sel.id) : null);
			} else {
				var tmp = sel ? output.findItem(config.clickid, sel.id) : null;
				tmp && self.select(tmp);
			}
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
		opt.filtercl = {};
		opt.filtervalues = {};
		opt.cols && self.rendercols();
		if (config.exec)
			self.operation('refresh');
		else
			self.refresh();
	};

	var pagecache = { pages: -1, count: -1 };

	self.redrawpagination = function() {

		if (!config.exec)
			return;

		var value = self.get();
		var is = false;

		if (value.page === 1 || (value.pages != null && value.count != null)) {
			pagecache.pages = value.pages;
			pagecache.count = value.count;
			is = true;
		}

		footer.find('button').each(function() {

			var el = $(this);
			var dis = true;

			switch (this.name) {
				case 'page-next':
					dis = value.page >= pagecache.pages;
					break;
				case 'page-prev':
					dis = value.page === 1;
					break;
				case 'page-last':
					dis = !value.page || value.page === pagecache.pages;
					break;
				case 'page-first':
					dis = value.page === 1;
					break;
			}

			el.prop('disabled', dis);
		});

		footer.find('input')[0].value = value.page;

		if (is) {
			var num = pagecache.pages || 0;
			footer.find('.dg-pagination-pages')[0].innerHTML = num.pluralize.apply(num, config.pluralizepages);
			num = pagecache.count || 0;
			footer.find('.dg-pagination-items')[0].innerHTML = num.pluralize.apply(num, config.pluralizeitems);
		}

		footer.rclass('hidden');
	};

	self.setter = function(value, path, type) {

		if (!ready) {
			setTimeout(self.setter, 100, value, path, type);
			return;
		}

		if (config.exec && value == null) {
			self.operation('refresh');
			return;
		}

		if (value && value.schema && schemas.$current !== value.schema) {
			schemas.$current = value.schema;
			self.rebind(value.schema);
			setTimeout(function() {
				self.setter(value, path, type);
			}, 100);
			return;
		}

		if (!opt.cols)
			return;

		opt.checked = {};

		if (forcescroll) {
			opt.scroll = forcescroll;
			forcescroll = '';
		} else
			opt.scroll = type !== 'noscroll' ? 'xy' : '';

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
			vbody.find('.dg-checkbox-main').each(function() {
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

				var is = false;

				if (opt.filtercl[column] != null) {
					is = opt.filtercl[column] == val;
					return is;
				}

				if (val2 == null) {
					val2 = opt.filtercache[column] = filter.split(REG_STRING).trim();
					for (var j = 0; j < val2.length; j++)
						val2[j] = val2[j].toSearch();
				}

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

	self.readfilter = function() {
		return opt.filter;
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

	self.datagrid_cancel = function(meta, force) {
		var current = self.editable;
		if (current && current.is) {
			current.is = false;
			force && current.el.replaceWith(current.backup);
			current.input.off();
			$(W).off('keydown', current.fn).off('click', current.fn);
		}
	};

	self.datagrid_edit = function(meta, next) {

		if (!meta || !meta.col.editable)
			return;

		if (!self.editable)
			self.editable = {};

		var el = meta.elcol;
		var current = self.editable;
		current.is && self.datagrid_cancel(meta, true);
		current.is = true;

		current.backup = el.find('.dg-editable').aclass('dg-editable').clone();
		el = el.find('.dg-editable');

		if (!meta.col.type) {
			if (meta.value instanceof Date)
				meta.col.type = 'date';
			else
				meta.col.type = typeof(meta.value);
		}

		if (meta.col.options) {
			current.el = el;
			var opt = {};
			opt.element = el;
			opt.items = meta.col.options;
			opt.key = meta.col.otext;
			opt.placeholder = meta.col.dirsearch ? meta.col.dirsearch : '';
			if (meta.col.dirsearch === false)
				opt.search = false;
			opt.callback = function(item) {
				current.is = false;
				meta.value = item[meta.col.ovalue];
				next(meta);
				self.datagrid_cancel(meta);
			};
			SETTER('directory', 'show', opt);
			return;
		}

		var align = meta.col.align;
		el.rclass('dg-value').html(meta.col.type.substring(0, 4) === 'bool' ? '<div{1}><div class="dg-checkbox{0}" data-custom="2"><i class="fa fa-check"></i></div></div>'.format(meta.value ? ' dg-checked' : '', align ? (' class="' + align.trim() + '"') : '') : '<input type="{0}" maxlength="{1}"{2} />'.format(meta.col.ispassword ? 'password' : 'text', meta.col.maxlength || 100, align ? (' class="' + align.trim() + '"') : ''));
		current.el = el;

		var input = meta.elcol.find('input');
		input.val(meta.value instanceof Date ? meta.value.format(meta.col.format) : meta.value);
		input.focus();
		current.input = input;

		if (meta.col.type === 'date') {
			// DATE
			var opt = {};
			opt.element = el;
			opt.value = meta.value;
			opt.callback = function(date) {
				current.is = false;
				meta.value = date;
				next(meta);
				self.datagrid_cancel(meta);
			};
			SETTER('datepicker/show', opt);
		}

		current.fn = function(e) {

			if (!current.is)
				return;

			if (e.type === 'click') {
				if (e.target.tagName === 'INPUT')
					return;
				e.preventDefault();
				e.keyCode = 13;
				if (meta.col.type === 'date') {
					e.type = 'keydown';
					setTimeout(current.fn, 800, e);
					return;
				} else if (meta.col.type.substring(0, 4) === 'bool') {
					var tmp = $(e.target);
					var is = tmp.hclass('dg-checkbox');
					if (!is) {
						tmp = tmp.closest('.dg-checkbox');
						is = tmp.length;
					}
					if (is) {
						meta.value = tmp.hclass('dg-checked');
						next(meta);
						self.datagrid_cancel(meta);
						return;
					}
				}
			}

			switch (e.keyCode) {
				case 13: // ENTER
				case 9: // TAB

					var val = input.val();
					if (val == meta.value) {
						next = null;
						self.datagrid_cancel(meta, true);
					} else {

						if (meta.col.type === 'number') {
							val = val.parseFloat();
							if (val == meta.value || (meta.min != null && meta.min > val) || (meta.max != null && meta.max < val)) {
								next = null;
								self.datagrid_cancel(meta, true);
								return;
							}
						} else if (meta.col.type === 'date') {

							val = val.parseDate(meta.format ? meta.format.env() : undefined);

							if (!val || isNaN(val.getTime()))
								val = null;

							if (val && meta.value && val.getTime() === meta.value.getTime()) {
								next = null;
								self.datagrid_cancel(meta, true);
								return;
							}
						}

						if (meta.col.required && (val == null || val === '')) {
							// WRONG VALUE
							self.datagrid_cancel(meta, true);
							return;
						}

						meta.value = val;
						next(meta);
						self.datagrid_cancel(meta);
					}

					if (e.which === 9) {

						// tries to edit another field
						var elcol = meta.elcol;

						while (true) {
							elcol = elcol.next();
							if (!elcol.length)
								break;

							var eledit = elcol.find('.dg-editable');
							if (eledit.length) {
								setTimeout(function() {
									self.editcolumn(meta.rowindex, +elcol.attr('class').match(/\d+/)[0]);
								}, 200);
								break;
							}
						}
					}

					break;

				case 27: // ESC
					next = null;
					self.datagrid_cancel(meta, true);
					break;
			}
		};

		$(W).on('keydown', current.fn).on('click', current.fn);
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

COMPONENT('menu', function(self, config, cls) {

	self.singleton();
	self.readonly();
	self.nocompile && self.nocompile();

	var cls2 = '.' + cls;

	var is = false;
	var issubmenu = false;
	var isopen = false;
	var events = {};
	var ul, children, prevsub, parentclass;

	self.make = function() {
		self.aclass(cls + ' hidden ' + cls + '-style-' + (config.style || 1));
		self.append('<div class="{0}-items"><ul></ul></div><div class="{0}-submenu hidden"><ul></ul></div>'.format(cls));
		ul = self.find(cls2 + '-items').find('ul');
		children = self.find(cls2 + '-submenu');

		self.event('click', 'li', function(e) {

			clearTimeout2(self.ID);

			var el = $(this);
			if (!el.hclass(cls + '-divider') && !el.hclass(cls + '-disabled')) {
				self.opt.scope && M.scope(self.opt.scope);
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

			e.preventDefault();
			e.stopPropagation();
		});

		events.hide = function() {
			is && self.hide();
		};

		self.event('scroll', events.hide);
		self.on('reflow + scroll + resize + resize2', events.hide);

		events.click = function(e) {
			if (is && !isopen && (!self.target || (self.target !== e.target && !self.target.contains(e.target))))
				setTimeout2(self.ID, self.hide, isMOBILE ? 700 : 300);
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
		$(document).on('touchstart mouseenter mousedown', cls2 + '-children', events.children).on('touchstart mousedown', events.click);
		$(W).on('scroll', events.hide);
		self.element.on('mouseenter', 'li', events.hidechildren);
	};

	self.unbindevents = function() {
		events.is = false;
		$(document).off('touchstart mouseenter mousedown', cls2 + '-children', events.children).off('touchstart mousedown', events.click);
		$(W).off('scroll', events.hide);
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
				icon = '<i class="{0}"></i>'.format(item.icon.charAt(0) === '!' ? item.icon.substring(1) : item.icon.indexOf('fa-') === -1 ? ('fa fa-' + item.icon) : item.icon);
			else
				cn = (cn ? (cn + ' ') : '') + cls + '-nofa';

			tmp = '';

			if (index == null && item.children && item.children.length) {
				cn += (cn ? ' ' : '') + cls + '-children';
				tmp += '<i class="fa fa-play pull-right"></i>';
			}

			if (item.selected)
				cn += (cn ? ' ' : '') + cls + '-selected';

			if (item.disabled)
				cn += (cn ? ' ' : '') + cls + '-disabled';

			tmp += '<div class="{0}-name">{1}{2}{3}</div>'.format(cls, icon, item.name, item.shortcut ? '<b>{0}</b>'.format(item.shortcut) : '');

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
		opt.scope = M.scope();

		if (parentclass && opt.classname !== parentclass) {
			self.rclass(parentclass);
			parentclass = null;
		}

		if (opt.large)
			self.aclass('ui-large');
		else
			self.rclass('ui-large');

		isopen = false;
		issubmenu = false;
		prevsub = null;

		var css = {};
		children.aclass('hidden');
		children.find('ul').empty();
		clearTimeout2(self.ID);

		ul.html(self.makehtml(opt.items));

		if (!parentclass && opt.classname) {
			self.aclass(opt.classname);
			parentclass = opt.classname;
		}

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

		if (opt.position === 'bottom')
			css.top += 10;
		else
			css.top -= 10;

		if (opt.offsetX)
			css.left += opt.offsetX;

		if (opt.offsetY)
			css.top += opt.offsetY;

		var mw = w;
		var mh = self.height();

		if (css.left < 0)
			css.left = 10;
		else if ((mw + css.left) > WW)
			css.left = (WW - mw) - 10;

		if (css.top < 0)
			css.top = 10;
		else if ((mh + css.top) > WH)
			css.top = (WH - mh) - 10;

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

	self.response = function(message, callback, response) {

		var fn;

		if (typeof(message) === 'function') {
			response = callback;
			fn = message;
			message = null;
		} else if (typeof(callback) === 'function')
			fn = callback;
		else {
			response = callback;
			fn = null;
		}

		if (response instanceof Array) {
			var builder = [];
			for (var i = 0; i < response.length; i++) {
				var err = response[i].error;
				err && builder.push(err);
			}
			self.warning(builder.join('<br />'));
			SETTER('!loading/hide');
		} else if (typeof(response) === 'string') {
			self.warning(response);
			SETTER('!loading/hide');
		} else {
			message && self.success(message);
			fn && fn(response);
		}
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
		// hardcoded
		url = (config.url || '').env(true) + '?id=' + common.id;
		if (!url.match(/^(ws|wss):\/\//))
			url = (location.protocol.length === 6 ? 'wss' : 'ws') + '://' + location.host + (url.substring(0, 1) !== '/' ? '/' : '') + url;
		setTimeout(self.connect, 500);
		self.destroy = self.close;
	};

	self.send = function(obj) {
		queue.push(JSON.stringify(obj));
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

		e.reason && WARN('WebSocket:', e.reason);
		self.close(true);
		setTimeout(self.connect, config.reconnect);
	}

	function onMessage(e) {
		var data;
		try {
			data = PARSE(e.data);
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

COMPONENT('shortcuts', function(self) {

	var items = [];
	var length = 0;
	var keys = {};

	self.singleton();
	self.readonly();
	self.blind();
	self.nocompile && self.nocompile();

	var cb = function(o, e) {
		o.callback(e, o.owner);
	};

	self.make = function() {

		$(W).on('keydown', function(e) {

			var f = e.key;
			var c = e.keyCode;

			if (f.length > 1 && f.charAt(0) === 'F')
				c = 0;
			else
				f = '-';

			// ctrl,alt,shift,meta,fkey,code
			var key = (e.ctrlKey ? 1 : 0) + '' + (e.altKey ? 1 : 0) + '' + (e.shiftKey ? 1 : 0) + '' + (e.metaKey ? 1 : 0) + f + c;

			if (!keys[key])
				return;

			if (length && !e.isPropagationStopped()) {
				for (var i = 0; i < length; i++) {
					var o = items[i];
					if (o.fn(e)) {
						if (o.prevent) {
							e.preventDefault();
							e.stopPropagation();
						}
						setTimeout(cb, 100, o, e);
						return;
					}
				}
			}
		});

		ON('component + knockknock', self.refresh);
	};

	self.refreshforce = function() {

		var arr = document.querySelectorAll('.shortcut');
		var index = 0;

		while (true) {
			var item = items[index++];
			if (item == null)
				break;
			if (item.owner) {
				index--;
				items.splice(index, 1);
			}
		}

		for (var i = 0; i < arr.length; i++) {
			var shortcut = arr[i].getAttribute('data-shortcut');
			shortcut && self.register(shortcut, self.execshortcut, true, arr[i]);
		}
	};

	self.execshortcut = function(e, owner) {
		$(owner).trigger('click');
	};

	self.refresh = function() {
		setTimeout2(self.ID, self.refreshforce, 500);
	};

	self.exec = function(shortcut) {
		var item = items.findItem('shortcut', shortcut.toLowerCase().replace(/\s/g, ''));
		item && item.callback(EMPTYOBJECT, item.owner);
	};

	self.register = function(shortcut, callback, prevent, owner) {
		shortcut.split(',').trim().forEach(function(shortcut) {

			var builder = [];
			var alias = [];
			var cachekey = [0, 0, 0, 0, '-', 0]; // ctrl,alt,shift,meta,fkey,code

			shortcut.split('+').trim().forEach(function(item) {
				var lower = item.toLowerCase();
				alias.push(lower);

				switch (lower) {
					case 'ctrl':
						cachekey[0] = 1;
						break;
					case 'alt':
						cachekey[1] = 1;
						break;
					case 'shift':
						cachekey[2] = 1;
						break;
					case 'win':
					case 'meta':
					case 'cmd':
						cachekey[3] = 1;
						break;
				}

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
						cachekey[5] = 45;
						return;
					case 'space':
						builder.push('e.keyCode===32');
						cachekey[5] = 32;
						return;
					case 'tab':
						builder.push('e.keyCode===9');
						cachekey[5] = 9;
						return;
					case 'esc':
						builder.push('e.keyCode===27');
						cachekey[5] = 27;
						return;
					case 'enter':
						builder.push('e.keyCode===13');
						cachekey[5] = 13;
						return;
					case 'backspace':
						builder.push('e.keyCode===8');
						cachekey[5] = 8;
						break;
					case 'del':
					case 'delete':
						builder.push('e.keyCode===46');
						cachekey[5] = 46;
						return;
					case 'remove':
						builder.push('(e.keyCode===8||e.keyCode===46)');
						cachekey[5] = -1;
						return;
					case 'up':
						builder.push('e.keyCode===38');
						cachekey[5] = 38;
						return;
					case 'down':
						builder.push('e.keyCode===40');
						cachekey[5] = 40;
						return;
					case 'right':
						builder.push('e.keyCode===39');
						cachekey[5] = 39;
						return;
					case 'left':
						builder.push('e.keyCode===37');
						cachekey[5] = 37;
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
						cachekey[4] = a;
						return;
					case 'capslock':
						builder.push('e.which===20');
						cachekey[5] = 20;
						return;
				}

				var num = item.parseInt();
				if (num) {
					builder.push('e.which===' + num);
					cachekey[5] = num;
				} else {
					num = item.toUpperCase().charCodeAt(0);
					cachekey[5] = num;
					builder.push('e.keyCode==={0}'.format(num));
				}
			});

			items.push({ shortcut: alias.join('+'), fn: new Function('e', 'return ' + builder.join('&&')), callback: callback, prevent: prevent, owner: owner });
			length = items.length;

			var k;

			// Remove
			if (cachekey[5] === -1) {
				cachekey[5] = 8;
				k = cachekey.join('');
				keys[k] = 1;
				cachekey[5] = 46;
			}

			k = cachekey.join('');
			keys[k] = 1;
		});

		if (!owner)
			self.refresh();

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
		input = self.find('input');
		self.event('keydown', 'input', function(e) {
			if (e.which === 13) {
				self.submit();
				self.set('');
			}
		});
	};

	self.submit = function(){
		EXEC(config.exec, input.parent().attrd('name'), input.val().toLowerCase().replace(/[^a-z0-9./\-_]/gi, ''), formtype);
	};

	self.val = function(value, type, submit) {
		input && input.val(value);
		formtype = type;
		submit && self.submit();
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

COMPONENT('infopanel', function(self, config, cls) {

	var is = false;
	var cache;
	var tsshow;
	var tshide;
	var callback;

	// self.singleton();
	self.readonly();
	// self.bindchanges();
	// self.bindvisible();
	// self.bindexact();
	// self.blind();

	self.make = function() {
		self.aclass(cls + ' hidden invisible');
		$(document).on('click mousedown', self.hide);

		self.on('resize + scroll', function() {
			self.hide();
		});
	};

	self.hide = function(force) {
		if (is || force === true) {
			clearTimeout(tshide);
			tshide = setTimeout(function() {
				is = false;
				self.aclass('hidden invisible');
				cache = null;
				callback && setTimeout(function(callback) {
					callback();
				}, 1000, callback);
				callback = null;
			}, 100);
		}
	};

	self.show = function(el, render, offsetX, offsetY, top, cb) {

		var main = self.element;

		if (!(el instanceof jQuery))
			el = $(el);

		if (cache === el[0]) {
			is = true;
			self.hide(true);
			return;
		}

		callback = cb;
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

COMPONENT('viewbox', 'margin:0;scroll:true;delay:100;scrollbar:0;visibleY:1;height:100;invisible:1', function(self, config, cls) {

	var eld, elb;
	var scrollbar;
	var cls2 = '.' + cls;
	var init = false;
	var cache;
	var scrolltoforce;

	self.readonly();

	self.init = function() {

		var resize = function() {
			for (var i = 0; i < M.components.length; i++) {
				var com = M.components[i];
				if (com.name === 'viewbox' && com.dom.offsetParent && com.$ready && !com.$removed)
					com.resizeforce();
			}
		};

		ON('resize2', function() {
			setTimeout2('viewboxresize', resize, 200);
		});
	};

	self.destroy = function() {
		scrollbar && scrollbar.destroy();
	};

	self.configure = function(key, value, init) {
		switch (key) {
			case 'disabled':
				eld.tclass('hidden', !value);
				break;
			case 'minheight':
			case 'margin':
			case 'marginxs':
			case 'marginsm':
			case 'marginmd':
			case 'marginlg':
				!init && self.resizeforce();
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
		config.invisible && self.aclass('invisible');
		config.scroll && MAIN.version > 17 && self.element.wrapInner('<div class="' + cls + '-body"></div>');
		self.element.prepend('<div class="' + cls + '-disabled hidden"></div>');
		eld = self.find('> .{0}-disabled'.format(cls)).eq(0);
		elb = self.find('> .{0}-body'.format(cls)).eq(0);
		self.aclass('{0} {0}-hidden'.format(cls));
		if (config.scroll) {
			if (config.scrollbar) {
				if (MAIN.version > 17) {
					scrollbar = W.SCROLLBAR(self.find(cls2 + '-body'), { shadow: config.scrollbarshadow, visibleY: config.visibleY, visibleX: config.visibleX, orientation: config.visibleX ? null : 'y', parent: self.element });
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

	self.resize = function() {
		setTimeout2(self.ID, self.resizeforce, 200);
	};

	self.resizeforce = function() {

		var el = self.parent(config.parent);
		var h = el.height();
		var w = el.width();

		var width = WIDTH();
		var mywidth = self.element.width();
		var key = width + 'x' + mywidth + 'x' + w + 'x' + h + 'x' + config.margin;

		if (cache === key) {
			scrollbar && scrollbar.resize();
			if (scrolltoforce) {
				if (scrolltoforce ==='bottom')
					self.scrollbottom(0);
				else
					self.scrolltop(0);
				scrolltoforce = null;
			}
			return;
		}

		cache = key;

		var margin = config.margin;
		var responsivemargin = config['margin' + width];

		if (responsivemargin != null)
			margin = responsivemargin;

		if (margin === 'auto')
			margin = self.element.offset().top;

		if (h === 0 || w === 0) {
			self.$waiting && clearTimeout(self.$waiting);
			self.$waiting = setTimeout(self.resize, 234);
			return;
		}

		h = ((h / 100) * config.height) - margin;

		if (config.minheight && h < config.minheight)
			h = config.minheight;

		css.height = h;
		css.width = mywidth;
		eld.css(css);

		css.width = '';
		self.css(css);
		elb.length && elb.css(css);
		self.element.SETTER('*', 'resize');
		var c = cls + '-hidden';
		self.hclass(c) && self.rclass(c, 100);
		scrollbar && scrollbar.resize();

		if (scrolltoforce) {
			if (scrolltoforce ==='bottom')
				self.scrollbottom(0);
			else
				self.scrolltop(0);
			scrolltoforce = null;
		}

		if (!init) {
			self.rclass('invisible', 250);
			init = true;
		}
	};

	self.resizescrollbar = function() {
		scrollbar && scrollbar.resize();
	};

	self.setter = function() {
		scrolltoforce = config.scrollto || config.scrolltop;
		if (scrolltoforce) {
			if (scrolltoforce ==='bottom')
				self.scrollbottom(0);
			else
				self.scrolltop(0);
			scrolltoforce = null;
		}
		setTimeout(self.resize, config.delay, scrolltoforce);
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

COMPONENT('directory', 'minwidth:200', function(self, config, cls) {

	var cls2 = '.' + cls;
	var container, timeout, icon, plus, skipreset = false, skipclear = false, ready = false, input = null, issearch = false;
	var is = false, selectedindex = 0, resultscount = 0, skiphide = false;
	var templateE = '{{ name | encode | ui_directory_helper }}';
	var templateR = '{{ name | raw }}';
	var template = '<li data-index="{{ $.index }}" data-search="{{ $.search }}" {{ if selected }} class="current selected{{ if classname }} {{ classname }}{{ fi }}"{{ else if classname }} class="{{ classname }}"{{ fi }}>{{ if $.checkbox }}<span class="' + cls + '-checkbox"><i class="fa fa-check"></i></span>{{ fi }}{0}</li>';
	var templateraw = template.format(templateR);
	var regstrip = /(&nbsp;|<([^>]+)>)/ig;
	var parentclass;

	template = template.format(templateE);

	Thelpers.ui_directory_helper = function(val) {
		var t = this;
		return t.template ? (typeof(t.template) === 'string' ? t.template.indexOf('{{') === -1 ? t.template : Tangular.render(t.template, this) : t.render(this, val)) : self.opt.render ? self.opt.render(this, val) : val;
	};

	self.template = Tangular.compile(template);
	self.templateraw = Tangular.compile(templateraw);

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
		self.append('<div class="{1}-search"><span class="{1}-add hidden"><i class="fa fa-plus"></i></span><span class="{1}-button"><i class="fa fa-search"></i></span><div><input type="text" placeholder="{0}" class="{1}-search-input" name="dir{2}" autocomplete="new-password" /></div></div><div class="{1}-container"><ul></ul></div>'.format(config.placeholder, cls, Date.now()));
		container = self.find('ul');
		input = self.find('input');
		icon = self.find(cls2 + '-button').find('.fa');
		plus = self.find(cls2 + '-add');

		self.event('mouseenter mouseleave', 'li', function() {
			if (ready && !issearch) {
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

		self.event('focus', 'input', function() {
			if (self.opt.search === false)
				$(this).blur();
		});

		self.event('click', cls2 + '-button', function(e) {
			skipclear = false;
			input.val('');
			self.search();
			e.stopPropagation();
			e.preventDefault();
		});

		self.event('click', cls2 + '-add', function() {
			if (self.opt.custom && self.opt.callback) {
				self.opt.scope && M.scope(self.opt.scope);
				self.opt.callback(input.val(), self.opt.element, true);
				self.hide();
			}
		});

		self.event('click', 'li', function(e) {

			if (self.opt.callback) {
				self.opt.scope && M.scope(self.opt.scope);
				var item = self.opt.items[+this.getAttribute('data-index')];
				if (self.opt.checkbox) {
					item.selected = !item.selected;
					$(this).tclass('selected', item.selected);
					var response = [];
					for (var i = 0; i < self.opt.items.length; i++) {
						var m = self.opt.items[i];
						if (m.selected)
							response.push(m);
					}
					self.opt.callback(response, self.opt.element);
					skiphide = true;
				} else
					self.opt.callback(item, self.opt.element);
			}

			is = true;

			if (!self.opt.checkbox) {
				self.hide(0);
				e.preventDefault();
				e.stopPropagation();
			}

		});

		var e_click = function(e) {

			if (skiphide) {
				skiphide = false;
				return;
			}

			var node = e.target;
			var count = 0;

			if (is) {
				while (true) {
					var c = node.getAttribute('class') || '';
					if (c.indexOf(cls + '-search-input') !== -1)
						return;
					node = node.parentNode;
					if (!node || !node.tagName || node.tagName === 'BODY' || count > 3)
						break;
					count++;
				}
			} else {
				is = true;
				while (true) {
					var c = node.getAttribute('class') || '';
					if (c.indexOf(cls) !== -1) {
						is = false;
						break;
					}
					node = node.parentNode;
					if (!node || !node.tagName || node.tagName === 'BODY' || count > 4)
						break;
					count++;
				}
			}

			is && self.hide(0);
		};

		var e_resize = function() {
			is && self.hide(0);
		};

		self.bindedevents = false;

		self.bindevents = function() {
			if (!self.bindedevents) {
				$(document).on('click', e_click);
				$(W).on('resize', e_resize);
				self.bindedevents = true;
			}
		};

		self.unbindevents = function() {
			if (self.bindedevents) {
				self.bindedevents = false;
				$(document).off('click', e_click);
				$(W).off('resize', e_resize);
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
						self.opt.scope && M.scope(self.opt.scope);
						if (sel.length)
							self.opt.callback(self.opt.items[+sel.attrd('index')], self.opt.element);
						else if (self.opt.custom)
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
			issearch = true;
			setTimeout2(self.ID, self.search, 100, null, this.value);
		});

		var fn = function() {
			is && self.hide(1);
		};

		self.on('reflow + scroll + resize + resize2', fn);
		$(W).on('scroll', fn);
	};

	self.move = function() {

		var counter = 0;
		var scroller = container.parent();
		var li = container.find('li');
		var hli = 0;
		var was = false;
		var last = -1;
		var lastselected = 0;
		var plus = 0;

		for (var i = 0; i < li.length; i++) {

			var el = $(li[i]);

			if (el.hclass('hidden')) {
				el.rclass('current');
				continue;
			}

			var is = selectedindex === counter;
			el.tclass('current', is);

			if (is) {
				hli = (el.innerHeight() || 30) + 1;
				plus = (hli * 2);
				was = true;
				var t = (hli * (counter || 1));
				scroller[0].scrollTop = t - plus;
			}

			counter++;
			last = i;
			lastselected++;
		}

		if (!was && last >= 0) {
			selectedindex = lastselected;
			li.eq(last).aclass('current');
		}
	};

	var nosearch = function() {
		issearch = false;
	};

	self.nosearch = function() {
		setTimeout2(self.ID + 'nosearch', nosearch, 500);
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
			self.nosearch();
			return;
		}

		resultscount = 0;
		selectedindex = 0;

		if (self.opt.ajax) {
			var val = value || '';
			if (self.ajaxold !== val) {
				self.ajaxold = val;
				setTimeout2(self.ID, function(val) {
					self.opt && self.opt.ajax(val, function(items) {
						var builder = [];
						var indexer = {};
						var item;
						var key = (self.opt.search == true ? self.opt.key : (self.opt.search || self.opt.key)) || 'name';

						for (var i = 0; i < items.length; i++) {
							item = items[i];
							if (self.opt.exclude && self.opt.exclude(item))
								continue;
							indexer.index = i;
							indexer.search = item[key] ? item[key].replace(regstrip, '') : '';
							indexer.checkbox = self.opt.checkbox === true;
							resultscount++;
							builder.push(self.opt.ta(item, indexer));
						}

						if (self.opt.empty) {
							item = {};
							var tmp = self.opt.raw ? '<b>{0}</b>'.format(self.opt.empty) : self.opt.empty;
							item[self.opt.key || 'name'] = tmp;
							if (!self.opt.raw)
								item.template = '<b>{0}</b>'.format(self.opt.empty);
							indexer.index = -1;
							builder.unshift(self.opt.ta(item, indexer));
						}

						skipclear = true;
						self.opt.items = items;
						container.html(builder);
						self.move();
						self.nosearch();
					});
				}, 300, null, val);
			}
		} else if (value) {
			value = value.toSearch().split(' ');
			var arr = container.find('li');
			for (var i = 0; i < arr.length; i++) {
				var el = $(arr[i]);
				var val = el.attrd('search').toSearch();
				var is = false;

				for (var j = 0; j < value.length; j++) {
					if (val.indexOf(value[j]) === -1) {
						is = true;
						break;
					}
				}

				el.tclass('hidden', is);

				if (!is)
					resultscount++;
			}
			skipclear = true;
			self.move();
			self.nosearch();
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
		// opt.classname

		var el = opt.element instanceof jQuery ? opt.element[0] : opt.element;

		if (opt.items == null)
			opt.items = EMPTYARRAY;

		self.tclass(cls + '-default', !opt.render);

		if (parentclass) {
			self.rclass(parentclass);
			parentclass = null;
		}

		if (opt.classname) {
			self.aclass(opt.classname);
			parentclass = opt.classname;
		}

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

		if (type === 'string') {
			items = GET(items);
			type = typeof(items);
		}

		if (type === 'function' && callback) {
			type = '';
			opt.ajax = items;
			items = null;
		}

		if (!items && !opt.ajax) {
			self.hide(0);
			return;
		}

		setTimeout(self.bindevents, 500);
		self.tclass(cls + '-search-hidden', opt.search === false);

		self.opt = opt;
		opt.class && self.aclass(opt.class);

		input.val('');

		var builder = [];
		var selected = null;

		opt.ta = opt.key ? Tangular.compile((opt.raw ? templateraw : template).replace(/\{\{\sname/g, '{{ ' + opt.key)) : opt.raw ? self.templateraw : self.template;

		if (!opt.ajax) {
			var indexer = {};
			var key = (opt.search == true ? opt.key : (opt.search || opt.key)) || 'name';
			for (var i = 0; i < items.length; i++) {

				item = items[i];

				if (typeof(item) === 'string')
					item = { name: item, id: item, selected: item === opt.selected };

				if (opt.exclude && opt.exclude(item))
					continue;

				if (item.selected || opt.selected === item) {
					selected = i;
					skipreset = true;
					item.selected = true;
				} else
					item.selected = false;

				indexer.checkbox = opt.checkbox === true;
				indexer.index = i;
				indexer.search = item[key] ? item[key].replace(regstrip, '') : '';
				builder.push(opt.ta(item, indexer));
			}

			if (opt.empty) {
				item = {};
				var tmp = opt.raw ? '<b>{0}</b>'.format(opt.empty) : opt.empty;
				item[opt.key || 'name'] = tmp;
				if (!opt.raw)
					item.template = '<b>{0}</b>'.format(opt.empty);
				indexer.index = -1;
				builder.unshift(opt.ta(item, indexer));
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
				options.left = Math.ceil((offset.left - width / 2) + (opt.element.innerWidth() / 2));
				break;
			case 'right':
				options.left = (offset.left - width) + opt.element.innerWidth();
				break;
			default:
				options.left = offset.left;
				break;
		}

		options.top = opt.position === 'bottom' ? ((offset.top - self.height()) + element.height()) : offset.top;
		options.scope = M.scope ? M.scope() : '';

		if (opt.offsetX)
			options.left += opt.offsetX;

		if (opt.offsetY)
			options.top += opt.offsetY;

		var mw = width;
		var mh = self.height();

		if (options.left < 0)
			options.left = 10;
		else if ((mw + options.left) > WW)
			options.left = (WW - mw) - 10;

		if (options.top < 0)
			options.top = 10;
		else if ((mh + options.top) > WH)
			options.top = (WH - mh) - 10;

		self.css(options);

		!isMOBILE && setTimeout(function() {
			ready = true;
			if (opt.search !== false)
				input.focus();
		}, 200);

		setTimeout(function() {
			self.initializing = false;
			is = true;
			if (selected == null)
				scroller[0].scrollTop = 0;
			else {
				var h = container.find('li:first-child').innerHeight() + 1;
				var y = (container.find('li.selected').index() * h) - (h * 2);
				scroller[0].scrollTop = y < 0 ? 0 : y;
			}
		}, 100);

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
		W.ui_input_template = Tangular.compile(('{{ if label }}<div class="{0}-label">{{ if icon }}<i class="fa fa-{{ icon }}"></i>{{ fi }}{{ label | raw }}{{ after | raw }}</div>{{ fi }}<div class="{0}-control{{ if licon }} {0}-licon{{ fi }}{{ if ricon || (type === \'number\' && increment) }} {0}-ricon{{ fi }}">{{ if ricon || (type === \'number\' && increment) }}<div class="{0}-icon-right{{ if type === \'number\' && increment }} {0}-increment{{ else if riconclick || type === \'date\' || type === \'time\' || (type === \'search\' && searchalign === 1) || type === \'password\' }} {0}-click{{ fi }}">{{ if type === \'number\' }}<i class="fa fa-caret-up"></i><i class="fa fa-caret-down"></i>{{ else }}{{ ricon | ui_input_icon }}{{ fi }}</div>{{ fi }}{{ if licon }}<div class="{0}-icon-left{{ if liconclick || (type === \'search\' && searchalign !== 1) }} {0}-click{{ fi }}">{{ licon | ui_input_icon }}</div>{{ fi }}<div class="{0}-input{{ if align === 1 || align === \'center\' }} center{{ else if align === 2 || align === \'right\' }} right{{ fi }}">{{ if placeholder && !innerlabel }}<div class="{0}-placeholder">{{ placeholder }}</div>{{ fi }}<input type="{{ if !dirsource && type === \'password\' }}password{{ else }}text{{ fi }}"{{ if autofill }} name="{{ PATH }}"{{ else }} name="input' + Date.now() + '" autocomplete="new-password"{{ fi }}{{ if dirsource }} readonly{{ else }} data-jc-bind=""{{ fi }}{{ if maxlength > 0}} maxlength="{{ maxlength }}"{{ fi }}{{ if autofocus }} autofocus{{ fi }} /></div></div>{{ if error }}<div class="{0}-error hidden"><i class="fa fa-warning"></i> {{ error }}</div>{{ fi }}').format(cls));
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

			if (config.disabled)
				return $(this).blur();

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
			self.tclass(cls + '-camouflaged', is);
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
				if ((config.minvalue != null && value < config.minvalue) || (config.maxvalue != null && value > config.maxvalue))
					return false;
				return config.minvalue == null ? value > 0 : true;
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

		config.camouflage && !focused && setTimeout(self.camouflage, 1, true);

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

		if (self.type === 'number')
			return true;

		return (self.type === 'phone' || self.type === 'email') && (val != null && (typeof(val) === 'string' && val.length !== 0));
	};
});

COMPONENT('codemirror', 'linenumbers:false;required:false;trim:true;tabs:true', function(self, config) {

	var editor = null;
	var skip = false;

	self.getter = null;
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

		if (config.cmdenter) {
			var submit = function() {
				EXEC(self.makepath(config.cmdenter), editor.getSelection(), editor.getValue());
			};
			options.extraKeys = { 'Ctrl-Enter': submit, 'Cmd-Enter': submit };
		}

		if (config.tabs)
			options.indentWithTabs = true;

		if (config.type === 'markdown' || config.type === 'sql') {
			// options.styleActiveLine = true;
			options.lineWrapping = true;
			options.matchBrackets = true;
		}

		options.autoCloseBrackets = true;

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

	self.resize = function() {
		editor.refresh();
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

COMPONENT('message', 'button:OK', function(self, config, cls) {

	var cls2 = '.' + cls;
	var is, visible = false;

	self.readonly();
	self.singleton();
	self.nocompile && self.nocompile();

	self.make = function() {

		var pls = (config.style === 2 ? (' ' + cls + '2') : '');
		self.aclass(cls + ' hidden' + pls);
		self.event('click', 'button', self.hide);

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

	self.response = function(message, callback, response) {

		var fn;

		if (typeof(message) === 'function') {
			response = callback;
			fn = message;
			message = null;
		} else if (typeof(callback) === 'function')
			fn = callback;
		else {
			response = callback;
			fn = null;
		}

		if (response instanceof Array) {
			var builder = [];
			for (var i = 0; i < response.length; i++) {
				var err = response[i].error;
				err && builder.push(err);
			}
			self.warning(builder.join('<br />'));
			SETTER('!loading/hide');
		} else if (typeof(response) === 'string') {
			self.warning(response);
			SETTER('!loading/hide');
		} else {
			message && self.success(message);
			fn && fn(response);
		}
	};

	self.hide = function() {
		self.callback && self.callback();
		self.aclass('hidden');
		visible = false;
	};

	self.content = function(classname, text, icon) {

		if (icon.indexOf(' ') === -1)
			icon = 'fa fa-' + icon;

		!is && self.html('<div><div class="{0}-icon"><i class="{1}"></i></div><div class="{0}-body"><div class="{0}-text"></div><hr /><button>{2}</button></div></div>'.format(cls, icon, config.button));
		visible = true;
		self.rclass2(cls + '-').aclass(classname);
		self.find(cls2 + '-body').rclass().aclass(cls + '-body');

		if (is)
			self.find(cls2 + '-icon').find('.fa').rclass2('fa').aclass(icon);

		self.find(cls2 + '-text').html(text);
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

FUNC.messageresponse = function(success, callback) {
	return function(response, err) {
		if (err || response instanceof Array) {

			var msg = [];
			var template = '<div class="ui-message-error"><i class="fa fa-warning"></i>{0}</div>';

			if (response instanceof Array) {
				for (var i = 0; i < response.length; i++)
					msg.push(template.format(response[i].error));
				msg = msg.join('');
			} else
				msg = template.format(err.toString());

			SETTER('message', 'warning', msg);
		} else {
			SETTER('message', 'success', success);
			callback && callback(response);
		}
	};
};

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
	var colors = [['E73323', 'EC8632', 'FFFD54', '68B25B', '7CFBFD', '4285F4', 'E73CF7', '73197B', '91683C', 'FFFFFF', '808080', '000000'],['FFFFFF', 'E8E8E8', 'D1D1D1', 'B9B9B9', 'A2A2A2', '8B8B8B', '747474', '5D5D5D', '464646', '2E2E2E', '171717', '000000'],['5C0E07', '5E350F', '66651C', '41641A', '2D6419', '2D6438', '2D6465', '133363', '000662', '2D0962', '5C1262', '5C0F32', '8A1A11', '8E501B', '99982F', '62962B', '47962A', '479654', '479798', '214D94', '010E93', '451393', '8A2094', '8A1C4C', 'B9261A', 'BD6B27', 'CCCB41', '83C83C', '61C83B', '61C871', '62C9CA', '2E67C5', '0216C4', '5C1DC4', 'B92EC5', 'B92865', 'E73323', 'EC8632', 'FFFD54', 'A4FB4E', '7BFA4C', '7BFA8D', '7CFBFD', '3B80F7', '041EF5', '7327F5', 'E73CF7', 'E7357F', 'E8483F', 'EF9D4B', 'FFFE61', 'B4FB5C', '83FA5A', '83FAA2', '83FBFD', '5599F8', '343CF5', '8C42F6', 'E84FF7', 'E84A97', 'EA706B', 'F2B573', 'FFFE7E', 'C5FC7C', '96FA7A', '96FBB9', '96FCFD', '7BB2F9', '666AF6', 'A76EF7', 'EB73F8', 'EA71B0', 'F6CECD', 'FAE6CF', 'FFFED1', 'EBFED1', 'D7FDD0', 'D7FDE7', 'D8FEFE', 'D1E5FD', 'CCCDFB', 'E1CEFB', 'F6CFFC', 'F6CEE4']];

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
			if (common.isinfopanel)
				return;

			var combo = GET('code.data.combo');
			if (!combo)
				return;
			common.isinfopanel = true;
			SETTER('infopanel/show', self.element, function(el) {

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
			}, 90, 45, true, function() {
				common.isinfopanel = false;
			});
		});
	};

	function random() {
		return arguments[(Math.random() * arguments.length) >> 0];
	}

	self.text = function() {
		return random('Brutality', 'Awesome', 'Fantastic', 'Excellent', 'Stupendous', 'OMG', 'Impressive', 'Nice', 'Grand', 'Super', 'Whoah', 'Nice', 'Fatality');
	};

	self.summarize = function() {
		return sum;
	};

	var ratingB = function() {
		rating.animate({ 'margin-top': 25, opacity: 0, 'font-size': 12 }, 500);
	};

	var ratingA = function() {
		var text = self.text();

		switch (text) {
			case 'Brutality':
			case 'Fatality':
			case 'Impressive':
			case 'Excellent':
			case 'Awesome':

				var sound = text.toLowerCase();

				switch (sound) {
					case 'awesome':
						sound = 'finalround';
						break;
					case 'whoah':
						sound = 'fight';
						break;
				}

				if (sum > 20)
					FUNC.totalcombat(sound);

				break;
		}

		rating.html(text + '!');
		rating.stop().css({ 'margin-top': 10, 'font-size': 20, opacity: 1 });
		setTimeout(ratingB, 200);
	};

	var animB = function() {
		count.css('color', '').html('0');
		progress.css('background-color', '');
		rating.css('color', '');
		sum = 0;
	};

	var animA = function() {
		progress.stop().animate({ width: '5%' }, 8000, animB);
	};

	self.combo = function() {

		sum++;

		var color = '';

		setTimeout2('comborating', ratingA, 800, 20);

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
		progress.stop().animate({ width: '100%' }, 100, animA);
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

COMPONENT('windows', 'menuicon:fa fa-navicon;reoffsetresize:0', function(self, config, cls) {

	var cls2 = '.' + cls;
	var cache = {};
	var services = [];
	var events = {};
	var drag = {};
	var prevfocused;
	var serviceid;
	var data = [];
	var lastWW = WW;
	var lastWH = WH;

	self.make = function() {
		self.aclass(cls);
		self.event('click', cls2 + '-control', function() {
			var el = $(this);
			var name = el.attrd('name');
			var item = cache[el.closest(cls2 + '-item').attrd('id')];
			switch (name) {
				case 'close':
					item.setcommand('close');
					break;
				case 'minimize':
					item.setcommand('toggleminimize');
					break;
				case 'maximize':
					item.setcommand('togglemaximize');
					break;
				case 'menu':
					item.meta.menu && item.meta.menu.call(item, el);
					break;
				default:
					item.setcommand(name);
					break;
			}
		});

		self.event('mousedown touchstart', cls2 + '-item', function() {
			if (prevfocused) {
				if (prevfocused[0] == this)
					return;
				prevfocused.rclass(cls + '-focused');
			}
			prevfocused = $(this).aclass(cls + '-focused');
		});

		self.event('mousedown touchstart', cls2 + '-title,' + cls2 + '-resize', events.down);
		$(W).on('resize', self.resize2);
		serviceid = setInterval(events.service, 5000);
	};

	self.finditem = function(id) {
		return cache[id];
	};

	self.send = function(type, body) {
		for (var i = 0; i < data.length; i++)
			data[i].meta.data(type, body, data[i].element);
	};

	self.destroy = function() {
		$(W).off('resize', self.resize2);
		clearInterval(serviceid);
	};

	self.resize2 = function() {
		setTimeout2(self.ID, self.resize, 200);
	};

	self.recompile = function() {
		setTimeout2(self.ID + 'compile', COMPILE, 50);
	};

	self.resizeforce = function() {

		self.element.find(cls2 + '-maximized').each(function() {
			cache[$(this).attrd('id')].setcommand('maximize');
		});

		if (config.reoffsetresize) {
			var diffWW = lastWW - WW;
			var diffWH = lastWH - WH;

			var keys = Object.keys(cache);
			for (var i = 0; i < keys.length; i++) {
				var win = cache[keys[i]];
				win.setoffset(win.x - diffWW, win.y - diffWH);
			}

			lastWW = WW;
			lastWH = WH;
		}
	};

	self.resize = function() {
		setTimeout2(self.ID + 'resize', self.resizeforce, 300);
	};

	events.service = function() {
		for (var i = 0; i < services.length; i++) {
			var tmp = services[i];
			if (tmp.$service)
				tmp.$service++;
			else
				tmp.$service = 1;
			tmp.meta.service && tmp.meta.service.call(tmp, tmp.$service, tmp.element);
		}
	};

	events.down = function(e) {

		var E = e;

		if (e.type === 'touchstart') {
			drag.touch = true;
			e = e.touches[0];
		} else
			drag.touch = false;

		if (e.target.nodeName === 'I')
			return;

		var el = $(this);
		var parent = el.closest(cls2 + '-item');

		if (parent.hclass(cls + '-maximized'))
			return;

		drag.resize = el.hclass(cls + '-resize');
		drag.is = false;

		E.preventDefault();

		var myoffset = self.element.position();
		var pos;

		if (drag.resize) {
			var c = el.attr('class');
			drag.el = el.closest(cls2 + '-item');
			drag.dir = c.match(/-(tl|tr|bl|br)/)[0].substring(1);
			pos = drag.el.position();
			var m = self.element.offset();
			drag.body = drag.el.find(cls2 + '-body');
			drag.plus = m;
			drag.x = pos.left;
			drag.y = pos.top;
			drag.width = drag.el.width();
			drag.height = drag.body.height();
		} else {
			drag.el = el.closest(cls2 + '-item');
			pos = drag.el.position();
			drag.x = e.pageX - pos.left;
			drag.y = e.pageY - pos.top;
		}

		drag.el.aclass(cls + '-block');
		drag.offX = myoffset.left;
		drag.offY = myoffset.top;
		drag.item = cache[drag.el.attrd('id')];

		if (drag.item.meta.actions) {
			if (drag.resize) {
				if (drag.item.meta.actions.resize == false)
					return;
				drag.resize = drag.item.meta.actions.resize;
			} else {
				if (drag.item.meta.actions.move == false)
					return;
			}
		}

		drag.el.aclass(cls + '-dragged');
		$(W).on('mousemove touchmove', events.move).on('mouseup touchend', events.up);
	};

	events.move = function(e) {

		var evt = e;
		if (drag.touch)
			evt = e.touches[0];

		var obj = {};
		drag.is = true;

		if (drag.resize) {

			var x = evt.pageX - drag.offX - drag.plus.left;
			var y = evt.pageY - drag.offY - drag.plus.top;
			var off = drag.item.meta.offset;
			var w;
			var h;

			switch (drag.dir) {

				case 'tl':
					obj.left = x;
					obj.top = y;
					w = drag.width - (x - drag.x);
					h = drag.height - (y - drag.y);

					if ((off.minwidth && w < off.minwidth) || (off.minheight && h < off.minheight) || (off.maxwidth && w > off.maxwidth) || (off.maxheight && h > off.maxheight))
						break;

					if (drag.resize === true || drag.resize === 'width') {
						obj.width = w;
						drag.el.css(obj);
					}

					if (drag.resize === true || drag.resize === 'height') {
						obj.height = h;
						delete obj.width;
						delete obj.top;
						drag.body.css(obj);
					}
					break;

				case 'tr':
					w = x - drag.x;
					h = drag.height - (y - drag.y);

					if ((off.minwidth && w < off.minwidth) || (off.minheight && h < off.minheight) || (off.maxwidth && w > off.maxwidth) || (off.maxheight && h > off.maxheight))
						break;

					if (drag.resize === true || drag.resize === 'width') {
						obj.width = w;
						obj.top = y;
						drag.el.css(obj);
					}

					if (drag.resize === true || drag.resize === 'height') {
						obj.height = h;
						delete obj.width;
						delete obj.top;
						drag.body.css(obj);
					}

					break;

				case 'bl':

					w = drag.width - (x - drag.x);
					h = y - drag.y - 30;

					if ((off.minwidth && w < off.minwidth) || (off.minheight && h < off.minheight) || (off.maxwidth && w > off.maxwidth) || (off.maxheight && h > off.maxheight))
						break;

					if (drag.resize === true || drag.resize === 'width') {
						obj.left = x;
						obj.width = w;
						drag.el.css(obj);
						delete obj.width;
					}

					if (drag.resize === true || drag.resize === 'height') {
						obj.height = h;
						drag.body.css(obj);
					}

					break;

				case 'br':
					w = x - drag.x;
					h = y - drag.y - 30;

					if ((off.minwidth && w < off.minwidth) || (off.minheight && h < off.minheight) || (off.maxwidth && w > off.maxwidth) || (off.maxheight && h > off.maxheight))
						break;

					if (drag.resize === true || drag.resize === 'width') {
						obj.width = w;
						drag.el.css(obj);
						delete obj.width;
					}

					if (drag.resize === true || drag.resize === 'height') {
						obj.height = h;
						drag.body.css(obj);
					}

					break;
			}

			drag.item.ert && clearTimeout(drag.item.ert);
			drag.item.ert = setTimeout(drag.item.emitresize, 100);

		} else {
			obj.left = evt.pageX - drag.x - drag.offX;
			obj.top = evt.pageY - drag.y - drag.offY;

			if (obj.top < 0)
				obj.top = 0;

			drag.el.css(obj);
		}

		if (!drag.touch)
			e.preventDefault();
	};

	events.up = function() {

		drag.el.rclass(cls + '-dragged').rclass(cls + '-block');
		$(W).off('mousemove touchmove', events.move).off('mouseup touchend', events.up);

		if (!drag.is)
			return;

		var item = drag.item;
		var meta = item.meta;
		var pos = drag.el.position();

		drag.is = false;
		drag.x = meta.offset.x = item.x = pos.left;
		drag.y = meta.offset.y = item.y = pos.top;

		if (drag.resize) {
			item.width = meta.offset.width = drag.el.width();
			item.height = meta.offset.height = drag.body.height();
			meta.resize && meta.resize.call(item, item.width, item.height, drag.body, item.x, item.y);
			self.element.SETTER('*', 'resize');
		}

		meta.move && meta.move.call(item, item.x, item.y, drag.body);
		self.wsave(item);
		self.change(true);
	};

	var wsavecallback = function(item) {
		var key = 'win_' + item.meta.cachekey;
		var obj = {};
		obj.x = item.x;
		obj.y = item.y;
		obj.width = item.width;
		obj.height = item.height;
		obj.ww = WW;
		obj.wh = WH;
		obj.hidden = item.meta.hidden;
		PREF.set(key, obj, '1 month');
	};

	self.wsave = function(obj) {
		if (obj.meta.actions && obj.meta.actions.autosave)
			setTimeout2(self.ID + '_win_' + obj.meta.cachekey, wsavecallback, 500, null, obj);
	};

	self.wadd = function(item) {

		var hidden = '';
		var ishidden = false;

		if (!item.cachekey)
			item.cachekey = item.id;

		if (item.cachekey)
			item.cachekey += '' + item.offset.width + 'x' + item.offset.height;

		if (item.actions && item.actions.autosave) {
			pos = PREF['win_' + item.cachekey];
			if (pos) {

				var mx = 0;
				var my = 0;

				var keys = Object.keys(cache);
				var plus = 0;

				for (var i = 0; i < keys.length; i++) {
					if (cache[keys[i]].meta.cachekey === item.cachekey)
						plus += 50;
				}

				if (config.reoffsetresize && pos.ww != null && pos.wh != null) {
					mx = pos.ww - WW;
					my = pos.wh - WH;
				}

				item.offset.x = (pos.x - mx) + plus;
				item.offset.y = (pos.y - my) + plus;
				item.offset.width = pos.width;
				item.offset.height = pos.height;

				if (pos.hidden && (item.hidden == null || item.hidden)) {
					ishidden = true;
					item.hidden = true;
				}
			}
		}

		if (!ishidden)
			ishidden = item.hidden;

		hidden = ishidden ? ' hidden' : '';

		var el = $('<div class="{0}-item{2}" data-id="{id}" style="left:{x}px;top:{y}px;width:{width}px"><span class="{0}-resize {0}-resize-tl"></span><span class="{0}-resize {0}-resize-tr"></span><span class="{0}-resize {0}-resize-bl"></span><span class="{0}-resize {0}-resize-br"></span><div class="{0}-title"><i class="fa fa-times {0}-control" data-name="close"></i><i class="far fa-window-maximize {0}-control" data-name="maximize"></i><i class="far fa-window-minimize {0}-control" data-name="minimize"></i><i class="{1} {0}-control {0}-lastbutton" data-name="menu"></i><span>{{ title }}</span></div><div class="{0}-body" style="height:{height}px"></div></div>'.format(cls, config.menuicon, hidden).arg(item.offset).arg(item));
		var body = el.find(cls2 + '-body');
		var pos;

		body.append(item.html);

		if (typeof(item.html) === 'string' && item.html.COMPILABLE())
			self.recompile();

		if (item.actions) {
			if (item.actions.resize == false)
				el.aclass(cls + '-noresize');
			if (item.actions.move == false)
				el.aclass(cls + '-nomove');

			var noclose = item.actions.close == false;
			if (item.actions.hide)
				noclose = false;

			if (noclose)
				el.aclass(cls + '-noclose');
			if (item.actions.maximize == false)
				el.aclass(cls + '-nomaximize');
			if (item.actions.minimize == false)
				el.aclass(cls + '-nominimize');
			if (!item.actions.menu)
				el.aclass(cls + '-nomenu');
		}

		var obj = cache[item.id] = {};
		obj.main = self;
		obj.meta = item;
		obj.element = body;
		obj.container = el;
		obj.x = item.offset.x;
		obj.y = item.offset.y;
		obj.width = item.offset.width;
		obj.height = item.offset.height;

		if (item.buttons) {
			var builder = [];
			for (var i = 0; i < item.buttons.length; i++) {
				var btn = item.buttons[i];
				var icon = btn.icon.indexOf(' ') === -1 ? ('fa fa-' + btn.icon) : btn.icon;
				builder.push('<i class="fa fa-{1} {0}-control" data-name="{2}"></i>'.format(cls, icon, btn.name));
			}
			builder.length && el.find(cls2 + '-lastbutton').before(builder.join(''));
		}

		item.make && item.make.call(cache[item.id], body);

		obj.emitresize = function() {
			obj.ert = null;
			obj.element.SETTER('*', 'resize');
		};

		obj.setsize = function(w, h) {
			var t = this;
			var obj = {};

			if (w) {
				obj.width = t.width = t.meta.offset.width = w;
				t.element.parent().css('width', w);
			}

			if (h) {
				t.element.css('height', h);
				t.height = t.meta.offset.height = h;
			}

			t.ert && clearTimeout(t.ert);
			t.ert = setTimeout(t.emitresize, 100);
			self.wsave(t);
		};

		obj.setcommand = function(type) {

			var el = obj.element.parent();
			var c;

			switch (type) {

				case 'toggle':
					obj.setcommand(obj.meta.hidden ? 'show' : 'hide');
					break;

				case 'show':
					if (obj.meta.hidden) {
						obj.meta.hidden = false;
						obj.element.parent().rclass('hidden');
						self.wsave(obj);
						self.resize2();
					}
					break;

				case 'close':
				case 'hide':

					if (type === 'hide' && obj.meta.hidden)
						return;

					if (obj.meta.close) {
						obj.meta.close(function() {
							self.wrem(obj.meta);
							self.resize2();
						});
					} else {
						self.wrem(obj.meta);
						self.resize2();
					}
					break;

				case 'maximize':
					c = cls + '-maximized';

					if (!el.hclass(c)) {
						obj.prevwidth = obj.width;
						obj.prevheight = obj.height;
						obj.prevx = obj.x;
						obj.prevy = obj.y;
						el.aclass(c);
						obj.setcommand('resetminimize');
					}

					var ww = self.element.width() || WW;
					var wh = self.element.height() || WH;
					obj.setoffset(0, 0);
					obj.setsize(ww, wh - obj.element.position().top);
					break;

				case 'resetmaximize':
					c = cls + '-maximized';
					if (el.hclass(c)) {
						obj.setoffset(obj.prevx, obj.prevy);
						obj.setsize(obj.prevwidth, obj.prevheight);
						el.rclass(c);
					}
					break;

				case 'togglemaximize':
					c = cls + '-maximized';
					obj.setcommand(el.hclass(c) ? 'resetmaximize' : 'maximize');
					break;

				case 'minimize':
					c = cls + '-minimized';
					if (!el.hclass(c))
						el.aclass(c);
					break;

				case 'resetminimize':
					c = cls + '-minimized';
					el.hclass(c) && el.rclass(c);
					break;

				case 'toggleminimize':
					c = cls + '-minimized';
					obj.setcommand(el.hclass(c) ? 'resetminimize' : 'minimize');
					break;

				case 'resize':
					obj.setsize(obj.width, obj.height);
					break;

				case 'move':
					obj.setoffset(obj.x, obj.y);
					break;

				case 'focus':
					obj.setcommand('resetminimize');
					prevfocused && prevfocused.rclass(cls + '-focused');
					prevfocused = obj.element.parent().aclass(cls + '-focused');
					break;
				default:
					if (obj.meta.buttons) {
						var btn = obj.meta.buttons.findItem('name', type);
						if (btn && btn.exec)
							btn.exec.call(obj, obj);
					}
					break;
			}
		};

		obj.setoffset = function(x, y) {
			var t = this;
			var obj = {};

			if (x != null)
				obj.left = t.x = t.meta.offset.x = x;

			if (y != null)
				obj.top = t.y = t.meta.offset.y = y;

			t.element.parent().css(obj);
			self.wsave(t);
		};

		obj.meta.service && services.push(obj);
		obj.meta.data && data.push(obj);

		self.append(el);

		setTimeout(function(obj) {
			obj.setcommand('focus');
		}, 100, obj);
		return obj;
	};

	self.wrem = function(item) {
		var obj = cache[item.id];
		if (obj) {
			var main = obj.element.closest(cls2 + '-item');

			if (obj.meta.actions.hide) {
				obj.meta.hidden = true;
				main.aclass('hidden');
				self.wsave(obj);
			} else {
				obj.meta.destroy && obj.meta.destroy.call(obj);
				main.off('*');
				main.find('*').off('*');
				main.remove();
				delete cache[item.id];

				var index = services.indexOf(obj);
				if (index !== -1)
					services.splice(index, 1);

				index = data.indexOf(obj);
				if (index !== -1)
					data.splice(index, 1);

				var arr = self.get();
				arr.splice(arr.findIndex('id', item.id), 1);
				self.update();
			}
		}
	};

	self.setter = function(value) {

		if (!value)
			value = EMPTYARRAY;

		var updated = {};

		for (var i = 0; i < value.length; i++) {
			var item = value[i];
			if (!cache[item.id])
				cache[item.id] = self.wadd(item);
			updated[item.id] = 1;
		}

		// Remove older windows
		var keys = Object.keys(cache);
		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			if (!updated[key])
				self.wrem(cache[key].meta);
		}
	};

	self.toggle = function(id) {
		var item = cache[id];
		item && item.setcommand('toggle');
	};

	self.show = function(id) {
		var item = cache[id];
		item && item.setcommand('show');
	};

	self.focus = function(id) {
		var item = cache[id];
		item && item.setcommand('focus');
	};

	self.hide = function(id) {
		var item = cache[id];
		item && item.setcommand('hide');
	};

});

COMPONENT('dockable', 'menuicon:fa fa-navicon;style:2;parent:window;margin:0;reoffsetresize:0', function(self, config, cls) {

	var cls2 = '.' + cls;
	var cache = {};
	var services = [];
	var events = {};
	var drag = {};
	var prevfocused;
	var serviceid;
	var data = [];
	var docked = {};
	var layout;
	var ruler;
	var container;
	var init = false;
	var lastWW = WW;
	var lastWH = WH;

	self.make = function() {
		self.aclass(cls + (config.style === 2 ? (' ' + cls + '-style2') : ''));
		var el = self.element;
		el.wrapInner('<div class="{0}-layout" />'.format(cls));
		el.append('<div class="{0}-panels"><div class="{0}-ruler hidden"></div></div>'.format(cls));
		layout = self.find(cls2 + '-layout');
		ruler = self.find(cls2 + '-ruler');
		container = self.find(cls2 + '-panels');
		self.event('click', cls2 + '-control', function() {
			var el = $(this);
			var name = el.attrd('name');
			var item = cache[el.closest(cls2 + '-item').attrd('id')];
			switch (name) {
				case 'close':
					item.setcommand('close');
					break;
				case 'menu':
					item.meta.menu && item.meta.menu.call(item, el);
					break;
				default:
					item.setcommand(name);
					break;
			}
		});

		self.event('mousedown touchstart', cls2 + '-item', function() {
			if (prevfocused) {
				if (prevfocused[0] == this)
					return;
				prevfocused.rclass(cls + '-focused');
			}
			prevfocused = $(this).aclass(cls + '-focused');
		});

		self.event('mousedown touchstart', cls2 + '-title,' + cls2 + '-resize', events.down);
		$(W).on('resize', self.resize2);
		serviceid = setInterval(events.service, 5000);
		self.resizelayout();
	};

	self.finditem = function(id) {
		return cache[id];
	};

	self.send = function(type, body) {
		for (var i = 0; i < data.length; i++)
			data[i].meta.data(type, body, data[i].element);
	};

	self.destroy = function() {
		$(W).off('resize', self.resize2);
		clearInterval(serviceid);
	};

	self.resize = function() {

		clearTimeout2(self.ID + 'compile');
		self.resizelayout();

		var keys = Object.keys(cache);
		docked = {};

		for (var i = 0; i < keys.length; i++) {
			var item = cache[keys[i]];

			if (item.meta.hidden)
				continue;

			if (item.meta.offset.docked) {
				item.titleheight = item.container.find(cls2 + '-title').height() || 0;
				docked[item.meta.offset.docked] = item;
			} else if (config.reoffsetresize) {
				var diffWW = lastWW - WW;
				var diffWH = lastWH - WH;
				item.setoffset(item.x - diffWW, item.y - diffWH);
			}
		}

		lastWW = WW;
		lastWH = WH;

		var ww = self.element.width();
		var wh = self.element.height();

		var h;
		var w;
		var x;

		if (docked.bottom) {
			h = docked.bottom.container.offset().top;

			if (config.style === 1) {
				docked.left && docked.left.setsize(null, h - docked.left.titleheight - 1);
				if (docked.right) {
					docked.right.setsize(null, h - docked.right.titleheight - 1);
					docked.right.setoffset(ww - docked.right.width);
				}
			} else {

				w = self.element.width();
				x = docked.left ? docked.left.width : 0;

				if (docked.right) {
					docked.right.setoffset(ww - docked.right.width);
					docked.right.setsize(null, wh - docked.right.titleheight);
					w = w - docked.right.width;
				}

				docked.left && docked.left.setsize(null, wh - docked.left.titleheight);
				docked.bottom.setoffset(x, wh - docked.bottom.height - docked.bottom.titleheight);
				docked.bottom.setsize(w - x, null);
			}

		} else {

			w = self.element.width();
			x = docked.left ? docked.left.width : 0;

			if (docked.right) {
				docked.right.setoffset(ww - docked.right.width);
				docked.right.setsize(null, wh - docked.right.titleheight);
				w = w - docked.right.width;
			}

			docked.left && docked.left.setsize(null, wh - docked.left.titleheight);
		}

		self.resizelayout();
		self.element.SETTER('*', 'resize');
	};

	self.resizelayout = function() {

		var parent = self.parent(config.parent);
		var css = {};
		css.width = parent.width();
		css.height = parent.height() - config.margin;

		self.css(css);

		css['margin-left'] = 0;
		var keys = Object.keys(cache);
		for (var i = 0; i < keys.length; i++) {
			var item = cache[keys[i]];

			if (item.meta.hidden)
				continue;

			var meta = item.meta;
			var offset = meta.offset;
			switch (offset.docked) {
				case 'left':
					css['margin-left'] += offset.width;
					css.width -= offset.width;
					break;
				case 'right':
					css.width -= offset.width;
					break;
				case 'bottom':
					css.height -= offset.height + item.titleheight;
					break;
			}
		}
		layout.css(css);
	};

	self.resize2 = function() {
		setTimeout2(self.ID, self.resize, 300);
	};

	self.recompile = function() {
		setTimeout2(self.ID + 'compile', COMPILE, 50);
	};

	events.service = function() {
		for (var i = 0; i < services.length; i++) {
			var tmp = services[i];
			if (tmp.$service)
				tmp.$service++;
			else
				tmp.$service = 1;
			tmp.meta.service && tmp.meta.service.call(tmp, tmp.$service, tmp.element);
		}
	};

	events.down = function(e) {

		if (e.type === 'touchstart') {
			drag.touch = true;
			e = e.touches[0];
		} else
			drag.touch = false;

		if (e.target.nodeName === 'I')
			return;

		var el = $(this);
		drag.resize = el.hclass(cls + '-resize');
		drag.is = false;

		e.preventDefault();

		var myoffset = self.element.position();
		var pos;

		if (drag.resize) {
			var c = el.attr('class');
			drag.el = el.closest(cls2 + '-item');
			drag.dir = c.match(/-(tl|tr|bl|br)/)[0].substring(1);
			pos = drag.el.position();
			var m = self.element.offset();
			drag.body = drag.el.find(cls2 + '-body');
			drag.plus = m;
			drag.x = pos.left;
			drag.y = pos.top;
			drag.width = drag.el.width();
			drag.height = drag.body.height();

			var css = {};

			if (drag.el.hclass(cls + '-docked')) {
				switch (drag.dir) {
					case 'tr':
						css.width = 1;
						css.height = drag.el.height();
						css.left = pos.left + drag.width;
						css.top = pos.top;
						ruler.css(css).rclass('hidden');
						break;
					case 'tl':

						var item = cache[drag.el.attrd('id')];
						var d = item.meta.offset.docked;
						if (d === 'bottom') {
							css.width = drag.width;
							css.height = 1;
						} else {
							css.width = 1;
							css.height = drag.el.height();
						}

						css.top = pos.top;
						css.left = pos.left;
						ruler.css(css).rclass('hidden');
						break;
				}
			}

		} else {
			drag.el = el.closest(cls2 + '-item');
			pos = drag.el.position();
			drag.x = e.pageX - pos.left;
			drag.y = e.pageY - pos.top;
		}

		drag.el.aclass(cls + '-block');
		drag.offX = myoffset.left;
		drag.offY = myoffset.top;
		drag.item = cache[drag.el.attrd('id')];
		drag.isdocked = drag.el.hclass(cls + '-docked');
		drag.dockl = false;
		drag.dockr = false;
		drag.dockb = false;
		drag.ww = self.element.width();
		drag.wh = self.element.height();

		if (drag.item.meta.actions) {
			if (drag.resize) {
				if (drag.item.meta.actions.resize == false)
					return;
			} else {

				if (drag.item.meta.actions.move == false)
					return;
			}
		}

		drag.el.aclass(cls + '-dragged');
		$(W).on('mousemove touchmove', events.move).on('mouseup touchend', events.up);
	};

	events.move = function(e) {

		var evt = e;
		if (drag.touch)
			evt = e.touches[0];

		var obj = {};
		var off = drag.item.meta.offset;
		var d = off.docked;
		var minwidth = (d ? off.dockminwidth : off.minwidth) || 30;
		var maxwidth = d ? off.dockmaxwidth : off.maxwidth;
		var minheight = (d ? off.dockminheight : off.minheight) || 30;
		var maxheight = d ? off.dockmaxheight : off.maxheight;

		drag.is = true;

		if (drag.resize) {

			var x = evt.pageX - drag.plus.left;
			var y = evt.pageY - drag.plus.top;
			var actions = drag.item.meta.actions;
			var resizeX = actions ? actions.resizeX != false : true;
			var resizeY = actions ? actions.resizeY != false : true;
			var w;
			var h;
			var stopw, stoph;

			switch (drag.dir) {

				case 'tl':

					w = drag.width - (x - drag.x);
					h = drag.height - (y - drag.y);

					if (resizeY && (!d || d === 'bottom'))
						obj.top = y;

					if (resizeX && (!d || d !== 'bottom'))
						obj.left = x;

					stopw = (minwidth && w < minwidth) || (maxwidth && w > maxwidth);
					stoph = (minheight && h < minheight) || (maxheight && h > maxheight);

					if (d) {

						if (resizeX && (!d || d !== 'bottom') && !stopw) {
							obj.left = drag.ww - w;
							ruler.css(obj).attrd('cache', w);
						}

						if (resizeY && (!d || d === 'bottom') && !stoph) {
							obj.top = drag.wh - h - drag.item.titleheight;
							ruler.css(obj).attrd('cache', h);
						}

					} else {

						if (resizeX && (!d || d !== 'bottom') && !stopw) {
							drag.el.css(obj);
							obj.width = w;
						}

						if (resizeY && (!d || d === 'bottom') && !stoph) {
							obj.top = y;
							obj.height = h;
						}

						delete obj.width;
						delete obj.top;

						if (!stopw || !stoph)
							drag.body.css(obj);
					}
					break;

				case 'tr':

					w = x - drag.x;
					h = drag.height - (y - drag.y);

					stopw = (minwidth && w < minwidth) || (maxwidth && w > maxwidth);
					stoph = (minheight && h < minheight) || (maxheight && h > maxheight);

					if (d) {

						if (resizeX && !stopw)
							obj.left = w;

						if (resizeY && !d && !stoph)
							obj.top = y;

						if (!stopw)
							ruler.css(obj).attrd('cache', w);

					} else {

						if (resizeX && !stopw)
							obj.width = w;

						if (resizeY && !d && !stoph)
							obj.top = y;

						if (!stopw || !stoph)
							drag.el.css(obj);

						if (resizeY && !d && !stoph)
							obj.height = h;

						delete obj.width;
						delete obj.top;

						if (!stopw || !stoph)
							drag.body.css(obj);
					}

					break;

				case 'bl':

					w = drag.width - (x - drag.x);
					h = y - drag.y - 30;

					stopw = (minwidth && w < minwidth) || (maxwidth && w > maxwidth);
					stoph = (minheight && h < minheight) || (maxheight && h > maxheight);

					if (resizeX && !stopw) {
						obj.left = x;
						obj.width = w;
						drag.el.css(obj);
					}

					if (resizeY && !stoph) {
						delete obj.width;
						obj.height = h;
						drag.body.css(obj);
					}

					break;

				case 'br':

					w = x - drag.x;
					h = y - drag.y - 30;

					stopw = (minwidth && w < minwidth) || (maxwidth && w > maxwidth);
					stoph = (minheight && h < minheight) || (maxheight && h > maxheight);

					if (resizeX && !stopw) {
						obj.width = w;
						drag.el.css(obj);
					}

					if (resizeY && !stoph) {
						delete obj.width;
						obj.height = h;
						drag.body.css(obj);
					}

					break;
			}

			if (!d) {
				drag.item.ert && clearTimeout(drag.item.ert);
				drag.item.ert = setTimeout(drag.item.emitresize, 100);
			}

		} else {

			obj.left = evt.pageX - drag.x;
			obj.top = evt.pageY - drag.y;
			drag.el.css(obj);

			if (drag.isdocked) {

				var old = drag.item.meta.offset.docked;
				drag.isdocked = false;
				drag.item.setdock(null);
				drag.item.setsize(old === 'bottom' ? (drag.item.width / 2) >> 0 : drag.item.width, old !== 'bottom' ? (drag.item.height / 2) >> 0 : drag.item.height);

			} else {

				var is = false;
				var margin = 0;
				var css;

				if (drag.item.dockable.left && !docked.left) {

					is = obj.left < 30;
					if (is !== drag.dockl) {

						if (docked.bottom && is && config.style === 1)
							margin = drag.wh - docked.bottom.container.offset().top;

						drag.dockl = is;
						css = {};
						css.width = 1;
						css.height = drag.wh - margin;
						css.left = minwidth || maxwidth || drag.item.width;
						css.top = 0;
						ruler.css(css).tclass('hidden', !is);
					}
				}

				if (drag.item.dockable.right && !docked.right) {

					is = obj.left > drag.ww - drag.item.width + 50;
					if (is !== drag.dockr) {

						if (docked.bottom && is && config.style === 1)
							margin = drag.wh - docked.bottom.container.offset().top;

						drag.dockr = is;
						css = {};
						css.width = 1;
						css.height = drag.wh - margin;
						css.left = drag.ww - (minwidth || maxwidth || drag.item.width);
						css.top = 0;
						ruler.css(css).tclass('hidden', !is);
					}
				}

				if (drag.item.dockable.bottom && !docked.bottom) {

					is = obj.top > (drag.item.y + (drag.item.height / 2) + 50);

					if (is !== drag.dockb) {
						drag.dockb = is;
						css = {};

						css.height = 1;
						css.top = drag.wh - (minheight || maxheight || drag.item.height);

						if (config.style === 1) {
							css.left = 0;
							css.width = drag.ww;
						} else {
							css.left = (docked.left ? docked.left.width : 0);
							css.width = (docked.right ? docked.right.x : drag.ww) - css.left;
						}

						ruler.css(css).tclass('hidden', !is);
					}
				}
			}
		}

		if (!drag.touch)
			e.preventDefault();
	};

	events.up = function() {

		drag.el.rclass(cls + '-dragged').rclass(cls + '-block');
		$(W).off('mousemove touchmove', events.move).off('mouseup touchend', events.up);

		if (!drag.is) {
			ruler.aclass('hidden');
			return;
		}

		var item = drag.item;
		var meta = item.meta;
		var pos;
		var w;
		var h;

		if (meta.offset.docked) {
			pos = ruler.offset();

			if (meta.offset.docked !== 'bottom')
				w = +ruler.attrd('cache') + 1;
			else if (meta.offset.docked === 'bottom')
				h = +ruler.attrd('cache') + 1;

			if (meta.offset.docked === 'right')
				pos.left = drag.ww - w;

		} else {
			pos = drag.el.position();
			w = drag.el.width();
			h = drag.el.height() - drag.item.titleheight;
		}

		ruler.aclass('hidden');
		drag.is = false;
		drag.x = meta.offset.x = item.x = pos.left;
		drag.y = meta.offset.y = item.y = pos.top;

		if (drag.resize) {
			drag.item.setsize(w, h);
			meta.resize && meta.resize.call(item, item.width, item.height, drag.body, item.x, item.y);
		} else {
			drag.dockl && item.setdock('left', true);
			drag.dockr && item.setdock('right', true);
			drag.dockb && item.setdock('bottom', true);
		}

		meta.move && meta.move.call(item, item.x, item.y, drag.body);
		drag.resize && self.resize();
		self.wsave(item);
		self.change(true);
	};

	var wsavecallback = function(item) {
		var key = 'dock_' + item.meta.id;
		var obj = {};
		obj.x = item.x;
		obj.y = item.y;
		obj.width = item.width;
		obj.height = item.height;
		obj.docked = item.meta.offset.docked;
		obj.ww = WW;
		obj.wh = WH;
		obj.hidden = item.meta.hidden;
		PREF.set(key, obj, '1 month');
	};

	self.wsave = function(obj) {
		if (obj.meta.actions && obj.meta.actions.autosave && init)
			setTimeout2(self.ID + '_dock_' + obj.meta.id, wsavecallback, 500, null, obj);
	};

	self.wadd = function(item) {

		var hidden = '';
		var ishidden = false;

		if (item.actions && item.actions.autosave) {
			pos = PREF['dock_' + item.id];
			if (pos) {

				var mx = 0;
				var my = 0;

				if (config.reoffsetresize && pos.ww != null && pos.wh != null) {
					mx = pos.ww - WW;
					my = pos.wh - WH;
				}

				item.offset.x = pos.x - mx;
				item.offset.y = pos.y - my;
				item.offset.width = pos.width;
				item.offset.height = pos.height;
				item.offset.docked = pos.docked;

				if (pos.hidden) {
					ishidden = true;
					item.hidden = true;
				}
			}
		}

		if (!ishidden)
			ishidden = item.hidden;

		hidden = ishidden ? ' hidden' : '';

		var el = $('<div class="{0}-item{2}" data-id="{id}" style="left:{x}px;top:{y}px;width:{width}px"><span class="{0}-resize {0}-resize-tl"></span><span class="{0}-resize {0}-resize-tr"></span><span class="{0}-resize {0}-resize-bl"></span><span class="{0}-resize {0}-resize-br"></span><div class="{0}-title"><i class="fa fa-times {0}-control" data-name="close"></i><span>{{ title }}</span></div><div class="{0}-body" style="height:{height}px"></div></div>'.format(cls, config.menuicon, hidden).arg(item.offset).arg(item));
		var body = el.find(cls2 + '-body');
		var pos;

		body.append(item.html);

		if (typeof(item.html) === 'string' && item.html.COMPILABLE())
			self.recompile();

		if (item.actions) {
			if (item.actions.resize == false)
				el.aclass(cls + '-noresize');
			if (item.actions.move == false)
				el.aclass(cls + '-nomove');

			var noclose = item.actions.close == false;
			if (item.actions.hide)
				noclose = false;

			if (noclose)
				el.aclass(cls + '-noclose');
			if (item.actions.maximize == false)
				el.aclass(cls + '-nomaximize');
			if (item.actions.minimize == false)
				el.aclass(cls + '-nominimize');
			if (!item.actions.menu)
				el.aclass(cls + '-nomenu');
		}

		var obj = cache[item.id] = {};
		obj.main = self;
		obj.meta = item;
		obj.element = body;
		obj.container = el;
		obj.x = item.offset.x;
		obj.y = item.offset.y;
		obj.width = item.offset.width;
		obj.height = item.offset.height;
		obj.dockable = {};

		if (item.actions && item.actions.dockable) {
			var dockable = item.actions.dockable;
			if (typeof(dockable) === 'string')
				dockable = dockable.split(/\s|,|;/).trim();
			for (var i = 0; i < dockable.length; i++)
				obj.dockable[dockable[i]] = 1;
		} else {
			obj.dockable.left = 1;
			obj.dockable.right = 1;
			obj.dockable.bottom = 1;
		}

		if (item.buttons) {
			var builder = [];
			for (var i = 0; i < item.buttons.length; i++) {
				var btn = item.buttons[i];
				var icon = btn.icon.indexOf(' ') === -1 ? ('fa fa-' + btn.icon) : btn.icon;
				builder.push('<i class="fa fa-{1} {0}-control" data-name="{2}"></i>'.format(cls, icon, btn.name));
			}
			builder.length && el.find(cls2 + '-lastbutton').before(builder.join(''));
		}

		item.make && item.make.call(cache[item.id], body);

		obj.emitresize = function() {
			obj.ert = null;
			obj.element.SETTER('*', 'resize');
		};

		obj.setsize = function(w, h) {
			var t = this;
			var obj = {};

			if (w) {
				obj.width = t.width = t.meta.offset.width = w;
				t.element.parent().css('width', w);
			}

			if (h) {
				t.element.css('height', h);
				t.height = t.meta.offset.height = h;
			}

			if (!init) {
				t.ert && clearTimeout(t.ert);
				t.ert = setTimeout(t.emitresize, 100);
			}

			self.wsave(t);
		};

		obj.setdock = function(offset, force, init) {

			var t = this;

			if (!force && t.meta.docked === offset)
				return;

			var w = self.element.width();
			var h = self.element.height();
			var meta = t.meta;
			switch (offset) {
				case 'left':
					meta.offset.y = 0;
					meta.offset.x = 0;
					meta.offset.height = h;
					break;
				case 'right':
					meta.offset.y = 0;
					meta.offset.x = w - meta.offset.width;
					meta.offset.height = h;
					break;
				case 'bottom':
					meta.offset.width = w;
					meta.offset.x = 0;
					meta.offset.y = h - meta.offset.height;
					break;
			}

			t.meta.offset.docked = offset || null;

			var el = t.element.parent();

			if (offset)
				el.aclass(cls + '-docked ' + cls + '-docked-' + offset);
			else
				el.rclass2(cls + '-docked');

			t.setoffset(meta.offset.x, meta.offset.y);
			t.setsize(meta.offset.width, meta.offset.height, init);

			if (init)
				return;

			if (force)
				self.resize();
			else
				self.resize2();
		};

		obj.setcommand = function(type) {

			switch (type) {

				case 'toggle':
					obj.setcommand(obj.meta.hidden ? 'show' : 'hide');
					break;

				case 'show':
					if (obj.meta.hidden) {
						obj.meta.hidden = false;
						obj.element.parent().rclass('hidden');
						self.wsave(obj);
						self.resize2();
					}
					break;

				case 'close':
				case 'hide':

					if (type === 'hide' && obj.meta.hidden)
						return;

					if (obj.meta.close) {
						obj.meta.close(function() {
							self.wrem(obj.meta);
							self.resize2();
						});
					} else {
						self.wrem(obj.meta);
						self.resize2();
					}
					break;

				case 'resize':
					obj.setsize(obj.width, obj.height);
					break;

				case 'move':
					obj.setoffset(obj.x, obj.y);
					break;

				case 'focus':
					obj.setcommand('resetminimize');
					prevfocused && prevfocused.rclass(cls + '-focused');
					prevfocused = obj.element.parent().aclass(cls + '-focused');
					break;
				default:
					if (obj.meta.buttons) {
						var btn = obj.meta.buttons.findItem('name', type);
						if (btn && btn.exec)
							btn.exec.call(obj, obj);
					}
					break;
			}
		};

		obj.setoffset = function(x, y) {
			var t = this;
			var obj = {};

			if (x != null)
				obj.left = t.x = t.meta.offset.x = x;

			if (y != null)
				obj.top = t.y = t.meta.offset.y = y;

			t.container.css(obj);
			self.wsave(t);
		};

		item.offset.docked && obj.setdock(item.offset.docked, null, true);
		obj.meta.service && services.push(obj);
		obj.meta.data && data.push(obj);

		container.append(el);
		return obj;
	};

	self.wrem = function(item) {
		var obj = cache[item.id];
		if (obj) {

			var main = obj.element.closest(cls2 + '-item');
			if (obj.meta.actions.hide) {
				obj.meta.hidden = true;
				main.aclass('hidden');
				self.wsave(obj);
			} else {
				obj.meta.destroy && obj.meta.destroy.call(obj);
				main.off('*');
				main.find('*').off('*');
				main.remove();
				delete cache[item.id];

				var index = services.indexOf(obj);
				if (index !== -1)
					services.splice(index, 1);

				index = data.indexOf(obj);
				if (index !== -1)
					data.splice(index, 1);

			}
		}
	};

	self.setter = function(value) {

		if (!value)
			value = EMPTYARRAY;

		init = false;
		var updated = {};

		for (var i = 0; i < value.length; i++) {
			var item = value[i];
			if (!cache[item.id])
				cache[item.id] = self.wadd(item);
			updated[item.id] = 1;
		}

		// Remove older dockable
		var keys = Object.keys(cache);
		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			if (!updated[key])
				self.wrem(cache[key].meta);
		}

		self.resize();
		init = true;
	};

	self.toggle = function(id) {
		var item = cache[id];
		item && item.setcommand('toggle');
	};

	self.show = function(id) {
		var item = cache[id];
		item && item.setcommand('show');
	};

	self.hide = function(id) {
		var item = cache[id];
		item && item.setcommand('hide');
	};

});

COMPONENT('faicons', 'search:Search', function(self, config, cls) {

	var icons = 'ad,address-book,address-card,adjust,air-freshener,align-center,align-justify,align-left,align-right,allergies,ambulance,american-sign-language-interpreting,anchor,angle-double-down,angle-double-left,angle-double-right,angle-double-up,angle-down,angle-left,angle-right,angle-up,angry,ankh,apple-alt,archive,archway,arrow-alt-circle-down,arrow-alt-circle-left,arrow-alt-circle-right,arrow-alt-circle-up,arrow-circle-down,arrow-circle-left,arrow-circle-right,arrow-circle-up,arrow-down,arrow-left,arrow-right,arrow-up,arrows-alt,arrows-alt-h,arrows-alt-v,assistive-listening-systems,asterisk,at,atlas,atom,audio-description,award,baby,baby-carriage,backspace,backward,bacon,bahai,balance-scale,balance-scale-left,balance-scale-right,ban,band-aid,barcode,bars,baseball-ball,basketball-ball,bath,battery-empty,battery-full,battery-half,battery-quarter,battery-three-quarters,bed,beer,bell,bell-slash,bezier-curve,bible,bicycle,biking,binoculars,biohazard,birthday-cake,blender,blender-phone,blind,blog,bold,bolt,bomb,bone,bong,book,book-dead,book-medical,book-open,book-reader,bookmark,border-all,border-none,border-style,bowling-ball,box,box-open,boxes,braille,brain,bread-slice,briefcase,briefcase-medical,broadcast-tower,broom,brush,bug,building,bullhorn,bullseye,burn,bus,bus-alt,business-time,calculator,calendar,calendar-alt,calendar-check,calendar-day,calendar-minus,calendar-plus,calendar-times,calendar-week,camera,camera-retro,campground,candy-cane,cannabis,capsules,car,car-alt,car-battery,car-crash,car-side,caravan,caret-down,caret-left,caret-right,caret-square-down,caret-square-left,caret-square-right,caret-square-up,caret-up,carrot,cart-arrow-down,cart-plus,cash-register,cat,certificate,chair,chalkboard,chalkboard-teacher,charging-station,chart-area,chart-bar,chart-line,chart-pie,check,check-circle,check-double,check-square,cheese,chess,chess-bishop,chess-board,chess-king,chess-knight,chess-pawn,chess-queen,chess-rook,chevron-circle-down,chevron-circle-left,chevron-circle-right,chevron-circle-up,chevron-down,chevron-left,chevron-right,chevron-up,child,church,circle,circle-notch,city,clinic-medical,clipboard,clipboard-check,clipboard-list,clock,clone,closed-captioning,cloud,cloud-download-alt,cloud-meatball,cloud-moon,cloud-moon-rain,cloud-rain,cloud-showers-heavy,cloud-sun,cloud-sun-rain,cloud-upload-alt,cocktail,code,code-branch,coffee,cog,cogs,coins,columns,comment,comment-alt,comment-dollar,comment-dots,comment-medical,comment-slash,comments,comments-dollar,compact-disc,compass,compress,compress-alt,compress-arrows-alt,concierge-bell,cookie,cookie-bite,copy,copyright,couch,credit-card,crop,crop-alt,cross,crosshairs,crow,crown,crutch,cube,cubes,cut,database,deaf,democrat,desktop,dharmachakra,diagnoses,dice,dice-d20,dice-d6,dice-five,dice-four,dice-one,dice-six,dice-three,dice-two,digital-tachograph,directions,divide,dizzy,dna,dog,dollar-sign,dolly,dolly-flatbed,donate,door-closed,door-open,dot-circle,dove,download,drafting-compass,dragon,draw-polygon,drum,drum-steelpan,drumstick-bite,dumbbell,dumpster,dumpster-fire,dungeon,edit,egg,eject,ellipsis-h,ellipsis-v,envelope,envelope-open,envelope-open-text,envelope-square,equals,eraser,ethernet,euro-sign,exchange-alt,exclamation,exclamation-circle,exclamation-triangle,expand,expand-alt,expand-arrows-alt,external-link-alt,external-link-square-alt,eye,eye-dropper,eye-slash,fan,fast-backward,fast-forward,fax,feather,feather-alt,female,fighter-jet,file,file-alt,file-archive,file-audio,file-code,file-contract,file-csv,file-download,file-excel,file-export,file-image,file-import,file-invoice,file-invoice-dollar,file-medical,file-medical-alt,file-pdf,file-powerpoint,file-prescription,file-signature,file-upload,file-video,file-word,fill,fill-drip,film,filter,fingerprint,fire,fire-alt,fire-extinguisher,first-aid,fish,fist-raised,flag,flag-checkered,flag-usa,flask,flushed,folder,folder-minus,folder-open,folder-plus,font,football-ball,forward,frog,frown,frown-open,funnel-dollar,futbol,gamepad,gas-pump,gavel,gem,genderless,ghost,gift,gifts,glass-cheers,glass-martini,glass-martini-alt,glass-whiskey,glasses,globe,globe-africa,globe-americas,globe-asia,globe-europe,golf-ball,gopuram,graduation-cap,greater-than,greater-than-equal,grimace,grin,grin-alt,grin-beam,grin-beam-sweat,grin-hearts,grin-squint,grin-squint-tears,grin-stars,grin-tears,grin-tongue,grin-tongue-squint,grin-tongue-wink,grin-wink,grip-horizontal,grip-lines,grip-lines-vertical,grip-vertical,guitar,h-square,hamburger,hammer,hamsa,hand-holding,hand-holding-heart,hand-holding-usd,hand-lizard,hand-middle-finger,hand-paper,hand-peace,hand-point-down,hand-point-left,hand-point-right,hand-point-up,hand-pointer,hand-rock,hand-scissors,hand-spock,hands,hands-helping,handshake,hanukiah,hard-hat,hashtag,hat-cowboy,hat-cowboy-side,hat-wizard,hdd,heading,headphones,headphones-alt,headset,heart,heart-broken,heartbeat,helicopter,highlighter,hiking,hippo,history,hockey-puck,holly-berry,home,horse,horse-head,hospital,hospital-alt,hospital-symbol,hot-tub,hotdog,hotel,hourglass,hourglass-end,hourglass-half,hourglass-start,house-damage,hryvnia,i-cursor,ice-cream,icicles,icons,id-badge,id-card,id-card-alt,igloo,image,images,inbox,indent,industry,infinity,info,info-circle,italic,jedi,joint,journal-whills,kaaba,key,keyboard,khanda,kiss,kiss-beam,kiss-wink-heart,kiwi-bird,landmark,language,laptop,laptop-code,laptop-medical,laugh,laugh-beam,laugh-squint,laugh-wink,layer-group,leaf,lemon,less-than,less-than-equal,level-down-alt,level-up-alt,life-ring,lightbulb,link,lira-sign,list,list-alt,list-ol,list-ul,location-arrow,lock,lock-open,long-arrow-alt-down,long-arrow-alt-left,long-arrow-alt-right,long-arrow-alt-up,low-vision,luggage-cart,magic,magnet,mail-bulk,male,map,map-marked,map-marked-alt,map-marker,map-marker-alt,map-pin,map-signs,marker,mars,mars-double,mars-stroke,mars-stroke-h,mars-stroke-v,mask,medal,medkit,meh,meh-blank,meh-rolling-eyes,memory,menorah,mercury,meteor,microchip,microphone,microphone-alt,microphone-alt-slash,microphone-slash,microscope,minus,minus-circle,minus-square,mitten,mobile,mobile-alt,money-bill,money-bill-alt,money-bill-wave,money-bill-wave-alt,money-check,money-check-alt,monument,moon,mortar-pestle,mosque,motorcycle,mountain,mouse,mouse-pointer,mug-hot,music,network-wired,neuter,newspaper,not-equal,notes-medical,object-group,object-ungroup,oil-can,om,otter,outdent,pager,paint-brush,paint-roller,palette,pallet,paper-plane,paperclip,parachute-box,paragraph,parking,passport,pastafarianism,paste,pause,pause-circle,paw,peace,pen,pen-alt,pen-fancy,pen-nib,pen-square,pencil-alt,pencil-ruler,people-carry,pepper-hot,percent,percentage,person-booth,phone,phone-alt,phone-slash,phone-square,phone-square-alt,phone-volume,photo-video,piggy-bank,pills,pizza-slice,place-of-worship,plane,plane-arrival,plane-departure,play,play-circle,plug,plus,plus-circle,plus-square,podcast,poll,poll-h,poo,poo-storm,poop,portrait,pound-sign,power-off,pray,praying-hands,prescription,prescription-bottle,prescription-bottle-alt,print,procedures,project-diagram,puzzle-piece,qrcode,question,question-circle,quidditch,quote-left,quote-right,quran,radiation,radiation-alt,rainbow,random,receipt,record-vinyl,recycle,redo,redo-alt,registered,remove-format,reply,reply-all,republican,restroom,retweet,ribbon,ring,road,robot,rocket,route,rss,rss-square,ruble-sign,ruler,ruler-combined,ruler-horizontal,ruler-vertical,running,rupee-sign,sad-cry,sad-tear,satellite,satellite-dish,save,school,screwdriver,scroll,sd-card,search,search-dollar,search-location,search-minus,search-plus,seedling,server,shapes,share,share-alt,share-alt-square,share-square,shekel-sign,shield-alt,ship,shipping-fast,shoe-prints,shopping-bag,shopping-basket,shopping-cart,shower,shuttle-van,sign,sign-in-alt,sign-language,sign-out-alt,signal,signature,sim-card,sitemap,skating,skiing,skiing-nordic,skull,skull-crossbones,slash,sleigh,sliders-h,smile,smile-beam,smile-wink,smog,smoking,smoking-ban,sms,snowboarding,snowflake,snowman,snowplow,socks,solar-panel,sort,sort-alpha-down,sort-alpha-down-alt,sort-alpha-up,sort-alpha-up-alt,sort-amount-down,sort-amount-down-alt,sort-amount-up,sort-amount-up-alt,sort-down,sort-numeric-down,sort-numeric-down-alt,sort-numeric-up,sort-numeric-up-alt,sort-up,spa,space-shuttle,spell-check,spider,spinner,splotch,spray-can,square,square-full,square-root-alt,stamp,star,star-and-crescent,star-half,star-half-alt,star-of-david,star-of-life,step-backward,step-forward,stethoscope,sticky-note,stop,stop-circle,stopwatch,store,store-alt,stream,street-view,strikethrough,stroopwafel,subscript,subway,suitcase,suitcase-rolling,sun,superscript,surprise,swatchbook,swimmer,swimming-pool,synagogue,sync,sync-alt,syringe,table,table-tennis,tablet,tablet-alt,tablets,tachometer-alt,tag,tags,tape,tasks,taxi,teeth,teeth-open,temperature-high,temperature-low,tenge,terminal,text-height,text-width,th,th-large,th-list,theater-masks,thermometer,thermometer-empty,thermometer-full,thermometer-half,thermometer-quarter,thermometer-three-quarters,thumbs-down,thumbs-up,thumbtack,ticket-alt,times,times-circle,tint,tint-slash,tired,toggle-off,toggle-on,toilet,toilet-paper,toolbox,tools,tooth,torah,torii-gate,tractor,trademark,traffic-light,trailer,train,tram,transgender,transgender-alt,trash,trash-alt,trash-restore,trash-restore-alt,tree,trophy,truck,truck-loading,truck-monster,truck-moving,truck-pickup,tshirt,tty,tv,umbrella,umbrella-beach,underline,undo,undo-alt,universal-access,university,unlink,unlock,unlock-alt,upload,user,user-alt,user-alt-slash,user-astronaut,user-check,user-circle,user-clock,user-cog,user-edit,user-friends,user-graduate,user-injured,user-lock,user-md,user-minus,user-ninja,user-nurse,user-plus,user-secret,user-shield,user-slash,user-tag,user-tie,user-times,users,users-cog,utensil-spoon,utensils,vector-square,venus,venus-double,venus-mars,vial,vials,video,video-slash,vihara,voicemail,volleyball-ball,volume-down,volume-mute,volume-off,volume-up,vote-yea,vr-cardboard,walking,wallet,warehouse,water,wave-square,weight,weight-hanging,wheelchair,wifi,wind,window-close,window-maximize,window-minimize,window-restore,wine-bottle,wine-glass,wine-glass-alt,won-sign,wrench,x-ray,yen-sign,yin-yang,r address-book,r address-card,r angry,r arrow-alt-circle-down,r arrow-alt-circle-left,r arrow-alt-circle-right,r arrow-alt-circle-up,r bell,r bell-slash,r bookmark,r building,r calendar,r calendar-alt,r calendar-check,r calendar-minus,r calendar-plus,r calendar-times,r caret-square-down,r caret-square-left,r caret-square-right,r caret-square-up,r chart-bar,r check-circle,r check-square,r circle,r clipboard,r clock,r clone,r closed-captioning,r comment,r comment-alt,r comment-dots,r comments,r compass,r copy,r copyright,r credit-card,r dizzy,r dot-circle,r edit,r envelope,r envelope-open,r eye,r eye-slash,r file,r file-alt,r file-archive,r file-audio,r file-code,r file-excel,r file-image,r file-pdf,r file-powerpoint,r file-video,r file-word,r flag,r flushed,r folder,r folder-open,r frown,r frown-open,r futbol,r gem,r grimace,r grin,r grin-alt,r grin-beam,r grin-beam-sweat,r grin-hearts,r grin-squint,r grin-squint-tears,r grin-stars,r grin-tears,r grin-tongue,r grin-tongue-squint,r grin-tongue-wink,r grin-wink,r hand-lizard,r hand-paper,r hand-peace,r hand-point-down,r hand-point-left,r hand-point-right,r hand-point-up,r hand-pointer,r hand-rock,r hand-scissors,r hand-spock,r handshake,r hdd,r heart,r hospital,r hourglass,r id-badge,r id-card,r image,r images,r keyboard,r kiss,r kiss-beam,r kiss-wink-heart,r laugh,r laugh-beam,r laugh-squint,r laugh-wink,r lemon,r life-ring,r lightbulb,r list-alt,r map,r meh,r meh-blank,r meh-rolling-eyes,r minus-square,r money-bill-alt,r moon,r newspaper,r object-group,r object-ungroup,r paper-plane,r pause-circle,r play-circle,r plus-square,r question-circle,r registered,r sad-cry,r sad-tear,r save,r share-square,r smile,r smile-beam,r smile-wink,r snowflake,r square,r star,r star-half,r sticky-note,r stop-circle,r sun,r surprise,r thumbs-down,r thumbs-up,r times-circle,r tired,r trash-alt,r user,r user-circle,r window-close,r window-maximize,r window-minimize,r window-restore,b 500px,b accessible-icon,b accusoft,b acquisitions-incorporated,b adn,b adobe,b adversal,b affiliatetheme,b airbnb,b algolia,b alipay,b amazon,b amazon-pay,b amilia,b android,b angellist,b angrycreative,b angular,b app-store,b app-store-ios,b apper,b apple,b apple-pay,b artstation,b asymmetrik,b atlassian,b audible,b autoprefixer,b avianex,b aviato,b aws,b bandcamp,b battle-net,b behance,b behance-square,b bimobject,b bitbucket,b bitcoin,b bity,b black-tie,b blackberry,b blogger,b blogger-b,b bluetooth,b bluetooth-b,b bootstrap,b btc,b buffer,b buromobelexperte,b buy-n-large,b buysellads,b canadian-maple-leaf,b cc-amazon-pay,b cc-amex,b cc-apple-pay,b cc-diners-club,b cc-discover,b cc-jcb,b cc-mastercard,b cc-paypal,b cc-stripe,b cc-visa,b centercode,b centos,b chrome,b chromecast,b cloudscale,b cloudsmith,b cloudversify,b codepen,b codiepie,b confluence,b connectdevelop,b contao,b cotton-bureau,b cpanel,b creative-commons,b creative-commons-by,b creative-commons-nc,b creative-commons-nc-eu,b creative-commons-nc-jp,b creative-commons-nd,b creative-commons-pd,b creative-commons-pd-alt,b creative-commons-remix,b creative-commons-sa,b creative-commons-sampling,b creative-commons-sampling-plus,b creative-commons-share,b creative-commons-zero,b critical-role,b css3,b css3-alt,b cuttlefish,b d-and-d,b d-and-d-beyond,b dashcube,b delicious,b deploydog,b deskpro,b dev,b deviantart,b dhl,b diaspora,b digg,b digital-ocean,b discord,b discourse,b dochub,b docker,b draft2digital,b dribbble,b dribbble-square,b dropbox,b drupal,b dyalog,b earlybirds,b ebay,b edge,b elementor,b ello,b ember,b empire,b envira,b erlang,b ethereum,b etsy,b evernote,b expeditedssl,b facebook,b facebook-f,b facebook-messenger,b facebook-square,b fantasy-flight-games,b fedex,b fedora,b figma,b firefox,b firefox-browser,b first-order,b first-order-alt,b firstdraft,b flickr,b flipboard,b fly,b font-awesome,b font-awesome-alt,b font-awesome-flag,b fonticons,b fonticons-fi,b fort-awesome,b fort-awesome-alt,b forumbee,b foursquare,b free-code-camp,b freebsd,b fulcrum,b galactic-republic,b galactic-senate,b get-pocket,b gg,b gg-circle,b git,b git-alt,b git-square,b github,b github-alt,b github-square,b gitkraken,b gitlab,b gitter,b glide,b glide-g,b gofore,b goodreads,b goodreads-g,b google,b google-drive,b google-play,b google-plus,b google-plus-g,b google-plus-square,b google-wallet,b gratipay,b grav,b gripfire,b grunt,b gulp,b hacker-news,b hacker-news-square,b hackerrank,b hips,b hire-a-helper,b hooli,b hornbill,b hotjar,b houzz,b html5,b hubspot,b ideal,b imdb,b instagram,b intercom,b internet-explorer,b invision,b ioxhost,b itch-io,b itunes,b itunes-note,b java,b jedi-order,b jenkins,b jira,b joget,b joomla,b js,b js-square,b jsfiddle,b kaggle,b keybase,b keycdn,b kickstarter,b kickstarter-k,b korvue,b laravel,b lastfm,b lastfm-square,b leanpub,b less,b line,b linkedin,b linkedin-in,b linode,b linux,b lyft,b magento,b mailchimp,b mandalorian,b markdown,b mastodon,b maxcdn,b mdb,b medapps,b medium,b medium-m,b medrt,b meetup,b megaport,b mendeley,b microblog,b microsoft,b mix,b mixcloud,b mizuni,b modx,b monero,b napster,b neos,b nimblr,b node,b node-js,b npm,b ns8,b nutritionix,b odnoklassniki,b odnoklassniki-square,b old-republic,b opencart,b openid,b opera,b optin-monster,b orcid,b osi,b page4,b pagelines,b palfed,b patreon,b paypal,b penny-arcade,b periscope,b phabricator,b phoenix-framework,b phoenix-squadron,b php,b pied-piper,b pied-piper-alt,b pied-piper-hat,b pied-piper-pp,b pied-piper-square,b pinterest,b pinterest-p,b pinterest-square,b playstation,b product-hunt,b pushed,b python,b qq,b quinscape,b quora,b r-project,b raspberry-pi,b ravelry,b react,b reacteurope,b readme,b rebel,b red-river,b reddit,b reddit-alien,b reddit-square,b redhat,b renren,b replyd,b researchgate,b resolving,b rev,b rocketchat,b rockrms,b safari,b salesforce,b sass,b schlix,b scribd,b searchengin,b sellcast,b sellsy,b servicestack,b shirtsinbulk,b shopware,b simplybuilt,b sistrix,b sith,b sketch,b skyatlas,b skype,b slack,b slack-hash,b slideshare,b snapchat,b snapchat-ghost,b snapchat-square,b soundcloud,b sourcetree,b speakap,b speaker-deck,b spotify,b squarespace,b stack-exchange,b stack-overflow,b stackpath,b staylinked,b steam,b steam-square,b steam-symbol,b sticker-mule,b strava,b stripe,b stripe-s,b studiovinari,b stumbleupon,b stumbleupon-circle,b superpowers,b supple,b suse,b swift,b symfony,b teamspeak,b telegram,b telegram-plane,b tencent-weibo,b the-red-yeti,b themeco,b themeisle,b think-peaks,b trade-federation,b trello,b tripadvisor,b tumblr,b tumblr-square,b twitch,b twitter,b twitter-square,b typo3,b uber,b ubuntu,b uikit,b umbraco,b uniregistry,b unity,b untappd,b ups,b usb,b usps,b ussunnah,b vaadin,b viacoin,b viadeo,b viadeo-square,b viber,b vimeo,b vimeo-square,b vimeo-v,b vine,b vk,b vnv,b vuejs,b waze,b weebly,b weibo,b weixin,b whatsapp,b whatsapp-square,b whmcs,b wikipedia-w,b windows,b wix,b wizards-of-the-coast,b wolf-pack-battalion,b wordpress,b wordpress-simple,b wpbeginner,b wpexplorer,b wpforms,b wpressr,b xbox,b xing,b xing-square,b y-combinator,b yahoo,b yammer,b yandex,b yandex-international,b yarn,b yelp,b yoast,b youtube,b youtube-square,b zhihu'.split(',');
	var iconspro = 'abacus,acorn,ad,address-book,address-card,adjust,air-conditioner,air-freshener,alarm-clock,alarm-exclamation,alarm-plus,alarm-snooze,album,album-collection,alicorn,alien,alien-monster,align-center,align-justify,align-left,align-right,align-slash,allergies,ambulance,american-sign-language-interpreting,amp-guitar,analytics,anchor,angel,angle-double-down,angle-double-left,angle-double-right,angle-double-up,angle-down,angle-left,angle-right,angle-up,angry,ankh,apple-alt,apple-crate,archive,archway,arrow-alt-circle-down,arrow-alt-circle-left,arrow-alt-circle-right,arrow-alt-circle-up,arrow-alt-down,arrow-alt-from-bottom,arrow-alt-from-left,arrow-alt-from-right,arrow-alt-from-top,arrow-alt-left,arrow-alt-right,arrow-alt-square-down,arrow-alt-square-left,arrow-alt-square-right,arrow-alt-square-up,arrow-alt-to-bottom,arrow-alt-to-left,arrow-alt-to-right,arrow-alt-to-top,arrow-alt-up,arrow-circle-down,arrow-circle-left,arrow-circle-right,arrow-circle-up,arrow-down,arrow-from-bottom,arrow-from-left,arrow-from-right,arrow-from-top,arrow-left,arrow-right,arrow-square-down,arrow-square-left,arrow-square-right,arrow-square-up,arrow-to-bottom,arrow-to-left,arrow-to-right,arrow-to-top,arrow-up,arrows,arrows-alt,arrows-alt-h,arrows-alt-v,arrows-h,arrows-v,assistive-listening-systems,asterisk,at,atlas,atom,atom-alt,audio-description,award,axe,axe-battle,baby,baby-carriage,backpack,backspace,backward,bacon,badge,badge-check,badge-dollar,badge-percent,badge-sheriff,badger-honey,bags-shopping,bahai,balance-scale,balance-scale-left,balance-scale-right,ball-pile,ballot,ballot-check,ban,band-aid,banjo,barcode,barcode-alt,barcode-read,barcode-scan,bars,baseball,baseball-ball,basketball-ball,basketball-hoop,bat,bath,battery-bolt,battery-empty,battery-full,battery-half,battery-quarter,battery-slash,battery-three-quarters,bed,bed-alt,bed-bunk,bed-empty,beer,bell,bell-exclamation,bell-on,bell-plus,bell-school,bell-school-slash,bell-slash,bells,betamax,bezier-curve,bible,bicycle,biking,biking-mountain,binoculars,biohazard,birthday-cake,blanket,blender,blender-phone,blind,blinds,blinds-open,blinds-raised,blog,bold,bolt,bomb,bone,bone-break,bong,book,book-alt,book-dead,book-heart,book-medical,book-open,book-reader,book-spells,book-user,bookmark,books,books-medical,boombox,boot,booth-curtain,border-all,border-bottom,border-center-h,border-center-v,border-inner,border-left,border-none,border-outer,border-right,border-style,border-style-alt,border-top,bow-arrow,bowling-ball,bowling-pins,box,box-alt,box-ballot,box-check,box-fragile,box-full,box-heart,box-open,box-up,box-usd,boxes,boxes-alt,boxing-glove,brackets,brackets-curly,braille,brain,bread-loaf,bread-slice,briefcase,briefcase-medical,bring-forward,bring-front,broadcast-tower,broom,browser,brush,bug,building,bullhorn,bullseye,bullseye-arrow,bullseye-pointer,burger-soda,burn,burrito,bus,bus-alt,bus-school,business-time,cabinet-filing,cactus,calculator,calculator-alt,calendar,calendar-alt,calendar-check,calendar-day,calendar-edit,calendar-exclamation,calendar-minus,calendar-plus,calendar-star,calendar-times,calendar-week,camcorder,camera,camera-alt,camera-home,camera-movie,camera-polaroid,camera-retro,campfire,campground,candle-holder,candy-cane,candy-corn,cannabis,capsules,car,car-alt,car-battery,car-building,car-bump,car-bus,car-crash,car-garage,car-mechanic,car-side,car-tilt,car-wash,caravan,caravan-alt,caret-circle-down,caret-circle-left,caret-circle-right,caret-circle-up,caret-down,caret-left,caret-right,caret-square-down,caret-square-left,caret-square-right,caret-square-up,caret-up,carrot,cars,cart-arrow-down,cart-plus,cash-register,cassette-tape,cat,cat-space,cauldron,cctv,certificate,chair,chair-office,chalkboard,chalkboard-teacher,charging-station,chart-area,chart-bar,chart-line,chart-line-down,chart-network,chart-pie,chart-pie-alt,chart-scatter,check,check-circle,check-double,check-square,cheese,cheese-swiss,cheeseburger,chess,chess-bishop,chess-bishop-alt,chess-board,chess-clock,chess-clock-alt,chess-king,chess-king-alt,chess-knight,chess-knight-alt,chess-pawn,chess-pawn-alt,chess-queen,chess-queen-alt,chess-rook,chess-rook-alt,chevron-circle-down,chevron-circle-left,chevron-circle-right,chevron-circle-up,chevron-double-down,chevron-double-left,chevron-double-right,chevron-double-up,chevron-down,chevron-left,chevron-right,chevron-square-down,chevron-square-left,chevron-square-right,chevron-square-up,chevron-up,child,chimney,church,circle,circle-notch,city,clarinet,claw-marks,clinic-medical,clipboard,clipboard-check,clipboard-list,clipboard-list-check,clipboard-prescription,clipboard-user,clock,clone,closed-captioning,cloud,cloud-download,cloud-download-alt,cloud-drizzle,cloud-hail,cloud-hail-mixed,cloud-meatball,cloud-moon,cloud-moon-rain,cloud-music,cloud-rain,cloud-rainbow,cloud-showers,cloud-showers-heavy,cloud-sleet,cloud-snow,cloud-sun,cloud-sun-rain,cloud-upload,cloud-upload-alt,clouds,clouds-moon,clouds-sun,club,cocktail,code,code-branch,code-commit,code-merge,coffee,coffee-pot,coffee-togo,coffin,cog,cogs,coin,coins,columns,comet,comment,comment-alt,comment-alt-check,comment-alt-dollar,comment-alt-dots,comment-alt-edit,comment-alt-exclamation,comment-alt-lines,comment-alt-medical,comment-alt-minus,comment-alt-music,comment-alt-plus,comment-alt-slash,comment-alt-smile,comment-alt-times,comment-check,comment-dollar,comment-dots,comment-edit,comment-exclamation,comment-lines,comment-medical,comment-minus,comment-music,comment-plus,comment-slash,comment-smile,comment-times,comments,comments-alt,comments-alt-dollar,comments-dollar,compact-disc,compass,compass-slash,compress,compress-alt,compress-arrows-alt,compress-wide,computer-classic,computer-speaker,concierge-bell,construction,container-storage,conveyor-belt,conveyor-belt-alt,cookie,cookie-bite,copy,copyright,corn,couch,cow,cowbell,cowbell-more,credit-card,credit-card-blank,credit-card-front,cricket,croissant,crop,crop-alt,cross,crosshairs,crow,crown,crutch,crutches,cube,cubes,curling,cut,dagger,database,deaf,debug,deer,deer-rudolph,democrat,desktop,desktop-alt,dewpoint,dharmachakra,diagnoses,diamond,dice,dice-d10,dice-d12,dice-d20,dice-d4,dice-d6,dice-d8,dice-five,dice-four,dice-one,dice-six,dice-three,dice-two,digging,digital-tachograph,diploma,directions,disc-drive,disease,divide,dizzy,dna,do-not-enter,dog,dog-leashed,dollar-sign,dolly,dolly-empty,dolly-flatbed,dolly-flatbed-alt,dolly-flatbed-empty,donate,door-closed,door-open,dot-circle,dove,download,drafting-compass,dragon,draw-circle,draw-polygon,draw-square,dreidel,drone,drone-alt,drum,drum-steelpan,drumstick,drumstick-bite,dryer,dryer-alt,duck,dumbbell,dumpster,dumpster-fire,dungeon,ear,ear-muffs,eclipse,eclipse-alt,edit,egg,egg-fried,eject,elephant,ellipsis-h,ellipsis-h-alt,ellipsis-v,ellipsis-v-alt,empty-set,engine-warning,envelope,envelope-open,envelope-open-dollar,envelope-open-text,envelope-square,equals,eraser,ethernet,euro-sign,exchange,exchange-alt,exclamation,exclamation-circle,exclamation-square,exclamation-triangle,expand,expand-alt,expand-arrows,expand-arrows-alt,expand-wide,external-link,external-link-alt,external-link-square,external-link-square-alt,eye,eye-dropper,eye-evil,eye-slash,fan,fan-table,farm,fast-backward,fast-forward,faucet,faucet-drip,fax,feather,feather-alt,female,field-hockey,fighter-jet,file,file-alt,file-archive,file-audio,file-certificate,file-chart-line,file-chart-pie,file-check,file-code,file-contract,file-csv,file-download,file-edit,file-excel,file-exclamation,file-export,file-image,file-import,file-invoice,file-invoice-dollar,file-medical,file-medical-alt,file-minus,file-music,file-pdf,file-plus,file-powerpoint,file-prescription,file-search,file-signature,file-spreadsheet,file-times,file-upload,file-user,file-video,file-word,files-medical,fill,fill-drip,film,film-alt,film-canister,filter,fingerprint,fire,fire-alt,fire-extinguisher,fire-smoke,fireplace,first-aid,fish,fish-cooked,fist-raised,flag,flag-alt,flag-checkered,flag-usa,flame,flashlight,flask,flask-poison,flask-potion,flower,flower-daffodil,flower-tulip,flushed,flute,flux-capacitor,fog,folder,folder-minus,folder-open,folder-plus,folder-times,folder-tree,folders,font,font-case,football-ball,football-helmet,forklift,forward,fragile,french-fries,frog,frosty-head,frown,frown-open,function,funnel-dollar,futbol,galaxy,game-board,game-board-alt,game-console-handheld,gamepad,gamepad-alt,garage,garage-car,garage-open,gas-pump,gas-pump-slash,gavel,gem,genderless,ghost,gift,gift-card,gifts,gingerbread-man,glass,glass-champagne,glass-cheers,glass-citrus,glass-martini,glass-martini-alt,glass-whiskey,glass-whiskey-rocks,glasses,glasses-alt,globe,globe-africa,globe-americas,globe-asia,globe-europe,globe-snow,globe-stand,golf-ball,golf-club,gopuram,graduation-cap,gramophone,greater-than,greater-than-equal,grimace,grin,grin-alt,grin-beam,grin-beam-sweat,grin-hearts,grin-squint,grin-squint-tears,grin-stars,grin-tears,grin-tongue,grin-tongue-squint,grin-tongue-wink,grin-wink,grip-horizontal,grip-lines,grip-lines-vertical,grip-vertical,guitar,guitar-electric,guitars,h-square,h1,h2,h3,h4,hamburger,hammer,hammer-war,hamsa,hand-heart,hand-holding,hand-holding-box,hand-holding-heart,hand-holding-magic,hand-holding-seedling,hand-holding-usd,hand-holding-water,hand-lizard,hand-middle-finger,hand-paper,hand-peace,hand-point-down,hand-point-left,hand-point-right,hand-point-up,hand-pointer,hand-receiving,hand-rock,hand-scissors,hand-spock,hands,hands-heart,hands-helping,hands-usd,handshake,handshake-alt,hanukiah,hard-hat,hashtag,hat-chef,hat-cowboy,hat-cowboy-side,hat-santa,hat-winter,hat-witch,hat-wizard,hdd,head-side,head-side-brain,head-side-headphones,head-side-medical,head-vr,heading,headphones,headphones-alt,headset,heart,heart-broken,heart-circle,heart-rate,heart-square,heartbeat,heat,helicopter,helmet-battle,hexagon,highlighter,hiking,hippo,history,hockey-mask,hockey-puck,hockey-sticks,holly-berry,home,home-alt,home-heart,home-lg,home-lg-alt,hood-cloak,horizontal-rule,horse,horse-head,horse-saddle,hospital,hospital-alt,hospital-symbol,hospital-user,hospitals,hot-tub,hotdog,hotel,hourglass,hourglass-end,hourglass-half,hourglass-start,house,house-damage,house-day,house-flood,house-leave,house-night,house-return,house-signal,hryvnia,humidity,hurricane,i-cursor,ice-cream,ice-skate,icicles,icons,icons-alt,id-badge,id-card,id-card-alt,igloo,image,image-polaroid,images,inbox,inbox-in,inbox-out,indent,industry,industry-alt,infinity,info,info-circle,info-square,inhaler,integral,intersection,inventory,island-tropical,italic,jack-o-lantern,jedi,joint,journal-whills,joystick,jug,kaaba,kazoo,kerning,key,key-skeleton,keyboard,keynote,khanda,kidneys,kiss,kiss-beam,kiss-wink-heart,kite,kiwi-bird,knife-kitchen,lambda,lamp,lamp-desk,lamp-floor,landmark,landmark-alt,language,laptop,laptop-code,laptop-medical,lasso,laugh,laugh-beam,laugh-squint,laugh-wink,layer-group,layer-minus,layer-plus,leaf,leaf-heart,leaf-maple,leaf-oak,lemon,less-than,less-than-equal,level-down,level-down-alt,level-up,level-up-alt,life-ring,light-ceiling,light-switch,light-switch-off,light-switch-on,lightbulb,lightbulb-dollar,lightbulb-exclamation,lightbulb-on,lightbulb-slash,lights-holiday,line-columns,line-height,link,lips,lira-sign,list,list-alt,list-music,list-ol,list-ul,location,location-arrow,location-circle,location-slash,lock,lock-alt,lock-open,lock-open-alt,long-arrow-alt-down,long-arrow-alt-left,long-arrow-alt-right,long-arrow-alt-up,long-arrow-down,long-arrow-left,long-arrow-right,long-arrow-up,loveseat,low-vision,luchador,luggage-cart,lungs,mace,magic,magnet,mail-bulk,mailbox,male,mandolin,map,map-marked,map-marked-alt,map-marker,map-marker-alt,map-marker-alt-slash,map-marker-check,map-marker-edit,map-marker-exclamation,map-marker-minus,map-marker-plus,map-marker-question,map-marker-slash,map-marker-smile,map-marker-times,map-pin,map-signs,marker,mars,mars-double,mars-stroke,mars-stroke-h,mars-stroke-v,mask,meat,medal,medkit,megaphone,meh,meh-blank,meh-rolling-eyes,memory,menorah,mercury,meteor,microchip,microphone,microphone-alt,microphone-alt-slash,microphone-slash,microphone-stand,microscope,microwave,mind-share,minus,minus-circle,minus-hexagon,minus-octagon,minus-square,mistletoe,mitten,mobile,mobile-alt,mobile-android,mobile-android-alt,money-bill,money-bill-alt,money-bill-wave,money-bill-wave-alt,money-check,money-check-alt,money-check-edit,money-check-edit-alt,monitor-heart-rate,monkey,monument,moon,moon-cloud,moon-stars,mortar-pestle,mosque,motorcycle,mountain,mountains,mouse,mouse-alt,mouse-pointer,mp3-player,mug,mug-hot,mug-marshmallows,mug-tea,music,music-alt,music-alt-slash,music-slash,narwhal,network-wired,neuter,newspaper,not-equal,notes-medical,object-group,object-ungroup,octagon,oil-can,oil-temp,om,omega,ornament,otter,outdent,outlet,oven,overline,page-break,pager,paint-brush,paint-brush-alt,paint-roller,palette,pallet,pallet-alt,paper-plane,paperclip,parachute-box,paragraph,paragraph-rtl,parking,parking-circle,parking-circle-slash,parking-slash,passport,pastafarianism,paste,pause,pause-circle,paw,paw-alt,paw-claws,peace,pegasus,pen,pen-alt,pen-fancy,pen-nib,pen-square,pencil,pencil-alt,pencil-paintbrush,pencil-ruler,pennant,people-carry,pepper-hot,percent,percentage,person-booth,person-carry,person-dolly,person-dolly-empty,person-sign,phone,phone-alt,phone-laptop,phone-office,phone-plus,phone-rotary,phone-slash,phone-square,phone-square-alt,phone-volume,photo-video,pi,piano,piano-keyboard,pie,pig,piggy-bank,pills,pizza,pizza-slice,place-of-worship,plane,plane-alt,plane-arrival,plane-departure,planet-moon,planet-ringed,play,play-circle,plug,plus,plus-circle,plus-hexagon,plus-octagon,plus-square,podcast,podium,podium-star,police-box,poll,poll-h,poll-people,poo,poo-storm,poop,popcorn,portal-enter,portal-exit,portrait,pound-sign,power-off,pray,praying-hands,prescription,prescription-bottle,prescription-bottle-alt,presentation,print,print-search,print-slash,procedures,project-diagram,projector,pumpkin,puzzle-piece,qrcode,question,question-circle,question-square,quidditch,quote-left,quote-right,quran,rabbit,rabbit-fast,racquet,radar,radiation,radiation-alt,radio,radio-alt,rainbow,raindrops,ram,ramp-loading,random,raygun,receipt,record-vinyl,rectangle-landscape,rectangle-portrait,rectangle-wide,recycle,redo,redo-alt,refrigerator,registered,remove-format,repeat,repeat-1,repeat-1-alt,repeat-alt,reply,reply-all,republican,restroom,retweet,retweet-alt,ribbon,ring,rings-wedding,road,robot,rocket,rocket-launch,route,route-highway,route-interstate,router,rss,rss-square,ruble-sign,ruler,ruler-combined,ruler-horizontal,ruler-triangle,ruler-vertical,running,rupee-sign,rv,sack,sack-dollar,sad-cry,sad-tear,salad,sandwich,satellite,satellite-dish,sausage,save,sax-hot,saxophone,scalpel,scalpel-path,scanner,scanner-image,scanner-keyboard,scanner-touchscreen,scarecrow,scarf,school,screwdriver,scroll,scroll-old,scrubber,scythe,sd-card,search,search-dollar,search-location,search-minus,search-plus,seedling,send-back,send-backward,sensor,sensor-alert,sensor-fire,sensor-on,sensor-smoke,server,shapes,share,share-all,share-alt,share-alt-square,share-square,sheep,shekel-sign,shield,shield-alt,shield-check,shield-cross,ship,shipping-fast,shipping-timed,shish-kebab,shoe-prints,shopping-bag,shopping-basket,shopping-cart,shovel,shovel-snow,shower,shredder,shuttle-van,shuttlecock,sickle,sigma,sign,sign-in,sign-in-alt,sign-language,sign-out,sign-out-alt,signal,signal-1,signal-2,signal-3,signal-4,signal-alt,signal-alt-1,signal-alt-2,signal-alt-3,signal-alt-slash,signal-slash,signal-stream,signature,sim-card,siren,siren-on,sitemap,skating,skeleton,ski-jump,ski-lift,skiing,skiing-nordic,skull,skull-cow,skull-crossbones,slash,sledding,sleigh,sliders-h,sliders-h-square,sliders-v,sliders-v-square,smile,smile-beam,smile-plus,smile-wink,smog,smoke,smoking,smoking-ban,sms,snake,snooze,snow-blowing,snowboarding,snowflake,snowflakes,snowman,snowmobile,snowplow,socks,solar-panel,solar-system,sort,sort-alpha-down,sort-alpha-down-alt,sort-alpha-up,sort-alpha-up-alt,sort-alt,sort-amount-down,sort-amount-down-alt,sort-amount-up,sort-amount-up-alt,sort-circle,sort-circle-down,sort-circle-up,sort-down,sort-numeric-down,sort-numeric-down-alt,sort-numeric-up,sort-numeric-up-alt,sort-shapes-down,sort-shapes-down-alt,sort-shapes-up,sort-shapes-up-alt,sort-size-down,sort-size-down-alt,sort-size-up,sort-size-up-alt,sort-up,soup,spa,space-shuttle,space-station-moon,space-station-moon-alt,spade,sparkles,speaker,speakers,spell-check,spider,spider-black-widow,spider-web,spinner,spinner-third,splotch,spray-can,sprinkler,square,square-full,square-root,square-root-alt,squirrel,staff,stamp,star,star-and-crescent,star-christmas,star-exclamation,star-half,star-half-alt,star-of-david,star-of-life,star-shooting,starfighter,starfighter-alt,stars,starship,starship-freighter,steak,steering-wheel,step-backward,step-forward,stethoscope,sticky-note,stocking,stomach,stop,stop-circle,stopwatch,store,store-alt,stream,street-view,stretcher,strikethrough,stroopwafel,subscript,subway,suitcase,suitcase-rolling,sun,sun-cloud,sun-dust,sun-haze,sunglasses,sunrise,sunset,superscript,surprise,swatchbook,swimmer,swimming-pool,sword,sword-laser,sword-laser-alt,swords,swords-laser,synagogue,sync,sync-alt,syringe,table,table-tennis,tablet,tablet-alt,tablet-android,tablet-android-alt,tablet-rugged,tablets,tachometer,tachometer-alt,tachometer-alt-average,tachometer-alt-fast,tachometer-alt-fastest,tachometer-alt-slow,tachometer-alt-slowest,tachometer-average,tachometer-fast,tachometer-fastest,tachometer-slow,tachometer-slowest,taco,tag,tags,tally,tanakh,tape,tasks,tasks-alt,taxi,teeth,teeth-open,telescope,temperature-down,temperature-frigid,temperature-high,temperature-hot,temperature-low,temperature-up,tenge,tennis-ball,terminal,text,text-height,text-size,text-width,th,th-large,th-list,theater-masks,thermometer,thermometer-empty,thermometer-full,thermometer-half,thermometer-quarter,thermometer-three-quarters,theta,thumbs-down,thumbs-up,thumbtack,thunderstorm,thunderstorm-moon,thunderstorm-sun,ticket,ticket-alt,tilde,times,times-circle,times-hexagon,times-octagon,times-square,tint,tint-slash,tire,tire-flat,tire-pressure-warning,tire-rugged,tired,toggle-off,toggle-on,toilet,toilet-paper,toilet-paper-alt,tombstone,tombstone-alt,toolbox,tools,tooth,toothbrush,torah,torii-gate,tornado,tractor,trademark,traffic-cone,traffic-light,traffic-light-go,traffic-light-slow,traffic-light-stop,trailer,train,tram,transgender,transgender-alt,transporter,transporter-1,transporter-2,transporter-3,transporter-empty,trash,trash-alt,trash-restore,trash-restore-alt,trash-undo,trash-undo-alt,treasure-chest,tree,tree-alt,tree-christmas,tree-decorated,tree-large,tree-palm,trees,triangle,triangle-music,trophy,trophy-alt,truck,truck-container,truck-couch,truck-loading,truck-monster,truck-moving,truck-pickup,truck-plow,truck-ramp,trumpet,tshirt,tty,turkey,turntable,turtle,tv,tv-alt,tv-music,tv-retro,typewriter,ufo,ufo-beam,umbrella,umbrella-beach,underline,undo,undo-alt,unicorn,union,universal-access,university,unlink,unlock,unlock-alt,upload,usb-drive,usd-circle,usd-square,user,user-alien,user-alt,user-alt-slash,user-astronaut,user-chart,user-check,user-circle,user-clock,user-cog,user-cowboy,user-crown,user-edit,user-friends,user-graduate,user-hard-hat,user-headset,user-injured,user-lock,user-md,user-md-chat,user-minus,user-music,user-ninja,user-nurse,user-plus,user-robot,user-secret,user-shield,user-slash,user-tag,user-tie,user-times,user-visor,users,users-class,users-cog,users-crown,users-medical,utensil-fork,utensil-knife,utensil-spoon,utensils,utensils-alt,vacuum,vacuum-robot,value-absolute,vector-square,venus,venus-double,venus-mars,vhs,vial,vials,video,video-plus,video-slash,vihara,violin,voicemail,volcano,volleyball-ball,volume,volume-down,volume-mute,volume-off,volume-slash,volume-up,vote-nay,vote-yea,vr-cardboard,wagon-covered,walker,walkie-talkie,walking,wallet,wand,wand-magic,warehouse,warehouse-alt,washer,watch,watch-calculator,watch-fitness,water,water-lower,water-rise,wave-sine,wave-square,wave-triangle,waveform,waveform-path,webcam,webcam-slash,weight,weight-hanging,whale,wheat,wheelchair,whistle,wifi,wifi-1,wifi-2,wifi-slash,wind,wind-turbine,wind-warning,window,window-alt,window-close,window-frame,window-frame-open,window-maximize,window-minimize,window-restore,windsock,wine-bottle,wine-glass,wine-glass-alt,won-sign,wreath,wrench,x-ray,yen-sign,yin-yang,b 500px,b accessible-icon,b accusoft,b acquisitions-incorporated,b adn,b adobe,b adversal,b affiliatetheme,b airbnb,b algolia,b alipay,b amazon,b amazon-pay,b amilia,b android,b angellist,b angrycreative,b angular,b app-store,b app-store-ios,b apper,b apple,b apple-pay,b artstation,b asymmetrik,b atlassian,b audible,b autoprefixer,b avianex,b aviato,b aws,b bandcamp,b battle-net,b behance,b behance-square,b bimobject,b bitbucket,b bitcoin,b bity,b black-tie,b blackberry,b blogger,b blogger-b,b bluetooth,b bluetooth-b,b bootstrap,b btc,b buffer,b buromobelexperte,b buy-n-large,b buysellads,b canadian-maple-leaf,b cc-amazon-pay,b cc-amex,b cc-apple-pay,b cc-diners-club,b cc-discover,b cc-jcb,b cc-mastercard,b cc-paypal,b cc-stripe,b cc-visa,b centercode,b centos,b chrome,b chromecast,b cloudscale,b cloudsmith,b cloudversify,b codepen,b codiepie,b confluence,b connectdevelop,b contao,b cotton-bureau,b cpanel,b creative-commons,b creative-commons-by,b creative-commons-nc,b creative-commons-nc-eu,b creative-commons-nc-jp,b creative-commons-nd,b creative-commons-pd,b creative-commons-pd-alt,b creative-commons-remix,b creative-commons-sa,b creative-commons-sampling,b creative-commons-sampling-plus,b creative-commons-share,b creative-commons-zero,b critical-role,b css3,b css3-alt,b cuttlefish,b d-and-d,b d-and-d-beyond,b dashcube,b delicious,b deploydog,b deskpro,b dev,b deviantart,b dhl,b diaspora,b digg,b digital-ocean,b discord,b discourse,b dochub,b docker,b draft2digital,b dribbble,b dribbble-square,b dropbox,b drupal,b dyalog,b earlybirds,b ebay,b edge,b elementor,b ello,b ember,b empire,b envira,b erlang,b ethereum,b etsy,b evernote,b expeditedssl,b facebook,b facebook-f,b facebook-messenger,b facebook-square,b fantasy-flight-games,b fedex,b fedora,b figma,b firefox,b firefox-browser,b first-order,b first-order-alt,b firstdraft,b flickr,b flipboard,b fly,b font-awesome,b font-awesome-alt,b font-awesome-flag,b fonticons,b fonticons-fi,b fort-awesome,b fort-awesome-alt,b forumbee,b foursquare,b free-code-camp,b freebsd,b fulcrum,b galactic-republic,b galactic-senate,b get-pocket,b gg,b gg-circle,b git,b git-alt,b git-square,b github,b github-alt,b github-square,b gitkraken,b gitlab,b gitter,b glide,b glide-g,b gofore,b goodreads,b goodreads-g,b google,b google-drive,b google-play,b google-plus,b google-plus-g,b google-plus-square,b google-wallet,b gratipay,b grav,b gripfire,b grunt,b gulp,b hacker-news,b hacker-news-square,b hackerrank,b hips,b hire-a-helper,b hooli,b hornbill,b hotjar,b houzz,b html5,b hubspot,b ideal,b imdb,b instagram,b intercom,b internet-explorer,b invision,b ioxhost,b itch-io,b itunes,b itunes-note,b java,b jedi-order,b jenkins,b jira,b joget,b joomla,b js,b js-square,b jsfiddle,b kaggle,b keybase,b keycdn,b kickstarter,b kickstarter-k,b korvue,b laravel,b lastfm,b lastfm-square,b leanpub,b less,b line,b linkedin,b linkedin-in,b linode,b linux,b lyft,b magento,b mailchimp,b mandalorian,b markdown,b mastodon,b maxcdn,b mdb,b medapps,b medium,b medium-m,b medrt,b meetup,b megaport,b mendeley,b microblog,b microsoft,b mix,b mixcloud,b mizuni,b modx,b monero,b napster,b neos,b nimblr,b node,b node-js,b npm,b ns8,b nutritionix,b odnoklassniki,b odnoklassniki-square,b old-republic,b opencart,b openid,b opera,b optin-monster,b orcid,b osi,b page4,b pagelines,b palfed,b patreon,b paypal,b penny-arcade,b periscope,b phabricator,b phoenix-framework,b phoenix-squadron,b php,b pied-piper,b pied-piper-alt,b pied-piper-hat,b pied-piper-pp,b pied-piper-square,b pinterest,b pinterest-p,b pinterest-square,b playstation,b product-hunt,b pushed,b python,b qq,b quinscape,b quora,b r-project,b raspberry-pi,b ravelry,b react,b reacteurope,b readme,b rebel,b red-river,b reddit,b reddit-alien,b reddit-square,b redhat,b renren,b replyd,b researchgate,b resolving,b rev,b rocketchat,b rockrms,b safari,b salesforce,b sass,b schlix,b scribd,b searchengin,b sellcast,b sellsy,b servicestack,b shirtsinbulk,b shopware,b simplybuilt,b sistrix,b sith,b sketch,b skyatlas,b skype,b slack,b slack-hash,b slideshare,b snapchat,b snapchat-ghost,b snapchat-square,b soundcloud,b sourcetree,b speakap,b speaker-deck,b spotify,b squarespace,b stack-exchange,b stack-overflow,b stackpath,b staylinked,b steam,b steam-square,b steam-symbol,b sticker-mule,b strava,b stripe,b stripe-s,b studiovinari,b stumbleupon,b stumbleupon-circle,b superpowers,b supple,b suse,b swift,b symfony,b teamspeak,b telegram,b telegram-plane,b tencent-weibo,b the-red-yeti,b themeco,b themeisle,b think-peaks,b trade-federation,b trello,b tripadvisor,b tumblr,b tumblr-square,b twitch,b twitter,b twitter-square,b typo3,b uber,b ubuntu,b uikit,b umbraco,b uniregistry,b unity,b untappd,b ups,b usb,b usps,b ussunnah,b vaadin,b viacoin,b viadeo,b viadeo-square,b viber,b vimeo,b vimeo-square,b vimeo-v,b vine,b vk,b vnv,b vuejs,b waze,b weebly,b weibo,b weixin,b whatsapp,b whatsapp-square,b whmcs,b wikipedia-w,b windows,b wix,b wizards-of-the-coast,b wolf-pack-battalion,b wordpress,b wordpress-simple,b wpbeginner,b wpexplorer,b wpforms,b wpressr,b xbox,b xing,b xing-square,b y-combinator,b yahoo,b yammer,b yandex,b yandex-international,b yarn,b yelp,b yoast,b youtube,b youtube-square,b zhihu'.split(',');

	var cls2 = '.' + cls;
	var template = '<span data-search="{0}"><i class="{1}"></i></span>';
	var events = {};
	var container;
	var is = false;
	var ispro = false;
	var cachekey;

	self.singleton();
	self.readonly();
	self.blind();
	self.nocompile();

	self.redraw = function() {
		self.html('<div class="{0}"><div class="{0}-header"><div class="{0}-search"><span><i class="fa fa-search clearsearch"></i></span><div><input type="text" placeholder="{1}" class="{0}-search-input"></div></div></div><div class="{0}-content noscrollbar"></div></div>'.format(cls, config.search));
		container = self.find(cls2 + '-content');
	};

	self.rendericons = function(empty) {

		var key = empty ? '1' : '0';
		if (cachekey === key)
			return;

		cachekey = key;
		var builder = [];

		empty && builder.push(template.format('', ''));

		var arr = ispro ? iconspro : icons;
		for (var i = 0; i < arr.length; i++)
			builder.push(template.format(arr[i].replace(/^.*?-/, '').replace(/-/g, ' ').toSearch(), arr[i]));
		self.find(cls2 + '-content').html(builder.join(''));
	};

	self.search = function(value) {

		var search = self.find('.clearsearch');
		search.rclass2('fa-');

		if (!value.length) {
			search.aclass('fa-search');
			container.find('.hidden').rclass('hidden');
			return;
		}

		value = value.toSearch();
		search.aclass('fa-times');
		container[0].scrollTop = 0;
		var icons = container.find('span');
		for (var i = 0; i < icons.length; i++) {
			var el = $(icons[i]);
			el.tclass('hidden', el.attrd('search').indexOf(value) === -1);
		}
	};

	self.make = function() {

		var links = $(document.head).find('link');
		for (var i = 0; i < links.length; i++) {
			var href = links[i].getAttribute('href');
			if (href.indexOf('pro.css') !== -1) {
				ispro = true;
				break;
			}
		}

		var txt = ' fa-';

		if (ispro) {
			var tmp = [];
			for (var i = 0; i < iconspro.length; i++) {
				var icon = iconspro[i];
				if (icon.charAt(1) === ' ') {
					tmp.push('fa' + icon.replace(' ', txt));
				} else {
					tmp.push('fas fa-' + icon.replace(' ', txt));
					tmp.push('far fa-' + icon.replace(' ', txt));
					tmp.push('fal fa-' + icon.replace(' ', txt));
					tmp.push('fad fa-' + icon.replace(' ', txt));
				}
			}
			iconspro = tmp;
			icons = null;
		} else {
			iconspro = null;
			for (var i = 0; i < icons.length; i++) {
				var icon = icons[i];
				if (icon.charAt(1) === ' ')
					icons[i] = 'fa' + icon.replace(' ', txt);
				else
					icons[i] = 'fa fa-' + icons[i];
			}
		}

		self.aclass(cls + '-container hidden');

		self.event('keydown', 'input', function() {
			var t = this;
			setTimeout2(self.ID, function() {
				self.search(t.value);
			}, 300);
		});

		self.event('click', '.fa-times', function() {
			self.find('input').val('');
			self.search('');
		});

		self.event('click', cls2 + '-content span', function() {
			self.opt.scope && M.scope(self.opt.scope);
			self.opt.callback && self.opt.callback($(this).find('i').attr('class'));
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

		self.on('reflow + scroll + resize', self.hide);
		self.redraw();
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

		if (M.scope)
			opt.scope = M.scope();

		self.target = tmp;
		self.opt = opt;
		var css = {};

		if (is) {
			css.left = 0;
			css.top = 0;
			self.css(css);
		} else
			self.rclass('hidden');

		var target = $(opt.element);
		var w = self.element.width();
		var offset = target.offset();
		var search = self.find(cls2 + '-search-input');

		search.val('');
		self.find('.clearsearch').rclass2('fa-').aclass('fa-search');

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
		self.rendericons(opt.empty);
		var scrollarea = self.find('.noscrollbar').noscrollbar();
		self.css(css);
		if (opt.scrolltop == null || opt.scrolltop)
			scrollarea[0].scrollTop = 0;
		search.focus();
		setTimeout(self.bindevents, 50);
		clearTimeout2(self.ID);
	};

	self.clear = function() {
		container.empty();
		cachekey = null;
	};

	self.hide = function() {
		is = false;
		self.target = null;
		self.opt = null;
		self.unbindevents();
		self.aclass('hidden');
		container.find('.hidden').rclass('hidden');
		setTimeout2(self.ID, self.clear, 1000 * 10);
	};
});

COMPONENT('form', 'zindex:62;scrollbar:1', function(self, config, cls) {

	var cls2 = '.' + cls;
	var container;
	var csspos = {};

	if (!W.$$form) {

		W.$$form_level = W.$$form_level || 1;
		W.$$form = true;

		$(document).on('click', cls2 + '-button-close', function() {
			SET($(this).attrd('path'), '');
		});

		var resize = function() {
			setTimeout2('form', function() {
				for (var i = 0; i < M.components.length; i++) {
					var com = M.components[i];
					if (com.name === 'form' && !HIDDEN(com.dom) && com.$ready && !com.$removed)
						com.resize();
				}
			}, 200);
		};

		if (W.OP)
			W.OP.on('resize', resize);
		else
			$(W).on('resize', resize);

		$(document).on('click', cls2 + '-container', function(e) {
			var el = $(e.target);
			if (!(el.hclass(cls + '-container-padding') || el.hclass(cls + '-container')))
				return;
			var form = $(this).find(cls2);
			var c = cls + '-animate-click';
			form.aclass(c);
			setTimeout(function() {
				form.rclass(c);
			}, 300);
		});
	}

	self.readonly();
	self.submit = function() {
		if (config.submit)
			EXEC(config.submit, self.hide, self.element);
		else
			self.hide();
	};

	self.cancel = function() {
		config.cancel && EXEC(config.cancel, self.hide);
		self.hide();
	};

	self.hide = function() {
		self.set('');
	};

	self.icon = function(value) {
		var el = this.rclass2('fa');
		value.icon && el.aclass(value.icon.indexOf(' ') === -1 ? ('fa fa-' + value.icon) : value.icon);
	};

	self.resize = function() {

		if (self.scrollbar) {
			container.css('height', WH);
			self.scrollbar.resize();
		}

		if (!config.center || self.hclass('hidden'))
			return;

		var ui = self.find(cls2);
		var fh = ui.innerHeight();
		var wh = WH;
		var r = (wh / 2) - (fh / 2);
		csspos.marginTop = (r > 30 ? (r - 15) : 20) + 'px';
		ui.css(csspos);
	};

	self.make = function() {

		$(document.body).append('<div id="{0}" class="hidden {4}-container invisible"><div class="{4}-scrollbar"><div class="{4}-container-padding"><div class="{4}" style="max-width:{1}px"><div data-bind="@config__html span:value.title__change .{4}-icon:@icon" class="{4}-title"><button name="cancel" class="{4}-button-close{3}" data-path="{2}"><i class="fa fa-times"></i></button><i class="{4}-icon"></i><span></span></div></div></div></div>'.format(self.ID, config.width || 800, self.path, config.closebutton == false ? ' hidden' : '', cls));

		var scr = self.find('> script');
		self.template = scr.length ? scr.html().trim() : '';
		if (scr.length)
			scr.remove();

		var el = $('#' + self.ID);
		var body = el.find(cls2)[0];
		container = el.find(cls2 + '-scrollbar');

		if (config.scrollbar) {
			el.css('overflow', 'hidden');
			self.scrollbar = SCROLLBAR(el.find(cls2 + '-scrollbar'), { visibleY: 1, orientation: 'y' });
		}

		while (self.dom.children.length)
			body.appendChild(self.dom.children[0]);

		self.rclass('hidden invisible');
		self.replace(el, true);

		self.event('scroll', function() {
			EMIT('scroll', self.name);
			EMIT('reflow', self.name);
		});

		self.event('click', 'button[name]', function() {
			var t = this;
			switch (t.name) {
				case 'submit':
					self.submit(self.hide);
					break;
				case 'cancel':
					!t.disabled && self[t.name](self.hide);
					break;
			}
		});

		config.enter && self.event('keydown', 'input', function(e) {
			e.which === 13 && !self.find('button[name="submit"]')[0].disabled && setTimeout(self.submit, 800);
		});
	};

	self.configure = function(key, value, init, prev) {
		if (init)
			return;
		switch (key) {
			case 'width':
				value !== prev && self.find(cls2).css('max-width', value + 'px');
				break;
			case 'closebutton':
				self.find(cls2 + '-button-close').tclass('hidden', value !== true);
				break;
		}
	};

	self.setter = function(value) {

		setTimeout2(cls + '-noscroll', function() {
			$('html').tclass(cls + '-noscroll', !!$(cls2 + '-container').not('.hidden').length);
		}, 50);

		var isHidden = value !== config.if;

		if (self.hclass('hidden') === isHidden) {
			if (!isHidden) {
				config.reload && EXEC(config.reload, self);
				config.default && DEFAULT(config.default, true);
			}
			return;
		}

		setTimeout2(cls, function() {
			EMIT('reflow', self.name);
		}, 10);

		if (isHidden) {
			self.aclass('hidden');
			self.release(true);
			self.find(cls2).rclass(cls + '-animate');
			W.$$form_level--;
			return;
		}

		if (self.template) {
			var is = self.template.COMPILABLE();
			self.find(cls2).append(self.template);
			self.template = null;
			is && COMPILE();
		}

		if (W.$$form_level < 1)
			W.$$form_level = 1;

		W.$$form_level++;

		self.css('z-index', W.$$form_level * config.zindex);
		self.element.scrollTop(0);
		self.rclass('hidden');

		self.resize();
		self.release(false);

		config.reload && EXEC(config.reload, self);
		config.default && DEFAULT(config.default, true);

		if (!isMOBILE && config.autofocus) {
			setTimeout(function() {
				self.find(typeof(config.autofocus) === 'string' ? config.autofocus : 'input[type="text"],select,textarea').eq(0).focus();
			}, 1000);
		}

		setTimeout(function() {
			self.rclass('invisible');
			self.element.scrollTop(0);
			self.find(cls2).aclass(cls + '-animate');
		}, 300);

		// Fixes a problem with freezing of scrolling in Chrome
		setTimeout2(self.ID, function() {
			self.css('z-index', (W.$$form_level * config.zindex) + 1);
		}, 500);
	};
});

COMPONENT('floatinginput', 'minwidth:200', function(self, config, cls) {

	var cls2 = '.' + cls;
	var timeout, icon, plus, input, summary;
	var is = false;
	var plusvisible = false;

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
		self.append('<div class="{1}-summary hidden"></div><div class="{1}-input"><span class="{1}-add hidden"><i class="fa fa-plus"></i></span><span class="{1}-button"><i class="fa fa-search"></i></span><div><input type="text" placeholder="{0}" class="{1}-search-input" name="dir{2}" autocomplete="dir{2}" /></div></div'.format(config.placeholder, cls, Date.now()));

		input = self.find('input');
		icon = self.find(cls2 + '-button').find('i');
		plus = self.find(cls2 + '-add');
		summary = self.find(cls2 + '-summary');

		self.event('click', cls2 + '-button', function(e) {
			input.val('');
			self.search();
			e.stopPropagation();
			e.preventDefault();
		});

		self.event('click', cls2 + '-add', function() {
			if (self.opt.callback) {
				self.opt.scope && M.scope(self.opt.scope);
				self.opt.callback(input.val(), self.opt.element, true);
				self.hide();
			}
		});

		self.event('keydown', 'input', function(e) {
			switch (e.which) {
				case 27:
					self.hide();
					break;
				case 13:
					if (self.opt.callback) {
						self.opt.scope && M.scope(self.opt.scope);
						self.opt.callback(this.value, self.opt.element);
					}
					self.hide();
					break;
			}
		});

		var e_click = function(e) {
			var node = e.target;
			var count = 0;

			if (is) {
				while (true) {
					var c = node.getAttribute('class') || '';
					if (c.indexOf(cls + '-input') !== -1)
						return;
					node = node.parentNode;
					if (!node || !node.tagName || node.tagName === 'BODY' || count > 3)
						break;
					count++;
				}
			} else {
				is = true;
				while (true) {
					var c = node.getAttribute('class') || '';
					if (c.indexOf(cls) !== -1) {
						is = false;
						break;
					}
					node = node.parentNode;
					if (!node || !node.tagName || node.tagName === 'BODY' || count > 4)
						break;
					count++;
				}
			}

			is && self.hide(0);
		};

		var e_resize = function() {
			is && self.hide(0);
		};

		self.bindedevents = false;

		self.bindevents = function() {
			if (!self.bindedevents) {
				$(document).on('click', e_click);
				$(W).on('resize', e_resize);
				self.bindedevents = true;
			}
		};

		self.unbindevents = function() {
			if (self.bindedevents) {
				self.bindedevents = false;
				$(document).off('click', e_click);
				$(W).off('resize', e_resize);
			}
		};

		self.event('input', 'input', function() {
			var is = !!this.value;
			if (plusvisible !== is) {
				plusvisible = is;
				plus.tclass('hidden', !this.value);
			}
		});

		var fn = function() {
			is && self.hide(1);
		};

		self.on('reflow', fn);
		self.on('scroll', fn);
		self.on('resize', fn);
		$(W).on('scroll', fn);
	};

	self.show = function(opt) {

		// opt.element
		// opt.callback(value, el)
		// opt.offsetX     --> offsetX
		// opt.offsetY     --> offsetY
		// opt.offsetWidth --> plusWidth
		// opt.placeholder
		// opt.render
		// opt.minwidth
		// opt.maxwidth
		// opt.icon;
		// opt.maxlength = 30;

		var el = opt.element instanceof jQuery ? opt.element[0] : opt.element;

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
		plusvisible = false;

		var element = $(opt.element);

		setTimeout(self.bindevents, 500);

		self.opt = opt;
		opt.class && self.aclass(opt.class);

		input.val(opt.value || '');
		input.prop('maxlength', opt.maxlength || 50);

		self.target = element[0];

		var w = element.width();
		var offset = element.offset();
		var width = w + (opt.offsetWidth || 0);

		if (opt.minwidth && width < opt.minwidth)
			width = opt.minwidth;
		else if (opt.maxwidth && width > opt.maxwidth)
			width = opt.maxwidth;

		var ico = '';

		if (opt.icon) {
			if (opt.icon.indexOf(' ') === -1)
				ico = 'fa fa-' + opt.icon;
			else
				ico = opt.icon;
		} else
			ico = 'fa fa-pencil-alt';

		icon.rclass2('fa').aclass(ico).rclass('hidden');

		if (opt.value) {
			plusvisible = true;
			plus.rclass('hidden');
		} else
			plus.aclass('hidden');

		self.find('input').prop('placeholder', opt.placeholder || config.placeholder);
		var options = { left: 0, top: 0, width: width };

		summary.tclass('hidden', !opt.summary).html(opt.summary || '');

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
		options.scope = M.scope ? M.scope() : '';

		if (opt.offsetX)
			options.left += opt.offsetX;

		if (opt.offsetY)
			options.top += opt.offsetY;

		self.css(options);

		!isMOBILE && setTimeout(function() {
			input.focus();
		}, 200);

		self.rclass('hidden');

		setTimeout(function() {
			self.initializing = false;
			is = true;
			if (self.opt && self.target && self.target.offsetParent)
				self.aclass(cls + '-visible');
			else
				self.hide(1);
		}, 100);
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

COMPONENT('inputmessage', function(self, config, cls) {

	var area;

	self.make = function() {

		self.aclass(cls);
		self.append('<textarea></textarea>');
		area = self.find('textarea');

		var fn = GET(self.makepath(config.oninput));

		area.on('input', function() {
			fn(area[0]);
		});

		area.on('keydown', function(e) {
			if (e.which === 13) {
				if (!e.shiftKey) {
					config.exec && EXEC(self.makepath(config.exec), area.val());
					area.val('');
					fn(area[0]);
					e.preventDefault();
				}
			}
		});

		fn(area[0]);
		config.placeholder && area.attr('placeholder', config.placeholder);
	};

});

COMPONENT('messages', function(self) {

	var com;

	self.make = function() {
		self.template = Tangular.compile(self.find('script').html());
	};

	var resize = function(com) {
		com.resizescrollbar();
		com.scrollbottom(0);
	};

	self.setter = function(value, path, type) {

		if (!value)
			value = EMPTYARRAY;

		if (!com)
			com = self.element.closest('.ui-viewbox').component();

		if (type === 'insert') {
			self.append(self.template(value.last()));
		} else {
			var builder = [];
			for (var i = 0; i < value.length; i++)
				builder.push(self.template(value[i]));
			self.html(builder.join(''));
		}

		FUNC.markdownredraw && FUNC.markdownredraw(self.element);

		if (com) {
			resize(com);
			setTimeout(resize, 200, com);
			setTimeout(resize, 800, com);
		}
	};
});

COMPONENT('markdown', function (self) {

	self.readonly();
	self.singleton();
	self.blind();
	self.nocompile();

	self.make = function() {
		// Remove from DOM because Markdown is used as a String prototype and Tangular helper
		setTimeout(function() {
			self.remove();
		}, 500);

		$(document).on('click', '.showsecret', function() {
			var el = $(this);
			var next = el.next();
			next.tclass('hidden');

			var is = next.hclass('hidden');
			var icons = el.find('i');
			icons.eq(0).tclass('fa-unlock', !is).tclass('fa-lock', is);
			icons.eq(1).tclass('fa-angle-up', !is).tclass('fa-angle-down', is);

			el.find('b').html(el.attrd(is ? 'show' : 'hide'));
		});
	};

	/*! Markdown | (c) 2019 Peter Sirka | www.petersirka.com */
	(function Markdown() {

		var keywords = /\{.*?\}\(.*?\)/g;
		var linksexternal = /(https|http):\/\//;
		var format = /__.*?__|_.*?_|\*\*.*?\*\*|\*.*?\*|~~.*?~~|~.*?~/g;
		var ordered = /^[a-z|0-9]{1}\.\s|^-\s/i;
		var orderedsize = /^(\s|\t)+/;
		var code = /`.*?`/g;
		var encodetags = /<|>/g;
		var regdash = /-{2,}/g;
		var regicons = /(^|[^\w]):[a-z-]+:([^\w]|$)/g;
		var regemptychar = /\s|\W/;

		var encode = function(val) {
			return '&' + (val === '<' ? 'lt' : 'gt') + ';';
		};

		function markdown_code(value) {
			return '<code>' + value.substring(1, value.length - 1) + '</code>';
		}

		function markdown_imagelinks(value) {
			var end = value.lastIndexOf(')') + 1;
			var img = value.substring(0, end);
			var url = value.substring(end + 2, value.length - 1);
			var label = markdown_links(img);
			var footnote = label.substring(0, 13);

			if (footnote === '<sup data-id=' || footnote === '<span data-id' || label.substring(0, 9) === '<a href="')
				return label;

			return '<a href="' + url + '"' + (linksexternal.test(url) ? ' target="_blank"' : '') + '>' + label + '</a>';
		}

		function markdown_table(value, align, ishead) {

			var columns = value.substring(1, value.length - 1).split('|');
			var builder = '';

			for (var i = 0; i < columns.length; i++) {
				var column = columns[i].trim();
				if (column.charAt(0) == '-')
					continue;
				var a = align[i];
				builder += '<' + (ishead ? 'th' : 'td') + (a && a !== 'left' ? (' class="' + a + '"') : '') + '>' + column + '</' + (ishead ? 'th' : 'td') + '>';
			}

			return '<tr>' + builder + '</tr>';
		}

		function markdown_links(value) {
			var end = value.lastIndexOf(']');
			var img = value.charAt(0) === '!';
			var text = value.substring(img ? 2 : 1, end);
			var link = value.substring(end + 2, value.length - 1);

			if ((/^#\d+$/).test(link)) {
				// footnotes
				return (/^\d+$/).test(text) ? '<sup data-id="{0}" class="footnote">{1}</sup>'.format(link.substring(1), text) : '<span data-id="{0}" class="footnote">{1}</span>'.format(link.substring(1), text);
			}

			if (link.substring(0, 4) === 'www.')
				link = 'https://' + link;

			var nofollow = link.charAt(0) === '@' ? ' rel="nofollow"' : linksexternal.test(link) ? ' target="_blank"' : '';
			return '<a href="' + link + '"' + nofollow + '>' + text + '</a>';
		}

		function markdown_image(value) {

			var end = value.lastIndexOf(']');
			var text = value.substring(2, end);
			var link = value.substring(end + 2, value.length - 1);
			var responsive = 1;
			var f = text.charAt(0);

			if (f === '+') {
				responsive = 2;
				text = text.substring(1);
			} else if (f === '-') {
				// gallery
				responsive = 3;
				text = text.substring(1);
			}

			return '<img src="' + link + '" alt="' + text + '"' + (responsive === 1 ? ' class="img-responsive"' : responsive === 3 ? ' class="gallery"' : '') + ' border="0" loading="lazy" />';
		}

		function markdown_keywords(value) {
			var keyword = value.substring(1, value.indexOf('}'));
			var type = value.substring(value.lastIndexOf('(') + 1, value.lastIndexOf(')'));
			return '<span class="keyword" data-type="{0}">{1}</span>'.format(type, keyword);
		}

		function markdown_links2(value) {
			value = value.substring(4, value.length - 4);
			return '<a href="' + (value.indexOf('@') !== -1 ? 'mailto:' : linksexternal.test(value) ? '' : 'http://') + value + '" target="_blank">' + value + '</a>';
		}

		function markdown_format(value, index, text) {

			var p = text.charAt(index - 1);
			var n = text.charAt(index + value.length);

			if ((!p || regemptychar.test(p)) && (!n || regemptychar.test(n))) {

				var beg = '';
				var end = '';
				var tag;

				if (value.indexOf('*') !== -1) {
					tag = value.indexOf('**') === -1 ? 'em' : 'strong';
					beg += '<' + tag + '>';
					end = '</' + tag + '>' + end;
				}

				if (value.indexOf('_') !== -1) {
					tag = value.indexOf('__') === -1 ? 'u' : 'b';
					beg += '<' + tag + '>';
					end = '</' + tag + '>' + end;
				}

				if (value.indexOf('~') !== -1) {
					beg += '<strike>';
					end = '</strike>' + end;
				}

				var count = value.charAt(1) === value.charAt(0) ? 2 : 1;
				return beg + value.substring(count, value.length - count) + end;
			}

			return value;
		}

		function markdown_id(value) {

			var end = '';
			var beg = '';

			if (value.charAt(0) === '<')
				beg = '-';

			if (value.charAt(value.length - 1) === '>')
				end = '-';

			// return (beg + value.replace(regtags, '').toLowerCase().replace(regid, '-') + end).replace(regdash, '-');
			return (beg + value.slug() + end).replace(regdash, '-');
		}

		function markdown_icon(value) {

			var beg = -1;
			var end = -1;

			for (var i = 0; i < value.length; i++) {
				var code = value.charCodeAt(i);
				if (code === 58) {
					if (beg === -1)
						beg = i + 1;
					else
						end = i;
				}
			}

			return value.substring(0, beg - 1) + '<i class="fa fa-' + value.substring(beg, end) + '"></i>' + value.substring(end + 1);
		}

		function markdown_urlify(str) {
			return str.replace(/(^|\s)+(((https?:\/\/)|(www\.))[^\s]+)/g, function(url, b, c) {
				var len = url.length;
				var l = url.charAt(len - 1);
				var f = url.charAt(0);
				if (l === '.' || l === ',')
					url = url.substring(0, len - 1);
				else
					l = '';
				url = (c === 'www.' ? 'http://' + url : url).trim();
				return (f.charCodeAt(0) < 40 ? f : '') + '[' + url + '](' + url + ')' + l;
			});
		}

		FUNC.markdownredraw = function(el, opt) {

			if (!opt)
				opt = EMPTYOBJECT;

			el.find('.lang-secret').each(function() {
				var el = $(this);
				el.parent().replaceWith('<div class="secret" data-show="{0}" data-hide="{1}"><span class="showsecret"><i class="fa fa-lock"></i><i class="fa pull-right fa-angle-down"></i><b>{0}</b></span><div class="hidden">'.format(opt.showsecret || 'Show secret data', opt.hidesecret || 'Hide secret data') + el.html().trim().markdown(opt.secretoptions) +'</div></div>');
			});

			el.find('.lang-video').each(function() {
				var t = this;
				if (t.$mdloaded)
					return;
				t.$mdloaded = 1;
				var el = $(t);
				var html = el.html();
				if (html.indexOf('youtube') !== -1)
					el.parent().replaceWith('<div class="video"><iframe src="https://www.youtube.com/embed/' + html.split('v=')[1] + '" frameborder="0" allowfullscreen></iframe></div>');
				else if (html.indexOf('vimeo') !== -1)
					el.parent().replaceWith('<div class="video"><iframe src="//player.vimeo.com/video/' + html.substring(html.lastIndexOf('/') + 1) + '" frameborder="0" allowfullscreen></iframe></div>');
			});

			el.find('.lang-barchart').each(function() {

				var t = this;
				if (t.$mdloaded)
					return;

				t.$mdloaded = 1;
				var el = $(t);
				var arr = el.html().split('\n').trim();
				var series = [];
				var categories = [];
				var y = '';

				for (var i = 0; i < arr.length; i++) {
					var line = arr[i].split('|').trim();
					for (var j = 1; j < line.length; j++) {
						if (i === 0)
							series.push({ name: line[j], data: [] });
						else
							series[j - 1].data.push(+line[j]);
					}
					if (i)
						categories.push(line[0]);
					else
						y = line[0];
				}

				var options = {
					chart: {
						height: 300,
						type: 'bar',
					},
					yaxis: { title: { text: y }},
					series: series,
					xaxis: { categories: categories, },
					fill: { opacity: 1 },
				};

				var chart = new ApexCharts($(this).parent().empty()[0], options);
				chart.render();
			});

			el.find('.lang-linerchar').each(function() {

				var t = this;
				if (t.$mdloaded)
					return;
				t.$mdloaded = 1;

				var el = $(t);
				var arr = el.html().split('\n').trim();
				var series = [];
				var categories = [];
				var y = '';

				for (var i = 0; i < arr.length; i++) {
					var line = arr[i].split('|').trim();
					for (var j = 1; j < line.length; j++) {
						if (i === 0)
							series.push({ name: line[j], data: [] });
						else
							series[j - 1].data.push(+line[j]);
					}
					if (i)
						categories.push(line[0]);
					else
						y = line[0];
				}

				var options = {
					chart: {
						height: 300,
						type: 'line',
					},
					yaxis: { title: { text: y }},
					series: series,
					xaxis: { categories: categories, },
					fill: { opacity: 1 },
				};

				var chart = new ApexCharts($(this).parent().empty()[0], options);
				chart.render();
			});

			el.find('.lang-iframe').each(function() {

				var t = this;
				if (t.$mdloaded)
					return;
				t.$mdloaded = 1;

				var el = $(t);
				el.parent().replaceWith('<div class="iframe">' + el.html().replace(/&lt;/g, '<').replace(/&gt;/g, '>') + '</div>');
			});

			var fixtags = function(text) {
				switch (text) {
					case '&lt;':
						return '<';
					case '&gt;':
						return '>';
					case '&amp;':
						return '&';
				}
				return text;
			};

			el.find('pre code').each(function(i, block) {
				var t = this;
				if (t.$mdloaded)
					return;
				t.$mdloaded = 1;

				var lng = block.getAttribute('class').replace('lang-', '');
				var type;

				switch(lng) {
					case 'html':
					case 'htm':
						type = 'totaljs';
						break;
					case 'php':
						type = 'application/x-httpd-php';
						break;
					case 'js':
					case 'javascript':
					case 'totaljs_server':
						type = 'javascript';
						break;
					case 'css':
						type = 'text/css';
						break;
					case 'cpp':
						type = 'text/x-csrc';
						break;
					case 'sql':
						type = 'text/x-sql';
						break;
					case 'json':
						type = 'application/ld+json';
						break;
					case 'py':
						type = 'text/x-cython';
						break;
					case 'sh':
						type = 'text/x-sh';
						break;
					case 'sass':
						type = 'text/x-sass';
						break;
					case 'yaml':
						type = 'text/x-yaml';
						break;
					case 'xml':
						type = 'text/xml';
						break;
					case 'wat':
					case 'wast':
					case 'wasm':
						type = 'text/webassembly';
						break;
				}

				CodeMirror.runMode(block.innerHTML.trim().replace(/&lt;|&gt;|&amp;/g, fixtags).replace(/\t/g, '  '), type, $(block).aclass('cm-s-default')[0]);
			});

			el.find('a').each(function() {
				var t = this;
				if (t.$mdloaded)
					return;
				t.$mdloaded = 1;
				var el = $(t);
				var href = el.attr('href');
				var c = href.substring(0, 1);
				if (href === '#') {
					var beg = '';
					var end = '';
					var text = el.html();
					if (text.substring(0, 1) === '<')
						beg = '-';
					if (text.substring(text.length - 1) === '>')
						end = '-';
					el.attr('href', '#' + (beg + markdown_id(el.text()) + end));
				} else if (c !== '/' && c !== '#')
					el.attr('target', '_blank');
			});

			el.find('.code').rclass('hidden');
		};

		String.prototype.markdown = function(opt) {

			// opt.wrap = true;
			// opt.linetag = 'p';
			// opt.ul = true;
			// opt.code = true;
			// opt.images = true;
			// opt.links = true;
			// opt.formatting = true;
			// opt.icons = true;
			// opt.tables = true;
			// opt.br = true;
			// opt.headlines = true;
			// opt.hr = true;
			// opt.blockquotes = true;
			// opt.sections = true;
			// opt.custom
			// opt.footnotes = true;
			// opt.urlify = true;
			// opt.keywords = true;

			var str = this;

			if (!opt)
				opt = {};

			var lines = str.split('\n');
			var builder = [];
			var ul = [];
			var table = false;
			var iscode = false;
			var ishead = false;
			var prev;
			var prevsize = 0;
			var tmp;

			if (opt.wrap == null)
				opt.wrap = true;

			if (opt.linetag == null)
				opt.linetag = 'p';

			var closeul = function() {
				while (ul.length) {
					var text = ul.pop();
					builder.push('</' + text + '>');
				}
			};

			var formatlinks = function(val) {
				return markdown_links(val, opt.images);
			};

			var linkscope = function(val, index, callback) {

				var beg = -1;
				var beg2 = -1;
				var can = false;
				var n;

				for (var i = index; i < val.length; i++) {
					var c = val.charAt(i);

					if (c === '[') {
						beg = i;
						can = false;
						continue;
					}

					var il = val.substring(i, i + 4);

					if (il === '&lt;') {
						beg2 = i;
						continue;
					} else if (beg2 > -1 && il === '&gt;') {
						callback(val.substring(beg2, i + 4), true);
						beg2 = -1;
						continue;
					}

					if (c === ']') {

						can = false;

						if (beg === -1)
							continue;

						n = val.charAt(i + 1);

						// maybe a link mistake
						if (n === ' ')
							n = val.charAt(i + 2);

						// maybe a link
						can = n === '(';
					}

					if (beg > -1 && can && c === ')') {
						n = val.charAt(beg - 1);
						callback(val.substring(beg - (n === '!' ? 1 : 0), i + 1));
						can = false;
						beg = -1;
					}
				}

			};

			var imagescope = function(val) {

				var beg = -1;
				var can = false;
				var n;

				for (var i = 0; i < val.length; i++) {
					var c = val.charAt(i);

					if (c === '[') {
						beg = i;
						can = false;
						continue;
					}

					if (c === ']') {

						can = false;

						if (beg === -1)
							continue;

						n = val.charAt(i + 1);

						// maybe a link mistake
						if (n === ' ')
							n = val.charAt(i + 2);

						// maybe a link
						can = n === '(';
					}

					if (beg > -1 && can && c === ')') {
						n = val.charAt(beg - 1);
						var tmp = val.substring(beg - (n === '!' ? 1 : 0), i + 1);
						if (tmp.charAt(0) === '!')
							val = val.replace(tmp, markdown_image(tmp));
						can = false;
						beg = -1;
					}
				}


				return val;
			};

			for (var i = 0, length = lines.length; i < length; i++) {

				lines[i] = lines[i].replace(encodetags, encode);

				if (lines[i].substring(0, 3) === '```') {

					if (iscode) {
						if (opt.code !== false)
							builder[builder.length - 1] += '</code></pre></div>';
						iscode = false;
						continue;
					}

					closeul();
					iscode = true;
					if (opt.code !== false)
						tmp = '<div class="code hidden"><pre><code class="lang-' + lines[i].substring(3) + '">';
					prev = 'code';
					continue;
				}

				if (iscode) {
					if (opt.code !== false)
						builder.push(tmp + lines[i]);
					if (tmp)
						tmp = '';
					continue;
				}

				var line = lines[i];

				if (opt.urlify !== false && opt.links !== false)
					line = markdown_urlify(line);

				if (opt.custom)
					line = opt.custom(line);

				if (opt.formatting !== false)
					line = line.replace(format, markdown_format).replace(code, markdown_code);

				if (opt.images !== false)
					line = imagescope(line);

				if (opt.links !== false) {
					linkscope(line, 0, function(text, inline) {
						if (inline)
							line = line.replace(text, markdown_links2);
						else if (opt.images !== false)
							line = line.replace(text, markdown_imagelinks);
						else
							line = line.replace(text, formatlinks);
					});
				}

				if (opt.keywords !== false)
					line = line.replace(keywords, markdown_keywords);

				if (opt.icons !== false)
					line = line.replace(regicons, markdown_icon);

				if (!line) {
					if (table) {
						table = null;
						if (opt.tables !== false)
							builder.push('</tbody></table>');
					}
				}

				if (line === '' && lines[i - 1] === '') {
					closeul();
					if (opt.br !== false)
						builder.push('<br />');
					prev = 'br';
					continue;
				}

				if (line[0] === '|') {
					closeul();
					if (!table) {
						var next = lines[i + 1];
						if (next[0] === '|') {
							table = [];
							var columns = next.substring(1, next.length - 1).split('|');
							for (var j = 0; j < columns.length; j++) {
								var column = columns[j].trim();
								var align = 'left';
								if (column.charAt(column.length - 1) === ':')
									align = column[0] === ':' ? 'center' : 'right';
								table.push(align);
							}
							if (opt.tables !== false)
								builder.push('<table class="table table-bordered"><thead>');
							prev = 'table';
							ishead = true;
							i++;
						} else
							continue;
					}

					if (opt.tables !== false) {
						if (ishead)
							builder.push(markdown_table(line, table, true) + '</thead><tbody>');
						else
							builder.push(markdown_table(line, table));
					}
					ishead = false;
					continue;
				}

				if (line.charAt(0) === '#') {

					closeul();

					if (line.substring(0, 2) === '# ') {
						tmp = line.substring(2).trim();
						if (opt.headlines !== false)
							builder.push('<h1 id="' + markdown_id(tmp) + '">' + tmp + '</h1>');
						prev = '#';
						continue;
					}

					if (line.substring(0, 3) === '## ') {
						tmp = line.substring(3).trim();
						if (opt.headlines !== false)
							builder.push('<h2 id="' + markdown_id(tmp) + '">' + tmp + '</h2>');
						prev = '##';
						continue;
					}

					if (line.substring(0, 4) === '### ') {
						tmp = line.substring(4).trim();
						if (opt.headlines !== false)
							builder.push('<h3 id="' + markdown_id(tmp) + '">' + tmp + '</h3>');
						prev = '###';
						continue;
					}

					if (line.substring(0, 5) === '#### ') {
						tmp = line.substring(5).trim();
						if (opt.headlines !== false)
							builder.push('<h4 id="' + markdown_id(tmp) + '">' + tmp + '</h4>');
						prev = '####';
						continue;
					}

					if (line.substring(0, 6) === '##### ') {
						tmp = line.substring(6).trim();
						if (opt.headlines !== false)
							builder.push('<h5 id="' + markdown_id(tmp) + '">' + tmp + '</h5>');
						prev = '#####';
						continue;
					}
				}

				tmp = line.substring(0, 3);

				if (tmp === '---' || tmp === '***') {
					prev = 'hr';
					if (opt.hr !== false)
						builder.push('<hr class="line' + (tmp.charAt(0) === '-' ? '1' : '2') + '" />');
					continue;
				}

				// footnotes
				if ((/^#\d+:(\s)+/).test(line)) {
					if (opt.footnotes !== false) {
						tmp = line.indexOf(':');
						builder.push('<div class="footnotebody" data-id="{0}"><span>{0}:</span> {1}</div>'.format(line.substring(1, tmp).trim(), line.substring(tmp + 1).trim()));
					}
					continue;
				}

				if (line.substring(0, 5) === '&gt; ') {
					if (opt.blockquotes !== false)
						builder.push('<blockquote>' + line.substring(5).trim() + '</blockquote>');
					prev = '>';
					continue;
				}

				if (line.substring(0, 5) === '&lt; ') {
					if (opt.sections !== false)
						builder.push('<section>' + line.substring(5).trim() + '</section>');
					prev = '<';
					continue;
				}

				var tmpline = line.trim();

				if (opt.ul !== false && ordered.test(tmpline)) {

					var size = line.match(orderedsize);
					if (size)
						size = size[0].length;
					else
						size = 0;

					var append = false;

					if (prevsize !== size) {
						// NESTED
						if (size > prevsize) {
							prevsize = size;
							append = true;
							var index = builder.length - 1;
							builder[index] = builder[index].substring(0, builder[index].length - 5);
							prev = '';
						} else {
							// back to normal
							prevsize = size;
							builder.push('</' + ul.pop() + '>');
						}
					}

					var type = tmpline.charAt(0) === '-' ? 'ul' : 'ol';
					if (prev !== type) {
						var subtype;
						if (type === 'ol')
							subtype = tmpline.charAt(0);
						builder.push('<' + type + (subtype ? (' type="' + subtype + '"') : '') + '>');
						ul.push(type + (append ? '></li' : ''));
						prev = type;
						prevsize = size;
					}

					builder.push('<li>' + (type === 'ol' ? tmpline.substring(tmpline.indexOf('.') + 1) : tmpline.substring(2)).trim().replace(/\[x\]/g, '<i class="fa fa-check-square green"></i>').replace(/\[\s\]/g, '<i class="far fa-square"></i>') + '</li>');

				} else {
					closeul();
					line && builder.push((opt.linetag ? ('<' + opt.linetag + '>') : '') + line.trim() + (opt.linetag ? ('</' + opt.linetag + '>') : ''));
					prev = 'p';
				}
			}

			closeul();
			table && opt.tables !== false && builder.push('</tbody></table>');
			iscode && opt.code !== false && builder.push('</code></pre>');
			return (opt.wrap ? '<div class="markdown">' : '') + builder.join('\n').replace(/\t/g, '    ') + (opt.wrap ? '</div>' : '');
		};

	})();

});

COMPONENT('imageviewer', 'selector:.img-viewer;container:body;loading:1', function(self, config, cls) {

	var cls2 = '.' + cls;
	var isclosed = false;
	var isrendering = false;
	var events = {};

	events.keydown = function(e) {
		switch (e.which) {
			case 38:
			case 37: // prev
				self.find('button[name="prev"]').trigger('click');
				break;
			case 32: // next
			case 39:
			case 40:
				self.find('button[name="next"]').trigger('click');
				break;
			case 27: // close
				self.close();
				break;
		}
	};

	events.bind = function() {
		if (!events.is) {
			events.is = true;
			$(W).on('keydown', events.keydown);
		}
	};

	events.unbind = function() {
		if (events.is) {
			events.is = false;
			$(W).off('keydown', events.keydown);
		}
	};

	self.readonly();
	self.blind();
	self.singleton();
	self.nocompile && self.nocompile();

	self.make = function() {
		self.aclass(cls + ' hidden');
		self.append('<div class="{0}-header"><button name="close"><i class="fa fa-times"></i></button><div><b>Name</b><div class="help">Dimension</div></div></div><div class="{0}-loading hidden"><div></div></div><div class="{0}-viewer"><div class="{0}-cell"><img /></div></div>'.format(cls));
		self.resize();

		$(W).on('resize', self.resize);

		$(document.body).on('click', config.selector, function() {
			var el = $(this);
			isclosed = false;
			self.show(el);
		});

		self.event('click', 'button[name]', function() {
			var t = this;
			if (!t.disabled) {
				if (t.name === 'close')
					self.close();
			}
		});

		self.find('img').on('load', function() {
			isrendering = false;
			self.loading(false);
		});
	};

	self.close = function() {
		isclosed = true;
		isrendering = false;
		$('html,body').rclass(cls + '-noscroll');
		self.aclass('hidden');
		events.unbind();
	};

	self.loading = function(is) {

		if (!config.loading)
			return;

		var el = self.find(cls2 + '-loading');
		if (is) {
			el.rclass('hidden', is);
			return;
		}

		setTimeout(function() {
			el.aclass('hidden');
		}, 500);
	};

	self.show = function(name, url) {

		if (isrendering || !url)
			return;

		self.loading(true);
		isrendering = true;
		isclosed = false;

		var image = new Image();
		//image.crossOrigin = 'anonymous';
		image.src = url;
		image.onload = function() {

			var img = this;
			var ratio;

			var w = image.width;
			var h = image.height;
			var tw = WW - 80;
			var th = WH - 140;

			if (w > h) {
				ratio = w / h;

				if (w > tw)
					w = tw;

				h = w / ratio >> 0;

				if (h > th) {
					h = th;
					w = h * ratio >> 0;
				}

			} else {

				ratio = h / w;

				if (h > th)
					h = th;

				w = h / ratio >> 0;

				if (w > tw) {
					w = tw;
					h = w * ratio >> 0;
				}
			}

			if (isclosed)
				return;

			events.bind();
			self.find('img').attr('src', img.src).attr('width', w).attr('height', h);
			self.find('.help').html(img.width + 'x' + img.height + 'px');
			self.find('b').html(name);
			self.rclass('hidden');
			$('html,body').aclass(cls + '-noscroll');
		};
	};

	self.resize = function() {
		var viewer = self.find(cls2 + '-viewer');
		var loading = self.find(cls2 + '-loading');
		var css = {};
		css.height = WH - 45;
		css.width = WW;
		viewer.css(css);
		loading.css(css);
	};

});

COMPONENT('layout', 'space:1;border:0;parent:window;margin:0;remember:1;autoresize:1', function(self, config, cls) {

	var cls2 = '.' + cls;
	var cache = {};
	var drag = {};
	var s = {};
	var events = {};
	var istop2 = false;
	var isbottom2 = false;
	var isright2 = false;
	var loaded = false;
	var resizecache = '';
	var settings;
	var prefkey = '';
	var prefexpire = '1 month';
	var isreset = false;
	var layout = null;

	self.readonly();

	self.init = function() {
		var obj;
		if (W.OP)
			obj = W.OP;
		else
			obj = $(W);
		obj.on('resize', function() {
			for (var i = 0; i < M.components.length; i++) {
				var com = M.components[i];
				if (com.name === 'layout' && com.dom.offsetParent && com.$ready && !com.$removed && com.config.autoresize)
					com.resize();
			}
		});
	};

	self.make = function() {

		self.aclass(cls);
		self.find('> section').each(function() {
			var el = $(this);
			var type = el.attrd('type');

			if (type.charAt(type.length - 1) === '2') {
				type = type.substring(0, type.length - 1);

				switch (type) {
					case 'top':
						istop2 = true;
						break;
					case 'bottom':
						isbottom2 = true;
						break;
					case 'right':
						isright2 = true;
						break;
				}
			}
			el.aclass(cls + '-' + type + ' hidden ui-layout-section');
			el.after('<div class="{0}-resize-{1} {0}-resize" data-type="{1}"></div>'.format(cls, type));
			el.after('<div class="{0}-lock hidden" data-type="{1}"></div>'.format(cls, type));
			s[type] = el;
		});

		self.find('> .{0}-resize'.format(cls)).each(function() {
			var el = $(this);
			s[el.attrd('type') + 'resize'] = el;
		});

		self.find('> .{0}-lock'.format(cls)).each(function() {
			var el = $(this);
			s[el.attrd('type') + 'lock'] = el;
		});

		var tmp = self.find('> script');
		if (tmp.length) {
			self.rebind(tmp.html(), true);
			tmp.remove();
		}

		events.bind = function() {
			var el = self.element;
			el.bind('mousemove', events.mmove);
			el.bind('mouseup', events.mup);
			el.bind('mouseleave', events.mup);
		};

		events.unbind = function() {
			var el = self.element;
			el.unbind('mousemove', events.mmove);
			el.unbind('mouseup', events.mup);
			el.unbind('mouseleave', events.mup);
		};

		events.mdown = function(e) {

			var target = $(e.target);
			var type = target.attrd('type');
			var w = self.width();
			var h = self.height();
			var m = 2; // size of line

			self.element.find('iframe').css('pointer-events', 'none');

			drag.cur = self.element.offset();
			drag.cur.top -= 10;
			drag.cur.left -= 8;
			drag.offset = target.offset();
			drag.el = target;
			drag.x = e.pageX;
			drag.y = e.pageY;
			drag.horizontal = type === 'left' || type === 'right' ? 1 : 0;
			drag.type = type;
			drag.plusX = 10;
			drag.plusY = 10;

			var ch = cache[type];
			var offset = 0;
			var min = ch.minsize ? (ch.minsize.value - 1) : 0;

			target.aclass(cls + '-drag');

			switch (type) {
				case 'top':
					drag.min = min || (ch.size - m);
					drag.max = (h - (cache.bottom ? s.bottom.height() : 0) - 50);
					break;
				case 'right':
					offset = w;
					drag.min = (cache.left ? s.left.width() : 0) + 50;
					drag.max = offset - (min || ch.size);
					break;
				case 'bottom':
					offset = h;
					drag.min = (cache.top ? s.top.height() : 0) + 50;
					drag.max = offset - (min || ch.size);
					break;
				case 'left':
					drag.min = min || (ch.size - m);
					drag.max = w - (cache.right ? s.right.width() : 0) - 50;
					break;
			}

			events.bind();
		};

		events.mmove = function(e) {
			if (drag.horizontal) {
				var x = drag.offset.left + (e.pageX - drag.x) - drag.plusX - drag.cur.left;

				if (x < drag.min)
					x = drag.min + 1;

				if (x > drag.max)
					x = drag.max - 1;

				drag.el.css('left', x + 'px');

			} else {
				var y = drag.offset.top + (e.pageY - drag.y) - drag.plusY;

				if (y < drag.min)
					y = drag.min + 1;
				if (y > drag.max)
					y = drag.max - 1;

				drag.el.css('top', (y - drag.cur.top) + 'px');
			}
		};

		events.mup = function() {

			self.element.find('iframe').css('pointer-events', '');

			var offset = drag.el.offset();
			var d = WIDTH();
			var pk = prefkey + '_' + layout + '_' + drag.type + '_' + d;

			drag.el.rclass(cls + '-drag');

			if (drag.horizontal) {

				offset.left -= drag.cur.left;

				if (offset.left < drag.min)
					offset.left = drag.min;

				if (offset.left > drag.max)
					offset.left = drag.max;

				var w = offset.left - (drag.offset.left - drag.cur.left);

				if (!isright2 && drag.type === 'right')
					w = w * -1;

				drag.el.css('left', offset.left);
				w = s[drag.type].width() + w;
				s[drag.type].css('width', w);
				config.remember && PREF.set(pk, w, prefexpire);

			} else {

				offset.top -= drag.cur.top;

				if (offset.top < drag.min)
					offset.top = drag.min;
				if (offset.top > drag.max)
					offset.top = drag.max;

				drag.el.css('top', offset.top);

				var h = offset.top - (drag.offset.top - drag.cur.top);
				if (drag.type === 'bottom' || drag.type === 'preview')
					h = h * -1;

				h = s[drag.type].height() + h;
				s[drag.type].css('height', h);
				config.remember && PREF.set(pk, h, prefexpire);
			}

			events.unbind();
			self.refresh();
			config.resizepanel && EXEC(config.resizepanel, drag.type, s);
		};

		self.find('> ' + cls2 + '-resize').on('mousedown', events.mdown);
	};

	self.lock = function(type, b) {
		var el = s[type + 'lock'];
		el && el.tclass('hidden', b == null ? b : !b);
	};

	self.rebind = function(code, noresize) {
		code = code.trim();
		prefkey = 'L' + HASH(code);
		resizecache = '';
		settings = new Function('return ' + code)();
		!noresize && self.resize();
	};

	var getSize = function(display, data) {

		var obj = data[display];
		if (obj)
			return obj;

		switch (display) {
			case 'md':
				return getSize('lg', data);
			case 'sm':
				return getSize('md', data);
			case 'xs':
				return getSize('sm', data);
		}

		return data;
	};

	self.resize = function() {

		if (self.dom.offsetParent == null) {
			setTimeout(self.resize, 100);
			return;
		}

		if (settings == null)
			return;

		var d = WIDTH();
		var el = self.parent(config.parent);
		var width = el.width();
		var height = el.height();
		var key = d + 'x' + width + 'x' + height;

		if (resizecache === key)
			return;

		var tmp = layout ? settings[layout] : settings;

		if (tmp == null) {
			WARN('j-Layout: layout "{0}" not found'.format(layout));
			tmp = settings;
		}

		var size = getSize(d, tmp);
		var keys = Object.keys(s);

		height -= config.margin;
		resizecache = key;
		self.css({ width: width, height: height });

		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			el = s[key];
			self.update(key, size[key] ? size[key] : settings[key]);
		}

		config.resize && EXEC(config.resize, d, width, height);
		config.resizepanel && EXEC(config.resizepanel, '', s);
	};

	var parseSize = function(val, size) {
		var str = typeof(val) === 'string';
		var obj = { raw : str ? val.parseFloat() : val, percentage: str ? val.charAt(val.length - 1) === '%' : false };
		obj.value = obj.percentage ? ((((size / 100) * obj.raw) >> 0) - config.space) : obj.raw;
		return obj;
	};

	self.reset = function() {
		isreset = true;
		resizecache = '';
		self.resize();
	};

	self.layout = function(name) {

		if (name == null)
			name = '';

		if (layout != name) {
			layout = name;
			resizecache = '';
			self.resize();
		}
	};

	self.update = function(type, opt) {

		if (opt == null)
			return;

		if (typeof(opt) === 'string')
			opt = opt.parseConfig();

		if (s[type] == null)
			return;

		var el = s[type];
		var css = {};
		var is = 0;
		var size = null;
		var d = WIDTH();

		var c = cache[type];
		if (c == null)
			c = cache[type] = {};

		var w = self.width();
		var h = self.height();
		var pk = prefkey + '_' + layout + '_' + type + '_' + d;
		var cached = PREF.get(pk, prefexpire);

		if (isreset) {
			cached && PREF.set(pk); // remove value
			cached = 0;
		}

		c.minsize = opt.minwidth ? parseSize(opt.minwidth, w) : opt.minsize ? parseSize(opt.minsize, w) : 0;

		var def = getSize(d, settings);
		var width = (opt.size || opt.width) || (def[type] ? def[type].width : 0);
		var height = (opt.size || opt.height) || (def[type] ? def[type].height : 0);

		if (width && (type === 'left' || type === 'right')) {
			size = parseSize(width, w);
			c.size = size.value;
			css.width = cached ? cached : size.value;
			is = 1;
		}

		c.minsize = opt.minheight ? parseSize(opt.minheight, w) : opt.minsize ? parseSize(opt.minsize, w) : 0;
		if (height && (type === 'top' || type === 'bottom')) {
			size = parseSize(height, h);
			c.size = size.value;
			css.height = (cached ? cached : size.value);
			is = 1;
		}

		if (opt.show == null)
			opt.show = true;

		el.tclass('hidden', !opt.show);
		c.show = !!opt.show;
		c.resize = opt.resize == null ? false : !!opt.resize;
		el.tclass(cls + '-resizable', c.resize);
		s[type + 'resize'].tclass('hidden', !c.show || !c.resize);

		is && el.css(css);
		setTimeout2(self.ID + 'refresh', self.refresh, 50);
	};

	var getWidth = function(el) {
		return el.hclass('hidden') ? 0 : el.width();
	};

	var getHeight = function(el) {
		return el.hclass('hidden') ? 0 : el.height();
	};

	self.refresh = function() {

		var top = 0;
		var bottom = 0;
		var right = 0;
		var left = 0;
		var hidden = 'hidden';
		var top2 = 0;
		var bottom2 = 0;
		var space = 2;
		var topbottomoffset = 0;
		var right2visible = isright2 && !s.right.hclass(hidden);

		if (s.top)
			top = top2 = getHeight(s.top);

		if (s.bottom)
			bottom = bottom2 = getHeight(s.bottom);

		var width = self.width() - (config.border * 2);
		var height = self.height() - (config.border * 2);

		if (istop2) {
			topbottomoffset++;
			top2 = 0;
		}

		if (isbottom2) {
			topbottomoffset--;
			bottom2 = 0;
		}

		if (s.left && !s.left.hclass(hidden)) {
			var cssleft = {};
			space = top && bottom ? 2 : top || bottom ? 1 : 0;
			cssleft.left = 0;
			cssleft.top = istop2 ? config.border : (top ? (top + config.space) : 0);
			cssleft.height = isbottom2 ? (height - top2 - config.border) : (height - top2 - bottom2 - (config.space * space));
			cssleft.height += topbottomoffset;
			s.left.css(cssleft);
			cssleft.width = s.left.width();
			s.leftlock.css(cssleft);
			delete cssleft.width;
			left = s.left.width();
			cssleft.left = s.left.width();
			s.leftresize.css(cssleft);
			s.leftresize.tclass(hidden, !s.left.hclass(cls + '-resizable'));
		}

		if (s.right && !s.right.hclass(hidden)) {
			right = s.right.width();
			space = top && bottom ? 2 : top || bottom ? 1 : 0;
			var cssright = {};
			cssright.left = right2visible ? (getWidth(s.left) + config.border + config.space) : (width - right);
			cssright.top = istop2 ? config.border : (top ? (top + config.space) : 0);
			cssright.height = isbottom2 ? (height - top2 - config.border) : (height - top2 - bottom2 - (config.space * space));
			cssright.height += topbottomoffset;
			s.right.css(cssright);
			cssright.width = s.right.width();
			s.rightlock.css(cssright);
			delete cssright.width;

			if (right2visible)
				cssright.left += s.right.width();
			else
				cssright.left = width - right - 2;

			s.rightresize.css(cssright);
			s.rightresize.tclass(hidden, !s.right.hclass(cls + '-resizable'));
		}

		if (s.top) {
			var csstop = {};
			space = left ? config.space : 0;
			csstop.left = istop2 ? (left + space) : 0;

			if (right2visible && istop2)
				csstop.left += getWidth(s.right) + config.space;

			space = left && right ? 2 : left || right ? 1 : 0;
			csstop.width = istop2 ? (width - right - left - (config.space * space)) : width;
			csstop.top = 0;
			s.top.css(csstop);
			s.topresize.css(csstop);
			csstop.height = s.top.height();
			s.toplock.css(csstop);
			delete csstop.height;
			csstop.top = s.top.height();
			s.topresize.css(csstop);
			s.topresize.tclass(hidden, !s.top.hclass(cls + '-resizable'));
		}

		if (s.bottom) {
			var cssbottom = {};
			cssbottom.top = height - bottom;
			space = left ? config.space : 0;
			cssbottom.left = isbottom2 ? (left + space) : 0;

			if (right2visible && isbottom2)
				cssbottom.left += getWidth(s.right) + config.space;

			space = left && right ? 2 : left || right ? 1 : 0;
			cssbottom.width = isbottom2 ? (width - right - left - (config.space * space)) : width;
			s.bottom.css(cssbottom);
			cssbottom.height = s.bottom.height();
			s.bottomlock.css(cssbottom);
			delete cssbottom.height;
			cssbottom.top = cssbottom.top - 2;
			s.bottomresize.css(cssbottom);
			s.bottomresize.tclass(hidden, !s.bottom.hclass(cls + '-resizable'));
		}

		var space = left && right ? 2 : left ? 1 : right ? 1 : 0;
		var css = {};
		css.left = left ? left + config.space : 0;

		if (right2visible)
			css.left += getWidth(s.right) + config.space;

		css.width = (width - left - right - (config.space * space));
		css.top = top ? top + config.space : 0;

		space = top && bottom ? 2 : top || bottom ? 1 : 0;
		css.height = height - top - bottom - (config.space * space);

		s.main && s.main.css(css);
		s.mainlock && s.mainlock.css(css);

		self.element.SETTER('*', 'resize');

		if (loaded == false) {
			loaded = true;
			self.rclass('invisible');
		}

		isreset = false;
	};

	self.setter = function(value) {
		self.layout(value);
	};

});

COMPONENT('notifybar', 'timeout:5000', function(self, config, cls) {

	self.singleton();
	self.readonly();
	self.nocompile && self.nocompile();
	self.history = [];

	var cls2 = '.' + cls;
	var body, buttons, prevtype, timeout, currentindex = 0;

	self.make = function() {
		self.aclass(cls + ' hidden');
		self.append('<div class="{0}-controls"><button name="prev" disabled><i class="fa fa-angle-left"></i></button><button name="next" disabled><i class="fa fa-angle-right"></i></button></div><div class="{0}-body">OK</div>'.format(cls));
		self.event('click', cls2 + '-body', self.hide);
		self.event('click', 'button', function() {
			self[this.name]();
		});
		body = self.find(cls2 + '-body');
		buttons = self.find('button');
	};

	self.hide = function() {
		self.aclass('hidden');
	};

	self.next = function() {
		currentindex++;
		self.draw(config.timeout * 2);
	};

	self.prev = function() {
		currentindex--;
		self.draw(config.timeout * 2);
	};

	self.show = function() {
		currentindex = self.history.length - 1;
		if (currentindex >= 0) {
			self.draw(config.timeout);
			self.check();
		}
	};

	self.draw = function(delay) {

		prevtype && self.rclass(cls + '-' + prevtype);
		var msg = self.history[currentindex];

		if (msg.body.indexOf('fa-') === -1)
			msg.body = '<i class="fa fa-' + (msg.type === 1 ? 'check-circle' : msg.type === 2 ? 'warning' : 'info-circle') + '"></i>' + msg.body;

		body.html(msg.body);
		buttons[0].disabled = !self.history.length || currentindex === 0;
		buttons[1].disabled = !self.history.length || currentindex >= (self.history.length - 1);
		prevtype = msg.type;
		self.aclass(cls + '-' + prevtype);
		self.rclass('hidden');

		timeout && clearTimeout(timeout);
		timeout = setTimeout(self.hide, delay);
	};

	self.success = function(body) {
		currentindex = self.history.push({ type: 1, body: body }) - 1;
		self.draw(config.timeout);
		self.check();
	};

	self.info = function(body) {
		currentindex = self.history.push({ type: 3, body: body }) - 1;
		self.draw(config.timeout);
		self.check();
	};

	self.warning = function(body) {
		currentindex = self.history.push({ type: 2, body: body }) - 1;
		self.draw(config.timeout);
		self.check();
	};

	self.response = function(message, callback, response) {

		var fn;

		if (typeof(message) === 'function') {
			response = callback;
			fn = message;
			message = null;
		} else if (typeof(callback) === 'function')
			fn = callback;
		else {
			response = callback;
			fn = null;
		}

		if (response instanceof Array) {
			var builder = [];
			for (var i = 0; i < response.length; i++) {
				var err = response[i].error;
				err && builder.push(err);
			}
			self.warning(builder.join('<br />'));
		} else if (typeof(response) === 'string')
			self.warning(response);
		else {
			message && self.success(message);
			fn && fn(response);
		}
	};

	self.info = function(body) {
		currentindex = self.history.push({ type: 3, body: body }) - 1;
		self.draw(config.timeout);
		self.check();
	};

	self.check = function() {
		if (self.history.length > 20)
			self.history.unshift();
	};

});

COMPONENT('invisible', function(self) {

	self.readonly();
	self.blind();

	self.make = function() {
		setTimeout(function() {
			self.rclass('invisible');
		}, 300);
	};
});

COMPONENT('builder', 'url:https://builder.totaljs.com', function(self, config, cls) {

	var self = this;
	var opt = {};
	var iframe;

	self.singleton();
	self.readonly();

	self.make = function() {

		var dom = document.createElement('DIV');
		$('body').prepend(dom);

		self.replace($(dom));

		self.aclass(cls + ' hidden');
		self.css({ position: 'absolute', 'z-index': 100, left: 0, top: common.electron ? (common.ismac ? 28 : 1) : 0, right: 0, bottom: 0 });
		self.on('resize', self.resize);
		$(W).on('resize', self.resize);

		$(W).on('message', function(e) {
			e = e.originalEvent;
			var data = e.data;

			if (typeof(data) === 'string')
				data = PARSE(data);

			switch (data.TYPE) {
				case 'builder_shortcut':
					SETTER('shortcuts/exec', data.key);
					break;
				case 'builder_close':
					self.hide();
					break;
				case 'builder_ready':
					WAIT(function() {
						return iframe && iframe.contentWindow;
					}, function() {
						iframe.contentWindow.postMessage(STRINGIFY(opt.data), '*');
						SETTER('loading/hide', 500);
					});
					break;
				case 'builder_save':
					delete data.TYPE;
					opt.callback && opt.callback(data, self.hide);
					break;
			}
		});
	};

	self.hide = function() {
		if (iframe) {
			self.find('iframe').remove();
			iframe = null;
			self.aclass('hidden');
		}
	};

	self.make_iframe = function() {
		iframe && self.find('iframe').remove();
		self.append('<iframe src="{0}?darkmode={1}" scrolling="no" frameborder="0"></iframe>'.format(config.url, $('body').hclass('td') ? 1 : 0));
		iframe = self.find('iframe')[0];
		self.resize();
		self.rclass('hidden');
	};

	self.resize = function() {

		if (!iframe)
			return;

		var css = {};
		css.width = WW;
		css.height = WH - self.css('top').parseInt();
		self.css(css);
		$(iframe).css(css);
	};

	self.load = function(data, callback) {
		opt.data = (data ? data.substring(0, data.length - 1) + ',' : '{') + '"user":' + JSON.stringify({ id: user.id, name: user.name, uid: location.origin + '/' + code.data.id, url: location.origin, email: user.email, sa: user.sa }) + '}';
		opt.callback = callback;
		self.make_iframe();
		self.rclass('hidden');
	};

});

COMPONENT('audio', function(self) {

	var can = false;
	var volume = 0.5;

	self.items = [];
	self.readonly();
	self.singleton();

	self.make = function() {
		var audio = document.createElement('audio');
		if (audio.canPlayType && audio.canPlayType('audio/mpeg').replace(/no/, ''))
			can = true;
	};

	self.play = function(url) {

		if (!can)
			return;

		var audio = new window.Audio();

		audio.src = url;
		audio.volume = volume;
		audio.play();

		audio.onended = function() {
			audio.$destroy = true;
			self.cleaner();
		};

		audio.onerror = function() {
			audio.$destroy = true;
			self.cleaner();
		};

		audio.onabort = function() {
			audio.$destroy = true;
			self.cleaner();
		};

		self.items.push(audio);
		return self;
	};

	self.cleaner = function() {
		var index = 0;
		while (true) {
			var item = self.items[index++];
			if (item === undefined)
				return self;
			if (!item.$destroy)
				continue;
			item.pause();
			item.onended = null;
			item.onerror = null;
			item.onsuspend = null;
			item.onabort = null;
			item = null;
			index--;
			self.items.splice(index, 1);
		}
	};

	self.stop = function(url) {

		if (!url) {
			self.items.forEach(function(item) {
				item.$destroy = true;
			});
			return self.cleaner();
		}

		var index = self.items.findIndex('src', url);
		if (index === -1)
			return self;
		self.items[index].$destroy = true;
		return self.cleaner();
	};

	self.setter = function(value) {

		if (value === undefined)
			value = 0.5;
		else
			value = (value / 100);

		if (value > 1)
			value = 1;
		else if (value < 0)
			value = 0;

		volume = value ? +value : 0;
		for (var i = 0, length = self.items.length; i < length; i++) {
			var a = self.items[i];
			if (!a.$destroy)
				a.volume = value;
		}
	};
});

COMPONENT('largeform', 'zindex:12;padding:30;scrollbar:1;scrolltop:1;style:1', function(self, config, cls) {

	var cls2 = '.' + cls;
	var csspos = {};
	var nav = false;
	var init = false;

	if (!W.$$largeform) {

		W.$$largeform_level = W.$$largeform_level || 1;
		W.$$largeform = true;

		$(document).on('click', cls2 + '-button-close', function() {
			SET($(this).attrd('path'), '');
		});

		var resize = function() {
			setTimeout2(self.name, function() {
				for (var i = 0; i < M.components.length; i++) {
					var com = M.components[i];
					if (com.name === 'largeform' && !HIDDEN(com.dom) && com.$ready && !com.$removed)
						com.resize();
				}
			}, 200);
		};

		ON('resize2', resize);

		$(document).on('click', cls2 + '-container', function(e) {

			if (e.target === this) {
				var com = $(this).component();
				if (com && com.config.closeoutside) {
					com.set('');
					return;
				}
			}

			var el = $(e.target);
			if (el.hclass(cls + '-container') && !el.hclass(cls + '-style-2')) {
				var form = el.find(cls2);
				var c = cls + '-animate-click';
				form.aclass(c);
				setTimeout(function() {
					form.rclass(c);
				}, 300);
			}
		});
	}

	self.readonly();
	self.submit = function() {
		if (config.submit)
			self.EXEC(config.submit, self.hide, self.element);
		else
			self.hide();
	};

	self.cancel = function() {
		config.cancel && self.EXEC(config.cancel, self.hide);
		self.hide();
	};

	self.hide = function() {
		if (config.independent)
			self.hideforce();
		self.esc(false);
		self.set('');
	};

	self.icon = function(value) {
		var el = this.rclass2('fa');
		value.icon && el.aclass(value.icon.indexOf(' ') === -1 ? ('fa fa-' + value.icon) : value.icon);
	};

	self.resize = function() {

		if (self.hclass('hidden'))
			return;

		var padding = isMOBILE ? 0 : config.padding;
		var ui = self.find(cls2);

		csspos.height = WH - (config.style == 1 ? (padding * 2) : padding);
		csspos.top = padding;
		ui.css(csspos);

		var el = self.find(cls2 + '-title');
		var th = el.height();
		var w = ui.width();

		if (w > WW)
			w = WW;

		csspos = { height: csspos.height - th, width: w };

		if (nav)
			csspos.height -= nav.height();

		self.find(cls2 + '-body').css(csspos);
		self.scrollbar && self.scrollbar.resize();
		self.element.SETTER('*', 'resize');
	};

	self.make = function() {

		$(document.body).append('<div id="{0}" class="hidden {4}-container invisible"><div class="{4}" style="max-width:{1}px"><div data-bind="@config__text span:value.title__change .{4}-icon:@icon" class="{4}-title"><button name="cancel" class="{4}-button-close{3}" data-path="{2}"><i class="fa fa-times"></i></button><i class="{4}-icon"></i><span></span></div><div class="{4}-body"></div></div>'.format(self.ID, config.width || 800, self.path, config.closebutton == false ? ' hidden' : '', cls));

		var scr = self.find('> script');
		self.template = scr.length ? scr.html().trim() : '';
		scr.length && scr.remove();

		var el = $('#' + self.ID);
		var body = el.find(cls2 + '-body')[0];

		while (self.dom.children.length) {
			var child = self.dom.children[0];
			if (child.tagName === 'NAV') {
				nav = $(child);
				body.parentNode.appendChild(child);
			} else
				body.appendChild(child);
		}

		self.rclass('hidden invisible');
		self.replace(el, true);

		if (config.scrollbar)
			self.scrollbar = SCROLLBAR(self.find(cls2 + '-body'), { visibleY: config.visibleY, orientation: 'y' });

		if (config.style === 2)
			self.aclass(cls + '-style-2');

		self.event('scroll', function() {
			EMIT('scroll', self.name);
			EMIT('reflow', self.name);
		});

		self.event('click', 'button[name]', function() {
			var t = this;
			switch (t.name) {
				case 'submit':
					self.submit(self.hide);
					break;
				case 'cancel':
					!t.disabled && self[t.name](self.hide);
					break;
			}
		});

		config.enter && self.event('keydown', 'input', function(e) {
			e.which === 13 && !self.find('button[name="submit"]')[0].disabled && setTimeout(self.submit, 800);
		});
	};

	self.configure = function(key, value, init, prev) {
		if (!init) {
			switch (key) {
				case 'width':
					value !== prev && self.find(cls2).css('max-width', value + 'px');
					break;
				case 'closebutton':
					self.find(cls2 + '-button-close').tclass('hidden', value !== true);
					break;
			}
		}
	};

	self.esc = function(bind) {
		if (bind) {
			if (!self.$esc) {
				self.$esc = true;
				$(W).on('keydown', self.esc_keydown);
			}
		} else {
			if (self.$esc) {
				self.$esc = false;
				$(W).off('keydown', self.esc_keydown);
			}
		}
	};

	self.esc_keydown = function(e) {
		if (e.which === 27 && !e.isPropagationStopped()) {
			var val = self.get();
			if (!val || config.if === val) {
				e.preventDefault();
				e.stopPropagation();
				self.hide();
			}
		}
	};

	self.hideforce = function() {
		if (!self.hclass('hidden')) {
			self.aclass('hidden');
			self.release(true);
			self.find(cls2).rclass(cls + '-animate');
			W.$$largeform_level--;
		}
	};

	var allowscrollbars = function() {
		$('html').tclass(cls + '-noscroll', !!$(cls2 + '-container').not('.hidden').length);
	};

	self.setter = function(value) {

		setTimeout2(self.name + '-noscroll', allowscrollbars, 50);

		var isHidden = value !== config.if;

		if (self.hclass('hidden') === isHidden) {
			if (!isHidden) {
				config.reload && self.EXEC(config.reload, self);
				config.default && DEFAULT(self.makepath(config.default), true);
				config.scrolltop && self.scrollbar && self.scrollbar.scrollTop(0);
			}
			return;
		}

		setTimeout2(cls, function() {
			EMIT('reflow', self.name);
		}, 10);

		if (isHidden) {
			if (!config.independent)
				self.hideforce();
			return;
		}

		if (self.template) {
			var is = self.template.COMPILABLE();
			self.find(cls2).append(self.template);
			self.template = null;
			is && COMPILE();
		}

		if (W.$$largeform_level < 1)
			W.$$largeform_level = 1;

		W.$$largeform_level++;

		self.css('z-index', W.$$largeform_level * config.zindex);
		self.rclass('hidden');

		self.release(false);
		config.scrolltop && self.scrollbar && self.scrollbar.scrollTop(0);

		config.reload && self.EXEC(config.reload, self);
		config.default && DEFAULT(self.makepath(config.default), true);

		if (!isMOBILE && config.autofocus) {
			setTimeout(function() {
				self.find(typeof(config.autofocus) === 'string' ? config.autofocus : 'input[type="text"],select,textarea').eq(0).focus();
			}, 1000);
		}

		self.resize();

		setTimeout(function() {
			self.rclass('invisible');
			self.find(cls2).aclass(cls + '-animate');
			if (!init && isMOBILE) {
				$('body').aclass('hidden');
				setTimeout(function() {
					$('body').rclass('hidden');
				}, 50);
			}
			init = true;
		}, 300);

		// Fixes a problem with freezing of scrolling in Chrome
		setTimeout2(self.ID, function() {
			self.css('z-index', (W.$$largeform_level * config.zindex) + 1);
		}, 500);

		config.closeesc && self.esc(true);
	};
});

COMPONENT('approve', 'cancel:Cancel', function(self, config, cls) {

	var cls2 = '.' + cls;
	var events = {};
	var buttons;
	var oldcancel;

	self.readonly();
	self.singleton();
	self.nocompile && self.nocompile();

	self.make = function() {

		self.aclass(cls + ' hidden');
		self.html('<div><div class="{0}-body"><span class="{0}-close"><i class="fa fa-times"></i></span><div class="{0}-content"></div><div class="{0}-buttons"><button data-index="0"></button><button data-index="1"></button></div></div></div>'.format(cls));

		buttons = self.find(cls2 + '-buttons').find('button');

		self.event('click', 'button', function() {
			self.hide(+$(this).attrd('index'));
		});

		self.event('click', cls2 + '-close', function() {
			self.callback = null;
			self.hide(-1);
		});

		self.event('click', function(e) {
			var t = e.target.tagName;
			if (t !== 'DIV')
				return;
			var el = self.find(cls2 + '-body');
			el.aclass(cls + '-click');
			setTimeout(function() {
				el.rclass(cls + '-click');
			}, 300);
		});
	};

	events.keydown = function(e) {
		var index = e.which === 13 ? 0 : e.which === 27 ? 1 : null;
		if (index != null) {
			self.find('button[data-index="{0}"]'.format(index)).trigger('click');
			e.preventDefault();
			e.stopPropagation();
			events.unbind();
		}
	};

	events.bind = function() {
		$(W).on('keydown', events.keydown);
	};

	events.unbind = function() {
		$(W).off('keydown', events.keydown);
	};

	self.show = function(message, a, b, fn) {

		if (typeof(b) === 'function') {
			fn = b;
			b = config.cancel;
		}

		if (M.scope)
			self.currscope = M.scope();

		self.callback = fn;

		var icon = a.match(/"[a-z0-9-\s]+"/);
		if (icon) {

			var tmp = icon + '';
			if (tmp.indexOf(' ') == -1)
				tmp = 'fa fa-' + tmp;

			a = a.replace(icon, '').trim();
			icon = '<i class="{0}"></i>'.format(tmp.replace(/"/g, ''));
		} else
			icon = '';

		var color = a.match(/#[0-9a-f]+/i);
		if (color)
			a = a.replace(color, '').trim();

		buttons.eq(0).css('background-color', color || '').html(icon + a);

		if (oldcancel !== b) {
			oldcancel = b;
			buttons.eq(1).html(b);
		}

		self.find(cls2 + '-content').html(message.replace(/\n/g, '<br />'));
		$('html').aclass(cls + '-noscroll');
		self.rclass('hidden');
		events.bind();
		self.aclass(cls + '-visible', 5);
		document.activeElement && document.activeElement.blur();
	};

	self.hide = function(index) {

		if (!index) {
			self.currscope && M.scope(self.currscope);
			self.callback && self.callback(index);
		}

		self.rclass(cls + '-visible');
		events.unbind();
		setTimeout2(self.id, function() {
			$('html').rclass(cls + '-noscroll');
			self.aclass('hidden');
		}, 1000);
	};
});