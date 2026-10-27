from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
out=ROOT/'.local'
with sync_playwright() as p:
    ctx=p.chromium.launch_persistent_context(str(out/'guest-profile'),headless=True)
    page=ctx.pages[0]
    try:
        page.goto('https://checkout2.iherb.com/cart',wait_until='domcontentloaded')
        page.wait_for_timeout(2000)
        states=[]
        for code in ['', 'OCT26DAILY', 'GOLDUS']:
            if code:
                page.locator('#coupon-input').fill(code)
                page.locator('#coupon-apply').click()
                page.wait_for_timeout(2200)
            state=page.evaluate('''() => ({
                promo:document.querySelector('[data-qa-element="promo-code-section"]').outerHTML,
                qa:[...document.querySelectorAll('[data-qa-element]')].filter(e=>e.getClientRects().length).map(e=>({qa:e.getAttribute('data-qa-element'),tag:e.tagName,text:(e.innerText||e.textContent||'').slice(0,160),val:e.value})),
                currency:[...document.querySelectorAll('.selected-country-wrapper')].map(e=>e.textContent.trim())
            })''')
            state['tried']=code
            states.append(state)
        (out/'coupon-states.json').write_text(json.dumps(states,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps(states,ensure_ascii=False))
    finally: ctx.close()
