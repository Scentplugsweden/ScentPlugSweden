const express=require('express'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const Stripe=require('stripe');
const app=express();
const PORT=process.env.PORT||3000;
const BASE_URL=(process.env.BASE_URL||`http://localhost:${PORT}`).replace(/\/$/,'');
const productsFile=path.join(__dirname,'products.json'),ordersFile=path.join(__dirname,'orders.json'),localesDir=path.join(__dirname,'locales');
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||'';
const STRIPE_SECRET_KEY=process.env.STRIPE_SECRET_KEY||'';
const STRIPE_WEBHOOK_SECRET=process.env.STRIPE_WEBHOOK_SECRET||'';
const stripe=STRIPE_SECRET_KEY?Stripe(STRIPE_SECRET_KEY):null;
const sessions=new Map();

function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function writeJson(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2))}
function ensureData(){
  const products=readJson(productsFile,[]);
  let changed=false;
  for(const p of products){
    if(!p.stock||typeof p.stock!=='object'){p.stock={};Object.keys(p.sizes||{}).forEach(s=>p.stock[s]=50);changed=true}
    else for(const s of Object.keys(p.sizes||{})) if(!Number.isInteger(p.stock[s])){p.stock[s]=50;changed=true}
  }
  if(changed)writeJson(productsFile,products);
  if(!fs.existsSync(ordersFile))writeJson(ordersFile,[]);
}
ensureData();

function auth(req,res,next){
  const token=req.headers.authorization?.replace(/^Bearer\s+/i,'');
  const expiry=sessions.get(token);
  if(!token||!expiry||expiry<Date.now()){if(token)sessions.delete(token);return res.status(401).json({error:'Unauthorized'})}
  sessions.set(token,Date.now()+1000*60*60*12);next();
}
function publicOrder(o){return {id:o.id,createdAt:o.createdAt,status:o.status,paymentStatus:o.paymentStatus||'unpaid',shippingMethod:o.shippingMethod,trackingNumber:o.trackingNumber||'',items:o.items.map(i=>({name:i.name,size:i.size,qty:i.qty})),subtotal:o.subtotal,shippingCost:o.shippingCost,total:o.total}}
function slugId(){return 'SP-'+crypto.randomBytes(4).toString('hex').toUpperCase()}
function validateCustomer(customer){
  if(!customer?.name||!customer?.email||!customer?.address||!customer?.city||!customer?.postalCode)return 'Fyll i alla obligatoriska fält.';
  if(!/^\S+@\S+\.\S+$/.test(String(customer.email).trim()))return 'Ange en giltig e-postadress.';
  return null;
}
function buildSafeOrder(body){
  const {customer,items,shipping}=body||{};
  const customerError=validateCustomer(customer);
  if(customerError)return {error:customerError};
  if(!Array.isArray(items)||!items.length)return {error:'Varukorgen är tom.'};
  if(shipping?.method!=='PostNord')return {error:'Välj PostNord som leveransalternativ.'};
  const catalog=readJson(productsFile,[]),safe=[];
  for(const item of items){
    const p=catalog.find(x=>x.id===item.id),price=p?.sizes?.[item.size],qty=Number(item.qty),stock=Number(p?.stock?.[item.size]??0);
    if(!p||price===undefined||!Number.isFinite(Number(price))||!Number.isInteger(qty)||qty<1||qty>99)return {error:'En produkt i ordern är ogiltig.'};
    if(stock<qty)return {error:`${p.name} (${item.size}) är slut i lager.`};
    safe.push({id:p.id,name:p.name,brand:p.brand,size:item.size,price:Number(price),qty});
  }
  const subtotal=safe.reduce((s,x)=>s+x.price*x.qty,0),shippingCost=subtotal>=399?0:49,total=subtotal+shippingCost;
  return {catalog,safe,subtotal,shippingCost,total,customer:{name:String(customer.name).trim(),email:String(customer.email).trim(),address:String(customer.address).trim(),postalCode:String(customer.postalCode).trim(),city:String(customer.city).trim(),phone:String(customer.phone||'').trim()}};
}
function reserveStock(catalog,safe){
  for(const x of safe){const p=catalog.find(p=>p.id===x.id);p.stock[x.size]-=x.qty}
  writeJson(productsFile,catalog);
}
function releaseStock(order){
  const catalog=readJson(productsFile,[]);
  for(const x of order.items){
    const p=catalog.find(p=>p.id===x.id);if(!p)continue;
    p.stock=p.stock||{};p.stock[x.size]=Number(p.stock[x.size]||0)+Number(x.qty||0);
  }
  writeJson(productsFile,catalog);
}
function absoluteUrl(req,pathPart){return `${BASE_URL}${pathPart}`}

