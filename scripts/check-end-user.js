const { existsSync, readFileSync } = require('fs');
const { join } = require('path');
const root = process.cwd();
const routes = ['index.html','login.html','pages/my-plant.html','pages/devices.html','pages/device-detail.html','pages/alerts.html','pages/alert-detail.html','pages/energy.html','pages/sales-revenue.html','pages/reports.html','pages/profile.html'];
const failures = [];
for (const route of routes) if (!existsSync(join(root, route))) failures.push(`Missing route: ${route}`);
const layout = readFileSync(join(root, 'assets/js/layout.ts'), 'utf8');
for (const label of ['Overview','My Plant','Devices','Alerts','Energy','Sales & Revenue','Reports','Profile']) if (!layout.includes(label)) failures.push(`Missing navigation label: ${label}`);
for (const forbidden of ['Tenant Admin Workspace','Clients','Integration Health','Users & Access','Tenant Settings']) if (layout.includes(forbidden)) failures.push(`Forbidden End User navigation copy: ${forbidden}`);
const overview = readFileSync(join(root, 'assets/js/overview.ts'), 'utf8');
for (const marker of ['Generated Today','Sold Today','Revenue This Month','Current Settlement','System Status']) if (!overview.includes(marker)) failures.push(`Overview missing: ${marker}`);
for (const forbidden of ['Yerevan, Armenia · 5.40 MWp','2.18 MW','12.6 MWh','9.8 MWh','€18,420','€0.074/kWh','fallback remains visible']) if (overview.includes(forbidden)) failures.push(`Overview still contains mock data: ${forbidden}`);
for (const apiMarker of ['api.overview?.()', "api.dashboard?.('Today'", 'api.plants?.()', 'api.alerts?.()', "api.energy?.('Today')"]) if (!overview.includes(apiMarker)) failures.push(`Overview API source missing: ${apiMarker}`);

const plantPage = readFileSync(join(root, 'assets/js/my-plant.ts'), 'utf8');
for (const marker of ['Plant Status','Generated Today','Sold Today','Sales & Settlement','Plant Information','Devices']) if (!plantPage.includes(marker)) failures.push(`My Plant missing: ${marker}`);
for (const forbidden of ['PL-ARM-001','Yerevan, Armenia','5.40 MWp','2.18 MW','12.6 MWh','9.8 MWh','€18,420','€0.074/kWh','INV-ARM-001','MTR-ARM-001','WST-ARM-001','fallback remains visible','latest saved view']) if (plantPage.includes(forbidden)) failures.push(`My Plant still contains mock data: ${forbidden}`);
for (const apiMarker of ['api.overview?.()', "api.dashboard?.('Today'", 'api.plants?.()', 'api.devices?.({', 'api.alerts?.()', 'api.energy?.(endUserPlantState.period)']) if (!plantPage.includes(apiMarker)) failures.push(`My Plant API source missing: ${apiMarker}`);
const plantHtml = readFileSync(join(root, 'pages/my-plant.html'), 'utf8');
if (!plantHtml.includes('my-plant.js') || plantHtml.includes('placeholder.js')) failures.push('My Plant route is not using the dedicated page script.');
const devicesSource = readFileSync(join(root, 'assets/js/devices.ts'), 'utf8');
for (const marker of ['Equipment Status','My Equipment','Total Devices','Needs Attention','Open Device']) if (!devicesSource.includes(marker)) failures.push(`Devices missing: ${marker}`);
for (const forbidden of ['model.fallback()', 'zentrid_end_user_selected_device', 'zentrid_end_user_device_id', 'Latest update 2 min ago', 'latest saved view']) if (devicesSource.includes(forbidden)) failures.push(`Devices still contains mock/browser fallback data: ${forbidden}`);
for (const apiMarker of ['api.devices({ page:1, size:100 })', "api.getState?.('devices')", "let devices: OwnerDeviceRecord[] = []"]) if (!devicesSource.includes(apiMarker)) failures.push(`Devices API-only source missing: ${apiMarker}`);
const deviceDetailSource = readFileSync(join(root, 'assets/js/device-detail.ts'), 'utf8');
for (const marker of ['Device Status','Device Overview','Current Readings','Data & Connectivity','Related Issues']) if (!deviceDetailSource.includes(marker)) failures.push(`Device Detail missing: ${marker}`);
for (const forbidden of ['model.fallback()', 'zentrid_end_user_selected_device', 'zentrid_end_user_device_id', 'localStorage.', 'INV-ARM-001', 'defaultDevice', 'Selected Device', 'latest saved view']) if (deviceDetailSource.includes(forbidden)) failures.push(`Device Detail still contains mock/browser fallback data: ${forbidden}`);
for (const apiMarker of ["const requestedId = params.get('id')?.trim() || '';", 'let device: OwnerDeviceRecord | null = null', 'api.devices({ page:1, size:100 })', 'api.alerts?.()', "api.getState?.('devices')"]) if (!deviceDetailSource.includes(apiMarker)) failures.push(`Device Detail API-only source missing: ${apiMarker}`);
for (const [route,script] of [['pages/devices.html','devices.js'],['pages/device-detail.html','device-detail.js']]) {
  const html = readFileSync(join(root, route), 'utf8');
  if (!html.includes(script) || html.includes('placeholder.js') || !html.includes('end-user-device-model.js')) failures.push(`${route} is not using the dedicated device runtime.`);
}


