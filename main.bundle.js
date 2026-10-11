"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/suggestions.js
  var require_suggestions = __commonJS({
    "src/suggestions.js"(exports, module) {
      "use strict";
      var MAX_PACK_BYTES = 64 * 1024 * 1024;
      function normalizePath(value) {
        if (typeof value !== "string" || value.length > 512 || /[\\\x00-\x1f]/.test(value) || value.startsWith("/") || /^[a-z]:/i.test(value)) throw new Error("\u6587\u4EF6\u8DEF\u5F84\u5FC5\u987B\u662F\u9879\u76EE\u5185\u7684\u76F8\u5BF9\u8DEF\u5F84");
        const parts = value.split("/");
        if (parts.some((p) => !p || p === "." || p === "..") || !/\.(tex|bib|sty|cls|bst|bbx|cbx|lbx|cfg|def|clo|ist|txt|md|latex)$/i.test(value)) throw new Error("\u53EA\u652F\u6301\u9879\u76EE\u5185\u7684\u6587\u672C\u6587\u4EF6");
        return value;
      }
      function normalizeItem(raw, index = 0) {
        if (!raw || typeof raw !== "object" || typeof raw.original !== "string" || !raw.original.length || typeof raw.replacement !== "string") throw new Error("\u6BCF\u9879\u5FC5\u987B\u5305\u542B\u975E\u7A7A original \u548C\u5B57\u7B26\u4E32 replacement");
        if (raw.original.length > 2e5 || raw.replacement.length > 2e5) throw new Error("\u5355\u9879\u4FEE\u6539\u8FC7\u957F");
        const context = raw.context || {};
        const item = { id: String(raw.id ?? index + 1), file: normalizePath(raw.file ?? raw.path), original: raw.original, replacement: raw.replacement, reason: typeof raw.reason === "string" ? raw.reason : "" };
        for (const key of ["before", "after"]) {
          const value = raw[key] ?? context[key] ?? "";
          if (typeof value !== "string" || value.length > 1e4) throw new Error("\u4E0A\u4E0B\u6587\u5FC5\u987B\u662F\u6587\u672C\u4E14\u4E0D\u8D85\u8FC7 10000 \u5B57\u7B26");
          item[key] = value;
        }
        if (raw.scope !== void 0) {
          if (!raw.scope || typeof raw.scope.start !== "string" || !raw.scope.start || typeof (raw.scope.end ?? "") !== "string") throw new Error("scope \u5FC5\u987B\u5305\u542B start\uFF0C\u53EF\u9009 end\uFF0C\u5747\u4E3A\u539F\u6587\u6807\u8BB0");
          item.scope = { start: raw.scope.start, end: raw.scope.end ?? "" };
        }
        return item;
      }
      function parsePack(input) {
        if (typeof input === "string" && new TextEncoder().encode(input).length > MAX_PACK_BYTES) throw new Error("\u5EFA\u8BAE\u5305\u4E0D\u80FD\u8D85\u8FC7 64 MiB");
        const pack = typeof input === "string" ? JSON.parse(input) : input;
        if (!pack || pack.format !== "codex-overleaf-suggestions" || pack.version !== 1 || !Array.isArray(pack.suggestions) || !pack.suggestions.length || pack.suggestions.length > 1e4) throw new Error("\u9700\u8981 codex-overleaf-suggestions v1 \u5EFA\u8BAE\u5305\uFF0C\u542B 1\u201310000 \u9879");
        if (pack.projectId !== void 0 && (typeof pack.projectId !== "string" || !/^[a-f0-9]{24}$/i.test(pack.projectId))) throw new Error("projectId \u5FC5\u987B\u662F Overleaf \u9879\u76EE ID");
        const suggestions = pack.suggestions.map(normalizeItem);
        if (new Set(suggestions.map((s) => s.id)).size !== suggestions.length) throw new Error("\u6BCF\u9879 id \u5FC5\u987B\u552F\u4E00");
        return { format: pack.format, version: 1, projectId: pack.projectId || void 0, suggestions };
      }
      var logical = (text) => text.replace(/\r\n/g, "\n");
      function occurrences(text, value, from = 0, to = text.length) {
        if (!value) return [];
        const found = [];
        for (let pos = text.indexOf(value, from); pos >= 0 && pos + value.length <= to; pos = text.indexOf(value, pos + 1)) {
          found.push(pos);
          if (found.length > 1e4) break;
        }
        return found;
      }
      var sourceIndexes = /* @__PURE__ */ new Map();
      function upper(array, offset, inclusive = true) {
        let lo = 0, hi = array.length;
        while (lo < hi) {
          const mid = lo + hi >>> 1;
          if (inclusive ? array[mid] <= offset : array[mid] < offset) lo = mid + 1;
          else hi = mid;
        }
        return lo;
      }
      function sourceIndex(source) {
        if (sourceIndexes.has(source)) return sourceIndexes.get(source);
        const text = logical(source), lines = [0], carriageReturns = [];
        for (let at = text.indexOf("\n"); at >= 0; at = text.indexOf("\n", at + 1)) lines.push(at + 1);
        for (let at = source.indexOf("\r\n"); at >= 0; at = source.indexOf("\r\n", at + 2)) carriageReturns.push(at - carriageReturns.length);
        const rawLines = carriageReturns.length ? lines.map((at) => at + upper(carriageReturns, at, false)) : lines;
        const value = { text, lines, rawLines, carriageReturns };
        if (sourceIndexes.size >= 2) sourceIndexes.delete(sourceIndexes.keys().next().value);
        sourceIndexes.set(source, value);
        return value;
      }
      function lineAtSource(source, offset) {
        return upper(sourceIndex(source).rawLines, offset);
      }
      function locate(source, rawItem) {
        const indexed = sourceIndex(source);
        const item = normalizeItem(rawItem), text = indexed.text, old = logical(item.original), next = logical(item.replacement);
        const before = logical(item.before), after = logical(item.after);
        let start = 0, end = text.length;
        if (item.scope) {
          const starts = occurrences(text, logical(item.scope.start));
          if (starts.length !== 1) return { ok: false, code: starts.length ? "ambiguous_scope" : "scope_missing" };
          start = starts[0];
          if (item.scope.end) {
            const ends = occurrences(text, logical(item.scope.end), start + logical(item.scope.start).length);
            if (!ends.length) return { ok: false, code: "scope_missing" };
            end = ends[0];
          }
        }
        const anchored = (at, value) => (!before || text.slice(Math.max(0, at - before.length), at) === before) && (!after || text.slice(at + value.length, at + value.length + after.length) === after);
        if (old === next) return { ok: false, code: "no_change" };
        const applied = occurrences(text, next, start, end).filter((at) => anchored(at, next));
        const matches = occurrences(text, old, start, end).filter((at) => anchored(at, old) && !applied.some((done) => done <= at && done + next.length >= at + old.length));
        if (matches.length !== 1) return { ok: false, code: matches.length > 1 ? "ambiguous_match" : applied.length ? "already_applied" : "original_missing" };
        const offset = matches[0];
        const from = offset + upper(indexed.carriageReturns, offset, false);
        const endOffset = offset + old.length;
        const to = endOffset + upper(indexed.carriageReturns, endOffset, false);
        return { ok: true, patch: { from, to, expected: source.slice(from, to), insert: next }, line: upper(indexed.lines, offset) };
      }
      var skipped = {
        position_mismatch: "\u5B9A\u4F4D\u540E\u7684\u5B57\u7B26\u4E0E\u539F\u6587\u4E0D\u4E00\u81F4\uFF0C\u8DF3\u8FC7",
        overlapping_change: "\u4E0E\u5DF2\u63A5\u53D7\u4FEE\u6539\u91CD\u53E0\u51B2\u7A81\uFF0C\u8DF3\u8FC7",
        diff_too_complex: "\u5B57\u7B26\u5DEE\u5F02\u8FC7\u4E8E\u590D\u6742\uFF0C\u8DF3\u8FC7",
        original_missing: "\u539F\u6587\u6216\u4E0A\u4E0B\u6587\u5DF2\u7ECF\u53D8\u5316\uFF0C\u8DF3\u8FC7",
        already_applied: "\u5DF2\u7ECF\u5E94\u7528\uFF0C\u8DF3\u8FC7",
        ambiguous_match: "\u5339\u914D\u5230\u591A\u5904\u539F\u6587\uFF0C\u8DF3\u8FC7",
        scope_missing: "\u677F\u5757\u6807\u8BB0\u5DF2\u7ECF\u53D8\u5316\uFF0C\u8DF3\u8FC7",
        ambiguous_scope: "\u677F\u5757\u6807\u8BB0\u4E0D\u552F\u4E00\uFF0C\u8DF3\u8FC7",
        no_change: "\u5185\u5BB9\u6CA1\u6709\u53D8\u5316\uFF0C\u8DF3\u8FC7",
        file_not_ready: "\u6587\u4EF6\u6216 Code \u7F16\u8F91\u5668\u672A\u5C31\u7EEA\uFF0C\u8DF3\u8FC7",
        file_changed: "\u5F53\u524D\u6587\u4EF6\u5DF2\u5207\u6362\uFF0C\u8DF3\u8FC7",
        editor_changed: "\u7F16\u8F91\u5668\u72B6\u6001\u5DF2\u53D8\u5316\uFF0C\u8DF3\u8FC7"
      };
      module.exports = { parsePack, normalizeItem, normalizePath, locate, skipped, MAX_PACK_BYTES, lineAtSource };
    }
  });

  // node_modules/diff/libcjs/diff/base.js
  var require_base = __commonJS({
    "node_modules/diff/libcjs/diff/base.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var Diff = class {
        diff(oldStr, newStr, options = {}) {
          let callback;
          if (typeof options === "function") {
            callback = options;
            options = {};
          } else if ("callback" in options) {
            callback = options.callback;
          }
          const oldString = this.castInput(oldStr, options);
          const newString = this.castInput(newStr, options);
          const oldTokens = this.removeEmpty(this.tokenize(oldString, options));
          const newTokens = this.removeEmpty(this.tokenize(newString, options));
          return this.diffWithOptionsObj(oldTokens, newTokens, options, callback);
        }
        diffWithOptionsObj(oldTokens, newTokens, options, callback) {
          var _a;
          const done = (value) => {
            value = this.postProcess(value, options);
            if (callback) {
              setTimeout(function() {
                callback(value);
              }, 0);
              return void 0;
            } else {
              return value;
            }
          };
          const newLen = newTokens.length, oldLen = oldTokens.length;
          let editLength = 1;
          let maxEditLength = newLen + oldLen;
          if (options.maxEditLength != null) {
            maxEditLength = Math.min(maxEditLength, options.maxEditLength);
          }
          const maxExecutionTime = (_a = options.timeout) !== null && _a !== void 0 ? _a : Infinity;
          const abortAfterTimestamp = Date.now() + maxExecutionTime;
          const bestPath = [{ oldPos: -1, lastComponent: void 0 }];
          let newPos = this.extractCommon(bestPath[0], newTokens, oldTokens, 0, options);
          if (bestPath[0].oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
            return done(this.buildValues(bestPath[0].lastComponent, newTokens, oldTokens));
          }
          let minDiagonalToConsider = -Infinity, maxDiagonalToConsider = Infinity;
          const execEditLength = () => {
            for (let diagonalPath = Math.max(minDiagonalToConsider, -editLength); diagonalPath <= Math.min(maxDiagonalToConsider, editLength); diagonalPath += 2) {
              let basePath;
              const removePath = bestPath[diagonalPath - 1], addPath = bestPath[diagonalPath + 1];
              if (removePath) {
                bestPath[diagonalPath - 1] = void 0;
              }
              let canAdd = false;
              if (addPath) {
                const addPathNewPos = addPath.oldPos - diagonalPath;
                canAdd = addPath && 0 <= addPathNewPos && addPathNewPos < newLen;
              }
              const canRemove = removePath && removePath.oldPos + 1 < oldLen;
              if (!canAdd && !canRemove) {
                bestPath[diagonalPath] = void 0;
                continue;
              }
              if (!canRemove || canAdd && removePath.oldPos < addPath.oldPos) {
                basePath = this.addToPath(addPath, true, false, 0, options);
              } else {
                basePath = this.addToPath(removePath, false, true, 1, options);
              }
              newPos = this.extractCommon(basePath, newTokens, oldTokens, diagonalPath, options);
              if (basePath.oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
                return done(this.buildValues(basePath.lastComponent, newTokens, oldTokens)) || true;
              } else {
                bestPath[diagonalPath] = basePath;
                if (basePath.oldPos + 1 >= oldLen) {
                  maxDiagonalToConsider = Math.min(maxDiagonalToConsider, diagonalPath - 1);
                }
                if (newPos + 1 >= newLen) {
                  minDiagonalToConsider = Math.max(minDiagonalToConsider, diagonalPath + 1);
                }
              }
            }
            editLength++;
          };
          if (callback) {
            (function exec() {
              setTimeout(function() {
                if (editLength > maxEditLength || Date.now() > abortAfterTimestamp) {
                  return callback(void 0);
                }
                if (!execEditLength()) {
                  exec();
                }
              }, 0);
            })();
          } else {
            while (editLength <= maxEditLength && Date.now() <= abortAfterTimestamp) {
              const ret = execEditLength();
              if (ret) {
                return ret;
              }
            }
          }
        }
        addToPath(path, added, removed, oldPosInc, options) {
          const last = path.lastComponent;
          if (last && !options.oneChangePerToken && last.added === added && last.removed === removed) {
            return {
              oldPos: path.oldPos + oldPosInc,
              lastComponent: { count: last.count + 1, added, removed, previousComponent: last.previousComponent }
            };
          } else {
            return {
              oldPos: path.oldPos + oldPosInc,
              lastComponent: { count: 1, added, removed, previousComponent: last }
            };
          }
        }
        extractCommon(basePath, newTokens, oldTokens, diagonalPath, options) {
          const newLen = newTokens.length, oldLen = oldTokens.length;
          let oldPos = basePath.oldPos, newPos = oldPos - diagonalPath, commonCount = 0;
          while (newPos + 1 < newLen && oldPos + 1 < oldLen && this.equals(oldTokens[oldPos + 1], newTokens[newPos + 1], options)) {
            newPos++;
            oldPos++;
            commonCount++;
            if (options.oneChangePerToken) {
              basePath.lastComponent = { count: 1, previousComponent: basePath.lastComponent, added: false, removed: false };
            }
          }
          if (commonCount && !options.oneChangePerToken) {
            basePath.lastComponent = { count: commonCount, previousComponent: basePath.lastComponent, added: false, removed: false };
          }
          basePath.oldPos = oldPos;
          return newPos;
        }
        equals(left, right, options) {
          if (options.comparator) {
            return options.comparator(left, right);
          } else {
            return left === right || !!options.ignoreCase && left.toLowerCase() === right.toLowerCase();
          }
        }
        removeEmpty(array) {
          const ret = [];
          for (let i = 0; i < array.length; i++) {
            if (array[i]) {
              ret.push(array[i]);
            }
          }
          return ret;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        castInput(value, options) {
          return value;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        tokenize(value, options) {
          return Array.from(value);
        }
        join(chars) {
          return chars.join("");
        }
        postProcess(changeObjects, options) {
          return changeObjects;
        }
        get useLongestToken() {
          return false;
        }
        buildValues(lastComponent, newTokens, oldTokens) {
          const components = [];
          let nextComponent;
          while (lastComponent) {
            components.push(lastComponent);
            nextComponent = lastComponent.previousComponent;
            delete lastComponent.previousComponent;
            lastComponent = nextComponent;
          }
          components.reverse();
          const componentLen = components.length;
          let componentPos = 0, newPos = 0, oldPos = 0;
          for (; componentPos < componentLen; componentPos++) {
            const component = components[componentPos];
            if (!component.removed) {
              if (!component.added && this.useLongestToken) {
                let value = newTokens.slice(newPos, newPos + component.count);
                value = value.map(function(value2, i) {
                  const oldValue = oldTokens[oldPos + i];
                  return oldValue.length > value2.length ? oldValue : value2;
                });
                component.value = this.join(value);
              } else {
                component.value = this.join(newTokens.slice(newPos, newPos + component.count));
              }
              newPos += component.count;
              if (!component.added) {
                oldPos += component.count;
              }
            } else {
              component.value = this.join(oldTokens.slice(oldPos, oldPos + component.count));
              oldPos += component.count;
            }
          }
          return components;
        }
      };
      exports.default = Diff;
    }
  });

  // node_modules/diff/libcjs/diff/character.js
  var require_character = __commonJS({
    "node_modules/diff/libcjs/diff/character.js"(exports) {
      "use strict";
      var __importDefault = exports && exports.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.characterDiff = void 0;
      exports.diffChars = diffChars;
      var base_js_1 = __importDefault(require_base());
      var CharacterDiff = class extends base_js_1.default {
      };
      exports.characterDiff = new CharacterDiff();
      function diffChars(oldStr, newStr, options) {
        return exports.characterDiff.diff(oldStr, newStr, options);
      }
    }
  });

  // node_modules/diff/libcjs/util/string.js
  var require_string = __commonJS({
    "node_modules/diff/libcjs/util/string.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.longestCommonPrefix = longestCommonPrefix;
      exports.longestCommonSuffix = longestCommonSuffix;
      exports.replacePrefix = replacePrefix;
      exports.replaceSuffix = replaceSuffix;
      exports.removePrefix = removePrefix;
      exports.removeSuffix = removeSuffix;
      exports.maximumOverlap = maximumOverlap;
      exports.hasOnlyWinLineEndings = hasOnlyWinLineEndings;
      exports.hasOnlyUnixLineEndings = hasOnlyUnixLineEndings;
      exports.segment = segment;
      exports.trailingWs = trailingWs;
      exports.leadingWs = leadingWs;
      exports.leadingAndTrailingWs = leadingAndTrailingWs;
      function longestCommonPrefix(str1, str2) {
        let i;
        for (i = 0; i < str1.length && i < str2.length; i++) {
          if (str1[i] != str2[i]) {
            return str1.slice(0, i);
          }
        }
        return str1.slice(0, i);
      }
      function longestCommonSuffix(str1, str2) {
        let i;
        if (!str1 || !str2 || str1[str1.length - 1] != str2[str2.length - 1]) {
          return "";
        }
        for (i = 0; i < str1.length && i < str2.length; i++) {
          if (str1[str1.length - (i + 1)] != str2[str2.length - (i + 1)]) {
            return str1.slice(-i);
          }
        }
        return str1.slice(-i);
      }
      function replacePrefix(string, oldPrefix, newPrefix) {
        if (string.slice(0, oldPrefix.length) != oldPrefix) {
          throw Error(`string ${JSON.stringify(string)} doesn't start with prefix ${JSON.stringify(oldPrefix)}; this is a bug`);
        }
        return newPrefix + string.slice(oldPrefix.length);
      }
      function replaceSuffix(string, oldSuffix, newSuffix) {
        if (!oldSuffix) {
          return string + newSuffix;
        }
        if (string.slice(-oldSuffix.length) != oldSuffix) {
          throw Error(`string ${JSON.stringify(string)} doesn't end with suffix ${JSON.stringify(oldSuffix)}; this is a bug`);
        }
        return string.slice(0, -oldSuffix.length) + newSuffix;
      }
      function removePrefix(string, oldPrefix) {
        return replacePrefix(string, oldPrefix, "");
      }
      function removeSuffix(string, oldSuffix) {
        return replaceSuffix(string, oldSuffix, "");
      }
      function maximumOverlap(string1, string2) {
        return string2.slice(0, overlapCount(string1, string2));
      }
      function overlapCount(a, b) {
        let startA = 0;
        if (a.length > b.length) {
          startA = a.length - b.length;
        }
        let endB = b.length;
        if (a.length < b.length) {
          endB = a.length;
        }
        const map = Array(endB);
        let k = 0;
        map[0] = 0;
        for (let j = 1; j < endB; j++) {
          if (b[j] == b[k]) {
            map[j] = map[k];
          } else {
            map[j] = k;
          }
          while (k > 0 && b[j] != b[k]) {
            k = map[k];
          }
          if (b[j] == b[k]) {
            k++;
          }
        }
        k = 0;
        for (let i = startA; i < a.length; i++) {
          while (k > 0 && a[i] != b[k]) {
            k = map[k];
          }
          if (a[i] == b[k]) {
            k++;
          }
        }
        return k;
      }
      function hasOnlyWinLineEndings(string) {
        return string.includes("\r\n") && !string.startsWith("\n") && !string.match(/[^\r]\n/);
      }
      function hasOnlyUnixLineEndings(string) {
        return !string.includes("\r\n") && string.includes("\n");
      }
      function segment(string, segmenter) {
        const parts = [];
        for (const segmentObj of Array.from(segmenter.segment(string))) {
          const segment2 = segmentObj.segment;
          if (parts.length && /\s/.test(parts[parts.length - 1]) && /\s/.test(segment2)) {
            parts[parts.length - 1] += segment2;
          } else {
            parts.push(segment2);
          }
        }
        return parts;
      }
      function trailingWs(string, segmenter) {
        if (segmenter) {
          return leadingAndTrailingWs(string, segmenter)[1];
        }
        let i;
        for (i = string.length - 1; i >= 0; i--) {
          if (!string[i].match(/\s/)) {
            break;
          }
        }
        return string.substring(i + 1);
      }
      function leadingWs(string, segmenter) {
        if (segmenter) {
          return leadingAndTrailingWs(string, segmenter)[0];
        }
        const match = string.match(/^\s*/);
        return match ? match[0] : "";
      }
      function leadingAndTrailingWs(string, segmenter) {
        if (!segmenter) {
          return [leadingWs(string), trailingWs(string)];
        }
        if (segmenter.resolvedOptions().granularity != "word") {
          throw new Error('The segmenter passed must have a granularity of "word"');
        }
        const segments = segment(string, segmenter);
        const firstSeg = segments[0];
        const lastSeg = segments[segments.length - 1];
        const head = /\s/.test(firstSeg) ? firstSeg : "";
        const tail = /\s/.test(lastSeg) ? lastSeg : "";
        return [head, tail];
      }
    }
  });

  // node_modules/diff/libcjs/diff/word.js
  var require_word = __commonJS({
    "node_modules/diff/libcjs/diff/word.js"(exports) {
      "use strict";
      var __importDefault = exports && exports.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.wordsWithSpaceDiff = exports.wordDiff = void 0;
      exports.diffWords = diffWords;
      exports.diffWordsWithSpace = diffWordsWithSpace;
      var base_js_1 = __importDefault(require_base());
      var string_js_1 = require_string();
      var extendedWordChars = "a-zA-Z0-9_\\u{AD}\\u{C0}-\\u{D6}\\u{D8}-\\u{F6}\\u{F8}-\\u{2C6}\\u{2C8}-\\u{2D7}\\u{2DE}-\\u{2FF}\\u{1E00}-\\u{1EFF}";
      var tokenizeIncludingWhitespace = new RegExp(`[${extendedWordChars}]+|\\s+|[^${extendedWordChars}]`, "ug");
      var WordDiff = class extends base_js_1.default {
        equals(left, right, options) {
          if (options.ignoreCase) {
            left = left.toLowerCase();
            right = right.toLowerCase();
          }
          return left.trim() === right.trim();
        }
        tokenize(value, options = {}) {
          let parts;
          if (options.intlSegmenter) {
            const segmenter = options.intlSegmenter;
            if (segmenter.resolvedOptions().granularity != "word") {
              throw new Error('The segmenter passed must have a granularity of "word"');
            }
            parts = (0, string_js_1.segment)(value, segmenter);
          } else {
            parts = value.match(tokenizeIncludingWhitespace) || [];
          }
          const tokens = [];
          let prevPart = null;
          parts.forEach((part) => {
            if (/\s/.test(part)) {
              if (prevPart == null) {
                tokens.push(part);
              } else {
                tokens.push(tokens.pop() + part);
              }
            } else if (prevPart != null && /\s/.test(prevPart)) {
              if (tokens[tokens.length - 1] == prevPart) {
                tokens.push(tokens.pop() + part);
              } else {
                tokens.push(prevPart + part);
              }
            } else {
              tokens.push(part);
            }
            prevPart = part;
          });
          return tokens;
        }
        join(tokens) {
          return tokens.map((token, i) => {
            if (i == 0) {
              return token;
            } else {
              return token.replace(/^\s+/, "");
            }
          }).join("");
        }
        postProcess(changes, options) {
          if (!changes || options.oneChangePerToken) {
            return changes;
          }
          let lastKeep = null;
          let insertion = null;
          let deletion = null;
          changes.forEach((change) => {
            if (change.added) {
              insertion = change;
            } else if (change.removed) {
              deletion = change;
            } else {
              if (insertion || deletion) {
                dedupeWhitespaceInChangeObjects(lastKeep, deletion, insertion, change, options.intlSegmenter);
              }
              lastKeep = change;
              insertion = null;
              deletion = null;
            }
          });
          if (insertion || deletion) {
            dedupeWhitespaceInChangeObjects(lastKeep, deletion, insertion, null, options.intlSegmenter);
          }
          return changes;
        }
      };
      exports.wordDiff = new WordDiff();
      function diffWords(oldStr, newStr, options) {
        if ((options === null || options === void 0 ? void 0 : options.ignoreWhitespace) != null && !options.ignoreWhitespace) {
          return diffWordsWithSpace(oldStr, newStr, options);
        }
        return exports.wordDiff.diff(oldStr, newStr, options);
      }
      function dedupeWhitespaceInChangeObjects(startKeep, deletion, insertion, endKeep, segmenter) {
        if (deletion && insertion) {
          const [oldWsPrefix, oldWsSuffix] = (0, string_js_1.leadingAndTrailingWs)(deletion.value, segmenter);
          const [newWsPrefix, newWsSuffix] = (0, string_js_1.leadingAndTrailingWs)(insertion.value, segmenter);
          if (startKeep) {
            const commonWsPrefix = (0, string_js_1.longestCommonPrefix)(oldWsPrefix, newWsPrefix);
            startKeep.value = (0, string_js_1.replaceSuffix)(startKeep.value, newWsPrefix, commonWsPrefix);
            deletion.value = (0, string_js_1.removePrefix)(deletion.value, commonWsPrefix);
            insertion.value = (0, string_js_1.removePrefix)(insertion.value, commonWsPrefix);
          }
          if (endKeep) {
            const commonWsSuffix = (0, string_js_1.longestCommonSuffix)(oldWsSuffix, newWsSuffix);
            endKeep.value = (0, string_js_1.replacePrefix)(endKeep.value, newWsSuffix, commonWsSuffix);
            deletion.value = (0, string_js_1.removeSuffix)(deletion.value, commonWsSuffix);
            insertion.value = (0, string_js_1.removeSuffix)(insertion.value, commonWsSuffix);
          }
        } else if (insertion) {
          if (startKeep) {
            const ws = (0, string_js_1.leadingWs)(insertion.value, segmenter);
            insertion.value = insertion.value.substring(ws.length);
          }
          if (endKeep) {
            const ws = (0, string_js_1.leadingWs)(endKeep.value, segmenter);
            endKeep.value = endKeep.value.substring(ws.length);
          }
        } else if (startKeep && endKeep) {
          const newWsFull = (0, string_js_1.leadingWs)(endKeep.value, segmenter), [delWsStart, delWsEnd] = (0, string_js_1.leadingAndTrailingWs)(deletion.value, segmenter);
          const newWsStart = (0, string_js_1.longestCommonPrefix)(newWsFull, delWsStart);
          deletion.value = (0, string_js_1.removePrefix)(deletion.value, newWsStart);
          const newWsEnd = (0, string_js_1.longestCommonSuffix)((0, string_js_1.removePrefix)(newWsFull, newWsStart), delWsEnd);
          deletion.value = (0, string_js_1.removeSuffix)(deletion.value, newWsEnd);
          endKeep.value = (0, string_js_1.replacePrefix)(endKeep.value, newWsFull, newWsEnd);
          startKeep.value = (0, string_js_1.replaceSuffix)(startKeep.value, newWsFull, newWsFull.slice(0, newWsFull.length - newWsEnd.length));
        } else if (endKeep) {
          const endKeepWsPrefix = (0, string_js_1.leadingWs)(endKeep.value, segmenter);
          const deletionWsSuffix = (0, string_js_1.trailingWs)(deletion.value, segmenter);
          const overlap = (0, string_js_1.maximumOverlap)(deletionWsSuffix, endKeepWsPrefix);
          deletion.value = (0, string_js_1.removeSuffix)(deletion.value, overlap);
        } else if (startKeep) {
          const startKeepWsSuffix = (0, string_js_1.trailingWs)(startKeep.value, segmenter);
          const deletionWsPrefix = (0, string_js_1.leadingWs)(deletion.value, segmenter);
          const overlap = (0, string_js_1.maximumOverlap)(startKeepWsSuffix, deletionWsPrefix);
          deletion.value = (0, string_js_1.removePrefix)(deletion.value, overlap);
        }
      }
      var WordsWithSpaceDiff = class extends base_js_1.default {
        tokenize(value) {
          const regex = new RegExp(`(\\r?\\n)|[${extendedWordChars}]+|[^\\S\\n\\r]+|[^${extendedWordChars}]`, "ug");
          return value.match(regex) || [];
        }
      };
      exports.wordsWithSpaceDiff = new WordsWithSpaceDiff();
      function diffWordsWithSpace(oldStr, newStr, options) {
        return exports.wordsWithSpaceDiff.diff(oldStr, newStr, options);
      }
    }
  });

  // node_modules/diff/libcjs/util/params.js
  var require_params = __commonJS({
    "node_modules/diff/libcjs/util/params.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.generateOptions = generateOptions;
      function generateOptions(options, defaults) {
        if (typeof options === "function") {
          defaults.callback = options;
        } else if (options) {
          for (const name in options) {
            if (Object.prototype.hasOwnProperty.call(options, name)) {
              defaults[name] = options[name];
            }
          }
        }
        return defaults;
      }
    }
  });

  // node_modules/diff/libcjs/diff/line.js
  var require_line = __commonJS({
    "node_modules/diff/libcjs/diff/line.js"(exports) {
      "use strict";
      var __importDefault = exports && exports.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.lineDiff = void 0;
      exports.diffLines = diffLines;
      exports.diffTrimmedLines = diffTrimmedLines;
      exports.tokenize = tokenize;
      var base_js_1 = __importDefault(require_base());
      var params_js_1 = require_params();
      var LineDiff = class extends base_js_1.default {
        constructor() {
          super(...arguments);
          this.tokenize = tokenize;
        }
        equals(left, right, options) {
          if (options.ignoreWhitespace) {
            if (!options.newlineIsToken || !left.includes("\n")) {
              left = left.trim();
            }
            if (!options.newlineIsToken || !right.includes("\n")) {
              right = right.trim();
            }
          } else if (options.ignoreNewlineAtEof && !options.newlineIsToken) {
            if (left.endsWith("\n")) {
              left = left.slice(0, -1);
            }
            if (right.endsWith("\n")) {
              right = right.slice(0, -1);
            }
          }
          return super.equals(left, right, options);
        }
      };
      exports.lineDiff = new LineDiff();
      function diffLines(oldStr, newStr, options) {
        return exports.lineDiff.diff(oldStr, newStr, options);
      }
      function diffTrimmedLines(oldStr, newStr, options) {
        options = (0, params_js_1.generateOptions)(options, { ignoreWhitespace: true });
        return exports.lineDiff.diff(oldStr, newStr, options);
      }
      function tokenize(value, options) {
        if (options.stripTrailingCr) {
          value = value.replace(/\r\n/g, "\n");
        }
        const retLines = [], linesAndNewlines = value.split(/(\n|\r\n)/);
        if (!linesAndNewlines[linesAndNewlines.length - 1]) {
          linesAndNewlines.pop();
        }
        for (let i = 0; i < linesAndNewlines.length; i++) {
          const line = linesAndNewlines[i];
          if (i % 2 && !options.newlineIsToken) {
            retLines[retLines.length - 1] += line;
          } else {
            retLines.push(line);
          }
        }
        return retLines;
      }
    }
  });

  // node_modules/diff/libcjs/diff/sentence.js
  var require_sentence = __commonJS({
    "node_modules/diff/libcjs/diff/sentence.js"(exports) {
      "use strict";
      var __importDefault = exports && exports.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.sentenceDiff = void 0;
      exports.diffSentences = diffSentences;
      var base_js_1 = __importDefault(require_base());
      function isSentenceEndPunct(char) {
        return char == "." || char == "!" || char == "?";
      }
      var SentenceDiff = class extends base_js_1.default {
        tokenize(value) {
          var _a;
          const result = [];
          let tokenStartI = 0;
          for (let i = 0; i < value.length; i++) {
            if (i == value.length - 1) {
              result.push(value.slice(tokenStartI));
              break;
            }
            if (isSentenceEndPunct(value[i]) && value[i + 1].match(/\s/)) {
              result.push(value.slice(tokenStartI, i + 1));
              i = tokenStartI = i + 1;
              while ((_a = value[i + 1]) === null || _a === void 0 ? void 0 : _a.match(/\s/)) {
                i++;
              }
              result.push(value.slice(tokenStartI, i + 1));
              tokenStartI = i + 1;
            }
          }
          return result;
        }
      };
      exports.sentenceDiff = new SentenceDiff();
      function diffSentences(oldStr, newStr, options) {
        return exports.sentenceDiff.diff(oldStr, newStr, options);
      }
    }
  });

  // node_modules/diff/libcjs/diff/css.js
  var require_css = __commonJS({
    "node_modules/diff/libcjs/diff/css.js"(exports) {
      "use strict";
      var __importDefault = exports && exports.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.cssDiff = void 0;
      exports.diffCss = diffCss;
      var base_js_1 = __importDefault(require_base());
      var CssDiff = class extends base_js_1.default {
        tokenize(value) {
          return value.split(/([{}:;,]|\s+)/);
        }
      };
      exports.cssDiff = new CssDiff();
      function diffCss(oldStr, newStr, options) {
        return exports.cssDiff.diff(oldStr, newStr, options);
      }
    }
  });

  // node_modules/diff/libcjs/diff/json.js
  var require_json = __commonJS({
    "node_modules/diff/libcjs/diff/json.js"(exports) {
      "use strict";
      var __importDefault = exports && exports.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.jsonDiff = void 0;
      exports.diffJson = diffJson;
      exports.canonicalize = canonicalize;
      var base_js_1 = __importDefault(require_base());
      var line_js_1 = require_line();
      var JsonDiff = class extends base_js_1.default {
        constructor() {
          super(...arguments);
          this.tokenize = line_js_1.tokenize;
        }
        get useLongestToken() {
          return true;
        }
        castInput(value, options) {
          const { undefinedReplacement, stringifyReplacer = (k, v) => typeof v === "undefined" ? undefinedReplacement : v } = options;
          return typeof value === "string" ? value : JSON.stringify(canonicalize(value, null, null, stringifyReplacer), null, "  ");
        }
        equals(left, right, options) {
          return super.equals(left.replace(/,([\r\n])/g, "$1"), right.replace(/,([\r\n])/g, "$1"), options);
        }
      };
      exports.jsonDiff = new JsonDiff();
      function diffJson(oldStr, newStr, options) {
        return exports.jsonDiff.diff(oldStr, newStr, options);
      }
      function canonicalize(obj, stack, replacementStack, replacer, key) {
        stack = stack || [];
        replacementStack = replacementStack || [];
        if (replacer) {
          obj = replacer(key === void 0 ? "" : key, obj);
        }
        let i;
        for (i = 0; i < stack.length; i += 1) {
          if (stack[i] === obj) {
            return replacementStack[i];
          }
        }
        let canonicalizedObj;
        if ("[object Array]" === Object.prototype.toString.call(obj)) {
          stack.push(obj);
          canonicalizedObj = new Array(obj.length);
          replacementStack.push(canonicalizedObj);
          for (i = 0; i < obj.length; i += 1) {
            canonicalizedObj[i] = canonicalize(obj[i], stack, replacementStack, replacer, String(i));
          }
          stack.pop();
          replacementStack.pop();
          return canonicalizedObj;
        }
        if (obj && obj.toJSON) {
          obj = obj.toJSON();
        }
        if (typeof obj === "object" && obj !== null) {
          stack.push(obj);
          canonicalizedObj = {};
          replacementStack.push(canonicalizedObj);
          const sortedKeys = [];
          let key2;
          for (key2 in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key2)) {
              sortedKeys.push(key2);
            }
          }
          sortedKeys.sort();
          for (i = 0; i < sortedKeys.length; i += 1) {
            key2 = sortedKeys[i];
            canonicalizedObj[key2] = canonicalize(obj[key2], stack, replacementStack, replacer, key2);
          }
          stack.pop();
          replacementStack.pop();
        } else {
          canonicalizedObj = obj;
        }
        return canonicalizedObj;
      }
    }
  });

  // node_modules/diff/libcjs/diff/array.js
  var require_array = __commonJS({
    "node_modules/diff/libcjs/diff/array.js"(exports) {
      "use strict";
      var __importDefault = exports && exports.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.arrayDiff = void 0;
      exports.diffArrays = diffArrays;
      var base_js_1 = __importDefault(require_base());
      var ArrayDiff = class extends base_js_1.default {
        tokenize(value) {
          return value.slice();
        }
        join(value) {
          return value;
        }
        removeEmpty(value) {
          return value;
        }
      };
      exports.arrayDiff = new ArrayDiff();
      function diffArrays(oldArr, newArr, options) {
        return exports.arrayDiff.diff(oldArr, newArr, options);
      }
    }
  });

  // node_modules/diff/libcjs/patch/line-endings.js
  var require_line_endings = __commonJS({
    "node_modules/diff/libcjs/patch/line-endings.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.unixToWin = unixToWin;
      exports.winToUnix = winToUnix;
      exports.isUnix = isUnix;
      exports.isWin = isWin;
      function unixToWin(patch) {
        if (Array.isArray(patch)) {
          return patch.map((p) => unixToWin(p));
        }
        return Object.assign(Object.assign({}, patch), { hunks: patch.hunks.map((hunk) => Object.assign(Object.assign({}, hunk), { lines: hunk.lines.map((line, i) => {
          var _a;
          return line.startsWith("\\") || line.endsWith("\r") || ((_a = hunk.lines[i + 1]) === null || _a === void 0 ? void 0 : _a.startsWith("\\")) ? line : line + "\r";
        }) })) });
      }
      function winToUnix(patch) {
        if (Array.isArray(patch)) {
          return patch.map((p) => winToUnix(p));
        }
        return Object.assign(Object.assign({}, patch), { hunks: patch.hunks.map((hunk) => Object.assign(Object.assign({}, hunk), { lines: hunk.lines.map((line) => line.endsWith("\r") ? line.substring(0, line.length - 1) : line) })) });
      }
      function isUnix(patch) {
        if (!Array.isArray(patch)) {
          patch = [patch];
        }
        return !patch.some((index) => index.hunks.some((hunk) => hunk.lines.some((line) => !line.startsWith("\\") && line.endsWith("\r"))));
      }
      function isWin(patch) {
        if (!Array.isArray(patch)) {
          patch = [patch];
        }
        return patch.some((index) => index.hunks.some((hunk) => hunk.lines.some((line) => line.endsWith("\r")))) && patch.every((index) => index.hunks.every((hunk) => hunk.lines.every((line, i) => {
          var _a;
          return line.startsWith("\\") || line.endsWith("\r") || ((_a = hunk.lines[i + 1]) === null || _a === void 0 ? void 0 : _a.startsWith("\\"));
        })));
      }
    }
  });

  // node_modules/diff/libcjs/patch/parse.js
  var require_parse = __commonJS({
    "node_modules/diff/libcjs/patch/parse.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.parsePatch = parsePatch;
      function parsePatch(uniDiff) {
        const diffstr = uniDiff.split(/\n/), list = [];
        let i = 0;
        function isGitDiffHeader(line) {
          return /^diff --git /.test(line);
        }
        function isDiffHeader(line) {
          return isGitDiffHeader(line) || /^Index:\s/.test(line) || /^diff(?: -r \w+)+\s/.test(line);
        }
        function isFileHeader(line) {
          return /^(---|\+\+\+)\s/.test(line);
        }
        function isHunkHeader(line) {
          return /^@@\s/.test(line);
        }
        function parseIndex() {
          var _a;
          const index = {};
          index.hunks = [];
          list.push(index);
          let seenDiffHeader = false;
          while (i < diffstr.length) {
            const line = diffstr[i];
            if (isFileHeader(line) || isHunkHeader(line)) {
              break;
            }
            if (isGitDiffHeader(line)) {
              if (seenDiffHeader) {
                return;
              }
              seenDiffHeader = true;
              index.isGit = true;
              const paths = parseGitDiffHeader(line);
              if (paths) {
                index.oldFileName = paths.oldFileName;
                index.newFileName = paths.newFileName;
              }
              i++;
              while (i < diffstr.length) {
                const extLine = diffstr[i];
                if (isFileHeader(extLine) || isHunkHeader(extLine) || isDiffHeader(extLine)) {
                  break;
                }
                const renameFromMatch = /^rename from (.*)/.exec(extLine);
                if (renameFromMatch) {
                  index.oldFileName = "a/" + unquoteIfQuoted(renameFromMatch[1]);
                  index.isRename = true;
                }
                const renameToMatch = /^rename to (.*)/.exec(extLine);
                if (renameToMatch) {
                  index.newFileName = "b/" + unquoteIfQuoted(renameToMatch[1]);
                  index.isRename = true;
                }
                const copyFromMatch = /^copy from (.*)/.exec(extLine);
                if (copyFromMatch) {
                  index.oldFileName = "a/" + unquoteIfQuoted(copyFromMatch[1]);
                  index.isCopy = true;
                }
                const copyToMatch = /^copy to (.*)/.exec(extLine);
                if (copyToMatch) {
                  index.newFileName = "b/" + unquoteIfQuoted(copyToMatch[1]);
                  index.isCopy = true;
                }
                const newFileModeMatch = /^new file mode (\d+)/.exec(extLine);
                if (newFileModeMatch) {
                  index.isCreate = true;
                  index.newMode = newFileModeMatch[1];
                }
                const deletedFileModeMatch = /^deleted file mode (\d+)/.exec(extLine);
                if (deletedFileModeMatch) {
                  index.isDelete = true;
                  index.oldMode = deletedFileModeMatch[1];
                }
                const oldModeMatch = /^old mode (\d+)/.exec(extLine);
                if (oldModeMatch) {
                  index.oldMode = oldModeMatch[1];
                }
                const newModeMatch = /^new mode (\d+)/.exec(extLine);
                if (newModeMatch) {
                  index.newMode = newModeMatch[1];
                }
                if (/^Binary files /.test(extLine)) {
                  index.isBinary = true;
                }
                i++;
              }
              continue;
            } else if (isDiffHeader(line)) {
              if (seenDiffHeader) {
                return;
              }
              seenDiffHeader = true;
              const headerMatch = /^(?:Index:|diff(?: -r \w+)+)\s+/.exec(line);
              if (headerMatch) {
                index.index = line.substring(headerMatch[0].length).trim();
              }
            }
            i++;
          }
          parseFileHeader(index);
          parseFileHeader(index);
          if (index.oldFileName === void 0 !== (index.newFileName === void 0)) {
            throw new Error("Missing " + (index.oldFileName !== void 0 ? '"+++ ..."' : '"--- ..."') + " file header for " + ((_a = index.oldFileName) !== null && _a !== void 0 ? _a : index.newFileName));
          }
          while (i < diffstr.length) {
            const line = diffstr[i];
            if (isDiffHeader(line) || isFileHeader(line) || /^===================================================================/.test(line)) {
              break;
            } else if (isHunkHeader(line)) {
              index.hunks.push(parseHunk());
            } else {
              i++;
            }
          }
        }
        function parseGitDiffHeader(line) {
          const rest = line.substring("diff --git ".length);
          if (rest.startsWith('"')) {
            const oldPath = parseQuotedFileName(rest);
            if (oldPath === null) {
              return null;
            }
            const afterOld = rest.substring(oldPath.rawLength + 1);
            let newFileName;
            if (afterOld.startsWith('"')) {
              const newPath = parseQuotedFileName(afterOld);
              if (newPath === null) {
                return null;
              }
              newFileName = newPath.fileName;
            } else {
              newFileName = afterOld;
            }
            return {
              oldFileName: oldPath.fileName,
              newFileName
            };
          }
          const quoteIdx = rest.indexOf('"');
          if (quoteIdx > 0) {
            const oldFileName = rest.substring(0, quoteIdx - 1);
            const newPath = parseQuotedFileName(rest.substring(quoteIdx));
            if (newPath === null) {
              return null;
            }
            return {
              oldFileName,
              newFileName: newPath.fileName
            };
          }
          if (rest.startsWith("a/")) {
            const splits = [];
            let idx = 0;
            while (true) {
              idx = rest.indexOf(" b/", idx + 1);
              if (idx === -1) {
                break;
              }
              splits.push(idx);
            }
            if (splits.length > 0) {
              const mid = splits[Math.floor(splits.length / 2)];
              return {
                oldFileName: rest.substring(0, mid),
                newFileName: rest.substring(mid + 1)
              };
            }
          }
          return null;
        }
        function unquoteIfQuoted(s) {
          if (s.startsWith('"')) {
            const parsed = parseQuotedFileName(s);
            if (parsed) {
              return parsed.fileName;
            }
          }
          return s;
        }
        function parseQuotedFileName(s) {
          if (!s.startsWith('"')) {
            return null;
          }
          let result = "";
          let j = 1;
          while (j < s.length) {
            if (s[j] === '"') {
              return { fileName: result, rawLength: j + 1 };
            }
            if (s[j] === "\\" && j + 1 < s.length) {
              j++;
              switch (s[j]) {
                case "a":
                  result += "\x07";
                  break;
                case "b":
                  result += "\b";
                  break;
                case "f":
                  result += "\f";
                  break;
                case "n":
                  result += "\n";
                  break;
                case "r":
                  result += "\r";
                  break;
                case "t":
                  result += "	";
                  break;
                case "v":
                  result += "\v";
                  break;
                case "\\":
                  result += "\\";
                  break;
                case '"':
                  result += '"';
                  break;
                case "0":
                case "1":
                case "2":
                case "3":
                case "4":
                case "5":
                case "6":
                case "7": {
                  if (j + 2 >= s.length || s[j + 1] < "0" || s[j + 1] > "7" || s[j + 2] < "0" || s[j + 2] > "7") {
                    return null;
                  }
                  const bytes = [parseInt(s.substring(j, j + 3), 8)];
                  j += 3;
                  while (s[j] === "\\" && s[j + 1] >= "0" && s[j + 1] <= "7") {
                    if (j + 3 >= s.length || s[j + 2] < "0" || s[j + 2] > "7" || s[j + 3] < "0" || s[j + 3] > "7") {
                      return null;
                    }
                    bytes.push(parseInt(s.substring(j + 1, j + 4), 8));
                    j += 4;
                  }
                  result += new TextDecoder("utf-8").decode(new Uint8Array(bytes));
                  continue;
                }
                // Note that in C, there are also three kinds of hex escape sequences:
                // - \xhh
                // - \uhhhh
                // - \Uhhhhhhhh
                // We do not bother to parse them here because, so far as we know,
                // they are never emitted by any tools that generate unified diff
                // format diffs, and so for now jsdiff does not consider them legal.
                default:
                  return null;
              }
            } else {
              result += s[j];
            }
            j++;
          }
          return null;
        }
        function parseFileHeader(index) {
          const fileHeaderMatch = /^(---|\+\+\+)\s+/.exec(diffstr[i]);
          if (fileHeaderMatch) {
            const prefix = fileHeaderMatch[1], data = diffstr[i].substring(3).trim().split("	", 2), header = (data[1] || "").trim();
            let fileName = data[0];
            if (fileName.startsWith('"')) {
              fileName = unquoteIfQuoted(fileName);
            } else {
              fileName = fileName.replace(/\\\\/g, "\\");
            }
            if (prefix === "---") {
              index.oldFileName = fileName;
              index.oldHeader = header;
            } else {
              index.newFileName = fileName;
              index.newHeader = header;
            }
            i++;
          }
        }
        function parseHunk() {
          var _a;
          const chunkHeaderIndex = i, chunkHeaderLine = diffstr[i++], chunkHeader = chunkHeaderLine.split(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
          const hunk = {
            oldStart: +chunkHeader[1],
            oldLines: typeof chunkHeader[2] === "undefined" ? 1 : +chunkHeader[2],
            newStart: +chunkHeader[3],
            newLines: typeof chunkHeader[4] === "undefined" ? 1 : +chunkHeader[4],
            lines: []
          };
          if (hunk.oldLines === 0) {
            hunk.oldStart += 1;
          }
          if (hunk.newLines === 0) {
            hunk.newStart += 1;
          }
          let addCount = 0, removeCount = 0;
          for (; i < diffstr.length && (removeCount < hunk.oldLines || addCount < hunk.newLines || ((_a = diffstr[i]) === null || _a === void 0 ? void 0 : _a.startsWith("\\"))); i++) {
            const operation = diffstr[i].length == 0 && i != diffstr.length - 1 ? " " : diffstr[i][0];
            if (operation === "+" || operation === "-" || operation === " " || operation === "\\") {
              hunk.lines.push(diffstr[i]);
              if (operation === "+") {
                addCount++;
              } else if (operation === "-") {
                removeCount++;
              } else if (operation === " ") {
                addCount++;
                removeCount++;
              }
            } else {
              throw new Error(`Hunk at line ${chunkHeaderIndex + 1} contained invalid line ${diffstr[i]}`);
            }
          }
          if (!addCount && hunk.newLines === 1) {
            hunk.newLines = 0;
          }
          if (!removeCount && hunk.oldLines === 1) {
            hunk.oldLines = 0;
          }
          if (addCount !== hunk.newLines) {
            throw new Error("Added line count did not match for hunk at line " + (chunkHeaderIndex + 1));
          }
          if (removeCount !== hunk.oldLines) {
            throw new Error("Removed line count did not match for hunk at line " + (chunkHeaderIndex + 1));
          }
          if (i < diffstr.length && diffstr[i] && /^[+ -]/.test(diffstr[i]) && !isFileHeader(diffstr[i])) {
            throw new Error("Hunk at line " + (chunkHeaderIndex + 1) + " has more lines than expected (expected " + hunk.oldLines + " old lines and " + hunk.newLines + " new lines)");
          }
          return hunk;
        }
        while (i < diffstr.length) {
          parseIndex();
        }
        return list;
      }
    }
  });

  // node_modules/diff/libcjs/util/distance-iterator.js
  var require_distance_iterator = __commonJS({
    "node_modules/diff/libcjs/util/distance-iterator.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.default = default_1;
      function default_1(start, minLine, maxLine) {
        let wantForward = true, backwardExhausted = false, forwardExhausted = false, localOffset = 1;
        return function iterator() {
          if (wantForward && !forwardExhausted) {
            if (backwardExhausted) {
              localOffset++;
            } else {
              wantForward = false;
            }
            if (start + localOffset <= maxLine) {
              return start + localOffset;
            }
            forwardExhausted = true;
          }
          if (!backwardExhausted) {
            if (!forwardExhausted) {
              wantForward = true;
            }
            if (minLine <= start - localOffset) {
              return start - localOffset++;
            }
            backwardExhausted = true;
            return iterator();
          }
          return void 0;
        };
      }
    }
  });

  // node_modules/diff/libcjs/patch/apply.js
  var require_apply = __commonJS({
    "node_modules/diff/libcjs/patch/apply.js"(exports) {
      "use strict";
      var __importDefault = exports && exports.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.applyPatch = applyPatch;
      exports.applyPatches = applyPatches;
      var string_js_1 = require_string();
      var line_endings_js_1 = require_line_endings();
      var parse_js_1 = require_parse();
      var distance_iterator_js_1 = __importDefault(require_distance_iterator());
      function applyPatch(source, patch, options = {}) {
        let patches;
        if (typeof patch === "string") {
          patches = (0, parse_js_1.parsePatch)(patch);
        } else if (Array.isArray(patch)) {
          patches = patch;
        } else {
          patches = [patch];
        }
        if (patches.length > 1) {
          throw new Error("applyPatch only works with a single input.");
        }
        return applyStructuredPatch(source, patches[0], options);
      }
      function applyStructuredPatch(source, patch, options = {}) {
        if (options.autoConvertLineEndings || options.autoConvertLineEndings == null) {
          if ((0, string_js_1.hasOnlyWinLineEndings)(source) && (0, line_endings_js_1.isUnix)(patch)) {
            patch = (0, line_endings_js_1.unixToWin)(patch);
          } else if ((0, string_js_1.hasOnlyUnixLineEndings)(source) && (0, line_endings_js_1.isWin)(patch)) {
            patch = (0, line_endings_js_1.winToUnix)(patch);
          }
        }
        const lines = source.split("\n"), hunks = patch.hunks, compareLine = options.compareLine || ((lineNumber, line, operation, patchContent) => line === patchContent), fuzzFactor = options.fuzzFactor || 0;
        let minLine = 0;
        if (fuzzFactor < 0 || !Number.isInteger(fuzzFactor)) {
          throw new Error("fuzzFactor must be a non-negative integer");
        }
        if (!hunks.length) {
          return source;
        }
        let prevLine = "", removeEOFNL = false, addEOFNL = false;
        for (let i = 0; i < hunks[hunks.length - 1].lines.length; i++) {
          const line = hunks[hunks.length - 1].lines[i];
          if (line[0] == "\\") {
            if (prevLine[0] == "+") {
              removeEOFNL = true;
            } else if (prevLine[0] == "-") {
              addEOFNL = true;
            }
          }
          prevLine = line;
        }
        if (removeEOFNL) {
          if (addEOFNL) {
            if (!fuzzFactor && lines[lines.length - 1] == "") {
              return false;
            }
          } else if (lines[lines.length - 1] == "") {
            lines.pop();
          } else if (!fuzzFactor) {
            return false;
          }
        } else if (addEOFNL) {
          if (lines[lines.length - 1] != "") {
            lines.push("");
          } else if (!fuzzFactor) {
            return false;
          }
        }
        function applyHunk(hunkLines, toPos, maxErrors, hunkLinesI = 0, lastContextLineMatched = true, patchedLines = [], patchedLinesLength = 0) {
          let nConsecutiveOldContextLines = 0;
          let nextContextLineMustMatch = false;
          for (; hunkLinesI < hunkLines.length; hunkLinesI++) {
            const hunkLine = hunkLines[hunkLinesI], operation = hunkLine.length > 0 ? hunkLine[0] : " ", content = hunkLine.length > 0 ? hunkLine.substr(1) : hunkLine;
            if (operation === "-") {
              if (compareLine(toPos + 1, lines[toPos], operation, content)) {
                toPos++;
                nConsecutiveOldContextLines = 0;
              } else {
                if (!maxErrors || lines[toPos] == null) {
                  return null;
                }
                patchedLines[patchedLinesLength] = lines[toPos];
                return applyHunk(hunkLines, toPos + 1, maxErrors - 1, hunkLinesI, false, patchedLines, patchedLinesLength + 1);
              }
            }
            if (operation === "+") {
              if (!lastContextLineMatched) {
                return null;
              }
              patchedLines[patchedLinesLength] = content;
              patchedLinesLength++;
              nConsecutiveOldContextLines = 0;
              nextContextLineMustMatch = true;
            }
            if (operation === " ") {
              nConsecutiveOldContextLines++;
              patchedLines[patchedLinesLength] = lines[toPos];
              if (compareLine(toPos + 1, lines[toPos], operation, content)) {
                patchedLinesLength++;
                lastContextLineMatched = true;
                nextContextLineMustMatch = false;
                toPos++;
              } else {
                if (nextContextLineMustMatch || !maxErrors) {
                  return null;
                }
                return lines[toPos] && (applyHunk(hunkLines, toPos + 1, maxErrors - 1, hunkLinesI + 1, false, patchedLines, patchedLinesLength + 1) || applyHunk(hunkLines, toPos + 1, maxErrors - 1, hunkLinesI, false, patchedLines, patchedLinesLength + 1)) || applyHunk(hunkLines, toPos, maxErrors - 1, hunkLinesI + 1, false, patchedLines, patchedLinesLength);
              }
            }
          }
          patchedLinesLength -= nConsecutiveOldContextLines;
          toPos -= nConsecutiveOldContextLines;
          patchedLines.length = patchedLinesLength;
          return {
            patchedLines,
            oldLineLastI: toPos - 1
          };
        }
        const resultLines = [];
        let prevHunkOffset = 0;
        for (let i = 0; i < hunks.length; i++) {
          const hunk = hunks[i];
          let hunkResult;
          const maxLine = lines.length - hunk.oldLines + fuzzFactor;
          let toPos;
          for (let maxErrors = 0; maxErrors <= fuzzFactor; maxErrors++) {
            toPos = hunk.oldStart + prevHunkOffset - 1;
            const iterator = (0, distance_iterator_js_1.default)(toPos, minLine, maxLine);
            for (; toPos !== void 0; toPos = iterator()) {
              hunkResult = applyHunk(hunk.lines, toPos, maxErrors);
              if (hunkResult) {
                break;
              }
            }
            if (hunkResult) {
              break;
            }
          }
          if (!hunkResult) {
            return false;
          }
          for (let i2 = minLine; i2 < toPos; i2++) {
            resultLines.push(lines[i2]);
          }
          for (let i2 = 0; i2 < hunkResult.patchedLines.length; i2++) {
            const line = hunkResult.patchedLines[i2];
            resultLines.push(line);
          }
          minLine = hunkResult.oldLineLastI + 1;
          prevHunkOffset = toPos + 1 - hunk.oldStart;
        }
        for (let i = minLine; i < lines.length; i++) {
          resultLines.push(lines[i]);
        }
        return resultLines.join("\n");
      }
      function applyPatches(uniDiff, options) {
        const spDiff = typeof uniDiff === "string" ? (0, parse_js_1.parsePatch)(uniDiff) : uniDiff;
        let currentIndex = 0;
        function processIndex() {
          const index = spDiff[currentIndex++];
          if (!index) {
            return options.complete();
          }
          options.loadFile(index, function(err, data) {
            if (err) {
              return options.complete(err);
            }
            const updatedContent = applyPatch(data, index, options);
            options.patched(index, updatedContent, function(err2) {
              if (err2) {
                return options.complete(err2);
              }
              processIndex();
            });
          });
        }
        processIndex();
      }
    }
  });

  // node_modules/diff/libcjs/patch/reverse.js
  var require_reverse = __commonJS({
    "node_modules/diff/libcjs/patch/reverse.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.reversePatch = reversePatch;
      function swapPrefix(fileName) {
        if (fileName === void 0 || fileName === "/dev/null") {
          return fileName;
        }
        if (fileName.startsWith("a/")) {
          return "b/" + fileName.slice(2);
        }
        if (fileName.startsWith("b/")) {
          return "a/" + fileName.slice(2);
        }
        return fileName;
      }
      function reversePatch(structuredPatch) {
        if (Array.isArray(structuredPatch)) {
          return structuredPatch.map((patch) => reversePatch(patch)).reverse();
        }
        const reversed = Object.assign(Object.assign({}, structuredPatch), { oldFileName: structuredPatch.isGit ? swapPrefix(structuredPatch.newFileName) : structuredPatch.newFileName, oldHeader: structuredPatch.newHeader, newFileName: structuredPatch.isGit ? swapPrefix(structuredPatch.oldFileName) : structuredPatch.oldFileName, newHeader: structuredPatch.oldHeader, oldMode: structuredPatch.newMode, newMode: structuredPatch.oldMode, isCreate: structuredPatch.isDelete, isDelete: structuredPatch.isCreate, hunks: structuredPatch.hunks.map((hunk) => {
          return {
            oldLines: hunk.newLines,
            oldStart: hunk.newStart,
            newLines: hunk.oldLines,
            newStart: hunk.oldStart,
            lines: hunk.lines.map((l) => {
              if (l.startsWith("-")) {
                return `+${l.slice(1)}`;
              }
              if (l.startsWith("+")) {
                return `-${l.slice(1)}`;
              }
              return l;
            })
          };
        }) });
        if (structuredPatch.isCopy) {
          reversed.newFileName = "/dev/null";
          reversed.newHeader = void 0;
          reversed.isDelete = true;
          delete reversed.isCreate;
          delete reversed.isCopy;
          delete reversed.isRename;
          reversed.hunks = [];
        }
        return reversed;
      }
    }
  });

  // node_modules/diff/libcjs/patch/create.js
  var require_create = __commonJS({
    "node_modules/diff/libcjs/patch/create.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.OMIT_HEADERS = exports.FILE_HEADERS_ONLY = exports.INCLUDE_HEADERS = void 0;
      exports.structuredPatch = structuredPatch;
      exports.formatPatch = formatPatch;
      exports.createTwoFilesPatch = createTwoFilesPatch;
      exports.createPatch = createPatch;
      var line_js_1 = require_line();
      function needsQuoting(s) {
        for (let i = 0; i < s.length; i++) {
          if (s[i] < " " || s[i] > "~" || s[i] === '"' || s[i] === "\\") {
            return true;
          }
        }
        return false;
      }
      function quoteFileNameIfNeeded(s) {
        if (!needsQuoting(s)) {
          return s;
        }
        let result = '"';
        const bytes = new TextEncoder().encode(s);
        let i = 0;
        while (i < bytes.length) {
          const b = bytes[i];
          if (b === 7) {
            result += "\\a";
          } else if (b === 8) {
            result += "\\b";
          } else if (b === 9) {
            result += "\\t";
          } else if (b === 10) {
            result += "\\n";
          } else if (b === 11) {
            result += "\\v";
          } else if (b === 12) {
            result += "\\f";
          } else if (b === 13) {
            result += "\\r";
          } else if (b === 34) {
            result += '\\"';
          } else if (b === 92) {
            result += "\\\\";
          } else if (b >= 32 && b <= 126) {
            result += String.fromCharCode(b);
          } else {
            result += "\\" + b.toString(8).padStart(3, "0");
          }
          i++;
        }
        result += '"';
        return result;
      }
      exports.INCLUDE_HEADERS = {
        includeIndex: true,
        includeUnderline: true,
        includeFileHeaders: true
      };
      exports.FILE_HEADERS_ONLY = {
        includeIndex: false,
        includeUnderline: false,
        includeFileHeaders: true
      };
      exports.OMIT_HEADERS = {
        includeIndex: false,
        includeUnderline: false,
        includeFileHeaders: false
      };
      function structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) {
        let optionsObj;
        if (!options) {
          optionsObj = {};
        } else if (typeof options === "function") {
          optionsObj = { callback: options };
        } else {
          optionsObj = options;
        }
        if (typeof optionsObj.context === "undefined") {
          optionsObj.context = 4;
        }
        const context = optionsObj.context;
        if (optionsObj.newlineIsToken) {
          throw new Error("newlineIsToken may not be used with patch-generation functions, only with diffing functions");
        }
        if (!optionsObj.callback) {
          return diffLinesResultToPatch((0, line_js_1.diffLines)(oldStr, newStr, optionsObj));
        } else {
          const { callback } = optionsObj;
          (0, line_js_1.diffLines)(oldStr, newStr, Object.assign(Object.assign({}, optionsObj), { callback: (diff) => {
            const patch = diffLinesResultToPatch(diff);
            callback(patch);
          } }));
        }
        function diffLinesResultToPatch(diff) {
          if (!diff) {
            return;
          }
          diff.push({ value: "", lines: [] });
          function contextLines(lines) {
            return lines.map(function(entry) {
              return " " + entry;
            });
          }
          const hunks = [];
          let oldRangeStart = 0, newRangeStart = 0, curRange = [], oldLine = 1, newLine = 1;
          for (let i = 0; i < diff.length; i++) {
            const current = diff[i], lines = current.lines || splitLines(current.value);
            current.lines = lines;
            if (current.added || current.removed) {
              if (!oldRangeStart) {
                const prev = diff[i - 1];
                oldRangeStart = oldLine;
                newRangeStart = newLine;
                if (prev) {
                  curRange = context > 0 ? contextLines(prev.lines.slice(-context)) : [];
                  oldRangeStart -= curRange.length;
                  newRangeStart -= curRange.length;
                }
              }
              for (const line of lines) {
                curRange.push((current.added ? "+" : "-") + line);
              }
              if (current.added) {
                newLine += lines.length;
              } else {
                oldLine += lines.length;
              }
            } else {
              if (oldRangeStart) {
                if (lines.length <= context * 2 && i < diff.length - 2) {
                  for (const line of contextLines(lines)) {
                    curRange.push(line);
                  }
                } else {
                  const contextSize = Math.min(lines.length, context);
                  for (const line of contextLines(lines.slice(0, contextSize))) {
                    curRange.push(line);
                  }
                  const hunk = {
                    oldStart: oldRangeStart,
                    oldLines: oldLine - oldRangeStart + contextSize,
                    newStart: newRangeStart,
                    newLines: newLine - newRangeStart + contextSize,
                    lines: curRange
                  };
                  hunks.push(hunk);
                  oldRangeStart = 0;
                  newRangeStart = 0;
                  curRange = [];
                }
              }
              oldLine += lines.length;
              newLine += lines.length;
            }
          }
          for (const hunk of hunks) {
            for (let i = 0; i < hunk.lines.length; i++) {
              if (hunk.lines[i].endsWith("\n")) {
                hunk.lines[i] = hunk.lines[i].slice(0, -1);
              } else {
                hunk.lines.splice(i + 1, 0, "\\ No newline at end of file");
                i++;
              }
            }
          }
          return {
            oldFileName,
            newFileName,
            oldHeader,
            newHeader,
            hunks
          };
        }
      }
      function formatPatch(patch, headerOptions) {
        var _a, _b, _c, _d, _e, _f;
        if (!headerOptions) {
          headerOptions = exports.INCLUDE_HEADERS;
        }
        if (Array.isArray(patch)) {
          if (patch.length > 1 && !headerOptions.includeFileHeaders && !patch.every((p) => p.isGit)) {
            throw new Error("Cannot omit file headers on a multi-file patch. (The result would be unparseable; how would a tool trying to apply the patch know which changes are to which file?)");
          }
          return patch.map((p) => formatPatch(p, headerOptions)).join("\n");
        }
        const ret = [];
        if (patch.isGit) {
          headerOptions = exports.INCLUDE_HEADERS;
          if (!patch.oldFileName) {
            throw new Error("oldFileName must be specified for Git patches");
          }
          if (!patch.newFileName) {
            throw new Error("newFileName must be specified for Git patches");
          }
          let gitOldName = patch.oldFileName;
          let gitNewName = patch.newFileName;
          if (patch.isCreate && gitOldName === "/dev/null") {
            gitOldName = gitNewName.replace(/^b\//, "a/");
          } else if (patch.isDelete && gitNewName === "/dev/null") {
            gitNewName = gitOldName.replace(/^a\//, "b/");
          }
          ret.push("diff --git " + quoteFileNameIfNeeded(gitOldName) + " " + quoteFileNameIfNeeded(gitNewName));
          if (patch.isDelete) {
            ret.push("deleted file mode " + ((_a = patch.oldMode) !== null && _a !== void 0 ? _a : "100644"));
          }
          if (patch.isCreate) {
            ret.push("new file mode " + ((_b = patch.newMode) !== null && _b !== void 0 ? _b : "100644"));
          }
          if (patch.oldMode && patch.newMode && !patch.isDelete && !patch.isCreate) {
            ret.push("old mode " + patch.oldMode);
            ret.push("new mode " + patch.newMode);
          }
          if (patch.isRename) {
            ret.push("rename from " + quoteFileNameIfNeeded(((_c = patch.oldFileName) !== null && _c !== void 0 ? _c : "").replace(/^a\//, "")));
            ret.push("rename to " + quoteFileNameIfNeeded(((_d = patch.newFileName) !== null && _d !== void 0 ? _d : "").replace(/^b\//, "")));
          }
          if (patch.isCopy) {
            ret.push("copy from " + quoteFileNameIfNeeded(((_e = patch.oldFileName) !== null && _e !== void 0 ? _e : "").replace(/^a\//, "")));
            ret.push("copy to " + quoteFileNameIfNeeded(((_f = patch.newFileName) !== null && _f !== void 0 ? _f : "").replace(/^b\//, "")));
          }
        } else {
          if (headerOptions.includeIndex && patch.oldFileName == patch.newFileName && patch.oldFileName !== void 0) {
            ret.push("Index: " + patch.oldFileName);
          }
          if (headerOptions.includeUnderline) {
            ret.push("===================================================================");
          }
        }
        const hasHunks = patch.hunks.length > 0;
        if (headerOptions.includeFileHeaders && patch.oldFileName !== void 0 && patch.newFileName !== void 0 && (!patch.isGit || hasHunks)) {
          ret.push("--- " + quoteFileNameIfNeeded(patch.oldFileName) + (patch.oldHeader ? "	" + patch.oldHeader : ""));
          ret.push("+++ " + quoteFileNameIfNeeded(patch.newFileName) + (patch.newHeader ? "	" + patch.newHeader : ""));
        }
        for (let i = 0; i < patch.hunks.length; i++) {
          const hunk = patch.hunks[i];
          const oldStart = hunk.oldLines === 0 ? hunk.oldStart - 1 : hunk.oldStart;
          const newStart = hunk.newLines === 0 ? hunk.newStart - 1 : hunk.newStart;
          ret.push("@@ -" + oldStart + "," + hunk.oldLines + " +" + newStart + "," + hunk.newLines + " @@");
          for (const line of hunk.lines) {
            ret.push(line);
          }
        }
        return ret.join("\n") + "\n";
      }
      function createTwoFilesPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) {
        if (typeof options === "function") {
          options = { callback: options };
        }
        if (!(options === null || options === void 0 ? void 0 : options.callback)) {
          const patchObj = structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options);
          if (!patchObj) {
            return;
          }
          return formatPatch(patchObj, options === null || options === void 0 ? void 0 : options.headerOptions);
        } else {
          const { callback } = options;
          structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, Object.assign(Object.assign({}, options), { callback: (patchObj) => {
            if (!patchObj) {
              callback(void 0);
            } else {
              callback(formatPatch(patchObj, options.headerOptions));
            }
          } }));
        }
      }
      function createPatch(fileName, oldStr, newStr, oldHeader, newHeader, options) {
        return createTwoFilesPatch(fileName, fileName, oldStr, newStr, oldHeader, newHeader, options);
      }
      function splitLines(text) {
        const hasTrailingNl = text.endsWith("\n");
        const result = text.split("\n").map((line) => line + "\n");
        if (hasTrailingNl) {
          result.pop();
        } else {
          result.push(result.pop().slice(0, -1));
        }
        return result;
      }
    }
  });

  // node_modules/diff/libcjs/convert/dmp.js
  var require_dmp = __commonJS({
    "node_modules/diff/libcjs/convert/dmp.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.convertChangesToDMP = convertChangesToDMP;
      function convertChangesToDMP(changes) {
        const ret = [];
        let change, operation;
        for (let i = 0; i < changes.length; i++) {
          change = changes[i];
          if (change.added) {
            operation = 1;
          } else if (change.removed) {
            operation = -1;
          } else {
            operation = 0;
          }
          ret.push([operation, change.value]);
        }
        return ret;
      }
    }
  });

  // node_modules/diff/libcjs/convert/xml.js
  var require_xml = __commonJS({
    "node_modules/diff/libcjs/convert/xml.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.convertChangesToXML = convertChangesToXML;
      function convertChangesToXML(changes) {
        const ret = [];
        for (let i = 0; i < changes.length; i++) {
          const change = changes[i];
          if (change.added) {
            ret.push("<ins>");
          } else if (change.removed) {
            ret.push("<del>");
          }
          ret.push(escapeHTML(change.value));
          if (change.added) {
            ret.push("</ins>");
          } else if (change.removed) {
            ret.push("</del>");
          }
        }
        return ret.join("");
      }
      function escapeHTML(s) {
        let n = s;
        n = n.replace(/&/g, "&amp;");
        n = n.replace(/</g, "&lt;");
        n = n.replace(/>/g, "&gt;");
        n = n.replace(/"/g, "&quot;");
        return n;
      }
    }
  });

  // node_modules/diff/libcjs/index.js
  var require_libcjs = __commonJS({
    "node_modules/diff/libcjs/index.js"(exports) {
      "use strict";
      var __importDefault = exports && exports.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.canonicalize = exports.convertChangesToXML = exports.convertChangesToDMP = exports.reversePatch = exports.parsePatch = exports.applyPatches = exports.applyPatch = exports.OMIT_HEADERS = exports.FILE_HEADERS_ONLY = exports.INCLUDE_HEADERS = exports.formatPatch = exports.createPatch = exports.createTwoFilesPatch = exports.structuredPatch = exports.arrayDiff = exports.diffArrays = exports.jsonDiff = exports.diffJson = exports.cssDiff = exports.diffCss = exports.sentenceDiff = exports.diffSentences = exports.diffTrimmedLines = exports.lineDiff = exports.diffLines = exports.wordsWithSpaceDiff = exports.diffWordsWithSpace = exports.wordDiff = exports.diffWords = exports.characterDiff = exports.diffChars = exports.Diff = void 0;
      var base_js_1 = __importDefault(require_base());
      exports.Diff = base_js_1.default;
      var character_js_1 = require_character();
      Object.defineProperty(exports, "diffChars", { enumerable: true, get: function() {
        return character_js_1.diffChars;
      } });
      Object.defineProperty(exports, "characterDiff", { enumerable: true, get: function() {
        return character_js_1.characterDiff;
      } });
      var word_js_1 = require_word();
      Object.defineProperty(exports, "diffWords", { enumerable: true, get: function() {
        return word_js_1.diffWords;
      } });
      Object.defineProperty(exports, "diffWordsWithSpace", { enumerable: true, get: function() {
        return word_js_1.diffWordsWithSpace;
      } });
      Object.defineProperty(exports, "wordDiff", { enumerable: true, get: function() {
        return word_js_1.wordDiff;
      } });
      Object.defineProperty(exports, "wordsWithSpaceDiff", { enumerable: true, get: function() {
        return word_js_1.wordsWithSpaceDiff;
      } });
      var line_js_1 = require_line();
      Object.defineProperty(exports, "diffLines", { enumerable: true, get: function() {
        return line_js_1.diffLines;
      } });
      Object.defineProperty(exports, "diffTrimmedLines", { enumerable: true, get: function() {
        return line_js_1.diffTrimmedLines;
      } });
      Object.defineProperty(exports, "lineDiff", { enumerable: true, get: function() {
        return line_js_1.lineDiff;
      } });
      var sentence_js_1 = require_sentence();
      Object.defineProperty(exports, "diffSentences", { enumerable: true, get: function() {
        return sentence_js_1.diffSentences;
      } });
      Object.defineProperty(exports, "sentenceDiff", { enumerable: true, get: function() {
        return sentence_js_1.sentenceDiff;
      } });
      var css_js_1 = require_css();
      Object.defineProperty(exports, "diffCss", { enumerable: true, get: function() {
        return css_js_1.diffCss;
      } });
      Object.defineProperty(exports, "cssDiff", { enumerable: true, get: function() {
        return css_js_1.cssDiff;
      } });
      var json_js_1 = require_json();
      Object.defineProperty(exports, "diffJson", { enumerable: true, get: function() {
        return json_js_1.diffJson;
      } });
      Object.defineProperty(exports, "canonicalize", { enumerable: true, get: function() {
        return json_js_1.canonicalize;
      } });
      Object.defineProperty(exports, "jsonDiff", { enumerable: true, get: function() {
        return json_js_1.jsonDiff;
      } });
      var array_js_1 = require_array();
      Object.defineProperty(exports, "diffArrays", { enumerable: true, get: function() {
        return array_js_1.diffArrays;
      } });
      Object.defineProperty(exports, "arrayDiff", { enumerable: true, get: function() {
        return array_js_1.arrayDiff;
      } });
      var apply_js_1 = require_apply();
      Object.defineProperty(exports, "applyPatch", { enumerable: true, get: function() {
        return apply_js_1.applyPatch;
      } });
      Object.defineProperty(exports, "applyPatches", { enumerable: true, get: function() {
        return apply_js_1.applyPatches;
      } });
      var parse_js_1 = require_parse();
      Object.defineProperty(exports, "parsePatch", { enumerable: true, get: function() {
        return parse_js_1.parsePatch;
      } });
      var reverse_js_1 = require_reverse();
      Object.defineProperty(exports, "reversePatch", { enumerable: true, get: function() {
        return reverse_js_1.reversePatch;
      } });
      var create_js_1 = require_create();
      Object.defineProperty(exports, "structuredPatch", { enumerable: true, get: function() {
        return create_js_1.structuredPatch;
      } });
      Object.defineProperty(exports, "createTwoFilesPatch", { enumerable: true, get: function() {
        return create_js_1.createTwoFilesPatch;
      } });
      Object.defineProperty(exports, "createPatch", { enumerable: true, get: function() {
        return create_js_1.createPatch;
      } });
      Object.defineProperty(exports, "formatPatch", { enumerable: true, get: function() {
        return create_js_1.formatPatch;
      } });
      Object.defineProperty(exports, "INCLUDE_HEADERS", { enumerable: true, get: function() {
        return create_js_1.INCLUDE_HEADERS;
      } });
      Object.defineProperty(exports, "FILE_HEADERS_ONLY", { enumerable: true, get: function() {
        return create_js_1.FILE_HEADERS_ONLY;
      } });
      Object.defineProperty(exports, "OMIT_HEADERS", { enumerable: true, get: function() {
        return create_js_1.OMIT_HEADERS;
      } });
      var dmp_js_1 = require_dmp();
      Object.defineProperty(exports, "convertChangesToDMP", { enumerable: true, get: function() {
        return dmp_js_1.convertChangesToDMP;
      } });
      var xml_js_1 = require_xml();
      Object.defineProperty(exports, "convertChangesToXML", { enumerable: true, get: function() {
        return xml_js_1.convertChangesToXML;
      } });
    }
  });

  // src/characterEdits.js
  var require_characterEdits = __commonJS({
    "src/characterEdits.js"(exports, module) {
      "use strict";
      var { diffChars } = require_libcjs();
      function characterEdits(patch, source) {
        const replacement = source.includes("\r\n") ? patch.insert.replace(/\r?\n/g, "\r\n") : patch.insert;
        const parts = diffChars(patch.expected, replacement, { timeout: 1e3, maxEditLength: 4096 });
        if (!parts) return null;
        const changes = [];
        let offset = patch.from, pending = null;
        const flush = () => {
          if (pending) changes.push(pending);
          pending = null;
        };
        for (const part of parts) {
          if (!part.added && !part.removed) {
            flush();
            offset += part.value.length;
            continue;
          }
          if (!pending) pending = { from: offset, to: offset, insert: "" };
          if (part.removed) {
            offset += part.value.length;
            pending.to = offset;
          }
          if (part.added) pending.insert += part.value;
        }
        flush();
        return changes.map((change) => ({ ...change, expected: source.slice(change.from, change.to) }));
      }
      module.exports = { characterEdits };
    }
  });

  // src/rebase.js
  var require_rebase = __commonJS({
    "src/rebase.js"(exports, module) {
      "use strict";
      var Core = require_suggestions();
      var { characterEdits } = require_characterEdits();
      var { diffChars } = require_libcjs();
      function upper(array, value) {
        let lo = 0, hi = array.length;
        while (lo < hi) {
          const mid = lo + hi >>> 1;
          if (array[mid] <= value) lo = mid + 1;
          else hi = mid;
        }
        return lo;
      }
      function index(ledger) {
        if (ledger.index && ledger.index.version === ledger.version) return ledger.index;
        ledger.edits.sort((a, b) => a.from - b.from || a.to - b.to);
        const ends = [], liveEnds = [], deltas = [];
        let delta = 0;
        for (const edit of ledger.edits) {
          delta += edit.insert.length - (edit.to - edit.from);
          ends.push(edit.to);
          liveEnds.push(edit.to + delta);
          deltas.push(delta);
        }
        return ledger.index = { version: ledger.version, ends, liveEnds, deltas };
      }
      function map(ledger, pos, inverse = false) {
        const idx = index(ledger), n = upper(inverse ? idx.liveEnds : idx.ends, pos);
        return pos + (inverse ? -1 : 1) * (n ? idx.deltas[n - 1] : 0);
      }
      function touching(ledger, p, live = false) {
        const idx = index(ledger), ends = live ? idx.liveEnds : idx.ends;
        let at = Math.max(0, upper(ends, p.from) - 1), found = [];
        for (; at < ledger.edits.length; at++) {
          const q = ledger.edits[at], delta = at ? idx.deltas[at - 1] : 0, from = live ? q.from + delta : q.from, to = live ? from + q.insert.length : q.to;
          if (from > p.to) break;
          if (p.from < p.to && from < to && p.from < to && from < p.to || p.from === p.to && from < p.from && p.from < to || from === to && p.from < from && from < p.to || p.from === p.to && from === to && p.from === from) found.push(q);
        }
        return found;
      }
      function add(ledger, edits) {
        ledger.edits.push(...edits);
        ledger.edits.sort((a, b) => a.from - b.from || a.to - b.to);
        ledger.version = (ledger.version || 0) + 1;
      }
      function sync(ledger, text, recompute = true) {
        if (ledger.current === text) return { ok: true, edits: [] };
        const old = ledger.current;
        let from = 0, tail = 0;
        while (from < old.length && from < text.length && old[from] === text[from]) from++;
        while (tail < old.length - from && tail < text.length - from && old[old.length - 1 - tail] === text[text.length - 1 - tail]) tail++;
        if (from && /[\uDC00-\uDFFF]/.test(old[from] || text[from] || "")) from--;
        const parts = diffChars(old.slice(from, old.length - tail), text.slice(from, text.length - tail), { timeout: 25, maxEditLength: 4096 });
        if (!parts) return { ok: false };
        const changes = [];
        let pos = from, pending = null;
        const flush = () => {
          if (pending) {
            changes.push(pending);
            pending = null;
          }
        };
        for (const part of parts) {
          if (!part.added && !part.removed) {
            flush();
            pos += part.value.length;
          } else {
            pending ||= { from: pos, to: pos, insert: "" };
            if (part.removed) {
              pos += part.value.length;
              pending.to = pos;
            } else pending.insert += part.value;
          }
        }
        flush();
        const overlaps = changes.flatMap((p) => touching(ledger, p, true));
        if (overlaps.length) {
          if (!recompute || overlaps.some((p) => !p.external)) return { ok: false };
          const own = ledger.edits.filter((p) => !p.external);
          let current = ledger.base;
          for (const p of [...own].reverse()) current = current.slice(0, p.from) + p.insert + current.slice(p.to);
          const replacement = { base: ledger.base, current, edits: own, version: 0 };
          const result = sync(replacement, text, false);
          if (!result.ok) return result;
          ledger.current = text;
          ledger.edits = replacement.edits;
          ledger.version = (ledger.version || 0) + 1;
          return { ok: true, replace: true, edits: ledger.edits };
        }
        const edits = changes.map((p) => ({ from: map(ledger, p.from, true), to: map(ledger, p.to, true), insert: p.insert, external: true }));
        add(ledger, edits);
        ledger.current = text;
        return { ok: true, edits };
      }
      function resolve(text, item, ledger) {
        if (!ledger || ledger.current !== text) return Core.locate(text, item);
        if (!ledger.edits.length) {
          const match = Core.locate(text, item);
          if (!match.ok) return match;
          const edits = characterEdits(match.patch, ledger.base);
          return edits ? { ...match, baselineChanges: edits, characterChanges: edits } : { ok: false, code: "diff_too_complex" };
        }
        const base = Core.locate(ledger.base, item);
        if (!base.ok) return Core.locate(text, item);
        const live = Core.locate(text, item);
        if (live.code === "ambiguous_match" || live.code === "ambiguous_scope") return live;
        const requested = characterEdits(base.patch, ledger.base);
        if (!requested) return { ok: false, code: "diff_too_complex" };
        const remaining = [];
        for (const p of requested) {
          const touches = touching(ledger, p);
          if (touches.length) {
            if (touches.length === 1 && !touches[0].external && touches[0].from === p.from && touches[0].to === p.to && touches[0].insert === p.insert) continue;
            return { ok: false, code: touches.some((q) => q.external) ? live.ok ? "overlapping_change" : live.code || "original_missing" : "overlapping_change" };
          }
          remaining.push(p);
        }
        if (!remaining.length) return { ok: false, code: "already_applied" };
        const from = map(ledger, base.patch.from), to = map(ledger, base.patch.to);
        const changes = remaining.map((p) => ({ ...p, from: map(ledger, p.from), to: map(ledger, p.to) }));
        if (from < 0 || to < from || to > text.length || changes.some((p) => p.from < from || p.to > to || p.from > p.to || text.slice(p.from, p.to) !== p.expected)) return { ok: false, code: "position_mismatch" };
        let insert = text.slice(from, to);
        for (const p of [...changes].reverse()) insert = insert.slice(0, p.from - from) + p.insert + insert.slice(p.to - from);
        return { ok: true, line: Core.lineAtSource(text, from), patch: { from, to, expected: text.slice(from, to), insert }, baselineChanges: remaining, characterChanges: changes };
      }
      module.exports = { resolve, sync, add, map };
    }
  });

  // src/i18n.js
  var require_i18n = __commonJS({
    "src/i18n.js"(exports, module) {
      "use strict";
      var english = {
        "\u5F53\u524D\u539F\u6587\u5DF2\u53D8\u5316\uFF0C\u6B64\u9879\u5DF2\u5931\u6548\uFF1B\u53EF\u7EE7\u7EED\u7F16\u8F91\uFF0C\u70B9\u51FB\u5BFC\u822A\u540E\u8DF3\u8FC7": "The original changed; this item is stale. Continue editing; navigation will skip it.",
        "\u5B9A\u4F4D\u540E\u7684\u5B57\u7B26\u4E0E\u539F\u6587\u4E0D\u4E00\u81F4\uFF0C\u8DF3\u8FC7": "Located characters do not match the original; skipped",
        "\u914D\u5BF9\u4EE4\u724C\u683C\u5F0F\u4E0D\u6B63\u786E": "Invalid pairing token format",
        "\u5EFA\u8BAE\u4F1A\u8BDD\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u8F7D\u5165": "Suggestion session changed; reload the pack",
        "\u5EFA\u8BAE\u5305\u5206\u5757\u987A\u5E8F\u65E0\u6548": "Invalid suggestion pack chunk order",
        "\u5EFA\u8BAE\u7D22\u5F15\u65E0\u6548": "Invalid suggestion index",
        "\u5BFC\u5165\u4FEE\u6539\u5EFA\u8BAE": "Review suggestions",
        "\u6536\u8D77": "Close",
        "\u9010\u9879\u5BA1\u9605": "Review items",
        "\u2190 \u8FD4\u56DE\u5BFC\u5165": "\u2190 Back to import",
        "\u7EE7\u7EED\u5BA1\u9605": "Continue review",
        "\u6700\u8FD1\u5904\u7406\u8BB0\u5F55": "Recent decisions",
        "\u5148\u5BFC\u5165\u5EFA\u8BAE\u5305\uFF0C\u518D\u9010\u9879\u786E\u8BA4\u3002\u6BCF\u6B21\u63A5\u53D7\u90FD\u4F1A\u641C\u7D22\u5F53\u524D\u539F\u6587\uFF1B\u8FC7\u65F6\u6216\u4E0D\u552F\u4E00\u7684\u9879\u81EA\u52A8\u8DF3\u8FC7\u3002": "Import a pack and review each item. Accept searches the current source; stale or ambiguous items are skipped.",
        "\u5EFA\u8BAE\u5305 JSON": "Suggestion pack JSON",
        "\u7C98\u8D34 Agent \u751F\u6210\u7684\u5EFA\u8BAE\u5305": "Paste an Agent suggestion pack",
        "\u8FDE\u63A5 Agent": "Connect Agent",
        "\u65AD\u5F00": "Disconnect",
        "\u672C\u5730\u8FDE\u63A5\u914D\u5BF9\u4EE4\u724C": "Local pairing token",
        "\u9009\u62E9 JSON \u6587\u4EF6": "Choose JSON file",
        "\u5F00\u59CB\u5BA1\u9605": "Start review",
        "\u6062\u590D\u4E0A\u6B21\u5BA1\u9605": "Resume review",
        "\u6E05\u9664\u8FDB\u5EA6": "Clear progress",
        "\u505C\u6B62": "Stop",
        "\u7B49\u5F85\u5BFC\u5165\u5EFA\u8BAE\u5305": "Import a suggestion pack to begin",
        "\u5DF2\u5199\u5165\u8868\u793A\u7F16\u8F91\u5668\u5185\u5BB9\u5DF2\u6838\u9A8C\uFF0C\u670D\u52A1\u5668\u4FDD\u5B58\u9700\u5728 Overleaf \u68C0\u67E5\u3002\u53EF\u4F7F\u7528 Overleaf \u7684\u64A4\u9500\u6309\u94AE\u3002": "Written means editor content was verified. Check saving in Overleaf; use its Undo button if needed.",
        "\u65B0\u589E": "Added",
        "\u5220\u9664": "Deleted",
        "\u66FF\u6362\u539F\u6587": "Replaces",
        "\u539F\u6587 \xB7 \u6807\u51FA\u5220\u9664": "Original \xB7 deletions marked",
        "\u4FEE\u6539\u540E \xB7 \u6807\u51FA\u65B0\u589E": "After \xB7 additions marked",
        "\u2191 \u4E0A\u4E00\u9879 \xB7 \u2193 \u4E0B\u4E00\u9879 \xB7 Enter \u63A5\u53D7\uFF08\u5BA1\u9605\u5361\u7247\u5185\uFF09": "\u2191 Previous \xB7 \u2193 Next \xB7 Enter Accept (in review card)",
        "\u539F\u6587": "Original",
        "\u5EFA\u8BAE\u4FEE\u6539": "Proposed change",
        "\u4E0A\u4E00\u9879": "Previous item",
        "\u4E0B\u4E00\u9879": "Next item",
        "\u5149\u6807\u4E0A\u4E00\u5904": "Before cursor",
        "\u5149\u6807\u4E0B\u4E00\u5904": "After cursor",
        "\u62D2\u7EDD\u8FD9\u4E00\u9879": "Reject this item",
        "\u63A5\u53D7\u8FD9\u4E00\u9879": "Accept this item",
        "\uFF08\u5220\u9664\u6B64\u6BB5\uFF09": "(delete this text)",
        "\u62D6\u52A8\u6807\u9898\u79FB\u52A8\u9762\u677F\uFF1B\u65B9\u5411\u952E\u5FAE\u8C03": "Drag the title to move; arrow keys adjust position",
        "\u62D6\u52A8\u53F3\u4E0B\u89D2\u8C03\u6574\u5927\u5C0F\uFF1B\u65B9\u5411\u952E\u5FAE\u8C03": "Drag the bottom-right corner to resize; arrow keys adjust size",
        "\u8BED\u8A00": "Language",
        "\u539F\u6587\u5DF2\u9AD8\u4EAE\uFF1B\u63A5\u53D7\u65F6\u91CD\u65B0\u641C\u7D22\uFF0C\u8FC7\u65F6\u9879\u8DF3\u8FC7\u3002": "Original highlighted. Accept searches again; stale items are skipped.",
        "\u539F\u6587\u5DF2\u5728\u6E90\u7801\u4E2D\u9AD8\u4EAE\uFF0C\u7B49\u5F85\u786E\u8BA4": "Original highlighted in source; waiting for your decision",
        "\u9AD8\u4EAE\u6682\u4E0D\u53EF\u7528\uFF0C\u8BF7\u5728\u6B64\u6838\u5BF9\u539F\u6587\u4E0E\u5EFA\u8BAE": "Highlight unavailable; compare the original and proposal here",
        "\u6B63\u6587\u6709\u53D8\u5316\uFF0C\u5DF2\u91CD\u65B0\u5B9A\u4F4D\u8FD9\u4E00\u9879\uFF0C\u7B49\u5F85\u786E\u8BA4": "Source changed; this item was relocated and awaits your decision",
        "\u6B63\u5728\u6309\u5F53\u524D\u5149\u6807\u67E5\u627E\u5EFA\u8BAE\u2026": "Finding suggestions near the current cursor\u2026",
        "\u5F53\u524D\u6587\u4EF6\u7684\u5149\u6807\u8FD9\u4E00\u4FA7\u6CA1\u6709\u53EF\u5B9A\u4F4D\u7684\u5F85\u5904\u7406\u5EFA\u8BAE": "No locatable pending suggestion on this side of the cursor in this file",
        "\u6CA1\u6709\u5176\u4ED6\u5F85\u5904\u7406\u5EFA\u8BAE\uFF1B\u5F53\u524D\u9879\u4ECD\u7B49\u5F85\u786E\u8BA4": "No other pending suggestion; the current item still awaits your decision",
        "\u6B63\u6587\u3001\u6587\u4EF6\u6216\u5149\u6807\u6709\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u5BFC\u822A": "Source, file or cursor changed; click navigation again",
        "\u5BFC\u822A\u672A\u5B8C\u6210\uFF1A": "Navigation failed: ",
        "\u5DF2\u505C\u6B62": "Stopped",
        "\u9875\u9762\u8FDE\u63A5\u8D85\u65F6": "Page connection timed out",
        "\u65E0\u6CD5\u8FDE\u63A5\u9875\u9762": "Cannot connect to the page",
        "\u4FDD\u5B58\u5B9A\u4F4D\u8BB0\u5F55\u5931\u8D25\uFF1A": "Could not save position tracking: ",
        "\u4FDD\u5B58\u5BA1\u9605\u51B3\u5B9A\u5931\u8D25\uFF1A": "Could not save the review decision: ",
        "\u5DF2\u5199\u5165": "Written",
        "\u5DF2\u62D2\u7EDD": "Rejected",
        "\u5199\u5165\u672A\u786E\u8BA4": "Write unconfirmed",
        "\u5DF2\u8DF3\u8FC7\uFF1A": "Skipped: ",
        "\u5F53\u524D\u9879\u5DF2\u5199\u5165\u7F16\u8F91\u5668\uFF0C\u7EE7\u7EED\u6838\u5BF9\u4E0B\u4E00\u9879": "This item was written to the editor; review the next item",
        "\u8BF7\u5148\u6253\u5F00 Overleaf \u9879\u76EE": "Open an Overleaf project first",
        "\u5EFA\u8BAE\u5305\u5C5E\u4E8E\u5176\u4ED6\u9879\u76EE\uFF0C\u6CA1\u6709\u5199\u5165": "This pack belongs to another project; no write was made",
        "\u5EFA\u8BAE\u5DF2\u66F4\u65B0\u6216\u5BA1\u9605\u5DF2\u505C\u6B62": "Suggestions changed or review stopped",
        "\u5199\u5165\u7ED3\u679C\u672A\u786E\u8BA4\uFF0C\u5DF2\u505C\u6B62\u3002\u8BF7\u68C0\u67E5\u5F53\u524D\u6B63\u6587\uFF0C\u4E0D\u8981\u91CD\u590D\u63A5\u53D7\u3002": "Write could not be verified; review stopped. Check the source before accepting again.",
        "\u5BA1\u9605\u5DF2\u505C\u6B62\uFF1A": "Review stopped: ",
        "\u672C\u5730\u8FDE\u63A5\u9700\u8981\u5728 Chrome \u6269\u5C55\u4E2D\u4F7F\u7528": "Local connection requires the Chrome extension",
        "\u5DF2\u8FDE\u63A5\uFF1AAgent \u8BF7\u6C42\u65F6\u624D\u8BFB\u53D6\u6E90\u7801\uFF1B\u65B0\u5EFA\u8BAE\u7B49\u5F85\u9010\u9879\u786E\u8BA4": "Connected: source is read only on Agent request; suggestions await individual decisions",
        "\u5DF2\u65AD\u5F00\u672C\u5730\u8FDE\u63A5": "Local connection disconnected",
        "\u6E90\u7801\u7F16\u8F91\u5668\u672A\u5C31\u7EEA": "Source editor is not ready",
        "\u5DF2\u8FDE\u63A5 \xB7 \u6E90\u7801\u6309\u9700\u8BFB\u53D6 \xB7 \u5EFA\u8BAE\u7248\u672C ": "Connected \xB7 source read on request \xB7 pack revision ",
        "\u672C\u5730\u8FDE\u63A5\u6682\u4E0D\u53EF\u7528\uFF1A": "Local connection unavailable: ",
        "\u5EFA\u8BAE\u5305\u4E0D\u80FD\u8D85\u8FC7 64 MiB": "Suggestion packs must not exceed 64 MiB",
        "\u5DF2\u8BFB\u53D6\u5EFA\u8BAE\u5305\uFF0C\u70B9\u51FB\u5F00\u59CB\u5BA1\u9605": "Pack loaded; click Start review",
        "\u65E0\u6CD5\u8BFB\u53D6\u6587\u4EF6": "Could not read the file",
        "\u6062\u590D\u8FDB\u5EA6\u9700\u8981 Chrome \u6269\u5C55": "Resuming requires the Chrome extension",
        "\u5F53\u524D\u9879\u76EE\u6CA1\u6709\u4FDD\u5B58\u7684\u5EFA\u8BAE\u5305": "No saved suggestion pack for this project",
        "\u5DF2\u6E05\u9664\u5F53\u524D\u9879\u76EE\u7684\u5BA1\u9605\u8FDB\u5EA6\uFF1B\u6B63\u6587\u4E0D\u53D8\uFF0C\u53EF\u91CD\u65B0\u5BFC\u5165\u5BA1\u9605": "Review progress cleared for this project. Source is unchanged; import a pack to review again.",
        "\u6B63\u5728\u505C\u6B62\uFF1B\u5DF2\u6D3E\u53D1\u7684\u9879\u9700\u6838\u9A8C\u5B9E\u9645\u7ED3\u679C\u3002": "Stopping; verify the result of any write already dispatched.",
        "\u4E0E\u5DF2\u63A5\u53D7\u4FEE\u6539\u91CD\u53E0\u51B2\u7A81\uFF0C\u8DF3\u8FC7": "Overlaps an accepted change; skipped",
        "\u5B57\u7B26\u5DEE\u5F02\u8FC7\u4E8E\u590D\u6742\uFF0C\u8DF3\u8FC7": "Character diff too complex; skipped",
        "\u539F\u6587\u6216\u4E0A\u4E0B\u6587\u5DF2\u7ECF\u53D8\u5316\uFF0C\u8DF3\u8FC7": "Original or context changed; skipped",
        "\u5DF2\u7ECF\u5E94\u7528\uFF0C\u8DF3\u8FC7": "Already applied; skipped",
        "\u5339\u914D\u5230\u591A\u5904\u539F\u6587\uFF0C\u8DF3\u8FC7": "Multiple source matches; skipped",
        "\u677F\u5757\u6807\u8BB0\u5DF2\u7ECF\u53D8\u5316\uFF0C\u8DF3\u8FC7": "Section markers changed; skipped",
        "\u677F\u5757\u6807\u8BB0\u4E0D\u552F\u4E00\uFF0C\u8DF3\u8FC7": "Section markers ambiguous; skipped",
        "\u5185\u5BB9\u6CA1\u6709\u53D8\u5316\uFF0C\u8DF3\u8FC7": "No change; skipped",
        "\u6587\u4EF6\u6216 Code \u7F16\u8F91\u5668\u672A\u5C31\u7EEA\uFF0C\u8DF3\u8FC7": "File or code editor not ready; skipped",
        "\u5F53\u524D\u6587\u4EF6\u5DF2\u5207\u6362\uFF0C\u8DF3\u8FC7": "Active file changed; skipped",
        "\u7F16\u8F91\u5668\u72B6\u6001\u5DF2\u53D8\u5316\uFF0C\u8DF3\u8FC7": "Editor state changed; skipped",
        "\u6587\u4EF6\u8DEF\u5F84\u5FC5\u987B\u662F\u9879\u76EE\u5185\u7684\u76F8\u5BF9\u8DEF\u5F84": "File paths must be relative to the project",
        "\u53EA\u652F\u6301\u9879\u76EE\u5185\u7684\u6587\u672C\u6587\u4EF6": "Only project text files are supported",
        "\u6BCF\u9879\u5FC5\u987B\u5305\u542B\u975E\u7A7A original \u548C\u5B57\u7B26\u4E32 replacement": "Each item needs a nonempty original and a string replacement",
        "\u5355\u9879\u4FEE\u6539\u8FC7\u957F": "Suggestion text is too long",
        "\u4E0A\u4E0B\u6587\u5FC5\u987B\u662F\u6587\u672C\u4E14\u4E0D\u8D85\u8FC7 10000 \u5B57\u7B26": "Context must be text with at most 10,000 characters",
        "scope \u5FC5\u987B\u5305\u542B start\uFF0C\u53EF\u9009 end\uFF0C\u5747\u4E3A\u539F\u6587\u6807\u8BB0": "scope requires start and an optional end, both exact source markers",
        "\u9700\u8981 codex-overleaf-suggestions v1 \u5EFA\u8BAE\u5305\uFF0C\u542B 1\u201310000 \u9879": "Use a codex-overleaf-suggestions v1 pack with 1\u201310,000 items",
        "projectId \u5FC5\u987B\u662F Overleaf \u9879\u76EE ID": "projectId must be an Overleaf project ID",
        "\u6BCF\u9879 id \u5FC5\u987B\u552F\u4E00": "Each item id must be unique"
      };
      var templates = [
        [/^建议 (\d+) \/ (\d+)$/, (_, position, remaining) => `Suggestion ${position} / ${remaining}`],
        [/^修改 (.*)$/, (_, id) => "Change " + id],
        [/^Agent 建议版本 (\d+)，共 (\d+) 项$/, (_, revision, count) => `Agent pack revision ${revision}, ${count} items`],
        [/^已载入文件：(.*)（正文不在输入框展开）$/, (_, name) => `Loaded file: ${name} (pack not expanded here)`],
        [/^已恢复 (\d+) 项建议$/, (_, count) => `Restored ${count} suggestions`],
        [/^审阅结束：写入 (\d+) 项，拒绝 (\d+) 项，跳过 (\d+) 项，保留先前决定 (\d+) 项。$/, (_, a, b, c, d) => `Review complete: ${a} written, ${b} rejected, ${c} skipped, ${d} previous decisions retained.`],
        [/^(.*) · 修改 (.*)：(.*)$/, (_, file, id, state) => `${file} \xB7 Change ${id}: ${translate(state, "en")}`]
      ];
      function translate(text, language) {
        if (language !== "en" || typeof text !== "string") return text;
        if (english[text]) return english[text];
        for (const [pattern, replace] of templates) if (pattern.test(text)) return text.replace(pattern, replace);
        for (const key of Object.keys(english)) if (key.endsWith("\uFF1A") || key.endsWith(" ")) {
          if (text.startsWith(key)) return english[key] + translate(text.slice(key.length), language);
        }
        return text;
      }
      function normalize(language) {
        return language === "en" ? "en" : "zh-CN";
      }
      function previewLabels(item, line, language) {
        const t = (text) => translate(text, language);
        return { added: t("\u65B0\u589E"), removed: t("\u5220\u9664"), replaced: t("\u66FF\u6362\u539F\u6587"), title: t("\u4FEE\u6539 " + item.id + " \xB7 L" + line), hint: t("\u2191 \u4E0A\u4E00\u9879 \xB7 \u2193 \u4E0B\u4E00\u9879 \xB7 Enter \u63A5\u53D7\uFF08\u5BA1\u9605\u5361\u7247\u5185\uFF09"), accept: t("\u63A5\u53D7\u8FD9\u4E00\u9879"), reject: t("\u62D2\u7EDD\u8FD9\u4E00\u9879"), empty: t("\uFF08\u5220\u9664\u6B64\u6BB5\uFF09"), previous: t("\u4E0A\u4E00\u9879"), next: t("\u4E0B\u4E00\u9879"), move: t("\u62D6\u52A8\u6807\u9898\u79FB\u52A8\u9762\u677F\uFF1B\u65B9\u5411\u952E\u5FAE\u8C03"), resize: t("\u62D6\u52A8\u53F3\u4E0B\u89D2\u8C03\u6574\u5927\u5C0F\uFF1B\u65B9\u5411\u952E\u5FAE\u8C03") };
      }
      module.exports = { translate, normalize, previewLabels, english };
    }
  });

  // src/reviewDiff.js
  var require_reviewDiff = __commonJS({
    "src/reviewDiff.js"(exports, module) {
      "use strict";
      function parts(patch, edits) {
        const before = [], after = [], inline = [];
        let offset = 0;
        const push = (list, text, kind = "equal", previous = "") => {
          if (text) list.push({ text, kind, previous });
        };
        for (const edit of edits) {
          const from = edit.from - patch.from, to = edit.to - patch.from;
          if (from < offset || to < from || to > patch.expected.length || patch.expected.slice(from, to) !== edit.expected) throw new Error("invalid_display_diff");
          const equal2 = patch.expected.slice(offset, from);
          for (const list of [before, after, inline]) push(list, equal2);
          push(before, edit.expected, "removed");
          push(after, edit.insert, "added", edit.expected);
          if (edit.insert) push(inline, edit.insert, "added", edit.expected);
          else push(inline, edit.expected, "deletion");
          offset = to;
        }
        const equal = patch.expected.slice(offset);
        for (const list of [before, after, inline]) push(list, equal);
        return { before, after, inline };
      }
      var css = ".diff-equal{color:#586673}.diff-added{background:#bceac9;color:#105331;font-weight:700;text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:3px;border-radius:2px}.diff-removed{background:#ffd5c3;color:#8b321b;font-weight:700;text-decoration:line-through;border-radius:2px}.diff-deletion{user-select:none;display:inline-block;background:#ffe1d6;color:#8b321b;font-weight:700;border:1px solid #f0b39d;border-radius:3px;padding:0 3px;margin:0 2px;font-size:.9em}.diff-empty{color:#687888}";
      function render(element, parts2, labels = {}) {
        const document2 = element.ownerDocument, fragment = document2.createDocumentFragment();
        for (const part of parts2) {
          const node = document2.createElement(part.kind === "equal" ? "span" : "mark");
          node.className = "diff-" + part.kind;
          node.textContent = part.kind === "deletion" ? "\u2212" + part.text : part.text;
          if (part.kind !== "equal") {
            const label = part.kind === "added" ? part.previous ? labels.replaced : labels.added : labels.removed;
            node.title = (label || part.kind) + (part.previous ? ": " + part.previous : "");
            if (part.kind === "deletion") node.setAttribute("aria-label", (labels.removed || "Deleted") + ": " + part.text);
          }
          fragment.append(node);
        }
        if (!parts2.length) {
          const node = document2.createElement("span");
          node.className = "diff-empty";
          node.textContent = labels.empty || "(delete this text)";
          fragment.append(node);
        }
        element.replaceChildren(fragment);
      }
      module.exports = { parts, render, css };
    }
  });

  // src/navigation.js
  var require_navigation = __commonJS({
    "src/navigation.js"(exports, module) {
      "use strict";
      function adjacent(index, total, direction, isPending) {
        for (let step = 1; step < total; step++) {
          const i = (index + direction * step + total) % total;
          if (isPending(i)) return i;
        }
        return null;
      }
      function nearest(matches, cursor, direction, currentIndex) {
        let best = null;
        for (const match of matches) {
          if (match.index === currentIndex && cursor >= match.from && cursor <= match.to) continue;
          if (direction < 0 ? match.from >= cursor : match.from <= cursor) continue;
          if (!best || (direction < 0 ? match.from > best.from : match.from < best.from) || match.from === best.from && match.index < best.index) best = match;
        }
        return best?.index ?? null;
      }
      module.exports = { adjacent, nearest };
    }
  });

  // src/service.js
  var require_service = __commonJS({
    "src/service.js"(exports, module) {
      "use strict";
      var Core = require_suggestions();
      var Rebase = require_rebase();
      var I18n = require_i18n();
      var Diff = require_reviewDiff();
      var Navigation = require_navigation();
      var { characterEdits } = require_characterEdits();
      function create({ adapter: adapter2, preview: preview2, crypto }) {
        let pending = null, generation = 0, scan = null, language = "zh-CN";
        const receipts = /* @__PURE__ */ new Map(), ledgers = /* @__PURE__ */ new Map();
        let journals = [];
        const textCache = /* @__PURE__ */ new WeakMap(), navigationCache = /* @__PURE__ */ new WeakMap();
        function textOf(view) {
          const doc = view.state.doc;
          if (typeof doc.length !== "number") return doc.toString();
          if (!textCache.has(doc)) textCache.set(doc, doc.toString());
          return textCache.get(doc);
        }
        const drain = () => {
          const value = journals.map((entry) => ({ ...entry, id: crypto.randomUUID() }));
          journals = [];
          return value;
        };
        function begin(saved = {}) {
          cancel();
          ledgers.clear();
          journals = [];
          for (const [file, data] of Object.entries(saved.ledgers || {})) {
            if (typeof data.base !== "string" || !Array.isArray(data.edits)) continue;
            const edits = data.edits.map((p) => ({ ...p })).sort((a, b) => a.from - b.from || a.to - b.to);
            let current2 = data.base;
            for (const p of [...edits].reverse()) current2 = current2.slice(0, p.from) + p.insert + current2.slice(p.to);
            ledgers.set(key(adapter2.projectId(), file), { base: data.base, current: current2, edits, version: 0 });
          }
          return { ok: true };
        }
        function ledgerFor(owner, file, text) {
          const id = key(owner, file);
          let ledger = ledgers.get(id);
          if (ledger) {
            const update = Rebase.sync(ledger, text);
            if (!update.ok) ledger = null;
            else if (update.edits.length) journals.push({ file, edits: update.edits, replace: update.replace });
          }
          if (!ledger) {
            ledger = { base: text, current: text, edits: [], version: 0 };
            ledgers.set(id, ledger);
            journals.push({ file, base: text, edits: [] });
          }
          return ledger;
        }
        function snapshot() {
          const view = adapter2.view();
          return view ? { ok: true, projectId: adapter2.projectId(), file: adapter2.path(), source: textOf(view) } : failure("file_not_ready");
        }
        const key = (owner, file) => owner + "/" + file;
        const failure = (code) => ({ ok: false, code, changedDocument: false });
        const current = (projectId) => projectId && adapter2.projectId() === projectId;
        function cancel() {
          generation++;
          if (pending) preview2.clear({ token: pending.token });
          pending = null;
          scan = null;
          return { ok: true };
        }
        function navigation(params) {
          if (!current(params.projectId)) return failure("project_changed");
          const view = adapter2.view(), file = adapter2.path();
          if (!view || !view.state.selection?.main) return failure("file_not_ready");
          if (!params.scanId) {
            const text = textOf(view), ledger = ledgerFor(params.projectId, file, text);
            let cache = navigationCache.get(view.state.doc);
            if (typeof view.state.doc.length !== "number" || !cache || cache.ledger !== ledger || cache.version !== ledger.version) {
              cache = { ledger, version: ledger.version, positions: /* @__PURE__ */ new Map() };
              navigationCache.set(view.state.doc, cache);
            }
            if (!cache.indexed || cache.catalogId !== params.catalogId) {
              cache.catalogId = params.catalogId;
              cache.complete = false;
              cache.indexed = /* @__PURE__ */ new Map();
            }
            scan = { id: crypto.randomUUID(), view, doc: view.state.doc, text, file, ledger, cache: cache.positions, index: cache, cursor: view.state.selection.main.head };
            const cached = Boolean(params.catalogId && cache.complete);
            const excluded = new Set(params.excludedIndexes || []);
            const target = cached ? Navigation.nearest([...cache.indexed.values()].filter((p) => !excluded.has(p.index)), scan.cursor, params.direction, params.currentIndex) : null;
            return { ok: true, scanId: scan.id, file, cursor: scan.cursor, cached, target, journal: drain() };
          }
          if (!scan || scan.id !== params.scanId || view !== scan.view || file !== scan.file || (typeof view.state.doc.length === "number" ? view.state.doc !== scan.doc : textOf(view) !== scan.text) || view.state.selection.main.head !== scan.cursor) return failure("navigation_changed");
          if (!Array.isArray(params.items) || params.items.length > 128) return failure("invalid_navigation");
          const matches = [];
          let processed = 0;
          const started = performance.now();
          for (const entry of params.items) {
            const item = Core.normalizeItem(entry.item);
            if (item.file === file) {
              const identity = entry.item.reviewKey || JSON.stringify(item);
              if (!scan.cache.has(identity)) {
                const match = Rebase.resolve(scan.text, item, scan.ledger);
                const edits = match.ok ? match.characterChanges || characterEdits(match.patch, scan.text) : null;
                if (scan.cache.size >= 1e4) scan.cache.clear();
                scan.cache.set(identity, edits?.length ? { from: edits[0].from, to: edits[edits.length - 1].to } : null);
              }
              const position = scan.cache.get(identity);
              if (position) {
                const match = { index: entry.index, ...position };
                matches.push(match);
                scan.index.indexed.set(entry.index, match);
              }
            }
            processed++;
            if (performance.now() - started >= 8) break;
          }
          if (params.complete === true && !params.items.length && scan.index.catalogId) scan.index.complete = true;
          return { ok: true, scanId: scan.id, processed, matches };
        }
        async function prepare(params) {
          const item = Core.normalizeItem(params.item), owner = params.projectId;
          cancel();
          const attempt = generation;
          if (!current(owner)) return failure("project_changed");
          const reveal = params.reveal !== false;
          const ready = reveal ? await adapter2.open(item.file, owner) : adapter2.path() === item.file;
          if (attempt !== generation) return failure("cancelled");
          if (!current(owner)) return failure("project_changed");
          if (!ready || adapter2.path() !== item.file) return failure("file_not_ready");
          const view = adapter2.view();
          if (!view) return failure("file_not_ready");
          const text = textOf(view);
          const match = Rebase.resolve(text, item, ledgerFor(owner, item.file, text));
          if (!match.ok) return { ...match, journal: drain() };
          const highlights = characterEdits(match.patch, text);
          if (!highlights) return failure("diff_too_complex");
          const diff = Diff.parts(match.patch, highlights);
          const token = crypto.randomUUID();
          pending = { item, projectId: owner, token, view, text, doc: view.state.doc, line: match.line };
          const shown = await preview2.show({
            reveal,
            token,
            runProjectId: owner,
            path: item.file,
            base: text,
            patch: match.patch,
            highlightPatches: highlights,
            diff,
            labels: I18n.previewLabels(item, match.line, language)
          });
          if (attempt !== generation) {
            preview2.clear({ token });
            return failure("cancelled");
          }
          if (!shown.ok && shown.code !== "review_preview_unsupported") {
            cancel();
            return failure("file_not_ready");
          }
          pending.inline = shown.ok;
          return { ok: true, token, diff, item: { ...item, original: match.patch.expected, replacement: match.patch.insert }, line: match.line, inline: shown.ok, journal: drain() };
        }
        async function status(params) {
          const item = pending;
          if (!item || item.token !== params.token) return failure("expired");
          if (!current(item.projectId)) {
            cancel();
            return failure("project_changed");
          }
          if (adapter2.path() !== item.item.file) {
            cancel();
            return failure("file_changed");
          }
          const view = adapter2.view();
          if (!view) {
            cancel();
            return failure("file_not_ready");
          }
          if (view !== item.view || (typeof view.state.doc.length === "number" ? view.state.doc !== item.doc : textOf(view) !== item.text)) {
            const result2 = await prepare({ item: item.item, projectId: item.projectId, reveal: false });
            return { ...result2, refreshed: result2.ok };
          }
          const result = item.inline ? preview2.read({ token: item.token }) : { ok: true, token: item.token, decision: null };
          if (result.navigation === -1 || result.navigation === 1) preview2.consumeNavigation({ token: item.token });
          return result;
        }
        function apply(params) {
          if (receipts.has(params.token)) return receipts.get(params.token);
          const item = pending;
          if (!item || item.token !== params.token) return failure("expired");
          if (!current(item.projectId)) {
            cancel();
            return failure("project_changed");
          }
          if (adapter2.path() !== item.item.file) {
            cancel();
            return failure("file_changed");
          }
          const view = adapter2.view();
          if (!view?.dom?.isConnected) {
            cancel();
            return failure("editor_changed");
          }
          const text = textOf(view), match = Rebase.resolve(text, item.item, ledgerFor(item.projectId, item.item.file, text));
          if (!match.ok) {
            cancel();
            return { ...match, journal: drain() };
          }
          const changes = characterEdits(match.patch, text);
          if (!changes) {
            cancel();
            return failure("diff_too_complex");
          }
          if (!changes.length) {
            cancel();
            return failure("no_change");
          }
          let expected = text;
          for (const p of [...changes].reverse()) expected = expected.slice(0, p.from) + p.insert + expected.slice(p.to);
          const last = changes[changes.length - 1];
          const anchor = last.from + last.insert.length + changes.slice(0, -1).reduce((sum, p) => sum + p.insert.length - (p.to - p.from), 0);
          preview2.clear({ token: item.token });
          pending = null;
          generation++;
          let result;
          try {
            view.dispatch({ changes: changes.map(({ from, to, insert }) => ({ from, to, insert })), selection: { anchor }, scrollIntoView: true });
            result = adapter2.path() === item.item.file && current(item.projectId) && adapter2.view() === view && textOf(view) === expected ? { ok: true, changedDocument: true, verified: true, file: item.item.file, line: match.line, serverSaved: null } : { ok: false, code: "write_unconfirmed", changedDocument: true, serverSaved: null };
          } catch (error) {
            result = { ok: false, code: "write_unconfirmed", changedDocument: true, error: error.message };
          }
          if (result.verified) {
            const ledger = ledgers.get(key(item.projectId, item.item.file));
            if (ledger?.current === text && match.baselineChanges) {
              Rebase.add(ledger, match.baselineChanges);
              ledger.current = expected;
              journals.push({ file: item.item.file, edits: match.baselineChanges });
            } else ledgers.delete(key(item.projectId, item.item.file));
          }
          result.journal = drain();
          receipts.set(item.token, result);
          if (receipts.size > 500) receipts.delete(receipts.keys().next().value);
          return result;
        }
        function setLanguage(params) {
          language = I18n.normalize(params.language);
          if (pending?.inline) preview2.labels({ labels: I18n.previewLabels(pending.item, pending.line, language) });
          return { ok: true };
        }
        return { prepare, status, apply, cancel, begin, snapshot, navigation, setLanguage };
      }
      module.exports = { create };
    }
  });

  // vendor/treeOperations.js
  var require_treeOperations = __commonJS({
    "vendor/treeOperations.js"(exports, module) {
      (function initCodexOverleafTreeOperations(root, factory) {
        if (typeof module === "object" && module.exports) {
          module.exports = factory();
        } else {
          root.CodexOverleafTreeOperations = factory();
        }
      })(typeof window !== "undefined" ? window : globalThis, function treeOperationsFactory() {
        "use strict";
        const TEXT_PATH_EXTENSION_PATTERN = "(?:tex|bib|sty|cls|bst|bbx|cbx|lbx|cfg|def|clo|ist|txt|md|latex)";
        function create({
          projectFiles: ProjectFiles,
          window: windowDep,
          document: documentDep,
          normalizePath = fallbackNormalizeSafeProjectPath,
          readActiveEditorText = () => "",
          getActiveEditorIdentity = () => null,
          activeEditorIdentityChanged = () => false,
          getActiveFilePathFromEditorStore: readActiveFilePathFromEditorStore = () => ""
        } = {}) {
          const window2 = windowDep || (typeof globalThis !== "undefined" ? globalThis : {});
          const document2 = documentDep || window2.document || {};
          const normalizeSafeProjectPath = normalizePath;
          const NodeCtor = window2.Node || (typeof Node !== "undefined" ? Node : null);
          const EventTargetCtor = window2.EventTarget || (typeof EventTarget !== "undefined" ? EventTarget : null);
          let internalDocPathByIdCache = null;
          let internalDocPathByIdCacheTime = 0;
          let domProjectPathCache = null;
          let domProjectPathCacheTime = 0;
          let lastFileTreeSelection = null;
          function collectElements(selector, limit) {
            const result = [];
            const roots = collectSearchRoots();
            for (let rootIndex = 0; rootIndex < roots.length && result.length < limit; rootIndex += 1) {
              let nodes = [];
              try {
                nodes = Array.from(roots[rootIndex].querySelectorAll(selector));
              } catch (_error) {
                nodes = [];
              }
              for (const node of nodes) {
                result.push(node);
                if (result.length >= limit) {
                  break;
                }
              }
            }
            return result;
          }
          function collectSearchRoots() {
            const roots = [];
            const seenRoots = /* @__PURE__ */ new Set();
            const queue = [document2];
            for (let index = 0; index < queue.length && roots.length < 80; index += 1) {
              const root = queue[index];
              if (!root || seenRoots.has(root)) {
                continue;
              }
              seenRoots.add(root);
              roots.push(root);
              let allNodes = [];
              try {
                allNodes = Array.from(root.querySelectorAll("*")).slice(0, 4e3);
              } catch (_error) {
                allNodes = [];
              }
              for (const node of allNodes) {
                if (node.shadowRoot && !seenRoots.has(node.shadowRoot)) {
                  queue.push(node.shadowRoot);
                }
                if (node.tagName === "IFRAME") {
                  try {
                    if (node.contentDocument && !seenRoots.has(node.contentDocument)) {
                      queue.push(node.contentDocument);
                    }
                  } catch (_error) {
                  }
                }
              }
            }
            return roots;
          }
          function uniqueNodes(nodes) {
            return Array.from(new Set(nodes));
          }
          function getProjectId() {
            const match = window2.location.pathname.match(/\/project\/([^/]+)/);
            return match ? decodeURIComponent(match[1]) : null;
          }
          function readNativeTreePath(node) {
            const row = node?.closest?.('[role="treeitem"]');
            const root = document2.querySelector?.('[data-testid="file-tree-list-root"]');
            if (!row || !root?.contains?.(row) || !row.querySelector?.('[data-file-type="doc"][data-file-id]')) return "";
            const parts = [row.getAttribute("aria-label")];
            let group = row.closest('[role="tree"]');
            const seen = /* @__PURE__ */ new Set();
            while (group && group !== root) {
              if (seen.has(group)) return "";
              seen.add(group);
              const folder = group.previousElementSibling;
              if (folder?.getAttribute?.("role") !== "treeitem" || !folder.querySelector?.('[data-file-type="folder"]')) return "";
              parts.unshift(folder.getAttribute("aria-label"));
              group = group.parentElement?.closest?.('[role="tree"]');
            }
            if (group !== root || parts.some((part) => !part || /[/\\]/.test(part))) return "";
            return normalizeSafeProjectPath(parts.join("/"));
          }
          function getActiveFilePath() {
            const editorStorePath = getEditorStoreFilePath({ disambiguateBasename: true });
            if (editorStorePath && ProjectFiles.isTextProjectPath(editorStorePath) && !hasMultipleTextPathExtensions(editorStorePath)) {
              return editorStorePath;
            }
            const breadcrumbPath = readActiveFilePathFromEditorBreadcrumb();
            if (breadcrumbPath) {
              return breadcrumbPath;
            }
            const selectors = [
              '[aria-selected="true"][role="treeitem"]',
              '[aria-selected="true"][role="row"]',
              '.selected[role="treeitem"]',
              '.selected[role="row"]',
              ".file-tree .selected",
              ".project-tree .selected"
            ];
            const candidates = [];
            for (const selector of selectors) {
              const nodes = Array.from(document2.querySelectorAll?.(selector) || []);
              for (const node of nodes) {
                const path = node ? readNativeTreePath(node) || readProjectPathFromNode(node) : "";
                if (isActiveFilePathCandidate(path, node)) {
                  candidates.push({
                    node,
                    path,
                    score: scoreActiveFilePathCandidate(path, node)
                  });
                }
              }
            }
            if (candidates.length) {
              candidates.sort((left, right) => right.score - left.score);
              return candidates[0].path;
            }
            return "";
          }
          function getEditorStoreFilePath(options = {}) {
            return normalizeSafeProjectPath(readActiveFilePathFromEditorStore(options));
          }
          function scoreActiveFilePathCandidate(path, node) {
            let score = 0;
            const selected = getSettledRecentFileTreeSelection();
            if (selected?.path === path) {
              score += 1e3;
            }
            if (node?.getAttribute?.("aria-selected") === "true") {
              score += 100;
            }
            const className = normalizeDomText(node?.className || "");
            if (/\b(?:active|current|selected)\b/i.test(className)) {
              score += 50;
            }
            if (isVisibleNode(node)) {
              score += 10;
            }
            return score;
          }
          function getSettledRecentFileTreeSelection() {
            if (!lastFileTreeSelection?.path) {
              return null;
            }
            const elapsedMs = Date.now() - lastFileTreeSelection.time;
            if (elapsedMs < 0 || elapsedMs > 6e4) {
              return null;
            }
            if (lastFileTreeSelection.editorIdentityBefore && activeEditorIdentityChanged(lastFileTreeSelection.editorIdentityBefore)) {
              return lastFileTreeSelection;
            }
            const beforeSignature = lastFileTreeSelection.editorTextSignatureBefore || "";
            if (beforeSignature && contentSignature(readActiveEditorText()) !== beforeSignature) {
              return lastFileTreeSelection;
            }
            return null;
          }
          function isVisibleNode(node) {
            if (!node) {
              return false;
            }
            if (typeof node.getClientRects === "function" && node.getClientRects().length > 0) {
              return true;
            }
            return node.offsetParent != null;
          }
          async function openFileByPath(filePath, options = {}) {
            const normalizedPath = normalizeSafeProjectPath(filePath);
            if (!normalizedPath) {
              return {
                ok: false,
                reason: "Invalid file path"
              };
            }
            if (options.force !== true && getActiveFilePath() === normalizedPath) {
              return {
                ok: true,
                method: "already-active"
              };
            }
            const diagnostics = {
              path: normalizedPath,
              initialActivePath: getActiveFilePath(),
              initialDomNodeFound: false,
              ancestorFolders: [],
              postExpandDomNodeFound: false,
              domClickActivePath: "",
              managerMethods: []
            };
            let node = findFileTreeNode(normalizedPath, { invalidateCache: true });
            diagnostics.initialDomNodeFound = Boolean(node);
            if (!node && normalizedPath.includes("/")) {
              diagnostics.ancestorFolders = await ensureAncestorFoldersVisible(normalizedPath);
              node = findFileTreeNode(normalizedPath, { invalidateCache: true });
              diagnostics.postExpandDomNodeFound = Boolean(node);
            }
            if (node) {
              dispatchFileTreeOpenClick(node);
              await delay(250);
              const active = await waitForActiveFile(normalizedPath, options.activeWaitMs ?? 5e3);
              diagnostics.domClickActivePath = getActiveFilePath();
              if (active) {
                return {
                  ok: true,
                  method: "dom-click"
                };
              }
              const retryNode = findFileTreeNode(normalizedPath, { invalidateCache: true }) || node;
              dispatchActivationSequence(retryNode);
              dispatchKeyboardOpen(findFileTreeOpenClickTarget(retryNode) || retryNode);
              const retried = await waitForActiveFile(normalizedPath, options.retryWaitMs ?? 4e3);
              diagnostics.domRetryActivePath = getActiveFilePath() || "unknown";
              if (retried) {
                return {
                  ok: true,
                  method: "dom-click-retry"
                };
              }
            }
            const manager = findFileTreeManager();
            const openMethods = ["openDoc", "openFile", "selectFile", "selectEntity"];
            const openArgs = buildManagerOpenArgs(normalizedPath);
            for (const methodName of openMethods) {
              const method = manager?.[methodName];
              if (typeof method !== "function") {
                continue;
              }
              for (const openArg of openArgs) {
                const methodDiagnostics = {
                  method: methodName,
                  argType: openArg.type,
                  ok: false,
                  activePath: ""
                };
                try {
                  await method.call(manager, openArg.value);
                  const active = await waitForActiveFile(normalizedPath, 5e3);
                  methodDiagnostics.ok = active;
                  methodDiagnostics.activePath = getActiveFilePath();
                  diagnostics.managerMethods.push(methodDiagnostics);
                  if (active) {
                    return {
                      ok: true,
                      method: `fileTreeManager.${methodName}:${openArg.type}`
                    };
                  }
                } catch (error) {
                  methodDiagnostics.error = error?.message || String(error || "");
                  methodDiagnostics.activePath = getActiveFilePath();
                  diagnostics.managerMethods.push(methodDiagnostics);
                }
              }
            }
            return {
              ok: false,
              reason: `Could not open ${normalizedPath}; ${formatOpenDiagnostics(diagnostics)}`,
              diagnostics
            };
          }
          function buildManagerOpenArgs(filePath) {
            const normalizedPath = normalizeSafeProjectPath(filePath);
            const record = collectDocRecords({ includeWindowGlobals: true }).find((item) => item.path === normalizedPath);
            const args = [
              { type: "path", value: normalizedPath }
            ];
            if (record?.id) {
              args.unshift({ type: "doc-id", value: record.id });
              args.push({ type: "doc-record", value: { ...record } });
              args.push({ type: "doc-record-with-path", value: { ...record, path: normalizedPath, name: normalizedPath.split("/").pop() || normalizedPath } });
            }
            return args;
          }
          function formatOpenDiagnostics(diagnostics = {}) {
            const folders = (diagnostics.ancestorFolders || []).map((item) => `${item.path}:found=${item.found ? "yes" : "no"},expanded=${item.expandedBefore ? "yes" : "no"},visible=${item.visibleAfter ? "yes" : "no"}`).join("|") || "none";
            const managers = (diagnostics.managerMethods || []).map((item) => `${item.method}/${item.argType}:ok=${item.ok ? "yes" : "no"},active=${item.activePath || "unknown"}${item.error ? ",error=" + item.error : ""}`).slice(0, 8).join("|") || "none";
            return `open diagnostics initial=${diagnostics.initialActivePath || "unknown"}, initialNode=${diagnostics.initialDomNodeFound ? "yes" : "no"}, folders=${folders}, postExpandNode=${diagnostics.postExpandDomNodeFound ? "yes" : "no"}, domClickActive=${diagnostics.domClickActivePath || "unknown"}, domRetryActive=${diagnostics.domRetryActivePath || "none"}, manager=${managers}`;
          }
          function dispatchFileTreeOpenClick(node) {
            const path = readProjectPathFromNode(node);
            if (isActiveFilePathCandidate(path, node)) {
              recordFileTreeSelection(path, "script");
            }
            const target = findFileTreeOpenClickTarget(node) || node;
            dispatchActivationSequence(target);
          }
          function dispatchActivationSequence(node) {
            if (!node) {
              return;
            }
            try {
              node.scrollIntoView?.({ block: "nearest", inline: "nearest" });
            } catch (_error) {
            }
            try {
              node.focus?.({ preventScroll: true });
            } catch (_error) {
              try {
                node.focus?.();
              } catch (_nestedError) {
              }
            }
            for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
              try {
                node.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window2 }));
              } catch (_error) {
              }
            }
          }
          function dispatchKeyboardOpen(node) {
            for (const type of ["keydown", "keyup"]) {
              try {
                node?.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
              } catch (_error) {
              }
            }
          }
          function findFileTreeOpenClickTarget(node) {
            const selectors = [
              ".file-tree-entity-details",
              ".item-name",
              ".entity-name",
              ".file-tree-entity-button",
              '[role="button"]',
              "button"
            ];
            for (const selector of selectors) {
              let candidates = [];
              try {
                candidates = Array.from(node.querySelectorAll?.(selector) || []);
              } catch (_error) {
                candidates = [];
              }
              const candidate = candidates.find((item) => !isFileTreeMenuControl(item));
              if (candidate) {
                return candidate;
              }
            }
            return node;
          }
          function isFileTreeMenuControl(node) {
            if (!node || typeof node.getAttribute !== "function") {
              return false;
            }
            const role = node.getAttribute("role") || "";
            if (/^(?:treeitem|row)$/i.test(role)) {
              return false;
            }
            const signal = [
              node?.id || "",
              node?.className || "",
              node?.getAttribute?.("aria-label") || "",
              node?.getAttribute?.("title") || ""
            ].join(" ");
            if (/\b(?:menu|more_vert|action)\b/i.test(signal)) {
              return true;
            }
            const text = normalizeDomText(node.textContent || "");
            return /^(?:more_vert|menu|action menu)$/i.test(text);
          }
          function installFileTreeSelectionTracking() {
            const handlerKey = "__codexOverleafFileTreeSelectionHandler";
            if (typeof window2.removeEventListener === "function" && typeof window2[handlerKey] === "function") {
              window2.removeEventListener("click", window2[handlerKey], true);
            }
            const handler = (event) => {
              const path = readFileTreePathFromClickEvent(event);
              if (path) {
                recordFileTreeSelection(path, event?.isTrusted === true ? "user" : "script");
              }
            };
            window2[handlerKey] = handler;
            if (typeof window2.addEventListener === "function") {
              window2.addEventListener("click", handler, true);
            }
          }
          function readFileTreePathFromClickEvent(event) {
            const pathNodes = typeof event?.composedPath === "function" ? event.composedPath() : [];
            if (pathNodes.some((node) => node?.id === "codex-overleaf-panel") || event?.target?.closest?.("#codex-overleaf-panel")) return "";
            const insideTree = pathNodes.some((node) => /(?:^|\s)(?:file-tree|project-tree|file-tree-list)(?:\s|$)/.test(String(node?.className || ""))) || event?.target?.closest?.(".file-tree, .project-tree, .file-tree-list");
            if (!insideTree) return "";
            for (const node of pathNodes) {
              if (!node || typeof node.getAttribute !== "function") {
                continue;
              }
              const path = readProjectPathFromNode(node);
              if (isActiveFilePathCandidate(path, node)) {
                return path;
              }
              if (isFileTreeMenuControl(node)) {
                return "";
              }
            }
            const targetNode = event?.target;
            const treeNode = targetNode?.closest?.('[role="treeitem"], [role="row"], .file-tree li, .project-tree li');
            if (treeNode && !isFileTreeMenuControl(targetNode)) {
              const path = readProjectPathFromNode(treeNode);
              if (isActiveFilePathCandidate(path, treeNode)) {
                return path;
              }
            }
            return "";
          }
          function recordFileTreeSelection(path, source) {
            const normalizedPath = normalizeSafeProjectPath(path);
            if (!ProjectFiles.isTextProjectPath(normalizedPath)) {
              return;
            }
            lastFileTreeSelection = {
              path: normalizedPath,
              source,
              time: Date.now(),
              editorIdentityBefore: getActiveEditorIdentity(),
              editorTextSignatureBefore: contentSignature(readActiveEditorText())
            };
          }
          function getRecentFileTreeSelectionPath() {
            return getSettledRecentFileTreeSelection()?.path || "";
          }
          function readActiveFilePathFromEditorBreadcrumb() {
            const roots = document2.querySelectorAll?.(
              '.ol-cm-breadcrumbs, [data-testid="editor-breadcrumbs"], .editor-breadcrumbs'
            ) || [];
            for (const root of roots) {
              const path = readProjectPathFromBreadcrumbRoot(root);
              if (path) {
                return path;
              }
            }
            return "";
          }
          function readProjectPathFromBreadcrumbRoot(root) {
            const rawParts = Array.from(root.querySelectorAll?.("*") || []).map((node) => normalizeDomText(node.innerText || node.textContent || "")).filter(Boolean);
            const parts = [];
            for (const part of rawParts) {
              if (isBreadcrumbIconText(part)) {
                continue;
              }
              if (parts[parts.length - 1] === part) {
                continue;
              }
              parts.push(part);
            }
            if (!parts.length) {
              return "";
            }
            for (let start = 0; start < parts.length; start += 1) {
              const candidate = normalizeSafeProjectPath(parts.slice(start).join("/"));
              if (ProjectFiles.isTextProjectPath(candidate) && !hasMultipleTextPathExtensions(candidate)) {
                return candidate;
              }
            }
            return "";
          }
          function isBreadcrumbIconText(text) {
            return /^(?:chevron_right|description|book_5|image|insert_drive_file|article|folder|expand_more|keyboard_arrow_down)$/i.test(String(text || "").trim());
          }
          function findFileTreeNode(filePath, options = {}) {
            const normalizedPath = normalizeSafeProjectPath(filePath);
            if (!normalizedPath) {
              return null;
            }
            if (normalizedPath.includes("/") && options.invalidateCache === true) {
              invalidateDomProjectPathCache();
            }
            const fileName = normalizedPath.split("/").pop();
            const allowBasenameFallback = !normalizedPath.includes("/");
            const basenameMatches = [];
            let firstPathMatch = null;
            const candidates = document2.querySelectorAll('[role="treeitem"], [role="row"], .file-tree *, .project-tree *');
            for (const node of candidates) {
              const path = readProjectPathFromNode(node);
              const text = normalizeDomText(node.textContent || "");
              if (path === normalizedPath || text === normalizedPath) {
                const role = node.getAttribute?.("role") || "";
                if (/^(treeitem|row)$/i.test(role)) {
                  return node;
                }
                if (!firstPathMatch) {
                  firstPathMatch = node;
                }
              }
              if (allowBasenameFallback && (path === fileName || text === fileName)) {
                basenameMatches.push(node);
              }
            }
            if (firstPathMatch) {
              return firstPathMatch;
            }
            if (basenameMatches.length === 1) {
              return basenameMatches[0];
            }
            if (normalizedPath.includes("/")) {
              return findFileTreeNodeByDocId(normalizedPath, fileName);
            }
            return null;
          }
          function findFileTreeNodeByDocId(filePath, fileName) {
            const record = collectDocRecords({ includeWindowGlobals: true }).find((item) => item.path === filePath);
            if (!record?.id) {
              return null;
            }
            const idSelectors = [
              `[data-entity-id="${record.id}"]`,
              `[data-doc-id="${record.id}"]`,
              `[data-file-id="${record.id}"]`,
              `[data-id="${record.id}"]`
            ];
            for (const selector of idSelectors) {
              let nodes = [];
              try {
                nodes = Array.from(document2.querySelectorAll(selector));
              } catch (_error) {
                continue;
              }
              for (const node of nodes) {
                const role = node.getAttribute?.("role") || "";
                if (/^(treeitem|row)$/i.test(role)) {
                  return node;
                }
              }
              if (nodes.length) {
                return nodes[0];
              }
            }
            const allNodes = document2.querySelectorAll('[role="treeitem"], [role="row"], .file-tree *, .project-tree *');
            for (const node of allNodes) {
              const nodeId = readDomDocId(node);
              if (nodeId === record.id) {
                return node;
              }
            }
            return null;
          }
          async function ensureAncestorFoldersVisible(filePath) {
            const parts = String(filePath || "").split("/").filter(Boolean);
            const diagnostics = [];
            if (parts.length < 2) {
              return diagnostics;
            }
            let folderPath = "";
            for (const folderName of parts.slice(0, -1)) {
              folderPath = folderPath ? `${folderPath}/${folderName}` : folderName;
              const folderNode = findFolderTreeNode(folderPath);
              const entry = {
                path: folderPath,
                found: Boolean(folderNode),
                expandedBefore: folderNode ? isFolderExpanded(folderNode) : false,
                visibleAfter: false
              };
              if (!folderNode || isFolderExpanded(folderNode)) {
                entry.visibleAfter = hasVisibleFolderDescendant(folderPath);
                diagnostics.push(entry);
                continue;
              }
              dispatchFolderExpandClick(folderNode);
              invalidateDomProjectPathCache();
              const visible = await waitForFolderVisible(folderPath, 2e3);
              entry.visibleAfter = visible;
              if (!visible) {
                const refreshedFolderNode = findFolderTreeNode(folderPath) || folderNode;
                if (refreshedFolderNode && refreshedFolderNode !== folderNode) {
                  dispatchFolderExpandClick(refreshedFolderNode);
                } else {
                  dispatchActivationSequence(folderNode);
                }
                invalidateDomProjectPathCache();
                entry.visibleAfter = await waitForFolderVisible(folderPath, 2500);
              }
              diagnostics.push(entry);
            }
            return diagnostics;
          }
          function findFolderTreeNode(folderPath) {
            const normalizedPath = normalizeSafeProjectPath(folderPath);
            if (!normalizedPath || ProjectFiles.isTextProjectPath(normalizedPath)) {
              return null;
            }
            const folderName = normalizedPath.split("/").pop() || "";
            const matches = [];
            const candidates = document2.querySelectorAll('[role="treeitem"], [role="row"], .file-tree li, .project-tree li');
            for (const node of candidates) {
              const name = readFolderNameFromNode(node);
              if (name !== folderName) {
                continue;
              }
              const inferredPath = inferFolderPathFromTreeAncestors(node, name) || name;
              if (inferredPath === normalizedPath) {
                return node;
              }
              if (name === folderName) {
                matches.push(node);
              }
            }
            return matches.length === 1 ? matches[0] : null;
          }
          function isFolderExpanded(node) {
            const expanded = node?.getAttribute?.("aria-expanded");
            if (expanded === "true") {
              return true;
            }
            if (expanded === "false") {
              return false;
            }
            const signal = normalizeDomText(node?.textContent || "");
            return /expand_more|folder_open/i.test(signal);
          }
          function dispatchFolderExpandClick(node) {
            const target = findFolderExpandClickTarget(node) || node;
            dispatchActivationSequence(target);
          }
          function findFolderExpandClickTarget(node) {
            const selectors = [
              ".file-tree-entity-button",
              ".item-name",
              ".entity-name",
              '[role="button"]',
              "button"
            ];
            for (const selector of selectors) {
              let candidates = [];
              try {
                candidates = Array.from(node.querySelectorAll?.(selector) || []);
              } catch (_error) {
                candidates = [];
              }
              const candidate = candidates.find((item) => !isFileTreeMenuControl(item));
              if (candidate) {
                return candidate;
              }
            }
            return node;
          }
          async function waitForFolderVisible(folderPath, timeoutMs) {
            const deadline = Date.now() + timeoutMs;
            while (Date.now() < deadline) {
              const folderNode = findFolderTreeNode(folderPath);
              if (!folderNode || isFolderExpanded(folderNode) || hasVisibleFolderDescendant(folderPath)) {
                return true;
              }
              await delay(100);
            }
            return hasVisibleFolderDescendant(folderPath);
          }
          function hasVisibleFolderDescendant(folderPath) {
            const prefix = `${folderPath}/`;
            return collectDomProjectPaths().some((path) => path.startsWith(prefix));
          }
          function projectPathExists(filePath) {
            if (!filePath) {
              return false;
            }
            const normalizedPath = normalizeSafeProjectPath(filePath);
            if (!normalizedPath) {
              return false;
            }
            if (getActiveFilePath() === normalizedPath) {
              return true;
            }
            if (findFileTreeNode(normalizedPath)) {
              return true;
            }
            return collectDocRecords().some((record) => record.path === normalizedPath);
          }
          function collectProjectTextPaths(activePath) {
            const rawPaths = [
              activePath,
              ...collectDocRecords().map((record) => record.path),
              ...collectInternalProjectPaths(),
              ...collectDomProjectPaths()
            ];
            return ProjectFiles.collectUniqueTextPaths(rawPaths, 80);
          }
          function collectDocRecords(options = {}) {
            const seen = /* @__PURE__ */ new Set();
            const records = [];
            for (const record of [...collectInternalDocRecords(options), ...collectDomDocRecords()]) {
              if (!record?.id || !ProjectFiles.isTextProjectPath(record.path)) {
                continue;
              }
              const key = `${record.path}:${record.id}`;
              if (seen.has(key)) {
                continue;
              }
              seen.add(key);
              records.push(record);
              if (records.length >= 120) {
                break;
              }
            }
            return records;
          }
          function collectInternalDocRecords(options = {}) {
            const records = [];
            const seenObjects = /* @__PURE__ */ new WeakSet();
            const seenRecords = /* @__PURE__ */ new Set();
            const roots = collectInternalRoots(options);
            for (const root of roots) {
              walkInternalDocTree(root, "", 0);
              if (records.length >= 120) {
                break;
              }
            }
            return records;
            function walkInternalDocTree(value, folderPath, depth) {
              if (!value || depth > 7 || records.length >= 120 || typeof value !== "object") {
                return;
              }
              if (isDomLikeObject(value) || seenObjects.has(value)) {
                return;
              }
              seenObjects.add(value);
              if (Array.isArray(value)) {
                for (const item of value.slice(0, 250)) {
                  walkInternalDocTree(item, folderPath, depth + 1);
                }
                return;
              }
              const ownName = readObjectPathName(value);
              const ownId = readObjectDocId(value);
              const normalizedOwnName = normalizeSafeProjectPath(ownName);
              const ownPath = normalizedOwnName && normalizedOwnName.includes("/") ? normalizedOwnName : joinPath(folderPath, normalizedOwnName);
              if (ownId && ProjectFiles.isTextProjectPath(ownPath)) {
                const key = `${ownPath}:${ownId}`;
                if (!seenRecords.has(key)) {
                  seenRecords.add(key);
                  records.push({
                    path: ownPath,
                    id: ownId
                  });
                }
              }
              const nextFolderPath = normalizedOwnName && !ProjectFiles.isTextProjectPath(normalizedOwnName) ? joinPath(folderPath, normalizedOwnName) : folderPath;
              for (const key of Object.keys(value).slice(0, 220)) {
                if (!/project|root|folder|folders|children|entities|entity|docs|doc|file|files|tree|scope|state|data|metadata|meta/i.test(key)) {
                  continue;
                }
                let child;
                try {
                  child = value[key];
                } catch (_error) {
                  continue;
                }
                walkInternalDocTree(child, nextFolderPath, depth + 1);
              }
            }
          }
          function collectInternalRoots(options = {}) {
            const roots = [window2._ide, window2.Overleaf, window2.overleaf, window2.OL].filter(Boolean);
            if (options.includeWindowGlobals === false) {
              return uniqueNodes(roots);
            }
            for (const key of Object.keys(window2).slice(0, 2500)) {
              if (!/ide|overleaf|sharelatex|project|root|folder|doc|file|entity|state|meta|bootstrap|ol/i.test(key)) {
                continue;
              }
              try {
                const value = window2[key];
                if (value && typeof value === "object") {
                  roots.push(value);
                }
              } catch (_error) {
              }
            }
            return uniqueNodes(roots);
          }
          function collectInternalRootKeys() {
            return Object.keys(window2).filter((key) => /ide|overleaf|sharelatex|project|root|folder|doc|file|entity|state|meta|bootstrap|ol/i.test(key)).slice(0, 40);
          }
          function collectDomDocRecords() {
            const selectors = [
              '[role="treeitem"]',
              '[role="row"]',
              ".file-tree *",
              ".project-tree *",
              "[data-entity-id]",
              "[data-doc-id]",
              "[data-id]",
              "[data-file-id]"
            ];
            const nodes = uniqueNodes(selectors.flatMap((selector) => Array.from(document2.querySelectorAll(selector)).slice(0, 600)));
            const records = [];
            const seen = /* @__PURE__ */ new Set();
            for (const node of nodes) {
              const path = readProjectPathFromNode(node);
              const id = readDomDocId(node);
              if (!path || !id) {
                continue;
              }
              const key = `${path}:${id}`;
              if (seen.has(key)) {
                continue;
              }
              seen.add(key);
              records.push({
                path,
                id,
                source: "dom"
              });
            }
            return records;
          }
          function readDomDocId(node) {
            let current = node;
            for (let depth = 0; current && depth < 5; depth += 1) {
              for (const attr of ["data-entity-id", "data-doc-id", "data-id", "data-file-id", "data-ol-id", "id"]) {
                const value = current.getAttribute?.(attr) || "";
                const match = value.match(/[a-f0-9]{24}/i);
                if (match) {
                  return match[0];
                }
              }
              current = current.parentElement;
            }
            return "";
          }
          function readObjectPathName(value) {
            for (const key of ["path", "pathname", "filePath", "name", "fileName", "displayName"]) {
              const candidate = value?.[key];
              if (typeof candidate === "string" && candidate.trim()) {
                return candidate;
              }
            }
            return "";
          }
          function readObjectDocId(value) {
            for (const key of ["_id", "id", "docId", "doc_id", "entityId"]) {
              const candidate = value?.[key];
              if (typeof candidate === "string" && /^[a-f0-9]{24}$/i.test(candidate)) {
                return candidate;
              }
            }
            return "";
          }
          function isDomLikeObject(value) {
            return value === window2 || value === document2 || NodeCtor && value instanceof NodeCtor || EventTargetCtor && value instanceof EventTargetCtor && value.constructor?.name !== "Object";
          }
          function joinPath(folderPath, name) {
            const cleanName = normalizeSafeProjectPath(name);
            const cleanFolder = normalizeSafeProjectPath(folderPath);
            if (!cleanName) {
              return cleanFolder;
            }
            return cleanFolder ? `${cleanFolder}/${cleanName}` : cleanName;
          }
          function collectInternalProjectPaths() {
            const paths = [];
            const roots = [window2._ide, window2.Overleaf, window2.overleaf, window2.OL].filter(Boolean);
            for (const root of roots) {
              collectPathLikeValues(root, paths, 0);
              if (paths.length >= 200) {
                break;
              }
            }
            return paths;
          }
          function collectPathLikeValues(value, paths, depth) {
            if (!value || depth > 3 || paths.length >= 200) {
              return;
            }
            if (typeof value === "string") {
              if (ProjectFiles.isTextProjectPath(value)) {
                paths.push(value);
              }
              return;
            }
            if (typeof value !== "object") {
              return;
            }
            if (Array.isArray(value)) {
              for (const item of value.slice(0, 80)) {
                collectPathLikeValues(item, paths, depth + 1);
              }
              return;
            }
            for (const key of Object.keys(value).slice(0, 100)) {
              const child = value[key];
              if (/path|name|file|doc/i.test(key)) {
                collectPathLikeValues(child, paths, depth + 1);
              } else if (child && typeof child === "object" && /project|file|doc|root|entities|tree/i.test(key)) {
                collectPathLikeValues(child, paths, depth + 1);
              }
            }
          }
          function collectDomProjectPaths() {
            const selectors = [
              '[role="treeitem"]',
              '[role="row"]',
              ".file-tree li",
              ".file-tree [data-entity-id]",
              ".file-tree [data-testid]",
              ".project-tree li",
              ".project-tree [data-entity-id]"
            ];
            const candidates = [];
            for (const selector of selectors) {
              candidates.push(...Array.from(document2.querySelectorAll(selector)).slice(0, 500));
            }
            return Array.from(new Set(candidates.map((node) => readProjectPathFromNode(node)).filter(Boolean)));
          }
          function readProjectPathFromNode(node) {
            const explicitAttrPath = [
              node.getAttribute("data-path"),
              node.getAttribute("data-file-path")
            ].map(normalizeProjectPathCandidate).find(Boolean);
            if (explicitAttrPath) {
              if (explicitAttrPath.includes("/")) {
                return explicitAttrPath;
              }
              return resolveProjectPathFromDomDocId(node, explicitAttrPath) || inferPathFromTreeAncestors(node, explicitAttrPath) || (node.parentElement ? resolveProjectPathFromDomTree(node, explicitAttrPath) : "") || explicitAttrPath;
            }
            const attrPath = normalizeProjectPathCandidate(node.getAttribute("data-name"));
            if (attrPath) {
              if (!attrPath.includes("/")) {
                return inferPathFromTreeAncestors(node, attrPath) || resolveProjectPathFromDomDocId(node, attrPath) || resolveProjectPathFromDomTree(node, attrPath) || attrPath;
              }
              return attrPath;
            }
            const labelPath = [
              node.getAttribute("aria-label"),
              node.getAttribute("title")
            ].map(normalizeProjectPathCandidate).find(Boolean);
            if (labelPath) {
              if (!labelPath.includes("/")) {
                return inferPathFromTreeAncestors(node, labelPath) || resolveProjectPathFromDomDocId(node, labelPath) || resolveProjectPathFromDomTree(node, labelPath) || labelPath;
              }
              return labelPath;
            }
            const textPath = normalizeProjectPathCandidate(readFileTreeNodeText(node));
            if (!textPath) {
              const docIdPath = resolveProjectPathFromDomDocId(node);
              const domTreePath = resolveProjectPathFromDomTree(node);
              return docIdPath || domTreePath;
            }
            if (!textPath.includes("/")) {
              return inferPathFromTreeAncestors(node, textPath) || resolveProjectPathFromDomDocId(node, textPath) || resolveProjectPathFromDomTree(node, textPath) || textPath;
            }
            return textPath;
          }
          function isActiveFilePathCandidate(path, node) {
            if (!path || !ProjectFiles.isTextProjectPath(path)) {
              return false;
            }
            if (hasMultipleTextPathExtensions(path)) {
              return false;
            }
            if (isFolderTreeNode(node)) {
              return false;
            }
            const text = normalizeDomText(node?.textContent || "");
            return !hasMultipleTextPathExtensions(text);
          }
          function isFolderTreeNode(node) {
            const expanded = node?.getAttribute?.("aria-expanded");
            return (expanded === "true" || expanded === "false") && Boolean(readFolderNameFromNode(node));
          }
          function resolveProjectPathFromDomTree(node, pathHint = "") {
            const cache = getDomProjectPathCache();
            const normalizedHint = normalizeSafeProjectPath(pathHint);
            let current = node || null;
            for (let depth = 0; current && depth < 8; depth += 1) {
              const resolvedPath = cache.get(current) || "";
              if (resolvedPath && pathMatchesHint(resolvedPath, normalizedHint)) {
                return resolvedPath;
              }
              current = current.parentElement;
            }
            return "";
          }
          function pathMatchesHint(path, hint) {
            if (!hint) {
              return true;
            }
            if (hint.includes("/")) {
              return path === hint;
            }
            return (path.split("/").pop() || "") === hint;
          }
          function getDomProjectPathCache() {
            const now = Date.now();
            if (domProjectPathCache && now - domProjectPathCacheTime < 1e3) {
              return domProjectPathCache;
            }
            const pathByNode = /* @__PURE__ */ new WeakMap();
            const visited = /* @__PURE__ */ new WeakSet();
            const roots = uniqueNodes([
              ...collectElements(".file-tree", 20),
              ...collectElements(".project-tree", 20),
              ...collectElements(".file-tree-inner", 20),
              ...collectElements('[role="tree"]', 40)
            ]);
            for (const root of roots) {
              walkDomProjectTree(root, "", 0, pathByNode, visited);
            }
            domProjectPathCache = pathByNode;
            domProjectPathCacheTime = now;
            return domProjectPathCache;
          }
          function walkDomProjectTree(node, folderPath, depth, pathByNode, visited) {
            if (!node || depth > 60 || visited.has(node)) {
              return;
            }
            visited.add(node);
            const filePath = readFilePathFromTreeNodeSelf(node, folderPath);
            const folderName = filePath ? "" : readFolderNameFromNode(node);
            const nextFolderPath = folderName ? joinPath(folderPath, folderName) : folderPath;
            if (filePath) {
              pathByNode.set(node, filePath);
            }
            const children = Array.from(node.children || []);
            let pendingSiblingFolderPath = "";
            for (const child of children) {
              const childFilePath = readFilePathFromTreeNodeSelf(child, nextFolderPath);
              const childFolderName = childFilePath ? "" : readFolderNameFromNode(child);
              const childIsNestedList = isNestedFolderListNode(child);
              const childFolderPath = childIsNestedList && pendingSiblingFolderPath ? pendingSiblingFolderPath : nextFolderPath;
              walkDomProjectTree(child, childFolderPath, depth + 1, pathByNode, visited);
              if (childFolderName) {
                pendingSiblingFolderPath = joinPath(nextFolderPath, childFolderName);
              } else if (!childIsNestedList && childFilePath) {
                pendingSiblingFolderPath = "";
              } else if (childIsNestedList && pendingSiblingFolderPath) {
                pendingSiblingFolderPath = "";
              }
            }
          }
          function isNestedFolderListNode(node) {
            const className = String(node?.className || "");
            const role = node?.getAttribute?.("role") || "";
            return /file-tree-folder-list/i.test(className) || role === "tree" && !/file-tree-list/i.test(className);
          }
          function readFilePathFromTreeNodeSelf(node, folderPath) {
            const candidates = [
              node.getAttribute?.("data-path"),
              node.getAttribute?.("data-file-path"),
              node.getAttribute?.("data-name"),
              node.getAttribute?.("aria-label"),
              node.getAttribute?.("title"),
              readFileTreeNodeText(node)
            ];
            for (const value of candidates) {
              const path = normalizeProjectPathCandidate(value);
              if (!path) {
                continue;
              }
              const resolvedPath = path.includes("/") ? path : joinPath(folderPath, path);
              if (ProjectFiles.isTextProjectPath(resolvedPath)) {
                return resolvedPath;
              }
            }
            return "";
          }
          function resolveProjectPathFromDomDocId(node, pathHint = "") {
            const id = readDomDocId(node);
            if (!id) {
              return "";
            }
            const resolvedPath = getInternalDocPathByIdMap().get(id) || "";
            if (!resolvedPath) {
              return "";
            }
            const normalizedHint = normalizeSafeProjectPath(pathHint);
            if (!normalizedHint) {
              return resolvedPath;
            }
            if (normalizedHint.includes("/")) {
              return resolvedPath === normalizedHint ? resolvedPath : "";
            }
            const resolvedName = resolvedPath.split("/").pop() || "";
            return resolvedName === normalizedHint ? resolvedPath : "";
          }
          function getInternalDocPathByIdMap() {
            const now = Date.now();
            if (internalDocPathByIdCache && now - internalDocPathByIdCacheTime < 1e3) {
              return internalDocPathByIdCache;
            }
            const byId = /* @__PURE__ */ new Map();
            const ambiguousIds = /* @__PURE__ */ new Set();
            for (const record of collectInternalDocRecords({ includeWindowGlobals: false })) {
              if (!record?.id || !ProjectFiles.isTextProjectPath(record.path)) {
                continue;
              }
              const existingPath = byId.get(record.id);
              if (existingPath && existingPath !== record.path) {
                ambiguousIds.add(record.id);
                continue;
              }
              byId.set(record.id, record.path);
            }
            for (const id of ambiguousIds) {
              byId.delete(id);
            }
            internalDocPathByIdCache = byId;
            internalDocPathByIdCacheTime = now;
            return internalDocPathByIdCache;
          }
          function normalizeProjectPathCandidate(value) {
            const text = String(value || "").trim();
            if (!text || hasMultipleTextPathExtensions(text)) {
              return "";
            }
            const normalized = normalizeSafeProjectPath(text);
            return normalized && ProjectFiles.isTextProjectPath(normalized) ? normalized : "";
          }
          function normalizeDomText(value) {
            return String(value || "").replace(/\s+/g, " ").trim();
          }
          function hasMultipleTextPathExtensions(value) {
            const text = normalizeDomText(value);
            const pattern = new RegExp(`\\.${TEXT_PATH_EXTENSION_PATTERN}`, "gi");
            const matches = text.match(pattern) || [];
            if (matches.length > 1) {
              return true;
            }
            return false;
          }
          function readFileTreeNodeText(node) {
            const names = Array.from(node.querySelectorAll?.(".item-name") || []);
            if (names.length > 1) return "";
            return names.length === 1 ? names[0].textContent || "" : node.textContent || "";
          }
          function inferPathFromTreeAncestors(node, fileName) {
            const folders = [];
            let current = node?.parentElement || null;
            for (let depth = 0; current && depth < 8; depth += 1) {
              const folderName = readFolderNameFromNode(current);
              if (folderName) {
                folders.unshift(folderName);
              }
              current = current.parentElement;
            }
            if (!folders.length) {
              return "";
            }
            const path = normalizeSafeProjectPath([...folders, fileName].join("/"));
            return ProjectFiles.isTextProjectPath(path) ? path : "";
          }
          function inferFolderPathFromTreeAncestors(node, folderName) {
            const folders = [];
            let current = node?.parentElement || null;
            for (let depth = 0; current && depth < 8; depth += 1) {
              const parentFolderName = readFolderNameFromNode(current);
              if (parentFolderName) {
                folders.unshift(parentFolderName);
              }
              current = current.parentElement;
            }
            const path = normalizeSafeProjectPath([...folders, folderName].join("/"));
            return path && !ProjectFiles.isTextProjectPath(path) ? path : "";
          }
          function invalidateDomProjectPathCache() {
            domProjectPathCache = null;
            domProjectPathCacheTime = 0;
          }
          function readFolderNameFromNode(node) {
            const candidates = [
              node.getAttribute?.("data-name"),
              node.getAttribute?.("aria-label"),
              node.getAttribute?.("title")
            ];
            for (const value of candidates) {
              const folderName = normalizeFolderName(value);
              if (folderName) {
                return folderName;
              }
            }
            return "";
          }
          function normalizeFolderName(value) {
            const text = normalizeDomText(value);
            if (!text || /[\\/]/.test(text) || ProjectFiles.isTextProjectPath(text)) {
              return "";
            }
            if (new RegExp(`\\.${TEXT_PATH_EXTENSION_PATTERN}\\b`, "i").test(text)) {
              return "";
            }
            if (/^(?:description|article|book_5|insert_drive_file|draft|text_snippet|note|chevron_right|expand_more|folder_open|folder|expand|collapse|open|close|menu)\b/i.test(text)) {
              return "";
            }
            if (/(?:more_vert|action menu|Menu)$/i.test(text)) {
              return "";
            }
            if (!/^[\w .@+-]+$/.test(text) || text.length > 80) {
              return "";
            }
            return text;
          }
          async function waitForActiveFile(filePath, timeoutMs) {
            const deadline = Date.now() + timeoutMs;
            while (Date.now() < deadline) {
              if (getActiveFilePath() === filePath) {
                return true;
              }
              await delay(100);
            }
            return getActiveFilePath() === filePath;
          }
          async function waitForActiveEditorText(filePath, timeoutMs, options = {}) {
            const deadline = Date.now() + timeoutMs;
            let lastText = "";
            while (Date.now() < deadline) {
              const activeFileMatches = !filePath || getActiveFilePath() === filePath;
              const text = readActiveEditorText();
              lastText = text;
              const knownEmptyEditor = options.allowEmpty === true && typeof text === "string" && /^(?:\r?\n)*$/.test(text) && Boolean(getActiveEditorIdentity());
              const textReady = options.requireEmpty === true ? knownEmptyEditor : knownEmptyEditor || ProjectFiles.isUsableProjectFileContent(text);
              const signatureChanged = !options.notSignature || contentSignature(text) !== options.notSignature;
              if (activeFileMatches && textReady && signatureChanged) {
                return {
                  ok: true,
                  text
                };
              }
              await delay(150);
            }
            return {
              ok: false,
              text: lastText,
              reason: `Editor content was not ready for ${filePath || "active file"}; last length ${String(lastText || "").length}`
            };
          }
          function contentSignature(content) {
            const text = String(content || "");
            return `${text.length}:${text.slice(0, 120)}:${text.slice(-120)}`;
          }
          function findFileTreeManager() {
            const roots = [window2._ide, window2.Overleaf, window2.overleaf, window2.OL].filter(Boolean);
            for (const root of roots) {
              for (const key of Object.keys(root)) {
                if (/file.*tree|tree.*file|file.*manager|entity.*manager/i.test(key) && root[key] && typeof root[key] === "object") {
                  return root[key];
                }
              }
            }
            return window2._ide?.fileTreeManager || window2._ide?.fileTree || null;
          }
          function findHistoryObject() {
            const roots = [window2._ide, window2.Overleaf, window2.overleaf, window2.OL].filter(Boolean);
            for (const root of roots) {
              for (const key of Object.keys(root)) {
                if (/history/i.test(key) && root[key] && typeof root[key] === "object") {
                  return root[key];
                }
              }
            }
            return null;
          }
          function delay(ms) {
            return new Promise((resolve) => window2.setTimeout(resolve, ms));
          }
          async function navigateToFile(filePath, options = {}) {
            const normalizedPath = normalizeSafeProjectPath(filePath);
            if (!normalizedPath) {
              return {
                loaded: false,
                editorReady: false,
                reason: "Invalid file path"
              };
            }
            const opened = await openFileByPath(normalizedPath);
            if (!opened.ok) {
              return {
                loaded: false,
                editorReady: false,
                reason: opened.reason || "Could not open file"
              };
            }
            const ready = await waitForActiveEditorText(normalizedPath, resolveTimeoutMs(options, 2500));
            return {
              loaded: true,
              editorReady: ready.ok === true,
              method: opened.method,
              reason: ready.ok ? "" : ready.reason
            };
          }
          async function createFile(filePath, content, options = {}) {
            return callFileTreeMutation({
              type: "create",
              path: filePath,
              content
            }, options);
          }
          async function renameFile(fromPath, toPath, options = {}) {
            return callFileTreeMutation({
              type: "rename",
              path: fromPath,
              to: toPath
            }, options);
          }
          async function deleteFile(filePath, options = {}) {
            return callFileTreeMutation({
              type: "delete",
              path: filePath
            }, options);
          }
          async function callFileTreeMutation(rawOperation, options = {}) {
            const operation = {
              ...rawOperation,
              path: normalizeSafeProjectPath(rawOperation.path),
              to: rawOperation.to ? normalizeSafeProjectPath(rawOperation.to) : rawOperation.to
            };
            if (!operation.path || (operation.type === "rename" || operation.type === "move") && !operation.to) {
              return buildTreeContractResult(operation, false, "Invalid file-tree path");
            }
            const manager = findFileTreeManager();
            for (const methodName of fileTreeMethodNames(operation.type)) {
              const method = manager?.[methodName];
              if (typeof method !== "function") {
                continue;
              }
              try {
                if (operation.type === "create") {
                  await method.call(manager, operation.path, normalizeCreateFileContent(operation.path, operation.content));
                } else if (operation.type === "rename" || operation.type === "move") {
                  await method.call(manager, operation.path, operation.to);
                } else if (operation.type === "delete") {
                  await method.call(manager, operation.path);
                }
                await delay(120);
                return buildTreeContractResult(operation, verifyTreeMutation(operation), "", "fileTreeManager." + methodName);
              } catch (_error) {
              }
            }
            return buildTreeContractResult(operation, false, "No supported Overleaf file-tree method was detected");
          }
          function normalizeCreateFileContent(filePath, content) {
            if (content instanceof Uint8Array) {
              const fileName = String(filePath || "").split("/").filter(Boolean).pop() || "asset";
              if (typeof File === "function") {
                return new File([content], fileName);
              }
              return new Blob([content]);
            }
            return String(content || "");
          }
          function verifyTreeMutation(operation) {
            if (operation.type === "delete") {
              return !projectPathExists(operation.path);
            }
            if (operation.type === "rename" || operation.type === "move") {
              return Boolean(operation.to && projectPathExists(operation.to) && !projectPathExists(operation.path));
            }
            return projectPathExists(operation.path);
          }
          function buildTreeContractResult(operation, ok, reason = "", method = "") {
            if (operation.type === "delete") {
              return {
                deleted: ok,
                reason: ok ? "" : reason,
                method
              };
            }
            if (operation.type === "rename" || operation.type === "move") {
              return {
                renamed: ok,
                reason: ok ? "" : reason,
                method
              };
            }
            return {
              created: ok,
              reason: ok ? "" : reason,
              method
            };
          }
          function resolveTimeoutMs(options = {}, fallback) {
            const value = Number(options.timeoutMs);
            return Number.isFinite(value) && value >= 0 ? value : fallback;
          }
          installFileTreeSelectionTracking();
          return {
            collectDocRecords,
            collectDomProjectPaths,
            collectInternalRootKeys,
            collectProjectTextPaths,
            contentSignature,
            invalidateDomProjectPathCache,
            createFile,
            deleteFile,
            fileTreeMethodNames,
            findFileTreeManager,
            findFileTreeNode,
            findHistoryObject,
            getActiveFilePath,
            getEditorStoreFilePath,
            getRecentFileTreeSelectionPath,
            getProjectId,
            navigateToFile,
            openFileByPath,
            projectPathExists,
            readProjectPathFromNode,
            renameFile,
            waitForActiveEditorText,
            waitForActiveFile
          };
        }
        function fallbackNormalizeSafeProjectPath(value) {
          const text = String(value || "").replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+|\/+$/g, "").trim();
          if (!text || text.split("/").some((part) => !part || part === "." || part === "..")) {
            return "";
          }
          return text;
        }
        function fileTreeMethodNames(type) {
          return {
            create: ["createDoc", "createFile", "addDoc", "addFile"],
            rename: ["renameEntity", "renameFile", "renameDoc"],
            move: ["moveEntity", "moveFile", "moveDoc"],
            delete: ["deleteEntity", "deleteFile", "deleteDoc", "removeEntity"]
          }[type] || [];
        }
        return { create, fileTreeMethodNames };
      });
    }
  });

  // vendor/projectFiles.js
  var require_projectFiles = __commonJS({
    "vendor/projectFiles.js"(exports, module) {
      (function initProjectFiles(root, factory) {
        if (typeof module === "object" && module.exports) {
          module.exports = factory();
        } else {
          root.CodexOverleafProjectFiles = factory();
        }
      })(typeof globalThis !== "undefined" ? globalThis : window, function projectFilesFactory() {
        "use strict";
        const TEXT_EXTENSIONS = /* @__PURE__ */ new Set([
          ".tex",
          ".bib",
          ".sty",
          ".cls",
          ".bst",
          ".bbx",
          ".cbx",
          ".lbx",
          ".cfg",
          ".def",
          ".clo",
          ".ist",
          ".txt",
          ".md",
          ".latex"
        ]);
        const BINARY_EXTENSIONS = /* @__PURE__ */ new Set([
          ".pdf",
          ".png",
          ".jpg",
          ".jpeg",
          ".gif",
          ".svg",
          ".eps",
          ".zip",
          ".gz",
          ".tar",
          ".doc",
          ".docx",
          ".ppt",
          ".pptx",
          ".xls",
          ".xlsx"
        ]);
        const MAX_SAFE_PROJECT_PATH_LENGTH = 2048;
        function isTextProjectPath(path) {
          const normalized = normalizeSafeProjectPath(path);
          if (!normalized) {
            return false;
          }
          const extension = getExtension(normalized);
          if (BINARY_EXTENSIONS.has(extension)) {
            return false;
          }
          return TEXT_EXTENSIONS.has(extension);
        }
        function collectUniqueTextPaths(paths, limit = 80) {
          const seen = /* @__PURE__ */ new Set();
          const result = [];
          for (const path of paths || []) {
            const normalized = normalizeSafeProjectPath(path);
            if (!isTextProjectPath(normalized) || seen.has(normalized)) {
              continue;
            }
            seen.add(normalized);
            result.push(normalized);
            if (result.length >= limit) {
              break;
            }
          }
          return result;
        }
        function normalizePath(path) {
          return String(path || "").replace(/\s+/g, " ").replace(/\\/g, "/").trim().replace(/^\/+/, "");
        }
        function normalizeSafeProjectPath(value) {
          if (typeof value !== "string" || !value || value.length > MAX_SAFE_PROJECT_PATH_LENGTH || value.trim() !== value || hasControlCharacter(value) || value.startsWith("/") || value.includes("\\") || hasWindowsDrivePrefix(value)) return "";
          return value.split("/").some((segment) => !segment || segment === "." || segment === "..") ? "" : value;
        }
        function normalizeUrlEncodedProjectPath(value) {
          if (typeof value !== "string" || hasEncodedSeparator(value)) return "";
          let decoded;
          try {
            decoded = decodeURIComponent(value);
          } catch (_error) {
            return "";
          }
          const result = normalizeSafeProjectPath(decoded);
          if (!result) return "";
          for (let index = 0; index < 3; index += 1) {
            if (hasEncodedSeparator(decoded) || !normalizeSafeProjectPath(decoded)) return "";
            let next;
            try {
              next = decodeURIComponent(decoded);
            } catch (_error) {
              break;
            }
            if (next === decoded) break;
            decoded = next;
          }
          return hasEncodedSeparator(decoded) || !normalizeSafeProjectPath(decoded) ? "" : result;
        }
        function assertSafeProjectPath(value, label = "path") {
          const normalized = normalizeSafeProjectPath(value);
          if (!normalized) {
            throw new Error(`Invalid ${label}`);
          }
          return normalized;
        }
        function hasControlCharacter(value) {
          return /[\u0000-\u001f\u007f]/.test(String(value || ""));
        }
        function hasEncodedSeparator(value) {
          return /%(?:2f|5c)/i.test(String(value || ""));
        }
        function hasWindowsDrivePrefix(value) {
          return /^[A-Za-z]:/.test(String(value || ""));
        }
        function getExtension(path) {
          const fileName = path.split("/").pop() || "";
          const dotIndex = fileName.lastIndexOf(".");
          return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
        }
        function isUsableProjectFileContent(content) {
          const text = String(content || "").trim();
          if (!text) {
            return false;
          }
          return !/^(loading|loading\.{3}|loading…)$/i.test(text);
        }
        return {
          MAX_SAFE_PROJECT_PATH_LENGTH,
          assertSafeProjectPath,
          collectUniqueTextPaths,
          isUsableProjectFileContent,
          isTextProjectPath,
          normalizePath,
          normalizeSafeProjectPath,
          normalizeUrlEncodedProjectPath
        };
      });
    }
  });

  // src/overleafAdapter.js
  var require_overleafAdapter = __commonJS({
    "src/overleafAdapter.js"(exports, module) {
      "use strict";
      var Core = require_suggestions();
      var Tree = require_treeOperations();
      var ProjectFiles = require_projectFiles();
      function create(window2, document2) {
        const store = () => window2.overleaf?.unstable?.store || window2.Overleaf?.unstable?.store;
        function read(path2) {
          try {
            return store()?.get(path2);
          } catch (_) {
            return void 0;
          }
        }
        function view() {
          const candidates = [
            read("editor.view"),
            read("editor.view.camel"),
            read("editor")?.view,
            window2.overleaf?.unstable?.editorView,
            window2.Overleaf?.editorView,
            window2._ide?.editorView
          ];
          for (const node of document2.querySelectorAll(".cm-content")) candidates.push(node.cmView?.view);
          return candidates.find((v) => v?.state?.doc && typeof v.dispatch === "function" && typeof v.state.doc.toString === "function" && v.dom?.isConnected && v.dom.querySelector(".cm-content") && !v.dom.closest("[data-suggestion-importer]")) || null;
        }
        function storePath() {
          const name = read("editor.open_doc_name") || read("editor.openDocName") || window2._ide?.editor?.open_doc_name;
          try {
            return typeof name === "string" ? Core.normalizePath(name) : "";
          } catch (_) {
            return "";
          }
        }
        const tree = Tree.create({
          window: window2,
          document: document2,
          projectFiles: ProjectFiles,
          normalizePath: (value) => {
            try {
              return Core.normalizePath(value);
            } catch (_) {
              return "";
            }
          },
          readActiveEditorText: () => view()?.state.doc.toString() ?? "",
          getActiveEditorIdentity: view,
          activeEditorIdentityChanged: (before, after) => before !== after,
          getActiveFilePathFromEditorStore: storePath
        });
        const projectId = () => window2.location.pathname.match(/^\/project\/([a-f\d]{24})(?:\/|$)/i)?.[1] || "";
        const path = () => tree.getActiveFilePath();
        async function open(file, owner) {
          if (projectId() !== owner) return false;
          const previous = view(), navigating = path() !== file;
          if (navigating) {
            const opened = await tree.openFileByPath(file, { activeWaitMs: 1200, retryWaitMs: 1200 });
            if (!opened.ok) return false;
          }
          const until = Date.now() + 4e3;
          while (Date.now() < until && projectId() === owner) {
            const active = view();
            if (path() === file && active && (!navigating || active !== previous)) return true;
            await new Promise((resolve) => window2.setTimeout(resolve, 100));
          }
          return false;
        }
        return { projectId, path, view, open };
      }
      module.exports = { create };
    }
  });

  // src/floatingPanel.js
  var require_floatingPanel = __commonJS({
    "src/floatingPanel.js"(exports, module) {
      "use strict";
      var css = `.panel-drag{cursor:grab;touch-action:none;user-select:none}.panel-drag:active{cursor:grabbing}.panel-drag:focus-visible,.panel-resize:focus-visible{outline:3px solid #8aafe3;outline-offset:-3px}.panel-resize{position:absolute;right:2px;bottom:2px;width:20px;height:20px;cursor:nwse-resize;touch-action:none;z-index:2;border:0!important;padding:0!important;background:linear-gradient(135deg,transparent 50%,#8c9aa6 51%,#8c9aa6 57%,transparent 58%,transparent 68%,#8c9aa6 69%,#8c9aa6 75%,transparent 76%)!important;border-radius:0!important}`;
      function clamp(rect, bounds, minimum = { width: 280, height: 160 }) {
        const width = Math.min(Math.max(minimum.width, rect.width), bounds.width);
        const height = Math.min(Math.max(minimum.height, rect.height), bounds.height);
        return { left: Math.min(Math.max(bounds.left, rect.left), bounds.left + bounds.width - width), top: Math.min(Math.max(bounds.top, rect.top), bounds.top + bounds.height - height), width, height };
      }
      function attach({ panel, drag, resize, window: window2, state = {}, minimum, defaultRect }) {
        let gesture = null, disposed = false;
        const bounds = () => ({ left: 8, top: 8, width: Math.max(1, window2.innerWidth - 16), height: Math.max(1, window2.innerHeight - 16) });
        function layout() {
          if (disposed) return;
          const rect = clamp(state.rect || defaultRect(), bounds(), minimum);
          if (state.rect) state.rect = rect;
          Object.assign(panel.style, { left: rect.left + "px", top: rect.top + "px", width: rect.width + "px", height: rect.height + "px" });
          return rect;
        }
        function start(event, kind, handle) {
          if (event.button !== 0 || event.target.closest?.("button,input,select,textarea,a") && event.target !== resize) return;
          const rect = layout();
          gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, rect, kind, handle };
          handle.setPointerCapture(event.pointerId);
          event.preventDefault();
        }
        function move(event) {
          if (!gesture || event.pointerId !== gesture.id) return;
          const { rect, x, y, kind } = gesture, dx = event.clientX - x, dy = event.clientY - y;
          state.rect = kind === "move" ? { ...rect, left: rect.left + dx, top: rect.top + dy } : { ...rect, width: rect.width + dx, height: rect.height + dy };
          layout();
          event.preventDefault();
        }
        function end(event) {
          if (!gesture || event.pointerId !== gesture.id) return;
          const old = gesture;
          gesture = null;
          if (old.handle.hasPointerCapture(old.id)) old.handle.releasePointerCapture(old.id);
        }
        const onDrag = (e) => start(e, "move", drag), onResize = (e) => start(e, "resize", resize);
        function keys(event, kind) {
          const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
          if (!delta || event.target !== event.currentTarget) return;
          const rect = layout(), step = event.shiftKey ? 20 : 5;
          state.rect = kind === "move" ? { ...rect, left: rect.left + delta[0] * step, top: rect.top + delta[1] * step } : { ...rect, width: rect.width + delta[0] * step, height: rect.height + delta[1] * step };
          layout();
          event.preventDefault();
        }
        const dragKeys = (e) => keys(e, "move"), resizeKeys = (e) => keys(e, "resize");
        drag.classList.add("panel-drag");
        drag.tabIndex = 0;
        resize.classList.add("panel-resize");
        drag.addEventListener("pointerdown", onDrag);
        resize.addEventListener("pointerdown", onResize);
        drag.addEventListener("keydown", dragKeys);
        resize.addEventListener("keydown", resizeKeys);
        for (const handle of [drag, resize]) for (const [name, fn] of [["pointermove", move], ["pointerup", end], ["pointercancel", end], ["lostpointercapture", end]]) handle.addEventListener(name, fn);
        window2.addEventListener("resize", layout);
        return { layout, dispose() {
          disposed = true;
          if (gesture) {
            const old = gesture;
            gesture = null;
            if (old.handle.hasPointerCapture(old.id)) old.handle.releasePointerCapture(old.id);
          }
          drag.removeEventListener("pointerdown", onDrag);
          resize.removeEventListener("pointerdown", onResize);
          drag.removeEventListener("keydown", dragKeys);
          resize.removeEventListener("keydown", resizeKeys);
          for (const handle of [drag, resize]) for (const [name, fn] of [["pointermove", move], ["pointerup", end], ["pointercancel", end], ["lostpointercapture", end]]) handle.removeEventListener(name, fn);
          window2.removeEventListener("resize", layout);
        } };
      }
      module.exports = { attach, clamp, css };
    }
  });

  // src/reviewKeyboard.js
  var require_reviewKeyboard = __commonJS({
    "src/reviewKeyboard.js"(exports, module) {
      "use strict";
      function action(event) {
        if (event.defaultPrevented || event.isComposing || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
        const path = event.composedPath?.() || [event.target];
        if (path.some((node) => node?.matches?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),.panel-drag,.panel-resize'))) return null;
        return { ArrowUp: "previous", ArrowDown: "next", Enter: "accept" }[event.key] || null;
      }
      function attach(card, handler) {
        card.tabIndex = 0;
        card.addEventListener("keydown", (event) => {
          const choice = action(event);
          if (!choice) return;
          event.preventDefault();
          event.stopPropagation();
          handler(choice);
        });
        card.addEventListener("click", (event) => {
          if (!event.target.closest?.("button,input,textarea,select,.panel-drag,.panel-resize")) card.focus({ preventScroll: true });
        });
      }
      module.exports = { action, attach };
    }
  });

  // src/reviewScroll.js
  var require_reviewScroll = __commonJS({
    "src/reviewScroll.js"(exports, module) {
      "use strict";
      function reveal(view, change) {
        const transaction = { selection: { anchor: change.from, head: change.to } };
        const scroll = view.constructor?.scrollIntoView;
        if (typeof scroll === "function") transaction.effects = scroll.call(view.constructor, change.from, { y: "center", x: "nearest" });
        else transaction.scrollIntoView = true;
        view.dispatch(transaction);
      }
      function panel(body, card) {
        const bounds = body.getBoundingClientRect(), rect = card.getBoundingClientRect();
        if (rect.top < bounds.top || rect.bottom > bounds.bottom) body.scrollTop += rect.top - bounds.top - 12;
        card.focus({ preventScroll: true });
      }
      function previewRect(bounds, target) {
        const width = Math.min(370, bounds.right - bounds.left - 16);
        const belowRoom = bounds.bottom - target.bottom - 16, aboveRoom = target.top - bounds.top - 16;
        const below = belowRoom >= 230 || belowRoom >= aboveRoom;
        const height = Math.min(270, Math.max(230, below ? belowRoom : aboveRoom));
        const left = Math.max(bounds.left + 8, Math.min(target.left, bounds.right - width - 8));
        const top = below ? target.bottom + 8 : target.top - height - 8;
        return { left, top: Math.max(bounds.top + 8, Math.min(top, bounds.bottom - height - 8)), width, height };
      }
      module.exports = { reveal, panel, previewRect };
    }
  });

  // vendor/inlineReviewPreview.js
  var require_inlineReviewPreview = __commonJS({
    "vendor/inlineReviewPreview.js"(exports, module) {
      var Floating = require_floatingPanel();
      var Diff = require_reviewDiff();
      var Keyboard = require_reviewKeyboard();
      var Scroll = require_reviewScroll();
      (function(root, factory) {
        const api = factory();
        if (typeof module === "object" && module.exports) module.exports = api;
        if (root) root.CodexOverleafInlineReviewPreview = api;
      })(typeof window !== "undefined" ? window : globalThis, function() {
        "use strict";
        function create(deps) {
          const { document: document2, window: window2, staleGuard } = deps;
          let active = null, generation = 0;
          const panelState = {};
          const cancelledTokens = /* @__PURE__ */ new Set();
          const fail = (code) => ({ ok: false, code, changedDocument: false });
          function dispose() {
            if (active?.timer) window2.clearInterval(active.timer);
            active?.floating?.dispose();
            active?.host.remove();
            active = null;
          }
          function isCurrent(item) {
            return deps.getProjectId() === item.projectId && deps.getActiveFilePath() === item.path && deps.getEditorView() === item.view && item.view.dom.isConnected && item.view.state.doc.toString() === item.text;
          }
          function validate() {
            if (!active) return false;
            if (active.failure) return false;
            if (isCurrent(active)) return true;
            active.failure = "review_context_changed";
            active.floating?.dispose();
            active.host.remove();
            if (active.timer) window2.clearInterval(active.timer);
            return false;
          }
          function read(params) {
            if (!active || active.token !== params.token) return fail("review_preview_expired");
            validate();
            return active.failure ? fail(active.failure) : { ok: true, decision: active.decision, navigation: active.navigation, token: active.token };
          }
          function clear(params = {}) {
            if (params.token) {
              cancelledTokens.add(params.token);
              if (cancelledTokens.size > 64) cancelledTokens.delete(cancelledTokens.values().next().value);
            }
            if (!params.token || active?.token === params.token) {
              generation++;
              dispose();
            }
            return { ok: true, changedDocument: false };
          }
          async function show(params) {
            const owner = ++generation;
            dispose();
            if (!params.token || typeof params.base !== "string" || !params.patch || params.runProjectId !== deps.getProjectId()) return fail("review_preview_invalid");
            const opened = params.reveal === false ? { ok: true } : await deps.navigate({ path: params.path, from: 0, to: 0, runProjectId: params.runProjectId });
            if (owner !== generation || cancelledTokens.has(params.token)) return fail("review_preview_expired");
            if (!opened.ok) return opened;
            const view = deps.getEditorView();
            if (!view?.domAtPos || !view?.coordsAtPos || !view?.scrollDOM || !view.dom?.isConnected) return fail("review_preview_unsupported");
            const text = view.state.doc.toString();
            const operation = { type: "edit", path: params.path, patches: [params.patch], reviewBaselineStrict: true };
            const bases = staleGuard.buildBaseFileLookup([{ path: params.path, content: params.base }]);
            if (!staleGuard.checkOperationFreshness(operation, text, bases).ok) return fail("stale_snapshot");
            const prepared = staleGuard.prepareOperationPatches(operation, text, bases);
            const patch = prepared.patches?.[0];
            if (!prepared.ok || prepared.patches.length !== 1 || !patch || !Number.isInteger(patch.from) || !Number.isInteger(patch.to) || patch.from < 0 || patch.to < patch.from || patch.to > text.length || text.slice(patch.from, patch.to) !== patch.expected) return fail("review_preview_invalid");
            if (params.runProjectId !== deps.getProjectId() || params.path !== deps.getActiveFilePath()) return fail("review_context_changed");
            const highlights = params.highlightPatches || [patch];
            if (!highlights.length || highlights.some((p) => !Number.isInteger(p.from) || !Number.isInteger(p.to) || p.from < patch.from || p.to > patch.to || p.from > p.to || text.slice(p.from, p.to) !== p.expected)) return fail("review_preview_invalid");
            if (params.reveal !== false) Scroll.reveal(view, highlights[0]);
            const host = document2.createElement("div");
            host.dataset.codexInlineReview = "";
            host.style.cssText = "position:fixed;z-index:2147483000;pointer-events:none;overflow:visible;";
            const shadow = host.attachShadow({ mode: "open" });
            const style = document2.createElement("style");
            style.textContent = ":host{font:13px/1.45 system-ui;color:#202833}*{box-sizing:border-box}.mark{position:absolute;background:rgba(255,176,104,.30);border-bottom:2px solid #c76827;pointer-events:none}.card{position:fixed;display:flex;flex-direction:column;pointer-events:auto;background:#fff;border:1px solid #d4dce5;border-radius:9px;padding:12px;box-shadow:0 8px 28px #14233325;overflow:hidden;padding-bottom:24px}.title{font-weight:650;margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0}.hint,.actions{flex-shrink:0}.actions{flex-wrap:wrap}.text{flex:1;min-height:24px}.text{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.5 ui-monospace,monospace;background:#eef9f0;color:#165d2a;padding:8px;margin:0 0 10px;overflow:auto}.hint{max-height:3em;overflow:auto;font-size:11px;color:#697383;margin:0 0 8px}.actions{display:flex;gap:8px}button{font:inherit;padding:6px 10px;border:1px solid #c8d0da;border-radius:6px;background:#fff;color:#263140;cursor:pointer}button.accept{background:#16764b;border-color:#16764b;color:#fff}button:focus-visible{outline:3px solid #78a9e6}button:disabled{opacity:.5;cursor:default}" + Floating.css + Diff.css;
            const marks = document2.createElement("div");
            const card = document2.createElement("section");
            card.className = "card";
            card.setAttribute("aria-label", params.labels?.title || "Review one change");
            const title = document2.createElement("div");
            title.className = "title";
            title.textContent = params.labels?.title || "Review one change";
            const hint = document2.createElement("p");
            hint.className = "hint";
            hint.textContent = params.labels?.hint || "Original highlighted. Source is unchanged until accepted.";
            const proposed = document2.createElement("pre");
            proposed.className = "text";
            const diff = params.diff || Diff.parts(patch, highlights);
            Diff.render(proposed, diff.inline, params.labels);
            const actions = document2.createElement("div");
            actions.className = "actions";
            for (const [direction, symbol, label] of [[-1, "\u2191", params.labels?.previous || "Previous item"], [1, "\u2193", params.labels?.next || "Next item"]]) {
              const button = document2.createElement("button");
              button.type = "button";
              button.textContent = symbol;
              button.dataset.reviewNavigate = String(direction);
              button.title = label;
              button.setAttribute("aria-label", label);
              button.addEventListener("click", () => {
                if (validate() && active.decision === null) active.navigation = direction;
              });
              actions.append(button);
            }
            const resize = document2.createElement("button");
            resize.type = "button";
            resize.setAttribute("aria-label", params.labels?.resize || "Resize panel");
            resize.title = params.labels?.resize || "Resize panel";
            title.setAttribute("aria-label", params.labels?.move || "Move panel");
            title.title = params.labels?.move || "Move panel";
            for (const [choice, label] of [[false, params.labels?.reject || "Reject this change"], [true, params.labels?.accept || "Accept this change"]]) {
              const button = document2.createElement("button");
              button.type = "button";
              button.textContent = label;
              button.className = choice ? "accept" : "reject";
              button.dataset.reviewChoice = String(choice);
              button.addEventListener("click", () => {
                if (!validate() || active.decision !== null) return;
                active.decision = choice;
                actions.querySelectorAll("button").forEach((element) => {
                  element.disabled = true;
                });
              });
              actions.append(button);
            }
            card.append(title, hint, proposed, actions, resize);
            shadow.append(style, marks, card);
            document2.body.append(host);
            active = { token: params.token, projectId: params.runProjectId, path: params.path, view, text, patch, highlights, host, marks, card, navigation: null, decision: null, failure: "", timer: null };
            active.floating = Floating.attach({ panel: card, drag: title, resize, window: window2, state: panelState, minimum: { width: 260, height: 230 }, defaultRect: () => active.defaultRect || { left: 8, top: 8, width: 370, height: 220 } });
            active.elements = { title, hint, resize, actions, proposed };
            active.diff = diff;
            Keyboard.attach(card, (choice) => {
              if (!validate() || active.decision !== null) return;
              if (choice === "accept") {
                active.decision = true;
                actions.querySelectorAll("button").forEach((button) => {
                  button.disabled = true;
                });
              } else active.navigation = choice === "previous" ? -1 : 1;
            });
            view.requestMeasure?.({ key: host, read: () => null, write: () => window2.requestAnimationFrame(() => {
              if (active?.host === host) render();
            }) });
            render();
            active.timer = window2.setInterval(render, 250);
            return { ok: true, token: params.token, changedDocument: false };
          }
          function render() {
            if (!validate()) return;
            const item = active, { view, patch, host, marks, card } = item;
            const raw = view.scrollDOM.getBoundingClientRect();
            const bounds = { left: Math.max(0, raw.left), top: Math.max(0, raw.top), right: Math.min(window2.innerWidth, raw.right), bottom: Math.min(window2.innerHeight, raw.bottom) };
            const width = Math.max(0, bounds.right - bounds.left), height = Math.max(0, bounds.bottom - bounds.top);
            Object.assign(host.style, { left: bounds.left + "px", top: bounds.top + "px", width: width + "px", height: height + "px" });
            const rects = [];
            try {
              for (const changed of item.highlights) {
                for (const range of view.visibleRanges || []) {
                  const from = Math.max(range.from, changed.from), to = Math.min(range.to, changed.to);
                  if (from >= to) continue;
                  const start = view.domAtPos(from, 1), end = view.domAtPos(to, -1), domRange = document2.createRange();
                  domRange.setStart(start.node, start.offset);
                  domRange.setEnd(end.node, end.offset);
                  rects.push(...domRange.getClientRects());
                }
                if (changed.from === changed.to) {
                  const at = view.coordsAtPos(changed.from, 1);
                  if (at) rects.push({ ...at, left: at.left, top: at.top, right: at.left + 3, bottom: at.bottom });
                }
              }
            } catch (_) {
            }
            const visible = rects.filter((rect) => rect.bottom > bounds.top && rect.top < bounds.bottom && rect.right >= bounds.left && rect.left < bounds.right);
            marks.replaceChildren(...visible.map((rect) => {
              const mark = document2.createElement("div");
              mark.className = "mark";
              Object.assign(mark.style, { left: Math.max(0, rect.left - bounds.left) + "px", top: Math.max(0, rect.top - bounds.top) + "px", width: Math.max(3, Math.min(bounds.right, rect.right) - Math.max(bounds.left, rect.left)) + "px", height: Math.max(2, Math.min(bounds.bottom, rect.bottom) - Math.max(bounds.top, rect.top)) + "px" });
              return mark;
            }));
            card.hidden = !visible.length || width < 160 || height < 100;
            if (card.hidden) return;
            const first = visible[0];
            item.defaultRect = Scroll.previewRect(bounds, first);
            item.floating.layout();
          }
          function labels(params) {
            if (!active) return { ok: true };
            const value = params.labels, { title, hint, resize, actions, proposed } = active.elements;
            active.card.setAttribute("aria-label", value.title);
            title.textContent = value.title;
            title.title = value.move;
            title.setAttribute("aria-label", value.move);
            hint.textContent = value.hint;
            resize.title = value.resize;
            resize.setAttribute("aria-label", value.resize);
            actions.querySelector('[data-review-choice="true"]').textContent = value.accept;
            actions.querySelector('[data-review-choice="false"]').textContent = value.reject;
            for (const [direction, label] of [[-1, value.previous], [1, value.next]]) {
              const button = actions.querySelector(`[data-review-navigate="${direction}"]`);
              button.title = label;
              button.setAttribute("aria-label", label);
            }
            Diff.render(proposed, active.diff.inline, value);
            return { ok: true };
          }
          function consumeNavigation(params) {
            if (!active || active.token !== params.token) return fail("review_preview_expired");
            active.navigation = null;
            return { ok: true };
          }
          return { show, read, clear, labels, consumeNavigation, dispose: () => {
            generation++;
            dispose();
          } };
        }
        return { create };
      });
    }
  });

  // vendor/staleGuard.js
  var require_staleGuard = __commonJS({
    "vendor/staleGuard.js"(exports, module) {
      (function initStaleGuard(root, factory) {
        if (typeof module === "object" && module.exports) {
          module.exports = factory();
        } else {
          root.CodexOverleafStaleGuard = factory();
        }
      })(typeof globalThis !== "undefined" ? globalThis : window, function staleGuardFactory() {
        "use strict";
        function buildBaseFileLookup(files) {
          if (!Array.isArray(files) || files.length === 0) {
            return null;
          }
          const lookup = /* @__PURE__ */ new Map();
          for (const file of files) {
            if (typeof file?.path === "string") {
              const path = normalizePath(file.path);
              if (path) {
                lookup.set(path, String(file.content ?? ""));
              }
            }
          }
          return lookup.size ? lookup : null;
        }
        function checkOperationFreshness(operation, currentContent, baseFileLookup) {
          if (!baseFileLookup || operation?.type !== "edit") {
            return { ok: true };
          }
          const filePath = normalizePath(operation.path);
          if (!filePath || !baseFileLookup.has(filePath)) {
            return {
              ok: false,
              code: "missing_base_file",
              reasonKey: "missingBaseFile",
              reasonParams: { filePath },
              reason: `${filePath || "\u8FD9\u4E2A\u6587\u4EF6"} \u5728\u4EFB\u52A1\u5F00\u59CB\u65F6\u6CA1\u6709\u88AB Codex \u8BFB\u5230\u3002Codex \u6CA1\u6709\u8986\u76D6\u5B83\uFF1B\u8BF7\u5237\u65B0\u9879\u76EE\u5185\u5BB9\u540E\u91CD\u8BD5\u3002`
            };
          }
          const baseContent = normalizeText(baseFileLookup.get(filePath));
          const current = normalizeText(currentContent);
          if (current !== baseContent) {
            if (typeof console !== "undefined") {
              console.warn(
                "[codex-overleaf] staleGuard: STALE",
                filePath,
                "base.length:",
                baseContent.length,
                "current.length:",
                current.length,
                "base[0..80]:",
                JSON.stringify(baseContent.slice(0, 80)),
                "current[0..80]:",
                JSON.stringify(current.slice(0, 80))
              );
            }
            const patchRangeFreshness = operation.reviewBaselineStrict === true ? null : checkPatchRangeFreshness(operation, currentContent, baseFileLookup);
            if (patchRangeFreshness) {
              return patchRangeFreshness;
            }
            return {
              ok: false,
              code: "stale_snapshot",
              reasonKey: "staleSnapshot",
              reasonParams: { filePath },
              reason: `${filePath} \u5728\u4EFB\u52A1\u6267\u884C\u671F\u95F4\u88AB\u4F60\u6216\u534F\u4F5C\u8005\u6539\u8FC7\uFF0CCodex \u6CA1\u6709\u8986\u76D6\u5B83\u3002\u8BF7\u67E5\u770B\u5DEE\u5F02\u540E\u91CD\u8BD5\u3002`
            };
          }
          return { ok: true };
        }
        function checkPatchRangeFreshness(operation, currentContent, baseFileLookup) {
          const prepared = prepareOperationPatches(operation, currentContent, baseFileLookup);
          if (!prepared.ok) {
            return { ...prepared, code: "stale_patch_range", reasonKey: "stalePatchConflict" };
          }
          const patches = prepared.patches;
          if (!patches.length) {
            return null;
          }
          const current = String(currentContent ?? "");
          for (const rawPatch of patches) {
            const from = Number(rawPatch?.from);
            const to = Number(rawPatch?.to);
            const expected = String(rawPatch?.expected ?? "");
            if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from || to > current.length) {
              return {
                ok: false,
                code: "stale_patch_range",
                reasonKey: "stalePatchLocation",
                reason: "Codex \u8981\u4FEE\u6539\u7684\u4F4D\u7F6E\u5DF2\u7ECF\u65E0\u6CD5\u548C\u5F53\u524D Overleaf \u5185\u5BB9\u5BF9\u9F50\uFF0C\u6240\u4EE5\u6CA1\u6709\u5199\u5165\u3002\u8BF7\u91CD\u65B0\u8FD0\u884C\u4EFB\u52A1\u3002"
              };
            }
            if (current.slice(from, to) !== expected) {
              return {
                ok: false,
                code: "stale_patch_range",
                reasonKey: "stalePatchConflict",
                reason: "Codex \u8981\u4FEE\u6539\u7684\u5177\u4F53\u4F4D\u7F6E\u5DF2\u7ECF\u88AB\u4F60\u6216\u534F\u4F5C\u8005\u6539\u8FC7\uFF0C\u6240\u4EE5\u6CA1\u6709\u8986\u76D6\u5B83\u3002\u8BF7\u67E5\u770B\u5DEE\u5F02\u540E\u91CD\u8BD5\u3002"
              };
            }
          }
          return {
            ok: true,
            reconciled: true,
            strategy: "patch-range"
          };
        }
        function prepareOperationPatches(operation, currentContent, baseFileLookup) {
          const patches = Array.isArray(operation?.patches) ? operation.patches : [];
          const current = String(currentContent ?? "");
          const path = normalizePath(operation?.path);
          const base = baseFileLookup?.get(path);
          if (!patches.length || typeof base !== "string" || base === current) {
            return { ok: true, patches };
          }
          const baseMap = lineEndingMap(base);
          const currentMap = lineEndingMap(current);
          if (!baseMap.removed.length && !currentMap.removed.length) return { ok: true, patches };
          const groups = [];
          let previousTo = 0;
          for (const patch of patches) {
            const from = Number(patch?.from), to = Number(patch?.to);
            if (!Number.isInteger(from) || !Number.isInteger(to) || from < previousTo || to < from || to > base.length) {
              return patchMappingFailure("invalid_patch");
            }
            if (base.slice(from, to) !== String(patch.expected ?? "")) return patchMappingFailure("stale_patch");
            previousTo = to;
            let start = from, end = to;
            const insert = String(patch.insert ?? "");
            if (base[from - 1] === "\r" && (base[from] === "\n" || insert.startsWith("\n") || !insert && base[to] === "\n")) start -= 1;
            if (base[to] === "\n" && (base[to - 1] === "\r" || insert.endsWith("\r") || !insert && base[from - 1] === "\r")) end += 1;
            const previous = groups[groups.length - 1];
            if (previous && start <= previous.end) {
              previous.end = Math.max(previous.end, end);
              previous.patches.push({ ...patch, from, to });
            } else groups.push({ start, end, patches: [{ ...patch, from, to }] });
          }
          const mapped = [], sourceChanges = [];
          for (const group of groups) {
            const logicalFrom = baseMap.toLogical(group.start), logicalTo = baseMap.toLogical(group.end);
            if (logicalTo > currentMap.length) return patchMappingFailure("invalid_patch");
            const from = currentMap.toRaw(logicalFrom), to = currentMap.toRaw(logicalTo);
            const expected = current.slice(from, to);
            if (normalizeText(expected) !== normalizeText(base.slice(group.start, group.end))) {
              return patchMappingFailure("stale_patch");
            }
            let insert = base.slice(group.start, group.end);
            for (const patch of group.patches.slice().sort((left, right) => right.from - left.from)) {
              if (insert.slice(patch.from - group.start, patch.to - group.start) !== String(patch.expected ?? "")) {
                return patchMappingFailure("stale_patch");
              }
              insert = insert.slice(0, patch.from - group.start) + String(patch.insert ?? "") + insert.slice(patch.to - group.start);
            }
            sourceChanges.push({ from: group.start, to: group.end, insert });
            const sourceEnding = nearestLineEnding(base, group.start);
            const editorEnding = nearestLineEnding(current, from);
            if (sourceEnding && editorEnding && sourceEnding !== editorEnding) {
              insert = normalizeText(insert).replace(/\n/g, editorEnding);
            }
            let prefix = 0, oldEnd = expected.length, newEnd = insert.length;
            while (prefix < oldEnd && prefix < newEnd && expected[prefix] === insert[prefix]) prefix += 1;
            while (oldEnd > prefix && newEnd > prefix && expected[oldEnd - 1] === insert[newEnd - 1]) {
              oldEnd -= 1;
              newEnd -= 1;
            }
            mapped.push({ from: from + prefix, to: from + oldEnd, expected: expected.slice(prefix, oldEnd), insert: insert.slice(prefix, newEnd) });
          }
          let sourceContent = base;
          for (const patch of sourceChanges.reverse()) {
            sourceContent = sourceContent.slice(0, patch.from) + patch.insert + sourceContent.slice(patch.to);
          }
          return { ok: true, patches: mapped, sourceContent };
        }
        function patchMappingFailure(code) {
          return { ok: false, code, reason: "Codex \u8981\u4FEE\u6539\u7684\u4F4D\u7F6E\u5DF2\u7ECF\u65E0\u6CD5\u548C\u5F53\u524D Overleaf \u5185\u5BB9\u5BF9\u9F50\uFF0C\u6240\u4EE5\u6CA1\u6709\u5199\u5165\u3002\u8BF7\u91CD\u65B0\u8FD0\u884C\u4EFB\u52A1\u3002" };
        }
        function lineEndingMap(text) {
          const removed = [];
          for (let index = 0; index < text.length - 1; index += 1) {
            if (text[index] === "\r" && text[index + 1] === "\n") removed.push(index);
          }
          function countBefore(offset, logical) {
            let low = 0, high = removed.length;
            while (low < high) {
              const middle = low + high >>> 1;
              if (removed[middle] - (logical ? middle : 0) < offset) low = middle + 1;
              else high = middle;
            }
            return low;
          }
          return {
            removed,
            length: text.length - removed.length,
            toLogical: (offset) => offset - countBefore(offset, false),
            toRaw: (offset) => offset + countBefore(offset, true)
          };
        }
        function nearestLineEnding(text, offset) {
          let newline = text.indexOf("\n", offset);
          if (newline < 0) newline = text.lastIndexOf("\n", offset - 1);
          return newline < 0 ? "" : text[newline - 1] === "\r" ? "\r\n" : "\n";
        }
        function updateExpectedFileContent(baseFileLookup, filePath, content) {
          const path = normalizePath(filePath);
          if (!baseFileLookup || !path) {
            return;
          }
          baseFileLookup.set(path, String(content ?? ""));
        }
        function removeExpectedFile(baseFileLookup, filePath) {
          const path = normalizePath(filePath);
          if (!baseFileLookup || !path) {
            return;
          }
          baseFileLookup.delete(path);
        }
        function moveExpectedFile(baseFileLookup, fromPath, toPath) {
          const from = normalizePath(fromPath);
          const to = normalizePath(toPath);
          if (!baseFileLookup || !from || !to) {
            return;
          }
          if (!baseFileLookup.has(from)) {
            return;
          }
          const content = baseFileLookup.get(from);
          baseFileLookup.delete(from);
          baseFileLookup.set(to, content);
        }
        function normalizeText(value) {
          return String(value ?? "").replace(/\r\n/g, "\n");
        }
        function normalizePath(value) {
          return String(value || "").replace(/\s+/g, " ").replace(/\\/g, "/").trim().replace(/^\/+/, "");
        }
        return {
          buildBaseFileLookup,
          checkOperationFreshness,
          prepareOperationPatches,
          updateExpectedFileContent,
          removeExpectedFile,
          moveExpectedFile,
          normalizePath
        };
      });
    }
  });

  // src/main.js
  var Service = require_service();
  var Adapter = require_overleafAdapter();
  var Preview = require_inlineReviewPreview();
  var Guard = require_staleGuard();
  var adapter = Adapter.create(window, document);
  var preview = Preview.create({
    document,
    window,
    staleGuard: Guard,
    getProjectId: adapter.projectId,
    getActiveFilePath: adapter.path,
    getEditorView: adapter.view,
    navigate: async ({ path, runProjectId }) => ({ ok: await adapter.open(path, runProjectId) })
  });
  var service = Service.create({ adapter, preview, crypto: window.crypto });
  var capability = "";
  var responses = /* @__PURE__ */ new Map();
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== window.location.origin || event.data?.channel !== "codex-suggestions:request") return;
    const message = event.data;
    if (typeof message.capability !== "string" || message.capability.length !== 64 || typeof message.id !== "string") return;
    if (message.method === "hello" && !capability) capability = message.capability;
    if (!capability || message.capability !== capability) return;
    const reply = (result) => window.postMessage({ channel: "codex-suggestions:response", id: message.id, capability, result }, window.location.origin);
    if (responses.has(message.id)) {
      responses.get(message.id).then(reply);
      return;
    }
    const pending = Promise.resolve().then(() => {
      if (message.method === "hello") return { ok: true };
      if (message.method === "begin") return service.begin(message.params);
      if (message.method === "language") return service.setLanguage(message.params);
      if (message.method === "snapshot") return service.snapshot();
      if (message.method === "cancel") return service.cancel();
      if (message.method === "project") return { ok: true, projectId: adapter.projectId(), file: adapter.path() };
      if (!["prepare", "status", "apply", "navigation"].includes(message.method)) return { ok: false, code: "unknown_method" };
      if (!message.params?.projectId || adapter.projectId() !== message.params.projectId) return { ok: false, code: "project_changed" };
      return service[message.method](message.params);
    }).catch((error) => ({ ok: false, code: "bridge_failed", error: error.message }));
    responses.set(message.id, pending);
    if (responses.size > 64) responses.delete(responses.keys().next().value);
    pending.then((result) => {
      reply(result);
      if (message.method !== "apply") responses.delete(message.id);
    });
  });
})();
