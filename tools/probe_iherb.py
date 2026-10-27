"""Read-only anonymous DOM probe. Never attaches to the user's Chrome profile."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
out = ROOT / '.local'
out.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch_persistent_context(str(out / 'guest-profile'), headless=True, locale='en-AU', viewport={'width': 1360, 'height': 960})
    page = browser.pages[0]
    try:
        response = page.goto('https://checkout2.iherb.com/cart', wait_until='domcontentloaded', timeout=30000)
        page.wait_for_timeout(3000)
        if page.get_by_text('Your shopping cart is empty', exact=True).count():
            page.get_by_role('button', name='Add to Cart', exact=True).first.click()
            page.wait_for_timeout(3000)
            page.reload(wait_until='domcontentloaded')
            page.wait_for_timeout(2500)
        result = page.evaluate('''() => ({
          title: document.title, url: location.href,
          text: document.body.innerText.slice(0,14000),
          controls: [...document.querySelectorAll('input,button,select')].map(e=>({tag:e.tagName,id:e.id,name:e.name,placeholder:e.placeholder,testid:e.getAttribute('data-testid'),text:e.innerText,cls:e.className})),
          regions:[...document.querySelectorAll('[class],[id]')].filter(e=>/promo|coupon|summary|order-total|cart-total|cart-item|cart-product/i.test(e.className+' '+e.id)).map(e=>e.outerHTML.slice(0,14000)).slice(0,30)
        })''')
        result['httpStatus'] = response.status if response else None
        structures = page.evaluate('''() => {
          const leaves=[...document.querySelectorAll('body *')].filter(e=>e.children.length===0);
          const pick=t=>leaves.find(e=>e.textContent.trim()===t);
          return Object.fromEntries(['Promo code','Order summary','Total','Product code: NOW-01289'].map(t=>[t,pick(t)?.parentElement?.parentElement?.outerHTML]));
        }''')
        (out / 'cart-structures.json').write_text(json.dumps(structures,ensure_ascii=False,indent=2),encoding='utf-8')
        (out / 'anonymous-cart-probe.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        page.screenshot(path=str(out / 'anonymous-cart.png'))
        print(json.dumps(structures,ensure_ascii=False))
    finally:
        browser.close()
