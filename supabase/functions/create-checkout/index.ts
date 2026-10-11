// LOUIS COR owns its catalog, reservations and orders. Stripe API keys stay with SEZA.
const supabaseUrl=Deno.env.get('SUPABASE_URL')||'';
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const siteUrl=(Deno.env.get('SITE_URL')||'').replace(/\/$/,'');
const gatewayUrl=Deno.env.get('SEZA_LC_GATEWAY_URL')||'';
const sharedKey=Deno.env.get('LC_GATEWAY_SHARED_SECRET')||'';
const connectedId=Deno.env.get('LC_CONNECTED_ACCOUNT_ID')||'';
const enabled=Deno.env.get('CHECKOUT_ENABLED')==='true';
const encoder=new TextEncoder();
const permitted=(o: string|null)=>Boolean(o&&/^https:\/\//.test(siteUrl)&&o===new URL(siteUrl).origin);
const cors=(o: string|null)=>({'Access-Control-Allow-Origin':permitted(o)?o!:'null',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'});
const reply=(message: string,status: number,o: string|null)=>new Response(JSON.stringify({message}),{
  status,headers:{...cors(o),'Content-Type':'application/json','Cache-Control':'no-store'}});
async function sign(raw: string,stamp: string) {
 const key=await crypto.subtle.importKey('raw',encoder.encode(sharedKey),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const digest=new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(`${stamp}.${raw}`)));
 return Array.from(digest,x=>x.toString(16).padStart(2,'0')).join('');
}
async function gateway(payload: object) {
 const raw=JSON.stringify(payload),stamp=String(Math.floor(Date.now()/1000));
 const response=await fetch(gatewayUrl,{method:'POST',headers:{'Content-Type':'application/json',
  'x-lc-timestamp':stamp,'x-lc-signature':await sign(raw,stamp)},body:raw,
  signal:AbortSignal.timeout(18000)});
 if (!response.ok) throw new Error('Merchant payment service not ready');
 return response.json();
}
async function rpc<T>(name: string,body: object): Promise<T> {
 const res=await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:serviceKey,
  Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
 if (!res.ok) throw new Error('Order unavailable');return res.json() as Promise<T>;
}
type Item={name:string;color:string;size:string;quantity:number;unit_price_cents:number};
type Reservation={order_id:string;order_number:string;subtotal_cents:number;items:Item[]};
Deno.serve(async req=>{
 const origin=req.headers.get('Origin');
 if (req.method==='OPTIONS') return new Response(null,{status:204,headers:cors(origin)});
 if (req.method!=='POST'||!permitted(origin)) return reply('Request unavailable.',403,origin);
 if (!enabled || sharedKey.length<32 || !serviceKey || !/^https:\/\//.test(siteUrl) ||
     !/^https:\/\/[^/]+\/functions\/v1\/seza-louis-cor-gateway$/.test(gatewayUrl) ||
     !/^acct_[A-Za-z0-9]+$/.test(connectedId)) return reply('Checkout is not available yet.',503,origin);
 const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
 if (!jwt) return reply('Please sign in to continue.',401,origin);
 const u=await fetch(`${supabaseUrl}/auth/v1/user`,{headers:{apikey:serviceKey,Authorization:`Bearer ${jwt}`}});
 if (!u.ok) return reply('Please sign in again.',401,origin);
 const user=await u.json();
 if (!user?.id || !user?.email_confirmed_at) return reply('Please verify your email before checkout.',403,origin);
 const settingsRes=await fetch(`${supabaseUrl}/rest/v1/lc_store_settings?select=*&id=eq.1`,{
  headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`}});
 const settings=settingsRes.ok?(await settingsRes.json())[0]:null;
 if (!settings || ['legal_business_name','support_email','privacy_email','postal_address','shipping_regions',
  'processing_time','return_conditions','return_address'].some(f=>!String(settings[f]||'').trim())||
  settings.return_window_days===null) return reply('Checkout is not available yet.',503,origin);
 let orderId: string|null=null;let sessionId: string|null=null;
 try{
  const input=await req.json();
  if(!Array.isArray(input?.cart)||input.cart.length<1||input.cart.length>20) return reply('Please review your bag.',400,origin);
  const cart=input.cart.map((x: any)=>({product_id:x.product_id,color:x.color,size:x.size,quantity:x.quantity}));
  if(cart.some((x: any)=>typeof x.product_id!=='string'||typeof x.color!=='string'||
    typeof x.size!=='string'||!Number.isInteger(x.quantity))) return reply('Please review your bag.',400,origin);
  const reservation=await rpc<Reservation>('lc_checkout_reserve',{buyer_id:user.id,cart});
  orderId=reservation.order_id;
  const session=await gateway({action:'create_checkout',order_id:orderId,email:user.email,
    subtotal_cents:reservation.subtotal_cents,items:reservation.items});
  if (!session?.session_id || !session?.url) throw new Error('Checkout not started');
  sessionId=session.session_id;
  await rpc('lc_checkout_attach',{oid:orderId,sid:sessionId});
  return new Response(JSON.stringify({url:session.url}),{headers:{...cors(origin),
    'Content-Type':'application/json','Cache-Control':'no-store'}});
 }catch(error){
  // A Stripe session must be expired before restoring held inventory.
  if(sessionId){try{await gateway({action:'expire_checkout',session_id:sessionId})}catch(e){
    console.error('Checkout requires manual reconciliation; do not release stock',e);
    return reply('Your checkout could not be completed. Please contact the store.',503,origin);
  }}
  if(orderId){try{await rpc('lc_checkout_release',{oid:orderId})}catch(e){console.error('Inventory release unsuccessful',e)}}
  console.error('Checkout unavailable',error);
  return reply('We could not start checkout. Please try again.',503,origin);
 }
});
export {};
