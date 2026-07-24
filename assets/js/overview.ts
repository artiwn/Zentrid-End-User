type AnyRecord = Record<string, any>;
type EndUserOverviewStatus = 'Normal' | 'Needs Attention' | 'Problem Detected' | 'Unavailable';
type EndUserOverviewEnergyPoint = { label: string; generated: number | null; sold: number | null };
type EndUserOverviewState = {
  plantName: string;
  plantLocation: string;
  plantStatus: string;
  plantStatusTone: string;
  systemStatus: EndUserOverviewStatus;
  statusMessage: string;
  powerNow: string;
  generatedToday: string;
  generatedDelta: string;
  soldToday: string;
  soldDelta: string;
  revenueMonth: string;
  revenueDelta: string;
  monthEnergy: string;
  activeAlerts: number | null;
  lastPayment: string;
  lastPaymentNote: string;
  nextSettlement: string;
  nextSettlementNote: string;
  settlementStatus: string;
  settlementStatusTone: string;
  settlementSold: string;
  settlementGross: string;
  settlementReceived: string;
  settlementOutstanding: string;
  settlementReceivedPercent: number;
  averageTariff: string;
  freshnessTitle: string;
  freshnessDetail: string;
  alertRows: AnyRecord[];
  energyPoints: EndUserOverviewEnergyPoint[];
};

const ownerState: EndUserOverviewState = {
  plantName: '—',
  plantLocation: '—',
  plantStatus: '—',
  plantStatusTone: 'neutral',
  systemStatus: 'Unavailable',
  statusMessage: 'Loading overview data from the API.',
  powerNow: '—',
  generatedToday: '—',
  generatedDelta: 'Waiting for API data',
  soldToday: '—',
  soldDelta: 'Waiting for API data',
  revenueMonth: '—',
  revenueDelta: 'Waiting for API data',
  monthEnergy: '—',
  activeAlerts: null,
  lastPayment: '—',
  lastPaymentNote: 'No payment value returned',
  nextSettlement: '—',
  nextSettlementNote: 'No settlement date returned',
  settlementStatus: 'No data',
  settlementStatusTone: 'neutral',
  settlementSold: '—',
  settlementGross: '—',
  settlementReceived: '—',
  settlementOutstanding: '—',
  settlementReceivedPercent: 0,
  averageTariff: '—',
  freshnessTitle: 'Loading API data',
  freshnessDetail: 'Connecting to End User services',
  alertRows: [],
  energyPoints: []
};

function ownerEscape(value: unknown): string {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character] || character));
}

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function firstName(): string {
  return String(window.ZentridEndUserLayout.state.user || 'End User').trim().split(/\s+/)[0] || 'End User';
}

function normalizedKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function collectRecords(value: unknown, depth = 0, seen = new Set<unknown>()): AnyRecord[] {
  if (depth > 4 || !value || seen.has(value)) return [];
  seen.add(value);
  if (Array.isArray(value)) return value.flatMap(item => collectRecords(item, depth + 1, seen));
  if (!isRecord(value)) return [];
  const records: AnyRecord[] = [value];
  Object.values(value).forEach(child => {
    if (isRecord(child)) records.push(...collectRecords(child, depth + 1, seen));
  });
  return records;
}

function pickValue(records: AnyRecord[], keys: string[]): unknown {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
  }
  const wanted = new Set(keys.map(normalizedKey));
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      if (wanted.has(normalizedKey(key)) && value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
  }
  return undefined;
}

function scalar(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'number' && Number.isFinite(value)) return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value).trim() || '—';
}

function metric(records: AnyRecord[], candidates: Array<{ keys: string[]; unit?: string }>): string {
  for (const candidate of candidates) {
    const value = pickValue(records, candidate.keys);
    if (value === undefined || value === null || String(value).trim() === '') continue;
    if (typeof value === 'number' && Number.isFinite(value)) {
      const formatted = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(value);
      return candidate.unit ? `${formatted} ${candidate.unit}` : formatted;
    }
    return String(value).trim();
  }
  return '—';
}

function numericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s/g, '').replace(/,/g, '').replace(/[^0-9.+-]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberFrom(records: AnyRecord[], keys: string[]): number | null {
  return numericValue(pickValue(records, keys));
}

function money(records: AnyRecord[], amountKeys: string[]): string {
  const value = pickValue(records, amountKeys);
  if (value === undefined || value === null || String(value).trim() === '') return '—';
  if (typeof value === 'string' && /[^0-9.,+\-\s]/.test(value)) return value.trim();
  const amount = numericValue(value);
  if (amount === null) return scalar(value);
  const currencyValue = pickValue(records, ['currency', 'currencyCode', 'settlementCurrency', 'paymentCurrency']);
  const currency = typeof currencyValue === 'string' && /^[A-Z]{3}$/.test(currencyValue.trim().toUpperCase()) ? currencyValue.trim().toUpperCase() : '';
  if (currency) {
    try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount); }
    catch (_error) { return `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(amount)} ${currency}`; }
  }
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(amount);
}

function dateValue(records: AnyRecord[], keys: string[]): string {
  const value = pickValue(records, keys);
  if (value === undefined || value === null || String(value).trim() === '') return '—';
  const text = String(value).trim();
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) return text;
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(timestamp));
}

function statusTone(): string {
  if (ownerState.systemStatus === 'Problem Detected') return 'danger';
  if (ownerState.systemStatus === 'Needs Attention') return 'warning';
  if (ownerState.systemStatus === 'Normal') return 'success';
  return 'neutral';
}

function statusIcon(): string {
  if (ownerState.systemStatus === 'Problem Detected') return '!';
  if (ownerState.systemStatus === 'Needs Attention') return '⚠';
  if (ownerState.systemStatus === 'Normal') return '✓';
  return '—';
}

function pointLabel(row: AnyRecord, index: number): string {
  const raw = pickValue([row], ['label', 'period', 'timeLabel', 'timestamp', 'time', 'date', 'intervalStart', 'recordedAt']);
  if (raw === undefined || raw === null || String(raw).trim() === '') return String(index + 1);
  const text = String(raw).trim();
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) return text;
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function energyPoint(row: AnyRecord, index: number): EndUserOverviewEnergyPoint | null {
  const generated = numberFrom([row], ['generated', 'generation', 'energyGenerated', 'generatedEnergy', 'production', 'produced', 'yield', 'value']);
  const sold = numberFrom([row], ['sold', 'energySold', 'soldEnergy', 'exported', 'exportEnergy', 'gridExport']);
  if (generated === null && sold === null) return null;
  return { label: pointLabel(row, index), generated, sold };
}

function findEnergyPoints(values: unknown[]): EndUserOverviewEnergyPoint[] {
  let best: EndUserOverviewEnergyPoint[] = [];
  const visit = (value: unknown, depth = 0): void => {
    if (depth > 5 || value === null || value === undefined) return;
    if (Array.isArray(value)) {
      const direct = value.filter(isRecord).map((row, index) => energyPoint(row, index)).filter((point): point is EndUserOverviewEnergyPoint => Boolean(point));
      if (direct.length > best.length) best = direct;
      value.forEach(item => visit(item, depth + 1));
      return;
    }
    if (!isRecord(value)) return;
    const seriesValue = value.series;
    if (Array.isArray(seriesValue)) {
      const generatedSeries = seriesValue.find(item => isRecord(item) && /generat|produc/i.test(String(item.name || item.label || item.key || '')));
      const soldSeries = seriesValue.find(item => isRecord(item) && /sold|export/i.test(String(item.name || item.label || item.key || '')));
      const generatedData = isRecord(generatedSeries) && Array.isArray(generatedSeries.data) ? generatedSeries.data : [];
      const soldData = isRecord(soldSeries) && Array.isArray(soldSeries.data) ? soldSeries.data : [];
      const length = Math.max(generatedData.length, soldData.length);
      const merged: EndUserOverviewEnergyPoint[] = [];
      for (let index = 0; index < length; index += 1) {
        const generatedItem = generatedData[index];
        const soldItem = soldData[index];
        const generatedRecord = isRecord(generatedItem) ? generatedItem : {};
        const soldRecord = isRecord(soldItem) ? soldItem : {};
        const generated = numericValue(isRecord(generatedItem) ? pickValue([generatedRecord], ['y', 'value', 'generated']) : generatedItem);
        const sold = numericValue(isRecord(soldItem) ? pickValue([soldRecord], ['y', 'value', 'sold']) : soldItem);
        if (generated === null && sold === null) continue;
        const labelSource = pickValue([generatedRecord, soldRecord], ['x', 'label', 'time', 'timestamp', 'date']);
        merged.push({ label: labelSource === undefined ? String(index + 1) : pointLabel({ label: labelSource }, index), generated, sold });
      }
      if (merged.length > best.length) best = merged;
    }
    Object.values(value).forEach(child => visit(child, depth + 1));
  };
  values.forEach(value => visit(value));
  return best.slice(0, 96);
}

