(() => {
  const SEASON_PREFIX='__SP_SEASON__:';
  const CAMPAIGN_CODE='VINTER2026';
  const MYSTERY_ID='mystery-sample';
  function explicitSeason(p){const marker=(p?.notes||[]).find(n=>String(n).startsWith(SEASON_PREFIX));const value=marker?String(marker).slice(SEASON_PREFIX.length):'';return value==='winter'||value==='summer'?value:null}
  function hideCampaignProduct(){if(Array.isArray(products)){const before=products.length;products=products.filter(p=>!p.hidden);if(products.length!==before){renderFilters();renderProducts()}}}
  const originalFetch=window.fetch;
  window.fetch=async function(input,init={}){
    const url=typeof input==='string'?input:(input?.url||'');
    if(url.includes('/api/orders/checkout')&&init?.body){
      try{
        const body=JSON.parse(init.body),code=String(body.customer?.promoCode||'').trim().toUpperCase(),items=Array.isArray(body.items)?body.items:[],qty=items.reduce((s,i)=>s+Number(i.qty||0),0);
        if(code===CAMPAIGN_CODE){
          if(qty<3)return new Response(JSON.stringify({error:'Kampanjen kräver minst 3 samples.'}),{status:400,headers:{'Content-Type':'application/json'}});
          if(!items.some(i=>i.id===MYSTERY_ID))items.push({id:MYSTERY_ID,size:'1 ml',qty:1,name:'Mystery Sample',brand:'ScentPlugSweden',price:49});
          body.items=items;init={...init,body:JSON.stringify(body)};
        }else if(code){return new Response(JSON.stringify({error:'Ogiltig kampanjkod.'}),{status:400,headers:{'Content-Type':'application/json'}})}
      }catch{}
    }
    return originalFetch.call(this,input,init);
  };
  const originalSeasonFor=typeof seasonFor==='function'?seasonFor:null;
  if(originalSeasonFor)seasonFor=function(p){return explicitSeason(p)||originalSeasonFor(p)};
  const clean=()=>{hideCampaignProduct();document.querySelectorAll('#products .card').forEach(card=>{if(card.textContent?.includes('Mystery Sample'))card.remove()})};
  window.addEventListener('load',()=>{clean();setTimeout(clean,100);setTimeout(clean,500)});
  const observer=new MutationObserver(clean);observer.observe(document.documentElement,{childList:true,subtree:true});
})();
