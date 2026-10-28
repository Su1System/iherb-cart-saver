const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../extension/popup.js'),'utf8');
const settle=()=>new Promise(resolve=>setImmediate(resolve));

// Exercise the shipped popup controller without requiring Chrome's native toolbar.
// Browser integration of the injected scripts is covered by extension_test.py.
function popup(url,{language='en',inject=async()=>{}}={}){
  const elements=new Map(), calls={scripts:[],tabs:[],closed:0,prefs:[]};
  const document={documentElement:{},querySelector(selector){
    if(!elements.has(selector))elements.set(selector,{textContent:'',disabled:false,addEventListener(event,fn){this['on'+event]=fn;}});
    return elements.get(selector);
  }};
  vm.runInNewContext(source,{document,URL,window:{close(){calls.closed++;}},chrome:{
    storage:{local:{get:async()=>({preferences:{language}})}},
    runtime:{getManifest:()=>({version:'test'}),sendMessage:async value=>{calls.prefs.push(value);}},
    tabs:{query:async()=>[{id:42,url}],create:async value=>{calls.tabs.push(value);}},
    scripting:{executeScript:async value=>{calls.scripts.push(value);await inject(value);}}
  }});
  return {calls,el:selector=>document.querySelector(selector)};
}

test('cart icon immediately injects bundled checker once, with stored language',async()=>{
  for(const host of ['au','www','sg','checkout','checkout6']){
    const p=popup(`https://${host}.iherb.com/cart?x=1`,{language:'zh'});await settle();
    assert.equal(p.calls.scripts.length,2);
    assert.equal(p.calls.scripts[0].target.tabId,42);
    assert.equal(p.calls.scripts[0].args[0],'zh');
    assert.equal(Array.from(p.calls.scripts[1].files).join(','),'core.js,adapter.js,panel.js');
    assert.equal(p.calls.closed,1);assert.equal(p.calls.tabs.length,0);
  }
});

test('other pages offer a cart link; no code injection or navigation until clicked',async()=>{
  for(const url of ['https://au.iherb.com/pr/item/438','https://example.com/cart','https://www.iherb.com.evil.example/cart','http://au.iherb.com/cart','chrome://newtab/']){
    const p=popup(url);await settle();
    assert.equal(p.el('#open').textContent,'Open iHerb cart');
    assert.equal(p.calls.scripts.length,0);assert.equal(p.calls.tabs.length,0);
    await p.el('#open').onclick();
    assert.equal(p.calls.tabs[0].url,'https://www.iherb.com/cart');
    assert.equal(p.calls.closed,1);assert.equal(p.calls.scripts.length,0);
  }
});

test('injection failure stops with a usable retry, not an automatic retry loop',async()=>{
  let fail=true;
  const p=popup('https://au.iherb.com/cart',{inject:async()=>{if(fail)throw new Error('not ready');}});await settle();
  assert.equal(p.calls.scripts.length,1);assert.equal(p.calls.closed,0);
  assert.equal(p.el('#open').textContent,'Try again');assert.equal(p.el('#open').disabled,false);
  assert.match(p.el('#status').textContent,/Refresh your cart/);
  fail=false;await p.el('#open').onclick();
  assert.equal(p.calls.scripts.length,3);assert.equal(p.calls.closed,1);
});

test('repeated click during injection does not start a second check',async()=>{
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const p=popup('https://au.iherb.com/cart',{inject:()=>gate});await settle();
  assert.equal(p.el('#open').disabled,true);await p.el('#open').onclick();
  assert.equal(p.calls.scripts.length,1);
  release();await settle();assert.equal(p.calls.scripts.length,2);assert.equal(p.calls.closed,1);
});

test('off-cart language choice updates simple action and persists through existing preferences',async()=>{
  const p=popup('https://example.com');await settle();await p.el('#language').onclick();
  assert.equal(p.el('#open').textContent,'打开 iHerb 购物车');
  assert.equal(p.calls.prefs[0].value.language,'zh');
  assert.doesNotMatch(p.el('#intro').textContent,/AI key/);
});