function coordinates(values: Array<number | null>, maxValue: number): string {
  const left = 42;
  const right = 735;
  const top = 35;
  const bottom = 205;
  const width = right - left;
  const height = bottom - top;
  const steps = Math.max(values.length - 1, 1);
  return values.map((value, index) => {
    const x = left + (width * index / steps);
    const y = bottom - ((Math.max(0, value || 0) / maxValue) * height);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function chartMarkup(): string {
  const points = ownerState.energyPoints;
  if (!points.length) {
    return `<div class="owner-chart-wrap" aria-label="Energy API data unavailable"><div class="owner-positive-state"><div><div class="icon">—</div><h3>No energy series returned</h3><p>The chart will appear when the API returns interval generation data.</p></div></div></div>`;
  }
  const generatedValues = points.map(point => point.generated);
  const soldValues = points.map(point => point.sold);
  const numericValues = [...generatedValues, ...soldValues].filter((value): value is number => value !== null && Number.isFinite(value));
  const maxValue = Math.max(...numericValues, 1) * 1.08;
  const generated = coordinates(generatedValues, maxValue);
  const sold = coordinates(soldValues, maxValue);
  const area = `42,205 ${generated} 735,205`;
  const hasGenerated = generatedValues.some(value => value !== null);
  const hasSold = soldValues.some(value => value !== null);
  const labelStep = Math.max(1, Math.ceil(points.length / 5));
  const labels = points.map((point, index) => {
    if (index % labelStep !== 0 && index !== points.length - 1) return '';
    const x = 42 + (693 * index / Math.max(points.length - 1, 1));
    return `<text x="${x.toFixed(1)}" y="240" text-anchor="middle">${ownerEscape(point.label)}</text>`;
  }).join('');
  const lastGenerated = generated.split(' ').at(-1) || '735,205';
  const [dotX, dotY] = lastGenerated.split(',');
  return `<div class="owner-chart-wrap" aria-label="Generated and sold energy chart">
    <svg class="owner-chart-svg" viewBox="0 0 760 250" role="img" aria-label="Energy series returned by the API">
      <defs><linearGradient id="ownerEnergyArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#22d3ee" stop-opacity=".26"/><stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/></linearGradient></defs>
      <g class="owner-chart-grid"><line x1="42" y1="35" x2="735" y2="35"/><line x1="42" y1="90" x2="735" y2="90"/><line x1="42" y1="145" x2="735" y2="145"/><line x1="42" y1="200" x2="735" y2="200"/></g>
      ${hasGenerated ? `<polygon class="owner-chart-area" points="${area}"/><polyline class="owner-chart-generated" points="${generated}"/><circle class="owner-chart-dot" cx="${dotX}" cy="${dotY}" r="6"/>` : ''}
      ${hasSold ? `<polyline class="owner-chart-sold" points="${sold}"/>` : ''}
      <g fill="#91a4bc" font-size="11">${labels}</g>
    </svg>
    <div class="owner-chart-legend">${hasGenerated ? '<span><i></i>Generated energy</span>' : ''}${hasSold ? '<span class="sold"><i></i>Sold to grid</span>' : ''}</div>
  </div>`;
}

function activeAlertLabel(): string {
  if (ownerState.activeAlerts === null) return '—';
  if (ownerState.activeAlerts === 0) return 'No issues detected';
  return String(ownerState.activeAlerts);
}

function activeAlertNote(): string {
  if (ownerState.activeAlerts === null) return 'Alerts API unavailable';
  if (ownerState.activeAlerts === 0) return 'No open alerts returned by API';
  return 'Open Alerts for details';
}

function alertContentMarkup(): string {
  if (ownerState.activeAlerts === null) {
    return `<div class="owner-positive-state"><div><div class="icon">—</div><h3>Alerts unavailable</h3><p>No alert data was returned by the API.</p></div></div>`;
  }
  if (ownerState.activeAlerts === 0) {
    return `<div class="owner-positive-state"><div><div class="icon">✓</div><h3>No issues detected</h3><p>The Alerts API returned no open issues.</p></div></div>`;
  }
  const rows = ownerState.alertRows.slice(0, 3);
  return `<div class="information-grid">${rows.map(row => {
    const title = scalar(pickValue(collectRecords(row), ['title', 'name', 'message', 'description', 'alertName', 'code']));
    const severity = scalar(pickValue(collectRecords(row), ['severity', 'priority', 'level']));
    const status = scalar(pickValue(collectRecords(row), ['status', 'state']));
    return `<div><span>${ownerEscape(severity)}</span><strong>${ownerEscape(title)}</strong><small>${ownerEscape(status)}</small></div>`;
  }).join('')}</div>`;
}

function renderOverview(): string {
  const tone = statusTone();
  return `<section class="page-hero">
    <div class="greeting-copy"><p class="eyebrow">My Zentrid</p><h1>${greeting()}, ${ownerEscape(firstName())} 👋</h1><p class="friendly-note">Here is a simple view of your plant, energy sales and revenue.</p></div>
    <button class="freshness-card" type="button" data-route="energy"><span class="pulse"></span><div><strong>${ownerEscape(ownerState.freshnessTitle)}</strong><small>${ownerEscape(ownerState.freshnessDetail)}</small></div></button>
  </section>

  <section class="owner-status-card ${tone}" aria-label="System status">
    <div class="owner-status-icon">${statusIcon()}</div>
    <div class="owner-status-copy"><p class="eyebrow">System Status</p><h2>${ownerEscape(ownerState.systemStatus)}</h2><p>${ownerEscape(ownerState.statusMessage)}</p></div>
    <button class="secondary-action owner-status-action" type="button" data-route="alerts">${ownerState.activeAlerts && ownerState.activeAlerts > 0 ? `View ${ownerState.activeAlerts} issue${ownerState.activeAlerts === 1 ? '' : 's'}` : 'View system status'}</button>
  </section>

  <section class="kpi-grid owner-kpi-grid">
    <button class="kpi-card yellow" type="button" data-route="energy"><div class="kpi-icon">⚡</div><div class="kpi-label">Power Now</div><div class="kpi-value" id="ownerPowerNow">${ownerEscape(ownerState.powerNow)}</div><div class="kpi-delta">Live API value</div></button>
    <button class="kpi-card cyan" type="button" data-route="energy"><div class="kpi-icon">☀️</div><div class="kpi-label">Generated Today</div><div class="kpi-value" id="ownerGeneratedToday">${ownerEscape(ownerState.generatedToday)}</div><div class="kpi-delta">${ownerEscape(ownerState.generatedDelta)}</div></button>
    <button class="kpi-card green" type="button" data-route="revenue"><div class="kpi-icon">↗</div><div class="kpi-label">Sold Today</div><div class="kpi-value" id="ownerSoldToday">${ownerEscape(ownerState.soldToday)}</div><div class="kpi-delta">${ownerEscape(ownerState.soldDelta)}</div></button>
    <button class="kpi-card violet" type="button" data-route="revenue"><div class="kpi-icon">💶</div><div class="kpi-label">Revenue This Month</div><div class="kpi-value" id="ownerRevenueMonth">${ownerEscape(ownerState.revenueMonth)}</div><div class="kpi-delta">${ownerEscape(ownerState.revenueDelta)}</div></button>
  </section>

  <section class="owner-secondary-strip" aria-label="Quick account status">
    <button type="button" data-route="alerts"><span>Active Issues</span><strong id="ownerActiveAlerts">${ownerEscape(activeAlertLabel())}</strong><small>${ownerEscape(activeAlertNote())}</small></button>
    <button type="button" data-route="revenue"><span>Last Payment</span><strong>${ownerEscape(ownerState.lastPayment)}</strong><small>${ownerEscape(ownerState.lastPaymentNote)}</small></button>
    <button type="button" data-route="revenue"><span>Next Settlement</span><strong>${ownerEscape(ownerState.nextSettlement)}</strong><small>${ownerEscape(ownerState.nextSettlementNote)}</small></button>
  </section>

  <section class="owner-overview-grid">
    <article class="panel glass-card owner-chart-card">
      <div class="panel-head"><div><h2>Energy Today</h2><p>Generated energy and the part sold to the grid.</p></div><div class="owner-period-pills"><button class="active" type="button" data-period="today">Today</button><button type="button" data-period="week">Week</button><button type="button" data-period="month">Month</button></div></div>
      ${chartMarkup()}
      <button class="secondary-action" type="button" data-route="energy">Open Energy</button>
    </article>

    <article class="panel glass-card owner-settlement-card">
      <div class="panel-head"><div><h2>Current Settlement</h2><p>Simple financial view for the current month.</p></div><span class="badge ${ownerEscape(ownerState.settlementStatusTone)}">${ownerEscape(ownerState.settlementStatus)}</span></div>
      <div class="owner-settlement-total"><span>Estimated gross revenue</span><strong>${ownerEscape(ownerState.settlementGross)}</strong></div>
      <div class="owner-settlement-progress" aria-label="${ownerState.settlementReceivedPercent} percent received"><span style="width:${ownerState.settlementReceivedPercent}%"></span></div>
      <div class="owner-settlement-grid">
        <div><span>Energy sold</span><strong>${ownerEscape(ownerState.settlementSold)}</strong><small>Current period API value</small></div>
        <div><span>Received</span><strong>${ownerEscape(ownerState.settlementReceived)}</strong><small>${ownerState.settlementReceivedPercent ? `${ownerState.settlementReceivedPercent}% settled` : 'No percentage returned'}</small></div>
        <div><span>Outstanding</span><strong>${ownerEscape(ownerState.settlementOutstanding)}</strong><small>${ownerState.nextSettlement !== '—' ? `Expected by ${ownerEscape(ownerState.nextSettlement)}` : 'No settlement date returned'}</small></div>
        <div><span>Average tariff</span><strong>${ownerEscape(ownerState.averageTariff)}</strong><small>Read-only API value</small></div>
      </div>
      <div class="owner-card-action"><button class="primary-action" type="button" data-route="revenue">Open Sales & Revenue</button></div>
    </article>
  </section>

  <section class="owner-lower-grid">
    <article class="panel glass-card">
      <div class="panel-head"><div><h2>My Plant</h2><p>Your assigned solar asset.</p></div></div>
      <div class="owner-plant-card">
        <div><span class="badge ${ownerEscape(ownerState.plantStatusTone)}">${ownerEscape(ownerState.plantStatus)}</span><h3>${ownerEscape(ownerState.plantName)}</h3><p>${ownerEscape(ownerState.plantLocation)}</p>
          <div class="owner-plant-metrics"><div><span>Today</span><strong>${ownerEscape(ownerState.generatedToday)}</strong></div><div><span>This month</span><strong>${ownerEscape(ownerState.monthEnergy)}</strong></div><div><span>Active alerts</span><strong>${ownerState.activeAlerts === null ? '—' : ownerState.activeAlerts}</strong></div></div>
        </div>
        <button class="secondary-action" type="button" data-route="plant">Open My Plant</button>
      </div>
    </article>

    <article class="panel glass-card">
      <div class="panel-head"><div><h2>Alerts</h2><p>Only clear, owner-relevant issues are shown here.</p></div><button class="secondary-action" type="button" data-route="alerts">View Alerts</button></div>
      <div id="ownerAlertContent">${alertContentMarkup()}</div>
    </article>
  </section>`;
}

function wireOverview(): void {
  document.querySelectorAll<HTMLButtonElement>('.owner-period-pills button').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.owner-period-pills button').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    window.ZentridEndUserLayout.toast(`${button.textContent} view selected. Detailed period data is available in the Energy section.`, 'info');
  }));
}

