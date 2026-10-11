/* LOUIS COR backend client. Supabase Auth + REST + Storage; no vendor build required.
   No service role key, no client-side authorization bypass, no fake browser database. */
(function () {
  'use strict';
  const cfg=window.LC_BACKEND_CONFIG||{};
  const endpoint=String(cfg.url||'').replace(/\/$/,'');
  const key=String(cfg.publishableKey||'');
  const configured=Boolean(/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(endpoint)&&key);
  const storageKey='lc-owner-auth-session-v1';
  let auth=null;
  try{auth=JSON.parse(localStorage.getItem(storageKey)||'null')}catch(_){}
  function saveAuth(data){auth=data; if(data)localStorage.setItem(storageKey,JSON.stringify(data));else localStorage.removeItem(storageKey)}
  function check(){if(!configured)throw Error('Connect the LOUIS COR Supabase project in config.js before using live management.');}
  function encode(s){return encodeURIComponent(String(s))}
  async function request(path,{method='GET',body,authRequired=false,headers={}}={}){
    check();
    if(authRequired){await ensureToken();if(!auth?.access_token)throw Error('Please sign in.');}
    const h={'apikey':key, ...headers};
    if(authRequired)h.Authorization='Bearer '+auth.access_token;
    else if(key.startsWith('eyJ'))h.Authorization='Bearer '+key;
    if(body!==undefined && !headers['Content-Type'])h['Content-Type']='application/json';
    let res;
    try{res=await fetch(endpoint+path,{method,headers:h,body:body===undefined?undefined:(typeof body==='string'||body instanceof Blob?body:JSON.stringify(body))})}
    catch(e){throw Error('Could not reach the store database. Check your internet connection.');}
    if(!res.ok){let detail;try{detail=await res.json()}catch(_){detail={}};throw Error(detail.msg||detail.message||detail.error_description||detail.error||'Request failed ('+res.status+')');}
    if(res.status===204)return null;
    const text=await res.text();return text?JSON.parse(text):null;
  }
  async function login(email,password){check();const result=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});saveAuth(result);return profile()}
  async function refresh(){check();if(!auth?.refresh_token)throw Error('Session expired. Please sign in.');const response=await fetch(endpoint+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:auth.refresh_token})});if(!response.ok){saveAuth(null);throw Error('Session expired. Please sign in again.');} const data=await response.json();saveAuth(data);return data}
  async function ensureToken(){if(!auth?.access_token)throw Error('Please sign in.');if(auth.expires_at && auth.expires_at*1000<Date.now()+60000)await refresh();}
  async function profile(){await ensureToken();const users=await request('/rest/v1/lc_store_members?select=user_id,role&user_id=eq.'+encode(auth.user.id),{authRequired:true});if(!users||!users.length||users[0].role!=='owner'){saveAuth(null);throw Error('This account has no LOUIS COR owner permission.');}return {id:auth.user.id,email:auth.user.email,role:'owner'};}
  async function logout(){if(auth?.access_token){try{await request('/auth/v1/logout',{method:'POST',authRequired:true})}catch(_){}}saveAuth(null)}
  const currentUser=()=>auth?.user||null;
  const imageUrl=path=>!path?null:(/^https?:\/\//.test(path)?path:(endpoint+'/storage/v1/object/public/lc-product-images/'+path.split('/').map(encode).join('/')));
  function toUi(row,vars=[]){return {id:row.id,name:row.name,category:row.category,group:row.audience,price:row.price_cents/100,compareAt:(row.compare_at_cents||0)/100,status:row.status,sku:row.sku||'',image:row.image_path?imageUrl(row.image_path):'',imagePath:row.image_path||'',detail:row.image_path?imageUrl(row.image_path):'',alt:row.image_alt||row.name,tag:row.label||'',description:row.description||'',fabric:row.materials||'',featured:row.featured,updatedAt:row.updated_at,variants:vars.map(x=>({color:x.color,size:x.size,qty:x.stock_qty,sku:x.sku||''})),colors:[...new Set(vars.map(x=>x.color))],sizes:[...new Set(vars.map(x=>x.size))]}}
  async function readProducts({owner=false}={}){
    const opts=owner?{authRequired:true}:{};
    const [rows,vars]=await Promise.all([request('/rest/v1/lc_products?select=*&order=created_at.desc',opts),request('/rest/v1/lc_variants?select=*',opts)]);
    const byId={};(vars||[]).forEach(x=>(byId[x.product_id]??=[]).push(x));
    return (rows||[]).filter(x=>owner||x.status==='active').map(x=>toUi(x,byId[x.id]||[]));
  }
  async function upsertProduct(p){await ensureToken();const payload={id:p.id,name:p.name,category:p.category,audience:p.group,price_cents:Math.round(Number(p.price)*100),compare_at_cents:p.compareAt?Math.round(Number(p.compareAt)*100):null,description:p.description||'',materials:p.fabric||'',sku:p.sku||'',image_path:p.imagePath||null,image_alt:p.alt||p.name,label:p.tag||'',featured:!!p.featured,status:p.status,variants:(p.variants||[]).map(v=>({color:v.color,size:v.size,stock_qty:Number(v.qty),sku:v.sku||''}))};return request('/rest/v1/rpc/lc_upsert_product',{method:'POST',body:{payload},authRequired:true});}
  async function archiveProduct(id){return request('/rest/v1/lc_products?id=eq.'+encode(id),{method:'PATCH',body:{status:'archived'},authRequired:true,headers:{Prefer:'return=minimal'}})}
  async function uploadProductPhoto(file){await ensureToken();if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Please select JPG, PNG, or WebP.');if(file.size>10*1024*1024)throw Error('Maximum file size is 10 MB.');const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];const path=auth.user.id+'/'+(typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)) + '.'+ext;await request('/storage/v1/object/lc-product-images/'+path,{method:'POST',body:file,authRequired:true,headers:{'Content-Type':file.type,'cache-control':'3600'}});return {path,url:imageUrl(path)};}
  async function readCustomers(){return request('/rest/v1/rpc/lc_list_customers',{method:'POST',body:{},authRequired:true});}
  async function readOrders(){const [orders,lines,shipments]=await Promise.all([request('/rest/v1/lc_orders?select=*&order=created_at.desc&limit=200',{authRequired:true}),request('/rest/v1/lc_order_lines?select=*',{authRequired:true}),request('/rest/v1/lc_shipments?select=*',{authRequired:true})]);return (orders||[]).map(o=>({...o,lines:(lines||[]).filter(x=>x.order_id===o.id),shipments:(shipments||[]).filter(x=>x.order_id===o.id)}))}
  async function recordTracking(orderId,carrier,tracking){if(!carrier?.trim()||!tracking?.trim())throw Error('Carrier and tracking number are required.');return request('/rest/v1/rpc/lc_record_tracking',{method:'POST',body:{order_id:orderId,carrier_name:carrier.trim(),tracking_number:tracking.trim()},authRequired:true})}
  async function readSettings(){const result=await request('/rest/v1/lc_store_settings?select=*&id=eq.1');return result?.[0]||null}
  async function updateSettings(value){return request('/rest/v1/lc_store_settings?id=eq.1',{method:'PATCH',body:value,authRequired:true,headers:{Prefer:'return=representation'}})}
  window.LCBackend={configured,currentUser,login,logout,profile,readProducts,upsertProduct,archiveProduct,uploadProductPhoto,readOrders,readCustomers,recordTracking,readSettings,updateSettings,imageUrl};
})();
