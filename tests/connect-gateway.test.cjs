const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'supabase', 'functions');
const platformRoot = path.join(__dirname, '..', 'seza-gateway', 'supabase', 'functions');
const src = file => fs.readFileSync(path.join(file === 'seza-louis-cor-gateway' ? platformRoot : root, file, 'index.ts'), 'utf8');

test('SEZA secret exists only at SEZA boundary', () => {
  const platform = src('seza-louis-cor-gateway');
  for (const merchant of ['create-checkout','checkout-status','stripe-webhook']) {
    const code = src(merchant);
    assert.doesNotMatch(code,/STRIPE_SECRET_KEY|SEZA_STRIPE_LIVE_SECRET_KEY|sk_live_/);
    assert.match(code,/LC_GATEWAY_SHARED_SECRET/);
  }
  assert.match(platform,/SEZA_STRIPE_LIVE_SECRET_KEY/);
});
test('SEZA direct charge targets one pinned merchant and no SEZA subscription', () => {
  const s=src('seza-louis-cor-gateway');
  assert.match(s,/'Stripe-Account':connectedId/);
  assert.match(s,/LC_CONNECTED_ACCOUNT_ID/);
  assert.doesNotMatch(s,/transfer_data\[destination\]/);
  assert.doesNotMatch(s,/application_fee_amount\[|stripe\.subscriptions|mode','subscription'/);
  assert.match(s,/mode','payment'/);
});
test('Connect webhook signs and verifies both hops and filters account and live mode', () => {
 const platform=src('seza-louis-cor-gateway'), merchant=src('stripe-webhook');
 assert.match(platform,/verifyStripe\(raw/);
 assert.match(platform,/event\?\.account!==connectedId/);
 assert.match(platform,/event\?\.livemode!==true/);
 assert.match(merchant,/authorized\(req,raw\)/);
 assert.match(merchant,/event\?\.account!==merchantId/);
 assert.match(merchant,/lc_checkout_paid/);
});
test('Checkout denies until verified and product amounts are server sourced', () => {
 const code=src('create-checkout');
 assert.match(code,/CHECKOUT_ENABLED/);
 assert.match(code,/email_confirmed_at/);
 assert.match(code,/lc_checkout_reserve/);
 assert.match(code,/subtotal_cents:reservation\.subtotal_cents/);
 assert.match(code,/action:'expire_checkout'/);
});
