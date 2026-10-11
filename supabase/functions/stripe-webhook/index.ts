// Receives verified Stripe Connect events forwarded and signed by the SEZA gateway.
// The SEZA live Stripe key is never stored in this project.
const secret=Deno.env.get('LC_GATEWAY_SHARED_SECRET')||'';
const merchantId=Deno.env.get('LC_CONNECTED_ACCOUNT_ID')||'';
const supabaseUrl=Deno.env.get('SUPABASE_URL')||'';
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const enc=new TextEncoder();
function equal(a:string,b:string){if(a.length!==b.length||!/^[a-f0-9]+$/i.test(a)||!/^[a-f0-9]+$/i.test(b))return false;
 let delta=0;for(let i=0;i<a.length;i++)delta |= a.charCodeAt(i)^b.charCodeAt(i);return delta===0;}
async function authorized(req:Request,raw:string){
 const timestamp=req.headers.get('x-lc-timestamp')||'';
 if(secret.length<32||!/^[0-9]{10}$/.test(timestamp)||Math.abs(Date.now()/1000-Number(timestamp))>300)return false;
 const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const digest=new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(`${timestamp}.${raw}`)));
 return equal(req.headers.get('x-lc-signature')||'',Array.from(digest,b=>b.toString(16).padStart(2,'0')).join(''));
}
async function rpc(name:string,body:object){
 const res=await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`,{method:'POST',headers:{
  apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!res.ok)throw Error('Payment reconciliation failed');return res.json();
}
Deno.serve(async req=>{
 if(req.method!=='POST'||!serviceKey||!/^acct_[A-Za-z0-9]+$/.test(merchantId))return new Response('Rejected',{status:403});
 const raw=await req.text();
 if(!(await authorized(req,raw)))return new Response('Rejected',{status:401});
 try{
  const event=JSON.parse(raw),o=event?.data?.object;
  if(event?.livemode!==true||event?.account!==merchantId||!o||!event.id)
   return new Response('Rejected',{status:403});
  if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){
   if(o.payment_status!=='paid')return new Response('Accepted');
   if(!o.metadata?.lc_order_id||!o.id||o.currency!=='usd')return new Response('Rejected',{status:400});
   await rpc('lc_checkout_paid',{oid:o.metadata.lc_order_id,sid:o.id,payment_intent:o.payment_intent,
    paid_total:o.amount_total,shipping_total:Number(o.shipping_cost?.amount_total||0),
    tax_total:Number(o.total_details?.amount_tax||0),
    address:o.collected_information?.shipping_details||o.shipping_details||o.customer_details?.address||null});
  }else if(['checkout.session.expired','checkout.session.async_payment_failed'].includes(event.type)){
   if(!o.metadata?.lc_order_id||!o.id)return new Response('Rejected',{status:400});
   await rpc('lc_checkout_release',{oid:o.metadata.lc_order_id,sid:o.id});
  }else if(event.type==='charge.refunded'){
   if(o.payment_intent&&Number.isSafeInteger(o.amount_refunded))
    await rpc('lc_record_stripe_refund',{payment_intent:o.payment_intent,refund_total:o.amount_refunded});
  }else{return new Response('Ignored')}
  await rpc('lc_record_payment_event',{eid:event.id,kind:event.type});
  return new Response('OK');
 }catch(e){console.error('Order event processing unsuccessful',e);return new Response('Retry',{status:503});}
});
export {};
