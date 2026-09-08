import React, { useState, useMemo } from 'react';
import { 
  Lock, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Key, 
  Download, 
  RefreshCw, 
  Cpu, 
  GitCommit,
  Sparkles,
  Layers,
  UploadCloud,
  Search,
  Filter,
  Copy,
  Plus,
  Video,
  FileSpreadsheet,
  FileCode,
  Music,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Shield,
  X,
  Loader2
} from 'lucide-react';
import { InvestigationDataset } from '../services/datasetNormalizer';
import { EvidenceRecord } from '../types/investigation';
import { 
  fetchEvidenceList, 
  createEvidenceApi, 
  fetchBSACertificate, 
  generateBSACertificate, 
  getBSACertificateDownloadUrl 
} from '../services/apiService';

interface EvidenceVaultViewProps {
  dataset: InvestigationDataset;
  tamperSimulated: boolean;
  onToggleTamper: () => void;
  onRefreshEvidence?: () => void;
  selectedCaseId?: string | null;
  onSelectCaseId?: (caseId: string | null) => void;
}

export const EvidenceVaultView: React.FC<EvidenceVaultViewProps> = ({
  dataset,
  tamperSimulated,
  onToggleTamper,
  onRefreshEvidence,
  selectedCaseId,
  onSelectCaseId
}) => {
  const activeCaseId = selectedCaseId || dataset.cases[0]?.id || 'CASE-000001';
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // New Evidence Modal Form State
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState('SURVEILLANCE');
  const [newCaseId, setNewCaseId] = useState('');
  const [newSource, setNewSource] = useState('Law Enforcement Intercept');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [localEvidence, setLocalEvidence] = useState<EvidenceRecord[]>([]);

  // Section 63 BSA Certificate Modal State
  const [showBsaModal, setShowBsaModal] = useState<boolean>(false);
  const [bsaCertData, setBsaCertData] = useState<any>(null);
  const [bsaCertLoading, setBsaCertLoading] = useState<boolean>(false);
  const [bsaCertError, setBsaCertError] = useState<string | null>(null);

  const handleExportSec63BSA = async (evId?: string) => {
    const targetId = evId || selectedEvidenceId || selectedEvidence?.id;
    if (!targetId) return;

    setShowBsaModal(true);
    setBsaCertLoading(true);
    setBsaCertError(null);

    if (tamperSimulated) {
      setBsaCertError('Evidence verification required. Record is flagged as tampered and cannot be certified.');
      setBsaCertLoading(false);
      return;
    }

    try {
      const data = await generateBSACertificate(targetId);
      setBsaCertData(data);
    } catch (err: any) {
      setBsaCertError(err.message || 'Evidence verification required before certificate export.');
    } finally {
      setBsaCertLoading(false);
    }
  };

  // Fetch case-specific evidence when activeCaseId or typeFilter changes
  React.useEffect(() => {
    if (!activeCaseId) return;
    const controller = new AbortController();
    setLocalEvidence([]);
    setLoading(true);

    fetchEvidenceList(200, activeCaseId, typeFilter, controller.signal)
      .then(res => {
        if (!controller.signal.aborted) {
          if (Array.isArray(res)) {
            setLocalEvidence(res);
            if (res.length > 0) setSelectedEvidenceId(res[0].id || res[0].evidence_id);
            else setSelectedEvidenceId('');
          } else {
            setLocalEvidence([]);
            setSelectedEvidenceId('');
          }
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLocalEvidence([]);
          setSelectedEvidenceId('');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [activeCaseId, typeFilter]);

  const selectedEvidence = localEvidence.find(e => e.id === selectedEvidenceId) || localEvidence[0];

  const filteredEvidence = useMemo(() => {
    return localEvidence.filter(e => {
      if (typeFilter !== 'ALL' && e.evidenceType !== typeFilter) return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        e.title.toLowerCase().includes(term) ||
        e.id.toLowerCase().includes(term) ||
        (e.caseId && e.caseId.toLowerCase().includes(term)) ||
        (e.sha256Hash && e.sha256Hash.toLowerCase().includes(term))
      );
    });
  }, [localEvidence, searchTerm, typeFilter]);

  const handleCopy = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleCreateEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesc.trim()) {
      setSubmitError('Evidence description is required.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const created = await createEvidenceApi({
        description: newDesc.trim(),
        evidence_type: newType,
        case_id: newCaseId.trim() || undefined,
        source: newSource.trim() || undefined
      });

      const formattedRecord: EvidenceRecord = {
        id: created.id || created.evidence_id,
        evidenceNumber: created.evidence_id || created.id,
        title: created.title || created.description,
        evidenceType: (created.evidenceType || created.evidence_type || 'SURVEILLANCE') as any,
        caseId: created.caseId || created.case_id || 'CASE-000001',
        sha256Hash: created.sha256Hash || created.integrity_sha256,
        sourceDeviceOrMedium: created.source || 'Law Enforcement Intercept',
        collectionTimestamp: created.collectedAt || created.collected_at || new Date().toISOString(),
        collectedBy: 'Lead Investigator',
        chainOfCustodyLocation: 'Precinct-7 Secure Bay',
        rawPayload: created.description,
        verified: true,
        tampered: false,
        custodyLogs: [
          {
            id: `LOG-${Date.now()}`,
            timestamp: new Date().toISOString(),
            action: 'EVIDENCE_INGESTED',
            actor: 'Lead Investigator',
            verificationHash: created.sha256Hash || created.integrity_sha256,
            status: 'VERIFIED'
          }
        ]
      };

      setLocalEvidence(prev => [formattedRecord, ...prev]);
      setSelectedEvidenceId(formattedRecord.id);
      setShowUploadModal(false);
      setNewDesc('');
      setNewCaseId('');
      if (onRefreshEvidence) onRefreshEvidence();
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit evidence to backend');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCert = () => {
    const cert = {
      platform: 'RAKSHAK C3PL Cryptographic Provenance Engine v4.2',
      precinct: 'National Crime Intelligence Division',
      issuedAt: new Date().toISOString(),
      merkleRoot: tamperSimulated ? '0xCORRUPTED_ROOT_MISMATCH' : '0x7f4a9b29e18c8942b08faec13e9a018d',
      integrityStatus: tamperSimulated ? 'FAILED_INTEGRITY_CHECK' : 'VERIFIED_IMMUTABLE',
      algorithm: 'SHA-256 Merkle Tree Chaining (Section 65B BSA Compliant)',
      evidenceItemsCount: localEvidence.length,
      records: localEvidence.map(e => ({
        id: e.id,
        title: e.title,
        type: e.evidenceType,
        sha256: e.sha256Hash,
        custodyLogCount: (e.chainOfCustody || []).length
      }))
    };

    const blob = new Blob([JSON.stringify(cert, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RAKSHAK_C3PL_Audit_Certificate_${dataset.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getEvidenceIcon = (type: string) => {
    switch (type) {
      case 'DIGITAL_CCTV':
      case 'VIDEO':
        return <Video className="w-4 h-4 text-blue-600" />;
      case 'TELECOM_EXTRACTION':
      case 'AUDIO':
        return <Music className="w-4 h-4 text-purple-600" />;
      case 'FINANCIAL_LEDGER':
        return <FileSpreadsheet className="w-4 h-4 text-emerald-600" />;
      case 'PHYSICAL_SEIZURE':
      case 'DOCUMENT':
      default:
        return <FileText className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight font-heading">
              Evidence Vault
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 rounded-full font-mono">
              {activeCaseId} ({filteredEvidence.length} Exhibits)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Cryptographic chain of custody and SHA-256 evidence integrity logs.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Active Case Selector */}
          <div className="flex items-center gap-2 bg-white border border-slate-300 px-3 py-1.5 rounded-lg shadow-xs">
            <span className="text-xs font-semibold text-slate-500 font-mono">CASE:</span>
            <select
              value={activeCaseId}
              onChange={(e) => onSelectCaseId?.(e.target.value)}
              className="text-xs font-bold text-slate-900 bg-transparent outline-none cursor-pointer font-mono"
            >
              {(dataset.cases || []).map(c => (
                <option key={c.id} value={c.id}>
                  {c.id} • {c.title || c.crimeType || 'Case'}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => handleExportSec63BSA()}
            className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs"
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span>Export Sec 63 BSA Certificate (PDF)</span>
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-2 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Evidence</span>
          </button>
        </div>
      </div>

      {/* Merkle Tamper Alert Banner */}
      <div className={`p-4 rounded-xl border transition-all ${
        tamperSimulated 
          ? 'bg-red-50 border-red-300 text-red-900' 
          : 'bg-white border-slate-200 text-slate-800 card-shadow'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              tamperSimulated ? 'bg-red-100 border-red-300 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}>
              {tamperSimulated ? <ShieldAlert className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-xs uppercase font-semibold text-slate-500 font-sans">Root Audit Status:</span>
                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                  tamperSimulated ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}>
                  {tamperSimulated ? 'ALERT: MERKLE ROOT MISMATCH' : 'PASS: MERKLE TREE SYNCHRONIZED'}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 font-sans">
                {tamperSimulated
                  ? 'CRITICAL INTEGRITY FAILURE: Exhibit payload hash diverged from anchored ledger signature.'
                  : 'Every seized item is anchored to a SHA-256 Merkle tree root for judicial Section 65B compliance.'}
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={onToggleTamper}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 shadow-xs ${
                tamperSimulated
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{tamperSimulated ? 'Restore Valid Audit State' : 'Simulate Tamper Attack'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Secure Drop & Storage Breakdown */}
        <div className="space-y-4">
          {/* Secure Drop Box */}
          <div className="p-5 bg-white border border-slate-200 rounded-xl card-shadow space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-700" />
                <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                  Secure Ingestion Drop
                </h3>
              </div>
              <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                AES-256
              </span>
            </div>

            {/* Dotted Drop Zone */}
            <div 
              onClick={() => setShowUploadModal(true)}
              className="p-6 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl text-center bg-slate-50/50 hover:bg-blue-50/30 transition-all cursor-pointer space-y-2"
            >
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-xs text-slate-800 font-sans">Add & Ingest Evidence</div>
                <div className="text-xs text-slate-500 mt-0.5">FIRs, CCTV, Call Logs, Financial Ledgers</div>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowUploadModal(true); }}
                className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium shadow-xs mt-1"
              >
                + Add Evidence
              </button>
            </div>
          </div>

          {/* Storage Breakdown */}
          <div className="p-5 bg-white border border-slate-200 rounded-xl card-shadow space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                Vault Capacity
              </h3>
              <span className="text-xs font-mono font-bold text-blue-700">
                78% Full
              </span>
            </div>

            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex border border-slate-200">
              <div className="bg-blue-600 h-full w-[48%]" />
              <div className="bg-cyan-500 h-full w-[20%]" />
              <div className="bg-purple-600 h-full w-[10%]" />
            </div>

            <div className="space-y-2 text-xs pt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                  <span className="text-slate-700">Video Evidence</span>
                </div>
                <span className="font-mono font-semibold text-slate-900">1.2 TB</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block" />
                  <span className="text-slate-700">CDR Extracts</span>
                </div>
                <span className="font-mono font-semibold text-slate-900">450 GB</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block" />
                  <span className="text-slate-700">Documents / FIRs</span>
                </div>
                <span className="font-mono font-semibold text-slate-900">85 GB</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (2 Cols): Evidence List & Detail */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden card-shadow">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search file name, ID, or hash..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:outline-none"
                >
                  <option value="ALL">All File Types</option>
                  <option value="DIGITAL_CCTV">Video / CCTV</option>
                  <option value="TELECOM_EXTRACTION">Telecom Logs</option>
                  <option value="FINANCIAL_LEDGER">Financial Records</option>
                  <option value="PHYSICAL_SEIZURE">Physical Documents</option>
                  <option value="SURVEILLANCE">Surveillance Logs</option>
                </select>
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
              {filteredEvidence.map((ev) => {
                const isSelected = ev.id === selectedEvidence?.id;
                return (
                  <div
                    key={ev.id}
                    onClick={() => setSelectedEvidenceId(ev.id)}
                    className={`p-4 cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      isSelected ? 'bg-blue-50/60 border-l-4 border-l-blue-600' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-slate-100 rounded-lg border border-slate-200 shrink-0">
                        {getEvidenceIcon(ev.evidenceType)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 truncate">{ev.title}</div>
                        <div className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                          ID: {ev.id} • SHA256: {ev.sha256Hash?.slice(0, 16)}...
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2.5 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                        SEALED
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Evidence Custody Log Drawer */}
          {selectedEvidence && (
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div>
                  <h4 className="font-bold text-xs text-slate-900 font-mono">
                    CHAIN OF CUSTODY LOG: {selectedEvidence.title}
                  </h4>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Vault Bay: {selectedEvidence.chainOfCustodyLocation || 'Precinct-7 Secure Bay'} • Lead: {selectedEvidence.collectedBy || 'Lead Investigator'}
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 rounded">
                  LEAF VALIDATED
                </span>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {(selectedEvidence.chainOfCustody || []).map((c, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-0.5">
                    <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
                      <span className="font-bold text-slate-800">{c.custodianName} ({c.action})</span>
                      <span>{c.timestamp.replace('T', ' ').slice(0, 16)} UTC</span>
                    </div>
                    <p className="text-slate-600 text-[11px]">{c.notes}</p>
                  </div>
                ))}
              </div>

              {/* BSA Certificate Action Bar */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="text-[11px] text-slate-500 font-mono">
                  SHA-256 Digest: <span className="font-bold text-slate-800">{selectedEvidence.sha256Hash?.slice(0, 16)}...</span>
                </div>
                <button
                  onClick={() => handleExportSec63BSA(selectedEvidence.id)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Sec 63 BSA Certificate (PDF)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 63 BSA Certificate Modal */}
      {showBsaModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white border border-slate-300 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden font-sans">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm tracking-tight font-mono">
                  Section 63 BSA Digital Evidence Certificate
                </h3>
              </div>
              <button 
                onClick={() => setShowBsaModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {bsaCertLoading && (
                <div className="text-center py-8 space-y-3">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                  <p className="text-xs font-semibold text-slate-700 font-mono">
                    Generating Official Section 63 BSA Certificate PDF via ReportLab...
                  </p>
                </div>
              )}

              {bsaCertError && (
                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-800 font-mono">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>EVIDENCE VERIFICATION REQUIRED</span>
                  </div>
                  <p className="text-amber-900 leading-relaxed font-medium">
                    {bsaCertError}
                  </p>
                  <p className="text-[11px] text-amber-800 italic">
                    Unverified or tampered evidence records cannot be certified under Section 63 BSA. Please verify SHA-256 integrity first.
                  </p>
                </div>
              )}

              {bsaCertData && !bsaCertLoading && (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-xs font-bold text-emerald-900 font-mono">CERTIFICATE GENERATED & PERSISTED IN MONGODB</span>
                    </div>
                    <span className="px-2.5 py-0.5 text-[10px] font-bold font-mono bg-emerald-600 text-white rounded">
                      {bsaCertData.verification_status || 'VERIFIED'}
                    </span>
                  </div>

                  {/* Cert Details Grid */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs font-mono">
                    <div className="grid grid-cols-2 gap-3 border-b border-slate-200 pb-2">
                      <div>
                        <span className="text-slate-400 block text-[10px]">CERTIFICATE ID</span>
                        <span className="font-bold text-slate-900">{bsaCertData.certificate_id}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">GENERATED AT</span>
                        <span className="font-semibold text-slate-800">{new Date(bsaCertData.generated_at).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 border-b border-slate-200 pb-2">
                      <div>
                        <span className="text-slate-400 block text-[10px]">CUSTODIAL OFFICER</span>
                        <span className="font-semibold text-slate-800">{bsaCertData.officer_name} ({bsaCertData.officer_role})</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">EVIDENCE TYPE</span>
                        <span className="font-semibold text-slate-800">{bsaCertData.evidence_type}</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">EVIDENCE SHA-256 DIGEST</span>
                      <span className="font-bold text-blue-700 block truncate">{bsaCertData.evidence_sha256}</span>
                    </div>
                  </div>

                  {/* Download Action */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      onClick={() => setShowBsaModal(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                    >
                      Close
                    </button>
                    <a
                      href={getBSACertificateDownloadUrl(bsaCertData.evidence_id || selectedEvidence?.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Certificate (PDF)</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Evidence Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white border border-slate-300 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm tracking-tight font-mono">Ingest New Evidence Item</h3>
              </div>
              <button 
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvidence} className="p-5 space-y-4 text-slate-800">
              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg">
                  {submitError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Evidence Description / Title *
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="e.g. Seized Hard Drive - CCTV Pier 9 Intercept"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Type
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none"
                  >
                    <option value="SURVEILLANCE">Surveillance</option>
                    <option value="DIGITAL_CCTV">Digital CCTV</option>
                    <option value="TELECOM_EXTRACTION">Telecom Extraction</option>
                    <option value="FINANCIAL_LEDGER">Financial Ledger</option>
                    <option value="PHYSICAL_SEIZURE">Physical Seizure</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Linked Case ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={newCaseId}
                    onChange={(e) => setNewCaseId(e.target.value)}
                    placeholder="CASE-000001"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Source / Intercept Authority
                </label>
                <input
                  type="text"
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value)}
                  placeholder="Law Enforcement Intercept / Cyber Cell"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-900 font-mono">
                ✓ SHA-256 hash will be generated & anchored into MongoDB evidence collection.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Ingesting...</span>
                    </>
                  ) : (
                    <span>Save & Anchor Evidence</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
