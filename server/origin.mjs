import {get} from 'node:https';

export function fetchOrigin(url,ca,request=get){
  const endpoint=new URL(url);
  if(endpoint.protocol!=='https:'||endpoint.pathname!=='/offers.json'||endpoint.search||endpoint.hash||endpoint.username||endpoint.password||!ca?.includes('BEGIN CERTIFICATE'))throw new Error('ORIGIN_CONFIGURATION');
  return new Promise((resolve,reject)=>{
    let settled=false;
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);};
    const timer=setTimeout(()=>{req.destroy();finish(new Error('ORIGIN_TIMEOUT'));},5000);
    const req=request(endpoint,{ca,rejectUnauthorized:true,headers:{Accept:'application/json'}},res=>{
      if(res.statusCode!==200||!res.headers['content-type']?.includes('application/json')){res.resume();finish(new Error('ORIGIN_RESPONSE'));return;}
      let size=0;const chunks=[];
      res.on('data',part=>{size+=part.length;if(size>65536){res.destroy();finish(new Error('ORIGIN_TOO_LARGE'));}else chunks.push(part);});
      res.on('error',()=>finish(new Error('ORIGIN_READ')));
      res.on('end',()=>{try{finish(null,JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{finish(new Error('ORIGIN_JSON'));}});
    });
    req.on('error',()=>finish(new Error('ORIGIN_CONNECT')));
  });
}
