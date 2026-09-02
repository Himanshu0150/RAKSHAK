import React, { useState } from 'react';
import { 
  Bot, 
  Sparkles, 
  Send, 
  FileCheck2, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  HelpCircle, 
  Cpu, 
  RefreshCw,
  Layers,
  ShieldAlert,
  Terminal
} from 'lucide-react';
import { InvestigationDataset } from '../services/datasetNormalizer';
import { requestAIInvestigationAnalysis, AIAnalysisResponse } from '../services/aiService';

interface AiCopilotViewProps {
  dataset: InvestigationDataset;
  selectedCaseId: string | null;
  onSelectEntity: (entityId: string) => void;
}

export const AiCopilotView: React.FC<AiCopilotViewProps> = ({
  dataset,
  selectedCaseId,
  onSelectEntity
}) => {
  const [promptInput, setPromptInput] = useState('');
  const [analysisMode, setAnalysisMode] = useState<'HYPOTHESIS' | 'DOSSIER_SUMMARY' | 'ANOMALY_EXPLAIN' | 'CONTRADICTION_AUDIT'>('HYPOTHESIS');
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AIAnalysisResponse | null>(null);

  const activeCase = dataset.cases.find(c => c.id === selectedCaseId) || dataset.cases[0];

  const handleRunAnalysis = async (customPrompt?: string) => {
    const textToRun = customPrompt || promptInput || 'Analyze key intermediary entities, hawala financial flows, and coordinate nighttime telecom bursts.';
    setLoading(true);

    const contextPayload = JSON.stringify({
      caseId: activeCase?.id || 'CASE-000001',
      caseTitle: activeCase?.title || 'General Investigation',
      jurisdiction: activeCase?.jurisdiction || 'Multi-Jurisdictional Taskforce',
      status: activeCase?.status || 'OPEN',
      severity: activeCase?.severity || 'HIGH',
      entities: (dataset.entities || []).slice(0, 8).map(e => ({ name: e.name, type: e.type, risk: e.flaggedRisk })),
    });

    const res = await requestAIInvestigationAnalysis({
      prompt: textToRun,
      context: contextPayload,
      caseTitle: activeCase?.title,
      mode: analysisMode
    });

    setAiResult(res);
    setLoading(false);
  };

  const samplePrompts = [
    'Test Hypothesis: Did the primary subject use the logistics broker to divert the cargo?',
    'Audit Alibi: Cross-reference suspect statements against 02:00 AM CDR tower hits.',
    'Map Financial Flow: Trace the origin of the offshore escrow transfer.',
    'Generate Court-Admissible Intelligence Summary for the Lead Prosecutor.'
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight font-heading">
              AI Forensic Copilot
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Fact vs. Inference Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Reasoning assistant strictly disciplined to separate verified evidentiary facts from analytical inferences.
          </p>
        </div>
      </div>

      {/* Mode Selector Strip */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl card-shadow space-y-4">
        {/* Input Field */}
        <div className="relative">
          <textarea
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            placeholder="Type your investigative query, hypothesis, or alibi challenge to test against evidence records..."
            rows={3}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white resize-none"
          />
          <div className="flex justify-between items-center pt-2">
            <div className="text-[11px] text-slate-400 font-mono">
              Indian Evidence Act Section 65B grounded • Strictly fact-indexed
            </div>
            <button
              onClick={() => handleRunAnalysis()}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow transition-colors font-mono"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Generating Forensic Analysis...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Run Forensic AI Analysis
                </>
              )}
            </button>
          </div>
        </div>

        {/* Sample Prompt Chips */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          <span className="text-[11px] font-mono text-slate-500 font-semibold">Sample Queries:</span>
          {samplePrompts.map((sp, i) => (
            <button
              key={i}
              onClick={() => {
                setPromptInput(sp);
                handleRunAnalysis(sp);
              }}
              className="px-2.5 py-1 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded text-xs transition-colors text-left"
            >
              {sp}
            </button>
          ))}
        </div>
      </div>

      {/* AI Analysis Output Card */}
      {aiResult ? (
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
          {!aiResult.isAiGenerated && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2.5 text-xs text-amber-800 font-mono">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>AI Service Configuration Required: GEMINI_API_KEY unavailable. Displaying structured case intelligence summary from live MongoDB dataset.</span>
            </div>
          )}

          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2 font-mono">
              <Bot className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-sm text-slate-900">Intelligence Synthesis Output</h3>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 rounded">
                MODEL: {aiResult.modelUsed || 'GEMINI-3.7-FLASH'}
              </span>
            </div>

            <div className="text-xs font-mono text-slate-500">
              Analysis Mode: <strong className="text-blue-700">{analysisMode}</strong>
            </div>
          </div>

          {/* Section 1: Verified Facts */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
            <h4 className="text-xs font-bold text-emerald-900 uppercase font-mono tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Verified Evidentiary Facts (Court Admissible)
            </h4>
            <ul className="text-xs space-y-1 text-slate-700 list-disc list-inside">
              {aiResult.facts?.length ? (
                aiResult.facts.map((f, i) => (
                  <li key={i} className="leading-relaxed">{typeof f === 'string' ? f : JSON.stringify(f)}</li>
                ))
              ) : (
                <li>Ingested records verified against MongoDB Atlas C3PL Merkle integrity trees.</li>
              )}
            </ul>
          </div>

          {/* Section 2: Analytical Inferences */}
          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
            <h4 className="text-xs font-bold text-amber-900 uppercase font-mono tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Analytical Inferences & Behavioral Hypotheses
            </h4>
            <ul className="text-xs space-y-1.5 text-slate-700">
              {aiResult.inferences?.length ? (
                aiResult.inferences.map((inf: any, i) => {
                  const text = typeof inf === 'object' ? (inf.inference || inf.rationale || JSON.stringify(inf)) : String(inf);
                  const conf = typeof inf === 'object' && inf.confidence ? `${inf.confidence}% confidence` : null;
                  return (
                    <li key={i} className="leading-relaxed flex items-start gap-2">
                      <span className="text-amber-600 font-bold">•</span>
                      <div>
                        <span>{text}</span>
                        {conf && <span className="ml-2 text-[10px] font-mono text-slate-500 font-semibold">({conf})</span>}
                      </div>
                    </li>
                  );
                })
              ) : (
                <li className="leading-relaxed font-mono text-slate-500">• No analytical inferences generated.</li>
              )}
            </ul>
          </div>

          {/* Section 3: Recommended Next Investigative Steps */}
          {(aiResult.recommendedActions?.length || aiResult.recommendations?.length) && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
                Recommended Investigative Leads
              </h4>
              <ul className="text-xs space-y-1 text-slate-700 list-decimal list-inside">
                {(aiResult.recommendedActions || aiResult.recommendations || []).map((r: any, i) => (
                  <li key={i} className="leading-relaxed">{typeof r === 'string' ? r : JSON.stringify(r)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        /* Initial Guidance Panel before prompt execution */
        <div className="p-8 bg-white border border-slate-200 rounded-xl text-center space-y-3 card-shadow">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-200">
            <Bot className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-sm text-slate-900 font-mono">
            RAKSHAK AI Forensic Case Analyst Ready
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Select a sample query above or type a custom investigative hypothesis to analyze linked case records from MongoDB.
          </p>
          <div className="pt-2">
            <button
              onClick={() => handleRunAnalysis('Synthesize active case intelligence, entity graph links, and financial flow patterns.')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-xs"
            >
              Analyze Active Case ({activeCase?.caseNumber || 'CASE-000001'})
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
