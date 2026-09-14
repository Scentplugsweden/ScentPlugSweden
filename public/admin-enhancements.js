(() => {
  const SEASON_PREFIX='__SP_SEASON__:';
  let selectedSeason='';
  const seasonLabels={winter:'❄ Vinterparfymer',summer:'☀ Sommarparfymer'};

  function ensureSeasonUI(){
    const form=document.querySelector('#productForm');
    if(!form||document.querySelector('#seasonChoices'))return;
    const wrap=document.createElement('div');
    wrap.id='seasonChoices';
    wrap.innerHTML=`<div style="font-weight:700;margin-top:4px">Säsong</div><div class="seasonAdminButtons"><button type="button" class="btn seasonAdminBtn" data-season="winter">${seasonLabels.winter}</button><button type="button" class="btn seasonAdminBtn" data-season="summer">${seasonLabels.summer}</button></div><small style="color:#777">Välj en säsong för parfymen. Klicka igen för att ta bort valet.</small>`;
    const anchor=document.querySelector('#pNotes');
    (anchor?.parentElement||form).insertAdjacentElement('afterend',wrap);
    wrap.querySelectorAll('[data-season]').forEach(btn=>btn.addEventListener('click',()=>{
      selectedSeason=selectedSeason===btn.dataset.season?'':btn.dataset.season;
      updateSeasonUI();
    }));
    updateSeasonUI();
  }

  function updateSeasonUI(){
    document.querySelectorAll('#seasonChoices [data-season]').forEach(btn=>btn.classList.toggle('active',btn.dataset.season===selectedSeason));
  }

  function readSeasonFromProduct(){
    const id=document.querySelector('#pId')?.value?.trim();
    const notes=(window.products||[]).find(p=>p.id===id)?.notes||[];
    const marker=notes.find(n=>String(n).startsWith(SEASON_PREFIX));
    selectedSeason=marker?String(marker).slice(SEASON_PREFIX.length):'';
    updateSeasonUI();
  }

  const originalFetch=window.fetch;
  window.fetch=async function(input,init={}){
    const url=typeof input==='string'?input:(input?.url||'');
    if(init?.body && /\/api\/admin\/products(?:\/|$)/.test(url) && String(init.method||'GET').toUpperCase()!=='GET'){
      try{
        const body=JSON.parse(init.body);
        const notes=Array.isArray(body.notes)?body.notes.map(String).filter(n=>!n.startsWith(SEASON_PREFIX)):[];
        if(selectedSeason)notes.push(SEASON_PREFIX+selectedSeason);
        body.notes=notes;
        init={...init,body:JSON.stringify(body)};
      }catch{}
    }
    return originalFetch.call(this,input,init);
  };

  const observer=new MutationObserver(()=>ensureSeasonUI());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('click',e=>{
    if(e.target?.id==='newProduct')setTimeout(()=>{selectedSeason='';ensureSeasonUI();updateSeasonUI()},50);
    if(e.target?.matches?.('.productActions .btn') && /Redigera|språk/.test(e.target.textContent||''))setTimeout(()=>{ensureSeasonUI();readSeasonFromProduct()},50);
  });
  ensureSeasonUI();
})();
