const express=require('express'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const Stripe=require('stripe');
const {Pool}=require('pg');
const app=express();
const PORT=process.env.PORT||3000;
const BASE_URL=(process.env.BASE_URL||`http://localhost:${PORT}`).replace(/\/$/,'');
const productsFile=path.join(__dirname,'products.json'),ordersFile=path.join(__dirname,'orders.json'),localesDir=path.join(__dirname,'locales');
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||'';
const STRIPE_SECRET_KEY=process.env.STRIPE_SECRET_KEY||'';
const STRIPE_WEBHOOK_SECRET=process.env.STRIPE_WEBHOOK_SECRET||'';
const stripe=STRIPE_SECRET_KEY?Stripe(STRIPE_SECRET_KEY):null;
const sessions=new Map();
const pool=process.env.DATABASE_URL?new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}):null;

function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function writeJson(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2))}
function normalizeProducts(products){
  let changed=false;
  for(const p of products){
    if(!p.stock||typeof p.stock!=='object'){p.stock={};Object.keys(p.sizes||{}).forEach(s=>p.stock[s]=50);changed=true}
    else for(const s of Object.keys(p.sizes||{})) if(!Number.isInteger(p.stock[s])){p.stock[s]=50;changed=true}
  }
  return {products,changed};
}
async function initDb(){
  if(!pool)return;
  await pool.query(`CREATE TABLE IF NOT EXISTS products (id text PRIMARY KEY, data jsonb NOT NULL);
                    CREATE TABLE IF NOT EXISTS orders (id text PRIMARY KEY, data jsonb NOT NULL);`);
  const count=(await pool.query('SELECT COUNT(*)::int AS n FROM products')).rows[0].n;
  if(count===0){
    const {products,changed}=normalizeProducts(readJson(productsFile,[]));
    await pool.query('BEGIN');
    try{
      for(const p of products)await pool.query('INSERT INTO products(id,data) VALUES($1,$2)',[p.id,p]);
      await pool.query('COMMIT');
      if(changed)writeJson(productsFile,products);
    }catch(e){await pool.query('ROLLBACK');throw e}
  }
  const ocount=(await pool.query('SELECT COUNT(*)::int AS n FROM orders')).rows[0].n;
  if(ocount===0){
    const orders=readJson(ordersFile,[]);
    await pool.query('BEGIN');
    try{
      for(const o of orders)await pool.query('INSERT INTO orders(id,data) VALUES($1,$2)',[o.id,o]);
      await pool.query('COMMIT');
    }catch(e){await pool.query('ROLLBACK');throw e}
  }
}
async function getProducts(){
  if(pool)return (await pool.query('SELECT data FROM products ORDER BY id')).rows.map(r=>r.data);
  return readJson(productsFile,[]);
}
async function getOrders(){
  if(pool)return (await pool.query("SELECT data FROM orders ORDER BY (data->>'createdAt') DESC")).rows.map(r=>r.data);
  return readJson(ordersFile,[]);
}
async function saveProduct(p){
  if(pool)await pool.query('INSERT INTO products(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data',[p.id,p]);
  else {const a=readJson(productsFile,[]),i=a.findIndex(x=>x.id===p.id);if(i>=0)a[i]=p;else a.push(p);writeJson(productsFile,a)}
}
async function deleteProduct(id){
  if(pool)await pool.query('DELETE FROM products WHERE id=$1',[id]);
  else writeJson(productsFile,readJson(productsFile,[]).filter(p=>p.id!==id));
}
async function saveOrder(o){
  if(pool)await pool.query('INSERT INTO orders(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data',[o.id,o]);
  else {const a=readJson(ordersFile,[]),i=a.findIndex(x=>x.id===o.id);if(i>=0)a[i]=o;else a.unshift(o);writeJson(ordersFile,a)}
}
async function deleteOrder(id){
  if(pool)await pool.query('DELETE FROM orders WHERE id=$1',[id]);
  else writeJson(ordersFile,readJson(ordersFile,[]).filter(o=>o.id!==id));
}
async function getProduct(id){
  if(pool){const r=await pool.query('SELECT data FROM products WHERE id=$1',[id]);return r.rows[0]?.data||null}
  return readJson(productsFile,[]).find(p=>p.id===id)||null;
}
async function getOrder(id){
  if(pool){const r=await pool.query('SELECT data FROM orders WHERE id=$1',[id]);return r.rows[0]?.data||null}
  return readJson(ordersFile,[]).find(o=>o.id===id)||null;
}
async function updateOrderData(id,fn){
  const o=await getOrder(id);if(!o)return null;fn(o);await saveOrder(o);return o;
}
async function reserveStock(safe){
  if(pool){
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      for(const x of safe){
        const r=await client.query('SELECT data FROM products WHERE id=$1 FOR UPDATE',[x.id]);
        const p=r.rows[0]?.data;
        if(!p||Number(p.stock?.[x.size]??0)<x.qty)throw new Error(`${x.name} (${x.size}) är slut i lager.`);
        p.stock[x.size]-=x.qty;
        await client.query('UPDATE products SET data=$2 WHERE id=$1',[x.id,p]);
      }
      await client.query('COMMIT');
    }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
  }else{
    const catalog=await getProducts();
    for(const x of safe){const p=catalog.find(p=>p.id===x.id);if(!p||Number(p.stock?.[x.size]??0)<x.qty)throw new Error('Slut i lager');p.stock[x.size]-=x.qty}
    writeJson(productsFile,catalog);
  }
}
async function releaseStock(order){
  if(pool){
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      for(const x of order.items){
        const r=await client.query('SELECT data FROM products WHERE id=$1 FOR UPDATE',[x.id]);
        const p=r.rows[0]?.data;if(!p)continue;p.stock=p.stock||{};p.stock[x.size]=Number(p.stock[x.size]||0)+Number(x.qty||0);
        await client.query('UPDATE products SET data=$2 WHERE id=$1',[x.id,p]);
      }
      await client.query('COMMIT');
    }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
  }else{
    const catalog=await getProducts();
    for(const x of order.items){const p=catalog.find(p=>p.id===x.id);if(!p)continue;p.stock=p.stock||{};p.stock[x.size]=Number(p.stock[x.size]||0)+Number(x.qty||0)}
    writeJson(productsFile,catalog);
  }
}
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
async function buildSafeOrder(body){
  const {customer,items,shipping}=body||{},customerError=validateCustomer(customer);
  if(customerError)return {error:customerError};
  if(!Array.isArray(items)||!items.length)return {error:'Varukorgen är tom.'};
  if(shipping?.method!=='PostNord')return {error:'Välj PostNord som leveransalternativ.'};
  const catalog=await getProducts(),safe=[];
  for(const item of items){
    const p=catalog.find(x=>x.id===item.id),price=p?.sizes?.[item.size],qty=Number(item.qty),stock=Number(p?.stock?.[item.size]??0);
    if(!p||price===undefined||!Number.isFinite(Number(price))||!Number.isInteger(qty)||qty<1||qty>99)return {error:'En produkt i ordern är ogiltig.'};
    if(stock<qty)return {error:`${p.name} (${item.size}) är slut i lager.`};
    safe.push({id:p.id,name:p.name,brand:p.brand,size:item.size,price:Number(price),qty});
  }
  const subtotal=safe.reduce((s,x)=>s+x.price*x.qty,0),shippingCost=subtotal>=399?0:49,total=subtotal+shippingCost;
  return {safe,subtotal,shippingCost,total,customer:{name:String(customer.name).trim(),email:String(customer.email).trim(),address:String(customer.address).trim(),postalCode:String(customer.postalCode).trim(),city:String(customer.city).trim(),phone:String(customer.phone||'').trim()}};
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
      const order=orderId?await getOrder(orderId):null;
      if(order){order.stripeSessionId=session.id;order.paymentStatus=session.payment_status||'paid';if(session.payment_status==='paid'&&order.status==='Betalning väntar')order.status='Betald';order.paidAt=order.paidAt||new Date().toISOString();await saveOrder(order)}
    }else if(event.type==='checkout.session.expired'){
      const session=event.data.object,orderId=session.metadata?.orderId,order=orderId?await getOrder(orderId):null;
      if(order&&order.status==='Betalning väntar'&&!order.stockReleasedAt){await releaseStock(order);order.status='Avbruten';order.paymentStatus='expired';order.stockReleasedAt=new Date().toISOString();await saveOrder(order)}
    }
  }catch(err){console.error('Stripe webhook handling error:',err)}
  res.json({received:true});
});
app.use(express.json({limit:'100kb'}));
app.use(express.static(path.join(__dirname,'public')));

