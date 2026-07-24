export {};

type AnyRecord = Record<string, any>;
type RevenueTab = 'overview' | 'sales' | 'settlements' | 'payments' | 'agreement' | 'statements';
type ApiState = 'loading' | 'live' | 'cached' | 'empty' | 'error';
type SettlementStatus = string;

type SalesPeriod = {
  id: string;
  label: string;
  generatedMwh: number | null;
  soldMwh: number | null;
  tariff: number | null;
  gross: number | null;
  received: number | null;
  outstanding: number | null;
  status: SettlementStatus;
  paymentDate: string;
  currency: string;
  raw: AnyRecord;
};

type SettlementLine = {
  label: string;
  basis: string;
  amount: number | null;
  kind: 'credit' | 'debit' | 'pending';
};

type PaymentRecord = {
  id: string;
  period: string;
  date: string;
  amount: number | null;
  method: string;
  reference: string;
  status: string;
  currency: string;
  receiptUrl: string;
};

type AgreementRecord = {
  buyer: string;
  trader: string;
  contractNumber: string;
  status: string;
  effectiveFrom: string;
  validUntil: string;
  tariffType: string;
  currentRate: number | null;
  currency: string;
  settlementCycle: string;
  paymentTerms: string;
  nextSettlement: string;
};

type StatementRecord = {
  id: string;
  period: string;
  type: string;
  status: string;
  url: string;
};

type RevenueState = {
  state: ApiState;
  fetchedAt: string;
  error: string;
  plantName: string;
  currentPeriodLabel: string;
  currency: string;
  periods: SalesPeriod[];
  payments: PaymentRecord[];
  agreement: AgreementRecord;
  statements: StatementRecord[];
};

