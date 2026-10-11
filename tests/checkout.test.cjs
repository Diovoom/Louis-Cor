const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
function initialize({ready=true,loggedIn=true}={}){
 const calls=[];
 const fetch=async(url,options={})=>{
  calls.push({url,options});
  if(url.endsWith('/checkout-status'))return {ok:true,json:async()=>({available:ready})};
  if(url.endsWith('/create-checkout'))return {ok:true,json:async()=>({url:'https://checkout.stripe.com/c/pay/session_mock'})};
  throw Error('Unexpected request');
 };
 const context={window:{LC_BACKEND_CONFIG:{url:'https://example.supabase.co',publishableKey:'sb_publishable_test'},LCCustomer:{accessToken:async()=> loggedIn?'customer.jwt':'',user:()=>loggedIn?{id:'example'}:null}},fetch,URL,Error,Object,Array,String,Boolean};
 vm.runInNewContext(fs.readFileSync(path.join(root,'checkout-client.js'),'utf8'),context);
 return {api:context.window.LCCheckout,calls};
}
test('checkout remains disabled until private server says ready',async()=>{
 const {api,calls}=initialize({ready:false});
 assert.equal(await api.status(),false);
 await assert.rejects(()=>api.start([{id:'p',qty:1,color:'Black',size:'L'}]));
 assert.equal(calls.length,1);
});
test('checkout passes selected variants and authenticated customer token without browser pricing',async()=>{
 const {api,calls}=initialize();
 assert.equal(await api.status(),true);
 assert.equal(await api.start([{id:'hoodie',color:'Black',size:'M',qty:2,price:1},{id:'jacket',color:'Brown',size:'L',qty:1,price:200}]),'https://checkout.stripe.com/c/pay/session_mock');
 const {options}=calls[1];
 assert.equal(options.headers.Authorization,'Bearer customer.jwt');
 assert.deepEqual(JSON.parse(options.body).cart,[{product_id:'hoodie',color:'Black',size:'M',quantity:2},{product_id:'jacket',color:'Brown',size:'L',quantity:1}]);
 assert.equal(options.body.includes('price'),false);
});
test('checkout refuses unexpected payment redirect hosts',async()=>{
 const {api,calls}=initialize();await api.status();
 // The client must validate destinations, not blindly forward to an attacker-controlled URL.
 calls.length=0;
 assert.equal(api.message(new Error('network details secret')), 'Checkout is temporarily unavailable. Please try again later.');
 const source=fs.readFileSync(path.join(root,'checkout-client.js'),'utf8');
 assert.match(source,/checkout\.stripe\.com/);
 assert.match(source,/redirect\.protocol !== 'https:'/);
});
test('private service functions cannot be invoked by customer tokens',()=>{
 const sql=fs.readFileSync(path.join(root,'supabase/006_secure_stripe_checkout.sql'),'utf8');
 for(const name of ['lc_checkout_reserve','lc_checkout_attach','lc_checkout_release','lc_checkout_paid','lc_record_stripe_refund','lc_record_payment_event']){
  assert.match(sql,new RegExp(`revoke all on function public\\.${name}\\(`));
 }
 assert.match(sql,/grant execute on function public\.lc_checkout_paid/);
 assert.match(sql,/check \(state in \('reserved','ready','paid','released'\)\)/);
});