app.get('/api/health',async(req,res)=>res.json({ok:true,version:'V7',storage:pool?'postgres':'json',stripeConfigured:Boolean(stripe),postNordMode:process.env.POSTNORD_API_KEY?'api-ready':'manual'}));
app.get('/api/products',async(req,res)=>res.json(await getProducts()));
app.get('/api/locales/:lang',(req,res)=>{const lang=String(req.params.lang||'sv').toLowerCase(),allowed=['sv','en','de','fr'];if(!allowed.includes(lang))return res.status(404).json({error:'Language not found'});res.json({ui:readJson(path.join(localesDir,`${lang}.json`),{}),products:readJson(path.join(localesDir,'products.json'),{})[lang]||{}})});

app.post('/api/admin/login',(req,res)=>{
  if(!ADMIN_PASSWORD)return res.status(503).json({error:'Admin is not configured. Set ADMIN_PASSWORD first.'});
  if(String(req.body?.password||'')!==ADMIN_PASSWORD)return res.status(401).json({error:'Fel lösenord.'});
  const token=crypto.randomBytes(32).toString('hex');sessions.set(token,Date.now()+1000*60*60*12);res.json({token});
});
app.post('/api/admin/logout',auth,(req,res)=>{const token=req.headers.authorization.replace(/^Bearer\s+/i,'');sessions.delete(token);res.json({ok:true})});
app.get('/api/admin/orders',auth,async(req,res)=>res.json(await getOrders()));
app.patch('/api/admin/orders/:id',auth,async(req,res)=>{
  const order=await getOrder(req.params.id);if(!order)return res.status(404).json({error:'Order not found'});
  const allowed=['Betalning väntar','Mottagen','Betald','Packas','Skickad','Levererad','Avbruten'],{status,trackingNumber,shippingMethod}=req.body||{};
  if(status!==undefined&&!allowed.includes(status))return res.status(400).json({error:'Ogiltig status.'});
  if(status!==undefined)order.status=status;if(trackingNumber!==undefined)order.trackingNumber=String(trackingNumber).trim().slice(0,120);if(shippingMethod!==undefined)order.shippingMethod=String(shippingMethod).trim().slice(0,80);
  order.updatedAt=new Date().toISOString();await saveOrder(order);res.json({ok:true,order});
});
app.post('/api/admin/products',auth,async(req,res)=>{
  const body=req.body||{},id=String(body.id||'').trim();
  if(!/^[a-z0-9-]{2,40}$/.test(id)||!body.name||!body.brand||!body.category||!body.description||!body.image||!body.sizes||typeof body.sizes!=='object')return res.status(400).json({error:'Fyll i alla produktfält.'});
  if(await getProduct(id))return res.status(409).json({error:'Produkt-ID finns redan.'});
  const sizes={};for(const [s,v] of Object.entries(body.sizes)){const price=Number(v);if(!s||!Number.isFinite(price)||price<0)return res.status(400).json({error:'Ogiltigt pris.'});sizes[s]=price}
  if(!Object.keys(sizes).length)return res.status(400).json({error:'Minst en storlek krävs.'});
  const stock={};for(const s of Object.keys(sizes))stock[s]=Math.max(0,Number.isInteger(Number(body.stock?.[s]))?Number(body.stock[s]):50);
  const p={id,name:String(body.name).trim(),brand:String(body.brand).trim(),category:String(body.category).trim(),description:String(body.description).trim(),notes:Array.isArray(body.notes)?body.notes.map(String):[],sizes,stock,image:String(body.image).trim()};
  await saveProduct(p);res.json({ok:true,product:p});
});
app.patch('/api/admin/products/:id',auth,async(req,res)=>{
  const p=await getProduct(req.params.id);if(!p)return res.status(404).json({error:'Product not found'});const b=req.body||{};
  ['name','brand','category','description','image'].forEach(k=>{if(b[k]!==undefined)p[k]=String(b[k]).trim()});
  if(b.notes!==undefined)p.notes=Array.isArray(b.notes)?b.notes.map(String):[];
  if(b.sizes!==undefined){if(!b.sizes||typeof b.sizes!=='object')return res.status(400).json({error:'Ogiltiga storlekar.'});const sizes={};for(const [s,v] of Object.entries(b.sizes)){const n=Number(v);if(!s||!Number.isFinite(n)||n<0)return res.status(400).json({error:'Ogiltigt pris.'});sizes[s]=n}p.sizes=sizes;p.stock=p.stock||{};for(const s of Object.keys(sizes))if(!Number.isInteger(p.stock[s]))p.stock[s]=50;for(const s of Object.keys(p.stock))if(!Object.prototype.hasOwnProperty.call(sizes,s))delete p.stock[s]}
  if(b.stock!==undefined){if(!b.stock||typeof b.stock!=='object')return res.status(400).json({error:'Ogiltigt lager.'});for(const s of Object.keys(p.sizes||{})){const n=Number(b.stock[s]);if(!Number.isInteger(n)||n<0||n>100000)return res.status(400).json({error:'Lager måste vara ett heltal 0–100000.'});p.stock[s]=n}}
  await saveProduct(p);res.json({ok:true,product:p});
});
app.delete('/api/admin/products/:id',auth,async(req,res)=>{if(!await getProduct(req.params.id))return res.status(404).json({error:'Product not found'});await deleteProduct(req.params.id);res.json({ok:true})});

