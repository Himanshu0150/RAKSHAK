import React, { useState } from 'react';
import { 
  X, 
  UploadCloud, 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  FileCode, 
  Sparkles,
  ArrowRight,
  Layers
} from 'lucide-react';
import { 
  InvestigationDataset, 
  createPhantomLedgerDataset, 
  createIronHarborDataset, 
  parseCustomInvestigationData 
} from '../../services/datasetNormalizer';

interface DatasetUploadModalProps {
  currentDataset: InvestigationDataset;
  onSelectDataset: (dataset: InvestigationDataset) => void;
  onClose: () => void;
}

export const DatasetUploadModal: React.FC<DatasetUploadModalProps> = ({
  currentDataset,
  onSelectDataset,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'PRELOADED' | 'UPLOAD'>('PRELOADED');
  const [jsonText, setJsonText] = useState('');
  const [fileName, setFileName] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewDataset, setPreviewDataset] = useState<InvestigationDataset | null>(null);

  const phantom = createPhantomLedgerDataset();
  const ironHarbor = createIronHarborDataset();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        setJsonText(text);
        const parsed = parseCustomInvestigationData(text, file.name);
        setPreviewDataset(parsed);
        setUploadError(null);
      } catch (err: any) {
        setUploadError(err.message || 'Failed to parse JSON file');
        setPreviewDataset(null);
      }
    };
    reader.readAsText(file);
  };

  const handleApplyCustom = () => {
    if (previewDataset) {
      onSelectDataset(previewDataset);
      onClose();
    } else if (jsonText) {
      try {
        const parsed = parseCustomInvestigationData(jsonText, fileName || 'custom_input.json');
        onSelectDataset(parsed);
        onClose();
      } catch (err: any) {
        setUploadError(err.message || 'Failed to parse JSON data');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div 
        id="dataset-upload-modal"
        className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden text-slate-900"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 rounded-lg text-blue-600 border border-slate-200">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 font-heading">Dataset & Feed Switcher</h2>
              <p className="text-xs text-slate-500">Switch investigation feeds or import custom JSON telemetry data</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selector */}
        <div className="px-6 pt-4 border-b border-slate-200 flex gap-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab('PRELOADED')}
            className={`pb-3 font-semibold border-b-2 transition-colors ${
              activeTab === 'PRELOADED' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Preloaded Datasets
          </button>
          <button
            onClick={() => setActiveTab('UPLOAD')}
            className={`pb-3 font-semibold border-b-2 transition-colors ${
              activeTab === 'UPLOAD' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Import Custom JSON
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {activeTab === 'PRELOADED' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Select an active investigative feed. The entire platform (cases, CDR matrix, financial graphs, timeline, C3PL Merkle Root) adapts automatically:
              </p>

              {/* Dataset 1 */}
              <div 
                onClick={() => { onSelectDataset(phantom); onClose(); }}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  currentDataset.id === 'DS-01'
                    ? 'bg-[#152542] border-blue-500 ring-1 ring-blue-500/50'
                    : 'bg-[#121E33] border-[#223354] hover:border-[#344E7E]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-100">{phantom.name}</span>
                    <span className="px-2 py-0.5 text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-800 rounded">
                      {phantom.codeName}
                    </span>
                  </div>
                  {currentDataset.id === 'DS-01' && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      ACTIVE INGESTION
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">{phantom.description}</p>
                <div className="mt-3 flex items-center gap-4 text-xs font-mono text-slate-300 pt-2 border-t border-[#1C2C4C]">
                  <span>Entities: <strong className="text-blue-400">{phantom.entities.length}</strong></span>
                  <span>CDRs: <strong className="text-blue-400">{phantom.cdrRecords.length}</strong></span>
                  <span>Transactions: <strong className="text-blue-400">{phantom.transactions.length}</strong></span>
                  <span>Evidence: <strong className="text-blue-400">{phantom.evidenceRecords.length}</strong></span>
                  <span>Cases: <strong className="text-blue-400">{phantom.cases.length}</strong></span>
                </div>
              </div>

              {/* Dataset 2 */}
              <div 
                onClick={() => { onSelectDataset(ironHarbor); onClose(); }}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  currentDataset.id === 'DS-02'
                    ? 'bg-[#152542] border-blue-500 ring-1 ring-blue-500/50'
                    : 'bg-[#121E33] border-[#223354] hover:border-[#344E7E]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-100">{ironHarbor.name}</span>
                    <span className="px-2 py-0.5 text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800 rounded">
                      {ironHarbor.codeName}
                    </span>
                  </div>
                  {currentDataset.id === 'DS-02' && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      ACTIVE INGESTION
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">{ironHarbor.description}</p>
                <div className="mt-3 flex items-center gap-4 text-xs font-mono text-slate-300 pt-2 border-t border-[#1C2C4C]">
                  <span>Entities: <strong className="text-purple-400">{ironHarbor.entities.length}</strong></span>
                  <span>CDRs: <strong className="text-purple-400">{ironHarbor.cdrRecords.length}</strong></span>
                  <span>Transactions: <strong className="text-purple-400">{ironHarbor.transactions.length}</strong></span>
                  <span>Evidence: <strong className="text-purple-400">{ironHarbor.evidenceRecords.length}</strong></span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'UPLOAD' && (
            <div className="space-y-4">
              <div className="p-6 border-2 border-dashed border-[#2A3E66] rounded-xl bg-[#0D1524] text-center">
                <UploadCloud className="w-10 h-10 text-blue-400 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-slate-200">Drag & Drop investigation dataset (.json)</h3>
                <p className="text-xs text-slate-400 mt-1">Supports heterogeneous schemas, raw entity lists, CDR dumps, and banking files</p>
                
                <input 
                  type="file" 
                  accept=".json,.txt" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  id="file-upload-input" 
                />
                <label 
                  htmlFor="file-upload-input"
                  className="mt-3 inline-block px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg cursor-pointer transition-colors"
                >
                  Select Local File
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Or Paste Raw JSON Record Stream:
                </label>
                <textarea
                  value={jsonText}
                  onChange={(e) => {
                    setJsonText(e.target.value);
                    try {
                      const parsed = parseCustomInvestigationData(e.target.value, 'pasted_records.json');
                      setPreviewDataset(parsed);
                      setUploadError(null);
                    } catch (err: any) {
                      setUploadError('Invalid JSON structure');
                      setPreviewDataset(null);
                    }
                  }}
                  placeholder='[{"name": "Suspect Alpha", "phone": "+91-99999-00001", "type": "person", "risk": "HIGH"}]'
                  className="w-full h-32 bg-[#090F1C] border border-[#223354] rounded-lg p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              {uploadError && (
                <div className="p-3 bg-red-950/60 border border-red-800 rounded-lg flex items-center gap-2 text-xs text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {previewDataset && (
                <div className="p-3 bg-[#132038] border border-[#233556] rounded-lg text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    Schema Normalized Successfully!
                  </div>
                  <p className="text-slate-300">
                    Detected: <strong className="text-blue-400">{previewDataset.entities.length}</strong> entities, <strong className="text-blue-400">{previewDataset.cdrRecords.length}</strong> CDRs, <strong className="text-blue-400">{previewDataset.transactions.length}</strong> transactions.
                  </p>
                </div>
              )}

              <button
                onClick={handleApplyCustom}
                disabled={!previewDataset}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 font-semibold text-xs text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Ingest & Re-Calculate Dynamic Workspace
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
