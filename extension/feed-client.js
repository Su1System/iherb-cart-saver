(function(root){
  'use strict';
  const C=typeof module!=='undefined'&&module.exports?require('./core.js'):root.IHerbSaverCore;
  const KEY='officialOfferFeedV1',INTERVAL=6*3600000,RETRY=3600000,MAX_BYTES=65536;
  function sanitize(feed,now=Date.now()){
    if(feed?.schema!==1||!feed.regions||typeof feed.regions!=='object')throw new Error('FEED_SCHEMA');
    const clean={schema:1,regions:{},status:{}};
    for(const country of Object.keys(C.markets)){
      const e=feed.regions[country];
      if(!e||!Array.isArray(e.codes)||!e.codes.length||e.codes.length>20||e.codes.some(c=>!C.validCode(c)))continue;
      if(!C.cachedOffers(feed,country,now).length)continue;
      clean.regions[country]={country,source:e.source,collectedAt:e.collectedAt,expiresAt:e.expiresAt,codes:[...new Set(e.codes)]};
      if(feed.status?.[country]?.state==='retained')clean.status[country]={state:'retained'};
    }
    return clean;
  }
  function merge(prior,incoming,now){
    const clean=sanitize(prior||{schema:1,regions:{}},now),next=sanitize(incoming,now);
    for(const [country,e] of Object.entries(next.regions)){
      if(!clean.regions[country]||Date.parse(e.collectedAt)>=Date.parse(clean.regions[country].collectedAt)){clean.regions[country]=e;delete clean.status[country];if(next.status[country])clean.status[country]=next.status[country];}
    }
    return clean;
  }
  function create({url,storage,fetcher=fetch,now=Date.now}){
    let flight;
    async function refresh(){
      if(flight)return flight;
      flight=(async()=>{
        const time=now();const state=(await storage.get(KEY))[KEY]||{};
        if(state.nextAttemptAt>time)return state;
        try{
          if(!url||new URL(url).protocol!=='https:')throw new Error('FEED_NOT_CONFIGURED');
          const r=await fetcher(url,{credentials:'omit',cache:'no-cache',redirect:'error',signal:AbortSignal.timeout(20000)});
          if(!r.ok)throw new Error('FEED_HTTP_'+r.status);
          if(!r.headers.get('content-type')?.includes('application/json'))throw new Error('FEED_NOT_JSON');
          if(Number(r.headers.get('content-length'))>MAX_BYTES)throw new Error('FEED_TOO_LARGE');
          const reader=r.body.getReader();const decoder=new TextDecoder();let size=0,body='';
          while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>MAX_BYTES){await reader.cancel();throw new Error('FEED_TOO_LARGE');}body+=decoder.decode(part.value,{stream:true});}
          body+=decoder.decode();
          const incoming=sanitize(JSON.parse(body),now());
          if(!Object.keys(incoming.regions).length)throw new Error('FEED_NO_FRESH_DATA');
          const updated={feed:merge(state.feed,incoming,now()),checkedAt:time,nextAttemptAt:time+INTERVAL,error:null};
          await storage.set({[KEY]:updated});return updated;
        }catch(e){
          const failed={...state,checkedAt:time,nextAttemptAt:time+RETRY,error:e.message};
          await storage.set({[KEY]:failed});return failed;
        }
      })();
      try{return await flight;}finally{flight=null;}
    }
    async function offers(country){
      const state=await refresh();return {offers:C.cachedOffers(state.feed,country,now()),checkedAt:state.checkedAt,error:state.error||(state.feed?.status?.[country]?.state==='retained'?'SOURCE_REFRESH_UNAVAILABLE':null)};
    }
    return {refresh,offers};
  }
  const api={KEY,INTERVAL,RETRY,sanitize,merge,create};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.IHerbSaverFeed=api;
})(globalThis);
