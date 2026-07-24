type EndUserPlantAnyRecord = Record<string, any>;
type EndUserPlantStatus = 'Normal' | 'Needs Attention' | 'Problem Detected' | 'Unavailable';
type EndUserPlantDeviceStatus = 'Online' | 'Needs Attention' | 'Offline' | 'Unknown';
type EndUserPlantPeriod = 'Today' | 'Week' | 'Month';

type EndUserPlantDevice = {
  id: string;
  name: string;
  type: string;
  status: EndUserPlantDeviceStatus;
  detail: string;
  updated: string;
};

type EndUserPlantEnergyPoint = {
  label: string;
  generated: number | null;
  sold: number | null;
  consumed: number | null;
};

type EndUserPlantState = {
  period: EndUserPlantPeriod;
  id: string;
  name: string;
  location: string;
  capacity: string;
  commissioned: string;
  status: EndUserPlantStatus;
  statusMessage: string;
  updated: string;
  freshnessTitle: string;
  powerNow: string;
  generatedToday: string;
  generatedMonth: string;
  soldToday: string;
  soldMonth: string;
  selfConsumedToday: string;
  importedToday: string;
  revenueMonth: string;
  receivedMonth: string;
  outstanding: string;
  tariff: string;
  buyer: string;
  nextSettlement: string;
  settlementStatus: string;
  settlementTone: string;
  settlementProgress: number;
  performanceRatio: string;
  availability: string;
  co2Avoided: string;
  activeAlerts: number | null;
  devices: EndUserPlantDevice[];
  alerts: EndUserPlantAnyRecord[];
  energyPoints: EndUserPlantEnergyPoint[];
};

type EndUserPlantPayloads = {
  overview: EndUserPlantAnyRecord;
  dashboard: EndUserPlantAnyRecord;
  plants: EndUserPlantAnyRecord[];
  devices: EndUserPlantAnyRecord[];
  alerts: EndUserPlantAnyRecord[];
  energy: EndUserPlantAnyRecord;
};

const endUserPlantState: EndUserPlantState = {
  period: 'Today',
  id: '—',
  name: '—',
  location: '—',
  capacity: '—',
  commissioned: '—',
  status: 'Unavailable',
  statusMessage: 'Loading plant data from the API.',
  updated: 'Connecting to End User services',
  freshnessTitle: 'Loading API data',
  powerNow: '—',
  generatedToday: '—',
  generatedMonth: '—',
  soldToday: '—',
  soldMonth: '—',
  selfConsumedToday: '—',
  importedToday: '—',
  revenueMonth: '—',
  receivedMonth: '—',
  outstanding: '—',
  tariff: '—',
  buyer: '—',
  nextSettlement: '—',
  settlementStatus: 'No data',
  settlementTone: 'neutral',
  settlementProgress: 0,
  performanceRatio: '—',
  availability: '—',
  co2Avoided: '—',
  activeAlerts: null,
  devices: [],
  alerts: [],
  energyPoints: []
};

let plantPayloads: EndUserPlantPayloads = {
  overview: {},
  dashboard: {},
  plants: [],
  devices: [],
  alerts: [],
  energy: {}
};

function plantEscape(value: unknown): string {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character] || character));
}

function plantIsRecord(value: unknown): value is EndUserPlantAnyRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function plantNormalizedKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function plantCollectRecords(value: unknown, depth = 0, seen = new Set<unknown>()): EndUserPlantAnyRecord[] {
  if (depth > 5 || !value || seen.has(value)) return [];
  seen.add(value);
  if (Array.isArray(value)) return value.flatMap(item => plantCollectRecords(item, depth + 1, seen));
  if (!plantIsRecord(value)) return [];
  const records: EndUserPlantAnyRecord[] = [value];
  Object.values(value).forEach(child => {
    if (Array.isArray(child) || plantIsRecord(child)) records.push(...plantCollectRecords(child, depth + 1, seen));
  });
  return records;
}

function plantPickValue(records: EndUserPlantAnyRecord[], keys: string[]): unknown {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
  }
  const wanted = new Set(keys.map(plantNormalizedKey));
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      if (wanted.has(plantNormalizedKey(key)) && value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
  }
  return undefined;
}

function plantText(records: EndUserPlantAnyRecord[], keys: string[]): string {
  const value = plantPickValue(records, keys);
  return value === undefined || value === null ? '' : String(value).trim();
}

function plantNumericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s/g, '').replace(/,/g, '').replace(/[^0-9.+-]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function plantNumberFrom(records: EndUserPlantAnyRecord[], keys: string[]): number | null {
  return plantNumericValue(plantPickValue(records, keys));
}

function plantScalar(value: unknown): string {
  if (value === undefined || value === null || String(value).trim() === '') return '—';
  if (typeof value === 'number' && Number.isFinite(value)) return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value).trim() || '—';
}

function plantMetric(records: EndUserPlantAnyRecord[], candidates: Array<{ keys: string[]; unit?: string }>): string {
  for (const candidate of candidates) {
    const value = plantPickValue(records, candidate.keys);
    if (value === undefined || value === null || String(value).trim() === '') continue;
    if (typeof value === 'number' && Number.isFinite(value)) {
      const formatted = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(value);
      return candidate.unit ? `${formatted} ${candidate.unit}` : formatted;
    }
    return String(value).trim();
  }
  return '—';
}

function plantMoney(records: EndUserPlantAnyRecord[], amountKeys: string[]): string {
  const value = plantPickValue(records, amountKeys);
  if (value === undefined || value === null || String(value).trim() === '') return '—';
  if (typeof value === 'string' && /[^0-9.,+\-\s]/.test(value)) return value.trim();
  const amount = plantNumericValue(value);
  if (amount === null) return plantScalar(value);
  const currencyValue = plantPickValue(records, ['currency', 'currencyCode', 'settlementCurrency', 'paymentCurrency']);
  const currency = typeof currencyValue === 'string' && /^[A-Z]{3}$/.test(currencyValue.trim().toUpperCase()) ? currencyValue.trim().toUpperCase() : '';
  if (currency) {
    try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount); }
    catch (_error) { return `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(amount)} ${currency}`; }
  }
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(amount);
}

