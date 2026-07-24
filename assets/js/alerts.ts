(() => {
  type OwnerAlertRecord = {
    id:string; title:string; severity:'Critical'|'Warning'|'Information'; status:'Open'|'Monitoring'|'Resolved';
    plantName:string; deviceId:string; deviceName:string; detected:string; updated:string; summary:string;
    explanation:string; ownerAction:string; operationsStatus:string; productionImpact:string; revenueImpact:string;
    estimatedLoss:string; supportReference:string; timeline:Array<{time:string;title:string;detail:string}>;
  };

  const model = window.ZentridEndUserAlertModel;
  let alerts: OwnerAlertRecord[] = [];
  let search = '';
  let statusFilter = '';
  let severityFilter = '';

  function escapeValue(value: unknown): string {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character] || character));
  }

  function filtered(): OwnerAlertRecord[] {
    const query = search.trim().toLowerCase();
    return alerts.filter(alert => {
      const haystack = `${alert.id} ${alert.title} ${alert.deviceName} ${alert.plantName} ${alert.summary}`.toLowerCase();
      return (!query || haystack.includes(query)) && (!statusFilter || alert.status === statusFilter) && (!severityFilter || alert.severity === severityFilter);
    });
  }

  function counts(): { active:number; critical:number; monitoring:number; resolved:number } {
    return {
      active: alerts.filter(alert => alert.status === 'Open').length,
      critical: alerts.filter(alert => alert.status === 'Open' && alert.severity === 'Critical').length,
      monitoring: alerts.filter(alert => alert.status === 'Monitoring').length,
      resolved: alerts.filter(alert => alert.status === 'Resolved').length
    };
  }

  function statusBanner(): string {
    const summary = counts();
    if (summary.critical) return `<section class="owner-status-card danger owner-alerts-status"><div class="owner-status-icon">!</div><div class="owner-status-copy"><p class="eyebrow">System Status</p><h2>${summary.critical} critical issue${summary.critical === 1 ? '' : 's'} need attention</h2><p>The operations team can see the same issue. Open the alert for a plain-language explanation and the latest response status.</p></div><button class="secondary-action owner-status-action" type="button" data-owner-alert-status="Open">View Active Issues</button></section>`;
    if (summary.active) return `<section class="owner-status-card warning owner-alerts-status"><div class="owner-status-icon">⚠</div><div class="owner-status-copy"><p class="eyebrow">System Status</p><h2>${summary.active} active issue${summary.active === 1 ? '' : 's'}</h2><p>Your plant is still visible in Zentrid. Review the issue details and the actions already being taken by the operations team.</p></div><button class="secondary-action owner-status-action" type="button" data-owner-alert-status="Open">View Active Issues</button></section>`;
    return `<section class="owner-status-card owner-alerts-status"><div class="owner-status-icon">✓</div><div class="owner-status-copy"><p class="eyebrow">System Status</p><h2>No active issues</h2><p>Your plant and devices are currently operating without owner-relevant errors. Recent events remain available below for transparency.</p></div><button class="secondary-action owner-status-action" type="button" data-route="plant">Open My Plant</button></section>`;
  }

  function alertCard(alert: OwnerAlertRecord): string {
    const severityTone = model.tone(alert.severity);
    const statusTone = model.tone(alert.status);
    return `<article class="owner-alert-card ${statusTone}" data-alert-id="${escapeValue(alert.id)}">
      <div class="owner-alert-card-icon ${severityTone}">${model.icon(alert.severity)}</div>
      <div class="owner-alert-card-main">
        <div class="owner-alert-card-heading"><div><p class="eyebrow">${escapeValue(alert.plantName)} · ${escapeValue(alert.deviceName)}</p><h3>${escapeValue(alert.title)}</h3></div><div class="owner-alert-badges"><span class="badge ${severityTone}">${escapeValue(alert.severity)}</span><span class="badge ${statusTone}">${escapeValue(alert.status)}</span></div></div>
        <p class="owner-alert-summary">${escapeValue(alert.summary)}</p>
        <div class="owner-alert-impact-grid">
          <div><span>Production Impact</span><strong>${escapeValue(alert.productionImpact)}</strong></div>
          <div><span>Revenue Impact</span><strong>${escapeValue(alert.revenueImpact)}</strong></div>
          <div><span>Operations Status</span><strong>${escapeValue(alert.operationsStatus)}</strong></div>
        </div>
        <div class="owner-alert-card-footer"><small>Detected ${escapeValue(alert.detected)} · Updated ${escapeValue(alert.updated)}</small><button class="secondary-action" type="button" data-open-owner-alert="${escapeValue(alert.id)}">View Details</button></div>
      </div>
    </article>`;
  }

  function listMarkup(): string {
    const rows = filtered();
    if (!rows.length) return `<div class="owner-positive-state owner-alert-empty"><div><div class="icon">✓</div><h3>No alerts match your filters</h3><p>Clear the filters to see recent plant events.</p><button class="secondary-action" id="clearOwnerAlertFilters" type="button">Clear Filters</button></div></div>`;
    return rows.map(alertCard).join('');
  }

  function renderPage(): string {
    const summary = counts();
    return `<section class="page-hero owner-alerts-hero"><div><p class="eyebrow">My Plant</p><h1>Alerts</h1><p class="friendly-note">Clear, owner-friendly explanations of plant issues and the latest response from your operations team.</p></div><button class="freshness-card" type="button" data-route="plant"><span class="pulse"></span><div><strong>Alert view is current</strong><small>Live API data only</small></div></button></section>
      <div id="ownerAlertsStatus">${statusBanner()}</div>
      <section class="kpi-grid owner-alert-kpi-grid">
        <article class="kpi-card red"><div class="kpi-icon">!</div><div class="kpi-label">Active Issues</div><div class="kpi-value" id="ownerActiveAlertCount">${summary.active}</div><div class="kpi-delta">Open owner-relevant alerts</div></article>
        <article class="kpi-card yellow"><div class="kpi-icon">⚠</div><div class="kpi-label">Critical</div><div class="kpi-value" id="ownerCriticalAlertCount">${summary.critical}</div><div class="kpi-delta">Immediate attention needed</div></article>
        <article class="kpi-card violet"><div class="kpi-icon">◉</div><div class="kpi-label">Monitoring</div><div class="kpi-value" id="ownerMonitoringAlertCount">${summary.monitoring}</div><div class="kpi-delta">Conditions being watched</div></article>
        <article class="kpi-card green"><div class="kpi-icon">✓</div><div class="kpi-label">Resolved</div><div class="kpi-value" id="ownerResolvedAlertCount">${summary.resolved}</div><div class="kpi-delta">Recent events closed</div></article>
      </section>
      <section class="panel glass-card owner-alerts-panel">
        <div class="panel-head"><div><h2>Plant Issues & History</h2><p>Search active issues and recently resolved events.</p></div><button class="secondary-action" type="button" id="exportOwnerAlerts">Export Summary</button></div>
        <div class="owner-alert-toolbar">
          <input id="ownerAlertSearch" type="search" placeholder="Search issue, device or reference..." aria-label="Search alerts" />
          <select id="ownerAlertStatusFilter" aria-label="Filter by status"><option value="">All statuses</option><option>Open</option><option>Monitoring</option><option>Resolved</option></select>
          <select id="ownerAlertSeverityFilter" aria-label="Filter by severity"><option value="">All severities</option><option>Critical</option><option>Warning</option><option>Information</option></select>
        </div>
        <div class="owner-alert-list-v14" id="ownerAlertList">${listMarkup()}</div>
      </section>
      <section class="owner-alert-help-grid">
        <article class="panel glass-card"><div class="panel-head"><div><h2>What happens when an issue appears?</h2><p>Zentrid shares the same alert with your operations team.</p></div></div><div class="owner-alert-process"><div><b>1</b><strong>Issue detected</strong><small>Plant or device behavior is checked against normal operation.</small></div><div><b>2</b><strong>Operations notified</strong><small>The responsible team receives the technical details.</small></div><div><b>3</b><strong>You stay informed</strong><small>This portal shows the impact and current response in plain language.</small></div></div></article>
        <article class="panel glass-card owner-alert-support-card"><p class="eyebrow">Need clarification?</p><h2>Contact Support</h2><p>You do not need to troubleshoot technical equipment yourself. Contact support with the alert reference and your plant name.</p><div class="information-grid owner-alert-support-grid"><div><span>Support Email</span><strong>support@zentrid.example</strong></div><div><span>Your Plant</span><strong>${escapeValue(window.ZentridEndUserLayout.state.plant)}</strong></div></div><button class="primary-action" type="button" id="contactOwnerSupport">Contact Support</button></article>
      </section>`;
  }

  function refresh(): void {
    const summary = counts();
    const values: Record<string,string> = {
      ownerActiveAlertCount:String(summary.active), ownerCriticalAlertCount:String(summary.critical),
      ownerMonitoringAlertCount:String(summary.monitoring), ownerResolvedAlertCount:String(summary.resolved)
    };
    Object.entries(values).forEach(([id,value]) => { const element = document.getElementById(id); if (element) element.textContent = value; });
    const status = document.getElementById('ownerAlertsStatus'); if (status) status.innerHTML = statusBanner();
    const list = document.getElementById('ownerAlertList'); if (list) list.innerHTML = listMarkup();
  }

  function openAlert(id: string): void {
    const alert = alerts.find(item => item.id === id); if (!alert) return;
    window.location.href = `${window.ZentridEndUserLayout.pathFor('alert-detail')}?id=${encodeURIComponent(alert.id)}`;
  }

  function clearFilters(): void {
    search = ''; statusFilter = ''; severityFilter = '';
    const searchInput = document.getElementById('ownerAlertSearch') as HTMLInputElement | null;
    const statusSelect = document.getElementById('ownerAlertStatusFilter') as HTMLSelectElement | null;
    const severitySelect = document.getElementById('ownerAlertSeverityFilter') as HTMLSelectElement | null;
    if (searchInput) searchInput.value = ''; if (statusSelect) statusSelect.value = ''; if (severitySelect) severitySelect.value = '';
    refresh();
  }

  function exportSummary(): void {
    const headers = ['Alert ID','Title','Severity','Status','Plant','Device','Detected','Production Impact','Revenue Impact','Operations Status'];
    const rows = filtered().map(alert => [alert.id,alert.title,alert.severity,alert.status,alert.plantName,alert.deviceName,alert.detected,alert.productionImpact,alert.revenueImpact,alert.operationsStatus]);
    const csv = [headers,...rows].map(row => row.map(value => `"${String(value).replace(/"/g,'""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'zentrid-owner-alerts.csv'; anchor.click(); URL.revokeObjectURL(url);
  }

  function wire(): void {
    document.getElementById('ownerAlertSearch')?.addEventListener('input', event => { search = (event.target as HTMLInputElement).value; refresh(); });
    document.getElementById('ownerAlertStatusFilter')?.addEventListener('change', event => { statusFilter = (event.target as HTMLSelectElement).value; refresh(); });
    document.getElementById('ownerAlertSeverityFilter')?.addEventListener('change', event => { severityFilter = (event.target as HTMLSelectElement).value; refresh(); });
    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      const open = target?.closest<HTMLElement>('[data-open-owner-alert]'); if (open?.dataset.openOwnerAlert) openAlert(open.dataset.openOwnerAlert);
      const status = target?.closest<HTMLElement>('[data-owner-alert-status]'); if (status?.dataset.ownerAlertStatus) { statusFilter = status.dataset.ownerAlertStatus; const select = document.getElementById('ownerAlertStatusFilter') as HTMLSelectElement | null; if (select) select.value = statusFilter; refresh(); document.getElementById('ownerAlertList')?.scrollIntoView({ behavior:'smooth', block:'start' }); }
      if (target?.closest('#clearOwnerAlertFilters')) clearFilters();
    });
    document.getElementById('exportOwnerAlerts')?.addEventListener('click', exportSummary);
    document.getElementById('contactOwnerSupport')?.addEventListener('click', () => { window.location.href = `mailto:support@zentrid.example?subject=${encodeURIComponent('Zentrid support request — ' + window.ZentridEndUserLayout.state.plant)}`; });
  }

  async function enrich(): Promise<void> {
    const api = window.ZentridEndUserAPI;
    const rows = await api?.alerts?.();
    const normalized = Array.isArray(rows) ? model.normalizeRows(rows) as OwnerAlertRecord[] : [];
    alerts = normalized.filter(alert => Boolean(alert.id.trim()));
    refresh();

    const state = api?.getState?.('alerts');
    if (state?.state === 'error') {
      window.ZentridEndUserLayout.toast('Live alerts are temporarily unavailable.', 'warning');
    } else if (state?.state === 'cached') {
      window.ZentridEndUserLayout.toast('Showing the latest saved API response.', 'warning');
    }
  }

  window.ZentridEndUserLayout.mount(renderPage());
  wire();
  void enrich();
})();
