(() => {
  const TRANSLATION_PREFIX='__SP_TRANSLATIONS__:',SEASON_PREFIX='__SP_SEASON__:';
  const oldDecode=window.decodeProductTranslations;
  window.decodeProductTranslations=function(p){
    if(p?.translations&&typeof p.translations==='object')return p.translations;
    if(typeof oldDecode==='function')return oldDecode(p);
    const raw=(p?.notes||[]).find(n=>String(n).startsWith(TRANSLATION_PREFIX));if(!raw)return{};
    try{return JSON.parse(decodeURIComponent(String(raw).slice(TRANSLATION_PREFIX.length)))}catch{try{return JSON.parse(String(raw).slice(TRANSLATION_PREFIX.length))}catch{return{}}}
  };
  window.visibleProductNotes=notes=>(notes||[]).filter(n=>{const s=String(n);return!s.startsWith(TRANSLATION_PREFIX)&&!s.startsWith(SEASON_PREFIX)});
  window.productTranslationFor=function(p){const db=window.decodeProductTranslations(p)||{},current=localStorage.getItem('splang')||document.documentElement.lang||'sv',tr=db?.[current]&&Object.keys(db[current]).length?{...db[current]}:{};if(Array.isArray(tr.notes))tr.notes=window.visibleProductNotes(tr.notes);return tr};
  window.stockText=p=>Object.values(p?.stock||{}).reduce((a,b)=>a+Number(b||0),0)<=0?t('stock.out'):t('stock.in');
  window.seasonFor=function(p){const marker=(p?.notes||[]).find(n=>String(n).startsWith(SEASON_PREFIX)),explicit=marker?String(marker).slice(SEASON_PREFIX.length):'';if(explicit==='winter'||explicit==='summer')return explicit;const text=[p?.name,p?.brand,p?.category,p?.description,...window.visibleProductNotes(p?.notes||[])].join(' ').toLowerCase(),winter=/oud|amber|ambra|vanil|vanilla|tonka|kanel|cinnamon|kardemumma|cardamom|läder|leather|tobak|tobacco|musk|woody|trä|bois|wood|warm|varm|krydd|spicy|épicé|würzig/.test(text),summer=/citrus|bergamot|bergamott|marine|marin|aquatic|aqua|fresh|lemon|citron|grapefruit|grapefrukt|mint|menthe|lime|water|vatten|ozonic|calone/.test(text);if(winter&&!summer)return'winter';if(summer&&!winter)return'summer';return winter?'winter':summer?'summer':'all'};
  window.shippingWeight=()=>cart.reduce((s,i)=>s+25*Number(i.qty||0),0);
  window.shippingCost=()=>{const grams=window.shippingWeight(),subtotal=typeof total==='function'?total():0;if(!grams)return 0;if(subtotal>=499)return 0;if(grams<=50)return 22;if(grams<=100)return 44;if(grams<=250)return 61;if(grams<=500)return 88;if(grams<=1000)return 132;return 154};
  const rerender=()=>{if(typeof renderFilters==='function')renderFilters();if(typeof renderProducts==='function')renderProducts();if(typeof updateCart==='function')updateCart()};
  window.addEventListener('load',()=>setTimeout(rerender,0));setTimeout(rerender,50);
})();
