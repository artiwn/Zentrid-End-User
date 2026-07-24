type OwnerProfileAnyRecord = Record<string, any>;
type ProfileLoadState = 'loading' | 'live' | 'empty' | 'error';

type OwnerProfileRecord = {
  fullName: string;
  email: string;
  phone: string;
  organization: string;
  accountId: string;
  role: string;
  plantName: string;
  accountStatus: string;
  mfaStatus: string;
};

type OwnerPreferenceRecord = {
  language: string;
  timezone: string;
  currency: string;
  energyUnit: string;
  dateFormat: string;
  numberFormat: string;
};

type OwnerNotificationRecord = {
  emailEnabled: boolean | null;
  inAppEnabled: boolean | null;
  criticalAlerts: boolean | null;
  warningAlerts: boolean | null;
  deviceOffline: boolean | null;
  paymentReceived: boolean | null;
  paymentOverdue: boolean | null;
  settlementReady: boolean | null;
  reportReady: boolean | null;
  monthlySummary: boolean | null;
};

type OwnerCommunicationRecord = {
  reportEmail: string;
  monthlyReport: boolean | null;
  energySummary: boolean | null;
  financialSummary: boolean | null;
  paymentReceipts: boolean | null;
};

type OwnerProfileEvent = {
  id: string;
  title: string;
  detail: string;
  time: string;
  tone: 'success' | 'info' | 'warning';
};

