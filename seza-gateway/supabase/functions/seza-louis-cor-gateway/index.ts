// SEZA payment boundary: the platform's Stripe secret never enters the merchant database.
// This function supports only one explicitly configured connected account and no subscriptions.
const secret = Deno.env.get('LC_GATEWAY_SHARED_SECRET') || '';
const stripeKey = Deno.env.get('SEZA_STRIPE_LIVE_SECRET_KEY') || '';
const connectedId = Deno.env.get('LC_CONNECTED_ACCOUNT_ID') || '';
const siteUrl = (Deno.env.get('LC_SITE_URL') || '').replace(/\/$/, '');
const webhookSecret = Deno.env.get('LC_STRIPE_CONNECT_WEBHOOK_SECRET') || '';
const callbackUrl = Deno.env.get('LC_FORWARD_WEBHOOK_URL') || '';
const shippingFee = Deno.env.get('LC_SHIPPING_FEE_CENTS') || '';
const autoTax = Deno.env.get('LC_AUTOMATIC_TAX_ENABLED') || '';
const enabled = Deno.env.get('LC_GATEWAY_ENABLED') === 'true';
const encoder = new TextEncoder();

function configured() {
  return enabled && secret.length >= 32 && stripeKey.startsWith('sk_live_') &&
    /^acct_[A-Za-z0-9]+$/.test(connectedId) &&
    /^https:\/\//.test(siteUrl) &&
    /^https:\/\/ualukbmqfayymggevizo\.supabase\.co\/functions\/v1\/stripe-webhook$/.test(callbackUrl) &&
    /^\d{1,6}$/.test(shippingFee) && ['true','false'].includes(autoTax) && webhookSecret.startsWith('whsec_');
}
const json = (data: unknown, code = 200) => new Response(JSON.stringify(data), {
  status: code, headers: {'Content-Type':'application/json','Cache-Control':'no-store'}
});
function eqHex(a: string, b: string) {
  if (a.length !== b.length || !/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b)) return false;
  let diff = 0; for (let i=0;i<a.length;i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function hmac(value: string, keyText: string) {
  const key = await crypto.subtle.importKey('raw',encoder.encode(keyText),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value)));
  return Array.from(bytes, x => x.toString(16).padStart(2,'0')).join('');
}
async function verifyService(req: Request, raw: string) {
  const stamp = req.headers.get('x-lc-timestamp') || '';
  if (!/^\d{10}$/.test(stamp) || Math.abs(Date.now()/1000-Number(stamp))>300 || secret.length<32) return false;
  return eqHex(req.headers.get('x-lc-signature') || '',await hmac(`${stamp}.${raw}`,secret));
}
async function verifyStripe(raw: string, header: string) {
  const fields = header.split(',').map(x=>x.trim().split('='));
  const stamp = fields.find(x=>x[0]==='t')?.[1] || '';
  const signatures = fields.filter(x=>x[0]==='v1').map(x=>x[1]);
  if (!/^\d{10}$/.test(stamp) || Math.abs(Date.now()/1000-Number(stamp))>300 || !signatures.length) return false;
  const expected = await hmac(`${stamp}.${raw}`,webhookSecret);
  return signatures.some(sig=>eqHex(sig,expected));
}
async function merchantReady() {
  if (!configured()) return false;
  try {
    const query = new URLSearchParams();query.append('include[]','configuration.merchant');
    const res = await fetch(`https://api.stripe.com/v2/core/accounts/${encodeURIComponent(connectedId)}?${query}`,{
      headers:{Authorization:`Bearer ${stripeKey}`,'Stripe-Version':'2026-08-26.preview'},signal:AbortSignal.timeout(8500)
    });
    if (!res.ok) return false;
    const account = await res.json();
    const status = account?.configuration?.merchant?.capabilities?.card_payments?.status || '';
    return account?.livemode !== false && ['active','enabled'].includes(String(status).toLowerCase());
  } catch(_) { return false; }
}
async function stripeRequest(path: string, fields: URLSearchParams, key?: string) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`,{
    method:'POST',headers:{Authorization:`Bearer ${stripeKey}`,'Stripe-Account':connectedId,
      'Content-Type':'application/x-www-form-urlencoded',...(key?{'Idempotency-Key':key}:{})},
    body:fields.toString(),signal:AbortSignal.timeout(14000)
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Stripe operation unsuccessful');
  return data;
}
function validateOrder(body: any) {
  if (!body || !/^[0-9a-f-]{36}$/.test(String(body.order_id||'')) ||
    typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || body.email.length>254 ||
    !Array.isArray(body.items) || body.items.length<1 || body.items.length>20) return false;
  let subtotal=0;
  for (const item of body.items) {
    if (!item || typeof item.name!=='string' || item.name.length<2 || item.name.length>180 ||
      typeof item.color!=='string' || item.color.length>70 || typeof item.size!=='string' || item.size.length>40 ||
      !Number.isInteger(item.quantity) || item.quantity<1 || item.quantity>99 ||
      !Number.isSafeInteger(item.unit_price_cents) || item.unit_price_cents<50 || item.unit_price_cents>200000000) return false;
    subtotal+=item.quantity*item.unit_price_cents;
  }
  return subtotal===body.subtotal_cents && subtotal<=200000000;
}
Deno.serve(async (req: Request) => {
  if (!configured()) return json({message:'Payment service unavailable'},503);
  if (req.method==='POST' && req.headers.has('Stripe-Signature')) {
    const raw=await req.text();
    if (!(await verifyStripe(raw,req.headers.get('Stripe-Signature') || ''))) return json({message:'Rejected'},400);
    let event: any;try{event=JSON.parse(raw)}catch(_){return json({message:'Rejected'},400)}
    if (event?.livemode!==true || event?.account!==connectedId) return json({accepted:true});
    if (!['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.expired',
      'checkout.session.async_payment_failed','charge.refunded'].includes(event.type)) return json({accepted:true});
    const stamp=String(Math.floor(Date.now()/1000));
    const res=await fetch(callbackUrl,{method:'POST',headers:{'Content-Type':'application/json',
      'x-lc-timestamp':stamp,'x-lc-signature':await hmac(`${stamp}.${raw}`,secret)},body:raw,
      signal:AbortSignal.timeout(15000)}).catch(()=>null);
    if (!res?.ok) return json({message:'Delivery pending'},503);
    return json({accepted:true});
  }
  if (!['GET','POST'].includes(req.method)) return json({message:'Method not allowed'},405);
  const raw=req.method==='POST'?await req.text():'';
  if (!(await verifyService(req,raw))) return json({message:'Unauthorized'},401);
  if (req.method==='GET') return json({ready:await merchantReady()});
  let body: any;try{body=JSON.parse(raw)}catch(_){return json({message:'Invalid request'},400)}
  if (body?.action==='expire_checkout') {
    if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(String(body.session_id||''))) return json({message:'Invalid session'},400);
    try{await stripeRequest(`checkout/sessions/${encodeURIComponent(body.session_id)}/expire`,new URLSearchParams());return json({expired:true})}
    catch(_){return json({expired:false},409)}
  }
  if (body?.action!=='create_checkout' || !validateOrder(body)) return json({message:'Invalid request'},400);
  if (!(await merchantReady())) return json({message:'Merchant not ready'},503);
  const p=new URLSearchParams();
  p.set('mode','payment');p.set('payment_method_types[0]','card');
  p.set('success_url',`${siteUrl}/#/account/orders`);
  p.set('cancel_url',`${siteUrl}/#/shop`);
  p.set('client_reference_id',body.order_id);
  p.set('customer_email',body.email);
  p.set('metadata[lc_order_id]',body.order_id);
  p.set('metadata[lc_payment_processor]','seza_connect');
  p.set('expires_at',String(Math.floor(Date.now()/1000)+30*60));
  p.set('billing_address_collection','required');
  p.set('shipping_address_collection[allowed_countries][0]','US');
  p.set('phone_number_collection[enabled]','true');
  p.set('shipping_options[0][shipping_rate_data][type]','fixed_amount');
  p.set('shipping_options[0][shipping_rate_data][fixed_amount][amount]',shippingFee);
  p.set('shipping_options[0][shipping_rate_data][fixed_amount][currency]','usd');
  p.set('shipping_options[0][shipping_rate_data][display_name]','Standard shipping');
  p.set('automatic_tax[enabled]',autoTax);
  // No application_fee_amount: the clothing merchant owes no platform transaction markup.
  body.items.forEach((item: any,i: number) => {
    p.set(`line_items[${i}][price_data][currency]`,'usd');
    p.set(`line_items[${i}][price_data][unit_amount]`,String(item.unit_price_cents));
    p.set(`line_items[${i}][price_data][product_data][name]`,`${item.name} · ${item.color} / ${item.size}`.slice(0,240));
    p.set(`line_items[${i}][quantity]`,String(item.quantity));
  });
  try{
    const session=await stripeRequest('checkout/sessions',p,`lc-direct-${body.order_id}`);
    if (!session?.id || !session?.url) throw new Error('No session returned');
    return json({session_id:session.id,url:session.url});
  }catch(_){return json({message:'Checkout could not start'},503)}
});
export {};
