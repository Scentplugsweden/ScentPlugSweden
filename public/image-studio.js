(()=>{'use strict';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
let products=[],latestImageId='',latestProductId='';
function headers(){return {Authorization:'Bearer '+(localStorage.getItem('spadmin')||''),'Content-Type':'application/json'}}
async function json(r){const t=await r.text();let d={};try{d=t?JSON.parse(t):{}}catch{throw Error('Serverfel ('+r.status+')')}if(!r.ok)throw Error(d.error||'Serverfel ('+r.status+')');return d}
function mount(){
 const app=$('#app'),tabs=$('.tabs'),productsSection=$('#productsSection');
 if(!app||!tabs||!productsSection||$('#imageStudioTab'))return;
 const tab=document.createElement('button');tab.id='imageStudioTab';tab.type='button';tab.textContent='AI-produktbilder';tabs.appendChild(tab);
 const section=document.createElement('section');section.id='imageStudioSection';section.className='hidden';
 section.innerHTML=`<div class="card"><small>SCENTPLUGSWEDEN · IMAGE STUDIO</small><h2>Luxury Product Image Studio</h2><p>Skapa en ny produktbild från en uppladdad originalbild. Originalbilden ändras aldrig. Den nya bilden sparas separat och publiceras först när du godkänner den.</p><label>Produkt<select id="isProduct"><option value="">Laddar produkter…</option></select></label><label style="display:block;margin-top:12px">Originalbild (JPG, PNG eller WebP)<input id="isFile" type="file" accept="image/jpeg,image/png,image/webp"></label><label style="display:block;margin-top:12px">Bildstil<select id="isStyle"><option value="luxury">Luxury studio · varm beige och champagne</option><option value="dark">Dark luxury · svart och mjukt guld</option><option value="ivory">Clean ivory · ljus premiumstudio</option></select></label><label style="display:block;margin-top:12px">Extra instruktion (valfritt)<textarea id="isPrompt" rows="3" maxlength="800" placeholder="Exempel: mjuk skugga och diskret reflektion på marmoryta."></textarea></label><div class="row" style="margin-top:14px"><button id="isGenerate" type="button">Generera bild</button><span id="isStatus" role="status"></span></div><p class="hint">En bild per körning. Kontrollera alltid etikett, logotyp och text – AI kan förändra små detaljer. Genereringen kan medföra kostnad hos Google.</p></div><div id="isPreview" class="card hidden"><h3>Förhandsgranskning</h3><img id="isResult" alt="Genererad produktbild" style="display:block;width:min(100%,420px);aspect-ratio:4/5;object-fit:contain;background:#f5f3ef;border-radius:12px"><p id="isMeta"></p><div class="row"><button id="isApprove" type="button">Godkänn som produktbild</button><button id="isDiscard" type="button">Behåll originalet</button></div><p id="isApproveStatus" role="status"></p></div>`;
 productsSection.after(section);
 const show=target=>{['ordersSection','productsSection','imageStudioSection'].forEach(id=>$('#'+id)?.classList.toggle('hidden',id!==target))};
 tab.addEventListener('click',()=>{show('imageStudioSection');loadProducts()});
 $('#ordersTab')?.addEventListener('click',()=>show('ordersSection'));
 $('#productsTab')?.addEventListener('click',()=>show('productsSection'));
 $('#isGenerate').addEventListener('click',generate);
 $('#isApprove').addEventListener('click',approve);
 $('#isDiscard').addEventListener('click',()=>{$('#isPreview').classList.add('hidden');latestImageId='';latestProductId='';});
 loadProducts();
}
async function loadProducts(){try{products=await json(await fetch('/api/products',{cache:'no-store'}));const select=$('#isProduct');if(!select)return;const previous=select.value;select.innerHTML='<option value="">Välj produkt</option>'+products.filter(p=>!p.hidden).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+' · '+esc(p.brand)+'</option>').join('');if(products.some(p=>p.id===previous))select.value=previous}catch(e){const s=$('#isStatus');if(s)s.textContent=e.message}}
async function generate(){
 const status=$('#isStatus'),file=$('#isFile').files?.[0],productId=$('#isProduct').value;
 status.textContent='';
 if(!productId){status.textContent='Välj en produkt.';return}
 if(!file){status.textContent='Ladda upp produktens originalbild.';return}
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024){status.textContent='Använd JPG, PNG eller WebP under 8 MB.';return}
 const product=products.find(p=>p.id===productId);if(!product){status.textContent='Produkten hittades inte.';return}
 const button=$('#isGenerate');button.disabled=true;button.textContent='Genererar…';
 try{
  const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(Error('Kunde inte läsa bilden.'));r.readAsDataURL(file)});
  const result=await json(await fetch('/api/admin/image-studio/generate',{method:'POST',headers:headers(),body:JSON.stringify({productId,imageData:dataUrl,style:$('#isStyle').value,extraPrompt:$('#isPrompt').value})}));
  latestImageId=result.id;latestProductId=productId;$('#isResult').src='/api/product-images/'+encodeURIComponent(result.id);$('#isMeta').textContent='Ny bild skapad · '+result.width+' × '+result.height+' px · Originalbilden är oförändrad.';$('#isPreview').classList.remove('hidden');$('#isApproveStatus').textContent='';status.textContent='Bilden är klar. Granska den innan du godkänner.';
 }catch(e){status.textContent=e.message}
 finally{button.disabled=false;button.textContent='Generera bild'}
}
async function approve(){
 if(!latestImageId||!latestProductId)return;
 const button=$('#isApprove');button.disabled=true;
 try{await json(await fetch('/api/admin/image-studio/approve',{method:'POST',headers:headers(),body:JSON.stringify({imageId:latestImageId,productId:latestProductId})}));$('#isApproveStatus').textContent='Godkänd. Produktbilden är uppdaterad; originalfilen finns kvar separat.';await loadProducts()}
 catch(e){$('#isApproveStatus').textContent=e.message}
 finally{button.disabled=false}
}
const observer=new MutationObserver(mount);observer.observe(document.documentElement,{childList:true,subtree:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();