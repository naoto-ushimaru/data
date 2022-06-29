(function() {
  var Point, Range, actionUtils, editorUtils, emmet, insertSnippet, normalize, path, preprocessSnippet, ref, resources, tabStops, utils, visualize;

  ref = require('atom'), Point = ref.Point, Range = ref.Range;

  path = require('path');

  emmet = require('emmet');

  utils = require('emmet/lib/utils/common');

  tabStops = require('emmet/lib/assets/tabStops');

  resources = require('emmet/lib/assets/resources');

  editorUtils = require('emmet/lib/utils/editor');

  actionUtils = require('emmet/lib/utils/action');

  insertSnippet = function(snippet, editor) {
    var ref1, ref2, ref3, ref4;
    if ((ref1 = atom.packages.getLoadedPackage('snippets')) != null) {
      if ((ref2 = ref1.mainModule) != null) {
        ref2.insert(snippet, editor);
      }
    }
    return editor.snippetExpansion = (ref3 = atom.packages.getLoadedPackage('snippets')) != null ? (ref4 = ref3.mainModule) != null ? ref4.getExpansions(editor)[0] : void 0 : void 0;
  };

  visualize = function(str) {
    return str.replace(/\t/g, '\\t').replace(/\n/g, '\\n').replace(/\s/g, '\\s');
  };

  normalize = function(text, editor) {
    return editorUtils.normalize(text, {
      indentation: editor.getTabText(),
      newline: '\n'
    });
  };

  preprocessSnippet = function(value) {
    var order, tabstopOptions;
    order = [];
    tabstopOptions = {
      tabstop: function(data) {
        var group, placeholder;
        group = parseInt(data.group, 10);
        if (group === 0) {
          order.push(-1);
          group = order.length;
        } else {
          if (order.indexOf(group) === -1) {
            order.push(group);
          }
          group = order.indexOf(group) + 1;
        }
        placeholder = data.placeholder || '';
        if (placeholder) {
          placeholder = tabStops.processText(placeholder, tabstopOptions);
        }
        if (placeholder) {
          return "${" + group + ":" + placeholder + "}";
        } else {
          return "${" + group + "}";
        }
      },
      escape: function(ch) {
        if (ch === '$') {
          return '\\$';
        } else {
          return ch;
        }
      }
    };
    return tabStops.processText(value, tabstopOptions);
  };

  module.exports = {
    setup: function(editor1, selectionIndex) {
      var buf, bufRanges;
      this.editor = editor1;
      this.selectionIndex = selectionIndex != null ? selectionIndex : 0;
      buf = this.editor.getBuffer();
      bufRanges = this.editor.getSelectedBufferRanges();
      return this._selection = {
        index: 0,
        saved: new Array(bufRanges.length),
        bufferRanges: bufRanges,
        indexRanges: bufRanges.map(function(range) {
          return {
            start: buf.characterIndexForPosition(range.start),
            end: buf.characterIndexForPosition(range.end)
          };
        })
      };
    },
    exec: function(fn) {
      var ix, success;
      ix = this._selection.bufferRanges.length - 1;
      this._selection.saved = [];
      success = true;
      while (ix >= 0) {
        this._selection.index = ix;
        if (fn(this._selection.index) === false) {
          success = false;
          break;
        }
        ix--;
      }
      if (success && this._selection.saved.length > 1) {
        return this._setSelectedBufferRanges(this._selection.saved);
      }
    },
    _setSelectedBufferRanges: function(sels) {
      var filteredSels;
      filteredSels = sels.filter(function(s) {
        return !!s;
      });
      if (filteredSels.length) {
        return this.editor.setSelectedBufferRanges(filteredSels);
      }
    },
    _saveSelection: function(delta) {
      var i, range, results;
      this._selection.saved[this._selection.index] = this.editor.getSelectedBufferRange();
      if (delta) {
        i = this._selection.index;
        delta = Point.fromObject([delta, 0]);
        results = [];
        while (++i < this._selection.saved.length) {
          range = this._selection.saved[i];
          if (range) {
            results.push(this._selection.saved[i] = new Range(range.start.translate(delta), range.end.translate(delta)));
          } else {
            results.push(void 0);
          }
        }
        return results;
      }
    },
    selectionList: function() {
      return this._selection.indexRanges;
    },
    getCaretPos: function() {
      return this.getSelectionRange().start;
    },
    setCaretPos: function(pos) {
      return this.createSelection(pos);
    },
    getSelectionRange: function() {
      return this._selection.indexRanges[this._selection.index];
    },
    getSelectionBufferRange: function() {
      return this._selection.bufferRanges[this._selection.index];
    },
    createSelection: function(start, end) {
      var buf, sels;
      if (end == null) {
        end = start;
      }
      sels = this._selection.bufferRanges;
      buf = this.editor.getBuffer();
      sels[this._selection.index] = new Range(buf.positionForCharacterIndex(start), buf.positionForCharacterIndex(end));
      return this._setSelectedBufferRanges(sels);
    },
    getSelection: function() {
      return this.editor.getTextInBufferRange(this.getSelectionBufferRange());
    },
    getCurrentLineRange: function() {
      var index, lineLength, row, sel;
      sel = this.getSelectionBufferRange();
      row = sel.getRows()[0];
      lineLength = this.editor.lineTextForBufferRow(row).length;
      index = this.editor.getBuffer().characterIndexForPosition({
        row: row,
        column: 0
      });
      return {
        start: index,
        end: index + lineLength
      };
    },
    getCurrentLine: function() {
      var row, sel;
      sel = this.getSelectionBufferRange();
      row = sel.getRows()[0];
      return this.editor.lineTextForBufferRow(row);
    },
    getContent: function() {
      return this.editor.getText();
    },
    replaceContent: function(value, start, end, noIndent) {
      var buf, caret, changeRange, oldValue;
      if (end == null) {
        end = start == null ? this.getContent().length : start;
      }
      if (start == null) {
        start = 0;
      }
      value = normalize(value, this.editor);
      buf = this.editor.getBuffer();
      changeRange = new Range(Point.fromObject(buf.positionForCharacterIndex(start)), Point.fromObject(buf.positionForCharacterIndex(end)));
      oldValue = this.editor.getTextInBufferRange(changeRange);
      buf.setTextInRange(changeRange, '');
      caret = buf.positionForCharacterIndex(start);
      this.editor.setSelectedBufferRange(new Range(caret, caret));
      insertSnippet(preprocessSnippet(value), this.editor);
      this._saveSelection(utils.splitByLines(value).length - utils.splitByLines(oldValue).length);
      return value;
    },
    getGrammar: function() {
      return this.editor.getGrammar().scopeName.toLowerCase();
    },
    getSyntax: function() {
      var m, ref1, scope, sourceSyntax, syntax;
      scope = this.getCurrentScope().join(' ');
      if (~scope.indexOf('xsl')) {
        return 'xsl';
      }
      if (!/\bstring\b/.test(scope) && /\bsource\.(js|ts)x?\b/.test(scope)) {
        return 'jsx';
      }
      sourceSyntax = (ref1 = scope.match(/\bsource\.([\w\-]+)/)) != null ? ref1[0] : void 0;
      if (!/\bstring\b/.test(scope) && sourceSyntax && resources.hasSyntax(sourceSyntax)) {
        syntax = sourceSyntax;
      } else {
        m = scope.match(/\b(source|text)\.[\w\-\.]+/);
        syntax = m != null ? m[0].split('.').reduceRight(function(result, token) {
          return result || (resources.hasSyntax(token) ? token : void 0);
        }, null) : void 0;
      }
      return actionUtils.detectSyntax(this, syntax || 'html');
    },
    getCurrentScope: function() {
      var range;
      range = this._selection.bufferRanges[this._selection.index];
      return this.editor.scopeDescriptorForBufferPosition(range.start).getScopesArray();
    },
    getProfileName: function() {
      if (this.getCurrentScope().some(function(scope) {
        return /\bstring\.quoted\b/.test(scope);
      })) {
        return 'line';
      } else {
        return actionUtils.detectProfile(this);
      }
    },
    getFilePath: function() {
      return this.editor.buffer.file.path;
    }
  };

}).call(this);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiL1VzZXJzL3VzaGltYXJ1Ly5hdG9tL3BhY2thZ2VzL2VtbWV0L2xpYi9lZGl0b3ItcHJveHkuY29mZmVlIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQUEsTUFBQTs7RUFBQSxNQUFpQixPQUFBLENBQVEsTUFBUixDQUFqQixFQUFDLGlCQUFELEVBQVE7O0VBQ1IsSUFBQSxHQUFpQixPQUFBLENBQVEsTUFBUjs7RUFFakIsS0FBQSxHQUFjLE9BQUEsQ0FBUSxPQUFSOztFQUNkLEtBQUEsR0FBYyxPQUFBLENBQVEsd0JBQVI7O0VBQ2QsUUFBQSxHQUFjLE9BQUEsQ0FBUSwyQkFBUjs7RUFDZCxTQUFBLEdBQWMsT0FBQSxDQUFRLDRCQUFSOztFQUNkLFdBQUEsR0FBYyxPQUFBLENBQVEsd0JBQVI7O0VBQ2QsV0FBQSxHQUFjLE9BQUEsQ0FBUSx3QkFBUjs7RUFFZCxhQUFBLEdBQWdCLFNBQUMsT0FBRCxFQUFVLE1BQVY7QUFDZCxRQUFBOzs7WUFBc0QsQ0FBRSxNQUF4RCxDQUErRCxPQUEvRCxFQUF3RSxNQUF4RTs7O1dBR0EsTUFBTSxDQUFDLGdCQUFQLHdHQUFnRixDQUFFLGFBQXhELENBQXNFLE1BQXRFLENBQThFLENBQUEsQ0FBQTtFQUoxRjs7RUFNaEIsU0FBQSxHQUFZLFNBQUMsR0FBRDtXQUNWLEdBQ0UsQ0FBQyxPQURILENBQ1csS0FEWCxFQUNrQixLQURsQixDQUVFLENBQUMsT0FGSCxDQUVXLEtBRlgsRUFFa0IsS0FGbEIsQ0FHRSxDQUFDLE9BSEgsQ0FHVyxLQUhYLEVBR2tCLEtBSGxCO0VBRFU7O0VBV1osU0FBQSxHQUFZLFNBQUMsSUFBRCxFQUFPLE1BQVA7V0FDVixXQUFXLENBQUMsU0FBWixDQUFzQixJQUF0QixFQUNFO01BQUEsV0FBQSxFQUFhLE1BQU0sQ0FBQyxVQUFQLENBQUEsQ0FBYjtNQUNBLE9BQUEsRUFBUyxJQURUO0tBREY7RUFEVTs7RUFRWixpQkFBQSxHQUFvQixT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Q0osTUFBQSxlQUFTLENBQUcsQ0FBQSxDQUFBLENBQUUsQ0FBQyxLQUFOLENBQVksR0FBWixDQUFnQixDQUFDLFdBQWpCLENBQTZCLFNBQUMsTUFBRCxFQUFTLEtBQVQ7aUJBQ2xDLE1BQUEsSUFBVSxDQUFVLFNBQVMsQ0FBQyxTQUFWLENBQW9CLEtBQXBCLENBQVQsR0FBQSxLQUFBLEdBQUEsTUFBRDtRQUR3QixDQUE3QixFQUVMLElBRkssV0FMWDs7YUFTQSxXQUFXLENBQUMsWUFBWixDQUF5QixJQUF6QixFQUE0QixNQUFBLElBQVUsTUFBdEM7SUFoQlMsQ0FqSlg7SUFtS0EsZUFBQSxFQUFpQixTQUFBO0FBQ2YsVUFBQTtNQUFBLEtBQUEsR0FBUSxJQUFDLENBQUEsVUFBVSxDQUFDLFlBQWEsQ0FBQSxJQUFDLENBQUEsVUFBVSxDQUFDLEtBQVo7YUFDakMsSUFBQyxDQUFBLE1BQU0sQ0FBQyxnQ0FBUixDQUF5QyxLQUFLLENBQUMsS0FBL0MsQ0FBcUQsQ0FBQyxjQUF0RCxDQUFBO0lBRmUsQ0FuS2pCO0lBMEtBLGNBQUEsRUFBZ0IsU0FBQTtNQUNQLElBQUcsSUFBQyxDQUFBLGVBQUQsQ0FBQSxDQUFrQixDQUFDLElBQW5CLENBQXdCLFNBQUMsS0FBRDtlQUFXLG9CQUFvQixDQUFDLElBQXJCLENBQTBCLEtBQTFCO01BQVgsQ0FBeEIsQ0FBSDtlQUE0RSxPQUE1RTtPQUFBLE1BQUE7ZUFBd0YsV0FBVyxDQUFDLGFBQVosQ0FBMEIsSUFBMUIsRUFBeEY7O0lBRE8sQ0ExS2hCO0lBOEtBLFdBQUEsRUFBYSxTQUFBO2FBRVgsSUFBQyxDQUFBLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO0lBRlQsQ0E5S2I7O0FBN0RGIiwic291cmNlc0NvbnRlbnQiOlsie1BvaW50LCBSYW5nZX0gPSByZXF1aXJlICdhdG9tJ1xucGF0aCAgICAgICAgICAgPSByZXF1aXJlICdwYXRoJ1xuXG5lbW1ldCAgICAgICA9IHJlcXVpcmUgJ2VtbWV0J1xudXRpbHMgICAgICAgPSByZXF1aXJlICdlbW1ldC9saWIvdXRpbHMvY29tbW9uJ1xudGFiU3RvcHMgICAgPSByZXF1aXJlICdlbW1ldC9saWIvYXNzZXRzL3RhYlN0b3BzJ1xucmVzb3VyY2VzICAgPSByZXF1aXJlICdlbW1ldC9saWIvYXNzZXRzL3Jlc291cmNlcydcbmVkaXRvclV0aWxzID0gcmVxdWlyZSAnZW1tZXQvbGliL3V0aWxzL2VkaXRvcidcbmFjdGlvblV0aWxzID0gcmVxdWlyZSAnZW1tZXQvbGliL3V0aWxzL2FjdGlvbidcblxuaW5zZXJ0U25pcHBldCA9IChzbmlwcGV0LCBlZGl0b3IpIC0+XG4gIGF0b20ucGFja2FnZXMuZ2V0TG9hZGVkUGFja2FnZSgnc25pcHBldHMnKT8ubWFpbk1vZHVsZT8uaW5zZXJ0KHNuaXBwZXQsIGVkaXRvcilcblxuICAjIEZldGNoIGV4cGFuc2lvbnMgYW5kIGFzc2lnbiB0byBlZGl0b3JcbiAgZWRpdG9yLnNuaXBwZXRFeHBhbnNpb24gPSBhdG9tLnBhY2thZ2VzLmdldExvYWRlZFBhY2thZ2UoJ3NuaXBwZXRzJyk/Lm1haW5Nb2R1bGU/LmdldEV4cGFuc2lvbnMoZWRpdG9yKVswXVxuXG52aXN1YWxpemUgPSAoc3RyKSAtPlxuICBzdHJcbiAgICAucmVwbGFjZSgvXFx0L2csICdcXFxcdCcpXG4gICAgLnJlcGxhY2UoL1xcbi9nLCAnXFxcXG4nKVxuICAgIC5yZXBsYWNlKC9cXHMvZywgJ1xcXFxzJylcblxuIyBOb3JtYWxpemVzIHRleHQgYmVmb3JlIGl0IGdvZXMgdG8gZWRpdG9yOiByZXBsYWNlcyBpbmRlbnRhdGlvblxuIyBhbmQgbmV3bGluZXMgd2l0aCBvbmVzIHVzZWQgaW4gZWRpdG9yXG4jIEBwYXJhbSAge1N0cmluZ30gdGV4dCAgIFRleHQgdG8gbm9ybWFsaXplXG4jIEBwYXJhbSAge0VkaXRvcn0gZWRpdG9yIEJyYWNrZXRzIGVkaXRvciBpbnN0YW5jZVxuIyBAcmV0dXJuIHtTdHJpbmd9XG5ub3JtYWxpemUgPSAodGV4dCwgZWRpdG9yKSAtPlxuICBlZGl0b3JVdGlscy5ub3JtYWxpemUgdGV4dCxcbiAgICBpbmRlbnRhdGlvbjogZWRpdG9yLmdldFRhYlRleHQoKSxcbiAgICBuZXdsaW5lOiAnXFxuJ1xuXG4jIFByb3Byb2Nlc3MgdGV4dCBkYXRhIHRoYXQgc2hvdWxkIGJlIHVzZWQgYXMgc25pcHBldCBjb250ZW50XG4jIEN1cnJlbnRseSwgQXRvbeKAmXMgc25pcHBldHMgaW1wbGVtZW50YXRpb24gaGFzIHRoZSBmb2xsb3dpbmcgaXNzdWVzOlxuIyAqIG11bHRpcGxlICQwIGFyZSBub3QgdHJlYXRlZCBhcyBkaXN0aW5jdCBmaW5hbCB0YWJzdG9wc1xucHJlcHJvY2Vzc1NuaXBwZXQgPSAodmFsdWUpIC0+XG4gIG9yZGVyID0gW11cblxuICB0YWJzdG9wT3B0aW9ucyA9XG4gICAgdGFic3RvcDogKGRhdGEpIC0+XG4gICAgICBncm91cCA9IHBhcnNlSW50KGRhdGEuZ3JvdXAsIDEwKVxuICAgICAgaWYgZ3JvdXAgaXMgMFxuICAgICAgICBvcmRlci5wdXNoKC0xKVxuICAgICAgICBncm91cCA9IG9yZGVyLmxlbmd0aFxuICAgICAgZWxzZVxuICAgICAgICBvcmRlci5wdXNoKGdyb3VwKSBpZiBvcmRlci5pbmRleE9mKGdyb3VwKSBpcyAtMVxuICAgICAgICBncm91cCA9IG9yZGVyLmluZGV4T2YoZ3JvdXApICsgMVxuXG4gICAgICBwbGFjZWhvbGRlciA9IGRhdGEucGxhY2Vob2xkZXIgb3IgJydcbiAgICAgIGlmIHBsYWNlaG9sZGVyXG4gICAgICAgICMgcmVjdXJzaXZlbHkgdXBkYXRlIG5lc3RlZCB0YWJzdG9wc1xuICAgICAgICBwbGFjZWhvbGRlciA9IHRhYlN0b3BzLnByb2Nlc3NUZXh0KHBsYWNlaG9sZGVyLCB0YWJzdG9wT3B0aW9ucylcblxuICAgICAgaWYgcGxhY2Vob2xkZXIgdGhlbiBcIiR7I3tncm91cH06I3twbGFjZWhvbGRlcn19XCIgZWxzZSBcIiR7I3tncm91cH19XCJcblxuICAgIGVzY2FwZTogKGNoKSAtPlxuICAgICAgaWYgY2ggPT0gJyQnIHRoZW4gJ1xcXFwkJyBlbHNlIGNoXG5cbiAgdGFiU3RvcHMucHJvY2Vzc1RleHQodmFsdWUsIHRhYnN0b3BPcHRpb25zKVxuXG5tb2R1bGUuZXhwb3J0cyA9XG4gIHNldHVwOiAoQGVkaXRvciwgQHNlbGVjdGlvbkluZGV4PTApIC0+XG4gICAgYnVmID0gQGVkaXRvci5nZXRCdWZmZXIoKVxuICAgIGJ1ZlJhbmdlcyA9IEBlZGl0b3IuZ2V0U2VsZWN0ZWRCdWZmZXJSYW5nZXMoKVxuICAgIEBfc2VsZWN0aW9uID1cbiAgICAgIGluZGV4OiAwXG4gICAgICBzYXZlZDogbmV3IEFycmF5KGJ1ZlJhbmdlcy5sZW5ndGgpXG4gICAgICBidWZmZXJSYW5nZXM6IGJ1ZlJhbmdlc1xuICAgICAgaW5kZXhSYW5nZXM6IGJ1ZlJhbmdlcy5tYXAgKHJhbmdlKSAtPlxuICAgICAgICAgIHN0YXJ0OiBidWYuY2hhcmFjdGVySW5kZXhGb3JQb3NpdGlvbihyYW5nZS5zdGFydClcbiAgICAgICAgICBlbmQ6ICAgYnVmLmNoYXJhY3RlckluZGV4Rm9yUG9zaXRpb24ocmFuZ2UuZW5kKVxuXG4gICMgRXhlY3V0ZXMgZ2l2ZW4gZnVuY3Rpb24gZm9yIGV2ZXJ5IHNlbGVjdGlvblxuICBleGVjOiAoZm4pIC0+XG4gICAgaXggPSBAX3NlbGVjdGlvbi5idWZmZXJSYW5nZXMubGVuZ3RoIC0gMVxuICAgIEBfc2VsZWN0aW9uLnNhdmVkID0gW11cbiAgICBzdWNjZXNzID0gdHJ1ZVxuICAgIHdoaWxlIGl4ID49IDBcbiAgICAgIEBfc2VsZWN0aW9uLmluZGV4ID0gaXhcbiAgICAgIGlmIGZuKEBfc2VsZWN0aW9uLmluZGV4KSBpcyBmYWxzZVxuICAgICAgICBzdWNjZXNzID0gZmFsc2VcbiAgICAgICAgYnJlYWtcbiAgICAgIGl4LS1cblxuICAgIGlmIHN1Y2Nlc3MgYW5kIEBfc2VsZWN0aW9uLnNhdmVkLmxlbmd0aCA+IDFcbiAgICAgIEBfc2V0U2VsZWN0ZWRCdWZmZXJSYW5nZXMoQF9zZWxlY3Rpb24uc2F2ZWQpXG5cbiAgX3NldFNlbGVjdGVkQnVmZmVyUmFuZ2VzOiAoc2VscykgLT5cbiAgICBmaWx0ZXJlZFNlbHMgPSBzZWxzLmZpbHRlciAocykgLT4gISFzXG4gICAgaWYgZmlsdGVyZWRTZWxzLmxlbmd0aFxuICAgICAgQGVkaXRvci5zZXRTZWxlY3RlZEJ1ZmZlclJhbmdlcyhmaWx0ZXJlZFNlbHMpXG5cbiAgX3NhdmVTZWxlY3Rpb246IChkZWx0YSkgLT5cbiAgICBAX3NlbGVjdGlvbi5zYXZlZFtAX3NlbGVjdGlvbi5pbmRleF0gPSBAZWRpdG9yLmdldFNlbGVjdGVkQnVmZmVyUmFuZ2UoKVxuICAgIGlmIGRlbHRhXG4gICAgICBpID0gQF9zZWxlY3Rpb24uaW5kZXhcbiAgICAgIGRlbHRhID0gUG9pbnQuZnJvbU9iamVjdChbZGVsdGEsIDBdKVxuICAgICAgd2hpbGUgKytpIDwgQF9zZWxlY3Rpb24uc2F2ZWQubGVuZ3RoXG4gICAgICAgIHJhbmdlID0gQF9zZWxlY3Rpb24uc2F2ZWRbaV1cbiAgICAgICAgaWYgcmFuZ2VcbiAgICAgICAgICBAX3NlbGVjdGlvbi5zYXZlZFtpXSA9IG5ldyBSYW5nZShyYW5nZS5zdGFydC50cmFuc2xhdGUoZGVsdGEpLCByYW5nZS5lbmQudHJhbnNsYXRlKGRlbHRhKSlcblxuICBzZWxlY3Rpb25MaXN0OiAtPlxuICAgIEBfc2VsZWN0aW9uLmluZGV4UmFuZ2VzXG5cbiAgIyBSZXR1cm5zIHRoZSBjdXJyZW50IGNhcmV0IHBvc2l0aW9uLlxuICBnZXRDYXJldFBvczogLT5cbiAgICBAZ2V0U2VsZWN0aW9uUmFuZ2UoKS5zdGFydFxuXG4gICMgU2V0cyB0aGUgY3VycmVudCBjYXJldCBwb3NpdGlvbi5cbiAgc2V0Q2FyZXRQb3M6IChwb3MpIC0+XG4gICAgQGNyZWF0ZVNlbGVjdGlvbihwb3MpXG5cbiAgIyBGZXRjaGVzIHRoZSBjaGFyYWN0ZXIgaW5kZXhlcyBvZiB0aGUgc2VsZWN0ZWQgdGV4dC5cbiAgIyBSZXR1cm5zIGFuIHtPYmplY3R9IHdpdGggYHN0YXJ0YCBhbmQgYGVuZGAgcHJvcGVydGllcy5cbiAgZ2V0U2VsZWN0aW9uUmFuZ2U6IC0+XG4gICAgQF9zZWxlY3Rpb24uaW5kZXhSYW5nZXNbQF9zZWxlY3Rpb24uaW5kZXhdXG5cbiAgZ2V0U2VsZWN0aW9uQnVmZmVyUmFuZ2U6IC0+XG4gICAgQF9zZWxlY3Rpb24uYnVmZmVyUmFuZ2VzW0Bfc2VsZWN0aW9uLmluZGV4XVxuXG4gICMgQ3JlYXRlcyBhIHNlbGVjdGlvbiBmcm9tIHRoZSBgc3RhcnRgIHRvIGBlbmRgIGNoYXJhY3RlciBpbmRleGVzLlxuICAjXG4gICMgSWYgYGVuZGAgaXMgb21taXRlZCwgdGhpcyBtZXRob2Qgc2hvdWxkIHBsYWNlIGEgY2FyZXQgYXQgdGhlIGBzdGFydGAgaW5kZXguXG4gICNcbiAgIyBzdGFydCAtIEEge051bWJlcn0gcmVwcmVzZW50aW5nIHRoZSBzdGFydGluZyBjaGFyYWN0ZXIgaW5kZXhcbiAgIyBlbmQgLSBBIHtOdW1iZXJ9IHJlcHJlc2VudGluZyB0aGUgZW5kaW5nIGNoYXJhY3RlciBpbmRleFxuICBjcmVhdGVTZWxlY3Rpb246IChzdGFydCwgZW5kPXN0YXJ0KSAtPlxuICAgIHNlbHMgPSBAX3NlbGVjdGlvbi5idWZmZXJSYW5nZXNcbiAgICBidWYgPSBAZWRpdG9yLmdldEJ1ZmZlcigpXG4gICAgc2Vsc1tAX3NlbGVjdGlvbi5pbmRleF0gPSBuZXcgUmFuZ2UoYnVmLnBvc2l0aW9uRm9yQ2hhcmFjdGVySW5kZXgoc3RhcnQpLCBidWYucG9zaXRpb25Gb3JDaGFyYWN0ZXJJbmRleChlbmQpKVxuICAgIEBfc2V0U2VsZWN0ZWRCdWZmZXJSYW5nZXMoc2VscylcblxuICAjIFJldHVybnMgdGhlIGN1cnJlbnRseSBzZWxlY3RlZCB0ZXh0LlxuICBnZXRTZWxlY3Rpb246IC0+XG4gICAgQGVkaXRvci5nZXRUZXh0SW5CdWZmZXJSYW5nZShAZ2V0U2VsZWN0aW9uQnVmZmVyUmFuZ2UoKSlcblxuICAjIEZldGNoZXMgdGhlIGN1cnJlbnQgbGluZSdzIHN0YXJ0IGFuZCBlbmQgaW5kZXhlcy5cbiAgI1xuICAjIFJldHVybnMgYW4ge09iamVjdH0gd2l0aCBgc3RhcnRgIGFuZCBgZW5kYCBwcm9wZXJ0aWVzXG4gIGdldEN1cnJlbnRMaW5lUmFuZ2U6IC0+XG4gICAgc2VsID0gQGdldFNlbGVjdGlvbkJ1ZmZlclJhbmdlKClcbiAgICByb3cgPSBzZWwuZ2V0Um93cygpWzBdXG4gICAgbGluZUxlbmd0aCA9IEBlZGl0b3IubGluZVRleHRGb3JCdWZmZXJSb3cocm93KS5sZW5ndGhcbiAgICBpbmRleCA9IEBlZGl0b3IuZ2V0QnVmZmVyKCkuY2hhcmFjdGVySW5kZXhGb3JQb3NpdGlvbih7cm93OiByb3csIGNvbHVtbjogMH0pXG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXJ0OiBpbmRleFxuICAgICAgZW5kOiBpbmRleCArIGxpbmVMZW5ndGhcbiAgICB9XG5cbiAgIyBSZXR1cm5zIHRoZSBjdXJyZW50IGxpbmUuXG4gIGdldEN1cnJlbnRMaW5lOiAtPlxuICAgIHNlbCA9IEBnZXRTZWxlY3Rpb25CdWZmZXJSYW5nZSgpXG4gICAgcm93ID0gc2VsLmdldFJvd3MoKVswXVxuICAgIHJldHVybiBAZWRpdG9yLmxpbmVUZXh0Rm9yQnVmZmVyUm93KHJvdylcblxuICAjIFJldHVybnMgdGhlIGVkaXRvciBjb250ZW50LlxuICBnZXRDb250ZW50OiAtPlxuICAgIHJldHVybiBAZWRpdG9yLmdldFRleHQoKVxuXG4gICMgUmVwbGFjZSB0aGUgZWRpdG9yJ3MgY29udGVudCAob3IgcGFydCBvZiBpdCwgaWYgdXNpbmcgYHN0YXJ0YCB0b1xuICAjIGBlbmRgIGluZGV4KS5cbiAgI1xuICAjIElmIGB2YWx1ZWAgY29udGFpbnMgYGNhcmV0X3BsYWNlaG9sZGVyYCwgdGhlIGVkaXRvciBwdXRzIGEgY2FyZXQgaW50b1xuICAjIHRoaXMgcG9zaXRpb24uIElmIHlvdSBza2lwIHRoZSBgc3RhcnRgIGFuZCBgZW5kYCBhcmd1bWVudHMsIHRoZSB3aG9sZSB0YXJnZXQnc1xuICAjIGNvbnRlbnQgaXMgcmVwbGFjZWQgd2l0aCBgdmFsdWVgLlxuICAjXG4gICMgSWYgeW91IHBhc3MganVzdCB0aGUgYHN0YXJ0YCBhcmd1bWVudCwgdGhlIGB2YWx1ZWAgaXMgcGxhY2VkIGF0IHRoZSBgc3RhcnRgIHN0cmluZ1xuICAjIGluZGV4IG9mIHRociBjdXJyZW50IGNvbnRlbnQuXG4gICNcbiAgIyBJZiB5b3UgcGFzcyBib3RoIGBzdGFydGAgYW5kIGBlbmRgIGFyZ3VtZW50cywgdGhlIGNvcnJlc3BvbmRpbmcgc3Vic3RyaW5nIG9mXG4gICMgdGhlIGN1cnJlbnQgdGFyZ2V0J3MgY29udGVudCBpcyByZXBsYWNlZCB3aXRoIGB2YWx1ZWAuXG4gICNcbiAgIyB2YWx1ZSAtIEEge1N0cmluZ30gb2YgY29udGVudCB5b3Ugd2FudCB0byBwYXN0ZVxuICAjIHN0YXJ0IC0gVGhlIG9wdGlvbmFsIHN0YXJ0IGluZGV4IHtOdW1iZXJ9IG9mIHRoZSBlZGl0b3IncyBjb250ZW50XG4gICMgZW5kIC0gVGhlIG9wdGlvbmFsIGVuZCBpbmRleCB7TnVtYmVyfSBvZiB0aGUgZWRpdG9yJ3MgY29udGVudFxuICAjIG5vSWRlbnQgLSBBbiBvcHRpb25hbCB7Qm9vbGVhbn0gd2hpY2gsIGlmIGB0cnVlYCwgZG9lcyBub3QgYXR0ZW1wdCB0byBhdXRvIGluZGVudCBgdmFsdWVgXG4gIHJlcGxhY2VDb250ZW50OiAodmFsdWUsIHN0YXJ0LCBlbmQsIG5vSW5kZW50KSAtPlxuICAgIHVubGVzcyBlbmQ/XG4gICAgICBlbmQgPSB1bmxlc3Mgc3RhcnQ/IHRoZW4gQGdldENvbnRlbnQoKS5sZW5ndGggZWxzZSBzdGFydFxuICAgIHN0YXJ0ID0gMCB1bmxlc3Mgc3RhcnQ/XG5cbiAgICB2YWx1ZSA9IG5vcm1hbGl6ZSh2YWx1ZSwgQGVkaXRvcilcbiAgICBidWYgPSBAZWRpdG9yLmdldEJ1ZmZlcigpXG4gICAgY2hhbmdlUmFuZ2UgPSBuZXcgUmFuZ2UoXG4gICAgICBQb2ludC5mcm9tT2JqZWN0KGJ1Zi5wb3NpdGlvbkZvckNoYXJhY3RlckluZGV4KHN0YXJ0KSksXG4gICAgICBQb2ludC5mcm9tT2JqZWN0KGJ1Zi5wb3NpdGlvbkZvckNoYXJhY3RlckluZGV4KGVuZCkpXG4gICAgKVxuXG4gICAgb2xkVmFsdWUgPSBAZWRpdG9yLmdldFRleHRJbkJ1ZmZlclJhbmdlKGNoYW5nZVJhbmdlKVxuICAgIGJ1Zi5zZXRUZXh0SW5SYW5nZShjaGFuZ2VSYW5nZSwgJycpXG4gICAgIyBCZWZvcmUgaW5zZXJ0aW5nIHNuaXBwZXQgd2UgaGF2ZSB0byByZXNldCBhbGwgYXZhaWxhYmxlIHNlbGVjdGlvbnNcbiAgICAjIHRvIGluc2VydCBzbmlwcGVudCByaWdodCBpbiByZXF1aXJlZCBwbGFjZS4gT3RoZXJ3aXNlIHNuaXBwZXRcbiAgICAjIHdpbGwgYmUgaW5zZXJ0ZWQgZm9yIGVhY2ggc2VsZWN0aW9uIGluIGVkaXRvclxuXG4gICAgIyBSaWdodCBhZnRlciB0aGF0IHdlIHNob3VsZCBzYXZlIGZpcnN0IGF2YWlsYWJsZSBzZWxlY3Rpb24gYXMgYnVmZmVyIHJhbmdlXG4gICAgY2FyZXQgPSBidWYucG9zaXRpb25Gb3JDaGFyYWN0ZXJJbmRleChzdGFydClcbiAgICBAZWRpdG9yLnNldFNlbGVjdGVkQnVmZmVyUmFuZ2UobmV3IFJhbmdlKGNhcmV0LCBjYXJldCkpXG4gICAgaW5zZXJ0U25pcHBldCBwcmVwcm9jZXNzU25pcHBldCh2YWx1ZSksIEBlZGl0b3JcbiAgICBAX3NhdmVTZWxlY3Rpb24odXRpbHMuc3BsaXRCeUxpbmVzKHZhbHVlKS5sZW5ndGggLSB1dGlscy5zcGxpdEJ5TGluZXMob2xkVmFsdWUpLmxlbmd0aClcbiAgICB2YWx1ZVxuXG4gIGdldEdyYW1tYXI6IC0+XG4gICAgQGVkaXRvci5nZXRHcmFtbWFyKCkuc2NvcGVOYW1lLnRvTG93ZXJDYXNlKClcblxuICAjIFJldHVybnMgdGhlIGVkaXRvcidzIHN5bnRheCBtb2RlLlxuICBnZXRTeW50YXg6IC0+XG4gICAgc2NvcGUgPSBAZ2V0Q3VycmVudFNjb3BlKCkuam9pbignICcpXG4gICAgcmV0dXJuICd4c2wnIGlmIH5zY29wZS5pbmRleE9mKCd4c2wnKVxuICAgIHJldHVybiAnanN4JyBpZiBub3QgL1xcYnN0cmluZ1xcYi8udGVzdChzY29wZSkgJiYgL1xcYnNvdXJjZVxcLihqc3x0cyl4P1xcYi8udGVzdChzY29wZSlcblxuICAgIHNvdXJjZVN5bnRheCA9IHNjb3BlLm1hdGNoKC9cXGJzb3VyY2VcXC4oW1xcd1xcLV0rKS8pP1swXVxuXG4gICAgaWYgbm90IC9cXGJzdHJpbmdcXGIvLnRlc3Qoc2NvcGUpICYmIHNvdXJjZVN5bnRheCAmJiByZXNvdXJjZXMuaGFzU3ludGF4KHNvdXJjZVN5bnRheClcbiAgICAgIHN5bnRheCA9IHNvdXJjZVN5bnRheDtcbiAgICBlbHNlXG4gICAgICAjIHByb2JlIHN5bnRheCBiYXNlZCBvbiBjdXJyZW50IHNlbGVjdG9yXG4gICAgICBtID0gc2NvcGUubWF0Y2goL1xcYihzb3VyY2V8dGV4dClcXC5bXFx3XFwtXFwuXSsvKVxuICAgICAgc3ludGF4ID0gbT9bMF0uc3BsaXQoJy4nKS5yZWR1Y2VSaWdodCAocmVzdWx0LCB0b2tlbikgLT5cbiAgICAgICAgICByZXN1bHQgb3IgKHRva2VuIGlmIHJlc291cmNlcy5oYXNTeW50YXggdG9rZW4pXG4gICAgICAgICwgbnVsbFxuXG4gICAgYWN0aW9uVXRpbHMuZGV0ZWN0U3ludGF4KEAsIHN5bnRheCBvciAnaHRtbCcpXG5cbiAgZ2V0Q3VycmVudFNjb3BlOiAtPlxuICAgIHJhbmdlID0gQF9zZWxlY3Rpb24uYnVmZmVyUmFuZ2VzW0Bfc2VsZWN0aW9uLmluZGV4XVxuICAgIEBlZGl0b3Iuc2NvcGVEZXNjcmlwdG9yRm9yQnVmZmVyUG9zaXRpb24ocmFuZ2Uuc3RhcnQpLmdldFNjb3Blc0FycmF5KClcblxuICAjIFJldHVybnMgdGhlIGN1cnJlbnQgb3V0cHV0IHByb2ZpbGUgbmFtZVxuICAjXG4gICMgU2VlIGVtbWV0LnNldHVwUHJvZmlsZSBmb3IgbW9yZSBpbmZvcm1hdGlvbi5cbiAgZ2V0UHJvZmlsZU5hbWU6IC0+XG4gICAgcmV0dXJuIGlmIEBnZXRDdXJyZW50U2NvcGUoKS5zb21lKChzY29wZSkgLT4gL1xcYnN0cmluZ1xcLnF1b3RlZFxcYi8udGVzdCBzY29wZSkgdGhlbiAnbGluZScgZWxzZSBhY3Rpb25VdGlscy5kZXRlY3RQcm9maWxlKEApXG5cbiAgIyBSZXR1cm5zIHRoZSBjdXJyZW50IGVkaXRvcidzIGZpbGUgcGF0aFxuICBnZXRGaWxlUGF0aDogLT5cbiAgICAjIGlzIHRoZXJlIGEgYmV0dGVyIHdheSB0byBnZXQgdGhpcz9cbiAgICBAZWRpdG9yLmJ1ZmZlci5maWxlLnBhdGhcbiJdfQ==