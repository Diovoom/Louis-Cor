(() => {
  'use strict';
  const React = window.React;
  const h = React.createElement;
  const auth = window.LCCustomer;
  const EMPTY_ADDRESS = { label: 'Home', recipient: '', line1: '', line2: '', city: '', region: '', postal_code: '', country: 'US', phone: '', is_default: false };
  const dollars = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((Number(cents) || 0) / 100);

  function Field({ label, value, onChange, type = 'text', required = false, autoComplete, placeholder = '', ...rest }) {
    return h('label', { className: 'customer-field' },
      h('span', null, label),
      h('input', { type, required, value: value ?? '', placeholder, autoComplete, onChange: event => onChange(event.target.value), ...rest }));
  }
  function Action({ children, secondary = false, ...props }) {
    return h('button', { ...props, className: secondary ? 'customer-button-secondary' : 'customer-button' }, children);
  }
  function Link({ children, path, ...props }) { return h('a', { href: '#' + path, ...props }, children); }

  class CustomerAccount extends React.Component {
    constructor(props) {
      super(props);
      this.state = {
        mode: this.modeFromPath(props.path), tab: 'profile', busy: false, loading: true, error: '', message: '',
        email: '', password: '', newPassword: '', passwordConfirm: '', fullName: '', verifyCode: '', termsAccepted: false,
        user: auth.user(), profile: null, addresses: [], orders: [], wishlist: [],
        addressForm: null, emailChange: '', phone: '', marketing_opt_in: false
      };
      this.sync = () => this.loadAccount();
    }
    modeFromPath(path) {
      if (path.endsWith('/register')) return 'register';
      if (path.endsWith('/recover')) return 'recover';
      if (path.endsWith('/reset')) return 'reset';
      return 'login';
    }
    componentDidMount() {
      window.addEventListener('lc-customer-auth-changed', this.sync);
      this.loadAccount();
    }
    componentWillUnmount() { window.removeEventListener('lc-customer-auth-changed', this.sync); }
    componentDidUpdate(prevProps) {
      if (prevProps.path !== this.props.path) {
        this.setState({ mode: this.modeFromPath(this.props.path), error: '', message: '' });
      }
    }
    async loadAccount() {
      const user = auth.user();
      if (!user) { this.setState({ user: null, loading: false, profile: null }); return; }
      try {
        const [profile, addresses, orders, wishlist] = await Promise.all([
          auth.loadProfile(), auth.loadAddresses(), auth.loadOrders(), auth.loadWishlist()
        ]);
        this.setState({ user: auth.user(), profile, addresses, orders, wishlist, loading: false,
          fullName: profile.full_name || '', phone: profile.phone || '', marketing_opt_in: profile.marketing_opt_in || false });
      } catch (error) {
        this.setState({ user: auth.user(), loading: false, error: error.message });
      }
    }
    async run(task, success) {
      this.setState({ busy: true, error: '', message: '' });
      try {
        await task();
        if (success) this.setState({ message: success });
      } catch (error) {
        this.setState({ error: error.message || 'Something went wrong. Please try again.' });
      } finally { this.setState({ busy: false }); }
    }
    go(path) { this.props.navigate(path); }
    async signUp(event) {
      event.preventDefault();
      if (this.state.password.length < 8) { this.setState({ error: 'Use at least eight characters for your password.' }); return; }
      if (this.state.password !== this.state.passwordConfirm) { this.setState({ error: 'Passwords do not match.' }); return; }
      if (!this.state.termsAccepted) { this.setState({ error: 'Please review and accept the Terms and Privacy Policy.' }); return; }
      await this.run(async () => {
        const result = await auth.signUp({ email: this.state.email, password: this.state.password, fullName: this.state.fullName });
        if (result.verified) { await this.loadAccount(); this.go('/account'); }
        else this.setState({ mode: 'confirm', password: '', passwordConfirm: '', message: 'Check your email for a verification link. After confirming, sign in to your account.' });
      });
    }
    async signIn(event) {
      event.preventDefault();
      await this.run(async () => { await auth.signIn({ email: this.state.email, password: this.state.password }); await this.loadAccount(); this.go('/account'); });
    }
    async recovery(event) {
      event.preventDefault();
      await this.run(() => auth.requestPasswordReset(this.state.email), 'If the address is registered, a password reset email is on its way.');
    }
    async confirmEmail(event) {
      event.preventDefault();
      await this.run(async () => { await auth.verifyEmailCode(this.state.email, this.state.verifyCode.trim()); await this.loadAccount(); this.go('/account'); });
    }
    async password(event) {
      event.preventDefault();
      if (this.state.newPassword.length < 8) { this.setState({ error: 'Use at least eight characters.' }); return; }
      if (this.state.newPassword !== this.state.passwordConfirm) { this.setState({ error: 'Passwords do not match.' }); return; }
      await this.run(async () => { await auth.updatePassword(this.state.newPassword); this.setState({ newPassword: '', passwordConfirm: '', mode: 'login' }); }, 'Your password has been updated.');
    }
    async profile(event) {
      event.preventDefault();
      await this.run(async () => {
        await auth.saveProfile({ full_name: this.state.fullName, phone: this.state.phone, marketing_opt_in: this.state.marketing_opt_in });
        await this.loadAccount();
      }, 'Your details have been saved.');
    }
    async saveAddress(event) {
      event.preventDefault();
      await this.run(async () => {
        const address = this.state.addressForm;
        if (address.is_default) {
          await Promise.all(this.state.addresses.filter(a => a.id !== address.id && a.is_default).map(a => auth.saveAddress({ ...a, is_default: false })));
        }
        await auth.saveAddress(address);
        this.setState({ addressForm: null });
        await this.loadAccount();
      }, 'Address saved.');
    }
    async removeAddress(id) {
      if (!window.confirm('Remove this saved address?')) return;
      await this.run(async () => { await auth.deleteAddress(id); await this.loadAccount(); }, 'Address removed.');
    }
    async changeEmail(event) {
      event.preventDefault();
      await this.run(() => auth.changeEmail(this.state.emailChange), 'Check your inbox to confirm your new email address.');
    }
    async signOut() {
      await this.run(async () => { await auth.signOut(); this.go('/account/login'); });
    }

    notice() {
      return h(React.Fragment, null,
        this.state.error && h('p', { className: 'customer-error', role: 'alert' }, this.state.error),
        this.state.message && h('p', { className: 'customer-success', role: 'status' }, this.state.message));
    }
    loginForm() {
      const s = this.state;
      return h('div', { className: 'customer-auth-card' },
        h('p', { className: 'customer-eyebrow' }, 'LOUIS COR ACCOUNT'),
        h('h1', null, 'WELCOME BACK'),
        h('p', { className: 'customer-muted' }, 'Sign in to see your orders, saved pieces, and account details.'),
        h('form', { onSubmit: e => this.signIn(e) },
          h(Field, { label: 'Email', type: 'email', required: true, value: s.email, onChange: value => this.setState({ email: value }), autoComplete: 'email' }),
          h(Field, { label: 'Password', type: 'password', required: true, value: s.password, onChange: value => this.setState({ password: value }), autoComplete: 'current-password' }),
          h('p', { className: 'customer-small-link' }, h(Link, { path: '/account/recover' }, 'Forgot password?')),
          h(Action, { type: 'submit', disabled: s.busy }, s.busy ? 'SIGNING IN...' : 'SIGN IN')),
        h('p', { className: 'customer-auth-footer' }, 'New to LOUIS COR? ', h(Link, { path: '/account/register' }, 'Create an account')));
    }
    registerForm() {
      const s = this.state;
      return h('div', { className: 'customer-auth-card' },
        h('p', { className: 'customer-eyebrow' }, 'LOUIS COR ACCOUNT'),
        h('h1', null, 'CREATE AN ACCOUNT'),
        h('p', { className: 'customer-muted' }, 'Keep your favorite pieces, addresses and orders together.'),
        h('form', { onSubmit: e => this.signUp(e) },
          h(Field, { label: 'Full name', required: true, maxLength: 120, value: s.fullName, onChange: value => this.setState({ fullName: value }), autoComplete: 'name' }),
          h(Field, { label: 'Email', required: true, type: 'email', value: s.email, onChange: value => this.setState({ email: value }), autoComplete: 'email' }),
          h(Field, { label: 'Password', required: true, minLength: 8, type: 'password', value: s.password, onChange: value => this.setState({ password: value }), autoComplete: 'new-password' }),
          h(Field, { label: 'Confirm password', required: true, type: 'password', value: s.passwordConfirm, onChange: value => this.setState({ passwordConfirm: value }), autoComplete: 'new-password' }),
          h('label', { className: 'customer-consent' },
            h('input', { type: 'checkbox', required: true, checked: s.termsAccepted, onChange: e => this.setState({ termsAccepted: e.target.checked }) }),
            h('span', null, 'I agree to the ', h(Link, { path: '/legal/terms' }, 'Terms'), ' and acknowledge the ', h(Link, { path: '/legal/privacy' }, 'Privacy Policy'), '.')),
          h(Action, { type: 'submit', disabled: s.busy }, s.busy ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT')),
        h('p', { className: 'customer-auth-footer' }, 'Already have an account? ', h(Link, { path: '/account/login' }, 'Sign in')));
    }
    confirmationForm() {
      return h('div', { className: 'customer-auth-card' },
        h('h1', null, 'CHECK YOUR EMAIL'),
        h('p', { className: 'customer-muted' }, 'Use the verification link we sent you. If your email contains a six-digit code, you can enter it here.'),
        h('form', { onSubmit: e => this.confirmEmail(e) },
          h(Field, { label: 'Verification code', required: true, inputMode: 'numeric', value: this.state.verifyCode, onChange: value => this.setState({ verifyCode: value }) }),
          h(Action, { type: 'submit', disabled: this.state.busy }, 'VERIFY EMAIL')),
        h('p', { className: 'customer-auth-footer' }, h(Link, { path: '/account/login' }, 'Back to sign in')));
    }
    recoverForm() {
      return h('div', { className: 'customer-auth-card' },
        h('h1', null, 'RESET PASSWORD'),
        h('p', { className: 'customer-muted' }, 'Enter the email you used to create your account.'),
        h('form', { onSubmit: e => this.recovery(e) },
          h(Field, { label: 'Email', required: true, type: 'email', value: this.state.email, onChange: value => this.setState({ email: value }), autoComplete: 'email' }),
          h(Action, { type: 'submit', disabled: this.state.busy }, 'SEND RESET LINK')),
        h('p', { className: 'customer-auth-footer' }, h(Link, { path: '/account/login' }, 'Back to sign in')));
    }
    resetForm() {
      return h('div', { className: 'customer-auth-card' },
        h('h1', null, 'NEW PASSWORD'),
        h('form', { onSubmit: e => this.password(e) },
          h(Field, { label: 'New password', required: true, minLength: 8, type: 'password', value: this.state.newPassword, onChange: value => this.setState({ newPassword: value }), autoComplete: 'new-password' }),
          h(Field, { label: 'Confirm new password', required: true, minLength: 8, type: 'password', value: this.state.passwordConfirm, onChange: value => this.setState({ passwordConfirm: value }), autoComplete: 'new-password' }),
          h(Action, { type: 'submit', disabled: this.state.busy }, 'SAVE PASSWORD')));
    }
    profileForm() {
      return h('section', { className: 'customer-panel' },
        h('h2', null, 'PERSONAL INFORMATION'),
        h('form', { onSubmit: e => this.profile(e) },
          h(Field, { label: 'Full name', maxLength: 120, value: this.state.fullName, onChange: value => this.setState({ fullName: value }), autoComplete: 'name' }),
          h(Field, { label: 'Email', type: 'email', value: this.state.user?.email || '', disabled: true, onChange: () => {} }),
          h(Field, { label: 'Phone (optional)', type: 'tel', maxLength: 32, value: this.state.phone, onChange: value => this.setState({ phone: value }), autoComplete: 'tel' }),
          h('label', { className: 'customer-consent' }, h('input', { type: 'checkbox', checked: this.state.marketing_opt_in, onChange: event => this.setState({ marketing_opt_in: event.target.checked }) }),
            h('span', null, 'I agree to receive occasional LOUIS COR updates by email. I can change this anytime.')),
          h(Action, { type: 'submit', disabled: this.state.busy }, 'SAVE CHANGES')));
    }
    addressesPanel() {
      return h('section', { className: 'customer-panel' },
        h('div', { className: 'customer-panel-heading' }, h('h2', null, 'SAVED ADDRESSES'),
          !this.state.addressForm && h(Action, { type: 'button', secondary: true, onClick: () => this.setState({ addressForm: { ...EMPTY_ADDRESS, recipient: this.state.fullName } }) }, 'ADD ADDRESS')),
        this.state.addresses.length === 0 && !this.state.addressForm && h('p', { className: 'customer-muted' }, 'No addresses saved.'),
        h('div', { className: 'customer-address-list' }, this.state.addresses.map(a => h('article', { className: 'customer-address', key: a.id },
          h('strong', null, a.label, a.is_default ? ' · Default' : ''),
          h('p', null, a.recipient, h('br'), a.line1, a.line2 ? ', ' + a.line2 : '', h('br'), a.city + ', ' + a.region + ' ' + a.postal_code),
          h('div', { className: 'customer-address-actions' },
            h('button', { type: 'button', onClick: () => this.setState({ addressForm: { ...a } }) }, 'Edit'),
            h('button', { type: 'button', onClick: () => this.removeAddress(a.id) }, 'Remove'))))),
        this.state.addressForm && this.addressForm());
    }
    addressForm() {
      const a = this.state.addressForm;
      const update = (field, value) => this.setState({ addressForm: { ...this.state.addressForm, [field]: value } });
      return h('form', { className: 'customer-address-form', onSubmit: e => this.saveAddress(e) },
        h('h3', null, a.id ? 'EDIT ADDRESS' : 'NEW ADDRESS'),
        ...[['label', 'Address label'], ['recipient', 'Full name'], ['line1', 'Street address'], ['line2', 'Apartment, suite, etc.'], ['city', 'City'], ['region', 'State / province'], ['postal_code', 'ZIP / postal code'], ['country', 'Country code (US, CA, etc.)'], ['phone', 'Phone (optional)']].map(([name, label]) => h(Field, {
          key: name, label, required: !['line2', 'phone'].includes(name), maxLength: name === 'country' ? 2 : 180,
          value: a[name], onChange: value => update(name, name === 'country' ? value.toUpperCase() : value),
          autoComplete: { recipient: 'name', line1: 'address-line1', line2: 'address-line2', city: 'address-level2', region: 'address-level1', postal_code: 'postal-code', country: 'country', phone: 'tel' }[name]
        })),
        h('label', { className: 'customer-consent' }, h('input', { type: 'checkbox', checked: a.is_default, onChange: e => update('is_default', e.target.checked) }), 'Make this my default address'),
        h('div', { className: 'customer-inline-actions' },
          h(Action, { type: 'submit', disabled: this.state.busy }, 'SAVE ADDRESS'),
          h(Action, { type: 'button', secondary: true, onClick: () => this.setState({ addressForm: null }) }, 'CANCEL')));
    }
    ordersPanel() {
      return h('section', { className: 'customer-panel' }, h('h2', null, 'ORDER HISTORY'),
        !this.state.orders.length && h('div', { className: 'customer-empty' },
          h('p', null, 'No orders yet.'), h(Link, { path: '/shop' }, 'Explore the collection →')),
        this.state.orders.map(order => h('article', { className: 'customer-order', key: order.id },
          h('div', { className: 'customer-order-top' },
            h('strong', null, order.order_number),
            h('span', null, new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }))),
          h('p', null, 'Payment: ', order.payment_status, ' · Fulfillment: ', order.fulfillment_status),
          ...order.lines.map(line => h('div', { className: 'customer-order-line', key: line.id },
            h('span', null, `${line.quantity} × ${line.name}`, line.size ? ` · ${line.size}` : '', line.color ? ` · ${line.color}` : ''),
            h('span', null, dollars(line.unit_price_cents * line.quantity)))),
          h('strong', null, 'Total ', dollars(order.total_cents)),
          order.shipments.map(s => h('p', { key: s.id, className: 'customer-tracking' }, 'Shipment: ', s.carrier, ' · ', s.tracking_code)))));
    }
    savedPanel() {
      return h('section', { className: 'customer-panel' }, h('h2', null, 'SAVED PIECES'),
        !this.state.wishlist.length && h('div', { className: 'customer-empty' }, h('p', null, 'You have no saved pieces.'), h(Link, { path: '/shop' }, 'Discover the collection →')),
        this.state.wishlist.map(id => {
          const product = (window.LC_PRODUCTS || []).find(p => p.id === id);
          return product ? h('div', { className: 'customer-wishlist-item', key: id },
            h('img', { src: product.image, alt: product.name }),
            h('div', null, h('strong', null, product.name), h('p', null, dollars(Math.round(product.price * 100))), h(Link, { path: '/product/' + id }, 'View product →'))) : null;
        }));
    }
    securityPanel() {
      return h('section', { className: 'customer-panel' }, h('h2', null, 'ACCOUNT SECURITY'),
        h('h3', null, 'Change password'),
        h('form', { onSubmit: e => this.password(e) },
          h(Field, { label: 'New password', type: 'password', minLength: 8, required: true, value: this.state.newPassword, onChange: value => this.setState({ newPassword: value }), autoComplete: 'new-password' }),
          h(Field, { label: 'Confirm new password', type: 'password', required: true, value: this.state.passwordConfirm, onChange: value => this.setState({ passwordConfirm: value }), autoComplete: 'new-password' }),
          h(Action, { type: 'submit', disabled: this.state.busy }, 'UPDATE PASSWORD')),
        h('h3', { className: 'customer-security-heading' }, 'Change email'),
        h('form', { onSubmit: e => this.changeEmail(e) },
          h(Field, { label: 'New email address', type: 'email', required: true, value: this.state.emailChange, onChange: value => this.setState({ emailChange: value }), autoComplete: 'email' }),
          h(Action, { type: 'submit', secondary: true, disabled: this.state.busy }, 'REQUEST EMAIL CHANGE')),
        h('p', { className: 'customer-muted' }, 'For data access or deletion requests, use the contact information in the Privacy Policy.'));
    }
    dashboard() {
      const tabs = [['profile', 'Personal details'], ['addresses', 'Addresses'], ['orders', 'Orders'], ['saved', 'Saved pieces'], ['security', 'Security']];
      const active = this.state.tab;
      return h('div', { className: 'customer-dashboard' },
        h('div', { className: 'customer-dashboard-header' },
          h('p', { className: 'customer-eyebrow' }, 'LOUIS COR ACCOUNT'),
          h('h1', null, 'YOUR ACCOUNT'),
          h('p', null, 'Welcome', this.state.fullName ? ', ' + this.state.fullName : '', '.'),
          h('button', { className: 'customer-signout', onClick: () => this.signOut(), type: 'button' }, 'SIGN OUT')),
        h('div', { className: 'customer-dashboard-body' },
          h('nav', { className: 'customer-tabs', 'aria-label': 'Account sections' }, tabs.map(([id, name]) =>
            h('button', { key: id, type: 'button', onClick: () => this.setState({ tab: id, error: '', message: '' }), 'aria-current': active === id ? 'page' : undefined, className: active === id ? 'selected' : '' }, name))),
          h('div', { className: 'customer-tab-content' }, this.notice(),
            active === 'profile' ? this.profileForm() : active === 'addresses' ? this.addressesPanel() : active === 'orders' ? this.ordersPanel() : active === 'saved' ? this.savedPanel() : this.securityPanel())));
    }
    render() {
      if (this.state.loading) return h('main', { className: 'customer-account-page' }, h('p', { className: 'customer-loading' }, 'Loading your account…'));
      const recovering = this.props.path.endsWith('/reset');
      if (this.state.user && !recovering) return h('main', { className: 'customer-account-page' }, this.dashboard());
      const mode = recovering ? 'reset' : this.state.mode;
      return h('main', { className: 'customer-account-page customer-auth-page' },
        mode === 'register' ? this.registerForm() : mode === 'recover' ? this.recoverForm() : mode === 'reset' ? this.resetForm() : mode === 'confirm' ? this.confirmationForm() : this.loginForm(),
        (this.state.error || this.state.message) ? h('div', { className: 'customer-auth-messages' }, this.notice()) : null);
    }
  }

  window.LCCustomerAccountPage = CustomerAccount;
})();
