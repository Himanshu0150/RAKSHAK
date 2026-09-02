import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  ShieldAlert, 
  Clock, 
  MapPin, 
  CreditCard, 
  PhoneCall, 
  ArrowRight,
  Filter,
  CheckCircle2,
  Zap,
  Target,
  RefreshCw
} from 'lucide-react';
import { InvestigationDataset } from '../services/datasetNormalizer';
import { AnomalySignal } from '../types/investigation';
import { fetchAnomalies } from '../services/apiService';

interface AnomalyRadarViewProps {
  dataset: InvestigationDataset;
  onSelectEntity: (entityId: string) => void;
  selectedCaseId?: string | null;
  onSelectCaseId?: (caseId: string | null) => void;
}

export const AnomalyRadarView: React.FC<AnomalyRadarViewProps> = ({
  dataset,
  onSelectEntity,
  selectedCaseId,
  onSelectCaseId
}) => {
  const activeCaseId = selectedCaseId || dataset.cases[0]?.id || 'CASE-000001';
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [anomalies, setAnomalies] = useState<AnomalySignal[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const controller = new AbortController();
    setAnomalies([]);
    setLoading(true);

    fetchAnomalies(200, activeCaseId || undefined, selectedCategory, selectedSeverity, controller.signal)
      .then(data => {
        if (!controller.signal.aborted) {
          setAnomalies(data || []);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setAnomalies([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [activeCaseId, selectedSeverity, selectedCategory]);

  const filtered = anomalies;

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'TELECOM': return <PhoneCall className="w-4 h-4 text-cyan-600" />;
      case 'FINANCIAL': return <CreditCard className="w-4 h-4 text-amber-600" />;
      case 'BEHAVIORAL': return <Activity className="w-4 h-4 text-purple-600" />;
      case 'GEOGRAPHIC': return <MapPin className="w-4 h-4 text-rose-600" />;
      default: return <Clock className="w-4 h-4 text-blue-600" />;
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 border border-red-300 rounded font-mono">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300 rounded font-mono">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-300 rounded font-mono">MEDIUM</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 rounded font-mono">LOW</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight font-heading">
              Behavioral & Anomaly Radar
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-red-50 text-red-700 border border-red-200 rounded-full flex items-center gap-1 font-mono">
              {activeCaseId} • {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : `${filtered.length} Active Signals`}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Deterministic anomaly scoring across cell tower bursts, fast-money escrow hopping, and contradictory identity claims.
          </p>
        </div>

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
      </div>

      {/* Filter strip */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl card-shadow flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Severity Tier:</span>
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(sev => (
            <button
              key={sev}
              onClick={() => setSelectedSeverity(sev)}
              className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${
                selectedSeverity === sev
                  ? 'bg-blue-600 border-blue-600 text-white font-semibold'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Category:</span>
          {['ALL', 'TELECOM', 'FINANCIAL', 'BEHAVIORAL', 'GEOGRAPHIC'].map(cat => (
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
      </div>

      {/* Anomaly Signal Cards Grid / Empty State */}
      {filtered.length === 0 && !loading ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-xl card-shadow space-y-3">
          <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700 font-heading">No Matching Anomaly Signals Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No anomaly signals match the selected severity filter ({selectedSeverity}) and category filter ({selectedCategory}).
          </p>
          <button
            onClick={() => { setSelectedSeverity('ALL'); setSelectedCategory('ALL'); }}
            className="px-3.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-semibold"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(anom => (
            <div key={anom.id} className="p-5 bg-white border border-slate-200 rounded-xl card-shadow space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {getCategoryIcon(anom.category)}
                  <span className="text-[11px] font-bold text-slate-500 font-mono tracking-wide uppercase">
                    {anom.category}
                  </span>
                </div>
                {getSeverityBadge(anom.severity)}
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 font-heading">{anom.title}</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{anom.description}</p>
              </div>

              {anom.recommendedAction && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <span className="font-bold text-slate-800 font-mono block text-[11px]">
                    Recommended Action:
                  </span>
                  <p className="text-slate-600 mt-0.5">{anom.recommendedAction}</p>
                </div>
              )}

              {/* Linked Entity Badges */}
              {anom.entities && anom.entities.length > 0 && (
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <span>Target Node:</span>
                    {anom.entities.map(eid => {
                      const ent = dataset.entities.find(e => e.id === eid);
                      return (
                        <button
                          key={eid}
                          onClick={() => onSelectEntity(eid)}
                          className="font-semibold text-blue-700 hover:underline"
                        >
                          {ent?.name || eid}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => {
                      if (anom.entities && anom.entities[0]) {
                        onSelectEntity(anom.entities[0]);
                      }
                    }}
                    className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    Open Dossier <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
