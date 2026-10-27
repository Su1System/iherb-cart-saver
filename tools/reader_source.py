"""Authenticated public-page reader adapter. Does not send merchant cookies/cart data.
The normal collector still validates the original URL, country selector and codes.
"""
from types import SimpleNamespace
from pathlib import Path
import os, requests
from update_offers import SOURCES
from reader_budget import ReaderBudget

class ReaderSource:
    def __init__(self, token=None, get=requests.get, budget=None):
        self.token=os.environ.get('JINA_API_KEY') if token is None else token
        self.get=get
        state=Path(os.environ.get('IHERB_STATE_DIR',str(Path(__file__).resolve().parents[1]/'.local')))
        self.budget=budget or ReaderBudget(state/'reader-budget.sqlite')

    def __call__(self,url,timeout=15):
        if url not in SOURCES.values():raise ValueError('READER_SOURCE_NOT_ALLOWED')
        if not self.token:raise ValueError('READER_AUTH_REQUIRED')
        tokens=self.budget.reserve(url)
        r=self.get('https://r.jina.ai/'+url,headers={
            'Authorization':'Bearer '+self.token,'Accept':'application/json',
            'X-Respond-With':'html','X-Cache-Tolerance':'0',
            'X-Robots-Txt':'*','X-Assert-Status-Code':'200','X-Timeout':'30',
            'X-Token-Budget':str(tokens),'X-Remove-Selector':'script,style,svg,noscript',
            'X-Target-Selector':'button.selected-country-wrapper, a[href*="pcode="], [data-code], [data-promo-code]',
        },timeout=45,allow_redirects=False)
        try:
            payload=r.json();usage=payload.get('data',{}).get('usage',{}) if isinstance(payload.get('data'),dict) else {}
            used=usage.get('tokens')
            if not isinstance(used,int) or used<0:used=None
        except (ValueError,AttributeError):used=None
        self.budget.record(used,r.status_code)
        if r.status_code!=200:raise ValueError('READER_HTTP_'+str(r.status_code))
        if len(r.content)>3500000:raise ValueError('READER_TOO_LARGE')
        try:data=r.json()['data']
        except (KeyError,TypeError,ValueError):raise ValueError('READER_INVALID_JSON')
        if not isinstance(data,dict) or data.get('url')!=url:raise ValueError('READER_SOURCE_MISMATCH')
        text=data.get('html') or data.get('content')
        if not isinstance(text,str) or '<html' not in text.lower():raise ValueError('READER_NOT_HTML')
        return SimpleNamespace(status_code=200,url=data['url'],headers={'content-type':'text/html'},text=text,content=text.encode('utf-8'))
