(() => {
  const SEASON_PREFIX='__SP_SEASON__:',CAMPAIGN_CODE='VINTER2026',MYSTERY_ID='mystery-sample';
  const campaignText={sv:{eyebrow:'VINTERKAMPANJ · 2026',title:'Köp 3 samples — få en mystery sample på köpet.',text:'Använd koden och få en överraskningsdoft med din beställning.',button:'Shoppa samples →',placeholder:'Kampanjkod (valfritt)'},en:{eyebrow:'WINTER CAMPAIGN · 2026',title:'Buy 3 samples — get a mystery sample free.',text:'Use the code and receive a surprise scent with your order.',button:'Shop samples →',placeholder:'Promo code (optional)'},de:{eyebrow:'WINTERAKTION · 2026',title:'Kaufe 3 Samples — erhalte ein Mystery Sample gratis.',text:'Nutze den Code und erhalte einen Überraschungsduft zu deiner Bestellung.',button:'Samples shoppen →',placeholder:'Aktionscode (optional)'},fr:{eyebrow:'OFFRE HIVER · 2026',title:'Achetez 3 échantillons — recevez un échantillon mystère offert.',text:'Utilisez le code et recevez un parfum surprise avec votre commande.',button:'Découvrir les samples →',placeholder:'Code promo (facultatif)'}};
  function explicitSeason(p){const marker=(p?.notes||[]).find(n=>String(n).startsWith(SEASON_PREFIX));const value=marker?String(marker).slice(SEASON_PREFIX.length):'';return value==='winter'||value==='summer'?value:null}
  function applyCampaignLanguage(){const c=campaignText[typeof lang==='string'?lang:'sv']||campaignText.sv;for(const [id,value] of Object.entries({campaignEyebrow:c.eyebrow,campaignTitle:c.title,campaignText:c.text,campaignButton:c.button})){const el=document.getElementById(id);if(el)el.textContent=value}const input=document.getElementById('promoCode');if(input)input.placeholder=c.placeholder}
  function hideCampaignProduct(){if(Array.isArray(products)){const before=products.length;products=products.filter(p=>!p.hidden);if(products.length!==before){renderFilters();renderProducts()}}}
  const originalFetch=window.fetch;
  window.fetch=async function(input,init={}){
    const url=typeof input==='string'?input:(input?.url||'');
    if(url.includes('/api/orders/checkout')&&init?.body){try{const body=JSON.parse(init.body),code=String(body.customer?.promoCode||'').trim().toUpperCase(),items=Array.isArray(body.items)?body.items:[],qty=items.reduce((s,i)=>s+Number(i.qty||0),0);if(code===CAMPAIGN_CODE){if(qty<3)return new Response(JSON.stringify({error:'Kampanjen kräver minst 3 samples.'}),{status:400,headers:{'Content-Type':'application/json'}});if(!items.some(i=>i.id===MYSTERY_ID))items.push({id:MYSTERY_ID,size:'1 ml',qty:1,name:'Mystery Sample',brand:'ScentPlugSweden',price:49});body.items=items;init={...init,body:JSON.stringify(body)};}else if(code)return new Response(JSON.stringify({error:'Ogiltig kampanjkod.'}),{status:400,headers:{'Content-Type':'application/json'}})}catch{}}
    return originalFetch.call(this,input,init);
  };
  const originalSeasonFor=typeof seasonFor==='function'?seasonFor:null;if(originalSeasonFor)seasonFor=function(p){return explicitSeason(p)||originalSeasonFor(p)};
  const clean=()=>{hideCampaignProduct();document.querySelectorAll('#products .card').forEach(card=>{if(card.textContent?.includes('Mystery Sample'))card.remove()})};
  window.addEventListener('load',()=>{applyCampaignLanguage();clean();setTimeout(clean,100);setTimeout(clean,500)});
  window.addEventListener('splangchange',applyCampaignLanguage);
  const observer=new MutationObserver(clean);observer.observe(document.documentElement,{childList:true,subtree:true});
})();
