// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE
(function(mod) {
	mod(CodeMirror);
})(function(CodeMirror) {
	var listRE = /^(\s*)(>[> ]*|[*+-]\s|(\d+)([.)]))(\s*)/;
	var emptyListRE = /^(\s*)(>[> ]*|[*+-]|(\d+)[.)])(\s*)$/;
	var unorderedListRE = /[*+-]\s/;
	CodeMirror.commands.newlineAndIndentContinue = function(cm) {
		if (cm.getOption('disableInput'))
			return CodeMirror.Pass;
		var ranges = cm.listSelections(), replacements = [];
		for (var i = 0; i < ranges.length; i++) {
			var pos = ranges[i].head;
			var eolState = cm.getStateAfter(pos.line);
			var inList = eolState.list !== false;
			var inQuote = eolState.quote !== 0;
			var line = cm.getLine(pos.line), match = listRE.exec(line);
			if (!ranges[i].empty() || (!inList && !inQuote) || !match) {
				cm.execCommand('newlineAndIndent');
				return;
			}

			if (emptyListRE.test(line)) {
				cm.replaceRange('', { line: pos.line, ch: 0 }, { line: pos.line, ch: pos.ch + 1 });
				replacements[i] = '\n';
			} else {
				var indent = match[1], after = match[5];
				var bullet = unorderedListRE.test(match[2]) || match[2].indexOf('>') >= 0 ? match[2] : (parseInt(match[3], 10) + 1) + match[4];
				replacements[i] = '\n' + indent + bullet + after;
			}
		}
		cm.replaceSelections(replacements);
	};
});

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

