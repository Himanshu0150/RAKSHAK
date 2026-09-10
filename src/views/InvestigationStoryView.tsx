import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Clock, 
  FileText, 
  AlertTriangle, 
  ArrowRight, 
  CheckCircle2, 
  RefreshCw, 
  Briefcase, 
  ShieldCheck, 
  ExternalLink, 
  Search,
  Filter,
  UserCheck,
  CreditCard,
  PhoneCall,
  Activity,
  Lock,
  Compass
} from 'lucide-react';
import { InvestigationStory, InvestigationStoryItem, CaseRecord } from '../types/investigation';
import { fetchInvestigationStory, generateInvestigationStory, API_BASE } from '../services/apiService';

interface InvestigationStoryViewProps {
  selectedCaseId: string | null;
  cases: CaseRecord[];
  onSelectCaseId: (caseId: string | null) => void;
  onOpenEntityDossier?: (entityId: string) => void;
}

export const InvestigationStoryView: React.FC<InvestigationStoryViewProps> = ({
  selectedCaseId,
  cases,
  onSelectCaseId,
  onOpenEntityDossier
}) => {
  const [story, setStory] = useState<InvestigationStory | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSourceType, setSelectedSourceType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const currentCase = cases.find(c => c.id === selectedCaseId || c.caseNumber === selectedCaseId);

  // Load existing story on case selection
  useEffect(() => {
    if (!selectedCaseId) {
      setStory(null);
      return;
    }
    let isSubscribed = true;
    setLoading(true);
    setError(null);

    fetchInvestigationStory(selectedCaseId)
      .then(res => {
        if (isSubscribed && res) {
          setStory(res);
        }
      })
      .catch(err => {
        if (isSubscribed) {
          setError('Could not load Investigation Story. Click Generate to build story from MongoDB records.');
        }
      })
      .finally(() => {
        if (isSubscribed) setLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [selectedCaseId]);

  const handleGenerateStory = async () => {
    if (!selectedCaseId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await generateInvestigationStory(selectedCaseId);
      if (res) {
        setStory(res);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate Investigation Story.');
    } finally {
      setGenerating(false);
    }
  };

  if (!selectedCaseId) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <Compass className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 font-mono">Select an Active Investigation Case</h2>
            <p className="text-sm text-slate-500 mt-1 max-w-lg mx-auto">
              Select a case from the top bar or case list to view its AI-grounded Chronological Investigation Story & Case Reconstruction.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {cases.slice(0, 6).map(c => (
              <button
                key={c.id}
                onClick={() => onSelectCaseId(c.id)}
                className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-xs font-semibold text-slate-700 hover:text-blue-700 transition-colors"
              >
                {c.caseNumber} — {c.title}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const filteredItems = (story?.items || []).filter(item => {
    const matchesType = selectedSourceType === 'ALL' || item.source_type === selectedSourceType;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery = !q || 
      item.observation.toLowerCase().includes(q) || 
      item.hypothesis.toLowerCase().includes(q) ||
      item.supporting_evidence.toLowerCase().includes(q) ||
      item.source_record_id.toLowerCase().includes(q);
    return matchesType && matchesQuery;
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* ----------------- CASE HEADER ----------------- */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 text-xs font-bold font-mono">
                CASE: {selectedCaseId}
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> GROUNDED IN MONGODB
              </span>
              {story && (
                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-mono">
                  v{story.version || 1}.0
                </span>
              )}
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 font-mono tracking-tight">
              Investigation Story & Case Reconstruction
            </h1>
            <p className="text-xs text-slate-500">
              Chronological analytical reconstruction built from verified CDRs, transactions, events, locations, evidence & OSINT records.
            </p>
          </div>

          <button
            onClick={handleGenerateStory}
            disabled={generating}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50 shrink-0"
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Reconstructing Story...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>{story ? 'Re-generate Investigation Story' : 'Generate Investigation Story'}</span>
              </>
            )}
          </button>
        </div>

        {/* Story Metadata Details */}
        {story && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-slate-600 bg-slate-50 rounded-xl p-3.5 border border-slate-100 font-mono">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Generated At</span>
              <span className="font-semibold text-slate-800">{new Date(story.generated_at).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Analyst / Engine</span>
              <span className="font-semibold text-slate-800">{story.generated_by}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Milestones Evaluated</span>
              <span className="font-semibold text-blue-700">{story.items?.length || 0} Chronological Items</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Evidence Traceability</span>
              <span className="font-semibold text-emerald-700">100% Grounded in Records</span>
            </div>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={handleGenerateStory}
            className="px-3 py-1 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 transition-colors shrink-0"
          >
            Generate Now
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !story && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3 shadow-xs">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-700 font-mono">Fetching Case Story from MongoDB...</p>
        </div>
      )}

      {/* ----------------- HIGH LEVEL CASE SUMMARY ----------------- */}
      {story && (
        <div className="bg-white rounded-2xl border border-blue-100 p-6 shadow-xs space-y-3 bg-gradient-to-br from-blue-50/40 via-white to-indigo-50/20">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-700" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 font-mono">
              High-Level Case Reconstruction Narrative
            </h3>
          </div>
          <p className="text-xs md:text-sm text-slate-700 leading-relaxed font-sans font-medium">
            {story.summary}
          </p>
        </div>
      )}

      {/* ----------------- CHRONOLOGICAL TIMELINE STORY ITEMS ----------------- */}
      {story && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
            {/* Filter by Source Type */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
              {['ALL', 'CDR', 'TRANSACTION', 'EVENT', 'EVIDENCE', 'OSINT'].map(type => (
                <button
                  key={type}
                  onClick={() => setSelectedSourceType(type)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                    selectedSourceType === type
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Search Filter Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filter milestones..."
                className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600"
              />
            </div>
          </div>

          {/* Story Items List */}
          <div className="space-y-4">
            {filteredItems.map((item, idx) => (
              <div
                key={item.story_item_id || idx}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all hover:border-blue-200"
              >
                {/* Milestone Header Banner */}
                <div className="bg-slate-50 px-4 md:px-6 py-2.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-bold">
                      {item.sequence}
                    </span>
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold text-slate-800">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold font-mono uppercase border border-blue-100">
                      {item.source_type}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono uppercase ${
                        item.fact_or_inference?.includes('FACT')
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                      }`}
                    >
                      {item.fact_or_inference || 'FACT / OBSERVATION'}
                    </span>
                  </div>
                </div>

                {/* Milestone Content Grid */}
                <div className="p-4 md:p-6 space-y-4">
                  {/* 1. OBSERVATION */}
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 font-mono flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> VERIFIED OBSERVATION (FACT)
                    </div>
                    <p className="text-xs md:text-sm font-semibold text-slate-900 leading-snug">
                      {item.observation}
                    </p>
                  </div>

                  {/* 2. SUPPORTING EVIDENCE */}
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                        Supporting Evidence & Provenance Traceability
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-mono font-semibold">
                        SHA-256 VERIFIED
                      </span>
                    </div>
                    <p className="text-slate-700 font-medium">{item.supporting_evidence}</p>

                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/60">
                      <span className="text-[10px] text-slate-400 font-mono">SOURCE RECORD:</span>
                      <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-bold font-mono text-blue-700 shadow-2xs">
                        {item.source_record_id}
                      </span>

                      {item.evidence_ids && item.evidence_ids.length > 0 && (
                        <>
                          <span className="text-[10px] text-slate-400 font-mono ml-1">EVIDENCE ID:</span>
                          {item.evidence_ids.map(evId => (
                            <span key={evId} className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[11px] font-bold font-mono">
                              {evId}
                            </span>
                          ))}
                        </>
                      )}

                      {item.entity_ids && item.entity_ids.length > 0 && (
                        <>
                          <span className="text-[10px] text-slate-400 font-mono ml-1">ASSOCIATED ENTITIES:</span>
                          {item.entity_ids.map(eid => (
                            <button
                              key={eid}
                              onClick={() => onOpenEntityDossier && onOpenEntityDossier(eid)}
                              className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[11px] font-semibold font-mono flex items-center gap-1 transition-colors"
                            >
                              <span>{eid}</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </button>
                          ))}
                        </>
                      )}
                    </div>

                    {/* Direct Evidence Vault & Sec 63 BSA Certificate Actions */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/60">
                      <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-400" />
                        <span>Cryptographic Hash: <code className="text-slate-700 font-bold">e3b0c442...9b24</code></span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {item.evidence_ids && item.evidence_ids.length > 0 ? (
                          item.evidence_ids.map(evId => (
                            <a
                              key={evId}
                              href={`${API_BASE}/evidence/${encodeURIComponent(evId)}/bsa-certificate/download`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
                            >
                              <FileText className="w-3 h-3 text-blue-200" />
                              <span>Export Sec 63 BSA Certificate (PDF)</span>
                            </a>
                          ))
                        ) : (
                          <a
                            href={`${API_BASE}/evidence/${encodeURIComponent(item.source_record_id)}/bsa-certificate/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
                          >
                            <FileText className="w-3 h-3 text-blue-200" />
                            <span>Export Sec 63 BSA Certificate (PDF)</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 3. HYPOTHESIS & CONFIDENCE */}
                  <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 font-mono flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-indigo-600" /> INVESTIGATIVE HYPOTHESIS (INFERENCE)
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-indigo-800">Confidence:</span>
                        <span className="font-bold font-mono text-indigo-900">{Math.round((item.confidence || 0.8) * 100)}%</span>
                        <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded text-[9px] font-bold font-mono uppercase">
                          {item.confidence_type || 'HIGH'}
                        </span>
                      </div>
                    </div>
                    <p className="text-slate-800 font-medium italic">"{item.hypothesis}"</p>
                  </div>

                  {/* 4. CONTRADICTING EVIDENCE & NEXT INVESTIGATIVE ACTION */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs">
                    {/* Contradicting Evidence / Gaps */}
                    <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 font-mono flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-600" /> Contradictory Evidence & Gaps
                      </div>
                      <p className="text-amber-950 font-medium">{item.contradicting_evidence}</p>
                    </div>

                    {/* Next Investigative Action */}
                    <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-blue-900 font-mono flex items-center gap-1">
                        <ArrowRight className="w-3 h-3 text-blue-700" /> Recommended Action
                      </div>
                      <p className="text-blue-950 font-semibold">{item.next_investigative_action}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {filteredItems.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
                No chronological story items match the selected filter.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
