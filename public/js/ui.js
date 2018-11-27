COMPONENT('editor', function(self, config) {

	var editor = null;
	var skip = false;
	var markers = {};
	var fn = {};
	var autocomplete;

	fn.lastIndexOf = function(str, chfrom) {
		for (var i = chfrom; i > 0; i--) {
			var c = str.substring(i - 1, i);
			for (var j = 1; j < arguments.length; j++)
				if (c === arguments[j])
					return i;
		}
		return 0;
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

	self.configure = function(key, value, init) {
		if (init)
			return;

		switch (key) {
			case 'mode':
				editor.setOption('mode', value === 'totaljs' ? { name: 'totaljs', base: 'htmlmixed' } : value);
				editor.setOption('lint', value === 'javascript' || value === 'xml' || value === 'totaljs' || value === 'html' ? { esversion: 6, expr: true, evil: true, unused: true } : false);
				break;
			case 'disabled':
				self.tclass('ui-disabled', value);
				editor.setOption('readOnly', value);
				editor.refresh();
				break;
		}
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

			if (config.mode === 'totaljs' || config.mode === 'html') {

				var cm = editor;
				var cur = cm.getCursor();
				var line = cm.getLine(cur.line);
				var index = fn.lastIndexOf(line, cur.ch, '\t', '>', ' ');

				if (index === -1)
					return CodeMirror.Pass;

				var html = line.substring(index, cur.ch);
				if ((/(div|span|table|b|i|a|img|td|tr|thead|tfoot|tbody|section|figure|section)+(\.[a-z0-9-_])*/).test(html) || (/(^|\s)\.[a-z0-9-_]*/).test(html)) {
					var cls = html.split('.');
					if (!cls[0]) {
						if (cls[1].substring(0, 2) === 'fa')
							cls[0] = 'i';
						else
							cls[0] = 'div';
					}
					var tag = cls[0] === 'img' ? '<img src="" alt="" />' : ('<{0}{1}></{0}>'.format(cls[0], cls[1] ? (' class="' + cls[1] + '"') : ''));
					cm.replaceRange(line.substring(0, index) + tag, { line: cur.line, ch: 0 }, { line: cur.line, ch: cur.cr });
					cm.doc.setCursor({ line: cur.line, ch: index + (cls[0] === 'img' ? (tag.indexOf('"') + 1) : (tag.indexOf('>') + 1)) });
					return;
				}
			}
			return CodeMirror.Pass;
		};

		var findmatch = function() {
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
			return CodeMirror.pass;
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
		options.gutters = ['CodeMirror-lint-markers', 'GutterColor'];
		options.foldGutter = true;
		options.highlightSelectionMatches = { annotateScrollbar: true, delay: 100 };
		options.phrases = {};
		// options.showTrailingSpace = true;
		options.matchTags = { bothTags: true };
		// options.autoCloseTags = true;
		options.scrollPastEnd = true;
		options.lint = true;
		options.autoCloseBrackets = true;
		options.extraKeys = { 'Alt-F': 'findPersistent', 'Esc': clearsearch, 'Cmd-D': findmatch, 'Ctrl-D': findmatch, 'Cmd-S': shortcut('save'), 'Ctrl-S': shortcut('save'), 'Alt-W': shortcut('close'), 'Cmd-W': shortcut('close'), 'F5': shortcut('F5'), Tab: tabulator, 'Alt-Tab': shortcut('nexttab') };

		if (common.electron) {
			options.extraKeys['Cmd-Tab'] = shortcut('nexttab');
			options.extraKeys['Ctrl-Tab'] = shortcut('nexttab');
		}

		var GutterColor = function(color) {
			var marker = document.createElement('div');
			var css = marker.style;
			css.color = color;
			css.position = 'absolute';
			css.left = '-10px';
			css.top = '-1px';
			marker.innerHTML = '●';
			return marker;
		};

		editor = CodeMirror(container[0], options);
		self.editor = editor;

		self.event('contextmenu', function(e) {
			e.preventDefault();
			e.stopPropagation();
			config.contextmenu && EXEC(config.contextmenu, e, editor);
		});

		var cache_selection = {};

		editor.on('keydown', function(editor, e) {
			if (e.shiftKey && e.ctrlKey && (e.keyCode === 40 || e.keyCode === 38)) {
				var tmp = editor.getCursor();
				cache_selection.line = tmp.line + (e.keyCode === 40 ? 1 : -1);
				cache_selection.ch = tmp.ch;
				editor.doc.addSelection(cache_selection);
				e.stopPropagation();
				e.preventDefault();
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

		var REGHEXCOLOR = /#[a-f0-9]{6}(;|"|'|$)/i;

		var prerender_colors = function() {
			var lines = editor.getValue().split('\n');
			editor.doc.clearGutter('GutterColor');
			for (var i = 0; i < lines.length; i++) {
				var color = lines[i].match(REGHEXCOLOR);
				if (color)
					editor.setGutterMarker(i, 'GutterColor', GutterColor(color.toString().replace(/;|'|"|,/g, '')));
			}
		};

		var snippets = {};
		var cache_snip = {};
		var snippetsoptions = { completeSingle: false, hint: function(cm) {
			var cur = cm.getCursor();
			var start = snippets.index;
			var end = cur.ch;
			var tabs = ''.padLeft(snippets.index, '\t');

			var index = snippets.text.lastIndexOf('.');
			if (index > -1) {
				index++;
				snippets.text = snippets.text.substring(index);
				start += index;
				end += index;
			} else
				index = 0;

			cache_snip.list = FUNC.snippets(config.type, snippets.text, tabs, cur.line, autocomplete, index);
			cache_snip.from = CodeMirror.Pos(cur.line, start);
			cache_snip.to = CodeMirror.Pos(cur.line, end);
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
			var reader = new FileReader();

			if (files[0].type.substring(0, 4) === 'text')
				reader.readAsText(files[0]);
			else
				reader.readAsDataURL(files[0]);

			reader.onload = function () {
				editor.doc.replaceSelection(reader.result);
			};
		});

		var cache_sync = { from: {}, to: {} };

		editor.on('change', function(a, b) {

			if (b.origin !== 'setValue' && code.SYNC) {
				cache_sync.from.line = b.from.line;
				cache_sync.from.ch = b.from.ch;
				cache_sync.to.line= b.to.line;
				cache_sync.to.ch = b.to.ch;
				cache_sync.text = b.text;
				EXEC(config.sync, cache_sync);
			}

			setTimeout2('EditorGutterColor', prerender_colors, 500);

			if (config.disabled || !can[b.origin])
				return;

			setTimeout2(self.id, function() {

				var cur = editor.getCursor();
				var line = editor.getLine(cur.line);
				var index = fn.lastIndexOf(line, cur.ch, ' ', '>', '\t');

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
		cache_mt_css.className = 'cm-user';
		cache_mt_css.title = id;

		markers[id] = editor.markText(cache_mt_f, cache_mt_t, cache_mt_css);
	};

	self.copy = function(history) {
		return editor.doc.copy(history);
	};

	self.paste = function(doc) {
		editor.swapDoc(doc);
		editor.refresh();
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

		var words = (value || '').match(/[a-zA-Z0-9_-]{3,}/g);
		if (words) {
			var unique = {};
			for (var i = 0; i < words.length; i++)
				unique[words[i].toLowerCase()] = words[i];
			autocomplete = Object.keys(unique);
			for (var i = 0; i < autocomplete.length; i++) {
				var s = autocomplete[i];
				autocomplete[i] = { search: s, code: unique[s] };
			}
		}

		setTimeout(function() {
			editor.refresh();
		}, 200);

		setTimeout(function() {
			editor.refresh();
		}, 1000);

		setTimeout(function() {
			editor.refresh();
		}, 2000);

		self.resize();
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
});

COMPONENT('exec', function(self, config) {
	self.readonly();
	self.blind();
	self.make = function() {
		self.event('click', config.selector || '.exec', function(e) {
			var el = $(this);

			var attr = el.attrd('exec');
			var path = el.attrd('path');
			var href = el.attrd('href');

			if (el.attrd('prevent') === 'true') {
				e.preventDefault();
				e.stopPropagation();
			}

			attr && EXEC(attr, el, e);
			href && NAV.redirect(href);

			if (path) {
				var val = el.attrd('value');
				if (val) {
					var v = GET(path);
					SET(path, new Function('value', 'return ' + val)(v), true);
				}
			}
		});
	};
});

COMPONENT('tree', 'selected:selected;autoreset:false', function(self, config) {

	var cache = null;
	var counter = 0;
	var expanded = {};
	var selindex = -1;

	self.template = Tangular.compile('<div class="item{{ if children }} expand{{ fi }}" data-index="{{ $pointer }}" title="{{ name }}"><i class="icon fa-{{ if children }}folder fa{{ if isopen }}-open fa{{ fi }}{{ else }}file-o far{{ fi }}"></i><span class="options"><i class="fa fa-cog"></i></span><div>{{ name }}</div></div>');
	self.readonly();

	self.make = function() {
		self.aclass('ui-tree');

		self.event('click', '.item', function() {
			var el = $(this);
			var index = +el.attr('data-index');
			self.select(index);
		});

		var ddfile = null;
		var ddtarget = null;

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
					var val = input.val().replace(/[^a-z0-9.\-_]/gi, '');
					var index = +input.closest('.item').attrd('index');
					var item = cache[index];
					var newname = item.path.substring(0, item.path.length - item.name.length) + val;
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

		self.event('click', '.options', function(e) {
			e.preventDefault();
			e.stopPropagation();
			var el = $(this);
			var index = +el.closest('.item').attrd('index');
			config.options && EXEC(config.options, cache[index], el);
		});
	};

	self.select = function(index, noeval) {
		var cls = config.selected;
		var el = self.find('[data-index="{0}"]'.format(index));
		if (el.hclass('expand')) {
			var parent = el.parent();
			parent.tclass('show');
			var is = expanded[index] = parent.hclass('show');
			el.find('.icon').tclass('fa-folder', !is).tclass('fa-folder-open', is);
			!noeval && config.exec && EXEC(config.exec, cache[index], true, is);
		} else {
			!el.hclass(cls) && self.find('.' + cls).rclass(cls);
			el.aclass(cls);
			!noeval && config.exec && EXEC(config.exec, cache[index], false);
			selindex = index;
		}
	};

	self.selectpath = function(path) {
		var index = FUNC.treeindex(self.get(), path);
		if (index !== -1) {
			self.expand(index);
			self.select(index);
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

	self.renderchildren = function(builder, item, level) {
		builder.push('<div class="children children{0}" data-level="{0}">'.format(level));
		item.children.forEach(function(item) {
			counter++;
			item.$pointer = counter;
			cache[counter] = item;
			item.isopen = !!(expanded[counter] && item.children);
			builder.push('<div class="node{0}">'.format(item.isopen ? ' show' : ''));
			builder.push(self.template(item));
			item.children && self.renderchildren(builder, item, level + 1);
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

		counter = 0;
		cache = {};

		value && value.forEach(function(item) {
			counter++;
			item.$pointer = counter;
			cache[counter] = item;
			item.isopen = !!(expanded[counter] && item.children);
			builder.push('<div class="node{0}">'.format(item.isopen ? ' show' : '') + self.template(item));
			if (item.children)
				self.renderchildren(builder, item, 1);
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
		self.event('click', config.selector, function() {
			if (!config.disabled) {
				var el = $(this);
				if (!el.hclass(config.class)) {
					var val = el.attrd('value');
					if (config.exec)
						EXEC(config.exec, val);
					else
						self.set(val);
				}
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

COMPONENT('datagrid', 'checkbox:true;colwidth:150;rowheight:27;limit:80;filterlabel:Filter;numbering:;height:auto;bottom:90;resize:true;reorder:true;sorting:true;boolean:true,on,yes;pluralizepages:# pages,# page,# pages,# pages;pluralizeitems:# items,# item,# items,# items;remember:true;highlight:false;autoselect:false;buttonapply:Apply;allowtitles:false;fullwidth_xs:true', function(self, config) {

	var opt = { filter: {}, filtercache: {}, filtervalues: {}, scroll: false, selected: {}, operation: '' };
	var header, vbody, footer, vcontainer, hcontainer, varea, hbody, vscrollbar, vscrollbararea, hscrollbar, hscrollbararea, ecolumns, isecolumns = false;
	var Theadercol = Tangular.compile('<div class="dg-hcol dg-col-{{ index }}{{ if sorting }} dg-sorting{{ fi }}" data-index="{{ index }}">{{ if sorting }}<i class="dg-sort fa fa-sort"></i>{{ fi }}<div class="dg-label{{ alignheader }}"{{ if labeltitle }} title="{{ labeltitle }}"{{ fi }}{{ if reorder }} draggable="true"{{ fi }}>{{ label | raw }}</div>{{ if filter }}<div class="dg-filter{{ alignfilter }}{{ if filterval != null && filterval !== \'\' }} dg-filter-selected{{ fi }}">{{ if options }}<select class="dg-filter-input" data-name="{{ name }}" name="{{ name }}{{ index }}"><option value="">{{ filter }}</option></select>{{ else }}<input autocomplete="off" type="text" placeholder="{{ filter }}" class="dg-filter-input" name="{{ name }}{{ index }}" data-name="{{ name }}" value="{{ filterval }}" />{{ fi }}</div>{{ else }}<div class="dg-filter-empty">&nbsp;</div>{{ fi }}</div>');
	var isIE = (/msie|trident/i).test(navigator.userAgent);
	var isredraw = false;
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
			if (b < 2)
				b = 2;
			self.el.html('<div style="height:{0}px"></div>{2}<div style="height:{1}px"></div>'.format(t, b, h.join('')));
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
			}
		};

		self.update = function(rows, noscroll) {

			if (noscroll != true)
				self.el.prop('scrollTop', 0);

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
	self.nocompile && self.nocompile();

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
			case 'click':
				self.tclass('dg-clickable', !!value);
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

	self.make = function() {

		self.IDCSS = GUID(5);
		self.aclass('dg dg-' + self.IDCSS);

		var scr = self.find('script');
		var meta = scr.html();
		meta && self.rebind(meta);

		var pagination = '';

		if (config.exec)
			pagination = '<div class="dg-footer hidden"><div class="dg-pagination-items hidden-xs"></div><div class="dg-pagination"><button name="page-first" disabled><i class="fa fa-angle-double-left"></i></button><button name="page-prev" disabled><i class="fa fa-angle-left"></i></button><div><input type="text" name="page" maxlength="5" class="dg-pagination-input" /></div><button name="page-next" disabled><i class="fa fa-angle-right"></i></button><button name="page-last" disabled><i class="fa fa-angle-double-right"></i></button></div><div class="dg-pagination-pages"></div></div>';

		self.html('<div class="dg-columns hidden"><div class="dg-columns-body"></div><button class="dg-columns-button" name="columns-apply"><i class="fa fa-columns"></i>{1}</button></div><div class="dg-scrollbar-container-v hidden"><div class="dg-scrollbar-v"></div></div><div class="dg-h-container"><div class="dg-h-body"><div class="dg-v-container"><div class="dg-v-area"><div class="dg-header"></div><div class="dg-v-body"></div></div></div></div></div><div class="dg-scrollbar-container-h hidden"><div class="dg-scrollbar-h"></div></div>{0}'.format(pagination, config.buttonapply));

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

		// Gets a top/left position of vertical/horizontal scrollbar
		pos.vscroll = vscrollbararea.css('top').parseInt();
		pos.hscroll = hscrollbararea.css('left').parseInt();

		var sv = { is: false };
		var sh = { is: false };

		vscrollbararea.on('mousedown', function(e) {
			var el = $(e.target);
			if (el.hclass('dg-scrollbar-v')) {
				sv.is = true;
				sv.y = self.element.offset().top + pos.vscroll;
				sv.h = vscrollbararea.height();
				sv.s = vbody[0].scrollHeight;
				e.preventDefault();
				e.stopPropagation();
			} else if (el.hclass('dg-scrollbar-container-v')) {
				sv.is = false;
				sv.y = self.element.offset().top + pos.vscroll;
				sv.h = vscrollbararea.height();
				var y = (e.pageY - sv.y);
				var p = (y / sv.h) * 100;
				var scroll = ((vbody[0].scrollHeight - opt.height) / 100) * p;
				var plus = (p / 100) * 30;
				vbody.prop('scrollTop', Math.ceil(scroll + plus));
				e.preventDefault();
				e.stopPropagation();
			}
		});

		hscrollbararea.on('mousedown', function(e) {
			var el = $(e.target);
			if (el.hclass('dg-scrollbar-h')) {
				sh.is = true;
				sh.x = self.element.offset().left + pos.hscroll;
				sh.w = hscrollbararea.width();
				sh.s = hbody[0].scrollWidth;
				e.preventDefault();
				e.stopPropagation();
			} else if (el.hclass('dg-scrollbar-container-h')) {
				sh.is = false;
				sh.w = hscrollbararea.width();
				var x = e.offsetX;
				var p = (x / sh.w) * 100;
				var scroll = ((hbody[0].scrollWidth - opt.width2) / 100) * p;
				var plus = (p / 100) * 30;
				hbody.prop('scrollLeft', Math.ceil(scroll + plus));
				e.preventDefault();
				e.stopPropagation();
			}
		});

		$(window).on('mousemove', function(e) {
			var p, scroll;
			if (sv.is) {
				var y = (e.pageY - sv.y);
				p = (y / sv.h) * 100;
				scroll = ((vbody[0].scrollHeight - opt.height) / 100) * (p > 100 ? 100 : p);
				vbody.prop('scrollTop', Math.ceil(scroll));
			} else if (sh.is) {
				var x = (e.pageX - sh.x);
				p = (x / sh.w) * 100;
				scroll = ((hbody[0].scrollWidth - opt.width2) / 100) * (p > 100 ? 100 : p);
				hbody.prop('scrollLeft', Math.ceil(scroll));
			}
		});

		vbody.on('scroll', function(e) {
			var el = e.target;
			var p = ((el.scrollTop / (el.scrollHeight - opt.height)) * 100) >> 0;

			if (p > 100)
				p = 100;

			var plus = (p / 100) * 30;
			p = (((opt.height - pos.vscroll) / 100) * p);
			var oy = (p + plus);
			if (oy < 0)
				oy = 0;
			vscrollbar.css('top', (oy >> 0) + 'px');
			isecolumns && self.applycolumns();
		});

		hbody.on('scroll', function(e) {
			var el = e.target;
			var p = ((el.scrollLeft / (el.scrollWidth - opt.width2)) * 100) >> 0;

			if (p > 100)
				p = 100;

			var plus = (p / 100) * 30;
			p = (((opt.width2 - pos.hscroll) / 100) * p);
			var ox = (p - plus);
			if (ox < 0)
				ox = 0;
			hscrollbar.css('left', (ox >> 0) + 'px');
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
					builder.push('<div><label><input type="checkbox" value="{0}"{1} /><span>{2}</span></label></div>'.format(col.id, col.hidden ? '' : ' checked', col.text));
				}

				ecolumns.find('.dg-columns-body').html(builder.join(''));
				ecolumns.rclass(cls);
				isecolumns = true;
			}
		});

		self.event('click', '.dg-row', function(e) {
			var el = $(this);
			var type = e.target.nodeName;
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
								self.selected = row;
								elrow.aclass(cls);
							}
							config.click && EXEC(config.click, row, self, elrow, target);
						}
					}
					break;
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

			var offset = self.element.offset().left;
			r.el = el;
			r.offset = (hbody.scrollLeft() - offset) + 10;

			var prev = el.prev();
			r.min = (prev.length ? prev.css('left').parseInt() : 0) + 50;

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

		$(window).on('mouseup', function(e) {
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
				case 'dragleave':
				case 'dragexit':
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

			if (config.exec)
				self.operation(opt.operation);
			else
				self.refreshfilter(true);
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
				config.highlight && config.click && EXEC(config.click, null, self);
				return;
			}

			self.selected = row;

			var elrow = opt.cluster.el.find('.dg-row[data-index="{0}"]'.format(index));
			if (elrow && config.highlight) {
				opt.cluster.el.find('.' + cls).rclass(cls);
				elrow.aclass(cls);
			}

			config.click && EXEC(config.click, row, self, elrow, null);
		};

		self.event('change', '.dg-checkbox-input', function() {
			var t = this;
			var val = t.value;
			if (val === '-1') {
				if (t.checked) {
					opt.selected = {};
					for (var i = 0; i < opt.rows.length; i++)
						opt.selected[opt.rows[i].ROW] = 1;
				} else
					opt.selected = {};
				self.scrolling();
			} else if (t.checked)
				opt.selected[val] = 1;
			else
				delete opt.selected[val];

			if (config.checked) {
				if (config.checked.indexOf('.') === -1)
					EXEC(config.checked, self.checked(), self);
				else
					SET(config.checked, self.checked());
			}
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
					var row = opt.rows[+$(this).closest('.dg-row').attrd('index')];
					config.button && EXEC(config.button, this.name, row, self, e);
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
		EXEC(config.exec, type, keys.length ? opt.filter : null, opt.sort && opt.sort.sort ? [(opt.sort.name + ' ' + (opt.sort.sort === 1 ? 'asc' : 'desc'))] : null, value.page, self);

		switch (type) {
			case 'sort':
				self.redrawsorting();
				break;
		}
	};

	function align(type) {
		return type === 1 ? 'center' : type === 2 ? 'right' : type;
	}

	self.rebind = function(code) {

		var type = typeof(code);

		if (type === 'string') {
			code = code.trim();
			self.gridid = 'dg' + HASH(code);
		} else
			self.gridid = 'dg' + HASH(JSON.stringify(code));

		var cache = config.remember ? CACHE(self.gridid) : null;
		var cols = type === 'string' ? new Function('return ' + code)() : CLONE(code);

		opt.search = false;

		for (var i = 0; i < cols.length; i++) {
			var col = cols[i];

			col.id = GUID(5);
			col.realindex = i;

			if (!col.name)
				col.name = col.id;

			if (col.hidden)
				col.hidden = FN(col.hidden)(col) === true;

			if (col.options) {
				!col.otext && (col.otext = 'text');
				!col.ovalue && (col.ovalue = 'value');
			}

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

			if (col.alignfilter)
				col.alignfilter = ' ' + align(col.alignfilter);

			if (col.alignheader)
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

			if (col.template)
				col.template = Tangular.compile((col.template.indexOf('<button') === -1 ? '<div class="dg-value">{0}</div>' : '{0}').format(col.template));
			else
				col.template = Tangular.compile(('<div class="dg-value"' + (config.allowtitles ? ' title="{{ {0} }}"' : '') + '>{{ {0} }}</div>').format(col.name + (col.format ? ' | format({0}) '.format(typeof(col.format) === 'string' ? ('\'' + col.format + '\'') : col.format) : '')));

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
		}

		cols.quicksort('index');
		opt.cols = cols;
		self.rebindcss();
		hbody && hbody.prop('scrollLeft', 0);
		vbody && vbody.prop('scrollTop', 0);
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

		self.style(css);

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
			column += Theadercol({ index: -1, label: '<div class="center"><input type="checkbox" value="-1" class="dg-checkbox-input" /></div>', filter: false, name: '$', sorting: false });

		for (var i = 0; i < opt.cols.length; i++) {
			var col = opt.cols[i];
			if (!col.hidden) {
				var obj = { index: i, label: col.header(col), filter: col.filter, reorder: config.reorder, sorting: col.sorting, name: col.name, alignfilter: col.alignfilter, alignheader: col.alignheader, filterval: opt.filtervalues[col.id], labeltitle: col.title || col.text, options: col.options ? col.options instanceof Array ? col.options : GET(col.options) : null };
				opt.width += col.width;
				config.resize && resize.push('<span class="dg-resize" style="left:{0}px" data-index="{1}"></span>'.format(opt.width - 39, i));
				column += Theadercol(obj);
			}
		}

		column += '<div class="dg-hcol"></div><div class="dg-btn-columns"><i class="fa fa-columns"></i></div>';
		header.html(resize.join('') + Trow.format(0, column));

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
	};

	self.redraw = function(update) {
		var x = hbody.prop('scrollLeft');
		var y = vbody.prop('scrollTop');
		isredraw = update ? 2 : 1;
		self.refreshfilter();
		isredraw = 0;
		hbody.prop('scrollLeft', x);
		vbody.prop('scrollTop', y);
	};

	self.renderrows = function(rows, noscroll) {

		opt.rows = rows;

		var output = [];
		var Trow = '<div class="dg-row dg-row-{0}{3}" data-index="{2}">{1}</div>';
		var Tcol = '<div class="dg-col dg-col-{0}{2}">{1}</div>';
		var plus = 0;

		if (config.exec) {
			// pagination
			var val = self.get();
			plus = (val.page - 1) * val.limit;
		}

		for (var i = 0, length = rows.length; i < length; i++) {

			var row = rows[i];
			var column = '';

			if (config.numbering !== false)
				column += Tcol.format(-1, '<div class="dg-number">{0}</div>'.format(i + 1 + plus));

			if (config.checkbox)
				column += Tcol.format(-1, '<div class="dg-checkbox"><input type="checkbox" value="{0}" class="dg-checkbox-input" /></div>'.format(row.ROW));

			for (var j = 0; j < opt.cols.length; j++) {
				var col = opt.cols[j];
				if (!col.hidden)
					column += Tcol.format(j, col.template(row), col.align);
			}

			column += '<div class="dg-col">&nbsp;</div>';
			column && output.push(Trow.format(i + 1, column, i, self.selected === row ? ' dg-selected' : ''));
		}

		var min = ((opt.height / config.rowheight) >> 0) + 1;
		var is = output.length < min;

		if (is) {
			for (var i = output.length; i < min + 1; i++)
				output.push('<div class="dg-row-empty">&nbsp;</div>');
		}

		if (noscroll) {
			self.tclass('dg-noscroll', is);
			hbody.prop('scrollLeft', 0);
			vbody.prop('scrollTop', 0);
		}

		opt.render = output;
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

		CACHE(self.gridid, cache, '1 month');
	};

	self.rows = function() {
		return opt.rows.slice(0);
	};

	self.resize = function() {

		if (!opt.cols)
			return;

		switch (config.height) {
			case 'auto':
				var el = self.element;
				opt.height = WH - (el.offset().top + config.bottom) - (config.exec ? 30 : 0);
				vbody.css('height', opt.height);
				break;
			case 'parent':
				var el = self.element.parent();
				opt.height = el.height() - config.bottom - (config.exec ? 30 : 0);
				vbody.css('height', opt.height);
				break;
			default:
				vbody.css('height', config.height);
				opt.height = config.height;
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

		setTimeout2(self.ID, function() {
			var vb = vbody[0];
			var hb = hbody[0];

			// Scrollbars
			vscrollbararea.tclass('hidden', isMOBILE || (vb.scrollHeight - vb.clientHeight) < 5);
			hscrollbararea.tclass('hidden', isMOBILE || (hb.scrollWidth - hb.clientWidth) < 5);

			// Empty rows
			var min = ((opt.height / config.rowheight) >> 0) + 1;
			var is = (opt.rows ? opt.rows.length : 0) < min;
			self.tclass('dg-noscroll', is);

			// rescroll
			vbody.prop('scrollTop', vbody.prop('scrollTop') - 1);
			hbody.prop('scrollLeft', hbody.prop('scrollLeft') - 1);
		}, 500);
	};

	self.refreshfilter = function(useraction) {

		// Get data
		var obj = self.get() || EMPTYARRAY;
		var items = (obj instanceof Array ? obj : obj.items) || EMPTYARRAY;
		var output = [];

		if (isredraw) {
			if (isredraw === 2) {
				if (config.checked) {
					if (config.checked.indexOf('.') === -1)
						EXEC(config.checked, self.checked(), self);
					else
						SET(config.checked, self.checked());
				}
			}
		} else {
			opt.selected = {};
			config.checkbox && header.find('.dg-checkbox-input').prop('checked', false);
			if (config.checked) {
				if (config.checked.indexOf('.') === - 1)
					EXEC(config.checked, EMPTYARRAY, self);
				else
					SET(config.checked, EMPTYARRAY);
			}
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
				vbody.prop('scrollTop', 0);
				if (useraction)	{
					var sl = hbody.prop('scrollLeft');
					hbody.prop('scrollLeft', sl ? sl - 1 : 0);
				} else
					hbody.prop('scrollLeft', 0);
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
		});
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

		footer.find('input').val(value.page);
		footer.find('.dg-pagination-pages').html(value.pages.pluralize.apply(value.pages, config.pluralizepages));
		footer.find('.dg-pagination-items').html(value.count.pluralize.apply(value.count, config.pluralizeitems));
		footer.rclass('hidden');
	};

	self.setter = function(value) {

		if (!opt.cols)
			return;

		if (config.exec && value == null) {
			self.operation('refresh');
			return;
		}

		opt.selected = {};
		opt.scroll = true;

		self.applycolumns();
		self.refreshfilter();
		self.redrawpagination();

		!config.exec && self.rendercols();

		if (opt.cluster)
			return;

		config.exec && self.rendercols();
		opt.cluster = new Cluster(vbody);
		opt.cluster.scroll = self.scrolling;
		opt.render && opt.cluster.update(opt.render);
		self.aclass('dg-visible');
	};

	self.scrolling = function() {
		config.checkbox && setTimeout2(self.ID, function() {
			vbody.find('.dg-checkbox-input').each(function() {
				this.checked = opt.selected[this.value] == 1;
			});
		}, 80, 10);
	};

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
					val2 = opt.filtercache[column] = filter.split(/\/\|\\|,/).trim();
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
					val2 = opt.filtercache[column] = typeof(filter) === 'string' ? config.boolean.indexOf(filter.replace(/\s/g, '')) !== -1 : filter;
				if (val2 !== val)
					return false;
			} else if (val instanceof Date) {

				val.setHours(0);
				val.setMinutes(0);

				if (val2 == null) {

					val2 = filter.trim().replace(/\s-\s/, '/').split(/\/|\||\\|,/).trim();
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
		var arr = Object.keys(opt.selected);
		var output = [];
		var model = self.get();
		var rows = model instanceof Array ? model : model.items;
		for (var i = 0; i < arr.length; i++) {
			var index = +arr[i];
			output.push(rows[index]);
		}
		return output;
	};

	self.parseDate = function(val, second) {
		var index = val.indexOf('.');
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
				return [new Date(+val, 0, 1), new Date(+val + 1, 0	, 1)];
		} else if (val.indexOf('.', index + 1) === -1) {
			var a = val.split('.');
			var m, y, d, special;
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

			var tmp = new Date(y, m, d);
			if (special)
				tmp.YYYYMM = true;
			return tmp;
		}
		index = val.indexOf('-');
		if (index !== -1 && val.indexOf('-', index + 1) === -1) {
			var a = val.split('-');
			var m, y, d, special;

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

			var tmp = new Date(y, m, d);
			if (special)
				tmp.YYYYMM = true;
			return tmp;
		}
		return val.parseDate();
	};

	self.parseNumber = function(val) {
		var arr = [];
		var num = val.replace(/\s-\s/, '/').replace(/\s/g, '').replace(/,/g, '.').split(/\/|\|\s-\s|\\/).trim();
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
		el.height(WH - self.find('.ui-panel-header').height());
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
		container.scrollTop(0);
		self.rclass('hidden');
		self.release(false);
		setTimeout(self.resize, 100);

		config.reload && EXEC(config.reload, self);
		config.default && DEFAULT(config.default, true);

		if (!isMOBILE && config.autofocus) {
			var el = self.find(config.autofocus === true ? 'input[type="text"],select,textarea' : config.autofocus);
			el.length && el[0].focus();
		}

		setTimeout(function() {
			container.scrollTop(0);
			self.aclass('ui-panel-animate');
		}, 300);

		// Fixes a problem with freezing of scrolling in Chrome
		setTimeout2(self.id, function() {
			self.css('z-index', (W.$$panel_level * config.zindex) + 1);
		}, 1000);
	};
});

COMPONENT('importer', function(self, config) {

	var init = false;
	var clid = null;
	var content = '';

	self.readonly();

	self.make = function() {
		var scr = self.find('script');
		content = scr.length ? scr.html() : '';
	};

	self.reload = function(recompile) {
		config.reload && EXEC(config.reload);
		recompile && COMPILE();
	};

	self.setter = function(value) {

		if (config.if !== value) {
			if (config.cleaner && init && !clid)
				clid = setTimeout(self.clean, config.cleaner * 60000);
			return;
		}

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

	self.configure = function(key, value, init) {

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

	var ul;
	var is = false;

	self.make = function() {
		self.aclass('ui-menu hidden');
		self.append('<ul></ul>');
		ul = self.find('ul');

		self.event('touchstart mousedown', 'li', function() {
			self.callback(self.items[$(this).index()]);
			self.hide();
		});

		$(window).on('scroll', function() {
			is && self.hide();
		});

		self.event('scroll', function() {
			is && self.hide();
		});

		$(document).on('touchstart mousedown', function(e) {
			if (is && (!self.target || (self.target !== e.target && !self.target.contains(e.target))))
				self.hide();
		});
	};

	self.showxy = function(x, y, items, callback) {

		var builder = [];

		self.target = null;
		self.items = items;
		self.callback = callback;

		for (var i = 0; i < items.length; i++) {
			var item = items[i];
			builder.push('<li{2}>{0}{1}</li>'.format(item.icon ? '<i class="fa fa-{0}"></i>'.format(item.icon) : '', item.name, item.icon ? '' : ' class="ui-menu-nofa"'));
		}

		ul.html(builder.join(''));

		if (!is) {
			self.rclass('hidden');
			self.aclass('ui-menu-visible', 100);
			is = true;
		}

		var opt = {};
		opt.left = x;
		opt.top = y;

		self.element.css(opt);
	};

	self.show = function(orientation, element, items, callback, offsetX, offsetY) {

		var target = $(element);
		var builder = [];
		var tmp = element instanceof jQuery ? element[0] : element;

		self.items = items;
		self.callback = callback;

		if (is && self.target === tmp) {
			self.hide();
			return;
		}

		self.target = tmp;

		for (var i = 0; i < items.length; i++) {
			var item = items[i];
			builder.push('<li{2}>{0}{1}</li>'.format(item.icon ? '<i class="fa fa-{0}"></i>'.format(item.icon) : '', item.name, item.icon ? '' : ' class="ui-menu-nofa"'));
		}

		ul.html(builder.join(''));

		if (!is) {
			self.rclass('hidden');
			self.aclass('ui-menu-visible', 100);
			is = true;
		}

		var opt = {};
		var w = self.width();
		var offset = target.offset();

		switch (orientation) {
			case 'left':
				opt.left = offset.left;
				break;
			case 'center':
				opt.left = Math.ceil((offset.left - w / 2) + (target.innerWidth() / 2));
				break;
			case 'right':
				opt.left = (offset.left - w) + target.innerWidth();
				break;
		}

		opt.top = offset.top + target.innerHeight() + 10 + (offsetY || 0);

		if (offsetX)
			opt.left += offsetX;

		self.element.css(opt);
	};

	self.hide = function() {
		is = false;
		self.target = null;
		self.aclass('hidden');
		self.rclass('ui-menu-visible');
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
		var arr = self.get(config.datasource);
		if (arr.length) {
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
		self.append('<div></div>');
	};

	self.show = function() {
		clearTimeout(pointer);
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

	var show = true;
	var callback;

	self.readonly();
	self.blind();
	self.nocompile && self.nocompile();

	self.make = function() {
		self.aclass('ui-snackbar hidden');
		self.append('<div><span class="ui-snackbar-dismiss"></span><span class="ui-snackbar-icon"></span><div class="ui-snackbar-body"></div></div>');
		self.event('click', '.ui-snackbar-dismiss', function() {
			self.hide();
			callback && callback();
		});
	};

	self.hide = function() {
		clearTimeout2(self.ID);
		self.rclass('ui-snackbar-visible');
		setTimeout(function() {
			self.aclass('hidden');
		}, 1000);
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

		self.find('.ui-snackbar-icon').html('<i class="fa {0}"></i>'.format(icon || 'fa-info-circle'));
		self.find('.ui-snackbar-body').html(message).attr('title', message);
		self.find('.ui-snackbar-dismiss').html(button || config.button);

		if (show) {
			self.rclass('hidden');
			setTimeout(function() {
				self.aclass('ui-snackbar-visible');
			}, 50);
		}

		clearTimeout2(self.ID);
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
	self.nocompile && self.nocompile();

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

		if (!ws || sending || !queue.length || ws.readyState !== 1) {
			callback && callback();
			return;
		}

		sending = true;
		var async = queue.splice(0, 3);
		async.wait(function(item, next) {
			ws.send(item);
			setTimeout(next, 5);
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

	function onClose() {
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

		self.aclass('ui-features-layer hidden');
		self.append('<div class="ui-features"><div class="ui-features-search"><span><i class="fa fa-search"></i></span><div><input type="text" placeholder="{0}" class="ui-features-search-input" /></div></div><div class="ui-features-container"><ul></ul></div></div>'.format(config.placeholder));

		container = self.find('ul');
		input = self.find('input');
		search = self.find('.ui-features');
		scroller = self.find('.ui-features-container');

		self.event('touchstart mousedown', 'li[data-index]', function(e) {
			self.callback && self.callback(self.items[+this.getAttribute('data-index')]);
			self.hide();
			e.preventDefault();
			e.stopPropagation();
		});

		$(document).on('touchstart mousedown', function(e) {
			is && !$(e.target).hclass('ui-features-search-input') && self.hide(0);
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
						self.callback(self.items[+sel.attr('data-index')]);
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
			var val = el.attr('data-search');
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

	self.show = function(items, callback) {

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
			self.aclass('ui-features-visible');
		}, 100);

		!isMOBILE && setTimeout(function() {
			input.focus();
		}, 500);

		is = true;
		$('html,body').aclass('ui-features-noscroll');
	};

	self.hide = function(sleep) {
		if (!is)
			return;
		clearTimeout(timeout);
		timeout = setTimeout(function() {
			self.aclass('hidden').rclass('ui-features-visible');
			self.callback = null;
			self.target = null;
			is = false;
			$('html,body').rclass('ui-features-noscroll');
		}, sleep ? sleep : 100);
	};
});

COMPONENT('statusform', function(self, config) {

	var el;

	self.singleton();

	self.make = function() {
		el = self.find('.statusform-item');
		self.event('keydown', 'input', function(e) {
			if (e.which === 13) {
				var input = $(this);
				EXEC(config.exec, input.parent().attrd('name'), input.val().toLowerCase().replace(/[^a-z0-9.-_]/gi, ''));
				self.set('');
			}
		});
	};

	self.setter = function(value) {
		el.aclass('hidden');
		if (value) {
			var input = el.filter('[data-name="{0}"]'.format(value)).rclass('hidden').find('input').val('');
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
	var cache = {};

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

COMPONENT('infopanel', '', function(self, config) {

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

	self.show = function(el, render, offsetX, offsetY) {

		var main = self.element;

		if (!(el instanceof jQuery))
			el = $(el);

		clearTimeout(tshide);

		if (cache === el[0]) {
			self.hide(true);
			return;
		}

		clearTimeout(tsshow);
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

			main.css({ left: off.left - (offsetX || 0), top: off.top - h - (offsetY || 0) - el.height() });
			main.rclass('invisible');
		}, 50);
	};

});