# Agent instructions

These instructions apply when asked to prepare or deliver **Overleaf review suggestions**. For repository development, follow `CONTRIBUTING.md` and run the relevant checks.

## Deliver a review

1. Read [docs/agent-guide.md](docs/agent-guide.md). Prioritize **generate → validate → publish → user review**. Reading source is optional, not a prerequisite if exact source is already available.
2. Obtain the target project ID from the user's Overleaf URL and use actual project-relative file paths. Never use the example ID for a real project.
3. Use original text you have actually seen. Make each suggestion an independent decision. Prefer small character/word/punctuation changes with enough exact context for unique matching. Never invent source or use line numbers as replacement addresses.
4. Save a UTF-8 JSON pack to `work/suggestions.json` using `format: "codex-overleaf-suggestions"`, `version: 1`, and the target `projectId`. This legacy format marker works for all Agents. Keep stable IDs when updating unchanged suggestions.
5. From the repository/extracted extension directory, run `node bridge/cli.js validate --file work/suggestions.json --project PROJECT_ID`. Fix validation errors before publishing.
6. With an already running and paired local bridge, run `node bridge/cli.js publish --project PROJECT_ID --file work/suggestions.json`. Add `--config /absolute/path/work/bridge.json` if the service was started elsewhere. Do not print, commit, or include the pairing token in the pack.
7. Report the returned revision and count as **submitted for review**, not applied. The user accepts or rejects each item in Overleaf. Do not bypass this flow with direct editor writes or automated acceptance.
8. Query `node bridge/cli.js status --project PROJECT_ID` when feedback is needed; do not keep polling or sending messages. Publish replaces the whole pack, so prepare the complete intended next revision, not an append-only fragment.

If the bridge is unavailable, deliver the validated JSON file and link to [setup](docs/local-bridge.md) for pairing or manual import. Do not claim delivery succeeded. If exact original text is missing, ask for it or optionally use the explicitly requested `read` capability described in the guide.

## 中文摘要

优先生成并发送审阅意见，不要求先获取正文。遵循上面的校验和发布命令；`publish` 仅提交建议，由用户在 Overleaf 逐项接受。缺少原文时才询问或按需读取。完整中英文流程与更新规则见 [Agent guide](docs/agent-guide.md)。
