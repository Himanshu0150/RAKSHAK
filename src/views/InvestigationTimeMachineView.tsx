import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, 
  Play, 
  Pause, 
  RotateCcw, 
  CreditCard, 
  PhoneCall, 
  MapPin, 
  Car, 
  Users, 
  ExternalLink,
  Sparkles,
  GitBranch,
  Copy,
  Check,
  AlertTriangle,
  Lock,
  Loader2,
  FileText,
  Layers,
  ShieldCheck,
  ShieldAlert,
  ListChecks,
  Compass,
  CheckCircle2,
  Info
} from 'lucide-react';
import { InvestigationDataset } from '../services/datasetNormalizer';
import { getEntityDisplayInfo, resolveGraphNodesForEvent } from '../utils/entityDisplay';
import { fetchTimelineEvents } from '../services/apiService';
import { buildInvestigationStory, InvestigationStoryData } from '../services/investigationStoryGenerator';

interface InvestigationTimeMachineViewProps {
  dataset: InvestigationDataset;
  selectedCaseId: string | null;
  onSelectCaseId: (caseId: string) => void;
  onSelectEntity: (entityId: string) => void;
  onNavigateTab: (tab: any) => void;
}

export const InvestigationTimeMachineView: React.FC<InvestigationTimeMachineViewProps> = ({
  dataset,
  selectedCaseId,
  onSelectCaseId,
  onSelectEntity,
  onNavigateTab
}) => {
  const cases = dataset.cases || [];
  const currentCase = cases.find(c => c.id === selectedCaseId || c.caseNumber === selectedCaseId) || cases[0];
  const activeCaseId = currentCase?.id || 'CASE-CYBER-8841';

  // Events & Loading State
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [events, setEvents] = useState<any[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Replay State
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Story & Brief State
  const storyContentRef = useRef<HTMLDivElement>(null);
  const [storyModalOpen, setStoryModalOpen] = useState<boolean>(false);
  const [isGeneratingStory, setIsGeneratingStory] = useState<boolean>(false);
  const [storyError, setStoryError] = useState<string | null>(null);
  const [storyData, setStoryData] = useState<InvestigationStoryData | null>(null);
  const [copiedBrief, setCopiedBrief] = useState<boolean>(false);
  const [storyActiveTab, setStoryActiveTab] = useState<'OVERVIEW' | 'CHRONOLOGY' | 'OBSERVATIONS' | 'HYPOTHESIS' | 'ACTIONS' | 'TRACEABILITY'>('OVERVIEW');

  // Prevent background page scrolling when story modal is active
  useEffect(() => {
    if (storyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [storyModalOpen]);

  // CRITICAL: Reset story content scroll position to top whenever modal opens, story generates, or active tab changes
  useEffect(() => {
    if (storyModalOpen && storyContentRef.current) {
      requestAnimationFrame(() => {
        if (storyContentRef.current) {
          storyContentRef.current.scrollTop = 0;
        }
      });
    }
  }, [storyModalOpen, storyData, storyActiveTab]);

  // Load timeline events for active case
  useEffect(() => {
    if (!activeCaseId) return;
    setIsLoading(true);
    setIsPlaying(false);
    setCurrentIndex(0);
    setStoryData(null);
    const controller = new AbortController();

    fetchTimelineEvents(300, activeCaseId, undefined, controller.signal)
      .then(data => {
        if (data && Array.isArray(data) && data.length > 0) {
          setEvents(data);
        } else {
          setEvents(dataset.timelineEvents || []);
        }
      })
      .catch(err => {
        console.warn('Backend timeline events fetch error, fallback to dataset:', err);
        setEvents(dataset.timelineEvents || []);
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [activeCaseId, dataset.timelineEvents]);

  // Filtered Events
  const filteredEvents = events.filter(e => {
    if (categoryFilter === 'ALL') return true;
    const cat = (e.category || e.sourceType || '').toUpperCase();
    if (categoryFilter === 'TELECOM') return cat.includes('TELECOM') || cat.includes('CDR') || cat.includes('CALL');
    if (categoryFilter === 'FINANCIAL') return cat.includes('FINANCIAL') || cat.includes('TRANSACTION') || cat.includes('BANK');
    if (categoryFilter === 'LOCATION') return cat.includes('LOCATION') || cat.includes('MOVEMENT') || cat.includes('TOWER');
    if (categoryFilter === 'VEHICLE') return cat.includes('VEHICLE') || cat.includes('CAR');
    if (categoryFilter === 'EVIDENCE') return cat.includes('EVIDENCE') || cat.includes('SEIZURE');
    return true;
  });

  // Replay Timer
  useEffect(() => {
    let timer: any = null;
    if (isPlaying && filteredEvents.length > 0) {
      const intervalMs = Math.max(200, 2000 / playbackSpeed);
      timer = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= filteredEvents.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, intervalMs);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, playbackSpeed, filteredEvents.length]);

  const activeEvent = filteredEvents[currentIndex] || filteredEvents[0];

  // Format Event Category Badge
  const getCategoryIcon = (category?: string) => {
    const c = (category || '').toUpperCase();
    if (c.includes('TELECOM') || c.includes('CDR')) return <PhoneCall className="w-3.5 h-3.5 text-cyan-600" />;
    if (c.includes('FINANCIAL') || c.includes('TRANSACTION')) return <CreditCard className="w-3.5 h-3.5 text-blue-600" />;
    if (c.includes('LOCATION') || c.includes('MOVEMENT')) return <MapPin className="w-3.5 h-3.5 text-amber-600" />;
    if (c.includes('VEHICLE')) return <Car className="w-3.5 h-3.5 text-purple-600" />;
    if (c.includes('EVIDENCE') || c.includes('SEIZURE')) return <Lock className="w-3.5 h-3.5 text-emerald-600" />;
    return <Clock className="w-3.5 h-3.5 text-slate-600" />;
  };

  // Story Generation Trigger
  const handleGenerateStory = async () => {
    setIsGeneratingStory(true);
    setStoryError(null);
    setStoryModalOpen(true);
    if (storyContentRef.current) {
      storyContentRef.current.scrollTop = 0;
    }

    try {
      const result = await buildInvestigationStory(activeCaseId, events, dataset);
      setStoryData(result);
      requestAnimationFrame(() => {
        if (storyContentRef.current) {
          storyContentRef.current.scrollTop = 0;
        }
      });
    } catch (err: any) {
      console.error('Failed to generate investigation story:', err);
      setStoryError('STORY GENERATION UNAVAILABLE: Unable to process case records.');
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const handleCopyBrief = () => {
    if (!storyData) return;
    const textToCopy = `RAKSHAK INVESTIGATION INTELLIGENCE BRIEF
Case #: ${storyData.case_number} — ${storyData.case_title}
Generated: ${storyData.generated_at}
Time Period: ${storyData.time_period}
Total Events: ${storyData.total_events}

CASE OVERVIEW:
${storyData.case_overview.summary}

WORKING HYPOTHESIS:
${storyData.working_hypothesis.statement}
${storyData.working_hypothesis.disclaimer}

CONFIDENCE ASSESSMENT:
${storyData.confidence_assessment.level} (${storyData.confidence_assessment.score_percentage}%)
Basis: ${storyData.confidence_assessment.basis}

CONTRADICTING EVIDENCE:
${storyData.contradicting_evidence.summary}

KEY OBSERVATIONS:
${storyData.key_observations.map((o, i) => `${i + 1}. ${o.observation}`).join('\n')}

NEXT INVESTIGATIVE ACTIONS:
${storyData.next_investigative_actions.map(a => `Step ${a.step} [${a.priority}]: ${a.action}`).join('\n')}

RAKSHAK System Traceability: All data strictly anchored to verified case records.`;
    
    navigator.clipboard.writeText(textToCopy);
    setCopiedBrief(true);
    setTimeout(() => setCopiedBrief(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-12">
      {/* ----------------- PAGE HEADER ----------------- */}
      <div className="pb-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#004B73] text-white rounded-lg shadow-xs">
              <Clock className="w-5 h-5 text-[#EAE0C8]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight font-mono">
                INVESTIGATION TIME MACHINE
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                "What happened, and in what order?" — Interactive Chronological Event Replay & Network Graph Synchronization
              </p>
            </div>
          </div>
        </div>

        {/* Controls: Case Selector & Generate Story Button */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={activeCaseId}
              onChange={(e) => onSelectCaseId(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 shadow-xs focus:outline-none focus:border-blue-600 font-mono"
            >
              {cases.map(c => (
                <option key={c.id} value={c.id}>
                  Case #{c.caseNumber || c.id} — {c.title?.slice(0, 30)}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleGenerateStory}
            className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-2 transition-all shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-purple-200" />
            <span>GENERATE INVESTIGATION STORY</span>
          </button>
        </div>
      </div>

      {/* ----------------- REPLAY PLAYBACK CONTROLS BAR ----------------- */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
          {/* Main Buttons: Play, Pause, Restart */}
          <div className="flex items-center gap-2">
            {!isPlaying ? (
              <button
                onClick={() => {
                  if (currentIndex >= filteredEvents.length - 1) setCurrentIndex(0);
                  setIsPlaying(true);
                }}
                disabled={filteredEvents.length === 0}
                className="px-4 py-2 bg-[#004B73] hover:bg-[#003857] text-white rounded-lg text-xs font-bold font-mono flex items-center gap-2 transition-all shadow-xs disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>PLAY REPLAY</span>
              </button>
            ) : (
              <button
                onClick={() => setIsPlaying(false)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold font-mono flex items-center gap-2 transition-all shadow-xs"
              >
                <Pause className="w-4 h-4 fill-white" />
                <span>PAUSE</span>
              </button>
            )}

            <button
              onClick={() => {
                setIsPlaying(false);
                setCurrentIndex(0);
              }}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors border border-slate-300"
              title="Restart Replay"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Timeline Scrubber Slider */}
          <div className="flex-1 max-w-md mx-2">
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-1">
              <span>Event {filteredEvents.length > 0 ? currentIndex + 1 : 0} of {filteredEvents.length}</span>
              <span>{activeEvent?.timestamp ? String(activeEvent.timestamp).slice(0, 19) : 'Timestamp Unavailable'}</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0, filteredEvents.length - 1)}
              value={currentIndex}
              onChange={(e) => {
                setIsPlaying(false);
                setCurrentIndex(parseInt(e.target.value, 10));
              }}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#004B73]"
            />
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="text-slate-500 font-semibold">Speed:</span>
            {[0.5, 1, 2, 4].map(s => (
              <button
                key={s}
                onClick={() => setPlaybackSpeed(s)}
                className={`px-2 py-1 text-xs font-bold rounded transition-colors ${
                  playbackSpeed === s ? 'bg-[#004B73] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Event Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto text-xs font-mono pt-1">
          <span className="text-slate-400 font-bold uppercase text-[10px] shrink-0">Filter Stream:</span>
          {['ALL', 'TELECOM', 'FINANCIAL', 'LOCATION', 'VEHICLE', 'EVIDENCE'].map(cat => (
            <button
              key={cat}
              onClick={() => {
                setCategoryFilter(cat);
                setCurrentIndex(0);
              }}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-colors shrink-0 ${
                categoryFilter === cat
                  ? 'bg-blue-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ----------------- MAIN WORKSPACE: ACTIVE EVENT CARD + NETWORK GRAPH (12 cols) ----------------- */}
      {filteredEvents.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-xl space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h2 className="text-sm font-bold font-mono text-slate-900 uppercase">
            NO REPLAYABLE EVENTS
          </h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            This case does not currently contain enough timestamped events to build an investigation replay.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Active Event Spotlight & Chronological Stream (6 cols) */}
          <div className="lg:col-span-6 space-y-5">
            
            {/* Active Event Spotlight Card */}
            {activeEvent && (
              <div className="bg-white border-2 border-blue-500 rounded-xl p-5 shadow-md space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="p-1.5 bg-blue-50 border border-blue-200 rounded">
                      {getCategoryIcon(activeEvent.category || activeEvent.sourceType)}
                    </span>
                    <span className="text-xs font-bold text-slate-900 uppercase">
                      {activeEvent.category || activeEvent.sourceType || 'EVENT'}
                    </span>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-800 text-[10px] font-bold rounded border border-blue-200">
                      Event #{currentIndex + 1}
                    </span>
                  </div>

                  <span className="text-xs font-bold font-mono text-blue-700 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                    {activeEvent.timestamp ? String(activeEvent.timestamp).slice(0, 19) : 'Timestamp Unavailable'}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    {activeEvent.title}
                  </h3>
                  <p className="text-xs text-slate-700 font-sans mt-1.5 leading-relaxed">
                    {activeEvent.description}
                  </p>
                </div>

                {/* Entities Involved Strip */}
                {activeEvent.entitiesInvolved && activeEvent.entitiesInvolved.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-bold font-mono text-slate-400 uppercase block mb-1.5">
                      Entities Involved In Event:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {activeEvent.entitiesInvolved.map((eid: string) => {
                        const info = getEntityDisplayInfo(eid, dataset);
                        return (
                          <button
                            key={eid}
                            onClick={() => onSelectEntity(eid)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded border border-slate-200 flex items-center gap-1.5 transition-colors"
                            title={info.title}
                          >
                            <span className="font-bold text-slate-900">{info.title}</span>
                            {info.subtitle && (
                              <span className="text-[10px] text-slate-500 font-medium">• {info.subtitle}</span>
                            )}
                            <ExternalLink className="w-3 h-3 text-slate-500" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Source Record Inspection Link */}
                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => {
                      const cat = (activeEvent.category || activeEvent.sourceType || '').toUpperCase();
                      if (cat.includes('FINANCIAL') || cat.includes('TRANSACTION')) onNavigateTab('financial');
                      else if (cat.includes('TELECOM') || cat.includes('CDR')) onNavigateTab('telecom');
                      else if (cat.includes('EVIDENCE')) onNavigateTab('evidence_vault');
                      else onNavigateTab('entities');
                    }}
                    className="px-3 py-1.5 bg-[#004B73] hover:bg-[#003857] text-white text-xs font-semibold rounded-lg font-mono flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <span>VIEW SOURCE RECORD</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            )}

            {/* Vertical Chronological Stream */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
              <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#004B73]" />
                CHRONOLOGICAL CASE STREAM ({filteredEvents.length} Events)
              </h3>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {filteredEvents.map((ev, idx) => {
                  const isActive = idx === currentIndex;
                  return (
                    <div
                      key={ev.id || idx}
                      onClick={() => {
                        setIsPlaying(false);
                        setCurrentIndex(idx);
                      }}
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                        isActive
                          ? 'bg-blue-50 border-blue-500 shadow-xs ring-1 ring-blue-500/20'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {getCategoryIcon(ev.category || ev.sourceType)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold font-mono text-[#004B73] truncate">
                            {ev.title}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 shrink-0">
                            {ev.timestamp ? String(ev.timestamp).slice(11, 19) : 'N/A'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-1 mt-0.5">
                          {ev.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Right Column: Synchronized Knowledge Graph Visualizer (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 sticky top-20">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider">
                    SYNCHRONIZED NETWORK GRAPH
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold bg-purple-50 text-purple-800 px-2 py-0.5 rounded border border-purple-200">
                  Live Event Highlight
                </span>
              </div>

              {/* Graphical Animation Representation */}
              <div className="p-6 bg-slate-900 text-white rounded-xl min-h-[340px] flex flex-col justify-between relative overflow-hidden">
                {/* Background Grid */}
                <div className="absolute inset-0 opacity-15 tactical-grid-bg pointer-events-none" />

                <div className="relative z-10 flex justify-between items-center text-xs font-mono text-slate-400 border-b border-slate-800 pb-2">
                  <span>ACTIVE REPLAY HIGHLIGHT</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE NODES
                  </span>
                </div>

                {/* Highlighted Entities Flow */}
                <div className="relative z-10 my-8 flex items-center justify-around font-sans">
                  {(() => {
                    const resolved = resolveGraphNodesForEvent(activeEvent, dataset);
                    const { sourceNode, targetNode, linkLabel } = resolved;

                    return (
                      <>
                        <div className="p-3.5 bg-blue-600 text-white rounded-xl font-bold text-xs border border-blue-400 shadow-lg text-center animate-pulse max-w-[210px] shrink-0">
                          <Users className="w-5 h-5 mx-auto mb-1 text-blue-200" />
                          <div className="font-bold text-white text-xs truncate max-w-[180px]" title={sourceNode.primary}>
                            {sourceNode.primary}
                          </div>
                          <div className="text-[10px] text-blue-100 font-medium truncate max-w-[180px] mt-0.5">
                            {sourceNode.secondary}
                          </div>
                          {sourceNode.refId && (
                            <div className="text-[9px] text-blue-200 font-mono mt-0.5 opacity-80">
                              Ref: {sourceNode.refId}
                            </div>
                          )}
                          <div className="text-[9px] text-blue-200 font-semibold uppercase tracking-wider mt-1 border-t border-blue-500/50 pt-1">
                            {sourceNode.type.toUpperCase()} NODE
                          </div>
                        </div>

                        {targetNode ? (
                          <>
                            <div className="flex flex-col items-center mx-2 shrink-0">
                              <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800 font-mono text-center max-w-[140px] truncate" title={linkLabel}>
                                {linkLabel}
                              </span>
                              <div className="h-0.5 w-16 bg-gradient-to-r from-blue-500 via-emerald-400 to-purple-500 my-2 animate-pulse" />
                            </div>

                            <div className="p-3.5 bg-purple-600 text-white rounded-xl font-bold text-xs border border-purple-400 shadow-lg text-center animate-pulse max-w-[210px] shrink-0">
                              <Users className="w-5 h-5 mx-auto mb-1 text-purple-200" />
                              <div className="font-bold text-white text-xs truncate max-w-[180px]" title={targetNode.primary}>
                                {targetNode.primary}
                              </div>
                              <div className="text-[10px] text-purple-100 font-medium truncate max-w-[180px] mt-0.5">
                                {targetNode.secondary}
                              </div>
                              {targetNode.refId && (
                                <div className="text-[9px] text-purple-200 font-mono mt-0.5 opacity-80">
                                  Ref: {targetNode.refId}
                                </div>
                              )}
                              <div className="text-[9px] text-purple-200 font-semibold uppercase tracking-wider mt-1 border-t border-purple-500/50 pt-1">
                                {targetNode.type.toUpperCase()} NODE
                              </div>
                            </div>
                          </>
                        ) : null}
                      </>
                    );
                  })()}
                </div>

                {/* Footer status */}
                <div className="relative z-10 pt-3 border-t border-slate-800 flex justify-between items-center text-[10px] font-mono text-slate-400">
                  <span className="font-semibold">Knowledge Graph Topology Stream</span>
                  <button
                    onClick={() => onNavigateTab('knowledge_graph')}
                    className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                  >
                    <span>OPEN FULL GRAPH</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Action Button: Open Full Graph */}
              <div className="pt-2">
                <button
                  onClick={() => onNavigateTab('knowledge_graph')}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold font-mono flex items-center justify-center gap-2 border border-slate-200 transition-colors"
                >
                  <GitBranch className="w-4 h-4 text-purple-600" />
                  <span>EXPLORE FULL KNOWLEDGE GRAPH TOPOLOGY</span>
                </button>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* ----------------- INTEGRATED INVESTIGATION STORY MODAL ----------------- */}
      {storyModalOpen && (
        <>
          {/* Overlay (Z-9990) */}
          <div 
            className="fixed inset-0 z-[9990] bg-slate-950/75 backdrop-blur-xs animate-in fade-in"
            onClick={() => setStoryModalOpen(false)}
          />

          {/* Modal Container Card (Z-9991, Top: 112px) */}
          <div className="fixed top-[112px] left-1/2 -translate-x-1/2 z-[9991] w-[calc(100vw-48px)] lg:w-[70vw] max-w-[1344px] min-w-[320px] h-[calc(100vh-142px)] max-h-[calc(100vh-142px)] bg-white border border-slate-300 rounded-[18px] flex flex-col overflow-hidden shadow-2xl font-sans box-border">
            
            {/* Modal Header (70px Height, Fixed Flex-None) */}
            <div className="h-[70px] min-h-[70px] max-h-[70px] flex-none px-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 box-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-600 text-white rounded-xl shadow-xs">
                  <Sparkles className="w-5 h-5 text-purple-200" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold font-mono tracking-tight text-white">
                      INVESTIGATION STORY & CASE RECONSTRUCTION
                    </h2>
                    <span className="px-2 py-0.5 bg-purple-950 text-purple-300 text-[10px] font-mono font-bold rounded border border-purple-800">
                      Grounded Forensic Intelligence
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Case #{currentCase?.caseNumber || activeCaseId} — {currentCase?.title || 'Active Investigation Scope'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {storyData && (
                  <button
                    onClick={handleGenerateStory}
                    disabled={isGeneratingStory}
                    className="px-3 py-1.5 bg-purple-800 hover:bg-purple-700 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>REGENERATE STORY</span>
                  </button>
                )}
                <button
                  onClick={() => setStoryModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Pinned Tab Bar (56px Height, Fixed Flex-None) */}
            {storyData && !isGeneratingStory && !storyError && (
              <div className="h-[56px] min-h-[56px] max-h-[56px] flex-none bg-slate-100 border-b border-slate-200 px-[18px] py-[10px] flex items-center gap-2 overflow-x-auto whitespace-nowrap box-border">
                {[
                  { id: 'OVERVIEW', label: '1. OVERVIEW', icon: Info },
                  { id: 'CHRONOLOGY', label: '2. CHRONOLOGY', icon: Clock },
                  { id: 'OBSERVATIONS', label: '3. OBSERVATIONS', icon: FileText },
                  { id: 'HYPOTHESIS', label: '4. HYPOTHESIS & CONFIDENCE', icon: ShieldCheck },
                  { id: 'ACTIONS', label: '5. ACTIONS & UNVERIFIED', icon: ListChecks },
                  { id: 'TRACEABILITY', label: '6. SOURCE TRACEABILITY', icon: Compass }
                ].map(tab => {
                  const Icon = tab.icon;
                  const active = storyActiveTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setStoryActiveTab(tab.id as any)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 flex-none transition-colors ${
                        active
                          ? 'bg-[#004B73] text-white shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Dedicated Scrollable Story Body (Flex: 1 1 auto, Overflow-Y-Auto) */}
            <div 
              ref={storyContentRef}
              className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6 sm:px-[28px] sm:pt-6 sm:pb-[28px] space-y-6 bg-slate-50 font-sans w-full box-border"
            >
              
              {isGeneratingStory ? (
                <div className="p-16 text-center space-y-4">
                  <Loader2 className="w-10 h-10 text-purple-700 animate-spin mx-auto" />
                  <div className="text-sm font-bold font-mono text-slate-900 uppercase tracking-wide">
                    ANALYZING VERIFIED CASE RECORDS...
                  </div>
                  <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed font-mono">
                    Aggregating event chronology, CDR intercepts, financial transfers, cell tower movements, and evidence custody records. Pre-resolving all entity identifiers against canonical registries...
                  </p>
                </div>
              ) : storyError ? (
                <div className="p-12 text-center bg-white border border-rose-200 rounded-xl space-y-4">
                  <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto" />
                  <div className="text-sm font-bold font-mono text-slate-900 uppercase">
                    STORY GENERATION UNAVAILABLE
                  </div>
                  <p className="text-xs text-slate-600 max-w-md mx-auto">{storyError}</p>
                  <button
                    onClick={handleGenerateStory}
                    className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-mono text-xs font-bold rounded-lg shadow-xs"
                  >
                    RETRY STORY GENERATION
                  </button>
                </div>
              ) : storyData ? (
                <div className="space-y-6 mb-6">

                  {/* TAB 1: CASE OVERVIEW */}
                  {storyActiveTab === 'OVERVIEW' && (
                    <div className="space-y-5">
                      {/* Overview Header Banner */}
                      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                          <div>
                            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Case Scope</span>
                            <h3 className="text-base font-bold text-slate-900 font-mono">
                              {storyData.case_title} (#{storyData.case_number})
                            </h3>
                          </div>

                          <div className="flex items-center gap-2 font-mono">
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold rounded">
                              ✓ VERIFIED DATA ONLY
                            </span>
                            <span className="px-2.5 py-1 bg-purple-50 text-purple-900 border border-purple-200 text-xs font-bold rounded">
                              {storyData.model_used}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-700 leading-relaxed font-sans">
                          {storyData.case_overview.summary}
                        </p>

                        <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs font-mono text-blue-950 flex items-start gap-2">
                          <ShieldCheck className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-bold block">GROUNDED RECONSTRUCTION GUARANTEE:</span>
                            {storyData.case_overview.verified_scope}
                          </div>
                        </div>
                      </div>

                      {/* Key Pre-Resolved Entities Card */}
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
                        <h4 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider flex items-center gap-2">
                          <Users className="w-4 h-4 text-purple-700" />
                          KEY RESOLVED CASE ENTITIES ({storyData.case_overview.key_entities.length})
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                          {storyData.case_overview.key_entities.map((e, idx) => (
                            <div
                              key={e.id || idx}
                              onClick={() => onSelectEntity(e.id)}
                              className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer transition-colors space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-900 truncate">{e.title}</span>
                                <span className="px-1.5 py-0.5 bg-slate-200 text-slate-800 text-[9px] font-mono font-bold uppercase rounded">
                                  {e.type}
                                </span>
                              </div>
                              {e.subtitle && (
                                <p className="text-[10px] text-slate-500 truncate">{e.subtitle}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: CHRONOLOGICAL RECONSTRUCTION */}
                  {storyActiveTab === 'CHRONOLOGY' && (
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#004B73]" />
                          SECTION 2 — CHRONOLOGICAL CASE RECONSTRUCTION ({storyData.chronological_reconstruction.length} Events)
                        </h3>
                        <span className="text-[10px] font-mono text-slate-500">
                          {storyData.time_period}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {storyData.chronological_reconstruction.map((item) => (
                          <div
                            key={item.sequence}
                            className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 font-sans hover:border-slate-300 transition-colors"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                              <div className="flex items-center gap-2 font-mono">
                                <span className="w-5 h-5 rounded-full bg-[#004B73] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                  {item.sequence}
                                </span>
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-900 text-[10px] font-bold uppercase rounded border border-blue-200">
                                  {item.category}
                                </span>
                                <span className="text-xs font-bold text-slate-900">{item.title}</span>
                              </div>

                              <span className="text-[11px] font-mono text-blue-800 font-bold bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">
                                {item.timestamp}
                              </span>
                            </div>

                            <p className="text-xs text-slate-700 leading-relaxed">
                              {item.description}
                            </p>

                            {/* Involved Entities Pills */}
                            {item.entities_involved.length > 0 && (
                              <div className="pt-2 flex flex-wrap items-center gap-1.5 text-xs">
                                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">Resolved Entities:</span>
                                {item.entities_involved.map((ent, eidx) => (
                                  <button
                                    key={ent.id || eidx}
                                    onClick={() => onSelectEntity(ent.id)}
                                    className="px-2 py-0.5 bg-white hover:bg-slate-200 text-slate-800 text-[11px] font-semibold rounded border border-slate-200 transition-colors"
                                  >
                                    {ent.title}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: KEY OBSERVATIONS & SUPPORTING EVIDENCE */}
                  {storyActiveTab === 'OBSERVATIONS' && (
                    <div className="space-y-6">
                      {/* Section 3: Key Observations */}
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                        <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                          <FileText className="w-4 h-4 text-emerald-700" />
                          SECTION 3 — KEY EMPIRICAL OBSERVATIONS ({storyData.key_observations.length})
                        </h3>

                        <div className="space-y-2.5">
                          {storyData.key_observations.map((obs, idx) => (
                            <div key={obs.id || idx} className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-lg flex items-start gap-3">
                              <span className="w-6 h-6 rounded-full bg-emerald-700 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] font-mono font-bold text-emerald-900 uppercase">{obs.category}</span>
                                  <span className="text-[10px] font-mono text-slate-500">{obs.timestamp}</span>
                                </div>
                                <p className="text-xs font-medium text-slate-900 leading-relaxed">
                                  {obs.observation}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Section 4: Supporting Evidence */}
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                        <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                          <ShieldCheck className="w-4 h-4 text-[#004B73]" />
                          SECTION 4 — SUPPORTING EVIDENCE & SOURCE NAVIGATION ({storyData.supporting_evidence.length})
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {storyData.supporting_evidence.map((ev, idx) => (
                            <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 flex flex-col justify-between">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-900 text-[10px] font-bold font-mono uppercase rounded border border-blue-200">
                                    {ev.evidence_type}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-400">Ref: {ev.source_record_id}</span>
                                </div>
                                <h4 className="text-xs font-bold text-slate-900">{ev.title}</h4>
                                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{ev.summary}</p>
                              </div>

                              <div className="pt-2 border-t border-slate-200/80 flex justify-end">
                                <button
                                  onClick={() => onNavigateTab(ev.target_tab)}
                                  className="px-3 py-1.5 bg-[#004B73] hover:bg-[#003857] text-white text-[11px] font-bold font-mono rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
                                >
                                  <span>VIEW SOURCE RECORD</span>
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: WORKING HYPOTHESIS & CONFIDENCE ASSESSMENT */}
                  {storyActiveTab === 'HYPOTHESIS' && (
                    <div className="space-y-6">
                      {/* Section 5: Working Hypothesis */}
                      <div className="p-6 bg-purple-950 text-white rounded-xl shadow-md space-y-4 border border-purple-800">
                        <div className="flex items-center justify-between border-b border-purple-800 pb-3">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-purple-300" />
                            <h3 className="text-sm font-bold font-mono text-purple-100 uppercase tracking-wider">
                              SECTION 5 — WORKING HYPOTHESIS
                            </h3>
                          </div>
                          <span className="px-2.5 py-0.5 bg-purple-900 text-purple-200 text-[10px] font-mono font-bold rounded border border-purple-700">
                            ANALYTICAL CORRELATION
                          </span>
                        </div>

                        <div className="p-4 bg-purple-900/60 rounded-xl border border-purple-700/60 space-y-2">
                          <p className="text-sm font-semibold text-white leading-relaxed font-sans">
                            "{storyData.working_hypothesis.statement}"
                          </p>
                          <p className="text-xs text-purple-200 font-mono pt-1">
                            Rationale: {storyData.working_hypothesis.rationale}
                          </p>
                        </div>

                        <div className="p-3 bg-purple-900/30 rounded-lg border border-purple-700/40 text-[11px] font-mono text-purple-300 flex items-center gap-2">
                          <Info className="w-4 h-4 text-purple-300 shrink-0" />
                          <span>{storyData.working_hypothesis.disclaimer}</span>
                        </div>
                      </div>

                      {/* Section 6: Confidence Assessment */}
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                        <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          SECTION 6 — CONFIDENCE ASSESSMENT
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <div className="text-center md:border-r border-slate-200 pr-4">
                            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">Confidence Level</span>
                            <span className={`text-xl font-bold font-mono mt-1 inline-block px-3 py-1 rounded ${
                              storyData.confidence_assessment.level === 'HIGH' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' :
                              storyData.confidence_assessment.level === 'MODERATE' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                              'bg-rose-100 text-rose-900 border border-rose-300'
                            }`}>
                              {storyData.confidence_assessment.level} ({storyData.confidence_assessment.score_percentage}%)
                            </span>
                          </div>

                          <div className="md:col-span-2 space-y-1">
                            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">Deterministic Evaluation Basis</span>
                            <p className="text-xs font-medium text-slate-800 leading-relaxed font-mono">
                              {storyData.confidence_assessment.basis}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Section 7: Contradicting / Inconsistent Evidence */}
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                        <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                          <ShieldAlert className="w-4 h-4 text-amber-600" />
                          SECTION 7 — CONTRADICTING / INCONSISTENT EVIDENCE AUDIT
                        </h3>

                        <div className={`p-4 rounded-xl border font-mono text-xs ${
                          storyData.contradicting_evidence.has_contradictions 
                            ? 'bg-amber-50 border-amber-200 text-amber-950'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                        }`}>
                          <div className="flex items-center gap-2 font-bold mb-2">
                            {storyData.contradicting_evidence.has_contradictions ? (
                              <AlertTriangle className="w-4 h-4 text-amber-600" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            )}
                            <span>AUDIT SUMMARY:</span>
                          </div>
                          <p className="font-sans text-xs">{storyData.contradicting_evidence.summary}</p>

                          {storyData.contradicting_evidence.findings.length > 0 && (
                            <div className="mt-3 space-y-2 pt-2 border-t border-amber-200">
                              {storyData.contradicting_evidence.findings.map((f, i) => (
                                <div key={i} className="p-2 bg-white rounded border border-amber-200 text-slate-900 text-xs">
                                  {f.description} (Record: {f.source_record_id})
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 5: ACTIONS & UNVERIFIED ITEMS */}
                  {storyActiveTab === 'ACTIONS' && (
                    <div className="space-y-6">
                      {/* Section 8: Unverified Items */}
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                        <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          SECTION 8 — UNVERIFIED ITEMS & EVIDENCE GAPS ({storyData.unverified_items.length})
                        </h3>

                        <div className="space-y-2">
                          {storyData.unverified_items.map((item, idx) => (
                            <div key={idx} className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg flex items-start justify-between gap-3 text-xs">
                              <div>
                                <span className="font-bold text-amber-950 block font-mono">{item.item}</span>
                                <span className="text-slate-600 mt-0.5 block">{item.reason}</span>
                              </div>
                              <span className="px-2 py-0.5 bg-amber-200 text-amber-900 text-[10px] font-mono font-bold rounded shrink-0 uppercase">
                                PENDING CORROBORATION
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Section 9: Next Investigative Actions */}
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                        <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                          <ListChecks className="w-4 h-4 text-purple-700" />
                          SECTION 9 — RECOMMENDED NEXT INVESTIGATIVE ACTIONS ({storyData.next_investigative_actions.length})
                        </h3>

                        <div className="space-y-3">
                          {storyData.next_investigative_actions.map((act) => (
                            <div key={act.step} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                                <div className="flex items-center gap-2 font-mono">
                                  <span className="w-5 h-5 rounded-full bg-purple-700 text-white text-[10px] font-bold flex items-center justify-center">
                                    {act.step}
                                  </span>
                                  <span className="text-xs font-bold text-slate-900">Step {act.step} Action</span>
                                </div>
                                <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded uppercase ${
                                  act.priority === 'HIGH' ? 'bg-rose-100 text-rose-900 border border-rose-300' :
                                  act.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                                  'bg-slate-200 text-slate-800'
                                }`}>
                                  {act.priority} PRIORITY
                                </span>
                              </div>

                              <p className="text-xs font-semibold text-slate-900 leading-relaxed font-sans">
                                {act.action}
                              </p>

                              <p className="text-[11px] font-mono text-slate-500">
                                Evidentiary Basis: {act.basis}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 6: SOURCE TRACEABILITY */}
                  {storyActiveTab === 'TRACEABILITY' && (
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider flex items-center gap-2">
                          <Compass className="w-4 h-4 text-[#004B73]" />
                          SECTION 10 — FULL SOURCE TRACEABILITY MATRIX ({storyData.source_traceability.length} Claims Anchored)
                        </h3>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs font-sans">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-200 font-mono text-[11px] text-slate-700 uppercase">
                              <th className="p-3">Claim / Observation</th>
                              <th className="p-3">Source Record ID</th>
                              <th className="p-3">Category</th>
                              <th className="p-3">Resolved Entity</th>
                              <th className="p-3">Timestamp</th>
                              <th className="p-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {storyData.source_traceability.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="p-3 font-medium text-slate-900 max-w-xs truncate" title={item.claim}>
                                  {item.claim}
                                </td>
                                <td className="p-3 font-mono text-slate-600">{item.source_record_id}</td>
                                <td className="p-3 font-mono font-semibold text-blue-900">{item.source_type}</td>
                                <td className="p-3 font-bold text-slate-900">{item.resolved_entity_label}</td>
                                <td className="p-3 font-mono text-slate-500">{item.timestamp}</td>
                                <td className="p-3 text-right">
                                  <button
                                    onClick={() => {
                                      const st = item.source_type;
                                      if (st.includes('FINANCIAL')) onNavigateTab('financial');
                                      else if (st.includes('TELECOM') || st.includes('CDR') || st.includes('LOCATION')) onNavigateTab('telecom');
                                      else if (st.includes('EVIDENCE')) onNavigateTab('evidence_vault');
                                      else onNavigateTab('entities');
                                    }}
                                    className="px-2.5 py-1 bg-[#004B73] hover:bg-[#003857] text-white text-[10px] font-bold font-mono rounded flex items-center gap-1 ml-auto transition-colors"
                                  >
                                    <span>VIEW SOURCE</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>
              ) : null}

            </div>

            {/* Modal Footer (70px Height, Fixed Flex-None) */}
            <div className="h-[70px] min-h-[70px] max-h-[70px] flex-none bg-white border-t border-slate-200 pl-6 pr-5 flex items-center justify-between box-border">
              <div className="text-[11px] font-mono text-slate-500 truncate max-w-md">
                RAKSHAK System Protocol: Verified Data Anchoring Active • Zero Fictional Inferences
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {storyData && (
                  <button
                    onClick={handleCopyBrief}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold font-mono text-xs rounded-lg flex items-center gap-1.5 border border-slate-300 transition-colors shadow-xs"
                  >
                    {copiedBrief ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
                    <span>{copiedBrief ? 'COPIED BRIEF' : 'COPY BRIEF'}</span>
                  </button>
                )}

                <button
                  onClick={() => setStoryModalOpen(false)}
                  className="px-4 py-2 bg-[#004B73] hover:bg-[#003857] text-white font-bold font-mono text-xs rounded-lg transition-colors shadow-xs"
                >
                  CLOSE STORY
                </button>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
};
