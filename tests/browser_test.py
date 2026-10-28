"""Deterministic Chromium DOM integration tests; all shopping pages are simulated."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.local';OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(locale='zh-CN',viewport={'width':1440,'height':1000})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto((ROOT/'demo/index.html').as_uri())
    assert page.locator('#iherb-cart-saver #check').inner_text()=='Check savings'
    assert page.locator('html').get_attribute('lang')=='en'
    page.locator('#iherb-cart-saver #lang').click()
    assert page.locator('html').get_attribute('lang')=='zh-CN'
    page.locator('#iherb-cart-saver #check').click()
    page.get_by_text('检查完成，原优惠已还原。你选好后再应用。',exact=True).wait_for(timeout=20000)
    assert page.locator('[data-qa-element="total-price"]').inner_text()=='A$306.31'
    assert '13.40' in page.locator('#iherb-cart-saver #saving').inner_text()
    assert page.locator('#iherb-cart-saver #total-label').inner_text()=='应用后的总价'
    assert not page.locator('#iherb-cart-saver #advice').is_visible()
    assert '已验证的替代方案' not in page.locator('#iherb-cart-saver #advice').text_content()
    assert page.locator('#iherb-cart-saver #apply').bounding_box()['y'] < page.locator('#iherb-cart-saver #check').bounding_box()['y']
    page.locator('#iherb-cart-saver #lang').click()
    page.screenshot(path=str(OUT/'demo-simplified-result.png'),full_page=True)
    page.locator('#iherb-cart-saver #lang').click()
    page.locator('#iherb-cart-saver #alternatives-label').click()
    assert '剩余商品另用优惠' in page.locator('#iherb-cart-saver #advice').inner_text()
    page.locator('#iherb-cart-saver #cashback-label').click()
    assert not page.locator('#iherb-cart-saver #cashback-link').is_visible()
    page.locator('#iherb-cart-saver #cashback-market').select_option('AU')
    assert page.locator('#iherb-cart-saver #cashback-link').get_attribute('href')=='https://www.shopback.com.au/iherb'
    assert '尚未计入' in page.locator('#iherb-cart-saver #cashback-text').inner_text()
    page.screenshot(path=str(OUT/'demo-checked.png'),full_page=True)
    page.locator('#iherb-cart-saver #apply').click()
    page.get_by_text('已应用 GOLDAU，总价 $292.91。',exact=True).wait_for(timeout=10000)
    assert page.locator('[data-qa-element="total-price"]').inner_text()=='A$292.91'
    calls=page.evaluate('fixtureCalls')
    assert calls[0::2]==['']*4 and set(calls[1:4:2])=={'GOLDAU','EXPIRED20'} and calls[5::2]==['OCT26DAILY','GOLDAU'],calls
    assert page.evaluate('fixtureBlocked')==0
    assert page.locator('#iherb-cart-saver #total-label').inner_text()=='已应用 · 当前总价'
    assert page.locator('#iherb-cart-saver #done').is_visible()
    assert not page.locator('#iherb-cart-saver #apply').is_visible()
    page.locator('#iherb-cart-saver #lang').click()
    assert page.locator('#iherb-cart-saver #total-label').inner_text()=='Applied · current total'
    assert page.locator('#iherb-cart-saver #saving').inner_text()=='Saved $13.40 · GOLDAU'
    page.locator('#iherb-cart-saver #cashback-label').click()
    page.screenshot(path=str(OUT/'demo-simplified-applied.png'),full_page=True)
    page.locator('#iherb-cart-saver #done').click()
    assert not page.locator('#iherb-cart-saver').is_visible()
    page.add_script_tag(path=str(ROOT/'extension/panel.js'))
    assert page.locator('#iherb-cart-saver #done').is_visible()
    assert page.evaluate('fixtureCalls')==calls
    page.locator('#iherb-cart-saver #check').click()
    page.get_by_text('No better price found. Your current code is restored.',exact=True).wait_for(timeout=20000)
    assert not page.locator('#iherb-cart-saver #apply').is_visible()
    assert not page.locator('#iherb-cart-saver #done').is_visible()
    assert page.locator('#iherb-cart-saver #total-label').inner_text()=='Keep your current total'
    assert page.locator('#iherb-cart-saver #alternatives').get_attribute('open') is not None
    assert page.locator('#iherb-cart-saver #advice').is_visible()
    assert page.locator('[data-qa-element="total-price"]').inner_text()=='A$292.91'
    print('PASS: primary apply, collapsed alternatives, restore/apply, bilingual success, Done/reopen without rescan, no-better-price recovery (simulated merchant)')
    page.reload()
    page.locator('#iherb-cart-saver #lang').click()
    page.locator('#iherb-cart-saver #check').click()
    page.get_by_text('检查完成，原优惠已还原。你选好后再应用。',exact=True).wait_for(timeout=20000)
    page.evaluate("document.querySelector('[data-qa-element=product-quantity-select]').textContent='2'")
    page.locator('#iherb-cart-saver #apply').click()
    page.get_by_text('购物车或价格变了，请重新检查后应用。',exact=True).wait_for()
    assert page.locator('#iherb-cart-saver #total').inner_text()=='—'
    assert not page.locator('#iherb-cart-saver #done').is_visible()
    calls=page.evaluate('fixtureCalls')
    assert calls[0::2]==['']*3 and set(calls[1:4:2])=={'GOLDAU','EXPIRED20'} and calls[-1]=='OCT26DAILY',calls
    print('PASS: edited cart prevents stale apply')
    page.reload()
    page.locator('#iherb-cart-saver #lang').click()
    page.locator('#iherb-cart-saver #check').click()
    page.locator('#iherb-cart-saver #cancel').click()
    page.get_by_text('已停止，原优惠已还原。',exact=True).wait_for(timeout=15000)
    assert page.locator('[data-qa-element="total-price"]').inner_text()=='A$306.31'
    print('PASS: cancel and restoration')
    page.reload()
    page.locator('#iherb-cart-saver #cashback-label').click()
    page.locator('#iherb-cart-saver #cashback-market').select_option('AU')
    page.locator('#demo-market').select_option('AU_USD')
    page.get_by_text('Delivery: Australia · Currency: USD',exact=True).wait_for()
    assert page.locator('#iherb-cart-saver #cashback-link').get_attribute('href')=='https://www.shopback.com.au/iherb'
    page.evaluate("document.body.insertAdjacentHTML('beforeend','<a href=\"https://sg.iherb.com/pr/example?pcode=GOLDSG\">Wrong-region code</a>')")
    assert 'GOLDSG' not in page.evaluate('IHerbSaverAdapter.extractOffers().map(x=>x.code)')
    page.locator('#iherb-cart-saver #check').click()
    page.get_by_text('Checked. Original code restored. Apply when ready.',exact=True).wait_for(timeout=20000)
    assert page.locator('#iherb-cart-saver #apply').is_visible()
    page.locator('#demo-market').select_option('SG')
    page.get_by_text('Delivery: Singapore · Currency: SGD',exact=True).wait_for()
    assert not page.locator('#iherb-cart-saver #apply').is_visible()
    assert not page.locator('#iherb-cart-saver #cashback-link').is_visible()
    page.locator('#iherb-cart-saver #cashback-market').select_option('SG')
    assert page.locator('#iherb-cart-saver #cashback-link').get_attribute('href')=='https://www.shopback.sg/iherb'
    assert 'sg.iherb.com' in page.locator('#iherb-cart-saver #cashback-eligibility').inner_text()
    page.screenshot(path=str(OUT/'demo-regional.png'),full_page=True)
    page.locator('#demo-market').select_option('US')
    page.get_by_text('Delivery: United States · Currency: USD',exact=True).wait_for()
    assert not page.locator('#iherb-cart-saver #cashback-link').is_visible()
    print('PASS: English default on Chinese browser; Chinese switch; AU+USD; cross-region code excluded; SG cashback matching; country change invalidates old result')
    assert not errors,errors
    browser.close()
    print('PASS: no browser runtime errors')
