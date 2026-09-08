import React, { useState, useMemo } from 'react';
import { 
  Briefcase, 
  Users, 
  GitBranch, 
  Lock, 
  Activity, 
  ShieldAlert, 
  CheckCircle2, 
  Search, 
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  FileText,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { InvestigationDataset } from '../services/datasetNormalizer';
import { NavigationTab } from '../components/layout/AppShell';
import { useAuth, isCaseAuthorized } from '../context/AuthContext';

interface DashboardViewProps {
  dataset: InvestigationDataset;
  selectedCaseId: string | null;
  onSelectCaseId: (caseId: string | null) => void;
  onNavigateTab: (tab: NavigationTab) => void;
  onSelectEntity: (entityId: string) => void;
  tamperSimulated: boolean;
  summaryData?: any;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  dataset,
  selectedCaseId,
  onSelectCaseId,
  onNavigateTab,
  onSelectEntity,
  tamperSimulated,
  summaryData
}) => {
  const { user } = useAuth();
  const [attentionPage, setAttentionPage] = useState(1);
  const pageSize = 4;

  const currentCase = selectedCaseId ? dataset.cases.find(c => c.id === selectedCaseId) : null;

  const activeCasesCount = summaryData?.activeCasesCount ?? dataset.cases.filter(c => (c.status || '').toUpperCase() !== 'CLOSED').length;
  const criticalCasesCount = summaryData?.criticalCasesCount ?? dataset.cases.filter(c => (c.priority || '').toUpperCase() === 'CRITICAL').length;
  const indexedEntitiesCount = summaryData?.indexedEntitiesCount ?? dataset.entities.length;
  const relationshipsCount = summaryData?.relationshipsCount ?? dataset.relationships.length;
  const evidenceRecordsCount = summaryData?.evidenceRecordsCount ?? dataset.evidenceRecords.length;
  const anomaliesCount = summaryData?.anomaliesCount ?? dataset.anomalies.length;
  const criticalAnomaliesCount = dataset.anomalies.filter(a => a.severity === 'CRITICAL' || a.severity === 'HIGH').length;

  // Cases list for dashboard view sorted by priority
  const casesNeedingAttention = useMemo(() => {
    const list = (dataset.cases || []).filter(c => isCaseAuthorized(user, c.id));
    // Sort CRITICAL first, then HIGH
    return list.sort((a, b) => {
      const pA = (a.priority || '').toUpperCase();
      const pB = (b.priority || '').toUpperCase();
      if (pA === 'CRITICAL' && pB !== 'CRITICAL') return -1;
      if (pB === 'CRITICAL' && pA !== 'CRITICAL') return 1;
      if (pA === 'HIGH' && pB !== 'HIGH') return -1;
      if (pB === 'HIGH' && pA !== 'HIGH') return 1;
      return 0;
    });
  }, [dataset.cases, user]);

  const totalPages = Math.max(1, Math.ceil(casesNeedingAttention.length / pageSize));
  const paginatedAttentionCases = casesNeedingAttention.slice((attentionPage - 1) * pageSize, attentionPage * pageSize);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Question 1: What investigation am I working on & What is the current situation? */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 card-shadow space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100 uppercase tracking-wider">
                Current Active Scope
              </span>
              <span className="text-xs text-slate-400 font-mono">Dataset: {dataset.name}</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1 font-heading">
              {currentCase ? `${currentCase.caseNumber} — ${currentCase.title}` : 'All Active Investigations'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              {currentCase ? currentCase.summary : 'Multi-source intelligence platform tracking high-priority network subjects, financial conduits, and evidence logs.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => onNavigateTab('knowledge_graph')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-2 shadow-xs transition-colors"
            >
              <GitBranch className="w-4 h-4" />
              <span>Explore Graph</span>
            </button>
            <button
              onClick={() => onNavigateTab('investigate')}
              className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors"
            >
              <Search className="w-4 h-4 text-slate-500" />
              <span>Search Target</span>
            </button>
          </div>
        </div>

        {/* Question 2: Situation Telemetry Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
          <div 
            onClick={() => onNavigateTab('cases')}
            className="p-3.5 bg-slate-50/70 hover:bg-slate-100/80 rounded-xl cursor-pointer transition-colors"
          >
            <span className="text-xs text-slate-500 font-medium">Active Cases</span>
            <div className="text-2xl font-bold text-slate-900 font-mono mt-1">{activeCasesCount}</div>
            <span className="text-[11px] text-blue-700 font-medium mt-0.5 block">
              {criticalCasesCount} Critical Focus
            </span>
          </div>

          <div 
            onClick={() => onNavigateTab('entities')}
            className="p-3.5 bg-slate-50/70 hover:bg-slate-100/80 rounded-xl cursor-pointer transition-colors"
          >
            <span className="text-xs text-slate-500 font-medium">Indexed Targets</span>
            <div className="text-2xl font-bold text-slate-900 font-mono mt-1">{indexedEntitiesCount}</div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {relationshipsCount} Graph Connections
            </span>
          </div>

          <div 
            onClick={() => onNavigateTab('evidence_vault')}
            className="p-3.5 bg-slate-50/70 hover:bg-slate-100/80 rounded-xl cursor-pointer transition-colors"
          >
            <span className="text-xs text-slate-500 font-medium">Evidence Integrity</span>
            <div className={`text-2xl font-bold font-mono mt-1 ${tamperSimulated ? 'text-red-600' : 'text-emerald-700'}`}>
              {tamperSimulated ? 'ALERT' : `${evidenceRecordsCount}/${evidenceRecordsCount}`}
            </div>
            <span className={`text-[11px] font-medium mt-0.5 flex items-center gap-1 ${tamperSimulated ? 'text-red-700' : 'text-emerald-700'}`}>
              {tamperSimulated ? <ShieldAlert className="w-3 h-3 text-red-600" /> : <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
              <span>{tamperSimulated ? 'Merkle Root Divergence' : 'C3PL Verified'}</span>
            </span>
          </div>

          <div 
            onClick={() => onNavigateTab('anomaly_radar')}
            className="p-3.5 bg-slate-50/70 hover:bg-slate-100/80 rounded-xl cursor-pointer transition-colors"
          >
            <span className="text-xs text-slate-500 font-medium">Active Signals</span>
            <div className="text-2xl font-bold text-amber-600 font-mono mt-1">{anomaliesCount}</div>
            <span className="text-[11px] text-amber-700 font-medium mt-0.5 block">
              {criticalAnomaliesCount} High Risk Anomaly Bursts
            </span>
          </div>
        </div>
      </div>

      {/* Grid: Cases needing attention & Next investigation leads */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Question 3: Which cases need attention? (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 font-heading">
                Cases Needing Attention
              </h2>
              <span className="px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-800 rounded-full font-mono">
                {casesNeedingAttention.length}
              </span>
            </div>
            <button
              onClick={() => onNavigateTab('cases')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 transition-colors"
            >
              <span>View All ({casesNeedingAttention.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {paginatedAttentionCases.map(c => (
              <div 
                key={c.id} 
                className={`p-4 rounded-xl border transition-all ${
                  selectedCaseId === c.id 
                    ? 'bg-blue-50/60 border-blue-200 ring-1 ring-blue-300' 
                    : 'bg-white border-slate-200 hover:border-slate-300 card-shadow'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wide ${
                      (c.priority || '').toUpperCase() === 'CRITICAL' 
                        ? 'bg-red-100 text-red-700 border border-red-200' 
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {c.priority}
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-500">{c.caseNumber}</span>
                    <h3 className="text-sm font-bold text-slate-900">{c.title}</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-mono">Lead: {c.leadInvestigator || 'Unassigned'}</span>
                    <button
                      onClick={() => onSelectCaseId(selectedCaseId === c.id ? null : c.id)}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        selectedCaseId === c.id 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {selectedCaseId === c.id ? 'Active Scope' : 'Select Scope'}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                  {c.summary}
                </p>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-4">
                    <span>Crime: <strong className="text-slate-700">{c.crimeType}</strong></span>
                    <span>Status: <strong className="text-slate-700">{c.status}</strong></span>
                  </div>
                  <button 
                    onClick={() => {
                      onSelectCaseId(c.id);
                      onNavigateTab('timeline');
                    }}
                    className="text-blue-600 hover:text-blue-700 font-medium text-xs flex items-center gap-1"
                  >
                    <span>View Timeline</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Attention Cases Pagination Bar */}
          {casesNeedingAttention.length > pageSize && (
            <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
              <span className="font-mono">
                Showing {(attentionPage - 1) * pageSize + 1}–{Math.min(attentionPage * pageSize, casesNeedingAttention.length)} of {casesNeedingAttention.length} matching cases
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={attentionPage <= 1}
                  onClick={() => setAttentionPage(p => Math.max(1, p - 1))}
                  className="px-2 py-1 bg-white border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50 flex items-center text-slate-700 font-medium"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-xs px-2 text-slate-700">
                  {attentionPage} / {totalPages}
                </span>
                <button
                  disabled={attentionPage >= totalPages}
                  onClick={() => setAttentionPage(p => Math.min(totalPages, p + 1))}
                  className="px-2 py-1 bg-white border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50 flex items-center text-slate-700 font-medium"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Question 4: What are the high-priority targets / leads? (1 Col) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 font-heading">
              Indexed Key Targets
            </h2>
            <button
              onClick={() => onNavigateTab('entities')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 transition-colors"
            >
              <span>View All ({indexedEntitiesCount})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 card-shadow space-y-3">
            {dataset.entities.slice(0, 6).map(e => (
              <div 
                key={e.id}
                onClick={() => onSelectEntity(e.id)}
                className="p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors flex items-center justify-between border border-transparent hover:border-slate-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs">
                    {e.name ? e.name.slice(0, 2).toUpperCase() : 'EN'}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">{e.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2">
                      <span className="capitalize">{e.type}</span>
                      <span>•</span>
                      <span>Risk: {e.riskScore ?? 80}/100</span>
                    </div>
                  </div>
                </div>

                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
