const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../extension/core.js');

function fake({total=10000,code='',prices={},hook}={}){
  let state={totalCents:total,currency:'AUD',country:'AU',shippingKnown:true,taxKnown:true,fingerprint:'cart-A',codes:code?[code]:[],items:[{id:'1',name:'C-500',quantity:1}]};
  const initial=structuredClone(state),calls=[];
  return {calls,state,snapshot:async()=>structuredClone(state),setCode:async c=>{
    calls.push(c);
    if(hook) await hook(c,state,calls);
    if(c===code){Object.assign(state,{totalCents:initial.totalCents,codes:initial.codes});return {status:'accepted',message:'applied'};}
    state.codes=c?[c]:[];state.totalCents=prices[c]?.total??total;
    return {status:prices[c]?.status??'rejected',message:prices[c]?.message??'Not eligible'};
  }};
}
test('money uses integer cents; unknown and comma decimals do not become zero',()=>{
  assert.equal(C.money('AU$1,234.56'),123456);assert.equal(C.money('$76.59'),7659);
  assert.equal(C.money('Free'),0);assert.equal(C.money('TBD'),null);assert.equal(C.money(''),null);assert.equal(C.money('76,59'),null);
});
test('deduplicates, validates and bounds candidate attempts',()=>{
  assert.deepEqual(C.candidates([' OCT26DAILY ','OCT26DAILY','bad code','GOLDAU'],['GOLDAU']).map(x=>x.code),['OCT26DAILY']);
  assert.equal(C.candidates(Array.from({length:20},(_,i)=>'TEST'+i)).length,6);
});
test('chooses actual lowest total and restores the original discount',async()=>{
  const a=fake({total:30631,code:'OCT26DAILY',prices:{GOLDAU:{total:29291,status:'accepted'},BADCODE:{total:32546}}});
  const r=await C.scan(a,['BADCODE','GOLDAU']);
  assert.equal(r.best.code,'GOLDAU');assert.equal(r.savingsCents,1340);
  assert.deepEqual(a.state.codes,['OCT26DAILY']);assert.equal(a.state.totalCents,30631);
});
test('discounted merchandise with higher shipping is not a saving',async()=>{
  const a=fake({total:8000,prices:{LESS20:{total:8200,status:'accepted'}}});
  const r=await C.scan(a,['LESS20']);assert.equal(r.best,null);assert.equal(r.savingsCents,0);
});
test('a rejection with a changing total is never claimed as success',async()=>{
  const r=await C.scan(fake({prices:{BADCODE:{total:7000,status:'rejected'}}}),['BADCODE']);
  assert.equal(r.best,null);
});
test('can stop between attempts and restores the original code',async()=>{
  let stop=false;const a=fake({hook:async()=>{stop=true;}});
  const r=await C.scan(a,['ONE10','TWO20'],{cancelled:()=>stop});
  assert.equal(r.cancelled,true);assert.deepEqual(a.calls,['ONE10','']);
});
test('timeout attempts restore; does not silently advance through an unknown response',async()=>{
  const a=fake({code:'ORIGINAL',hook:async c=>{if(c==='BROKEN')throw new Error('RESPONSE_TIMEOUT');}});
  await assert.rejects(C.scan(a,['BROKEN','NEXT20']),/RESPONSE_TIMEOUT/);
  assert.deepEqual(a.calls,['BROKEN','ORIGINAL']);
});
test('restoration failure cannot be reported as completed checking',async()=>{
  const a=fake({code:'ORIGINAL',hook:async c=>{if(c==='ORIGINAL')throw new Error('RESTORE_UNCONFIRMED');}});
  await assert.rejects(C.scan(a,['NEWCODE']),/RESTORE_UNCONFIRMED/);
});
test('cart change halts and does not write a discount to the newly edited cart',async()=>{
  const a=fake({hook:async(c,s)=>{s.fingerprint='edited-cart';}});
  await assert.rejects(C.scan(a,['ONE10','TWO20']),/CART_CHANGED_RESTORE_SKIPPED/);
  assert.deepEqual(a.calls,['ONE10']);
});
test('unavailable shipping stops before any mutation',async()=>{
  const a=fake();a.state.shippingKnown=false;
  await assert.rejects(C.scan(a,['CODE10']),/SHIPPING_UNKNOWN/);assert.equal(a.calls.length,0);
});
test('unknown tax stops before any mutation',async()=>{
  const a=fake();a.state.taxKnown=false;
  await assert.rejects(C.scan(a,['CODE10']),/TAX_UNKNOWN/);assert.equal(a.calls.length,0);
});
test('multiple original codes are preserved without trying to reconstruct a combination',async()=>{
  const a=fake();a.state.codes=['ONE10','TWO20'];
  await assert.rejects(C.scan(a,['NEW20']),/MULTIPLE_CODES/);assert.equal(a.calls.length,0);
});
test('apply revalidates the actual final amount',async()=>{
  const a=fake({prices:{GOOD20:{total:8000,status:'accepted'}}});
  const r=await C.scan(a,['GOOD20']);const applied=await C.apply(a,r);
  assert.equal(applied.totalCents,8000);assert.equal(applied.savingsCents,2000);assert.deepEqual(a.state.codes,['GOOD20']);
});
test('price or cart change after scan requires a new check',async()=>{
  const a=fake({prices:{GOOD20:{total:8000,status:'accepted'}}});
  const r=await C.scan(a,['GOOD20']);a.state.totalCents=11000;
  await assert.rejects(C.apply(a,r),/STALE_RESULT/);
});
test('changed offer on reapplication is rolled back',async()=>{
  const prices={GOOD20:{total:8000,status:'accepted'}},a=fake({prices});
  const r=await C.scan(a,['GOOD20']);prices.GOOD20.total=8500;
  await assert.rejects(C.apply(a,r),/PRICE_CHANGED/);assert.equal(a.state.totalCents,10000);
});
test('failure advice links to verified alternative and threshold guidance',async()=>{
  const a=fake({prices:{GOLDAU:{message:'Add $20.00 to unlock 10% off'},WORKS20:{total:8000,status:'accepted'}}});
  const advice=C.advice(await C.scan(a,['GOLDAU','WORKS20']));
  assert.ok(advice.some(x=>x.kind==='minimum'));assert.ok(advice.some(x=>x.kind==='verified'&&x.code==='WORKS20'));
});
test('partial eligibility gives a split suggestion without inventing shipping savings',()=>{
  const a=C.advice({best:null,results:[{code:'PART20',status:'accepted',items:[{name:'C500',discounted:true},{name:'Citicoline',excluded:true}]}]});
  const split=a.find(x=>x.kind==='split');assert.deepEqual(split.excluded,['Citicoline']);assert.equal(split.amount,undefined);
});
test('currency mismatch is not compared as if the amounts were equivalent',async()=>{
  const a=fake({hook:async(c,s)=>{s.currency='USD';}});
  await assert.rejects(C.scan(a,['ONE10']),/CART_CHANGED_RESTORE_SKIPPED/);
});
test('official cache has explicit freshness, expires, and rejects future or third-party records',()=>{
  const now=Date.parse('2026-10-28T00:00:00Z');
  const entry={country:'AU',source:'https://au.iherb.com/info/sales-and-offers',collectedAt:'2026-10-27T00:00:00Z',expiresAt:'2026-10-29T00:00:00Z',codes:['GOLDAU']};
  const feed={schema:1,regions:{AU:entry}};
  assert.equal(C.cachedOffers(feed,'AU',now)[0].code,'GOLDAU');
  assert.deepEqual(C.cachedOffers(feed,'AU',now+2*86400000),[]);
  assert.deepEqual(C.cachedOffers(feed,'US',now),[]);
  entry.source='https://example.com';assert.deepEqual(C.cachedOffers(feed,'AU',now),[]);
});

