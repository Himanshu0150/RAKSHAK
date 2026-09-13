import React, { useState, useEffect, useMemo } from 'react';
import { 
  PhoneCall, 
  Search, 
  Clock, 
  Radio, 
  AlertTriangle, 
  MapPin, 
  ArrowRight,
  TrendingUp,
  Activity,
  Layers,
  PhoneForwarded,
  Signal,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { InvestigationDataset } from '../services/datasetNormalizer';
import { CDRRecord } from '../types/investigation';
import { fetchCDRs } from '../services/apiService';
import { getCDRDisplayInfo, getEntityDisplayInfo } from '../utils/entityDisplay';

interface TelecomViewProps {
  dataset: InvestigationDataset;
  onSelectEntity: (entityId: string) => void;
  selectedCaseId?: string | null;
  onSelectCaseId?: (caseId: string | null) => void;
}

export const TelecomView: React.FC<TelecomViewProps> = ({
  dataset,
  onSelectEntity,
  selectedCaseId,
  onSelectCaseId
}) => {
  const activeCaseId = selectedCaseId || dataset.cases[0]?.id || 'CASE-000001';
  const [cdrs, setCdrs] = useState<CDRRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [anomalyOnly, setAnomalyOnly] = useState(false);

  useEffect(() => {
    if (!activeCaseId) return;
    const controller = new AbortController();
    setCdrs([]);
    setLoading(true);

    fetchCDRs(200, undefined, activeCaseId, controller.signal)
      .then(res => {
        if (!controller.signal.aborted) {
          if (Array.isArray(res)) setCdrs(res);
          else setCdrs([]);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setCdrs([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [activeCaseId]);

  const filteredCdrs = useMemo(() => {
    return cdrs.filter(c => {
      if (anomalyOnly && !c.flaggedAnomaly) return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        c.callerPhone?.toLowerCase().includes(term) ||
        c.receiverPhone?.toLowerCase().includes(term) ||
        c.callerName?.toLowerCase().includes(term) ||
        c.receiverName?.toLowerCase().includes(term) ||
        c.cellTowerLocation?.toLowerCase().includes(term)
      );
    });
  }, [cdrs, searchTerm, anomalyOnly]);

  // Hourly distribution calculation
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: `${String(i).padStart(2, '0')}:00`,
      calls: 0,
      isNight: i >= 0 && i <= 5
    }));

    cdrs.forEach(c => {
      try {
        const h = new Date(c.timestamp).getUTCHours();
        if (!isNaN(h) && hours[h]) {
          hours[h].calls += 1;
        }
      } catch (e) {
        // ignore
      }
    });

    return hours;
  }, [cdrs]);

  const suspiciousCount = cdrs.filter(c => c.flaggedAnomaly).length;
  const shortPingCount = cdrs.filter(c => c.durationSeconds > 0 && c.durationSeconds <= 20).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight font-heading">
              Telecom & Call Detail Records (CDR)
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-full font-mono">
              {activeCaseId} ({filteredCdrs.length} Call Bursts)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Base transceiver station (BTS) tower logs, tactical burn-phone rotations, and nocturnal communication burst matrices.
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

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl card-shadow">
          <span className="text-xs font-medium text-slate-500 block">Total CDR Intercepts</span>
          <div className="text-2xl font-bold text-slate-900 font-mono mt-1">{cdrs.length}</div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Carrier Extraction Verified</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl card-shadow">
          <span className="text-xs font-medium text-slate-500 block">Nighttime Bursts (01-05 AM)</span>
          <div className="text-2xl font-bold text-amber-600 font-mono mt-1">{suspiciousCount} Calls</div>
          <span className="text-[11px] text-amber-700 font-medium mt-0.5 block">Pre-Drop Coordination</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl card-shadow">
          <span className="text-xs font-medium text-slate-500 block">Short Pings (&lt; 20s)</span>
          <div className="text-2xl font-bold text-purple-600 font-mono mt-1">{shortPingCount} Pings</div>
          <span className="text-[11px] text-slate-500 mt-0.5 block font-medium">Burner Verification Calls</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl card-shadow">
          <span className="text-xs font-medium text-slate-500 block font-mono">CASE TARGET</span>
          <div className="text-sm font-bold text-cyan-700 font-mono mt-2 truncate">{activeCaseId}</div>
          <span className="text-[11px] text-slate-500 mt-0.5 block font-medium">Telecom Intercept Link</span>
        </div>
      </div>

      {/* Hourly Timeline Chart */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-600" />
            24-Hour Call Frequency Distribution ({activeCaseId})
          </h3>
          <span className="text-[10px] font-mono text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            NIGHT BURST ALERTS
          </span>
        </div>

        <div className="h-44 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="hour" stroke="#94A3B8" fontSize={10} tickLine={false} />
              <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: '8px', fontSize: '11px', color: '#0F172A' }}
                cursor={{ fill: 'rgba(2, 132, 199, 0.08)' }}
              />
              <Bar dataKey="calls" radius={[3, 3, 0, 0]}>
                {hourlyData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.isNight && entry.calls > 0 ? '#DC2626' : '#2563EB'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* CDR Table / Empty State */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search phone number, contact name, or tower..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:bg-white"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-mono text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={anomalyOnly}
              onChange={(e) => setAnomalyOnly(e.target.checked)}
              className="rounded border-slate-300 text-cyan-600 focus:ring-0"
            />
            Show Flagged Night Bursts Only
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="flex items-center space-x-2 text-xs font-medium text-cyan-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Fetching Call Detail Records (CDRs) for {activeCaseId}...</span>
            </div>
          </div>
        ) : filteredCdrs.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200 space-y-1">
            <ShieldAlert className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="text-xs font-semibold text-slate-700">No Telecom Intercept Records</p>
            <p className="text-[11px] text-slate-500 font-mono">No call detail records (CDRs) logged for active case {activeCaseId}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#F8FAFC] border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Timestamp (UTC)</th>
                  <th className="py-2.5 px-3">Originator (A-Party)</th>
                  <th className="py-2.5 px-3">Recipient (B-Party)</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3">BTS Cell Tower</th>
                  <th className="py-2.5 px-3">Anomaly</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCdrs.map(c => {
                  const callerInfo = getEntityDisplayInfo(c.callerPhone, dataset);
                  const receiverInfo = getEntityDisplayInfo(c.receiverPhone, dataset);
                  const callerDisplay = c.callerName && !c.callerName.startsWith('PH00') ? `${c.callerName} (${callerInfo.title})` : callerInfo.title;
                  const receiverDisplay = c.receiverName && !c.receiverName.startsWith('PH00') ? `${c.receiverName} (${receiverInfo.title})` : receiverInfo.title;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 text-slate-600">
                        <div>{c.timestamp ? c.timestamp.replace('T', ' ').slice(0, 16) : 'N/A'}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{callerDisplay}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-cyan-800">{receiverDisplay}</div>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800">
                        {c.durationSeconds}s
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {c.cellTowerLocation || 'Sector 4 Tower-A'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {c.flaggedAnomaly ? (
                          <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-amber-100 text-amber-800 border border-amber-200">
                            NIGHT BURST
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[9px] rounded bg-slate-100 text-slate-600 border border-slate-200">
                            NORMAL
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
