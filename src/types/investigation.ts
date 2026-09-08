export type EntityType = 
  | 'person' 
  | 'organization' 
  | 'phone' 
  | 'account' 
  | 'vehicle' 
  | 'location' 
  | 'case' 
  | 'evidence' 
  | 'event' 
  | 'transaction';

export type SubjectRole = 
  | 'case_subject'      // Officially listed prime suspect / accused
  | 'witness'           // Witness providing testimony/statement
  | 'observed_entity'   // Not accused: appears in CCTV, transaction, or CDR record
  | 'related_entity'    // Associate, kin, or business connection
  | 'inferred';         // Detected via network centrality or link analysis

export type CasePriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type CaseStatus = 'UNDER_INVESTIGATION' | 'EVIDENCE_COLLECTION' | 'FORENSIC_ANALYSIS' | 'PROSECUTION_READY' | 'CLOSED';

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  aliases?: string[];
  attributes: Record<string, string | number | boolean | null | undefined>;
  confidence: number; // 0.0 - 1.0
  sourceCount: number;
  linkedCaseIds: string[];
  flaggedRisk?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  tags?: string[];
}

export interface Relationship {
  id: string;
  source: string; // Entity ID
  target: string; // Entity ID
  relationType: string; // e.g., 'CALLED', 'TRANSFERRED_FUNDS', 'REGISTERED_OWNER', 'SIGHTED_AT', 'ASSOCIATE_OF'
  weight?: number;
  evidenceId?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
  verified: boolean;
}

export interface CaseRecord {
  id: string;
  caseNumber: string;
  title: string;
  incidentType: string;
  status: CaseStatus;
  priority: CasePriority;
  jurisdiction: string;
  openedDate: string;
  incidentDate: string;
  leadInvestigator: string;
  summary: string;
  location: string;
  
  // Categorized entity relationships
  subjects: Array<{ entityId: string; role: 'prime_suspect' | 'accused' | 'conspirator'; notes: string }>;
  witnesses: Array<{ entityId: string; statementDate: string; testimonySummary: string }>;
  observedEntities: Array<{ entityId: string; observationReason: string; sourceEvidenceId: string }>;
  
  evidenceIds: string[];
  eventIds: string[];
  findingsNotes: string[];
}

export interface CDRRecord {
  id: string;
  callerPhone: string;
  callerName?: string;
  receiverPhone: string;
  receiverName?: string;
  timestamp: string;
  durationSeconds: number;
  callType: 'VOICE' | 'SMS' | 'ENCRYPTED_VOIP' | 'DATA';
  cellTowerId: string;
  cellTowerLocation: string;
  imei?: string;
  linkedCaseId?: string;
  flaggedAnomaly?: boolean;
  anomalyReason?: string;
}

export interface FinancialTransaction {
  id: string;
  txnReference: string;
  sourceAccount: string;
  sourceOwnerName?: string;
  targetAccount: string;
  targetOwnerName?: string;
  amount: number;
  currency: string;
  timestamp: string;
  txnType: 'WIRE_TRANSFER' | 'CASH_DEPOSIT' | 'CRYPTO_OFFRAMP' | 'HAWALA_SETTLEMENT' | 'ATM_WITHDRAWAL';
  channel: string;
  linkedCaseId?: string;
  riskScore: number; // 0 - 100
  patternTag?: 'CIRCULAR' | 'LAYERING' | 'BURST' | 'HIGH_VALUE' | 'STRUCTURING' | 'INTERMEDIARY';
  evidenceId?: string;
}

export interface EvidenceRecord {
  id: string;
  evidenceNumber: string;
  caseId: string;
  title: string;
  evidenceType: 'DIGITAL_CCTV' | 'TELECOM_EXTRACTION' | 'FINANCIAL_LEDGER' | 'PHYSICAL_SEIZURE' | 'FORENSIC_IMAGE' | 'WITNESS_DEPOSITION';
  collectionTimestamp: string;
  collectedBy: string;
  chainOfCustodyLocation: string;
  sourceDeviceOrMedium: string;
  rawPayload: string;
  sha256Hash: string;
  tampered?: boolean;
  tamperedHash?: string;
  verified: boolean;
  custodyLogs: Array<{
    id: string;
    timestamp: string;
    actor: string;
    action: string;
    verificationHash: string;
    status: 'VERIFIED' | 'FLAGGED';
  }>;
}

