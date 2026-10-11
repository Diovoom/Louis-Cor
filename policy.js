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
   privacy:{title:'Privacy Policy',intro:`This policy describes how ${who()} handles personal information when you use our website. Effective October 11, 2026.`,sections:[
     ['Who operates this site',`${who()} operates this store. ${s().postal_address?'Our business mailing address is '+s().postal_address+'. ':''}${contact()}`],
     ['Information you provide','When you create an account, we collect your email address, name, password, and any phone number you choose to supply. When you use your account, we process saved shipping addresses, cart contents, wishlists, your account preferences, and related service requests. Password verification is handled by our authentication provider; the store interface does not show passwords to store staff. When checkout is enabled, payments are processed by Stripe. The store does not collect or store full card numbers. Orders, shipping addresses, payment status, and fulfillment records are retained to process purchases. If checkout is not enabled, no online payments are accepted.'],
     ['Information collected automatically','Our hosting and authentication services receive technical details needed to serve pages and protect access, which may include device/browser information, IP address, event times, and request logs. Our website uses local browser storage for sign-in, your bag, saved items and storage-notice acknowledgement. See the Cookie & Storage Policy.'],
     ['How we use information','We use your data to create and secure accounts, keep saved items and addresses available, maintain the product catalog, respond to service requests, prevent misuse, and keep the website running. When checkout is enabled, we also use order and delivery details to take payments, prevent fraud, fulfill shipments, provide customer support, and meet tax and accounting obligations.'],
     ['Marketing choices','You may choose whether you want marketing updates in your account preferences. No marketing emails or advertising trackers are active in the current website build. If marketing services are added, they must respect your preferences and include any legally required opt-out controls.'],
     ['Who processes information','Supabase provides our database, customer authentication, and product image storage. If payments are enabled, Stripe processes payment and billing information and helps prevent payment fraud. Shipping carriers receive the address and contact details required for delivery. The website hosting provider may process normal site delivery and security logs. We do not currently install advertising pixels, cross-site profiling services or behavioral analytics. We do not sell personal information through this website.'],
     ['Storage and security','Customer account information and preferences are held in the LOUIS COR Supabase project. This project is hosted in a United States region. We use account authentication and database access rules to restrict customer records. No online service can promise perfect security. Do not share passwords, and sign out on devices you do not control.'],
     ['How long data stays','We keep account records while the account is active or for the time reasonably needed to operate the service and meet applicable legal obligations. Browser-stored information remains until cleared through the browser or the available site controls. Technical logs may be retained according to service-provider policies. We do not claim a fixed retention period that has not been implemented.'],
     ['Your choices and rights',`You can update your profile, manage saved addresses, clear locally saved items, and sign out. You may also request access, correction or deletion of personal information, subject to verification and legal exceptions. Additional rights may apply depending on where you live. ${contact()}`],
     ['Children','This website is not directed to children under 13. If you believe a child has provided personal information without appropriate authorization, contact us.'],
     ['Changes','We may revise this notice as website features or providers change. The effective date at the top will be updated if the policy materially changes.']
   ]},
   terms:{title:'Terms & Conditions',intro:`These terms govern use of the ${who()} website. Last updated October 2026.`,sections:[
     ['Using the website','You may browse the catalog for lawful personal use. Do not interfere with the security or operation of the website or attempt unauthorized access.'],
     ['Availability and purchases','Purchases are available only when checkout is enabled. Product stock and prices are confirmed during checkout. An order is confirmed only after payment is verified, not merely when you return from the payment page. Applicable taxes and delivery charges are shown before payment.'],
     ['Product information','Colors may vary between screens. Customers should review the size and material information listed on each item. Product availability and pricing may change prior to checkout being enabled.'],
     ['Ownership of content','Brand marks, copy and images are the property of the respective rights holders. Reuse requires permission.'],
     ['Liability and applicable rights','Nothing here excludes consumer rights that cannot legally be waived. Governing-law and dispute provisions will be supplied after the brand confirms its registered business details.'],
     ['Questions',contact()]
   ]},
   cookies:{title:'Cookie & Storage Policy',intro:'We currently use necessary device storage. No advertising, analytics or social-tracking cookies are installed in this version of the store.',sections:[
     ['What is stored on your device','The site uses browser localStorage, which is similar in purpose to some necessary cookies but is not itself an HTTP cookie. Essential entries include lc-cart-v1 (on-device shopping bag), lc-wishlist-v1 (saved items), lc-cookie-consent-v1 (storage notice acknowledgement), and lc-customer-session-v1 (signed-in customer session). The separate private Owner Dashboard uses lc-owner-auth-session-v1 for an authenticated owner session.'],
     ['Why we use it','This storage keeps you signed in, restores your selections across page visits, and remembers that you have seen the storage notice. The website does not use it for cross-site advertising or analytics profiling. Hosting and authentication providers may use their own necessary security/session technologies. If you proceed to Stripe’s secure payment page, Stripe may use cookies and other technologies governed by its own privacy notice.'],
     ['Optional technologies','No optional tracking categories are active. We therefore do not show an artificial marketing-consent switch or an advertising opt-out that cannot do anything. Optional tracking would need a separate updated notice and consent controls where required before activation.'],
     ['Your control','Choose Privacy & Cookies in the footer to see what is used and clear the bag and saved items stored locally on this device. This does not remove copies in a signed-in account. To remove sign-in storage, sign out; you may also clear the site data in your browser settings.']
   ]},
   shipping:{title:'Shipping & Delivery',intro:'Shipping is available only to the destinations supported at checkout, and the terms below describe confirmed fulfillment arrangements.',sections:[
     ['Where we ship',shipping()],
     ['Processing time',s().processing_time?`Confirmed preparation time: ${s().processing_time}.`:'Processing times and carrier options will be announced before orders are accepted.'],
     ['Rates and tracking','When checkout is available, shipping charges and applicable taxes are displayed before payment. Shipping carriers, delivery dates, and tracking depend on the merchant’s available services. The website does not automatically purchase shipping labels.'],
     ['Questions',contact()]
   ]},
   returns:{title:'Returns & Exchanges',intro:'Returns and refunds apply to completed purchases, subject to the merchant’s published conditions and applicable consumer rights.',sections:[
     ['Request period',returns()],
     ['Eligibility',s().return_conditions||'Return eligibility, product condition requirements, and exclusions must be confirmed by the merchant before purchases can be accepted. Applicable statutory consumer rights remain in effect.'],
     ['Return address',s().return_address||'The return address will be provided before orders are accepted. Do not send parcels without return authorization.'],
     ['Refunds and contact','Where approved, refunds are generally issued to the original payment method; processing times depend on the payment provider and financial institution. '+contact()]
   ]},
   accessibility:{title:'Accessibility',intro:'We aim to offer an accessible experience across phones, laptops and assistive technologies.',sections:[
     ['Accessibility features','The store provides labeled controls, semantic page regions, keyboard navigation, visible focus styles and reduced-motion support where available.'],
     ['Feedback','If something on the website is difficult to access, please contact us. '+contact()]
   ]}
 }}
 return {pages};
})();
