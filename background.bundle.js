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

  // src/reviewCounts.js
  var require_reviewCounts = __commonJS({
    "src/reviewCounts.js"(exports, module) {
      "use strict";
      function restore(pack, decisions = {}) {
        const counts = { written: 0, rejected: 0, skipped: 0, unknown: 0, retained: 0 }, indexes = [], decisionIndexes = {};
        for (const [index, item] of (pack?.suggestions || []).entries()) {
          const state = decisions[item.reviewKey]?.state;
          if (state === "written" || state === "rejected") {
            counts[state]++;
            counts.retained++;
            indexes.push(index);
            decisionIndexes[item.reviewKey] = index;
          }
        }
        return { counts, indexes, decisionIndexes };
      }
      function completed(counts) {
        return counts.written + counts.rejected + counts.skipped + counts.unknown;
      }
      function retained(pack, decisions) {
        return restore(pack, decisions).counts;
      }
      function position(index, finished) {
        let ordinal = 0;
        for (let i = 0; i <= index; i++) if (!finished.has(i)) ordinal++;
        return ordinal;
      }
      module.exports = { restore, retained, completed, position };
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

  // src/progress.js
  var require_progress = __commonJS({
    "src/progress.js"(exports, module) {
      "use strict";
      var Core2 = require_suggestions();
      var { characterEdits } = require_characterEdits();
      var request2 = (r) => new Promise((resolve, reject) => {
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      function create(indexedDB2, crypto2) {
        let opening;
        function db() {
          return opening ||= new Promise((resolve, reject) => {
            const r = indexedDB2.open("codex-overleaf-review", 1);
            r.onupgradeneeded = () => {
              for (const name of ["packs", "decisions", "bases", "edits"]) {
                const store = r.result.createObjectStore(name, { keyPath: "key" });
                store.createIndex("project", "project");
              }
            };
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
          });
        }
        const complete = (tx) => new Promise((resolve, reject) => {
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error || new Error("Progress transaction aborted"));
        });
        async function keys(pack) {
          const suggestions = [];
          for (let offset = 0; offset < pack.suggestions.length; offset += 64) {
            suggestions.push(...await Promise.all(pack.suggestions.slice(offset, offset + 64).map(async (item) => {
              const fields = [item.id, item.file, item.original, item.replacement, item.before, item.after, item.scope || null];
              const hash = await crypto2.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(fields)));
              return { ...item, reviewKey: Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("") };
            })));
          }
          return { ...pack, suggestions };
        }
        async function load(project) {
          const database = await db(), tx = database.transaction(["packs", "decisions", "bases", "edits"], "readonly"), done = complete(tx);
          const reads = ["packs", "decisions", "bases", "edits"].map((name) => request2(tx.objectStore(name).index("project").getAll(project)));
          const [packs, records, bases, chunks] = await Promise.all(reads);
          await done;
          const ledgers = {};
          for (const base of bases) ledgers[base.file] = { base: base.base, history: base.history || [], edits: chunks.filter((c) => c.file === base.file && c.generation === base.generation).sort((a, b) => a.sequence - b.sequence).flatMap((c) => c.edits) };
          const legacy = /* @__PURE__ */ new Map();
          for (const [file, ledger] of Object.entries(ledgers)) {
            const edits = ledger.edits.filter((p) => !p.external && !p.reviewKey);
            if (edits.length) legacy.set(file, new Map(edits.map((p) => [JSON.stringify([p.from, p.to, p.insert]), p])));
          }
          const written = new Set(records.filter((r) => r.state === "written").map((r) => r.key[1]));
          for (const item of packs[0]?.pack?.suggestions || []) {
            const edits = legacy.get(item.file);
            if (!edits || !written.has(item.reviewKey)) continue;
            const match = Core2.locate(ledgers[item.file].base, item);
            if (!match.ok) continue;
            for (const p of characterEdits(match.patch, ledgers[item.file].base) || []) {
              const saved = edits.get(JSON.stringify([p.from, p.to, p.insert]));
              if (saved) {
                saved.reviewKey = item.reviewKey;
                edits.delete(JSON.stringify([p.from, p.to, p.insert]));
              }
            }
            if (!edits.size) legacy.delete(item.file);
          }
          return { pack: packs[0]?.pack || null, decisions: Object.fromEntries(records.map((r) => [r.key[1], { state: r.state, code: r.code }])), ledgers };
        }
        async function savePack(project, pack) {
          const prepared = await keys(pack), database = await db(), tx = database.transaction("packs", "readwrite"), done = complete(tx);
          tx.objectStore("packs").put({ key: project, project, pack: prepared });
          await done;
        }
        async function save(project, { decision, journal = [] }) {
          const database = await db(), tx = database.transaction(["decisions", "bases", "edits"], "readwrite"), done = complete(tx);
          if (decision) tx.objectStore("decisions").put({ key: [project, decision.reviewKey], project, state: decision.state, code: decision.code || "" });
          for (const entry of journal) {
            const chunksStore = tx.objectStore("edits");
            if (entry.id && await request2(chunksStore.get([project, "receipt", entry.id]))) continue;
            for (const update of entry.decisions || []) if (update.state === "pending") {
              const decisions = tx.objectStore("decisions"), key2 = [project, update.reviewKey], saved = await request2(decisions.get(key2));
              if (saved?.state === "written") decisions.delete(key2);
            }
            const store = tx.objectStore("bases"), key = [project, entry.file];
            const existing = await request2(store.get(key));
            let base = existing;
            if (typeof entry.base === "string") {
              base = { key, project, file: entry.file, base: entry.base, generation: crypto2.randomUUID(), sequence: 0 };
              store.put(base);
              const chunks = await request2(tx.objectStore("edits").index("project").getAll(project));
              for (const chunk of chunks) if (chunk.file === entry.file) tx.objectStore("edits").delete(chunk.key);
            }
            if (entry.replace) {
              const chunks = await request2(chunksStore.index("project").getAll(project));
              for (const chunk of chunks) if (chunk.file === entry.file) chunksStore.delete(chunk.key);
            }
            if (base && entry.removed?.length) {
              base.history ||= [];
              for (const p of entry.removed) if (!base.history.some((q) => q.from === p.from && q.to === p.to && q.insert === p.insert && q.reviewKey === p.reviewKey)) base.history.push(p);
              store.put(base);
            }
            if (entry.id) chunksStore.put({ key: [project, "receipt", entry.id], project, file: "", edits: [] });
            if (base && entry.edits?.length) {
              base.sequence++;
              store.put(base);
              tx.objectStore("edits").put({ key: crypto2.randomUUID(), project, file: entry.file, generation: base.generation, sequence: base.sequence, edits: entry.edits });
            }
          }
          await done;
        }
        async function clear(project) {
          const database = await db(), tx = database.transaction(["packs", "decisions", "bases", "edits"], "readwrite"), done = complete(tx);
          for (const name of ["packs", "decisions", "bases", "edits"]) {
            const store = tx.objectStore(name), rows = await request2(store.index("project").getAll(project));
            for (const row of rows) store.delete(row.key);
          }
          await done;
        }
        async function clearTracking(project, file) {
          if (typeof file !== "string" || !file) throw new Error("File required");
          const database = await db(), tx = database.transaction(["bases", "edits"], "readwrite"), done = complete(tx);
          for (const name of ["bases", "edits"]) {
            const store = tx.objectStore(name), rows = await request2(store.index("project").getAll(project));
            for (const row of rows) if (row.file === file) store.delete(row.key);
          }
          await done;
        }
        return { load, savePack, save, clear, clearTracking, keys };
      }
      module.exports = { create };
    }
  });

  // src/catalog.js
  var require_catalog = __commonJS({
    "src/catalog.js"(exports, module) {
      "use strict";
      var Core2 = require_suggestions();
      function create(crypto2) {
        const packs = /* @__PURE__ */ new Map(), uploads = /* @__PURE__ */ new Map();
        function put(project, pack) {
          const ref = crypto2.randomUUID();
          packs.set(ref, { project, pack });
          const previous = [...packs].filter(([id, p]) => p.project === project && id !== ref);
          for (const [id] of previous.slice(0, -1)) packs.delete(id);
          return { ref, count: pack.suggestions.length, projectId: pack.projectId };
        }
        function get(project, ref) {
          const entry = packs.get(ref);
          if (!entry || entry.project !== project) throw new Error("\u5EFA\u8BAE\u4F1A\u8BDD\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u8F7D\u5165");
          return entry.pack;
        }
        function parse(project, input) {
          return put(project, Core2.parsePack(input));
        }
        function chunk(project, message) {
          for (const [id, upload2] of uploads) if (upload2.expires < Date.now()) uploads.delete(id);
          let upload = uploads.get(project);
          if (message.index === 0) {
            upload = { id: message.uploadId, next: 0, chunks: [], bytes: 0, expires: Date.now() + 6e4 };
            uploads.set(project, upload);
          }
          if (!upload || upload.id !== message.uploadId || upload.next !== message.index || typeof message.chunk !== "string" || message.chunk.length > 262144) throw new Error("\u5EFA\u8BAE\u5305\u5206\u5757\u987A\u5E8F\u65E0\u6548");
          upload.bytes += new TextEncoder().encode(message.chunk).length;
          upload.expires = Date.now() + 6e4;
          if (upload.bytes > Core2.MAX_PACK_BYTES) {
            uploads.delete(project);
            throw new Error("\u5EFA\u8BAE\u5305\u4E0D\u80FD\u8D85\u8FC7 64 MiB");
          }
          upload.chunks.push(message.chunk);
          upload.next++;
          if (message.last) {
            uploads.delete(project);
            return parse(project, upload.chunks.join(""));
          }
          return null;
        }
        function items(project, ref, index) {
          const pack = get(project, ref), values = [];
          let bytes = 0;
          if (!Number.isInteger(index) || index < 0 || index >= pack.suggestions.length) throw new Error("\u5EFA\u8BAE\u7D22\u5F15\u65E0\u6548");
          for (const item of pack.suggestions.slice(index, index + 32)) {
            const size = JSON.stringify(item).length;
            if (values.length && bytes + size > 131072) break;
            values.push(item);
            bytes += size;
          }
          return values;
        }
        return { put, get, parse, chunk, items };
      }
      module.exports = { create };
    }
  });

  // src/background.js
  var Core = require_suggestions();
  var Counts = require_reviewCounts();
  var Progress = require_progress();
  var progress = Progress.create(indexedDB, crypto);
  var catalog = require_catalog().create(crypto);
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (sender.id !== chrome.runtime.id) return;
    (async () => {
      if (!/^https:\/\/(www\.)?overleaf\.com\/project\/([a-f\d]{24})(?:\/|$)/i.test(sender.url || "")) throw new Error("Overleaf project required");
      const projectId = sender.url.match(/\/project\/([a-f\d]{24})/i)[1];
      const name = "bridge-" + projectId;
      if (message.type === "ping") return { ok: true };
      if (message.type === "parse") return { ok: true, pack: catalog.parse(projectId, message.input) };
      if (message.type === "parseChunk") return { ok: true, pack: catalog.chunk(projectId, message) };
      if (message.type === "items") return { ok: true, items: catalog.items(projectId, message.ref, message.index) };
      if (message.type === "session") {
        if (message.pack) {
          const pack = message.pack.ref ? catalog.get(projectId, message.pack.ref) : Core.parsePack(message.pack);
          if (pack.projectId && pack.projectId !== projectId) throw new Error("Project mismatch");
          await progress.savePack(projectId, pack);
        }
        const state = await progress.load(projectId), restored = Counts.restore(state.pack, state.decisions);
        return { ok: true, ...state, initialCounts: restored.counts, decidedIndexes: restored.indexes, decisionIndexes: restored.decisionIndexes, pack: state.pack ? catalog.put(projectId, state.pack) : null };
      }
      if (message.type === "progress") {
        await progress.save(projectId, message);
        return { ok: true };
      }
      if (message.type === "clearTracking") {
        if (message.projectId !== projectId) throw new Error("Project mismatch");
        await progress.clearTracking(projectId, message.file);
        return { ok: true };
      }
      if (message.type === "clearProgress") {
        await progress.clear(projectId);
        return { ok: true };
      }
      if (message.type === "disconnect") {
        await chrome.storage.local.remove(name);
        return { ok: true };
      }
      if (message.type === "connect") {
        if (!/^[a-f\d]{64}$/i.test(message.token || "")) throw new Error("\u914D\u5BF9\u4EE4\u724C\u683C\u5F0F\u4E0D\u6B63\u786E");
        await request("state", projectId, message.token);
        await chrome.storage.local.set({ [name]: message.token });
        return { ok: true };
      }
      const token = (await chrome.storage.local.get(name))[name];
      if (!token) return { ok: false, disconnected: true };
      if (message.type === "sync") {
        const data = await request("sync", projectId, token, { snapshot: message.snapshot, requestId: message.requestId, results: message.results });
        if (data.revision !== message.revision) {
          const next = await request("pack", projectId, token);
          return { ...data, ok: true, ...next, pack: next.pack ? catalog.parse(projectId, next.pack) : null };
        }
        return { ok: true, ...data };
      }
      throw new Error("Unknown bridge operation");
    })().then(reply, (error) => reply({ ok: false, error: error.message }));
    return true;
  });
  async function request(endpoint, projectId, token, body) {
    const response = await fetch("http://127.0.0.1:43127/" + endpoint + "?projectId=" + projectId, { method: body ? "POST" : "GET", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : void 0, signal: AbortSignal.timeout(1e4) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
  }
})();
