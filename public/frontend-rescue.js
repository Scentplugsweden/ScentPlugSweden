(() => {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const sv = {
    announcement:'FRI FRAKT ÖVER 499 KR · POSTNORD · 1–3 ARBETSDAGAR', navShop:'Shop',navTrack:'Spåra order',navAbout:'Om oss',navFaq:'FAQ',navContact:'Kontakt',
    heroEyebrow:'PREMIUM DECANTS',heroTitle:'Din doft.',heroTitle2:'Ditt val.',heroText:'Upptäck ikoniska dofter i praktiska decants. Testa innan du köper full storlek.',heroShop:'Shoppa dofter →',heroHow:'Så fungerar det',heroRating:'4.9/5 från våra kunder',heroSideTop:'PREMIUM',heroSideMain:'DECANTS',heroSideBottom:'Äkta doft · Smidig storlek',
    trustSmall:'Små format',trustSmallText:'Perfekt för resan',trustTry:'Testa först',trustTryText:'Hitta din signaturdoft',trustBuild:'Bygg din samling',trustBuildText:'Välj flera favoriter',trustCheckout:'Trygg checkout',trustCheckoutText:'Säker betalning',
    shopEyebrow:'VÅRA DOFTER',shopTitle:'Hitta din nästa favorit',search:'Sök doft eller varumärke…',aboutEyebrow:'SCENTPLUGSWEDEN',aboutTitle:'Premiumdofter, enklare.',aboutText:'Vi gör det enkelt att upptäcka premiumparfymer genom mindre, praktiska decants.',aboutButton:'Utforska dofter →',discover:'Upptäck',discoverText:'Utforska dofter du varit nyfiken på.',choose2:'Välj storlek',chooseText:'Välj den mängd som passar dig.',wear:'Bär med dig',wearText:'Ta med dina favoriter överallt.',
    faqTitle:'Vanliga frågor',faqQ1:'Är dofterna äkta?',faqA1:'Ja. Våra decants fylls från originaldofter.',faqQ2:'Hur snabbt skickas min order?',faqA2:'Beställningar skickas normalt inom 1–3 arbetsdagar med PostNord.',faqQ3:'När är frakten gratis?',faqA3:'Frakten är gratis på beställningar över 499 kr.',footerText:'Premium decants från ScentPlugSweden.',footerShop:'Shop',footerAll:'Alla dofter',footerFaq:'FAQ',footerTrack:'Spåra order',footerContact:'Kontakt',footerEmail:'E-post',footerCookies:'Cookies',footerTerms:'Villkor',footerPrivacy:'Integritet',orderEyebrow:'DIN BESTÄLLNING',cartTitle:'Varukorg',totalLabel:'Totalt',checkout:'Till checkout →',trackLink:'Spåra order',checkoutEyebrow:'CHECKOUT',checkoutTitle:'Dina uppgifter',postnordLabel:'PostNord',postnordDetails:'1–3 arbetsdagar',paymentLabel:'Säker betalning',paymentDetails:'Du skickas vidare till säker betalning.',orderTotalLabel:'Ordertotal',sendOrder:'Fortsätt till betalning →',name:'Namn',email:'E-post',address:'Adress',city:'Ort',postalCode:'Postnummer',phone:'Telefon (valfritt)'
  };
  const $ = s => document.querySelector(s);
  const set = (id, value, attr) => { const e=document.getElementById(id); if(e){ if(attr)e.setAttribute(attr,value); else e.textContent=value; } };
  function fillUi(){
    Object.keys(sv).forEach(k=>{ const e=document.getElementById(k); if(e){ if(k==='search'||k==='name'||k==='email'||k==='address'||k==='city'||k==='postalCode'||k==='phone')e.placeholder=sv[k]; else e.textContent=sv[k]; }});
    set('announcement',sv.announcement); set('campaignEyebrow','VINTERKAMPANJ · 2026'); set('campaignTitle','Köp 3 samples — få en mystery sample på köpet.'); set('campaignText','Använd koden och få en överraskningsdoft med din beställning.'); set('campaignButton','Shoppa samples →');
  }
  function price(p,size){ const prices=p.prices||{}; if(size&&prices[size]!=null)return Number(prices[size]); const vals=Object.values(prices).map(Number).filter(Number.isFinite); return vals[0]||Number(p.price)||0; }
  function img(p){ return p.image||p.imageUrl||p.img||'/images/placeholder.jpg'; }
  let data=[];
  function render(){
    const root=$('#products'); if(!root)return;
    if(!data.length){root.innerHTML='<p>Inga dofter hittades.</p>';return;}
    root.innerHTML=data.filter(p=>p.id!=='mystery-sample').map(p=>{
      const sizes=Object.keys(p.prices||{}); const first=sizes[0]; const pr=price(p,first);
      return `<article class="card" data-id="${esc(p.id)}"><button class="cardImage" data-open="${esc(p.id)}" type="button"><img src="${esc(img(p))}" alt="${esc(p.name||'Parfym')}" loading="lazy" onerror="this.style.display='none'"></button><div class="cardBody"><small>${esc(p.brand||'ScentPlugSweden')}</small><h3>${esc(p.name||'Premium scent')}</h3><p>${esc(p.description||'Premium doft i praktisk decant.')}</p><div class="cardFoot"><b>${pr} kr</b><button class="btn" type="button" data-add="${esc(p.id)}">Lägg i varukorg</button></div></div></article>`;
    }).join('');
    set('resultCount',`${data.filter(p=>p.id!=='mystery-sample').length} dofter`);
  }
  function cart(){try{return JSON.parse(localStorage.getItem('spcart')||'[]')}catch{return[]}}
  function save(c){localStorage.setItem('spcart',JSON.stringify(c));set('count',c.reduce((n,i)=>n+Number(i.qty||0),0))}
  function add(id){const p=data.find(x=>String(x.id)===String(id));if(!p)return;const sizes=Object.keys(p.prices||{});const size=sizes[0]||p.size||'5ml';const c=cart();const key=`${p.id}:${size}`;const i=c.find(x=>`${x.id}:${x.size||size}`===key);if(i)i.qty=Number(i.qty||0)+1;else c.push({id:p.id,size,qty:1,name:p.name,brand:p.brand,price:price(p,size),image:img(p)});save(c); if(typeof window.updateCart==='function')window.updateCart();}
  function bind(){
    document.addEventListener('click',e=>{const a=e.target.closest('[data-add]');if(a){e.preventDefault();add(a.dataset.add);return}const o=e.target.closest('[data-open]');if(o&&typeof window.showProduct==='function'){window.showProduct(o.dataset.open);return}});
    const s=$('#search'); if(s)s.addEventListener('input',()=>{const q=s.value.trim().toLowerCase();const all=data;data=all.filter(p=>`${p.name||''} ${p.brand||''} ${p.description||''}`.toLowerCase().includes(q));render();data=all});
    const lang=$('#languageSelect'); if(lang)lang.addEventListener('change',()=>{localStorage.setItem('splang',lang.value);location.reload()});
    const cb=$('#cartBtn'); if(cb&&typeof window.openCart!=='function')cb.addEventListener('click',()=>$('#cart')?.classList.add('open'));
    const cl=$('#close'); if(cl&&typeof window.closeCart!=='function')cl.addEventListener('click',()=>$('#cart')?.classList.remove('open'));
  }
  async function boot(){
    fillUi();
    try{const r=await fetch('/api/products',{cache:'no-store'});if(r.ok){const x=await r.json();if(Array.isArray(x))data=x;}}catch(e){console.error('[frontend rescue]',e)}
    render();save(cart());bind();
    document.body.classList.add('page-ready');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
