'use strict';
// UI text only. Manuscript source, replacements and Agent reasons are never passed here.
const english = {
 '建议详情':'Suggestion details','详情 ↗':'Details ↗','返回精简 ↙':'Back to compact ↙','审阅管理':'Review setup',
 '修改理由':'Reason','修改对比':'Changes','查看完整上下文':'Show full context','返回简洁对比':'Back to concise changes',
 '拒绝':'Reject','接受':'Accept','↑↓ 切换 · Enter 接受':'↑↓ Navigate · Enter Accept',
 '已停止，返回导入后可继续':'Stopped; return to import to resume',
 '重新建立定位（保留决定）':'Rebuild tracking (keep decisions)',
 '定位记录与当前正文不一致，审阅已暂停。可重新建立定位，保留接受／拒绝决定。':'Saved tracking no longer matches the source. Review paused. Rebuild tracking to keep accepted/rejected decisions.',
 '正在准备审阅…':'Preparing review…',
 '正在载入新版本建议…':'Loading the updated suggestion pack…',
 '审阅已停止，可返回导入后继续':'Review stopped. Return to import to resume.',
 '扩展已更新或重新加载，审阅已停止。请刷新 Overleaf 页面后继续；刚接受的修改请先核对正文。':'The extension was updated or reloaded. Review has stopped. Refresh Overleaf to continue; check the source if you just accepted a change.',
 '无法连接扩展':'Cannot connect to the extension',
 '当前原文已变化，此项已失效；可继续编辑，点击导航后跳过':'The original changed; this item is stale. Continue editing; navigation will skip it.',
 '定位后的字符与原文不一致，跳过':'Located characters do not match the original; skipped',
 '配对令牌格式不正确':'Invalid pairing token format','建议会话已更新，请重新载入':'Suggestion session changed; reload the pack','建议包分块顺序无效':'Invalid suggestion pack chunk order','建议索引无效':'Invalid suggestion index',
 '导入修改建议':'Review suggestions', '收起':'Close', '逐项审阅':'Review items','← 返回导入':'← Back to import','继续审阅':'Continue review','最近处理记录':'Recent decisions',
 '先导入建议包，再逐项确认。每次接受都会搜索当前原文；过时或不唯一的项自动跳过。':'Import a pack and review each item. Accept searches the current source; stale or ambiguous items are skipped.',
 '建议包 JSON':'Suggestion pack JSON','粘贴 Agent 生成的建议包':'Paste an Agent suggestion pack',
 '连接 Agent':'Connect Agent','断开':'Disconnect','本地连接配对令牌':'Local pairing token','选择 JSON 文件':'Choose JSON file','开始审阅':'Start review','恢复上次审阅':'Resume review','清除进度':'Clear progress','停止':'Stop','等待导入建议包':'Import a suggestion pack to begin',
 '已写入表示编辑器内容已核验，服务器保存需在 Overleaf 检查。可使用 Overleaf 的撤销按钮。':'Written means editor content was verified. Check saving in Overleaf; use its Undo button if needed.',
 '新增':'Added','删除':'Deleted','替换原文':'Replaces','原文 · 标出删除':'Original · deletions marked','修改后 · 标出新增':'After · additions marked','↑ 上一项 · ↓ 下一项 · Enter 接受（审阅卡片内）':'↑ Previous · ↓ Next · Enter Accept (in review card)',
 '原文':'Original','建议修改':'Proposed change','上一项':'Previous item','下一项':'Next item','光标上一处':'Before cursor','光标下一处':'After cursor','拒绝这一项':'Reject this item','接受这一项':'Accept this item','（删除此段）':'(delete this text)',
 '拖动标题移动面板；方向键微调':'Drag the title to move; arrow keys adjust position','拖动右下角调整大小；方向键微调':'Drag the bottom-right corner to resize; arrow keys adjust size','语言':'Language',
 '原文已高亮；接受时重新搜索，过时项跳过。':'Original highlighted. Accept searches again; stale items are skipped.',
 '原文已在源码中高亮，等待确认':'Original highlighted in source; waiting for your decision','高亮暂不可用，请在此核对原文与建议':'Highlight unavailable; compare the original and proposal here',
 '正文有变化，已重新定位这一项，等待确认':'Source changed; this item was relocated and awaits your decision',
 '正在按当前光标查找建议…':'Finding suggestions near the current cursor…','当前文件的光标这一侧没有可定位的待处理建议':'No locatable pending suggestion on this side of the cursor in this file','没有其他待处理建议；当前项仍等待确认':'No other pending suggestion; the current item still awaits your decision',
 '正文、文件或光标有变化，请重新点击导航':'Source, file or cursor changed; click navigation again','导航未完成：':'Navigation failed: ',
 '已停止':'Stopped','页面连接超时':'Page connection timed out','无法连接页面':'Cannot connect to the page','保存定位记录失败：':'Could not save position tracking: ','保存审阅决定失败：':'Could not save the review decision: ',
 '已写入':'Written','已拒绝':'Rejected','写入未确认':'Write unconfirmed','已跳过：':'Skipped: ','当前项已写入编辑器，继续核对下一项':'This item was written to the editor; review the next item',
 '请先打开 Overleaf 项目':'Open an Overleaf project first','建议包属于其他项目，没有写入':'This pack belongs to another project; no write was made','建议已更新或审阅已停止':'Suggestions changed or review stopped','写入结果未确认，已停止。请检查当前正文，不要重复接受。':'Write could not be verified; review stopped. Check the source before accepting again.','审阅已停止：':'Review stopped: ',
 '本地连接需要在 Chrome 扩展中使用':'Local connection requires the Chrome extension','已连接：Agent 请求时才读取源码；新建议等待逐项确认':'Connected: source is read only on Agent request; suggestions await individual decisions','已断开本地连接':'Local connection disconnected','源码编辑器未就绪':'Source editor is not ready','已连接 · 源码按需读取 · 建议版本 ':'Connected · source read on request · pack revision ','本地连接暂不可用：':'Local connection unavailable: ',
 '建议包不能超过 64 MiB':'Suggestion packs must not exceed 64 MiB','已读取建议包，点击开始审阅':'Pack loaded; click Start review','无法读取文件':'Could not read the file','恢复进度需要 Chrome 扩展':'Resuming requires the Chrome extension','当前项目没有保存的建议包':'No saved suggestion pack for this project','已清除当前项目的审阅进度；正文不变，可重新导入审阅':'Review progress cleared for this project. Source is unchanged; import a pack to review again.','正在停止；已派发的项需核验实际结果。':'Stopping; verify the result of any write already dispatched.',
 '与已接受修改重叠冲突，跳过':'Overlaps an accepted change; skipped','字符差异过于复杂，跳过':'Character diff too complex; skipped','原文或上下文已经变化，跳过':'Original or context changed; skipped','已经应用，跳过':'Already applied; skipped','匹配到多处原文，跳过':'Multiple source matches; skipped','板块标记已经变化，跳过':'Section markers changed; skipped','板块标记不唯一，跳过':'Section markers ambiguous; skipped','内容没有变化，跳过':'No change; skipped','文件或 Code 编辑器未就绪，跳过':'File or code editor not ready; skipped','当前文件已切换，跳过':'Active file changed; skipped','编辑器状态已变化，跳过':'Editor state changed; skipped',
 '文件路径必须是项目内的相对路径':'File paths must be relative to the project','只支持项目内的文本文件':'Only project text files are supported','每项必须包含非空 original 和字符串 replacement':'Each item needs a nonempty original and a string replacement','单项修改过长':'Suggestion text is too long','上下文必须是文本且不超过 10000 字符':'Context must be text with at most 10,000 characters','scope 必须包含 start，可选 end，均为原文标记':'scope requires start and an optional end, both exact source markers','需要 codex-overleaf-suggestions v1 建议包，含 1–10000 项':'Use a codex-overleaf-suggestions v1 pack with 1–10,000 items','projectId 必须是 Overleaf 项目 ID':'projectId must be an Overleaf project ID','每项 id 必须唯一':'Each item id must be unique'
};
const templates=[
 [/^建议 (\d+) \/ (\d+)$/,(_,position,remaining)=>`Suggestion ${position} / ${remaining}`],
 [/^修改 (.*)$/, (_,id)=>'Change '+id],
 [/^Agent 建议版本 (\d+)，共 (\d+) 项$/,(_,revision,count)=>`Agent pack revision ${revision}, ${count} items`],
 [/^已载入文件：(.*)（正文不在输入框展开）$/,(_,name)=>`Loaded file: ${name} (pack not expanded here)`],
 [/^已恢复 (\d+) 项建议$/,(_,count)=>`Restored ${count} suggestions`],
 [/^审阅结束：写入 (\d+) 项，拒绝 (\d+) 项，跳过 (\d+) 项，保留先前决定 (\d+) 项。$/,(_,a,b,c,d)=>`Review complete: ${a} written, ${b} rejected, ${c} skipped, ${d} previous decisions retained.`],
 [/^(.*) · 修改 (.*)：(.*)$/,(_,file,id,state)=>`${file} · Change ${id}: ${translate(state,'en')}`]
];
function translate(text,language){
 if(language!=='en' || typeof text!=='string')return text;
 if(english[text])return english[text];
 for(const [pattern,replace] of templates)if(pattern.test(text))return text.replace(pattern,replace);
 for(const key of Object.keys(english))if(key.endsWith('：') || key.endsWith(' '))if(text.startsWith(key))return english[key]+translate(text.slice(key.length),language);
 return text;
}
function normalize(language){return language==='en'?'en':'zh-CN'}
function previewLabels(item,line,language){const t=text=>translate(text,language);return{added:t('新增'),removed:t('删除'),replaced:t('替换原文'),title:t('修改 '+item.id+' · L'+line),details:t('详情 ↗'),reason:item.reason,compactHint:t('↑↓ 切换 · Enter 接受'),hint:t('↑ 上一项 · ↓ 下一项 · Enter 接受（审阅卡片内）'),accept:t('接受这一项'),reject:t('拒绝这一项'),empty:t('（删除此段）'),previous:t('上一项'),next:t('下一项'),move:t('拖动标题移动面板；方向键微调'),resize:t('拖动右下角调整大小；方向键微调')}}
module.exports={translate,normalize,previewLabels,english};