(() => {
  const layout = window.ZentridEndUserLayout;
  if (!layout?.mount) {
    const app = document.getElementById('app');
    if (app) app.innerHTML = '<section class="panel glass-card"><h1>Sales & Revenue</h1><p>The Zentrid layout could not be loaded. Refresh the page or sign in again.</p></section>';
    return;
  }

  const api = window.ZentridEndUserAPI;
  let activeTab: RevenueTab = 'overview';
  let selectedPeriodId = '';
  let requestSequence = 0;
  let revenueState: RevenueState = emptyRevenueState('loading');

  function emptyRevenueState(state: ApiState): RevenueState {
    return {
      state,
      fetchedAt: '',
      error: '',
      plantName: '—',
      currentPeriodLabel: '—',
      currency: '—',
      periods: [],
      payments: [],
      agreement: {
        buyer: '—',
        trader: '—',
        contractNumber: '—',
        status: '—',
        effectiveFrom: '—',
        validUntil: '—',
        tariffType: '—',
        currentRate: null,
        currency: '—',
        settlementCycle: '—',
        paymentTerms: '—',
        nextSettlement: '—'
      },
      statements: []
    };
  }

  function isRecord(value: unknown): value is AnyRecord {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function escapeHtml(value: unknown): string {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] || character));
  }

  function normalizedKey(value: string): string {
    return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
  }

  function valueByKeys(record: AnyRecord, keys: string[]): unknown {
    const accepted = new Set(keys.map(normalizedKey));
    for (const [key, value] of Object.entries(record)) {
      if (accepted.has(normalizedKey(key)) && value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
    return undefined;
  }

  function collectRecords(value: unknown, depth = 0, seen = new Set<object>()): AnyRecord[] {
    if (depth > 6 || value === null || value === undefined) return [];
    if (Array.isArray(value)) return value.flatMap(item => collectRecords(item, depth + 1, seen));
    if (!isRecord(value) || seen.has(value)) return [];
    seen.add(value);
    return [value, ...Object.values(value).flatMap(item => collectRecords(item, depth + 1, seen))];
  }

  function collectNamedArrays(value: unknown, pattern: RegExp, depth = 0, seen = new Set<object>()): AnyRecord[][] {
    if (depth > 6 || value === null || value === undefined) return [];
    if (Array.isArray(value)) return value.flatMap(item => collectNamedArrays(item, pattern, depth + 1, seen));
    if (!isRecord(value) || seen.has(value)) return [];
    seen.add(value);
    const result: AnyRecord[][] = [];
    for (const [key, child] of Object.entries(value)) {
      if (Array.isArray(child)) {
        const rows = child.filter(isRecord);
        if (rows.length && pattern.test(key)) result.push(rows);
        child.forEach(item => result.push(...collectNamedArrays(item, pattern, depth + 1, seen)));
      } else if (isRecord(child)) {
        result.push(...collectNamedArrays(child, pattern, depth + 1, seen));
      }
    }
    return result;
  }

  function text(value: unknown): string {
    if (value === undefined || value === null) return '—';
    const result = String(value).trim();
    return result || '—';
  }

  function numberValue(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return null;
    const normalized = value.replace(/\s/g, '').replace(/,/g, '').replace(/[^0-9.+-]/g, '');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function dateLabel(value: unknown): string {
    const raw = text(value);
    if (raw === '—') return raw;
    const timestamp = Date.parse(raw);
    if (!Number.isFinite(timestamp)) return raw;
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(timestamp));
  }

  function periodLabel(value: unknown): string {
    const raw = text(value);
    if (raw === '—') return raw;
    const timestamp = Date.parse(raw);
    if (!Number.isFinite(timestamp)) return raw;
    return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(timestamp));
  }

  function energyMwh(record: AnyRecord, mwhKeys: string[], kwhKeys: string[], genericKeys: string[]): number | null {
    const mwh = numberValue(valueByKeys(record, mwhKeys));
    if (mwh !== null) return mwh;
    const kwh = numberValue(valueByKeys(record, kwhKeys));
    if (kwh !== null) return kwh / 1000;
    const genericValue = valueByKeys(record, genericKeys);
    const generic = numberValue(genericValue);
    if (generic === null) return null;
    const unit = text(valueByKeys(record, ['unit', 'energyUnit', 'measurementUnit', 'uom'])).toLowerCase();
    if (unit.includes('kwh')) return generic / 1000;
    if (unit.includes('mwh')) return generic;
    return null;
  }

  function currencyFrom(record: AnyRecord, fallback = '—'): string {
    const value = text(valueByKeys(record, ['currency', 'currencyCode', 'settlementCurrency', 'paymentCurrency']));
    return value === '—' ? fallback : value.toUpperCase();
  }

  function money(value: number | null, currency = '—'): string {
    if (value === null) return '—';
    if (/^[A-Z]{3}$/.test(currency)) {
      try {
        return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: value % 1 ? 2 : 0 }).format(value);
      } catch (_error) {
        // Fall through to a neutral numeric representation.
      }
    }
    return new Intl.NumberFormat('en-GB', { maximumFractionDigits: value % 1 ? 2 : 0 }).format(value);
  }

  function displayNumber(value: number | null, digits = 1): string {
    if (value === null) return '—';
    return new Intl.NumberFormat('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
  }

  function percent(value: number | null): string {
    if (value === null) return '—';
    return `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(value)}%`;
  }

  function normalizeStatus(value: unknown): string {
    const result = text(value);
    return result === '—' ? 'Not provided' : result;
  }

  function statusTone(status: string): string {
    const value = status.toLowerCase();
    if (/paid|received|complete|ready|active|settled|success/.test(value)) return 'success';
    if (/partial|progress|processing|pending|open|draft|expected|due/.test(value)) return 'warning';
    if (/failed|overdue|rejected|cancelled|error/.test(value)) return 'danger';
    return 'info';
  }

  function uniqueBy<T>(rows: T[], key: (row: T) => string): T[] {
    const seen = new Set<string>();
    return rows.filter(row => {
      const id = key(row);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function normalizePeriod(record: AnyRecord, index: number, fallbackCurrency: string): SalesPeriod | null {
    const rawLabel = valueByKeys(record, ['label', 'periodLabel', 'period', 'month', 'settlementPeriod', 'billingPeriod', 'salesPeriod', 'date', 'periodStart']);
    const label = periodLabel(rawLabel);
    const id = text(valueByKeys(record, ['id', 'settlementId', 'periodId', 'salesId', 'reference', 'statementId']));
    const generatedMwh = energyMwh(record,
      ['generatedMwh', 'generationMwh', 'energyGeneratedMwh', 'generatedEnergyMwh', 'productionMwh'],
      ['generatedKwh', 'generationKwh', 'energyGeneratedKwh', 'generatedEnergyKwh', 'productionKwh'],
      ['generated', 'generation', 'energyGenerated', 'generatedEnergy', 'production']);
    const soldMwh = energyMwh(record,
      ['soldMwh', 'energySoldMwh', 'soldEnergyMwh', 'exportMwh', 'exportedMwh'],
      ['soldKwh', 'energySoldKwh', 'soldEnergyKwh', 'exportKwh', 'exportedKwh'],
      ['sold', 'energySold', 'soldEnergy', 'exported', 'exportEnergy']);
    const tariff = numberValue(valueByKeys(record, ['tariff', 'rate', 'tariffRate', 'pricePerKwh', 'unitPrice', 'averageTariff']));
    const gross = numberValue(valueByKeys(record, ['gross', 'grossRevenue', 'estimatedGross', 'revenue', 'salesRevenue', 'grossAmount', 'amountDue']));
    const received = numberValue(valueByKeys(record, ['received', 'receivedAmount', 'paid', 'paidAmount', 'paymentReceived', 'settledAmount']));
    const outstandingDirect = numberValue(valueByKeys(record, ['outstanding', 'outstandingAmount', 'balance', 'openBalance', 'remainingAmount']));
    const outstanding = outstandingDirect !== null ? outstandingDirect : gross !== null && received !== null ? Math.max(0, gross - received) : null;
    const status = normalizeStatus(valueByKeys(record, ['status', 'settlementStatus', 'paymentStatus', 'state']));
    const paymentDate = dateLabel(valueByKeys(record, ['paymentDate', 'paidAt', 'receivedAt', 'settledAt', 'valueDate']));
    const currency = currencyFrom(record, fallbackCurrency);
    const hasBusinessValue = [generatedMwh, soldMwh, tariff, gross, received, outstandingDirect].some(value => value !== null);
    if (!hasBusinessValue || (label === '—' && id === '—')) return null;
    return {
      id: id === '—' ? `api-period-${index + 1}` : id,
      label: label === '—' ? id : label,
      generatedMwh,
      soldMwh,
      tariff,
      gross,
      received,
      outstanding,
      status,
      paymentDate,
      currency,
      raw: record
    };
  }

  function normalizePayment(record: AnyRecord, index: number, fallbackCurrency: string): PaymentRecord | null {
    const amount = numberValue(valueByKeys(record, ['amount', 'paymentAmount', 'receivedAmount', 'paidAmount', 'value']));
    const id = text(valueByKeys(record, ['id', 'paymentId', 'transactionId', 'reference', 'bankReference']));
    const period = periodLabel(valueByKeys(record, ['period', 'periodLabel', 'settlementPeriod', 'billingPeriod', 'month']));
    const date = dateLabel(valueByKeys(record, ['date', 'paymentDate', 'paidAt', 'receivedAt', 'valueDate', 'createdAt']));
    if (amount === null && id === '—' && date === '—') return null;
    return {
      id: id === '—' ? `api-payment-${index + 1}` : id,
      period,
      date,
      amount,
      method: text(valueByKeys(record, ['method', 'paymentMethod', 'channel', 'transferMethod'])),
      reference: text(valueByKeys(record, ['reference', 'bankReference', 'transactionReference', 'externalId'])),
      status: normalizeStatus(valueByKeys(record, ['status', 'paymentStatus', 'state'])),
      currency: currencyFrom(record, fallbackCurrency),
      receiptUrl: text(valueByKeys(record, ['receiptUrl', 'downloadUrl', 'documentUrl', 'fileUrl', 'url']))
    };
  }

  function normalizeAgreement(records: AnyRecord[], fallbackCurrency: string): AgreementRecord {
    const pick = (keys: string[]): unknown => {
      for (const record of records) {
        const value = valueByKeys(record, keys);
        if (value !== undefined && value !== null && String(value).trim() !== '') return value;
      }
      return undefined;
    };
    return {
      buyer: text(pick(['buyer', 'energyBuyer', 'offtaker', 'offTaker', 'purchaser'])),
      trader: text(pick(['trader', 'energyTrader', 'marketAgent'])),
      contractNumber: text(pick(['contractNumber', 'agreementNumber', 'ppaNumber', 'contractId', 'agreementId'])),
      status: text(pick(['contractStatus', 'agreementStatus', 'ppaStatus'])),
      effectiveFrom: dateLabel(pick(['effectiveFrom', 'contractStart', 'startDate', 'validFrom'])),
      validUntil: dateLabel(pick(['validUntil', 'contractEnd', 'endDate', 'validTo', 'expiresAt'])),
      tariffType: text(pick(['tariffType', 'rateType', 'pricingModel'])),
      currentRate: numberValue(pick(['currentRate', 'tariff', 'tariffRate', 'pricePerKwh', 'unitPrice', 'averageTariff'])),
      currency: text(pick(['currency', 'currencyCode', 'settlementCurrency'])) === '—' ? fallbackCurrency : text(pick(['currency', 'currencyCode', 'settlementCurrency'])).toUpperCase(),
      settlementCycle: text(pick(['settlementCycle', 'billingCycle', 'settlementFrequency', 'paymentCycle'])),
      paymentTerms: text(pick(['paymentTerms', 'terms', 'paymentTerm'])),
      nextSettlement: dateLabel(pick(['nextSettlement', 'nextSettlementDate', 'settlementDate', 'nextPaymentDate']))
    };
  }

  function normalizeStatement(record: AnyRecord, index: number): StatementRecord | null {
    const type = text(valueByKeys(record, ['type', 'reportType', 'documentType', 'name', 'title']));
    const searchable = `${type} ${text(valueByKeys(record, ['category', 'description', 'fileName']))}`.toLowerCase();
    if (!/settlement|sales|revenue|payment|receipt|statement/.test(searchable)) return null;
    const id = text(valueByKeys(record, ['id', 'reportId', 'documentId', 'statementId', 'reference']));
    return {
      id: id === '—' ? `api-statement-${index + 1}` : id,
      period: periodLabel(valueByKeys(record, ['period', 'periodLabel', 'month', 'date', 'createdAt'])),
      type,
      status: normalizeStatus(valueByKeys(record, ['status', 'documentStatus', 'reportStatus', 'state'])),
      url: text(valueByKeys(record, ['downloadUrl', 'fileUrl', 'documentUrl', 'url']))
    };
  }

  function settlementLines(period: SalesPeriod): SettlementLine[] {
    const arrays = collectNamedArrays(period.raw, /line|adjustment|calculation|deduction|charge|fee|tax|breakdown/i);
    const rows = arrays.flat();
    return uniqueBy(rows.map((record, index): SettlementLine | null => {
      const label = text(valueByKeys(record, ['label', 'name', 'type', 'description', 'title']));
      const basis = text(valueByKeys(record, ['basis', 'calculation', 'formula', 'note', 'description', 'details']));
      const amount = numberValue(valueByKeys(record, ['amount', 'value', 'total', 'charge', 'fee']));
      if (label === '—' && amount === null) return null;
      const kindValue = text(valueByKeys(record, ['kind', 'type', 'category', 'direction'])).toLowerCase();
      const kind: SettlementLine['kind'] = amount === null || /pending|expected|estimate/.test(kindValue)
        ? 'pending'
        : amount < 0 || /debit|fee|tax|deduct|charge/.test(kindValue)
          ? 'debit'
          : 'credit';
      return { label: label === '—' ? `Line ${index + 1}` : label, basis, amount, kind };
    }).filter((line): line is SettlementLine => Boolean(line)), line => `${line.label}|${line.basis}|${line.amount}`);
  }

  function deriveApiState(resourceNames: string[]): { state: ApiState; fetchedAt: string; error: string } {
    const metas = resourceNames.map(name => api?.getState?.(name)).filter(Boolean) as Array<{ state?: string; fetchedAt?: string; error?: string }>;
    if (!metas.length) return { state: 'empty', fetchedAt: '', error: '' };
    if (metas.some(meta => meta.state === 'live')) return { state: 'live', fetchedAt: text(metas.find(meta => meta.state === 'live')?.fetchedAt) === '—' ? '' : text(metas.find(meta => meta.state === 'live')?.fetchedAt), error: '' };
    if (metas.some(meta => meta.state === 'cached')) return { state: 'cached', fetchedAt: text(metas.find(meta => meta.state === 'cached')?.fetchedAt) === '—' ? '' : text(metas.find(meta => meta.state === 'cached')?.fetchedAt), error: text(metas.find(meta => meta.state === 'cached')?.error) === '—' ? '' : text(metas.find(meta => meta.state === 'cached')?.error) };
    if (metas.every(meta => meta.state === 'error')) return { state: 'error', fetchedAt: '', error: text(metas.find(meta => meta.error)?.error) === '—' ? 'Sales and revenue data is unavailable.' : text(metas.find(meta => meta.error)?.error) };
    return { state: 'empty', fetchedAt: '', error: '' };
  }

  function buildState(payloads: unknown[]): RevenueState {
    const [overviewPayload, dashboardPayload, monthEnergyPayload, yearEnergyPayload, reportsPayload, plantsPayload] = payloads;
    const allPayloads = [overviewPayload, dashboardPayload, monthEnergyPayload, yearEnergyPayload];
    const allRecords = allPayloads.flatMap(payload => collectRecords(payload));
    const fallbackCurrency = text(allRecords.map(record => valueByKeys(record, ['currency', 'currencyCode', 'settlementCurrency'])).find(value => value !== undefined)) === '—'
      ? '—'
      : text(allRecords.map(record => valueByKeys(record, ['currency', 'currencyCode', 'settlementCurrency'])).find(value => value !== undefined)).toUpperCase();

    const periodArrays = allPayloads.flatMap(payload => collectNamedArrays(payload, /settlement|sales|revenue|period|monthly|billing/i));
    let periods = uniqueBy(periodArrays.flat().map(normalizePeriodWithIndex).filter((period): period is SalesPeriod => Boolean(period)), period => period.id);
    function normalizePeriodWithIndex(record: AnyRecord, index: number): SalesPeriod | null {
      return normalizePeriod(record, index, fallbackCurrency);
    }

    if (!periods.length) {
      const summaryPeriod = allRecords.map((record, index) => normalizePeriod(record, index, fallbackCurrency)).find((period): period is SalesPeriod => Boolean(period));
      if (summaryPeriod) periods = [summaryPeriod];
    }

    periods.sort((left, right) => {
      const leftDate = Date.parse(left.label);
      const rightDate = Date.parse(right.label);
      if (Number.isFinite(leftDate) && Number.isFinite(rightDate)) return rightDate - leftDate;
      return left.label.localeCompare(right.label);
    });

    const paymentArrays = allPayloads.flatMap(payload => collectNamedArrays(payload, /payment|transaction|receipt|transfer/i));
    const payments = uniqueBy(paymentArrays.flat().map((record, index) => normalizePayment(record, index, fallbackCurrency)).filter((payment): payment is PaymentRecord => Boolean(payment)), payment => payment.id);

    const agreementRecords = allRecords.filter(record => Object.keys(record).some(key => /agreement|contract|buyer|offtaker|tariff|settlement|paymentterm/i.test(key)));
    const agreement = normalizeAgreement(agreementRecords, fallbackCurrency);

    const reports = Array.isArray(reportsPayload) ? reportsPayload.filter(isRecord) : collectRecords(reportsPayload);
    const statements = uniqueBy(reports.map((record, index) => normalizeStatement(record, index)).filter((statement): statement is StatementRecord => Boolean(statement)), statement => statement.id);

    const plantRecords = Array.isArray(plantsPayload) ? plantsPayload.filter(isRecord) : collectRecords(plantsPayload);
    const plantName = text(valueByKeys(plantRecords[0] || {}, ['name', 'plantName', 'siteName', 'displayName']));
    const currentPeriod = periods[0];
    const resourceState = deriveApiState(['overview', 'dashboard', 'energy:Month', 'energy:Year', 'reports', 'plants']);
    const hasData = periods.length > 0 || payments.length > 0 || statements.length > 0 || Object.values(agreement).some(value => value !== '—' && value !== null);

    return {
      state: hasData ? resourceState.state === 'error' ? 'cached' : resourceState.state : resourceState.state === 'error' ? 'error' : 'empty',
      fetchedAt: resourceState.fetchedAt,
      error: resourceState.error,
      plantName: plantName === '—' ? text(layout.state.plant) : plantName,
      currentPeriodLabel: currentPeriod?.label || '—',
      currency: currentPeriod && currentPeriod.currency !== '—' ? currentPeriod.currency : agreement.currency !== '—' ? agreement.currency : fallbackCurrency,
      periods,
      payments,
      agreement,
      statements
    };
  }

  function emptyState(title: string, detail: string): string {
    return `<div class="empty-state"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></div>`;
  }

  function chartMarkup(): string {
    const points = revenueState.periods.filter(period => period.gross !== null || period.received !== null).slice(0, 8).reverse();
    if (!points.length) return emptyState('No revenue trend available', 'The API did not return period revenue or payment values.');
    const max = Math.max(...points.flatMap(period => [period.gross || 0, period.received || 0]), 1);
    const step = points.length > 1 ? 660 / (points.length - 1) : 0;
    const xValues = points.map((_, index) => 56 + index * step);
    const grossPath = points.map((period, index) => `${index ? 'L' : 'M'} ${xValues[index]} ${220 - (period.gross || 0) / max * 155}`).join(' ');
    const paidPath = points.map((period, index) => `${index ? 'L' : 'M'} ${xValues[index]} ${220 - (period.received || 0) / max * 155}`).join(' ');
    return `<div class="owner-revenue-chart-wrap" aria-label="Gross revenue and received payments trend">
      <svg class="owner-revenue-chart-svg" viewBox="0 0 760 270" role="img" aria-label="Period gross revenue and received payments">
        <defs><linearGradient id="ownerRevenueArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#34d399" stop-opacity=".23"/><stop offset="100%" stop-color="#34d399" stop-opacity="0"/></linearGradient></defs>
        <g class="owner-revenue-chart-grid"><line x1="46" y1="45" x2="730" y2="45"/><line x1="46" y1="100" x2="730" y2="100"/><line x1="46" y1="155" x2="730" y2="155"/><line x1="46" y1="220" x2="730" y2="220"/></g>
        <path class="owner-revenue-chart-area" d="${grossPath} L ${xValues[xValues.length - 1]} 230 L ${xValues[0]} 230 Z"/>
        <path class="owner-revenue-chart-gross" d="${grossPath}"/>
        <path class="owner-revenue-chart-paid" d="${paidPath}"/>
        ${points.map((period, index) => `<circle class="owner-revenue-chart-dot" cx="${xValues[index]}" cy="${220 - (period.gross || 0) / max * 155}" r="5"><title>${escapeHtml(period.label)}: ${escapeHtml(money(period.gross, period.currency))}</title></circle>`).join('')}
        <g class="owner-revenue-chart-labels">${points.map((period, index) => `<text x="${(xValues[index] ?? 56) - 18}" y="252">${escapeHtml(period.label.slice(0, 8))}</text>`).join('')}</g>
      </svg>
      <div class="owner-revenue-chart-legend"><span><i></i>Gross revenue</span><span class="paid"><i></i>Received</span></div>
    </div>`;
  }

  function sidebarMarkup(): string {
    const items: Array<{ key: RevenueTab; icon: string; label: string; note: string }> = [
      { key: 'overview', icon: '▦', label: 'Overview', note: 'Current financial position' },
      { key: 'sales', icon: '↗', label: 'Energy Sales', note: 'Sold energy by period' },
      { key: 'settlements', icon: '≋', label: 'Settlements', note: 'Calculation details' },
      { key: 'payments', icon: '€', label: 'Payments', note: 'Received funds' },
      { key: 'agreement', icon: '⌁', label: 'Agreement', note: 'Buyer and tariff' },
      { key: 'statements', icon: '▤', label: 'Statements', note: 'Download documents' }
    ];
    return `<aside class="owner-revenue-sidebar" aria-label="Sales and revenue sections">
      <div class="owner-revenue-sidebar-title"><span>Business view</span><strong>Sales & Revenue</strong></div>
      <nav>${items.map(item => `<button type="button" class="${activeTab === item.key ? 'active' : ''}" data-revenue-tab="${item.key}"><span class="owner-revenue-tab-icon">${item.icon}</span><span><strong>${item.label}</strong><small>${item.note}</small></span></button>`).join('')}</nav>
      <div class="owner-revenue-readonly"><span>Read-only agreement</span><strong>Financial rules are managed by your operator.</strong></div>
    </aside>`;
  }

  function overviewMarkup(): string {
    const currentPeriod = revenueState.periods[0] || null;
    const totals = revenueState.periods.reduce((sum, period) => ({
      gross: sum.gross + (period.gross || 0),
      received: sum.received + (period.received || 0),
      outstanding: sum.outstanding + (period.outstanding || 0),
      sold: sum.sold + (period.soldMwh || 0),
      grossKnown: sum.grossKnown || period.gross !== null,
      receivedKnown: sum.receivedKnown || period.received !== null,
      outstandingKnown: sum.outstandingKnown || period.outstanding !== null,
      soldKnown: sum.soldKnown || period.soldMwh !== null
    }), { gross: 0, received: 0, outstanding: 0, sold: 0, grossKnown: false, receivedKnown: false, outstandingKnown: false, soldKnown: false });
    const receivedPct = currentPeriod?.gross && currentPeriod.received !== null ? Math.max(0, Math.min(100, Math.round(currentPeriod.received / currentPeriod.gross * 100))) : null;
    const soldPct = currentPeriod?.generatedMwh && currentPeriod.soldMwh !== null ? currentPeriod.soldMwh / currentPeriod.generatedMwh * 100 : null;
    const recentPayments = revenueState.payments.slice(0, 3);
    return `<section class="owner-revenue-view" data-revenue-view="overview">
      <div class="owner-revenue-view-head"><div><p class="eyebrow">Current position</p><h2>${escapeHtml(currentPeriod ? `${currentPeriod.label} settlement overview` : 'Settlement overview')}</h2><p>Energy sales, expected revenue and received payments returned by the API.</p></div><span class="badge ${statusTone(currentPeriod?.status || revenueState.state)}">${escapeHtml(currentPeriod?.status || revenueState.state)}</span></div>
      <div class="kpi-grid owner-kpi-grid owner-revenue-kpi-grid">
        <article class="kpi-card green"><div class="kpi-icon">↗</div><div class="kpi-label">Energy Sold</div><div class="kpi-value">${currentPeriod?.soldMwh !== null && currentPeriod ? `${displayNumber(currentPeriod.soldMwh)} MWh` : '—'}</div><div class="kpi-delta">Current API settlement period</div></article>
        <article class="kpi-card violet"><div class="kpi-icon">💶</div><div class="kpi-label">Estimated Gross</div><div class="kpi-value">${money(currentPeriod?.gross ?? null, currentPeriod?.currency || revenueState.currency)}</div><div class="kpi-delta">Shown only when returned by API</div></article>
        <article class="kpi-card cyan"><div class="kpi-icon">✓</div><div class="kpi-label">Received</div><div class="kpi-value">${money(currentPeriod?.received ?? null, currentPeriod?.currency || revenueState.currency)}</div><div class="kpi-delta">${receivedPct === null ? 'No payment ratio returned' : `${receivedPct}% of gross amount`}</div></article>
        <article class="kpi-card yellow"><div class="kpi-icon">◷</div><div class="kpi-label">Outstanding</div><div class="kpi-value">${money(currentPeriod?.outstanding ?? null, currentPeriod?.currency || revenueState.currency)}</div><div class="kpi-delta">API-confirmed open balance</div></article>
      </div>
      <div class="owner-revenue-overview-grid">
        <article class="panel glass-card owner-revenue-current-card">
          <div class="panel-head"><div><h3>Current Settlement</h3><p>API-backed settlement progress.</p></div><button class="secondary-action" type="button" data-revenue-tab="settlements">View calculation</button></div>
          <div class="owner-revenue-current-total"><span>Estimated gross revenue</span><strong>${money(currentPeriod?.gross ?? null, currentPeriod?.currency || revenueState.currency)}</strong><small>${currentPeriod?.tariff !== null && currentPeriod ? `API rate ${currentPeriod.tariff} per kWh.` : 'No tariff value returned by API.'}</small></div>
          <div class="owner-revenue-progress" aria-label="${receivedPct === null ? 'No received percentage available' : `${receivedPct} percent received`}"><span style="width:${receivedPct || 0}%"></span></div>
          <div class="information-grid owner-revenue-current-grid">
            <div><span>Generated</span><strong>${currentPeriod?.generatedMwh !== null && currentPeriod ? `${displayNumber(currentPeriod.generatedMwh)} MWh` : '—'}</strong><small>Plant generation</small></div>
            <div><span>Sold</span><strong>${currentPeriod?.soldMwh !== null && currentPeriod ? `${displayNumber(currentPeriod.soldMwh)} MWh` : '—'}</strong><small>${soldPct === null ? 'No ratio returned' : `${percent(soldPct)} of generation`}</small></div>
            <div><span>Received</span><strong>${money(currentPeriod?.received ?? null, currentPeriod?.currency || revenueState.currency)}</strong><small>Confirmed API payment value</small></div>
            <div><span>Outstanding</span><strong>${money(currentPeriod?.outstanding ?? null, currentPeriod?.currency || revenueState.currency)}</strong><small>API-confirmed open balance</small></div>
          </div>
          <div class="owner-revenue-pending-note"><span>i</span><div><strong>No financial values are estimated locally</strong><p>Fees, tax, buyer, tariff and settlement deductions appear only when returned by the backend.</p></div></div>
        </article>
        <article class="panel glass-card owner-revenue-summary-card">
          <div class="panel-head"><div><h3>Available Periods</h3><p>Summary of all periods returned by API.</p></div></div>
          <div class="owner-revenue-year-total"><span>Gross revenue</span><strong>${totals.grossKnown ? money(totals.gross, revenueState.currency) : '—'}</strong><small>${totals.soldKnown ? `${displayNumber(totals.sold)} MWh sold` : 'No sold-energy total returned'}</small></div>
          <div class="information-grid owner-revenue-year-grid">
            <div><span>Received</span><strong>${totals.receivedKnown ? money(totals.received, revenueState.currency) : '—'}</strong><small>Confirmed API payments</small></div>
            <div><span>Outstanding</span><strong>${totals.outstandingKnown ? money(totals.outstanding, revenueState.currency) : '—'}</strong><small>Open API balances</small></div>
            <div><span>Average Tariff</span><strong>${currentPeriod?.tariff !== null && currentPeriod ? String(currentPeriod.tariff) : '—'}</strong><small>Returned by API</small></div>
            <div><span>Buyer</span><strong>${escapeHtml(revenueState.agreement.buyer)}</strong><small>Returned by API</small></div>
          </div>
          <button class="primary-action" type="button" data-revenue-tab="statements">Open Statements</button>
        </article>
      </div>
      <div class="owner-revenue-lower-grid">
        <article class="panel glass-card"><div class="panel-head"><div><h3>Revenue Trend</h3><p>Gross revenue compared with received payments.</p></div></div>${chartMarkup()}</article>
        <article class="panel glass-card"><div class="panel-head"><div><h3>Recent Payments</h3><p>Latest transfers returned by API.</p></div><button class="secondary-action" type="button" data-revenue-tab="payments">View all</button></div>
          <div class="owner-revenue-payment-list">${recentPayments.length ? recentPayments.map(payment => `<button type="button" data-revenue-tab="payments"><span class="owner-revenue-payment-icon">✓</span><span><strong>${money(payment.amount, payment.currency)}</strong><small>${escapeHtml(payment.period)} · ${escapeHtml(payment.date)}</small></span><span class="badge ${statusTone(payment.status)}">${escapeHtml(payment.status)}</span></button>`).join('') : emptyState('No payments available', 'The API did not return payment records.')}</div>
        </article>
      </div>
    </section>`;
  }

  function salesMarkup(): string {
    return `<section class="owner-revenue-view" data-revenue-view="sales">
      <div class="owner-revenue-view-head"><div><p class="eyebrow">Energy sales</p><h2>Sold energy by period</h2><p>Only periods returned by the API are displayed.</p></div><button class="secondary-action" type="button" id="exportRevenueCsv" ${revenueState.periods.length ? '' : 'disabled'}>Export CSV</button></div>
      <article class="panel glass-card owner-revenue-table-card">
        ${revenueState.periods.length ? `<div class="owner-revenue-table" role="table" aria-label="Energy sales by period">
          <div class="owner-revenue-table-head" role="row"><span>Period</span><span>Generated</span><span>Sold</span><span>Tariff</span><span>Gross Revenue</span><span>Status</span><span>Action</span></div>
          ${revenueState.periods.map(period => `<div class="owner-revenue-table-row" role="row" data-settlement-row="${escapeHtml(period.id)}">
            <div data-label="Period"><strong>${escapeHtml(period.label)}</strong><small>${escapeHtml(period.id)}</small></div>
            <div data-label="Generated"><strong>${period.generatedMwh === null ? '—' : `${displayNumber(period.generatedMwh)} MWh`}</strong><small>API value</small></div>
            <div data-label="Sold"><strong>${period.soldMwh === null ? '—' : `${displayNumber(period.soldMwh)} MWh`}</strong><small>${period.generatedMwh && period.soldMwh !== null ? `${percent(period.soldMwh / period.generatedMwh * 100)} sold` : 'No ratio available'}</small></div>
            <div data-label="Tariff"><strong>${period.tariff === null ? '—' : escapeHtml(String(period.tariff))}</strong><small>API rate</small></div>
            <div data-label="Gross Revenue"><strong>${money(period.gross, period.currency)}</strong><small>API amount</small></div>
            <div data-label="Status"><span class="badge ${statusTone(period.status)}">${escapeHtml(period.status)}</span><small>${period.paymentDate === '—' ? 'No payment date' : escapeHtml(period.paymentDate)}</small></div>
            <div class="row-actions single-action" data-label="Action"><button class="secondary-action single-row-action" type="button" data-open-settlement="${escapeHtml(period.id)}">View</button></div>
          </div>`).join('')}
        </div>` : emptyState('No energy sales available', 'The API did not return settlement or sales periods.')}
      </article>
    </section>`;
  }

  function settlementsMarkup(): string {
    const selected = revenueState.periods.find(period => period.id === selectedPeriodId) || revenueState.periods[0] || null;
    const lines = selected ? settlementLines(selected) : [];
    return `<section class="owner-revenue-view" data-revenue-view="settlements">
      <div class="owner-revenue-view-head"><div><p class="eyebrow">Settlement details</p><h2>How the amount is calculated</h2><p>Only backend-provided calculation lines are displayed.</p></div><select id="settlementPeriodSelect" aria-label="Settlement period" ${revenueState.periods.length ? '' : 'disabled'}>${revenueState.periods.length ? revenueState.periods.map(period => `<option value="${escapeHtml(period.id)}" ${selected?.id === period.id ? 'selected' : ''}>${escapeHtml(period.label)}</option>`).join('') : '<option>No periods available</option>'}</select></div>
      ${selected ? `<div class="owner-revenue-settlement-grid">
        <article class="panel glass-card">
          <div class="panel-head"><div><h3>${escapeHtml(selected.label)}</h3><p>${selected.soldMwh === null ? 'Sold energy not returned' : `${displayNumber(selected.soldMwh)} MWh sold`}${selected.tariff === null ? '' : ` at API rate ${selected.tariff}`}.</p></div><span class="badge ${statusTone(selected.status)}">${escapeHtml(selected.status)}</span></div>
          <div class="owner-revenue-calculation-list">${lines.length ? lines.map(line => `<div class="${line.kind}"><span><strong>${escapeHtml(line.label)}</strong><small>${escapeHtml(line.basis)}</small></span><b>${line.amount === null ? 'Pending' : money(line.amount, selected.currency)}</b></div>`).join('') : emptyState('No settlement breakdown available', 'The API did not return fees, taxes or calculation lines.')}</div>
        </article>
        <article class="panel glass-card owner-revenue-settlement-summary"><div class="panel-head"><div><h3>Settlement Summary</h3><p>API-backed values for the selected period.</p></div></div>
          <div class="information-grid owner-revenue-current-grid">
            <div><span>Gross</span><strong>${money(selected.gross, selected.currency)}</strong><small>Returned by API</small></div>
            <div><span>Received</span><strong>${money(selected.received, selected.currency)}</strong><small>Returned by API</small></div>
            <div><span>Outstanding</span><strong>${money(selected.outstanding, selected.currency)}</strong><small>Returned by API</small></div>
            <div><span>Payment Date</span><strong>${escapeHtml(selected.paymentDate)}</strong><small>Returned by API</small></div>
          </div>
        </article>
      </div>` : emptyState('No settlements available', 'The API did not return settlement periods.')}
    </section>`;
  }

  function paymentsMarkup(): string {
    const totalReceived = revenueState.payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const receivedKnown = revenueState.payments.some(payment => payment.amount !== null);
    const outstandingPeriods = revenueState.periods.filter(period => period.outstanding !== null);
    const totalOutstanding = outstandingPeriods.reduce((sum, period) => sum + (period.outstanding || 0), 0);
    const lastPayment = revenueState.payments[0] || null;
    return `<section class="owner-revenue-view" data-revenue-view="payments">
      <div class="owner-revenue-view-head"><div><p class="eyebrow">Payments</p><h2>Received funds</h2><p>Confirmed payment history returned by the API.</p></div><button class="secondary-action" type="button" id="exportPaymentsCsv" ${revenueState.payments.length ? '' : 'disabled'}>Export CSV</button></div>
      <div class="kpi-grid owner-kpi-grid owner-revenue-payment-kpis">
        <article class="kpi-card cyan"><div class="kpi-icon">✓</div><div class="kpi-label">Received</div><div class="kpi-value">${receivedKnown ? money(totalReceived, revenueState.currency) : '—'}</div><div class="kpi-delta">Confirmed API transfers</div></article>
        <article class="kpi-card yellow"><div class="kpi-icon">◷</div><div class="kpi-label">Outstanding</div><div class="kpi-value">${outstandingPeriods.length ? money(totalOutstanding, revenueState.currency) : '—'}</div><div class="kpi-delta">Across API periods</div></article>
        <article class="kpi-card green"><div class="kpi-icon">▣</div><div class="kpi-label">Last Payment</div><div class="kpi-value">${lastPayment ? money(lastPayment.amount, lastPayment.currency) : '—'}</div><div class="kpi-delta">${lastPayment ? escapeHtml(lastPayment.date) : 'No payment returned'}</div></article>
        <article class="kpi-card violet"><div class="kpi-icon">↻</div><div class="kpi-label">Payment Method</div><div class="kpi-value owner-revenue-text-value">${lastPayment ? escapeHtml(lastPayment.method) : '—'}</div><div class="kpi-delta">Returned by API</div></article>
      </div>
      <article class="panel glass-card owner-revenue-table-card">
        ${revenueState.payments.length ? `<div class="owner-revenue-table owner-revenue-payment-table" role="table" aria-label="Payment history">
          <div class="owner-revenue-table-head" role="row"><span>Payment</span><span>Period</span><span>Date</span><span>Amount</span><span>Method</span><span>Status</span><span>Receipt</span></div>
          ${revenueState.payments.map(payment => `<div class="owner-revenue-table-row" role="row">
            <div data-label="Payment"><strong>${escapeHtml(payment.id)}</strong><small>${escapeHtml(payment.reference)}</small></div>
            <div data-label="Period"><strong>${escapeHtml(payment.period)}</strong><small>API settlement period</small></div>
            <div data-label="Date"><strong>${escapeHtml(payment.date)}</strong><small>API value date</small></div>
            <div data-label="Amount"><strong>${money(payment.amount, payment.currency)}</strong><small>${escapeHtml(payment.currency)}</small></div>
            <div data-label="Method"><strong>${escapeHtml(payment.method)}</strong><small>Returned by API</small></div>
            <div data-label="Status"><span class="badge ${statusTone(payment.status)}">${escapeHtml(payment.status)}</span><small>Returned by API</small></div>
            <div class="row-actions single-action" data-label="Receipt"><button class="secondary-action single-row-action" type="button" data-download-receipt="${escapeHtml(payment.id)}" ${payment.receiptUrl === '—' ? 'disabled' : ''}>Download</button></div>
          </div>`).join('')}
        </div>` : emptyState('No payments available', 'The API did not return payment records.')}
      </article>
    </section>`;
  }

  function agreementMarkup(): string {
    const agreement = revenueState.agreement;
    const hasAgreement = Object.values(agreement).some(value => value !== '—' && value !== null);
    return `<section class="owner-revenue-view" data-revenue-view="agreement">
      <div class="owner-revenue-view-head"><div><p class="eyebrow">Contract & tariff</p><h2>Your sales agreement</h2><p>Read-only commercial terms returned by the API.</p></div><span class="badge ${statusTone(agreement.status)}">${escapeHtml(agreement.status)}</span></div>
      ${hasAgreement ? `<div class="owner-revenue-agreement-grid">
        <article class="panel glass-card"><div class="panel-head"><div><h3>Agreement Details</h3><p>Commercial relationship for ${escapeHtml(revenueState.plantName)}.</p></div></div>
          <div class="information-grid owner-revenue-agreement-info">
            <div><span>Energy Buyer</span><strong>${escapeHtml(agreement.buyer)}</strong><small>Returned by API</small></div>
            <div><span>Trader</span><strong>${escapeHtml(agreement.trader)}</strong><small>Returned by API</small></div>
            <div><span>Contract Number</span><strong>${escapeHtml(agreement.contractNumber)}</strong><small>Returned by API</small></div>
            <div><span>Contract Status</span><strong>${escapeHtml(agreement.status)}</strong><small>Returned by API</small></div>
            <div><span>Effective From</span><strong>${escapeHtml(agreement.effectiveFrom)}</strong><small>Returned by API</small></div>
            <div><span>Valid Until</span><strong>${escapeHtml(agreement.validUntil)}</strong><small>Returned by API</small></div>
          </div>
        </article>
        <article class="panel glass-card"><div class="panel-head"><div><h3>Tariff & Settlement</h3><p>Only backend-provided values are shown.</p></div></div>
          <div class="information-grid owner-revenue-agreement-info">
            <div><span>Tariff Type</span><strong>${escapeHtml(agreement.tariffType)}</strong><small>Returned by API</small></div>
            <div><span>Current Rate</span><strong>${agreement.currentRate === null ? '—' : escapeHtml(String(agreement.currentRate))}</strong><small>Returned by API</small></div>
            <div><span>Currency</span><strong>${escapeHtml(agreement.currency)}</strong><small>Settlement currency</small></div>
            <div><span>Settlement Cycle</span><strong>${escapeHtml(agreement.settlementCycle)}</strong><small>Returned by API</small></div>
            <div><span>Payment Terms</span><strong>${escapeHtml(agreement.paymentTerms)}</strong><small>Returned by API</small></div>
            <div><span>Next Settlement</span><strong>${escapeHtml(agreement.nextSettlement)}</strong><small>Returned by API</small></div>
          </div>
        </article>
      </div>` : emptyState('No agreement data available', 'The API did not return buyer, contract or tariff fields.')}
      <div class="owner-revenue-readonly-banner"><span>🔒</span><div><strong>Agreement terms are read-only</strong><p>Contact your tenant operator to request commercial or bank detail changes.</p></div></div>
    </section>`;
  }

  function statementsMarkup(): string {
    return `<section class="owner-revenue-view" data-revenue-view="statements">
      <div class="owner-revenue-view-head"><div><p class="eyebrow">Documents</p><h2>Statements & receipts</h2><p>Only documents returned by the Reports API are displayed.</p></div><button class="secondary-action" type="button" id="exportRevenueCsvStatements" ${revenueState.periods.length ? '' : 'disabled'}>Export Sales CSV</button></div>
      ${revenueState.statements.length ? `<div class="owner-revenue-document-grid">${revenueState.statements.map(statement => `<article class="owner-revenue-document-card"><div class="owner-revenue-document-icon">▤</div><div><span>${escapeHtml(statement.type)}</span><h3>${escapeHtml(statement.period)}</h3><p>${escapeHtml(statement.id)} · Returned by API</p></div><span class="badge ${statusTone(statement.status)}">${escapeHtml(statement.status)}</span><button class="secondary-action" type="button" data-download-statement="${escapeHtml(statement.id)}" ${statement.url === '—' ? 'disabled' : ''}>Download</button></article>`).join('')}</div>` : emptyState('No statements available', 'The Reports API did not return sales, settlement or payment documents.')}
      <article class="panel glass-card owner-revenue-document-note"><div class="panel-head"><div><h3>What is included?</h3><p>Document content and download availability are controlled by the backend.</p></div></div>
        <div class="information-grid owner-revenue-document-info">
          <div><span>Energy</span><strong>—</strong><small>Shown when returned by API</small></div>
          <div><span>Tariff</span><strong>—</strong><small>Shown when returned by API</small></div>
          <div><span>Adjustments</span><strong>—</strong><small>Shown when returned by API</small></div>
          <div><span>Payment</span><strong>—</strong><small>Shown when returned by API</small></div>
        </div>
      </article>
    </section>`;
  }

  function activeContent(): string {
    if (revenueState.state === 'loading') return `<section class="owner-revenue-view">${emptyState('Loading sales and revenue', 'Connecting to End User API resources.')}</section>`;
    if (activeTab === 'sales') return salesMarkup();
    if (activeTab === 'settlements') return settlementsMarkup();
    if (activeTab === 'payments') return paymentsMarkup();
    if (activeTab === 'agreement') return agreementMarkup();
    if (activeTab === 'statements') return statementsMarkup();
    return overviewMarkup();
  }

  function freshnessLabel(): { title: string; detail: string } {
    if (revenueState.state === 'live') return { title: 'Live API data', detail: revenueState.fetchedAt ? `Updated ${dateLabel(revenueState.fetchedAt)}` : 'Current response' };
    if (revenueState.state === 'cached') return { title: 'Cached API data', detail: revenueState.fetchedAt ? `Last successful response ${dateLabel(revenueState.fetchedAt)}` : 'Last successful response' };
    if (revenueState.state === 'error') return { title: 'API unavailable', detail: revenueState.error || 'No sales and revenue resource is available' };
    if (revenueState.state === 'empty') return { title: 'No API data', detail: 'Financial resources returned no records' };
    return { title: 'Loading API data', detail: 'Connecting to End User services' };
  }

  function pageMarkup(): string {
    const freshness = freshnessLabel();
    return `<section class="page-hero owner-revenue-hero"><div><p class="eyebrow">Business</p><h1>Sales & Revenue</h1><p class="friendly-note">See API-backed energy sales, revenue, settlements and payments.</p></div><button class="freshness-card" type="button" id="refreshRevenueData"><span class="pulse"></span><div><strong>${escapeHtml(freshness.title)}</strong><small>${escapeHtml(freshness.detail)}</small></div></button></section>
      <section class="owner-revenue-context panel glass-card"><div><span>Plant</span><strong>${escapeHtml(revenueState.plantName)}</strong></div><div><span>Current Period</span><strong>${escapeHtml(revenueState.currentPeriodLabel)}</strong></div><div><span>Buyer</span><strong>${escapeHtml(revenueState.agreement.buyer)}</strong></div><div><span>Currency</span><strong>${escapeHtml(revenueState.currency)}</strong></div><button class="secondary-action" type="button" data-route="energy">Open Energy</button></section>
      <section class="owner-revenue-workspace">${sidebarMarkup()}<main class="owner-revenue-main">${activeContent()}</main></section>`;
  }

  function render(): void {
    const app = document.getElementById('app');
    if (!app || !app.querySelector('.workspace')) {
      layout.mount(pageMarkup());
      wireGlobal();
      wireView();
      return;
    }
    const main = app.querySelector('.main-content');
    if (!main) return;
    main.innerHTML = pageMarkup();
    wireView();
  }

  function switchTab(tab: RevenueTab): void {
    activeTab = tab;
    render();
    document.querySelector('.owner-revenue-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function downloadBlob(filename: string, content: string, type: string): void {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function exportCsv(filename = 'zentrid-sales-revenue.csv'): void {
    if (!revenueState.periods.length) return;
    const headers = ['Period', 'Generated MWh', 'Sold MWh', 'Tariff', 'Gross Revenue', 'Received', 'Outstanding', 'Currency', 'Status'];
    const rows = revenueState.periods.map(period => [period.label, period.generatedMwh ?? '', period.soldMwh ?? '', period.tariff ?? '', period.gross ?? '', period.received ?? '', period.outstanding ?? '', period.currency, period.status]);
    downloadBlob(filename, [headers, ...rows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv;charset=utf-8');
    layout.toast('API-backed sales data exported.', 'success');
  }

  function exportPayments(): void {
    if (!revenueState.payments.length) return;
    const headers = ['Payment ID', 'Period', 'Date', 'Amount', 'Currency', 'Method', 'Reference', 'Status'];
    const rows = revenueState.payments.map(payment => [payment.id, payment.period, payment.date, payment.amount ?? '', payment.currency, payment.method, payment.reference, payment.status]);
    downloadBlob('zentrid-payments.csv', [headers, ...rows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv;charset=utf-8');
    layout.toast('API-backed payment data exported.', 'success');
  }

  function safeOpen(url: string): void {
    if (!url || url === '—') return;
    try {
      const parsed = new URL(url, window.location.origin);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Unsupported document URL.');
      window.open(parsed.href, '_blank', 'noopener,noreferrer');
    } catch (_error) {
      layout.toast('The API returned an invalid document URL.', 'warning');
    }
  }

  function wireGlobal(): void {
    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      const tab = target?.closest<HTMLElement>('[data-revenue-tab]')?.dataset.revenueTab as RevenueTab | undefined;
      if (tab) {
        event.preventDefault();
        switchTab(tab);
        return;
      }
      const openSettlement = target?.closest<HTMLElement>('[data-open-settlement]')?.dataset.openSettlement;
      if (openSettlement) {
        selectedPeriodId = openSettlement;
        activeTab = 'settlements';
        render();
        return;
      }
      const statementId = target?.closest<HTMLElement>('[data-download-statement]')?.dataset.downloadStatement;
      if (statementId) safeOpen(revenueState.statements.find(statement => statement.id === statementId)?.url || '');
      const receiptId = target?.closest<HTMLElement>('[data-download-receipt]')?.dataset.downloadReceipt;
      if (receiptId) safeOpen(revenueState.payments.find(payment => payment.id === receiptId)?.receiptUrl || '');
    });
  }

  function wireView(): void {
    document.getElementById('refreshRevenueData')?.addEventListener('click', () => void loadRevenueData());
    document.getElementById('exportRevenueCsv')?.addEventListener('click', () => exportCsv());
    document.getElementById('exportRevenueCsvStatements')?.addEventListener('click', () => exportCsv('zentrid-sales-statements.csv'));
    document.getElementById('exportPaymentsCsv')?.addEventListener('click', exportPayments);
    document.getElementById('settlementPeriodSelect')?.addEventListener('change', event => {
      selectedPeriodId = (event.currentTarget as HTMLSelectElement).value;
      render();
    });
  }

  async function loadRevenueData(): Promise<void> {
    const sequence = ++requestSequence;
    revenueState = emptyRevenueState('loading');
    render();
    if (!api) {
      revenueState = { ...emptyRevenueState('error'), error: 'End User API adapter is unavailable.' };
      render();
      return;
    }
    const payloads = await Promise.all([
      api.overview?.(),
      api.dashboard?.('Month', 1, 100),
      api.energy?.('Month'),
      api.energy?.('Year'),
      api.reports?.(),
      api.plants?.()
    ]);
    if (sequence !== requestSequence) return;
    revenueState = buildState(payloads);
    if (!selectedPeriodId || !revenueState.periods.some(period => period.id === selectedPeriodId)) selectedPeriodId = revenueState.periods[0]?.id || '';
    render();
  }

  layout.mount(pageMarkup());
  wireGlobal();
  wireView();
  void loadRevenueData();
})();
