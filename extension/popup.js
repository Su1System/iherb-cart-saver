'use strict';
let zh=false;
function labels(){
  document.documentElement.lang=zh?'zh-CN':'en';
  document.querySelector('#language').textContent=zh?'English':'中文';
  document.querySelector('h1').textContent=zh?'这单，还能省多少？':'Keep the cart. Find the saving.';
  document.querySelector('#intro').textContent=zh?'在你的 iHerb 购物车核实优惠。无需注册或 AI key。':'Check working codes against your iHerb cart. No account. No AI key.';
  document.querySelector('#open').textContent=zh?'检查我的购物车':'Check my cart';document.querySelector('#status').textContent='';
  document.querySelector('#feedback').textContent=zh?'反馈问题':'Feedback';
  document.querySelector('#privacy').textContent=zh?'隐私说明':'Privacy';
  document.querySelector('#source').textContent=zh?'源码':'Source';
  document.querySelector('#version').textContent='v'+chrome.runtime.getManifest().version+' beta';
}
chrome.storage.local.get('preferences').then(s=>{zh=s.preferences?.language==='zh';labels();});
document.querySelector('#language').onclick=async()=>{
  zh=!zh;labels();
  await chrome.runtime.sendMessage({type:'preferences',value:{language:zh?'zh':'en'}});
};
document.querySelector('#open').addEventListener('click',async()=>{
  const status=document.querySelector('#status');
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  let allowed=false;
  try{const u=new URL(tab.url);allowed=u.protocol==='https:' && /^(checkout[0-9]*|www|au|sg)\.iherb\.com$/.test(u.hostname) && /^\/cart\/?$/.test(u.pathname);}catch{}
  if(!allowed){status.textContent=zh?'请先打开 iHerb 购物车，再点这里。':'Open your iHerb cart, then click here.';return;}
  try{
    await chrome.scripting.executeScript({target:{tabId:tab.id},func:lang=>{globalThis.__IHERB_SAVER_LANG__=lang;},args:[zh?'zh':'en']});
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['core.js','adapter.js','panel.js']});
    window.close();
  }catch{status.textContent=zh?'页面尚未就绪，请刷新购物车后重试。':'Refresh your cart, then try again.';}
});
