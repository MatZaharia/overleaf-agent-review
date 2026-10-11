from pathlib import Path
import json, zipfile
root=Path(__file__).resolve().parent.parent
version=json.loads((root/'manifest.json').read_text())['version']
files=['manifest.json','main.bundle.js','content.bundle.js','README.md','README.zh-CN.md','LICENSE','THIRD-PARTY-NOTICES.md','vendor/LICENSE','vendor/jsdiff-LICENSE','examples/character-edit.json','examples/section-edit.json']
(root/'dist').mkdir(exist_ok=True)
out=root/'dist'/f'overleaf-codex-review-v{version}.zip'
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as archive:
 for name in files: archive.write(root/name,'overleaf-codex-review/'+name)
print(out)
