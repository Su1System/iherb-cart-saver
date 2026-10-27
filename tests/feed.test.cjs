const {test}=require('node:test');const assert=require('node:assert/strict');
const F=require('../extension/feed-client.js');const C=require('../extension/core.js');
const START=Date.parse('2026-10-28T00:00:00Z');
const entry=(country='AU',at=START)=>({country,source:C.markets[country].source,collectedAt:new Date(at).toISOString(),expiresAt:new Date(at+48*3600000).toISOString(),codes:['CODE20']});
const feed=e=>({schema:1,regions:{[e.country]:e}});
function fixture(fetcher){let clock=START,db={};return {get db(){return db},advance:ms=>clock+=ms,client:F.create({url:'https://feed.example/api/offers',storage:{get:async()=>structuredClone(db),set:async s=>{db={...db,...structuredClone(s)}}},now:()=>clock,fetcher})};}
test('install fetch, six-hour refresh, no cookies or cart data, and concurrent request dedupe',async()=>{
  let calls=0;const a=fixture(async(url,opts)=>{calls++;assert.equal(opts.credentials,'omit');assert.equal(opts.body,undefined);return Response.json(feed(entry()));});
  await Promise.all([a.client.refresh(),a.client.refresh(),a.client.offers('AU')]);assert.equal(calls,1);
  a.advance(5*3600000);await a.client.refresh();assert.equal(calls,1);
  a.advance(3600000);await a.client.refresh();assert.equal(calls,2);
});
test('network failure keeps prior dates; expired records disappear; failed refresh backs off',async()=>{
  let failure=false,calls=0;const a=fixture(async()=>{calls++;if(failure)throw new Error('OFFLINE');return Response.json(feed(entry()));});
  await a.client.refresh();const original=a.db[F.KEY].feed.regions.AU.collectedAt;failure=true;a.advance(6*3600000);
  assert.equal((await a.client.offers('AU')).offers.length,1);assert.equal(a.db[F.KEY].feed.regions.AU.collectedAt,original);
  await a.client.refresh();assert.equal(calls,2);
  a.advance(43*3600000);assert.equal((await a.client.offers('AU')).offers.length,0);
});
test('bad source, wrong region, expired timestamps and executable strings cannot enter a remote feed',()=>{
  for(const patch of [{country:'SG'},{source:'https://example.com'},{expiresAt:new Date(START-1).toISOString()},{codes:['<script>alert(1)</script>']},{collectedAt:new Date(START+1000).toISOString()}]){
    assert.deepEqual(F.sanitize({schema:1,regions:{AU:{...entry(),...patch}}},START).regions,{});
  }
});
test('older download cannot replace a newer region; one failed market does not remove others',()=>{
  const old=feed(entry('AU',START-1000)),current=feed(entry('AU'));
  assert.equal(F.merge(current,old,START).regions.AU.collectedAt,entry().collectedAt);
  assert.deepEqual(Object.keys(F.merge(current,feed(entry('SG')),START).regions).sort(),['AU','SG']);
});
test('oversized/non-JSON or unavailable feeds do not overwrite a valid cached feed',async()=>{
  for(const response of [new Response('blocked',{status:403}),new Response('<html>oops</html>',{headers:{'content-type':'text/html'}}),new Response('x'.repeat(65537),{headers:{'content-type':'application/json'}})]){
    const a=fixture(async()=>response);const state=await a.client.refresh();assert.ok(state.error);assert.equal(state.feed,undefined);
  }
});
