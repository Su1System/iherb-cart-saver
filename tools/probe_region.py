"""Inspect only the independent guest cart region controls; no user's Chrome."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    ctx=p.chromium.launch_persistent_context(str(ROOT/'.local/guest-profile'),headless=True)
    try:
        page=ctx.pages[0];page.goto('https://checkout2.iherb.com/cart',wait_until='domcontentloaded',timeout=30000)
        page.locator('#coupon-input').wait_for(timeout=10000)
        page.locator('.selected-country-wrapper').first.click()
        page.wait_for_timeout(400)
        page.get_by_role('combobox').first.click()
        page.get_by_role('combobox').first.fill('Australia')
        page.locator('span.ccl-label:visible').filter(has_text='Australia').first.click(timeout=3000)
        postcode=page.locator('input.gh-input-search:visible')
        if postcode.count(): postcode.fill('3149')
        currency=page.locator('input[aria-controls="currency-listbox"]:visible')
        currency.click();currency.fill('AUD')
        page.locator('#currency-listbox .ccl-label:visible').filter(has_text='AUD').first.click(timeout=3000)
        page.get_by_role('button',name='Save',exact=True).click()
        page.wait_for_timeout(2000)
        print('REGION',page.locator('.selected-country-wrapper').first.inner_text())
        print('DELIVERY',page.locator('[data-qa-element="cart-shipping-destination"]').all_text_contents())
    finally:ctx.close()
