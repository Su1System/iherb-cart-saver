const {test}=require('node:test');const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');const {Readable}=require('node:stream');
const cert='-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----';
function reply(body,{status=200,type='application/json'}={}){return (url,options,cb)=>{assert.equal(options.rejectUnauthorized,true);assert.equal(options.ca,cert);assert.equal(options.headers.Authorization,undefined);const req=new EventEmitter();req.destroy=()=>{};process.nextTick(()=>{const res=Readable.from([Buffer.from(body)]);res.statusCode=status;res.headers={'content-type':type};cb(res);});return req;};}
test('origin uses certificate verification and only the configured JSON path',async()=>{
  const {fetchOrigin}=await import('../server/origin.mjs');
  assert.deepEqual(await fetchOrigin('https://127.0.0.1:8443/offers.json',cert,reply('{"schema":1}')),{schema:1});
  for(const url of ['http://example.com/offers.json','https://example.com/private','https://u:p@example.com/offers.json','https://example.com/offers.json?key=x'])assert.throws(()=>fetchOrigin(url,cert),/CONFIGURATION/);
});
test('origin rejects redirects, non-JSON and oversized responses',async()=>{
  const {fetchOrigin}=await import('../server/origin.mjs');
  for(const mock of [reply('{}',{status:302}),reply('{}',{type:'text/html'}),reply('x'.repeat(65537)),reply('bad json')])await assert.rejects(fetchOrigin('https://127.0.0.1:8443/offers.json',cert,mock));
});
