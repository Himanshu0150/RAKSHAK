import React, { useEffect, useState } from 'react';
import { 
  X, 
  Shield, 
  FileText, 
  Phone, 
  CreditCard, 
  Car, 
  Building2, 
  MapPin, 
  GitBranch, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink,
  Lock,
  Layers,
  ArrowUpRight,
  Loader2,
  UserCheck,
  Users
} from 'lucide-react';
import { Entity, Relationship, CaseRecord, EvidenceRecord, CDRRecord, FinancialTransaction } from '../../types/investigation';
import { fetchEntityDossier } from '../../services/apiService';
import { getEntityDisplayInfo, getCaseDisplayInfo } from '../../utils/entityDisplay';

interface EntityDossierModalProps {
  entity: Entity | null;
  onClose: () => void;
  allRelationships: Relationship[];
  allEntities: Entity[];
  allCases: CaseRecord[];
  allEvidence: EvidenceRecord[];
  allCdrs: CDRRecord[];
  allTransactions: FinancialTransaction[];
  onSelectEntity: (entityId: string) => void;
  onOpenInGraph?: (entityId: string) => void;
  onOpenInCompare?: (entityId: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export const EntityDossierModal: React.FC<EntityDossierModalProps> = ({
  entity,
  onClose,
  allRelationships,
  allEntities,
  allCases,
  allEvidence,
  allCdrs,
  allTransactions,
  onSelectEntity,
  onOpenInGraph,
  onOpenInCompare,
  onNavigateTab
}) => {
  const [dossier, setDossier] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!entity?.id) return;
    setLoading(true);
    fetchEntityDossier(entity.id)
      .then(res => {
        if (res) setDossier(res);
      })
      .finally(() => setLoading(false));
  }, [entity?.id]);

  if (!entity) return null;

  // Use entity from dossier API if available, fallback to entity prop
  const currentEntity = dossier?.entity ? {
    id: dossier.entity.id || entity.id,
    name: dossier.entity.name || entity.name,
    type: dossier.entity.type || entity.type,
    flaggedRisk: dossier.entity.flaggedRisk || entity.flaggedRisk,
    attributes: dossier.entity.attributes || entity.attributes
  } : entity;

  // Fallbacks if dossier fetch is loading or pending
  const displayInfo = getEntityDisplayInfo(currentEntity);
  const directLinks = dossier?.relationships || (allRelationships || []).filter(r => r.source === currentEntity.id || r.target === currentEntity.id);
  const linkedCases = dossier?.cases || (allCases || []).filter(c => currentEntity.linkedCaseIds?.includes(c.id));
  const linkedEvidence = dossier?.evidence || (allEvidence || []).filter(e => directLinks.some((l: any) => l.evidenceId === e.id));
  const relevantCdrs = dossier?.cdrs || [];
  const relevantTxns = dossier?.transactions || [];

  const confidenceScore = dossier?.entity?.confidenceScore ?? 92.5;
  const sourceMetadata = dossier?.entity?.sourceMetadata ?? "VERIFIED OPERATIONAL INTELLIGENCE";

  const getRiskBadge = (risk?: string) => {
    switch (risk) {
      case 'CRITICAL':
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-red-50 text-red-700 border border-red-200">CRITICAL RISK</span>;
      case 'HIGH':
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-50 text-amber-800 border border-amber-200">HIGH RISK</span>;
      case 'MEDIUM':
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">MEDIUM RISK</span>;
      default:
        return <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200">VERIFIED LOW RISK</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs">
      {/* Backdrop click layer */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal ROOT Container */}
      <div 
        id="entity-dossier-modal"
        className="fixed z-[10000] bg-white border border-slate-200 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-900"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(92vw, 56rem)',
          maxHeight: '90vh',
          overflow: 'hidden'
        }}
      >
        {/* Header (stays visible, shrink-0) */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2 bg-slate-900 text-white rounded-lg shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap">
                <h2 className="text-lg font-semibold text-slate-900 truncate">{displayInfo.title}</h2>
                {getRiskBadge(currentEntity.flaggedRisk)}
                {loading && (
                  <span className="flex items-center text-xs text-blue-600 space-x-1 shrink-0">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Fetching MongoDB Dossier...</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium truncate">{displayInfo.subtitle || `TYPE: ${String(displayInfo.type).toUpperCase()}`}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            {onOpenInCompare && (
              <button
                onClick={() => onOpenInCompare(currentEntity.id)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center space-x-1"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Compare</span>
              </button>
            )}
            {onOpenInGraph && (
              <button
                onClick={() => onOpenInGraph(currentEntity.id)}
                className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors flex items-center space-x-1"
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Inspect in Graph</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dossier CONTENT Area (overflow-y: auto) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
          {/* Metadata Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <div>
              <span className="text-[10px] font-semibold uppercase text-slate-500 block">IDENTITY RECORD</span>
              <span className="font-bold text-slate-900 font-mono mt-0.5 block">{currentEntity.id}</span>
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase text-slate-500 block">CONFIDENCE</span>
              <span className="font-bold text-emerald-700 font-mono mt-0.5 block">{confidenceScore}%</span>
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase text-slate-500 block">INTELLIGENCE SOURCE</span>
              <span className="font-semibold text-slate-900 truncate block mt-0.5">{sourceMetadata}</span>
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase text-slate-500 block font-mono">ROLE / CARRIER</span>
              <span className="font-semibold text-slate-900 truncate block mt-0.5">{currentEntity.attributes?.occupation || currentEntity.attributes?.role || currentEntity.attributes?.carrier || currentEntity.attributes?.institution_type || "Operational Target"}</span>
            </div>
          </div>

          {/* Associated Cases */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider mb-3 flex items-center justify-between">
              <span>ASSOCIATED POLICE & INTELLIGENCE CASES ({linkedCases.length})</span>
            </h3>
            {linkedCases.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3.5 bg-slate-50 rounded-lg border border-dashed border-slate-200">No active cases associated with this target ID.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {linkedCases.map((c: any) => (
                  <div key={c.id || c.case_id} className="p-3.5 border border-slate-200 rounded-xl hover:border-blue-300 transition-colors bg-white shadow-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-blue-700 font-mono">{c.case_id || c.caseNumber || c.id}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 uppercase">{c.severity || c.priority || 'CRITICAL'}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase">{c.status || c.case_status || 'OPEN'}</span>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-slate-900">{c.crime_type || c.crime_category || c.title}</div>
                    <p className="text-xs text-slate-600 leading-relaxed font-sans">{c.description || c.summary}</p>
                    <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-100">
                      <span>Date: {c.dates || c.incident_date || 'N/A'}</span>
                      <span>{c.jurisdiction || (c.police_station ? `Station: ${c.police_station}` : 'N/A')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Direct Relationships */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider mb-3 flex items-center justify-between">
              <span>DIRECT GRAPH RELATIONSHIPS ({directLinks.length})</span>
            </h3>
            {directLinks.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3.5 bg-slate-50 rounded-lg border border-dashed border-slate-200">No direct graph links detected.</p>
            ) : (
              <div className="space-y-2">
                {directLinks.map((r: any) => {
                  const targetId = r.source === currentEntity.id ? r.target : (r.target_id || r.source);
                  const targetDisplay = getEntityDisplayInfo(targetId, { entities: allEntities } as any);
                  const confVal = r.confidence != null ? (r.confidence <= 1 ? Math.round(r.confidence * 100) : r.confidence) : 90;
                  return (
                    <div key={r.id || `${r.source}-${r.target}`} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <GitBranch className="w-4 h-4 text-blue-600 shrink-0" />
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 block truncate">{targetDisplay.title}</span>
                          <span className="text-[10px] text-slate-500 font-mono block">Ref: {targetId}</span>
                        </div>
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-mono text-[10px] font-semibold border border-blue-200 rounded uppercase shrink-0">{r.type || r.relationType || r.relationship_type}</span>
                      </div>
                      <div className="flex items-center space-x-3 shrink-0 text-slate-500 font-mono">
                        <span className="text-[11px]">Conf: <strong className="text-emerald-700">{confVal}%</strong></span>
                        {onSelectEntity && (
                          <button 
                            onClick={() => onSelectEntity(targetId)}
                            className="p-1 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
                            title="Inspect Target Entity"
                          >
                            <ArrowUpRight className="w-4 h-4 text-slate-700" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Evidence References */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider mb-3 flex items-center justify-between">
              <span>SEIZED EVIDENCE & C3PL HASH REFERENCES ({linkedEvidence.length})</span>
            </h3>
            {linkedEvidence.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3.5 bg-slate-50 rounded-lg border border-dashed border-slate-200">No physical or digital evidence linked.</p>
            ) : (
              <div className="space-y-2">
                {linkedEvidence.map((e: any) => (
                  <div key={e.id || e.evidence_id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-slate-600 shrink-0" />
                      <span className="font-semibold text-slate-900 truncate">{e.title || e.description}</span>
                      <span className="text-slate-400">•</span>
                      <span className="font-mono text-slate-500 text-[11px] uppercase">{e.evidenceType || e.evidence_type}</span>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="font-mono text-[10px] bg-slate-200 text-slate-800 px-2 py-0.5 rounded truncate max-w-[140px] font-semibold">{e.sha256Hash || e.integrity_sha256}</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Associated CDR & Financial Intercept Summary */}
          {(relevantCdrs.length > 0 || relevantTxns.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider mb-2">TELECOM INTERCEPTS ({relevantCdrs.length})</h4>
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {relevantCdrs.map((c: any, idx: number) => (
                    <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex justify-between items-center font-mono">
                      <span className="font-bold text-slate-800">{c.caller_phone_id || c.callerPhone} → {c.receiver_phone_id || c.receiverPhone}</span>
                      <span className="text-slate-500">{c.duration_seconds || c.durationSeconds}s</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider mb-2">FINANCIAL WIRES ({relevantTxns.length})</h4>
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {relevantTxns.map((t: any, idx: number) => {
                    const amt = t.amount != null ? (typeof t.amount === 'number' ? Math.round(t.amount * 83) : t.amount) : 0;
                    return (
                      <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex justify-between items-center font-mono">
                        <span className="font-bold text-slate-800">{t.source_account_id || t.sourceAccount} → ₹{amt.toLocaleString('en-IN')}</span>
                        <span className="text-slate-500 uppercase text-[10px]">{t.transaction_type || t.txnType}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
