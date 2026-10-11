const assert = require('node:assert/strict');
const { test } = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function fixture() {
  const values = new Map();
  const calls = [];
  const listeners = new Map();
  const window = {
    LC_BACKEND_CONFIG: { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test' },
    addEventListener(event, listener) { listeners.set(event, listener); },
    dispatchEvent() {}
  };
  const localStorage = {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
  const user = { id: '11111111-1111-4111-8111-111111111111', email: 'shopper@example.com' };
  async function fetch(url, options = {}) {
    calls.push({ url, options });
    const method = options.method || 'GET';
    const route = new URL(url);
    let data = [];
    if (route.pathname === '/auth/v1/signup') data = { user };
    if (route.pathname === '/auth/v1/token') data = { user, access_token: 'access_token', refresh_token: 'refresh_token', expires_at: 9999999999 };
    if (route.pathname === '/auth/v1/user') data = user;
    if (route.pathname.endsWith('lc_customer_profiles') && method === 'GET') data = [{ user_id: user.id, full_name: 'Alex Stone', phone: '', marketing_opt_in: false }];
    if (route.pathname.endsWith('lc_customer_profiles') && method === 'POST') data = [{ user_id: user.id, full_name: 'Alex Stone', phone: '3055551234', marketing_opt_in: false }];
    if (route.pathname.endsWith('lc_customer_wishlist') && method === 'GET') data = [{ product_id: 'signature-hoodie' }];
    if (route.pathname.endsWith('lc_customer_cart') && method === 'GET') data = [{ product_id: 'signature-hoodie', color: 'Black', size: 'M', quantity: 2 }];
    return { ok: true, status: 200, text: async () => JSON.stringify(data) };
  }
  const context = vm.createContext({ window, localStorage, fetch, location: { hash: '', origin: 'https://louiscor.example', pathname: '/' }, history: { replaceState() {} }, CustomEvent: class {}, URLSearchParams, Date, console, encodeURIComponent, String, Promise });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'customer-auth.js'), 'utf8'), context);
  return { api: window.LCCustomer, calls, values };
}

test('registration requests account creation without exposing a stored session before email verification', async () => {
  const { api, calls, values } = fixture();
  const result = await api.signUp({ email: ' Shopper@Example.com ', password: 'securepassword123', fullName: 'Alex Stone' });
  assert.equal(result.verified, false);
  assert.equal(result.email, 'shopper@example.com');
  assert.equal(values.size, 0);
  assert.equal(JSON.parse(calls[0].options.body).data.full_name, 'Alex Stone');
});

test('sign-in and account reads use authorized credentials', async () => {
  const { api, calls, values } = fixture();
  await api.signIn({ email: 'shopper@example.com', password: 'securepassword123' });
  assert.equal(api.user().email, 'shopper@example.com');
  assert.equal((await api.loadProfile()).full_name, 'Alex Stone');
  assert.deepEqual(Array.from(await api.loadWishlist()), ['signature-hoodie']);
  assert.equal((await api.loadCart())[0].qty, 2);
  assert.ok(calls.find(c => c.options.headers?.Authorization === 'Bearer access_token'));
  assert.ok(values.has('lc-customer-session-v1'));
  await api.signOut();
  assert.equal(api.user(), null);
  assert.equal(values.has('lc-customer-session-v1'), false);
});

test('customer data saves use server-side authenticated endpoints', async () => {
  const { api, calls } = fixture();
  await api.signIn({ email: 'shopper@example.com', password: 'securepassword123' });
  await api.saveProfile({ full_name: 'Alex Stone', phone: '3055551234', marketing_opt_in: false });
  await api.addWishlist('signature-hoodie');
  await api.setCartLine({ id: 'signature-hoodie', color: 'Black', size: 'M', qty: 2 });
  assert.ok(calls.find(c => c.url.includes('lc_customer_profiles?on_conflict=user_id') && c.options.method === 'POST'));
  assert.ok(calls.find(c => c.url.includes('lc_customer_wishlist?on_conflict=') && c.options.method === 'POST'));
  assert.ok(calls.find(c => c.url.includes('lc_customer_cart?on_conflict=') && c.options.method === 'POST'));
});