function openAlerts(rows: AnyRecord[]): AnyRecord[] {
  return rows.filter(alert => {
    const status = scalar(pickValue(collectRecords(alert), ['status', 'state', 'alertStatus'])).toLowerCase();
    return !['resolved', 'closed', 'cleared', 'inactive'].includes(status);
  });
}

function normalizedStatus(value: unknown): { label: EndUserOverviewStatus; tone: string } | null {
  const status = String(value ?? '').trim().toLowerCase();
  if (!status) return null;
  if (/critical|problem|failed|offline|error|down|unhealthy/.test(status)) return { label: 'Problem Detected', tone: 'danger' };
  if (/warning|attention|degraded|partial|issue/.test(status)) return { label: 'Needs Attention', tone: 'warning' };
  if (/normal|healthy|online|active|operational|running|ok/.test(status)) return { label: 'Normal', tone: 'success' };
  return null;
}

function rawPlantStatus(value: unknown): { label: string; tone: string } {
  const text = scalar(value);
  const normalized = normalizedStatus(value);
  if (normalized) return { label: text, tone: normalized.tone };
  return { label: text, tone: text === '—' ? 'neutral' : 'neutral' };
}

function relativeTime(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 'Timestamp unavailable';
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
}

function updateFreshness(api: any): void {
  const metas = ['overview', 'dashboard', 'plants', 'alerts', 'energy:Today']
    .map(resource => api.getState?.(resource))
    .filter((meta: unknown): meta is AnyRecord => isRecord(meta));
  const live = metas.filter(meta => meta.state === 'live');
  const cached = metas.filter(meta => meta.state === 'cached');
  const empty = metas.filter(meta => meta.state === 'empty');
  const latest = [...live, ...cached, ...empty]
    .map(meta => String(meta.fetchedAt || ''))
    .filter(Boolean)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
  if (live.length) {
    ownerState.freshnessTitle = 'Live API data connected';
    ownerState.freshnessDetail = `${latest ? relativeTime(latest) : 'Updated'} · ${live.length} resource${live.length === 1 ? '' : 's'} live`;
  } else if (cached.length) {
    ownerState.freshnessTitle = 'Cached API data';
    ownerState.freshnessDetail = `${latest ? relativeTime(latest) : 'Saved response'} · Live service unavailable`;
  } else if (empty.length) {
    ownerState.freshnessTitle = 'API connected';
    ownerState.freshnessDetail = 'No overview records returned';
  } else {
    ownerState.freshnessTitle = 'API unavailable';
    ownerState.freshnessDetail = 'No live or cached End User data';
  }
}

