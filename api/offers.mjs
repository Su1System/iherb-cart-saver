import {getFeed} from '../server/service.mjs';
export default {async fetch(request){
  if(request.method!=='GET')return new Response('Method not allowed',{status:405});
  try{
    const feed=await getFeed();
    return Response.json(feed,{status:Object.keys(feed.regions).length?200:503,headers:{'Cache-Control':'public, max-age=300','Vercel-CDN-Cache-Control':'public, s-maxage=300','Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff'}});
  }catch(e){console.error('offer-feed-service-failed',e.name);return Response.json({error:'FEED_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});}
}};
