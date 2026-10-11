/* Describes current storefront behavior truthfully; owner-configurable commercial terms.
   The business owner MUST review/apply jurisdiction-specific requirements before sales. */
window.LCLegal=(function(){
 const s=()=>window.LC_STORE_SETTINGS||{};
 const email=()=>s().privacy_email||s().support_email;
 const who=()=>s().legal_business_name||'LOUIS COR';
 const contact=()=>email()?`For privacy or service inquiries, email ${email()}.`:'The store will provide its verified customer contact details before accepting orders.';
 const shipping=()=>s().shipping_regions?`We ship to: ${s().shipping_regions}.`:'Available shipping destinations have not been announced. Orders cannot be placed at this time.';
 const returns=()=>s().return_window_days!==null&&s().return_window_days!==undefined?`Return requests may be made within ${s().return_window_days} days, subject to the published eligibility conditions.`:'The return period will be confirmed before online orders become available.';
 function pages(){return {
   privacy:{title:'Privacy Policy',intro:`${who()} explains here how information is handled on this website. Last updated October 2026.`,sections:[
     ['What information is processed','The publicly accessible storefront retrieves product names, descriptions, prices, and available stock. Your browser stores the shopping bag, saved items, customer sign-in session, and acknowledgement of the storage notice on this device. Signed-in customers can also save selected details securely to their account. Customer accounts are available. When you register, we process your email address, optional phone number, name, saved addresses, saved items and account credentials through Supabase Authentication. Online card checkout is not yet enabled and this storefront does not collect card details.'],
     ['Technical information','Our hosting and backend providers may process IP addresses, timestamps, and technical request information for operation, troubleshooting, and security. The store database and customer authentication run on Supabase.'],
     ['Why information is used','Information is used to create and secure your account, save preferences and delivery addresses, sync your bag and saved pieces, and show your own order history when orders become available. Operational request logs help the service run securely. Information is not sold by this storefront.'],
     ['Disclosure and service providers','The site may share technical data with its hosting service and Supabase infrastructure as necessary for site delivery. No advertising or behavioral analytics tools are enabled in this build.'],
     ['Retention and control','You can change your account profile and saved addresses after signing in, opt out of promotional updates, sign out, or clear local browser data. Requests to access or delete account data should be directed to the privacy contact below. Account and customer records are retained as needed to provide the service and meet legal obligations; the merchant must define and publish its retention schedule before accepting payments.'],
     ['Your privacy rights','Depending on your location, you may have rights to access, correct, or delete personal information and raise privacy concerns. '+contact()],
     ['Policy updates','This notice will be updated if payment processing, shipment services, optional analytics, or new processing activities are activated.']
   ]},
   terms:{title:'Terms & Conditions',intro:`These terms govern use of the ${who()} website. Last updated October 2026.`,sections:[
     ['Using the website','You may browse the catalog for lawful personal use. Do not interfere with the security or operation of the website or attempt unauthorized access.'],
     ['Availability and purchases','Online ordering and checkout are not yet enabled. Listings are informational until the store activates a validated payment system. Showing a product does not constitute acceptance of an order.'],
     ['Product information','Colors may vary between screens. Customers should review the size and material information listed on each item. Product availability and pricing may change prior to checkout being enabled.'],
     ['Ownership of content','Brand marks, copy and images are the property of the respective rights holders. Reuse requires permission.'],
     ['Liability and applicable rights','Nothing here excludes consumer rights that cannot legally be waived. Governing-law and dispute provisions will be supplied after the brand confirms its registered business details.'],
     ['Questions',contact()]
   ]},
   cookies:{title:'Cookie & Storage Policy',intro:'This storefront uses necessary browser storage. It currently does not load advertising, analytics, or marketing cookies.',sections:[
     ['Essential storage','lc-cart-v1 stores items in your shopping bag. lc-wishlist-v1 stores items you save. lc-cookie-consent-v1 stores your acknowledgement of this notice. lc-customer-session-v1 stores your customer authentication tokens when you sign in. These are functional localStorage keys, not advertising cookies. Signed-in customers also have saved data protected by database access controls.'],
     ['Owner access','The private Owner Dashboard uses lc-owner-auth-session-v1 to retain an authenticated owner session on that device. It is not a customer tracking cookie.'],
     ['Optional technologies','No optional trackers or analytics vendors are installed. Therefore there are no optional categories to enable or disable. If the business adds them later, it must update this notice and obtain consent where required before loading them.'],
     ['Your controls','Use your browser privacy settings to remove local data. You can reopen the site storage notice using Cookie settings in the footer.']
   ]},
   shipping:{title:'Shipping & Delivery',intro:'Online checkout is currently unavailable. This page describes only confirmed fulfillment arrangements.',sections:[
     ['Where we ship',shipping()],
     ['Processing time',s().processing_time?`Confirmed preparation time: ${s().processing_time}.`:'Processing times and carrier options will be announced before orders are accepted.'],
     ['Rates and tracking','Actual shipping charges and delivery estimates will be disclosed at checkout once that service becomes available. This website does not currently purchase shipping labels or send shipment notifications.'],
     ['Questions',contact()]
   ]},
   returns:{title:'Returns & Exchanges',intro:'Returns apply to completed purchases once online ordering becomes available.',sections:[
     ['Request period',returns()],
     ['Eligibility',s().return_conditions||'Return eligibility, product condition requirements, and exclusions must be confirmed by the merchant before purchases can be accepted. Applicable statutory consumer rights remain in effect.'],
     ['Return address',s().return_address||'The return address will be provided before orders are accepted. Do not send parcels without return authorization.'],
     ['Refunds and contact','Refund method and timing will be specified with the active checkout system. '+contact()]
   ]},
   accessibility:{title:'Accessibility',intro:'We aim to offer an accessible experience across phones, laptops and assistive technologies.',sections:[
     ['Accessibility features','The store provides labeled controls, semantic page regions, keyboard navigation, visible focus styles and reduced-motion support where available.'],
     ['Feedback','If something on the website is difficult to access, please contact us. '+contact()]
   ]}
 }}
 return {pages};
})();
