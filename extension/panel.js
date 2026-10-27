(function(root){
  'use strict';
  if(document.getElementById('iherb-cart-saver')){document.getElementById('iherb-cart-saver').hidden=false;return;}
  const C=root.IHerbSaverCore, A=root.IHerbSaverAdapter;
  let zh=root.__IHERB_SAVER_LANG__==='zh', report=null, busy=false, cancel=false, sourceNote='';
  const translations=new Map();
  const t=(cn,en)=>{translations.set(cn,[cn,en]);translations.set(en,[cn,en]);return zh?cn:en;};
  const host=document.createElement('div');host.id='iherb-cart-saver';
  host.style.cssText='position:fixed;right:24px;top:24px;z-index:2147483647;width:min(390px,calc(100vw - 32px));';
  const shadow=host.attachShadow({mode:'open'});
  // Static markup only. Merchant content and codes are always rendered with textContent.
  shadow.innerHTML=`<style>
    :host{font:14px/1.55 system-ui,-apple-system,sans-serif;color:#19392d;color-scheme:light}*{box-sizing:border-box}
    .panel{background:#fbfcf7;border:1px solid #d4ddcf;border-radius:20px;box-shadow:0 16px 60px #182c2333;overflow:hidden}
    header{display:flex;align-items:center;padding:19px 22px 13px;gap:10px}.brand{font-size:11px;letter-spacing:1.3px;font-weight:800;flex:1}
    .badge{background:#e5edda;border-radius:4px;padding:2px 5px;font-size:9px;letter-spacing:.6px}.icon{background:none;border:0;color:#546458;font:14px system-ui;cursor:pointer;padding:5px}
    main{padding:4px 22px 22px;max-height:calc(100vh - 130px);overflow:auto}h1{font-size:26px;line-height:1.25;letter-spacing:-.8px;margin:8px 0 10px}p{margin:8px 0;color:#617064}
    .total{background:#edf2e6;border:1px solid #e0e7d8;border-radius:13px;padding:17px;margin:18px 0 12px}.caption{font-size:12px;color:#617064}.amount{font-size:34px;letter-spacing:-1.3px;font-weight:750;line-height:1.35}.was{text-decoration:line-through;color:#77816f;font-size:14px;margin-right:8px}.saving{font-size:13px;font-weight:700;color:#2a5c32;margin-top:6px}
    button.primary{display:block;width:100%;padding:14px;border:0;border-radius:11px;background:#244e39;color:white;font:700 14px system-ui;cursor:pointer;margin-top:14px}button.primary:hover{background:#163d29}button.primary:disabled{opacity:.55;cursor:wait}
    button.secondary{background:none;border:1px solid #cbd7c3;color:#31573b;width:100%;border-radius:10px;padding:9px;cursor:pointer;margin-top:8px;font:13px system-ui}
    button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #b1c774;outline-offset:2px}
    .hint{font-size:11px;line-height:1.6;margin:11px 0;color:#73806d}.status{font-size:12px;padding:10px 12px;border-radius:8px;background:#f0f2e9;min-height:38px}.status.error{background:#fff0e2;color:#8f4618}
    details{border-top:1px solid #e1e7d9;margin-top:18px;padding-top:12px}summary{cursor:pointer;font-size:12px;font-weight:650;color:#51634f}.row{padding:10px 0;border-bottom:1px solid #e4e9dd}.rowhead{display:flex;justify-content:space-between;gap:10px;font-size:12px}.row strong{font-size:12px}.merchant{font-size:11px;line-height:1.5;margin:5px 0;color:#72806b;overflow-wrap:anywhere}
    .advice{background:#f3f0df;border-left:3px solid #aab66a;padding:11px 12px;border-radius:6px;margin-top:10px;font-size:12px;color:#4e583d}.advice strong{display:block;margin-bottom:4px}.advice a,a{color:#3e643f;text-decoration:underline}input{width:100%;background:white;border:1px solid #cbd7c3;border-radius:8px;padding:10px;margin-top:10px;font:13px system-ui}.foot{font-size:10px;color:#86907d;margin-top:16px}.hidden{display:none!important}
    @media(max-width:500px){:host{font-size:13px}.amount{font-size:29px}}
  </style><section class="panel" role="dialog" aria-label="Cart Saver"><header><span class="brand">↘ CART SAVER</span><span class="badge">OPEN SOURCE</span><button class="icon" id="lang" aria-label="Change language">中</button><button class="icon" id="close" aria-label="Close">×</button></header><main>
    <h1 id="heading"></h1><p id="subheading"></p><p class="hint" id="region"></p>
    <div class="total"><div class="caption" id="total-label"></div><div><span class="was hidden" id="was"></span><span class="amount" id="total">—</span></div><div class="saving" id="saving"></div></div>
    <div class="status" id="status" role="status" aria-live="polite"></div>
    <button class="primary" id="check"></button><button class="primary hidden" id="apply"></button><button class="secondary hidden" id="cancel"></button>
    <p class="hint" id="hint"></p><div id="advice"></div>
    <details id="cashback"><summary id="cashback-label"></summary><p class="merchant" id="cashback-text"></p><label class="merchant" for="cashback-market" id="cashback-market-label"></label><select id="cashback-market" style="width:100%;padding:9px;margin:6px 0;border:1px solid #cbd7c3;border-radius:8px;background:white;color:#19392d"><option value=""></option><option value="AU"></option><option value="SG"></option><option value="OTHER"></option></select><p class="merchant" id="cashback-eligibility"></p><a id="cashback-link" class="hidden" target="_blank" rel="noopener noreferrer"></a><p class="hint" id="cashback-note"></p></details>
    <details id="results" class="hidden"><summary id="results-label"></summary><div id="rows"></div></details>
    <p class="hint" id="source-note"></p>
    <details><summary id="manual-label"></summary><input id="manual" maxlength="190" placeholder="CODE1, CODE2" aria-label="Additional coupon codes"><p class="hint" id="manual-hint"></p></details>
    <div class="foot" id="foot"></div>
  </main></section>`;
  document.documentElement.append(host);
  const $=id=>shadow.getElementById(id);
  function labels(){
    $('heading').textContent=t('这单，还能省多少？','Your cart. A better total.');
    $('subheading').textContent=t('试过的优惠，才算数。','Real cart totals. No guesswork.');
    $('total-label').textContent=t('当前购物车总价','Current cart total');
    $('check').textContent=t('检查优惠','Check savings');
    $('apply').textContent=t('一键应用','Apply this code');
    $('cancel').textContent=t('停止并还原','Stop & restore');
    $('hint').textContent=t('检查会暂时替换优惠码，完成后还原。请保持购物车不变；商品、数量和付款由你决定。','Checking temporarily switches codes, then restores yours. Keep the cart unchanged. You control items and payment.');
    $('results-label').textContent=t('查看实测结果','See tested codes');
    $('manual-label').textContent=t('我还有其他优惠码','Have another code?');
    $('manual-hint').textContent=t('可选，用逗号分隔；最多检查 6 个。','Optional. Separate with commas; up to 6 codes.');
    $('cashback-label').textContent=t('还可以查 Cashback，由你决定','Optional: check cashback');
    $('cashback-text').textContent=t('返现比例和适用条件会变，尚未计入上方节省金额。先比较折扣码与返现哪种更划算。','Rates and eligibility change. Cashback is not included in savings above. Compare the coupon and cashback routes before choosing.');
    $('cashback-market-label').textContent=t('你的 Cashback 账户所属市场','Your cashback account market');
    const opts=$('cashback-market').options;
    opts[0].textContent=t('请选择账户所属市场','Choose your account market');
    opts[1].textContent=t('澳洲','Australia');opts[2].textContent=t('新加坡','Singapore');opts[3].textContent=t('其他 / 尚未注册','Other / no account yet');
    $('cashback-note').textContent=t('非 ShopBack 列出的码可能使返现失效，自动订阅订单也可能被排除。按返现平台指引激活后，避免再次试码或切换推广链接。是否启用由你决定。','Unlisted promo codes and autoship orders can be excluded. Follow the cashback provider’s activation steps; avoid further code tests or referral-link changes after activation.');
    $('foot').textContent=t('独立开源项目 · 无推广码植入 · 按购物车当前配送与税费计算','Independent & open source · No affiliate injection · Uses current cart shipping & tax');
    $('lang').textContent=zh?'English':'中文';
    shadow.querySelector('.panel').lang=zh?'zh-CN':'en';
    renderRegion();
  }
  function renderRegion(){
    const s=A.currencyInfo(), name=C.markets[s.country]?.[zh?'zh':'en']||s.country;
    $('region').textContent=s.regionConflict?t('收货国家与网站地区不一致，请在 iHerb 核对。','Delivery country and site setting disagree. Check your iHerb destination.'):
      name?t(`收货地区：${name} · 币种：${s.currency||'未知'}`,`Delivery: ${name} · Currency: ${s.currency||'unknown'}`):t('请先在 iHerb 选择收货国家。','Set your delivery country on iHerb first.');
    const account=$('cashback-market').value;
    const provider=!s.regionConflict&&C.cashbackFor(s.country,account);
    $('cashback-link').classList.toggle('hidden',!provider);
    if(provider){
      $('cashback-link').href=provider.url;
      $('cashback-link').textContent=t(`查看 ${provider.name} 的最新条款 ↗`,`Check ${provider.name} terms ↗`);
      $('cashback-eligibility').textContent=t(`该入口要求从 ${provider.store} 下单并寄到${name}。请核对账户资格及优惠码能否叠加，当前返现未激活。`,`This offer requires ordering on ${provider.store} and shipping to ${name}. Check account eligibility and permitted codes. Cashback has not been activated.`);
    }else{
      $('cashback-link').removeAttribute('href');
      $('cashback-eligibility').textContent=!account?t('确认账户市场后，显示匹配的返现入口。','Choose your account market to see a matching cashback option.'):
        t('尚无已核实匹配此收货国家与账户市场的返现入口。','No verified cashback option for this delivery country and account market yet.');
    }
  }
  const errors={
    NOT_CART:['请先打开 iHerb 购物车。','Open an iHerb cart first.'],
    LAYOUT_CHANGED:['暂时无法识别页面，请刷新购物车后再试。','Cart layout not recognized. Refresh the page and try again.'],
    CART_EMPTY:['先把要买的商品放进购物车。','Add your items to the cart first.'],
    TOTAL_UNKNOWN:['尚未读到完整总价，请等购物车加载完成。','Wait for the cart total to finish loading.'],
    ITEMS_UNKNOWN:['无法确认商品数量，本次没有继续试码。','Could not verify item quantities. Checking stopped.'],
    SHIPPING_UNKNOWN:['请先在购物车选好配送地区，显示运费后再检查。','Set your shipping destination so the cart shows delivery costs.'],
    TAX_UNKNOWN:['税费尚未明确，暂不把商品折扣当作最终节省。','Tax is not available yet. Final savings cannot be verified.'],
    CURRENCY_UNSUPPORTED:['本版支持 AUD、USD、SGD；其他币种尚未适配。','This beta supports AUD, USD and SGD. Other currencies are not supported yet.'],
    COUNTRY_UNKNOWN:['无法确认收货国家，请先在 iHerb 选择。','Choose a delivery country on iHerb before checking codes.'],
    COUNTRY_CONFLICT:['收货国家与网站地区不一致，请先在 iHerb 核对。','Delivery country and site setting disagree. Resolve this on iHerb first.'],
    MULTIPLE_CODES:['你正在使用多码组合，先保留原优惠；本版暂不自动替换。','Your cart has multiple codes. This beta preserves that combination.'],
    CODE_UNKNOWN:['无法确认原优惠码，已停止。','Could not identify the original code. Checking stopped.'],
    NO_CODES:['当前没有找到其他候选码，可展开下方填写你找到的码。','No additional codes found. You can add your own below.'],
    STALE_RESULT:['购物车或价格变了，请重新检查后应用。','Your cart changed. Check again before applying.'],
    CART_CHANGED:['购物车发生变化，已停止检查。','Cart changed during checking. Stopped.'],
    CART_CHANGED_RESTORE_SKIPPED:['商品、数量或配送发生变化，已停止。请核对网站优惠码栏后重新检查。','Items or delivery changed. Check the site’s code field before restarting.'],
    RESTORE_UNCONFIRMED:['原优惠未能确认恢复，请核对网站总价和优惠码后再付款。','Could not confirm restoration. Review the site’s code and total before paying.'],
    RESPONSE_TIMEOUT:['网站没有返回明确结果，未将这个码计为优惠。请检查原码是否已还原。','No clear site response. No saving counted. Check that your original code is restored.'],
    SITE_CHALLENGE:['网站要求人工验证，请在 iHerb 完成后再试。','Complete the site verification on iHerb, then try again.'],
    PRICE_CHANGED:['重新应用时价格变了，已尝试还原；请重新检查。','Price changed on reapplication. Restored when possible; check again.'],
    NO_BETTER_CODE:['已测试的码没有更低总价，保留当前优惠。','No tested code improves your current total.'],
    INPUT_PENDING:['优惠码输入框里还有未提交的文字，请先处理再检查。','Finish or clear the code already typed into the site before checking.']
  };
  function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
  function fail(e){const pair=errors[e.message];status(pair?t(...pair):t('检查未完成，请核对网站优惠码与总价。','Check incomplete. Review the site’s code and total.'),true);}
  function beforeLeave(e){if(busy){e.preventDefault();e.returnValue='';}}
  window.addEventListener('beforeunload',beforeLeave);
  function controls(){
    $('check').disabled=busy;$('manual').disabled=busy;$('lang').disabled=busy;$('cashback-market').disabled=busy;
    $('check').className=report?.best?'secondary':'primary';
    $('check').textContent=report?t('重新检查','Check again'):t('检查优惠','Check savings');
    $('apply').classList.toggle('hidden',busy||!report?.best);
    $('cancel').classList.toggle('hidden',!busy);
  }
  function renderReport(){
    if(!report)return;
    const fmt=n=>C.formatMoney(n,report.original.currency);
    $('total-label').textContent=report.best?t('已实测的最低总价','Lowest tested total'):t('保留当前购物车总价','Keep your current total');
    $('total').textContent=fmt(report.best?.totalCents??report.original.totalCents);
    $('was').textContent=fmt(report.original.totalCents);$('was').classList.toggle('hidden',!report.best);
    $('saving').textContent=report.best?t(`比检查前再省 ${fmt(report.savingsCents)}`,`Save ${fmt(report.savingsCents)} more than before`):t('没有更低价，也会如实告诉你。','No better price found among tested codes.');
    $('apply').textContent=report.best?t(`应用 ${report.best.code} · 省 ${fmt(report.savingsCents)}`,`Apply ${report.best.code} · save ${fmt(report.savingsCents)}`):'';
    $('rows').replaceChildren();
    for(const r of report.results){
      const row=document.createElement('div');row.className='row';
      const head=document.createElement('div');head.className='rowhead';
      const code=document.createElement('strong');code.textContent=r.code;
      const outcome=document.createElement('span');outcome.textContent=r.status==='accepted'?fmt(r.totalCents):t('这单不适用','Not eligible');
      head.append(code,outcome);row.append(head);
      const msg=document.createElement('p');msg.className='merchant';msg.textContent=r.message||t('网站未说明原因','No reason provided by the site');row.append(msg);
      const source=document.createElement('p');source.className='merchant';
      const label=(r.source==='manual'?t('来源：你提供的码','Source: your code'):t('来源：iHerb 官网','Source: iHerb official page'))+' · '+r.country+' · '+(r.cached?t('采集于 ','Collected ')+new Date(r.collectedAt).toLocaleString():new Date(report.checkedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));
      if(Object.values(C.markets).some(m=>m.source===r.source)){
        const link=document.createElement('a');link.href=r.source;link.target='_blank';link.rel='noopener noreferrer';link.textContent=label;source.append(link);
      }else source.textContent=label;
      row.append(source);
      $('rows').append(row);
    }
    $('results').classList.remove('hidden');$('advice').replaceChildren();
    for(const a of C.advice(report)){
      if(a.kind==='keep') continue;
      const box=document.createElement('div');box.className='advice';
      const title=document.createElement('strong'),body=document.createElement('span');
      title.textContent=t('还可以这样买','Another way to save');
      if(a.kind==='verified'){
        title.textContent=t('已验证的替代方案','Verified alternative');
        body.textContent=t(`换用 ${a.code}，这单总价 ${fmt(a.amount)}。`,`Use ${a.code}: this cart totals ${fmt(a.amount)}.`);
      }else if(a.kind==='minimum') body.textContent=t('有的码没达到门槛。先看已测过的其他码；只有本来就要补货时，才考虑合单，别为折扣多买。','Some codes require a higher eligible spend. Try a verified alternative; combine only items you already need.');
      else if(a.kind==='split') body.textContent=t(`这个码只覆盖部分商品。不适用：${a.excluded.join('、')}。可把适用商品单独下单，剩余商品另用优惠；两单运费和下次价格尚未核实，暂不计入节省。`,`This code covers part of the cart. Excluded: ${a.excluded.join(', ')}. Consider a separate order for eligible items; shipping on both orders and later prices must be checked first.`);
      else if(a.kind==='new-customer') body.textContent=t('新客码不适用时，试上方已验证的老客优惠；不必为了折扣注册新账户。','If a new-customer code is unavailable, use a tested returning-customer offer above.');
      else if(a.kind==='app-only') body.textContent=t('这是 App 专享优惠。可以在 iHerb App 核对同一购物车总价，再决定是否在那里付款。','This is an app-only offer. Compare the same cart total in the iHerb app before deciding.');
      else body.textContent=t('部分品牌或商品可能被排除。优先选上方已验证的其他码；也可等品牌促销，或手动核对同规格商品，价格未验证前不算节省。','Some brands or products are excluded. Prefer a tested alternative, or check a brand sale or matching product; unverified prices are not counted as savings.');
      box.append(title,body);$('advice').append(box);
    }
  }
  async function collect(country){
    sourceNote='';
    const manual=$('manual').value.split(/[\s,，;；]+/).map(C.normalizeCode).filter(C.validCode);
    const local=A.extractOffers(document,'cart',country); let official=[];
    if(!root.__IHERB_SAVER_TEST__ && typeof chrome!=='undefined' && chrome.runtime?.id){
      try{
        const r=await chrome.runtime.sendMessage({type:'officialOffers',country});
        if(r?.ok&&r.country===country&&r.kind==='feed'){
          official=r.offers;
          sourceNote=r.refreshError?t('自动更新暂时失败，使用仍未过期的已采集优惠；候选码会逐一实测。','Automatic refresh is temporarily unavailable. Using previously collected, unexpired offers; each code is still tested.'):
            t('优惠库已自动同步，无需手动找码。每个码的来源和采集时间见实测结果。','Offers sync automatically. Sources and collection times appear with each tested code.');
        }
        else if(r?.ok&&r.country===country){const doc=new DOMParser().parseFromString(r.html,'text/html');official=A.extractOffers(doc,r.source,country);}
        else{
          official=r?.offers||[];
          sourceNote=official.length?t('官方活动页暂不可读，使用 48 小时内采集的官方候选码；有效性仍逐个实测。','Official page unavailable. Using official codes collected within 48 hours; eligibility is still tested live.'):
            t('官方活动页暂不可读，本次仅检查当前页面和你提供的码。','Official page unavailable. Checking only this page and your own codes.');
          if(r?.error==='REGION_UNSUPPORTED') sourceNote=t('该地区的官方采集源尚未接入，本次只查当前购物车和你提供的码。','No official feed for this market yet. Checking only this cart and your own codes.');
        }
      }catch{sourceNote=t('官方来源未读取成功，本次仅检查当前页和你提供的码。','Official source unavailable. Checking this page and your own codes only.');}
    }
    return C.regionalCandidates([...manual.map(code=>({code,country,source:'manual'})),...local,...official],country);
  }
  async function check(){
    if(busy)return;
    busy=true;cancel=false;report=null;controls();$('saving').textContent='';$('was').classList.add('hidden');$('advice').replaceChildren();$('results').classList.add('hidden');
    try{
      if(document.querySelector('#coupon-input')?.value.trim())throw new Error('INPUT_PENDING');
      const original=C.validate(await A.snapshot());
      renderRegion();
      $('total').textContent=C.formatMoney(original.totalCents,original.currency);
      status(t('正在查找官网优惠…','Finding official offers…'));
      const offers=await collect(original.country);
      $('source-note').textContent=sourceNote;
      report=await C.scan(A,offers,{cancelled:()=>cancel,progress:p=>status(p.restoring?t('正在还原原优惠…','Restoring your original code…'):t(`正在核实 ${p.index}/${p.total}：${p.code}`,`Checking ${p.index}/${p.total}: ${p.code}`))});
      renderReport();
      status(report.cancelled?t('已停止，原优惠已还原。','Stopped. Original code restored.'):t('检查完成，原优惠已还原。你选好后再应用。','Checked. Original code restored. Apply when ready.'));
    }catch(e){fail(e);}finally{busy=false;controls();}
  }
  $('check').onclick=check;
  $('cancel').onclick=()=>{cancel=true;status(t('本次响应结束后还原，请稍候…','Restoring after the current response…'));};
  $('apply').onclick=async()=>{
    if(busy||!report?.best)return;
    busy=true;controls();status(t('正在应用并核对总价…','Applying and verifying the total…'));
    try{const applied=await C.apply(A,report);status(t(`已应用 ${report.best.code}，总价 ${C.formatMoney(applied.totalCents,applied.currency)}。`,`Applied ${report.best.code}. Total ${C.formatMoney(applied.totalCents,applied.currency)}.`));report=null;}
    catch(e){report=null;fail(e);}finally{busy=false;controls();}
  };
  $('close').onclick=()=>{if(busy){cancel=true;status(t('请等原优惠还原后关闭。','Wait for the original code to be restored.'));}else host.hidden=true;};
  $('lang').onclick=()=>{
    zh=!zh;root.__IHERB_SAVER_LANG__=zh?'zh':'en';
    for(const id of ['status','source-note','saving']){
      const pair=translations.get($(id).textContent);if(pair)$(id).textContent=t(...pair);
    }
    labels();renderReport();controls();
    document.dispatchEvent(new CustomEvent('cart-saver-language',{detail:zh?'zh':'en'}));
    savePreferences({language:zh?'zh':'en'});
  };
  function savePreferences(value){
    if(!root.__IHERB_SAVER_TEST__&&typeof chrome!=='undefined'&&chrome.runtime?.id)chrome.runtime.sendMessage({type:'preferences',value}).catch(()=>{});
  }
  $('cashback-market').onchange=()=>{renderRegion();savePreferences({cashbackMarket:$('cashback-market').value});};
  labels();
  try{const s=A.snapshot();$('total').textContent=C.formatMoney(s.totalCents,s.currency);}catch{}
  status(t('一键核实这单能用的优惠。','Check what works for this cart.'));
  let regionKey=JSON.stringify(A.currencyInfo());
  const regionObserver=new MutationObserver(()=>{
    const next=JSON.stringify(A.currencyInfo());
    if(next===regionKey)return;
    regionKey=next;report=null;cancel=true;renderRegion();controls();
    $('apply').classList.add('hidden');$('results').classList.add('hidden');$('advice').replaceChildren();$('saving').textContent='';$('was').classList.add('hidden');
    $('total').textContent='—';$('total-label').textContent=t('需要重新检查','Check required');
    status(t('收货地区或币种已变化，请重新检查优惠。','Delivery market or currency changed. Check savings again.'));
  });
  regionObserver.observe(document.body,{subtree:true,childList:true,characterData:true});
  // Clicking "Check my cart" in the extension popup is the explicit start action.
  if(!root.__IHERB_SAVER_TEST__){
    (async()=>{
      try{
        const p=await chrome.runtime.sendMessage({type:'preferences'});
        zh=p?.language==='zh';
        if(['AU','SG','OTHER'].includes(p?.cashbackMarket))$('cashback-market').value=p.cashbackMarket;
        labels();
      }catch{}
      check();
    })();
  }
})(globalThis);
