'use strict';
importScripts('core.js','feed-client.js','feed-config.js');
const feedClient=IHerbSaverFeed.create({url:IHerbSaverFeedConfig.url,storage:chrome.storage.local});
const ALARM='refresh-official-offers';
async function setup(){
  await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  if(!await chrome.alarms.get(ALARM))await chrome.alarms.create(ALARM,{periodInMinutes:60});
  await feedClient.refresh();
}
chrome.runtime.onInstalled.addListener(()=>setup().catch(()=>{}));
chrome.runtime.onStartup.addListener(()=>setup().catch(()=>{}));
chrome.alarms.onAlarm.addListener(a=>{if(a.name===ALARM)feedClient.refresh().catch(()=>{});});
setup().catch(()=>{});
const officialSources=Object.fromEntries(Object.entries(IHerbSaverCore.markets).map(([k,v])=>[k,v.source]));
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.type==='preferences'&&sender.id===chrome.runtime.id){
    (async()=>{
      const preferences=(await chrome.storage.local.get('preferences')).preferences||{};
      if(message.value){
        if(['en','zh'].includes(message.value.language))preferences.language=message.value.language;
        if(['','AU','SG','OTHER'].includes(message.value.cashbackMarket))preferences.cashbackMarket=message.value.cashbackMarket;
        await chrome.storage.local.set({preferences});
      }
      reply(preferences);
    })().catch(()=>reply({}));
    return true;
  }
  if(message?.type!=='officialOffers') return;
  const u=new URL(sender.url || 'https://invalid.local');
  if(!sender.tab || u.protocol!=='https:' || !/^(checkout[0-9]*|www|au|sg)\.iherb\.com$/.test(u.hostname) || !/^\/cart\/?$/.test(u.pathname)){
    reply({ok:false,error:'NOT_CART'}); return;
  }
  const source=officialSources[message.country];
  if(!source){reply({ok:false,error:'REGION_UNSUPPORTED'});return;}
  (async()=>{
    try{
      const remote=await feedClient.offers(message.country);
      if(remote.offers.length){reply({ok:true,kind:'feed',country:message.country,offers:remote.offers,checkedAt:remote.checkedAt,refreshError:remote.error});return;}
      const r=await fetch(source,{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(9000)});
      if(!r.ok || !r.headers.get('content-type')?.includes('text/html')) throw new Error('OFFERS_HTTP_'+r.status);
      if(r.url!==source) throw new Error('OFFERS_REDIRECTED');
      const html=await r.text();
      if(html.length>2500000 || /<title[^>]*>\s*(Just a moment|Access Denied)/i.test(html)) throw new Error('OFFERS_UNAVAILABLE');
      if(IHerbSaverCore.pageCountry(html)!==message.country) throw new Error('OFFERS_REGION_MISMATCH');
      reply({ok:true,html,source,country:message.country});
    }catch(e){
      try{
        const feed=await (await fetch(chrome.runtime.getURL('offers.json'))).json();
        const offers=IHerbSaverCore.cachedOffers(feed,message.country);
        reply({ok:false,error:e.message,offers});
      }catch{reply({ok:false,error:e.message,offers:[]});}
    }
  })();
  return true;
});

