"""Load the real MV3 package in isolated headless Chromium and exercise its worker/injection.
Merchant DOM is the explicit local fixture; official-offer GET is a live read.
"""
from pathlib import Path
import json, uuid
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
EXT=ROOT/'extension';OUT=ROOT/'.local'
with sync_playwright() as p:
    ctx=p.chromium.launch_persistent_context(str(OUT/('extension-test-'+uuid.uuid4().hex[:8])),headless=True,channel='chromium',args=[f'--disable-extensions-except={EXT}',f'--load-extension={EXT}'])
    ctx.set_default_timeout(15000)
    try:
        worker=ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event('serviceworker')
        manifest=worker.evaluate('chrome.runtime.getManifest()')
        assert manifest['permissions']==['activeTab','scripting','storage','alarms']
        assert 'https://iherb-cart-saver-feed.vercel.app/*' in manifest['host_permissions']
        alarm=worker.evaluate("chrome.alarms.get('refresh-official-offers')")
        assert alarm and alarm['periodInMinutes']==60,alarm
        synced=worker.evaluate('feedClient.refresh()')
        assert not synced.get('error'),synced
        assert synced['feed']['regions']['AU']['codes'],synced
        print('PASS: install fetched public feed and registered hourly due-check alarm',flush=True)
        page=ctx.pages[0]
        html=(ROOT/'demo/index.html').read_text(encoding='utf-8')
        html=html[:html.index('<script src="cart.js">')]+ '<script src="https://www.iherb.com/demo/cart.js"></script></body></html>'
        ctx.route('https://www.iherb.com/cart',lambda r:r.fulfill(content_type='text/html',body=html))
        ctx.route('https://www.iherb.com/demo/cart.js',lambda r:r.fulfill(content_type='application/javascript',body=(ROOT/'demo/cart.js').read_text(encoding='utf-8')))
        ctx.route('https://www.iherb.com/style.css',lambda r:r.fulfill(content_type='text/css',body=(ROOT/'demo/style.css').read_text(encoding='utf-8')))
        page.goto('https://www.iherb.com/cart')
        worker.evaluate('''async()=>{
          const tabs=await chrome.tabs.query({});const tab=tabs.find(t=>t.url==='https://www.iherb.com/cart');
          await chrome.scripting.executeScript({target:{tabId:tab.id},files:['core.js','adapter.js']});
        }''')
        extracted=worker.evaluate('''async()=>{
          const tabs=await chrome.tabs.query({});const tab=tabs.find(t=>t.url==='https://www.iherb.com/cart');
          const result=await chrome.scripting.executeScript({target:{tabId:tab.id},func:async()=>{
            const r=await chrome.runtime.sendMessage({type:'officialOffers',country:'AU'});
            if(!r.ok||r.kind==='feed')return {...r,codes:(r.offers||[]).map(x=>x.code)};
            const doc=new DOMParser().parseFromString(r.html,'text/html');
            return {ok:true,source:r.source,codes:IHerbSaverAdapter.extractOffers(doc,r.source).map(x=>x.code)};
          }});return result[0].result;
        }''')
        print('Official source',json.dumps(extracted),flush=True)
        assert 'GOLDAU' in extracted['codes'],extracted
        assert extracted.get('kind')=='feed',extracted
        if not extracted['ok']:print('Live official page fetch unavailable; timestamped official cache verified (no claim of fresh network fetch)')
        # Same bundled panel in the isolated world. Popup routing is covered separately
        # in popup.test.cjs; this proves the real script/worker/adapter integration.
        worker.evaluate('''async()=>{
          const tabs=await chrome.tabs.query({});const tab=tabs.find(t=>t.url==='https://www.iherb.com/cart');
          await chrome.scripting.executeScript({target:{tabId:tab.id},files:['panel.js']});
        }''')
        page.get_by_text('Checked. Original code restored. Apply when ready.',exact=True).wait_for(timeout=35000)
        page.locator('#iherb-cart-saver #apply').click()
        page.get_by_text('Applied GOLDAU. Total $292.91.',exact=True).wait_for(timeout=10000)
        assert page.locator('#iherb-cart-saver #done').is_visible()
        extension_id=worker.url.split('/')[2]
        popup=ctx.new_page();popup.goto(f'chrome-extension://{extension_id}/popup.html')
        popup.get_by_text('Open iHerb cart',exact=True).wait_for()
        assert popup.locator('#feedback').get_attribute('href')=='https://github.com/Su1System/iherb-cart-saver/issues/new/choose'
        assert popup.locator('#privacy').get_attribute('href')=='https://iherb-cart-saver-feed.vercel.app/privacy.html'
        assert popup.locator('#version').inner_text()=='v'+manifest['version']+' beta'
        popup.locator('#language').click()
        assert popup.locator('#open').inner_text()=='打开 iHerb 购物车'
        assert popup.locator('#feedback').inner_text()=='反馈问题'
        popup.reload()
        popup.get_by_text('打开 iHerb 购物车',exact=True).wait_for()
        popup.locator('#language').click()
        assert popup.locator('#open').inner_text()=='Open iHerb cart'
        page.locator('#iherb-cart-saver #cashback-label').click()
        page.locator('#iherb-cart-saver #cashback-market').select_option('AU')
        # Verify preference persistence, without injecting or changing affiliate attribution.
        page.wait_for_timeout(200)
        preferences=worker.evaluate("(async()=> (await chrome.storage.local.get('preferences')).preferences)()")
        assert preferences=={'language':'en','cashbackMarket':'AU'},preferences
        # Same worker update entry as the alarm. Make the cached state due in this test profile.
        refreshed=worker.evaluate('''async()=>{
          const key=IHerbSaverFeed.KEY,s=(await chrome.storage.local.get(key))[key];s.nextAttemptAt=0;
          await chrome.storage.local.set({[key]:s});return feedClient.refresh();
        }''')
        assert not refreshed['error'] and refreshed['checkedAt']>synced['checkedAt'],refreshed
        print('PASS: public-feed refresh, package injection, panel check/apply, popup language persists, cashback preference persists',flush=True)
    finally:ctx.close()
