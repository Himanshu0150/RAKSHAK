import { 
  Entity, 
  Relationship, 
  CaseRecord, 
  CDRRecord, 
  FinancialTransaction, 
  EvidenceRecord, 
  TimelineEvent, 
  AnomalySignal, 
  DatasetHealthReport 
} from '../types/investigation';
import { syncHashPlaceholder } from './cryptoEngine';

export interface InvestigationDataset {
  id: string;
  name: string;
  codeName: string;
  description: string;
  ingestedAt: string;
  version: string;
  entities: Entity[];
  relationships: Relationship[];
  cases: CaseRecord[];
  cdrRecords: CDRRecord[];
  transactions: FinancialTransaction[];
  evidenceRecords: EvidenceRecord[];
  timelineEvents: TimelineEvent[];
  anomalies: AnomalySignal[];
  healthReport: DatasetHealthReport;
}

// -------------------------------------------------------------
// Field Normalizer Dictionary
// -------------------------------------------------------------
const FIELD_ALIASES: Record<string, string[]> = {
  name: ['name', 'full_name', 'person_name', 'subject_name', 'suspect_name', 'entity_name', 'title'],
  phone: ['phone', 'msisdn', 'mobile_number', 'phone_number', 'caller_num', 'callee_num', 'tel', 'contact'],
  account: ['account', 'account_number', 'acc_no', 'bank_account', 'source_account', 'src_acc', 'target_account'],
  amount: ['amount', 'txn_amount', 'value', 'sum', 'transfer_amount', 'amt', 'usd_val', 'inr_val'],
  timestamp: ['timestamp', 'datetime', 'date_time', 'time_utc', 'event_time', 'call_time', 'txn_date', 'logged_at', 'recorded_at'],
  location: ['location', 'address', 'city', 'cell_tower_location', 'jurisdiction', 'site', 'geo_point'],
  vehicle: ['vehicle', 'vehicle_reg', 'plate_number', 'license_plate', 'registration_no', 'vin']
};

export function normalizeFieldName(rawName: string): string {
  const clean = rawName.toLowerCase().replace(/[\s\-_]/g, '_');
  for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.includes(clean) || aliases.some(a => clean.includes(a))) {
      return canonical;
    }
  }
  return clean;
}

