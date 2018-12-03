// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE
(function(mod) {
	mod(CodeMirror);
})(function(CodeMirror) {

	CodeMirror.defineOption('rulers', false, function(cm, val) {
		if (cm.state.rulerDiv) {
			cm.state.rulerDiv.parentElement.removeChild(cm.state.rulerDiv);
			cm.state.rulerDiv = null;
			cm.off('refresh', drawRulers);
		}

		if (val && val.length) {
			cm.state.rulerDiv = cm.display.lineSpace.parentElement.insertBefore(document.createElement('div'), cm.display.lineSpace);
			cm.state.rulerDiv.className = 'CodeMirror-rulers';
			drawRulers(cm);
			cm.on('refresh', drawRulers);
		}
	});

	function drawRulers(cm) {
		cm.state.rulerDiv.textContent = '';
		var val = cm.getOption('rulers');
		var cw = cm.defaultCharWidth();
		var left = cm.charCoords(CodeMirror.Pos(cm.firstLine(), 0), 'div').left;
		cm.state.rulerDiv.style.minHeight = (cm.display.scroller.offsetHeight + 30) + 'px';
		for (var i = 0; i < val.length; i++) {
			var elt = document.createElement('div');
			elt.className = 'CodeMirror-ruler';
			var col, conf = val[i];
			if (typeof(conf) == 'number') {
				col = conf;
			} else {
				col = conf.column;
				if (conf.className) elt.className += ' ' + conf.className;
				if (conf.color) elt.style.borderColor = conf.color;
				if (conf.lineStyle) elt.style.borderLeftStyle = conf.lineStyle;
				if (conf.width) elt.style.borderLeftWidth = conf.width;
			}
			elt.style.left = (left + col * cw) + 'px';
			cm.state.rulerDiv.appendChild(elt);
		}
	}
});

(function(mod) {
	mod(CodeMirror);
})(function(CodeMirror) {

	function Bar(cls, orientation, scroll) {
		var self = this;
		self.orientation = orientation;
		self.scroll = scroll;
		self.screen = self.total = self.size = 1;
		self.pos = 0;
		self.node = document.createElement('div');
		self.node.className = cls + '-' + orientation;
		self.inner = self.node.appendChild(document.createElement('div'));

		CodeMirror.on(self.inner, 'mousedown', function(e) {

			if (e.which != 1)
				return;

			CodeMirror.e_preventDefault(e);
			var axis = self.orientation == 'horizontal' ? 'pageX' : 'pageY';
			var start = e[axis], startpos = self.pos;

			function done() {
				CodeMirror.off(document, 'mousemove', move);
				CodeMirror.off(document, 'mouseup', done);
			}

			function move(e) {
				if (e.which != 1)
					return done();
				self.moveTo(startpos + (e[axis] - start) * (self.total / self.size));
			}

			CodeMirror.on(document, 'mousemove', move);
			CodeMirror.on(document, 'mouseup', done);
		});

		CodeMirror.on(self.node, 'click', function(e) {
			CodeMirror.e_preventDefault(e);
			var innerBox = self.inner.getBoundingClientRect(), where;
			if (self.orientation == 'horizontal')
				where = e.clientX < innerBox.left ? -1 : e.clientX > innerBox.right ? 1 : 0;
			else
				where = e.clientY < innerBox.top ? -1 : e.clientY > innerBox.bottom ? 1 : 0;
			self.moveTo(self.pos + where * self.screen);
		});

		function onWheel(e) {
			var moved = CodeMirror.wheelEventPixels(e)[self.orientation == 'horizontal' ? 'x' : 'y'];
			var oldPos = self.pos;
			self.moveTo(self.pos + moved);
			if (self.pos != oldPos) CodeMirror.e_preventDefault(e);
		}
		CodeMirror.on(self.node, 'mousewheel', onWheel);
		CodeMirror.on(self.node, 'DOMMouseScroll', onWheel);
	}

	Bar.prototype.setPos = function(pos, force) {
		var t = this;
		if (pos < 0)
			pos = 0;
		if (pos > t.total - t.screen)
			pos = t.total - t.screen;
		if (!force && pos == t.pos)
			return false;
		t.pos = pos;
		t.inner.style[t.orientation == 'horizontal' ? 'left' : 'top'] = (pos * (t.size / t.total)) + 'px';
		return true;
	};

	Bar.prototype.moveTo = function(pos) {
		var t = this;
		t.setPos(pos) && t.scroll(pos, t.orientation);
	};

	var minButtonSize = 10;

	Bar.prototype.update = function(scrollSize, clientSize, barSize) {
		var t = this;
		var sizeChanged = t.screen != clientSize || t.total != scrollSize || t.size != barSize;

		if (sizeChanged) {
			t.screen = clientSize;
			t.total = scrollSize;
			t.size = barSize;
		}

		var buttonSize = t.screen * (t.size / t.total);
		if (buttonSize < minButtonSize) {
			t.size -= minButtonSize - buttonSize;
			buttonSize = minButtonSize;
		}

		t.inner.style[t.orientation == 'horizontal' ? 'width' : 'height'] = buttonSize + 'px';
		t.setPos(t.pos, sizeChanged);
	};

	function SimpleScrollbars(cls, place, scroll) {
		var t = this;
		t.addClass = cls;
		t.horiz = new Bar(cls, 'horizontal', scroll);
		place(t.horiz.node);
		t.vert = new Bar(cls, 'vertical', scroll);
		place(t.vert.node);
		t.width = null;
	}

	SimpleScrollbars.prototype.update = function(measure) {
		var t = this;
		if (t.width == null) {
			var style = window.getComputedStyle ? window.getComputedStyle(t.horiz.node) : t.horiz.node.currentStyle;
			if (style)
				t.width = parseInt(style.height);
		}

		var width = t.width || 0;
		var needsH = measure.scrollWidth > measure.clientWidth + 1;
		var needsV = measure.scrollHeight > measure.clientHeight + 1;

		t.vert.inner.style.display = needsV ? 'block' : 'none';
		t.horiz.inner.style.display = needsH ? 'block' : 'none';

		if (needsV) {
			t.vert.update(measure.scrollHeight, measure.clientHeight, measure.viewHeight - (needsH ? width : 0));
			t.vert.node.style.bottom = needsH ? width + 'px' : '0';
		}

		if (needsH) {
			var l = 0; // measure.barLeft;
			t.horiz.update(measure.scrollWidth, measure.clientWidth, measure.viewWidth - (needsV ? width : 0) - l);
			t.horiz.node.style.right = needsV ? width + 'px' : '0';
			t.horiz.node.style.left = l + 'px';
		}

		return { right: needsV ? width : 0, bottom: needsH ? width : 0 };
	};

	SimpleScrollbars.prototype.setScrollTop = function(pos) {
		this.vert.setPos(pos);
	};

	SimpleScrollbars.prototype.setScrollLeft = function(pos) {
		this.horiz.setPos(pos);
	};

	SimpleScrollbars.prototype.clear = function() {
		var parent = this.horiz.node.parentNode;
		parent.removeChild(this.horiz.node);
		parent.removeChild(this.vert.node);
	};

	CodeMirror.scrollbarModel.simple = function(place, scroll) {
		return new SimpleScrollbars('CodeMirror-simplescroll', place, scroll);
	};

	CodeMirror.scrollbarModel.overlay = function(place, scroll) {
		return new SimpleScrollbars('CodeMirror-overlayscroll', place, scroll);
	};
});