const alertsSource = readFileSync(join(root, 'assets/js/alerts.ts'), 'utf8');
for (const marker of ['System Status','Active Issues','Plant Issues & History','Production Impact','Revenue Impact','Contact Support']) if (!alertsSource.includes(marker)) failures.push(`Alerts missing: ${marker}`);
for (const forbidden of ['model.fallback()', 'zentrid_end_user_selected_alert', 'zentrid_end_user_alert_id', 'Fallback-first', 'latest saved view']) if (alertsSource.includes(forbidden)) failures.push(`Alerts still contains mock/browser fallback data: ${forbidden}`);
for (const apiMarker of ['let alerts: OwnerAlertRecord[] = []', 'api?.alerts?.()', "api?.getState?.('alerts')", 'alerts = normalized.filter']) if (!alertsSource.includes(apiMarker)) failures.push(`Alerts API-only source missing: ${apiMarker}`);
const alertDetailSource = readFileSync(join(root, 'assets/js/alert-detail.ts'), 'utf8');
for (const marker of ['Current Status','What happened?','What you should do','Response Timeline','Related Equipment']) if (!alertDetailSource.includes(marker)) failures.push(`Alert Detail missing: ${marker}`);
for (const forbidden of ['model.fallback()', 'localStorage.', 'zentrid_end_user_selected_alert', 'zentrid_end_user_alert_id', 'support@zentrid.example', 'Selected Plant Alert', 'detail remains available from snapshot/fallback']) if (alertDetailSource.includes(forbidden)) failures.push(`Alert Detail still contains mock/browser fallback data: ${forbidden}`);
for (const apiMarker of ["const requestedId = params.get('id')?.trim() || '';", 'let alert: OwnerAlertRecord | null = null', 'api?.alerts?.()', "api?.getState?.('alerts')", 'No response timeline available']) if (!alertDetailSource.includes(apiMarker)) failures.push(`Alert Detail API-only source missing: ${apiMarker}`);
const alertModelSource = readFileSync(join(root, 'assets/js/end-user-alert-model.ts'), 'utf8');
for (const forbidden of ['fallbackAlerts', 'cloneFallback', 'ALT-OWNER-001', 'defaultExplanation', 'Issue detected']) if (alertModelSource.includes(forbidden)) failures.push(`Alert model still contains generated business data: ${forbidden}`);
for (const apiMarker of ['if (!id) return null;', 'timeline: timeline(row)', "supportEmail: text(row", 'window.ZentridEndUserAlertModel = { normalizeRows, tone, icon }']) if (!alertModelSource.includes(apiMarker)) failures.push(`Alert model API-only mapping missing: ${apiMarker}`);
for (const [route,script] of [['pages/alerts.html','alerts.js'],['pages/alert-detail.html','alert-detail.js']]) {
  const html = readFileSync(join(root, route), 'utf8');
  if (!html.includes(script) || html.includes('placeholder.js') || !html.includes('end-user-alert-model.js')) failures.push(`${route} is not using the dedicated alert runtime.`);
}