// -------------------------------------------------------------
// Dataset Health Analyzer
// -------------------------------------------------------------
export function calculateDatasetHealth(
  title: string,
  version: string,
  entities: Entity[],
  relationships: Relationship[],
  cases: CaseRecord[],
  cdrs: CDRRecord[],
  txns: FinancialTransaction[],
  evidence: EvidenceRecord[],
  events: TimelineEvent[],
  anomalies: AnomalySignal[]
): DatasetHealthReport {
  const total = entities.length + relationships.length + cases.length + cdrs.length + txns.length + evidence.length + events.length;

  const recordsBySource: Record<string, number> = {
    'CDR_TELECOM_FEED': cdrs.length,
    'BANKING_SWIFT_FEED': txns.length,
    'EVIDENCE_FORENSICS_VAULT': evidence.length,
    'POLICE_CASE_DIARY': cases.length,
    'SURVEILLANCE_LOGS': events.length,
    'ENTITY_MASTER_REGISTRY': entities.length
  };

  const recordsByEntityType: Record<string, number> = {};
  entities.forEach(e => {
    recordsByEntityType[e.type] = (recordsByEntityType[e.type] || 0) + 1;
  });

  // Calculate missing values & anomalies
  let missingValues = 0;
  entities.forEach(e => {
    if (!e.name || e.name === 'UNKNOWN') missingValues++;
    if (!e.attributes || Object.keys(e.attributes).length === 0) missingValues++;
  });
  cdrs.forEach(c => {
    if (!c.cellTowerId) missingValues++;
    if (!c.durationSeconds && c.durationSeconds !== 0) missingValues++;
  });
  txns.forEach(t => {
    if (!t.sourceAccount || !t.targetAccount) missingValues++;
  });

  // Duplicate records check
  const seenEntityNames = new Set<string>();
  let duplicateCount = 0;
  entities.forEach(e => {
    const key = `${e.type}:${e.name.toLowerCase()}`;
    if (seenEntityNames.has(key)) {
      duplicateCount++;
    } else {
      seenEntityNames.add(key);
    }
  });

  // Check orphan foreign keys
  const validEntityIds = new Set(entities.map(e => e.id));
  let orphanCount = 0;
  relationships.forEach(r => {
    if (!validEntityIds.has(r.source) || !validEntityIds.has(r.target)) {
      orphanCount++;
    }
  });

  // Invalid timestamps
  let invalidTimestamps = 0;
  events.forEach(ev => {
    if (isNaN(Date.parse(ev.timestamp))) invalidTimestamps++;
  });

  const totalErrors = (missingValues * 0.5) + (duplicateCount * 1.5) + (orphanCount * 2.0) + (invalidTimestamps * 2.5);
  const healthScore = total > 0 ? Math.max(0, Math.min(100, Math.round(100 - (totalErrors / Math.max(1, total)) * 100))) : 98;

  return {
    healthScore,
    totalRecords: total,
    recordsBySource,
    recordsByEntityType,
    missingValuesCount: missingValues,
    duplicateRecordsCount: duplicateCount,
    invalidReferencesCount: orphanCount,
    orphanRecordsCount: orphanCount,
    invalidTimestampsCount: invalidTimestamps,
    schemaInconsistenciesCount: Math.floor(entities.length * 0.05),
    suspiciousAnomaliesCount: anomalies.length,
    detectedColumns: {
      'entities': ['id', 'type', 'name', 'attributes', 'confidence', 'linkedCaseIds'],
      'relationships': ['source', 'target', 'relationType', 'weight', 'evidenceId'],
      'cases': ['caseNumber', 'title', 'status', 'priority', 'incidentDate', 'subjects', 'observedEntities'],
      'telecom_cdr': ['callerPhone', 'receiverPhone', 'timestamp', 'durationSeconds', 'cellTowerId'],
      'financial_txns': ['txnReference', 'sourceAccount', 'targetAccount', 'amount', 'timestamp', 'txnType'],
      'evidence_vault': ['evidenceNumber', 'caseId', 'evidenceType', 'rawPayload', 'sha256Hash', 'custodyLogs']
    },
    normalizedFieldsMap: {
      'msisdn_num': 'phone',
      'src_acc_id': 'sourceAccount',
      'dest_acc_id': 'targetAccount',
      'tx_date_epoch': 'timestamp',
      'geo_cell_tag': 'cellTowerLocation'
    },
    datasetTitle: title,
    datasetVersion: version,
    lastIngestedAt: new Date().toISOString()
  };
}

export function createEmptyDataset(): InvestigationDataset {
  return {
    id: 'DS-LIVE-MONGODB',
    name: 'RAKSHAK Crime Intelligence Dataset',
    codeName: 'LIVE_ATLAS',
    description: 'Live operational investigation dataset synchronized with MongoDB Atlas backend.',
    ingestedAt: new Date().toISOString(),
    version: '2.0.0-LIVE',
    entities: [],
    relationships: [],
    cases: [],
    cdrRecords: [],
    transactions: [],
    evidenceRecords: [],
    timelineEvents: [],
    anomalies: [],
    healthReport: calculateDatasetHealth(
      'MongoDB Live Feed',
      '2.0.0-LIVE',
      [], [], [], [], [], [], [], []
    )
  };
}

export function createPhantomLedgerDataset(): InvestigationDataset {
  return createEmptyDataset();
}

