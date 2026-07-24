(() => {
  type AnyRecord = Record<string, unknown>;
  type EnergyPeriodKey = 'today' | 'week' | 'month' | 'year';
  type ApiPeriod = 'Today' | 'Week' | 'Month' | 'Year';
  type MetricValue = {
    value: number | null;
    display: string;
    unit: string;
  };
  type EnergyPoint = {
    label: string;
    generated: MetricValue;
    sold: MetricValue;
    consumed: MetricValue;
    imported: MetricValue;
  };
  type EnergyView = {
    key: EnergyPeriodKey;
    apiPeriod: ApiPeriod;
    label: string;
    generated: string;
    sold: string;
    consumed: string;
    imported: string;
    peakPower: string;
    specificYield: string;
    exportShare: number | null;
    co2Avoided: string;
    comparison: string;
    bestInterval: string;
    completeness: string;
    estimatedRevenue: string;
    averageTariff: string;
    buyer: string;
    calculationStatus: string;
    points: EnergyPoint[];
    freshnessTitle: string;
    freshnessCopy: string;
    freshnessTone: string;
  };

  const periodConfig: Record<EnergyPeriodKey, { apiPeriod: ApiPeriod; label: string }> = {
    today: { apiPeriod: 'Today', label: 'Today' },
    week: { apiPeriod: 'Week', label: 'This Week' },
    month: { apiPeriod: 'Month', label: 'This Month' },
    year: { apiPeriod: 'Year', label: 'This Year' }
  };

  let activePeriod: EnergyPeriodKey = 'today';
  let activeView = emptyView(activePeriod, 'loading');
  let requestSequence = 0;

  function isRecord(value: unknown): value is AnyRecord {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function escapeValue(value: unknown): string {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character] || character));
  }

  function recordEntries(record: AnyRecord): Array<[string, unknown]> {
    return Object.entries(record);
  }

  function keyValue(record: AnyRecord, candidates: string[]): { key: string; value: unknown } | null {
    const candidateSet = new Set(candidates.map(candidate => candidate.toLowerCase()));
    for (const [key, value] of recordEntries(record)) {
      if (candidateSet.has(key.toLowerCase())) return { key, value };
    }
    return null;
  }

  function collectRecords(value: unknown, depth = 0, seen = new Set<object>()): AnyRecord[] {
    if (depth > 6 || value === null || value === undefined) return [];
    if (Array.isArray(value)) return value.flatMap(item => collectRecords(item, depth + 1, seen));
    if (!isRecord(value)) return [];
    if (seen.has(value)) return [];
    seen.add(value);
    return [value, ...Object.values(value).flatMap(item => collectRecords(item, depth + 1, seen))];
  }

  function pickValue(records: AnyRecord[], candidates: string[]): unknown {
    for (const record of records) {
      const match = keyValue(record, candidates);
      if (match && match.value !== undefined && match.value !== null && String(match.value).trim() !== '') return match.value;
    }
    return undefined;
  }

  function scalar(value: unknown): string {
    if (value === undefined || value === null || String(value).trim() === '') return '—';
    if (typeof value === 'number' && Number.isFinite(value)) return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value).trim() || '—';
  }

  function numeric(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return null;
    const normalized = value.replace(/\s/g, '').replace(/,/g, '').replace(/[^0-9.+-]/g, '');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function unitFromKey(key: string): string {
    const lower = key.toLowerCase();
    if (lower.includes('gwh')) return 'GWh';
    if (lower.includes('mwh')) return 'MWh';
    if (lower.includes('kwh')) return 'kWh';
    if (/(^|_)wh($|_)/.test(lower) || lower.endsWith('wh')) return 'Wh';
    if (lower.includes('mwp')) return 'MWp';
    if (lower.includes('kwp')) return 'kWp';
    if (lower.includes('mw')) return 'MW';
    if (lower.includes('kw')) return 'kW';
    if (lower.includes('percent') || lower.endsWith('pct')) return '%';
    if (lower.includes('tonne') || lower.includes('tons')) return 't';
    if (lower.includes('kg')) return 'kg';
    return '';
  }

  function unitFromText(value: string): string {
    const match = value.match(/\b(GWh|MWh|kWh|Wh|MWp|kWp|MW|kW|kg|t|%)\b/i);
    if (!match) return '';
    const unit = match[1] || '';
    if (/^gwh$/i.test(unit)) return 'GWh';
    if (/^mwh$/i.test(unit)) return 'MWh';
    if (/^kwh$/i.test(unit)) return 'kWh';
    if (/^wh$/i.test(unit)) return 'Wh';
    if (/^mwp$/i.test(unit)) return 'MWp';
    if (/^kwp$/i.test(unit)) return 'kWp';
    if (/^mw$/i.test(unit)) return 'MW';
    if (/^kw$/i.test(unit)) return 'kW';
    if (/^kg$/i.test(unit)) return 'kg';
    if (/^t$/i.test(unit)) return 't';
    return '%';
  }

  function formatNumber(value: number): string {
    return new Intl.NumberFormat('en-GB', { maximumFractionDigits: value >= 100 ? 0 : 2 }).format(value);
  }

  function metricFromRecord(record: AnyRecord, keys: string[], fallbackUnit = ''): MetricValue {
    const match = keyValue(record, keys);
    if (!match || match.value === undefined || match.value === null || String(match.value).trim() === '') return { value:null, display:'—', unit:'' };
    const explicitUnit = scalar(pickValue([record], ['unit','energyUnit','measurementUnit','uom','displayUnit']));
    const unit = unitFromKey(match.key) || (explicitUnit === '—' ? '' : explicitUnit) || (typeof match.value === 'string' ? unitFromText(match.value) : '') || fallbackUnit;
    const value = numeric(match.value);
    if (value === null) return { value:null, display:scalar(match.value), unit };
    return { value, display:`${formatNumber(value)}${unit ? ` ${unit}` : ''}`, unit };
  }

  function metricFromRecords(records: AnyRecord[], groups: Array<{ keys:string[]; unit?:string }>): MetricValue {
    for (const record of records) {
      for (const group of groups) {
        const metric = metricFromRecord(record, group.keys, group.unit || '');
        if (metric.display !== '—') return metric;
      }
    }
    return { value:null, display:'—', unit:'' };
  }

  function energyMetric(record: AnyRecord, kind: 'generated' | 'sold' | 'consumed' | 'imported'): MetricValue {
    const definitions: Record<typeof kind, Array<{ keys:string[]; unit?:string }>> = {
      generated: [
        { keys:['generatedMwh','generationMwh','energyGeneratedMwh','generatedEnergyMwh','productionMwh'], unit:'MWh' },
        { keys:['generatedKwh','generationKwh','energyGeneratedKwh','generatedEnergyKwh','productionKwh'], unit:'kWh' },
        { keys:['generatedWh','generationWh','energyGeneratedWh','productionWh'], unit:'Wh' },
        { keys:['generated','generation','energyGenerated','generatedEnergy','production','produced','yield','value'] }
      ],
      sold: [
        { keys:['soldMwh','energySoldMwh','soldEnergyMwh','exportMwh','exportedMwh','gridExportMwh'], unit:'MWh' },
        { keys:['soldKwh','energySoldKwh','soldEnergyKwh','exportKwh','exportedKwh','gridExportKwh'], unit:'kWh' },
        { keys:['soldWh','energySoldWh','exportWh','gridExportWh'], unit:'Wh' },
        { keys:['sold','energySold','soldEnergy','exported','exportEnergy','gridExport'] }
      ],
      consumed: [
        { keys:['selfConsumedMwh','selfConsumptionMwh','consumedMwh','consumptionMwh','loadEnergyMwh'], unit:'MWh' },
        { keys:['selfConsumedKwh','selfConsumptionKwh','consumedKwh','consumptionKwh','loadEnergyKwh'], unit:'kWh' },
        { keys:['selfConsumedWh','selfConsumptionWh','consumedWh','consumptionWh'], unit:'Wh' },
        { keys:['selfConsumed','selfConsumption','consumed','consumption','loadEnergy','usedOnSite'] }
      ],
      imported: [
        { keys:['importedMwh','gridImportMwh','importEnergyMwh'], unit:'MWh' },
        { keys:['importedKwh','gridImportKwh','importEnergyKwh'], unit:'kWh' },
        { keys:['importedWh','gridImportWh','importEnergyWh'], unit:'Wh' },
        { keys:['imported','gridImport','importEnergy','purchasedEnergy'] }
      ]
    };
    return metricFromRecords([record], definitions[kind]);
  }

  function pointLabel(record: AnyRecord, index: number, period: EnergyPeriodKey): string {
    const value = pickValue([record], ['label','periodLabel','bucketLabel','timeLabel','timestamp','time','date','intervalStart','recordedAt','startTime']);
    if (value === undefined || value === null || String(value).trim() === '') return String(index + 1);
    const text = String(value).trim();
    const timestamp = Date.parse(text);
    if (!Number.isFinite(timestamp)) return text;
    const date = new Date(timestamp);
    if (period === 'today') return new Intl.DateTimeFormat('en-GB', { hour:'2-digit', minute:'2-digit' }).format(date);
    if (period === 'week') return new Intl.DateTimeFormat('en-GB', { weekday:'short' }).format(date);
    if (period === 'month') return new Intl.DateTimeFormat('en-GB', { day:'2-digit', month:'short' }).format(date);
    return new Intl.DateTimeFormat('en-GB', { month:'short', year:'2-digit' }).format(date);
  }

  function pointFromRecord(record: AnyRecord, index: number, period: EnergyPeriodKey): EnergyPoint | null {
    const generated = energyMetric(record, 'generated');
    const sold = energyMetric(record, 'sold');
    const consumed = energyMetric(record, 'consumed');
    const imported = energyMetric(record, 'imported');
    if ([generated,sold,consumed,imported].every(metric => metric.display === '—')) return null;
    return { label:pointLabel(record,index,period), generated, sold, consumed, imported };
  }

  function seriesRecords(payload: unknown, period: EnergyPeriodKey): AnyRecord[] {
    const candidates: AnyRecord[][] = [];
    const visit = (value: unknown, depth = 0): void => {
      if (depth > 6 || value === null || value === undefined) return;
      if (Array.isArray(value)) {
        const records = value.filter(isRecord);
        if (records.length) candidates.push(records);
        value.forEach(item => visit(item, depth + 1));
        return;
      }
      if (!isRecord(value)) return;
      Object.values(value).forEach(item => visit(item, depth + 1));
    };
    visit(payload);
    candidates.sort((left, right) => right.length - left.length);
    return candidates.find(rows => rows.some(row => pointFromRecord(row, 0, period))) || [];
  }

  function summaryRecords(payload: unknown): AnyRecord[] {
    if (!isRecord(payload)) return [];
    const records: AnyRecord[] = [payload];
    const visit = (record: AnyRecord, depth: number): void => {
      if (depth > 3) return;
      for (const [key, value] of Object.entries(record)) {
        if (!isRecord(value)) continue;
        if (/summary|total|aggregate|metric|kpi|overview|current|period/i.test(key)) records.push(value);
        visit(value, depth + 1);
      }
    };
    visit(payload, 0);
    return Array.from(new Set(records));
  }

  function seriesItemMetric(item: unknown, series: AnyRecord): MetricValue {
    const raw = isRecord(item) ? pickValue([item], ['y','value','amount','energy']) : item;
    if (raw === undefined || raw === null || String(raw).trim() === '') return { value:null, display:'—', unit:'' };
    const seriesUnitValue = pickValue([series], ['unit','energyUnit','measurementUnit','uom','displayUnit']);
    const seriesNameValue = pickValue([series], ['name','label','key','metric']);
    const unit = (seriesUnitValue === undefined ? '' : scalar(seriesUnitValue)) || (seriesNameValue === undefined ? '' : unitFromText(String(seriesNameValue))) || (typeof raw === 'string' ? unitFromText(raw) : '');
    const value = numeric(raw);
    if (value === null) return { value:null, display:scalar(raw), unit };
    return { value, display:`${formatNumber(value)}${unit && unit !== '—' ? ` ${unit}` : ''}`, unit:unit === '—' ? '' : unit };
  }

  function namedSeriesPoints(payload: unknown, period: EnergyPeriodKey): EnergyPoint[] {
    const containers = collectRecords(payload).filter(record => Array.isArray(record.series));
    let best: EnergyPoint[] = [];
    for (const container of containers) {
      const series = (container.series as unknown[]).filter(isRecord);
      const findSeries = (pattern: RegExp): AnyRecord | undefined => series.find(item => pattern.test(String(pickValue([item], ['name','label','key','metric']) || '')));
      const generatedSeries = findSeries(/generat|produc|yield/i);
      const soldSeries = findSeries(/sold|export/i);
      const consumedSeries = findSeries(/self.?consum|consum|load/i);
      const importedSeries = findSeries(/import|purchas/i);
      const selected = [generatedSeries,soldSeries,consumedSeries,importedSeries].filter((item): item is AnyRecord => Boolean(item));
      if (!selected.length) continue;
      const arrays = selected.map(item => Array.isArray(item.data) ? item.data as unknown[] : Array.isArray(item.values) ? item.values as unknown[] : []);
      const length = Math.max(...arrays.map(items => items.length), 0);
      const categories = Array.isArray(container.categories) ? container.categories : [];
      const points: EnergyPoint[] = [];
      for (let index = 0; index < length; index += 1) {
        const generatedItem = Array.isArray(generatedSeries?.data) ? generatedSeries.data[index] : Array.isArray(generatedSeries?.values) ? generatedSeries.values[index] : undefined;
        const soldItem = Array.isArray(soldSeries?.data) ? soldSeries.data[index] : Array.isArray(soldSeries?.values) ? soldSeries.values[index] : undefined;
        const consumedItem = Array.isArray(consumedSeries?.data) ? consumedSeries.data[index] : Array.isArray(consumedSeries?.values) ? consumedSeries.values[index] : undefined;
        const importedItem = Array.isArray(importedSeries?.data) ? importedSeries.data[index] : Array.isArray(importedSeries?.values) ? importedSeries.values[index] : undefined;
        const sourceRecord = [generatedItem,soldItem,consumedItem,importedItem].find(isRecord) as AnyRecord | undefined;
        const labelValue = sourceRecord ? pickValue([sourceRecord], ['x','label','time','timestamp','date']) : categories[index];
        const labelRecord: AnyRecord = { label:labelValue ?? String(index + 1) };
        const point: EnergyPoint = {
          label:pointLabel(labelRecord,index,period),
          generated:generatedSeries ? seriesItemMetric(generatedItem, generatedSeries) : { value:null, display:'—', unit:'' },
          sold:soldSeries ? seriesItemMetric(soldItem, soldSeries) : { value:null, display:'—', unit:'' },
          consumed:consumedSeries ? seriesItemMetric(consumedItem, consumedSeries) : { value:null, display:'—', unit:'' },
          imported:importedSeries ? seriesItemMetric(importedItem, importedSeries) : { value:null, display:'—', unit:'' }
        };
        if ([point.generated,point.sold,point.consumed,point.imported].some(metric => metric.display !== '—')) points.push(point);
      }
      if (points.length > best.length) best = points;
    }
    return best;
  }

  function energyPoints(payload: unknown, period: EnergyPeriodKey): EnergyPoint[] {
    const directRows = seriesRecords(payload, period);
    const direct = directRows.map((row, index) => pointFromRecord(row, index, period)).filter((point): point is EnergyPoint => Boolean(point));
    const named = namedSeriesPoints(payload, period);
    return named.length > direct.length ? named : direct;
  }

  function metricValueToBase(metric: MetricValue): number | null {
    if (metric.value === null) return null;
    const unit = metric.unit.toLowerCase();
    if (unit === 'gwh') return metric.value * 1_000_000;
    if (unit === 'mwh') return metric.value * 1_000;
    if (unit === 'kwh') return metric.value;
    if (unit === 'wh') return metric.value / 1_000;
    return metric.value;
  }

  function aggregate(points: EnergyPoint[], key: 'generated' | 'sold' | 'consumed' | 'imported'): MetricValue {
    const values = points.map(point => metricValueToBase(point[key])).filter((value): value is number => value !== null);
    if (!values.length) return { value:null, display:'—', unit:'' };
    const totalKwh = values.reduce((sum, value) => sum + value, 0);
    if (totalKwh >= 1_000_000) return { value:totalKwh / 1_000_000, display:`${formatNumber(totalKwh / 1_000_000)} GWh`, unit:'GWh' };
    if (totalKwh >= 1_000) return { value:totalKwh / 1_000, display:`${formatNumber(totalKwh / 1_000)} MWh`, unit:'MWh' };
    return { value:totalKwh, display:`${formatNumber(totalKwh)} kWh`, unit:'kWh' };
  }

  function directTotal(records: AnyRecord[], kind: 'generated' | 'sold' | 'consumed' | 'imported'): MetricValue {
    const suffixes: Record<typeof kind, Array<{ keys:string[]; unit?:string }>> = {
      generated: [
        { keys:['totalGeneratedMwh','generatedTotalMwh','generationTotalMwh','generatedMwh','generationMwh','energyGeneratedMwh'], unit:'MWh' },
        { keys:['totalGeneratedKwh','generatedTotalKwh','generationTotalKwh','generatedKwh','generationKwh','energyGeneratedKwh'], unit:'kWh' },
        { keys:['totalGenerated','generatedTotal','generated','generation','energyGenerated','generatedEnergy','production'] }
      ],
      sold: [
        { keys:['totalSoldMwh','soldTotalMwh','energySoldMwh','soldMwh','exportMwh','gridExportMwh'], unit:'MWh' },
        { keys:['totalSoldKwh','soldTotalKwh','energySoldKwh','soldKwh','exportKwh','gridExportKwh'], unit:'kWh' },
        { keys:['totalSold','soldTotal','sold','energySold','soldEnergy','exported','gridExport'] }
      ],
      consumed: [
        { keys:['totalSelfConsumedMwh','selfConsumedTotalMwh','selfConsumedMwh','consumedMwh','consumptionMwh'], unit:'MWh' },
        { keys:['totalSelfConsumedKwh','selfConsumedTotalKwh','selfConsumedKwh','consumedKwh','consumptionKwh'], unit:'kWh' },
        { keys:['totalSelfConsumed','selfConsumedTotal','selfConsumed','selfConsumption','consumed','consumption'] }
      ],
      imported: [
        { keys:['totalImportedMwh','importedTotalMwh','importedMwh','gridImportMwh'], unit:'MWh' },
        { keys:['totalImportedKwh','importedTotalKwh','importedKwh','gridImportKwh'], unit:'kWh' },
        { keys:['totalImported','importedTotal','imported','gridImport','importEnergy'] }
      ]
    };
    return metricFromRecords(records, suffixes[kind]);
  }

  function displayTotal(records: AnyRecord[], points: EnergyPoint[], kind: 'generated' | 'sold' | 'consumed' | 'imported'): MetricValue {
    const direct = directTotal(records, kind);
    return direct.display !== '—' ? direct : aggregate(points, kind);
  }

  function money(records: AnyRecord[], amountKeys: string[]): string {
    const value = pickValue(records, amountKeys);
    if (value === undefined || value === null || String(value).trim() === '') return '—';
    if (typeof value === 'string' && /[^0-9.,+\-\s]/.test(value)) return value.trim();
    const amount = numeric(value);
    if (amount === null) return scalar(value);
    const currencyValue = pickValue(records, ['currency','currencyCode','settlementCurrency','paymentCurrency']);
    const currency = typeof currencyValue === 'string' && /^[A-Z]{3}$/.test(currencyValue.trim().toUpperCase()) ? currencyValue.trim().toUpperCase() : '';
    if (!currency) return formatNumber(amount);
    try { return new Intl.NumberFormat('en-GB', { style:'currency', currency, maximumFractionDigits:2 }).format(amount); }
    catch (_error) { return `${formatNumber(amount)} ${currency}`; }
  }

  function bestInterval(points: EnergyPoint[]): string {
    const available = points.map(point => ({ point, value:metricValueToBase(point.generated) })).filter((item): item is { point:EnergyPoint; value:number } => item.value !== null);
    if (!available.length) return '—';
    const best = available.reduce((current, item) => item.value > current.value ? item : current);
    return `${best.point.label} · ${best.point.generated.display}`;
  }

  function percentage(value: unknown): number | null {
    const number = numeric(value);
    if (number === null) return null;
    return Math.max(0, Math.min(100, number));
  }

  function exportShare(records: AnyRecord[], generated: MetricValue, sold: MetricValue): number | null {
    const direct = percentage(pickValue(records, ['exportShare','exportSharePercent','soldShare','soldSharePercent','exportPercentage']));
    if (direct !== null) return direct;
    const generatedBase = metricValueToBase(generated);
    const soldBase = metricValueToBase(sold);
    if (generatedBase === null || generatedBase <= 0 || soldBase === null) return null;
    return Math.max(0, Math.min(100, (soldBase / generatedBase) * 100));
  }

  function stateCopy(state: string, fetchedAt: string, error: string): { title:string; copy:string; tone:string } {
    const formatted = fetchedAt ? new Intl.DateTimeFormat('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }).format(new Date(fetchedAt)) : '';
    if (state === 'live') return { title:'Energy data is fresh', copy:formatted ? `Updated ${formatted} · Live API` : 'Live API response', tone:'success' };
    if (state === 'cached') return { title:'Showing last confirmed data', copy:formatted ? `Saved ${formatted} · API currently unavailable` : 'Saved API response', tone:'warning' };
    if (state === 'empty') return { title:'No energy data available', copy:'The API returned no records for this period', tone:'neutral' };
    if (state === 'error') return { title:'Energy data unavailable', copy:error || 'The End User Energy API could not be reached', tone:'danger' };
    return { title:'Loading energy data', copy:'Requesting the latest API records', tone:'neutral' };
  }

  function emptyView(key: EnergyPeriodKey, state: string): EnergyView {
    const config = periodConfig[key];
    const freshness = stateCopy(state, '', '');
    return {
      key,
      apiPeriod:config.apiPeriod,
      label:config.label,
      generated:'—',
      sold:'—',
      consumed:'—',
      imported:'—',
      peakPower:'—',
      specificYield:'—',
      exportShare:null,
      co2Avoided:'—',
      comparison:'—',
      bestInterval:'—',
      completeness:'—',
      estimatedRevenue:'—',
      averageTariff:'—',
      buyer:'—',
      calculationStatus:'—',
      points:[],
      freshnessTitle:freshness.title,
      freshnessCopy:freshness.copy,
      freshnessTone:freshness.tone
    };
  }

  function viewFromPayload(key: EnergyPeriodKey, payload: unknown, api: any): EnergyView {
    const config = periodConfig[key];
    const records = collectRecords(payload);
    const totals = summaryRecords(payload);
    const points = energyPoints(payload, key);
    const generated = displayTotal(totals, points, 'generated');
    const sold = displayTotal(totals, points, 'sold');
    const consumed = displayTotal(totals, points, 'consumed');
    const imported = displayTotal(totals, points, 'imported');
    const state = api?.getState?.(`energy:${config.apiPeriod}`) || {};
    const freshness = stateCopy(String(state.state || (records.length ? 'live' : 'empty')), String(state.fetchedAt || ''), String(state.error || ''));
    const peakPower = metricFromRecords(records, [
      { keys:['peakPowerMw','maxPowerMw','peakOutputMw'], unit:'MW' },
      { keys:['peakPowerKw','maxPowerKw','peakOutputKw'], unit:'kW' },
      { keys:['peakPower','maxPower','peakOutput'] }
    ]).display;
    const specificYield = metricFromRecords(records, [
      { keys:['specificYieldKwhPerKwp','specificYieldKwhKwp'], unit:'kWh/kWp' },
      { keys:['specificYield','yieldPerCapacity'] }
    ]).display;
    const co2 = metricFromRecords(records, [
      { keys:['co2AvoidedTons','co2AvoidedTonnes'], unit:'t' },
      { keys:['co2AvoidedKg'], unit:'kg' },
      { keys:['co2Avoided','carbonAvoided','emissionsAvoided'] }
    ]).display;
    const completenessMetric = metricFromRecords(records, [
      { keys:['dataCompletenessPercent','completenessPercent','coveragePercent'], unit:'%' },
      { keys:['dataCompleteness','completeness','coverage'] }
    ]).display;
    const comparison = scalar(pickValue(records, ['comparison','comparisonText','periodComparison','changeVsPrevious','deltaText','trendText']));
    const apiBestInterval = scalar(pickValue(records, ['bestInterval','bestPeriod','bestBucket','highestGenerationInterval']));
    const calculatedStatus = scalar(pickValue(records, ['calculationStatus','revenueCalculationStatus','settlementCalculationStatus','status']));
    return {
      key,
      apiPeriod:config.apiPeriod,
      label:config.label,
      generated:generated.display,
      sold:sold.display,
      consumed:consumed.display,
      imported:imported.display,
      peakPower,
      specificYield,
      exportShare:exportShare(records, generated, sold),
      co2Avoided:co2,
      comparison,
      bestInterval:apiBestInterval !== '—' ? apiBestInterval : bestInterval(points),
      completeness:completenessMetric,
      estimatedRevenue:money(records, ['estimatedRevenue','estimatedGrossRevenue','grossRevenue','revenue','energyRevenue']),
      averageTariff:metricFromRecords(records, [
        { keys:['averageTariffPerKwh','tariffPerKwh','ratePerKwh'], unit:'/kWh' },
        { keys:['averageTariff','tariff','contractRate','energyRate'] }
      ]).display,
      buyer:scalar(pickValue(records, ['buyer','energyBuyer','offtaker','counterparty','settlementCounterparty'])),
      calculationStatus:calculatedStatus,
      points,
      freshnessTitle:freshness.title,
      freshnessCopy:freshness.copy,
      freshnessTone:freshness.tone
    };
  }

  function coordinates(values: number[], maxValue: number): string {
    const left = 48;
    const right = 730;
    const top = 34;
    const bottom = 228;
    const width = right - left;
    const height = bottom - top;
    const steps = Math.max(values.length - 1, 1);
    return values.map((value, index) => {
      const x = left + (width * index / steps);
      const y = bottom - ((Math.max(0, value) / maxValue) * height);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  function chartMarkup(view: EnergyView): string {
    if (!view.points.length) return '<div class="empty-state"><strong>No energy trend available</strong><small>The API returned no interval records for this period.</small></div>';
    const generatedValues = view.points.map(point => metricValueToBase(point.generated) || 0);
    const soldValues = view.points.map(point => metricValueToBase(point.sold) || 0);
    const consumedValues = view.points.map(point => metricValueToBase(point.consumed) || 0);
    const allValues = [...generatedValues,...soldValues,...consumedValues];
    const maxValue = Math.max(...allValues, 1) * 1.12;
    const generated = coordinates(generatedValues, maxValue);
    const sold = coordinates(soldValues, maxValue);
    const consumed = coordinates(consumedValues, maxValue);
    const generatedParts = generated.split(' ');
    const firstGenerated = generatedParts[0] || '48,228';
    const lastGenerated = generatedParts.at(-1) || '730,228';
    const area = `48,228 ${generated} 730,228`;
    const labels = view.points.map((point, index) => {
      const steps = Math.max(view.points.length - 1, 1);
      const x = 48 + (682 * index / steps);
      return `<text x="${x.toFixed(1)}" y="263" text-anchor="middle">${escapeValue(point.label)}</text>`;
    }).join('');
    return `<div class="owner-energy-chart-wrap" aria-label="Energy generated, sold and self-consumed for ${escapeValue(view.label)}">
      <svg class="owner-energy-chart-svg" viewBox="0 0 780 280" role="img" aria-label="Energy trend for ${escapeValue(view.label)}">
        <defs><linearGradient id="ownerEnergyPageArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#22d3ee" stop-opacity=".28"/><stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/></linearGradient></defs>
        <g class="owner-energy-chart-grid"><line x1="48" y1="34" x2="730" y2="34"/><line x1="48" y1="98" x2="730" y2="98"/><line x1="48" y1="162" x2="730" y2="162"/><line x1="48" y1="228" x2="730" y2="228"/></g>
        <polygon class="owner-energy-chart-area" points="${area}" data-start="${firstGenerated}" data-end="${lastGenerated}"/>
        <polyline class="owner-energy-chart-generated" points="${generated}"/>
        <polyline class="owner-energy-chart-sold" points="${sold}"/>
        <polyline class="owner-energy-chart-consumed" points="${consumed}"/>
        <g class="owner-energy-chart-labels">${labels}</g>
      </svg>
      <div class="owner-energy-chart-legend"><span><i></i>Generated</span><span class="sold"><i></i>Sold</span><span class="consumed"><i></i>Self-consumed</span></div>
    </div>`;
  }

  function mixMarkup(view: EnergyView): string {
    if (view.exportShare === null) return '<div class="empty-state"><strong>No energy mix available</strong><small>The API did not return enough generated and sold energy data.</small></div>';
    const soldShare = Math.round(view.exportShare);
    const consumedShare = Math.max(0, 100 - soldShare);
    return `<div class="owner-energy-mix-wrap">
      <svg class="owner-energy-mix-ring" viewBox="0 0 120 120" role="img" aria-label="${soldShare}% sold and ${consumedShare}% retained or consumed">
        <circle class="owner-energy-mix-track" cx="60" cy="60" r="48" pathLength="100"/>
        <circle class="owner-energy-mix-sold" cx="60" cy="60" r="48" pathLength="100" stroke-dasharray="${soldShare} ${100 - soldShare}"/>
        <circle class="owner-energy-mix-consumed" cx="60" cy="60" r="38" pathLength="100" stroke-dasharray="${consumedShare} ${100 - consumedShare}"/>
        <text x="60" y="56" text-anchor="middle" class="owner-energy-mix-value">${soldShare}%</text>
        <text x="60" y="73" text-anchor="middle" class="owner-energy-mix-label">sold</text>
      </svg>
      <div class="owner-energy-mix-copy"><span>Energy utilization</span><strong>${escapeValue(view.sold)} sold</strong><small>${escapeValue(view.consumed)} used on site</small></div>
    </div>`;
  }

  function summaryMarkup(view: EnergyView): string {
    return `<div class="information-grid owner-energy-summary-grid">
      <div><span>Peak Power</span><strong>${escapeValue(view.peakPower)}</strong><small>Highest recorded output</small></div>
      <div><span>Specific Yield</span><strong>${escapeValue(view.specificYield)}</strong><small>Energy per installed capacity</small></div>
      <div><span>Best Interval</span><strong>${escapeValue(view.bestInterval)}</strong><small>Highest API generation result</small></div>
      <div><span>CO₂ Avoided</span><strong>${escapeValue(view.co2Avoided)}</strong><small>Returned by API</small></div>
      <div><span>Compared With Previous</span><strong>${escapeValue(view.comparison)}</strong><small>Returned by API</small></div>
      <div><span>Data Completeness</span><strong>${escapeValue(view.completeness)}</strong><small>Returned by API</small></div>
    </div>`;
  }

  function tableMarkup(view: EnergyView): string {
    if (!view.points.length) return '<div class="empty-state"><strong>No energy records available</strong><small>The API returned no interval records for this period.</small></div>';
    return `<div class="owner-energy-table" role="table" aria-label="Energy records for ${escapeValue(view.label)}">
      <div class="owner-energy-table-head" role="row"><span>Period</span><span>Generated</span><span>Sold</span><span>Self-consumed</span><span>Imported</span><span>Export Share</span></div>
      ${view.points.map(point => {
        const generated = metricValueToBase(point.generated);
        const sold = metricValueToBase(point.sold);
        const share = generated !== null && generated > 0 && sold !== null ? Math.max(0, Math.min(100, Math.round((sold / generated) * 100))) : null;
        return `<div class="owner-energy-table-row" role="row">
          <div data-label="Period" role="cell"><strong>${escapeValue(point.label)}</strong><small>${escapeValue(view.label)}</small></div>
          <div data-label="Generated" role="cell"><strong>${escapeValue(point.generated.display)}</strong><small>Total production</small></div>
          <div data-label="Sold" role="cell"><strong>${escapeValue(point.sold.display)}</strong><small>Exported to buyer</small></div>
          <div data-label="Self-consumed" role="cell"><strong>${escapeValue(point.consumed.display)}</strong><small>Used on site</small></div>
          <div data-label="Imported" role="cell"><strong>${escapeValue(point.imported.display)}</strong><small>Grid energy used</small></div>
          <div data-label="Export Share" role="cell">${share === null ? '<strong>—</strong>' : `<span class="badge ${share >= 75 ? 'success' : share >= 60 ? 'warning' : 'neutral'}">${share}%</span>`}<small>Of generation</small></div>
        </div>`;
      }).join('')}
    </div>`;
  }

  function renderPage(): string {
    const view = activeView;
    const exportShareText = view.exportShare === null ? '—' : `${Math.round(view.exportShare)}% of generation`;
    return `<section class="page-hero owner-energy-hero">
      <div><p class="eyebrow">My Plant</p><h1>Energy</h1><p class="friendly-note">A simple view of how much energy your plant generated, sold, used and imported.</p></div>
      <button class="freshness-card" type="button" id="refreshOwnerEnergy"><span class="pulse"></span><div><strong>${escapeValue(view.freshnessTitle)}</strong><small>${escapeValue(view.freshnessCopy)}</small></div></button>
    </section>

    <section class="owner-energy-period-bar panel glass-card" aria-label="Energy period selector">
      <div><span>Viewing</span><strong id="ownerEnergyPeriodLabel">${escapeValue(view.label)}</strong></div>
      <div class="owner-period-pills owner-energy-period-pills" role="tablist" aria-label="Energy period">
        ${(Object.keys(periodConfig) as EnergyPeriodKey[]).map(key => `<button class="${key === activePeriod ? 'active' : ''}" type="button" role="tab" aria-selected="${key === activePeriod}" data-energy-period="${key}">${periodConfig[key].label.replace('This ', '')}</button>`).join('')}
      </div>
      <button class="secondary-action" type="button" id="exportOwnerEnergy" ${view.points.length ? '' : 'disabled'}>Export Energy CSV</button>
    </section>

    <section class="kpi-grid owner-kpi-grid owner-energy-kpi-grid">
      <article class="kpi-card cyan"><div class="kpi-icon">☀️</div><div class="kpi-label">Generated</div><div class="kpi-value" id="ownerEnergyGenerated">${escapeValue(view.generated)}</div><div class="kpi-delta">${escapeValue(view.comparison)}</div></article>
      <article class="kpi-card green"><div class="kpi-icon">↗</div><div class="kpi-label">Sold</div><div class="kpi-value" id="ownerEnergySold">${escapeValue(view.sold)}</div><div class="kpi-delta" id="ownerEnergyExportShare">${escapeValue(exportShareText)}</div></article>
      <article class="kpi-card violet"><div class="kpi-icon">⌂</div><div class="kpi-label">Self-consumed</div><div class="kpi-value" id="ownerEnergyConsumed">${escapeValue(view.consumed)}</div><div class="kpi-delta">Used by the site</div></article>
      <article class="kpi-card yellow"><div class="kpi-icon">⇣</div><div class="kpi-label">Imported</div><div class="kpi-value" id="ownerEnergyImported">${escapeValue(view.imported)}</div><div class="kpi-delta">Energy taken from the grid</div></article>
    </section>

    <section class="owner-energy-main-grid">
      <article class="panel glass-card owner-energy-trend-card">
        <div class="panel-head"><div><h2>Energy Trend</h2><p>Generated energy and how it was distributed.</p></div><span class="badge ${escapeValue(view.freshnessTone)}">API data</span></div>
        <div id="ownerEnergyChart">${chartMarkup(view)}</div>
      </article>

      <article class="panel glass-card owner-energy-mix-card">
        <div class="panel-head"><div><h2>Energy Mix</h2><p>How your generated energy was used.</p></div></div>
        <div id="ownerEnergyMix">${mixMarkup(view)}</div>
        <div class="owner-energy-flow-list">
          <div class="generated"><span>Generated</span><strong id="ownerEnergyFlowGenerated">${escapeValue(view.generated)}</strong><small>API total production</small></div>
          <div class="sold"><span>Sold to grid</span><strong id="ownerEnergyFlowSold">${escapeValue(view.sold)}</strong><small>API commercial export</small></div>
          <div class="consumed"><span>Self-consumed</span><strong id="ownerEnergyFlowConsumed">${escapeValue(view.consumed)}</strong><small>API on-site use</small></div>
          <div class="imported"><span>Imported</span><strong id="ownerEnergyFlowImported">${escapeValue(view.imported)}</strong><small>API grid import</small></div>
        </div>
      </article>
    </section>

    <section class="owner-energy-secondary-grid">
      <article class="panel glass-card">
        <div class="panel-head"><div><h2>Period Summary</h2><p>Helpful indicators without technical telemetry details.</p></div></div>
        <div id="ownerEnergySummary">${summaryMarkup(view)}</div>
      </article>

      <article class="panel glass-card owner-energy-revenue-card">
        <div class="panel-head"><div><h2>Energy to Revenue</h2><p>Estimated value of the energy sold in this period.</p></div><span class="badge warning">API value</span></div>
        <div class="owner-energy-revenue-total"><span>Estimated gross revenue</span><strong id="ownerEnergyEstimatedRevenue">${escapeValue(view.estimatedRevenue)}</strong><small>Shown only when returned by API</small></div>
        <div class="information-grid owner-energy-revenue-grid">
          <div><span>Energy Sold</span><strong id="ownerEnergyRevenueSold">${escapeValue(view.sold)}</strong><small>Commercially exported</small></div>
          <div><span>Average Tariff</span><strong>${escapeValue(view.averageTariff)}</strong><small>Returned by API</small></div>
          <div><span>Buyer</span><strong>${escapeValue(view.buyer)}</strong><small>Returned by API</small></div>
          <div><span>Calculation Status</span><strong>${escapeValue(view.calculationStatus)}</strong><small>Returned by API</small></div>
        </div>
        <button class="primary-action" type="button" data-route="revenue">Open Sales & Revenue</button>
      </article>
    </section>

    <section class="panel glass-card owner-energy-records-card">
      <div class="panel-head"><div><h2>Energy Records</h2><p>Simple interval totals for the selected period.</p></div><button class="secondary-action" type="button" data-route="reports">Create Energy Report</button></div>
      <div id="ownerEnergyTable">${tableMarkup(view)}</div>
    </section>`;
  }

  function renderAndWire(): void {
    window.ZentridEndUserLayout.mount(renderPage());
    wire();
  }

  async function loadPeriod(key: EnergyPeriodKey): Promise<void> {
    const sequence = ++requestSequence;
    activePeriod = key;
    activeView = emptyView(key, 'loading');
    renderAndWire();
    const api = window.ZentridEndUserAPI;
    if (!api?.energy) {
      activeView = emptyView(key, 'error');
      activeView.freshnessTitle = 'Energy data unavailable';
      activeView.freshnessCopy = 'The End User API client is not available.';
      activeView.freshnessTone = 'danger';
      renderAndWire();
      return;
    }
    const payload = await api.energy(periodConfig[key].apiPeriod);
    if (sequence !== requestSequence) return;
    activeView = viewFromPayload(key, payload, api);
    renderAndWire();
  }

  function exportCsv(): void {
    if (!activeView.points.length) {
      window.ZentridEndUserLayout.toast('No API energy records are available to export.', 'warning');
      return;
    }
    const headers = ['Period','Generated','Sold','Self-consumed','Imported','Export Share'];
    const rows = activeView.points.map(point => {
      const generated = metricValueToBase(point.generated);
      const sold = metricValueToBase(point.sold);
      const share = generated !== null && generated > 0 && sold !== null ? `${Math.round((sold / generated) * 100)}%` : '';
      return [point.label,point.generated.display,point.sold.display,point.consumed.display,point.imported.display,share];
    });
    const csv = [headers,...rows].map(row => row.map(value => `"${String(value).replace(/"/g,'""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `zentrid-energy-${activePeriod}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    window.ZentridEndUserLayout.toast(`${activeView.label} API energy data exported.`, 'success');
  }

  function wire(): void {
    document.querySelectorAll<HTMLButtonElement>('[data-energy-period]').forEach(button => button.addEventListener('click', () => {
      const key = button.dataset.energyPeriod as EnergyPeriodKey | undefined;
      if (!key || !periodConfig[key] || key === activePeriod) return;
      void loadPeriod(key);
    }));
    document.getElementById('refreshOwnerEnergy')?.addEventListener('click', () => void loadPeriod(activePeriod));
    document.getElementById('exportOwnerEnergy')?.addEventListener('click', exportCsv);
  }

  renderAndWire();
  void loadPeriod(activePeriod);
})();
