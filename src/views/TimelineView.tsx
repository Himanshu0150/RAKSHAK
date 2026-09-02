import React, { useState, useEffect } from 'react';
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
  Loader2
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

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [evidenceOnly, setEvidenceOnly] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');

  useEffect(() => {
    if (!activeCaseId) return;
    const controller = new AbortController();
    setCaseEvents([]);
    setLoading(true);

    fetchTimelineEvents(200, activeCaseId, undefined, controller.signal)
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

  const filteredEvents = caseEvents
    .filter(ev => {
      if (selectedCategory !== 'ALL' && ev.category !== selectedCategory) return false;
      if (evidenceOnly && !ev.evidenceId) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortOrder === 'ASC') return a.timestamp.localeCompare(b.timestamp);
      return b.timestamp.localeCompare(a.timestamp);
    });

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'TELECOM': return <PhoneCall className="w-4 h-4 text-cyan-600" />;
      case 'FINANCIAL': return <CreditCard className="w-4 h-4 text-amber-600" />;
      case 'MOVEMENT': return <Car className="w-4 h-4 text-emerald-600" />;
      case 'SEIZURE': return <Lock className="w-4 h-4 text-purple-600" />;
      default: return <Users className="w-4 h-4 text-blue-600" />;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
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
            Chronologically synchronized call records, vehicle toll passages, banking wires, and evidence seizures.
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
            onClick={() => setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')}
            className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-700 shadow-xs transition-colors"
          >
            <span>Sort: {sortOrder === 'ASC' ? 'Oldest First' : 'Newest First'}</span>
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl card-shadow flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Channel:</span>
          {['ALL', 'TELECOM', 'FINANCIAL', 'MOVEMENT', 'SEIZURE', 'MEETING'].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${
                selectedCategory === cat
                  ? 'bg-blue-600 border-blue-600 text-white font-semibold'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
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
          <p className="text-sm font-semibold text-slate-700">No Timeline Events Found</p>
          <p className="text-xs text-slate-500 font-mono">No synchronized timeline entries recorded for active case {activeCaseId}.</p>
        </div>
      ) : (
        /* Timeline Event List */
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
          {filteredEvents.map((ev, idx) => (
            <div key={ev.id || idx} className="relative group">
              {/* Timeline Dot */}
              <div className="absolute -left-[27px] top-1.5 w-6 h-6 rounded-full bg-white border-2 border-blue-600 flex items-center justify-center shadow-xs">
                <div className="w-2 h-2 rounded-full bg-blue-600" />
              </div>

              {/* Event Card */}
              <div className="p-5 bg-white border border-slate-200 rounded-xl card-shadow space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-200">
                      {getCategoryIcon(ev.category)}
                    </div>
                    <h3 className="font-bold text-sm text-slate-900">{ev.title}</h3>
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

                {/* Entity Chips */}
                {ev.entitiesInvolved && ev.entitiesInvolved.length > 0 && (
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-medium">Involved:</span>
                    {ev.entitiesInvolved.map(entId => {
                      const entityObj = dataset.entities.find(e => e.id === entId);
                      return (
                        <button
                          key={entId}
                          onClick={() => onSelectEntity(entId)}
                          className="px-2.5 py-0.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors"
                        >
                          {entityObj?.name || entId}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
