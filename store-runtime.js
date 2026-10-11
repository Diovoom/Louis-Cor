/* Storefront data: no fabricated catalogue, prices, or product availability. */
window.LC_PRODUCTS=[];
window.LC_CONFIG={brand:'LOUIS COR',currency:'USD'};
window.LC_STORE_SETTINGS={display_name:'LOUIS COR'};
window.LCStore={available(product,color,size){const v=(product?.variants||[]).find(x=>x.color===color&&x.size===size);return Math.max(0,Number(v?.qty)||0);}};
window.LC_LOAD_STATUS='loading';
(function(){
 const api=window.LCBackend;
 if(!api?.configured){window.LC_LOAD_STATUS='not_connected';window.dispatchEvent(new Event('lc-store-updated'));return;}
 Promise.all([api.readProducts(),api.readSettings()]).then(([items,settings])=>{
   window.LC_PRODUCTS.splice(0,window.LC_PRODUCTS.length,...items);
   window.LC_STORE_SETTINGS=settings||window.LC_STORE_SETTINGS;
   window.LC_LOAD_STATUS='ready';
   window.dispatchEvent(new Event('lc-store-updated'));
 }).catch(err=>{window.LC_LOAD_STATUS='error';window.LC_LOAD_ERROR=err.message;window.dispatchEvent(new Event('lc-store-updated'))});
})();
