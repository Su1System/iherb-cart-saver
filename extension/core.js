(function (root) {
  'use strict';
  const validCode = code => typeof code === 'string' && /^[A-Z0-9][A-Z0-9_-]{2,29}$/.test(code);
  const normalizeCode = value => String(value || '').trim().toUpperCase();
  const markets={
    AU:{en:'Australia',zh:'澳洲',source:'https://au.iherb.com/info/sales-and-offers',cashback:{name:'ShopBack Australia',url:'https://www.shopback.com.au/iherb',store:'au.iherb.com'}},
    US:{en:'United States',zh:'美国',source:'https://www.iherb.com/info/sales-and-offers'},
    SG:{en:'Singapore',zh:'新加坡',source:'https://sg.iherb.com/info/sales-and-offers',cashback:{name:'ShopBack Singapore',url:'https://www.shopback.sg/iherb',store:'sg.iherb.com'}}
  };
  function deliveryCountry(value){
    const s=String(value||'');
    const aliases={AU:/\bAustralia\b|澳大利亚|澳大利亞|澳洲/i,US:/\bUnited States(?: of America)?\b|美国|美國/i,SG:/\bSingapore\b|新加坡/i,GB:/\bUnited Kingdom\b|英国|英國/i,CA:/\bCanada\b|加拿大/i,HK:/\bHong Kong\b|香港/i,CN:/\bChina\b|中国|中國/i,NZ:/\bNew Zealand\b|新西兰|紐西蘭/i};
    const matches=Object.keys(aliases).filter(k=>aliases[k].test(s));
    return matches.length===1?matches[0]:null;
  }
  function pageCountry(html){
    const m=String(html).match(/<button\b[^>]*class="[^"]*\bselected-country-wrapper\b[^"]*"[^>]*>([\s\S]*?)<\/button>/i);
    return m?.[1].replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').trim().match(/^([A-Z]{2})\b/)?.[1]||null;
  }
  function cashbackFor(country,accountMarket){
    return country && country===accountMarket ? markets[country]?.cashback||null : null;
  }
  function money(value) {
    const s = String(value ?? '').trim();
    if (/^(free|免费|免費)$/i.test(s)) return 0;
    // This beta supports AUD/USD/SGD dot-decimal displays only. Never guess comma-decimal prices.
    const match = s.match(/^(?:[A-Z]{0,3}\s*\$?\s*)?(-?\d{1,3}(?:,\d{3})+|-?\d+)(\.\d{2})?\s*(?:[A-Z]{3})?$/);
    if (!match) return null;
    const cents = Math.round(Number((match[1] + (match[2] || '')).replaceAll(',', '')) * 100);
    return Number.isSafeInteger(cents) ? cents : null;
  }
  const formatMoney = (cents, currency = 'AUD') => new Intl.NumberFormat('en-AU', {style:'currency',currency}).format(cents / 100);
  function validate(s) {
    if (!s || !Number.isSafeInteger(s.totalCents) || s.totalCents < 0) throw new Error('TOTAL_UNKNOWN');
    if (!['AUD','USD','SGD'].includes(s.currency)) throw new Error('CURRENCY_UNSUPPORTED');
    if (!/^[A-Z]{2}$/.test(s.country||'')) throw new Error('COUNTRY_UNKNOWN');
    if (s.regionConflict) throw new Error('COUNTRY_CONFLICT');
    if (!s.fingerprint || !s.items?.length) throw new Error('CART_EMPTY');
    if (!s.shippingKnown) throw new Error('SHIPPING_UNKNOWN');
    if (!s.taxKnown) throw new Error('TAX_UNKNOWN');
    if (s.codes.length > 1) throw new Error('MULTIPLE_CODES');
    if (s.codes.some(c => !validCode(c))) throw new Error('CODE_UNKNOWN');
    return s;
  }
  function sameCart(a,b) {
    return a.fingerprint === b.fingerprint && a.currency === b.currency && a.country===b.country && !b.regionConflict;
  }
  function unchanged(a,b) {
    return sameCart(a,b) && a.totalCents === b.totalCents && a.codes.join('|') === b.codes.join('|');
  }
  function reason(text) {
    const s = String(text || '');
    if (/expired|过期|過期|失效/i.test(s)) return 'expired';
    if (/first|new customer|首次|新客/i.test(s)) return 'new-customer';
    if (/app.only|in.app|应用程式|應用程式|APP专享/i.test(s)) return 'app-only';
    if (/add .+unlock|minimum|order over|spend|满|滿|门槛|門檻/i.test(s)) return 'minimum';
    if (/not eligible|excluded|exclusions|not applicable|不适用|不適用|不符合/i.test(s)) return 'excluded';
    if (/invalid|not valid|无效|無效|无法识别/i.test(s)) return 'invalid';
    return 'unavailable';
  }
  function candidates(offers, originals = []) {
    const seen=new Set(originals), result=[];
    for (const offer of offers) {
      const code=normalizeCode(typeof offer === 'string' ? offer : offer.code);
      if (!validCode(code) || seen.has(code)) continue;
      seen.add(code); result.push(typeof offer === 'string' ? {code,source:'manual'} : {...offer,code});
      if(result.length === 6) break;
    }
    return result;
  }
  function cachedOffers(feed,country,now=Date.now()) {
    const entry=feed?.schema===1 ? feed.regions?.[country] : null;
    if(!entry || !Array.isArray(entry.codes)) return [];
    const collected=Date.parse(entry.collectedAt),expires=Date.parse(entry.expiresAt);
    if(!Number.isFinite(collected)||!Number.isFinite(expires)||collected>now||expires<=now||expires-collected>48*3600000) return [];
    if(!markets[country] || entry.country!==country || entry.source!==markets[country].source)return [];
    return candidates(entry.codes.map(code=>({code,country,source:entry.source,collectedAt:entry.collectedAt,cached:true})));
  }
  function regionalCandidates(offers,country,originals=[]){
    if(!/^[A-Z]{2}$/.test(country||'')) return [];
    const scoped=offers.map(o=>typeof o==='string'?{code:o,source:'manual',country}:o)
      .filter(o=>o.country===country || (o.source==='manual' && !o.country));
    return candidates(scoped.map(o=>({...o,country})),originals);
  }
  async function restore(adapter, original) {
    const current=await adapter.snapshot();
    if (!sameCart(original,current)) throw new Error('CART_CHANGED_RESTORE_SKIPPED');
    await adapter.setCode(original.codes[0] || '');
    const restored=validate(await adapter.snapshot());
    if (!unchanged(original,restored)) throw new Error('RESTORE_UNCONFIRMED');
  }
  async function scan(adapter, offers, options={}) {
    const original=validate(await adapter.snapshot());
    const list=regionalCandidates(offers,original.country,original.codes);
    if(!list.length) throw new Error('NO_CODES');
    const results=[]; let mutated=false, cancelled=false, error;
    try {
      for(let i=0;i<list.length;i++) {
        if(options.cancelled?.()){cancelled=true;break;}
        if(!sameCart(original,await adapter.snapshot())) throw new Error('CART_CHANGED');
        options.progress?.({index:i+1,total:list.length,code:list[i].code});
        mutated=true;
        const response=await adapter.setCode(list[i].code);
        const after=validate(await adapter.snapshot());
        if(!sameCart(original,after)) throw new Error('CART_CHANGED');
        results.push({...list[i],...response,totalCents:after.totalCents,currency:after.currency,items:after.items,reason:reason(response.message)});
      }
    } catch(e) { error=e; }
    finally {
      if(mutated) {
        options.progress?.({restoring:true});
        try { await restore(adapter,original); } catch(e) { error=e; }
      }
    }
    if(error) throw error;
    const best=results.filter(r=>r.status==='accepted' && r.totalCents < original.totalCents)
      .sort((a,b)=>a.totalCents-b.totalCents)[0] || null;
    return {original,results,best,savingsCents:best ? original.totalCents-best.totalCents : 0,cancelled,checkedAt:Date.now()};
  }
  async function apply(adapter, report) {
    if(!report?.best) throw new Error('NO_BETTER_CODE');
    const before=validate(await adapter.snapshot());
    if(!unchanged(report.original,before)) throw new Error('STALE_RESULT');
    let result;
    try {
      const applied=await adapter.setCode(report.best.code);
      result=validate(await adapter.snapshot());
      if(applied.status!=='accepted' || !sameCart(before,result) || result.totalCents!==report.best.totalCents)
        throw new Error('PRICE_CHANGED');
    } catch(e) {
      await restore(adapter,before);
      throw e;
    }
    return {...result,savingsCents:before.totalCents-result.totalCents};
  }
  function advice(report) {
    const out=[];
    if(report.best) out.push({kind:'verified',code:report.best.code,amount:report.best.totalCents});
    if(report.results.some(r=>r.reason==='minimum' && r.status!=='accepted')) out.push({kind:'minimum'});
    if(report.results.some(r=>r.reason==='new-customer' && r.status!=='accepted')) out.push({kind:'new-customer'});
    if(report.results.some(r=>r.reason==='app-only' && r.status!=='accepted')) out.push({kind:'app-only'});
    const current=report.original?.codes?.length ? {code:report.original.codes[0],status:'accepted',items:report.original.items} : null;
    const partial=[...report.results,...(current?[current]:[])].find(r=>r.status==='accepted' && r.items.some(i=>i.excluded) && r.items.some(i=>i.discounted));
    if(partial) out.push({kind:'split',code:partial.code,excluded:partial.items.filter(i=>i.excluded).map(i=>i.name)});
    else if(report.results.some(r=>r.reason==='excluded' && r.status!=='accepted')) out.push({kind:'excluded'});
    if(!report.best) out.push({kind:'keep'});
    return out;
  }
  const api={money,formatMoney,validCode,normalizeCode,markets,deliveryCountry,pageCountry,cashbackFor,validate,sameCart,unchanged,reason,candidates,regionalCandidates,cachedOffers,scan,apply,advice};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  root.IHerbSaverCore=api;
})(globalThis);

