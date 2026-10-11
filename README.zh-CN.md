<div align="center">

<img src="docs/assets/hero.svg" width="100%" alt="Overleaf Agent Review：Agent 提建议，你逐项决定，只改变化的字符。" />

# Overleaf Agent Review

**Agent 提建议，Overleaf 看修改，你来拍板。**

让在线 LaTeX 审阅，细到每个字符、每次决定。

[![Release](https://img.shields.io/github/v/release/MatZaharia/overleaf-agent-review?include_prereleases&style=flat-square&color=6752c7)](https://github.com/MatZaharia/overleaf-agent-review/releases/tag/v1.4.0)
[![CI](https://github.com/MatZaharia/overleaf-agent-review/actions/workflows/ci.yml/badge.svg)](https://github.com/MatZaharia/overleaf-agent-review/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-278262?style=flat-square)](LICENSE)
[![Chrome](https://img.shields.io/badge/Chrome-Manifest_V3-456cb3?style=flat-square)](#安装)
[![Agent ready](https://img.shields.io/badge/Agent-ready-e9a751?style=flat-square)](AGENTS.md)

**简体中文** · [English](README.md)

[下载扩展](https://github.com/MatZaharia/overleaf-agent-review/releases/tag/v1.4.0) · [连接 Agent](#本地-agent-连接) · [Agent 操作指南](docs/agent-guide.md) · [反馈问题](https://github.com/MatZaharia/overleaf-agent-review/issues)

</div>

---

Agent 发来建议包，Overleaf 高亮变化的字符。**你可以接受、拒绝，或先看其他项。** 每次接受都重新核对当前原文；过时、已应用或不唯一的建议自动跳过。

## ✨ 能做什么

| 🔎 原位审阅 | ✍️ 字符级修改 | 🧭 跟随光标 |
| :--- | :--- | :--- |
| 在实时源码中高亮并确认建议，不用另开一份稿件对照。 | 即使用整句作为匹配原文，实际也只写入变化的字符。 | 按建议顺序切换，或寻找光标前后最近的待处理修改。 |
| **📦 支持万项建议包** | **🔌 本地 Agent 连接** | **🛡️ 决定权在你** |
| 分页传送，保存进度，大包不用全部展开到页面。 | 通过 CLI 校验和发布，已写好的修改清单可以直接转换。 | 手动配对，逐项接受；读取正文可选，不持续自动上传。 |

## 👀 实际长什么样

![真实 CodeMirror 演示：作者建议已高亮，审阅面板提供上一项、下一项和光标导航](docs/assets/review-demo.jpg)

*实际浏览器演示，使用插件代码和真实 CodeMirror 编辑器。图中是测试稿件，不是真实 Overleaf 截图。当前扩展界面为中文。*

> **修改意见已经整理好了？** 只要有精确原文、改后文本和文件路径，就可以直接转换并发送建议包，不必先读取在线正文。

**从这里开始：** [安装](#安装) → [配对](#本地-agent-连接) → [发送建议](#配合-agent-使用) → [逐项审阅与导航](#审阅导航)

<details>
<summary><strong>📚 展开文档导航</strong></summary>

- [快速测试](#快速测试)
- [建议包格式](#建议包格式)与[示例](examples/)
- [行为和限制](#行为和限制)
- [隐私](#隐私)
- [开发](#开发)与[贡献指南](CONTRIBUTING.md)
- [Agent 指引](AGENTS.md)与[可复用提示词](docs/agent-prompt.md)

</details>

---

## 安装

1. 在 [Releases](https://github.com/MatZaharia/overleaf-agent-review/releases/tag/v1.4.0) 下载插件 ZIP 并解压。请选择插件安装包，不是 GitHub 自动生成的 Source code ZIP。
2. 在 Chrome 打开 `chrome://extensions`，开启“开发者模式”。
3. 点击“加载未打包的扩展程序”，选择解压后包含 `manifest.json` 的 `overleaf-agent-review` 文件夹。
4. 打开 Overleaf 项目，刷新页面，切换到 **Code** 源码模式。
5. 点击右下角“导入修改建议”。

更新时替换安装目录里的文件，在扩展卡片上点击“重新加载”，再刷新 Overleaf。界面支持中文／English，可在右侧面板标题栏切换，选择会保存在浏览器本地。Codex 侧边浏览器中的安装尚未验证，目前支持的安装方式是 Chrome。

## 本地 Agent 连接

首次连接按下面的顺序操作。**Agent 只使用本地命令行提交建议；浏览器、安装、配对和接受／拒绝全部由你操作。**

1. **你安装或更新扩展**：按上面的安装步骤加载 v1.4.0 或更新版，刷新真实 Overleaf 项目，切换到 Code 模式。本地演示页不能替真实项目配对。
2. **让 Agent 启动服务**：告诉它本地工具的绝对路径，并让它在该目录运行下面的命令。需要 Node.js 22+，运行 CLI 不需要安装 npm 依赖：

   ```sh
   node bridge/cli.js start
   ```

   保持该进程运行。首次启动生成随机配对令牌，保存到该目录的 `work/bridge.json`（权限 600）；以后使用同一配置文件会复用令牌。如果服务已经运行，使用其配置文件，不要重复启动。
3. **你取得令牌并手动配对**：查看配置文件的 `token` 字段，或明确让 Agent 在当前私有会话提供它。在真实 Overleaf 项目右下角打开“导入修改建议”，填入“本地连接配对令牌”，点击“连接 Agent”。每个项目需要单独配对。令牌不要放进建议包、日志、公开聊天或 GitHub。
4. **告诉 Agent“已配对”并提供修改清单**：已有建议包直接校验发布；清单中已有精确原文、改后文本和文件路径时，直接转换，不需要先读在线正文。让它在工具目录执行：

   ```sh
   node bridge/cli.js validate --file work/suggestions.json --project PROJECT_ID
   node bridge/cli.js publish --project PROJECT_ID --file work/suggestions.json
   ```

   将 `PROJECT_ID` 换成 Overleaf URL 中 `/project/` 后的 24 位 ID。其他工作目录调用 publish / status / read 时，添加 `--config /绝对路径/工具目录/work/bridge.json`。
5. **你在 Overleaf 逐项决定**：新包收到后展开预览，但不自动接受。你可以接受、拒绝或使用导航暂缓处理；只有接受才修改正文。需要反馈时，Agent 可运行 `node bridge/cli.js status --project PROJECT_ID`，发布成功应报告“已提交建议”，不能报告“正文已修改”。

可以直接发给 Agent 的连接指令：

```text
本地工具目录：[工具目录的绝对路径]
目标 Overleaf 项目：[项目 URL]
请先阅读 AGENTS.md 和 docs/agent-guide.md。
请启动本地 bridge，并告诉我令牌文件的位置；如果我明确要求，
仅在当前私有会话向我提供配对令牌。
不要操控浏览器、安装扩展、填写配对字段或接受／拒绝建议。
等我说“已配对”后，根据我提供的修改清单生成、校验并发布建议包。
已有精确原文时不需要先读取正文；是否接受每项修改由我决定。
```

**后续使用**：同一服务运行期间、页面保持连接时，新建议直接发布，不必每包重新配对。刷新 Overleaf 后需再次填写令牌并点击连接；使用同一配置文件时令牌不变。服务重启后内存中的包会清空，需要重新发布。停止审阅不会断开连接，点击“断开”才停止本地传输。若连接未就绪，Agent 应保存校验好的文件并说明尚未送达，你也可以手动导入。完整细节见[本地连接说明](docs/local-bridge.md)。

新包自动展开审阅，但不自动接受；收到新版本后旧预览失效。审阅面板仅保留最近 100 条记录，文件导入不在输入框展开大 JSON，支持一万项规模。建议包、决定和定位记录保存到扩展本地 IndexedDB，刷新后点击“恢复上次审阅”继续。同一 ID 且修改内容、上下文和范围不变的建议保留原决定；内容改变后重新确认。“清除进度”删除当前项目的保存会话，不修改正文。跳过项在恢复时重新核对。

## 配合 Agent 使用

**Agent 入口：[AGENTS.md](AGENTS.md) → [中英文操作指南](docs/agent-guide.md)。** 主流程是生成、校验并发布审阅建议包，由用户在 Overleaf 逐项确认。读取正文是可选能力。已有建议包可直接校验发布；已写好的意见含文件路径、精确原文和改后文本时，可直接转换，无需读取在线正文。

完成下面的[首次连接流程](#本地-agent-连接)后，让 Agent 根据已掌握的精确原文生成 `work/suggestions.json`，然后执行：

```sh
node bridge/cli.js validate --file work/suggestions.json --project PROJECT_ID
node bridge/cli.js publish --project PROJECT_ID --file work/suggestions.json
node bridge/cli.js status --project PROJECT_ID
```

`PROJECT_ID` 使用 Overleaf URL 中的项目 ID。`validate` 可以离线使用，不需要配对或令牌；`publish` 只提交建议，不接受或写入修改；需要反馈时再查 `status`。未连接本地服务时，可以手动导入生成的 JSON 文件。另有[中英文提示词](docs/agent-prompt.md)。

CLI 和建议包格式不绑定模型厂商。目前以 Codex 开发和验证流程，其他具备本地文件与命令行能力的 Agent 可以使用同一接口，但尚未分别验证各自集成。插件不调用 AI API。建议必须基于精确原文；缺少原文时应询问用户，或按需调用 `read`，不要猜测。

## 快速测试

在含有 `\title{Your Paper}` 的临时测试项目中，将以下内容粘贴到导入面板：

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
      "reason": "只把大写 P 改为小写 p"
    }
  ]
}
```

点击“开始审阅”：源码只高亮 `P`，此时正文尚未修改。点击“接受这一项”才把 `P` 改为 `p`；点击“拒绝这一项”保留原文。接受后再次导入同一建议，会显示“已经应用，跳过”。把 original 改成不存在的标题，可以测试过时跳过。测试完可用 Overleaf 原生撤销或反向建议恢复。

行号仅用于展示，不作为替换地址。

## 审阅导航

两块面板都可拖动标题移动，拖动右下角斜线手柄调整大小；切换建议时保留布局，位置不会越出浏览器窗口。标题或缩放手柄获得焦点后，也可用方向键微调，Shift 加快调整。左侧 **↑／↓** 切换建议包中的上一项／下一项；光标导航只在右侧。中英文切换即时更新两侧控件，保留当前待确认项，原文、替换文本和 Agent 的修改理由不会被翻译。

这些界面改进目前在 `main` 源码中；现有 v1.4.0 Release ZIP 尚不包含。先构建再加载仓库根目录，或更新已从源码加载的扩展并刷新 Overleaf。

**上一项／下一项**按建议包顺序切换未决定项。**光标上一处／光标下一处**在当前文件中，按实时修改字符的位置查找光标前后最近的可定位待处理建议，不按 JSON 顺序或行号寻找。切换只移动预览，不拒绝、不写入；暂不处理的项仍待确认，其他项处理后会回来。已接受／拒绝的项不参与导航。搜索期间正文、文件或光标变化时，请重新点击导航。

## 建议包格式

[examples](examples/) 包含字符修改和板块定位示例。为兼容已有建议包，`format` 仍使用 `codex-overleaf-suggestions`；这个协议标识不限制生成建议的 Agent。

| 字段 | 说明 |
| --- | --- |
| `format`、`version` | 必须为 `codex-overleaf-suggestions` 和 `1`。 |
| `projectId` | 可选，24 位 Overleaf 项目 ID。建议填写，防止导入错误项目；省略时绑定开始审阅所在的项目。 |
| `suggestions` | 1–10,000 项，按顺序处理。 |
| `id` | 每项唯一标识，建议使用字符串。 |
| `file` | 项目相对路径，支持 `sections/results.tex` 等嵌套路径。 |
| `original` | 非空精确原文，用于定位和检查是否过时。 |
| `replacement` | 替换文本，空字符串表示删除。 |
| `reason` | 可选，修改理由。 |
| `before`、`after` | 可选，紧邻原文的精确上下文。 |
| `scope.start` | 可选板块起始标记，必须在全文中唯一。 |
| `scope.end` | 可选结束标记，使用起始标记后第一次出现的位置限定搜索范围。 |

JSON 中 LaTeX 反斜杠需转义为 `\\`。定位时 LF 和 CRLF 换行等价，其他空白精确比较；修改保留现有 CRLF 换行风格。路径不允许绝对路径、`..` 或反斜杠。建议包最多 64 MiB，单项 original/replacement 各最多 200,000 个 UTF-16 编码单元。尽量使用小而独立的建议；建议互相重叠时，后项原文应考虑前项接受后的结果。

即使 original 为整句话以便可靠定位，实际写入仍按字符计算差异，前后及中间没有变化的文本不会进入写入范围。同一建议内不连续的字符修改在一个编辑器事务中一起接受；若希望分别确认，请拆成独立建议。

## 行为和限制

- 每次接受重新核对项目、文件和当前原文；不沿用旧行号，不做模糊替换。
- 审阅期间正文变化会重新定位；目标已变化则跳过。
- 已核验的修改和基准定位记录可跨刷新恢复；有界差异跟踪会更新无关手动修改后的地址，改到已接受文本或变化过于复杂时退回当前源码严格匹配；同一句话中独立字符修改可以组合，同一字符修改判为冲突。外部修改不会被当作插件自己的修改，当前匹配失效仍跳过。
- 字符差异计算过于复杂时跳过，不回退到整段替换。
- 切换项目、连接异常、停止审阅或无法核验写入时，停止队列；不自动重放结果不确定的写入。
- **“已写入”只表示编辑器内容读回核验成功。**服务器同步和编译需在 Overleaf 检查；离线时修改可能等待同步。
- 刷新后可恢复队列；已接受的正文仍由 Overleaf 的正常保存和撤销机制管理。接受/拒绝记录不自动失效；如需重新审阅撤销过的修改，先清除进度。
- 依赖 Overleaf 当前编辑器和文件树接口，这些不是稳定公开 API；无法确认编辑器或文件身份时会跳过或停止。

v1.0.1 审阅流程已在登录态 Chrome 的真实 Overleaf 测试项目验证源码高亮、字符替换、拒绝、过时跳过、已应用跳过、刷新后保留，以及源码和 PDF 恢复。v1.1 的相邻字符修改合并与万项队列已在浏览器真实 CodeMirror 演示验证。本地连接已通过服务端、扩展后台集成及 CLI 测试；新版扩展与真实 Overleaf 的配对测试尚待完成。嵌套文件打开和前文变化后重新定位使用真实 CodeMirror 演示验证；多用户协同及所有 Overleaf 布局尚未验证。

v1.2 的 Chrome 压力测试和刷新恢复见[验证记录](docs/validation-v1.2.md)。

v1.4 导航的乱序包、刷新恢复和万项光标查找见[验证记录](docs/validation-v1.4.md)。

## 隐私

当前公开仓库历史和安装包的检查范围见[隐私检查记录](docs/privacy-audit.md)。真实正文、建议包、配对令牌和日志应留在忽略的 `work/`，不要提交到公开仓库。

插件没有 AI 请求、统计服务或 Native 连接，仅在 Overleaf 项目页面运行。后台 service worker 负责大包解析和可选的鉴权本地连接。源码和建议包在本机处理，接受后通过现有编辑器写入，Overleaf 负责正常同步。连接按项目手动配对；只有 Agent 明确执行 read 命令时，才抓取一次当前文件源码传到本机服务；空闲检查仅查看读取请求和建议版本，不会自动打开其他文件。断开后停止新增传输；扩展会在本地 IndexedDB 保存建议包、决定和源码基准，点击“清除进度”可按项目删除；本机服务状态仍保存在内存中，CLI 导出由你明确执行。是否向模型服务提供源码取决于你如何使用 Agent。

## 开发

开发使用 Node.js 22+ 和 npm；只有生成 ZIP 需要 Python 3。

```sh
npm ci
npm test
npm run build
npm run demo
npm run package
```

演示地址会打印在终端，使用本地 CodeMirror 编辑器，不连接 Overleaf。演示产物位于 `work/`，安装 ZIP 位于 `dist/`。开发时可以先构建，再在 Chrome 中直接加载仓库根目录。

64 项自动化测试覆盖精确匹配、Unicode 字符修改、CRLF 保留、实时重新定位、过时保护、逐项确认、取消和写入不重放。GitHub Actions 在 push 和 pull request 时运行测试及构建。

遇到问题请提交 [Issue](https://github.com/MatZaharia/overleaf-agent-review/issues)，包含 Chrome/插件版本、复现步骤和最小非敏感样例。欢迎贡献，见 [CONTRIBUTING](CONTRIBUTING.md)。

## 许可和致谢

自行编写部分采用 MIT 许可。编辑器导航和预览工具基于 Hengquan Guo 的 [codex-overleaf-link](https://github.com/Ghqqqq/codex-overleaf-link)，采用 MIT 许可；字符差异使用 [jsdiff](https://github.com/kpdecker/jsdiff)，采用 BSD-3-Clause；开发演示使用 MIT 许可的 CodeMirror。详见[第三方声明](THIRD-PARTY-NOTICES.md)。

本项目为独立社区项目，并非 Overleaf 或 OpenAI 官方扩展。
