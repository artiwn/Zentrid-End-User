(() => {
  type OwnerDeviceStatus = 'Online' | 'Needs Attention' | 'Offline';
  type OwnerDeviceReading = { label: string; value: string; note: string };
  type OwnerDeviceRecord = {
    id: string;
    name: string;
    type: string;
    status: OwnerDeviceStatus;
    statusMessage: string;
    plantName: string;
    vendor: string;
    model: string;
    serial: string;
    location: string;
    updated: string;
    primaryLabel: string;
    primaryValue: string;
    secondaryLabel: string;
    secondaryValue: string;
    connectivity: string;
    description: string;
    readings: OwnerDeviceReading[];
  };

  const fallbackDevices: OwnerDeviceRecord[] = [
    {
      id: 'INV-ARM-001', name: 'Inverter 01', type: 'Inverter', status: 'Online',
      statusMessage: 'The inverter is producing energy and reporting normally.',
      plantName: 'Arpi Plant 01', vendor: 'Huawei', model: 'SUN2000-450KTL', serial: 'HUA-INV-ARM-001',
      location: 'Inverter Station A', updated: '2 min ago', primaryLabel: 'Current Output', primaryValue: '420 kW',
      secondaryLabel: 'Energy Today', secondaryValue: '2.8 MWh', connectivity: 'Online · Ethernet',
      description: 'Converts solar panel DC power into grid-ready AC power.',
      readings: [
        { label: 'Current Output', value: '420 kW', note: 'Live AC production' },
        { label: 'Energy Today', value: '2.8 MWh', note: 'Generated since sunrise' },
        { label: 'Efficiency', value: '98.4%', note: 'Current conversion efficiency' },
        { label: 'Operating Temperature', value: '47.2 °C', note: 'Within normal range' }
      ]
    },
    {
      id: 'INV-ARM-002', name: 'Inverter 02', type: 'Inverter', status: 'Online',
      statusMessage: 'The inverter is producing energy and reporting normally.',
      plantName: 'Arpi Plant 01', vendor: 'Huawei', model: 'SUN2000-450KTL', serial: 'HUA-INV-ARM-002',
      location: 'Inverter Station B', updated: '2 min ago', primaryLabel: 'Current Output', primaryValue: '398 kW',
      secondaryLabel: 'Energy Today', secondaryValue: '2.6 MWh', connectivity: 'Online · Ethernet',
      description: 'Converts solar panel DC power into grid-ready AC power.',
      readings: [
        { label: 'Current Output', value: '398 kW', note: 'Live AC production' },
        { label: 'Energy Today', value: '2.6 MWh', note: 'Generated since sunrise' },
        { label: 'Efficiency', value: '98.1%', note: 'Current conversion efficiency' },
        { label: 'Operating Temperature', value: '46.5 °C', note: 'Within normal range' }
      ]
    },
    {
      id: 'MTR-ARM-001', name: 'Export Meter', type: 'Export Meter', status: 'Online',
      statusMessage: 'Commercial export readings are available for settlement.',
      plantName: 'Arpi Plant 01', vendor: 'Schneider Electric', model: 'ION9000', serial: 'MTR-ARM-001',
      location: 'Grid Connection Point', updated: '1 min ago', primaryLabel: 'Exported Today', primaryValue: '9.8 MWh',
      secondaryLabel: 'Current Export', secondaryValue: '1.72 MW', connectivity: 'Online · Modbus TCP',
      description: 'Measures the energy delivered to the grid and used for commercial settlement.',
      readings: [
        { label: 'Exported Today', value: '9.8 MWh', note: 'Settlement-grade export energy' },
        { label: 'Current Export', value: '1.72 MW', note: 'Live power delivered to grid' },
        { label: 'Grid Import Today', value: '0.2 MWh', note: 'Energy received from grid' },
        { label: 'Settlement Data', value: 'Available', note: 'Latest interval is complete' }
      ]
    },
    {
      id: 'WST-ARM-001', name: 'Weather Station', type: 'Weather Station', status: 'Online',
      statusMessage: 'Environmental sensors are reporting normally.',
      plantName: 'Arpi Plant 01', vendor: 'Kipp & Zonen', model: 'SMP10 Sensor Set', serial: 'WST-ARM-001',
      location: 'Array Field North', updated: '3 min ago', primaryLabel: 'Irradiance', primaryValue: '742 W/m²',
      secondaryLabel: 'Ambient Temperature', secondaryValue: '24.8 °C', connectivity: 'Online · RS485',
      description: 'Measures sunlight and weather conditions used to understand plant performance.',
      readings: [
        { label: 'Irradiance', value: '742 W/m²', note: 'Solar energy reaching the panels' },
        { label: 'Ambient Temperature', value: '24.8 °C', note: 'Air temperature at the plant' },
        { label: 'Module Temperature', value: '41.2 °C', note: 'Measured panel temperature' },
        { label: 'Wind Speed', value: '3.6 m/s', note: 'Current site wind speed' }
      ]
    },
    {
      id: 'LOG-ARM-001', name: 'Plant Data Logger', type: 'Data Logger', status: 'Online',
      statusMessage: 'The logger is collecting and forwarding plant data normally.',
      plantName: 'Arpi Plant 01', vendor: 'Huawei', model: 'SmartLogger3000A', serial: 'LOG-ARM-001',
      location: 'Control Room', updated: '2 min ago', primaryLabel: 'Connected Devices', primaryValue: '14',
      secondaryLabel: 'Data Freshness', secondaryValue: '2 min', connectivity: 'Online · Ethernet',
      description: 'Collects readings from plant equipment and sends them securely to Zentrid.',
      readings: [
        { label: 'Connected Devices', value: '14', note: 'Equipment currently reporting' },
        { label: 'Data Freshness', value: '2 min', note: 'Age of the latest data packet' },
        { label: 'Network', value: 'Ethernet', note: 'Primary communication channel' },
        { label: 'Last Synchronization', value: '10:42', note: 'Completed successfully' }
      ]
    }
  ];

  function text(row: Record<string, any>, keys: string[]): string {
    for (const key of keys) {
      const value = row?.[key];
      if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
    }
    return '';
  }

  function normalizeStatus(value: string): OwnerDeviceStatus {
    const status = value.toLowerCase();
    if (['offline','disconnected','fault','faulted','error','critical','failed'].some(token => status.includes(token))) return 'Offline';
    if (['warning','degraded','stale','delayed','attention','unknown'].some(token => status.includes(token))) return 'Needs Attention';
    return 'Online';
  }

  function normalizeType(value: string): string {
    const type = value.toLowerCase();
    if (type.includes('inverter')) return 'Inverter';
    if (type.includes('meter')) return 'Export Meter';
    if (type.includes('weather') || type.includes('irradiance') || type.includes('sensor')) return 'Weather Station';
    if (type.includes('logger') || type.includes('gateway') || type.includes('dongle')) return 'Data Logger';
    if (type.includes('battery') || type.includes('bess')) return 'Battery';
    if (type.includes('charger') || type.includes('evse')) return 'EV Charger';
    if (type.includes('transformer')) return 'Transformer';
    return value.trim() || 'Device';
  }

  function valueWithUnit(row: Record<string, any>, keys: string[], unit: string, fallback: string): string {
    const value = text(row, keys);
    if (!value) return fallback;
    if (!unit || /[a-zA-Z%°²]/.test(value)) return value;
    return `${value} ${unit}`;
  }

  function defaultsFor(type: string, row: Record<string, any>): Pick<OwnerDeviceRecord, 'primaryLabel'|'primaryValue'|'secondaryLabel'|'secondaryValue'|'description'|'readings'> {
    if (type === 'Inverter') {
      const power = valueWithUnit(row, ['currentPower','powerNow','activePower','power','outputPower'], 'kW', 'Not available');
      const energy = valueWithUnit(row, ['energyToday','todayEnergy','dailyEnergy','yieldToday'], 'kWh', 'Not available');
      const efficiency = valueWithUnit(row, ['efficiency','conversionEfficiency'], '%', 'Not available');
      const temperature = valueWithUnit(row, ['temperature','deviceTemperature','internalTemperature'], '°C', 'Not available');
      return { primaryLabel:'Current Output', primaryValue:power, secondaryLabel:'Energy Today', secondaryValue:energy,
        description:'Converts solar panel DC power into grid-ready AC power.', readings:[
          {label:'Current Output',value:power,note:'Live AC production'}, {label:'Energy Today',value:energy,note:'Generated since sunrise'},
          {label:'Efficiency',value:efficiency,note:'Current conversion efficiency'}, {label:'Operating Temperature',value:temperature,note:'Latest available reading'}
        ] };
    }
    if (type === 'Export Meter') {
      const exported = valueWithUnit(row, ['exportEnergyToday','exportedToday','energyToday','todayEnergy'], 'kWh', 'Not available');
      const power = valueWithUnit(row, ['exportPower','currentPower','activePower','power'], 'kW', 'Not available');
      const imported = valueWithUnit(row, ['importEnergyToday','importedToday','gridImport'], 'kWh', 'Not available');
      return { primaryLabel:'Exported Today', primaryValue:exported, secondaryLabel:'Current Export', secondaryValue:power,
        description:'Measures the energy delivered to the grid and used for commercial settlement.', readings:[
          {label:'Exported Today',value:exported,note:'Commercial export energy'}, {label:'Current Export',value:power,note:'Live power delivered to grid'},
          {label:'Grid Import Today',value:imported,note:'Energy received from grid'}, {label:'Settlement Data',value:'Available',note:'Latest source record received'}
        ] };
    }
    if (type === 'Weather Station') {
      const irradiance = valueWithUnit(row, ['irradiance','poaIrradiance','solarIrradiance'], 'W/m²', 'Not available');
      const ambient = valueWithUnit(row, ['ambientTemperature','temperature','airTemperature'], '°C', 'Not available');
      const moduleTemp = valueWithUnit(row, ['moduleTemperature','panelTemperature'], '°C', 'Not available');
      const wind = valueWithUnit(row, ['windSpeed'], 'm/s', 'Not available');
      return { primaryLabel:'Irradiance', primaryValue:irradiance, secondaryLabel:'Ambient Temperature', secondaryValue:ambient,
        description:'Measures sunlight and weather conditions used to understand plant performance.', readings:[
          {label:'Irradiance',value:irradiance,note:'Solar energy reaching the panels'}, {label:'Ambient Temperature',value:ambient,note:'Air temperature at the plant'},
          {label:'Module Temperature',value:moduleTemp,note:'Measured panel temperature'}, {label:'Wind Speed',value:wind,note:'Current site wind speed'}
        ] };
    }
    if (type === 'Data Logger') {
      const connected = text(row, ['connectedDevices','deviceCount','childrenCount']) || 'Not available';
      const freshness = text(row, ['dataFreshness','freshness','lag']) || 'Recent';
      const network = text(row, ['network','connectionType','communicationType']) || 'Online';
      const sync = text(row, ['lastSync','lastSynchronization','lastSeenAt','lastActivity']) || 'Recent';
      return { primaryLabel:'Connected Devices', primaryValue:connected, secondaryLabel:'Data Freshness', secondaryValue:freshness,
        description:'Collects readings from plant equipment and sends them securely to Zentrid.', readings:[
          {label:'Connected Devices',value:connected,note:'Equipment currently reporting'}, {label:'Data Freshness',value:freshness,note:'Age of the latest data packet'},
          {label:'Network',value:network,note:'Primary communication channel'}, {label:'Last Synchronization',value:sync,note:'Latest data forwarding activity'}
        ] };
    }
    if (type === 'Battery') {
      const soc = valueWithUnit(row, ['stateOfCharge','soc'], '%', 'Not available');
      const power = valueWithUnit(row, ['currentPower','power','activePower'], 'kW', 'Not available');
      const energy = valueWithUnit(row, ['energyToday','todayEnergy'], 'kWh', 'Not available');
      const temperature = valueWithUnit(row, ['temperature','batteryTemperature'], '°C', 'Not available');
      return { primaryLabel:'State of Charge', primaryValue:soc, secondaryLabel:'Current Power', secondaryValue:power,
        description:'Stores energy for later use and supports plant energy management.', readings:[
          {label:'State of Charge',value:soc,note:'Available stored energy'}, {label:'Current Power',value:power,note:'Charging or discharging power'},
          {label:'Energy Today',value:energy,note:'Energy moved today'}, {label:'Temperature',value:temperature,note:'Latest available reading'}
        ] };
    }
    const primary = valueWithUnit(row, ['currentPower','power','activePower','value'], '', 'Available');
    const secondary = text(row, ['energyToday','todayEnergy','lastValue']) || 'Reporting normally';
    return { primaryLabel:'Current Reading', primaryValue:primary, secondaryLabel:'Status', secondaryValue:secondary,
      description:'Provides operational information for your plant.', readings:[
        {label:'Current Reading',value:primary,note:'Latest available value'}, {label:'Status',value:secondary,note:'Latest reported state'},
        {label:'Connectivity',value:'Online',note:'Communication status'}, {label:'Data Quality',value:'Available',note:'Owner-level data view'}
      ] };
  }

  function normalize(row: Record<string, any>, index: number): OwnerDeviceRecord {
    const rawType = text(row, ['type','deviceType','device_type','category','assetType','kind','model']);
    const type = normalizeType(rawType);
    const defaults = defaultsFor(type, row);
    const status = normalizeStatus(text(row, ['status','state','connectivityStatus','operationalStatus']) || 'online');
    const id = text(row, ['id','deviceId','device_id','assetId','uuid']) || `DEVICE-${index + 1}`;
    const name = text(row, ['name','deviceName','device_name','displayName','assetName','title']) || `${type} ${index + 1}`;
    const updated = text(row, ['updatedAgo','lastUpdate','lastSeen','lastSeenAt','updatedAt','timestamp']) || 'Recently';
    return {
      id, name, type, status,
      statusMessage: status === 'Offline' ? 'This device is not currently reporting. The operations team can see the same issue.' : status === 'Needs Attention' ? 'This device is reporting, but its latest data needs attention.' : 'This device is operating and reporting normally.',
      plantName: text(row, ['plantName','plant_name','siteName','site_name','plant']) || window.ZentridEndUserLayout.state.plant,
      vendor: text(row, ['vendor','manufacturer','provider']) || 'Not provided',
      model: text(row, ['model','modelName','deviceModel']) || 'Not provided',
      serial: text(row, ['serial','serialNumber','sn','deviceSn']) || id,
      location: text(row, ['location','installLocation','installationPoint']) || 'Plant site',
      updated, connectivity: text(row, ['connectivity','connectionStatus','networkStatus']) || (status === 'Offline' ? 'Offline' : 'Online'),
      primaryLabel: defaults.primaryLabel, primaryValue: defaults.primaryValue,
      secondaryLabel: defaults.secondaryLabel, secondaryValue: defaults.secondaryValue,
      description: defaults.description, readings: defaults.readings
    };
  }

  function normalizeRows(rows: Record<string, any>[]): OwnerDeviceRecord[] {
    return rows.map((row, index) => normalize(row, index));
  }

  function cloneFallback(): OwnerDeviceRecord[] {
    return fallbackDevices.map(device => ({ ...device, readings: device.readings.map(reading => ({ ...reading })) }));
  }

  function tone(status: OwnerDeviceStatus): string {
    return status === 'Offline' ? 'danger' : status === 'Needs Attention' ? 'warning' : 'success';
  }

  function icon(type: string): string {
    if (type === 'Inverter') return '⌁';
    if (type === 'Export Meter') return '▥';
    if (type === 'Weather Station') return '☀';
    if (type === 'Data Logger') return '⇄';
    if (type === 'Battery') return '▰';
    if (type === 'EV Charger') return '⚡';
    if (type === 'Transformer') return '◫';
    return '●';
  }

  window.ZentridEndUserDeviceModel = { fallback: cloneFallback, normalizeRows, tone, icon };
})();
