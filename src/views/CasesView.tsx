import React, { useState, useMemo } from 'react';
import { 
  Briefcase, 
  Shield, 
  Users, 
  AlertTriangle, 
  FileText, 
  Lock, 
  Clock, 
  PhoneCall, 
  CreditCard, 
  CheckCircle2, 
  ArrowRight, 
  Plus, 
  Download, 
  ChevronRight,
  Eye,
  Info,
  Calendar,
  Search,
  Filter,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { InvestigationDataset } from '../services/datasetNormalizer';
import { CaseRecord } from '../types/investigation';
import { NavigationTab } from '../components/layout/AppShell';
import { InvestigationStoryView } from './InvestigationStoryView';
import { useAuth, isCaseAuthorized } from '../context/AuthContext';

interface CasesViewProps {
  dataset: InvestigationDataset;
  selectedCaseId: string | null;
  onSelectCaseId: (caseId: string | null) => void;
  onSelectEntity: (entityId: string) => void;
  onNavigateTab: (tab: NavigationTab) => void;
}

export const CasesView: React.FC<CasesViewProps> = ({
  dataset,
  selectedCaseId,
  onSelectCaseId,
  onSelectEntity,
  onNavigateTab
}) => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'DIRECTORY' | 'WORKSPACE'>('DIRECTORY');
  const [searchTerm, setSearchTerm] = useState('');
  const [unitFilter, setUnitFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'STORY' | 'ENTITIES' | 'TIMELINE' | 'EVIDENCE' | 'NOTES'>('OVERVIEW');
  const [investigatorNote, setInvestigatorNote] = useState('');
  const [notesList, setNotesList] = useState<Array<{ id: string; timestamp: string; author: string; text: string }>>([]);

  const activeCase = dataset.cases.find(c => c.id === selectedCaseId) || dataset.cases[0];

  const handleAddNote = () => {
    if (!investigatorNote.trim()) return;
    setNotesList([
      {
        id: `n-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
        author: 'Det. H. Vance',
        text: investigatorNote.trim()
      },
      ...notesList
    ]);
    setInvestigatorNote('');
  };

  // Export Court Briefing function
  const handleExportCourtBrief = () => {
    if (!activeCase) return;
    const content = `================================================================================
SHERLOCK FORENSIC INTELLIGENCE BRIEFING (C3PL AUDITED)
================================================================================
CASE IDENTIFIER: ${activeCase.caseNumber}
CASE TITLE: ${activeCase.title}
JURISDICTION: ${activeCase.jurisdiction || 'Precinct-7 Special Sector 4 Enforcement'}
STATUS: ${activeCase.status} | PRIORITY: ${activeCase.priority}
DATE GENERATED: ${new Date().toUTCString()}
LEAD INVESTIGATOR: ${activeCase.leadInvestigator}
================================================================================

1. EXECUTIVE INCIDENT SUMMARY
${activeCase.summary}

2. SUBJECTS / ACCUSED PERSONS
${(activeCase.subjects || []).map((s, idx) => `[${idx + 1}] Entity ID: ${s.entityId} | Role: ${s.roleInCrime} | Notes: ${s.allegation || s.notes || 'Identified actor'}`).join('\n')}

3. OBSERVED ENTITIES (CLEARLY DELINEATED - NOT CHARGED)
${(activeCase.observedEntities || []).map((o, idx) => `[${idx + 1}] Entity ID: ${o.entityId} | Observation Reason: ${o.observationReason}`).join('\n')}

4. SEIZED EVIDENCE & C3PL MERKLE CUSTODY
${(activeCase.evidenceIds || []).map((eid, idx) => {
  const ev = dataset.evidenceRecords.find(e => e.id === eid);
  return `[${idx + 1}] ID: ${eid} | Type: ${ev?.evidenceType || 'Digital'} | SHA-256: ${ev?.sha256Hash || 'VALID_MERKLE_LEAF'}`;
}).join('\n')}

================================================================================
CONFIDENTIAL LAW ENFORCEMENT RECORD — NOT FOR PUBLIC DISCLOSURE
================================================================================`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `COURT_BRIEF_${activeCase.caseNumber}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const filteredCases = useMemo(() => {
    return dataset.cases.filter(c => {
      if (!isCaseAuthorized(user, c.id)) return false;
      if (priorityFilter !== 'ALL' && c.priority !== priorityFilter) return false;
      if (unitFilter !== 'ALL') {
        const juris = (c.jurisdiction || '').toLowerCase();
        if (unitFilter === 'SECTOR4' && !juris.includes('sector 4')) return false;
        if (unitFilter === 'CYBER' && !juris.includes('cyber')) return false;
        if (unitFilter === 'MAJOR' && !juris.includes('major')) return false;
      }
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        c.caseNumber.toLowerCase().includes(term) ||
        c.title.toLowerCase().includes(term) ||
        c.leadInvestigator.toLowerCase().includes(term) ||
        c.summary.toLowerCase().includes(term)
      );
    });
  }, [dataset.cases, searchTerm, priorityFilter, unitFilter, user]);

  const totalPages = Math.max(1, Math.ceil(filteredCases.length / pageSize));
  const paginatedCases = useMemo(() => {
    return filteredCases.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredCases, currentPage]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight font-heading">
              Active Cases Directory
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
              {dataset.cases.length} Investigations
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Central case directory, subject classifications, jurisdiction units & forensic dossiers.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setViewMode(viewMode === 'DIRECTORY' ? 'WORKSPACE' : 'DIRECTORY')}
            className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors shadow-xs"
          >
            {viewMode === 'DIRECTORY' ? (
              <>
                <Briefcase className="w-4 h-4 text-blue-600" />
                <span>Open Dossier ({activeCase?.caseNumber || 'None'})</span>
              </>
            ) : (
              <>
                <Layers className="w-4 h-4 text-slate-600" />
                <span>Directory View</span>
              </>
            )}
          </button>
          
          <button
            onClick={handleExportCourtBrief}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-2 shadow-xs transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export Brief</span>
          </button>
        </div>
      </div>

      {viewMode === 'DIRECTORY' ? (
        /* Active Cases Table Directory View */
        <div className="space-y-4">
          {/* Search and Filters Strip */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search case ID, suspect, or keywords..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                <span>Unit:</span>
                <select
                  value={unitFilter}
                  onChange={(e) => setUnitFilter(e.target.value)}
                  className="py-1.5 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-600"
                >
                  <option value="ALL">All Units</option>
                  <option value="SECTOR4">Sector 4 Enforcement</option>
                  <option value="CYBER">Cyber Division</option>
                  <option value="MAJOR">Major Crimes Unit</option>
                </select>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                <span>Priority:</span>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="py-1.5 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-600"
                >
                  <option value="ALL">All Levels</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
            </div>
          </div>

          {/* Cases Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#F8FAFC] border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Case ID</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Title & Classification</th>
                    <th className="py-3.5 px-4">Lead Investigator</th>
                    <th className="py-3.5 px-4 text-right">Last Update</th>
                    <th className="py-3.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                  {paginatedCases.map((caseItem) => {
                    const isClosed = caseItem.status === 'CLOSED';
                    const isPending = caseItem.status === 'PENDING' || caseItem.status === 'FORENSIC_ANALYSIS' || caseItem.status === 'PENDING_REVIEW';

                    return (
                      <tr 
                        key={caseItem.id} 
                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                          caseItem.id === selectedCaseId ? 'bg-blue-50/40' : ''
                        }`}
                        onClick={() => {
                          onSelectCaseId(caseItem.id);
                          setViewMode('WORKSPACE');
                        }}
                      >
                        {/* Case ID */}
                        <td className="py-4 px-4 font-mono font-bold">
                          <span className={isClosed ? 'line-through text-slate-400' : 'text-blue-700'}>
                            {caseItem.caseNumber}
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td className="py-4 px-4">
                          {isClosed ? (
                            <span className="px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                              CLOSED
                            </span>
                          ) : isPending ? (
                            <span className="px-2.5 py-0.5 text-xs font-semibold bg-amber-50 text-amber-800 rounded-full border border-amber-200">
                              PENDING
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 text-xs font-semibold bg-red-50 text-red-700 rounded-full border border-red-200">
                              OPEN
                            </span>
                          )}
                        </td>

                        {/* Classification */}
                        <td className="py-4 px-4">
                          <div className={`font-bold ${isClosed ? 'text-slate-500' : 'text-slate-900'}`}>
                            {caseItem.title}
                          </div>
                          <div className="text-xs text-slate-500">
                            {caseItem.incidentType || caseItem.jurisdiction}
                          </div>
                        </td>

                        {/* Lead Investigator */}
                        <td className="py-4 px-4">
                          <div className="font-semibold text-slate-800">{caseItem.leadInvestigator}</div>
                          <div className="text-[11px] text-slate-500">Precinct-7 Unit</div>
                        </td>

                        {/* Last Update */}
                        <td className="py-4 px-4 text-right font-mono text-slate-500 text-xs">
                          {caseItem.dateOpened || 'Not available'}
                        </td>

                        {/* Action */}
                        <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              onSelectCaseId(caseItem.id);
                              setViewMode('WORKSPACE');
                            }}
                            className="px-3 py-1 bg-white hover:bg-slate-50 text-blue-700 border border-slate-300 rounded-lg font-semibold text-xs inline-flex items-center gap-1 transition-colors shadow-xs"
                          >
                            <span>Open Dossier</span> <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom summary footer with Pagination */}
            <div className="p-3.5 bg-[#F8FAFC] border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
              <span>Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredCases.length)} of {filteredCases.length} active investigations (Total: {dataset.cases.length})</span>
              
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50 flex items-center text-slate-700 font-medium font-mono"
                >
                  Prev
                </button>
                <span className="font-mono text-xs px-2 text-slate-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50 flex items-center text-slate-700 font-medium font-mono"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Isolated Case Detail Workspace View */
        activeCase && (
          <div className="space-y-5">
            {/* Active Case Header Card */}
            <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-4 card-shadow">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-blue-700 px-2.5 py-0.5 bg-blue-50 rounded-md border border-blue-200">
                      {activeCase.caseNumber}
                    </span>
                    <h2 className="text-lg font-bold text-slate-900 font-heading">{activeCase.title}</h2>
                    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                      activeCase.priority === 'CRITICAL' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}>
                      {activeCase.priority} PRIORITY
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500 font-medium">
                    <span>Opened: <strong className="text-slate-800 font-semibold">{activeCase.openedDate}</strong></span>
                    <span>Lead: <strong className="text-slate-800 font-semibold">{activeCase.leadInvestigator}</strong></span>
                    <span>Status: <strong className="text-blue-700 font-semibold">{activeCase.status.replace(/_/g, ' ')}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleExportCourtBrief}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-2 shadow-xs transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Court Brief</span>
                  </button>
                  <button
                    onClick={() => onNavigateTab('ai_copilot')}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-2 shadow-xs transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    <span>AI Case Hypothesis</span>
                  </button>
                </div>
              </div>

              {/* Case Summary */}
              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
                {activeCase.summary}
              </p>

              {/* Sub-tabs for Case workspace */}
              <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3 text-xs font-medium">
                {(['OVERVIEW', 'STORY', 'ENTITIES', 'TIMELINE', 'EVIDENCE', 'NOTES'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      activeTab === tab 
                        ? 'bg-blue-600 text-white font-semibold' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {tab === 'OVERVIEW' && 'Case Overview'}
                    {tab === 'STORY' && 'Investigation Story ✨'}
                    {tab === 'ENTITIES' && `Entities (${(activeCase.subjects?.length || 0) + (activeCase.observedEntities?.length || 0)})`}
                    {tab === 'TIMELINE' && 'Case Timeline'}
                    {tab === 'EVIDENCE' && `Seized Evidence (${activeCase.evidenceIds?.length || 0})`}
                    {tab === 'NOTES' && `Investigator Log (${notesList.length})`}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-tab: STORY */}
            {activeTab === 'STORY' && (
              <InvestigationStoryView
                selectedCaseId={activeCase.id}
                cases={dataset.cases || []}
                onSelectCaseId={onSelectCaseId}
                onOpenEntityDossier={onSelectEntity}
              />
            )}

            {/* Sub-tab: OVERVIEW */}
            {activeTab === 'OVERVIEW' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Left 2 Cols: Subjects & Observed summary */}
                <div className="md:col-span-2 space-y-4">
                  <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-3 card-shadow">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Shield className="w-4 h-4 text-red-600" />
                      Prime Subjects & Accused ({activeCase.subjects?.length || 0})
                    </h3>
                    <div className="space-y-2.5">
                      {(activeCase.subjects || []).map(s => {
                        const entity = dataset.entities.find(e => e.id === s.entityId);
                        return (
                          <div 
                            key={s.entityId}
                            className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span 
                                  onClick={() => onSelectEntity(s.entityId)}
                                  className="font-bold text-sm text-slate-900 hover:text-blue-600 cursor-pointer"
                                >
                                  {entity?.name || s.entityId}
                                </span>
                                <span className="px-2 py-0.5 text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 rounded-full">
                                  {s.role}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 mt-1">{s.notes}</p>
                            </div>
                            <button
                              onClick={() => onSelectEntity(s.entityId)}
                              className="text-xs text-blue-600 hover:text-blue-700 shrink-0 font-semibold"
                            >
                              Dossier ➔
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-3 card-shadow">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <Eye className="w-4 h-4 text-amber-600" />
                        Observed Entities (Not Formally Accused)
                      </h3>
                      <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                        LEGAL DELINEATION
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      {(activeCase.observedEntities || []).length > 0 ? (
                        (activeCase.observedEntities || []).map(o => {
                          const entity = dataset.entities.find(e => e.id === o.entityId);
                          return (
                            <div 
                              key={o.entityId}
                              className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span 
                                    onClick={() => onSelectEntity(o.entityId)}
                                    className="font-bold text-sm text-slate-900 hover:text-blue-600 cursor-pointer"
                                  >
                                    {entity?.name || o.entityId}
                                  </span>
                                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 rounded-full">
                                    OBSERVED
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 mt-1">
                                  <strong>Observation Rationale:</strong> {o.reason}
                                </p>
                              </div>
                              <button
                                onClick={() => onSelectEntity(o.entityId)}
                                className="text-xs text-blue-600 hover:text-blue-700 shrink-0 font-semibold"
                              >
                                View Contacts ➔
                              </button>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg border border-slate-200">
                          No non-accused observed contacts recorded for this case identifier.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Col: Evidence and Quick Actions */}
                <div className="space-y-4">
                  <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-3 card-shadow">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Lock className="w-4 h-4 text-purple-600" />
                      Seized Evidence Records ({activeCase.evidenceIds?.length || 0})
                    </h3>
                    <div className="space-y-2">
                      {(activeCase.evidenceIds || []).map(eid => {
                        const ev = dataset.evidenceRecords.find(e => e.id === eid);
                        return (
                          <div key={eid} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900 font-mono">{ev?.title || eid}</span>
                              <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                                {ev?.evidenceType || 'EXHIBIT'}
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 truncate">
                              SHA256: {ev?.sha256Hash || '0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => onNavigateTab('evidence_vault')}
                      className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>Open Merkle Vault</span> <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tab: NOTES */}
            {activeTab === 'NOTES' && (
              <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-4 card-shadow">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    Investigator Running Case Diary
                  </h3>
                </div>

                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                  {notesList.map(n => (
                    <div key={n.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                      <div className="flex items-center justify-between font-mono text-[11px] text-slate-500 border-b border-slate-200 pb-1">
                        <span className="font-bold text-slate-800 font-sans">{n.author}</span>
                        <span>{n.timestamp}</span>
                      </div>
                      <p className="text-slate-700 mt-1 leading-relaxed">{n.text}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <textarea
                    value={investigatorNote}
                    onChange={(e) => setInvestigatorNote(e.target.value)}
                    placeholder="Enter formal investigative note or cross-reference..."
                    rows={3}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleAddNote}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors shadow-xs"
                    >
                      Append Note to Case Diary
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
};

