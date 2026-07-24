(() => {
  type OwnerAlertSeverity = 'Critical' | 'Warning' | 'Information' | 'Unknown';
  type OwnerAlertStatus = 'Open' | 'Monitoring' | 'Resolved' | 'Unknown';
  type OwnerAlertRecord = {
    id:string; title:string; severity:OwnerAlertSeverity; status:OwnerAlertStatus;
    plantName:string; deviceId:string; deviceName:string; detected:string; updated:string; summary:string;
    explanation:string; ownerAction:string; operationsStatus:string; productionImpact:string; revenueImpact:string;
    estimatedLoss:string; supportReference:string; supportEmail:string;
    timeline:Array<{time:string;title:string;detail:string}>;
  };
  type DetailState = 'loading' | 'live' | 'cached' | 'empty' | 'error';

  const model = window.ZentridEndUserAlertModel;
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get('id')?.trim() || '';
  let alert: OwnerAlertRecord | null = null;
  let detailState: DetailState = 'loading';

  function escapeValue(value: unknown): string {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character] || character));
  }

  function display(value: unknown): string {
    const normalized = String(value ?? '').trim();
    return normalized || '—';
  }

  function placeholder(): OwnerAlertRecord {
    const isLoading = detailState === 'loading';
    return {
      id: requestedId,
      title: isLoading ? 'Loading alert…' : 'Alert unavailable',
      severity: 'Unknown',
      status: 'Unknown',
      plantName: '',
      deviceId: '',
      deviceName: '',
      detected: '',
      updated: '',
      summary: isLoading ? 'Loading live alert data from the API.' : 'No API alert record is available for this reference.',
      explanation: '',
      ownerAction: '',
      operationsStatus: '',
      productionImpact: '',
      revenueImpact: '',
      estimatedLoss: '',
      supportReference: '',
      supportEmail: '',
      timeline: []
    };
  }

  function currentAlert(): OwnerAlertRecord {
    return alert || placeholder();
  }

  function openRelatedDevice(): void {
    const current = currentAlert();
    if (!alert || !current.deviceId) {
      window.ZentridEndUserLayout.toast('No related device was returned by the API.', 'info');
      return;
    }
    window.location.href = `${window.ZentridEndUserLayout.pathFor('device-detail')}?id=${encodeURIComponent(current.deviceId)}`;
  }

  function timelineMarkup(current: OwnerAlertRecord): string {
    if (!current.timeline.length) {
      return `<div class="owner-positive-state owner-alert-empty"><div><div class="icon">i</div><h3>No response timeline available</h3><p>The alert API did not return owner-visible timeline events.</p></div></div>`;
    }
    return current.timeline.map((item,index) => `<article class="owner-alert-timeline-item ${index === current.timeline.length - 1 ? 'latest' : ''}"><div class="owner-alert-timeline-dot"></div><div><small>${escapeValue(display(item.time))}</small><strong>${escapeValue(display(item.title))}</strong><p>${escapeValue(display(item.detail))}</p></div></article>`).join('');
  }

  function freshnessCopy(current: OwnerAlertRecord): { strong:string; small:string } {
    if (detailState === 'loading') return { strong:'Loading', small:'Requesting live alert data' };
    if (detailState === 'cached') return { strong:display(current.status), small:'Latest saved API response' };
    if (detailState === 'error') return { strong:'Unavailable', small:'Alert API request failed' };
    if (detailState === 'empty') return { strong:'Not found', small:'No matching API record' };
    return { strong:display(current.status), small:`Updated ${display(current.updated)}` };
  }

  function renderPage(): string {
    const current = currentAlert();
    const severityTone = model.tone(current.severity);
    const statusTone = model.tone(current.status);
    const icon = model.icon(current.status);
    const freshness = freshnessCopy(current);
    const canOpenDevice = Boolean(alert && current.deviceId);
    const canContactSupport = Boolean(alert && current.supportEmail);

    return `<section class="page-hero owner-alert-detail-hero"><div><button class="owner-back-link" type="button" data-route="alerts">← Back to Alerts</button><p class="eyebrow">${escapeValue(display(current.plantName))} · ${escapeValue(display(current.deviceName))}</p><h1>${escapeValue(display(current.title))}</h1><p class="friendly-note">Reference ${escapeValue(display(current.id))} · Detected ${escapeValue(display(current.detected))}</p></div><button class="freshness-card" type="button" data-route="alerts"><span class="pulse ${current.status === 'Open' ? 'offline' : ''}"></span><div><strong>${escapeValue(freshness.strong)}</strong><small>${escapeValue(freshness.small)}</small></div></button></section>
      <section class="owner-status-card owner-alert-detail-status ${statusTone}"><div class="owner-status-icon">${icon}</div><div class="owner-status-copy"><p class="eyebrow">Current Status</p><h2>${escapeValue(display(current.status))}</h2><p>${escapeValue(display(current.summary))}</p></div><span class="badge ${severityTone} owner-alert-detail-severity">${escapeValue(display(current.severity))}</span></section>
      <section class="kpi-grid owner-alert-detail-kpis">
        <article class="kpi-card yellow"><div class="kpi-icon">⚡</div><div class="kpi-label">Production Impact</div><div class="kpi-value owner-alert-kpi-text">${escapeValue(display(current.productionImpact))}</div><div class="kpi-delta">Estimated energy effect</div></article>
        <article class="kpi-card green"><div class="kpi-icon">€</div><div class="kpi-label">Revenue Impact</div><div class="kpi-value owner-alert-kpi-text">${escapeValue(display(current.revenueImpact))}</div><div class="kpi-delta">${escapeValue(display(current.estimatedLoss))}</div></article>
        <article class="kpi-card cyan"><div class="kpi-icon">◉</div><div class="kpi-label">Operations Status</div><div class="kpi-value owner-alert-kpi-text">${escapeValue(display(current.operationsStatus))}</div><div class="kpi-delta">Technical response information from the API</div></article>
        <article class="kpi-card violet"><div class="kpi-icon">#</div><div class="kpi-label">Support Reference</div><div class="kpi-value owner-alert-kpi-text">${escapeValue(display(current.supportReference))}</div><div class="kpi-delta">Reference returned by the API</div></article>
      </section>
      <section class="owner-alert-detail-grid">
        <article class="panel glass-card owner-alert-explanation-card"><div class="panel-head"><div><h2>What happened?</h2><p>A plain-language explanation for the plant owner.</p></div><span class="badge ${statusTone}">${escapeValue(display(current.status))}</span></div><p class="owner-alert-explanation">${escapeValue(display(current.explanation))}</p><div class="owner-alert-owner-action"><span>✓</span><div><strong>What you should do</strong><p>${escapeValue(display(current.ownerAction))}</p></div></div></article>
        <article class="panel glass-card"><div class="panel-head"><div><h2>Related Equipment</h2><p>The plant object connected to this event.</p></div></div><div class="information-grid owner-alert-related-grid"><div><span>Plant</span><strong>${escapeValue(display(current.plantName))}</strong><small>Returned by API</small></div><div><span>Device</span><strong>${escapeValue(display(current.deviceName))}</strong><small>${escapeValue(display(current.deviceId))}</small></div><div><span>Detected</span><strong>${escapeValue(display(current.detected))}</strong><small>First owner-visible occurrence</small></div><div><span>Last Update</span><strong>${escapeValue(display(current.updated))}</strong><small>Latest API information</small></div></div><div class="owner-alert-related-actions"><button class="secondary-action" type="button" data-route="plant">Open My Plant</button><button class="secondary-action" type="button" id="openRelatedAlertDevice" ${canOpenDevice ? '' : 'disabled'}>Open Device</button></div></article>
      </section>
      <section class="owner-alert-detail-grid owner-alert-detail-lower">
        <article class="panel glass-card"><div class="panel-head"><div><h2>Response Timeline</h2><p>Important owner-visible milestones only.</p></div></div><div class="owner-alert-timeline">${timelineMarkup(current)}</div></article>
        <article class="panel glass-card owner-alert-support-detail"><p class="eyebrow">Support</p><h2>You are not expected to troubleshoot plant equipment</h2><p>Your operations team receives the technical data. Contact support only when you need clarification or want to provide additional information.</p><div class="information-grid owner-alert-support-detail-grid"><div><span>Reference</span><strong>${escapeValue(display(current.supportReference))}</strong></div><div><span>Support Email</span><strong>${escapeValue(display(current.supportEmail))}</strong></div></div><button class="primary-action" type="button" id="contactAlertSupport" ${canContactSupport ? '' : 'disabled'}>Contact Support</button></article>
      </section>
      <section class="panel glass-card owner-alert-detail-actions"><div><h2>Continue exploring</h2><p>Return to alerts, review your plant, or see your energy and sales results.</p></div><div><button class="secondary-action" type="button" data-route="alerts">All Alerts</button><button class="secondary-action" type="button" data-route="energy">Energy</button><button class="primary-action" type="button" data-route="revenue">Sales & Revenue</button></div></section>`;
  }

  function wire(): void {
    document.getElementById('openRelatedAlertDevice')?.addEventListener('click', openRelatedDevice);
    document.getElementById('contactAlertSupport')?.addEventListener('click', () => {
      const current = currentAlert();
      if (!alert || !current.supportEmail) {
        window.ZentridEndUserLayout.toast('No support email was returned by the API.', 'info');
        return;
      }
      const subject = `Zentrid alert ${current.id} — ${display(current.plantName)}`;
      const body = `Hello Zentrid Support,\n\nI would like more information about alert ${current.id}: ${display(current.title)}.\nPlant: ${display(current.plantName)}\nDevice: ${display(current.deviceName)}\n\nThank you.`;
      window.location.href = `mailto:${encodeURIComponent(current.supportEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
  }

  function remount(): void {
    window.ZentridEndUserLayout.mount(renderPage());
    wire();
  }

  async function loadAlert(): Promise<void> {
    if (!requestedId) {
      detailState = 'empty';
      remount();
      return;
    }

    const api = window.ZentridEndUserAPI;
    const rows = await api?.alerts?.();
    const normalized = Array.isArray(rows) ? model.normalizeRows(rows) as OwnerAlertRecord[] : [];
    alert = normalized.find(item => item.id === requestedId)
      || normalized.find(item => item.id.toLowerCase() === requestedId.toLowerCase())
      || null;

    const resourceState = api?.getState?.('alerts');
    if (alert) {
      detailState = resourceState?.state === 'cached' ? 'cached' : 'live';
      if (detailState === 'cached') window.ZentridEndUserLayout.toast('Showing the latest saved API response.', 'warning');
    } else if (resourceState?.state === 'error') {
      detailState = 'error';
      window.ZentridEndUserLayout.toast('Live alert details are temporarily unavailable.', 'warning');
    } else {
      detailState = 'empty';
    }
    remount();
  }

  remount();
  void loadAlert();
})();
