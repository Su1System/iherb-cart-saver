"""Run the proven public collector, publish its JSON, and verify the public read path.
The token is supplied by the maintainer's environment, never by extension users.
"""
from pathlib import Path
from datetime import datetime, timezone
import json, os, sys, requests
from update_offers import collect

ROOT=Path(__file__).resolve().parents[1]
def run():
    local=Path(os.environ.get('IHERB_STATE_DIR',str(ROOT/'.local')));local.mkdir(parents=True,exist_ok=True)
    endpoint=os.environ.get('IHERB_FEED_ORIGIN','https://iherb-cart-saver-feed.vercel.app').rstrip('/')
    if not endpoint.startswith('https://'):raise ValueError('HTTPS_REQUIRED')
    token=os.environ.get('IHERB_FEED_TOKEN')
    origin_only=os.environ.get('IHERB_PUBLISH_MODE')=='origin'
    if not token and not origin_only:raise ValueError('PUBLISHER_NOT_CONFIGURED')
    path=local/'feed-state.json'
    previous=json.loads((path if path.exists() else ROOT/'extension/offers.json').read_text(encoding='utf-8'))
    backend=os.environ.get('IHERB_SOURCE_BACKEND','direct')
    if backend=='reader':
        from reader_source import ReaderSource
        feed=collect(previous,get=ReaderSource())
    elif backend=='direct':feed=collect(previous)
    else:raise ValueError('UNKNOWN_SOURCE_BACKEND')
    if origin_only:
        temporary=path.with_suffix('.tmp');temporary.write_text(json.dumps(feed,indent=2)+'\n',encoding='utf-8');temporary.replace(path)
        status={'checkedAt':datetime.now(timezone.utc).isoformat(),'stored':True,'backend':backend,'regions':feed['status']}
        (local/'publisher-state.json').write_text(json.dumps(status,indent=2)+'\n',encoding='utf-8')
        print(json.dumps(status),flush=True)
        return 0 if any(s['state']=='ok' for s in feed['status'].values()) else 2
    if not feed['regions']:raise ValueError('NO_FRESH_OFFERS')
    response=requests.post(endpoint+'/api/publish',json=feed,headers={'Authorization':'Bearer '+token},timeout=25,allow_redirects=False)
    if response.status_code!=200:raise ValueError('PUBLISH_HTTP_'+str(response.status_code))
    # Own API cache-buster checks the written feed, rather than a previous CDN response.
    public=requests.get(endpoint+'/api/offers',params={'verify':feed['generatedAt']},timeout=25,allow_redirects=False)
    if public.status_code!=200:raise ValueError('VERIFY_HTTP_'+str(public.status_code))
    actual=public.json()
    for country,entry in feed['regions'].items():
        if actual.get('regions',{}).get(country)!=entry:raise ValueError('PUBLISH_READBACK_MISMATCH')
    temporary=path.with_suffix('.tmp');temporary.write_text(json.dumps(feed,indent=2)+'\n',encoding='utf-8');temporary.replace(path)
    status={'checkedAt':datetime.now(timezone.utc).isoformat(),'published':True,'regions':feed['status']}
    (local/'publisher-state.json').write_text(json.dumps(status,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(status),flush=True)
    return 0 if any(s['state']=='ok' for s in feed['status'].values()) else 2

if __name__=='__main__':
    try:sys.exit(run())
    except (requests.RequestException,ValueError,KeyError) as e:
        print(json.dumps({'published':False,'error':str(e) if isinstance(e,ValueError) else type(e).__name__}),flush=True)
        sys.exit(1)
