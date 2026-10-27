/* Explicit simulation, shared by the interactive demo and deterministic DOM tests. */
globalThis.__IHERB_SAVER_TEST__=true;
const sampleItems=[
  {id:'438',name:'NOW C-500 Calcium Ascorbate · 250 capsules',qty:1,price:'A$30.04',eligible:true},
  {id:'101384',name:'Thorne Zinc Bisglycinate · 15 mg · 60 capsules',qty:3,price:'A$65.70',eligible:true},
  {id:'47806',name:'Life Extension Citicoline · 250 mg · 60 capsules',qty:5,price:'A$195.45',eligible:false},
  {id:'146618',name:'Force Factor TMG · 180 capsules',qty:1,price:'A$34.27',eligible:false}
];
const itemList=document.getElementById('items');
for(const item of sampleItems){
  const div=document.createElement('div');div.className='item';div.setAttribute('data-qa-element','line-item');
  const bottle=document.createElement('div');bottle.className='bottle';const body=document.createElement('div');
  const link=document.createElement('a');link.href='https://au.iherb.com/pr/sample/'+item.id;link.textContent=item.name;link.setAttribute('data-qa-element','product-item-title');
  const qty=document.createElement('small');qty.textContent='Quantity ';const count=document.createElement('span');count.setAttribute('data-qa-element','product-quantity-select');count.textContent=item.qty;qty.append(count);
  const price=document.createElement('small');price.textContent=item.price;const effect=document.createElement('small');effect.className='effect';
  body.append(link,qty,price,effect);div.append(bottle,body);itemList.append(div);
}
const q=(s)=>document.querySelector(`[data-qa-element="${s}"]`);
globalThis.fixtureCalls=[];
globalThis.fixtureDelay=280;
let fixtureCountry='AU',fixtureCurrency='AUD',fixtureBestCode='GOLDAU';
const fixtureMoney=n=>(fixtureCurrency==='AUD'?'A$':fixtureCurrency==='SGD'?'S$':'US$')+n;
function setSample(code){
  const result=document.getElementById('promo-result');result.replaceChildren();
  const accepted=['OCT26DAILY',fixtureBestCode].includes(code);
  let message=code==='OCT26DAILY'?'20% applies to eligible items only. Some brands are excluded.':code===fixtureBestCode?'Save '+fixtureMoney('32.55')+' with discounts applied!':'This code has expired.';
  if(code){
    const wrap=document.createElement('div');wrap.className='promo-chip';
    const remove=document.createElement('button');remove.textContent='×';remove.setAttribute('data-qa-element','remove-code-btn');remove.onclick=()=>{fixtureCalls.push('');updateSample('');};
    const head=document.createElement('div');const name=document.createElement('span');name.textContent=code;const status=document.createElement('span');status.setAttribute('data-qa-element','discount-display');status.textContent=accepted?'applied':'not applied';head.append(name,status);
    const msg=document.createElement('div');msg.setAttribute('data-qa-element','discount-message');msg.textContent=message;wrap.append(remove,head,msg);result.append(wrap);
  }
  q('total-price').textContent=fixtureMoney(code==='OCT26DAILY'?'306.31':code===fixtureBestCode?'292.91':'325.46');
  document.querySelectorAll('.effect').forEach((e,i)=>{
    e.removeAttribute('data-qa-element');e.textContent='';
    if(accepted){const yes=code===fixtureBestCode||sampleItems[i].eligible;e.textContent=yes?'Discount applied':'Not eligible';e.setAttribute('data-qa-element',(yes?'discount-item-':'warning-msg-promo-')+sampleItems[i].id);}
  });
}
function updateSample(code){
  const button=document.getElementById('coupon-apply');button.disabled=true;
  setTimeout(()=>{setSample(code);button.disabled=false;document.getElementById('coupon-input').value='';},fixtureDelay);
}
globalThis.fixtureBlocked=0;
document.getElementById('coupon-apply').onclick=()=>{
  const c=document.getElementById('coupon-input').value.toUpperCase().trim();
  // Live AU behavior: a second code does not simply replace the first.
  if(q('discount-display')){fixtureBlocked++;return;}
  fixtureCalls.push(c);updateSample(c);
};
document.getElementById('reset').onclick=()=>location.reload();
setSample('OCT26DAILY');
document.getElementById('demo-market').onchange=e=>{
  fixtureCountry=e.target.value.split('_')[0];fixtureCurrency=e.target.value==='AU'?'AUD':fixtureCountry==='SG'?'SGD':'USD';
  fixtureBestCode='GOLD'+fixtureCountry;
  document.querySelector('.selected-country-wrapper').textContent=fixtureCountry+' EN '+fixtureCurrency;
  const names={AU:'Australia',SG:'Singapore',US:'United States'};
  q('cart-shipping-destination').textContent='Ship to '+names[fixtureCountry];
  q('items-total').textContent=fixtureMoney('325.46');
  document.querySelectorAll('.item').forEach((el,i)=>{el.querySelectorAll('small')[1].textContent=fixtureMoney(sampleItems[i].price.replace('A$',''));});
  q('auto-apply-message-panel').textContent='Save 10% with code '+fixtureBestCode;
  for(const link of document.querySelectorAll('.source')){const u=new URL(link.href);u.hostname=(fixtureCountry==='US'?'www':fixtureCountry.toLowerCase())+'.iherb.com';link.href=u.href;}
  setSample('OCT26DAILY');
};
document.addEventListener('cart-saver-language',e=>{
  document.documentElement.lang=e.detail==='zh'?'zh-CN':'en';
  for(const el of document.querySelectorAll('[data-en][data-zh]'))el.textContent=el.dataset[e.detail];
  document.querySelectorAll('.item small:first-of-type').forEach((el,i)=>{el.firstChild.textContent=e.detail==='zh'?'数量 ':'Quantity ';});
});
