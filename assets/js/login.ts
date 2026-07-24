(() => {
  const qs = (name: string) => new URLSearchParams(window.location.search).get(name);
  const roles = ['enduser','clientuser','clientportaluser','assetowner','owner','investor','organizationuser'];
  const normalize = (value: unknown) => String(value || '').toLowerCase().replace(/[ _-]+/g, '');
  function status(message: string, type = 'info'): void {
    const box = document.getElementById('loginStatus'); if (!box) return;
    box.textContent = message; box.className = `login-status ${type}`;
  }
  function nextUrl(): string {
    const next = qs('next'); if (!next) return 'index.html';
    const safe = next.replace(/\\/g,'/').replace(/^\.\//,'');
    return safe.includes('://') || safe.startsWith('/') || safe.startsWith('../') ? 'index.html' : safe;
  }
  function intro(): string {
    if (qs('reason') === 'role') return 'This account does not have End User portal access.';
    if (qs('reason') === 'session') return 'Your session expired. Sign in again.';
    return 'Sign in to view your plant, energy sales, revenue and reports.';
  }
  async function submit(event: Event): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const username = (form.elements.namedItem('username') as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    const authBase = (form.elements.namedItem('authBaseUrl') as HTMLInputElement).value.trim();
    const apiBase = (form.elements.namedItem('apiBaseUrl') as HTMLInputElement).value.trim();
    window.ZentridConfig.setAuthBaseUrl(authBase); window.ZentridConfig.setApiBaseUrl(apiBase);
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    button.disabled = true; button.textContent = 'Signing in...'; status('Connecting to Zentrid Auth...', 'info');
    try {
      await window.ZentridAuth.login(username, password);
      const valid = await window.ZentridAuth.ensureSession('');
      if (!valid) throw new Error('Unable to verify the authenticated session.');
      if (!(window.ZentridAuth.getRoles() || []).length) await window.ZentridAuth.me();
      const allowed = window.ZentridAuth.getRoles().some((role: string) => roles.includes(normalize(role)));
      if (!allowed) { window.ZentridAuth.logout(false); throw new Error('This account does not have End User portal access.'); }
      status('Login successful. Opening your dashboard...', 'success'); window.location.href = nextUrl();
    } catch (error) {
      status(error instanceof Error ? error.message : 'Unable to sign in.', 'error');
      button.disabled = false; button.textContent = 'Sign in to My Zentrid';
    }
  }
  const root = document.getElementById('loginApp');
  if (!root) return;
  root.innerHTML = `<main class="login-shell"><section class="login-card glass-card">
    <div class="login-brand"><div class="brand-mark">Z</div><div><p class="eyebrow">Zentrid Auth</p><h1>End User Login</h1><p class="muted">Your plant, energy sales and revenue in one simple place.</p></div></div>
    <form id="loginForm" class="login-form">
      <label>Username
        <input name="username" autocomplete="username" required />
      </label>
      <label>Password
        <input name="password" type="password" autocomplete="current-password" required />
      </label>
      <details class="login-config"><summary>API configuration (optional)</summary>
        <label>Auth base URL<input name="authBaseUrl" value="${window.ZentridConfig.authBaseUrl || ''}" placeholder="Local: http://localhost:5050" /></label>
        <label>API base URL<input name="apiBaseUrl" value="${window.ZentridConfig.apiBaseUrl || ''}" placeholder="Local: http://localhost:5050" /></label>
      </details>
      <button class="primary-action" type="submit">Sign in to My Zentrid</button>
      <div id="loginStatus" class="login-status info">${intro()}</div>
    </form>
  </section></main>`;
  document.getElementById('loginForm')?.addEventListener('submit', submit);
})();
