# v1.2 validation / 验证记录

52 automated tests cover character-only writes, live guards, own/external edit tracking, journal restore, local IndexedDB persistence, updated suggestion identities, paged pack delivery, authenticated bridge requests and CLI freshness.

Chrome was exercised through native browser UI using the included real CodeMirror fixture, a dedicated worker that simulates extension messaging, and browser-native IndexedDB. The fixture is explicitly not a live Overleaf project or an installed v1.2 extension.

- A source of approximately 610,000 characters and 10,000 stale suggestions completed in 3,077 ms in one run. No main-thread task of at least 50 ms was reported during that run; this is not a guarantee for every document or machine. Pack creation and loading the fixture document happen before the measured interval.
- Accepted the title, inserted unrelated text before it, rejected the author, and refreshed. Resume opened item 3 of 4, keeping the title and prior rejection without replay.
- Accepted the abstract and the nested results file; the completion summary showed two new writes and two retained decisions.
- Imported an updated pack containing the unchanged title and a changed author replacement. Review opened item 2 of 2 for the changed author.

The localhost bridge has server, extension-background integration and CLI coverage, but pairing the upgraded extension with live Overleaf still needs installation and access confirmation. Multi-user collaboration, all Overleaf layouts and worst-case 64 MiB packs remain unverified.

中文：52 项测试通过。在 Chrome 的真实编辑器测试页完成约 61 万字符正文、一万项过时建议队列，单次耗时 3.077 秒，计时区间内未记录到 50 毫秒及以上主线程任务。另验证连续接受、前文变化、拒绝、刷新恢复、嵌套文件和更新建议保留决定。测试页消息接口由专用 Worker 模拟；真实 Overleaf 的新版安装配对尚待确认。本数据不代表所有论文、电脑或最大 64 MiB 建议包的性能保证。
