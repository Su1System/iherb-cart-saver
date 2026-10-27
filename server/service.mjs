import {getCache} from '@vercel/functions';
import core from '../extension/core.js';
import feedClient from '../extension/feed-client.js';
import seed from '../extension/offers.json' with {type:'json'};
import {fetchOrigin} from './origin.mjs';

const cache=getCache({namespace:'iherb-cart-saver-feed-v1'});
export async function getFeed(){
  // Public reads never call a paid collector. Vultr refreshes independently.
  const origin=process.env.IHERB_ORIGIN_URL,ca=process.env.IHERB_ORIGIN_CA;
  if(origin&&Date.now()>(await cache.get('origin-next-check')||0)){
    try{
      const incoming=await fetchOrigin(origin,ca);
      feedClient.sanitize(incoming);
      if(Object.keys(incoming.regions).length)await publishFeed(incoming);
      await cache.set('origin-next-check',Date.now()+300000,{ttl:300});
    }catch(e){
      console.error('offer-origin-refresh-failed',e.message);
      await cache.set('origin-next-check',Date.now()+60000,{ttl:60});
    }
  }
  return prune(await cache.get('official-feed')||seed);
}
export async function publishFeed(incoming){
  const now=Date.now(), clean=feedClient.sanitize(incoming,now);
  if(!Object.keys(clean.regions).length)throw new Error('NO_FRESH_OFFERS');
  const prior=await cache.get('official-feed')||seed;
  const feed={...feedClient.merge(prior,clean,now),generatedAt:new Date(now).toISOString(),status:{}};
  for(const country of Object.keys(core.markets)){
    const e=feed.regions[country];
    const updated=e&&e.collectedAt===clean.regions[country]?.collectedAt;
    feed.status[country]={state:updated&&incoming.status?.[country]?.state==='ok'?'ok':e?'retained':'unavailable',checkedAt:incoming.status?.[country]?.checkedAt||null};
  }
  await cache.set('official-feed',feed,{ttl:172800});
  return prune(feed,now);
}
export function prune(feed,now=Date.now()){
  const regions={};for(const country of Object.keys(core.markets))if(core.cachedOffers(feed,country,now).length)regions[country]=feed.regions[country];
  return {...feed,regions};
}