WAIT('CodeMirror.defineSimpleMode', function() {
	CodeMirror.defineSimpleMode('totaljs-tags', {
		start: [
			{ regex: /@{/,          push: 'totaljs', token: 'variable-T' },
			{ regex: /{\{/,         push: 'tangular', token: 'variable-A' },
			{ regex: /@\(/,         push: 'localization', token: 'variable-L' },
			{ regex: /data-jc='/,   push: 'component', token: 'variable-J' },
			{ regex: /data-bind='/, push: 'binder', token: 'variable-B' }
		],

		tangular: [
			{ regex: /\}\}/, pop: true, token: 'variable-A' },
			{ regex: /./, token: 'variable-A' }
		],

		totaljs: [
			{ regex: /\}/, pop: true, token: 'variable-T' },
			{ regex: /./, token: 'variable-T' }
		],

		localization: [
			{ regex: /\)/, pop: true, token: 'variable-L' },
			{ regex: /./, token: 'variable-L' }
		],

		component: [
			{ regex: /'(\s|>)/, pop: false, token: 'variable-J' },
			{ regex: /./, token: 'variable-J' }
		],

		binder: [
			{ regex: /'(\s|>)/, dedent: true, token: 'variable-B' },
			{ regex: /./, token: 'variable-B' }
		]
	});

	CodeMirror.defineMode('totaljs', function(config, parserConfig) {
		var totaljs = CodeMirror.getMode(config, 'totaljs-tags');
		if (!parserConfig || !parserConfig.base)
			return totaljs;
		return CodeMirror.multiplexingMode(CodeMirror.getMode(config, parserConfig.base), { open: /(@\{|\{\{|@\()/, close: /(\}\}|\}|\))/, mode: totaljs, parseDelimiters: true });
	});

	CodeMirror.defineMIME('text/totaljs', 'totaljs');
});

WAIT('CodeMirror.defineMode', function() {
	CodeMirror.defineMode('totaljsresources', function() {
		var REG_KEY = /^[a-z0-9_\-.#]+/i;
		return {

			startState: function() {
				return { type: 0, keyword: 0 };
			},

			token: function(stream, state) {

				var m;

				if (stream.sol()) {

					var line = stream.string;
					if (line.substring(0, 2) === '//') {
						stream.skipToEnd();
						return 'comment';
					}

					state.type = 0;
				}

				m = stream.match(REG_KEY, true);
				if (m)
					return 'tag';

				if (!stream.string) {
					stream.next();
					return '';
				}

				var count = 0;

				while (true) {

					count++;
					if (count > 5000)
						break;

					var c = stream.peek();
					if (c === ':') {
						stream.skipToEnd();
						return 'def';
					}

					if (c === '(') {
						if (stream.skipTo(')')) {
							stream.eat(')');
							return 'variable-L';
						}
					}

				}

				stream.next();
				return '';
			}
		};
	});

});

(function(mod) {
	mod(CodeMirror);
})(function(CodeMirror) {

	var defaults = {
		style: 'matchhighlight',
		minChars: 2,
		delay: 100,
		wordsOnly: false,
		annotateScrollbar: false,
		showToken: false,
		trim: true
	};

	function State(options) {
		this.options = {};
		for (var name in defaults)
			this.options[name] = (options && options.hasOwnProperty(name) ? options : defaults)[name];
		this.overlay = this.timeout = null;
		this.matchesonscroll = null;
		this.active = false;
	}

	CodeMirror.defineOption('highlightSelectionMatches', false, function(cm, val, old) {
		if (old && old != CodeMirror.Init) {
			removeOverlay(cm);
			clearTimeout(cm.state.matchHighlighter.timeout);
			cm.state.matchHighlighter = null;
			cm.off('cursorActivity', cursorActivity);
			cm.off('focus', onFocus);
		}

		if (val) {
			var state = cm.state.matchHighlighter = new State(val);
			if (cm.hasFocus()) {
				state.active = true;
				highlightMatches(cm);
			} else {
				cm.on('focus', onFocus);
			}
			cm.on('cursorActivity', cursorActivity);
		}
	});

	function cursorActivity(cm) {
		var state = cm.state.matchHighlighter;
		if (state.active || cm.hasFocus())
			scheduleHighlight(cm, state);
	}

	function onFocus(cm) {
		var state = cm.state.matchHighlighter;
		if (!state.active) {
			state.active = true;
			scheduleHighlight(cm, state);
		}
	}

	function scheduleHighlight(cm, state) {
		clearTimeout(state.timeout);
		state.timeout = setTimeout(function() {
			highlightMatches(cm);
		}, state.options.delay);
	}

	function addOverlay(cm, query, hasBoundary, style) {
		var state = cm.state.matchHighlighter;
		cm.addOverlay(state.overlay = makeOverlay(query, hasBoundary, style));
		if (state.options.annotateScrollbar && cm.showMatchesOnScrollbar) {
			var searchFor = hasBoundary ? new RegExp('\\b' + query.replace(/[\\[.+*?(){|^$]/g, '\\$&') + '\\b') : query;
			state.matchesonscroll = cm.showMatchesOnScrollbar(searchFor, false, { className: 'CodeMirror-selection-highlight-scrollbar' });
		}
	}

	function removeOverlay(cm) {
		var state = cm.state.matchHighlighter;
		if (state.overlay) {
			cm.removeOverlay(state.overlay);
			state.overlay = null;
			if (state.matchesonscroll) {
				state.matchesonscroll.clear();
				state.matchesonscroll = null;
			}
		}
	}

	function highlightMatches(cm) {
		cm.operation(function() {

			var state = cm.state.matchHighlighter;
			removeOverlay(cm);

			if (!cm.somethingSelected() && state.options.showToken) {
				var re = state.options.showToken === true ? /[\w$]/ : state.options.showToken;
				var cur = cm.getCursor(), line = cm.getLine(cur.line), start = cur.ch, end = start;
				while (start && re.test(line.charAt(start - 1))) --start;
				while (end < line.length && re.test(line.charAt(end))) ++end;
				if (start < end)
					addOverlay(cm, line.slice(start, end), re, state.options.style);
				return;
			}

			var from = cm.getCursor('from'), to = cm.getCursor('to');
			if (from.line != to.line)
				return;

			if (state.options.wordsOnly && !isWord(cm, from, to))
				return;

			var selection = cm.getRange(from, to);

			if ((/\W/).test(selection))
				return;

			if (state.options.trim) selection = selection.replace(/^\s+|\s+$/g, '');
			if (selection.length >= state.options.minChars)
				addOverlay(cm, selection, false, state.options.style);
		});
	}

	function isWord(cm, from, to) {
		var str = cm.getRange(from, to);
		if (str.match(/^\w+$/) !== null) {
			if (from.ch > 0) {
				var pos = {line: from.line, ch: from.ch - 1};
				var chr = cm.getRange(pos, from);
				if (chr.match(/\W/) === null)
					return false;
			}
			if (to.ch < cm.getLine(from.line).length) {
				var pos = {line: to.line, ch: to.ch + 1};
				var chr = cm.getRange(to, pos);
				if (chr.match(/\W/) === null)
					return false;
			}
			return true;
		} else
			return false;
	}

	function boundariesAround(stream, re) {
		return (!stream.start || !re.test(stream.string.charAt(stream.start - 1))) && (stream.pos == stream.string.length || !re.test(stream.string.charAt(stream.pos)));
	}

	function makeOverlay(query, hasBoundary, style) {
		return { token: function(stream) {
			if (stream.match(query) && (!hasBoundary || boundariesAround(stream, hasBoundary)))
				return style;
			stream.next();
			stream.skipTo(query.charAt(0)) || stream.skipToEnd();
		}};
	}
});

(function(mod) {
	mod(CodeMirror);
})(function(CodeMirror) {
	CodeMirror.defineOption('showTrailingSpace', false, function(cm, val, prev) {
		if (prev == CodeMirror.Init)
			prev = false;
		if (prev && !val)
			cm.removeOverlay('trailingspace');
		else if (!prev && val) {
			cm.addOverlay({ token: function(stream) {
				for (var l = stream.string.length, i = l; i; --i) {
					if (stream.string.charCodeAt(i - 1) !== 32)
						break;
				}
				if (i > stream.pos) {
					stream.pos = i;
					return null;
				}
				stream.pos = l;
				return 'trailingspace';
			}, name: 'trailingspace' });
		}
	});
});

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
	mod(CodeMirror);
})(function(CodeMirror) {

	CodeMirror.defineOption('scrollPastEnd', false, function(cm, val, old) {
		if (old && old != CodeMirror.Init) {
			cm.off('change', onChange);
			cm.off('refresh', updateBottomMargin);
			cm.display.lineSpace.parentNode.style.paddingBottom = '';
			cm.state.scrollPastEndPadding = null;
		}
		if (val) {
			cm.on('change', onChange);
			cm.on('refresh', updateBottomMargin);
			updateBottomMargin(cm);
		}
	});

	function onChange(cm, change) {
		if (CodeMirror.changeEnd(change).line == cm.lastLine())
			updateBottomMargin(cm);
	}

	function updateBottomMargin(cm) {
		var padding = '';

		if (cm.lineCount() > 1) {
			var totalH = cm.display.scroller.clientHeight - 30;
			var lastLineH = cm.getLineHandle(cm.lastLine()).height;
			padding = (totalH - lastLineH) + 'px';
		}

		if (cm.state.scrollPastEndPadding != padding) {
			cm.state.scrollPastEndPadding = padding;
			cm.display.lineSpace.parentNode.style.paddingBottom = padding;
			cm.off('refresh', updateBottomMargin);
			cm.setSize();
			cm.on('refresh', updateBottomMargin);
		}
	}
});

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
	mod(CodeMirror);
})(function(CodeMirror) {

	var HINT_ELEMENT_CLASS = 'CodeMirror-hint';
	var ACTIVE_HINT_ELEMENT_CLASS = 'CodeMirror-hint-active';

	// This is the old interface, kept around for now to stay
	// backwards-compatible.
	CodeMirror.showHint = function(cm, getHints, options) {

		if (!getHints)
			return cm.showHint(options);

		if (options && options.async)
			getHints.async = true;

		var newOpts = { hint: getHints };
		if (options) {
			for (var prop in options)
				newOpts[prop] = options[prop];
		}
		return cm.showHint(newOpts);
	};

	CodeMirror.defineExtension('showHint', function(options) {
		options = parseOptions(this, this.getCursor('start'), options);
		var selections = this.listSelections();
		if (selections.length > 1)
			return;

		// By default, don't allow completion when something is selected.
		// A hint function can have a `supportsSelection` property to
		// indicate that it can handle selections.
		if (this.somethingSelected()) {
			if (!options.hint.supportsSelection)
				return;
			// Don't try with cross-line selections
			for (var i = 0; i < selections.length; i++) {
				if (selections[i].head.line != selections[i].anchor.line)
					return;
			}
		}

		this.state.completionActive && this.state.completionActive.close();

		var completion = this.state.completionActive = new Completion(this, options);
		if (completion.options.hint) {
			CodeMirror.signal(this, 'startCompletion', this);
			completion.update(true);
		}
	});

	function Completion(cm, options) {
		var self = this;
		self.cm = cm;
		self.options = options;
		self.widget = null;
		self.debounce = 0;
		self.tick = 0;
		self.startPos = self.cm.getCursor('start');
		self.startLen = self.cm.getLine(self.startPos.line).length - self.cm.getSelection().length;

		cm.on('cursorActivity', self.activityFunc = function() {
			self.cursorActivity();
		});
	}

	var requestAnimationFrame = window.requestAnimationFrame || function(fn) {
		return setTimeout(fn, 1000/60);
	};

	var cancelAnimationFrame = window.cancelAnimationFrame || clearTimeout;

	Completion.prototype = {
		close: function(item) {
			if (this.active()) {
				this.cm.state.completionActive = null;
				this.tick = null;
				this.cm.off('cursorActivity', this.activityFunc);
				this.widget && this.data && CodeMirror.signal(this.data, 'close');
				this.widget && this.widget.close();
				CodeMirror.signal(this.cm, 'endCompletion', this.cm, item);
			}
		},

		active: function() {
			return this.cm.state.completionActive == this;
		},

		pick: function(data, i) {
			var completion = data.list[i];
			if (completion.hint)
				completion.hint(this.cm, data, completion);
			else
				this.cm.replaceRange(getText(completion), completion.to || data.to, completion.from || data.from, 'complete');
			CodeMirror.signal(data, 'pick', completion);
			this.close(completion);
		},

		cursorActivity: function() {

			if (this.debounce) {
				cancelAnimationFrame(this.debounce);
				this.debounce = 0;
			}

			var pos = this.cm.getCursor();
			var line = this.cm.getLine(pos.line);
			if (pos.line != this.startPos.line || line.length - pos.ch != this.startLen - this.startPos.ch || pos.ch < this.startPos.ch || this.cm.somethingSelected() || (!pos.ch || this.options.closeCharacters.test(line.charAt(pos.ch - 1)))) {
				this.close();
			} else {
				var self = this;
				this.debounce = requestAnimationFrame(function() {
					self.update();
				});
				this.widget && this.widget.disable();
			}
		},

		update: function(first) {
			if (this.tick == null)
				return;
			var self = this;
			var myTick = ++this.tick;
			fetchHints(this.options.hint, this.cm, this.options, function(data) {
				if (self.tick == myTick)
					self.finishUpdate(data, first);
			});
		},

		finishUpdate: function(data, first) {
			if (this.data)
				CodeMirror.signal(this.data, 'update');

			var picked = (this.widget && this.widget.picked) || (first && this.options.completeSingle);
			this.widget && this.widget.close();
			this.data = data;

			if (data && data.list.length) {
				if (picked && data.list.length == 1) {
					this.pick(data, 0);
				} else {
					this.widget = new Widget(this, data);
					CodeMirror.signal(data, 'shown');
				}
			}
		}
	};

	function parseOptions(cm, pos, options) {
		var editor = cm.options.hintOptions;
		var out = {};
		for (var prop in defaultOptions)
			out[prop] = defaultOptions[prop];
		if (editor)
			for (var prop in editor) {
				if (editor[prop] !== undefined)
					out[prop] = editor[prop];
			}
		if (options)
			for (var prop in options) {
				if (options[prop] !== undefined)
					out[prop] = options[prop];
			}

		if (out.hint.resolve)
			out.hint = out.hint.resolve(cm, pos);

		return out;
	}

	function getText(completion) {
		return typeof completion == 'string' ? completion : completion.text;
	}

	function buildKeyMap(completion, handle) {
		var baseMap = {
			Up: function() {
				handle.moveFocus(-1);
			},
			Down: function() {
				handle.moveFocus(1);
			},
			PageUp: function() {
				handle.moveFocus(-handle.menuSize() + 1, true);
			},
			PageDown: function() {
				handle.moveFocus(handle.menuSize() - 1, true);
			},
			Home: function() {
				handle.setFocus(0);
			},
			End: function() {
				handle.setFocus(handle.length - 1);
			},
			Enter: handle.pick,
			Tab: handle.pick,
			Esc: handle.close
		};

		var custom = completion.options.customKeys;
		var ourMap = custom ? {} : baseMap;

		function addBinding(key, val) {
			var bound;
			if (typeof val != 'string')
				bound = function(cm) {
					return val(cm, handle);
				};
			else if (baseMap.hasOwnProperty(val)) // This mechanism is deprecated
				bound = baseMap[val];
			else
				bound = val;
			ourMap[key] = bound;
		}

		if (custom) {
			for (var key in custom) {
				if (custom.hasOwnProperty(key))
					addBinding(key, custom[key]);
			}
		}

		var extra = completion.options.extraKeys;
		if (extra) {
			for (var key in extra)
				extra.hasOwnProperty(key) && addBinding(key, extra[key]);
		}
		return ourMap;
	}

	function getHintElement(hintsElement, el) {
		while (el && el != hintsElement) {
			if (el.nodeName.toUpperCase() === 'LI' && el.parentNode == hintsElement)
				return el;
			el = el.parentNode;
		}
	}

	function Widget(completion, data) {

		this.completion = completion;
		this.data = data;
		this.picked = false;
		var widget = this, cm = completion.cm;
		var ownerDocument = cm.getInputField().ownerDocument;
		var parentWindow = ownerDocument.defaultView || ownerDocument.parentWindow;
		var hints = this.hints = ownerDocument.createElement('ul');
		var theme = completion.cm.options.theme;
		hints.className = 'CodeMirror-hints ' + theme;
		this.selectedHint = data.selectedHint || 0;

		var completions = data.list;
		for (var i = 0; i < completions.length; ++i) {
			var elt = hints.appendChild(ownerDocument.createElement('li')), cur = completions[i];
			var className = HINT_ELEMENT_CLASS + (i != this.selectedHint ? '' : ' ' + ACTIVE_HINT_ELEMENT_CLASS);
			if (cur.className != null)
				className = cur.className + ' ' + className;
			elt.className = className;
			if (cur.render)
				cur.render(elt, data, cur);
			else
				elt.innerHTML = cur.displayText || getText(cur);
			elt.hintId = i;
		}

		var pos = cm.cursorCoords(completion.options.alignWithWord ? data.from : null);
		var left = pos.left;
		var top = pos.bottom;
		var below = true;

		hints.style.left = left + 'px';
		hints.style.top = top + 'px';
		// If we're at the edge of the screen, then we want the menu to appear on the left of the cursor.
		var winW = parentWindow.innerWidth || Math.max(ownerDocument.body.offsetWidth, ownerDocument.documentElement.offsetWidth);
		var winH = parentWindow.innerHeight || Math.max(ownerDocument.body.offsetHeight, ownerDocument.documentElement.offsetHeight);
		(completion.options.container || ownerDocument.body).appendChild(hints);
		var box = hints.getBoundingClientRect(), overlapY = box.bottom - winH;
		var scrolls = hints.scrollHeight > hints.clientHeight + 1;
		var startScroll = cm.getScrollInfo();

		if (overlapY > 0) {
			var height = box.bottom - box.top;
			var curTop = pos.top - (pos.bottom - box.top);
			if (curTop - height > 0) { // Fits above cursor
				hints.style.top = (top = pos.top - height) + 'px';
				below = false;
			} else if (height > winH) {
				hints.style.height = (winH - 5) + 'px';
				hints.style.top = (top = pos.bottom - box.top) + 'px';
				var cursor = cm.getCursor();
				if (data.from.ch != cursor.ch) {
					pos = cm.cursorCoords(cursor);
					hints.style.left = (left = pos.left) + 'px';
					box = hints.getBoundingClientRect();
				}
			}
		}

		var overlapX = box.right - winW;
		if (overlapX > 0) {
			if (box.right - box.left > winW) {
				hints.style.width = (winW - 5) + 'px';
				overlapX -= (box.right - box.left) - winW;
			}
			hints.style.left = (left = pos.left - overlapX) + 'px';
		}

		if (scrolls) {
			for (var node = hints.firstChild; node; node = node.nextSibling)
				node.style.paddingRight = cm.display.nativeBarWidth + 'px';
		}

		cm.addKeyMap(this.keyMap = buildKeyMap(completion, {
			moveFocus: function(n, avoidWrap) {
				widget.changeActive(widget.selectedHint + n, avoidWrap);
			},
			setFocus: function(n) {
				widget.changeActive(n);
			},
			menuSize: function() {
				return widget.screenAmount();
			},
			length: completions.length,
			close: function() {
				completion.close();
			},
			pick: function() {
				widget.pick();
			},
			data: data
		}));

		if (completion.options.closeOnUnfocus) {
			var closingOnBlur;
			cm.on('blur', this.onBlur = function() {
				closingOnBlur = setTimeout(function() {
					completion.close();
				}, 100);
			});
			cm.on('focus', this.onFocus = function() {
				clearTimeout(closingOnBlur);
			});
		}

		cm.on('scroll', this.onScroll = function() {
			var curScroll = cm.getScrollInfo();
			var editor = cm.getWrapperElement().getBoundingClientRect();
			var newTop = top + startScroll.top - curScroll.top;
			var point = newTop - (parentWindow.pageYOffset || (ownerDocument.documentElement || ownerDocument.body).scrollTop);
			if (!below)
				point += hints.offsetHeight;
			if (point <= editor.top || point >= editor.bottom)
				return completion.close();
			hints.style.top = newTop + 'px';
			hints.style.left = (left + startScroll.left - curScroll.left) + 'px';
		});

		CodeMirror.on(hints, 'dblclick', function(e) {
			var t = getHintElement(hints, e.target || e.srcElement);
			if (t && t.hintId != null) {
				widget.changeActive(t.hintId);
				widget.pick();
			}
		});

		CodeMirror.on(hints, 'click', function(e) {
			var t = getHintElement(hints, e.target || e.srcElement);
			if (t && t.hintId != null) {
				widget.changeActive(t.hintId);
				completion.options.completeOnSingleClick && widget.pick();
			}
		});

		CodeMirror.on(hints, 'mousedown', function() {
			setTimeout(function() {
				cm.focus();
			}, 20);
		});

		CodeMirror.signal(data, 'select', completions[this.selectedHint], hints.childNodes[this.selectedHint]);
		return true;
	}

	Widget.prototype = {
		close: function() {
			if (this.completion.widget != this)
				return;
			this.completion.widget = null;
			this.hints.parentNode.removeChild(this.hints);
			this.completion.cm.removeKeyMap(this.keyMap);
			var cm = this.completion.cm;
			if (this.completion.options.closeOnUnfocus) {
				cm.off('blur', this.onBlur);
				cm.off('focus', this.onFocus);
			}
			cm.off('scroll', this.onScroll);
		},

		disable: function() {
			this.completion.cm.removeKeyMap(this.keyMap);
			var widget = this;
			this.keyMap = { Enter: function() {
				widget.picked = true;
			}};
			this.completion.cm.addKeyMap(this.keyMap);
		},

		pick: function() {
			this.completion.pick(this.data, this.selectedHint);
		},

		changeActive: function(i, avoidWrap) {
			if (i >= this.data.list.length) {
				this.completion.close();
				// i = avoidWrap ? this.data.list.length - 1 : 0;
				this.data.from.line++;
				this.completion.cm.setCursor(this.data.from);
				return;
			} else if (i < 0) {
				this.completion.close();
				this.data.from.line--;
				this.completion.cm.setCursor(this.data.from);
				// i = avoidWrap ? 0 : this.data.list.length - 1;
				return;
			}
			if (this.selectedHint == i)
				return;
			var node = this.hints.childNodes[this.selectedHint];
			if (node)
				node.className = node.className.replace(' ' + ACTIVE_HINT_ELEMENT_CLASS, '');
			node = this.hints.childNodes[this.selectedHint = i];
			node.className += ' ' + ACTIVE_HINT_ELEMENT_CLASS;
			if (node.offsetTop < this.hints.scrollTop)
				this.hints.scrollTop = node.offsetTop - 3;
			else if (node.offsetTop + node.offsetHeight > this.hints.scrollTop + this.hints.clientHeight)
				this.hints.scrollTop = node.offsetTop + node.offsetHeight - this.hints.clientHeight + 3;
			CodeMirror.signal(this.data, 'select', this.data.list[this.selectedHint], node);
		},

		screenAmount: function() {
			return Math.floor(this.hints.clientHeight / this.hints.firstChild.offsetHeight) || 1;
		}
	};

	function applicableHelpers(cm, helpers) {
		if (!cm.somethingSelected())
			return helpers;
		var result = [];
		for (var i = 0; i < helpers.length; i++)
			if (helpers[i].supportsSelection)
				result.push(helpers[i]);
		return result;
	}

	function fetchHints(hint, cm, options, callback) {
		if (hint.async) {
			hint(cm, callback, options);
		} else {
			var result = hint(cm, options);
			if (result && result.then)
				result.then(callback);
			else
				callback(result);
		}
	}

	function resolveAutoHints(cm, pos) {

		var helpers = cm.getHelpers(pos, 'hint');
		var words;

		if (helpers.length) {
			var resolved = function(cm, callback, options) {
				var app = applicableHelpers(cm, helpers);
				function run(i) {
					if (i == app.length)
						return callback(null);
					fetchHints(app[i], cm, options, function(result) {
						if (result && result.list.length > 0)
							callback(result);
						else
							run(i + 1);
					});
				}
				run(0);
			};

			resolved.async = true;
			resolved.supportsSelection = true;
			return resolved;
		} else if (words = cm.getHelper(cm.getCursor(), 'hintWords')) {
			return function(cm) {
				return CodeMirror.hint.fromList(cm, { words: words });
			};
		} else if (CodeMirror.hint.anyword) {
			return function(cm, options) {
				return CodeMirror.hint.anyword(cm, options);
			};
		} else {
			return function() {};
		}
	}

	CodeMirror.registerHelper('hint', 'auto', { resolve: resolveAutoHints });
	CodeMirror.registerHelper('hint', 'fromList', function(cm, options) {

		var cur = cm.getCursor();
		var token = cm.getTokenAt(cur);
		var term;
		var from = CodeMirror.Pos(cur.line, token.start);
		var to = cur;

		if (token.start < cur.ch && /\w/.test(token.string.charAt(cur.ch - token.start - 1))) {
			term = token.string.substr(0, cur.ch - token.start);
		} else {
			term = '';
			from = cur;
		}

		var found = [];
		for (var i = 0; i < options.words.length; i++) {
			var word = options.words[i];
			if (word.slice(0, term.length) == term)
				found.push(word);
		}

		if (found.length)
			return { list: found, from: from, to: to };
	});

	CodeMirror.commands.autocomplete = CodeMirror.showHint;

	var defaultOptions = {
		hint: CodeMirror.hint.auto,
		completeSingle: true,
		alignWithWord: true,
		closeCharacters: /[\s()[]{};:>,]/,
		closeOnUnfocus: true,
		completeOnSingleClick: true,
		container: null,
		customKeys: null,
		extraKeys: null
	};

	CodeMirror.defineOption('hintOptions', null);
});

(function(mod) {
	mod(CodeMirror);
})(function(CodeMirror) {
	var RULES = { 'tagname-lowercase': true, 'attr-lowercase': true, 'attr-value-double-quotes': true, 'doctype-first': false, 'tag-pair': true, 'spec-char-escape': true, 'id-unique': true, 'src-not-empty': true, 'attr-no-duplication': true };
	var fn = function(text) {

		var found = [];
		var message;

		if (window.HTMLHint) {
			SET('code.errors', found);
			var messages = HTMLHint.verify(text, RULES);
			for (var i = 0; i < messages.length; i++) {
				message = messages[i];
				var startLine = message.line -1, endLine = message.line -1, startCol = message.col -1, endCol = message.col;
				found.push({ from: CodeMirror.Pos(startLine, startCol), to: CodeMirror.Pos(endLine, endCol), message: message.message, severity : message.type, line: startLine + 1, reason: message.message, });
			}
		}

		SET('code.errors', found);
		return found;
	};
	CodeMirror.registerHelper('lint', 'html', fn);
});

var SNIPPETS = [];
SNIPPETS.push({ type: 'html', search: 'fa', text: '<b>Font-Awesome Icon</b>', code: '<i class="fa fa-"></i>', ch: 17 });
SNIPPETS.push({ type: 'html', search: 'jc', text: '<b>Component</b>', code: '<div data-jc="__"></div>', ch: 15 });
SNIPPETS.push({ type: 'html', search: 'scope', text: '<b>Scope</b>', code: '<div data-jc-scope=""></div>', ch: 21 });
SNIPPETS.push({ type: 'html', search: 'data-bind', text: '<b>Binder</b>', code: 'data-bind="__"', ch: 12 });
SNIPPETS.push({ type: 'javascript', search: 'COMPONENT', text: '<b>COMPONENT</b>', code: 'COMPONENT(\'\', \'\', function(self, config) {\n\t{0}\n{0}});', ch: 12 });
SNIPPETS.push({ type: 'javascript', search: 'NEWSCHEMA', text: '<b>NEWSCHEMA</b>', code: 'NEWSCHEMA(\'\', function(schema) {\n\t{0}schema.define(\'key\', String, true);\n{0}});', ch: 12 });
SNIPPETS.push({ type: 'javascript', search: 'NEWOPERATION', text: '<b>NEWOPERATION</b>', code: 'NEWOPERATION(\'\', function($) {\n\t{0}\n{0}});', ch: 15 });
SNIPPETS.push({ type: 'javascript', search: 'schema.define', text: '<b>scheam.define</b>', code: 'schema.define(\'\', String, true)', ch: 16 });
SNIPPETS.push({ type: 'javascript', search: 'schema.addWorkflow', text: '<b>schema.addWorkflow</b>', code: 'schema.addWorkflow(\'\', function($) {\n\t{0}\n{0}});', ch: 21 });
SNIPPETS.push({ type: 'javascript', search: 'schema.addOperation', text: '<b>schema.addOperation</b>', code: 'schema.addOperation(\'\', function($) {\n\t{0}\n{0}});', ch: 21 });
SNIPPETS.push({ type: 'javascript', search: 'schema.addTransform', text: '<b>schema.addTransform</b>', code: 'schema.addTransform(\'\', function($) {\n\t{0}\n{0}});', ch: 21 });
SNIPPETS.push({ type: 'javascript', search: 'schema.setSave', text: '<b>schema.setSave</b>', code: 'schema.setSave(function($) {\n\t{0}\n{0}});', ch: 21, line: 1 });
SNIPPETS.push({ type: 'javascript', search: 'schema.setInsert', text: '<b>schema.setInsert</b>', code: 'schema.setInsert(function($) {\n\t{0}\n{0}});', ch: 2, line: 1 });
SNIPPETS.push({ type: 'javascript', search: 'schema.setUpdate', text: '<b>schema.setUpdate</b>', code: 'schema.setUpdate(function($) {\n\t{0}\n{0}});', ch: 2, line: 1 });
SNIPPETS.push({ type: 'javascript', search: 'schema.setRemove', text: '<b>schema.setRemove</b>', code: 'schema.setRemove(function($) {\n\t{0}\n{0}});', ch: 2, line: 1 });
SNIPPETS.push({ type: 'javascript', search: 'schema.setQuery', text: '<b>schema.setQuery</b>', code: 'schema.setQuery(function($) {\n\t{0}\n{0}});', ch: 2, line: 1 });
SNIPPETS.push({ type: 'javascript', search: 'schema.setRead', text: '<b>schema.setRead</b>', code: 'schema.setRead(function($) {\n\t{0}\n{0}});', ch: 2, line: 1 });
SNIPPETS.push({ type: 'javascript', search: 'schema.setGet', text: '<b>schema.setGet</b>', code: 'schema.setGet(function($) {\n\t{0}\n{0}});', ch: 2, line: 1 });
SNIPPETS.push({ type: 'javascript', search: 'MERGE', text: '<b>MERGE</b>', code: 'MERGE(\'\', \'\');', ch: 8 });
SNIPPETS.push({ type: 'javascript', search: 'ROUTE', text: '<b>ROUTE</b>', code: 'ROUTE(\'\', \'\');', ch: 8 });
SNIPPETS.push({ type: 'javascript', search: 'WEBSOCKET', text: '<b>WEBSOCKET</b>', code: 'WEBSOCKET(\'\', \'\');', ch: 11 });
SNIPPETS.push({ type: 'javascript', search: 'LOCALIZE', text: '<b>LOCALIZE</b>', code: 'LOCALIZE(\'\', \'\');', ch: 11 });
SNIPPETS.push({ type: 'javascript', search: 'exports.install', text: '<b>exports.install</b>', code: 'exports.install = function() {\n\t{0}\n{0}};', ch: 2, line: 1 });

FUNC.snippets = function(type, text, tabs, line, words, chplus) {

	switch (type) {
		case 'html':
		case 'totaljs':
			type = 'html';
			break;
		default:
			type = 'javascript';
			break;
	}

	var arr = [];
	for (var i = 0; i < SNIPPETS.length; i++) {
		var snip = SNIPPETS[i];
		if (snip.type === type && snip.search.indexOf(text) !== -1) {
			arr.push({ displayText: snip.text, text: snip.code.format(tabs || ''), ch: (snip.line ? snip.ch + tabs.length : tabs.length === 0 ? snip.ch - 1 : snip.ch + tabs.length - 1) + chplus, line: line + (snip.line || 0) });
		}
	}

	if (words && words.length) {
		for (var i = 0; i < words.length; i++) {
			var snip = words[i];
			if (snip.search.indexOf(text) !== -1)
				arr.push({ displayText: snip.code, text: snip.code, ch: snip.code.length + tabs.length + chplus, line: line });
		}
	}

	return arr;
};
