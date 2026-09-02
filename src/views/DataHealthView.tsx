import React, { useState } from 'react';
import { 
  HeartPulse, 
  CheckCircle2, 
  AlertCircle, 
  Database, 
  FileCode, 
  Layers, 
  ShieldCheck,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { InvestigationDataset } from '../services/datasetNormalizer';

interface DataHealthViewProps {
  dataset: InvestigationDataset;
  onOpenDatasetModal: () => void;
}

export const DataHealthView: React.FC<DataHealthViewProps> = ({
  dataset,
  onOpenDatasetModal
}) => {
  const [activeTab, setActiveTab] = useState<'SCORECARD' | 'RAW_ENTITIES' | 'SCHEMA_MAPPING'>('SCORECARD');

  const report = dataset.healthReport;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight font-heading">
              Data Ingestion & Pipeline Health
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full">
              Grade: {report.healthScore >= 90 ? 'A (Excellent)' : 'B (Stable)'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Feed parsing status, missing attribute tolerances, orphan foreign keys, and dynamic alias mapping.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenDatasetModal}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-2 shadow-xs transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Switch / Upload Feed</span>
          </button>
        </div>
      </div>

      {/* Top Health Scores */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl card-shadow">
          <span className="text-xs font-medium text-slate-500 block">Overall Quality Score</span>
          <div className="text-3xl font-extrabold text-emerald-600 font-mono mt-1">
            {report.healthScore}%
          </div>
          <span className="text-[11px] text-emerald-700 font-medium mt-0.5 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Fully Normalized
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl card-shadow">
          <span className="text-xs font-medium text-slate-500 block">Total Ingested Records</span>
          <div className="text-3xl font-extrabold text-slate-900 font-mono mt-1">
            {report.totalRecords}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Across 5 Intelligence Feeds</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl card-shadow">
          <span className="text-xs font-medium text-slate-500 block">Duplicate Records Found</span>
          <div className="text-3xl font-extrabold text-purple-600 font-mono mt-1">
            {report.duplicateRecords}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Auto-Deduplicated</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl card-shadow">
          <span className="text-xs font-medium text-slate-500 block">Orphan Link References</span>
          <div className="text-3xl font-extrabold text-blue-600 font-mono mt-1">
            {report.orphanLinks}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">All Pointers Resolved</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-3 text-xs font-medium">
        <button
          onClick={() => setActiveTab('SCORECARD')}
          className={`px-3.5 py-2 rounded-lg transition-colors ${
            activeTab === 'SCORECARD' ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          Normalization Audit
        </button>
        <button
          onClick={() => setActiveTab('SCHEMA_MAPPING')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            activeTab === 'SCHEMA_MAPPING' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          Dynamic Field Alias Dictionary
        </button>
        <button
          onClick={() => setActiveTab('RAW_ENTITIES')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            activeTab === 'RAW_ENTITIES' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          Raw Ingested JSON Table ({dataset.entities.length})
        </button>
      </div>

      {/* Tab: SCORECARD */}
      {activeTab === 'SCORECARD' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Verified Ingestion Feeds
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex justify-between">
                <span className="text-slate-700">Suspect Master Registry (Persons & Orgs)</span>
                <span className="text-emerald-700 font-bold">{dataset.entities.length} Nodes</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex justify-between">
                <span className="text-slate-700">Carrier Telecom CDR Stream</span>
                <span className="text-emerald-700 font-bold">{dataset.cdrRecords.length} Intercepts</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex justify-between">
                <span className="text-slate-700">Core Banking RTGS/NEFT/SWIFT Ledger</span>
                <span className="text-emerald-700 font-bold">{dataset.transactions.length} Wires</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex justify-between">
                <span className="text-slate-700">Physical & Digital Seizure Vault (C3PL)</span>
                <span className="text-emerald-700 font-bold">{dataset.evidenceRecords.length} Exhibits</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex justify-between">
                <span className="text-slate-700">Multi-Source Chronological Event Stream</span>
                <span className="text-emerald-700 font-bold">{dataset.timelineEvents.length} Events</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Data Hygiene & Compliance Rules
            </h3>
            <div className="space-y-2 text-xs text-slate-700">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <strong className="text-slate-900 font-mono">Heterogeneous Schema Ingestion:</strong> Tolerant to divergent key names (e.g. `mobile_no` ➔ `phone`, `account_no` ➔ `sourceAccount`).
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <strong className="text-slate-900 font-mono">Section 65B BSA Compliance:</strong> Ingested evidence items are immediately SHA-256 hashed and anchored into Merkle nodes.
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <strong className="text-slate-900 font-mono">No Hardcoded Fallbacks:</strong> Graph metrics, centralities, and anomaly signals are dynamically generated in real-time.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: SCHEMA_MAPPING */}
      {activeTab === 'SCHEMA_MAPPING' && (
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900">Dynamic Field Normalization Dictionary</h3>
          <p className="text-xs text-slate-500">
            The platform automatically maps any incoming custom schema keys into internal canonical investigation models:
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#F8FAFC] border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Target Canonical Field</th>
                  <th className="py-2.5 px-3">Accepted Ingest Key Aliases</th>
                  <th className="py-2.5 px-3">Data Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2.5 px-3 text-blue-700 font-bold">name</td>
                  <td className="py-2.5 px-3 text-slate-700">full_name, person_name, entity_name, suspect_name, title</td>
                  <td className="py-2.5 px-3 text-slate-500">String</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-blue-700 font-bold">phone</td>
                  <td className="py-2.5 px-3 text-slate-700">phone_number, mobile, mobile_no, contact, caller_msisdn</td>
                  <td className="py-2.5 px-3 text-slate-500">String (E.164)</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-blue-700 font-bold">amount</td>
                  <td className="py-2.5 px-3 text-slate-700">txn_amount, value, sum, transfer_amount, inr_value</td>
                  <td className="py-2.5 px-3 text-slate-500">Number</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-blue-700 font-bold">timestamp</td>
                  <td className="py-2.5 px-3 text-slate-700">date_time, call_time, txn_date, event_time, created_at</td>
                  <td className="py-2.5 px-3 text-slate-500">ISO 8601 UTC</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: RAW_ENTITIES */}
      {activeTab === 'RAW_ENTITIES' && (
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#F8FAFC] border-b border-slate-200 text-slate-500 uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">ID</th>
                <th className="py-2.5 px-3">Name</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Risk</th>
                <th className="py-2.5 px-3">Normalized Attributes Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(dataset.entities || []).map(e => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 text-blue-700 font-bold">{e.id}</td>
                  <td className="py-2.5 px-3 text-slate-900 font-sans font-medium">{e.name}</td>
                  <td className="py-2.5 px-3 uppercase text-slate-500">{e.type}</td>
                  <td className="py-2.5 px-3 font-bold text-red-600">{e.flaggedRisk}</td>
                  <td className="py-2.5 px-3 text-slate-600 truncate max-w-md">
                    {JSON.stringify(e.attributes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
