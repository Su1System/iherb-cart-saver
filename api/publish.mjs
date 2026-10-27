import {timingSafeEqual} from 'node:crypto';
import {publishFeed} from '../server/service.mjs';
export default {async fetch(request){
  const expected=process.env.CRON_SECRET?Buffer.from('Bearer '+process.env.CRON_SECRET):null;
  const actual=Buffer.from(request.headers.get('authorization')||'');
  if(request.method!=='POST'||!expected||actual.length!==expected.length||!timingSafeEqual(actual,expected))return new Response('Unauthorized',{status:401});
  if(!request.headers.get('content-type')?.includes('application/json'))return new Response('JSON required',{status:415});
  if(Number(request.headers.get('content-length'))>65536)return new Response('Too large',{status:413});
  try{
    const reader=request.body.getReader();let size=0,parts=[];
    while(true){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>65536){await reader.cancel();return new Response('Too large',{status:413});}parts.push(Buffer.from(p.value));}
    const feed=await publishFeed(JSON.parse(Buffer.concat(parts).toString('utf8')));
    return Response.json(feed,{headers:{'Cache-Control':'no-store'}});
  }catch(e){return Response.json({error:e.message==='NO_FRESH_OFFERS'?e.message:'PUBLISH_FAILED'},{status:400,headers:{'Cache-Control':'no-store'}});}
}};