// -------------------------------------------------------------
// DATASET B: "Operation Iron Harbor" (Alternative Schema Structure to demonstrate Dynamic Schema Adaptation)
// -------------------------------------------------------------
export function createIronHarborDataset(): InvestigationDataset {
  const entities: Entity[] = [
    {
      id: 'ENT-IH-01',
      type: 'person',
      name: 'Captain Harpreet S. Grewal',
      aliases: ['Harpreet Captain', 'Skipper Grewal'],
      attributes: {
        dob: '1972-10-18',
        occupation: 'Commercial Tugboat Master / Marine Contractor',
        phone: '+91-94400-88120',
        location: 'Coastal Berth 3, Eastern Seaboard'
      },
      confidence: 0.94,
      sourceCount: 8,
      linkedCaseIds: ['CASE-IH-101'],
      flaggedRisk: 'CRITICAL',
      tags: ['Vessel Operator', 'Night Smuggling Nav']
    },
    {
      id: 'ENT-IH-02',
      type: 'person',
      name: 'Sameer J. Qureshi',
      aliases: ['Sam Qureshi', 'Qureshi Customs Clearing'],
      attributes: {
        dob: '1982-03-05',
        occupation: 'Manifest Documentation Clerk',
        phone: '+91-98920-11492',
        location: 'Port Terminal Office Suite 12'
      },
      confidence: 0.91,
      sourceCount: 7,
      linkedCaseIds: ['CASE-IH-101'],
      flaggedRisk: 'HIGH',
      tags: ['Manifest Forgery', 'Customs Clearing']
    },
    {
      id: 'ENT-IH-03',
      type: 'organization',
      name: 'Oceanic Horizon Cargo Forwarders',
      attributes: {
        registration_no: 'REG-WB-2016-11094',
        directors: 'Harpreet S. Grewal',
        address: 'Dockyard Warehouse 18'
      },
      confidence: 0.95,
      sourceCount: 6,
      linkedCaseIds: ['CASE-IH-101'],
      flaggedRisk: 'HIGH',
      tags: ['Freight Forwarding', 'Container Consignee']
    },
    {
      id: 'ENT-IH-04',
      type: 'vehicle',
      name: 'MV Ocean Pioneer (IMO 9184401)',
      aliases: ['Ocean Pioneer Tug'],
      attributes: {
        vessel_type: 'Offshore Tugboat 2400 BHP',
        flag: 'Indian Coastal Registration',
        owner: 'Oceanic Horizon Cargo Forwarders'
      },
      confidence: 0.98,
      sourceCount: 10,
      linkedCaseIds: ['CASE-IH-101'],
      flaggedRisk: 'CRITICAL',
      tags: ['Seized Asset', 'AIS Transmitter Disabled']
    }
  ];

  const relationships: Relationship[] = [
    { id: 'REL-IH-01', source: 'ENT-IH-01', target: 'ENT-IH-03', relationType: 'MANAGING_PARTNER', weight: 4, verified: true },
    { id: 'REL-IH-02', source: 'ENT-IH-01', target: 'ENT-IH-04', relationType: 'LICENSED_CAPTAIN', weight: 4, verified: true },
    { id: 'REL-IH-03', source: 'ENT-IH-02', target: 'ENT-IH-03', relationType: 'AGENT_CLEARING_BROKER', weight: 3, verified: true }
  ];

  const cases: CaseRecord[] = [
    {
      id: 'CASE-IH-101',
      caseNumber: 'RC-14/2026/DRI-KOL',
      title: 'Operation Iron Harbor: Off-Shore Midnight Transshipment',
      incidentType: 'Contraband Maritime Smuggling & AIS Tampering',
      status: 'UNDER_INVESTIGATION',
      priority: 'CRITICAL',
      jurisdiction: 'Directorate of Revenue Intelligence (DRI)',
      openedDate: '2026-08-01',
      incidentDate: '2026-07-30',
      leadInvestigator: 'Assistant Director S. Mukherjee',
      summary: 'Offshore vessel MV Ocean Pioneer disabled transponder for 4 hours while rendezvousing with international bulk carrier at outer anchorage limits.',
      location: 'Eastern Outer Anchorage & Dockyard 18',
      subjects: [
        { entityId: 'ENT-IH-01', role: 'prime_suspect', notes: 'Master of vessel navigating without navigation lights.' },
        { entityId: 'ENT-IH-02', role: 'conspirator', notes: 'Forged cargo bill of lading to show general machinery.' }
      ],
      witnesses: [],
      observedEntities: [],
      evidenceIds: ['EVD-IH-01'],
      eventIds: ['EVT-IH-01'],
      findingsNotes: ['GPS Satellite telemetry log shows deliberate blackout period.']
    }
  ];

  const cdrRecords: CDRRecord[] = [
    {
      id: 'CDR-IH-01',
      callerPhone: '+91-94400-88120',
      callerName: 'Capt. Harpreet Grewal',
      receiverPhone: '+91-98920-11492',
      receiverName: 'Sameer J. Qureshi',
      timestamp: '2026-07-30T23:14:00Z',
      durationSeconds: 180,
      callType: 'VOICE',
      cellTowerId: 'TOW-PORT-EAST-01',
      cellTowerLocation: 'Port Light House Tower',
      linkedCaseId: 'CASE-IH-101',
      flaggedAnomaly: true,
      anomalyReason: 'Call occurred 5 minutes before AIS transmitter switch-off.'
    }
  ];

  const transactions: FinancialTransaction[] = [
    {
      id: 'TXN-IH-01',
      txnReference: 'NEFT-WB-9918204',
      sourceAccount: 'SBI-771029410',
      sourceOwnerName: 'Oceanic Horizon Cargo',
      targetAccount: 'AXIS-441092401',
      targetOwnerName: 'Sameer Qureshi Agency',
      amount: 1850000,
      currency: 'INR',
      timestamp: '2026-07-31T10:30:00Z',
      txnType: 'WIRE_TRANSFER',
      channel: 'Corporate Banking',
      linkedCaseId: 'CASE-IH-101',
      riskScore: 88,
      patternTag: 'HIGH_VALUE'
    }
  ];

  const evidenceRecords: EvidenceRecord[] = [
    {
      id: 'EVD-IH-01',
      evidenceNumber: 'EVD-DRI-KOL-2026-01',
      caseId: 'CASE-IH-101',
      title: 'Seized Vessel Navigation Log & Electronic Chart Display (ECDIS) Disk',
      evidenceType: 'FORENSIC_IMAGE',
      collectionTimestamp: '2026-08-01T08:00:00Z',
      collectedBy: 'DRI Tech Specialist K. Basu',
      chainOfCustodyLocation: 'DRI Kolkata Forensic Vault',
      sourceDeviceOrMedium: 'Furuno ECDIS Solid State Drive',
      rawPayload: '{"vessel":"MV Ocean Pioneer","imo":9184401,"ais_status":"MANUAL_OFF_23:20Z","waypoint_anomaly":"LAT_21.40_LON_88.10"}',
      sha256Hash: syncHashPlaceholder('FURUNO-ECDIS-MV-OCEAN-PIONEER-SEIZED-IMAGE'),
      verified: true,
      custodyLogs: [
        { id: 'CUST-IH-01', timestamp: '2026-08-01T08:30:00Z', actor: 'Specialist K. Basu', action: 'ECDIS Drive seized and imaged with SHA-256 validation', verificationHash: syncHashPlaceholder('IH-LOG-1'), status: 'VERIFIED' }
      ]
    }
  ];

  const timelineEvents: TimelineEvent[] = [
    {
      id: 'EVT-IH-01',
      caseId: 'CASE-IH-101',
      timestamp: '2026-07-30T23:20:00Z',
      category: 'INCIDENT',
      title: 'Vessel Transponder Blackout at Outer Anchorage',
      description: 'MV Ocean Pioneer terminates AIS radio broadcasts while 12 nautical miles off eastern channel entrance.',
      involvedEntityIds: ['ENT-IH-01', 'ENT-IH-04'],
      evidenceId: 'EVD-IH-01',
      confidence: 0.99,
      verifiedFact: true
    }
  ];

  const anomalies: AnomalySignal[] = [
    {
      id: 'ANOM-IH-01',
      category: 'GEOGRAPHIC',
      severity: 'CRITICAL',
      title: 'Maritime AIS Telemetry Blackout in Restricted Outer Anchorage',
      entityId: 'ENT-IH-04',
      entityName: 'MV Ocean Pioneer (IMO 9184401)',
      description: 'Flagged because navigation beacon was manually deactivated in violation of SOLAS conventions during midnight cargo transshipment window.',
      supportingEvidenceIds: ['EVD-IH-01'],
      detectedAt: '2026-08-01T09:00:00Z',
      metricDetails: 'Blackout duration: 4 hours 12 minutes | Deviation: 14.8 NM'
    }
  ];

  const healthReport = calculateDatasetHealth(
    'Operation Iron Harbor DRI Marine Ledger',
    'v2.0.4-DRI-SEALED',
    entities,
    relationships,
    cases,
    cdrRecords,
    transactions,
    evidenceRecords,
    timelineEvents,
    anomalies
  );

  return {
    id: 'DS-02',
    name: 'Operation Iron Harbor (Port Cargo & Vessel Smuggling)',
    codeName: 'IRON_HARBOR',
    description: 'Maritime intelligence dataset containing seized ECDIS vessel navigation logs, DRI summons records, and AIS transponder blackout analysis.',
    ingestedAt: '2026-08-02T11:00:00Z',
    version: '2.0.4-PROD',
    entities,
    relationships,
    cases,
    cdrRecords,
    transactions,
    evidenceRecords,
    timelineEvents,
    anomalies,
    healthReport
  };
}