(() => {
  const layout = window.ZentridEndUserLayout;
  if (!layout?.mount) {
    const app = document.getElementById('app');
    if (app) app.innerHTML = '<div class="end-user-error-banner"><strong>Profile could not be opened.</strong><small>The Zentrid layout runtime is unavailable.</small></div>';
    return;
  }

  const emptyProfile = (): OwnerProfileRecord => ({
    fullName: '',
    email: '',
    phone: '',
    organization: '',
    accountId: '',
    role: '',
    plantName: '',
    accountStatus: '',
    mfaStatus: ''
  });

  const emptyPreferences = (): OwnerPreferenceRecord => ({
    language: '',
    timezone: '',
    currency: '',
    energyUnit: '',
    dateFormat: '',
    numberFormat: ''
  });

  const emptyNotifications = (): OwnerNotificationRecord => ({
    emailEnabled: null,
    inAppEnabled: null,
    criticalAlerts: null,
    warningAlerts: null,
    deviceOffline: null,
    paymentReceived: null,
    paymentOverdue: null,
    settlementReady: null,
    reportReady: null,
    monthlySummary: null
  });

  const emptyCommunication = (): OwnerCommunicationRecord => ({
    reportEmail: '',
    monthlyReport: null,
    energySummary: null,
    financialSummary: null,
    paymentReceipts: null
  });

  let profile = emptyProfile();
  let preferences = emptyPreferences();
  let notifications = emptyNotifications();
  let communication = emptyCommunication();
  let events: OwnerProfileEvent[] = [];
  let state: ProfileLoadState = 'loading';
  let stateMessage = 'Loading profile data from API.';
  let rawProfilePayload: unknown = null;
  let rawAuthPayload: unknown = null;

  function isRecord(value: unknown): value is OwnerProfileAnyRecord {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function unwrap(value: unknown): OwnerProfileAnyRecord {
    if (!isRecord(value)) return {};
    for (const key of ['data', 'result', 'payload']) {
      if (isRecord(value[key])) return value[key];
    }
    return value;
  }

  function nestedRecord(source: OwnerProfileAnyRecord, ...keys: string[]): OwnerProfileAnyRecord {
    for (const key of keys) {
      if (isRecord(source[key])) return source[key];
    }
    return {};
  }

  function text(...values: unknown[]): string {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
    return '';
  }

  function bool(...values: unknown[]): boolean | null {
    for (const value of values) {
      if (typeof value === 'boolean') return value;
      if (value === 1 || value === '1') return true;
      if (value === 0 || value === '0') return false;
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', 'enabled', 'on', 'yes', 'active'].includes(normalized)) return true;
        if (['false', 'disabled', 'off', 'no', 'inactive'].includes(normalized)) return false;
      }
    }
    return null;
  }

  function list(...values: unknown[]): OwnerProfileAnyRecord[] {
    for (const value of values) {
      if (Array.isArray(value)) return value.filter(isRecord);
      if (isRecord(value)) {
        for (const key of ['items', 'records', 'results', 'rows']) {
          if (Array.isArray(value[key])) return value[key].filter(isRecord);
        }
      }
    }
    return [];
  }

  function escapeHtml(value: unknown): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function initials(value: string): string {
    return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'EU';
  }

  function display(value: unknown): string {
    const result = text(value);
    return result || '—';
  }

  function boolLabel(value: boolean | null): string {
    if (value === true) return 'On';
    if (value === false) return 'Off';
    return '—';
  }

  function checked(value: boolean | null): string {
    return value === true ? 'checked' : '';
  }

  function selected(actual: string, expected: string): string {
    return actual === expected ? 'selected' : '';
  }

  function options(actual: string, values: string[]): string {
    const known = Boolean(actual && values.includes(actual));
    const unknownOption = known ? '' : `<option selected>${escapeHtml(actual || 'Not provided')}</option>`;
    return unknownOption + values.map(value => `<option ${selected(actual, value)}>${escapeHtml(value)}</option>`).join('');
  }

  function enabledNotificationCount(): number | null {
    const values = [
      notifications.criticalAlerts,
      notifications.warningAlerts,
      notifications.deviceOffline,
      notifications.paymentReceived,
      notifications.paymentOverdue,
      notifications.settlementReady,
      notifications.reportReady,
      notifications.monthlySummary
    ];
    return values.every(value => value === null) ? null : values.filter(value => value === true).length;
  }

  function eventTone(value: unknown): OwnerProfileEvent['tone'] {
    const normalized = text(value).toLowerCase();
    if (['warning', 'warn', 'failed', 'error', 'danger'].includes(normalized)) return 'warning';
    if (['success', 'completed', 'active', 'ok'].includes(normalized)) return 'success';
    return 'info';
  }

  function normalizeEvents(source: OwnerProfileAnyRecord): OwnerProfileEvent[] {
    return list(source.activity, source.activities, source.events, source.history, source.profileActivity, source.auditTrail)
      .map((row, index) => ({
        id: text(row.id, row.eventId, row.activityId) || `PROFILE-ACTIVITY-${index + 1}`,
        title: text(row.title, row.name, row.action, row.eventType, row.type),
        detail: text(row.detail, row.description, row.message, row.summary),
        time: text(row.time, row.timestamp, row.createdAt, row.occurredAt, row.date),
        tone: eventTone(row.tone ?? row.status ?? row.severity)
      }))
      .filter(event => Boolean(event.title || event.detail || event.time));
  }

  function mapApiData(endUserResponse: unknown, authResponse: unknown): void {
    const endUser = unwrap(endUserResponse);
    const authRoot = unwrap(authResponse);
    const auth = isRecord(authRoot.user) ? authRoot.user : isRecord(authRoot.profile) ? authRoot.profile : authRoot;
    const person = nestedRecord(endUser, 'profile', 'user', 'personalInformation', 'personal', 'account');
    const effectivePerson = Object.keys(person).length ? person : endUser;
    const preferenceSource = nestedRecord(endUser, 'preferences', 'displayPreferences', 'localization', 'display');
    const settings = nestedRecord(endUser, 'settings', 'configuration');
    const settingsPreferences = nestedRecord(settings, 'preferences', 'displayPreferences', 'localization');
    const notificationSource = nestedRecord(endUser, 'notifications', 'notificationPreferences', 'notificationSettings');
    const settingsNotifications = nestedRecord(settings, 'notifications', 'notificationPreferences');
    const communicationSource = nestedRecord(endUser, 'communication', 'reportDelivery', 'reportPreferences', 'deliverySettings');
    const settingsCommunication = nestedRecord(settings, 'communication', 'reportDelivery', 'reportPreferences');
    const organization = nestedRecord(endUser, 'organization', 'tenant', 'company');
    const plant = nestedRecord(endUser, 'plant', 'assignedPlant', 'scope');
    const roles = Array.isArray(auth.roles) ? auth.roles : Array.isArray(endUser.roles) ? endUser.roles : [];

    const accountStatusRaw = text(
      effectivePerson.accountStatus,
      effectivePerson.status,
      endUser.accountStatus,
      endUser.status,
      auth.accountStatus,
      auth.status
    );
    const mfaValue = bool(
      effectivePerson.mfaEnabled,
      effectivePerson.isMfaEnabled,
      endUser.mfaEnabled,
      endUser.isMfaEnabled,
      auth.mfaEnabled,
      auth.isMfaEnabled
    );

    profile = {
      fullName: text(effectivePerson.fullName, effectivePerson.full_name, effectivePerson.name, endUser.fullName, auth.fullName, auth.full_name, auth.name, auth.username),
      email: text(effectivePerson.email, endUser.email, auth.email),
      phone: text(effectivePerson.phone, effectivePerson.phoneNumber, effectivePerson.phone_number, endUser.phone, auth.phone, auth.phoneNumber),
      organization: text(effectivePerson.organizationName, endUser.organizationName, organization.name, organization.organizationName, organization.tenantName, auth.organizationName, auth.tenantName),
      accountId: text(effectivePerson.accountId, effectivePerson.userId, effectivePerson.id, endUser.accountId, endUser.userId, auth.accountId, auth.userId, auth.id, auth.sub),
      role: text(effectivePerson.role, endUser.role, auth.role, roles[0]),
      plantName: text(effectivePerson.plantName, endUser.plantName, plant.name, plant.plantName, plant.displayName, endUser.assignedPlantName),
      accountStatus: accountStatusRaw,
      mfaStatus: mfaValue === null ? '' : mfaValue ? 'Enabled' : 'Disabled'
    };

    preferences = {
      language: text(preferenceSource.language, settingsPreferences.language, endUser.language),
      timezone: text(preferenceSource.timezone, preferenceSource.timeZone, settingsPreferences.timezone, settingsPreferences.timeZone, endUser.timezone),
      currency: text(preferenceSource.currency, settingsPreferences.currency, endUser.currency),
      energyUnit: text(preferenceSource.energyUnit, preferenceSource.energy_unit, settingsPreferences.energyUnit, endUser.energyUnit),
      dateFormat: text(preferenceSource.dateFormat, preferenceSource.date_format, settingsPreferences.dateFormat, endUser.dateFormat),
      numberFormat: text(preferenceSource.numberFormat, preferenceSource.number_format, settingsPreferences.numberFormat, endUser.numberFormat)
    };

    notifications = {
      emailEnabled: bool(notificationSource.emailEnabled, notificationSource.email, settingsNotifications.emailEnabled),
      inAppEnabled: bool(notificationSource.inAppEnabled, notificationSource.inApp, settingsNotifications.inAppEnabled),
      criticalAlerts: bool(notificationSource.criticalAlerts, notificationSource.critical, settingsNotifications.criticalAlerts),
      warningAlerts: bool(notificationSource.warningAlerts, notificationSource.warnings, settingsNotifications.warningAlerts),
      deviceOffline: bool(notificationSource.deviceOffline, notificationSource.offlineDevices, settingsNotifications.deviceOffline),
      paymentReceived: bool(notificationSource.paymentReceived, settingsNotifications.paymentReceived),
      paymentOverdue: bool(notificationSource.paymentOverdue, settingsNotifications.paymentOverdue),
      settlementReady: bool(notificationSource.settlementReady, settingsNotifications.settlementReady),
      reportReady: bool(notificationSource.reportReady, settingsNotifications.reportReady),
      monthlySummary: bool(notificationSource.monthlySummary, settingsNotifications.monthlySummary)
    };

    communication = {
      reportEmail: text(communicationSource.reportEmail, communicationSource.email, settingsCommunication.reportEmail, profile.email),
      monthlyReport: bool(communicationSource.monthlyReport, communicationSource.enabled, settingsCommunication.monthlyReport),
      energySummary: bool(communicationSource.energySummary, settingsCommunication.energySummary),
      financialSummary: bool(communicationSource.financialSummary, settingsCommunication.financialSummary),
      paymentReceipts: bool(communicationSource.paymentReceipts, settingsCommunication.paymentReceipts)
    };

    events = normalizeEvents(endUser);
  }

  function activityHtml(): string {
    if (!events.length) {
      return '<div class="empty-state"><strong>No profile activity returned</strong><small>Activity will appear when it is provided by the profile API.</small></div>';
    }
    return events.map(event => `<article class="owner-profile-activity-item-v18">
      <span class="owner-profile-activity-icon-v18 ${event.tone}">${event.tone === 'success' ? '✓' : event.tone === 'warning' ? '!' : 'i'}</span>
      <div><strong>${escapeHtml(display(event.title))}</strong><small>${escapeHtml(display(event.detail))}</small></div>
      <time>${escapeHtml(display(event.time))}</time>
    </article>`).join('');
  }

  function profilePage(): string {
    const notificationCount = enabledNotificationCount();
    const statusText = state === 'loading' ? 'Loading profile' : state === 'live' ? 'Profile data connected' : state === 'empty' ? 'No profile data returned' : 'Profile API unavailable';
    const statusTone = state === 'live' ? 'success' : state === 'error' ? 'danger' : state === 'empty' ? 'muted' : 'info';
    const notificationValue = notificationCount === null ? '—' : `${notificationCount}/8`;
    const monthlyReportValue = boolLabel(communication.monthlyReport);
    const accountStatus = display(profile.accountStatus);

    return `<section class="page-hero owner-profile-hero-v18">
      <div><p class="eyebrow">Account</p><h1>Profile</h1><p class="friendly-note">Manage your personal details, display preferences, notifications and report delivery.</p></div>
      <button class="freshness-card" type="button" id="ownerProfileStatusButton"><span class="pulse"></span><div><strong>${escapeHtml(statusText)}</strong><small>${escapeHtml(stateMessage)}</small></div></button>
    </section>

    <section class="owner-profile-identity-card-v18 panel glass-card">
      <div class="owner-profile-avatar-v18" id="ownerProfileAvatar">${escapeHtml(initials(profile.fullName))}</div>
      <div class="owner-profile-identity-copy-v18"><p class="eyebrow">Zentrid End User</p><h2 id="ownerProfileIdentityName">${escapeHtml(display(profile.fullName))}</h2><p>${escapeHtml(display(profile.email))}</p><div><span class="badge ${statusTone}">${escapeHtml(accountStatus)}</span><span class="badge info">${escapeHtml(display(profile.role))}</span></div></div>
      <div class="owner-profile-scope-v18"><span>Assigned Plant</span><strong>${escapeHtml(display(profile.plantName))}</strong><small>${escapeHtml(display(profile.organization))}</small></div>
    </section>

    <section class="kpi-grid owner-profile-kpis-v18">
      <article class="kpi-card green"><div class="kpi-icon">✓</div><div class="kpi-label">Account Status</div><div class="kpi-value owner-profile-kpi-text-v18">${escapeHtml(accountStatus)}</div><div class="kpi-delta">Returned by API</div></article>
      <article class="kpi-card blue"><div class="kpi-icon">🔔</div><div class="kpi-label">Notifications</div><div class="kpi-value">${escapeHtml(notificationValue)}</div><div class="kpi-delta">${notificationCount === null ? 'No preferences returned' : 'Enabled categories returned by API'}</div></article>
      <article class="kpi-card violet"><div class="kpi-icon">📄</div><div class="kpi-label">Monthly Reports</div><div class="kpi-value owner-profile-kpi-text-v18">${escapeHtml(monthlyReportValue)}</div><div class="kpi-delta">${escapeHtml(display(communication.reportEmail))}</div></article>
      <article class="kpi-card yellow"><div class="kpi-icon">€</div><div class="kpi-label">Display Currency</div><div class="kpi-value owner-profile-kpi-text-v18">${escapeHtml(display(preferences.currency))}</div><div class="kpi-delta">Energy unit ${escapeHtml(display(preferences.energyUnit))}</div></article>
    </section>

    <section class="owner-profile-main-grid-v18">
      <article class="panel glass-card owner-profile-form-card-v18">
        <div class="panel-head"><div><h2>Personal Information</h2><p>Profile fields returned by the End User and Auth APIs.</p></div><span class="badge muted">Read-only</span></div>
        <form id="ownerPersonalForm" class="owner-profile-form-grid-v18">
          <label>Full Name<input id="ownerProfileFullName" name="fullName" type="text" value="${escapeHtml(profile.fullName)}" autocomplete="name" readonly /></label>
          <label>Email Address<input id="ownerProfileEmail" name="email" type="email" value="${escapeHtml(profile.email)}" autocomplete="email" readonly /></label>
          <label>Phone Number<input id="ownerProfilePhone" name="phone" type="tel" value="${escapeHtml(profile.phone)}" autocomplete="tel" readonly /></label>
          <label>Organization<input type="text" value="${escapeHtml(profile.organization)}" readonly /></label>
          <label>Account Reference<input type="text" value="${escapeHtml(profile.accountId)}" readonly /></label>
          <label>Assigned Plant<input type="text" value="${escapeHtml(profile.plantName)}" readonly /></label>
          <div class="owner-profile-form-actions-v18"><button class="primary-action" type="submit" disabled>Save Personal Details</button></div>
        </form>
      </article>

      <article class="panel glass-card owner-profile-form-card-v18">
        <div class="panel-head"><div><h2>Display Preferences</h2><p>Preferences are shown only when returned by the profile API.</p></div><span class="badge muted">Read-only</span></div>
        <form id="ownerPreferencesForm" class="owner-profile-form-grid-v18">
          <label>Language<select id="ownerPreferenceLanguage" disabled>${options(preferences.language, ['English', 'Armenian', 'Russian'])}</select></label>
          <label>Timezone<select id="ownerPreferenceTimezone" disabled>${options(preferences.timezone, ['Asia/Yerevan', 'Europe/London', 'Europe/Berlin'])}</select></label>
          <label>Currency<select id="ownerPreferenceCurrency" disabled>${options(preferences.currency, ['EUR', 'USD', 'AMD'])}</select></label>
          <label>Energy Unit<select id="ownerPreferenceEnergyUnit" disabled>${options(preferences.energyUnit, ['MWh', 'kWh'])}</select></label>
          <label>Date Format<select id="ownerPreferenceDateFormat" disabled>${options(preferences.dateFormat, ['DD MMM YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'])}</select></label>
          <label>Number Format<select id="ownerPreferenceNumberFormat" disabled>${options(preferences.numberFormat, ['1,234.56', '1 234,56'])}</select></label>
          <div class="owner-profile-form-actions-v18"><button class="primary-action" type="submit" disabled>Save Preferences</button></div>
        </form>
      </article>
    </section>

    <section class="owner-profile-secondary-grid-v18">
      <article class="panel glass-card owner-profile-notification-card-v18">
        <div class="panel-head"><div><h2>Notifications</h2><p>Notification preferences returned by the backend.</p></div><span class="badge ${notificationCount === null ? 'muted' : 'success'}">${notificationCount === null ? 'Not provided' : `${notificationCount} enabled`}</span></div>
        <form id="ownerNotificationsForm">
          <div class="owner-profile-channel-grid-v18">
            <label class="check"><input id="ownerNotifyEmail" type="checkbox" ${checked(notifications.emailEnabled)} disabled /><span><strong>Email</strong><small>${escapeHtml(display(profile.email))}</small></span></label>
            <label class="check"><input id="ownerNotifyInApp" type="checkbox" ${checked(notifications.inAppEnabled)} disabled /><span><strong>In-app</strong><small>Returned by API</small></span></label>
          </div>
          <div class="owner-profile-toggle-grid-v18">
            <label class="check"><input id="ownerNotifyCritical" type="checkbox" ${checked(notifications.criticalAlerts)} disabled /><span>Critical plant alerts</span></label>
            <label class="check"><input id="ownerNotifyWarning" type="checkbox" ${checked(notifications.warningAlerts)} disabled /><span>Warning alerts</span></label>
            <label class="check"><input id="ownerNotifyOffline" type="checkbox" ${checked(notifications.deviceOffline)} disabled /><span>Device offline</span></label>
            <label class="check"><input id="ownerNotifyPayment" type="checkbox" ${checked(notifications.paymentReceived)} disabled /><span>Payment received</span></label>
            <label class="check"><input id="ownerNotifyOverdue" type="checkbox" ${checked(notifications.paymentOverdue)} disabled /><span>Payment overdue</span></label>
            <label class="check"><input id="ownerNotifySettlement" type="checkbox" ${checked(notifications.settlementReady)} disabled /><span>Settlement ready</span></label>
            <label class="check"><input id="ownerNotifyReport" type="checkbox" ${checked(notifications.reportReady)} disabled /><span>Report ready</span></label>
            <label class="check"><input id="ownerNotifySummary" type="checkbox" ${checked(notifications.monthlySummary)} disabled /><span>Monthly owner summary</span></label>
          </div>
          <div class="owner-profile-form-actions-v18"><button class="primary-action" type="submit" disabled>Save Notifications</button></div>
        </form>
      </article>

      <article class="panel glass-card owner-profile-communication-card-v18">
        <div class="panel-head"><div><h2>Reports & Financial Updates</h2><p>Delivery settings returned by the backend.</p></div><span class="badge ${communication.monthlyReport === null ? 'muted' : communication.monthlyReport ? 'success' : 'muted'}">${communication.monthlyReport === null ? 'Not provided' : communication.monthlyReport ? 'Monthly email on' : 'Portal only'}</span></div>
        <form id="ownerCommunicationForm" class="owner-profile-communication-form-v18">
          <label>Report Email<input id="ownerCommunicationEmail" type="email" value="${escapeHtml(communication.reportEmail)}" readonly /></label>
          <label class="check"><input id="ownerCommunicationMonthly" type="checkbox" ${checked(communication.monthlyReport)} disabled /><span><strong>Monthly report delivery</strong><small>Returned by API</small></span></label>
          <label class="check"><input id="ownerCommunicationEnergy" type="checkbox" ${checked(communication.energySummary)} disabled /><span><strong>Energy summary</strong><small>Include production and sales values</small></span></label>
          <label class="check"><input id="ownerCommunicationFinance" type="checkbox" ${checked(communication.financialSummary)} disabled /><span><strong>Financial summary</strong><small>Include settlements and revenue</small></span></label>
          <label class="check"><input id="ownerCommunicationReceipts" type="checkbox" ${checked(communication.paymentReceipts)} disabled /><span><strong>Payment receipts</strong><small>Send when supplied by the backend</small></span></label>
          <div class="owner-profile-form-actions-v18"><button class="secondary-action" type="button" data-route="reports">Open Reports</button><button class="primary-action" type="submit" disabled>Save Delivery Settings</button></div>
        </form>
      </article>
    </section>

    <section class="owner-profile-bottom-grid-v18">
      <article class="panel glass-card owner-profile-security-card-v18">
        <div class="panel-head"><div><h2>Security & Access</h2><p>Authentication and scope fields returned by the backend.</p></div><span class="badge ${statusTone}">${escapeHtml(statusText)}</span></div>
        <div class="information-grid owner-profile-security-grid-v18">
          <div><span>Portal Role</span><strong>${escapeHtml(display(profile.role))}</strong><small>Returned by API</small></div>
          <div><span>Account Status</span><strong>${escapeHtml(accountStatus)}</strong><small>Returned by API</small></div>
          <div><span>Assigned Scope</span><strong>${escapeHtml(display(profile.plantName))}</strong><small>${escapeHtml(display(profile.organization))}</small></div>
          <div><span>Password & MFA</span><strong>${escapeHtml(display(profile.mfaStatus))}</strong><small>Authentication security is controlled by Zentrid Auth</small></div>
        </div>
        <div class="owner-profile-security-note-v18"><span>i</span><div><strong>Need to change your password?</strong><p>Use the approved Zentrid Auth password recovery flow or contact your organization administrator.</p></div></div>
        <div class="owner-profile-form-actions-v18"><button class="secondary-action" type="button" id="ownerCopyAccountReference" ${profile.accountId ? '' : 'disabled'}>Copy Account Reference</button><button class="danger-action secondary-action" type="button" id="ownerProfileSignOut">Sign Out</button></div>
      </article>

      <article class="panel glass-card owner-profile-activity-card-v18">
        <div class="panel-head"><div><h2>Recent Profile Activity</h2><p>Activity returned by the profile API.</p></div><button class="secondary-action" type="button" id="ownerExportProfile">Export Settings</button></div>
        <div class="owner-profile-activity-list-v18" id="ownerProfileActivityList">${activityHtml()}</div>
      </article>
    </section>`;
  }

  function updateHeaderIdentity(): void {
    if (!profile.fullName && !profile.email) return;
    document.querySelectorAll<HTMLElement>('.profile-btn > span:not(.avatar)').forEach(node => { node.textContent = profile.fullName || profile.email; });
    document.querySelectorAll<HTMLElement>('.profile-btn .avatar').forEach(node => { node.textContent = initials(profile.fullName || profile.email); });
    document.querySelectorAll<HTMLElement>('.profile-summary strong').forEach(node => { node.textContent = profile.fullName || profile.email; });
    document.querySelectorAll<HTMLElement>('.profile-summary small').forEach(node => { node.textContent = profile.email; });
  }

  function wireForms(): void {
    for (const formId of ['ownerPersonalForm', 'ownerPreferencesForm', 'ownerNotificationsForm', 'ownerCommunicationForm']) {
      document.getElementById(formId)?.addEventListener('submit', event => {
        event.preventDefault();
        layout.toast('Profile updates require a backend update endpoint.', 'info');
      });
    }

    document.getElementById('ownerProfileStatusButton')?.addEventListener('click', () => {
      void loadProfile();
    });

    document.getElementById('ownerCopyAccountReference')?.addEventListener('click', async () => {
      if (!profile.accountId) {
        layout.toast('No account reference was returned by the API.', 'warning');
        return;
      }
      try {
        await navigator.clipboard.writeText(profile.accountId);
        layout.toast('Account reference copied.', 'success');
      } catch (_error) {
        layout.toast(`Account reference: ${profile.accountId}`, 'info');
      }
    });

    document.getElementById('ownerProfileSignOut')?.addEventListener('click', () => {
      window.ZentridAuth?.logout?.();
      window.location.href = '../login.html';
    });

    document.getElementById('ownerExportProfile')?.addEventListener('click', () => {
      const snapshot = {
        exportedAt: new Date().toISOString(),
        source: 'Zentrid End User API',
        state,
        profile,
        preferences,
        notifications,
        communication,
        activity: events,
        rawProfilePayload,
        rawAuthPayload
      };
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'zentrid-owner-profile-api-snapshot.json';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      layout.toast('API-backed profile snapshot exported.', 'success');
    });
  }

  function render(): void {
    layout.mount(profilePage());
    wireForms();
    updateHeaderIdentity();
  }

  async function loadProfile(): Promise<void> {
    state = 'loading';
    stateMessage = 'Loading profile identity from /api/Auth/me.';
    render();

    const profileRequest = window.ZentridEndUserAPI?.profile
      ? window.ZentridEndUserAPI.profile()
      : Promise.reject(new Error('The End User API adapter is not available.'));
    const authRequest = Promise.resolve(null);

    const [profileResult, authResult] = await Promise.allSettled([profileRequest, authRequest]);
    rawProfilePayload = profileResult.status === 'fulfilled' ? profileResult.value : null;
    rawAuthPayload = authResult.status === 'fulfilled' ? authResult.value : null;

    mapApiData(rawProfilePayload, rawAuthPayload);

    const profileObject = unwrap(rawProfilePayload);
    const hasProfileData = Object.keys(profileObject).length > 0;
    const hasAuthData = Object.keys(unwrap(rawAuthPayload)).length > 0;

    if (profileResult.status === 'fulfilled' && hasProfileData) {
      state = 'live';
      stateMessage = profile.plantName ? `End User access · ${profile.plantName}` : 'Profile data returned by API.';
    } else if (profileResult.status === 'fulfilled' && !hasProfileData) {
      state = hasAuthData ? 'empty' : 'empty';
      stateMessage = hasAuthData ? 'No End User profile fields returned; Available identity fields are shown.' : 'No profile data returned by API.';
    } else {
      state = 'error';
      const message = profileResult.status === 'rejected'
        ? text((profileResult.reason as OwnerProfileAnyRecord)?.message, profileResult.reason)
        : '';
      stateMessage = hasAuthData ? `${message || 'Auth profile endpoint unavailable.'} Available identity fields are shown.` : message || 'Profile API is unavailable.';
    }

    render();
  }

  render();
  void loadProfile();
})();
