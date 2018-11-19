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

		t.vert.node.style.display = needsV ? 'block' : 'none';
		t.horiz.node.style.display = needsH ? 'block' : 'none';

		if (needsV) {
			t.vert.update(measure.scrollHeight, measure.clientHeight, measure.viewHeight - (needsH ? width : 0));
			t.vert.node.style.bottom = needsH ? width + 'px' : '0';
		}

		if (needsH) {
			t.horiz.update(measure.scrollWidth, measure.clientWidth, measure.viewWidth - (needsV ? width : 0) - measure.barLeft);
			t.horiz.node.style.right = needsV ? width + 'px' : '0';
			t.horiz.node.style.left = measure.barLeft + 'px';
		}

		return {right: needsV ? width : 0, bottom: needsH ? width : 0};
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
			{ regex: /data-jc="/,   push: 'component', token: 'variable-J' },
			{ regex: /data-bind="/, push: 'binder', token: 'variable-B' }
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
			{ regex: /"(\s|>)/, pop: false, token: 'variable-J' },
			{ regex: /./, token: 'variable-J' }
		],

		binder: [
			{ regex: /"(\s|>)/, dedent: true, token: 'variable-B' },
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

(function (mod) {
	mod(CodeMirror);
})(function (CodeMirror) {
	'use strict';
	CodeMirror.defineOption('autoSuggest', [], function (cm, value, old) {
		cm.on('inputRead', function (cm, change) {
			var mode = cm.getModeAt(cm.getCursor());
			for (var i = 0, len = value.length; i < len; i++) {
				if (mode.name === value[i].mode && change.text[0] === value[i].startChar) {
					cm.showHint({
						completeSingle: false,
						hint: function (cm, options) {
							var cur = cm.getCursor(),
								token = cm.getTokenAt(cur);
							var start = token.start + 1,
								end = token.end;
							return {
								list: value[i].listCallback(),
								from: CodeMirror.Pos(cur.line, start),
								to: CodeMirror.Pos(cur.line, end)
							};
						}
					});
				}
			}
		});
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
				for (var l = stream.string.length, i = l; i && /\s/.test(stream.string.charAt(i - 1)); --i) {}
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