(() => {
  'use strict';

  const config = window.LC_BACKEND_CONFIG;
  const base = String(config.url).replace(/\/$/, '');
  const apiKey = config.publishableKey;
  const sessionStorageKey = 'lc-customer-session-v1';
  let session = null;
  let refreshPromise = null;

  try { session = JSON.parse(localStorage.getItem(sessionStorageKey) || 'null'); } catch (_) { /* invalid prior session */ }

  const notify = () => window.dispatchEvent(new CustomEvent('lc-customer-auth-changed', { detail: { user: session?.user || null } }));
  function setSession(value) {
    session = value?.access_token ? { ...value, expires_at: value.expires_at || Math.floor(Date.now() / 1000) + (value.expires_in || 3600) } : null;
    if (session) localStorage.setItem(sessionStorageKey, JSON.stringify(session));
    else localStorage.removeItem(sessionStorageKey);
    notify();
  }

  async function http(path, { method = 'GET', body, requireAuth = false, headers = {} } = {}) {
    if (requireAuth) await ensureSession();
    const response = await fetch(base + path, {
      method,
      headers: {
        apikey: apiKey,
        ...(requireAuth && session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch (_) { data = raw; }
    if (!response.ok) throw new Error(data?.msg || data?.error_description || data?.message || data?.error || `Request failed (${response.status})`);
    return data;
  }

  async function refresh() {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
      try {
        if (!session?.refresh_token) throw new Error('Your session expired. Sign in again.');
        const next = await http('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token } });
        setSession(next);
        return next;
      } catch (error) {
        setSession(null);
        throw error;
      } finally {
        refreshPromise = null;
      }
    })();
    return refreshPromise;
  }

  async function ensureSession() {
    if (!session?.access_token) throw new Error('Please sign in.');
    if ((session.expires_at || 0) < Math.floor(Date.now() / 1000) + 90) await refresh();
    return session;
  }

  const user = () => session?.user || null;
  async function restore() {
    if (!session) { notify(); return null; }
    try {
      await ensureSession();
      const verified = await http('/auth/v1/user', { requireAuth: true });
      session.user = verified;
      localStorage.setItem(sessionStorageKey, JSON.stringify(session));
      notify();
      return verified;
    } catch (_) { setSession(null); return null; }
  }

  async function signUp({ email, password, fullName }) {
    const result = await http('/auth/v1/signup', {
      method: 'POST',
      body: { email: email.trim().toLowerCase(), password, data: { full_name: fullName.trim() } }
    });
    if (result?.access_token) setSession(result);
    return { verified: Boolean(result?.access_token), email: email.trim().toLowerCase() };
  }

  async function signIn({ email, password }) {
    const result = await http('/auth/v1/token?grant_type=password', {
      method: 'POST', body: { email: email.trim().toLowerCase(), password }
    });
    setSession(result);
    return result.user;
  }

  async function signOut() {
    try { if (session) await http('/auth/v1/logout', { method: 'POST', requireAuth: true }); }
    catch (_) { /* A local sign-out must still succeed if the network is unavailable. */ }
    finally { setSession(null); }
  }

  function publicRedirect() { return location.origin + location.pathname; }
  async function requestPasswordReset(email) {
    await http('/auth/v1/recover?redirect_to=' + encodeURIComponent(publicRedirect()), {
      method: 'POST', body: { email: email.trim().toLowerCase() }
    });
  }

  async function verifyEmailCode(email, token) {
    const result = await http('/auth/v1/verify', { method: 'POST', body: { email: email.trim().toLowerCase(), token, type: 'signup' } });
    if (result?.access_token) setSession(result);
    return result;
  }

  async function updatePassword(password) {
    const next = await http('/auth/v1/user', { method: 'PUT', body: { password }, requireAuth: true });
    if (next?.id && session) { session.user = next; localStorage.setItem(sessionStorageKey, JSON.stringify(session)); }
  }

  async function changeEmail(email) {
    const next = await http('/auth/v1/user', { method: 'PUT', body: { email: email.trim().toLowerCase() }, requireAuth: true });
    if (next?.id && session) { session.user = next; localStorage.setItem(sessionStorageKey, JSON.stringify(session)); notify(); }
  }

  async function select(table, query = '') {
    return http(`/rest/v1/${table}?${query || 'select=*'}`, { requireAuth: true });
  }

  async function loadProfile() {
    await ensureSession();
    const records = await select('lc_customer_profiles', 'select=*&user_id=eq.' + encodeURIComponent(user().id));
    return records[0] || { user_id: user().id, full_name: user().user_metadata?.full_name || '', phone: '', marketing_opt_in: false };
  }

  async function saveProfile({ full_name, phone, marketing_opt_in }) {
    await ensureSession();
    const payload = { user_id: user().id, full_name: String(full_name).trim(), phone: String(phone || '').trim(), marketing_opt_in: Boolean(marketing_opt_in), updated_at: new Date().toISOString() };
    const records = await http('/rest/v1/lc_customer_profiles?on_conflict=user_id', {
      method: 'POST', body: payload, requireAuth: true, headers: { Prefer: 'resolution=merge-duplicates,return=representation' }
    });
    return records[0];
  }

  async function loadAddresses() { return select('lc_customer_addresses', 'select=*&order=is_default.desc,created_at.desc'); }
  async function saveAddress(address) {
    await ensureSession();
    const fields = ['label', 'recipient', 'line1', 'line2', 'city', 'region', 'postal_code', 'country', 'phone', 'is_default'];
    const payload = Object.fromEntries(fields.map(field => [field, address[field]]));
    payload.user_id = user().id;
    if (address.id) payload.id = address.id;
    const response = await http('/rest/v1/lc_customer_addresses' + (address.id ? '?id=eq.' + encodeURIComponent(address.id) : ''), {
      method: address.id ? 'PATCH' : 'POST', body: payload, requireAuth: true, headers: { Prefer: 'return=representation' }
    });
    return response?.[0];
  }
  async function deleteAddress(id) { return http('/rest/v1/lc_customer_addresses?id=eq.' + encodeURIComponent(id), { method: 'DELETE', requireAuth: true }); }

  async function loadWishlist() {
    const items = await select('lc_customer_wishlist', 'select=product_id');
    return items.map(item => item.product_id);
  }
  async function addWishlist(productId) {
    await ensureSession();
    return http('/rest/v1/lc_customer_wishlist?on_conflict=user_id,product_id', { method: 'POST', requireAuth: true, body: { user_id: user().id, product_id: productId }, headers: { Prefer: 'resolution=ignore-duplicates' } });
  }
  async function removeWishlist(productId) {
    return http('/rest/v1/lc_customer_wishlist?product_id=eq.' + encodeURIComponent(productId), { method: 'DELETE', requireAuth: true });
  }

  async function loadCart() {
    const items = await select('lc_customer_cart', 'select=product_id,color,size,quantity');
    return items.map(item => ({ id: item.product_id, color: item.color, size: item.size, qty: item.quantity, key: `${item.product_id}_${item.size}_${item.color}` }));
  }
  async function setCartLine(item) {
    await ensureSession();
    if (item.qty <= 0) return http('/rest/v1/lc_customer_cart?product_id=eq.' + encodeURIComponent(item.id) + '&color=eq.' + encodeURIComponent(item.color) + '&size=eq.' + encodeURIComponent(item.size), { method: 'DELETE', requireAuth: true });
    return http('/rest/v1/lc_customer_cart?on_conflict=user_id,product_id,color,size', {
      method: 'POST', requireAuth: true,
      body: { user_id: user().id, product_id: item.id, color: item.color, size: item.size, quantity: item.qty, modified_at: new Date().toISOString() },
      headers: { Prefer: 'resolution=merge-duplicates' }
    });
  }

  async function loadOrders() {
    const orders = await select('lc_orders', 'select=*&order=created_at.desc');
    const [lines, shipments] = await Promise.all([select('lc_order_lines'), select('lc_shipments')]);
    return orders.map(order => ({ ...order, lines: lines.filter(line => line.order_id === order.id), shipments: shipments.filter(shipment => shipment.order_id === order.id) }));
  }

  // Supabase email confirmation/recovery links return their short-lived tokens in the fragment.
  const fragment = location.hash.slice(1);
  if (/^(access_token|refresh_token)=/.test(fragment)) {
    const params = new URLSearchParams(fragment);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (access_token && refresh_token) {
      setSession({ access_token, refresh_token, token_type: 'bearer', expires_in: Number(params.get('expires_in')) || 3600 });
      const destination = params.get('type') === 'recovery' ? '#/account/reset' : '#/account';
      history.replaceState(null, '', location.pathname + location.search + destination);
    }
  }

  window.addEventListener('storage', event => {
    if (event.key === sessionStorageKey) {
      try { session = event.newValue ? JSON.parse(event.newValue) : null; } catch (_) { session = null; }
      notify();
    }
  });

  window.LCCustomer = Object.freeze({
    user, restore, signUp, signIn, signOut, requestPasswordReset, verifyEmailCode,
    updatePassword, changeEmail, loadProfile, saveProfile, loadAddresses, saveAddress,
    deleteAddress, loadWishlist, addWishlist, removeWishlist, loadCart, setCartLine, loadOrders
  });
})();
