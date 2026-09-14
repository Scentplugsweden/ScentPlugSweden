const Module=require('module');
const fs=require('fs');
const originalLoad=Module._load;
const originalJsLoader=Module._extensions['.js'];
let activeCampaign=null;

Module._extensions['.js']=function(module,filename){
  if(filename===require('path').join(__dirname,'server.js')){
    let source=fs.readFileSync(filename,'utf8');
    source=source.replace(
      "const subtotal=safe.reduce((s,x)=>s+x.price*x.qty,0),shippingCost=subtotal>=399?0:49,total=subtotal+shippingCost;",
      "const subtotal=safe.reduce((s,x)=>s+x.price*x.qty,0),shippingWeightGrams=safe.reduce((s,x)=>s+25*x.qty,0),shippingCost=subtotal>=499?0:shippingWeightGrams<=50?22:shippingWeightGrams<=100?44:shippingWeightGrams<=250?61:shippingWeightGrams<=500?88:shippingWeightGrams<=1000?132:154,total=subtotal+shippingCost;"
    );
    source=source.replace(
      /async function start\(\)\{try\{await initDb\(\);app\.listen\(PORT,\(\)=>console\.log\(`ScentPlugSweden V7 kör på \$\{BASE_URL\} \(\$\{pool\?'PostgreSQL':'JSON'\}\)`\)\)\}catch\(e\)\{console\.error\('Startup failed:',e\);process\.exit\(1\)\}\}\s*start\(\);/s,
      "function start(){app.listen(PORT,()=>console.log(`ScentPlugSweden V7 kör på ${BASE_URL} (${pool?'PostgreSQL':'JSON'})`));initDb().then(()=>console.log('[DB] PostgreSQL initialization complete')).catch(e=>console.error('[DB] Initialization failed, server remains online:',e.message))}\nstart();"
    );
    return module._compile(source,filename);
  }
  return originalJsLoader(module,filename);
};

Module._load=function(request,parent,isMain){
  if(request==='stripe'){
    const Stripe=originalLoad.apply(this,arguments);
    return function(...args){
      const client=Stripe(...args);
      const originalCreate=client.checkout.sessions.create.bind(client.checkout.sessions);
      client.checkout.sessions.create=async(params)=>{
        if(activeCampaign?.discountCents){
          const coupon=await client.coupons.create({amount_off:activeCampaign.discountCents,currency:'sek',duration:'once',name:'Vinter2026 – Mystery Sample'});
          params={...params,discounts:[{coupon:coupon.id}],metadata:{...(params.metadata||{}),campaignCode:'Vinter2026',campaignReward:'Mystery Sample'}};
        }
        return originalCreate(params);
      };
      return client;
    };
  }
  return originalLoad.apply(this,arguments);
};
const express=require('express');
const originalPost=express.application.post;
express.application.post=function(path,...handlers){
  if(path==='/api/orders/checkout'&&handlers.length){
    const originalHandler=handlers[handlers.length-1];
    handlers[handlers.length-1]=async function(req,res,next){
      const body=req.body||{},code=String(body.customer?.promoCode||body.promoCode||'').trim().toUpperCase(),items=Array.isArray(body.items)?body.items:[],qty=items.reduce((sum,item)=>sum+Number(item.qty||0),0);
      if(code==='VINTER2026'&&qty>=3){if(!items.some(i=>i.id==='mystery-sample'))items.push({id:'mystery-sample',size:'1 ml',qty:1,name:'Mystery Sample',brand:'ScentPlugSweden',price:49});body.items=items;activeCampaign={discountCents:4900}}
      else if(code)return res.status(400).json({error:qty<3?'Kampanjen kräver minst 3 samples.':'Ogiltig kampanjkod.'});
      try{return await originalHandler(req,res,next)}finally{activeCampaign=null}
    };
  }
  return originalPost.call(this,path,...handlers);
};
if(process.env.DATABASE_URL)setTimeout(async()=>{try{const {Pool}=require('pg');const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});await pool.query(`INSERT INTO products(id,data) VALUES($1,$2) ON CONFLICT(id) DO NOTHING`,['mystery-sample',{id:'mystery-sample',name:'Mystery Sample',brand:'ScentPlugSweden',category:'Kampanj',description:'En överraskningsdoft som väljs ut för din beställning.',notes:['Mystery'],sizes:{'1 ml':49},stock:{'1 ml':999999},image:'https://images.unsplash.com/photo-1547887538-e3a2f32cb1cc?auto=format&fit=crop&w=900&q=85',hidden:true,bestseller:false}]);await pool.end()}catch(e){console.error('Campaign product seed skipped:',e.message)}},3000);