WAIT('CodeMirror.defineMode', function() {

	CodeMirror.defineMode('totaljs', function(config) {
		var htmlbase = CodeMirror.getMode(config, 'text/html');
		var totaljsinner = CodeMirror.getMode(config, 'totaljs:inner');
		return CodeMirror.overlayMode(htmlbase, totaljsinner);
	});

	CodeMirror.defineMode('totaljs:inner', function() {
		return {
			token: function(stream) {

				if (stream.match(/@{.*?}/, true))
					return 'variable-T';

				if (stream.match(/@\(.*?\)/, true))
					return 'variable-L';

				if (stream.match(/\{\{.*?\}\}/, true))
					return 'variable-A';

				if (stream.match(/data-scope=/, true))
					return 'variable-S';

				if (stream.match(/data-released=/, true))
					return 'variable-R';

				if (stream.match(/data-bind=/, true))
					return 'variable-B';

				if (stream.match(/data-jc=|data-{2,4}=|data-bind=/, true))
					return 'variable-J';

				stream.next();
				return null;
			}
		};
	});

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

	CodeMirror.defineMode('codeapi', function() {

		var REG_KEY = /^\$[a-z0-9_\-.#]+(\s)+:\s/i;
		var REG_HEADER = /^[a-z0-9_\-.#]+:\s/i;
		var REG_METHOD = /^(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEADER)\s?.*?/i;
		var REG_VARIABLE = /^\$(\$)?[a-z0-9_\-.#]+/i;

		return {

			startState: function() {
				return { type: 0, keyword: 0 };
			},

			token: function(stream, state) {

				var m;

				if (stream.sol()) {

					var line = stream.string.trim();
					if (line.substring(0, 2) === '//') {
						stream.skipToEnd();
						return 'comment';
					}

					var tmp = line.substring(0, 3);

					if (tmp === '===' || tmp === '---') {
						stream.skipToEnd();
						return 'type';
					}

					state.type = 0;
				}

				m = stream.match(REG_METHOD, true);
				if (m) {
					stream.skipToEnd();
					return 'variable-API';
				}

				m = stream.match(REG_HEADER, true);
				if (m)
					return 'def';

				m = stream.match(REG_VARIABLE, true);
				if (m)
					return 'variable-A';

				m = stream.match(REG_KEY, true);
				if (m)
					return 'atom';

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

// Utility function that allows modes to be combined. The mode given
// as the base argument takes care of most of the normal mode
// functionality, but a second (typically simple) mode is used, which
// can override the style of text. Both modes get to parse all of the
// text, but when both assign a non-null style to a piece of code, the
// overlay wins, unless the combine argument was true and not overridden,
// or state.overlay.combineTokens was true, in which case the styles are
// combined.

(function(mod) {
	mod(CodeMirror);
})(function(CodeMirror) {
	CodeMirror.overlayMode = function(base, overlay, combine) {
		return {
			startState: function() {
				return {
					base: CodeMirror.startState(base),
					overlay: CodeMirror.startState(overlay),
					basePos: 0, baseCur: null,
					overlayPos: 0, overlayCur: null,
					streamSeen: null
				};
			},
			copyState: function(state) {
				return {
					base: CodeMirror.copyState(base, state.base),
					overlay: CodeMirror.copyState(overlay, state.overlay),
					basePos: state.basePos, baseCur: null,
					overlayPos: state.overlayPos, overlayCur: null
				};
			},
			token: function(stream, state) {
				if (stream != state.streamSeen || Math.min(state.basePos, state.overlayPos) < stream.start) {
					state.streamSeen = stream;
					state.basePos = state.overlayPos = stream.start;
				}

				if (stream.start == state.basePos) {
					state.baseCur = base.token(stream, state.base);
					state.basePos = stream.pos;
				}

				if (stream.start == state.overlayPos) {
					stream.pos = stream.start;
					state.overlayCur = overlay.token(stream, state.overlay);
					state.overlayPos = stream.pos;
				}

				stream.pos = Math.min(state.basePos, state.overlayPos);

				// state.overlay.combineTokens always takes precedence over combine,
				// unless set to null
				if (state.overlayCur == null)
					return state.baseCur;
				else if (state.baseCur != null && state.overlay.combineTokens || combine && state.overlay.combineTokens == null)
					return state.baseCur + ' ' + state.overlayCur;
				else
					return state.overlayCur;
			},
			indent: base.indent && function(state, textAfter) {
				return base.indent(state.base, textAfter);
			},
			electricChars: base.electricChars, innerMode: function(state) {
				return { state: state.base, mode: base };
			},
			blankLine: function(state) {
				var baseToken, overlayToken;
				if (base.blankLine)
					baseToken = base.blankLine(state.base);
				if (overlay.blankLine)
					overlayToken = overlay.blankLine(state.overlay);
				return overlayToken == null ? baseToken : (combine && baseToken != null ? baseToken + ' ' + overlayToken : overlayToken);
			}
		};
	};
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

		changeActive: function(i) {
			if (i >= this.data.list.length) {
				this.completion.close();
				this.data.from.line++;
				this.completion.cm.setCursor(this.data.from);
				return;
			} else if (i < 0) {
				this.completion.close();
				this.data.from.line--;
				this.completion.cm.setCursor(this.data.from);
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
		var f = CodeMirror.Pos(cur.line, token.start);
		var to = cur;

		if (token.start < cur.ch && /\w/.test(token.string.charAt(cur.ch - token.start - 1))) {
			term = token.string.substr(0, cur.ch - token.start);
		} else {
			term = '';
			f = cur;
		}

		var found = [];
		for (var i = 0; i < options.words.length; i++) {
			var word = options.words[i];
			if (word.slice(0, term.length) == term)
				found.push(word);
		}

		if (found.length)
			return { list: found, from: f, to: to };
	});

	CodeMirror.commands.autocomplete = CodeMirror.showHint;

	var defaultOptions = {
		hint: CodeMirror.hint.auto,
		completeSingle: true,
		alignWithWord: true,
		closeCharacters: /[\s()[]{};:>,\/"]/,
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

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE
(function(mod) {
	mod(CodeMirror);
})(function(CodeMirror) {

	var reg_skip = (/[a-zA-Z'"`0-9/$\-{@]/);
	var delay;
	var defaults = {
		pairs: '()[]{}\'\'""',
		triples: '',
		explode: '[]{}'
	};

	var Pos = CodeMirror.Pos;

	CodeMirror.defineOption('autoCloseBrackets', false, function(cm, val, old) {

		cm.on('keydown', function() {
			if (delay) {
				clearTimeout(delay);
				delay = 0;
			}
		});

		if (old && old != CodeMirror.Init) {
			cm.removeKeyMap(keyMap);
			cm.state.closeBrackets = null;
		}

		if (val) {
			ensureBound(getOption(val, 'pairs'));
			cm.state.closeBrackets = val;
			cm.addKeyMap(keyMap);
		}
	});

	function getOption(conf, name) {
		if (name == 'pairs' && typeof conf == 'string')
			return conf;
		if (typeof(conf) == 'object' && conf[name] != null)
			return conf[name];
		return defaults[name];
	}

	var keyMap = { Backspace: handleBackspace, Enter: handleEnter };

	function ensureBound(chars) {
		for (var i = 0; i < chars.length; i++) {
			var ch = chars.charAt(i), key = '\'' + ch + '\'';
			!keyMap[key] && (keyMap[key] = handler(ch));
		}
	}

	ensureBound(defaults.pairs + '`');

	function handler(ch) {
		return function(cm) {
			return handleChar(cm, ch);
		};
	}

	function getConfig(cm) {
		var deflt = cm.state.closeBrackets;
		if (!deflt || deflt.override)
			return deflt;
		return cm.getModeAt(cm.getCursor()).closeBrackets || deflt;
	}

	function handleBackspace() {
		return CodeMirror.Pass;
	}

	function handleEnter(cm) {
		var conf = getConfig(cm);
		var explode = conf && getOption(conf, 'explode');
		if (!explode || cm.getOption('disableInput'))
			return CodeMirror.Pass;

		var ranges = cm.listSelections();
		for (var i = 0; i < ranges.length; i++) {
			if (!ranges[i].empty())
				return CodeMirror.Pass;
			var around = charsAround(cm, ranges[i].head);
			if (!around || explode.indexOf(around) % 2 != 0)
				return CodeMirror.Pass;
		}

		cm.operation(function() {
			var linesep = cm.lineSeparator() || '\n';
			cm.replaceSelection(linesep + linesep, null);
			cm.execCommand('goCharLeft');
			ranges = cm.listSelections();
			for (var i = 0; i < ranges.length; i++) {
				var line = ranges[i].head.line;
				cm.indentLine(line, null, true);
				cm.indentLine(line + 1, null, true);
			}
		});
	}

	function handleChar(cm, ch) {

		delay && clearTimeout(delay);

		var conf = getConfig(cm);
		if (!conf || cm.getOption('disableInput'))
			return CodeMirror.Pass;

		var pairs = getOption(conf, 'pairs');
		var pos = pairs.indexOf(ch);
		if (pos == -1)
			return CodeMirror.Pass;

		var triples = getOption(conf, 'triples');
		var identical = pairs.charAt(pos + 1) == ch;
		var ranges = cm.listSelections();
		var opening = pos % 2 == 0;
		var type;
		var left = pos % 2 ? pairs.charAt(pos - 1) : ch;

		for (var i = 0; i < ranges.length; i++) {
			var range = ranges[i], cur = range.head, curType;
			var next = cm.getRange(cur, Pos(cur.line, cur.ch + 1));
			if (opening && !range.empty()) {
				curType = 'surround';
			} else if ((identical || !opening) && next == ch) {
				cm.replaceSelection(left, null);
				return CodeMirror.pass;
			} else if (identical && cur.ch > 1 && triples.indexOf(ch) >= 0 && cm.getRange(Pos(cur.line, cur.ch - 2), cur) == ch + ch) {
				if (cur.ch > 2 && /\bstring/.test(cm.getTokenTypeAt(Pos(cur.line, cur.ch - 2))))
					return CodeMirror.Pass;
				curType = 'addFour';
			} else if (identical) {
				var prev = cur.ch == 0 ? ' ' : cm.getRange(Pos(cur.line, cur.ch - 1), cur);
				if (reg_skip.test(next) || reg_skip.test(prev))
					return CodeMirror.Pass;
				if (!CodeMirror.isWordChar(next) && prev != ch && !CodeMirror.isWordChar(prev))
					curType = 'both';
				else
					return CodeMirror.Pass;
			} else if (opening) {
				if (reg_skip.test(next))
					return CodeMirror.Pass;
				curType = 'both';
			} else
				return CodeMirror.Pass;
			if (!type)
				type = curType;
			else if (type != curType)
				return CodeMirror.Pass;
		}

		var right = pos % 2 ? ch : pairs.charAt(pos + 1);

		if (type == 'both') {
			cm.operation(function() {
				cm.replaceSelection(left, null);
				delay && clearTimeout(delay);
				delay = setTimeout(function() {
					cm.operation(function() {
						cm.replaceSelection(right, 'before');
						cm.triggerElectric(right);
					});
				}, 250);
			});
		}
	}

	function charsAround(cm, pos) {
		var str = cm.getRange(Pos(pos.line, pos.ch - 1),
			Pos(pos.line, pos.ch + 1));
		return str.length == 2 ? str : null;
	}
});

(function(mod) {
	mod(CodeMirror);
})(function(CodeMirror) {

	CodeMirror.defineOption('autoCloseTags', false, function(cm, val, old) {
		if (old != CodeMirror.Init && old)
			cm.removeKeyMap('autoCloseTags');
		if (!val)
			return;
		var map = { name: 'autoCloseTags' };
		if (typeof val != 'object' || val.whenClosing)
			map['\'/\''] = function(cm) {
				return autoCloseSlash(cm);
			};

		if (typeof val != 'object' || val.whenOpening)
			map['\'>\''] = function(cm) {
				return autoCloseGT(cm);
			};
		cm.addKeyMap(map);
	});

	var htmlDontClose = ['area', 'base', 'br', 'col', 'command', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
	var htmlIndent = ['applet', 'blockquote', 'body', 'button', 'div', 'dl', 'fieldset', 'form', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'html', 'iframe', 'layer', 'legend', 'object', 'ol', 'p', 'select', 'table', 'ul'];

	function autoCloseGT(cm) {

		if (cm.getOption('disableInput'))
			return CodeMirror.Pass;

		var ranges = cm.listSelections();
		var replacements = [];
		var opt = cm.getOption('autoCloseTags');

		for (var i = 0; i < ranges.length; i++) {
			if (!ranges[i].empty())
				return CodeMirror.Pass;

			var pos = ranges[i].head, tok = cm.getTokenAt(pos);
			var inner = CodeMirror.innerMode(cm.getMode(), tok.state), state = inner.state;
			if (inner.mode.name != 'xml' || !state.tagName)
				return CodeMirror.Pass;

			var anchor = ranges[i].anchor;
			var n = cm.getRange({ line: anchor.line, ch: anchor.ch }, { line: anchor.line, ch: anchor.ch + 1 });
			if (!(!n || n === ' ' || n === '\t' || n === '\n'))
				return CodeMirror.Pass;

			var html = inner.mode.configuration == 'html';
			var dontCloseTags = (typeof(opt) == 'object' && opt.dontCloseTags) || (html && htmlDontClose);
			var indentTags = (typeof opt == 'object' && opt.indentTags) || (html && htmlIndent);

			var tagName = state.tagName;
			if (tok.end > pos.ch)
				tagName = tagName.slice(0, tagName.length - tok.end + pos.ch);

			var lowerTagName = tagName.toLowerCase();
			// Don't process the '>' at the end of an end-tag or self-closing tag
			if (!tagName || tok.type == 'string' && (tok.end != pos.ch || !/["']/.test(tok.string.charAt(tok.string.length - 1)) || tok.string.length == 1) || tok.type == 'tag' && state.type == 'closeTag' || tok.string.indexOf('/') == (tok.string.length - 1) || dontCloseTags && indexOf(dontCloseTags, lowerTagName) > -1 || closingTagExists(cm, tagName, pos, state, true))
				return CodeMirror.Pass;

			var indent = indentTags && indexOf(indentTags, lowerTagName) > -1;
			replacements[i] = { indent: indent, text: '></' + tagName + '>', newPos: CodeMirror.Pos(pos.line, pos.ch + 1) };
		}

		var dontIndentOnAutoClose = (typeof(opt) == 'object' && opt.dontIndentOnAutoClose);
		for (var i = ranges.length - 1; i >= 0; i--) {
			var info = replacements[i];
			cm.replaceRange(info.text, ranges[i].head, ranges[i].anchor, '+insert');
			var sel = cm.listSelections().slice(0);
			sel[i] = { head: info.newPos, anchor: info.newPos };
			cm.setSelections(sel);
			if (!dontIndentOnAutoClose && info.indent) {
				cm.indentLine(info.newPos.line, null, true);
				cm.indentLine(info.newPos.line + 1, null, true);
			}
		}
	}

	function autoCloseCurrent(cm, typingSlash) {
		var ranges = cm.listSelections();
		var replacements = [];
		var head = typingSlash ? '/' : '</';
		var opt = cm.getOption('autoCloseTags');
		var dontIndentOnAutoClose = (typeof(opt) == 'object' && opt.dontIndentOnSlash);
		for (var i = 0; i < ranges.length; i++) {
			if (!ranges[i].empty())
				return CodeMirror.Pass;
			var pos = ranges[i].head;
			var tok = cm.getTokenAt(pos);
			var inner = CodeMirror.innerMode(cm.getMode(), tok.state);
			var state = inner.state;
			if (typingSlash && (tok.type == 'string' || tok.string.charAt(0) != '<' || tok.start != pos.ch - 1))
				return CodeMirror.Pass;

			// Kludge to get around the fact that we are not in XML mode
			// when completing in JS/CSS snippet in htmlmixed mode. Does not
			// work for other XML embedded languages (there is no general
			// way to go from a mixed mode to its current XML state).
			var replacement;

			if (inner.mode.name != 'xml') {
				if (cm.getMode().name == 'htmlmixed' && inner.mode.name == 'javascript')
					replacement = head + 'script';
				else if (cm.getMode().name == 'htmlmixed' && inner.mode.name == 'css')
					replacement = head + 'style';
				else
					return CodeMirror.Pass;
			} else {
				if (!state.context || !state.context.tagName || closingTagExists(cm, state.context.tagName, pos, state))
					return CodeMirror.Pass;
				replacement = head + state.context.tagName;
			}
			if (cm.getLine(pos.line).charAt(tok.end) != '>')
				replacement += '>';
			replacements[i] = replacement;
		}

		cm.replaceSelections(replacements);
		ranges = cm.listSelections();

		if (!dontIndentOnAutoClose) {
			for (var i = 0; i < ranges.length; i++)
				if (i == ranges.length - 1 || ranges[i].head.line < ranges[i + 1].head.line)
					cm.indentLine(ranges[i].head.line);
		}
	}

	function autoCloseSlash(cm) {
		return cm.getOption('disableInput') ? CodeMirror.Pass : autoCloseCurrent(cm, true);
	}

	CodeMirror.commands.closeTag = function(cm) {
		return autoCloseCurrent(cm);
	};

	function indexOf(collection, elt) {
		if (collection.indexOf)
			return collection.indexOf(elt);
		for (var i = 0, e = collection.length; i < e; ++i)
			if (collection[i] == elt)
				return i;
		return -1;
	}

	// If xml-fold is loaded, we use its functionality to try and verify
	// whether a given tag is actually unclosed.
	function closingTagExists(cm, tagName, pos, state, newTag) {
		if (!CodeMirror.scanForClosingTag)
			return false;
		var end = Math.min(cm.lastLine() + 1, pos.line + 500);
		var nextClose = CodeMirror.scanForClosingTag(cm, pos, null, end);
		if (!nextClose || nextClose.tag != tagName)
			return false;

		var cx = state.context;
		// If the immediate wrapping context contains onCx instances of
		// the same tag, a closing tag only exists if there are at least
		// that many closing tags of that type following.
		for (var onCx = newTag ? 1 : 0; cx && cx.tagName == tagName; cx = cx.prev)
			++onCx;

		pos = nextClose.to;
		for (var i = 1; i < onCx; i++) {
			var next = CodeMirror.scanForClosingTag(cm, pos, null, end);
			if (!next || next.tag != tagName)
				return false;
			pos = next.to;
		}
		return true;
	}
});

var SNIPPETS = [];
SNIPPETS.push({ type: 'html', search: 'script', text: '<b>Script: JavaScript</b>', code: '<script></script>', ch: 9 });
SNIPPETS.push({ type: 'html', search: 'script', text: '<b>Script: HTML</b>', code: '<script type="text/html"></script>', ch: 26 });
SNIPPETS.push({ type: 'html', search: 'script', text: '<b>Script: Text</b>', code: '<script type="text/plain"></script>', ch: 27 });
SNIPPETS.push({ type: 'html', search: 'fa', text: '<b>Font-Awesome Icon</b>', code: '<i class="fa fa-"></i>', ch: 17 });
SNIPPETS.push({ type: 'html', search: 'jc', text: '<b>Component</b>', code: '<div data-jc="__"></div>', ch: 15 });
SNIPPETS.push({ type: 'html', search: '--', text: '<b>Component</b>', code: '<div data---="__"></div>', ch: 15 });
SNIPPETS.push({ type: 'html', search: 'scope', text: '<b>Scope</b>', code: '<div data-scope=""></div>', ch: 18 });
SNIPPETS.push({ type: 'html', search: 'data-bind', text: '<b>Binder</b>', code: 'data-bind="__"', ch: 12 });
SNIPPETS.push({ type: 'javascript', search: 'COMPONENT', text: '<b>COMPONENT</b>', code: 'COMPONENT(\'\', \'\', function(self, config) {\n\t{0}\n{0}});', ch: 12 });
SNIPPETS.push({ type: 'javascript', search: 'NEWSCHEMA', text: '<b>NEWSCHEMA</b>', code: 'NEWSCHEMA(\'\', function(schema) {\n\t{0}schema.define(\'key\', String, true);\n{0}});', ch: 12 });
SNIPPETS.push({ type: 'javascript', search: 'NEWOPERATION', text: '<b>NEWOPERATION</b>', code: 'NEWOPERATION(\'\', function($) {\n\t{0}\n{0}});', ch: 15 });
SNIPPETS.push({ type: 'javascript', search: 'schema.define', text: '<b>schema.define</b>', code: 'schema.define(\'\', String, true);', ch: 16 });
SNIPPETS.push({ type: 'javascript', search: 'schema.required', text: '<b>schema.required</b>', code: 'schema.required(\'\', model => model.age > 33);', ch: 18 });
SNIPPETS.push({ type: 'javascript', search: 'schema.addWorkflow', text: '<b>schema.addWorkflow</b>', code: 'schema.addWorkflow(\'\', function($) {\n\t{0}\n{0}});', ch: 21 });
SNIPPETS.push({ type: 'javascript', search: 'schema.addOperation', text: '<b>schema.addOperation</b>', code: 'schema.addOperation(\'\', function($) {\n\t{0}\n{0}});', ch: 21 });
SNIPPETS.push({ type: 'javascript', search: 'schema.addTransform', text: '<b>schema.addTransform</b>', code: 'schema.addTransform(\'\', function($) {\n\t{0}\n{0}});', ch: 21 });
SNIPPETS.push({ type: 'javascript', search: 'schema.setSave', text: '<b>schema.setSave</b>', code: 'schema.setSave(function($) {\n\t{0}\n{0}});', ch: 21, line: 1 });
SNIPPETS.push({ type: 'javascript', search: 'schema.setPatch', text: '<b>schema.setPatch</b>', code: 'schema.setPatch(function($) {\n\t{0}\n{0}});', ch: 22, line: 1 });
SNIPPETS.push({ type: 'javascript', search: 'schema.setInsert', text: '<b>schema.setInsert</b>', code: 'schema.setInsert(function($) {\n\t{0}\n{0}});', ch: 2, line: 1 });
SNIPPETS.push({ type: 'javascript', search: 'schema.setUpdate', text: '<b>schema.setUpdate</b>', code: 'schema.setUpdate(function($) {\n\t{0}\n{0}});', ch: 2, line: 1 });
SNIPPETS.push({ type: 'javascript', search: 'schema.setRemove', text: '<b>schema.setRemove</b>', code: 'schema.setRemove(function($) {\n\t{0}\n{0}});', ch: 2, line: 1 });
SNIPPETS.push({ type: 'javascript', search: 'schema.setQuery', text: '<b>schema.setQuery</b>', code: 'schema.setQuery(function($) {\n\t{0}\n{0}});', ch: 2, line: 1 });
SNIPPETS.push({ type: 'javascript', search: 'schema.setRead', text: '<b>schema.setRead</b>', code: 'schema.setRead(function($) {\n\t{0}\n{0}});', ch: 2, line: 1 });
SNIPPETS.push({ type: 'javascript', search: 'schema.setGet', text: '<b>schema.setGet</b>', code: 'schema.setGet(function($) {\n\t{0}\n{0}});', ch: 2, line: 1 });
SNIPPETS.push({ type: 'javascript', search: 'MERGE', text: '<b>MERGE</b>', code: 'MERGE(\'\', \'\');', ch: 8 });
SNIPPETS.push({ type: 'javascript', search: 'ROUTE', text: '<b>ROUTE</b>', code: 'ROUTE(\'\', \'\');', ch: 8 });
SNIPPETS.push({ type: 'javascript', search: 'WEBSOCKET', text: '<b>WEBSOCKET</b>', code: 'WEBSOCKET(\'\', action, [\'json\']);', ch: 12 });
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
		if (snip.type === type && snip.search.indexOf(text) !== -1 && (snip.search !== text || text.charAt(0) === '-'))
			arr.push({ displayText: snip.text, text: snip.code.format(tabs || ''), ch: (snip.line ? snip.ch + tabs.length : tabs.length === 0 ? snip.ch - 1 : snip.ch + tabs.length - 1) + chplus, line: line + (snip.line || 0) });
	}

	if (words && words.length) {
		for (var i = 0; i < words.length; i++) {
			var snip = words[i];
			if (snip.search.indexOf(text) !== -1 && snip.search !== text)
				arr.push({ displayText: snip.code, text: snip.code, ch: snip.code.length + tabs.length + chplus, line: line });
		}
	}

	return arr;
};


CodeMirror.defineExtension('centerLine', function(line) {
	var h = this.getScrollInfo().clientHeight;
	var coords = this.charCoords({ line: line, ch: 0 }, 'local');
	this.scrollTo(null, (coords.top + coords.bottom - h) / 2);
});

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
	mod(CodeMirror);
})(function(CodeMirror) {

	function validator(text, options) {
		if (!options.indent)    // JSHint error.character actually is a column index, this fixes underlining on lines using tabs for indentation
			options.indent = 1; // JSHint default value is 4
		JSHINT(text, options, options.globals);
		var errors = JSHINT.data().errors, result = [];
		if (errors)
			parseErrors(errors, result);
		return result;
	}

	CodeMirror.registerHelper('lint', 'javascript', validator);

	function parseErrors(errors, output) {
		for ( var i = 0; i < errors.length; i++) {
			var error = errors[i];
			if (error) {
				var start = error.character - 1, end = start + 1;
				if (error.evidence) {
					var index = error.evidence.substring(start).search(/.\b/);
					if (index > -1)
						end += index;
				}

				// Convert to format expected by validation service
				var hint = {
					message: error.reason,
					severity: error.code ? (error.code.startsWith('W') ? 'warning' : 'error') : 'error',
					from: CodeMirror.Pos(error.line - 1, start)
					// to: CodeMirror.Pos(error.line - 1, end) -- because this replaces UTF8 chars to unreadable chars
				};

				output.push(hint);
			}
		}
	}
});

(function(mod) {
	mod(CodeMirror);
})(function(CodeMirror) {
	CodeMirror.defineMode('todo', function() {

		var REG_MINUTES = /\[\d+(\s)(minutes|minute|min|m|hours|hour|h|hod)?(.)?\]?/i;
		var REG_ESTIMATE = /\{\d+(\s)(minutes|minute|hours|hour|h|hod)?(.)?\}?/i;
		var REG_ESTIMATE2 = /(^|\s)\{\d+(\s)(minutes|minute|hours|hour|h|hod)?(.)?\}?/i;
		var REG_KEYWORD = /@(working|canceled|done|priority|important|date)(\(.*?\))?/i;
		var REG_SPECIAL = /(^|\s)`.*?`/;
		var REG_BOLD = /\*.*?\*/;
		var REG_HIGH = /_{1,}.*?_{1,}/;
		var REG_STRIKE = /~.*?~/;
		var REG_USER = /<.*?>/;
		var REG_HEADER_SUB = /[^-].*?:(\s)?$/;
		var REG_HEADER = /.*?:(\s)?$/;
		var REG_TAG = /#[a-z0-9]+/;
		var REG_UTF8 = new RegExp('(' + String.fromCharCode(9989) + '|' + String.fromCharCode(10060) + ')', 'g');

		return {

			startState: function() {
				return { type: 0, keyword: 0 };
			},

			token: function(stream, state) {

				var style = [];
				var m;
				var ora = stream.lineOracle;

				if (stream.sol()) {

					state.next = '';

					var line = stream.string;
					var c = line.charCodeAt(0);

					if (c > 45 && line.match(REG_HEADER)) {
						state.type = 0;
						state.keyword = false;
						stream.skipToEnd();
						setTimeout(function(line, editor) {
							editor.addLineClass(line, 'text', 'cm-header-bg');
						}, 5, ora.line, ora.doc.getEditor());
						return 'header';
					} else if (line.trim().charCodeAt(0) > 45 && line.match(REG_HEADER_SUB)) {
						state.type = 0;
						state.keyword = false;
						stream.skipToEnd();
						// remove(ora.line, ora.doc.getEditor());
						return 'headersub';
					}

					if (line.match(/^(\s)*=.*?$/)) {
						if (line.substring(0, 1) === '=') {
							stream.skipToEnd();
							return 'sum';
						}
						state.type = 99;
						state.next = stream.next();
						return '';
					}

					if (line.match(/^-{3,}$/g)) {
						// line
						stream.skipToEnd();
						return 'line';
					}

					if (line.match(/^(\s)*-/)) {
						state.type = 1;

						if (line.indexOf('@done') !== -1)
							state.type = 2;
						if (line.indexOf('@canceled') !== -1)
							state.type = 3;
						if (line.indexOf('@working') !== -1)
							state.type = 4;

						if (state.type === 1 && (line.indexOf('@priority') !== -1 || line.indexOf('@important') !== -1))
							state.type = 6;
						else if (state.type === 1 && line.indexOf('@high') !== -1)
							state.type = 5;

						state.next = stream.next();
						return find_style(state.type);
					}

					state.type = 0;
				}

				if (state.type === 100) {
					state.type = 0;
					return stream.match(/=.*?$/, true) ? 'sum' : '';
				}

				if (state.type === 99) {
					stream.eatSpace();
					state.type = 100;
					return 'summarize';
				}

				m = stream.match(REG_UTF8, true);
				if (m) {
					style.push(find_style(state.type));
					style.push('utf8');
					return style.join(' ');
				}

				if (state.type) {
					m = stream.match(REG_KEYWORD, true);
					if (m) {
						var a = m.toString().toLowerCase();
						style.push(find_style(state.type));
						if (a.indexOf('@done') !== -1) {
							state.keyword = 1;
							style.push('completed');
						} else if (a.indexOf('@canceled') !== -1) {
							state.keyword = 2;
							style.push('canceled');
						} else if (a.indexOf('@working') !== -1) {
							state.keyword = 3;
							style.push('working');
						} else if (a.indexOf('@priority') !== -1 || a.indexOf('@important') !== -1) {
							state.keyword = 4;
							style.push('priority');
						} else if (a.indexOf('@high') !== -1) {
							state.keyword = 5;
							style.push('high');
						} else if (a.indexOf('@date') !== -1) {
							state.keyword = 6;
							if (a.indexOf('(') !== -1) {
								style.push('date');
								if (state.type !== 2 && state.type !== 3) {
									if (m[2]) {
										var date = +m[2].replace(/\(|\)/g, '').parseDate().format('yyyyMMdd');
										if (date < (+NOW.format('yyyyMMdd')))
											style.push('date-expired');
										else if (date === (+NOW.format('yyyyMMdd')))
											style.push('date-today-expire');
										else if (date === (+NOW.add('1 day').format('yyyyMMdd')))
											style.push('date-tomorrow-expire');
										else if (date === (+NOW.add('2 day').format('yyyyMMdd')))
											style.push('date-soon-expire');
									}
								}
							}
						}
						return style.join(' ');
					}

					m = stream.match(REG_MINUTES, true);
					if (m) {
						style.push(find_style(state.type));
						style.push('minutes');
						return style.join(' ');
					}

					m = stream.match(REG_TAG, true);
					if (m) {
						style.push(find_style(state.type));
						style.push('tag2');
						return style.join(' ');
					}

					m = stream.match(REG_USER, true);
					if (m) {
						style.push(find_style(state.type));
						style.push('user');
						return style.join(' ');
					}
				}

				if (!state.next || state.next === ' ' || state.next === '\t') {
					m = stream.match(REG_ESTIMATE2);
					if (m) {
						m = stream.match(REG_ESTIMATE, true);
						style.push(find_style(state.type));
						style.push('estimate');
						return style.join(' ');
					}

					m = stream.match(REG_SPECIAL, true);
					if (m) {
						style.push(find_style(state.type));
						style.push('special');
						return style.join(' ');
					}

					m = stream.match(REG_STRIKE, true);
					if (m) {
						style.push(find_style(state.type));
						style.push('strike');
						return style.join(' ');
					}

					m = stream.match(REG_BOLD, true);
					if (m) {
						style.push(find_style(state.type));
						style.push('bold');
						return style.join(' ');
					}

					m = stream.match(REG_HIGH, true);
					if (m) {
						style.push(find_style(state.type));
						style.push('high');
						return style.join(' ');
					}
				}

				if (stream.eol()) {
					state.next = '';
					state.type = 0;
					state.keyword = 0;
				}

				// remove(ora.line, ora.doc.getEditor());
				state.next = stream.next();
				return find_style(state.type);
			}
		};
	});

	function find_style(type) {
		if (type === 1)
			return 'code';
		if (type === 2)
			return 'strong quote';
		if (type === 3)
			return 'strong canceled2';
		if (type === 4)
			return 'strong working2';
		if (type === 5)
			return 'high';
		if (type === 6)
			return 'highpriority';
		return '';
	}
});

/*
Based on Joel Besada's lovely experiment
https://twitter.com/JoelBesada/status/670343885655293952
 */
(function () {
	var shakeTime = 0,
		shakeTimeMax = 0,
		shakeIntensity = 2,
		lastTime = 0,
		particles = [],
		particlePointer = 0,
		MAX_PARTICLES = 20,
		PARTICLE_NUM_RANGE = { min: 2, max: 5 },
		PARTICLE_GRAVITY = 0.07,
		PARTICLE_ALPHA_FADEOUT = 0.96,
		PARTICLE_VELOCITY_RANGE = { x: [-1, 1], y: [-3.5, -1.5] },
		COLORS = ['#69D2E7', '#A0D468', '#AC92EC', '#F38630', '#FA6900', '#ED5565', '#F9D423'],
		w = window.innerWidth,
		h = window.innerHeight,
		effect,
		isActive = false;

	var codemirrors = [], cmNode;
	var canvas, ctx;
	var throttledShake = throttle(shake, 100);
	var throttledSpawnParticles = throttle(spawnParticles, 100);

	function spawnParticles(cm, type) {
		var cursorPos = cm.getCursor();
		var pos = cm.cursorCoords();
		//var node = document.elementFromPoint(pos.left - 5, pos.top + 5);
		type = cm.getTokenAt(cursorPos);
		if (type) { type = type.type; }
		var numParticles = random(PARTICLE_NUM_RANGE.min, PARTICLE_NUM_RANGE.max);
		var color = randomcolor();
		for (var i = numParticles; i--;) {
			particles[particlePointer] = createParticle(pos.left + 20, pos.top, color);
			particlePointer = (particlePointer + 1) % MAX_PARTICLES;
		}
	}

	function createParticle(x, y, color) {
		var p = {
			x: x,
			y: y + 10,
			alpha: 1,
			color: color
		};
		if (effect === 1) {
			p.size = random(2, 4);
			p.vx = PARTICLE_VELOCITY_RANGE.x[0] + Math.random() * (PARTICLE_VELOCITY_RANGE.x[1] - PARTICLE_VELOCITY_RANGE.x[0]);
			p.vy = PARTICLE_VELOCITY_RANGE.y[0] + Math.random() * (PARTICLE_VELOCITY_RANGE.y[1] - PARTICLE_VELOCITY_RANGE.y[0]);
		} else if (effect === 2) {
			p.size = random(2, 8);
			p.drag = 0.92;
			p.vx = random(-3, 3);
			p.vy = random(-3, 3);
			p.wander = 0.15;
			p.theta = random(0, 360) * Math.PI / 180;
		}
		return p;
	}

	function effect1(particle) {
		particle.vy += PARTICLE_GRAVITY;
		particle.x += particle.vx;
		particle.y += particle.vy;
		particle.alpha *= PARTICLE_ALPHA_FADEOUT;
		ctx.fillStyle = particle.color;
		ctx.fillRect(Math.round(particle.x - 1), Math.round(particle.y - 1), particle.size, particle.size);
	}

	// Effect based on Soulwire's demo: http://codepen.io/soulwire/pen/foktm
	function effect2(particle) {
		particle.x += particle.vx;
		particle.y += particle.vy;
		particle.vx *= particle.drag;
		particle.vy *= particle.drag;
		particle.theta += random( -0.5, 0.5 );
		particle.vx += Math.sin(particle.theta) * 0.1;
		particle.vy += Math.cos(particle.theta) * 0.1;
		particle.size *= 0.96;
		ctx.fillStyle = particle.color;
		ctx.fillRect(Math.round(particle.x - 1), Math.round(particle.y - 1), particle.size, particle.size);
		// ctx.beginPath();
		// ctx.arc(Math.round(particle.x - 1), Math.round(particle.y - 1), particle.size, 0, 2 * Math.PI);
		// ctx.fill();
	}

	function drawParticles(timeDelta) {
		var particle;
		for (var i = particles.length; i--;) {
			particle = particles[i];
			if (!particle || particle.alpha < 0.01 || particle.size <= 0.5) { continue; }
			if (effect === 1) { effect1(particle); }
			else if (effect === 2) { effect2(particle); }
		}
	}

	function shake(editor, time) {
		cmNode = editor.getWrapperElement();
		shakeTime = shakeTimeMax = time;
	}

	function randomcolor() {
		return COLORS[(Math.random() * (COLORS.length + 1)) >> 0] || '#A0D468';
	}

	function random(min, max) {
		if (!max) { max = min; min = 0; }
		return min + ~~(Math.random() * (max - min + 1));
	}

	function throttle(callback, limit) {
		var wait = false;
		return function () {
			if (!wait) {
				callback.apply(this, arguments);
				wait = true;
				setTimeout(function () {
					wait = false;
				}, limit);
			}
		};
	}

	function loop() {
		if (!isActive) { return; }

		ctx.clearRect(0, 0, w, h);

		// get the time past the previous frame
		var current_time = new Date().getTime();
		if(!lastTime) lastTime = current_time;
		var dt = (current_time - lastTime) / 1000;
		lastTime = current_time;

		if (shakeTime > 0) {
			shakeTime -= dt;
			if (common.powermodeshaking) {
				var magnitude = (shakeTime / shakeTimeMax) * shakeIntensity;
				var shakeX = random(-magnitude, magnitude);
				var shakeY = random(-magnitude, magnitude);
				cmNode.style.transform = 'translate(' + shakeX + 'px,' + shakeY + 'px)';
			}
		}

		drawParticles();
		requestAnimationFrame(loop);
	}

	function onCodeMirrorChange(editor, a) {
		if (a.origin !== 'setValue' && a.origin) {
			if (editor.getOption('blastCode') === true || editor.getOption('blastCode').shake === undefined)
				throttledShake(editor, 0.1);
			throttledSpawnParticles(editor);
		}
	}

	function init(editor) {
		isActive = true;
		if (!canvas) {
			canvas = document.createElement('canvas');
			ctx = canvas.getContext('2d'),
			canvas.id = 'code-blast-canvas';
			canvas.style.position = 'absolute';
			canvas.style.top = 0;
			canvas.style.left = 0;
			canvas.style.zIndex = 1;
			canvas.style.pointerEvents = 'none';
			canvas.width = w;
			canvas.height = h;
			document.body.appendChild(canvas);
			loop();
		}

		editor.on('change', onCodeMirrorChange);
	}

	function destroy(editor) {
		editor.off('change', onCodeMirrorChange);
		codemirrors.splice(codemirrors.indexOf(editor), 1);
		if (!codemirrors.length) {
			isActive = false;
			if (canvas) {
				canvas.remove();
				canvas = null;
			}
		}
	}

	CodeMirror.defineOption('blastCode', false, function(editor, val, old) {
		if (val) {
			codemirrors.push(editor);
			effect = val.effect || 2;
			init(editor);
		} else {
			destroy(editor);
		}

	});
})();