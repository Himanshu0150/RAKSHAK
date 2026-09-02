import React from 'react';
import { 
  X, 
  Bell, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  PhoneCall, 
  CreditCard,
  Clock
} from 'lucide-react';
import { AnomalySignal } from '../../types/investigation';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  anomalies: AnomalySignal[];
  tamperAlert: boolean;
  onNavigateToAnomalies: () => void;
  onNavigateToVault: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  anomalies,
  tamperAlert,
  onNavigateToAnomalies,
  onNavigateToVault
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
      <div 
        id="notification-drawer"
        className="w-full max-w-md bg-white border-l border-slate-200 h-full shadow-2xl flex flex-col text-slate-900 animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Bell className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-900 font-heading">Live Intelligence Notifications</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {tamperAlert && (
            <div 
              onClick={() => { onNavigateToVault(); onClose(); }}
              className="p-3.5 bg-red-50 border border-red-200 rounded-xl cursor-pointer hover:bg-red-100/80 transition-colors"
            >
              <div className="flex items-center gap-2 text-red-700 font-bold text-xs">
                <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                <span>INTEGRITY VIOLATION DETECTED</span>
              </div>
              <p className="text-xs text-red-700 mt-1 leading-relaxed">
                C3PL Merkle Root fingerprint mismatch detected. Evidence block leaf modified. Click to inspect vault.
              </p>
            </div>
          )}

          {(anomalies || []).map(anom => (
            <div
              key={anom.id}
              onClick={() => { onNavigateToAnomalies(); onClose(); }}
              className="p-3.5 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors card-shadow space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                  anom.severity === 'CRITICAL' 
                    ? 'bg-red-50 text-red-700 border-red-200' 
                    : anom.severity === 'HIGH'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  {anom.category} • {anom.severity}
                </span>
                <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {anom.detectedAt && anom.detectedAt.length >= 16 ? anom.detectedAt.slice(11, 16) : String(anom.detectedAt || '00:00')} UTC
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-900">{anom.title}</h4>
              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{anom.description}</p>
            </div>
          ))}

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1 font-mono">
            <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              SYSTEM STATUS: OPTIMAL
            </div>
            <div>• All ingest pipelines synchronized</div>
            <div>• C3PL Merkle integrity cycle: PASS</div>
            <div>• Disambiguation scoring: LIVE AUTO-REFRESH</div>
          </div>
        </div>
      </div>
    </div>
  );
};

