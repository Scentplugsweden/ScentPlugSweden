(() => {
  const PREFIX='__SP_TRANSLATIONS__:';
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
  function translations(p){const raw=(p?.notes||[]).find(n=>String(n).startsWith(PREFIX));if(!raw)return{};try{return JSON.parse(decodeURIComponent(String(raw).slice(PREFIX.length)))||{}}catch{return{}}}
  async function emergencyProducts(){
    const host=document.querySelector('#products');
    if(!host||host.children.length)return;
    try{
      const r=await fetch('/api/products',{cache:'no-store'});if(!r.ok)throw 0;
      const list=await r.json();if(!Array.isArray(list)||!list.length)throw 0;
      const lang=localStorage.getItem('splang')||'sv';
      host.innerHTML=list.filter(p=>!p.hidden).map(p=>{
        const tr=translations(p)?.[lang]||{};const name=tr.name||p.name||'Parfym';const brand=tr.brand||p.brand||'';const desc=tr.description||p.description||'';
        const prices=Object.values(p.sizes||{}).map(Number).filter(Number.isFinite);const price=prices.length?Math.min(...prices):0;
        const sold=Object.values(p.stock||{}).length&&!Object.values(p.stock||{}).some(v=>Number(v)>0);
        return `<article class="card ${sold?'soldOut':''}"><div class="cardImg"><img src="${esc(p.image||'')}" alt="${esc(name)}" loading="lazy"><span class="stockBadge ${sold?'out':''}">${sold?'SLUT I LAGER':'I LAGER'}</span></div><div class="cardBody"><small>${esc(brand)}</small><h3>${esc(name)}</h3><p class="cardDescription">${esc(desc)}</p><div class="cardFoot"><strong>Från ${price} kr</strong><button class="add" ${sold?'disabled':''} onclick="showProduct('${esc(p.id)}')">${sold?'Slut':'Välj'}</button></div></div></article>`;
      }).join('');
      const count=document.querySelector('#resultCount');if(count)count.textContent=`${list.filter(p=>!p.hidden).length} produkter`;
      document.body.classList.add('page-ready');
    }catch(e){console.error('[ScentPlug] product fallback failed',e)}
  }
  setTimeout(emergencyProducts,250);setTimeout(emergencyProducts,1200);
  window.addEventListener('load',()=>{setTimeout(emergencyProducts,100);setTimeout(emergencyProducts,1000)});
})();
