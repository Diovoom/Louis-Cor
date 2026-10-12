/* LOUIS COR — Responsive storefront connected to owner-managed product data. */
(function(){
'use strict';
const R=window.React, RD=window.ReactDOM, h=R.createElement;
/* This build uses the bundled React runtime. */
if(!R.Fragment)R.Fragment=function Fragment(props){return props.children;};
const P=window.LC_PRODUCTS, CFG=window.LC_CONFIG;
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
const img=name=>/^(data:image\/|https?:\/\/|blob:)/.test(name||'')?name:'assets/'+(name||'lc-monogram.svg');
const get=(k,fallback)=>{try {const data=JSON.parse(localStorage.getItem(k));return data===null?fallback:data}catch(e){return fallback}};
const put=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const route=()=>decodeURIComponent((window.location.hash||'#/').slice(1)||'/');
const categories=['All','Hoodies','T-Shirts','Sweatpants','Outerwear','Footwear'];
const iconPaths={
 menu:[['path',{d:'M4 7h16M4 12h16M4 17h16'}]],search:[['circle',{cx:11,cy:11,r:7}],['path',{d:'m16 16 5 5'}]],
 bag:[['path',{d:'M5 8h14l1 12H4L5 8Z'}],['path',{d:'M9 9V6a3 3 0 0 1 6 0v3'}]],
 user:[['circle',{cx:12,cy:8,r:3}],['path',{d:'M5 20a7 7 0 0 1 14 0'}]],
 heart:[['path',{d:'M20.8 5.6a5.2 5.2 0 0 0-7.4 0L12 7l-1.4-1.4a5.2 5.2 0 1 0-7.4 7.4L12 21l8.8-8a5.2 5.2 0 0 0 0-7.4Z'}]],
 close:[['path',{d:'M5 5l14 14M19 5 5 19'}]],arrow:[['path',{d:'M4 12h16m-7-7 7 7-7 7'}]],
 chevron:[['path',{d:'m6 9 6 6 6-6'}]],plus:[['path',{d:'M12 4v16M4 12h16'}]],minus:[['path',{d:'M4 12h16'}]],
 sliders:[['path',{d:'M4 6h16M4 12h16M4 18h16'}],['circle',{cx:9,cy:6,r:2,fill:'currentColor',stroke:'none'}],['circle',{cx:15,cy:12,r:2,fill:'currentColor',stroke:'none'}]],
 check:[['path',{d:'m4 12 5 5L20 6'}]],back:[['path',{d:'m14 4-8 8 8 8M6 12h15'}]],
 truck:[['path',{d:'M3 6h12v10H3zM15 10h4l3 4v2h-7'}],['circle',{cx:7,cy:18,r:2}],['circle',{cx:18,cy:18,r:2}]],
 shield:[['path',{d:'m12 2 8 4v6c0 5-3 8-8 10-5-2-8-5-8-10V6z'}],['path',{d:'m8 12 3 3 5-6'}]],
 instagram:[['rect',{x:3,y:3,width:18,height:18,rx:5}],['circle',{cx:12,cy:12,r:4}],['circle',{cx:17.5,cy:6.5,r:.8,fill:'currentColor',stroke:'none'}]],
 mail:[['rect',{x:3,y:5,width:18,height:14}],['path',{d:'m3 6 9 7 9-7'}]]
};
function Icon({name,size=21,fill=false}){return h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:fill?'currentColor':'none',stroke:'currentColor',strokeWidth:1.35,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':'true'},(iconPaths[name]||iconPaths.arrow).map((p,i)=>h(p[0],Object.assign({key:i},p[1]))))}
function Logo({className=''}){return h('img',{src:img('lc-monogram.svg'),alt:'LC',className:'lc-logo '+className})}
function A({to='/',className='',children,onClick,...rest}){return h('a',Object.assign({href:'#'+to,className,onClick},rest),children)}
function BtnIcon({icon,label,onClick,active=false,extra=null}){return h('button',{type:'button',className:'icon-btn'+(active?' active':''),onClick,'aria-label':label,title:label},h(Icon,{name:icon,size:21}),extra)}
function ArrowLink({to,children,className=''}){return h(A,{to,className:'arrow-link '+className},h('span',null,children),h(Icon,{name:'arrow',size:20}))}
const COLOR_DEFAULTS={black:'#191919',white:'#ffffff',cream:'#fffdd0',ivory:'#fffff0',beige:'#d7c5af',stone:'#bbb9ae',charcoal:'#414141',grey:'#808080',gray:'#808080',navy:'#14213d',gold:'#d4af37',silver:'#c0c0c0',burgundy:'#800020',olive:'#808000',tan:'#d2b48c',khaki:'#c3b091',offwhite:'#faf9f6',off_white:'#faf9f6'};
function swatchColor(color,custom){const hex=custom?.[color];if(/^#[0-9a-f]{6}$/i.test(String(hex||'')))return hex;const key=String(color||'').trim().toLowerCase().replace(/[ -]/g,'');if(COLOR_DEFAULTS[key])return COLOR_DEFAULTS[key];if(typeof CSS!=='undefined'&&CSS.supports('color',String(color||''))){try{const ctx=document.createElement('canvas').getContext('2d');ctx.fillStyle=String(color);const converted=ctx.fillStyle;if(/^#[0-9a-f]{6}$/i.test(converted))return converted;}catch(_){}}return '#d9d9d9';}
function ProductCard({item,openProduct,toggleWish,wishlist,index=0}){const soldOut=!item.variants?.some(v=>Number(v.qty)>0);return h('article',{className:'product-card',style:{animationDelay:(index%4)*60+'ms'}},
 h('div',{className:'product-image-wrap'},
 h('button',{className:'product-photo-button',type:'button',onClick:()=>openProduct(item.id),'aria-label':'View '+item.name},h('img',{src:img(item.image),alt:item.name,className:'product-photo'})),
 soldOut?h('span',{className:'product-sticker'},'SOLD OUT'):item.tag?h('span',{className:'product-sticker'},item.tag):null,
 h('button',{className:'heart-button '+(wishlist.includes(item.id)?'is-saved':''),type:'button',onClick:()=>toggleWish(item.id),'aria-label':wishlist.includes(item.id)?'Remove '+item.name+' from saved items':'Save '+item.name},h(Icon,{name:'heart',size:20,fill:wishlist.includes(item.id)})) ),
 h('button',{className:'product-meta',onClick:()=>openProduct(item.id),type:'button'},h('span',{className:'product-title'},item.name),h('span',null,money(item.price))),
 h('div',{className:'product-lower'},h('span',null,item.category),h('span',{className:'swatches'},item.colors.slice(0,3).map(c=>h('i',{title:c,'aria-label':c,key:c,className:'swatch',style:{backgroundColor:swatchColor(c,item.colorSwatches)}})))),
 h('button',{className:'quick-shop',type:'button',onClick:()=>openProduct(item.id)},'EXPLORE ',h(Icon,{name:'arrow',size:15}))
)}
function ConsentBanner({onClose,onSettings}){return h('div',{className:'cookie-banner',role:'region','aria-label':'Browser storage notice'},h('div',{className:'cookie-copy'},h('strong',null,'YOUR PRIVACY'),h('p',null,'We use necessary browser storage for sign-in, your bag, and saved items. No advertising or analytics trackers are installed. ',h(A,{to:'/legal/cookies'},'Read our storage policy.'))),h('div',{className:'cookie-actions'},h('button',{type:'button',onClick:onSettings,className:'line-button'},'STORAGE DETAILS'),h('button',{type:'button',onClick:onClose,className:'solid-button'},'CONTINUE')))}

class App extends R.Component{
 constructor(props){super(props);this.state={path:route(),cart:get('lc-cart-v1',[]),wishlist:get('lc-wishlist-v1',[]),consent:get('lc-cookie-consent-v1',null),cookieSettings:false,mobileMenu:false,searchOpen:false,search:'',cartOpen:false,selectedSize:'',selectedColor:'',gallery:0,category:'All',sort:'featured',query:'',group:'All',filterOpen:false,accountOpen:false,toast:'',videoMuted:true,customerUser:null,checkoutReady:false,checkoutBusy:false};this.onHash=()=>this.setState({path:route(),mobileMenu:false,searchOpen:false,cartOpen:false,selectedSize:'',selectedColor:'',gallery:0,filterOpen:false,category:'All',group:'All'},()=>{window.scrollTo({top:0,behavior:'instant'});this.updateTitle()});this.onEscape=e=>{if(e.key==='Escape')this.setState({cartOpen:false,searchOpen:false,mobileMenu:false,cookieSettings:false,accountOpen:false})};}
 componentDidMount(){
  window.addEventListener('hashchange',this.onHash);
  window.addEventListener('keydown',this.onEscape);
  this.cartSyncQueue=Promise.resolve();
  this.onCustomerAuth=()=>this.syncCustomer();
  window.addEventListener('lc-customer-auth-changed',this.onCustomerAuth);
  window.LCCustomer.restore().then(()=>this.syncCustomer()).catch(()=>{});
  window.LCCheckout.status().then(ready=>this.setState({checkoutReady:ready})).catch(()=>{});
  this.updateTitle();this.onCatalog=()=>{const valid=window.LC_LOAD_STATUS==='ready'?this.state.cart.filter(c=>P.some(p=>p.id===c.id&&window.LCStore.available(p,c.color,c.size)>0)):this.state.cart;if(valid.length!==this.state.cart.length)put('lc-cart-v1',valid);this.setState({cart:valid,catalogVersion:(this.state.catalogVersion||0)+1},()=>{this.updateTitle();if(!this.state.customerUser&&window.LCCustomer.user())this.syncCustomer();});};window.addEventListener('lc-store-updated',this.onCatalog);}
 componentWillUnmount(){window.removeEventListener('hashchange',this.onHash);window.removeEventListener('keydown',this.onEscape);window.removeEventListener('lc-store-updated',this.onCatalog);window.removeEventListener('lc-customer-auth-changed',this.onCustomerAuth)}
 updateTitle(){const path=this.state.path;document.title=(path==='/'?'Home':path.includes('/product/')?(P.find(x=>path.endsWith(x.id))||{}).name||'Collection':path.includes('legal')?'Customer Information':path.replace('/','').replace(/\b\w/g,c=>c.toUpperCase()))+' | LOUIS COR'}
 nav(path){if(this.state.path===path){window.scrollTo({top:0,behavior:'smooth'})}else window.location.hash='#'+path}
 announce(text){this.setState({toast:text});clearTimeout(this.tid);this.tid=setTimeout(()=>this.setState({toast:''}),3100)}
 async syncCustomer(){
   const user=window.LCCustomer.user();
   const previous=this.state.customerUser;
   if(!user){
     this.setState({customerUser:null});
     if(previous){put('lc-wishlist-v1',[]);put('lc-cart-v1',[]);this.setState({cart:[],wishlist:[]});}
     return;
   }
   if(window.LC_LOAD_STATUS==='loading')return;
   if(previous?.id===user.id)return;
   this.setState({customerUser:user});
   try{
     const [remoteWishlist,remoteCart]=await Promise.all([window.LCCustomer.loadWishlist(),window.LCCustomer.loadCart()]);
     const valid=id=>P.some(p=>p.id===id);
     const guestWishlist=this.state.wishlist.filter(valid);
     const mergedWishlist=[...new Set([...remoteWishlist,...guestWishlist])];
     const guestCart=this.state.cart.filter(c=>valid(c.id));
     const cartMap=new Map(remoteCart.map(c=>[c.key,c]));
     const newItems=[];
     for(const c of guestCart){
       if(!cartMap.has(c.key)){
         const item=P.find(p=>p.id===c.id);
         const allowed=window.LCStore.available(item,c.color,c.size);
         if(allowed>0){const next={...c,qty:Math.min(c.qty,allowed)};cartMap.set(c.key,next);newItems.push(next);}
       }
     }
     await Promise.all([...guestWishlist.filter(id=>!remoteWishlist.includes(id)).map(id=>window.LCCustomer.addWishlist(id)),...newItems.map(c=>window.LCCustomer.setCartLine(c))]);
     const cart=[...cartMap.values()].filter(c=>valid(c.id));
     this.setState({wishlist:mergedWishlist,cart});put('lc-wishlist-v1',mergedWishlist);put('lc-cart-v1',cart);
   }catch(error){this.announce('We could not sync your account. Please try again.');}
 }
 async toggleWish(id){
   const before=this.state.wishlist;
   const adding=!before.includes(id);
   const wishlist=adding?[...before,id]:before.filter(x=>x!==id);
   this.setState({wishlist});put('lc-wishlist-v1',wishlist);
   if(window.LCCustomer.user()){
     try{await (adding?window.LCCustomer.addWishlist(id):window.LCCustomer.removeWishlist(id));}
     catch(error){this.setState({wishlist:before});put('lc-wishlist-v1',before);this.announce((window.LCUserMessage ? window.LCUserMessage(error) : 'Please try again.'));return;}
   }
   this.announce(adding?'Added to saved pieces':'Removed from saved pieces');
 }
 syncCartLine(line){
   if(!window.LCCustomer.user())return;
   this.cartSyncQueue=this.cartSyncQueue.catch(()=>{}).then(()=>window.LCCustomer.setCartLine(line));
   this.cartSyncQueue.catch(error=>this.announce('Your bag could not be saved. Please try again.'));
 }

 addToCart(item){if(!item?.colors?.length){this.announce('This product is not available');return}if(!this.state.selectedSize){this.announce('Choose a size first');return}const color=item.colors.includes(this.state.selectedColor)?this.state.selectedColor:item.colors[0];const key=item.id+'_'+this.state.selectedSize+'_'+color;const inBag=this.state.cart.filter(x=>x.key===key).reduce((n,x)=>n+x.qty,0);if(inBag>=99 || (window.LCStore && window.LCStore.available(item,color,this.state.selectedSize)<=inBag)){this.announce('This size and color is out of stock');return}let found=false;const cart=this.state.cart.map(x=>{if(x.key===key){found=true;return Object.assign({},x,{qty:x.qty+1})}return x});if(!found)cart.push({key,id:item.id,size:this.state.selectedSize,color,qty:1});this.setState({cart,cartOpen:true});put('lc-cart-v1',cart);this.syncCartLine(cart.find(x=>x.key===key))}
 changeQty(key,diff){const existing=this.state.cart.find(x=>x.key===key);const product=existing&&P.find(x=>x.id===existing.id);if(diff>0 && product && (existing.qty>=99 || (window.LCStore && window.LCStore.available(product,existing.color,existing.size)<=existing.qty))){this.announce('No more stock available in this size and color');return}let cart=this.state.cart.map(x=>x.key===key?Object.assign({},x,{qty:x.qty+diff}):x).filter(x=>x.qty>0);this.setState({cart});put('lc-cart-v1',cart);this.syncCartLine(cart.find(x=>x.key===key)||{...existing,qty:0})}
 consent(){const choices={necessary:true,acknowledgedAt:new Date().toISOString()};put('lc-cookie-consent-v1',choices);this.setState({consent:choices,cookieSettings:false})}
 clearLocalItems(){try{localStorage.removeItem('lc-cart-v1');localStorage.removeItem('lc-wishlist-v1');}catch(_){ }this.setState({cart:[],wishlist:[],cookieSettings:false});this.announce('Saved items on this device cleared.');}
 async onCheckout(){
  if(!this.state.checkoutReady||this.state.checkoutBusy||!this.state.cart.length)return;
  if(!window.LCCustomer.user()){
    this.setState({cartOpen:false});
    this.nav('/account/login');
    this.announce('Sign in to continue to checkout.');
    return;
  }
  this.setState({checkoutBusy:true});
  try{
    const url=await window.LCCheckout.start(this.state.cart);
    window.location.assign(url);
  }catch(error){
    this.announce(window.LCCheckout.message(error));
    this.setState({checkoutBusy:false});
  }
 }
 product(id){this.nav('/product/'+id)}
 header(){const count=this.state.cart.reduce((s,c)=>s+c.qty,0);return h(R.Fragment,null,
 h('header',{className:'site-header'},
 h('div',{className:'header-side header-left'},h(BtnIcon,{icon:'menu',label:'Open navigation',onClick:()=>this.setState({mobileMenu:true})}),h('nav',{className:'desktop-nav','aria-label':'Primary'},h(A,{to:'/shop/men'},'MEN'),h(A,{to:'/shop/women'},'WOMEN'),h(A,{to:'/shop'},'SHOP ALL'))),
 h(A,{to:'/',className:'brand-center','aria-label':'LOUIS COR — Home'},h(Logo,{})),
 h('div',{className:'header-side header-right'},h(BtnIcon,{icon:'search',label:'Search products',onClick:()=>this.setState({searchOpen:true,search:''})}),h(BtnIcon,{icon:'user',label:this.state.customerUser?'My account':'Sign in or create account',onClick:()=>this.nav('/account')}),h('span',{className:'desktop-only'},h(BtnIcon,{icon:'heart',label:'Saved items',onClick:()=>this.nav('/saved')})),h(BtnIcon,{icon:'bag',label:'Shopping bag with '+count+' items',onClick:()=>this.setState({cartOpen:true}),extra:count?h('span',{className:'bag-count'},count):null}))),
 this.state.mobileMenu?h('div',{className:'backdrop visible',onClick:()=>this.setState({mobileMenu:false})},null):null,
 h('aside',{className:'mobile-nav '+(this.state.mobileMenu?'open':'')},h('div',{className:'drawer-top'},h('span',null,'MENU'),h(BtnIcon,{icon:'close',label:'Close menu',onClick:()=>this.setState({mobileMenu:false})})),['New arrivals','Shop all','Men','Women','Hoodies','T-Shirts','Sweatpants','Outerwear','Footwear','About','Contact'].map((x,i)=>h(A,{to:['/shop','/shop','/shop/men','/shop/women','/shop/hoodies','/shop/t-shirts','/shop/sweatpants','/shop/outerwear','/shop/footwear','/about','/contact'][i],key:x,className:'mobile-nav-item'},x,h(Icon,{name:'arrow',size:17}))),h('div',{className:'mobile-nav-foot'},h(A,{to:'/account'},this.state.customerUser?'MY ACCOUNT':'SIGN IN / REGISTER'),h(A,{to:'/saved'},'SAVED PIECES'),h(A,{to:'/legal/privacy'},'PRIVACY')))
 )}
 footer(){return h('footer',{className:'site-footer'},h('div',{className:'footer-top'},h('div',null,h('span',{className:'eyebrow light'},'LOUIS COR'),h('h2',null,'THE ART OF\nLESS.'),h('p',null,'Contemporary essentials. Considered in every detail.')),h('div',{className:'footer-links'},h('div',null,h('strong',null,'EXPLORE'),[['The collection','/shop'],['New arrivals','/shop'],['Our story','/about'],['Contact','/contact']].map(x=>h(A,{to:x[1],key:x[0]},x[0]))),h('div',null,h('strong',null,'CLIENT SERVICES'),[['My account','/account'],['Shipping & delivery','/legal/shipping'],['Returns & exchanges','/legal/returns'],['Size guide','/size-guide'],['Frequently asked questions','/faq']].map(x=>h(A,{to:x[1],key:x[0]},x[0]))),h('div',null,h('strong',null,'LEGAL'),[['Privacy policy','/legal/privacy'],['Terms & conditions','/legal/terms'],['Cookie policy','/legal/cookies'],['Accessibility','/legal/accessibility']].map(x=>h(A,{to:x[1],key:x[0]},x[0])),h('button',{onClick:()=>this.setState({cookieSettings:true})},'Cookie settings')))),h('div',{className:'footer-bottom'},h('span',null,'© '+new Date().getFullYear()+' LOUIS COR'),h('span',null,'INDEPENDENT FASHION HOUSE'),h('span',null,'UNITED STATES  ·  USD')))}
 home(){return h('main',null,
 h('section',{className:'home-hero'},h('video',{className:'hero-video',poster:img(typeof window.matchMedia==='function'&&window.matchMedia('(max-width:700px)').matches?'lc-atelier-hero-mobile-poster.jpg':'hero-poster.jpg'),autoPlay:true,loop:true,muted:true,playsInline:true,'aria-hidden':'true',preload:'metadata'},
  h('source',{src:img('lc-atelier-hero-mobile.mp4'),media:'(max-width:700px)',type:'video/mp4'}),
  h('source',{src:img('editorial-loop.mp4'),type:'video/mp4'})),h('div',{className:'hero-shade'}),h('div',{className:'hero-content'},h('h1',null,'THE NEW\nUNIFORM.'),h('p',null,'ESSENTIALS FOR WHAT COMES NEXT.'),h(A,{to:'/shop',className:'outline-white-btn'},'DISCOVER THE COLLECTION ',h(Icon,{name:'arrow',size:18}))),h('div',{className:'hero-bottom'},h('span',null,'THE COLLECTION'),h('span',null,'SCROLL TO EXPLORE ↓'))),
  h('section',{className:'section-wrap arrivals'},h('div',{className:'section-kicker'},h('span',{className:'eyebrow'},'CURATED ESSENTIALS'),h('span',null,'LOUIS COR')),h('div',{className:'section-title-row'},h('h2',null,'NEW ARRIVALS'),h(ArrowLink,{to:'/shop'},'SHOP ALL')),h('div',{className:'products-grid'},(P.length?P.slice(0,4).map((item,i)=>h(ProductCard,{key:item.id,item,index:i,openProduct:id=>this.product(id),toggleWish:id=>this.toggleWish(id),wishlist:this.state.wishlist})):h('p',{className:'collection-empty'},window.LC_LOAD_STATUS==='error'?'The collection is temporarily unavailable. Please try again later.':'New pieces will be announced here.')))),
 h('section',{className:'editorial-grid'},h(A,{to:'/shop/men',className:'editorial-panel panel-men'},h('img',{src:img('campaign-man.jpg'),alt:'Model in black LOUIS COR hoodie',loading:'lazy'}),h('div',null,h('span',{className:'eyebrow light'},'01 / THE COLLECTION'),h('h2',null,'MEN'),h('span',{className:'edge-link'},'DISCOVER ',h(Icon,{name:'arrow',size:19})))),h(A,{to:'/shop/women',className:'editorial-panel panel-women'},h('img',{src:img('campaign-woman.jpg'),alt:'Model in LOUIS COR streetwear',loading:'lazy'}),h('div',null,h('span',{className:'eyebrow light'},'02 / THE COLLECTION'),h('h2',null,'WOMEN'),h('span',{className:'edge-link'},'DISCOVER ',h(Icon,{name:'arrow',size:19}))))),
 h('section',{className:'statement-section'},h('span',{className:'eyebrow'},'OUR DESIGN LANGUAGE'),h('h2',null,'NOT LOUD.\nNOT ORDINARY.'),h('p',null,'An evolving study in shape, texture and the pieces you return to.'),h(ArrowLink,{to:'/about'},'DISCOVER THE HOUSE')),
 h('section',{className:'feature-editorial'},h('div',{className:'feature-editorial-image'},h('img',{src:img('campaign-duo.jpg'),alt:'LOUIS COR campaign with two models in streetwear',loading:'lazy'})),h('div',{className:'feature-editorial-copy'},h('span',{className:'eyebrow'},'THE SEASONAL FOCUS'),h('h2',null,'BUILT FOR\nREAL LIFE.'),h('p',null,'Elevated everyday layers, strong silhouettes and considered details.'),h(ArrowLink,{to:'/shop'},'EXPLORE THE EDIT'))),
 h('section',{className:'section-wrap home-bottom-products'},h('div',{className:'section-title-row'},h('h2',null,'THE ESSENTIALS'),h(ArrowLink,{to:'/shop'},'VIEW COLLECTION')),h('div',{className:'products-grid'},P.slice(4,8).map((item,i)=>h(ProductCard,{key:item.id,item,index:i,openProduct:id=>this.product(id),toggleWish:id=>this.toggleWish(id),wishlist:this.state.wishlist})))),
 h('section',{className:'assurance'},[['shield','PRIVATE BY DESIGN'],['truck','SHIPPING DETAILS BEFORE CHECKOUT'],['check','CONSIDERED ESSENTIALS']].map(x=>h('div',{key:x[1]},h(Icon,{name:x[0],size:25}),h('span',null,x[1]))))
 )}
 shop(){let segment=this.state.path.split('/')[2]||'';let forcedCategory={'hoodies':'Hoodies','t-shirts':'T-Shirts','sweatpants':'Sweatpants','outerwear':'Outerwear','footwear':'Footwear'}[segment];let group=segment==='men'?'Men':segment==='women'?'Women':'All';let items=P.filter(x=>(!forcedCategory||x.category===forcedCategory) && (group==='All'||x.group===group||x.group==='Unisex') && (this.state.category==='All'||forcedCategory||x.category===this.state.category) && (this.state.query.trim()===''|| (x.name+' '+x.category).toLowerCase().includes(this.state.query.toLowerCase()))); if(this.state.sort==='price-low')items.sort((a,b)=>a.price-b.price);if(this.state.sort==='price-high')items.sort((a,b)=>b.price-a.price);if(this.state.sort==='name')items.sort((a,b)=>a.name.localeCompare(b.name));let heading=forcedCategory|| (group==='Men'?'MEN':group==='Women'?'WOMEN':'THE COLLECTION');return h('main',{className:'shop-page'},h('div',{className:'page-heading'},h('h1',null,heading),h('p',null,'Considered essentials, designed for the everyday.')),h('div',{className:'collection-toolbar'},h('div',{className:'cat-tabs'},(forcedCategory?['All']:categories).map(c=>h('button',{key:c,className:(this.state.category===c?'active':'')+' cat-tab',onClick:()=>{if(forcedCategory)this.nav('/shop');this.setState({category:c})}},c))),h('div',{className:'filters-right'},h('span',{className:'product-count'},items.length+' PIECES'),h('label',{className:'sort-label'},'SORT ',h('select',{value:this.state.sort,onChange:e=>this.setState({sort:e.target.value})},h('option',{value:'featured'},'Featured'),h('option',{value:'price-low'},'Price: low to high'),h('option',{value:'price-high'},'Price: high to low'),h('option',{value:'name'},'Name A–Z'))))),h('div',{className:'section-wrap shop-products'},h('div',{className:'products-grid'},items.map((item,i)=>h(ProductCard,{key:item.id,item,index:i,openProduct:id=>this.product(id),toggleWish:id=>this.toggleWish(id),wishlist:this.state.wishlist}))),items.length===0?h('p',{className:'empty-state'},P.length===0?'No items are available right now.':'No pieces match these filters.'):null))}
 productPage(){
  const item=P.find(x=>this.state.path.endsWith('/'+x.id));
  if(!item)return this.notFound();
  const gallery=[...new Set([item.detail,item.image].filter(Boolean))];
  const breadcrumbs=h('div',{className:'breadcrumbs'},h(A,{to:'/'},'HOME'),' / ',h(A,{to:'/shop'},'COLLECTION'),' / ',h('span',null,item.name.toUpperCase()));
  const photos=h('div',{className:'gallery'},
    h('div',{className:'main-product-image'},h('img',{src:img(gallery[this.state.gallery]||gallery[0]),alt:item.name+' view '+(this.state.gallery+1),className:''})),
    h('div',{className:'thumbnails'},gallery.map((name,i)=>h('button',{key:i,type:'button',className:this.state.gallery===i?'selected':'',onClick:()=>this.setState({gallery:i}),'aria-label':'View photo '+(i+1)},h('img',{src:img(name),alt:'Product photo '+(i+1)})))));
  const activeColor=item.colors.includes(this.state.selectedColor)?this.state.selectedColor:item.colors[0];
  const available=(color,size)=>window.LCStore.available(item,color,size);
  const colorButtons=h('div',{className:'color-options'},item.colors.map(c=>{
    const hasStock=item.sizes.some(size=>available(c,size)>0);
    return h('button',{key:c,type:'button',title:c+(hasStock?'':' — sold out'),
      'aria-label':'Select '+c+(hasStock?'':' (sold out)'),
      'aria-pressed':activeColor===c,
      className:'color-choice '+(activeColor===c?'selected':'')+(hasStock?'':' unavailable'),
      onClick:()=>this.setState({selectedColor:c,selectedSize:available(c,this.state.selectedSize)>0?this.state.selectedSize:''})},
      h('span',{className:'color-select',style:{backgroundColor:swatchColor(c,item.colorSwatches)}},null),
      h('span',{className:'color-choice-label'},c),
      !hasStock&&h('span',{className:'color-choice-stock'},'Sold out'));
  }));
  const sizeButtons=h('div',{className:'size-options'},item.sizes.map(s=>{
    const quantity=available(activeColor,s),unavailable=quantity<=0;
    return h('button',{key:s,type:'button',className:(this.state.selectedSize===s?'selected ':'')+(unavailable?'sold-out':''),
      disabled:unavailable,'aria-label':s+(unavailable?' — out of stock':''),title:unavailable?'Out of stock for '+activeColor:'Available',
      onClick:()=>this.setState({selectedSize:s})},s);
  }));
  const anyStock=item.colors.some(c=>item.sizes.some(s=>available(c,s)>0));
  const selectedStock=available(activeColor,this.state.selectedSize);
  const sizeAvailable=item.sizes.some(s=>available(activeColor,s)>0);

  const accordion=h('div',{className:'detail-accordions'},
    h('details',{open:true},h('summary',null,'THE DETAILS'),h('p',null,item.fabric,' — ',item.description)),
    h('details',null,h('summary',null,'SIZE & FIT'),h('p',null,'Select your size above. Refer to the description for fit and fabric details.')),
    h('details',null,h('summary',null,'SHIPPING & RETURNS'),h('p',null,'Review our current policies: ',h(A,{to:'/legal/shipping'},'Shipping information'),' · ',h(A,{to:'/legal/returns'},'Returns'))));
  const info=h('div',{className:'product-info'},
    h('span',{className:'eyebrow'},'LOUIS COR / '+item.category.toUpperCase()),
    h('h1',null,item.name),
    h('div',{className:'price-line'},h('strong',null,money(item.price)),h('span',null,'USD')),
    h('p',{className:'product-description'},item.description),
    h('div',{className:'option-block'},h('div',{className:'option-top'},h('strong',null,'COLOR'),h('span',null,activeColor)),colorButtons),
    h('div',{className:'option-block'},h('div',{className:'option-top'},h('strong',null,'SIZE'),h(A,{to:'/size-guide'},'SIZE GUIDE ↗')),sizeButtons),
    h('p',{className:'stock-note','aria-live':'polite'},!anyStock?'SOLD OUT — ALL COLORS':!sizeAvailable?'THIS COLOR IS SOLD OUT':!this.state.selectedSize?'SELECT AN AVAILABLE SIZE':selectedStock<=0?'THIS SIZE IS OUT OF STOCK':''),
    h('button',{className:'add-to-bag',type:'button',disabled:!anyStock||!sizeAvailable||Boolean(this.state.selectedSize&&selectedStock<=0),onClick:()=>this.addToCart(item)},!anyStock?'SOLD OUT':'ADD TO BAG ',h(Icon,{name:'arrow',size:21})),
    h('button',{className:'save-detail',onClick:()=>this.toggleWish(item.id)},h(Icon,{name:'heart',size:17,fill:this.state.wishlist.includes(item.id)}),this.state.wishlist.includes(item.id)?' SAVED':' SAVE FOR LATER'),
    accordion);
  const related=h('section',{className:'section-wrap related-products'},
    h('div',{className:'section-title-row'},h('h2',null,'YOU MAY ALSO LIKE'),h(ArrowLink,{to:'/shop'},'EXPLORE ALL')),
    h('div',{className:'products-grid'},P.filter(x=>x.id!==item.id).slice(0,4).map((x,i)=>h(ProductCard,{key:x.id,item:x,index:i,openProduct:id=>this.product(id),toggleWish:id=>this.toggleWish(id),wishlist:this.state.wishlist}))));
  return h('main',{className:'product-page'},breadcrumbs,h('div',{className:'product-layout'},photos,info),related);
 }
 cartDrawer(){
  const count=this.state.cart.reduce((s,c)=>s+c.qty,0);
  const total=this.state.cart.reduce((s,c)=>{const p=P.find(x=>x.id===c.id);return s+(p?p.price*c.qty:0)},0);
  const cartLines=this.state.cart.map(c=>{
   const item=P.find(x=>x.id===c.id);if(!item)return null;
   const control=h('div',{className:'quantity-control'},
    h('button',{'aria-label':'Decrease quantity',onClick:()=>this.changeQty(c.key,-1)},h(Icon,{name:'minus',size:15})),
    h('span',null,c.qty),
    h('button',{'aria-label':'Increase quantity',onClick:()=>this.changeQty(c.key,1)},h(Icon,{name:'plus',size:15})));
   const detail=h('div',{className:'cart-line-details'},
    h('div',{className:'cart-title-row'},h('strong',null,item.name),h('button',{'aria-label':'Remove '+item.name,onClick:()=>this.changeQty(c.key,-c.qty)},h(Icon,{name:'close',size:16}))),
    h('span',null,c.color+' / '+c.size),h('span',null,money(item.price)),control);
   return h('div',{key:c.key,className:'cart-line'},h('img',{src:img(item.image),alt:item.name}),detail);
  });
  const empty=h('div',{className:'cart-empty'},h(Icon,{name:'bag',size:32}),h('h3',null,'YOUR BAG IS EMPTY'),h('p',null,'Find your next favorite piece.'),h('button',{className:'solid-button',onClick:()=>{this.setState({cartOpen:false});this.nav('/shop')}},'EXPLORE THE COLLECTION'));
  const summary=h('div',{className:'cart-summary'},
   h('div',{className:'subtotal'},h('span',null,'SUBTOTAL'),h('strong',null,money(total))),
   h('p',null,this.state.checkoutReady?'Shipping and applicable taxes are confirmed before you pay.':'Online checkout is not available yet.'),
   h('button',{className:'solid-button checkout-button',type:'button',disabled:!this.state.checkoutReady||this.state.checkoutBusy,onClick:()=>this.onCheckout(),'aria-label':this.state.checkoutReady?'Proceed to secure checkout':'Online checkout is not available yet'},this.state.checkoutReady?(this.state.checkoutBusy?'PLEASE WAIT':'SECURE CHECKOUT'):'CHECKOUT UNAVAILABLE ',h(Icon,{name:'arrow',size:18})),
   h('small',null,this.state.checkoutReady?'PAYMENT HANDLED SECURELY BY STRIPE':'ONLINE CHECKOUT IS NOT YET AVAILABLE'));
  return h(R.Fragment,null,
   this.state.cartOpen?h('div',{className:'backdrop visible',onClick:()=>this.setState({cartOpen:false})}):null,
   h('aside',{className:'cart-drawer '+(this.state.cartOpen?'open':''),role:'dialog','aria-label':'Shopping bag','aria-modal':this.state.cartOpen?'true':'false'},
    h('div',{className:'drawer-top'},h('div',null,'YOUR BAG ',h('span',null,'('+count+')')),h(BtnIcon,{icon:'close',label:'Close cart',onClick:()=>this.setState({cartOpen:false})})),
    h('div',{className:'cart-contents'},count?cartLines:empty),count?summary:null));
 }
 searchOverlay(){if(!this.state.searchOpen)return null;let q=this.state.search.trim().toLowerCase();let results=q?P.filter(x=>(x.name+' '+x.category).toLowerCase().includes(q)):P.slice(0,4);return h('div',{className:'search-overlay',role:'dialog','aria-modal':'true','aria-label':'Search collection'},h('div',{className:'search-inner'},h('div',{className:'search-head'},h('span',{className:'eyebrow'},'SEARCH LOUIS COR'),h(BtnIcon,{icon:'close',label:'Close search',onClick:()=>this.setState({searchOpen:false})})),h('label',{className:'search-input-row'},h(Icon,{name:'search',size:26}),h('input',{autoFocus:true,type:'search',value:this.state.search,onChange:e=>this.setState({search:e.target.value}),placeholder:'What are you looking for?','aria-label':'Search products'})),h('span',{className:'eyebrow'},q?'SEARCH RESULTS':'POPULAR PIECES'),h('div',{className:'search-results'},results.length?results.slice(0,6).map(item=>h('button',{key:item.id,onClick:()=>this.product(item.id)},h('img',{src:img(item.image),alt:''}),h('span',null,item.name),h('span',null,money(item.price)),h(Icon,{name:'arrow',size:18}))):h('p',null,'No pieces found. Try a different search.'))))}
 saved(){let list=P.filter(x=>this.state.wishlist.includes(x.id));return h('main',{className:'section-wrap simple-page'},h('span',{className:'eyebrow'},'PERSONAL EDIT'),h('h1',null,'SAVED PIECES'),list.length?h('div',{className:'products-grid'},list.map((item,i)=>h(ProductCard,{key:item.id,item,index:i,openProduct:id=>this.product(id),toggleWish:id=>this.toggleWish(id),wishlist:this.state.wishlist}))):h('div',{className:'empty-content'},h('p',null,'Keep the pieces worth returning to.'),h(ArrowLink,{to:'/shop'},'DISCOVER THE COLLECTION')))}
 about(){return h('main',null,h('section',{className:'about-hero'},h('img',{src:img('campaign-duo.jpg'),alt:'LOUIS COR fashion editorial'}),h('div',null,h('span',{className:'eyebrow light'},'THE HOUSE / LOUIS COR'),h('h1',null,'WEAR THE\nUNEXPECTED.'))),h('section',{className:'statement-section'},h('span',{className:'eyebrow'},'OUR PERSPECTIVE'),h('h2',null,'LESS NOISE.\nMORE INTENTION.'),h('p',null,'A new name in modern essentials. Built around confident silhouettes, thoughtful details, and pieces for everyday expression.'),h(ArrowLink,{to:'/shop'},'EXPLORE THE COLLECTION')))}
 contact(){const info=window.LC_STORE_SETTINGS||{};return h('main',{className:'simple-page section-wrap'},h('span',{className:'eyebrow'},'CLIENT SERVICES'),h('h1',null,'CONTACT'),h('div',{className:'info-panels'},h('div',null,h('h3',null,'CUSTOMER SUPPORT'),info.support_email?h('a',{href:'mailto:'+info.support_email},info.support_email):h('p',null,'Customer contact information will be available before purchases are accepted.')),h('div',null,h('h3',null,'ORDERS'),h('p',null,this.state.checkoutReady?'Order and delivery details are available in your account.':'Online checkout is not yet available.'))),h(ArrowLink,{to:'/faq'},'FREQUENTLY ASKED QUESTIONS'))}

 faq(){return h('main',{className:'simple-page section-wrap'},h('span',{className:'eyebrow'},'HELP & INFORMATION'),h('h1',null,'QUESTIONS'),h('div',{className:'faq-list'},[['How do I place an order?','Add an available size to your bag and proceed to secure checkout when ordering is available. Sign in to track your orders.'],['How do I save a piece?','Use the heart icon to save items to your account or this device.'],['Which sizes are offered?','Available sizes appear on each published product.'],['How do I change cookie settings?','Open Cookie settings in the footer. This store currently uses only necessary local browser storage.'],['Where can I read the shipping and return information?','Visit the Shipping and Returns links in the footer for the currently confirmed information.']].map(x=>h('details',{key:x[0]},h('summary',null,x[0]),h('p',null,x[1])))))}

 sizeGuide(){
   const headers=['SIZE','XS','S','M','L','XL','XXL'].map(x=>h('th',{key:x},x));
   const cells=['US LABEL','Extra small','Small','Medium','Large','Extra large','2X large'].map(x=>h('td',{key:x},x));
   const table=h('table',{className:'size-table'},h('thead',null,h('tr',null,headers)),h('tbody',null,h('tr',null,cells)));
   return h('main',{className:'simple-page section-wrap'},
    h('span',{className:'eyebrow'},'FIND YOUR FIT'),h('h1',null,'SIZE GUIDE'),
    h('p',{className:'lead'},'Select the size indicated on each product. Specific measurements will appear as they become available.'),
    h('div',{className:'size-table-wrap'},table),
    h('p',null,'Contact the store for additional fit information once customer support is available.'));
 }
 legal(name){let t=window.LCLegal.pages()[name];if(!t)return this.notFound();return h('main',{className:'legal-page section-wrap'},h('span',{className:'eyebrow'},'CUSTOMER INFORMATION'),h('h1',null,t.title.toUpperCase()),h('p',{className:'lead'},t.intro),t.sections.map((sec,i)=>h('section',{key:i,className:'legal-section'},h('h2',null,sec[0]),h('p',null,sec[1]))),h('div',{className:'legal-end'},'Updated October 2026'))}

 notFound(){return h('main',{className:'section-wrap simple-page'},h('span',{className:'eyebrow'},'404'),h('h1',null,'PAGE NOT FOUND'),h(ArrowLink,{to:'/'},'RETURN HOME'))}
 cookieModal(){if(!this.state.cookieSettings)return null;return h('div',{className:'modal-screen',role:'presentation',onClick:()=>this.setState({cookieSettings:false})},h('div',{className:'prefs-modal',role:'dialog','aria-modal':'true','aria-label':'Cookie and storage information',onClick:e=>e.stopPropagation()},
 h('div',{className:'modal-head'},h('h2',null,'PRIVACY & STORAGE'),h(BtnIcon,{icon:'close',label:'Close',onClick:()=>this.setState({cookieSettings:false})})),
 h('h3',null,'Necessary storage — always on'),
 h('p',null,'This site saves your shopping bag, saved pieces, and sign-in session on your device. These functions do not use advertising or analytics trackers.'),
 h('h3',null,'Optional tracking'),h('p',null,'No analytics, advertising, or social tracking is active. There are no optional tracking categories to enable.'),
 h('p',null,'Clearing device items below does not delete your online account, cloud-saved items or sign you out.'),
 h('div',{className:'prefs-actions'},h('button',{type:'button',className:'line-button',onClick:()=>this.clearLocalItems()},'CLEAR DEVICE ITEMS'),h('button',{type:'button',className:'solid-button',onClick:()=>this.consent()},'DONE'))))}


 render(){let path=this.state.path;let content=path==='/'?this.home():path.startsWith('/shop')?this.shop():path.startsWith('/product/')?this.productPage():path==='/saved'?this.saved():path.startsWith('/account')?h(window.LCCustomerAccountPage,{path,navigate:p=>this.nav(p)}):path==='/about'?this.about():path==='/contact'?this.contact():path==='/faq'?this.faq():path==='/size-guide'?this.sizeGuide():path.startsWith('/legal/')?this.legal(path.split('/')[2]):this.notFound();return h(R.Fragment,null,this.header(),content,this.footer(),this.cartDrawer(),this.searchOverlay(),this.state.consent===null?h(ConsentBanner,{onClose:()=>this.consent(),onSettings:()=>this.setState({cookieSettings:true})}):null,this.cookieModal(),this.state.toast?h('div',{className:'toast',role:'status'},this.state.toast):null)}
}
RD.render(h(App),document.getElementById('app'));
})();