test('USD is a display currency, not a United States coupon market',async()=>{
  const a=fake({prices:{GOLDAU:{total:8000,status:'accepted'},GOLDUS:{total:7000,status:'accepted'}}});a.state.currency='USD';
  const report=await C.scan(a,[{code:'GOLDUS',country:'US'},{code:'GOLDAU',country:'AU'}]);
  assert.equal(report.best.code,'GOLDAU');assert.ok(!a.calls.includes('GOLDUS'));
});
test('unknown coupon region is not treated as worldwide',()=>{
  assert.deepEqual(C.regionalCandidates([{code:'UNKNOWN',source:'official'},{code:'GOLDSG',country:'SG'}],'AU'),[]);
  assert.equal(C.regionalCandidates([{code:'MYCODE',source:'manual'}],'AU')[0].country,'AU');
});
test('cache source and observed country must match the requested market',()=>{
  const entry={country:'US',source:C.markets.US.source,collectedAt:'2026-10-27T00:00:00Z',expiresAt:'2026-10-29T00:00:00Z',codes:['GOLDUS']};
  const feed={schema:1,regions:{AU:entry}};const now=Date.parse('2026-10-28T00:00:00Z');
  assert.deepEqual(C.cachedOffers(feed,'AU',now),[]);
  entry.country='AU';assert.deepEqual(C.cachedOffers(feed,'AU',now),[]);
});
test('missing or conflicting delivery country stops before coupon changes',async()=>{
  const a=fake();a.state.country=null;
  await assert.rejects(C.scan(a,['CODE10']),/COUNTRY_UNKNOWN/);
  a.state.country='AU';a.state.regionConflict=true;
  await assert.rejects(C.scan(a,['CODE10']),/COUNTRY_CONFLICT/);assert.equal(a.calls.length,0);
});
test('country change invalidates a saved result even when currency stays USD',async()=>{
  const a=fake({prices:{GOOD20:{total:8000,status:'accepted'}}});a.state.currency='USD';
  const r=await C.scan(a,['GOOD20']);a.state.country='SG';
  await assert.rejects(C.apply(a,r),/STALE_RESULT/);
});
test('cashback is scoped by both delivery and explicitly chosen account market',()=>{
  assert.equal(C.cashbackFor('AU','AU').url,'https://www.shopback.com.au/iherb');
  assert.equal(C.cashbackFor('SG','SG').url,'https://www.shopback.sg/iherb');
  for(const pair of [['AU','SG'],['SG','AU'],['AU',''],['US','US'],['GB','AU']])assert.equal(C.cashbackFor(...pair),null);
});
test('official page country is read from the actual selector, not host, currency or language',()=>{
  const html='<button class="selected-country-wrapper"><span>SG</span><span>EN</span><span>USD</span></button>';
  assert.equal(C.pageCountry(html),'SG');assert.equal(C.pageCountry('AU USD https://au.iherb.com'),null);
  assert.equal(C.deliveryCountry('Ship to Australia, 3149'),'AU');assert.equal(C.deliveryCountry('配送到新加坡'),'SG');
});
