'use strict';
let zh=false, activeTab=null, onCart=false, working=false;
function isCart(tab){
  try{const u=new URL(tab?.url);return u.protocol==='https:' && /^(checkout[0-9]*|www|au|sg)\.iherb\.com$/.test(u.hostname) && /^\/cart\/?$/.test(u.pathname);}catch{return false;}
}
function labels(){
  document.documentElement.lang=zh?'zh-CN':'en';
  document.querySelector('#language').textContent=zh?'English':'中文';
  document.querySelector('h1').textContent=zh?'这单，还能省多少？':'Keep the cart. Find the saving.';
  document.querySelector('#intro').textContent=onCart
    ?(zh?'正在打开购物车优惠检查。无需注册。':'Opening your cart check. No signup needed.')
    :(zh?'打开购物车后，点浏览器里的 Cart Saver 图标即可检查优惠。无需注册。':'Open your cart, then click the Cart Saver icon in your browser to check codes. No signup needed.');
  document.querySelector('#open').textContent=working?(zh?'正在打开…':'Opening…'):onCart?(zh?'重试':'Try again'):(zh?'打开 iHerb 购物车':'Open iHerb cart');
  document.querySelector('#feedback').textContent=zh?'反馈问题':'Feedback';
  document.querySelector('#privacy').textContent=zh?'隐私说明':'Privacy';
  document.querySelector('#source').textContent=zh?'源码':'Source';
  document.querySelector('#version').textContent='v'+chrome.runtime.getManifest().version+' beta';
}
document.querySelector('#language').onclick=async()=>{
  zh=!zh;labels();
  await chrome.runtime.sendMessage({type:'preferences',value:{language:zh?'zh':'en'}});
};
async function openCart(){
  if(working)return;
  working=true;labels();document.querySelector('#open').disabled=true;document.querySelector('#language').disabled=true;
  const status=document.querySelector('#status');
  status.textContent='';
  try{
    if(onCart){
      await chrome.scripting.executeScript({target:{tabId:activeTab.id},func:lang=>{globalThis.__IHERB_SAVER_LANG__=lang;},args:[zh?'zh':'en']});
      await chrome.scripting.executeScript({target:{tabId:activeTab.id},files:['core.js','adapter.js','panel.js']});
    }else await chrome.tabs.create({url:'https://www.iherb.com/cart'});
    window.close();
  }catch{status.textContent=onCart?(zh?'页面尚未就绪，请刷新购物车后重试。':'Refresh your cart, then try again.'):(zh?'未能打开购物车，请重试。':'Could not open your cart. Try again.');}
  finally{working=false;labels();document.querySelector('#open').disabled=false;document.querySelector('#language').disabled=false;}
}
document.querySelector('#open').addEventListener('click',openCart);
(async()=>{
  try{
    const [settings,tabs]=await Promise.all([chrome.storage.local.get('preferences'),chrome.tabs.query({active:true,currentWindow:true})]);
    zh=settings.preferences?.language==='zh';activeTab=tabs[0];onCart=isCart(activeTab);
  }catch{}
  labels();document.querySelector('#open').disabled=false;
  if(onCart)await openCart();
})();
