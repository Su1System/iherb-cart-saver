/* Selectors observed on the live anonymous iHerb cart on 2026-10-28.
   Only coupon controls are ever clicked. No cart quantities, subscriptions or checkout. */
(function(root){
  'use strict';
  const C=root.IHerbSaverCore;
  const qa=(name,scope=document)=>scope.querySelector(`[data-qa-element="${name}"]`);
  const text=e=>(e?.innerText || e?.textContent || '').trim();
  const visible=e=>Boolean(e?.getClientRects().length);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function onCart(url=location.href){
    const u=new URL(url);
    return u.protocol==='https:' && /^(checkout[0-9]*|www|au|sg)\.iherb\.com$/.test(u.hostname) && /^\/cart\/?$/.test(u.pathname);
  }
  function promoState(){
    const scope=qa('promo-code-section');
    if(!scope) throw new Error('LAYOUT_CHANGED');
    const displays=[...scope.querySelectorAll('[data-qa-element="discount-display"]')];
    const codes=displays.map(e=>C.normalizeCode(text(e.previousElementSibling)));
    const statusText=displays.map(text).join(' ');
    const message=text(qa('discount-message',scope));
    const applied=/^(applied|已应用|已應用|已使用|已套用)$/i.test(statusText);
    const rejected=/not applied|not eligible|未应用|未應用|不适用|不適用|未使用|未套用/i.test(statusText);
    return {codes,status:applied?'accepted':rejected?'rejected':'unknown',message,statusText};
  }
  function currencyInfo(){
    const s=text([...document.querySelectorAll('.selected-country-wrapper')].find(visible));
    const currency=s.match(/\b(AUD|USD|SGD|EUR|GBP|CAD|NZD|CNY|JPY|KRW)\b/)?.[1] || null;
    const country=s.match(/^([A-Z]{2})\b/)?.[1] || null;
    const destination=C.deliveryCountry(text(qa('cart-shipping-destination')));
    return {currency,country,regionConflict:Boolean(destination&&country&&destination!==country)};
  }
  function snapshot(){
    const p=promoState(), {currency,country,regionConflict}=currencyInfo();
    const list=qa('cart-product-list-wrapper');
    const items=[...(list?.querySelectorAll('[data-qa-element="line-item"]') || [])].filter(visible).map(el=>{
      const title=qa('product-item-title',el);
      const name=text(title), id=title?.getAttribute('href')?.match(/\/([0-9]+)(?:[?#]|$)/)?.[1];
      const qty=text(qa('product-quantity-select',el));
      if(!id || !/^\d+$/.test(qty)) throw new Error('ITEMS_UNKNOWN');
      const warnings=[...el.querySelectorAll('[data-qa-element^="warning-msg-promo-"]')].map(text).join(' ');
      const discounted=Boolean(el.querySelector('[data-qa-element^="discount-item-"]'));
      const subscription=text(qa('a&s-subscription-caption',el));
      return {id,name,quantity:Number(qty),excluded:Boolean(warnings),discounted,subscription};
    });
    const shipping=C.money(text(qa('shipping-total')));
    const taxText=text(qa('tax-total'));
    const taxKnown=C.money(taxText)!==null || /included|包含|已含/i.test(taxText+' '+text(qa('tax-wrapper')));
    const delivery=text(qa('cart-shipping-destination'));
    const rewards=qa('summary-apply-rewards-credit')?.checked || false;
    const itemsTotal=C.money(text(qa('items-total')));
    // Keep postcode/address text transient in memory only; never upload or persist it.
    const fingerprint=JSON.stringify({items:items.map(({id,quantity,subscription})=>({id,quantity,subscription})).sort((a,b)=>a.id.localeCompare(b.id)),delivery,country,currency,rewards,itemsTotal});
    return {totalCents:C.money(text(qa('total-price'))),currency,country,regionConflict,shippingKnown:shipping!==null,taxKnown,
      shippingCents:shipping,items,codes:p.codes,fingerprint};
  }
  async function waitSettled(expectedCode, oldSignature){
    const started=Date.now(); let previous='',stableSince=0,observed=false;
    while(Date.now()-started<16000){
      await sleep(150);
      const p=promoState(), input=document.querySelector('#coupon-input');
      const raw=text(qa('promo-code-section'))+'|'+text(qa('total-price'));
      if(raw!==oldSignature) observed=true;
      const codeReady=expectedCode ? p.codes.length===1 && p.codes[0]===expectedCode && ['accepted','rejected'].includes(p.status)
        : p.codes.length===0 && !qa('promo-code-section').querySelector('[data-qa-element="remove-code-btn"]');
      const busy=document.querySelector('#coupon-apply')?.disabled || input?.disabled;
      if(observed && codeReady && !busy){
        if(raw!==previous){previous=raw;stableSince=Date.now();}
        // Coupon text and total update separately. Require settled state plus a minimum response window.
        if(Date.now()-stableSince>=700 && Date.now()-started>=1100) return p;
      } else {previous='';stableSince=0;}
      if(/captcha|verify you are human|access denied/i.test(document.title)) throw new Error('SITE_CHALLENGE');
    }
    throw new Error('RESPONSE_TIMEOUT');
  }
  async function setCode(code){
    if(!onCart() && !root.__IHERB_SAVER_TEST__) throw new Error('NOT_CART');
    if(code && !C.validCode(code)) throw new Error('CODE_UNKNOWN');
    const current=promoState();
    if(current.codes.length>1) throw new Error('MULTIPLE_CODES');
    if(code && current.codes[0]===code && current.status!=='unknown') return current;
    // The live AU cart keeps the old code when asked to replace it directly.
    // Remove it through the observed control before applying another code.
    if(code && current.codes.length) await setCode('');
    const writeInput=value=>{
      const input=document.querySelector('#coupon-input');
      if(!visible(input)) throw new Error('LAYOUT_CHANGED');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
    };
    if(!code && current.codes.length===0){writeInput('');return {status:'cleared',message:''};}
    const signature=text(qa('promo-code-section'))+'|'+text(qa('total-price'));
    if(!code){
      const button=qa('promo-code-section').querySelector('[data-qa-element="remove-code-btn"]');
      if(!button || !visible(button)) throw new Error('LAYOUT_CHANGED');
      button.click();
    }else{
      const input=document.querySelector('#coupon-input'), button=document.querySelector('#coupon-apply');
      if(!visible(input)||!visible(button)||button.disabled) throw new Error('LAYOUT_CHANGED');
      // Native setter + bubbling input works with the site's controlled React input.
      writeInput(code);
      await sleep(60);
      button.click();
    }
    const result=await waitSettled(code,signature);
    if(!code) writeInput('');
    return result;
  }
  function extractOffers(doc=document,source='cart',country=currencyInfo().country){
    const offers=[];
    const add=(code,context='')=>{
      code=C.normalizeCode(code);
      if(C.validCode(code)) offers.push({code,country,source,context:String(context).replace(/\s+/g,' ').slice(0,280)});
    };
    // Only merchant links: never import an affiliate code from an arbitrary third-party URL.
    for(const a of doc.querySelectorAll('a[href]')){
      try{const u=new URL(a.getAttribute('href'),'https://www.iherb.com');
        if(/(^|\.)iherb\.com$/.test(u.hostname)){
          const hostCountry=u.hostname.match(/^([a-z]{2})\.iherb\.com$/)?.[1]?.toUpperCase();
          if(hostCountry && hostCountry!==country) continue;
          const code=u.searchParams.get('pcode');
          if(code) add(code,text(a));
        }
      }catch{}
    }
    for(const e of doc.querySelectorAll('[data-qa-element="auto-apply-message-panel"],p,h3,h4,li,[data-code],[data-promo-code],input[readonly]')){
      if(e.getAttribute('data-code')) add(e.getAttribute('data-code'),text(e));
      if(e.getAttribute('data-promo-code')) add(e.getAttribute('data-promo-code'),text(e));
      const s=text(e);
      for(const m of s.matchAll(/(?:promo\s+code|with\s+code|code|优惠码|優惠碼)\s*[:：]?\s*([A-Z][A-Z0-9_-]{2,29})\b/g)) add(m[1],s);
      if(e.tagName==='INPUT' && e.readOnly && /[0-9]/.test(e.value)) add(e.value,s);
    }
    return C.candidates(offers);
  }
  root.IHerbSaverAdapter={onCart,snapshot,setCode,promoState,extractOffers,currencyInfo};
})(globalThis);