export interface TimelineEvent {
  id: string;
  caseId?: string;
  timestamp: string;
  category: 'SIGHTING' | 'CALL' | 'TRANSACTION' | 'EVIDENCE_COLLECTED' | 'INCIDENT' | 'INTERROGATION' | 'WARRANT_EXECUTED';
  title: string;
  description: string;
  location?: string;
  involvedEntityIds: string[];
  evidenceId?: string;
  confidence: number;
  verifiedFact: boolean;
}

export interface AnomalySignal {
  id: string;
  category: 'TEMPORAL' | 'FINANCIAL' | 'COMMUNICATION' | 'GEOGRAPHIC' | 'RELATIONSHIP';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  entityId?: string;
  entityName?: string;
  description: string;
  supportingEvidenceIds: string[];
  detectedAt: string;
  metricDetails: string;
}

export interface DisambiguationResult {
  entityAId: string;
  entityBId: string;
  entityAName: string;
  entityBName: string;
  similarityScore: number; // 0 - 100
  verdict: 'SAME' | 'DIFFERENT' | 'UNCERTAIN';
  confidence: number; // 0 - 100
  supportingFactors: string[];
  contradictingFactors: string[];
  hardContradictions: string[];
  missingInformation: string[];
  recommendation: string;
}

export interface DatasetHealthReport {
  healthScore: number;
  totalRecords: number;
  recordsBySource: Record<string, number>;
  recordsByEntityType: Record<string, number>;
  missingValuesCount: number;
  duplicateRecordsCount: number;
  invalidReferencesCount: number;
  orphanRecordsCount: number;
  invalidTimestampsCount: number;
  schemaInconsistenciesCount: number;
  suspiciousAnomaliesCount: number;
  detectedColumns: Record<string, string[]>;
  normalizedFieldsMap: Record<string, string>;
  datasetTitle: string;
  datasetVersion: string;
  lastIngestedAt: string;
}

export interface GraphNode {
  id: string;
  name: string;
  type: EntityType;
  caseIds: string[];
  risk?: string;
  degree?: number;
  betweenness?: number;
  community?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GraphLink {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  relationType: string;
  evidenceId?: string;
  weight?: number;
}

export interface InvestigationStoryItem {
  story_item_id: string;
  story_id: string;
  case_id: string;
  sequence: number;
  timestamp: string;
  observation: string;
  source_type: 'CDR' | 'TRANSACTION' | 'EVENT' | 'EVIDENCE' | 'OSINT' | 'RELATIONSHIP' | 'LOCATION';
  source_record_id: string;
  entity_ids: string[];
  relationship_ids?: string[];
  evidence_ids?: string[];
  supporting_evidence: string;
  hypothesis: string;
  confidence: number;
  confidence_type: 'HIGH' | 'MEDIUM' | 'VERY_HIGH' | 'CRITICAL';
  contradicting_evidence: string;
  next_investigative_action: string;
  fact_or_inference: 'FACT / OBSERVATION' | 'INFERENCE / HYPOTHESIS' | string;
}

export interface InvestigationStory {
  story_id: string;
  case_id: string;
  generated_at: string;
  generated_by: string;
  title: string;
  summary: string;
  status: string;
  items: InvestigationStoryItem[];
  source_record_ids: string[];
  version: number;
}

export interface SourceRecordRef {
  record_type: 'cdr' | 'transaction' | 'evidence' | 'event' | 'relationship' | 'person' | 'account' | 'phone' | 'vehicle' | 'device' | 'organization' | 'location';
  record_id: string;
  case_id: string;
  summary?: string;
}

export interface FactItem {
  fact: string;
  supporting_records?: SourceRecordRef[];
}

export interface InferenceItem {
  inference: string;
  confidence: number;
  rationale: string;
  supporting_records?: SourceRecordRef[];
  contradicting_records?: SourceRecordRef[];
  contradiction_note?: string;
}

export interface ActionItem {
  action: string;
  supporting_records?: SourceRecordRef[];
}

export interface ContradictionItem {
  contradiction: string;
  supporting_records?: SourceRecordRef[];
}

export interface AIAnalysisResponse {
  markdownOutput: string;
  facts: Array<string | FactItem>;
  inferences: InferenceItem[];
  recommendedActions: Array<string | ActionItem>;
  contradictions?: ContradictionItem[];
  contradictionSummary?: string;
  isAiGenerated: boolean;
  modelUsed: string;
  case_id?: string;
}
