(() => {
  type OwnerDeviceStatus = 'Online'|'Needs Attention'|'Offline'|'Unavailable';
  type OwnerDeviceRecord = {
    id: string; name: string; type: string; status: OwnerDeviceStatus; statusMessage: string;
    plantName: string; vendor: string; model: string; serial: string; location: string; updated: string;
    primaryLabel: string; primaryValue: string; secondaryLabel: string; secondaryValue: string;
    connectivity: string; description: string; readings: Array<{label:string;value:string;note:string}>;
  };
  type OwnerIssue = { title:string; message:string; severity:'warning'|'danger'; detected:string };
  type DeviceLoadState = 'loading'|'live'|'cached'|'empty'|'error';
  type AlertLoadState = 'loading'|'live'|'cached'|'empty'|'error';

  const model = window.ZentridEndUserDeviceModel;
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get('id')?.trim() || '';
  let device: OwnerDeviceRecord | null = null;
  let issues: OwnerIssue[] = [];
  let loadState: DeviceLoadState = 'loading';
  let alertLoadState: AlertLoadState = 'loading';
  let loadMessage = '';
  let fetchedAt = '';

  function escapeValue(value: unknown): string {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character] || character));
  }

  function apiText(row: Record<string, any>, keys: string[]): string {
    for (const key of keys) {
      const value = row?.[key];
      if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
    }
    return '';
  }

  function rawPrimitiveValues(value: unknown, output = new Set<string>()): Set<string> {
    if (Array.isArray(value)) value.forEach(item => rawPrimitiveValues(item, output));
    else if (value && typeof value === 'object') Object.values(value as Record<string, unknown>).forEach(item => rawPrimitiveValues(item, output));
    else if (value !== undefined && value !== null) output.add(String(value).trim().toLowerCase());
    return output;
  }

  function normalizeApiStatus(value: string): OwnerDeviceStatus {
    const status = value.trim().toLowerCase();
    if (!status) return 'Unavailable';
    if (['offline','disconnected','fault','faulted','error','critical','failed'].some(token => status.includes(token))) return 'Offline';
    if (['warning','degraded','stale','delayed','attention','unknown'].some(token => status.includes(token))) return 'Needs Attention';
    if (['online','connected','active','normal','healthy','running','operational'].some(token => status.includes(token))) return 'Online';
    return 'Needs Attention';
  }

  function sanitizeDevice(normalized: OwnerDeviceRecord, row: Record<string, any>): OwnerDeviceRecord {
    const rawValues = rawPrimitiveValues(row);
    const rawStatus = apiText(row, ['status','state','connectivityStatus','operationalStatus','healthStatus']);
    const status = normalizeApiStatus(rawStatus);
    const id = apiText(row, ['id','deviceId','device_id','assetId','uuid']);
    const name = apiText(row, ['name','deviceName','device_name','displayName','assetName','title']) || id || 'Not provided';
    const rawType = apiText(row, ['type','deviceType','device_type','category','assetType','kind']);
    const rawDescription = apiText(row, ['description','deviceDescription','purpose','summary']);
    const rawStatusMessage = apiText(row, ['statusMessage','healthMessage','statusDescription','stateDescription']);
    const replaceSynthetic = (value: string): string => {
      const normalizedValue = value.trim().toLowerCase();
      if (['available','reporting normally','online','recent'].includes(normalizedValue) && !rawValues.has(normalizedValue)) return 'Not available';
      return value || 'Not available';
    };
    const statusMessage = rawStatusMessage || (!rawStatus
      ? 'The API did not provide a device status.'
      : status === 'Offline'
        ? 'This device is not currently reporting. The operations team can see the same issue.'
        : status === 'Needs Attention'
          ? 'This device is reporting a status that needs attention.'
          : 'This device is operating and reporting normally.');
    return {
      ...normalized,
      id,
      name,
      type: rawType ? normalized.type : 'Not provided',
      status,
      statusMessage,
      plantName: apiText(row, ['plantName','plant_name','siteName','site_name','plant']) || 'Not provided',
      vendor: apiText(row, ['vendor','manufacturer','provider']) || 'Not provided',
      model: apiText(row, ['model','modelName','deviceModel']) || 'Not provided',
      serial: apiText(row, ['serial','serialNumber','sn','deviceSn']) || 'Not provided',
      location: apiText(row, ['location','installLocation','installationPoint']) || 'Not provided',
      updated: apiText(row, ['updatedAgo','lastUpdate','lastSeen','lastSeenAt','updatedAt','timestamp']) || 'Not provided',
      connectivity: apiText(row, ['connectivity','connectionStatus','networkStatus','communicationStatus']) || 'Not provided',
      description: rawDescription || 'Description not provided by API.',
      primaryValue: replaceSynthetic(normalized.primaryValue),
      secondaryValue: replaceSynthetic(normalized.secondaryValue),
      readings: normalized.readings.map(reading => ({ ...reading, value: replaceSynthetic(reading.value) }))
    };
  }

  function placeholderDevice(): OwnerDeviceRecord {
    const message = loadState === 'error'
      ? (loadMessage || 'The End User API could not provide device data.')
      : loadState === 'empty'
        ? 'The requested device was not returned by the End User API.'
        : 'Loading device data from the End User API.';
    return {
      id: requestedId || '—', name: '—', type: '—', status: 'Unavailable', statusMessage: message,
      plantName: '—', vendor: '—', model: '—', serial: '—', location: '—', updated: '—',
      primaryLabel: 'Current Reading', primaryValue: '—', secondaryLabel: 'Secondary Reading', secondaryValue: '—',
      connectivity: '—', description: '—',
      readings: [
        { label:'Current Reading', value:'—', note:'Waiting for API data' },
        { label:'Secondary Reading', value:'—', note:'Waiting for API data' },
        { label:'Device Metric', value:'—', note:'Waiting for API data' },
        { label:'Latest Value', value:'—', note:'Waiting for API data' }
      ]
    };
  }

  function activeDevice(): OwnerDeviceRecord { return device || placeholderDevice(); }

  function statusTone(value = activeDevice().status): string {
    if (value === 'Offline') return 'danger';
    if (value === 'Needs Attention') return 'warning';
    if (value === 'Online') return 'success';
    return 'neutral';
  }

  function statusIcon(value = activeDevice().status): string {
    if (loadState === 'loading') return '…';
    if (value === 'Offline') return '!';
    if (value === 'Needs Attention') return '⚠';
    if (value === 'Online') return '✓';
    return '—';
  }

  function freshnessTitle(current: OwnerDeviceRecord): string {
    if (loadState === 'live') return current.status === 'Offline' ? 'Device data reports offline' : 'Live device data connected';
    if (loadState === 'cached') return 'Cached API device data';
    if (loadState === 'empty') return 'Device not found';
    if (loadState === 'error') return 'Device data unavailable';
    return 'Loading device data';
  }

  function freshnessDetail(current: OwnerDeviceRecord): string {
    if (loadState === 'live' || loadState === 'cached') return current.updated !== 'Not provided' ? `Updated ${current.updated}` : (fetchedAt ? `Fetched ${new Date(fetchedAt).toLocaleString()}` : 'Update time not provided');
    if (loadState === 'error') return loadMessage || 'End User API request failed';
    if (loadState === 'empty') return requestedId ? `No API record for ${requestedId}` : 'Device ID is missing';
    return 'Waiting for End User API';
  }

  function readingsMarkup(current: OwnerDeviceRecord): string {
    return current.readings.slice(0,4).map(reading => `<div><span>${escapeValue(reading.label)}</span><strong>${escapeValue(reading.value)}</strong><small>${escapeValue(reading.note)}</small></div>`).join('');
  }

  function issueMarkup(current: OwnerDeviceRecord): string {
    if (alertLoadState === 'loading') return `<div class="owner-device-issue warning"><span>…</span><div><strong>Loading related issues</strong><p>Waiting for the End User Alerts API.</p><small>Only API-confirmed issues will be shown.</small></div></div>`;
    if (alertLoadState === 'error') return `<div class="owner-device-issue warning"><span>!</span><div><strong>Related issues unavailable</strong><p>The End User Alerts API could not provide linked alerts.</p><small>No local alert data is shown.</small></div></div>`;
    if (!issues.length && current.status === 'Online') return `<div class="owner-positive-state owner-device-positive-state"><div><div class="icon">✓</div><h3>No device issues</h3><p>No open owner-relevant alerts were returned for this device.</p></div></div>`;
    if (!issues.length && current.status !== 'Unavailable') return `<div class="owner-device-issue ${statusTone(current.status)}"><span>${statusIcon(current.status)}</span><div><strong>${escapeValue(current.status)}</strong><p>${escapeValue(current.statusMessage)}</p><small>Open Alerts for more information and support guidance.</small></div></div>`;
    if (!issues.length) return `<div class="owner-device-issue warning"><span>—</span><div><strong>No related alert data</strong><p>No open alert records were returned for this device.</p><small>Device status remains based on the device API response.</small></div></div>`;
    return `<div class="owner-device-issue-list">${issues.map(issue => `<article class="owner-device-issue ${issue.severity}"><span>${issue.severity === 'danger' ? '!' : '⚠'}</span><div><strong>${escapeValue(issue.title)}</strong><p>${escapeValue(issue.message)}</p><small>${escapeValue(issue.detected)}</small></div></article>`).join('')}</div>`;
  }

  function renderDetail(): string {
    const current = activeDevice();
    const tone = statusTone(current.status);
    const dataAvailability = device ? (current.status === 'Offline' ? 'Unavailable' : 'Available') : 'Not available';
    return `<section class="page-hero owner-device-detail-hero">
      <div><button class="owner-back-link" type="button" data-route="devices">← Back to Devices</button><p class="eyebrow">${escapeValue(current.type)}</p><h1>${escapeValue(current.name)}</h1><p class="friendly-note">${escapeValue(current.plantName)} · ${escapeValue(current.vendor)} ${escapeValue(current.model)}</p></div>
      <button class="freshness-card" type="button" data-route="plant"><span class="pulse ${loadState === 'error' || current.status === 'Offline' ? 'offline' : ''}"></span><div><strong>${escapeValue(freshnessTitle(current))}</strong><small>${escapeValue(freshnessDetail(current))}</small></div></button>
    </section>

    <section class="owner-status-card owner-device-detail-status ${tone}">
      <div class="owner-status-icon">${statusIcon(current.status)}</div>
      <div class="owner-status-copy"><p class="eyebrow">Device Status</p><h2>${escapeValue(current.status)}</h2><p>${escapeValue(current.statusMessage)}</p></div>
      <button class="secondary-action owner-status-action" type="button" data-route="alerts">View Alerts</button>
    </section>

    <section class="kpi-grid owner-device-detail-kpis">
      ${current.readings.slice(0,4).map((reading,index) => `<article class="kpi-card ${['cyan','green','yellow','violet'][index] || 'blue'}"><div class="kpi-icon">${model.icon(current.type)}</div><div class="kpi-label">${escapeValue(reading.label)}</div><div class="kpi-value">${escapeValue(reading.value)}</div><div class="kpi-delta">${escapeValue(reading.note)}</div></article>`).join('')}
    </section>

    <section class="owner-device-detail-grid">
      <article class="panel glass-card owner-device-overview-card">
        <div class="panel-head"><div><h2>Device Overview</h2><p>Owner-friendly identity and installation information.</p></div><span class="badge ${tone}">${escapeValue(current.status)}</span></div>
        <div class="information-grid owner-device-info-grid">
          <div><span>Device Name</span><strong>${escapeValue(current.name)}</strong><small>${escapeValue(current.id)}</small></div>
          <div><span>Device Type</span><strong>${escapeValue(current.type)}</strong><small>Equipment category</small></div>
          <div><span>Vendor & Model</span><strong>${escapeValue(current.vendor)}</strong><small>${escapeValue(current.model)}</small></div>
          <div><span>Serial Number</span><strong>${escapeValue(current.serial)}</strong><small>Read-only equipment identity</small></div>
          <div><span>Plant</span><strong>${escapeValue(current.plantName)}</strong><small>Your assigned solar asset</small></div>
          <div><span>Installation Point</span><strong>${escapeValue(current.location)}</strong><small>Physical plant location</small></div>
        </div>
      </article>

      <article class="panel glass-card owner-device-purpose-card">
        <div class="owner-device-purpose-icon">${model.icon(current.type)}</div>
        <p class="eyebrow">What this device does</p>
        <h2>${escapeValue(current.type)}</h2>
        <p>${escapeValue(current.description)}</p>
        <div class="owner-device-purpose-note"><strong>Managed by your operations team</strong><small>Configuration, firmware and remote controls are intentionally hidden from the owner portal.</small></div>
      </article>
    </section>

    <section class="owner-device-detail-grid owner-device-detail-lower">
      <article class="panel glass-card">
        <div class="panel-head"><div><h2>Current Readings</h2><p>The latest values available for this device.</p></div><span class="badge info">Read-only</span></div>
        <div class="information-grid owner-device-reading-grid">${readingsMarkup(current)}</div>
      </article>

      <article class="panel glass-card">
        <div class="panel-head"><div><h2>Data & Connectivity</h2><p>Simple communication and freshness information.</p></div></div>
        <div class="information-grid owner-device-connectivity-grid">
          <div><span>Connectivity</span><strong>${escapeValue(current.connectivity)}</strong><small>Current communication state</small></div>
          <div><span>Last Update</span><strong>${escapeValue(current.updated)}</strong><small>Age of latest reading</small></div>
          <div><span>Data Availability</span><strong>${escapeValue(dataAvailability)}</strong><small>Owner-level normalized data</small></div>
          <div><span>Support Visibility</span><strong>Shared</strong><small>Your operations team sees the same status</small></div>
        </div>
      </article>
    </section>

    <section class="panel glass-card owner-device-alerts-card">
      <div class="panel-head"><div><h2>Related Issues</h2><p>Plain-language alerts linked to this device.</p></div><button class="secondary-action" type="button" data-route="alerts">Open All Alerts</button></div>
      <div id="ownerDeviceIssues">${issueMarkup(current)}</div>
    </section>

    <section class="owner-device-detail-actions panel glass-card">
      <div><h2>Continue exploring</h2><p>Return to your equipment list or view plant energy and sales.</p></div>
      <div><button class="secondary-action" type="button" data-route="devices">All Devices</button><button class="secondary-action" type="button" data-route="energy">Energy</button><button class="primary-action" type="button" data-route="plant">My Plant</button></div>
    </section>`;
  }

  function updateContent(): void {
    const main = document.querySelector<HTMLElement>('.main-content');
    if (main) main.innerHTML = renderDetail();
  }

  function relatedAlert(row: Record<string, any>, current: OwnerDeviceRecord): boolean {
    const references = [
      apiText(row,['deviceId','device_id','assetId']),
      apiText(row,['deviceName','device_name','assetName','device'])
    ].map(value => value.toLowerCase()).filter(Boolean);
    if (!references.length) return false;
    return references.includes(current.id.toLowerCase()) || references.includes(current.name.toLowerCase());
  }

  function normalizeIssues(rows: Record<string, any>[], current: OwnerDeviceRecord): OwnerIssue[] {
    return rows.filter(row => relatedAlert(row, current) && !['resolved','closed','cleared'].includes(apiText(row,['status','state']).toLowerCase())).slice(0,3).map(row => {
      const severityValue = apiText(row,['severity','priority']).toLowerCase();
      return {
        title: apiText(row,['title','name','alertName','message']) || 'Device issue detected',
        message: apiText(row,['description','summary','message']) || 'An open issue is linked to this device.',
        severity: ['critical','high','p1','error'].some(value => severityValue.includes(value)) ? 'danger' as const : 'warning' as const,
        detected: apiText(row,['detectedAt','createdAt','timestamp','occurredAt']) || 'Detection time not provided'
      };
    });
  }

  async function loadDetail(): Promise<void> {
    const api = window.ZentridEndUserAPI;
    if (!requestedId) {
      loadState = 'empty';
      alertLoadState = 'empty';
      loadMessage = 'A device ID is required.';
      updateContent();
      return;
    }
    if (!api?.devices) {
      loadState = 'error';
      alertLoadState = 'error';
      loadMessage = 'The End User device API is not available.';
      updateContent();
      return;
    }

    try {
      const [deviceRows, alertRows] = await Promise.all([
        api.devices({ page:1, size:100 }),
        api.alerts?.() || Promise.resolve([])
      ]);
      const deviceMeta = api.getState?.('devices');
      const alertMeta = api.getState?.('alerts');
      fetchedAt = String(deviceMeta?.fetchedAt || '');
      loadMessage = String(deviceMeta?.error || '');
      const rows = Array.isArray(deviceRows) ? deviceRows as Record<string, any>[] : [];
      const requested = requestedId.toLowerCase();
      const match = rows.find(row => apiText(row, ['id','deviceId','device_id','assetId','uuid']).toLowerCase() === requested);

      if (match) {
        const normalized = (model.normalizeRows([match]) as OwnerDeviceRecord[])[0];
        device = normalized ? sanitizeDevice(normalized, match) : null;
        loadState = deviceMeta?.state === 'cached' ? 'cached' : 'live';
      } else {
        device = null;
        loadState = deviceMeta?.state === 'error' ? 'error' : 'empty';
        if (loadState === 'empty') loadMessage = `The End User API did not return device ${requestedId}.`;
      }

      if (alertMeta?.state === 'error') {
        alertLoadState = 'error';
        issues = [];
      } else {
        alertLoadState = alertMeta?.state === 'cached' ? 'cached' : Array.isArray(alertRows) && alertRows.length ? 'live' : 'empty';
        issues = device && Array.isArray(alertRows) ? normalizeIssues(alertRows as Record<string, any>[], device) : [];
      }

      if (device && issues.length && device.status === 'Online') {
        device = {
          ...device,
          status: issues.some(issue => issue.severity === 'danger') ? 'Offline' : 'Needs Attention',
          statusMessage: `${issues.length} open issue${issues.length === 1 ? '' : 's'} are linked to this device.`
        };
      }

      updateContent();
      if (loadState === 'cached') window.ZentridEndUserLayout.toast('Showing the latest cached device data from a previous successful API response.', 'warning');
      if (loadState === 'error') window.ZentridEndUserLayout.toast(loadMessage || 'Device data is temporarily unavailable.', 'warning');
    } catch (error) {
      device = null;
      issues = [];
      loadState = 'error';
      alertLoadState = 'error';
      loadMessage = String((error as { message?: unknown })?.message || 'The End User API could not provide device data.');
      updateContent();
      window.ZentridEndUserLayout.toast(loadMessage, 'warning');
    }
  }

  window.ZentridEndUserLayout.mount(renderDetail());
  void loadDetail();
})();