function plantDate(records: EndUserPlantAnyRecord[], keys: string[]): string {
  const value = plantPickValue(records, keys);
  if (value === undefined || value === null || String(value).trim() === '') return '—';
  const text = String(value).trim();
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) return text;
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(timestamp));
}

function plantStatusTone(status = endUserPlantState.status): string {
  if (status === 'Problem Detected') return 'danger';
  if (status === 'Needs Attention') return 'warning';
  if (status === 'Normal') return 'success';
  return 'neutral';
}

function plantStatusIcon(status = endUserPlantState.status): string {
  if (status === 'Problem Detected') return '!';
  if (status === 'Needs Attention') return '⚠';
  if (status === 'Normal') return '✓';
  return '—';
}

function plantDeviceTone(status: EndUserPlantDeviceStatus): string {
  if (status === 'Offline') return 'danger';
  if (status === 'Needs Attention') return 'warning';
  if (status === 'Online') return 'success';
  return 'neutral';
}

function plantNormalizeDeviceStatus(value: string): EndUserPlantDeviceStatus {
  const status = value.toLowerCase();
  if (!status) return 'Unknown';
  if (['offline','disconnected','fault','faulted','error','critical','failed'].some(token => status.includes(token))) return 'Offline';
  if (['warning','degraded','stale','delayed','attention','unknown'].some(token => status.includes(token))) return 'Needs Attention';
  if (['online','active','normal','healthy','connected','running','producing'].some(token => status.includes(token))) return 'Online';
  return 'Unknown';
}

function plantNormalizeStatus(value: string): EndUserPlantStatus {
  const status = value.toLowerCase();
  if (!status) return 'Unavailable';
  if (['offline','fault','faulted','error','critical','failed','stopped'].some(token => status.includes(token))) return 'Problem Detected';
  if (['warning','degraded','stale','delayed','attention','monitor'].some(token => status.includes(token))) return 'Needs Attention';
  if (['online','active','normal','healthy','connected','running','producing','operational'].some(token => status.includes(token))) return 'Normal';
  return 'Unavailable';
}

function plantRelated(row: EndUserPlantAnyRecord, plantId: string, plantName: string): boolean {
  const records = plantCollectRecords(row);
  const references = [
    plantText(records, ['plantId','plant_id','siteId','site_id','parentPlantId','assetId']),
    plantText(records, ['plantName','plant_name','siteName','site_name','plant','assetName'])
  ].map(value => value.toLowerCase()).filter(Boolean);
  if (!references.length) return true;
  const identifiers = [plantId, plantName].map(value => value.toLowerCase()).filter(value => value && value !== '—');
  return identifiers.some(identifier => references.includes(identifier));
}

function plantPointLabel(row: EndUserPlantAnyRecord, index: number): string {
  const raw = plantPickValue([row], ['label','period','timeLabel','timestamp','time','date','intervalStart','recordedAt']);
  if (raw === undefined || raw === null || String(raw).trim() === '') return String(index + 1);
  const text = String(raw).trim();
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) return text;
  const date = new Date(timestamp);
  if (endUserPlantState.period === 'Month') return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(date);
  if (endUserPlantState.period === 'Week') return new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(date);
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function plantEnergyPoint(row: EndUserPlantAnyRecord, index: number): EndUserPlantEnergyPoint | null {
  const records = plantCollectRecords(row);
  const generated = plantNumberFrom(records, ['generated','generation','energyGenerated','generatedEnergy','production','produced','yield','value']);
  const sold = plantNumberFrom(records, ['sold','energySold','soldEnergy','exported','exportEnergy','gridExport']);
  const consumed = plantNumberFrom(records, ['selfConsumed','selfConsumption','consumed','consumption','loadEnergy']);
  if (generated === null && sold === null && consumed === null) return null;
  return { label: plantPointLabel(row, index), generated, sold, consumed };
}

function plantSeriesValues(series: EndUserPlantAnyRecord | undefined): unknown[] {
  if (!series) return [];
  for (const key of ['data','values','points','items','records']) {
    if (Array.isArray(series[key])) return series[key];
  }
  return [];
}

