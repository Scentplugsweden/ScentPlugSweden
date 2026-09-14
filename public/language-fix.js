(() => {
  const TRANSLATION_PREFIX='__SP_TRANSLATIONS__:';
  const SEASON_PREFIX='__SP_SEASON__:';
  const oldDecode=window.decodeProductTranslations;
  window.decodeProductTranslations=function(p){
    if(p?.translations && typeof p.translations==='object')return p.translations;
    if(typeof oldDecode==='function')return oldDecode(p);
    const raw=(p?.notes||[]).find(n=>String(n).startsWith(TRANSLATION_PREFIX));
    if(!raw)return{};
    try{return JSON.parse(decodeURIComponent(String(raw).slice(TRANSLATION_PREFIX.length)))}catch{try{return JSON.parse(String(raw).slice(TRANSLATION_PREFIX.length))}catch{return{}}}
  };
  window.visibleProductNotes=function(notes){return(notes||[]).filter(n=>{const s=String(n);return!s.startsWith(TRANSLATION_PREFIX)&&!s.startsWith(SEASON_PREFIX)})};
  window.productTranslationFor=function(p){const db=window.decodeProductTranslations(p)||{},current=localStorage.getItem('splang')||document.documentElement.lang||'sv';return db?.[current]&&Object.keys(db[current]).length?db[current]:{}};
  window.stockText=function(p){const total=Object.values(p?.stock||{}).reduce((a,b)=>a+Number(b||0),0);return total<=0?t('stock.out'):t('stock.in')};
  window.seasonFor=function(p){const marker=(p?.notes||[]).find(n=>String(n).startsWith(SEASON_PREFIX)),explicit=marker?String(marker).slice(SEASON_PREFIX.length):'';if(explicit==='winter'||explicit==='summer')return explicit;const text=[p?.name,p?.brand,p?.category,p?.description,...window.visibleProductNotes(p?.notes||[])].join(' ').toLowerCase(),winter=/oud|amber|ambra|vanil|vanilla|tonka|kanel|cinnamon|kardemumma|cardamom|läder|leather|tobak|tobacco|musk|woody|trä|bois|wood|warm|varm|krydd|spicy|épicé|würzig/.test(text),summer=/citrus|bergamot|bergamott|marine|marin|aquatic|aqua|fresh|lemon|citron|grapefruit|grapefrukt|mint|menthe|lime|water|vatten|ozonic|calone/.test(text);if(winter&&!summer)return'winter';if(summer&&!winter)return'summer';return winter?'winter':summer?'summer':'all'};
  const rerender=()=>{if(typeof renderFilters==='function')renderFilters();if(typeof renderProducts==='function')renderProducts()};
  window.addEventListener('load',()=>setTimeout(rerender,0));
  setTimeout(rerender,50);
})();
