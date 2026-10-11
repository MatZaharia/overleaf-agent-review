# Overleaf Agent Review

简体中文 · [English](README.md)

把 Agent 生成的建议包导入在线 Overleaf，在源码中高亮修改位置，**逐项接受或拒绝**。

建议可以提前生成，但每次接受都会搜索**当前源码**，实际只写入变化的字符。原文过时、已经替换或匹配不唯一时，自动跳过并继续下一项。

## 安装

1. 在 [Releases](https://github.com/MatZaharia/overleaf-agent-review/releases/tag/v1.4.0) 下载插件 ZIP 并解压。请选择插件安装包，不是 GitHub 自动生成的 Source code ZIP。
2. 在 Chrome 打开 `chrome://extensions`，开启“开发者模式”。
3. 点击“加载未打包的扩展程序”，选择解压后包含 `manifest.json` 的 `overleaf-agent-review` 文件夹。
4. 打开 Overleaf 项目，刷新页面，切换到 **Code** 源码模式。
5. 点击右下角“导入修改建议”。

更新时替换安装目录里的文件，在扩展卡片上点击“重新加载”，再刷新 Overleaf。当前界面为中文。Codex 侧边浏览器中的安装尚未验证，目前支持的安装方式是 Chrome。

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

## 配合 Agent 使用

**Agent 入口：[AGENTS.md](AGENTS.md) → [中英文操作指南](docs/agent-guide.md)。** 主流程是生成、校验并发布审阅建议包，由用户在 Overleaf 逐项确认。读取正文是可选能力。已有建议包可直接校验发布；已写好的意见含文件路径、精确原文和改后文本时，可直接转换，无需读取在线正文。

完成一次[本地连接配置](docs/local-bridge.md)后，让 Agent 根据已掌握的精确原文生成 `work/suggestions.json`，然后执行：

```sh
node bridge/cli.js validate --file work/suggestions.json --project PROJECT_ID
node bridge/cli.js publish --project PROJECT_ID --file work/suggestions.json
node bridge/cli.js status --project PROJECT_ID
```

`PROJECT_ID` 使用 Overleaf URL 中的项目 ID。`validate` 可以离线使用，不需要配对或令牌；`publish` 只提交建议，不接受或写入修改；需要反馈时再查 `status`。未连接本地服务时，可以手动导入生成的 JSON 文件。另有[中英文提示词](docs/agent-prompt.md)。

CLI 和建议包格式不绑定模型厂商。目前以 Codex 开发和验证流程，其他具备本地文件与命令行能力的 Agent 可以使用同一接口，但尚未分别验证各自集成。插件不调用 AI API。建议必须基于精确原文；缺少原文时应询问用户，或按需调用 `read`，不要猜测。

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

## 审阅导航

**上一项／下一项**按建议包顺序切换未决定项。**光标上一处／光标下一处**在当前文件中，按实时修改字符的位置查找光标前后最近的可定位待处理建议，不按 JSON 顺序或行号寻找。切换只移动预览，不拒绝、不写入；暂不处理的项仍待确认，其他项处理后会回来。已接受／拒绝的项不参与导航。搜索期间正文、文件或光标变化时，请重新点击导航。

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

插件没有 AI 请求、统计服务或 Native 连接，仅在 Overleaf 项目页面运行。后台 service worker 负责大包解析和可选的鉴权本地连接。源码和建议包在本机处理，接受后通过现有编辑器写入，Overleaf 负责正常同步。连接按项目手动配对；只有 Agent 明确执行 read 命令时，才抓取一次当前文件源码传到本机服务；空闲检查仅查看读取请求和建议版本，不会自动打开其他文件。断开后停止新增传输；扩展会在本地 IndexedDB 保存建议包、决定和源码基准，点击“清除进度”可按项目删除；本机服务状态仍保存在内存中，CLI 导出由你明确执行。是否向模型服务提供源码取决于你如何使用 Agent。

## 本地 Agent 连接

见[本地连接说明](docs/local-bridge.md)：启动本机服务，在 Overleaf 配对一次，随后 Agent 可通过 CLI 推送建议、读取当前源码及查询审阅结果。新包自动展开审阅，但不自动接受；收到新版本后旧预览失效。审阅面板仅保留最近 100 条记录，文件导入不在输入框展开大 JSON，支持一万项规模。建议包、决定和定位记录保存到扩展本地 IndexedDB，刷新后点击“恢复上次审阅”继续。同一 ID 且修改内容、上下文和范围不变的建议保留原决定；内容改变后重新确认。“清除进度”删除当前项目的保存会话，不修改正文。跳过项在恢复时重新核对。

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
