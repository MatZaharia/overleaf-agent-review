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
      function locate(source, rawItem) {
        const item = normalizeItem(rawItem), text = logical(source), old = logical(item.original), next = logical(item.replacement);
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
        let raw = 0, logicalOffset = 0, from = 0, to = 0;
        while (logicalOffset < offset + old.length) {
          if (logicalOffset === offset) from = raw;
          raw += source[raw] === "\r" && source[raw + 1] === "\n" ? 2 : 1;
          logicalOffset++;
        }
        if (offset === logicalOffset) from = raw;
        to = raw;
        return { ok: true, patch: { from, to, expected: source.slice(from, to), insert: next }, line: text.slice(0, offset).split("\n").length };
      }
      var skipped = {
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
      module.exports = { parsePack, normalizeItem, normalizePath, locate, skipped, MAX_PACK_BYTES };
    }
  });

  // src/runner.js
  var require_runner = __commonJS({
    "src/runner.js"(exports, module) {
      "use strict";
      var Core2 = require_suggestions();
      function halt(code) {
        return ["project_changed", "cancelled", "write_unconfirmed", "bridge_failed", "bridge_timeout"].includes(code);
      }
      async function run(pack, deps) {
        const results = /* @__PURE__ */ new Map(), settled = /* @__PURE__ */ new Set();
        const list = () => [...results.entries()].sort((a, b) => a[0] - b[0]).map(([, result]) => result);
        const save = (index2, result) => {
          results.set(index2, compact(result));
          settled.add(index2);
        };
        const compact = (result) => ({ ...result, item: { id: result.item.id, file: result.item.file, reviewKey: result.item.reviewKey } });
        const total = pack.count ?? pack.suggestions.length;
        let index = 0;
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
            prepared = await deps.call("prepare", { item, projectId: deps.projectId });
          } catch (_) {
            throw Object.assign(new Error("\u8FDE\u63A5\u4E2D\u65AD\uFF0C\u6CA1\u6709\u81EA\u52A8\u91CD\u8BD5"), { code: "bridge_timeout", results: list() });
          }
          deps.assertCurrent();
          if (!prepared.ok) {
            const result2 = { item, state: "skipped", code: prepared.code };
            save(index, result2);
            await deps.record(result2);
            if (halt(prepared.code)) throw Object.assign(new Error("\u5BA1\u9605\u5DF2\u505C\u6B62"), { code: prepared.code, results: list() });
            index++;
            continue;
          }
          const decision = await deps.review(item, prepared, { index, total, isPending: (i) => !settled.has(i), isDecided: (item2) => ["written", "rejected"].includes(deps.decisions?.[item2.reviewKey]?.state) });
          deps.assertCurrent();
          if (Number.isInteger(decision.navigate)) {
            if (decision.navigate < 0 || decision.navigate >= total || settled.has(decision.navigate)) throw new Error("\u65E0\u6548\u7684\u5BA1\u9605\u5BFC\u822A\u76EE\u6807");
            await deps.call("cancel", {});
            deps.assertCurrent();
            index = decision.navigate;
            continue;
          }
          if (decision.skipped) {
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
          } catch (_) {
            throw Object.assign(new Error("\u5199\u5165\u72B6\u6001\u672A\u786E\u8BA4\uFF0C\u68C0\u67E5\u5F53\u524D\u6587\u4EF6\uFF1B\u4E0D\u8981\u91CD\u590D\u63A5\u53D7"), { code: "write_unconfirmed", results: list() });
          }
          const verified = applied.ok === true && applied.verified === true;
          const code = applied.code || (verified ? "" : "write_unconfirmed");
          const result = { item, state: verified ? "written" : applied.changedDocument ? "unknown" : "skipped", code };
          save(index, result);
          await deps.record(result);
          if (!verified && halt(code)) throw Object.assign(new Error("\u5199\u5165\u672A\u786E\u8BA4\uFF0C\u505C\u6B62\u540E\u7EED\u9879"), { code, results: list() });
          index++;
        }
        return list();
      }
      module.exports = { run, halt };
    }
  });

  // src/navigation.js
  var require_navigation = __commonJS({
    "src/navigation.js"(exports, module) {
      "use strict";
      function adjacent(index, total, direction, isPending) {
        for (let i = index + direction; i >= 0 && i < total; i += direction) if (isPending(i)) return i;
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

  // src/content.js
  var Core = require_suggestions();
  var Runner = require_runner();
  var Navigation = require_navigation();
  if (!document.querySelector("[data-suggestion-importer]")) mount();
  function mount() {
    const host = document.createElement("div");
    host.dataset.suggestionImporter = "";
    host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483100;";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>
:host{font:13px/1.5 system-ui;color:#273342}*{box-sizing:border-box}button,textarea,input{font:inherit}button{border:1px solid #cdd6df;border-radius:6px;background:#fff;color:#273342;padding:7px 11px;cursor:pointer}button:disabled{opacity:.45;cursor:default}button:focus-visible,textarea:focus-visible{outline:3px solid #8aafe3;outline-offset:2px}.primary,.launch{background:#176347;color:#fff;border-color:#176347}.launch{box-shadow:0 4px 18px #18352925}.drawer{width:390px;max-width:calc(100vw - 32px);max-height:85vh;overflow:auto;background:#fff;border:1px solid #cbd5de;border-radius:10px;box-shadow:0 10px 40px #14253630;margin-bottom:10px}.head{padding:14px 16px;border-bottom:1px solid #e0e6ec;display:flex;align-items:center;justify-content:space-between}.head strong{font-size:15px}.head button{padding:3px 8px}.body{padding:16px}.muted{color:#657687;font-size:12px;margin:0 0 12px}.label{display:block;margin-bottom:6px;font-weight:600}textarea{display:block;width:100%;height:130px;padding:10px;border:1px solid #ccd7e0;border-radius:6px;resize:vertical;font:12px/1.45 ui-monospace,monospace}.toolbar{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.message{font-size:12px;padding:10px;background:#f0f5f4;border-radius:5px}.card{border:1px solid #d2dce4;border-radius:7px;padding:12px;margin-top:12px}.card strong{display:block}.path{font:11px/1.5 ui-monospace,monospace;color:#687888}.reason{font-size:12px;margin:8px 0}.source{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.5 ui-monospace,monospace;margin:6px 0 10px;padding:8px;max-height:180px;overflow:auto;border-radius:4px}.old{background:#fff1e5;color:#74451f}.new{background:#eef8ee;color:#23572c}.actions{display:flex;gap:8px}.history{padding:8px 0;border-bottom:1px solid #e3e9ed;font-size:12px}.history b{color:#176347}.unknown{color:#9a452c}.footer{margin-top:14px;font-size:11px;color:#6b7b88}[hidden]{display:none!important}
</style><section class="drawer" hidden><div class="head"><strong>\u5BFC\u5165\u4FEE\u6539\u5EFA\u8BAE</strong><button class="close" aria-label="\u6536\u8D77">\xD7</button></div><div class="body"><p class="muted">\u5148\u5BFC\u5165\u5EFA\u8BAE\u5305\uFF0C\u518D\u9010\u9879\u786E\u8BA4\u3002\u6BCF\u6B21\u63A5\u53D7\u90FD\u4F1A\u641C\u7D22\u5F53\u524D\u539F\u6587\uFF1B\u8FC7\u65F6\u6216\u4E0D\u552F\u4E00\u7684\u9879\u81EA\u52A8\u8DF3\u8FC7\u3002</p><label class="label" for="pack">\u5EFA\u8BAE\u5305 JSON</label><textarea id="pack" spellcheck="false" placeholder="\u7C98\u8D34 Agent \u751F\u6210\u7684\u5EFA\u8BAE\u5305"></textarea><input type="file" accept=".json,application/json" hidden><div class="toolbar"><button class="connect">\u8FDE\u63A5 Agent</button><button class="disconnect">\u65AD\u5F00</button></div><div class="bridge-status" role="status"></div><input class="bridge-token" type="password" placeholder="\u672C\u5730\u8FDE\u63A5\u914D\u5BF9\u4EE4\u724C" autocomplete="off"><div class="toolbar"><button class="file">\u9009\u62E9 JSON \u6587\u4EF6</button><button class="primary start">\u5F00\u59CB\u5BA1\u9605</button><button class="resume">\u6062\u590D\u4E0A\u6B21\u5BA1\u9605</button><button class="reset">\u6E05\u9664\u8FDB\u5EA6</button><button class="stop" hidden>\u505C\u6B62</button></div><div class="message" role="status" aria-live="polite">\u7B49\u5F85\u5BFC\u5165\u5EFA\u8BAE\u5305</div><div class="pending"></div><div class="history-list"></div><p class="footer">\u5DF2\u5199\u5165\u8868\u793A\u7F16\u8F91\u5668\u5185\u5BB9\u5DF2\u6838\u9A8C\uFF0C\u670D\u52A1\u5668\u4FDD\u5B58\u9700\u5728 Overleaf \u68C0\u67E5\u3002\u53EF\u4F7F\u7528 Overleaf \u7684\u64A4\u9500\u6309\u94AE\u3002</p></div></section><button class="launch">\u5BFC\u5165\u4FEE\u6539\u5EFA\u8BAE</button>`;
    document.body.append(host);
    const $ = (selector) => shadow.querySelector(selector);
    const capability = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
    const persistent = typeof chrome !== "undefined" && !!chrome.runtime?.id;
    let startEpoch = 0, sessionActive = false;
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
          reject(Object.assign(new Error("\u9875\u9762\u8FDE\u63A5\u8D85\u65F6"), { code: "bridge_timeout" }));
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
      if (!initialized) initialized = send("hello", {});
      const handshake = await initialized;
      if (!handshake.ok) throw new Error("\u65E0\u6CD5\u8FDE\u63A5\u9875\u9762");
      const result = await send(method, params);
      if (persistent && sessionActive && result.journal?.length) {
        const saved = await chrome.runtime.sendMessage({ type: "progress", journal: result.journal });
        if (!saved.ok) throw new Error("\u4FDD\u5B58\u5B9A\u4F4D\u8BB0\u5F55\u5931\u8D25\uFF1A" + saved.error);
      }
      return result;
    }
    const assertCurrent = () => {
      const current = location.pathname.match(/^\/project\/([a-f\d]{24})(?:\/|$)/i)?.[1];
      if (cancelled || current !== owner) throw Object.assign(new Error("\u5DF2\u505C\u6B62"), { code: cancelled ? "cancelled" : "project_changed" });
    };
    const status = (text) => {
      $(".message").textContent = text;
    };
    function review(item, prepared, options, itemAt) {
      return new Promise((resolve, reject) => {
        let token = prepared.token, settled = false, timer = null, navigating = false;
        const card = document.createElement("section");
        card.className = "card";
        card.innerHTML = '<strong></strong><div class="path"></div><p class="reason"></p><div>\u539F\u6587</div><pre class="source old"></pre><div>\u5EFA\u8BAE\u4FEE\u6539</div><pre class="source new"></pre><div class="toolbar navigation"><button class="previous">\u4E0A\u4E00\u9879</button><button class="next">\u4E0B\u4E00\u9879</button><button class="cursor-previous">\u5149\u6807\u4E0A\u4E00\u5904</button><button class="cursor-next">\u5149\u6807\u4E0B\u4E00\u5904</button></div><div class="actions"><button class="reject">\u62D2\u7EDD\u8FD9\u4E00\u9879</button><button class="primary accept">\u63A5\u53D7\u8FD9\u4E00\u9879</button></div>';
        card.querySelector("strong").textContent = "\u4FEE\u6539 " + (options.index + 1) + " / " + options.total;
        card.querySelector(".path").textContent = item.file + " \xB7 L" + prepared.line;
        card.querySelector(".reason").textContent = item.reason;
        card.querySelector(".old").textContent = prepared.item?.original || item.original;
        card.querySelector(".new").textContent = (prepared.item?.replacement ?? item.replacement) || "\uFF08\u5220\u9664\u6B64\u6BB5\uFF09";
        $(".pending").replaceChildren(card);
        status(prepared.inline ? "\u539F\u6587\u5DF2\u5728\u6E90\u7801\u4E2D\u9AD8\u4EAE\uFF0C\u7B49\u5F85\u786E\u8BA4" : "\u9AD8\u4EAE\u6682\u4E0D\u53EF\u7528\uFF0C\u8BF7\u5728\u6B64\u6838\u5BF9\u539F\u6587\u4E0E\u5EFA\u8BAE");
        function finish(accepted, skipped, navigate2) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          pendingAbort = null;
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
            let target;
            if (!fromCursor) {
              target = Navigation.adjacent(options.index, options.total, direction, options.isPending);
              while (target !== null && options.isDecided(await itemAt(target))) target = Navigation.adjacent(target, options.total, direction, options.isPending);
            } else {
              status("\u6B63\u5728\u6309\u5F53\u524D\u5149\u6807\u67E5\u627E\u5EFA\u8BAE\u2026");
              const scan = await call("navigation", { projectId: owner });
              if (!scan.ok) throw new Error(scan.code);
              let best = null;
              for (let index = 0; index < options.total; ) {
                if (settled) return;
                assertCurrent();
                const items = [];
                while (index < options.total && items.length < 32) {
                  const position = index++;
                  if (!options.isPending(position)) continue;
                  const candidate = await itemAt(position);
                  if (candidate.file === scan.file && !options.isDecided(candidate)) items.push({ index: position, item: candidate });
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
              const check = await call("navigation", { projectId: owner, scanId: scan.scanId, items: [] });
              if (!check.ok) throw new Error(check.code);
              target = best?.index ?? null;
            }
            if (settled) return;
            if (target !== null) {
              finish(void 0, void 0, target);
              return;
            }
            status(fromCursor ? "\u5F53\u524D\u6587\u4EF6\u7684\u5149\u6807\u8FD9\u4E00\u4FA7\u6CA1\u6709\u53EF\u5B9A\u4F4D\u7684\u5F85\u5904\u7406\u5EFA\u8BAE" : "\u8FD9\u4E00\u4FA7\u6CA1\u6709\u5F85\u5904\u7406\u5EFA\u8BAE\uFF1B\u5F53\u524D\u9879\u4ECD\u7B49\u5F85\u786E\u8BA4");
          } catch (error) {
            if (!settled) status(error.message === "navigation_changed" ? "\u6B63\u6587\u3001\u6587\u4EF6\u6216\u5149\u6807\u6709\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u5BFC\u822A" : "\u5BFC\u822A\u672A\u5B8C\u6210\uFF1A" + error.message);
          } finally {
            navigating = false;
            if (!settled) {
              card.querySelectorAll("button").forEach((button) => {
                button.disabled = false;
              });
              timer = setTimeout(poll, 300);
            }
          }
        }
        card.querySelector(".previous").addEventListener("click", () => navigate(-1, false));
        card.querySelector(".next").addEventListener("click", () => navigate(1, false));
        card.querySelector(".cursor-previous").addEventListener("click", () => navigate(-1, true));
        card.querySelector(".cursor-next").addEventListener("click", () => navigate(1, true));
        card.querySelector(".accept").addEventListener("click", () => finish(true));
        card.querySelector(".reject").addEventListener("click", () => finish(false));
        card.querySelector(".reject").focus();
        pendingAbort = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(Object.assign(new Error("\u5DF2\u505C\u6B62"), { code: "cancelled" }));
          }
        };
        async function poll() {
          if (settled) return;
          try {
            assertCurrent();
            const response = await call("status", { token, projectId: owner });
            if (settled || navigating) return;
            if (!response.ok) {
              finish(false, response.code);
              return;
            }
            if (response.refreshed) {
              if (response.item) {
                card.querySelector(".old").textContent = response.item.original;
                card.querySelector(".new").textContent = response.item.replacement || "\uFF08\u5220\u9664\u6B64\u6BB5\uFF09";
              }
              token = response.token;
              card.querySelector(".path").textContent = item.file + " \xB7 L" + response.line;
              status("\u6B63\u6587\u6709\u53D8\u5316\uFF0C\u5DF2\u91CD\u65B0\u5B9A\u4F4D\u8FD9\u4E00\u9879\uFF0C\u7B49\u5F85\u786E\u8BA4");
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
          row.textContent = text;
          return row;
        }));
      });
    }
    async function record(result) {
      if (persistent && ["written", "rejected", "unknown"].includes(result.state)) {
        const saved = await chrome.runtime.sendMessage({ type: "progress", decision: { reviewKey: result.item.reviewKey, state: result.state, code: result.code } });
        if (!saved.ok) throw new Error("\u4FDD\u5B58\u5BA1\u9605\u51B3\u5B9A\u5931\u8D25\uFF1A" + saved.error);
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
          response = await chrome.runtime.sendMessage({ type: "parseChunk", uploadId, index: index++, chunk: input.slice(from, from + 262144), last: from + 262144 >= input.length });
          if (!response.ok) throw new Error(response.error);
        }
      } else response = await chrome.runtime.sendMessage({ type: "parse", input });
      if (!response.ok) throw new Error(response.error);
      return response.pack;
    }
    async function start() {
      if (running || starting) return;
      const epoch = ++startEpoch;
      starting = true;
      $(".start").disabled = true;
      let pack, session = { decisions: {}, ledgers: {} };
      try {
        pack = await parseInput(importedPack || $("#pack").value);
        const current = await call("project", {});
        if (!current.ok || !current.projectId) throw new Error("\u8BF7\u5148\u6253\u5F00 Overleaf \u9879\u76EE");
        if (pack.projectId && pack.projectId !== current.projectId) throw new Error("\u5EFA\u8BAE\u5305\u5C5E\u4E8E\u5176\u4ED6\u9879\u76EE\uFF0C\u6CA1\u6709\u5199\u5165");
        if (epoch !== startEpoch) throw new Error("\u5EFA\u8BAE\u5DF2\u66F4\u65B0\u6216\u5BA1\u9605\u5DF2\u505C\u6B62");
        if (persistent) {
          session = await chrome.runtime.sendMessage({ type: "session", pack });
          if (!session.ok) throw new Error(session.error);
          pack = session.pack;
        }
        if (epoch !== startEpoch) throw new Error("\u5EFA\u8BAE\u5DF2\u66F4\u65B0\u6216\u5BA1\u9605\u5DF2\u505C\u6B62");
        owner = current.projectId;
        sessionActive = true;
      } catch (error) {
        status(error.message);
        starting = false;
        $(".start").disabled = false;
        return;
      }
      running = true;
      starting = false;
      cancelled = false;
      $(".start").disabled = true;
      $(".resume").disabled = true;
      $(".reset").disabled = true;
      $(".file").disabled = true;
      $("#pack").disabled = true;
      $(".stop").hidden = false;
      historyMessages = [];
      $(".history-list").replaceChildren();
      try {
        await call("begin", { ledgers: session.ledgers });
        let itemBuffer = [], bufferStart = -1;
        const itemAt = persistent ? async (index) => {
          if (index < bufferStart || index >= bufferStart + itemBuffer.length) {
            const fetched = await chrome.runtime.sendMessage({ type: "items", ref: pack.ref, index });
            if (!fetched.ok) throw new Error(fetched.error);
            bufferStart = index;
            itemBuffer = fetched.items;
          }
          return itemBuffer[index - bufferStart];
        } : async (index) => pack.suggestions[index];
        const results = await Runner.run(pack, { projectId: owner, assertCurrent, call, review: (item, prepared, options) => review(item, prepared, options, itemAt), record, decisions: session.decisions, itemAt, retained: (result) => {
          if (bridgeRevision) bridgeResults.push({ revision: bridgeRevision, id: result.item.id, state: result.state, code: "retained_decision" });
        } });
        const count = (state) => results.filter((result) => result.state === state).length;
        status("\u5BA1\u9605\u7ED3\u675F\uFF1A\u5199\u5165 " + count("written") + " \u9879\uFF0C\u62D2\u7EDD " + count("rejected") + " \u9879\uFF0C\u8DF3\u8FC7 " + count("skipped") + " \u9879\uFF0C\u4FDD\u7559\u5148\u524D\u51B3\u5B9A " + count("retained") + " \u9879\u3002");
      } catch (error) {
        status(error.code === "write_unconfirmed" ? "\u5199\u5165\u7ED3\u679C\u672A\u786E\u8BA4\uFF0C\u5DF2\u505C\u6B62\u3002\u8BF7\u68C0\u67E5\u5F53\u524D\u6B63\u6587\uFF0C\u4E0D\u8981\u91CD\u590D\u63A5\u53D7\u3002" : "\u5BA1\u9605\u5DF2\u505C\u6B62\uFF1A" + (error.code || error.message));
      } finally {
        pendingAbort?.();
        pendingAbort = null;
        await call("cancel", {}).catch(() => {
        });
        $(".pending").replaceChildren();
        running = false;
        $(".start").disabled = false;
        $(".resume").disabled = false;
        $(".reset").disabled = false;
        $(".file").disabled = false;
        $("#pack").disabled = false;
        $(".stop").hidden = true;
      }
    }
    let bridgeRevision = 0, bridgeEnabled = false, bridgeBusy = false, bridgeResults = [];
    const bridgeMessage = (message) => chrome.runtime.sendMessage(message);
    $(".connect").addEventListener("click", async () => {
      if (typeof chrome === "undefined" || !chrome.runtime?.id) {
        status("\u672C\u5730\u8FDE\u63A5\u9700\u8981\u5728 Chrome \u6269\u5C55\u4E2D\u4F7F\u7528");
        return;
      }
      const result = await bridgeMessage({ type: "connect", token: $(".bridge-token").value }).catch((e) => ({ error: e.message }));
      if (!result.ok) {
        $(".bridge-status").textContent = result.error;
        return;
      }
      $(".bridge-token").value = "";
      bridgeEnabled = true;
      $(".bridge-status").textContent = "\u5DF2\u8FDE\u63A5\uFF1AAgent \u8BF7\u6C42\u65F6\u624D\u8BFB\u53D6\u6E90\u7801\uFF1B\u65B0\u5EFA\u8BAE\u7B49\u5F85\u9010\u9879\u786E\u8BA4";
      pollBridge();
    });
    $(".disconnect").addEventListener("click", async () => {
      bridgeEnabled = false;
      if (typeof chrome !== "undefined") await bridgeMessage({ type: "disconnect" });
      $(".bridge-status").textContent = "\u5DF2\u65AD\u5F00\u672C\u5730\u8FDE\u63A5";
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
        if (result.snapshotRequest) {
          const snapshot = await call("snapshot", {});
          if (!snapshot.ok) throw new Error("\u6E90\u7801\u7F16\u8F91\u5668\u672A\u5C31\u7EEA");
          if (!bridgeEnabled) return;
          const uploaded = await bridgeMessage({ type: "sync", snapshot, requestId: result.snapshotRequest.id, revision: bridgeRevision, results: [] });
          if (!uploaded.ok) throw new Error(uploaded.error);
        }
        if (result.pack && result.revision !== bridgeRevision) {
          ++startEpoch;
          cancelled = true;
          pendingAbort?.();
          await call("cancel", {});
          while (running || starting) await new Promise((r) => setTimeout(r, 30));
          if (!bridgeEnabled) return;
          bridgeRevision = result.revision;
          bridgeResults = [];
          importedPack = result.pack;
          $("#pack").value = "Agent \u5EFA\u8BAE\u7248\u672C " + bridgeRevision + "\uFF0C\u5171 " + (result.pack.count ?? result.pack.suggestions.length) + " \u9879";
          $(".drawer").hidden = false;
          start();
        }
        $(".bridge-status").textContent = "\u5DF2\u8FDE\u63A5 \xB7 \u6E90\u7801\u6309\u9700\u8BFB\u53D6 \xB7 \u5EFA\u8BAE\u7248\u672C " + bridgeRevision;
      } catch (error) {
        $(".bridge-status").textContent = "\u672C\u5730\u8FDE\u63A5\u6682\u4E0D\u53EF\u7528\uFF1A" + error.message;
      } finally {
        bridgeBusy = false;
        if (bridgeEnabled) setTimeout(pollBridge, 2e3);
      }
    }
    $(".launch").addEventListener("click", () => {
      $(".drawer").hidden = !$(".drawer").hidden;
    });
    $(".close").addEventListener("click", () => {
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
        $("#pack").value = "\u5DF2\u8F7D\u5165\u6587\u4EF6\uFF1A" + file.name + "\uFF08\u6B63\u6587\u4E0D\u5728\u8F93\u5165\u6846\u5C55\u5F00\uFF09";
        status("\u5DF2\u8BFB\u53D6\u5EFA\u8BAE\u5305\uFF0C\u70B9\u51FB\u5F00\u59CB\u5BA1\u9605");
      } catch (_) {
        status("\u65E0\u6CD5\u8BFB\u53D6\u6587\u4EF6");
      }
      event.target.value = "";
    });
    $("#pack").addEventListener("input", () => {
      importedPack = null;
    });
    $(".resume").addEventListener("click", async () => {
      if (!persistent) {
        status("\u6062\u590D\u8FDB\u5EA6\u9700\u8981 Chrome \u6269\u5C55");
        return;
      }
      try {
        const session = await chrome.runtime.sendMessage({ type: "session" });
        if (!session.ok) throw new Error(session.error);
        if (!session.pack) throw new Error("\u5F53\u524D\u9879\u76EE\u6CA1\u6709\u4FDD\u5B58\u7684\u5EFA\u8BAE\u5305");
        importedPack = session.pack;
        $("#pack").value = "\u5DF2\u6062\u590D " + (session.pack.count ?? session.pack.suggestions.length) + " \u9879\u5EFA\u8BAE";
        start();
      } catch (error) {
        status(error.message);
      }
    });
    $(".reset").addEventListener("click", async () => {
      if (running || starting) return;
      if (persistent) {
        const saved = await chrome.runtime.sendMessage({ type: "clearProgress" });
        if (!saved.ok) {
          status(saved.error);
          return;
        }
      }
      sessionActive = false;
      status("\u5DF2\u6E05\u9664\u5F53\u524D\u9879\u76EE\u7684\u5BA1\u9605\u8FDB\u5EA6\uFF1B\u6B63\u6587\u4E0D\u53D8\uFF0C\u53EF\u91CD\u65B0\u5BFC\u5165\u5BA1\u9605");
    });
    $(".start").addEventListener("click", start);
    $(".stop").addEventListener("click", () => {
      ++startEpoch;
      cancelled = true;
      pendingAbort?.();
      call("cancel", {}).catch(() => {
      });
      status("\u6B63\u5728\u505C\u6B62\uFF1B\u5DF2\u6D3E\u53D1\u7684\u9879\u9700\u6838\u9A8C\u5B9E\u9645\u7ED3\u679C\u3002");
    });
  }
})();