app.post('/webhook/stripe',express.raw({type:'application/json'}),async(req,res)=>{
  if(!stripe||!STRIPE_WEBHOOK_SECRET)return res.status(503).send('Stripe webhook is not configured.');
  let event;
  try{event=stripe.webhooks.constructEvent(req.body,req.headers['stripe-signature'],STRIPE_WEBHOOK_SECRET)}
  catch(err){return res.status(400).send(`Webhook Error: ${err.message}`)}
  try{
    if(event.type==='checkout.session.completed'){
      const session=event.data.object,orderId=session.metadata?.orderId;
      const orders=readJson(ordersFile,[]),i=orders.findIndex(o=>o.id===orderId);
      if(i>=0){
        orders[i].stripeSessionId=session.id;
        orders[i].paymentStatus=session.payment_status||'paid';
        if(session.payment_status==='paid' && orders[i].status==='Betalning väntar')orders[i].status='Betald';
        orders[i].paidAt=orders[i].paidAt||new Date().toISOString();
        writeJson(ordersFile,orders);
      }
    } else if(event.type==='checkout.session.expired'){
      const session=event.data.object,orderId=session.metadata?.orderId;
      const orders=readJson(ordersFile,[]),i=orders.findIndex(o=>o.id===orderId);
      if(i>=0&&orders[i].status==='Betalning väntar'&&!orders[i].stockReleasedAt){
        releaseStock(orders[i]);orders[i].status='Avbruten';orders[i].paymentStatus='expired';orders[i].stockReleasedAt=new Date().toISOString();writeJson(ordersFile,orders);
      }
    }
  }catch(err){console.error('Stripe webhook handling error:',err)}
  res.json({received:true});
});

app.use(express.json({limit:'100kb'}));
app.use(express.static(path.join(__dirname,'public')));

app.get('/api/health',(req,res)=>res.json({ok:true,version:'V7',stripeConfigured:Boolean(stripe),postNordMode:process.env.POSTNORD_API_KEY?'api-ready':'manual'}));
app.get('/api/products',(req,res)=>res.json(readJson(productsFile,[])));
app.get('/api/locales/:lang',(req,res)=>{const lang=String(req.params.lang||'sv').toLowerCase();const allowed=['sv','en','de','fr'];if(!allowed.includes(lang))return res.status(404).json({error:'Language not found'});res.json({ui:readJson(path.join(localesDir,`${lang}.json`),{}),products:readJson(path.join(localesDir,'products.json'),{})[lang]||{}})});

