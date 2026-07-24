(() => {
  type OwnerDeviceRecord = {
    id: string; name: string; type: string; status: 'Online'|'Needs Attention'|'Offline'; statusMessage: string;
    plantName: string; vendor: string; model: string; serial: string; location: string; updated: string;
    primaryLabel: string; primaryValue: string; secondaryLabel: string; secondaryValue: string;
    connectivity: string; description: string; readings: Array<{label:string;value:string;note:string}>;
  };
  type DeviceLoadState = 'loading'|'live'|'cached'|'empty'|'error';

  const model = window.ZentridEndUserDeviceModel;
  let devices: OwnerDeviceRecord[] = [];
  let loadState: DeviceLoadState = 'loading';
  let loadMessage = '';
  let fetchedAt = '';
  let search = '';
  let typeFilter = '';
  let statusFilter = '';

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

  function normalizeApiStatus(value: string): OwnerDeviceRecord['status'] {
    const status = value.trim().toLowerCase();
    if (!status) return 'Needs Attention';
    if (['offline','disconnected','fault','faulted','error','critical','failed'].some(token => status.includes(token))) return 'Offline';
    if (['warning','degraded','stale','delayed','attention','unknown'].some(token => status.includes(token))) return 'Needs Attention';
    if (['online','connected','active','normal','healthy','running','operational'].some(token => status.includes(token))) return 'Online';
    return 'Needs Attention';
  }

  function sanitizeDevice(device: OwnerDeviceRecord, row: Record<string, any>): OwnerDeviceRecord {
    const rawValues = rawPrimitiveValues(row);
    const rawStatus = apiText(row, ['status','state','connectivityStatus','operationalStatus','healthStatus']);
    const status = normalizeApiStatus(rawStatus);
    const id = apiText(row, ['id','deviceId','device_id','assetId','uuid']);
    const name = apiText(row, ['name','deviceName','device_name','displayName','assetName','title']) || id;
    const replaceSynthetic = (value: string): string => {
      const normalized = value.trim().toLowerCase();
      if (['available','reporting normally','online','recent'].includes(normalized) && !rawValues.has(normalized)) return 'Not available';
      return value || 'Not available';
    };
    const statusMessage = !rawStatus
      ? 'The API did not provide a device status.'
      : status === 'Offline'
        ? 'This device is not currently reporting. The operations team can see the same issue.'
        : status === 'Needs Attention'
          ? 'This device is reporting a status that needs attention.'
          : 'This device is operating and reporting normally.';
    return {
      ...device,
      id,
      name,
      status,
      statusMessage,
      plantName: apiText(row, ['plantName','plant_name','siteName','site_name','plant']) || 'Not provided',
      vendor: apiText(row, ['vendor','manufacturer','provider']) || 'Not provided',
      model: apiText(row, ['model','modelName','deviceModel']) || 'Not provided',
      serial: apiText(row, ['serial','serialNumber','sn','deviceSn']) || 'Not provided',
      location: apiText(row, ['location','installLocation','installationPoint']) || 'Not provided',
      updated: apiText(row, ['updatedAgo','lastUpdate','lastSeen','lastSeenAt','updatedAt','timestamp']) || 'Not provided',
      connectivity: apiText(row, ['connectivity','connectionStatus','networkStatus','communicationStatus']) || 'Not provided',
      primaryValue: replaceSynthetic(device.primaryValue),
      secondaryValue: replaceSynthetic(device.secondaryValue),
      readings: device.readings.map(reading => ({ ...reading, value: replaceSynthetic(reading.value) }))
    };
  }

  function filteredDevices(): OwnerDeviceRecord[] {
    const query = search.trim().toLowerCase();
    return devices.filter(device => {
      const matchesSearch = !query || [device.name,device.id,device.type,device.vendor,device.model,device.serial].some(value => value.toLowerCase().includes(query));
      const matchesType = !typeFilter || device.type === typeFilter;
      const matchesStatus = !statusFilter || device.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }

  function count(status: OwnerDeviceRecord['status']): number {
    return devices.filter(device => device.status === status).length;
  }

  function countText(value: number): string {
    return loadState === 'loading' || loadState === 'error' ? '—' : String(value);
  }

  function overallStatus(): { tone:string; title:string; message:string; icon:string } {
    if (loadState === 'loading') return { tone:'warning', title:'Loading Equipment', message:'Waiting for device data from the End User API.', icon:'…' };
    if (loadState === 'error') return { tone:'danger', title:'Device Data Unavailable', message:loadMessage || 'The End User API could not provide device data.', icon:'!' };
    if (loadState === 'empty') return { tone:'warning', title:'No Devices Returned', message:'The End User API returned no devices for this account.', icon:'i' };
    if (count('Offline')) return { tone:'danger', title:'Problem Detected', message:`${count('Offline')} device${count('Offline') === 1 ? '' : 's'} are not reporting. Your operations team can see the same issue.`, icon:'!' };
    if (count('Needs Attention')) return { tone:'warning', title:'Needs Attention', message:`${count('Needs Attention')} device${count('Needs Attention') === 1 ? '' : 's'} have delayed, unknown or incomplete status data.`, icon:'⚠' };
    return { tone:'success', title:'All Devices Online', message:'Your plant equipment is reporting normally.', icon:'✓' };
  }

  function typeOptions(): string {
    return Array.from(new Set(devices.map(device => device.type))).sort().map(type => `<option value="${escapeValue(type)}">${escapeValue(type)}</option>`).join('');
  }

  function cardMarkup(device: OwnerDeviceRecord): string {
    const tone = model.tone(device.status);
    return `<article class="owner-device-card" data-device-card="${escapeValue(device.id)}">
      <div class="owner-device-card-head">
        <span class="owner-device-card-icon">${model.icon(device.type)}</span>
        <span class="badge ${tone}">${escapeValue(device.status)}</span>
      </div>
      <div class="owner-device-card-copy"><p class="owner-device-type">${escapeValue(device.type)}</p><h3>${escapeValue(device.name)}</h3><small>${escapeValue(device.vendor)} · ${escapeValue(device.model)}</small></div>
      <div class="owner-device-card-readings">
        <div><span>${escapeValue(device.primaryLabel)}</span><strong>${escapeValue(device.primaryValue)}</strong></div>
        <div><span>${escapeValue(device.secondaryLabel)}</span><strong>${escapeValue(device.secondaryValue)}</strong></div>
      </div>
      <div class="owner-device-card-footer"><small>${escapeValue(device.updated)} · ${escapeValue(device.connectivity)}</small><button class="secondary-action single-row-action" type="button" data-open-device="${escapeValue(device.id)}">Open Device</button></div>
    </article>`;
  }

  function gridMarkup(): string {
    if (loadState === 'loading') return `<div class="owner-device-empty"><div class="icon">…</div><h3>Loading devices</h3><p>Waiting for the End User API response.</p></div>`;
    if (loadState === 'error') return `<div class="owner-device-empty"><div class="icon">!</div><h3>Device data unavailable</h3><p>${escapeValue(loadMessage || 'The End User API could not provide device data.')}</p></div>`;
    if (!devices.length) return `<div class="owner-device-empty"><div class="icon">i</div><h3>No devices available</h3><p>The End User API returned no devices for this account.</p></div>`;
    const rows = filteredDevices();
    if (!rows.length) return `<div class="owner-device-empty"><div class="icon">⌕</div><h3>No devices match these filters</h3><p>Clear a filter or search for another device name, serial number or type.</p><button class="secondary-action" type="button" id="clearDeviceFilters">Clear Filters</button></div>`;
    return rows.map(cardMarkup).join('');
  }

  function renderPage(): string {
    const health = overallStatus();
    return `<section class="page-hero owner-devices-hero">
      <div><p class="eyebrow">My Equipment</p><h1>Devices</h1><p class="friendly-note">A simple view of the equipment connected to ${escapeValue(window.ZentridEndUserLayout.state.plant)}.</p></div>
      <button class="freshness-card" type="button" data-route="plant"><span class="pulse"></span><div><strong>Loading equipment data</strong><small>Waiting for End User API</small></div></button>
    </section>

    <section class="owner-status-card owner-device-status ${health.tone}" id="ownerDeviceStatusCard">
      <div class="owner-status-icon" id="ownerDeviceStatusIcon">${health.icon}</div>
      <div class="owner-status-copy"><p class="eyebrow">Equipment Status</p><h2 id="ownerDeviceStatusTitle">${health.title}</h2><p id="ownerDeviceStatusMessage">${health.message}</p></div>
      <button class="secondary-action owner-status-action" type="button" data-route="alerts">View Alerts</button>
    </section>

    <section class="kpi-grid owner-device-kpi-grid">
      <article class="kpi-card cyan"><div class="kpi-icon">🔌</div><div class="kpi-label">Total Devices</div><div class="kpi-value" id="deviceTotalCount">${countText(devices.length)}</div><div class="kpi-delta">Assigned to your plant</div></article>
      <article class="kpi-card green"><div class="kpi-icon">✓</div><div class="kpi-label">Online</div><div class="kpi-value" id="deviceOnlineCount">${countText(count('Online'))}</div><div class="kpi-delta">Reporting normally</div></article>
      <article class="kpi-card yellow"><div class="kpi-icon">⚠</div><div class="kpi-label">Needs Attention</div><div class="kpi-value" id="deviceWarningCount">${countText(count('Needs Attention'))}</div><div class="kpi-delta">Delayed or incomplete data</div></article>
      <article class="kpi-card red"><div class="kpi-icon">!</div><div class="kpi-label">Offline</div><div class="kpi-value" id="deviceOfflineCount">${countText(count('Offline'))}</div><div class="kpi-delta">Not currently reporting</div></article>
    </section>

    <section class="panel glass-card owner-device-registry">
      <div class="panel-head"><div><h2>My Equipment</h2><p>Open a device for owner-friendly readings and status information.</p></div><span class="badge info">Read-only</span></div>
      <div class="owner-device-toolbar">
        <input id="ownerDeviceSearch" type="search" placeholder="Search device, model or serial..." aria-label="Search devices" />
        <select id="ownerDeviceTypeFilter" aria-label="Filter by device type"><option value="">All device types</option>${typeOptions()}</select>
        <select id="ownerDeviceStatusFilter" aria-label="Filter by status"><option value="">All statuses</option><option>Online</option><option>Needs Attention</option><option>Offline</option></select>
      </div>
      <div class="owner-device-card-grid" id="ownerDeviceGrid">${gridMarkup()}</div>
    </section>

    <section class="owner-device-help panel glass-card">
      <div><span class="owner-device-help-icon">i</span><div><h2>Simple owner view</h2><p>Configuration, firmware, vendor mapping and remote commands are managed by your operations team and are intentionally not shown here.</p></div></div>
      <button class="secondary-action" type="button" data-route="plant">Back to My Plant</button>
    </section>`;
  }

  function formatFetchedAt(value: string): string {
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return 'Update time not provided';
    return `Updated ${new Date(timestamp).toLocaleString()}`;
  }

  function refreshFreshness(): void {
    const card = document.querySelector<HTMLElement>('.freshness-card');
    const strong = card?.querySelector('strong');
    const small = card?.querySelector('small');
    const pulse = card?.querySelector<HTMLElement>('.pulse');
    pulse?.classList.toggle('offline', loadState === 'error');
    if (!strong || !small) return;
    if (loadState === 'live') { strong.textContent = 'Live device data connected'; small.textContent = formatFetchedAt(fetchedAt); return; }
    if (loadState === 'cached') { strong.textContent = 'Cached API device data'; small.textContent = formatFetchedAt(fetchedAt); return; }
    if (loadState === 'empty') { strong.textContent = 'No device data returned'; small.textContent = 'End User API returned an empty list'; return; }
    if (loadState === 'error') { strong.textContent = 'Device data unavailable'; small.textContent = loadMessage || 'End User API request failed'; return; }
    strong.textContent = 'Loading equipment data'; small.textContent = 'Waiting for End User API';
  }

  function refreshSummary(): void {
    const health = overallStatus();
    const card = document.getElementById('ownerDeviceStatusCard');
    card?.classList.remove('success','warning','danger');
    card?.classList.add(health.tone);
    const values: Record<string,string> = {
      ownerDeviceStatusIcon: health.icon,
      ownerDeviceStatusTitle: health.title,
      ownerDeviceStatusMessage: health.message,
      deviceTotalCount: countText(devices.length),
      deviceOnlineCount: countText(count('Online')),
      deviceWarningCount: countText(count('Needs Attention')),
      deviceOfflineCount: countText(count('Offline'))
    };
    Object.entries(values).forEach(([id,value]) => { const element = document.getElementById(id); if (element) element.textContent = value; });
    refreshFreshness();
  }

  function refreshGrid(): void {
    const grid = document.getElementById('ownerDeviceGrid');
    if (grid) grid.innerHTML = gridMarkup();
  }

  function refreshTypeOptions(): void {
    const typeSelect = document.getElementById('ownerDeviceTypeFilter') as HTMLSelectElement | null;
    if (typeSelect) typeSelect.innerHTML = `<option value="">All device types</option>${typeOptions()}`;
  }

  function openDevice(id: string): void {
    if (!devices.some(item => item.id === id)) return;
    window.location.href = `${window.ZentridEndUserLayout.pathFor('device-detail')}?id=${encodeURIComponent(id)}`;
  }

  function clearFilters(): void {
    search = ''; typeFilter = ''; statusFilter = '';
    const searchInput = document.getElementById('ownerDeviceSearch') as HTMLInputElement | null;
    const typeSelect = document.getElementById('ownerDeviceTypeFilter') as HTMLSelectElement | null;
    const statusSelect = document.getElementById('ownerDeviceStatusFilter') as HTMLSelectElement | null;
    if (searchInput) searchInput.value = '';
    if (typeSelect) typeSelect.value = '';
    if (statusSelect) statusSelect.value = '';
    refreshGrid();
  }

  function wirePage(): void {
    document.getElementById('ownerDeviceSearch')?.addEventListener('input', event => { search = (event.target as HTMLInputElement).value; refreshGrid(); });
    document.getElementById('ownerDeviceTypeFilter')?.addEventListener('change', event => { typeFilter = (event.target as HTMLSelectElement).value; refreshGrid(); });
    document.getElementById('ownerDeviceStatusFilter')?.addEventListener('change', event => { statusFilter = (event.target as HTMLSelectElement).value; refreshGrid(); });
    document.getElementById('ownerDeviceGrid')?.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      const open = target?.closest<HTMLElement>('[data-open-device]');
      if (open?.dataset.openDevice) openDevice(open.dataset.openDevice);
      if (target?.closest('#clearDeviceFilters')) clearFilters();
    });
  }

  async function loadDevices(): Promise<void> {
    const api = window.ZentridEndUserAPI;
    if (!api?.devices) {
      loadState = 'error';
      loadMessage = 'The End User device API is not available.';
      refreshSummary();
      refreshGrid();
      return;
    }
    try {
      const rows = await api.devices({ page:1, size:100 });
      const meta = api.getState?.('devices');
      fetchedAt = String(meta?.fetchedAt || '');
      loadMessage = String(meta?.error || '');
      const rawRows = Array.isArray(rows) ? rows.filter((row: Record<string,any>) => Boolean(apiText(row, ['id','deviceId','device_id','assetId','uuid']))) : [];
      devices = (model.normalizeRows(rawRows) as OwnerDeviceRecord[]).map((device, index) => sanitizeDevice(device, rawRows[index] || {}));
      loadState = meta?.state === 'cached' ? 'cached' : meta?.state === 'error' ? 'error' : devices.length ? 'live' : 'empty';
      refreshTypeOptions();
      refreshSummary();
      refreshGrid();
      if (loadState === 'cached') window.ZentridEndUserLayout.toast('Showing the latest cached device data from a previous successful API response.', 'warning');
      if (loadState === 'error') window.ZentridEndUserLayout.toast(loadMessage || 'Device data is temporarily unavailable.', 'warning');
    } catch (error) {
      devices = [];
      loadState = 'error';
      loadMessage = String((error as { message?: unknown })?.message || 'The End User API could not provide device data.');
      refreshTypeOptions();
      refreshSummary();
      refreshGrid();
      window.ZentridEndUserLayout.toast(loadMessage, 'warning');
    }
  }

  window.ZentridEndUserLayout.mount(renderPage());
  wirePage();
  void loadDevices();
})();
