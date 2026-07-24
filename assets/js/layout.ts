type EndUserNavItem = { icon: string; label: string; href: string; key: string };
type EndUserNavGroup = { section: string; items: EndUserNavItem[] };

function endUserTarget(event: Event): Element | null {
  return event.target instanceof Element ? event.target : null;
}

const ZentridEndUserLayout = (() => {
  const basePath = window.location.pathname.includes('/pages/') ? '../' : '';
  const current = window.location.pathname.split('/').pop() || 'index.html';
  const nav: EndUserNavGroup[] = [
    { section: 'Home', items: [
      { icon: '🏠', label: 'Overview', href: basePath + 'index.html', key: 'index.html' },
      { icon: '☀️', label: 'My Plant', href: basePath + 'pages/my-plant.html', key: 'my-plant.html' }
    ] },
    { section: 'System', items: [
      { icon: '🔌', label: 'Devices', href: basePath + 'pages/devices.html', key: 'devices.html' },
      { icon: '🚨', label: 'Alerts', href: basePath + 'pages/alerts.html', key: 'alerts.html' },
      { icon: '⚡', label: 'Energy', href: basePath + 'pages/energy.html', key: 'energy.html' }
    ] },
    { section: 'Business', items: [
      { icon: '💶', label: 'Sales & Revenue', href: basePath + 'pages/sales-revenue.html', key: 'sales-revenue.html' },
      { icon: '📄', label: 'Reports', href: basePath + 'pages/reports.html', key: 'reports.html' }
    ] },
    { section: 'Account', items: [
      { icon: '👤', label: 'Profile', href: basePath + 'pages/profile.html', key: 'profile.html' }
    ] }
  ];

  function userObject(): Record<string, any> {
    return window.ZentridAuth?.getUser?.() || {};
  }
  function claimsObject(): Record<string, any> {
    return window.ZentridAuth?.getSession?.()?.claims || {};
  }
  function currentUser(): string {
    const user = userObject(); const claims = claimsObject();
    return user.fullName || user.full_name || user.name || claims.name || claims.unique_name || user.username || 'End User';
  }
  function currentEmail(): string {
    const user = userObject(); const claims = claimsObject();
    return user.email || claims.email || claims.unique_name || 'Email not available';
  }
  function initials(): string {
    return currentUser().split(/\s+/).filter(Boolean).slice(0,2).map(part => part[0]).join('').toUpperCase() || 'EU';
  }
  function plantName(): string {
    const user = userObject(); const claims = claimsObject();
    return user.plantName || user.plant_name || claims.plant_name || localStorage.getItem('zentrid_end_user_plant') || 'Plant not available';
  }
  const state = { plant: plantName(), user: currentUser() };
  if (state.plant !== 'Plant not available') localStorage.setItem('zentrid_end_user_plant', state.plant);

  function sidebar(): string {
    return `<aside class="sidebar" id="sidebar">
      <button class="brand" type="button" data-route="overview">
        <div class="brand-mark">Z</div>
        <div><div class="brand-name">Zentrid</div><div class="brand-subtitle">Owner & End User Portal</div></div>
      </button>
      <nav class="side-nav">
        ${nav.map(group => `<div class="nav-group"><div class="nav-section">${group.section}</div>${group.items.map(item => `<a class="nav-item ${current === item.key ? 'active' : ''}" href="${item.href}"><span class="nav-icon">${item.icon}</span><span>${item.label}</span></a>`).join('')}</div>`).join('')}
      </nav>
    </aside>`;
  }

  function header(): string {
    return `<header class="topbar">
      <div class="topbar-left">
        <button class="icon-btn" id="toggleSidebar" type="button" aria-label="Toggle navigation">☰</button>
        <button class="plant-context" type="button" data-route="plant" title="Open your plant">
          <span>My Plant</span><strong>${state.plant}</strong>
        </button>
      </div>
      <div class="topbar-actions">
        <button class="context-pill help-button" type="button" id="helpBtn">❔ <span>Need help?</span></button>
        <div class="menu-wrap">
          <button class="notification-btn" id="notifyBtn" type="button" aria-label="Notifications">🔔<span>0</span></button>
          <div class="dropdown-menu" id="notifyMenu">
            <div class="dropdown-title">Notifications</div>
            <div class="owner-topbar-empty-notice"><strong>No live notification feed</strong><small>Notification API is not part of the current End User contract.</small></div>
          </div>
        </div>
        <div class="menu-wrap">
          <button class="profile-btn" id="profileBtn" type="button"><span class="avatar">${initials()}</span><span>${currentUser()}</span> ▾</button>
          <div class="dropdown-menu" id="profileMenu">
            <div class="profile-summary"><strong>${currentUser()}</strong><small>${currentEmail()}</small></div>
            <button type="button" data-route="profile">Profile & Preferences</button>
            <button type="button" data-action="logout">Sign out</button>
          </div>
        </div>
      </div>
    </header>`;
  }

  function pathFor(route: string): string {
    const routes: Record<string,string> = {
      overview: basePath + 'index.html',
      plant: basePath + 'pages/my-plant.html',
      devices: basePath + 'pages/devices.html',
      'device-detail': basePath + 'pages/device-detail.html',
      alerts: basePath + 'pages/alerts.html',
      'alert-detail': basePath + 'pages/alert-detail.html',
      energy: basePath + 'pages/energy.html',
      revenue: basePath + 'pages/sales-revenue.html',
      reports: basePath + 'pages/reports.html',
      profile: basePath + 'pages/profile.html'
    };
    return routes[route] || routes.overview!;
  }

  function toast(message: string, tone = 'info'): void {
    let toast = document.getElementById('endUserToast');
    if (!toast) { toast = document.createElement('div'); toast.id = 'endUserToast'; toast.className = 'toast'; document.body.appendChild(toast); }
    toast.textContent = message; toast.className = `toast ${tone}`; requestAnimationFrame(() => toast?.classList.add('show'));
    window.clearTimeout(window.__endUserToastTimer);
    window.__endUserToastTimer = window.setTimeout(() => toast?.classList.remove('show'), 3200);
  }

  function closeMenus(): void {
    document.querySelectorAll('.dropdown-menu.open').forEach(menu => menu.classList.remove('open'));
  }
  function wire(): void {
    document.getElementById('toggleSidebar')?.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
    const pairs: Array<[HTMLElement | null, HTMLElement | null]> = [
      [document.getElementById('notifyBtn'), document.getElementById('notifyMenu')],
      [document.getElementById('profileBtn'), document.getElementById('profileMenu')]
    ];
    pairs.forEach(([button, menu]) => button?.addEventListener('click', event => {
      event.stopPropagation(); const wasOpen = menu?.classList.contains('open'); closeMenus(); if (!wasOpen) menu?.classList.add('open');
    }));
    document.addEventListener('click', event => {
      const target = endUserTarget(event);
      if (!target?.closest('.menu-wrap')) closeMenus();
      const route = target?.closest<HTMLElement>('[data-route]');
      if (route) { event.preventDefault(); window.location.href = pathFor(route.dataset.route || 'overview'); }
      const action = target?.closest<HTMLElement>('[data-action]');
      if (action?.dataset.action === 'logout') { window.ZentridAuth?.logout?.(); window.location.href = basePath + 'login.html'; }
    });
    document.getElementById('helpBtn')?.addEventListener('click', () => toast('Use your organization support channel and include the relevant device or alert reference.', 'info'));
    window.addEventListener('resize', () => { if (window.innerWidth > 760) document.body.classList.remove('sidebar-open'); });
  }

  function mount(html: string): void {
    document.body.classList.add('end-user-workspace');
    document.body.dataset.zentridWorkspace = 'end-user';
    const app = document.getElementById('app');
    if (!app) throw new Error('Zentrid End User app root not found.');
    app.innerHTML = `${sidebar()}<div class="workspace">${header()}<main class="main-content end-user-page">${html}</main></div>`;
    wire();
  }
  return { mount, pathFor, toast, state };
})();
window.ZentridEndUserLayout = ZentridEndUserLayout;