app.post('/api/admin/login',(req,res)=>{
  if(!ADMIN_PASSWORD)return res.status(503).json({error:'Admin is not configured. Set ADMIN_PASSWORD first.'});
  if(String(req.body?.password||'')!==ADMIN_PASSWORD)return res.status(401).json({error:'Fel lösenord.'});
  const token=crypto.randomBytes(32).toString('hex');sessions.set(token,Date.now()+1000*60*60*12);res.json({token});
});
app.post('/api/admin/logout',auth,(req,res)=>{const token=req.headers.authorization.replace(/^Bearer\s+/i,'');sessions.delete(token);res.json({ok:true})});
app.get('/api/admin/orders',auth,(req,res)=>res.json(readJson(ordersFile,[])));
app.patch('/api/admin/orders/:id',auth,(req,res)=>{
  const orders=readJson(ordersFile,[]),i=orders.findIndex(o=>o.id===req.params.id);if(i<0)return res.status(404).json({error:'Order not found'});
  const allowed=['Betalning väntar','Mottagen','Betald','Packas','Skickad','Levererad','Avbruten'],{status,trackingNumber,shippingMethod}=req.body||{};
  if(status!==undefined&&!allowed.includes(status))return res.status(400).json({error:'Ogiltig status.'});
  if(status!==undefined)orders[i].status=status;
  if(trackingNumber!==undefined)orders[i].trackingNumber=String(trackingNumber).trim().slice(0,120);
  if(shippingMethod!==undefined)orders[i].shippingMethod=String(shippingMethod).trim().slice(0,80);
  orders[i].updatedAt=new Date().toISOString();writeJson(ordersFile,orders);res.json({ok:true,order:orders[i]});
});

app.post('/api/admin/products',auth,(req,res)=>{
  const body=req.body||{},products=readJson(productsFile,[]),id=String(body.id||'').trim();
  if(!/^[a-z0-9-]{2,40}$/.test(id)||!body.name||!body.brand||!body.category||!body.description||!body.image||!body.sizes||typeof body.sizes!=='object')return res.status(400).json({error:'Fyll i alla produktfält.'});
  if(products.some(p=>p.id===id))return res.status(409).json({error:'Produkt-ID finns redan.'});
  const sizes={};for(const [s,v] of Object.entries(body.sizes)){const price=Number(v);if(!s||!Number.isFinite(price)||price<0)return res.status(400).json({error:'Ogiltigt pris.'});sizes[s]=price}
  if(!Object.keys(sizes).length)return res.status(400).json({error:'Minst en storlek krävs.'});
  const stock={};for(const s of Object.keys(sizes))stock[s]=Math.max(0,Number.isInteger(Number(body.stock?.[s]))?Number(body.stock[s]):50);
  const p={id,name:String(body.name).trim(),brand:String(body.brand).trim(),category:String(body.category).trim(),description:String(body.description).trim(),notes:Array.isArray(body.notes)?body.notes.map(String):[],sizes,stock,image:String(body.image).trim()};products.push(p);writeJson(productsFile,products);res.json({ok:true,product:p});
});
app.patch('/api/admin/products/:id',auth,(req,res)=>{
  const products=readJson(productsFile,[]),i=products.findIndex(p=>p.id===req.params.id);if(i<0)return res.status(404).json({error:'Product not found'});
  const p=products[i],b=req.body||{};
  ['name','brand','category','description','image'].forEach(k=>{if(b[k]!==undefined)p[k]=String(b[k]).trim()});
  if(b.notes!==undefined)p.notes=Array.isArray(b.notes)?b.notes.map(String):[];
  if(b.sizes!==undefined){if(!b.sizes||typeof b.sizes!=='object')return res.status(400).json({error:'Ogiltiga storlekar.'});const sizes={};for(const [s,v] of Object.entries(b.sizes)){const n=Number(v);if(!s||!Number.isFinite(n)||n<0)return res.status(400).json({error:'Ogiltigt pris.'});sizes[s]=n}p.sizes=sizes;p.stock=p.stock||{};for(const s of Object.keys(sizes))if(!Number.isInteger(p.stock[s]))p.stock[s]=50;for(const s of Object.keys(p.stock))if(!Object.prototype.hasOwnProperty.call(sizes,s))delete p.stock[s]}
  if(b.stock!==undefined){if(!b.stock||typeof b.stock!=='object')return res.status(400).json({error:'Ogiltigt lager.'});for(const s of Object.keys(p.sizes||{})){const n=Number(b.stock[s]);if(!Number.isInteger(n)||n<0||n>100000)return res.status(400).json({error:'Lager måste vara ett heltal 0–100000.'});p.stock[s]=n}}
  writeJson(productsFile,products);res.json({ok:true,product:p});
});
app.delete('/api/admin/products/:id',auth,(req,res)=>{const products=readJson(productsFile,[]),next=products.filter(p=>p.id!==req.params.id);if(next.length===products.length)return res.status(404).json({error:'Product not found'});writeJson(productsFile,next);res.json({ok:true})});

