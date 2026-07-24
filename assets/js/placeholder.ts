(() => {
  const page = document.body.dataset.endUserPage || 'section';
  const definitions: Record<string,{title:string; eyebrow:string; icon:string; description:string}> = {
    plant: { title:'My Plant', eyebrow:'Your Solar Asset', icon:'☀️', description:'A simple plant view with status, generation, sales, devices and owner-relevant alerts will be built in the next step.' },
    devices: { title:'Devices', eyebrow:'System Equipment', icon:'🔌', description:'A clear device list focused on working, warning and offline states will be added here.' },
    'device-detail': { title:'Device Detail', eyebrow:'Simple Device View', icon:'⚙️', description:'This page will show only owner-friendly status, power, today energy and related issues.' },
    alerts: { title:'Alerts', eyebrow:'Issues & Guidance', icon:'🚨', description:'This section will explain what happened, where it happened and what the owner should do next.' },
    'alert-detail': { title:'Alert Detail', eyebrow:'Issue Explanation', icon:'⚠️', description:'A plain-language issue view with support guidance will be added here.' },
    energy: { title:'Energy', eyebrow:'Generation & Export', icon:'⚡', description:'A visual energy page for generated, sold, self-consumed and imported energy will be built here.' },
    revenue: { title:'Sales & Revenue', eyebrow:'Commercial Performance', icon:'💶', description:'Energy sold, tariff, gross revenue, payments and outstanding settlements will be completed here.' },
    reports: { title:'Reports', eyebrow:'Documents', icon:'📄', description:'Simple energy, sales, revenue and payment reports will be available for preview and download.' },
    profile: { title:'Profile', eyebrow:'My Account', icon:'👤', description:'Personal information, notification preferences, currency, units and security options will be added here.' }
  };
  const current = definitions[page] || definitions.plant!;
  window.ZentridEndUserLayout.mount(`<section class="end-user-placeholder"><article class="panel glass-card"><div class="placeholder-icon">${current.icon}</div><p class="eyebrow">${current.eyebrow}</p><h1>${current.title}</h1><p>${current.description}</p><div class="placeholder-actions"><button class="primary-action" type="button" data-route="overview">Back to Overview</button></div></article></section>`);
})();
