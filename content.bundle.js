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

  // src/runner.js
  var require_runner = __commonJS({
    "src/runner.js"(exports, module) {
      "use strict";
      var Counts = require_reviewCounts();
      function halt(code) {
        return ["project_changed", "cancelled", "write_unconfirmed", "bridge_failed", "bridge_timeout", "tracking_out_of_sync", "review_lease_lost", "review_file_mismatch"].includes(code);
      }
      async function run(pack, deps) {
        const results = /* @__PURE__ */ new Map(), settled = /* @__PURE__ */ new Set();
        const list = () => [...results.entries()].sort((a, b) => a[0] - b[0]).map(([, result]) => result);
        const restored = deps.initialCounts ? { counts: deps.initialCounts, indexes: deps.decidedIndexes || [] } : Counts.restore(pack, deps.decisions);
        const counts = { ...restored.counts }, finished = new Set(restored.indexes);
        const indexes = new Map(Object.entries(deps.decisionIndexes || restored.decisionIndexes || {}));
        const initial = new Set(restored.indexes), states = /* @__PURE__ */ new Map();
        for (const [key, index2] of indexes) states.set(index2, deps.decisions?.[key]?.state);
        const notify = () => deps.progress?.({ ...counts, total, completed: Counts.completed(counts), pending: total - Counts.completed(counts) });
        const save = (index2, result) => {
          results.set(index2, compact(result));
          settled.add(index2);
          finished.add(index2);
          if (result.state !== "retained") counts[result.state]++;
          states.set(index2, result.state === "retained" ? result.previous : result.state);
          notify();
        };
        const compact = (result) => ({ ...result, item: { id: result.item.id, file: result.item.file, reviewKey: result.item.reviewKey } });
        const total = pack.count ?? pack.suggestions.length;
        let index = 0, suspended = null;
        notify();
        function reconcile(updates) {
          for (const update of updates) {
            if (update.state !== "pending") continue;
            const position = indexes.get(update.reviewKey), state = states.get(position) || deps.decisions?.[update.reviewKey]?.state;
            if (state === "rejected" || state === "unknown") continue;
            if (deps.decisions) delete deps.decisions[update.reviewKey];
            if (position === void 0 || !finished.has(position)) continue;
            finished.delete(position);
            settled.delete(position);
            results.delete(position);
            states.delete(position);
            if (state && counts[state] > 0) counts[state]--;
            if (initial.delete(position)) counts.retained--;
          }
          notify();
        }
        deps.observe?.(reconcile);
        try {
          while (settled.size < total) {
            if (index >= total) {
              index = 0;
              while (settled.has(index)) index++;
            }
            if (settled.has(index)) {
              index++;
              continue;
            }
            deps.assertCurrent();
            const item = deps.itemAt ? await deps.itemAt(index) : pack.suggestions[index];
            if (item.reviewKey) indexes.set(item.reviewKey, index);
            const retained = deps.decisions?.[item.reviewKey];
            if (retained?.state === "unknown") throw Object.assign(new Error("\u5148\u6838\u5BF9\u4E0A\u6B21\u672A\u786E\u8BA4\u7684\u5199\u5165"), { code: "write_unconfirmed", results: list() });
            if (retained && ["written", "rejected"].includes(retained.state)) {
              save(index, { item, state: "retained", previous: retained.state });
              await deps.retained?.({ item, state: retained.state });
              if (index % 100 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
              index++;
              continue;
            }
            let prepared;
            try {
              prepared = suspended?.index === index ? suspended.prepared : await deps.call("prepare", { item, projectId: deps.projectId, presentation: deps.presentation?.({ index, total, remaining: total - finished.size, position: Counts.position(index, finished) }) });
              suspended = null;
            } catch (error) {
              if (error.code === "review_lease_lost") throw error;
              throw Object.assign(new Error("\u8FDE\u63A5\u4E2D\u65AD\uFF0C\u6CA1\u6709\u81EA\u52A8\u91CD\u8BD5"), { code: "bridge_timeout", results: list() });
            }
            deps.assertCurrent();
            if (!prepared.ok) {
              if (prepared.code === "tracking_out_of_sync") throw Object.assign(new Error("\u5B9A\u4F4D\u8BB0\u5F55\u5DF2\u5931\u6548"), { code: prepared.code, file: item.file, results: list() });
              const result2 = { item, state: "skipped", code: prepared.code };
              save(index, result2);
              await deps.record(result2);
              if (halt(prepared.code)) throw Object.assign(new Error("\u5BA1\u9605\u5DF2\u505C\u6B62"), { code: prepared.code, results: list() });
              index++;
              continue;
            }
            const decision = await deps.review(item, prepared, { index, total, get remaining() {
              return total - finished.size;
            }, get position() {
              return Counts.position(index, finished);
            }, isPending: (i) => !finished.has(i), isDecided: (item2) => ["written", "rejected"].includes(deps.decisions?.[item2.reviewKey]?.state) });
            deps.assertCurrent();
            if (Number.isInteger(decision.navigate)) {
              if (decision.navigate < 0 || decision.navigate >= total || finished.has(decision.navigate)) throw new Error("\u65E0\u6548\u7684\u5BA1\u9605\u5BFC\u822A\u76EE\u6807");
              if (decision.skipped) {
                const result2 = { item, state: "skipped", code: decision.skipped };
                save(index, result2);
                await deps.record(result2);
              }
              await deps.call("cancel", {});
              deps.assertCurrent();
              index = decision.navigate;
              continue;
            }
            if (decision.skipped) {
              if (decision.skipped === "tracking_out_of_sync") throw Object.assign(new Error("\u5B9A\u4F4D\u8BB0\u5F55\u5DF2\u5931\u6548"), { code: decision.skipped, file: item.file, results: list() });
              const result2 = { item, state: "skipped", code: decision.skipped };
              save(index, result2);
              await deps.record(result2);
              if (halt(decision.skipped)) throw Object.assign(new Error("\u5BA1\u9605\u5DF2\u505C\u6B62"), { code: decision.skipped, results: list() });
              index++;
              continue;
            }
            if (decision.accepted !== true) {
              await deps.call("cancel", {});
              const result2 = { item, state: "rejected" };
              save(index, result2);
              await deps.record(result2);
              index++;
              continue;
            }
            let applied;
            try {
              applied = await deps.call("apply", { token: decision.token, projectId: deps.projectId });
            } catch (error) {
              if (error.code === "review_lease_lost") throw error;
              throw Object.assign(new Error("\u5199\u5165\u72B6\u6001\u672A\u786E\u8BA4\uFF0C\u68C0\u67E5\u5F53\u524D\u6587\u4EF6\uFF1B\u4E0D\u8981\u91CD\u590D\u63A5\u53D7"), { code: "write_unconfirmed", results: list() });
            }
            if (applied.suspended === true && applied.changedDocument === false) {
              suspended = { index, prepared: { ...prepared, token: decision.token, inline: false, suspended: true } };
              continue;
            }
            if (applied.code === "review_lease_lost") throw Object.assign(new Error("\u6807\u7B7E\u9875\u5BA1\u9605\u6743\u9650\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u5F00\u59CB\u5BA1\u9605"), { code: applied.code, results: list() });
            if (applied.code === "tracking_out_of_sync") throw Object.assign(new Error("\u5B9A\u4F4D\u8BB0\u5F55\u5DF2\u5931\u6548"), { code: applied.code, file: item.file, results: list() });
            const verified = applied.ok === true && applied.verified === true;
            const code = applied.code || (verified ? "" : "write_unconfirmed");
            const result = { item, state: verified ? "written" : applied.changedDocument ? "unknown" : "skipped", code };
            save(index, result);
            await deps.record(result);
            if (!verified && halt(code)) throw Object.assign(new Error("\u5199\u5165\u672A\u786E\u8BA4\uFF0C\u505C\u6B62\u540E\u7EED\u9879"), { code, results: list() });
            index++;
          }
          return list();
        } finally {
          deps.observe?.(null);
        }
      }
      module.exports = { run, halt };
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

  // src/i18n.js
  var require_i18n = __commonJS({
    "src/i18n.js"(exports, module) {
      "use strict";
      var english = {
        "\u5BA1\u9605\u8303\u56F4": "Review scope",
        "\u5F53\u524D\u6587\u4EF6\uFF08\u591A\u6807\u7B7E\u9875\uFF09": "Current file (multiple tabs)",
        "\u5168\u90E8\u6587\u4EF6\uFF08\u5355\u6807\u7B7E\u9875\uFF09": "All files (one tab)",
        "\u672C\u9875\u53EA\u5BA1\u9605\u5F00\u59CB\u65F6\u7684\u6587\u4EF6\uFF1B\u8BF7\u5B9A\u4F4D\u5F53\u524D\u9879\uFF0C\u6216\u505C\u6B62\u540E\u5728\u65B0\u6587\u4EF6\u5F00\u59CB\u5BA1\u9605": "This tab reviews its starting file. Locate the current item, or stop and start review in the new file.",
        "\u6807\u7B7E\u9875\u5BA1\u9605\u6743\u9650\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u5F00\u59CB\u5BA1\u9605": "This tab\u2019s review permission is no longer valid. Start review again.",
        "\u5176\u4ED6\u6807\u7B7E\u9875\u6B63\u5728\u5BA1\u9605\uFF0C\u8BF7\u5148\u505C\u6B62\u540E\u518D\u66F4\u6362\u5EFA\u8BAE\u5305": "Stop review in the other tabs before replacing the suggestion pack.",
        "\u6B64\u6587\u4EF6\u5DF2\u5728\u5176\u4ED6\u6807\u7B7E\u9875\u5BA1\u9605\uFF1B\u8BF7\u4F7F\u7528\u4E0D\u540C\u6587\u4EF6\uFF0C\u6216\u5148\u505C\u6B62\u53E6\u4E00\u9875": "This file is being reviewed in another tab. Use a different file or stop the other tab first.",
        "\u5F53\u524D\u6587\u4EF6\u6CA1\u6709\u5BA1\u9605\u5EFA\u8BAE\uFF0C\u8BF7\u5207\u6362\u6587\u4EF6\u6216\u9009\u62E9\u5168\u90E8\u6587\u4EF6": "No suggestions for this file. Switch files or select all files.",
        "\u8BF7\u5148\u505C\u6B62\u76F8\u5173\u6807\u7B7E\u9875\u7684\u5BA1\u9605\uFF0C\u518D\u6E05\u9664\u8FDB\u5EA6\u6216\u91CD\u5EFA\u5B9A\u4F4D": "Stop review in the affected tabs before clearing progress or rebuilding tracking.",
        "\u5EFA\u8BAE\u8BE6\u60C5": "Suggestion details",
        "\u8BE6\u60C5 \u2197": "Details \u2197",
        "\u8FD4\u56DE\u7CBE\u7B80 \u2199": "Back to compact \u2199",
        "\u5BA1\u9605\u7BA1\u7406": "Review setup",
        "\u4FEE\u6539\u7406\u7531": "Reason",
        "\u4FEE\u6539\u5BF9\u6BD4": "Changes",
        "\u67E5\u770B\u5B8C\u6574\u4E0A\u4E0B\u6587": "Show full context",
        "\u8FD4\u56DE\u7B80\u6D01\u5BF9\u6BD4": "Back to concise changes",
        "\u5B9A\u4F4D\u5F53\u524D\u9879": "Locate current item",
        "\u5DF2\u5207\u6362\u6587\u4EF6\uFF0C\u5F53\u524D\u5EFA\u8BAE\u4E0E\u8FDB\u5EA6\u4FDD\u7559\u3002\u53EF\u81EA\u7531\u7F16\u8F91\uFF0C\u70B9\u51FB\u5B9A\u4F4D\u5F53\u524D\u9879\u6216\u5BA1\u9605\u5BFC\u822A\u7EE7\u7EED\u3002": "File switched; the current suggestion and progress are preserved. Edit freely, then locate this item or use review navigation to continue.",
        "\u62D2\u7EDD": "Reject",
        "\u63A5\u53D7": "Accept",
        "\u2191\u2193 \u5207\u6362 \xB7 Enter \u63A5\u53D7": "\u2191\u2193 Navigate \xB7 Enter Accept",
        "\u5DF2\u505C\u6B62\uFF0C\u8FD4\u56DE\u5BFC\u5165\u540E\u53EF\u7EE7\u7EED": "Stopped; return to import to resume",
        "\u91CD\u65B0\u5EFA\u7ACB\u5B9A\u4F4D\uFF08\u4FDD\u7559\u51B3\u5B9A\uFF09": "Rebuild tracking (keep decisions)",
        "\u5B9A\u4F4D\u8BB0\u5F55\u4E0E\u5F53\u524D\u6B63\u6587\u4E0D\u4E00\u81F4\uFF0C\u5BA1\u9605\u5DF2\u6682\u505C\u3002\u53EF\u91CD\u65B0\u5EFA\u7ACB\u5B9A\u4F4D\uFF0C\u4FDD\u7559\u63A5\u53D7\uFF0F\u62D2\u7EDD\u51B3\u5B9A\u3002": "Saved tracking no longer matches the source. Review paused. Rebuild tracking to keep accepted/rejected decisions.",
        "\u6B63\u5728\u51C6\u5907\u5BA1\u9605\u2026": "Preparing review\u2026",
        "\u6B63\u5728\u8F7D\u5165\u65B0\u7248\u672C\u5EFA\u8BAE\u2026": "Loading the updated suggestion pack\u2026",
        "\u5BA1\u9605\u5DF2\u505C\u6B62\uFF0C\u53EF\u8FD4\u56DE\u5BFC\u5165\u540E\u7EE7\u7EED": "Review stopped. Return to import to resume.",
        "\u6269\u5C55\u5DF2\u66F4\u65B0\u6216\u91CD\u65B0\u52A0\u8F7D\uFF0C\u5BA1\u9605\u5DF2\u505C\u6B62\u3002\u8BF7\u5237\u65B0 Overleaf \u9875\u9762\u540E\u7EE7\u7EED\uFF1B\u521A\u63A5\u53D7\u7684\u4FEE\u6539\u8BF7\u5148\u6838\u5BF9\u6B63\u6587\u3002": "The extension was updated or reloaded. Review has stopped. Refresh Overleaf to continue; check the source if you just accepted a change.",
        "\u65E0\u6CD5\u8FDE\u63A5\u6269\u5C55": "Cannot connect to the extension",
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
        [/^项目已确认 (\d+) \/ (\d+)$/, (_, done, total) => `Project decisions ${done} / ${total}`],
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
        return { added: t("\u65B0\u589E"), removed: t("\u5220\u9664"), replaced: t("\u66FF\u6362\u539F\u6587"), title: t("\u4FEE\u6539 " + item.id + " \xB7 L" + line), details: t("\u8BE6\u60C5 \u2197"), reason: item.reason, compactHint: t("\u2191\u2193 \u5207\u6362 \xB7 Enter \u63A5\u53D7"), hint: t("\u2191 \u4E0A\u4E00\u9879 \xB7 \u2193 \u4E0B\u4E00\u9879 \xB7 Enter \u63A5\u53D7\uFF08\u5BA1\u9605\u5361\u7247\u5185\uFF09"), accept: t("\u63A5\u53D7\u8FD9\u4E00\u9879"), reject: t("\u62D2\u7EDD\u8FD9\u4E00\u9879"), empty: t("\uFF08\u5220\u9664\u6B64\u6BB5\uFF09"), previous: t("\u4E0A\u4E00\u9879"), next: t("\u4E0B\u4E00\u9879"), move: t("\u62D6\u52A8\u6807\u9898\u79FB\u52A8\u9762\u677F\uFF1B\u65B9\u5411\u952E\u5FAE\u8C03"), resize: t("\u62D6\u52A8\u53F3\u4E0B\u89D2\u8C03\u6574\u5927\u5C0F\uFF1B\u65B9\u5411\u952E\u5FAE\u8C03") };
      }
      module.exports = { translate, normalize, previewLabels, english };
    }
  });

  // src/reviewDiff.js
  var require_reviewDiff = __commonJS({
    "src/reviewDiff.js"(exports, module) {
      "use strict";
      function parts(patch, edits) {
        const before = [], after = [], inline = [], combined = [];
        let offset = 0;
        const push = (list, text, kind = "equal", previous = "") => {
          if (text) list.push({ text, kind, previous });
        };
        for (const edit of edits) {
          const from = edit.from - patch.from, to = edit.to - patch.from;
          if (from < offset || to < from || to > patch.expected.length || patch.expected.slice(from, to) !== edit.expected) throw new Error("invalid_display_diff");
          const equal2 = patch.expected.slice(offset, from);
          for (const list of [before, after, inline, combined]) push(list, equal2);
          push(combined, edit.expected, "removed");
          push(combined, edit.insert, "added");
          push(before, edit.expected, "removed");
          push(after, edit.insert, "added", edit.expected);
          if (edit.insert) push(inline, edit.insert, "added", edit.expected);
          else push(inline, edit.expected, "deletion");
          offset = to;
        }
        const equal = patch.expected.slice(offset);
        for (const list of [before, after, inline, combined]) push(list, equal);
        return { before, after, inline, combined };
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
      function compact(parts2, context = 45) {
        const changed = parts2.map((p, i) => p.kind === "equal" ? -1 : i).filter((i) => i >= 0);
        if (!changed.length) return parts2;
        const first = changed[0], last = changed[changed.length - 1];
        return parts2.map((p, i) => {
          if (p.kind !== "equal") return p;
          const chars = Array.from(p.text);
          let text = p.text;
          if (i < first && chars.length > context) text = "\u2026" + chars.slice(-context).join("");
          else if (i > last && chars.length > context) text = chars.slice(0, context).join("") + "\u2026";
          else if (i > first && i < last && chars.length > context * 2) text = chars.slice(0, context).join("") + " \u2026 " + chars.slice(-context).join("");
          return { ...p, text };
        });
      }
      module.exports = { parts, render, compact, css };
    }
  });

  // src/reviewKeyboard.js
  var require_reviewKeyboard = __commonJS({
    "src/reviewKeyboard.js"(exports, module) {
      "use strict";
      function action(event) {
        if (event.defaultPrevented || event.isComposing || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
        const path = event.composedPath?.() || [event.target];
        if (event.key === "Enter" && path.some((node) => node?.matches?.(".locate"))) return null;
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
        const below = belowRoom >= 210 || belowRoom >= aboveRoom;
        const height = Math.min(230, Math.max(210, below ? belowRoom : aboveRoom));
        const left = Math.max(bounds.left + 8, Math.min(target.left, bounds.right - width - 8));
        const top = below ? target.bottom + 8 : target.top - height - 8;
        return { left, top: Math.max(bounds.top + 8, Math.min(top, bounds.bottom - height - 8)), width, height };
      }
      module.exports = { reveal, panel, previewRect };
    }
  });

  // src/extensionRuntime.js
  var require_extensionRuntime = __commonJS({
    "src/extensionRuntime.js"(exports, module) {
      "use strict";
      var message = "\u6269\u5C55\u5DF2\u66F4\u65B0\u6216\u91CD\u65B0\u52A0\u8F7D\uFF0C\u5BA1\u9605\u5DF2\u505C\u6B62\u3002\u8BF7\u5237\u65B0 Overleaf \u9875\u9762\u540E\u7EE7\u7EED\uFF1B\u521A\u63A5\u53D7\u7684\u4FEE\u6539\u8BF7\u5148\u6838\u5BF9\u6B63\u6587\u3002";
      function create(getChrome, onInvalid = () => {
      }) {
        let invalid = false;
        const error = () => Object.assign(new Error(message), { code: "extension_invalidated" });
        function invalidate() {
          if (!invalid) {
            invalid = true;
            onInvalid();
          }
          return error();
        }
        function check() {
          if (invalid) throw error();
          try {
            if (getChrome()?.runtime?.id) return;
          } catch {
          }
          throw invalidate();
        }
        async function run(operation) {
          check();
          try {
            const result = await operation(getChrome());
            check();
            return result;
          } catch (cause) {
            if (cause?.code === "extension_invalidated" || /extension context invalidated/i.test(cause?.message || "")) throw invalidate();
            check();
            throw cause;
          }
        }
        return { check, message: (body) => run((chrome2) => chrome2.runtime.sendMessage(body)), storage: (method, value) => run((chrome2) => chrome2.storage.local[method](value)), get invalid() {
          return invalid;
        } };
      }
      module.exports = { create, message };
    }
  });

  // src/pageModal.js
  var require_pageModal = __commonJS({
    "src/pageModal.js"(exports, module) {
      "use strict";
      var selector = 'dialog[open],[aria-modal="true"],[role="dialog"],[role="alertdialog"],.modal,.modal-backdrop';
      var ownSelector = "[data-suggestion-importer],[data-codex-inline-review],[data-agent-review-marks]";
      function visible(node, window2) {
        if (!node.isConnected || node.hidden || node.getAttribute("aria-hidden") === "true" || !node.getClientRects().length) return false;
        const style = window2.getComputedStyle(node);
        return style.display !== "none" && style.visibility !== "hidden" && style.visibility !== "collapse";
      }
      function watch({ document: document2, window: window2, onChange }) {
        let blocked = null, frame = null, disposed = false, ancestors = /* @__PURE__ */ new Set();
        function check() {
          frame = null;
          if (disposed) return;
          const candidates = [...document2.querySelectorAll(selector)];
          ancestors = /* @__PURE__ */ new Set();
          for (const candidate of candidates) for (let node = candidate; node; node = node.parentElement) ancestors.add(node);
          const next = candidates.some((node) => !node.closest(ownSelector) && visible(node, window2));
          if (next !== blocked) {
            blocked = next;
            onChange(next);
          }
        }
        function relevant(node) {
          return node?.nodeType === 1 && !node.closest(ownSelector) && (ancestors.has(node) || node.matches(selector) || Boolean(node.querySelector(selector)));
        }
        const observer = new window2.MutationObserver((records) => {
          if (disposed || frame !== null) return;
          if (records.some((record) => record.type === "attributes" ? relevant(record.target) : [...record.addedNodes, ...record.removedNodes].some(relevant))) frame = window2.requestAnimationFrame(check);
        });
        observer.observe(document2.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "hidden", "open", "role", "aria-modal", "aria-hidden"] });
        check();
        return { blocked: () => blocked, dispose() {
          disposed = true;
          observer.disconnect();
          if (frame !== null) window2.cancelAnimationFrame(frame);
        } };
      }
      module.exports = { watch, visible };
    }
  });

  // src/content.js
  var Core = require_suggestions();
  var Runner = require_runner();
  var Navigation = require_navigation();
  var Floating = require_floatingPanel();
  var I18n = require_i18n();
  var Diff = require_reviewDiff();
  var Keyboard = require_reviewKeyboard();
  var Scroll = require_reviewScroll();
  var ExtensionRuntime = require_extensionRuntime();
  var PageModal = require_pageModal();
  if (!document.querySelector("[data-suggestion-importer]")) mount();
  function mount() {
    const host = document.createElement("div");
    host.dataset.suggestionImporter = "";
    host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483100;";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>
:host{font:13px/1.5 system-ui;color:#273342}*{box-sizing:border-box}button,textarea,input{font:inherit}button{border:1px solid #cdd6df;border-radius:6px;background:#fff;color:#273342;padding:7px 11px;cursor:pointer}button:disabled{opacity:.45;cursor:default}button:focus-visible,textarea:focus-visible{outline:3px solid #8aafe3;outline-offset:2px}.primary,.launch{background:#176347;color:#fff;border-color:#176347}.launch{box-shadow:0 4px 18px #18352925}.drawer{position:fixed;display:flex;flex-direction:column;overflow:hidden;background:#fff;border:1px solid #cbd5de;border-radius:10px;box-shadow:0 10px 40px #14253630;margin-bottom:10px}.head{padding:14px 16px;border-bottom:1px solid #e0e6ec;display:flex;align-items:center;justify-content:space-between}.head strong{font-size:15px}.head button{padding:3px 8px}.body{padding:16px 16px 26px;overflow:auto;min-height:0;flex:1}.head{flex-shrink:0;gap:12px}.head strong{flex:1}.language{font:inherit;border:1px solid #cdd6df;border-radius:5px;background:white;padding:3px}.muted{color:#657687;font-size:12px;margin:0 0 12px}.label{display:block;margin-bottom:6px;font-weight:600}textarea{display:block;width:100%;height:130px;padding:10px;border:1px solid #ccd7e0;border-radius:6px;resize:vertical;font:12px/1.45 ui-monospace,monospace}.toolbar{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.message{font-size:12px;padding:10px;background:#f0f5f4;border-radius:5px}.card{border:1px solid #d2dce4;border-radius:7px;padding:12px;margin-top:12px}.card strong{display:block}.path{font:11px/1.5 ui-monospace,monospace;color:#687888}.reason{font-size:12px;margin:8px 0}.comparison-label{font-weight:600;font-size:12px;margin:12px 0 6px}.context{font-size:12px;color:#657687;margin:14px 0}.context summary{cursor:pointer;padding:8px;border:1px solid #e0e6ec;border-radius:6px}.card{border:0;padding:0}.path{margin-top:4px}.reason{line-height:1.6}.session-toolbar{flex-wrap:wrap}.source{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.5 ui-monospace,monospace;margin:6px 0 10px;padding:8px;max-height:180px;overflow:auto;border-radius:4px}.old,.new{background:#f6f8fa;color:#586673}.actions{display:flex;gap:8px}.history{padding:8px 0;border-bottom:1px solid #e3e9ed;font-size:12px}.history b{color:#176347}.unknown{color:#9a452c}.session-toolbar{display:flex;justify-content:space-between;gap:8px;margin-bottom:12px}.history-details{margin-top:14px;font-size:12px;color:#657687}.footer{margin-top:14px;font-size:11px;color:#6b7b88}[hidden]{display:none!important}
${Floating.css}${Diff.css}</style><section class="drawer" hidden><div class="head"><strong>\u5BFC\u5165\u4FEE\u6539\u5EFA\u8BAE</strong><select class="language" aria-label="\u8BED\u8A00"><option value="zh-CN">\u4E2D\u6587</option><option value="en">English</option></select><button class="close" aria-label="\u6536\u8D77">\xD7</button></div><div class="body"><div class="session-toolbar" hidden><button class="compact">\u8FD4\u56DE\u7CBE\u7B80 \u2199</button><button class="back">\u5BA1\u9605\u7BA1\u7406</button><button class="continue" hidden>\u7EE7\u7EED\u5BA1\u9605</button><button class="stop" hidden>\u505C\u6B62</button></div><div class="setup-view"><p class="muted">\u5148\u5BFC\u5165\u5EFA\u8BAE\u5305\uFF0C\u518D\u9010\u9879\u786E\u8BA4\u3002\u6BCF\u6B21\u63A5\u53D7\u90FD\u4F1A\u641C\u7D22\u5F53\u524D\u539F\u6587\uFF1B\u8FC7\u65F6\u6216\u4E0D\u552F\u4E00\u7684\u9879\u81EA\u52A8\u8DF3\u8FC7\u3002</p><label class="label" for="pack">\u5EFA\u8BAE\u5305 JSON</label><textarea id="pack" spellcheck="false" placeholder="\u7C98\u8D34 Agent \u751F\u6210\u7684\u5EFA\u8BAE\u5305"></textarea><input type="file" accept=".json,application/json" hidden><div class="toolbar"><button class="connect">\u8FDE\u63A5 Agent</button><button class="disconnect">\u65AD\u5F00</button></div><div class="bridge-status" role="status"></div><input class="bridge-token" type="password" placeholder="\u672C\u5730\u8FDE\u63A5\u914D\u5BF9\u4EE4\u724C" autocomplete="off"><div class="toolbar"><button class="file">\u9009\u62E9 JSON \u6587\u4EF6</button><button class="primary start">\u5F00\u59CB\u5BA1\u9605</button><button class="resume">\u6062\u590D\u4E0A\u6B21\u5BA1\u9605</button><button class="reset">\u6E05\u9664\u8FDB\u5EA6</button></div><label class="label" for="review-scope">\u5BA1\u9605\u8303\u56F4</label><select id="review-scope"><option value="current">\u5F53\u524D\u6587\u4EF6\uFF08\u591A\u6807\u7B7E\u9875\uFF09</option><option value="all">\u5168\u90E8\u6587\u4EF6\uFF08\u5355\u6807\u7B7E\u9875\uFF09</option></select><p class="shared-summary muted" hidden></p><div class="setup-message message" role="status" aria-live="polite">\u7B49\u5F85\u5BFC\u5165\u5EFA\u8BAE\u5305</div></div><div class="review-view" hidden><div class="message review-message" role="status" aria-live="polite">\u7B49\u5F85\u5BFC\u5165\u5EFA\u8BAE\u5305</div><button class="repair" hidden>\u91CD\u65B0\u5EFA\u7ACB\u5B9A\u4F4D\uFF08\u4FDD\u7559\u51B3\u5B9A\uFF09</button><div class="pending"></div><details class="history-details"><summary>\u6700\u8FD1\u5904\u7406\u8BB0\u5F55</summary><div class="history-list"></div></details><p class="footer">\u5DF2\u5199\u5165\u8868\u793A\u7F16\u8F91\u5668\u5185\u5BB9\u5DF2\u6838\u9A8C\uFF0C\u670D\u52A1\u5668\u4FDD\u5B58\u9700\u5728 Overleaf \u68C0\u67E5\u3002\u53EF\u4F7F\u7528 Overleaf \u7684\u64A4\u9500\u6309\u94AE\u3002</p></div></div><button class="resize" aria-label="\u62D6\u52A8\u53F3\u4E0B\u89D2\u8C03\u6574\u5927\u5C0F\uFF1B\u65B9\u5411\u952E\u5FAE\u8C03" title="\u62D6\u52A8\u53F3\u4E0B\u89D2\u8C03\u6574\u5927\u5C0F\uFF1B\u65B9\u5411\u952E\u5FAE\u8C03"></button></section><button class="launch">\u5BFC\u5165\u4FEE\u6539\u5EFA\u8BAE</button>`;
    document.body.append(host);
    PageModal.watch({ document, window, onChange: (blocked) => {
      host.hidden = blocked;
    } });
    const $ = (selector) => shadow.querySelector(selector);
    const capability = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
    const persistent = typeof chrome !== "undefined" && !!chrome.runtime?.id;
    let contextLost = false, trackingFile = null, stopReason = null, reviewMode = "compact", presentCurrent = null, fullContext = false;
    const extension = ExtensionRuntime.create(() => typeof chrome === "undefined" ? null : chrome, onContextInvalidated);
    const runtime = { check: extension.check, storage: extension.storage, message: (body) => extension.message({ ...body, clientId: capability }) };
    let reviewLease = null, reviewFile = "", lastRenew = 0, sharedSummary = null, pendingBridgeStart = false;
    function showShared(value) {
      if (value) sharedSummary = value;
      if (!sharedSummary) return;
      for (const node of shadow.querySelectorAll(".shared-summary")) {
        node.hidden = false;
        setUI(node, "\u9879\u76EE\u5DF2\u786E\u8BA4 " + sharedSummary.confirmed + " / " + sharedSummary.total);
      }
    }
    async function renew(force = false) {
      if (!persistent || !reviewLease) return null;
      if (!force && Date.now() - lastRenew < 5e3) return null;
      const response = await runtime.message({ type: "reviewRenew", lease: reviewLease });
      if (!response.ok) throw Object.assign(new Error(response.error), { code: response.code || "review_lease_lost" });
      lastRenew = Date.now();
      showShared(response.summary);
      return response;
    }
    if (persistent) chrome.runtime.onMessage.addListener((event, sender) => {
      if (sender.id !== chrome.runtime.id || event.type !== "reviewShared" || event.clientId !== capability || event.projectId !== location.pathname.match(/^\/project\/([a-f\d]{24})(?:\/|$)/i)?.[1]) return;
      showShared(event.summary);
    });
    let language = "zh-CN", languageTouched = false, packLabel = null, reviewLanguageRefresh = null;
    function setPackLabel(text) {
      packLabel = text;
      $("#pack").value = t(text);
    }
    const uiText = /* @__PURE__ */ new Map(), uiAttributes = /* @__PURE__ */ new Map();
    const t = (text) => I18n.translate(text, language);
    function setUI(node, text) {
      uiText.set(node, text);
      node.textContent = t(text);
    }
    function rememberUI(root) {
      for (const [node] of uiText) if (!node.isConnected) uiText.delete(node);
      const walk = (node) => {
        if (node.nodeType === 3 && /[\u3400-\u9fff]/.test(node.textContent)) setUI(node, node.textContent);
        else for (const child of node.childNodes) walk(child);
      };
      walk(root);
      for (const node of root.querySelectorAll("[placeholder],[aria-label],[title]")) {
        const attributes = {};
        for (const name of ["placeholder", "aria-label", "title"]) if (node.hasAttribute(name)) attributes[name] = node.getAttribute(name);
        uiAttributes.set(node, attributes);
      }
      refreshUI();
    }
    function refreshUI() {
      for (const [node, text] of uiText) {
        if (node.isConnected) node.textContent = t(text);
        else uiText.delete(node);
      }
      for (const [node, attributes] of uiAttributes) {
        if (!node.isConnected) {
          uiAttributes.delete(node);
          continue;
        }
        for (const [name, text] of Object.entries(attributes)) node.setAttribute(name, t(text));
      }
      shadow.host.lang = language;
      if (packLabel) $("#pack").value = t(packLabel);
    }
    rememberUI(shadow);
    $(".head").setAttribute("aria-label", "\u62D6\u52A8\u6807\u9898\u79FB\u52A8\u9762\u677F\uFF1B\u65B9\u5411\u952E\u5FAE\u8C03");
    $(".head").title = "\u62D6\u52A8\u6807\u9898\u79FB\u52A8\u9762\u677F\uFF1B\u65B9\u5411\u952E\u5FAE\u8C03";
    uiAttributes.set($(".head"), { "aria-label": $(".head").getAttribute("aria-label"), title: $(".head").title });
    const floating = Floating.attach({ panel: $(".drawer"), drag: $(".head"), resize: $(".resize"), window, minimum: { width: 300, height: 220 }, defaultRect: () => ({ left: window.innerWidth - 406, top: Math.max(16, window.innerHeight - Math.min(600, window.innerHeight * 0.85) - 60), width: 390, height: Math.min(600, window.innerHeight * 0.85) }) });
    floating.layout();
    $(".setup-view").append($(".history-details"), $(".footer"));
    let screen = "setup";
    function showScreen(next) {
      const changed = screen !== next;
      screen = next;
      $(".setup-view").hidden = screen !== "setup";
      $(".review-view").hidden = screen !== "review";
      $(".session-toolbar").hidden = screen === "setup" && !running;
      $(".back").hidden = screen !== "review";
      $(".compact").hidden = screen !== "review" || !running;
      $(".continue").hidden = screen !== "setup" || !running;
      setUI($(".head strong"), screen === "review" ? "\u5EFA\u8BAE\u8BE6\u60C5" : "\u5BFC\u5165\u4FEE\u6539\u5EFA\u8BAE");
      if (changed) $(".body").scrollTop = 0;
      if (presentCurrent && screen === "setup") presentCurrent("setup").catch((error) => status(error.message));
    }
    let startEpoch = 0, sessionActive = false, reconcileReview = null, decisionUpdates = [];
    let bridgeRevision = 0, bridgeEnabled = false, bridgeBusy = false, bridgeResults = [];
    let importedPack = null, initialized = null, running = false, starting = false, owner = "", cancelled = false, pendingAbort = null;
    function send(method, params) {
      const id = crypto.randomUUID();
      return new Promise((resolve, reject) => {
        const handler = (event) => {
          if (event.source !== window || event.origin !== location.origin || event.data?.channel !== "codex-suggestions:response" || event.data.id !== id || event.data.capability !== capability) return;
          cleanup();
          resolve(event.data.result);
        };
        const timer = setTimeout(() => {
          cleanup();
          reject(Object.assign(new Error(t("\u9875\u9762\u8FDE\u63A5\u8D85\u65F6")), { code: "bridge_timeout" }));
        }, method === "prepare" ? 25e3 : 8e3);
        function cleanup() {
          clearTimeout(timer);
          window.removeEventListener("message", handler);
        }
        window.addEventListener("message", handler);
        window.postMessage({ channel: "codex-suggestions:request", id, capability, method, params }, location.origin);
      });
    }
    async function call(method, params) {
      if (persistent && method !== "cancel") {
        runtime.check();
        if (sessionActive) {
          const ready = await renew(method === "apply");
          if (method === "apply") params = { ...params, notAfter: ready?.notAfter };
        }
        if (method === "apply") {
          const ready = await runtime.message({ type: "ping" });
          if (!ready?.ok) throw new Error("\u65E0\u6CD5\u8FDE\u63A5\u6269\u5C55");
          runtime.check();
        }
      }
      if (!initialized) initialized = send("hello", {});
      const handshake = await initialized;
      if (!handshake.ok) throw new Error("\u65E0\u6CD5\u8FDE\u63A5\u9875\u9762");
      if (persistent && method !== "cancel") runtime.check();
      const result = await send(method, params);
      if (persistent && sessionActive && result.journal?.length) {
        const saved = await runtime.message({ type: "progress", journal: result.journal, lease: reviewLease });
        if (!saved.ok) throw Object.assign(new Error("\u4FDD\u5B58\u5B9A\u4F4D\u8BB0\u5F55\u5931\u8D25\uFF1A" + saved.error), { code: saved.code || "review_lease_lost" });
        showShared(saved.summary);
      }
      const updates = (result.journal || []).flatMap((entry) => entry.decisions || []);
      if (updates.length) {
        if (reconcileReview) reconcileReview(updates);
        else decisionUpdates.push(...updates);
      }
      return result;
    }
    const assertCurrent = () => {
      const current = location.pathname.match(/^\/project\/([a-f\d]{24})(?:\/|$)/i)?.[1];
      if (cancelled || current !== owner) throw Object.assign(new Error("\u5DF2\u505C\u6B62"), { code: cancelled ? "cancelled" : "project_changed" });
    };
    const status = (text) => {
      const value = contextLost ? ExtensionRuntime.message : text;
      $(".review-message").hidden = !contextLost && ["\u539F\u6587\u5DF2\u5728\u6E90\u7801\u4E2D\u9AD8\u4EAE\uFF0C\u7B49\u5F85\u786E\u8BA4", "\u6B63\u6587\u6709\u53D8\u5316\uFF0C\u5DF2\u91CD\u65B0\u5B9A\u4F4D\u8FD9\u4E00\u9879\uFF0C\u7B49\u5F85\u786E\u8BA4", "\u5F53\u524D\u9879\u5DF2\u5199\u5165\u7F16\u8F91\u5668\uFF0C\u7EE7\u7EED\u6838\u5BF9\u4E0B\u4E00\u9879", "\u6B63\u5728\u51C6\u5907\u5BA1\u9605\u2026"].includes(value);
      setUI($(".setup-message"), value);
      setUI($(".review-message"), value);
    };
    function lockInvalidContext() {
      $(".drawer").hidden = false;
      floating.layout();
      shadow.querySelectorAll(".setup-view button,.pending button,.stop,.continue,.compact,.language,.repair").forEach((node) => {
        node.disabled = true;
      });
      $("#pack").disabled = true;
      status(ExtensionRuntime.message);
      setUI($(".bridge-status"), ExtensionRuntime.message);
    }
    function onContextInvalidated() {
      contextLost = true;
      ++startEpoch;
      cancelled = true;
      bridgeEnabled = false;
      sessionActive = false;
      pendingAbort?.();
      if (initialized) send("cancel", {}).catch(() => {
      });
      lockInvalidContext();
    }
    async function changeLanguage(value) {
      language = I18n.normalize(value);
      $(".language").value = language;
      refreshUI();
      reviewLanguageRefresh?.();
      await call("language", { language }).catch(() => {
      });
    }
    $(".language").addEventListener("change", () => {
      languageTouched = true;
      changeLanguage($(".language").value);
      if (persistent) runtime.storage("set", { reviewLanguage: language }).catch((error) => status(error.message));
    });
    if (persistent) runtime.storage("get", "reviewLanguage").then((saved) => {
      if (!languageTouched) changeLanguage(saved.reviewLanguage || "zh-CN");
    }).catch(() => {
    });
    function review(item, prepared, options, itemAt, catalogId) {
      return new Promise((resolve, reject) => {
        let token = prepared.token, settled = false, timer = null, navigating = false, staleCode = null, statusRequest = null, suspended = Boolean(prepared.suspended);
        async function check() {
          if (statusRequest) return statusRequest;
          statusRequest = call("status", { token, projectId: owner });
          try {
            return await statusRequest;
          } finally {
            statusRequest = null;
          }
        }
        const card = document.createElement("section");
        card.className = "card";
        card.setAttribute("aria-label", "\u5EFA\u8BAE\u8BE6\u60C5");
        card.innerHTML = '<strong></strong><p class="shared-summary muted" hidden></p><div class="path"></div><div class="comparison-label">\u4FEE\u6539\u7406\u7531</div><p class="reason"></p><div class="comparison-label">\u4FEE\u6539\u5BF9\u6BD4</div><pre class="source combined"></pre><details class="context"><summary>\u67E5\u770B\u5B8C\u6574\u4E0A\u4E0B\u6587</summary><div>\u539F\u6587 \xB7 \u6807\u51FA\u5220\u9664</div><pre class="source old"></pre><div>\u4FEE\u6539\u540E \xB7 \u6807\u51FA\u65B0\u589E</div><pre class="source new"></pre></details><div class="toolbar navigation"><button class="previous">\u4E0A\u4E00\u9879</button><button class="next">\u4E0B\u4E00\u9879</button><button class="cursor-previous">\u5149\u6807\u4E0A\u4E00\u5904</button><button class="cursor-next">\u5149\u6807\u4E0B\u4E00\u5904</button></div><div class="actions"><button class="reject">\u62D2\u7EDD\u8FD9\u4E00\u9879</button><button class="primary accept">\u63A5\u53D7\u8FD9\u4E00\u9879</button></div>';
        $(".pending").replaceChildren(card);
        rememberUI(card);
        showShared();
        const context = card.querySelector(".context"), comparison = card.querySelector(".combined"), comparisonLabel = comparison.previousElementSibling;
        function contextPerspective() {
          if (!card.isConnected) return;
          fullContext = context.open;
          comparison.hidden = fullContext;
          comparisonLabel.hidden = fullContext;
          setUI(context.querySelector("summary"), fullContext ? "\u8FD4\u56DE\u7B80\u6D01\u5BF9\u6BD4" : "\u67E5\u770B\u5B8C\u6574\u4E0A\u4E0B\u6587");
        }
        context.open = fullContext;
        contextPerspective();
        context.addEventListener("toggle", contextPerspective);
        const locate = document.createElement("button");
        locate.className = "locate";
        locate.hidden = !suspended;
        setUI(locate, "\u5B9A\u4F4D\u5F53\u524D\u9879");
        card.querySelector(".navigation").prepend(locate);
        locate.addEventListener("click", () => {
          if (!settled && !navigating) {
            assertCurrent();
            finish(void 0, void 0, options.index);
          }
        });
        const renderCount = () => {
          const node = card.querySelector("strong"), text = "\u5EFA\u8BAE " + options.position + " / " + options.remaining;
          if (node.textContent !== t(text)) setUI(node, text);
        };
        renderCount();
        card.querySelector(".path").textContent = item.file + " \xB7 L" + prepared.line + " \xB7 #" + ((item.sourceIndex ?? options.index) + 1);
        card.querySelector(".reason").textContent = item.reason;
        let displayed = prepared, lastPresentation = null;
        function renderDiff() {
          const labels = { added: t("\u65B0\u589E"), removed: t("\u5220\u9664"), replaced: t("\u66FF\u6362\u539F\u6587"), empty: t("\uFF08\u5220\u9664\u6B64\u6BB5\uFF09") };
          if (displayed.diff) {
            Diff.render(card.querySelector(".combined"), Diff.compact(displayed.diff.combined || displayed.diff.inline, 80), labels);
            Diff.render(card.querySelector(".old"), displayed.diff.before, labels);
            Diff.render(card.querySelector(".new"), displayed.diff.after, labels);
          } else {
            card.querySelector(".combined").textContent = displayed.item?.replacement ?? item.replacement;
            card.querySelector(".old").textContent = displayed.item?.original || item.original;
            card.querySelector(".new").textContent = displayed.item?.replacement ?? item.replacement;
          }
        }
        renderDiff();
        const help = document.createElement("p");
        help.className = "muted keyboard-help";
        setUI(help, "\u2191 \u4E0A\u4E00\u9879 \xB7 \u2193 \u4E0B\u4E00\u9879 \xB7 Enter \u63A5\u53D7\uFF08\u5BA1\u9605\u5361\u7247\u5185\uFF09");
        card.append(help);
        const refresh = () => {
          renderDiff();
          card.setAttribute("aria-label", t("\u5EFA\u8BAE\u8BE6\u60C5"));
        };
        reviewLanguageRefresh = refresh;
        status(prepared.inline ? "\u539F\u6587\u5DF2\u5728\u6E90\u7801\u4E2D\u9AD8\u4EAE\uFF0C\u7B49\u5F85\u786E\u8BA4" : "\u9AD8\u4EAE\u6682\u4E0D\u53EF\u7528\uFF0C\u8BF7\u5728\u6B64\u6838\u5BF9\u539F\u6587\u4E0E\u5EFA\u8BAE");
        async function present(mode, focus = false) {
          if (settled) return;
          if (mode !== "setup") {
            const current = await check();
            if (settled) return;
            update(current);
          }
          if (mode !== "setup") {
            reviewMode = mode === "compact" && displayed.inline && !staleCode ? "compact" : "details";
            mode = reviewMode;
            showScreen("review");
          }
          const state = { mode, position: options.position, remaining: options.remaining };
          const response = await call("presentation", { ...state, token, projectId: owner, focus });
          if (settled) return;
          if (!response.ok) {
            lastPresentation = null;
            return;
          }
          lastPresentation = JSON.stringify({ ...state, token });
          $(".drawer").hidden = mode === "compact";
          if (mode === "details") {
            floating.layout();
            if (focus) card.focus({ preventScroll: true });
          }
          $(".compact").disabled = suspended || !displayed.inline || Boolean(staleCode);
          setUI($(".launch"), mode === "compact" ? "\u8BE6\u60C5 \u2197" : "\u5BFC\u5165\u4FEE\u6539\u5EFA\u8BAE");
        }
        presentCurrent = present;
        function finish(accepted, skipped, navigate2) {
          if (settled) return;
          fullContext = context.open;
          settled = true;
          clearTimeout(timer);
          pendingAbort = null;
          if (presentCurrent === present) presentCurrent = null;
          if (reviewLanguageRefresh === refresh) reviewLanguageRefresh = null;
          card.querySelectorAll("button").forEach((button) => {
            button.disabled = true;
          });
          resolve({ accepted, skipped, token, navigate: navigate2 });
        }
        async function navigate(direction, fromCursor) {
          if (settled || navigating) return;
          navigating = true;
          clearTimeout(timer);
          card.querySelectorAll("button").forEach((button) => {
            button.disabled = true;
          });
          try {
            assertCurrent();
            const current = await check();
            if (settled) return;
            if (!current.ok && !["original_missing", "already_applied", "ambiguous_match", "scope_missing", "ambiguous_scope", "overlapping_change", "position_mismatch", "no_change", "diff_too_complex"].includes(current.code)) {
              finish(false, current.code);
              return;
            }
            update(current);
            let target;
            if (!fromCursor) {
              const checked = /* @__PURE__ */ new Set([options.index]);
              target = options.index;
              do {
                target = Navigation.adjacent(target, options.total, direction, (index) => options.isPending(index) && !checked.has(index));
                if (target === null) break;
                checked.add(target);
              } while (options.isDecided(await itemAt(target)));
            } else {
              status("\u6B63\u5728\u6309\u5F53\u524D\u5149\u6807\u67E5\u627E\u5EFA\u8BAE\u2026");
              const excludedIndexes = [];
              for (let i = 0; i < options.total; i++) if (!options.isPending(i)) excludedIndexes.push(i);
              const scan = await call("navigation", { projectId: owner, catalogId, direction, currentIndex: options.index, excludedIndexes });
              if (!scan.ok) throw new Error(scan.code);
              let best = null;
              for (let index = 0; !scan.cached && index < options.total; ) {
                if (settled) return;
                assertCurrent();
                const items = [];
                let bytes = 0;
                while (index < options.total && items.length < 128) {
                  const position = index++;
                  if (!options.isPending(position)) continue;
                  const candidate = await itemAt(position);
                  if (candidate.file === scan.file && !options.isDecided(candidate)) {
                    items.push({ index: position, item: candidate });
                    bytes += JSON.stringify(candidate).length;
                    if (bytes >= 131072) break;
                  }
                }
                let offset = 0;
                while (offset < items.length) {
                  if (settled) return;
                  assertCurrent();
                  const response = await call("navigation", { projectId: owner, scanId: scan.scanId, items: items.slice(offset) });
                  if (!response.ok) throw new Error(response.code);
                  offset += response.processed;
                  const candidates = best ? [best, ...response.matches] : response.matches;
                  const nearest = Navigation.nearest(candidates, scan.cursor, direction, options.index);
                  best = candidates.find((match) => match.index === nearest) || null;
                }
              }
              const check2 = await call("navigation", { projectId: owner, scanId: scan.scanId, items: [], complete: !scan.cached });
              if (!check2.ok) throw new Error(check2.code);
              target = scan.cached ? scan.target : best?.index ?? null;
            }
            if (settled) return;
            if (target !== null) {
              finish(void 0, staleCode, target);
              return;
            }
            status(fromCursor ? "\u5F53\u524D\u6587\u4EF6\u7684\u5149\u6807\u8FD9\u4E00\u4FA7\u6CA1\u6709\u53EF\u5B9A\u4F4D\u7684\u5F85\u5904\u7406\u5EFA\u8BAE" : "\u6CA1\u6709\u5176\u4ED6\u5F85\u5904\u7406\u5EFA\u8BAE\uFF1B\u5F53\u524D\u9879\u4ECD\u7B49\u5F85\u786E\u8BA4");
          } catch (error) {
            if (!settled) status(error.message === "review_file_mismatch" ? "\u672C\u9875\u53EA\u5BA1\u9605\u5F00\u59CB\u65F6\u7684\u6587\u4EF6\uFF1B\u8BF7\u5B9A\u4F4D\u5F53\u524D\u9879\uFF0C\u6216\u505C\u6B62\u540E\u5728\u65B0\u6587\u4EF6\u5F00\u59CB\u5BA1\u9605" : error.message === "navigation_changed" ? "\u6B63\u6587\u3001\u6587\u4EF6\u6216\u5149\u6807\u6709\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u5BFC\u822A" : "\u5BFC\u822A\u672A\u5B8C\u6210\uFF1A" + error.message);
          } finally {
            navigating = false;
            if (!settled) {
              card.querySelectorAll("button").forEach((button) => {
                button.disabled = Boolean((suspended || staleCode) && button.classList.contains("accept"));
              });
              timer = setTimeout(poll, 300);
            }
          }
        }
        card.querySelector(".previous").addEventListener("click", () => navigate(-1, false));
        card.querySelector(".next").addEventListener("click", () => navigate(1, false));
        card.querySelector(".cursor-previous").addEventListener("click", () => navigate(-1, true));
        card.querySelector(".cursor-next").addEventListener("click", () => navigate(1, true));
        async function accept() {
          if (settled || navigating) return;
          try {
            const response = await check();
            if (settled || navigating) return;
            update(response);
            if (response.ok && !suspended) finish(true);
          } catch (error) {
            if (!settled) finish(false, error.code || "bridge_failed");
          }
        }
        card.querySelector(".accept").addEventListener("click", accept);
        card.querySelector(".reject").addEventListener("click", () => finish(false, staleCode));
        Keyboard.attach(card, (choice) => {
          if (settled || navigating) return;
          if (choice === "accept") {
            if (!staleCode && !suspended) accept();
          } else navigate(choice === "previous" ? -1 : 1, false);
        });
        if (reviewMode === "details") Scroll.panel($(".body"), card);
        pendingAbort = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            if (presentCurrent === present) presentCurrent = null;
            reject(Object.assign(new Error("\u5DF2\u505C\u6B62"), { code: "cancelled" }));
          }
        };
        function update(response) {
          renderCount();
          suspended = response.suspended === true;
          locate.hidden = !suspended;
          card.querySelector(".accept").disabled = suspended || Boolean(!response.ok);
          $(".compact").disabled = suspended || !displayed.inline || Boolean(staleCode);
          if (suspended) {
            status("\u5DF2\u5207\u6362\u6587\u4EF6\uFF0C\u5F53\u524D\u5EFA\u8BAE\u4E0E\u8FDB\u5EA6\u4FDD\u7559\u3002\u53EF\u81EA\u7531\u7F16\u8F91\uFF0C\u70B9\u51FB\u5B9A\u4F4D\u5F53\u524D\u9879\u6216\u5BA1\u9605\u5BFC\u822A\u7EE7\u7EED\u3002");
            return;
          }
          if (response.refreshed) {
            displayed = response;
            renderDiff();
            token = response.token;
            staleCode = null;
            card.querySelector(".accept").disabled = false;
            card.querySelector(".path").textContent = item.file + " \xB7 L" + response.line + " \xB7 #" + ((item.sourceIndex ?? options.index) + 1);
            status("\u6B63\u6587\u6709\u53D8\u5316\uFF0C\u5DF2\u91CD\u65B0\u5B9A\u4F4D\u8FD9\u4E00\u9879\uFF0C\u7B49\u5F85\u786E\u8BA4");
          } else if (!response.ok) staleCode = response.code;
        }
        async function poll() {
          if (settled) return;
          try {
            assertCurrent();
            const response = await check();
            if (settled || navigating) return;
            update(response);
            if (response.suspended) {
              timer = setTimeout(poll, 300);
              return;
            }
            if (!response.ok) {
              if (["original_missing", "already_applied", "ambiguous_match", "scope_missing", "ambiguous_scope", "overlapping_change", "position_mismatch", "no_change", "diff_too_complex"].includes(response.code)) {
                staleCode = response.code;
                card.querySelector(".accept").disabled = true;
                await present("details");
                status("\u5F53\u524D\u539F\u6587\u5DF2\u53D8\u5316\uFF0C\u6B64\u9879\u5DF2\u5931\u6548\uFF1B\u53EF\u7EE7\u7EED\u7F16\u8F91\uFF0C\u70B9\u51FB\u5BFC\u822A\u540E\u8DF3\u8FC7");
                timer = setTimeout(poll, 300);
                return;
              }
              finish(false, response.code);
              return;
            }
            const displayMode = screen === "setup" ? "setup" : reviewMode;
            const signature = JSON.stringify({ mode: displayMode, position: options.position, remaining: options.remaining, token });
            if (response.presentation === "details") await present("details", true);
            else if (signature !== lastPresentation) await present(displayMode);
            if (settled) return;
            if (response.navigation === -1 || response.navigation === 1) {
              await navigate(response.navigation, false);
              return;
            } else if (typeof response.decision === "boolean") {
              finish(response.decision);
              return;
            }
            timer = setTimeout(poll, 300);
          } catch (error) {
            finish(false, error.code || "bridge_failed");
          }
        }
        poll();
      });
    }
    let historyMessages = [], historyFrame = null;
    function renderHistory() {
      if (historyFrame !== null) return;
      historyFrame = requestAnimationFrame(() => {
        historyFrame = null;
        $(".history-list").replaceChildren(...historyMessages.map((text) => {
          const row = document.createElement("div");
          row.className = "history";
          setUI(row, text);
          return row;
        }));
        refreshUI();
      });
    }
    async function record(result) {
      if (persistent && ["written", "rejected", "unknown"].includes(result.state)) {
        const saved = await runtime.message({ type: "progress", lease: reviewLease, decision: { reviewKey: result.item.reviewKey, state: result.state, code: result.code } });
        if (!saved.ok) throw Object.assign(new Error("\u4FDD\u5B58\u5BA1\u9605\u51B3\u5B9A\u5931\u8D25\uFF1A" + saved.error), { code: saved.code || "review_lease_lost" });
        showShared(saved.summary);
      }
      if (bridgeRevision) bridgeResults.push({ revision: bridgeRevision, id: result.item.id, state: result.state, code: result.code });
      if ($(".pending").firstChild) $(".pending").replaceChildren();
      const word = result.state === "written" ? "\u5DF2\u5199\u5165" : result.state === "rejected" ? "\u5DF2\u62D2\u7EDD" : result.state === "unknown" ? "\u5199\u5165\u672A\u786E\u8BA4" : Core.skipped[result.code] || "\u5DF2\u8DF3\u8FC7\uFF1A" + result.code;
      historyMessages.push(result.item.file + " \xB7 \u4FEE\u6539 " + result.item.id + "\uFF1A" + word);
      if (historyMessages.length > 100) historyMessages.shift();
      renderHistory();
      if (result.state === "written") status("\u5F53\u524D\u9879\u5DF2\u5199\u5165\u7F16\u8F91\u5668\uFF0C\u7EE7\u7EED\u6838\u5BF9\u4E0B\u4E00\u9879");
    }
    async function parseInput(input) {
      if (!persistent) return Core.parsePack(input);
      let response;
      if (input?.ref) return input;
      if (typeof input === "string" && input.length > 262144) {
        const uploadId = crypto.randomUUID();
        let index = 0;
        for (let from = 0; from < input.length; from += 262144) {
          response = await runtime.message({ type: "parseChunk", uploadId, index: index++, chunk: input.slice(from, from + 262144), last: from + 262144 >= input.length });
          if (!response.ok) throw new Error(response.error);
        }
      } else response = await runtime.message({ type: "parse", input });
      if (!response.ok) throw new Error(response.error);
      return response.pack;
    }
    async function start() {
      if (contextLost || running || starting) return;
      const epoch = ++startEpoch;
      starting = true;
      $(".start").disabled = true;
      trackingFile = null;
      $(".repair").hidden = true;
      status("\u6B63\u5728\u51C6\u5907\u5BA1\u9605\u2026");
      let pack, session = { decisions: {}, ledgers: {} };
      try {
        pack = await parseInput(importedPack || $("#pack").value);
        const current = await call("project", {});
        if (!current.ok || !current.projectId) throw new Error("\u8BF7\u5148\u6253\u5F00 Overleaf \u9879\u76EE");
        if (pack.projectId && pack.projectId !== current.projectId) throw new Error("\u5EFA\u8BAE\u5305\u5C5E\u4E8E\u5176\u4ED6\u9879\u76EE\uFF0C\u6CA1\u6709\u5199\u5165");
        if (epoch !== startEpoch) throw new Error("\u5EFA\u8BAE\u5DF2\u66F4\u65B0\u6216\u5BA1\u9605\u5DF2\u505C\u6B62");
        reviewFile = $("#review-scope").value === "current" ? current.file : "";
        if ($("#review-scope").value === "current" && !reviewFile) throw new Error("\u6E90\u7801\u7F16\u8F91\u5668\u672A\u5C31\u7EEA");
        if (persistent) {
          session = await runtime.message({ type: "session", pack, acquire: true, file: reviewFile });
          if (!session.ok) throw Object.assign(new Error(session.error), { code: session.code });
          reviewLease = session.lease;
          lastRenew = Date.now();
          showShared(session.summary);
          pack = session.reviewPack || session.pack;
        } else if (reviewFile) {
          pack = { ...pack, suggestions: pack.suggestions.flatMap((item, index) => item.file === reviewFile ? [{ ...item, sourceIndex: index }] : []) };
          if (!pack.suggestions.length) throw new Error("\u5F53\u524D\u6587\u4EF6\u6CA1\u6709\u5BA1\u9605\u5EFA\u8BAE\uFF0C\u8BF7\u5207\u6362\u6587\u4EF6\u6216\u9009\u62E9\u5168\u90E8\u6587\u4EF6");
        }
        if (epoch !== startEpoch) throw new Error("\u5EFA\u8BAE\u5DF2\u66F4\u65B0\u6216\u5BA1\u9605\u5DF2\u505C\u6B62");
        owner = current.projectId;
        sessionActive = true;
      } catch (error) {
        if (error.code === "review_pack_busy" && bridgeEnabled) pendingBridgeStart = true;
        if (reviewLease) {
          await runtime.message({ type: "reviewRelease", lease: reviewLease }).catch(() => {
          });
          reviewLease = null;
        }
        status(error.message);
        starting = false;
        $(".start").disabled = contextLost;
        return;
      }
      running = true;
      starting = false;
      cancelled = false;
      stopReason = null;
      pendingBridgeStart = false;
      $("#review-scope").disabled = true;
      $(".start").disabled = true;
      $(".resume").disabled = true;
      $(".reset").disabled = true;
      $(".file").disabled = true;
      $("#pack").disabled = true;
      $(".stop").hidden = false;
      historyMessages = [];
      $(".history-list").replaceChildren();
      $(".history-details").open = false;
      showScreen("review");
      $(".drawer").hidden = reviewMode === "compact";
      try {
        decisionUpdates = [];
        await call("begin", { ledgers: session.ledgers, mode: reviewMode, file: reviewFile });
        const catalogId = crypto.randomUUID();
        let itemBuffer = [], bufferStart = -1;
        const itemAt = persistent ? async (index) => {
          if (index < bufferStart || index >= bufferStart + itemBuffer.length) {
            const fetched = await runtime.message({ type: "items", ref: pack.ref, index });
            if (!fetched.ok) throw new Error(fetched.error);
            bufferStart = index;
            itemBuffer = fetched.items;
          }
          return itemBuffer[index - bufferStart];
        } : async (index) => pack.suggestions[index];
        const results = await Runner.run(pack, { projectId: owner, assertCurrent, call, presentation: (state) => ({ mode: reviewMode, ...state }), observe: (fn) => {
          reconcileReview = fn;
          if (fn && decisionUpdates.length) {
            const updates = decisionUpdates;
            decisionUpdates = [];
            fn(updates);
          }
        }, review: (item, prepared, options) => review(item, prepared, options, itemAt, catalogId), record, initialCounts: session.initialCounts, decidedIndexes: session.decidedIndexes, decisionIndexes: session.decisionIndexes, decisions: session.decisions, itemAt, retained: (result) => {
          if (bridgeRevision) bridgeResults.push({ revision: bridgeRevision, id: result.item.id, state: result.state, code: "retained_decision" });
        } });
        const count = (state) => results.filter((result) => result.state === state).length;
        $(".drawer").hidden = false;
        floating.layout();
        status("\u5BA1\u9605\u7ED3\u675F\uFF1A\u5199\u5165 " + count("written") + " \u9879\uFF0C\u62D2\u7EDD " + count("rejected") + " \u9879\uFF0C\u8DF3\u8FC7 " + count("skipped") + " \u9879\uFF0C\u4FDD\u7559\u5148\u524D\u51B3\u5B9A " + count("retained") + " \u9879\u3002");
      } catch (error) {
        $(".drawer").hidden = false;
        floating.layout();
        if (error.code === "tracking_out_of_sync") {
          trackingFile = error.file;
          $(".repair").hidden = false;
          status("\u5B9A\u4F4D\u8BB0\u5F55\u4E0E\u5F53\u524D\u6B63\u6587\u4E0D\u4E00\u81F4\uFF0C\u5BA1\u9605\u5DF2\u6682\u505C\u3002\u53EF\u91CD\u65B0\u5EFA\u7ACB\u5B9A\u4F4D\uFF0C\u4FDD\u7559\u63A5\u53D7\uFF0F\u62D2\u7EDD\u51B3\u5B9A\u3002");
        } else if (error.code === "review_lease_lost") status("\u6807\u7B7E\u9875\u5BA1\u9605\u6743\u9650\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u5F00\u59CB\u5BA1\u9605");
        else if (error.code === "cancelled") status(stopReason === "update" ? "\u6B63\u5728\u8F7D\u5165\u65B0\u7248\u672C\u5EFA\u8BAE\u2026" : "\u5BA1\u9605\u5DF2\u505C\u6B62\uFF0C\u53EF\u8FD4\u56DE\u5BFC\u5165\u540E\u7EE7\u7EED");
        else status(error.code === "write_unconfirmed" ? "\u5199\u5165\u7ED3\u679C\u672A\u786E\u8BA4\uFF0C\u5DF2\u505C\u6B62\u3002\u8BF7\u68C0\u67E5\u5F53\u524D\u6B63\u6587\uFF0C\u4E0D\u8981\u91CD\u590D\u63A5\u53D7\u3002" : "\u5BA1\u9605\u5DF2\u505C\u6B62\uFF1A" + (error.code || error.message));
      } finally {
        pendingAbort?.();
        pendingAbort = null;
        await call("cancel", {}).catch(() => {
        });
        sessionActive = false;
        if (reviewLease) {
          await runtime.message({ type: "reviewRelease", lease: reviewLease }).catch(() => {
          });
          reviewLease = null;
        }
        $("#review-scope").disabled = false;
        $(".pending").replaceChildren();
        reviewLanguageRefresh = null;
        presentCurrent = null;
        running = false;
        setUI($(".launch"), "\u5BFC\u5165\u4FEE\u6539\u5EFA\u8BAE");
        $(".start").disabled = false;
        $(".resume").disabled = false;
        $(".reset").disabled = false;
        $(".file").disabled = false;
        $("#pack").disabled = false;
        $(".stop").hidden = true;
        showScreen(screen);
        if (contextLost) lockInvalidContext();
      }
    }
    const bridgeMessage = (message) => runtime.message(message);
    $(".connect").addEventListener("click", async () => {
      if (!persistent) {
        status("\u672C\u5730\u8FDE\u63A5\u9700\u8981\u5728 Chrome \u6269\u5C55\u4E2D\u4F7F\u7528");
        return;
      }
      const result = await bridgeMessage({ type: "connect", token: $(".bridge-token").value }).catch((e) => ({ error: e.message }));
      if (!result.ok) {
        setUI($(".bridge-status"), result.error);
        return;
      }
      $(".bridge-token").value = "";
      bridgeEnabled = true;
      setUI($(".bridge-status"), "\u5DF2\u8FDE\u63A5\uFF1AAgent \u8BF7\u6C42\u65F6\u624D\u8BFB\u53D6\u6E90\u7801\uFF1B\u65B0\u5EFA\u8BAE\u7B49\u5F85\u9010\u9879\u786E\u8BA4");
      pollBridge();
    });
    $(".disconnect").addEventListener("click", async () => {
      bridgeEnabled = false;
      try {
        if (persistent) await bridgeMessage({ type: "disconnect" });
        setUI($(".bridge-status"), "\u5DF2\u65AD\u5F00\u672C\u5730\u8FDE\u63A5");
      } catch (error) {
        status(error.message);
      }
    });
    async function pollBridge() {
      if (!bridgeEnabled || bridgeBusy) return;
      bridgeBusy = true;
      try {
        const batch = bridgeResults.slice(0, 500);
        const result = await bridgeMessage({ type: "sync", revision: bridgeRevision, results: batch });
        if (!bridgeEnabled) return;
        if (result.ok) bridgeResults.splice(0, batch.length);
        if (result.disconnected) {
          bridgeEnabled = false;
          return;
        }
        if (!result.ok) throw new Error(result.error);
        if (result.snapshotRequest && document.visibilityState === "visible") {
          const snapshot = await call("snapshot", {});
          if (!snapshot.ok) throw new Error("\u6E90\u7801\u7F16\u8F91\u5668\u672A\u5C31\u7EEA");
          if (!bridgeEnabled) return;
          const uploaded = await bridgeMessage({ type: "sync", snapshot, requestId: result.snapshotRequest.id, revision: bridgeRevision, results: [] });
          if (!uploaded.ok) throw new Error(uploaded.error);
        }
        if (result.pack && result.revision !== bridgeRevision) {
          ++startEpoch;
          stopReason = "update";
          cancelled = true;
          pendingAbort?.();
          await call("cancel", {});
          while (running || starting) await new Promise((r) => setTimeout(r, 30));
          if (!bridgeEnabled) return;
          bridgeRevision = result.revision;
          bridgeResults = [];
          importedPack = result.pack;
          setPackLabel("Agent \u5EFA\u8BAE\u7248\u672C " + bridgeRevision + "\uFF0C\u5171 " + (result.pack.count ?? result.pack.suggestions.length) + " \u9879");
          $(".drawer").hidden = false;
          floating.layout();
          start();
        }
        if (pendingBridgeStart && !running && !starting) {
          pendingBridgeStart = false;
          start();
        }
        setUI($(".bridge-status"), "\u5DF2\u8FDE\u63A5 \xB7 \u6E90\u7801\u6309\u9700\u8BFB\u53D6 \xB7 \u5EFA\u8BAE\u7248\u672C " + bridgeRevision);
      } catch (error) {
        setUI($(".bridge-status"), contextLost ? ExtensionRuntime.message : "\u672C\u5730\u8FDE\u63A5\u6682\u4E0D\u53EF\u7528\uFF1A" + error.message);
      } finally {
        bridgeBusy = false;
        if (bridgeEnabled) setTimeout(pollBridge, 2e3);
      }
    }
    $(".back").addEventListener("click", () => showScreen("setup"));
    $(".compact").addEventListener("click", () => presentCurrent?.("compact", true).catch((error) => status(error.message)));
    $(".continue").addEventListener("click", () => presentCurrent?.(reviewMode, true).catch((error) => status(error.message)));
    $(".launch").addEventListener("click", () => {
      if (running && presentCurrent) {
        presentCurrent("details", true).catch((error) => status(error.message));
        return;
      }
      $(".drawer").hidden = !$(".drawer").hidden;
      floating.layout();
    });
    $(".close").addEventListener("click", () => {
      if (running && presentCurrent && screen === "review") {
        presentCurrent("compact", true).catch((error) => status(error.message));
        return;
      }
      $(".drawer").hidden = true;
    });
    $(".file").addEventListener("click", () => $("input[type=file]").click());
    $("input[type=file]").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > Core.MAX_PACK_BYTES) {
        status("\u5EFA\u8BAE\u5305\u4E0D\u80FD\u8D85\u8FC7 64 MiB");
        return;
      }
      try {
        importedPack = await file.text();
        setPackLabel("\u5DF2\u8F7D\u5165\u6587\u4EF6\uFF1A" + file.name + "\uFF08\u6B63\u6587\u4E0D\u5728\u8F93\u5165\u6846\u5C55\u5F00\uFF09");
        status("\u5DF2\u8BFB\u53D6\u5EFA\u8BAE\u5305\uFF0C\u70B9\u51FB\u5F00\u59CB\u5BA1\u9605");
      } catch (_) {
        status("\u65E0\u6CD5\u8BFB\u53D6\u6587\u4EF6");
      }
      event.target.value = "";
    });
    $("#pack").addEventListener("input", () => {
      importedPack = null;
      packLabel = null;
    });
    $(".resume").addEventListener("click", async () => {
      if (!persistent) {
        status("\u6062\u590D\u8FDB\u5EA6\u9700\u8981 Chrome \u6269\u5C55");
        return;
      }
      try {
        const session = await runtime.message({ type: "session" });
        if (!session.ok) throw new Error(session.error);
        if (!session.pack) throw new Error("\u5F53\u524D\u9879\u76EE\u6CA1\u6709\u4FDD\u5B58\u7684\u5EFA\u8BAE\u5305");
        importedPack = session.pack;
        setPackLabel("\u5DF2\u6062\u590D " + (session.pack.count ?? session.pack.suggestions.length) + " \u9879\u5EFA\u8BAE");
        start();
      } catch (error) {
        status(error.message);
      }
    });
    $(".repair").addEventListener("click", async () => {
      if (contextLost || running || starting || !trackingFile) return;
      const file = trackingFile;
      $(".repair").disabled = true;
      try {
        if (persistent) {
          const saved = await runtime.message({ type: "clearTracking", file, projectId: owner });
          if (!saved.ok) throw new Error(saved.error);
        }
        await start();
      } catch (error) {
        status(error.message);
      } finally {
        $(".repair").disabled = contextLost;
      }
    });
    $(".reset").addEventListener("click", async () => {
      if (running || starting) return;
      try {
        if (persistent) {
          const saved = await runtime.message({ type: "clearProgress" });
          if (!saved.ok) {
            status(saved.error);
            return;
          }
        }
      } catch (error) {
        status(error.message);
        return;
      }
      sessionActive = false;
      sharedSummary = null;
      shadow.querySelectorAll(".shared-summary").forEach((node) => {
        node.hidden = true;
      });
      $(".history-list").replaceChildren();
      status("\u5DF2\u6E05\u9664\u5F53\u524D\u9879\u76EE\u7684\u5BA1\u9605\u8FDB\u5EA6\uFF1B\u6B63\u6587\u4E0D\u53D8\uFF0C\u53EF\u91CD\u65B0\u5BFC\u5165\u5BA1\u9605");
    });
    $(".start").addEventListener("click", start);
    $(".stop").addEventListener("click", () => {
      ++startEpoch;
      stopReason = "user";
      pendingBridgeStart = false;
      cancelled = true;
      pendingAbort?.();
      call("cancel", {}).catch(() => {
      });
      status("\u6B63\u5728\u505C\u6B62\uFF1B\u5DF2\u6D3E\u53D1\u7684\u9879\u9700\u6838\u9A8C\u5B9E\u9645\u7ED3\u679C\u3002");
    });
  }
})();
