// Public status for a checkout backed by SEZA Stripe Connect, never a payment key.
Deno.serve(async(req: Request)=>{
 if(!['GET','OPTIONS'].includes(req.method)) return new Response(null,{status:405});
 let available=Deno.env.get('CHECKOUT_ENABLED')==='true' &&
  (Deno.env.get('LC_GATEWAY_SHARED_SECRET')||'').length>=32 &&
  /^acct_[A-Za-z0-9]+$/.test(Deno.env.get('LC_CONNECTED_ACCOUNT_ID')||'') &&
  /^https:\/\//.test(Deno.env.get('SITE_URL')||'');
 if(available){
  try{
   const base=Deno.env.get('SUPABASE_URL')||'', key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
   const res=await fetch(`${base}/rest/v1/lc_store_settings?select=*&id=eq.1`,{
    headers:{apikey:key,Authorization:`Bearer ${key}`}});
   const settings=res.ok?(await res.json())[0]:null;
   available=Boolean(settings&&['legal_business_name','support_email','privacy_email','postal_address',
    'shipping_regions','processing_time','return_conditions','return_address']
    .every(f=>String(settings[f]||'').trim())&&settings.return_window_days!==null);
   if(available){
    const url=Deno.env.get('SEZA_LC_GATEWAY_URL')||'',secret=Deno.env.get('LC_GATEWAY_SHARED_SECRET')||'';
    const stamp=String(Math.floor(Date.now()/1000));const enc=new TextEncoder();
    const hmacKey=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const signature=new Uint8Array(await crypto.subtle.sign('HMAC',hmacKey,enc.encode(`${stamp}.`)));
    const hex=Array.from(signature,b=>b.toString(16).padStart(2,'0')).join('');
    const gate=await fetch(url,{headers:{'x-lc-timestamp':stamp,'x-lc-signature':hex},signal:AbortSignal.timeout(10000)});
    available=gate.ok&&(await gate.json())?.ready===true;
   }
  }catch(_){available=false}
 }
 return new Response(JSON.stringify({available}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store',
  'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey, authorization','Access-Control-Allow-Methods':'GET, OPTIONS'}});
});
export {};