const energySource = readFileSync(join(root, 'assets/js/energy.ts'), 'utf8');
for (const marker of ['Energy Trend','Energy Mix','Generated','Sold','Self-consumed','Imported','Period Summary','Energy to Revenue','Energy Records']) if (!energySource.includes(marker)) failures.push(`Energy missing: ${marker}`);
for (const forbidden of ['12.6 MWh','9.8 MWh','€18,420','€0.074/kWh','Armenia Grid Operator','const periods:', "estimatedRevenue: '€", 'fallback remains visible']) if (energySource.includes(forbidden)) failures.push(`Energy still contains mock data: ${forbidden}`);
for (const apiMarker of ["api.energy(periodConfig[key].apiPeriod)", "api?.getState?.(`energy:${config.apiPeriod}`)", 'let activeView = emptyView(activePeriod', 'No energy records available', 'Shown only when returned by API']) if (!energySource.includes(apiMarker)) failures.push(`Energy API-only source missing: ${apiMarker}`);
const energyHtml = readFileSync(join(root, 'pages/energy.html'), 'utf8');
if (!energyHtml.includes('energy.js') || energyHtml.includes('placeholder.js')) failures.push('Energy route is not using the dedicated page script.');



const revenueSource = readFileSync(join(root, 'assets/js/sales-revenue.ts'), 'utf8');
for (const marker of ['Sales & Revenue','Energy Sales','Settlements','Payments','Agreement','Statements','Energy Sold','Estimated Gross','Outstanding']) if (!revenueSource.includes(marker)) failures.push(`Sales & Revenue missing: ${marker}`);
for (const forbidden of ['zentrid_end_user_revenue_ui_v16', 'localStorage.', 'SET-2026-07', 'PAY-2026-071', 'Armenia Grid Settlement Co.', 'PPA-AM-2025-0041', '€0.074/kWh', 'completedJuneLines', 'Zentrid Energy Sales Statement', 'Zentrid Payment Receipt']) if (revenueSource.includes(forbidden)) failures.push(`Sales & Revenue still contains mock/browser-generated business data: ${forbidden}`);
for (const apiMarker of ["api.overview?.()", "api.dashboard?.('Month', 1, 100)", "api.energy?.('Month')", "api.energy?.('Year')", 'api.reports?.()', 'api.plants?.()', 'No financial values are estimated locally', 'safeOpen(revenueState.statements']) if (!revenueSource.includes(apiMarker)) failures.push(`Sales & Revenue API-only source missing: ${apiMarker}`);
const revenueHtml = readFileSync(join(root, 'pages/sales-revenue.html'), 'utf8');
if (!revenueHtml.includes('sales-revenue.js') || revenueHtml.includes('placeholder.js')) failures.push('Sales & Revenue route is not using the dedicated page script.');



const reportsSource = readFileSync(join(root, 'assets/js/reports.ts'), 'utf8');
for (const marker of ['Generate a Report','Recent Reports','Monthly Delivery','Owner Report Preview','api.reports?.()',"api.getState?.('reports')",'let reports: OwnerReportRecord[] = []','No report generation endpoint is available','safeOpen(report.downloadUrl)']) if (!reportsSource.includes(marker)) failures.push(`Reports API-only source missing: ${marker}`);
for (const forbidden of ['RPT-OWNER-','OWNER-TPL-','initialReports','reportsStorageKey','deliveryStorageKey','localStorage.','createReportRecord','generateReport(', 'saveReports(', 'saveDelivery(', 'pdfContent(', 'excelContent(', 'reportSummary(', '312.4 MWh', '€18,420', 'owner@example.com', 'Arpi Plant 01']) if (reportsSource.includes(forbidden)) failures.push(`Reports still contains mock/browser-generated business data: ${forbidden}`);
const reportsHtml = readFileSync(join(root, 'pages/reports.html'), 'utf8');
if (!reportsHtml.includes('reports.js') || reportsHtml.includes('placeholder.js')) failures.push('Reports route is not using the dedicated page script.');