app.post('/api/orders/checkout',async(req,res)=>{
  if(!stripe)return res.status(503).json({error:'Stripe är inte konfigurerat ännu. Lägg in STRIPE_SECRET_KEY i .env.'});
  const built=await buildSafeOrder(req.body);if(built.error)return res.status(400).json({error:built.error});
  const {safe,subtotal,shippingCost,total,customer}=built;
  const order={id:slugId(),createdAt:new Date().toISOString(),status:'Betalning väntar',paymentStatus:'unpaid',shippingMethod:'PostNord',shippingCost,customer,items:safe,subtotal,total};
  try{await reserveStock(safe);await saveOrder(order)}catch(err){return res.status(409).json({error:err.message||'Kunde inte reservera lager.'})}
  try{
    const line_items=safe.map(i=>({price_data:{currency:'sek',product_data:{name:`${i.name} — ${i.size}`,metadata:{productId:i.id,size:i.size}},unit_amount:Math.round(i.price*100)},quantity:i.qty}));
    if(shippingCost>0)line_items.push({price_data:{currency:'sek',product_data:{name:'PostNord — leverans'},unit_amount:Math.round(shippingCost*100)},quantity:1});
    const session=await stripe.checkout.sessions.create({mode:'payment',line_items,customer_email:customer.email,client_reference_id:order.id,metadata:{orderId:order.id},billing_address_collection:'required',success_url:absoluteUrl(req,`/order/success?id=${encodeURIComponent(order.id)}&email=${encodeURIComponent(customer.email)}`),cancel_url:absoluteUrl(req,'/?checkout=cancelled'),submit_type:'pay'});
    order.stripeSessionId=session.id;await saveOrder(order);res.json({ok:true,url:session.url,order:publicOrder(order)});
  }catch(err){
    await releaseStock(order);await deleteOrder(order.id);console.error('Stripe checkout error:',err);res.status(502).json({error:'Kunde inte starta betalningen. Försök igen.'});
  }
});
app.get('/api/orders/:id',async(req,res)=>{
  const id=String(req.params.id||'').trim().toUpperCase(),email=String(req.query.email||'').trim().toLowerCase();if(!id||!email)return res.status(400).json({error:'Ordernummer och e-post krävs.'});
  const order=await getOrder(id);if(!order||String(order.customer.email).toLowerCase()!==email)return res.status(404).json({error:'Ordern hittades inte. Kontrollera ordernummer och e-post.'});res.json(publicOrder(order));
});
app.get('/admin',(req,res)=>res.sendFile(path.join(__dirname,'public','admin.html')));
app.get('/order',(req,res)=>res.sendFile(path.join(__dirname,'public','order.html')));
app.get('/order/success',(req,res)=>res.sendFile(path.join(__dirname,'public','success.html')));
app.get('/terms',(req,res)=>res.sendFile(path.join(__dirname,'public','terms.html')));
app.get('/privacy',(req,res)=>res.sendFile(path.join(__dirname,'public','privacy.html')));
async function start(){try{await initDb();app.listen(PORT,()=>console.log(`ScentPlugSweden V7 kör på ${BASE_URL} (${pool?'PostgreSQL':'JSON'})`))}catch(e){console.error('Startup failed:',e);process.exit(1)}}
start();
