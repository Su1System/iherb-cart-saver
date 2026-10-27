"""Maintainer-side public offer collection. No login, private cart or model calls.
Run before a release (or from a future public CI schedule); never invent code validity.
"""
from datetime import datetime, timezone, timedelta
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import json, re, requests
ROOT=Path(__file__).resolve().parents[1]
SOURCES={'AU':'https://au.iherb.com/info/sales-and-offers','US':'https://www.iherb.com/info/sales-and-offers','SG':'https://sg.iherb.com/info/sales-and-offers'}

class Offers(HTMLParser):
    def __init__(self):
        super().__init__();self.codes=[];self.text=[];self.skip=0
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if tag in ('script','style'):self.skip+=1
        if tag=='a':
            u=urlparse(d.get('href',''))
            if u.hostname and (u.hostname=='iherb.com' or u.hostname.endswith('.iherb.com')):
                self.codes.extend(parse_qs(u.query).get('pcode',[]))
        for key in ('data-code','data-promo-code'):
            if d.get(key):self.codes.append(d[key])
    def handle_endtag(self,tag):
        if tag in ('script','style'):self.skip=max(0,self.skip-1)
    def handle_data(self,data):
        if not self.skip:self.text.append(data)

def collect(previous=None, now=None, get=requests.get):
    now=now or datetime.now(timezone.utc)
    feed={'schema':1,'generatedAt':now.isoformat(),'regions':{},'status':{}}
    previous=previous or {}
    for country,source in SOURCES.items():
        try:
            r=get(source,timeout=15)
            if r.status_code!=200 or 'text/html' not in r.headers.get('content-type',''):
                raise ValueError(f'SOURCE_HTTP_{r.status_code}')
            if len(r.content)>2500000:raise ValueError('SOURCE_TOO_LARGE')
            if r.url!=source:raise ValueError('SOURCE_REDIRECTED')
            marker=re.search(r'<button\b[^>]*class="[^"]*\bselected-country-wrapper\b[^"]*"[^>]*>([\s\S]*?)</button>',r.text,re.I)
            region=re.sub(r'<[^>]+>',' ',marker[1]).replace('&nbsp;',' ').strip() if marker else ''
            if not re.match(r'^'+country+r'\b',region):
                raise ValueError('SOURCE_REGION_MISMATCH')
            parser=Offers();parser.feed(r.text)
            public=' '.join(parser.text)
            parser.codes.extend(re.findall(r'(?:promo\s+code|with\s+code|code)\s*[:：]?\s*([A-Z][A-Z0-9_-]{2,29})\b',public))
            codes=list(dict.fromkeys(c.upper() for c in parser.codes if re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{2,29}',c)))
            if not codes:raise ValueError('SOURCE_NO_CODES')
            feed['regions'][country]={'country':country,'source':source,'collectedAt':now.isoformat(),'expiresAt':(now+timedelta(hours=48)).isoformat(),'codes':codes[:20]}
            feed['status'][country]={'state':'ok','checkedAt':now.isoformat()}
        except (requests.RequestException,ValueError) as e:
            entry=previous.get('regions',{}).get(country,{})
            try:
                collected=datetime.fromisoformat(entry['collectedAt']);expires=datetime.fromisoformat(entry['expiresAt'])
                valid=entry.get('country')==country and entry.get('source')==source and collected<=now<expires and timedelta(0)<expires-collected<=timedelta(hours=48)
            except (KeyError,ValueError,TypeError):valid=False
            if valid:feed['regions'][country]=entry
            feed['status'][country]={'state':'retained' if valid else 'unavailable','checkedAt':now.isoformat(),'error':str(e) if isinstance(e,ValueError) else type(e).__name__}
    return feed

def main():
    path=ROOT/'extension/offers.json'
    previous=json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
    feed=collect(previous)
    path.write_text(json.dumps(feed,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    for country,state in feed['status'].items():print(country,state['state'],state.get('error',''),','.join(feed['regions'].get(country,{}).get('codes',[])))

if __name__=='__main__':main()
