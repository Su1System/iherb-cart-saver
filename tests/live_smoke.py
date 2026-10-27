"""Opt-in real iHerb check using an isolated, anonymous test profile.
Never attaches to the user's browser. Never buys, subscribes, or signs in.
Run tools/probe_iherb.py once to populate the independent guest cart.
"""
from pathlib import Path
import json, argparse
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--live',action='store_true');args=parser.parse_args()
if not args.live: raise SystemExit('Live merchant actions are opt-in: pass --live')
out=ROOT/'.local'
with sync_playwright() as p:
    context=p.chromium.launch_persistent_context(str(out/'guest-profile'),headless=True,locale='en-AU',viewport={'width':1360,'height':1000})
    page=context.pages[0]
    page.on('console',lambda message:print(message.text,flush=True) if message.text.startswith('COUPON_FAILURE') else None)
    try:
        page.goto('https://checkout2.iherb.com/cart',wait_until='domcontentloaded',timeout=30000)
        page.locator('#coupon-input').wait_for(timeout=15000)
        page.wait_for_timeout(1200)
        for name in ['core.js','adapter.js']:page.add_script_tag(path=str(ROOT/'extension'/name))
        before=page.evaluate('IHerbSaverAdapter.snapshot()')
        offers=page.evaluate('IHerbSaverAdapter.extractOffers()')
        print('Candidates',json.dumps([x['code'] for x in offers]),flush=True)
        # Clear only the isolated guest's coupon so baseline is unambiguous for this smoke.
        page.evaluate("IHerbSaverAdapter.setCode('')")
        result=page.evaluate('''async offers => {
          const adapter={...IHerbSaverAdapter,setCode:async code=>{
            try{return await IHerbSaverAdapter.setCode(code)}catch(e){
              console.log('COUPON_FAILURE',JSON.stringify({code,error:e.message,promo:document.querySelector('[data-qa-element="promo-code-section"]').outerHTML}));throw e;
            }
          }};
          const report=await IHerbSaverCore.scan(adapter,offers);
          const restored=await IHerbSaverAdapter.snapshot();
          const applied=report.best ? await IHerbSaverCore.apply(IHerbSaverAdapter,report) : null;
          await IHerbSaverAdapter.setCode('');
          return {baseline:report.original.totalCents,currency:report.original.currency,
            candidates:offers.map(x=>x.code),results:report.results.map(({code,status,totalCents,message})=>({code,status,totalCents,message})),
            best:report.best?.code,savings:report.savingsCents,restored:restored.totalCents===report.original.totalCents&&restored.codes.length===0,
            applied:applied?.totalCents,advice:IHerbSaverCore.advice(report).map(x=>x.kind)};
        }''',offers)
        (out/'live-smoke-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps(result,ensure_ascii=False))
        assert result['restored']
        assert result['best'] and result['applied']<result['baseline']
        print('PASS: live guest cart discovery, coupon responses, total comparison, restoration, reapply and final guest cleanup')
    finally:context.close()