function plantFindEnergyPoints(values: unknown[]): EndUserPlantEnergyPoint[] {
  let best: EndUserPlantEnergyPoint[] = [];
  const visit = (value: unknown, depth = 0): void => {
    if (depth > 6 || value === null || value === undefined) return;
    if (Array.isArray(value)) {
      const direct = value.filter(plantIsRecord).map((row, index) => plantEnergyPoint(row, index)).filter((point): point is EndUserPlantEnergyPoint => Boolean(point));
      if (direct.length > best.length) best = direct;
      value.forEach(item => visit(item, depth + 1));
      return;
    }
    if (!plantIsRecord(value)) return;
    if (Array.isArray(value.series)) {
      const series = value.series.filter(plantIsRecord);
      const generatedSeries = series.find(item => /generat|produc|yield/i.test(String(item.name || item.label || item.key || item.type || '')));
      const soldSeries = series.find(item => /sold|export/i.test(String(item.name || item.label || item.key || item.type || '')));
      const consumedSeries = series.find(item => /self|consum|load/i.test(String(item.name || item.label || item.key || item.type || '')));
      const generatedData = plantSeriesValues(generatedSeries);
      const soldData = plantSeriesValues(soldSeries);
      const consumedData = plantSeriesValues(consumedSeries);
      const length = Math.max(generatedData.length, soldData.length, consumedData.length);
      const merged: EndUserPlantEnergyPoint[] = [];
      for (let index = 0; index < length; index += 1) {
        const generatedItem = generatedData[index];
        const soldItem = soldData[index];
        const consumedItem = consumedData[index];
        const generatedRecord = plantIsRecord(generatedItem) ? generatedItem : {};
        const soldRecord = plantIsRecord(soldItem) ? soldItem : {};
        const consumedRecord = plantIsRecord(consumedItem) ? consumedItem : {};
        const generated = plantNumericValue(plantIsRecord(generatedItem) ? plantPickValue([generatedRecord], ['y','value','generated']) : generatedItem);
        const sold = plantNumericValue(plantIsRecord(soldItem) ? plantPickValue([soldRecord], ['y','value','sold']) : soldItem);
        const consumed = plantNumericValue(plantIsRecord(consumedItem) ? plantPickValue([consumedRecord], ['y','value','consumed']) : consumedItem);
        if (generated === null && sold === null && consumed === null) continue;
        const labelSource = plantPickValue([generatedRecord, soldRecord, consumedRecord], ['x','label','time','timestamp','date']);
        merged.push({
          label: labelSource === undefined ? String(index + 1) : plantPointLabel({ label: labelSource }, index),
          generated,
          sold,
          consumed
        });
      }
      if (merged.length > best.length) best = merged;
    }
    Object.values(value).forEach(child => visit(child, depth + 1));
  };
  values.forEach(value => visit(value));
  return best.slice(0, 120);
}

