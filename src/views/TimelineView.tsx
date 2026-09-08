import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, 
  Filter, 
  PhoneCall, 
  CreditCard, 
  Car, 
  Lock, 
  Users, 
  Calendar, 
  CheckCircle2, 
  ArrowRight,
  ShieldAlert,
  ChevronDown,
  Loader2,
  Search,
  X,
  RotateCcw,
  FileText,
  Radio,
  Building2,
  Smartphone
} from 'lucide-react';
import { InvestigationDataset } from '../services/datasetNormalizer';
import { TimelineEvent } from '../types/investigation';
import { fetchTimelineEvents } from '../services/apiService';

interface TimelineViewProps {
  dataset: InvestigationDataset;
  onSelectEntity: (entityId: string) => void;
  selectedCaseId?: string | null;
  onSelectCaseId?: (caseId: string | null) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  dataset,
  onSelectEntity,
  selectedCaseId,
  onSelectCaseId
}) => {
  const activeCaseId = selectedCaseId || dataset.cases[0]?.id || 'CASE-000001';
  const [caseEvents, setCaseEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // PART 2 Timeline Filters State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSourceType, setSelectedSourceType] = useState<string>('ALL');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [evidenceOnly, setEvidenceOnly] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');

  useEffect(() => {
    if (!activeCaseId) return;
    const controller = new AbortController();
    setCaseEvents([]);
    setLoading(true);

    fetchTimelineEvents(300, activeCaseId, undefined, controller.signal)
      .then(res => {
        if (!controller.signal.aborted) {
          if (Array.isArray(res)) setCaseEvents(res);
          else setCaseEvents([]);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setCaseEvents([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [activeCaseId]);

  // Dynamically extract unique source types and involved entity IDs for selected case
  const availableSourceTypes = useMemo(() => {
    const set = new Set<string>();
    caseEvents.forEach(ev => {
      if ((ev as any).sourceType) set.add((ev as any).sourceType);
    });
    const defaultSources = ['Events', 'CDR', 'Transactions', 'Evidence', 'Locations', 'Vehicles', 'Relationships', 'OSINT'];
    defaultSources.forEach(s => set.add(s));
    return Array.from(set);
  }, [caseEvents]);

  const uniqueInvolvedEntities = useMemo(() => {
    const set = new Set<string>();
    caseEvents.forEach(ev => {
      if (ev.entitiesInvolved && Array.isArray(ev.entitiesInvolved)) {
        ev.entitiesInvolved.forEach(id => set.add(id));
      }
    });
    return Array.from(set).sort();
  }, [caseEvents]);

  // Case-Scoped Filtering Logic (PART 2)
  const filteredEvents = useMemo(() => {
    return caseEvents
      .filter(ev => {
        // Enforce active_case_id scoping
        if (ev.caseId && ev.caseId !== activeCaseId) return false;

        // 1. Text Search Filter (search IDs, titles, descriptions, entities)
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const matchId = (ev.id || '').toLowerCase().includes(q);
          const matchTitle = (ev.title || '').toLowerCase().includes(q);
          const matchDesc = (ev.description || '').toLowerCase().includes(q);
          const matchEvidence = (ev.evidenceId || '').toLowerCase().includes(q);
          const matchLocation = ((ev as any).locationLabel || '').toLowerCase().includes(q);
          const matchEntities = ev.entitiesInvolved?.some(e => e.toLowerCase().includes(q));
          if (!matchId && !matchTitle && !matchDesc && !matchEvidence && !matchLocation && !matchEntities) {
            return false;
          }
        }

        // 2. Source Type Filter
        if (selectedSourceType !== 'ALL') {
          const evSource = (ev as any).sourceType || 'Events';
          if (evSource.toUpperCase() !== selectedSourceType.toUpperCase()) return false;
        }

        // 3. Entity Filter
        if (selectedEntityId !== 'ALL') {
          if (!ev.entitiesInvolved?.includes(selectedEntityId)) return false;
        }

        // 4. Category Filter
        if (selectedCategory !== 'ALL' && ev.category !== selectedCategory) return false;

        // 5. Evidence Only Filter
        if (evidenceOnly && !ev.evidenceId) return false;

        // 6. Date Range Filter
        if (startDate) {
          const evDate = ev.timestamp ? ev.timestamp.slice(0, 10) : '';
          if (evDate && evDate < startDate) return false;
        }
        if (endDate) {
          const evDate = ev.timestamp ? ev.timestamp.slice(0, 10) : '';
          if (evDate && evDate > endDate) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOrder === 'ASC') return (a.timestamp || '').localeCompare(b.timestamp || '');
        return (b.timestamp || '').localeCompare(a.timestamp || '');
      });
  }, [caseEvents, activeCaseId, searchQuery, selectedSourceType, selectedEntityId, selectedCategory, evidenceOnly, startDate, endDate, sortOrder]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedSourceType('ALL');
    setSelectedEntityId('ALL');
    setStartDate('');
    setEndDate('');
    setSelectedCategory('ALL');
    setEvidenceOnly(false);
  };

  const getCategoryIcon = (cat: string, sourceType?: string) => {
    if (sourceType === 'CDR' || cat === 'TELECOM') return <PhoneCall className="w-4 h-4 text-cyan-600" />;
    if (sourceType === 'Transactions' || cat === 'FINANCIAL') return <CreditCard className="w-4 h-4 text-amber-600" />;
    if (sourceType === 'Evidence' || cat === 'SEIZURE') return <Lock className="w-4 h-4 text-purple-600" />;
    if (cat === 'MOVEMENT') return <Car className="w-4 h-4 text-emerald-600" />;
    return <Users className="w-4 h-4 text-blue-600" />;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight font-heading">
              Chronology Timeline
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-mono">
              {activeCaseId} ({filteredEvents.length} Events)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Chronologically synchronized call records, vehicle toll passages, banking wires, and evidence seizures for active case <span className="font-mono font-bold text-blue-600">{activeCaseId}</span>.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Active Case Selector */}
          <div className="flex items-center gap-2 bg-white border border-slate-300 px-3 py-1.5 rounded-lg shadow-xs">
            <span className="text-xs font-semibold text-slate-500 font-mono">CASE:</span>
            <select
              value={activeCaseId}
              onChange={(e) => {
                onSelectCaseId?.(e.target.value);
                handleClearFilters();
              }}
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
            onClick={() => setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')}
            className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-700 shadow-xs transition-colors cursor-pointer"
          >
            <span>Sort: {sortOrder === 'ASC' ? 'Oldest First' : 'Newest First'}</span>
          </button>
        </div>
      </div>

      {/* PART 2 SEARCH & FILTER BAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
        {/* Top Search Input */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="SEARCH TIMELINE [ Search events, persons, entities, IDs... e.g. P00001, CDR-1234, TXN-8842 ]"
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {(searchQuery || selectedSourceType !== 'ALL' || selectedEntityId !== 'ALL' || startDate || endDate || selectedCategory !== 'ALL' || evidenceOnly) && (
            <button
              onClick={handleClearFilters}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Clear Filters</span>
            </button>
          )}
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Source Type Filter */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
            <span className="text-slate-500 font-semibold font-mono text-[11px]">Source Type:</span>
            <select
              value={selectedSourceType}
              onChange={(e) => setSelectedSourceType(e.target.value)}
              className="bg-transparent font-bold text-blue-600 focus:outline-none w-full cursor-pointer font-mono"
            >
              <option value="ALL">All Sources</option>
              {availableSourceTypes.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* Involved Entity Filter */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
            <span className="text-slate-500 font-semibold font-mono text-[11px]">Entity:</span>
            <select
              value={selectedEntityId}
              onChange={(e) => setSelectedEntityId(e.target.value)}
              className="bg-transparent font-bold text-blue-600 focus:outline-none w-full cursor-pointer font-mono"
            >
              <option value="ALL">All Entities</option>
              {uniqueInvolvedEntities.map(entId => {
                const entObj = dataset.entities.find(e => e.id === entId);
                return (
                  <option key={entId} value={entId}>
                    {entObj?.name ? `${entObj.name} — ${entId}` : entId}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Date Range Start */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
            <span className="text-slate-500 font-semibold font-mono text-[11px]">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent font-bold text-slate-700 focus:outline-none w-full font-mono"
            />
          </div>

          {/* Date Range End */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
            <span className="text-slate-500 font-semibold font-mono text-[11px]">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent font-bold text-slate-700 focus:outline-none w-full font-mono"
            />
          </div>
        </div>

        {/* Channel Categories & Checkboxes */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium mr-1">Category:</span>
            {['ALL', 'TELECOM', 'FINANCIAL', 'MOVEMENT', 'SEIZURE', 'MEETING'].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-blue-600 border-blue-600 text-white font-semibold'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none font-medium">
            <input
              type="checkbox"
              checked={evidenceOnly}
              onChange={(e) => setEvidenceOnly(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span>Seized Evidence Links Only</span>
          </label>
        </div>
      </div>

      {/* Loading Indicator */}
      {loading ? (
        <div className="flex items-center justify-center p-12 bg-white border border-slate-200 rounded-xl card-shadow">
          <div className="flex items-center space-x-2 text-xs font-medium text-blue-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Fetching MongoDB timeline events for {activeCaseId}...</span>
          </div>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="p-8 text-center bg-white border border-slate-200 rounded-xl card-shadow space-y-2">
          <ShieldAlert className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">No Matching Timeline Events Found</p>
          <p className="text-xs text-slate-500 font-mono">
            No timeline records match the selected filters for Case <span className="font-bold">{activeCaseId}</span>.
          </p>
          {(searchQuery || selectedSourceType !== 'ALL' || selectedEntityId !== 'ALL' || startDate || endDate || selectedCategory !== 'ALL' || evidenceOnly) && (
            <button
              onClick={handleClearFilters}
              className="mt-2 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-bold transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        /* Timeline Event List */
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
          {filteredEvents.map((ev, idx) => {
            const sourceType = (ev as any).sourceType || 'Events';
            return (
              <div key={ev.id || idx} className="relative group">
                {/* Timeline Dot */}
                <div className="absolute -left-[27px] top-1.5 w-6 h-6 rounded-full bg-white border-2 border-blue-600 flex items-center justify-center shadow-xs">
                  <div className="w-2 h-2 rounded-full bg-blue-600" />
                </div>

                {/* Event Card */}
                <div className="p-5 bg-white border border-slate-200 rounded-xl card-shadow space-y-2 hover:border-slate-300 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-200">
                        {getCategoryIcon(ev.category, sourceType)}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900">{ev.title}</h3>
                        <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">
                          Source: {sourceType}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-500 font-semibold bg-slate-50 px-2.5 py-0.5 rounded border border-slate-200">
                        {ev.timestamp}
                      </span>
                      <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                        {ev.category}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{ev.description}</p>

                  {/* Entity Chips & Evidence Badge */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                    {ev.entitiesInvolved && ev.entitiesInvolved.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-slate-400 font-medium">Involved:</span>
                        {ev.entitiesInvolved.map(entId => {
                          const entityObj = dataset.entities.find(e => e.id === entId);
                          return (
                            <button
                              key={entId}
                              onClick={() => onSelectEntity(entId)}
                              className="px-2 py-0.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded text-xs font-medium font-mono transition-colors cursor-pointer"
                            >
                              {entityObj?.name || entId}
                            </button>
                          );
                        })}
                      </div>
                    ) : <div />}

                    {ev.evidenceId && (
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[10px] font-mono font-bold">
                        Ref Evidence: {ev.evidenceId}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
