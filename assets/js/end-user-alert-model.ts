(() => {
  type OwnerAlertSeverity = 'Critical' | 'Warning' | 'Information' | 'Unknown';
  type OwnerAlertStatus = 'Open' | 'Monitoring' | 'Resolved' | 'Unknown';
  type OwnerAlertTimelineItem = { time: string; title: string; detail: string };
  type OwnerAlertRecord = {
    id: string;
    title: string;
    severity: OwnerAlertSeverity;
    status: OwnerAlertStatus;
    plantName: string;
    deviceId: string;
    deviceName: string;
    detected: string;
    updated: string;
    summary: string;
    explanation: string;
    ownerAction: string;
    operationsStatus: string;
    productionImpact: string;
    revenueImpact: string;
    estimatedLoss: string;
    supportReference: string;
    supportEmail: string;
    timeline: OwnerAlertTimelineItem[];
  };

  function isRecord(value: unknown): value is Record<string, any> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function valueAt(row: Record<string, any>, path: string): unknown {
    if (Object.prototype.hasOwnProperty.call(row, path)) return row[path];
    return path.split('.').reduce<unknown>((value, key) => isRecord(value) ? value[key] : undefined, row);
  }

  function text(row: Record<string, any>, paths: string[]): string {
    for (const path of paths) {
      const value = valueAt(row, path);
      if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
    }
    return '';
  }

  function severity(value: string): OwnerAlertSeverity {
    const normalized = value.toLowerCase().trim();
    if (!normalized) return 'Unknown';
    if (['critical','fatal','p1','high','major','emergency'].some(token => normalized.includes(token))) return 'Critical';
    if (['warning','warn','medium','p2','p3','minor'].some(token => normalized.includes(token))) return 'Warning';
    if (['information','informational','info','low','notice'].some(token => normalized.includes(token))) return 'Information';
    return 'Unknown';
  }

  function status(value: string): OwnerAlertStatus {
    const normalized = value.toLowerCase().trim();
    if (!normalized) return 'Unknown';
    if (['resolved','closed','cleared','normal','recovered'].some(token => normalized.includes(token))) return 'Resolved';
    if (['monitor','acknowledged','investigating','in progress','assigned'].some(token => normalized.includes(token))) return 'Monitoring';
    if (['open','active','new','triggered','unresolved'].some(token => normalized.includes(token))) return 'Open';
    return 'Unknown';
  }

  function timeline(row: Record<string, any>): OwnerAlertTimelineItem[] {
    const candidates = ['timeline','history','events','activities','activity','updates','milestones'];
    for (const path of candidates) {
      const value = valueAt(row, path);
      if (!Array.isArray(value)) continue;
      return value.filter(isRecord).map(item => ({
        time: text(item, ['time','timestamp','createdAt','updatedAt','occurredAt','date']),
        title: text(item, ['title','name','event','status','type']),
        detail: text(item, ['detail','description','message','summary','note'])
      })).filter(item => Boolean(item.time || item.title || item.detail));
    }
    return [];
  }

  function normalize(row: Record<string, any>): OwnerAlertRecord | null {
    const id = text(row, ['id','alertId','alert_id','eventId','event_id','uuid','code']);
    if (!id) return null;

    return {
      id,
      title: text(row, ['title','name','message','alertName','alert_name','eventName','event_name','description']),
      severity: severity(text(row, ['severity','priority','level','type'])),
      status: status(text(row, ['status','state','lifecycleStatus','lifecycle_status','resolutionStatus','resolution_status'])),
      plantName: text(row, ['plantName','plant_name','siteName','site_name','plant.name','site.name','plant']),
      deviceId: text(row, ['deviceId','device_id','assetId','asset_id','sourceId','source_id','equipmentId','equipment_id','device.id','asset.id']),
      deviceName: text(row, ['deviceName','device_name','assetName','asset_name','sourceName','source_name','equipmentName','equipment_name','device.name','asset.name']),
      detected: text(row, ['detectedAgo','detectedAt','detected_at','createdAt','created_at','startedAt','started_at','timestamp','time']),
      updated: text(row, ['updatedAgo','updatedAt','updated_at','lastActivity','last_activity','resolvedAt','resolved_at']),
      summary: text(row, ['summary','ownerMessage','owner_message','plainLanguageMessage','plain_language_message','message','description']),
      explanation: text(row, ['explanation','ownerExplanation','owner_explanation','details','description']),
      ownerAction: text(row, ['ownerAction','owner_action','recommendedAction','recommended_action','nextStep','next_step']),
      operationsStatus: text(row, ['operationsStatus','operations_status','handlingStatus','handling_status','assignmentStatus','assignment_status']),
      productionImpact: text(row, ['productionImpact','production_impact','energyImpact','energy_impact','impact']),
      revenueImpact: text(row, ['revenueImpact','revenue_impact','financialImpact','financial_impact']),
      estimatedLoss: text(row, ['estimatedLoss','estimated_loss','estimatedRevenueLoss','estimated_revenue_loss','lossEstimate','loss_estimate']),
      supportReference: text(row, ['supportReference','support_reference','caseId','case_id','ticketId','ticket_id','incidentId','incident_id']),
      supportEmail: text(row, ['supportEmail','support_email','support.email','contactEmail','contact_email']),
      timeline: timeline(row)
    };
  }

  function normalizeRows(rows: Record<string, any>[]): OwnerAlertRecord[] {
    return rows.map(normalize).filter((row): row is OwnerAlertRecord => Boolean(row));
  }

  function tone(value: OwnerAlertSeverity | OwnerAlertStatus): string {
    if (value === 'Critical' || value === 'Open') return 'danger';
    if (value === 'Warning' || value === 'Monitoring') return 'warning';
    if (value === 'Resolved') return 'success';
    return 'info';
  }

  function icon(value: OwnerAlertSeverity | OwnerAlertStatus): string {
    if (value === 'Critical' || value === 'Open') return '!';
    if (value === 'Warning' || value === 'Monitoring') return '⚠';
    if (value === 'Resolved') return '✓';
    return 'i';
  }

  window.ZentridEndUserAlertModel = { normalizeRows, tone, icon };
})();