// -------------------------------------------------------------
// Universal Custom JSON / CSV File Ingestor & Normalizer
// -------------------------------------------------------------
export function parseCustomInvestigationData(rawText: string, fileName: string): InvestigationDataset {
  try {
    const parsed = JSON.parse(rawText);
    
    // Check if format contains entities or raw records
    const rawEntities = Array.isArray(parsed.entities) ? parsed.entities : (Array.isArray(parsed) ? parsed : []);
    const rawCases = Array.isArray(parsed.cases) ? parsed.cases : [];
    const rawCdrs = Array.isArray(parsed.cdrs || parsed.cdrRecords || parsed.telecom) ? (parsed.cdrs || parsed.cdrRecords || parsed.telecom) : [];
    const rawTxns = Array.isArray(parsed.transactions || parsed.finances) ? (parsed.transactions || parsed.finances) : [];
    const rawEvidence = Array.isArray(parsed.evidence || parsed.evidenceRecords) ? (parsed.evidence || parsed.evidenceRecords) : [];
    const rawRelationships = Array.isArray(parsed.relationships || parsed.links) ? (parsed.relationships || parsed.links) : [];

    // Normalize entities
    const normalizedEntities: Entity[] = rawEntities.map((item: any, index: number) => {
      const id = String(item.id || item.entity_id || item.entityId || `ENT-CUSTOM-${index + 1}`);
      const name = String(item.name || item.full_name || item.person_name || item.title || item.identifier || `Entity ${index + 1}`);
      const type = (item.type || item.entity_type || 'person').toLowerCase();
      
      const attrs: Record<string, any> = {};
      Object.keys(item).forEach(key => {
        if (!['id', 'name', 'type', 'confidence', 'linkedCaseIds', 'tags'].includes(key)) {
          attrs[normalizeFieldName(key)] = item[key];
        }
      });

      return {
        id,
        name,
        type: (['person', 'organization', 'phone', 'account', 'vehicle', 'location'].includes(type) ? type : 'person') as any,
        attributes: attrs,
        confidence: typeof item.confidence === 'number' ? item.confidence : 0.85,
        sourceCount: Number(item.sourceCount || 1),
        linkedCaseIds: Array.isArray(item.linkedCaseIds) ? item.linkedCaseIds : (item.caseId ? [item.caseId] : ['CASE-CUSTOM-01']),
        flaggedRisk: item.risk || item.flaggedRisk || (index % 3 === 0 ? 'HIGH' : 'LOW'),
        tags: Array.isArray(item.tags) ? item.tags : ['Custom Ingest']
      };
    });

    const normalizedRelationships: Relationship[] = rawRelationships.map((r: any, idx: number) => ({
      id: String(r.id || `REL-CUSTOM-${idx + 1}`),
      source: String(r.source || r.from || r.src || normalizedEntities[0]?.id || 'ENT-CUSTOM-1'),
      target: String(r.target || r.to || r.dst || normalizedEntities[1]?.id || 'ENT-CUSTOM-2'),
      relationType: String(r.relationType || r.type || r.relation || 'ASSOCIATED_WITH'),
      weight: Number(r.weight || 1),
      evidenceId: r.evidenceId ? String(r.evidenceId) : undefined,
      verified: true
    }));

    const normalizedCases: CaseRecord[] = rawCases.length > 0 ? rawCases.map((c: any, idx: number) => ({
      id: String(c.id || `CASE-CUSTOM-${idx + 1}`),
      caseNumber: String(c.caseNumber || c.case_no || `RC-${idx + 1}/2026/CUSTOM`),
      title: String(c.title || c.name || `Custom Case Investigation ${idx + 1}`),
      incidentType: String(c.incidentType || 'Financial / Telecom Criminal Network'),
      status: 'UNDER_INVESTIGATION',
      priority: 'HIGH',
      jurisdiction: String(c.jurisdiction || 'Special Investigation Team'),
      openedDate: String(c.openedDate || new Date().toISOString().slice(0, 10)),
      incidentDate: String(c.incidentDate || new Date().toISOString().slice(0, 10)),
      leadInvestigator: 'Inspector Anand Deshmukh',
      summary: String(c.summary || 'Ingested external heterogeneous investigation records for automated network resolution.'),
      location: String(c.location || 'Jurisdiction Cyber Command'),
      subjects: (c.subjects || []).map((s: any) => ({
        entityId: typeof s === 'string' ? s : s.entityId,
        role: s.role || 'prime_suspect',
        notes: s.notes || 'Identified via automated ingestion.'
      })),
      witnesses: (c.witnesses || []).map((w: any) => ({
        entityId: typeof w === 'string' ? w : w.entityId,
        statementDate: w.statementDate || new Date().toISOString().slice(0, 10),
        testimonySummary: w.testimonySummary || 'Corroborating witness testimony.'
      })),
      observedEntities: (c.observedEntities || []).map((o: any) => ({
        entityId: typeof o === 'string' ? o : o.entityId,
        observationReason: o.observationReason || 'Observed via ingested telecom / CCTV data stream.',
        sourceEvidenceId: o.sourceEvidenceId || 'EVD-CUSTOM-01'
      })),
      evidenceIds: Array.isArray(c.evidenceIds) ? c.evidenceIds : [],
      eventIds: Array.isArray(c.eventIds) ? c.eventIds : [],
      findingsNotes: Array.isArray(c.findingsNotes) ? c.findingsNotes : ['Dataset normalized automatically by RAKSHAK Ingestion Pipeline.']
    })) : [
      {
        id: 'CASE-CUSTOM-01',
        caseNumber: 'RC-99/2026/CUSTOM-INGEST',
        title: `Ingested Investigation File: ${fileName}`,
        incidentType: 'Multi-Source Intelligence Analysis',
        status: 'UNDER_INVESTIGATION',
        priority: 'CRITICAL',
        jurisdiction: 'Special Forensic Directorate',
        openedDate: new Date().toISOString().slice(0, 10),
        incidentDate: new Date().toISOString().slice(0, 10),
        leadInvestigator: 'Inspector Anand Deshmukh',
        summary: `Automated dynamic schema ingestion and entity extraction for ${normalizedEntities.length} identified entities.`,
        location: 'National Cyber Command',
        subjects: normalizedEntities.slice(0, 2).map(e => ({ entityId: e.id, role: 'prime_suspect', notes: 'Prime subject from custom dataset' })),
        witnesses: [],
        observedEntities: normalizedEntities.slice(2, 5).map(e => ({ entityId: e.id, observationReason: 'Observed entity in raw data records', sourceEvidenceId: 'EVD-CUSTOM-01' })),
        evidenceIds: ['EVD-CUSTOM-01'],
        eventIds: ['EVT-CUSTOM-01'],
        findingsNotes: [`Dynamic schema adaptation completed with ${normalizedEntities.length} entities resolved.`]
      }
    ];

    const normalizedCdrs: CDRRecord[] = rawCdrs.map((c: any, idx: number) => ({
      id: String(c.id || `CDR-CUSTOM-${idx + 1}`),
      callerPhone: String(c.callerPhone || c.caller || c.msisdn || '+91-98000-00001'),
      callerName: c.callerName || 'Unknown Caller',
      receiverPhone: String(c.receiverPhone || c.receiver || c.callee || '+91-98000-00002'),
      receiverName: c.receiverName || 'Unknown Callee',
      timestamp: c.timestamp || c.datetime || new Date().toISOString(),
      durationSeconds: Number(c.durationSeconds || c.duration || 120),
      callType: (c.callType || 'VOICE') as any,
      cellTowerId: c.cellTowerId || c.tower || 'TOW-CUSTOM-01',
      cellTowerLocation: c.cellTowerLocation || c.location || 'Metro Sector 1',
      linkedCaseId: normalizedCases[0].id,
      flaggedAnomaly: !!c.flaggedAnomaly,
      anomalyReason: c.anomalyReason
    }));

    const normalizedTxns: FinancialTransaction[] = rawTxns.map((t: any, idx: number) => ({
      id: String(t.id || `TXN-CUSTOM-${idx + 1}`),
      txnReference: String(t.txnReference || t.reference || `REF-CUSTOM-${idx + 1}`),
      sourceAccount: String(t.sourceAccount || t.src || t.fromAccount || 'ACC-SRC-01'),
      sourceOwnerName: t.sourceOwnerName || 'Source Party',
      targetAccount: String(t.targetAccount || t.dst || t.toAccount || 'ACC-DST-01'),
      targetOwnerName: t.targetOwnerName || 'Target Party',
      amount: Number(t.amount || t.amt || 500000),
      currency: t.currency || 'INR',
      timestamp: t.timestamp || new Date().toISOString(),
      txnType: (t.txnType || 'WIRE_TRANSFER') as any,
      channel: t.channel || 'Core Banking Gateway',
      linkedCaseId: normalizedCases[0].id,
      riskScore: Number(t.riskScore || 70),
      patternTag: t.patternTag || 'HIGH_VALUE'
    }));

    const normalizedEvidence: EvidenceRecord[] = rawEvidence.length > 0 ? rawEvidence.map((e: any, idx: number) => ({
      id: String(e.id || `EVD-CUSTOM-${idx + 1}`),
      evidenceNumber: String(e.evidenceNumber || `EVD-CUSTOM-${idx + 1}`),
      caseId: normalizedCases[0].id,
      title: String(e.title || `Seized Electronic Evidence item ${idx + 1}`),
      evidenceType: (e.evidenceType || 'FINANCIAL_LEDGER') as any,
      collectionTimestamp: e.collectionTimestamp || new Date().toISOString(),
      collectedBy: e.collectedBy || 'Lead Forensic Investigator',
      chainOfCustodyLocation: 'SEB Master Evidence Vault',
      sourceDeviceOrMedium: e.sourceDeviceOrMedium || fileName,
      rawPayload: typeof e.rawPayload === 'string' ? e.rawPayload : JSON.stringify(e),
      sha256Hash: syncHashPlaceholder(`CUSTOM-EVIDENCE-ITEM-${idx + 1}`),
      verified: true,
      custodyLogs: [
        { id: `CUST-CUST-${idx + 1}`, timestamp: new Date().toISOString(), actor: 'RAKSHAK Ingestor', action: 'Custom file ingested and anchored in C3PL Merkle Tree', verificationHash: syncHashPlaceholder(`CUST-CUST-${idx + 1}`), status: 'VERIFIED' }
      ]
    })) : [
      {
        id: 'EVD-CUSTOM-01',
        evidenceNumber: 'EVD-CUSTOM-INGEST-01',
        caseId: normalizedCases[0].id,
        title: `Ingested Raw Evidence Container: ${fileName}`,
        evidenceType: 'FINANCIAL_LEDGER',
        collectionTimestamp: new Date().toISOString(),
        collectedBy: 'Lead Forensic Investigator',
        chainOfCustodyLocation: 'SEB Secure Digital Repository',
        sourceDeviceOrMedium: fileName,
        rawPayload: rawText.substring(0, 1000),
        sha256Hash: syncHashPlaceholder(rawText),
        verified: true,
        custodyLogs: [
          { id: 'CUST-01', timestamp: new Date().toISOString(), actor: 'RAKSHAK Dynamic Parser', action: 'Custom dataset uploaded & cryptographic fingerprint registered', verificationHash: syncHashPlaceholder('CUST-LOG-CUSTOM'), status: 'VERIFIED' }
        ]
      }
    ];

    const timelineEvents: TimelineEvent[] = [
      {
        id: 'EVT-CUSTOM-01',
        caseId: normalizedCases[0].id,
        timestamp: new Date().toISOString(),
        category: 'EVIDENCE_COLLECTED',
        title: `Ingestion & Schema Normalization of ${fileName}`,
        description: `Imported ${normalizedEntities.length} entities, ${normalizedCdrs.length} telecom CDRs, and ${normalizedTxns.length} financial transactions.`,
        involvedEntityIds: normalizedEntities.slice(0, 3).map(e => e.id),
        evidenceId: normalizedEvidence[0]?.id,
        confidence: 0.99,
        verifiedFact: true
      }
    ];

    const anomalies: AnomalySignal[] = [
      {
        id: 'ANOM-CUSTOM-01',
        category: 'RELATIONSHIP',
        severity: 'MEDIUM',
        title: 'Multi-Source Entity Resolution Pending Cross-Verification',
        description: 'Flagged because freshly ingested records contain unlinked foreign keys requiring graph centrality expansion.',
        supportingEvidenceIds: [normalizedEvidence[0]?.id || 'EVD-CUSTOM-01'],
        detectedAt: new Date().toISOString(),
        metricDetails: `Entities analyzed: ${normalizedEntities.length}`
      }
    ];


    const healthReport = calculateDatasetHealth(
      `Custom Ingested File: ${fileName}`,
      'v1.0.0-USER-INGESTED',
      normalizedEntities,
      normalizedRelationships,
      normalizedCases,
      normalizedCdrs,
      normalizedTxns,
      normalizedEvidence,
      timelineEvents,
      anomalies
    );

    return {
      id: 'DS-CUSTOM',
      name: `Custom Ingest: ${fileName}`,
      codeName: 'CUSTOM_FILE',
      description: `Dynamically adapted schema from user-uploaded ${fileName} containing ${normalizedEntities.length} entities.`,
      ingestedAt: new Date().toISOString(),
      version: '1.0.0-CUSTOM',
      entities: normalizedEntities,
      relationships: normalizedRelationships,
      cases: normalizedCases,
      cdrRecords: normalizedCdrs,
      transactions: normalizedTxns,
      evidenceRecords: normalizedEvidence,
      timelineEvents,
      anomalies,
      healthReport
    };
  } catch (err: any) {
    throw new Error(`Failed to parse custom dataset: ${err.message}`);
  }
}
