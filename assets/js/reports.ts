(() => {
  type AnyRecord = Record<string, unknown>;
  type ReportResourceState = 'loading' | 'live' | 'cached' | 'empty' | 'error';

  type OwnerReportRecord = {
    id: string;
    title: string;
    description: string;
    type: string;
    period: string;
    format: string;
    status: string;
    created: string;
    createdIso: string;
    size: string;
    plant: string;
    delivery: string;
    sections: string[];
    downloadUrl: string;
  };

  const layout = window.ZentridEndUserLayout;
  const app = document.getElementById('app');
  if (!layout?.mount) {
    if (app) app.innerHTML = '<section class="panel glass-card"><h1>Reports</h1><p>The Zentrid End User layout is unavailable. Restart the application and reload this page.</p></section>';
    return;
  }

  const user = window.ZentridAuth?.getUser?.() || {};
  const claims = window.ZentridAuth?.getSession?.()?.claims || {};
  const ownerEmail = String(user.email || claims.email || '').trim();

  let reports: OwnerReportRecord[] = [];
  let selectedReportId = '';
  let search = '';
  let typeFilter = '';
  let resourceState: ReportResourceState = 'loading';
  let resourceError = '';
  let resourceFetchedAt = '';

  function isRecord(value: unknown): value is AnyRecord {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function escapeValue(value: unknown): string {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character] || character));
  }

  function text(row: AnyRecord, keys: string[]): string {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
    return '';
  }

  function stringList(row: AnyRecord, keys: string[]): string[] {
    for (const key of keys) {
      const value = row[key];
      if (Array.isArray(value)) {
        return value.map(item => {
          if (typeof item === 'string') return item.trim();
          if (isRecord(item)) return text(item, ['title', 'name', 'label', 'section', 'description']);
          return '';
        }).filter(Boolean);
      }
    }
    return [];
  }

  function formatDate(value: string): string {
    if (!value) return '—';
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return value;
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }).format(new Date(parsed));
  }

  function formatFromUrl(value: string): string {
    const clean = value.split('?')[0]?.split('#')[0] || '';
    const match = clean.match(/\.([a-z0-9]{2,8})$/i);
    return match?.[1]?.toUpperCase() || '';
  }

  function safeDownloadUrl(value: string): string {
    if (!value.trim()) return '';
    try {
      const resolved = new URL(value, window.location.href);
      if (!['http:', 'https:'].includes(resolved.protocol)) return '';
      return resolved.href;
    } catch {
      return '';
    }
  }

  function normalizeReport(row: AnyRecord): OwnerReportRecord | null {
    const id = text(row, ['reportId', 'id', 'documentId', 'fileId', 'reference']);
    if (!id) return null;
    const rawUrl = text(row, ['downloadUrl', 'fileUrl', 'documentUrl', 'url', 'href']);
    const downloadUrl = safeDownloadUrl(rawUrl);
    const explicitStatus = text(row, ['status', 'state', 'reportStatus']);
    const createdIso = text(row, ['createdAt', 'generatedAt', 'publishedAt', 'updatedAt', 'date']);
    const title = text(row, ['title', 'name', 'reportName', 'fileName']) || id;
    const explicitFormat = text(row, ['format', 'fileType', 'extension', 'mimeType']);
    return {
      id,
      title,
      description: text(row, ['description', 'summary', 'notes']),
      type: text(row, ['type', 'reportType', 'category', 'documentType']) || 'Report',
      period: text(row, ['period', 'periodLabel', 'reportingPeriod', 'dateRange']) || '—',
      format: explicitFormat || formatFromUrl(downloadUrl) || '—',
      status: explicitStatus || (downloadUrl ? 'Available' : 'Metadata only'),
      created: formatDate(createdIso),
      createdIso,
      size: text(row, ['size', 'fileSize', 'sizeLabel']) || '—',
      plant: text(row, ['plantName', 'plant', 'siteName', 'assetName']) || '—',
      delivery: text(row, ['delivery', 'deliveryMethod', 'channel']) || '—',
      sections: stringList(row, ['sections', 'includedSections', 'contents']),
      downloadUrl
    };
  }

  function statusTone(status: string): string {
    const normalized = status.toLowerCase();
    if (/ready|available|complete|published|success/.test(normalized)) return 'success';
    if (/generating|pending|processing|queued/.test(normalized)) return 'warning';
    if (/fail|error|cancel|expired/.test(normalized)) return 'danger';
    return 'muted';
  }

  function filteredReports(): OwnerReportRecord[] {
    const query = search.trim().toLowerCase();
    return reports.filter(report => {
      const haystack = `${report.id} ${report.title} ${report.type} ${report.period} ${report.format}`.toLowerCase();
      return (!query || haystack.includes(query)) && (!typeFilter || report.type === typeFilter);
    });
  }

  function templateCards(): string {
    return `<div class="owner-report-empty-v17"><div class="icon">📄</div><h3>Report generation is not available</h3><p>No report generation endpoint is available in the current End User API. Existing server reports remain available below.</p></div>`;
  }

  function reportRows(): string {
    if (resourceState === 'loading') {
      return `<div class="owner-report-empty-v17"><div class="icon">↻</div><h3>Loading reports</h3><p>Requesting your report library from the End User API.</p></div>`;
    }
    if (resourceState === 'error') {
      return `<div class="owner-report-empty-v17"><div class="icon">!</div><h3>Reports are unavailable</h3><p>${escapeValue(resourceError || 'The reports API could not be reached.')}</p></div>`;
    }
    if (!reports.length) {
      return `<div class="owner-report-empty-v17"><div class="icon">📄</div><h3>No reports available</h3><p>The End User reports API returned no report records.</p></div>`;
    }
    const rows = filteredReports();
    if (!rows.length) return `<div class="owner-report-empty-v17"><div class="icon">📄</div><h3>No reports match your filters</h3><p>Clear the search or select another report type.</p><button class="secondary-action" type="button" id="clearOwnerReportFilters">Clear Filters</button></div>`;
    return rows.map(report => `<div class="owner-report-table-row-v17 ${selectedReportId === report.id ? 'selected' : ''}" data-owner-report-row="${escapeValue(report.id)}" role="row">
      <div data-label="Report" role="cell"><strong>${escapeValue(report.title)}</strong><small>${escapeValue(report.id)}</small></div>
      <div data-label="Type" role="cell"><strong>${escapeValue(report.type)}</strong><small>${escapeValue(report.plant)}</small></div>
      <div data-label="Period" role="cell"><strong>${escapeValue(report.period)}</strong><small>${escapeValue(report.created)}</small></div>
      <div data-label="Format" role="cell"><strong>${escapeValue(report.format)}</strong><small>${escapeValue(report.size)}</small></div>
      <div data-label="Status" role="cell"><span class="badge ${statusTone(report.status)}">${escapeValue(report.status)}</span><small>${escapeValue(report.delivery)}</small></div>
      <div class="row-actions owner-report-row-actions-v17" data-label="Actions" role="cell"><button class="secondary-action" type="button" data-owner-report-preview="${escapeValue(report.id)}">Preview</button><button class="secondary-action" type="button" data-owner-report-download="${escapeValue(report.id)}" ${report.downloadUrl ? '' : 'disabled'}>Download</button></div>
    </div>`).join('');
  }

  function stateLabel(): string {
    if (resourceState === 'live') return 'Live';
    if (resourceState === 'cached') return 'Cached';
    if (resourceState === 'empty') return 'Empty';
    if (resourceState === 'error') return 'Error';
    return 'Loading';
  }

  function reportKpis(): string {
    const downloadable = reports.filter(report => Boolean(report.downloadUrl)).length;
    const latest = [...reports].sort((left, right) => Date.parse(right.createdIso || '') - Date.parse(left.createdIso || ''))[0];
    const latestValue = latest ? (latest.period !== '—' ? latest.period : latest.created) : '—';
    const latestTitle = latest?.title || 'No API report returned';
    return `<section class="kpi-grid owner-report-kpis-v17" id="ownerReportKpis">
      <article class="kpi-card cyan"><div class="kpi-icon">📄</div><div class="kpi-label">API Reports</div><div class="kpi-value">${reports.length}</div><div class="kpi-delta">Records returned by the reports API</div></article>
      <article class="kpi-card green"><div class="kpi-icon">↻</div><div class="kpi-label">Latest Report</div><div class="kpi-value owner-report-kpi-text-v17">${escapeValue(latestValue)}</div><div class="kpi-delta">${escapeValue(latestTitle)}</div></article>
      <article class="kpi-card violet"><div class="kpi-icon">↓</div><div class="kpi-label">Downloadable</div><div class="kpi-value">${downloadable}</div><div class="kpi-delta">Reports with a backend download URL</div></article>
      <article class="kpi-card yellow"><div class="kpi-icon">●</div><div class="kpi-label">API Status</div><div class="kpi-value owner-report-kpi-text-v17">${stateLabel()}</div><div class="kpi-delta">${resourceFetchedAt ? `Updated ${escapeValue(formatDate(resourceFetchedAt))}` : 'Waiting for API response'}</div></article>
    </section>`;
  }

  function freshnessContent(): string {
    if (resourceState === 'live') return '<span class="pulse"></span><div><strong>Report library connected</strong><small>Live data from /api/EndUser/reports</small></div>';
    if (resourceState === 'cached') return '<span class="pulse"></span><div><strong>Cached report library</strong><small>Showing the last successful API response</small></div>';
    if (resourceState === 'empty') return '<span class="pulse"></span><div><strong>No reports returned</strong><small>The reports endpoint responded successfully with no records</small></div>';
    if (resourceState === 'error') return `<span class="pulse"></span><div><strong>Report API unavailable</strong><small>${escapeValue(resourceError || 'Request failed')}</small></div>`;
    return '<span class="pulse"></span><div><strong>Loading report library</strong><small>Connecting to /api/EndUser/reports</small></div>';
  }

  function deliveryCard(): string {
    return `<article class="panel glass-card owner-report-delivery-card-v17" id="ownerReportDeliveryCard">
      <div class="panel-head"><div><h2>Monthly Delivery</h2><p>Receive the monthly energy and revenue report automatically.</p></div><span class="badge muted">Unavailable</span></div>
      <div class="owner-report-delivery-status-v17"><span>Next report</span><strong>—</strong><small>No monthly delivery endpoint</small></div>
      <label class="check owner-report-delivery-check-v17"><input id="ownerReportDeliveryEnabled" type="checkbox" disabled /><span>Send monthly report by email</span></label>
      <label>Email address<input id="ownerReportDeliveryEmail" type="email" value="${escapeValue(ownerEmail)}" placeholder="Not provided" disabled /></label>
      <div class="owner-report-delivery-actions-v17"><button class="secondary-action" type="button" id="saveOwnerReportDelivery" disabled>Save Delivery Preference</button></div>
      <div class="owner-report-safe-note-v17"><span>i</span><div><strong>Delivery settings are read-only</strong><p>No monthly report-delivery endpoint is available in the current End User API.</p></div></div>
    </article>`;
  }

  function typeOptions(): string {
    const types = [...new Set(reports.map(report => report.type).filter(Boolean))].sort((left, right) => left.localeCompare(right));
    return `<option value="">All report types</option>${types.map(type => `<option value="${escapeValue(type)}" ${typeFilter === type ? 'selected' : ''}>${escapeValue(type)}</option>`).join('')}`;
  }

  function reportPage(): string {
    return `<section class="page-hero owner-reports-hero-v17"><div><p class="eyebrow">Documents</p><h1>Reports</h1><p class="friendly-note">Preview and download reports supplied by your organization through the End User API.</p></div><button class="freshness-card" type="button" data-route="energy" id="ownerReportFreshness">${freshnessContent()}</button></section>
      ${reportKpis()}
      <section class="owner-report-main-grid-v17">
        <article class="panel glass-card owner-report-generate-card-v17">
          <div class="panel-head"><div><h2>Generate a Report</h2><p>Report generation requires a backend generation endpoint.</p></div><button class="primary-action" type="button" id="openOwnerReportBuilder" disabled>Generate Report</button></div>
          <div class="owner-report-template-grid-v17" id="ownerReportTemplateGrid">${templateCards()}</div>
        </article>
        ${deliveryCard()}
      </section>
      <section class="panel glass-card owner-report-library-card-v17">
        <div class="panel-head"><div><h2>Recent Reports</h2><p>Server-provided documents available to your authenticated owner account.</p></div><button class="secondary-action" type="button" id="exportOwnerReportLibrary" ${reports.length ? '' : 'disabled'}>Export List</button></div>
        <div class="owner-report-toolbar-v17"><input id="ownerReportSearch" type="search" placeholder="Search report, period or ID..." aria-label="Search reports" /><select id="ownerReportTypeFilter" aria-label="Filter reports by type">${typeOptions()}</select></div>
        <div class="owner-report-table-v17" role="table" aria-label="Recent owner reports">
          <div class="owner-report-table-head-v17" role="row"><span>Report</span><span>Type</span><span>Period</span><span>Format</span><span>Status</span><span>Actions</span></div>
          <div id="ownerReportRows">${reportRows()}</div>
        </div>
      </section>
      <div class="modal owner-report-builder-modal-v17" id="ownerReportBuilderModal" aria-hidden="true"><div class="modal-card owner-report-builder-card-v17"><button class="modal-close" type="button" data-close-owner-report-builder aria-label="Close report generator">×</button><p class="eyebrow">Simple Report Generator</p><h2>Generate Report</h2><p class="friendly-note">No report generation endpoint is available.</p><form id="ownerReportBuilderForm" class="owner-report-builder-form-v17"><label>Report Type<select id="ownerReportTemplateSelect" disabled><option>Not available</option></select></label><label>Period<select id="ownerReportPeriod" disabled><option>Not available</option></select></label><label>Format<select id="ownerReportFormat" disabled><option>Not available</option></select></label><label class="check"><input id="ownerReportEmailCopy" type="checkbox" disabled /><span>Email delivery is not available</span></label><div class="owner-report-section-preview-v17" id="ownerReportSectionPreview"><strong>Generation unavailable</strong><div><span><b>i</b>No report generation endpoint is available in the current API.</span></div></div><div class="owner-report-builder-actions-v17"><button class="secondary-action" type="button" data-close-owner-report-builder>Close</button><button class="primary-action" type="submit" disabled>Generate Report</button></div></form></div></div>
      <aside class="detail-drawer owner-report-preview-drawer-v17" id="ownerReportPreviewDrawer" aria-hidden="true"></aside>`;
  }

  function reportById(id: string): OwnerReportRecord | undefined {
    return reports.find(report => report.id === id);
  }

  function previewSections(report: OwnerReportRecord): string {
    if (!report.sections.length) return '<div class="owner-report-empty-v17"><p>No section metadata was returned by the reports API.</p></div>';
    return report.sections.map((section, index) => `<article><span>${index + 1}</span><div><strong>${escapeValue(section)}</strong><small>Section metadata returned by API</small></div></article>`).join('');
  }

  function previewReport(id: string): void {
    const report = reportById(id);
    if (!report) return;
    selectedReportId = report.id;
    refreshLibrary();
    const drawer = document.getElementById('ownerReportPreviewDrawer');
    if (!drawer) return;
    drawer.innerHTML = `<button class="drawer-close" type="button" data-close-owner-report-preview aria-label="Close report preview">×</button><p class="eyebrow">Owner Report Preview</p><h2>${escapeValue(report.title)}</h2><div class="owner-report-preview-meta-v17"><span class="badge ${statusTone(report.status)}">${escapeValue(report.status)}</span><small>${escapeValue(report.id)}</small></div><div class="information-grid owner-report-preview-grid-v17"><div><span>Report Type</span><strong>${escapeValue(report.type)}</strong></div><div><span>Period</span><strong>${escapeValue(report.period)}</strong></div><div><span>Plant</span><strong>${escapeValue(report.plant)}</strong></div><div><span>Created</span><strong>${escapeValue(report.created)}</strong></div><div><span>Format</span><strong>${escapeValue(report.format)}</strong></div><div><span>Delivery</span><strong>${escapeValue(report.delivery)}</strong></div></div><section class="owner-report-preview-sections-v17"><h3>Included Sections</h3>${previewSections(report)}</section><div class="owner-report-preview-summary-v17"><span>Report summary</span><strong>${escapeValue(report.description || 'No report description returned by API.')}</strong><small>Only metadata returned by the reports API is shown.</small></div><div class="owner-report-preview-actions-v17"><button class="secondary-action" type="button" disabled>Email Report</button><button class="primary-action" type="button" data-owner-report-download="${escapeValue(report.id)}" ${report.downloadUrl ? '' : 'disabled'}>Download ${escapeValue(report.format === '—' ? 'Report' : report.format)}</button></div>`;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
  }

  function closePreview(): void {
    const drawer = document.getElementById('ownerReportPreviewDrawer');
    drawer?.classList.remove('open');
    drawer?.setAttribute('aria-hidden', 'true');
  }

  function safeOpen(value: string): void {
    const url = safeDownloadUrl(value);
    if (!url) {
      layout.toast('No backend download URL is available for this report.', 'warning');
      return;
    }
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) layout.toast('Allow pop-ups to open the report download.', 'warning');
  }

  function downloadReport(id: string): void {
    const report = reportById(id);
    if (!report) return;
    safeOpen(report.downloadUrl);
  }

  function downloadText(filename: string, content: string, type: string): void {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function exportLibrary(): void {
    const rows = filteredReports();
    if (!rows.length) {
      layout.toast('No API report records are available to export.', 'warning');
      return;
    }
    const headers = ['Report ID', 'Title', 'Description', 'Type', 'Period', 'Format', 'Status', 'Created', 'Plant', 'Download URL'];
    const values = rows.map(report => [report.id, report.title, report.description, report.type, report.period, report.format, report.status, report.created, report.plant, report.downloadUrl]);
    const csv = [headers, ...values].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadText('zentrid-owner-report-library.csv', csv, 'text/csv;charset=utf-8');
  }

  function clearFilters(): void {
    search = '';
    typeFilter = '';
    const searchInput = document.getElementById('ownerReportSearch') as HTMLInputElement | null;
    const typeSelect = document.getElementById('ownerReportTypeFilter') as HTMLSelectElement | null;
    if (searchInput) searchInput.value = '';
    if (typeSelect) typeSelect.value = '';
    refreshLibrary();
  }

  function refreshLibrary(): void {
    const rows = document.getElementById('ownerReportRows');
    if (rows) rows.innerHTML = reportRows();
  }

  function refreshPageData(): void {
    const freshness = document.getElementById('ownerReportFreshness');
    if (freshness) freshness.innerHTML = freshnessContent();

    const kpis = document.getElementById('ownerReportKpis');
    if (kpis) kpis.outerHTML = reportKpis();

    const templateGrid = document.getElementById('ownerReportTemplateGrid');
    if (templateGrid) templateGrid.innerHTML = templateCards();

    const typeSelect = document.getElementById('ownerReportTypeFilter') as HTMLSelectElement | null;
    if (typeSelect) typeSelect.innerHTML = typeOptions();

    const exportButton = document.getElementById('exportOwnerReportLibrary') as HTMLButtonElement | null;
    if (exportButton) exportButton.disabled = reports.length === 0;

    refreshLibrary();
  }

  async function resolveApi(): Promise<any> {
    if (window.ZentridEndUserAPI) return window.ZentridEndUserAPI;
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '../assets/js/end-user-api.js';
      script.async = true;
      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener('error', () => reject(new Error('The End User API adapter could not be loaded.')), { once: true });
      document.head.appendChild(script);
    });
    if (!window.ZentridEndUserAPI) throw new Error('The End User API adapter is unavailable.');
    return window.ZentridEndUserAPI;
  }

  async function loadReports(): Promise<void> {
    resourceState = 'loading';
    resourceError = '';
    refreshPageData();
    try {
      const api = await resolveApi();
      const rows = await api.reports?.();
      reports = Array.isArray(rows) ? rows.filter(isRecord).map(normalizeReport).filter((report: OwnerReportRecord | null): report is OwnerReportRecord => Boolean(report)) : [];
      const meta = api.getState?.('reports');
      resourceState = meta?.state === 'cached' ? 'cached' : meta?.state === 'error' ? 'error' : reports.length ? 'live' : 'empty';
      resourceError = String(meta?.error || '');
      resourceFetchedAt = String(meta?.fetchedAt || '');
      selectedReportId = reports.some(report => report.id === selectedReportId) ? selectedReportId : (reports[0]?.id || '');
    } catch (error) {
      reports = [];
      selectedReportId = '';
      resourceState = 'error';
      resourceError = String((error as { message?: unknown })?.message || 'The reports API could not be loaded.');
      resourceFetchedAt = '';
    }
    refreshPageData();
  }

  function wire(): void {
    document.getElementById('ownerReportSearch')?.addEventListener('input', event => {
      search = (event.target as HTMLInputElement).value;
      refreshLibrary();
    });
    document.getElementById('ownerReportTypeFilter')?.addEventListener('change', event => {
      typeFilter = (event.target as HTMLSelectElement).value;
      refreshLibrary();
    });
    document.getElementById('exportOwnerReportLibrary')?.addEventListener('click', exportLibrary);
    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      const preview = target?.closest<HTMLElement>('[data-owner-report-preview]');
      if (preview?.dataset.ownerReportPreview) previewReport(preview.dataset.ownerReportPreview);
      const download = target?.closest<HTMLElement>('[data-owner-report-download]');
      if (download?.dataset.ownerReportDownload) downloadReport(download.dataset.ownerReportDownload);
      if (target?.closest('[data-close-owner-report-preview]')) closePreview();
      if (target?.closest('#clearOwnerReportFilters')) clearFilters();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closePreview();
    });
  }

  layout.mount(reportPage());
  wire();
  void loadReports();
})();
