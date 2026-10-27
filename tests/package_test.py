"""Check the distributable boundary: only public source, no local runtime records."""
from pathlib import Path
from zipfile import ZipFile
from io import BytesIO
import json
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
version=json.loads((ROOT/'extension/manifest.json').read_text(encoding='utf-8'))['version']
assert json.loads((ROOT/'package.json').read_text())['version']==version
assert json.loads((ROOT/'package-lock.json').read_text())['version']==version
with ZipFile(ROOT/f'dist/iherb-cart-saver-{version}.zip') as z:
    assert 'manifest.json' in z.namelist()
    assert all('/' not in n or n.startswith('icons/') for n in z.namelist())
    assert not any(n.startswith(('README','.local','tools','tests')) for n in z.namelist())
    manifest=json.loads(z.read('manifest.json'))
    assert manifest['permissions']==['activeTab','scripting','storage','alarms']
    icon=Image.open(BytesIO(z.read('icons/128.png')))
    assert icon.size==(128,128) and icon.mode=='RGBA'
    bounds=icon.getchannel('A').getbbox()
    assert bounds and bounds[0]>=16 and bounds[1]>=16 and bounds[2]<=112 and bounds[3]<=112
with ZipFile(ROOT/f'dist/iherb-cart-saver-{version}-source.zip') as z:
    names=z.namelist()
    assert 'iherb-cart-saver/.github/CODEOWNERS' in names
    assert 'iherb-cart-saver/.github/workflows/ci.yml' in names
    assert 'iherb-cart-saver/public/privacy.html' in names
    assert z.read('iherb-cart-saver/README.md')==(ROOT/'distribution/README.public.md').read_bytes()
    for name in names:
        parts=Path(name).parts
        assert not any(p in {'.local','.git','node_modules','__pycache__'} or p.startswith('.env') for p in parts),name
        if name.endswith(('.md','.html','.py','.js','.mjs','.json','.ps1','.yml','.yaml')):
            data=z.read(name).decode('utf-8')
            # Host-specific operations, account records and actual credential formats must stay out.
            for marker in ['Vultr migration completed with budget controls','C:\\Users\\','jina_'+ 'api_','-----BEGIN PRIVATE KEY-----']:
                # This test contains the denylist itself; it is not an operational record.
                if name.endswith('/tests/package_test.py'):continue
                assert marker not in data,(name,marker)
print('PASS: extension permissions/icon, matching versions, public source boundary and operator-record exclusion')
