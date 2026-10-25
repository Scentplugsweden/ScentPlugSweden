const cart=JSON.parse(localStorage.getItem('spcart')||'[]');let products=[];let shippingMethod='PostNord-Tracked';let appliedPromo='';const $=s=>document.querySelector(s);const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
const WINTER_CODE='VINTER2026';
function installPromo(){if(document.querySelector('#checkoutPromo'))return;const summary=document.querySelector('.checkoutSummary');if(!summary)return;const box=document.createElement('div');box.id='checkoutPromo';box.className='checkoutPromo';box.innerHTML='<div><small>VINTERKAMPANJ · 2026</small><b>VINTER2026</b></div><button type="button" id="copyWinterCode">Kopiera</button>';const target=summary.querySelector('.summaryLines');(target||summary).before(box);const btn=box.querySelector('#copyWinterCode');const done=()=>{btn.textContent='Kopierad ✓';btn.classList.add('copied');setTimeout(()=>{btn.textContent='Kopiera';btn.classList.remove('copied')},1800)};btn.addEventListener('click',()=>{if(navigator.clipboard?.writeText)navigator.clipboard.writeText(WINTER_CODE).then(done).catch(()=>fallbackCopy(done));else fallbackCopy(done)})}
function fallbackCopy(done){const ta=document.createElement('textarea');ta.value=WINTER_CODE;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done()}finally{ta.remove()}}
async function init(){try{const r=await fetch('/api/products',{cache:'no-store'});if(!r.ok)throw new Error('Kunde inte hämta produkter.');products=await r.json();render();installPromo()}catch(e){showError(e.message)}}
function currentItems(){return cart.map(i=>{const p=products.find(x=>x.id===i.id);const price=Number(p?.sizes?.[i.size]??i.price);return {...i,price,image:p?.image||i.image,name:p?.name||i.name,brand:p?.brand||i.brand}}).filter(i=>Number.isFinite(i.price)&&i.qty>0&&!products.find(p=>p.id===i.id)?.hidden)}
function subtotal(){return currentItems().reduce((s,i)=>s+i.price*Number(i.qty),0)}
function shipCost(){return subtotal()>=499?0:(shippingMethod==='PostNord-Untracked'?39:61)}
function render(){
  const baseItems=currentItems();
  if(!baseItems.length){$('#checkoutForm').classList.add('hidden');$('.checkoutSummary').innerHTML='<div class="summaryHead"><h2>Din order</h2></div><p style="color:#777;line-height:1.6">Din varukorg är tom.</p><a class="backToShop" href="/">← Tillbaka till butiken</a>';return}
  const baseSubtotal=baseItems.reduce((sum,item)=>sum+item.price*Number(item.qty),0);
  const quantity=baseItems.reduce((sum,item)=>sum+Number(item.qty),0);
  const campaignActive=appliedPromo===WINTER_CODE&&quantity>=3;
  const reward=products.find(p=>p.id==='mystery-sample');
  const items=campaignActive?[...baseItems,{id:'mystery-sample',name:reward?.name||'Mystery Sample',brand:reward?.brand||'ScentPlugSweden',size:'1 ml',qty:1,price:49,image:reward?.image||''}]:baseItems;
  const sub=items.reduce((sum,item)=>sum+item.price*Number(item.qty),0);
  const ship=baseSubtotal>=499?0:(shippingMethod==='PostNord-Untracked'?39:61);
  const discount=campaignActive?49:0;
  const tot=sub+ship-discount;
  $('#itemCount').textContent=`${items.reduce((sum,item)=>sum+Number(item.qty),0)} produkter`;
  $('#checkoutItems').innerHTML=items.map(item=>`<div class="checkoutItem"><img src="${esc(item.image)}" alt="${esc(item.name)}"><div><b>${esc(item.name)}</b><small>${esc(item.size)} · ${item.qty} st</small></div><strong>${item.price*Number(item.qty)} kr</strong></div>`).join('');
  $('#subtotal').textContent=`${sub} kr`;
  $('#discountLine').classList.toggle('hidden',!campaignActive);
  $('#discount').textContent=`−${discount} kr`;
  $('#shippingCost').textContent=ship?`${ship} kr`:'Fri frakt';
  $('#total').textContent=`${tot} kr`;
  $('#payTotal').textContent=`${tot} kr`;
  document.querySelectorAll('.shippingOption').forEach(option=>option.classList.toggle('selected',option.querySelector('input').value===shippingMethod));
  installPromo();
}
function applyPromo(){
  const code=$('#promoCode').value.trim().toUpperCase(),quantity=currentItems().reduce((sum,item)=>sum+Number(item.qty),0),message=$('#promoMessage');
  if(!code){appliedPromo='';message.textContent='';message.className='promoMessage';render();return}
  if(code!==WINTER_CODE){appliedPromo='';message.textContent='Ogiltig kampanjkod.';message.className='promoMessage error';render();return}
  if(quantity<3){appliedPromo='';message.textContent='Kampanjen kräver minst 3 samples.';message.className='promoMessage error';render();return}
  appliedPromo=code;message.textContent='Kampanj aktiverad — Mystery Sample ingår utan extra kostnad.';message.className='promoMessage success';render();
}
function showError(msg){const el=$('#checkoutError');el.textContent=msg;el.classList.remove('hidden')}
$('#applyPromo').addEventListener('click',applyPromo);$('#promoCode').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyPromo()}});
document.querySelectorAll('input[name="shippingMethod"]').forEach(input=>input.addEventListener('change',()=>{shippingMethod=input.value;render()}));
$('#checkoutForm').addEventListener('submit',async e=>{e.preventDefault();const items=currentItems();if(!items.length)return showError('Din varukorg är tom.');const btn=$('#sendOrder');btn.disabled=true;btn.querySelector('span').textContent='Startar säker betalning…';const fd=new FormData(e.currentTarget);const customer={name:fd.get('name'),email:fd.get('email'),address:fd.get('address'),postalCode:fd.get('postalCode'),city:fd.get('city'),phone:fd.get('phone')};try{const r=await fetch('/api/orders/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer,items,shipping:{method:shippingMethod},promoCode:appliedPromo})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Kunde inte starta betalningen.');window.location.href=d.url}catch(err){showError(err.message||'Något gick fel. Försök igen.');btn.disabled=false;btn.querySelector('span').textContent='Gå vidare till betalning'}});
init();