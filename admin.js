/* LOUIS COR — Owner Dashboard. All business data comes from a dedicated Supabase project. */
(function(){
'use strict';
const R=window.React,DOM=window.ReactDOM,h=R.createElement,api=window.LCBackend;
const CATS=['Hoodies','T-Shirts','Sweatpants','Outerwear','Footwear','Accessories'];
const GROUPS=['Men','Women','Unisex'];
const currency=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(c)||0);
const slug=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const csv=s=>[...new Set(String(s||'').split(',').map(x=>x.trim()).filter(Boolean))];
const variants=(colors,sizes,prev)=>{const byKey=new Map((prev||[]).map(x=>[x.color+'|'+x.size,x]));return colors.flatMap(color=>sizes.map(size=>byKey.get(color+'|'+size)||{color,size,qty:0,sku:''}));};
const localDay=d=>{const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`;};
const shiftDays=(date,n)=>new Date(date.getFullYear(),date.getMonth(),date.getDate()+n);
const salesDates=(period,from,to)=>{
 const now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 let start,end=shiftDays(today,1);
 if(period==='today')start=today;
 else if(period==='7')start=shiftDays(today,-6);
 else if(period==='30')start=shiftDays(today,-29);
 else if(period==='month')start=new Date(now.getFullYear(),now.getMonth(),1);
 else if(period==='year')start=new Date(now.getFullYear(),0,1);
 else if(period==='custom'){
   if(!from||!to||from>to)throw Error('Choose a valid start and end date.');
   start=new Date(from+'T00:00:00');end=shiftDays(new Date(to+'T00:00:00'),1);
 }
 if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||start>=end)throw Error('Choose a valid date range.');
 return {start:start.toISOString(),end:end.toISOString()};
};
const photo=p=>p?.image&&(/^(https?:|data:image\/)/.test(p.image))?p.image:p?.image?'assets/'+p.image:'assets/hoodie.jpg';
function Blank(){return {id:'',name:'',category:'Hoodies',group:'Unisex',price:0,compareAt:0,status:'draft',featured:false,description:'',fabric:'',tag:'',sku:'',image:'',imagePath:'',alt:'',colors:['Black'],sizes:['S','M','L','XL'],variants:variants(['Black'],['S','M','L','XL'],[])};}
function Field({label,value,onChange,type='text',placeholder='',multiline=false,help='',min,step}){
 return h('label',{className:'a-field'},h('span',null,label),multiline?h('textarea',{rows:4,value:value??'',placeholder,onChange:e=>onChange(e.target.value)}):h('input',{type,value:value??'',placeholder,min,step,onChange:e=>onChange(e.target.value)}),help&&h('small',null,help));
}
function Select({label,value,onChange,options}){return h('label',{className:'a-field'},h('span',null,label),h('select',{value,onChange:e=>onChange(e.target.value)},options.map(x=>h('option',{value:x,key:x},x))));}
function Button({children,onClick,disabled=false,kind='primary'}){return h('button',{type:'button',className:'a-btn '+kind,onClick,disabled},children)}
function Icon({name}){return h('span',{'aria-hidden':'true'}, {overview:'◫',products:'▣',orders:'▤',payments:'◇',shipping:'⇢',customers:'♙',settings:'⚙'}[name]||'•')}
class Owner extends R.Component{
 constructor(props){super(props);this.state={phase:'loading',email:'',password:'',fullName:'',confirmPassword:'',user:null,items:[],orders:[],customers:[],settings:null,page:'overview',editor:null,salesPeriod:'30',salesFrom:'',salesTo:'',sales:null,salesLoading:false,salesError:'',checkoutActive:false,busy:false,error:'',notice:'',menu:false,productMenu:null,query:'',chosenOrder:null,carrier:'',tracking:''};this.load=this.load.bind(this);this.onDocumentKeyDown=this.onDocumentKeyDown.bind(this);this.onOutsideProductMenu=this.onOutsideProductMenu.bind(this);}
 componentDidMount(){window.addEventListener('keydown',this.onDocumentKeyDown);document.addEventListener('pointerdown',this.onOutsideProductMenu);if(!api?.configured){this.setState({phase:'setup'});return;}api.profile().then(u=>this.setState({user:u,phase:'ready'},this.load)).catch(()=>this.setState({phase:'login'}));}
 componentWillUnmount(){window.removeEventListener('keydown',this.onDocumentKeyDown);document.removeEventListener('pointerdown',this.onOutsideProductMenu);}
 onDocumentKeyDown(e){if(e.key==='Escape'&&(this.state.menu||this.state.productMenu))this.setState({menu:false,productMenu:null});}
 onOutsideProductMenu(e){if(this.state.productMenu && !e.target.closest('.a-row-action-menu'))this.setState({productMenu:null});}
 error(message){this.setState({error:(window.LCUserMessage || (()=>'Something went wrong. Please try again.'))(message)});}
 async login(e){e.preventDefault();this.setState({busy:true,error:''});try{const user=await api.login(this.state.email,this.state.password);this.setState({user,phase:'ready',password:''},this.load);}catch(e){this.error(e);}finally{this.setState({busy:false});}}
 async register(e){
  e.preventDefault();
  const {email,password,fullName,confirmPassword}=this.state;
  if(!fullName.trim()||password.length<8||password!==confirmPassword){this.error('Enter your name and matching passwords with at least eight characters.');return;}
  this.setState({busy:true,error:''});
  try{
   if(typeof api?.registerOwner!=='function') throw Error('Please refresh the page and try again.');
   const result=await api.registerOwner(email.trim(),password,fullName.trim());
   this.setState({phase:'registered',password:'',confirmPassword:'',email:result.email});
  }catch(e){this.error(e)}finally{this.setState({busy:false})}
 }
 async load(){this.setState({busy:true,error:''});try{const [items,orders,customers,settings]=await Promise.all([api.readProducts({owner:true}),api.readOrders(),api.readCustomers(),api.readSettings()]);this.setState({items,orders,customers,settings:settings||{},busy:false},()=>{this.loadSales();api.readCheckoutStatus().then(active=>this.setState({checkoutActive:active})).catch(()=>{});});}catch(e){this.error(e);this.setState({busy:false});}}
 async loadSales(){
  let dates;
  try{dates=salesDates(this.state.salesPeriod,this.state.salesFrom,this.state.salesTo)}
  catch(e){this.setState({sales:null,salesError:'Choose a valid date range.',salesLoading:false});return;}
  const token=JSON.stringify(dates);
  this.salesToken=token;
  this.setState({salesLoading:true,salesError:''});
  try{
   const summary=await api.readSalesSummary(dates.start,dates.end);
   if(this.salesToken===token)this.setState({sales:summary||null,salesLoading:false});
  }catch(e){
   if(this.salesToken===token)this.setState({sales:null,salesLoading:false,salesError:'Sales figures are temporarily unavailable.'});
  }
 }
 setSalesPeriod(period){this.setState({salesPeriod:period},()=>this.loadSales())}
 navigate(page){this.setState({page,editor:null,menu:false,productMenu:null,chosenOrder:null,error:''});window.scrollTo(0,0)}
 edit(p){const editor=JSON.parse(JSON.stringify(p||Blank()));this.setState({editor,editorColors:editor.colors.join(', '),editorSizes:editor.sizes.join(', '),page:'products',productMenu:null,error:''});window.scrollTo(0,0)}
 change(k,v){this.setState(s=>({editor:{...s.editor,[k]:v}}));}
 changeOptions(k,v){this.setState(s=>{const p={...s.editor};p[k]=csv(v);p.variants=variants(p.colors,p.sizes,p.variants);return {editor:p,[k==='colors'?'editorColors':'editorSizes']:v}})}
 changeVariant(i,key,v){this.setState(s=>({editor:{...s.editor,variants:s.editor.variants.map((x,j)=>i===j?{...x,[key]:key==='qty'?Math.max(0,Math.floor(Number(v)||0)):v}:x)}}))}
 async uploadImage(e){const file=e.target.files?.[0];e.target.value='';if(!file)return;this.setState({busy:true,error:''});try{const result=await api.uploadProductPhoto(file);this.setState(s=>({editor:{...s.editor,image:result.url,imagePath:result.path}}));}catch(err){this.error(err)}finally{this.setState({busy:false});}}
 async saveProduct(nextStatus){
  let p=this.state.editor;
  if(!p||this.state.busy)return;
  const status=nextStatus||p.status;
  const id=p.id||slug(p.name);
  if(!id||!p.name?.trim()||!p.colors.length||!p.sizes.length){this.error('Enter a name, sizes and colors.');return;}
  if(!Number.isFinite(Number(p.price))||Number(p.price)<0){this.error('Enter a valid price.');return;}
  p={...p,id,status,variants:variants(p.colors,p.sizes,p.variants)};
  this.setState({busy:true,error:'',notice:''});
  try{
    await api.upsertProduct(p);
    await this.load();
    const notice=status==='active'?'Product published.':nextStatus==='draft'&&this.state.editor?.status==='active'?'Product unpublished.':'Product saved.';
    this.setState({editor:null,notice,page:'products',productMenu:null});
  }catch(e){this.error(e);}finally{this.setState({busy:false});}
 }
 async archive(p){if(!confirm('Archive '+p.name+'? The product will be removed from the storefront.'))return;this.setState({busy:true,error:''});try{await api.archiveProduct(p.id);await this.load()}catch(e){this.error(e)}finally{this.setState({busy:false})}}
 async saveSettings(){this.setState({busy:true,error:''});const s=this.state.settings||{};const fields=['display_name','legal_business_name','support_email','privacy_email','postal_address','shipping_regions','processing_time','return_address','return_conditions','return_window_days'];const body={};fields.forEach(x=>body[x]=s[x]===''&&x==='return_window_days'?null:s[x]??null);try{await api.updateSettings(body);await this.load();this.setState({notice:'Store settings saved.'})}catch(e){this.error(e)}finally{this.setState({busy:false})}}
 async saveTracking(){this.setState({busy:true,error:''});try{await api.recordTracking(this.state.chosenOrder.id,this.state.carrier,this.state.tracking);await this.load();this.setState({chosenOrder:null,notice:'Shipment tracking saved.'})}catch(e){this.error(e)}finally{this.setState({busy:false})}}
 async markInternal(userId){
  if(!confirm('Move this account out of the customer list? Only use this for your development team.'))return;
  this.setState({busy:true,error:''});
  try{await api.markInternalAccount(userId);const customers=await api.readCustomers();this.setState({customers,notice:'Team account hidden from customers.'});}
  catch(e){this.error(e)}finally{this.setState({busy:false})}
 }
 async logout(){await api.logout();this.setState({phase:'login',user:null,items:[],orders:[],customers:[],settings:null})}
 heading(title,subtitle,extra){return h('div',{className:'a-title-row'},h('div',null,h('span',{className:'a-overline'},subtitle),h('h1',null,title)),extra)}
 overview(){
  const s=this.state,items=s.items,live=items.filter(p=>p.status==='active');
  const stock=items.reduce((n,p)=>n+p.variants.reduce((k,x)=>k+x.qty,0),0);
  const total=Number(s.sales?.paid_total_cents||0),count=Number(s.sales?.paid_orders||0);
  const periods=[['today','Today'],['7','Last 7 days'],['30','Last 30 days'],['month','This month'],['year','This year'],['custom','Choose dates']];
  return h('div',null,this.heading('Overview','STORE MANAGEMENT'),
    h('section',{className:'a-panel lc-sales-panel'},
      h('div',{className:'lc-sales-head'},h('div',null,h('h2',null,'Sales'),h('p',null,'Confirmed paid orders')),
        h('label',{className:'lc-sales-period'},h('span',null,'Time period'),
          h('select',{value:s.salesPeriod,onChange:e=>this.setSalesPeriod(e.target.value),'aria-label':'Sales time period'},
            periods.map(([value,label])=>h('option',{key:value,value},label))))),
      s.salesPeriod==='custom'&&h('div',{className:'lc-sales-custom'},
        h('label',null,'From',h('input',{type:'date',value:s.salesFrom,max:localDay(new Date()),onChange:e=>this.setState({salesFrom:e.target.value},()=>this.loadSales())})),
        h('label',null,'To',h('input',{type:'date',value:s.salesTo,max:localDay(new Date()),onChange:e=>this.setState({salesTo:e.target.value},()=>this.loadSales())}))),
      s.salesLoading?h('p',{className:'a-muted',role:'status'},'Loading sales…'):
      s.salesError?h('p',{className:'lc-sales-unavailable',role:'status'},s.salesError):
      s.sales?h('div',{className:'lc-sales-figures'},
         h('div',null,h('span',null,'Paid order total'),h('strong',null,currency(total/100))),
         h('div',null,h('span',null,'Paid orders'),h('strong',null,count.toLocaleString())),
         h('div',null,h('span',null,'Average paid order'),h('strong',null,currency(count?total/count/100:0)))):
      h('p',{className:'a-muted'},'No sales data loaded.'),
      h('p',{className:'lc-sales-note'},'Paid orders only. Totals include taxes and shipping, before processing fees and other costs. Refunded and partially refunded orders are excluded; this is not profit or payout balance.'),
      !!(Number(s.sales?.partially_refunded_orders)||Number(s.sales?.refunded_orders))&&
        h('p',{className:'lc-sales-note'},'Excluded: '+(Number(s.sales.refunded_orders)+Number(s.sales.partially_refunded_orders))+' refunded or partially refunded order(s).')),
    h('div',{className:'a-stat-grid'},[['Products',items.length],['Published',live.length],['Inventory units',stock],['Orders',s.orders.length]].map(x=>h('div',{key:x[0],className:'a-panel'},h('span',{className:'a-overline'},x[0]),h('h2',null,x[1])))),
    h('section',{className:'a-panel'},h('h2',null,'Store status'),h('p',null,'Manage published products, stock and pricing here.'),h('p',null,s.checkoutActive?'Card checkout is open.':'Card checkout is currently closed.'),Button({children:'Manage products',onClick:()=>this.navigate('products')})));
 }
 products(){
  if(this.state.editor)return this.productEditor();
  const s=this.state;
  const items=s.items.filter(p=>(p.name+' '+p.category+' '+p.sku).toLowerCase().includes(s.query.toLowerCase()));
  return h('div',null,
   this.heading('Products','CATALOG',Button({children:'+ Add product',onClick:()=>this.edit(null)})),
   h('div',{className:'a-toolbar'},h('input',{type:'search',value:s.query,placeholder:'Search products','aria-label':'Search products',onChange:e=>this.setState({query:e.target.value,productMenu:null}),style:{padding:'12px 15px',border:'1px solid #ddd',width:'100%',maxWidth:360}})),
   h('div',{className:'a-products-table'},
    h('div',{className:'a-table-head'},h('span',null,'PRODUCT'),h('span',null,'STATUS'),h('span',null,'STOCK'),h('span',null,'PRICE'),h('span',null,'OPTIONS')),
    items.map(p=>h('div',{className:'a-product-row',key:p.id},
     h('button',{type:'button',className:'a-item-name',onClick:()=>this.edit(p)},h('img',{src:photo(p),alt:''}),h('span',null,h('b',null,p.name),h('small',null,p.category+' / '+p.group))),
     h('span',{className:'a-product-status'},p.status==='active'?'Published':p.status==='draft'?'Draft':'Archived'),
     h('span',{className:'a-product-stock'},p.variants.reduce((n,v)=>n+v.qty,0)),
     h('strong',{className:'a-product-price'},currency(p.price)),
     h('div',{className:'a-row-action-menu'},
      h('button',{type:'button',className:'a-product-more','aria-label':'Actions for '+p.name,'aria-haspopup':'menu','aria-expanded':s.productMenu===p.id,onClick:()=>this.setState({productMenu:s.productMenu===p.id?null:p.id})},h('span',{'aria-hidden':'true'},'⋯')),
      s.productMenu===p.id&&h('div',{className:'a-product-popover',role:'menu','aria-label':'Actions for '+p.name},
       h('button',{type:'button',role:'menuitem',onClick:()=>this.edit(p)},'Edit product'),
       p.status!=='archived'&&h('button',{type:'button',role:'menuitem',className:'a-destructive',disabled:s.busy,onClick:()=>{this.setState({productMenu:null});this.archive(p);}},'Archive product'))
     ))),
    !items.length&&h('p',{className:'a-empty'},'No products yet. Add your first piece.')));
 }
 productEditor(){const p=this.state.editor;const busy=this.state.busy;
 const editorActions=h('div',{className:'a-actions a-editor-actions'},
  Button({children:'Back',kind:'outline',onClick:()=>this.setState({editor:null,error:''})}),
  Button({children:p.status==='active'?'Save changes':'Save draft',kind:'outline',onClick:()=>this.saveProduct(p.status==='active'?'active':'draft'),disabled:busy}),
  p.status!=='active'?h('button',{type:'button',className:'a-btn primary a-publish-btn',disabled:busy,onClick:()=>this.saveProduct('active')},h('span',{'aria-hidden':'true'},'↗'),'Publish'):
    Button({children:'Unpublish',kind:'outline',onClick:()=>this.saveProduct('draft'),disabled:busy}));
 return h('div',null,
  this.heading(p.id?'Edit product':'New product','MERCHANDISING',editorActions),
  h('div',{className:'a-form-layout'},
   h('div',{className:'a-form-main'},
    h('section',{className:'a-panel'},h('h2',null,'Product information'),
     Field({label:'Name',value:p.name,onChange:v=>this.change('name',v)}),
     h('div',{className:'a-input-row'},
      Select({label:'Category',value:p.category,options:CATS,onChange:v=>this.change('category',v)}),
      Select({label:'Collection',value:p.group,options:GROUPS,onChange:v=>this.change('group',v)})),
     Field({label:'Description',value:p.description,multiline:true,onChange:v=>this.change('description',v)}),
     Field({label:'Materials and care',value:p.fabric,onChange:v=>this.change('fabric',v)})),
    h('section',{className:'a-panel'},h('h2',null,'Pricing and stock'),
     h('div',{className:'a-input-row'},
      Field({label:'Price (USD)',type:'number',min:0,step:'.01',value:p.price,onChange:v=>this.change('price',v)}),
      Field({label:'Compare-at price',type:'number',min:0,step:'.01',value:p.compareAt,onChange:v=>this.change('compareAt',v)})),
     Field({label:'SKU',value:p.sku,onChange:v=>this.change('sku',v)}),
     h('div',{className:'a-input-row'},
      Field({label:'Colors (comma-separated)',value:this.state.editorColors,onChange:v=>this.changeOptions('colors',v)}),
      Field({label:'Sizes (comma-separated)',value:this.state.editorSizes,onChange:v=>this.changeOptions('sizes',v)})),
     h('div',{className:'a-variants'},
      h('div',{className:'a-variants-head'},h('span',null,'VARIANT'),h('span',null,'QUANTITY'),h('span',null,'SKU')),
      p.variants.map((v,i)=>h('div',{className:'a-variant-row',key:v.color+'|'+v.size},
       h('span',null,v.color+' / '+v.size),
       h('input',{type:'number',min:0,value:v.qty,'aria-label':'Quantity '+v.color+' '+v.size,onChange:e=>this.changeVariant(i,'qty',e.target.value)}),
       h('input',{value:v.sku,'aria-label':'SKU '+v.color+' '+v.size,onChange:e=>this.changeVariant(i,'sku',e.target.value)})))))),
   h('div',{className:'a-form-side'},
    h('section',{className:'a-panel'},h('h2',null,'Product photo'),
     h('div',{className:'a-photo-preview'},p.image?h('img',{src:photo(p),alt:p.alt||p.name}):h('span',null,'Add product photo')),
     h('label',{className:'a-upload-label'},'Upload full-resolution photo',
      h('input',{type:'file',accept:'image/png,image/jpeg,image/webp',onChange:e=>this.uploadImage(e)})),
     Field({label:'Image description',value:p.alt,onChange:v=>this.change('alt',v)})),
    h('section',{className:'a-panel'},h('h2',null,'Publication'),
     h('p',{className:'a-editor-status'},'Status: ',h('strong',null,p.status==='active'?'Published':p.status==='archived'?'Archived':'Draft')),
     h('label',{className:'a-checkbox'},
      h('input',{type:'checkbox',checked:p.featured,onChange:e=>this.change('featured',e.target.checked)}),'Featured product'),
     Field({label:'Collection label (optional)',value:p.tag,onChange:v=>this.change('tag',v)})))));
 }
 orders(){const s=this.state;const content=!s.orders.length
 ?h('section',{className:'a-panel'},h('p',null,'No orders received yet. New orders will appear here after live checkout is connected.'))
 :h('section',{className:'a-panel'},s.orders.map(o=>h('button',{className:'a-order',key:o.id,onClick:()=>this.setState({chosenOrder:o})},
 h('strong',null,o.order_number),h('span',null,new Date(o.created_at).toLocaleDateString()),h('span',null,o.payment_status+' · '+o.fulfillment_status),h('strong',null,currency(o.total_cents/100)))));
 return h('div',null,this.heading('Orders','CUSTOMER ORDERS'),content,s.chosenOrder&&this.orderDialog());}

 orderDialog(){const o=this.state.chosenOrder;
 const detail=h('div',{className:'a-modal',role:'dialog','aria-modal':true,'aria-label':'Order details',onClick:e=>e.stopPropagation()},
 h('div',{className:'a-modal-head'},h('h2',null,o.order_number),h('button',{onClick:()=>this.setState({chosenOrder:null})},'Close')),
 h('p',null,'Payment: '+o.payment_status),h('p',null,'Customer: '+o.email),
 ...o.lines.map(l=>h('p',{key:l.id},l.quantity+' × '+l.name+' / '+(l.color||'')+' / '+(l.size||''))),
 ...o.shipments.map(s=>h('p',{key:s.id},s.carrier+' · '+s.tracking_code)),
 o.payment_status==='paid'?h('div',null,
 Field({label:'Carrier',value:this.state.carrier,onChange:v=>this.setState({carrier:v})}),
 Field({label:'Tracking number from your purchased shipping label',value:this.state.tracking,onChange:v=>this.setState({tracking:v})}),
 Button({children:'Save tracking',disabled:this.state.busy,onClick:()=>this.saveTracking()})):null);
 return h('div',{className:'a-modal-overlay',onClick:()=>this.setState({chosenOrder:null})},detail);}

 payments(){
  const paid=this.state.orders.filter(o=>o.payment_status==='paid');
  const refunds=this.state.orders.filter(o=>['refunded','partially_refunded'].includes(o.payment_status));
  return h('div',null,this.heading('Payments','PAYMENT ACTIVITY'),
   h('section',{className:'a-panel'},h('h2',null,'Online checkout'),
     h('p',null,this.state.checkoutActive?'Accepting online card payments.':'Card checkout is not active.'),
     h('p',null,'Card processing and bank payouts are managed in the store’s Stripe account.'),
     h('a',{href:'https://dashboard.stripe.com/payments',target:'_blank',rel:'noopener noreferrer'},'Open Stripe payments ↗')),
   h('div',{className:'a-stat-grid'},[
      ['Paid orders',paid.length],['Refunded orders',refunds.length],
      ['Unfulfilled paid orders',paid.filter(o=>o.fulfillment_status==='unfulfilled').length]
     ].map(x=>h('div',{className:'a-panel',key:x[0]},h('span',{className:'a-overline'},x[0]),h('h2',null,x[1])))),
    h('section',{className:'a-panel'},h('p',null,'See Overview for paid sales by date. Review individual payments in Orders.')));
 }
 shipping(){const shipped=this.state.orders.flatMap(o=>o.shipments.map(s=>({...s,number:o.order_number})));return h('div',null,this.heading('Shipping','FULFILLMENT'),h('section',{className:'a-panel'},h('h2',null,'Tracking'),h('p',null,'Record real carrier and tracking information from purchased labels through Orders. The shipping-label purchase integration is not connected yet.'),shipped.length?shipped.map(s=>h('p',{key:s.id},s.number+' — '+s.carrier+' — '+s.tracking_code)):h('p',null,'No shipments recorded.')));}
 customers(){
   const customers=this.state.customers.filter(c=>c.user_id!==this.state.user?.id);
   return h('div',null,this.heading('Customers','REGISTERED ACCOUNTS'),
     h('section',{className:'a-panel'},
       customers.length?h('div',{className:'lc-customer-directory'},customers.map(c=>h('article',{key:c.user_id,className:'lc-customer-directory-row'},
         h('div',null,h('strong',null,c.full_name||'Customer'),h('p',null,c.email),c.phone&&h('small',null,c.phone)),
         h('div',null,h('span',null,'Orders: '+c.order_count),h('span',null,'Total spent: '+currency(c.total_spent_cents/100))),
         h('div',{className:'lc-customer-team-action'},h('small',null,'Joined '+new Date(c.created_at).toLocaleDateString()),h('button',{type:'button',disabled:this.state.busy,onClick:()=>this.markInternal(c.user_id)},'Mark as team'))))):
       h('p',null,'No customer accounts yet. New customer registrations will appear here.')));
 }
 settings(){const s=this.state.settings||{};const set=(k,v)=>this.setState({settings:{...this.state.settings,[k]:v}});const fields=[['display_name','Store display name'],['legal_business_name','Legal business name'],['support_email','Customer support email'],['privacy_email','Privacy contact email'],['postal_address','Business mailing address'],['shipping_regions','Shipping destinations'],['processing_time','Processing time (business days)'],['return_window_days','Return window in days'],['return_conditions','Return eligibility and conditions'],['return_address','Return mailing address']];return h('div',null,this.heading('Settings','BUSINESS INFORMATION'),h('section',{className:'a-panel'},h('h2',null,'Business details and customer policies'),h('p',null,'Enter only confirmed business information. These details appear in customer information pages; do not publish claims you cannot honor.'),...fields.map(([k,label])=>h('div',{key:k},Field({label,value:s[k]??'',type:k==='return_window_days'?'number':'text',onChange:v=>set(k,v)}))),Button({children:'Save settings',onClick:()=>this.saveSettings(),disabled:this.state.busy})),h('section',{className:'a-panel'},h('h2',null,'Store access'),h('p',null,'Owner account: '+this.state.user?.email),h('p',null,'Account changes and access grants must be handled through the store-owned Supabase project.')));
 }
 render(){const s=this.state;if(s.phase==='loading')return h('main',{className:'lc-auth'},h('h1',null,'LOUIS COR'),h('p',null,'Connecting securely…'));if(s.phase==='setup')return h('main',{className:'lc-auth'},h('h1',null,'LOUIS COR'),h('h2',null,'Temporarily unavailable'),h('p',null,'Please try again in a little while.'));if(s.phase==='registered')return h('main',{className:'lc-auth'},
 h('img',{src:'assets/lc-monogram.svg',width:84,alt:'LOUIS COR'}),
 h('h1',null,'Check your email'),
 h('p',{className:'lc-auth-copy'},'Check your inbox and follow the confirmation link to finish setting up your account.'),
 h('button',{type:'button',className:'a-btn outline',onClick:()=>this.setState({phase:'login',error:''})},'Back to sign in'));
 if(s.phase==='register')return h('main',{className:'lc-auth'},
 h('img',{src:'assets/lc-monogram.svg',width:84,alt:'LOUIS COR'}),
 h('h1',null,'Create your account'),
 h('form',{onSubmit:e=>this.register(e)},
 Field({label:'Name',value:s.fullName,onChange:v=>this.setState({fullName:v})}),
 Field({label:'Email',value:s.email,type:'email',onChange:v=>this.setState({email:v})}),
 Field({label:'Password',value:s.password,type:'password',onChange:v=>this.setState({password:v})}),
 Field({label:'Confirm password',value:s.confirmPassword,type:'password',onChange:v=>this.setState({confirmPassword:v})}),
 h('button',{type:'submit',className:'a-btn primary a-full',disabled:s.busy},s.busy?'Creating account…':'Create account')),
 h('div',{className:'lc-owner-onboarding'},h('span',null,'Already have an account? '),h('button',{className:'lc-owner-link',type:'button',onClick:()=>this.setState({phase:'login',error:''})},'Sign in'),h('p',null,'')),
 s.error&&h('p',{role:'alert',className:'lc-error'},s.error));
 if(s.phase==='login')return h('main',{className:'lc-auth'},
 h('img',{src:'assets/lc-monogram.svg',width:84,alt:'LOUIS COR'}),
 h('h1',null,'Owner sign in'),
 h('form',{onSubmit:e=>this.login(e)},
 Field({label:'Email',value:s.email,type:'email',onChange:v=>this.setState({email:v})}),
 Field({label:'Password',value:s.password,type:'password',onChange:v=>this.setState({password:v})}),
 h('button',{type:'submit',className:'a-btn primary a-full',disabled:s.busy},s.busy?'Signing in…':'Sign in')),
 h('a',{className:'lc-password-link',href:'index.html#/account/recover'},'Forgot password?'),
 h('div',{className:'lc-owner-onboarding'},h('span',null,'New to LOUIS COR? '),h('button',{type:'button',className:'lc-owner-link',onClick:()=>this.setState({phase:'register',error:''})},'Create an account'),h('p',null,'')),
 s.error&&h('p',{role:'alert',className:'lc-error'},s.error));const tabs=[['overview','Overview'],['products','Products'],['orders','Orders'],['payments','Payments'],['customers','Customers'],['shipping','Shipping'],['settings','Settings']];return h('div',{className:'a-shell'},h('aside',{className:'a-sidebar'+(s.menu?' mobile-open':''),id:'lc-owner-nav'},h('div',{className:'a-sidebar-top'},h('img',{src:'assets/lc-monogram.svg',alt:'LC',width:72}),h('button',{type:'button',className:'a-sidebar-close',onClick:()=>this.setState({menu:false}),'aria-label':'Close menu'},'✕')),h('nav',{className:'a-nav'},tabs.map(([id,name])=>h('button',{key:id,onClick:()=>this.navigate(id),className:s.page===id?'active':''},h(Icon,{name:id}),name))),h('button',{className:'a-btn outline lc-logout',onClick:()=>this.logout()},'Sign out')),
 s.menu&&h('button',{type:'button',className:'a-backdrop','aria-label':'Close menu',onClick:()=>this.setState({menu:false})}),
 h('div',{className:'a-main-column'},h('header',{className:'a-header'},h('button',{type:'button',className:'a-menu-toggle','aria-label':s.menu?'Close menu':'Open menu','aria-expanded':s.menu,'aria-controls':'lc-owner-nav',onClick:()=>this.setState({menu:!s.menu})},s.menu?'✕':'☰'),h('span',null,'LOUIS COR / OWNER'),h('div',{className:'a-header-actions'},h('a',{href:'index.html',target:'_blank',rel:'noopener'},'View store'))),h('main',{className:'a-content'},s.error&&h('div',{className:'lc-error',role:'alert'},s.error),s.notice&&h('p',{className:'lc-notice',role:'status'},s.notice),s.busy&&h('p',{className:'a-muted'},'Saving…'),s.page==='overview'?this.overview():s.page==='products'?this.products():s.page==='orders'?this.orders():s.page==='payments'?this.payments():s.page==='customers'?this.customers():s.page==='shipping'?this.shipping():this.settings())));
 }
}
DOM.render(h(Owner),document.getElementById('admin-root'));
})();
