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

  // src/reviewCounts.js
  var require_reviewCounts = __commonJS({
    "src/reviewCounts.js"(exports, module) {
      "use strict";
      function restore(pack, decisions = {}) {
        const counts = { written: 0, rejected: 0, skipped: 0, unknown: 0, retained: 0 }, indexes = [];
        for (const [index, item] of (pack?.suggestions || []).entries()) {
          const state = decisions[item.reviewKey]?.state;
          if (state === "written" || state === "rejected") {
            counts[state]++;
            counts.retained++;
            indexes.push(index);
          }
        }
        return { counts, indexes };
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

  // src/progress.js
  var require_progress = __commonJS({
    "src/progress.js"(exports, module) {
      "use strict";
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
          for (const base of bases) ledgers[base.file] = { base: base.base, edits: chunks.filter((c) => c.file === base.file && c.generation === base.generation).sort((a, b) => a.sequence - b.sequence).flatMap((c) => c.edits) };
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
        return { load, savePack, save, clear, keys };
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
        return { ok: true, ...state, initialCounts: restored.counts, decidedIndexes: restored.indexes, pack: state.pack ? catalog.put(projectId, state.pack) : null };
      }
      if (message.type === "progress") {
        await progress.save(projectId, message);
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
