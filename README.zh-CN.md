# Overleaf Codex Review

简体中文 · [English](README.md)

把 Codex 生成的建议包导入在线 Overleaf，在源码中高亮修改位置，**逐项接受或拒绝**。

建议可以提前生成，但每次接受都会搜索**当前源码**，实际只写入变化的字符。原文过时、已经替换或匹配不唯一时，自动跳过并继续下一项。

## 安装

1. 在 [Releases](https://github.com/MatZaharia/overleaf-codex-review/releases/latest) 下载插件 ZIP 并解压。请选择插件安装包，不是 GitHub 自动生成的 Source code ZIP。
2. 在 Chrome 打开 `chrome://extensions`，开启“开发者模式”。
3. 点击“加载未打包的扩展程序”，选择解压后包含 `manifest.json` 的 `overleaf-codex-review` 文件夹。
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

## 配合 Codex 使用

向 Codex 提供当前源码和修改意见，请它生成上述格式的 JSON。仓库提供[中英文提示词](docs/codex-prompt.md)。把生成的 JSON 粘贴进插件，或选择 JSON 文件，然后在源码浮层或审阅面板中逐项确认。

插件本身不调用 Codex 或任何 AI API，只处理你在现有聊天中生成的建议包。Codex 必须知道精确原文；仅有“润色这段”这样的意见，还不足以生成可靠的匹配文本。

## 建议包格式

[examples](examples/) 包含字符修改和板块定位示例。

| 字段 | 说明 |
| --- | --- |
| `format`、`version` | 必须为 `codex-overleaf-suggestions` 和 `1`。 |
| `projectId` | 可选，24 位 Overleaf 项目 ID。建议填写，防止导入错误项目；省略时绑定开始审阅所在的项目。 |
| `suggestions` | 1–500 项，按顺序处理。 |
| `id` | 每项唯一标识，建议使用字符串。 |
| `file` | 项目相对路径，支持 `sections/results.tex` 等嵌套路径。 |
| `original` | 非空精确原文，用于定位和检查是否过时。 |
| `replacement` | 替换文本，空字符串表示删除。 |
| `reason` | 可选，修改理由。 |
| `before`、`after` | 可选，紧邻原文的精确上下文。 |
| `scope.start` | 可选板块起始标记，必须在全文中唯一。 |
| `scope.end` | 可选结束标记，使用起始标记后第一次出现的位置限定搜索范围。 |

JSON 中 LaTeX 反斜杠需转义为 `\\`。定位时 LF 和 CRLF 换行等价，其他空白精确比较；修改保留现有 CRLF 换行风格。路径不允许绝对路径、`..` 或反斜杠。建议包最多 2 MiB，单项 original/replacement 各最多 200,000 个 UTF-16 编码单元。尽量使用小而独立的建议；建议互相重叠时，后项原文应考虑前项接受后的结果。

即使 original 为整句话以便可靠定位，实际写入仍按字符计算差异，前后及中间没有变化的文本不会进入写入范围。同一建议内不连续的字符修改在一个编辑器事务中一起接受；若希望分别确认，请拆成独立建议。

## 行为和限制

- 每次接受重新核对项目、文件和当前原文；不沿用旧行号，不做模糊替换。
- 审阅期间正文变化会重新定位；目标已变化则跳过。
- 原文或上下文丢失、板块标记丢失或重复、匹配不唯一、已经应用：跳过并继续下一项。
- 字符差异计算过于复杂时跳过，不回退到整段替换。
- 切换项目、连接异常、停止审阅或无法核验写入时，停止队列；不自动重放结果不确定的写入。
- **“已写入”只表示编辑器内容读回核验成功。**服务器同步和编译需在 Overleaf 检查；离线时修改可能等待同步。
- 刷新后审阅队列消失，已接受的修改由 Overleaf 的正常保存和撤销机制管理。
- 依赖 Overleaf 当前编辑器和文件树接口，这些不是稳定公开 API；无法确认编辑器或文件身份时会跳过或停止。

已在登录态 Chrome 的真实 Overleaf 测试项目验证源码高亮、字符替换、拒绝、过时跳过、已应用跳过、刷新后保留，以及源码和 PDF 恢复。嵌套文件打开和前文变化后重新定位使用真实 CodeMirror 演示验证；多用户协同及所有 Overleaf 布局尚未验证。

## 隐私

插件没有 AI 请求、统计服务、Native 连接或后台 service worker，仅在 Overleaf 项目页面运行。源码和建议包在页面内处理，接受后通过现有编辑器写入，Overleaf 负责正常同步。向 Codex 提供源码是由你自行控制的另一项操作。

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

31 项自动化测试覆盖精确匹配、Unicode 字符修改、CRLF 保留、实时重新定位、过时保护、逐项确认、取消和写入不重放。GitHub Actions 在 push 和 pull request 时运行测试及构建。

遇到问题请提交 [Issue](https://github.com/MatZaharia/overleaf-codex-review/issues)，包含 Chrome/插件版本、复现步骤和最小非敏感样例。欢迎贡献，见 [CONTRIBUTING](CONTRIBUTING.md)。

## 许可和致谢

自行编写部分采用 MIT 许可。编辑器导航和预览工具基于 Hengquan Guo 的 [codex-overleaf-link](https://github.com/Ghqqqq/codex-overleaf-link)，采用 MIT 许可；字符差异使用 [jsdiff](https://github.com/kpdecker/jsdiff)，采用 BSD-3-Clause；开发演示使用 MIT 许可的 CodeMirror。详见[第三方声明](THIRD-PARTY-NOTICES.md)。

本项目为独立社区项目，并非 Overleaf 或 OpenAI 官方扩展。
