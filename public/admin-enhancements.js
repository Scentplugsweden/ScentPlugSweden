(() => {
  const SEASON_PREFIX='__SP_SEASON__:';
  let selectedSeason='';
  const labels={winter:'❄ Vinterparfymer',summer:'☀ Sommarparfymer'};
  function ensureUI(){
    const form=document.querySelector('#productForm');
    if(!form||document.querySelector('#seasonChoices'))return;
    const wrap=document.createElement('div');wrap.id='seasonChoices';
    wrap.innerHTML=`<div style="font-weight:700;margin-top:4px">Säsong</div><div class="seasonAdminButtons"><button type="button" class="btn seasonAdminBtn" data-season="winter">${labels.winter}</button><button type="button" class="btn seasonAdminBtn" data-season="summer">${labels.summer}</button></div><small style="color:#777">Välj säsong för parfymen. Klicka igen för att ta bort valet.</small>`;
    form.appendChild(wrap);
    wrap.querySelectorAll('[data-season]').forEach(btn=>btn.addEventListener('click',()=>{selectedSeason=selectedSeason===btn.dataset.season?'':btn.dataset.season;updateUI()}));
    updateUI();
  }
  function updateUI(){document.querySelectorAll('#seasonChoices [data-season]').forEach(btn=>btn.classList.toggle('active',btn.dataset.season===selectedSeason))}
  async function loadSeason(id){try{const r=await fetch('/api/products');const ps=await r.json();const p=ps.find(x=>x.id===id);const marker=(p?.notes||[]).find(n=>String(n).startsWith(SEASON_PREFIX));selectedSeason=marker?String(marker).slice(SEASON_PREFIX.length):'';updateUI()}catch{}}
  const originalFetch=window.fetch;
  window.fetch=async function(input,init={}){
    const url=typeof input==='string'?input:(input?.url||'');
    if(init?.body&&/\/api\/admin\/products(?:\/|$)/.test(url)&&String(init.method||'GET').toUpperCase()!=='GET'){
      try{const body=JSON.parse(init.body);const notes=Array.isArray(body.notes)?body.notes.map(String).filter(n=>!n.startsWith(SEASON_PREFIX)):[];if(selectedSeason)notes.push(SEASON_PREFIX+selectedSeason);body.notes=notes;init={...init,body:JSON.stringify(body)}}catch{}
    }
    return originalFetch.call(this,input,init);
  };
  const observer=new MutationObserver(ensureUI);observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('click',e=>{
    const target=e.target;
    if(target?.id==='newProduct'){selectedSeason='';setTimeout(()=>{ensureUI();updateUI()},30);return}
    const btn=target?.closest?.('.productActions button');
    if(btn){const m=String(btn.getAttribute('onclick')||'').match(/(?:editProduct|editAllLanguages)\('([^']+)'\)/);if(m)setTimeout(()=>{ensureUI();loadSeason(m[1])},50)}
  });
  ensureUI();
})();
