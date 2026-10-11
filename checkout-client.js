/* LOUIS COR checkout. Stripe secrets and product prices never enter the browser. */
(function () {
  'use strict';
  const config = window.LC_BACKEND_CONFIG || {};
  const base = String(config.url || '').replace(/\/$/, '');
  const apiKey = String(config.publishableKey || '');
  const errorText = error => {
    const message = String(error?.message || '').toLowerCase();
    if (/sign in|session expired|unauthorized/.test(message)) return 'Please sign in again to continue.';
    if (/stock|sold out|not available|no longer available/.test(message)) return 'A piece in your bag is no longer available. Please review your bag.';
    return 'Checkout is temporarily unavailable. Please try again later.';
  };
  let active = false;
  async function status() {
    active = false;
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(base)) return false;
    const response = await fetch(base + '/functions/v1/checkout-status', {
      method: 'GET', headers: { apikey: apiKey }, cache: 'no-store'
    });
    if (!response.ok) return false;
    const payload = await response.json();
    active = payload?.available === true;
    return active;
  }
  async function start(cart) {
    if (!active) throw Error('Checkout not available');
    const token = await window.LCCustomer.accessToken();
    const response = await fetch(base + '/functions/v1/create-checkout', {
      method: 'POST', headers: { apikey: apiKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cart: cart.map(line => ({ product_id: line.id, color: line.color, size: line.size, quantity: line.qty })) })
    });
    let result = null;
    try { result = await response.json(); } catch (_) { /* Don't display technical error bodies. */ }
    if (!response.ok || !result?.url) throw Error(result?.message || 'Checkout unavailable');
    const redirect = new URL(result.url);
    if (redirect.protocol !== 'https:' || !['checkout.stripe.com', 'buy.stripe.com'].includes(redirect.hostname)) {
      throw Error('Invalid payment destination');
    }
    return redirect.href;
  }
  window.LCCheckout = Object.freeze({ status, start, message: errorText });
})();
