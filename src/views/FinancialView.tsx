import React, { useState, useEffect, useMemo } from 'react';
import { 
  CreditCard, 
  Search, 
  DollarSign, 
  AlertTriangle, 
  ArrowRight, 
  Repeat, 
  CheckCircle2, 
  Building2,
  TrendingDown,
  Layers,
  Download,
  Filter,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { InvestigationDataset } from '../services/datasetNormalizer';
import { FinancialTransaction } from '../types/investigation';
import { fetchTransactions } from '../services/apiService';

interface FinancialViewProps {
  dataset: InvestigationDataset;
  onSelectEntity: (entityId: string) => void;
  selectedCaseId?: string | null;
  onSelectCaseId?: (caseId: string | null) => void;
}

export const FinancialView: React.FC<FinancialViewProps> = ({
  dataset,
  onSelectEntity,
  selectedCaseId,
  onSelectCaseId
}) => {
  const activeCaseId = selectedCaseId || dataset.cases[0]?.id || 'CASE-000001';
  const [txns, setTxns] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [suspiciousOnly, setSuspiciousOnly] = useState(false);

  useEffect(() => {
    if (!activeCaseId) return;
    const controller = new AbortController();
    setTxns([]);
    setLoading(true);

    fetchTransactions(200, undefined, activeCaseId, controller.signal)
      .then(res => {
        if (!controller.signal.aborted) {
          if (Array.isArray(res)) setTxns(res);
          else setTxns([]);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setTxns([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [activeCaseId]);

  const totalVolume = txns.reduce((sum, t) => sum + (t.amount || 0), 0);
  const suspiciousCount = txns.filter(t => t.flaggedStructuring || t.flaggedLayering).length;

  const filteredTxns = useMemo(() => {
    return txns.filter(t => {
      if (suspiciousOnly && !t.flaggedStructuring && !t.flaggedLayering) return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        t.sourceAccount?.toLowerCase().includes(term) ||
        t.targetAccount?.toLowerCase().includes(term) ||
        t.sourceOwnerName?.toLowerCase().includes(term) ||
        t.targetOwnerName?.toLowerCase().includes(term) ||
        t.bankName?.toLowerCase().includes(term)
      );
    });
  }, [txns, searchTerm, suspiciousOnly]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight font-heading">
              Financial Intel (AML)
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 rounded-full font-mono">
              {activeCaseId} ({filteredTxns.length} Ledger Hops)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Fund layering, circular flow cycles, sub-threshold structuring, and offshore escrow settlement tracking.
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
          <span className="text-xs font-medium text-slate-500 block">Total Ledger Volume</span>
          <div className="text-2xl font-bold text-slate-900 font-mono mt-1">
            ₹{totalVolume ? (totalVolume / 100000).toFixed(2) + 'L' : '0.00'}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Extracted Case Volume</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl card-shadow">
          <span className="text-xs font-medium text-slate-500 block">Layering & Hawala Wires</span>
          <div className="text-2xl font-bold text-red-600 font-mono mt-1">{suspiciousCount} Txns</div>
          <span className="text-[11px] text-red-700 font-medium mt-0.5 block">Rapid Fund Hop</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl card-shadow">
          <span className="text-xs font-medium text-slate-500 block">Structuring Alerts</span>
          <div className="text-2xl font-bold text-purple-600 font-mono mt-1">
            {txns.filter(t => t.flaggedStructuring).length} Txns
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block font-medium">Sub-threshold Cash</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl card-shadow">
          <span className="text-xs font-medium text-slate-500 block">Layering Wires</span>
          <div className="text-2xl font-bold text-emerald-600 font-mono mt-1">
            {txns.filter(t => t.flaggedLayering).length} Txns
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block font-medium">High Volume Hop</span>
        </div>
      </div>

      {/* Transactions Table / Empty State */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search account, owner, or bank..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-mono text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={suspiciousOnly}
              onChange={(e) => setSuspiciousOnly(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-0"
            />
            Show Flagged Layering & Structuring Only
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="flex items-center space-x-2 text-xs font-medium text-blue-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Fetching financial transactions for {activeCaseId}...</span>
            </div>
          </div>
        ) : filteredTxns.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200 space-y-1">
            <ShieldAlert className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="text-xs font-semibold text-slate-700">No linked financial data available</p>
            <p className="text-[11px] text-slate-500 font-mono">No banking wires or AML transactions recorded for active case {activeCaseId}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] border-b border-slate-200 font-mono text-slate-500 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Timestamp (UTC)</th>
                  <th className="py-2.5 px-3">Source / Debtor Account</th>
                  <th className="py-2.5 px-3">Target / Creditor Account</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Type / Channel</th>
                  <th className="py-2.5 px-3">AML Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredTxns.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 text-slate-600">{tx.timestamp}</td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{tx.sourceOwnerName || 'Unknown Entity'}</div>
                      <div className="text-[11px] text-slate-500">{tx.sourceAccount} ({tx.bankName || 'Bank'})</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{tx.targetOwnerName || 'Unknown Beneficiary'}</div>
                      <div className="text-[11px] text-blue-700">{tx.targetAccount}</div>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900 text-sm">
                      {tx.currency || '₹'} {Number(tx.amount || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{tx.txnType || tx.transactionType}</td>
                    <td className="py-3 px-3">
                      {tx.flaggedLayering ? (
                        <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-red-100 text-red-700 border border-red-200">
                          RAPID LAYERING
                        </span>
                      ) : tx.flaggedStructuring ? (
                        <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-amber-100 text-amber-800 border border-amber-200">
                          STRUCTURING
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[9px] rounded bg-slate-100 text-slate-600 border border-slate-200">
                          CLEARED
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