app.post('/api/orders/checkout',async(req,res)=>{
  if(!stripe)return res.status(503).json({error:'Stripe är inte konfigurerat ännu. Lägg in STRIPE_SECRET_KEY i .env.'});
  const built=buildSafeOrder(req.body);if(built.error)return res.status(400).json({error:built.error});
  const {catalog,safe,subtotal,shippingCost,total,customer}=built;
  const order={id:slugId(),createdAt:new Date().toISOString(),status:'Betalning väntar',paymentStatus:'unpaid',shippingMethod:'PostNord',shippingCost,customer,items:safe,subtotal,total};
  reserveStock(catalog,safe);
  const orders=readJson(ordersFile,[]);orders.unshift(order);writeJson(ordersFile,orders);
  try{
    const line_items=safe.map(i=>({price_data:{currency:'sek',product_data:{name:`${i.name} — ${i.size}`,metadata:{productId:i.id,size:i.size}},unit_amount:Math.round(i.price*100)},quantity:i.qty}));
    if(shippingCost>0)line_items.push({price_data:{currency:'sek',product_data:{name:'PostNord — leverans'},unit_amount:Math.round(shippingCost*100)},quantity:1});
    const session=await stripe.checkout.sessions.create({
      mode:'payment',line_items,customer_email:customer.email,client_reference_id:order.id,
      metadata:{orderId:order.id},billing_address_collection:'required',
      success_url:absoluteUrl(req,`/order/success?id=${encodeURIComponent(order.id)}&email=${encodeURIComponent(customer.email)}`),
      cancel_url:absoluteUrl(req,'/?checkout=cancelled'),
      submit_type:'pay'
    });
    order.stripeSessionId=session.id;const latest=readJson(ordersFile,[]),i=latest.findIndex(o=>o.id===order.id);if(i>=0){latest[i].stripeSessionId=session.id;writeJson(ordersFile,latest)}
    res.json({ok:true,url:session.url,order:publicOrder(order)});
  }catch(err){
    releaseStock(order);const remaining=readJson(ordersFile,[]).filter(o=>o.id!==order.id);writeJson(ordersFile,remaining);
    console.error('Stripe checkout error:',err);
    res.status(502).json({error:'Kunde inte starta betalningen. Försök igen.'});
  }
});
app.get('/api/orders/:id',(req,res)=>{
  const id=String(req.params.id||'').trim().toUpperCase(),email=String(req.query.email||'').trim().toLowerCase();
  if(!id||!email)return res.status(400).json({error:'Ordernummer och e-post krävs.'});
  const order=readJson(ordersFile,[]).find(o=>o.id.toUpperCase()===id&&String(o.customer.email).toLowerCase()===email);
  if(!order)return res.status(404).json({error:'Ordern hittades inte. Kontrollera ordernummer och e-post.'});
  res.json(publicOrder(order));
});

app.get('/admin',(req,res)=>res.sendFile(path.join(__dirname,'public','admin.html')));
app.get('/order',(req,res)=>res.sendFile(path.join(__dirname,'public','order.html')));
app.get('/order/success',(req,res)=>res.sendFile(path.join(__dirname,'public','success.html')));
app.get('/terms',(req,res)=>res.sendFile(path.join(__dirname,'public','terms.html')));
app.get('/privacy',(req,res)=>res.sendFile(path.join(__dirname,'public','privacy.html')));
app.listen(PORT,()=>console.log(`ScentPlugSweden V7 kör på ${BASE_URL}`));
