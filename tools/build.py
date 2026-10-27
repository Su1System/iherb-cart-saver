"""Deterministic package contents; no network, account files or local test profiles."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED, ZipInfo
import hashlib, json, argparse

ROOT=Path(__file__).resolve().parents[1]

def source_entries():
    # The working README is the operator's canonical checkpoint, not public source.
    # Export only product files and substitute the public-facing README.
    entries=[]
    for directory in ['extension','demo','api','server','tools','tests','deploy','public','distribution','.github']:
        for f in (ROOT/directory).rglob('*'):
            if not f.is_file() or '__pycache__' in f.parts or f.suffix=='.pyc' or f.name.startswith('.env'):
                continue
            entries.append((f,'iherb-cart-saver/'+f.relative_to(ROOT).as_posix()))
    for name in ['LICENSE','CONTRIBUTING.md','.gitignore','package.json','package-lock.json','requirements.txt','requirements-dev.txt','vercel.json']:
        entries.append((ROOT/name,'iherb-cart-saver/'+name))
    public_readme=ROOT/'distribution/README.public.md'
    entries.append((public_readme,'iherb-cart-saver/README.md'))
    return entries

def archive(path, entries):
    with ZipFile(path,'w',ZIP_DEFLATED) as z:
        for file, name in sorted(entries, key=lambda x:x[1]):
            info=ZipInfo(name,date_time=(2026,1,1,0,0,0));info.compress_type=ZIP_DEFLATED
            info.external_attr=0o644<<16
            z.writestr(info,file.read_bytes())

def main():
    from PIL import Image, ImageDraw
    icons=ROOT/'extension/icons';icons.mkdir(exist_ok=True)
    for size in [16,48,128]:
        s=4;im=Image.new('RGBA',(size*s,size*s),(0,0,0,0));d=ImageDraw.Draw(im)
        d.rounded_rectangle((0,0,size*s-1,size*s-1),radius=int(size*s*.23),fill='#244e39')
        def p(x,y):return (int(x*size*s),int(y*size*s))
        d.line([p(.26,.32),p(.66,.72)],fill='#dceda8',width=max(2,int(size*s*.095)))
        d.line([p(.35,.72),p(.69,.72),p(.69,.38)],fill='#dceda8',width=max(2,int(size*s*.095)))
        if size==128:
            padded=Image.new('RGBA',(128,128),(0,0,0,0))
            padded.paste(im.resize((96,96),Image.Resampling.LANCZOS),(16,16))
            padded.save(icons/f'{size}.png')
        else:im.resize((size,size),Image.Resampling.LANCZOS).save(icons/f'{size}.png')
    dist=ROOT/'dist';dist.mkdir(exist_ok=True)
    manifest=json.loads((ROOT/'extension/manifest.json').read_text(encoding='utf-8'))
    version=manifest['version']
    extension=dist/f'iherb-cart-saver-{version}.zip'
    entries=[(f,f.relative_to(ROOT/'extension').as_posix()) for f in (ROOT/'extension').rglob('*') if f.is_file()]
    entries.append((ROOT/'LICENSE','LICENSE'))
    archive(extension,entries)
    source=dist/f'iherb-cart-saver-{version}-source.zip'
    archive(source,source_entries())
    for path in [extension,source]:
        print(json.dumps({'file':str(path),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}))

if __name__=='__main__':main()