function applyOverviewData(api: any, overview: AnyRecord, dashboard: AnyRecord, plants: AnyRecord[], alerts: AnyRecord[], energy: AnyRecord): void {
  const plant = plants[0] || {};
  const overviewRecords = collectRecords(overview);
  const dashboardRecords = collectRecords(dashboard);
  const energyRecords = collectRecords(energy);
  const plantRecords = collectRecords(plant);
  const records = [...overviewRecords, ...dashboardRecords, ...energyRecords, ...plantRecords];

  ownerState.plantName = scalar(pickValue([...plantRecords, ...records], ['plantName', 'name', 'displayName', 'siteName', 'title']));
  const directLocation = scalar(pickValue([...plantRecords, ...records], ['plantLocation', 'location', 'address', 'siteAddress']));
  const city = scalar(pickValue([...plantRecords, ...records], ['city', 'locality']));
  const country = scalar(pickValue([...plantRecords, ...records], ['country', 'countryName']));
  const capacity = metric([...plantRecords, ...records], [
    { keys: ['installedCapacityMw', 'capacityMw', 'nominalPowerMw'], unit: 'MWp' },
    { keys: ['installedCapacityKw', 'capacityKw', 'nominalPowerKw'], unit: 'kWp' },
    { keys: ['installedCapacity', 'capacity', 'nominalPower'] }
  ]);
  const locationParts = directLocation !== '—' ? [directLocation] : [city, country].filter(value => value !== '—');
  if (capacity !== '—') locationParts.push(capacity);
  ownerState.plantLocation = locationParts.length ? locationParts.join(' · ') : '—';

  const plantStatus = rawPlantStatus(pickValue([...plantRecords, ...overviewRecords], ['plantStatus', 'operationalStatus', 'status', 'healthStatus']));
  ownerState.plantStatus = plantStatus.label;
  ownerState.plantStatusTone = plantStatus.tone;

  ownerState.powerNow = metric(records, [
    { keys: ['powerNowMw', 'currentPowerMw', 'activePowerMw'], unit: 'MW' },
    { keys: ['powerNowKw', 'currentPowerKw', 'activePowerKw'], unit: 'kW' },
    { keys: ['powerNow', 'currentPower', 'activePower', 'power'] }
  ]);
  ownerState.generatedToday = metric(records, [
    { keys: ['generatedTodayMwh', 'energyTodayMwh', 'todayEnergyMwh', 'dailyEnergyMwh'], unit: 'MWh' },
    { keys: ['generatedTodayKwh', 'energyTodayKwh', 'todayEnergyKwh', 'dailyEnergyKwh'], unit: 'kWh' },
    { keys: ['generatedToday', 'energyToday', 'todayEnergy', 'dailyEnergy', 'todayGeneration'] }
  ]);
  ownerState.soldToday = metric(records, [
    { keys: ['soldTodayMwh', 'energySoldTodayMwh', 'exportTodayMwh'], unit: 'MWh' },
    { keys: ['soldTodayKwh', 'energySoldTodayKwh', 'exportTodayKwh'], unit: 'kWh' },
    { keys: ['soldToday', 'energySoldToday', 'exportToday', 'todaySoldEnergy'] }
  ]);
  ownerState.monthEnergy = metric(records, [
    { keys: ['monthEnergyMwh', 'generatedThisMonthMwh', 'monthlyEnergyMwh'], unit: 'MWh' },
    { keys: ['monthEnergyKwh', 'generatedThisMonthKwh', 'monthlyEnergyKwh'], unit: 'kWh' },
    { keys: ['monthEnergy', 'generatedThisMonth', 'monthlyEnergy', 'monthGeneration'] }
  ]);
  ownerState.revenueMonth = money(records, ['revenueMonth', 'monthlyRevenue', 'revenueThisMonth', 'estimatedMonthlyRevenue', 'grossRevenue']);
  ownerState.generatedDelta = scalar(pickValue(records, ['generatedComparison', 'generationComparison', 'todayComparison', 'generationDelta']));
  if (ownerState.generatedDelta === '—') ownerState.generatedDelta = ownerState.generatedToday === '—' ? 'No API value' : 'Returned by API';
  const soldShare = numberFrom(records, ['soldShare', 'exportShare', 'soldPercentage', 'exportPercentage']);
  ownerState.soldDelta = soldShare === null ? (ownerState.soldToday === '—' ? 'No API value' : 'Returned by API') : `${Math.max(0, Math.min(100, Math.round(soldShare)))}% of generation`;
  ownerState.revenueDelta = scalar(pickValue(records, ['revenueStatus', 'settlementStatus', 'revenueNote']));
  if (ownerState.revenueDelta === '—') ownerState.revenueDelta = ownerState.revenueMonth === '—' ? 'No API value' : 'Returned by API';

  const alertsMeta = api.getState?.('alerts');
  const active = openAlerts(alerts);
  const overviewAlertCount = numberFrom(records, ['activeAlerts', 'openAlerts', 'alertCount', 'activeIssueCount']);
  if (isRecord(alertsMeta) && ['live', 'cached', 'empty'].includes(String(alertsMeta.state))) ownerState.activeAlerts = active.length;
  else ownerState.activeAlerts = overviewAlertCount === null ? null : Math.max(0, Math.round(overviewAlertCount));
  ownerState.alertRows = active;

  const directSystemStatus = normalizedStatus(pickValue(overviewRecords, ['systemStatus', 'healthStatus', 'overallStatus', 'operationalStatus']));
  if (directSystemStatus) {
    ownerState.systemStatus = directSystemStatus.label;
  } else if (ownerState.activeAlerts !== null) {
    const critical = active.some(alert => /critical|p1|high|error|failed/i.test(scalar(pickValue(collectRecords(alert), ['severity', 'priority', 'level', 'status']))));
    ownerState.systemStatus = critical ? 'Problem Detected' : ownerState.activeAlerts > 0 ? 'Needs Attention' : 'Normal';
  } else {
    ownerState.systemStatus = 'Unavailable';
  }
  const directMessage = scalar(pickValue(overviewRecords, ['statusMessage', 'systemMessage', 'healthMessage', 'message']));
  if (directMessage !== '—') ownerState.statusMessage = directMessage;
  else if (ownerState.activeAlerts === null) ownerState.statusMessage = 'No system status was returned by the API.';
  else if (ownerState.activeAlerts === 0) ownerState.statusMessage = 'The Alerts API returned no open issues.';
  else ownerState.statusMessage = `${ownerState.activeAlerts} open issue${ownerState.activeAlerts === 1 ? '' : 's'} returned by the API.`;

  ownerState.lastPayment = scalar(pickValue(records, ['lastPayment', 'latestPayment', 'lastPaymentDisplay']));
  if (ownerState.lastPayment === '—') {
    const amount = money(records, ['lastPaymentAmount', 'latestPaymentAmount', 'paymentAmount']);
    const date = dateValue(records, ['lastPaymentDate', 'latestPaymentDate', 'paymentDate']);
    ownerState.lastPayment = [amount, date].filter(value => value !== '—').join(' · ') || '—';
  }
  ownerState.lastPaymentNote = scalar(pickValue(records, ['lastPaymentStatus', 'paymentStatus', 'lastPaymentNote']));
  if (ownerState.lastPaymentNote === '—') ownerState.lastPaymentNote = ownerState.lastPayment === '—' ? 'No payment value returned' : 'Returned by API';

  ownerState.nextSettlement = dateValue(records, ['nextSettlement', 'nextSettlementDate', 'settlementDueDate', 'nextPaymentDate']);
  ownerState.nextSettlementNote = scalar(pickValue(records, ['nextSettlementStatus', 'settlementNote', 'nextSettlementNote']));
  if (ownerState.nextSettlementNote === '—') ownerState.nextSettlementNote = ownerState.nextSettlement === '—' ? 'No settlement date returned' : 'Returned by API';
  ownerState.settlementStatus = scalar(pickValue(records, ['settlementStatus', 'currentSettlementStatus', 'status']));
  if (ownerState.settlementStatus === '—') ownerState.settlementStatus = 'No data';
  const settlementNormalized = normalizedStatus(ownerState.settlementStatus);
  ownerState.settlementStatusTone = settlementNormalized?.tone || (/progress|pending|processing/i.test(ownerState.settlementStatus) ? 'warning' : 'neutral');
  ownerState.settlementSold = metric(records, [
    { keys: ['settlementSoldMwh', 'settlementEnergySoldMwh'], unit: 'MWh' },
    { keys: ['settlementSoldKwh', 'settlementEnergySoldKwh'], unit: 'kWh' },
    { keys: ['settlementSold', 'settlementEnergySold', 'energySold'] }
  ]);
  ownerState.settlementGross = money(records, ['settlementGross', 'grossSettlement', 'estimatedGrossRevenue', 'grossRevenue']);
  ownerState.settlementReceived = money(records, ['settlementReceived', 'receivedAmount', 'amountReceived', 'paidAmount']);
  ownerState.settlementOutstanding = money(records, ['settlementOutstanding', 'outstandingAmount', 'amountOutstanding', 'balanceDue']);
  ownerState.averageTariff = metric(records, [
    { keys: ['averageTariffPerKwh', 'tariffPerKwh'], unit: '/kWh' },
    { keys: ['averageTariff', 'tariff', 'pricePerKwh'] }
  ]);
  const explicitPercent = numberFrom(records, ['settlementReceivedPercent', 'receivedPercent', 'settledPercent', 'paymentProgress']);
  const grossNumeric = numberFrom(records, ['settlementGross', 'grossSettlement', 'estimatedGrossRevenue', 'grossRevenue']);
  const receivedNumeric = numberFrom(records, ['settlementReceived', 'receivedAmount', 'amountReceived', 'paidAmount']);
  const calculatedPercent = grossNumeric && receivedNumeric !== null ? receivedNumeric / grossNumeric * 100 : null;
  ownerState.settlementReceivedPercent = Math.max(0, Math.min(100, Math.round(explicitPercent ?? calculatedPercent ?? 0)));

  ownerState.energyPoints = findEnergyPoints([energy, dashboard, overview]);
  updateFreshness(api);
}

async function enrichOverview(): Promise<void> {
  const api = window.ZentridEndUserAPI;
  if (!api) {
    ownerState.statusMessage = 'The End User API client is not available.';
    ownerState.freshnessTitle = 'API unavailable';
    ownerState.freshnessDetail = 'End User API client was not loaded';
    window.ZentridEndUserLayout.mount(renderOverview());
    wireOverview();
    return;
  }
  const [overview, dashboard, plants, alerts, energy] = await Promise.all([
    api.overview?.() || Promise.resolve({}),
    api.dashboard?.('Today', 1, 100) || Promise.resolve({}),
    api.plants?.() || Promise.resolve([]),
    api.alerts?.() || Promise.resolve([]),
    api.energy?.('Today') || Promise.resolve({})
  ]);
  applyOverviewData(api, isRecord(overview) ? overview : {}, isRecord(dashboard) ? dashboard : {}, Array.isArray(plants) ? plants.filter(isRecord) : [], Array.isArray(alerts) ? alerts.filter(isRecord) : [], isRecord(energy) ? energy : {});
  window.ZentridEndUserLayout.mount(renderOverview());
  wireOverview();
}

window.ZentridEndUserLayout.mount(renderOverview());
wireOverview();
void enrichOverview();
