"""Reproducible store assets from the actual panel and labelled local demo; no account data."""
from pathlib import Path
import html, json, shutil
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'dist/store'
OUT.mkdir(parents=True,exist_ok=True)
listing=json.loads((ROOT/'distribution/store-listing.json').read_text(encoding='utf-8'))
shutil.copyfile(ROOT/'extension/icons/128.png',OUT/'icon-128.png')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1280,'height':800},device_scale_factor=1)
    page.goto((ROOT/'demo/index.html').as_uri())
    # The merchant fixture is condensed to fit the store's required screenshot size.
    # The extension panel itself is the unchanged shipped UI, including its scroll behavior.
    page.add_style_tag(content='''
      .site-header{height:65px;padding:0 40px}.layout{grid-template-columns:255px 350px;gap:28px;padding:30px 430px 25px 40px;max-width:none}
      .intro h1{font-size:38px}.intro p{font-size:13px}.demo-note{margin:18px 0;padding:12px}.intro ol{font-size:12px;line-height:2}
      .cart{padding:18px}.item{padding:11px 0}.item a{font-size:11px}.bottle{height:36px;width:25px}.promos{margin-top:12px}.summary{margin-top:12px}
      .links{margin-top:18px}.small{margin-top:14px}.cart-head{gap:8px}
    ''')
    page.locator('#iherb-cart-saver #check').click()
    page.get_by_text('Checked. Original code restored. Apply when ready.',exact=True).wait_for(timeout=25000)
    page.screenshot(path=str(OUT/'01-check-savings-en.png'))
    page.locator('#iherb-cart-saver #cashback-label').click()
    page.locator('#iherb-cart-saver #cashback-market').select_option('AU')
    page.locator('#iherb-cart-saver #cashback-link').scroll_into_view_if_needed()
    page.screenshot(path=str(OUT/'02-cashback-en.png'))
    page.locator('#iherb-cart-saver #lang').click()
    page.locator('#iherb-cart-saver #cashback-label').click()
    page.locator('#iherb-cart-saver #saving').scroll_into_view_if_needed()
    page.screenshot(path=str(OUT/'03-chinese.png'))
    promo=browser.new_page(viewport={'width':440,'height':280},device_scale_factor=1)
    promo.set_content('''<!doctype html><html><body style="margin:0;background:#244e39;color:#eff5df;font-family:system-ui;overflow:hidden"><div style="padding:36px 38px"><div style="font-size:13px;letter-spacing:3px;color:#dceda8">↘ CART SAVER</div><h1 style="font-size:38px;line-height:1.12;letter-spacing:-1px;margin:23px 0 17px">Keep the cart.<br>Find the saving.</h1><div style="font-size:13px;color:#d2dfc3">For iHerb · Open source · No signup</div></div></body></html>''')
    promo.screenshot(path=str(OUT/'promo-440x280.png'))
    browser.close()

fields=''.join('<h2>'+html.escape(k.replace('_',' ').title())+'</h2><textarea readonly rows="'+str(min(16,max(3,str(v).count('\n')+2)))+'">'+html.escape(v if isinstance(v,str) else json.dumps(v,ensure_ascii=False,indent=2))+'</textarea>' for k,v in listing.items())
guide='''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Cart Saver — Store upload kit</title><style>body{font:16px/1.6 system-ui;background:#f6f7f1;color:#203d30;max-width:1000px;margin:50px auto;padding:0 25px}h1{font-size:38px}h2{font-size:20px;margin-top:30px}textarea{width:100%;box-sizing:border-box;font:14px/1.55 system-ui;padding:15px;border:1px solid #cbd7c3;border-radius:8px;background:white;color:#203d30}a{color:#315f43}.notice{padding:20px;background:#e5ecd9;border-radius:10px}.images{display:flex;flex-wrap:wrap;gap:15px}.images img{width:300px;height:auto;border:1px solid #cbd7c3}.muted{color:#607463;font-size:14px}</style></head><body><h1>Cart Saver · Chrome Web Store kit</h1><p class="notice">Prepared package, not a submitted or approved listing. Store upload and submission are manual. GitHub repository protection must be verified separately; having CODEOWNERS in source is not proof of enforcement.</p><ol><li>Open the Chrome Web Store developer dashboard. If registration is required, the standard fee is a one-time US$5; confirm the actual checkout amount before paying. No payment is automated by this kit.</li><li>Create a new item and upload the extension ZIP below. Do not upload the source ZIP.</li><li>Use the English listing, Shopping category, icon and screenshots. Add the Chinese description if desired. Start with Australia, United States and Singapore.</li><li>Enter the support and privacy URLs, permission reasons and single purpose. Review the live privacy form's definitions against the supplied disclosures; locally processed cart data must be disclosed.</li><li>Verify public support/source URLs work. Complete the account's requested contact/identity fields yourself. Save the draft and review it before submitting.</li><li>After approval, copy the real store installation URL into the public README and support page. Users then click Add to Chrome; they do not download source or configure keys.</li></ol><p><a href="../iherb-cart-saver-VERSION.zip">Extension ZIP vVERSION</a> · <a href="../iherb-cart-saver-VERSION-source.zip">Public source ZIP</a> · <a href="icon-128.png">128px icon</a> · <a href="promo-440x280.png">Promotional tile</a></p><p class="muted">Screenshots are 1280 × 800. They show the real extension panel on a labelled simulated cart. Savings are fixture examples, not current offers.</p><div class="images"><a href="01-check-savings-en.png"><img src="01-check-savings-en.png" alt="Check savings in English"></a><a href="02-cashback-en.png"><img src="02-cashback-en.png" alt="Optional cashback"></a><a href="03-chinese.png"><img src="03-chinese.png" alt="Chinese interface"></a></div>FIELDS<p><a href="https://developer.chrome.com/docs/webstore/publish">Official publishing guide</a> · <a href="https://developer.chrome.com/docs/webstore/program-policies/user-data-faq">Privacy disclosure rules</a></p></body></html>'''
(OUT/'upload-guide.html').write_text(guide.replace('VERSION',listing['version']).replace('FIELDS',fields),encoding='utf-8')
print('Prepared store assets:',OUT)
