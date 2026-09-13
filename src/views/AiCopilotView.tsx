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
  Terminal,
  ExternalLink,
  Info,
  XCircle
} from 'lucide-react';
import { InvestigationDataset } from '../services/datasetNormalizer';
import { 
  requestAIInvestigationAnalysis, 
  AIAnalysisResponse 
} from '../services/aiService';
import { 
  SourceRecordRef, 
  FactItem, 
  InferenceItem, 
  ActionItem, 
  ContradictionItem 
} from '../types/investigation';
import { getEntityDisplayInfo, getCaseDisplayInfo } from '../utils/entityDisplay';

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
  const [analysisMode, setAnalysisMode] = useState<'HYPOTHESIS' | 'DOSSIER_SUMMARY' | 'ANOMALY_EXPLAIN' | 'CONTRADICTION_AUDIT' | 'CHAT'>('HYPOTHESIS');
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
      entities: (dataset.entities || []).slice(0, 8).map(e => ({ id: e.id, name: e.name, type: e.type, risk: e.flaggedRisk })),
    });

    const res = await requestAIInvestigationAnalysis({
      prompt: textToRun,
      context: contextPayload,
      caseTitle: activeCase?.title,
      case_id: activeCase?.id || 'CASE-000001',
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

  const handleSourceClick = (rec: SourceRecordRef) => {
    // If the record_id matches an existing entity, open it directly
    const targetEntity = dataset.entities.find(e => e.id === rec.record_id);
    if (targetEntity) {
      onSelectEntity(rec.record_id);
      return;
    }

    // Check if CDR has linked phone/person
    if (rec.record_type === 'cdr') {
      const cdrItem = dataset.cdrRecords.find(c => c.id === rec.record_id);
      if (cdrItem) {
        const linkedPhone = dataset.entities.find(e => e.id === cdrItem.callerPhone || e.name === cdrItem.callerPhone || e.id === cdrItem.receiverPhone);
        if (linkedPhone) {
          onSelectEntity(linkedPhone.id);
          return;
        }
      }
    }

    // Check if Transaction has linked account/person
    if (rec.record_type === 'transaction') {
      const txnItem = dataset.transactions.find(t => t.id === rec.record_id);
      if (txnItem) {
        const linkedAccount = dataset.entities.find(e => e.id === txnItem.sourceAccount || e.id === txnItem.targetAccount);
        if (linkedAccount) {
          onSelectEntity(linkedAccount.id);
          return;
        }
      }
    }

    // Default fallback to entity or first entity in dataset
    if (dataset.entities.length > 0) {
      onSelectEntity(dataset.entities[0].id);
    }
  };

  const renderSourceBadges = (records?: SourceRecordRef[]) => {
    if (!records || records.length === 0) return null;
    return (
      <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
        <span className="text-[10px] font-mono text-slate-400 font-semibold uppercase">Supporting Records:</span>
        {records.map((rec, idx) => {
          const typeLabel = (rec.record_type || 'RECORD').toUpperCase();
          const info = getEntityDisplayInfo(rec.record_id, dataset);
          const displayLabel = info.title && info.title !== 'Unknown Entity' ? info.title : 'Investigation Record';
          return (
            <button
              key={idx}
              onClick={() => handleSourceClick(rec)}
              title={rec.summary || `${typeLabel} record — Click to view`}
              className="px-2 py-0.5 bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-800 border border-slate-200 hover:border-blue-300 rounded font-mono text-[10px] flex items-center gap-1 transition-colors group cursor-pointer"
            >
              <span className="font-bold text-blue-600">{typeLabel}:</span>
              <span className="font-semibold underline decoration-dotted">{displayLabel}</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
            </button>
          );
        })}
      </div>
    );
  };

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
          <p className="text-xs text-slate-500 font-medium mt-1">
            LLM intelligence synthesis, Merkled court fact extraction & hypothesis generation.
          </p>
        </div>
      </div>

      {/* Query Bar */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl card-shadow space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-sm text-slate-900 font-mono">TARGET SCOPE:</span>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-800 text-xs font-bold rounded border border-slate-200 font-mono">
              {getCaseDisplayInfo(activeCase, dataset).title}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={analysisMode}
              onChange={(e) => setAnalysisMode(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 font-mono focus:outline-none"
            >
              <option value="HYPOTHESIS">Hypothesis Testing</option>
              <option value="DOSSIER_SUMMARY">Dossier Summary</option>
              <option value="ANOMALY_EXPLAIN">Anomaly Explanation</option>
              <option value="CONTRADICTION_AUDIT">Contradiction Audit</option>
            </select>

            <button
              onClick={() => handleRunAnalysis()}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow transition-colors font-mono cursor-pointer"
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

        <div className="relative">
          <textarea
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            placeholder="Type your investigative query, hypothesis, or alibi challenge to test against active case records..."
            rows={3}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white resize-none font-mono"
          />
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
              className="px-2.5 py-1 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded text-xs transition-colors text-left font-mono cursor-pointer"
            >
              {sp}
            </button>
          ))}
        </div>
      </div>

      {/* AI Analysis Output Card */}
      {aiResult ? (
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-5">
          {!aiResult.isAiGenerated && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2.5 text-xs text-amber-800 font-mono">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>AI Service Configuration Notice: Displaying grounded forensic assessment generated from active case records in MongoDB.</span>
            </div>
          )}

          {/* Header Status Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-sm text-slate-900">Intelligence Synthesis Output</h3>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 rounded">
                MODEL: {aiResult.modelUsed || 'GEMINI-3.7-FLASH'}
              </span>
              {aiResult.case_id && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 rounded">
                  CASE: {getCaseDisplayInfo(aiResult.case_id, dataset).title}
                </span>
              )}
            </div>

            <div className="text-xs font-mono text-slate-500">
              Analysis Mode: <strong className="text-blue-700">{analysisMode}</strong>
            </div>
          </div>

          {/* Section 1: Verified Evidentiary Facts */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-emerald-900 uppercase font-mono tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Verified Evidentiary Facts (Court Admissible Grounded Facts)
            </h4>
            <div className="space-y-3">
              {aiResult.facts?.length ? (
                aiResult.facts.map((f, i) => {
                  const factText = typeof f === 'string' ? f : f.fact;
                  const records = typeof f === 'object' ? f.supporting_records : undefined;
                  return (
                    <div key={i} className="p-2.5 bg-white/80 border border-emerald-100 rounded-lg text-xs space-y-1">
                      <div className="text-slate-800 leading-relaxed font-sans">
                        <strong className="text-emerald-800 font-mono mr-1">FACT #{i+1}:</strong>
                        {factText}
                      </div>
                      {renderSourceBadges(records)}
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-emerald-800 font-mono">
                  • Ingested records verified against MongoDB Atlas C3PL Merkle integrity trees for {activeCase?.id}.
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Analytical Inferences & Behavioral Hypotheses */}
          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-amber-900 uppercase font-mono tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Analytical Inferences & Behavioral Hypotheses
            </h4>
            <div className="space-y-3">
              {aiResult.inferences?.length ? (
                aiResult.inferences.map((inf: InferenceItem, i) => (
                  <div key={i} className="p-3 bg-white/80 border border-amber-100 rounded-lg text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-amber-900 font-mono">HYPOTHESIS #{i+1}</span>
                      {inf.confidence && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-mono font-bold">
                          {inf.confidence}% Analytical Confidence
                        </span>
                      )}
                    </div>
                    <div className="text-slate-800 font-medium leading-relaxed">
                      {inf.inference}
                    </div>
                    {inf.rationale && (
                      <div className="text-[11px] text-slate-500 font-mono bg-slate-50 p-2 rounded border border-slate-100">
                        <strong>Rationale:</strong> {inf.rationale}
                      </div>
                    )}
                    {renderSourceBadges(inf.supporting_records)}
                    {inf.contradicting_records && inf.contradicting_records.length > 0 && (
                      <div className="pt-1">
                        <span className="text-[10px] font-mono text-rose-600 font-semibold">CONTRADICTING RECORDS:</span>
                        {renderSourceBadges(inf.contradicting_records)}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-xs text-amber-800 font-mono">• No analytical inferences generated.</div>
              )}
            </div>
          </div>

          {/* Section 3: Contradicting Evidence & Discrepancy Audit */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600" />
              Contradicting Evidence & Discrepancy Audit
            </h4>
            {aiResult.contradictions?.length ? (
              <div className="space-y-2 pt-1">
                {aiResult.contradictions.map((con: ContradictionItem, i) => (
                  <div key={i} className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs space-y-1">
                    <div className="text-slate-800">{con.contradiction}</div>
                    {renderSourceBadges(con.supporting_records)}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-600 font-mono">
                {aiResult.contradictionSummary || 'No contradicting record identified in the available case context.'}
              </p>
            )}
          </div>

          {/* Section 4: Recommended Investigative Leads */}
          {(aiResult.recommendedActions?.length || 0) > 0 && (
            <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-blue-900 uppercase font-mono tracking-wider flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-blue-600" />
                Recommended Investigative Leads & Actions
              </h4>
              <div className="space-y-2">
                {aiResult.recommendedActions.map((act: any, i) => {
                  const actionText = typeof act === 'string' ? act : act.action;
                  const records = typeof act === 'object' ? act.supporting_records : undefined;
                  return (
                    <div key={i} className="p-2.5 bg-white/80 border border-blue-100 rounded-lg text-xs space-y-1">
                      <div className="text-slate-800 leading-relaxed font-sans">
                        <strong className="text-blue-800 font-mono mr-1">ACTION #{i+1}:</strong>
                        {actionText}
                      </div>
                      {renderSourceBadges(records)}
                    </div>
                  );
                })}
              </div>
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
            RAKSHAK AI Forensic Case Analyst Ready ({activeCase?.caseNumber || 'CASE-000001'})
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Select a sample query above or type a custom investigative hypothesis to analyze linked case records from MongoDB with complete evidence traceability.
          </p>
          <div className="pt-2">
            <button
              onClick={() => handleRunAnalysis('Synthesize active case intelligence, entity graph links, and financial flow patterns.')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-xs font-mono cursor-pointer"
            >
              Analyze Active Case ({activeCase?.caseNumber || 'CASE-000001'})
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