const adapterSource = readFileSync(join(root, 'assets/js/end-user-api.ts'), 'utf8');
for (const forbidden of ['/api/Ui/dashboard${query', "'/api/EndUser/overview'", "'/api/EndUser/plants'", '`/api/EndUser/devices', "'/api/EndUser/alerts'", '`/api/EndUser/energy', "'/api/EndUser/reports'", "'/api/EndUser/profile'"]) if (adapterSource.includes(forbidden)) failures.push(`End User adapter still calls unavailable backend route: ${forbidden}`);
for (const marker of ["'/api/plants'", "'/api/devices'", "'/api/alerts'", "'/api/telemetry'", "'/api/Auth/me'", "unavailable('dashboard'", "unavailable('overview'", "unavailable('reports'"]) if (!adapterSource.includes(marker)) failures.push(`End User adapter compatibility route missing: ${marker}`);

const profileSource = readFileSync(join(root, 'assets/js/profile.ts'), 'utf8');
for (const marker of ['Personal Information','Display Preferences','Notifications','Reports & Financial Updates','Security & Access','Recent Profile Activity']) if (!profileSource.includes(marker)) failures.push(`Profile missing: ${marker}`);
for (const forbidden of ['localStorage.', 'zentrid_end_user_profile_v18', 'zentrid_end_user_preferences_v18', 'zentrid_end_user_notifications_v18', 'zentrid_end_user_communication_v18', 'zentrid_end_user_profile_events_v18', 'zentrid_end_user_report_delivery_v17', 'Arpi Solar Group', 'Arpi Plant 01', 'owner@example.com', 'PROFILE-EVT-001', 'saveEvent(', 'Personal details saved.', 'Display preferences saved.', 'Notification preferences saved.', 'Report delivery settings saved.']) if (profileSource.includes(forbidden)) failures.push(`Profile still contains mock/browser-local data: ${forbidden}`);
for (const apiMarker of ['window.ZentridEndUserAPI?.profile', 'Promise.allSettled([profileRequest, authRequest])', 'Profile updates require a backend update endpoint.', 'No profile activity returned', 'API-backed profile snapshot exported.']) if (!profileSource.includes(apiMarker)) failures.push(`Profile API-only source missing: ${apiMarker}`);
const profileHtml = readFileSync(join(root, 'pages/profile.html'), 'utf8');
if (!profileHtml.includes('profile.js') || profileHtml.includes('placeholder.js')) failures.push('Profile route is not using the dedicated page script.');

const guard = readFileSync(join(root, 'assets/js/auth-guard.ts'), 'utf8');
if (guard.includes('tenantadmin') || guard.includes('globaladmin')) failures.push('Admin roles leaked into End User auth guard.');

const cssManifest = JSON.parse(readFileSync(join(root, 'assets/css/src/manifest.json'), 'utf8'));
for (const sharedStyle of ['components/actions.css','components/ux-consistency.css','components/end-user-shell-parity.css','92-end-user-devices.css','93-end-user-alerts.css','94-end-user-energy.css','95-end-user-revenue.css','96-end-user-density-spacing.css','97-end-user-reports.css','98-end-user-profile.css']) {
  if (!cssManifest.sources.includes(sharedStyle)) failures.push(`Missing shared Zentrid style: ${sharedStyle}`);
}
const densityCss = readFileSync(join(root, 'assets/css/src/96-end-user-density-spacing.css'), 'utf8');
for (const marker of ['.end-user-page .panel', 'button.freshness-card', '.owner-energy-period-bar', '.owner-device-detail-actions']) if (!densityCss.includes(marker)) failures.push(`End User density style missing: ${marker}`);
const actionsCss = readFileSync(join(root, 'assets/css/src/components/actions.css'), 'utf8');
for (const selector of ['.primary-action', '.secondary-action']) if (!actionsCss.includes(selector)) failures.push(`Shared action selector missing: ${selector}`);
const loginSource = readFileSync(join(root, 'assets/js/login.ts'), 'utf8');
if (!loginSource.includes('class="primary-action"')) failures.push('End User login is missing the shared primary-action class.');

if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('End User check OK: 11 routes, 8 navigation items, Overview + My Plant + Devices + Alerts + Energy + Sales & Revenue + Reports + Profile and shared Zentrid style parity.');
