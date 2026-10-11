# Public repository privacy check / 公开仓库隐私检查

Checked on 2026-10-11, against the published `main` at `b6138feb9cbc930cf3bcaf6f0e561a16bb810222`, plus the current interface changes before publishing.

- Reviewed 11 reachable commits and 157 distinct historical file blobs, including deleted/older files.
- Checked all six published extension ZIP assets, from v1.0.1 through v1.4.0.
- Searched for credential/key signatures, literal pairing tokens, personal filesystem paths, private project identifiers and supplied manuscript content; inspected the public image asset's provenance.
- No matching credentials, private manuscript exports, personal screenshots or local connection config files were found. Project IDs in the checked files are synthetic test fixtures. The README screenshot uses the local fixture's synthetic text.
- `work/`, `dist/`, dependencies, local environment files, key files, `bridge.json`, `private/` and `snapshots/` are ignored. Packaging uses an explicit file allowlist.

This is a scoped repository/asset review, not a guarantee that arbitrary future uploads contain no private information. Keep real suggestion packs, manuscript exports, logs and pairing files in ignored `work/`; do not force-add them. Public Git commit attribution and third-party license author names are intentional public metadata.

本次检查覆盖上述 11 次历史提交、157 个文件版本、6 个公开安装 ZIP 以及发布前的界面改动。未发现匹配的凭据、真实论文导出、个人截图或本地连接配置；仓库中的项目 ID 是测试样例，README 截图使用合成正文。真实建议包、正文、日志和配对文件应保存在忽略的 `work/`，不要强制加入 Git。检查结论仅对应上述范围，不保证未来任意文件都没有私人内容；提交署名和第三方许可作者名属于有意保留的公开元数据。