function plantChartCoordinates(values: Array<number | null>, maxValue: number): string {
  const left = 46;
  const right = 790;
  const top = 36;
  const bottom = 234;
  const width = right - left;
  const height = bottom - top;
  const steps = Math.max(values.length - 1, 1);
  return values.map((value, index) => {
    if (value === null || !Number.isFinite(value)) return '';
    const x = left + (width * index / steps);
    const y = bottom - ((Math.max(0, value) / maxValue) * height);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).filter(Boolean).join(' ');
}

function plantChartMarkup(): string {
  const points = endUserPlantState.energyPoints;
  if (!points.length) {
    return `<div class="owner-plant-chart-wrap" aria-label="Plant energy API data unavailable"><div class="owner-positive-state"><div><div class="icon">—</div><h3>No energy series returned</h3><p>The chart will appear when the API returns interval plant energy data.</p></div></div></div>`;
  }
  const generatedValues = points.map(point => point.generated);
  const soldValues = points.map(point => point.sold);
  const consumedValues = points.map(point => point.consumed);
  const numericValues = [...generatedValues, ...soldValues, ...consumedValues].filter((value): value is number => value !== null && Number.isFinite(value));
  if (!numericValues.length) return `<div class="owner-plant-chart-wrap"><div class="owner-positive-state"><div><div class="icon">—</div><h3>No numeric energy points returned</h3><p>The API response did not include chartable interval values.</p></div></div></div>`;
  const maxValue = Math.max(...numericValues, 1) * 1.08;
  const generated = plantChartCoordinates(generatedValues, maxValue);
  const sold = plantChartCoordinates(soldValues, maxValue);
  const consumed = plantChartCoordinates(consumedValues, maxValue);
  const generatedPairs = generated.split(' ').filter(Boolean);
  const area = generatedPairs.length > 1 ? `46,234 ${generated} 790,234` : '';
  const lastGenerated = generatedPairs.at(-1) || '';
  const [dotX, dotY] = lastGenerated.split(',');
  const labelStep = Math.max(1, Math.ceil(points.length / 5));
  const labels = points.map((point, index) => {
    if (index % labelStep !== 0 && index !== points.length - 1) return '';
    const x = 46 + (744 * index / Math.max(points.length - 1, 1));
    return `<text x="${x.toFixed(1)}" y="260" text-anchor="middle">${plantEscape(point.label)}</text>`;
  }).join('');
  return `<div class="owner-plant-chart-wrap" aria-label="Plant generation, sales and self-consumption chart">
    <svg class="owner-plant-chart-svg" viewBox="0 0 820 280" role="img" aria-label="Energy series returned by the API">
      <defs><linearGradient id="plantGeneratedArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#22d3ee" stop-opacity=".24"/><stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/></linearGradient></defs>
      <g class="owner-plant-chart-grid"><line x1="46" y1="36" x2="790" y2="36"/><line x1="46" y1="96" x2="790" y2="96"/><line x1="46" y1="156" x2="790" y2="156"/><line x1="46" y1="216" x2="790" y2="216"/></g>
      ${area ? `<polygon class="owner-plant-chart-area" points="${area}"/>` : ''}
      ${generated ? `<polyline class="owner-plant-chart-generated" points="${generated}"/>` : ''}
      ${sold ? `<polyline class="owner-plant-chart-sold" points="${sold}"/>` : ''}
      ${consumed ? `<polyline class="owner-plant-chart-consumed" points="${consumed}"/>` : ''}
      ${dotX && dotY ? `<circle class="owner-plant-chart-dot" cx="${dotX}" cy="${dotY}" r="6"/>` : ''}
      <g fill="#91a4bc" font-size="11">${labels}</g>
    </svg>
    <div class="owner-plant-chart-legend">${generated ? '<span><i></i>Generated</span>' : ''}${sold ? '<span class="sold"><i></i>Sold</span>' : ''}${consumed ? '<span class="consumed"><i></i>Self-consumed</span>' : ''}</div>
  </div>`;
}

function plantDevicesMarkup(): string {
  if (!endUserPlantState.devices.length) {
    return `<div class="owner-positive-state"><div><div class="icon">—</div><h3>No devices returned</h3><p>The Devices API returned no equipment for this plant.</p></div></div>`;
  }
  return endUserPlantState.devices.slice(0, 3).map(device => {
    const tone = plantDeviceTone(device.status);
    const lowerType = device.type.toLowerCase();
    const symbol = lowerType.includes('meter') ? '▥' : lowerType.includes('weather') || lowerType.includes('sensor') ? '☀' : '⌁';
    return `<button class="owner-device-summary-card" type="button" data-route="devices" data-device-id="${plantEscape(device.id)}">
      <div class="owner-device-summary-head"><span class="owner-device-symbol">${symbol}</span><span class="badge ${tone}">${plantEscape(device.status)}</span></div>
      <div><h3>${plantEscape(device.name)}</h3><p>${plantEscape(device.type)}</p></div>
      <div class="owner-device-reading"><strong>${plantEscape(device.detail)}</strong><small>${plantEscape(device.updated)}</small></div>
    </button>`;
  }).join('');
}

function plantAlertContentMarkup(): string {
  if (endUserPlantState.activeAlerts === null) {
    return `<div class="owner-positive-state owner-plant-positive-state"><div><div class="icon">—</div><h3>Alerts unavailable</h3><p>No alert data was returned by the API.</p></div></div>`;
  }
  if (endUserPlantState.activeAlerts === 0) {
    return `<div class="owner-positive-state owner-plant-positive-state"><div><div class="icon">✓</div><h3>No issues detected</h3><p>The Alerts API returned no open issues for this plant.</p></div></div>`;
  }
  return `<div class="owner-alert-list">${endUserPlantState.alerts.slice(0, 3).map(alert => {
    const records = plantCollectRecords(alert);
    const title = plantScalar(plantPickValue(records, ['title','name','message','description','alertName','code']));
    const severity = plantScalar(plantPickValue(records, ['severity','priority','level']));
    const status = plantScalar(plantPickValue(records, ['status','state']));
    const tone = /critical|high|p1|fatal/i.test(severity) ? 'danger' : /warning|medium|p2|p3/i.test(severity) ? 'warning' : 'info';
    return `<button class="owner-alert-item ${tone}" type="button" data-route="alerts"><span class="owner-alert-icon">${tone === 'danger' ? '!' : tone === 'warning' ? '⚠' : 'i'}</span><div><strong>${plantEscape(title)}</strong><small>${plantEscape(status)}</small></div><span class="badge ${tone}">${plantEscape(severity)}</span></button>`;
  }).join('')}</div>`;
}

function plantPercentNote(numerator: string, denominator: string): string {
  const top = plantNumericValue(numerator);
  const bottom = plantNumericValue(denominator);
  if (top === null || bottom === null || bottom <= 0) return 'API value';
  return `${Math.max(0, Math.min(100, Math.round((top / bottom) * 100)))}% of returned generation`;
}

function renderMyPlant(): string {
  const tone = plantStatusTone();
  const activeAlertLabel = endUserPlantState.activeAlerts === null ? '—' : String(endUserPlantState.activeAlerts);
  const activeAlertNote = endUserPlantState.activeAlerts === null ? 'Alerts API unavailable' : endUserPlantState.activeAlerts ? 'Needs review' : 'No open issues';
  const commercialStatus = endUserPlantState.settlementStatus || 'No data';
  return `<section class="page-hero owner-plant-hero">
    <div class="greeting-copy"><p class="eyebrow">My Solar Asset</p><h1 id="ownerPlantName">${plantEscape(endUserPlantState.name)}</h1><p class="friendly-note"><span id="ownerPlantLocation">${plantEscape(endUserPlantState.location)}</span> · <span id="ownerPlantCapacity">${plantEscape(endUserPlantState.capacity)}</span></p></div>
    <button class="freshness-card" type="button" data-route="energy"><span class="pulse"></span><div><strong>${plantEscape(endUserPlantState.freshnessTitle)}</strong><small id="ownerPlantUpdated">${plantEscape(endUserPlantState.updated)}</small></div></button>
  </section>

  <section class="owner-status-card owner-plant-status ${tone}" id="ownerPlantStatusCard" aria-label="Plant status">
    <div class="owner-status-icon" id="ownerPlantStatusIcon">${plantStatusIcon()}</div>
    <div class="owner-status-copy"><p class="eyebrow">Plant Status</p><h2 id="ownerPlantStatus">${plantEscape(endUserPlantState.status)}</h2><p id="ownerPlantStatusMessage">${plantEscape(endUserPlantState.statusMessage)}</p></div>
    <button class="secondary-action owner-status-action" type="button" data-route="alerts">${endUserPlantState.activeAlerts && endUserPlantState.activeAlerts > 0 ? 'View active issues' : 'View system status'}</button>
  </section>

  <section class="kpi-grid owner-kpi-grid owner-plant-kpi-grid">
    <button class="kpi-card yellow" type="button" data-route="energy"><div class="kpi-icon">⚡</div><div class="kpi-label">Power Now</div><div class="kpi-value" id="plantPowerNow">${plantEscape(endUserPlantState.powerNow)}</div><div class="kpi-delta">Live API value</div></button>
    <button class="kpi-card cyan" type="button" data-route="energy"><div class="kpi-icon">☀️</div><div class="kpi-label">Generated Today</div><div class="kpi-value" id="plantGeneratedToday">${plantEscape(endUserPlantState.generatedToday)}</div><div class="kpi-delta">${plantEscape(endUserPlantState.generatedMonth)} this month</div></button>
    <button class="kpi-card green" type="button" data-route="energy"><div class="kpi-icon">↗</div><div class="kpi-label">Sold Today</div><div class="kpi-value" id="plantSoldToday">${plantEscape(endUserPlantState.soldToday)}</div><div class="kpi-delta">${plantEscape(endUserPlantState.soldMonth)} this month</div></button>
    <button class="kpi-card violet" type="button" data-route="revenue"><div class="kpi-icon">💶</div><div class="kpi-label">Revenue This Month</div><div class="kpi-value">${plantEscape(endUserPlantState.revenueMonth)}</div><div class="kpi-delta">API settlement value</div></button>
  </section>

  <section class="owner-plant-main-grid">
    <article class="panel glass-card owner-plant-energy-card">
      <div class="panel-head"><div><h2>Plant Energy</h2><p>Generated energy and how it was used or sold.</p></div><div class="owner-period-pills owner-plant-periods"><button class="${endUserPlantState.period === 'Today' ? 'active' : ''}" type="button" data-plant-period="Today">Today</button><button class="${endUserPlantState.period === 'Week' ? 'active' : ''}" type="button" data-plant-period="Week">Week</button><button class="${endUserPlantState.period === 'Month' ? 'active' : ''}" type="button" data-plant-period="Month">Month</button></div></div>
      ${plantChartMarkup()}
      <div class="owner-plant-flow-grid">
        <div class="generated"><span>Generated</span><strong>${plantEscape(endUserPlantState.generatedToday)}</strong><small>API value for today</small></div>
        <div class="sold"><span>Sold to grid</span><strong>${plantEscape(endUserPlantState.soldToday)}</strong><small>${plantEscape(plantPercentNote(endUserPlantState.soldToday, endUserPlantState.generatedToday))}</small></div>
        <div class="consumed"><span>Self-consumed</span><strong>${plantEscape(endUserPlantState.selfConsumedToday)}</strong><small>${plantEscape(plantPercentNote(endUserPlantState.selfConsumedToday, endUserPlantState.generatedToday))}</small></div>
        <div class="imported"><span>Imported</span><strong>${plantEscape(endUserPlantState.importedToday)}</strong><small>API grid import value</small></div>
      </div>
      <div class="owner-card-action"><button class="secondary-action" type="button" data-route="energy">Open Energy Details</button></div>
    </article>

    <article class="panel glass-card owner-plant-commercial-card">
      <div class="panel-head"><div><h2>Sales & Settlement</h2><p>Commercial result for the current month.</p></div><span class="badge ${plantEscape(endUserPlantState.settlementTone)}">${plantEscape(commercialStatus)}</span></div>
      <div class="owner-commercial-total"><span>Estimated revenue</span><strong>${plantEscape(endUserPlantState.revenueMonth)}</strong><small>${plantEscape(endUserPlantState.soldMonth)} sold this month</small></div>
      <div class="owner-commercial-progress"><span style="width:${endUserPlantState.settlementProgress}%"></span></div>
      <div class="information-grid owner-plant-commercial-grid">
        <div><span>Received</span><strong>${plantEscape(endUserPlantState.receivedMonth)}</strong><small>Confirmed API value</small></div>
        <div><span>Outstanding</span><strong>${plantEscape(endUserPlantState.outstanding)}</strong><small>Next settlement: ${plantEscape(endUserPlantState.nextSettlement)}</small></div>
        <div><span>Average Tariff</span><strong>${plantEscape(endUserPlantState.tariff)}</strong><small>Returned by API</small></div>
        <div><span>Energy Buyer</span><strong>${plantEscape(endUserPlantState.buyer)}</strong><small>Returned by API</small></div>
      </div>
      <div class="owner-card-action"><button class="primary-action" type="button" data-route="revenue">Open Sales & Revenue</button></div>
    </article>
  </section>

  <section class="owner-plant-secondary-grid">
    <article class="panel glass-card owner-plant-performance-card">
      <div class="panel-head"><div><h2>Performance</h2><p>Simple indicators for plant health and output quality.</p></div></div>
      <div class="owner-performance-score"><div class="owner-performance-ring"><span>${plantEscape(endUserPlantState.performanceRatio)}</span><small>Performance ratio</small></div></div>
      <div class="information-grid owner-performance-grid">
        <div><span>Availability</span><strong>${plantEscape(endUserPlantState.availability)}</strong><small>Returned by API</small></div>
        <div><span>CO₂ Avoided Today</span><strong>${plantEscape(endUserPlantState.co2Avoided)}</strong><small>Returned by API</small></div>
        <div><span>Active Alerts</span><strong id="plantActiveAlerts">${plantEscape(activeAlertLabel)}</strong><small>${plantEscape(activeAlertNote)}</small></div>
        <div><span>Data Freshness</span><strong>${plantEscape(endUserPlantState.freshnessTitle)}</strong><small id="plantFreshnessText">${plantEscape(endUserPlantState.updated)}</small></div>
      </div>
    </article>

    <article class="panel glass-card owner-plant-info-card">
      <div class="panel-head"><div><h2>Plant Information</h2><p>Key information about your assigned asset.</p></div></div>
      <div class="information-grid owner-plant-info-grid">
        <div><span>Plant Name</span><strong>${plantEscape(endUserPlantState.name)}</strong><small>${plantEscape(endUserPlantState.id)}</small></div>
        <div><span>Location</span><strong>${plantEscape(endUserPlantState.location)}</strong><small>Returned by API</small></div>
        <div><span>Installed Capacity</span><strong>${plantEscape(endUserPlantState.capacity)}</strong><small>Returned by API</small></div>
        <div><span>Commissioned</span><strong>${plantEscape(endUserPlantState.commissioned)}</strong><small>Returned by API</small></div>
        <div><span>Energy Buyer</span><strong>${plantEscape(endUserPlantState.buyer)}</strong><small>Returned by API</small></div>
        <div><span>Next Settlement</span><strong>${plantEscape(endUserPlantState.nextSettlement)}</strong><small>Returned by API</small></div>
      </div>
    </article>
  </section>

  <section class="owner-plant-devices-section panel glass-card">
    <div class="panel-head"><div><h2>Devices</h2><p>A simple view of the equipment that keeps your plant running.</p></div><button class="secondary-action" type="button" data-route="devices">View All Devices</button></div>
    <div class="owner-device-summary-grid" id="ownerPlantDevices">${plantDevicesMarkup()}</div>
  </section>

  <section class="owner-plant-bottom-grid">
    <article class="panel glass-card owner-plant-alert-card">
      <div class="panel-head"><div><h2>Plant Alerts</h2><p>Only owner-relevant issues are shown.</p></div><button class="secondary-action" type="button" data-route="alerts">Open Alerts</button></div>
      <div id="ownerPlantAlertContent">${plantAlertContentMarkup()}</div>
    </article>

    <article class="panel glass-card owner-plant-quick-actions">
      <div class="panel-head"><div><h2>Quick Actions</h2><p>Open the information you use most often.</p></div></div>
      <div class="owner-quick-action-grid">
        <button type="button" data-route="energy"><span>⚡</span><div><strong>Energy</strong><small>Generation and exported energy</small></div></button>
        <button type="button" data-route="revenue"><span>💶</span><div><strong>Sales & Revenue</strong><small>Settlements and payments</small></div></button>
        <button type="button" data-route="reports"><span>📄</span><div><strong>Reports</strong><small>Download monthly statements</small></div></button>
        <button type="button" data-route="devices"><span>🔌</span><div><strong>Devices</strong><small>Equipment status</small></div></button>
      </div>
    </article>
  </section>`;
}

function plantFindSelected(plants: EndUserPlantAnyRecord[]): EndUserPlantAnyRecord | null {
  const selectedId = localStorage.getItem('zentrid_end_user_plant_id') || '';
  if (selectedId) {
    const selected = plants.find(row => plantText(plantCollectRecords(row), ['id','plantId','plant_id','uuid']) === selectedId);
    if (selected) return selected;
  }
  return plants[0] || null;
}

function plantDeviceFromRow(row: EndUserPlantAnyRecord): EndUserPlantDevice {
  const records = plantCollectRecords(row);
  const id = plantText(records, ['id','deviceId','device_id','uuid','serialNumber','serial']);
  const name = plantText(records, ['name','deviceName','device_name','displayName','title']) || plantText(records, ['type','deviceType','device_type']) || 'Device';
  const type = plantText(records, ['type','deviceType','device_type','category','assetType']) || 'Device';
  const status = plantNormalizeDeviceStatus(plantText(records, ['status','state','connectivityStatus','operationalStatus','healthStatus']));
  const detail = plantMetric(records, [
    { keys:['currentPowerMw','activePowerMw','powerMw'], unit:'MW' },
    { keys:['currentPowerKw','activePowerKw','powerKw','outputPowerKw'], unit:'kW' },
    { keys:['currentPower','powerNow','activePower','power','outputPower'] },
    { keys:['energyTodayMwh','todayEnergyMwh','dailyEnergyMwh'], unit:'MWh' },
    { keys:['energyTodayKwh','todayEnergyKwh','dailyEnergyKwh'], unit:'kWh' },
    { keys:['energyToday','todayEnergy','dailyEnergy','irradiance','temperature','value'] }
  ]);
  const updated = plantDate(records, ['updatedAt','lastSeenAt','lastUpdate','lastTelemetryAt','timestamp','recordedAt']);
  return { id, name, type, status, detail, updated };
}

function plantApplyFreshness(api: any): void {
  const names = ['overview','dashboard','plants','devices','alerts',`energy:${endUserPlantState.period}`];
  const states = names.map(name => api?.getState?.(name)).filter(Boolean);
  const cached = states.some((state: EndUserPlantAnyRecord) => state.state === 'cached');
  const live = states.some((state: EndUserPlantAnyRecord) => state.state === 'live');
  const empty = states.some((state: EndUserPlantAnyRecord) => state.state === 'empty');
  const fetchedAt = states.map((state: EndUserPlantAnyRecord) => Date.parse(String(state.fetchedAt || ''))).filter(Number.isFinite).sort((a: number, b: number) => b - a)[0];
  if (cached) endUserPlantState.freshnessTitle = 'Saved API data';
  else if (live) endUserPlantState.freshnessTitle = 'Plant data is fresh';
  else if (empty) endUserPlantState.freshnessTitle = 'No plant data returned';
  else endUserPlantState.freshnessTitle = 'Plant data unavailable';
  endUserPlantState.updated = fetchedAt
    ? `Updated ${new Intl.DateTimeFormat('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }).format(new Date(fetchedAt))}`
    : 'No successful API response';
}

function plantApplyPayloads(api: any): void {
  const selectedPlant = plantFindSelected(plantPayloads.plants);
  const plantRecords = selectedPlant ? plantCollectRecords(selectedPlant) : [];
  const allRecords = plantCollectRecords({
    overview: plantPayloads.overview,
    dashboard: plantPayloads.dashboard,
    plant: selectedPlant || {},
    energy: plantPayloads.energy
  });

  endUserPlantState.id = plantScalar(plantPickValue(plantRecords, ['id','plantId','plant_id','uuid']));
  endUserPlantState.name = plantScalar(plantPickValue(plantRecords, ['name','plantName','plant_name','displayName','title']));
  endUserPlantState.location = plantScalar(plantPickValue(plantRecords, ['location','address','siteAddress','city','region']));
  endUserPlantState.capacity = plantMetric(plantRecords, [
    { keys:['installedCapacityMw','dcCapacityMw','capacityMw'], unit:'MW' },
    { keys:['installedCapacityKw','dcCapacityKw','capacityKw'], unit:'kW' },
    { keys:['installedCapacity','capacity','dcCapacity','nameplateCapacity'] }
  ]);
  endUserPlantState.commissioned = plantDate(plantRecords, ['commissionedAt','commissioningDate','commercialOperationDate','cod','startDate']);
  endUserPlantState.powerNow = plantMetric(allRecords, [
    { keys:['currentPowerMw','powerNowMw','activePowerMw'], unit:'MW' },
    { keys:['currentPowerKw','powerNowKw','activePowerKw'], unit:'kW' },
    { keys:['currentPower','powerNow','activePower','livePower','power'] }
  ]);
  endUserPlantState.generatedToday = plantMetric(allRecords, [
    { keys:['generatedTodayMwh','energyTodayMwh','todayEnergyMwh','dailyEnergyMwh'], unit:'MWh' },
    { keys:['generatedTodayKwh','energyTodayKwh','todayEnergyKwh','dailyEnergyKwh'], unit:'kWh' },
    { keys:['generatedToday','energyToday','todayEnergy','dailyEnergy','generationToday'] }
  ]);
  endUserPlantState.generatedMonth = plantMetric(allRecords, [
    { keys:['generatedMonthMwh','energyMonthMwh','monthEnergyMwh','monthlyEnergyMwh'], unit:'MWh' },
    { keys:['generatedMonthKwh','energyMonthKwh','monthEnergyKwh','monthlyEnergyKwh'], unit:'kWh' },
    { keys:['generatedMonth','energyMonth','monthEnergy','monthlyEnergy','generationMonth'] }
  ]);
  endUserPlantState.soldToday = plantMetric(allRecords, [
    { keys:['soldTodayMwh','energySoldTodayMwh','exportTodayMwh'], unit:'MWh' },
    { keys:['soldTodayKwh','energySoldTodayKwh','exportTodayKwh'], unit:'kWh' },
    { keys:['soldToday','energySoldToday','soldEnergyToday','exportedToday','gridExportToday'] }
  ]);
  endUserPlantState.soldMonth = plantMetric(allRecords, [
    { keys:['soldMonthMwh','energySoldMonthMwh','exportMonthMwh'], unit:'MWh' },
    { keys:['soldMonthKwh','energySoldMonthKwh','exportMonthKwh'], unit:'kWh' },
    { keys:['soldMonth','energySoldMonth','soldEnergyMonth','exportedMonth','gridExportMonth'] }
  ]);
  endUserPlantState.selfConsumedToday = plantMetric(allRecords, [
    { keys:['selfConsumedTodayMwh','selfConsumptionTodayMwh'], unit:'MWh' },
    { keys:['selfConsumedTodayKwh','selfConsumptionTodayKwh'], unit:'kWh' },
    { keys:['selfConsumedToday','selfConsumptionToday','consumedToday','loadEnergyToday'] }
  ]);
  endUserPlantState.importedToday = plantMetric(allRecords, [
    { keys:['importedTodayMwh','gridImportTodayMwh'], unit:'MWh' },
    { keys:['importedTodayKwh','gridImportTodayKwh'], unit:'kWh' },
    { keys:['importedToday','gridImportToday','importEnergyToday'] }
  ]);
  endUserPlantState.revenueMonth = plantMoney(allRecords, ['revenueMonth','monthlyRevenue','estimatedRevenue','estimatedGross','grossRevenue','revenue']);
  endUserPlantState.receivedMonth = plantMoney(allRecords, ['receivedMonth','amountReceived','received','paidAmount','paymentReceived']);
  endUserPlantState.outstanding = plantMoney(allRecords, ['outstanding','outstandingAmount','amountOutstanding','remainingAmount','balanceDue']);
  endUserPlantState.tariff = plantMetric(allRecords, [
    { keys:['averageTariff','tariff','contractRate','ratePerKwh','energyRate'] }
  ]);
  endUserPlantState.buyer = plantScalar(plantPickValue(allRecords, ['buyer','energyBuyer','offtaker','counterparty','settlementCounterparty']));
  endUserPlantState.nextSettlement = plantDate(allRecords, ['nextSettlement','nextSettlementDate','settlementDate','expectedSettlementAt']);
  endUserPlantState.performanceRatio = plantMetric(allRecords, [
    { keys:['performanceRatioPercent','prPercent'], unit:'%' },
    { keys:['performanceRatio','pr'] }
  ]);
  endUserPlantState.availability = plantMetric(allRecords, [
    { keys:['availabilityPercent','plantAvailabilityPercent'], unit:'%' },
    { keys:['availability','plantAvailability'] }
  ]);
  endUserPlantState.co2Avoided = plantMetric(allRecords, [
    { keys:['co2AvoidedTons','co2AvoidedTonnes'], unit:'t' },
    { keys:['co2AvoidedKg'], unit:'kg' },
    { keys:['co2Avoided','carbonAvoided','emissionsAvoided'] }
  ]);
  endUserPlantState.settlementStatus = plantScalar(plantPickValue(allRecords, ['settlementStatus','paymentStatus','statusLabel']));
  endUserPlantState.settlementTone = /paid|complete|settled|success/i.test(endUserPlantState.settlementStatus) ? 'success' : /overdue|failed|problem|blocked/i.test(endUserPlantState.settlementStatus) ? 'danger' : endUserPlantState.settlementStatus === '—' ? 'neutral' : 'warning';
  const gross = plantNumberFrom(allRecords, ['estimatedGross','grossRevenue','revenueMonth','monthlyRevenue','revenue']);
  const received = plantNumberFrom(allRecords, ['receivedMonth','amountReceived','received','paidAmount','paymentReceived']);
  const apiProgress = plantNumberFrom(allRecords, ['settlementProgress','paymentProgress','receivedPercent','progressPercent']);
  endUserPlantState.settlementProgress = apiProgress !== null ? Math.max(0, Math.min(100, apiProgress)) : gross !== null && gross > 0 && received !== null ? Math.max(0, Math.min(100, (received / gross) * 100)) : 0;

  if (selectedPlant && endUserPlantState.id !== '—') localStorage.setItem('zentrid_end_user_plant_id', endUserPlantState.id);
  if (selectedPlant && endUserPlantState.name !== '—') {
    localStorage.setItem('zentrid_end_user_plant', endUserPlantState.name);
    window.ZentridEndUserLayout.state.plant = endUserPlantState.name;
  }

  const relatedDevices = plantPayloads.devices.filter(row => plantRelated(row, endUserPlantState.id, endUserPlantState.name));
  endUserPlantState.devices = relatedDevices.map(plantDeviceFromRow);

  const relatedAlerts = plantPayloads.alerts.filter(row => plantRelated(row, endUserPlantState.id, endUserPlantState.name));
  const openAlerts = relatedAlerts.filter(row => {
    const status = plantText(plantCollectRecords(row), ['status','state','lifecycleStatus','resolutionStatus']).toLowerCase();
    return !['resolved','closed','cleared','normal','recovered'].some(token => status.includes(token));
  });
  const alertsState = api?.getState?.('alerts');
  endUserPlantState.activeAlerts = alertsState?.state === 'error' ? null : openAlerts.length;
  endUserPlantState.alerts = openAlerts;
  endUserPlantState.energyPoints = plantFindEnergyPoints([plantPayloads.energy, plantPayloads.dashboard, selectedPlant]);

  const explicitStatus = plantNormalizeStatus(plantText(plantRecords, ['status','state','operationalStatus','healthStatus','plantStatus']));
  const deviceStatuses = endUserPlantState.devices.map(device => device.status);
  const hasCriticalAlert = openAlerts.some(row => /critical|fatal|p1|high|major/i.test(plantText(plantCollectRecords(row), ['severity','priority','level'])));
  if (hasCriticalAlert || deviceStatuses.includes('Offline') || explicitStatus === 'Problem Detected') endUserPlantState.status = 'Problem Detected';
  else if (openAlerts.length > 0 || deviceStatuses.includes('Needs Attention') || explicitStatus === 'Needs Attention') endUserPlantState.status = 'Needs Attention';
  else if (explicitStatus === 'Normal' || (endUserPlantState.devices.length > 0 && deviceStatuses.every(status => status === 'Online'))) endUserPlantState.status = 'Normal';
  else endUserPlantState.status = 'Unavailable';

  const apiMessage = plantText(allRecords, ['statusMessage','plantStatusMessage','ownerMessage','healthMessage','summary']);
  if (apiMessage) endUserPlantState.statusMessage = apiMessage;
  else if (endUserPlantState.status === 'Problem Detected') endUserPlantState.statusMessage = `${openAlerts.length} API issue${openAlerts.length === 1 ? '' : 's'} or offline equipment may affect this plant.`;
  else if (endUserPlantState.status === 'Needs Attention') endUserPlantState.statusMessage = `${openAlerts.length} API issue${openAlerts.length === 1 ? '' : 's'} or degraded equipment needs review.`;
  else if (endUserPlantState.status === 'Normal') endUserPlantState.statusMessage = 'The API reports no open plant issues and connected equipment is operating normally.';
  else endUserPlantState.statusMessage = 'No conclusive plant status was returned by the API.';

  plantApplyFreshness(api);
}

function renderAndWireMyPlant(): void {
  window.ZentridEndUserLayout.mount(renderMyPlant());
  wireMyPlant();
}

async function loadMyPlant(): Promise<void> {
  const api = window.ZentridEndUserAPI;
  if (!api) {
    endUserPlantState.statusMessage = 'The End User API client is not available.';
    endUserPlantState.freshnessTitle = 'Plant data unavailable';
    endUserPlantState.updated = 'API client unavailable';
    renderAndWireMyPlant();
    return;
  }
  const [overview, dashboard, plants, alerts, energy] = await Promise.all([
    api.overview?.(),
    api.dashboard?.('Today', 1, 100),
    api.plants?.(),
    api.alerts?.(),
    api.energy?.(endUserPlantState.period)
  ]);
  const plantRows = Array.isArray(plants) ? plants : [];
  const selectedPlant = plantFindSelected(plantRows);
  const selectedRecords = selectedPlant ? plantCollectRecords(selectedPlant) : [];
  const selectedId = plantText(selectedRecords, ['id','plantId','plant_id','uuid']);
  const devices = await api.devices?.({ page:1, size:100, plantId:selectedId || undefined });
  plantPayloads = {
    overview: plantIsRecord(overview) ? overview : {},
    dashboard: plantIsRecord(dashboard) ? dashboard : {},
    plants: plantRows,
    devices: Array.isArray(devices) ? devices : [],
    alerts: Array.isArray(alerts) ? alerts : [],
    energy: plantIsRecord(energy) ? energy : {}
  };
  plantApplyPayloads(api);
  renderAndWireMyPlant();
}

async function loadPlantPeriod(period: EndUserPlantPeriod): Promise<void> {
  const api = window.ZentridEndUserAPI;
  if (!api?.energy) return;
  endUserPlantState.period = period;
  renderAndWireMyPlant();
  const energy = await api.energy(period);
  plantPayloads.energy = plantIsRecord(energy) ? energy : {};
  plantApplyPayloads(api);
  renderAndWireMyPlant();
}

function wireMyPlant(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-plant-period]').forEach(button => button.addEventListener('click', () => {
    const period = button.dataset.plantPeriod as EndUserPlantPeriod | undefined;
    if (!period || period === endUserPlantState.period) return;
    void loadPlantPeriod(period);
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-device-id]').forEach(button => button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    const id = button.dataset.deviceId || '';
    if (!id) return;
    localStorage.setItem('zentrid_end_user_device_id', id);
    window.location.href = `${window.ZentridEndUserLayout.pathFor('device-detail')}?id=${encodeURIComponent(id)}`;
  }));
}

renderAndWireMyPlant();
void loadMyPlant();
