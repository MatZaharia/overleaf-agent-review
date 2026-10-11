# Overleaf Agent Review

[简体中文](README.zh-CN.md) · English

Review Agent suggestions **one at a time, inside the live Overleaf source editor**. Import a JSON suggestion pack, inspect the highlighted characters, and accept or reject each suggestion.

Suggestions can be generated earlier. Every acceptance searches the **current source**, then writes only the changed characters. Stale, already-applied, or ambiguous suggestions are skipped.

## Install

1. Download the extension ZIP from [Releases](https://github.com/MatZaharia/overleaf-agent-review/releases/tag/v1.3.0) and extract it. Use the extension asset, rather than GitHub's automatically generated source ZIP.
2. Open `chrome://extensions` in Chrome and enable **Developer mode**.
3. Click **Load unpacked** and select the extracted `overleaf-agent-review` folder containing `manifest.json`.
4. Open your Overleaf project and refresh the page. Select **Code** mode.
5. Click **导入修改建议** (Import suggestions) at the bottom right.

The extension's current interface is Chinese. Main buttons: **开始审阅** = Start review; **接受这一项** = Accept this item; **拒绝这一项** = Reject this item; **停止** = Stop.

To update, replace the files in the installed folder, click Reload on the extension card, and refresh Overleaf. Installation in the Codex in-app browser has not been verified; the supported installation path is Chrome.

## Quick test

In a disposable project containing `\title{Your Paper}`, paste this pack into the importer:

```json
{
  "format": "codex-overleaf-suggestions",
  "version": 1,
  "suggestions": [
    {
      "id": "title-case",
      "file": "main.tex",
      "original": "\\title{Your Paper}",
      "replacement": "\\title{Your paper}",
      "reason": "Change only P to p"
    }
  ]
}
```

Click Start review. Only `P` is highlighted; the source stays unchanged until you accept. Accepting changes `P` to `p`. Rejecting retains the original. Reimporting after acceptance skips the already-applied suggestion. Changing the original to a nonexistent title tests stale skipping. Use Overleaf's Undo button or an inverse suggestion to restore your test change.

The displayed line number is informational. It is never used as the replacement address.

## Workflow with an Agent

**Agent entry point: [AGENTS.md](AGENTS.md) → [Agent guide (English / 中文)](docs/agent-guide.md).** The main workflow is to generate, validate and publish a review pack, then let the user accept or reject each item in Overleaf. Source reading is an optional capability.

After the one-time [local bridge setup](docs/local-bridge.md), ask your Agent to write `work/suggestions.json` from exact source it already has, then run:

```sh
node bridge/cli.js validate --file work/suggestions.json --project PROJECT_ID
node bridge/cli.js publish --project PROJECT_ID --file work/suggestions.json
node bridge/cli.js status --project PROJECT_ID
```

Use the project ID from your Overleaf URL. `validate` works offline, without pairing or a token. `publish` submits suggestions; it does not accept or write them. Check `status` when you need feedback. If the bridge is unavailable, import the generated JSON file manually. A reusable [English / Chinese prompt](docs/agent-prompt.md) is included.

The bridge CLI and JSON format are independent of any model provider. The current workflow was developed with Codex; other Agents with local file and shell access can use the same interface, but their integrations have not been separately verified. The extension calls no AI API. Exact original text is required; ask for missing source or optionally use the on-demand `read` command rather than inventing it.

## Suggestion format

See [examples](examples/) for character and section edits. The format marker `codex-overleaf-suggestions` is retained for compatibility with existing packs; it does not restrict which Agent can produce them.

| Field | Meaning |
| --- | --- |
| `format`, `version` | Must be `codex-overleaf-suggestions` and `1`. |
| `projectId` | Optional 24-character Overleaf project ID. Recommended to prevent importing into the wrong project; omitted packs bind to the project where review starts. |
| `suggestions` | 1–10,000 sequential suggestions. |
| `id` | A unique suggestion identifier; use a string. |
| `file` | Project-relative text-file path, including nested paths such as `sections/results.tex`. |
| `original` | Nonempty exact source used for locating and freshness checks. |
| `replacement` | Replacement text; an empty string deletes the original. |
| `reason` | Optional explanation. |
| `before`, `after` | Optional exact context immediately adjacent to the original. |
| `scope.start` | Optional section marker, which must occur exactly once in the file. |
| `scope.end` | Optional closing marker; the first occurrence after `scope.start` ends the search range. |

Escape LaTeX backslashes as `\\` inside JSON. LF and CRLF are equivalent for locating; other whitespace remains exact. Existing CRLF line endings are retained in edits. Paths cannot be absolute or contain `..` or backslashes. Packs are limited to 64 MiB; original/replacement fields to 200,000 UTF-16 code units each. Prefer small, independent suggestions; later suggestions must account for earlier accepted edits if they overlap.

Even when `original` contains a whole sentence for reliable matching, the write is a character diff: unchanged runs between edits remain outside the transaction. Disjoint edits within one suggestion are accepted together in one atomic editor transaction. Split independent suggestions if you want separate decisions.

## Behavior and limits

- Each acceptance rechecks project, file, and live original before dispatch. No stale line offsets or fuzzy matching.
- Editing during review refreshes the preview and searches again; changed targets are skipped.
- Verified edits and their baseline anchors are tracked and can be restored across a refresh. Bounded external-change tracking relocates unaffected targets; changes overlapping accepted text or exceeding the tracking budget fall back to strict current-source matching. Independent edits in a shared sentence can compose; edits to the same characters conflict. External changes are never silently attributed to the extension. Missing/ambiguous live matches remain skipped.
- Extremely expensive character diffs are skipped rather than replaced as a whole block.
- Project changes, connection failures, cancellation, or unverified writes stop the queue. Uncertain writes are never automatically replayed.
- **已写入** (Written) means the editor readback was verified. Check Overleaf's connection/save state and recompile separately. Offline Overleaf edits may await synchronization.
- After refresh, use **恢复上次审阅** (Resume) to restore the queue. Overleaf still governs document saving and Undo; clear progress before re-reviewing an accepted edit that you subsequently undid.
- Overleaf's editor/file-tree interfaces are not a stable public API. If the extension cannot confirm the editor or file identity, it skips or stops.

The v1.0.1 review flow was tested in a signed-in Chrome Overleaf test project: source highlighting, character replacement, rejection, stale skipping, already-applied skipping, refresh persistence, and restoration of the source/PDF. v1.1 own-edit rebasing and a 10,000-item queue were verified in a real CodeMirror browser fixture. The localhost bridge passed server, extension-background integration and CLI tests; pairing the upgraded extension with live Overleaf is still pending. Nested-file switching and relocation after unrelated edits were tested with a real CodeMirror fixture; multi-user collaboration and every Overleaf layout have not been verified.

See [v1.2 validation details](docs/validation-v1.2.md) for the Chrome performance and refresh-resume checks.

## Privacy

The extension has no AI requests, analytics, or native host. A background service worker parses large packs off the page thread and handles an optional authenticated localhost connection. It runs only on Overleaf project URLs. It reads source and suggestion text in the page and writes accepted edits through the existing editor; Overleaf handles its usual synchronization. Pairing is opt-in and project-specific: source is captured and sent only when an Agent explicitly invokes the CLI read command. Idle polling checks requests and pack revisions without reading source. No other files are opened automatically. Disconnect stops new transfers. The extension persists packs, decisions and source baselines locally in IndexedDB; clear them per project with **清除进度**, or remove extension data. The bridge stores state in memory; CLI exports are explicit. Sharing source with an AI provider depends on how you use your Agent.

## Local Agent connection

See [local bridge instructions](docs/local-bridge.md): run the local service, pair once in Overleaf, then use the CLI to publish packs, read the current source, or retrieve review results. Receiving a new pack opens review automatically, but never accepts a change. A received new revision cancels the old preview. The drawer retains only the latest 100 history rows to keep 10,000-item packs manageable. File imports avoid expanding large JSON in the textarea. Suggestion packs, decisions and anchor journals are saved in the extension’s local IndexedDB. Click **恢复上次审阅** to resume after a refresh. Unchanged accepted/rejected suggestions retain their decisions across pack updates; changed suggestion fields require another review. **清除进度** resets the current project’s saved session without changing Overleaf source. Skipped suggestions are checked again on resume.

## Develop

Node.js 22+ and npm are used for development; Python 3 is needed only to create the ZIP.

```sh
npm ci
npm test
npm run build
npm run demo
npm run package
```

The demo URL is printed in the terminal; it uses a local CodeMirror editor and does not connect to Overleaf. The generated demo is in `work/`, the installable release ZIP in `dist/`. To load a development checkout directly, run `npm run build`, then select its repository root in Chrome's Load unpacked dialog.

55 automated tests cover matching, Unicode character edits, CRLF preservation, live relocation, stale guards, explicit acceptance, cancellation, and non-replayed writes. GitHub Actions runs the tests and build on pushes and pull requests.

Report problems through [Issues](https://github.com/MatZaharia/overleaf-agent-review/issues). Include Chrome version, extension version, reproduction steps, and a minimal non-sensitive example. Contributions are welcome; see [CONTRIBUTING](CONTRIBUTING.md).

## License and credits

Own code is MIT licensed. Editor navigation and preview utilities derive from [codex-overleaf-link](https://github.com/Ghqqqq/codex-overleaf-link), copyright Hengquan Guo, MIT. Character diffs use [jsdiff](https://github.com/kpdecker/jsdiff), BSD-3-Clause; the development demo uses CodeMirror, MIT. See [third-party notices](THIRD-PARTY-NOTICES.md).

An independent community project, not an official Overleaf or OpenAI extension.
