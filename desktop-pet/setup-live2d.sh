#!/bin/bash
# 下载 Live2D 运行时与官方示例皮套（Haru）。
# 模型与 Cubism Core 属 Live2D 官方素材（免费素材许可，非商用），不随仓库分发，按需拉取。
set -e
cd "$(dirname "$0")"
mkdir -p vendor models/haru

echo "1/3 Cubism Core..."
curl -sL -o vendor/live2dcubismcore.min.js "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js"

echo "2/3 浏览器运行库（来自 npm 包）..."
[ -f node_modules/pixi.js/dist/browser/pixi.min.js ] || npm i --registry=https://registry.npmmirror.com
cp node_modules/pixi.js/dist/browser/pixi.min.js vendor/
cp node_modules/pixi-live2d-display/dist/cubism4.min.js vendor/

echo "3/3 官方示例模型 Haru..."
BASE="https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display@master/test/assets/haru"
cd models/haru
curl -sL -O "$BASE/haru_greeter_t03.model3.json"
python3 - <<'EOF'
import json, os, subprocess
base = "https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display@master/test/assets/haru"
with open('haru_greeter_t03.model3.json') as f:
    m = json.load(f)
files = set()
fr = m.get('FileReferences', {})
for k in ('Moc', 'Physics', 'Pose', 'DisplayInfo', 'UserData'):
    if fr.get(k): files.add(fr[k])
for t in fr.get('Textures', []): files.add(t)
for grp in fr.get('Motions', {}).values():
    for mo in grp:
        if mo.get('File'): files.add(mo['File'])
        if mo.get('Sound'): files.add(mo['Sound'])
for e in fr.get('Expressions', []):
    if e.get('File'): files.add(e['File'])
for f in sorted(files):
    os.makedirs(os.path.dirname(f) or '.', exist_ok=True)
    subprocess.run(['curl', '-sL', '-o', f, f'{base}/{f}'])
    print('OK', f)
EOF
echo "完成。npm start 启动即为真皮套模式。"
