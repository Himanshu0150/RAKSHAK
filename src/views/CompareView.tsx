import React, { useState, useEffect, useMemo } from 'react';
import { 
  GitCompare, 
  ShieldCheck, 
  ShieldAlert, 
  HelpCircle, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ArrowRight,
  Sparkles,
  Layers,
  Scale,
  Loader2,
  FileText,
  Network,
  PhoneCall,
  Briefcase
} from 'lucide-react';
import { InvestigationDataset } from '../services/datasetNormalizer';
import { disambiguateEntityPair } from '../services/disambiguationEngine';
import { fetchEntityDossier } from '../services/apiService';
import { getEntityDisplayInfo } from '../utils/entityDisplay';

interface CompareViewProps {
  dataset: InvestigationDataset;
  preselectedEntityIdA?: string | null;
  preselectedEntityIdB?: string | null;
  selectedCaseId?: string | null;
  onSelectEntity: (entityId: string) => void;
}

export const CompareView: React.FC<CompareViewProps> = ({
  dataset,
  preselectedEntityIdA,
  preselectedEntityIdB,
  selectedCaseId,
  onSelectEntity
}) => {
  const [selectedIdA, setSelectedIdA] = useState<string>(
    preselectedEntityIdA || dataset.entities[0]?.id || 'PERSON-000009'
  );
  const [selectedIdB, setSelectedIdB] = useState<string>(
    preselectedEntityIdB || dataset.entities[1]?.id || 'PHONE-007568'
  );

  const [dossierA, setDossierA] = useState<any | null>(null);
  const [loadingA, setLoadingA] = useState<boolean>(false);

  const [dossierB, setDossierB] = useState<any | null>(null);
  const [loadingB, setLoadingB] = useState<boolean>(false);

  // Fetch Subject A's actual MongoDB data independently
  useEffect(() => {
    if (!selectedIdA) return;
    const controller = new AbortController();
    setDossierA(null);
    setLoadingA(true);

    fetchEntityDossier(selectedIdA, selectedCaseId || undefined, controller.signal)
      .then(res => {
        if (!controller.signal.aborted) setDossierA(res);
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          console.error('Failed to fetch dossier A:', err);
          setDossierA(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingA(false);
      });

    return () => {
      controller.abort();
    };
  }, [selectedIdA, selectedCaseId]);

  // Fetch Subject B's actual MongoDB data independently
  useEffect(() => {
    if (!selectedIdB) return;
    const controller = new AbortController();
    setDossierB(null);
    setLoadingB(true);

    fetchEntityDossier(selectedIdB, selectedCaseId || undefined, controller.signal)
      .then(res => {
        if (!controller.signal.aborted) setDossierB(res);
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          console.error('Failed to fetch dossier B:', err);
          setDossierB(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingB(false);
      });

    return () => {
      controller.abort();
    };
  }, [selectedIdB, selectedCaseId]);

  const entityA = useMemo(() => {
    if (dossierA?.entity) return dossierA.entity;
    return dataset.entities.find(e => e.id === selectedIdA) || { id: selectedIdA, name: selectedIdA, type: selectedIdA.split('-')[0] || 'ENTITY', flaggedRisk: 'MEDIUM' };
  }, [dossierA, dataset.entities, selectedIdA]);

  const entityB = useMemo(() => {
    if (dossierB?.entity) return dossierB.entity;
    return dataset.entities.find(e => e.id === selectedIdB) || { id: selectedIdB, name: selectedIdB, type: selectedIdB.split('-')[0] || 'ENTITY', flaggedRisk: 'MEDIUM' };
  }, [dossierB, dataset.entities, selectedIdB]);

  // Calculate Subject A's independent confidence / evidence strength
  const confidenceScoreA = useMemo(() => {
    if (!dossierA) return 50;
    const evCount = dossierA.evidence?.length || 0;
    const relCount = dossierA.relationships?.length || 0;
    const caseCount = dossierA.cases?.length || 0;
    return Math.min(99, Math.max(30, Math.round(45 + (evCount * 6) + (relCount * 0.5) + (caseCount * 2))));
  }, [dossierA]);

  // Calculate Subject B's independent confidence / evidence strength
  const confidenceScoreB = useMemo(() => {
    if (!dossierB) return 50;
    const evCount = dossierB.evidence?.length || 0;
    const relCount = dossierB.relationships?.length || 0;
    const caseCount = dossierB.cases?.length || 0;
    return Math.min(99, Math.max(30, Math.round(45 + (evCount * 6) + (relCount * 0.5) + (caseCount * 2))));
  }, [dossierB]);

  // Pairwise Disambiguation Verdict
  const disambiguationResult = useMemo(() => {
    if (!entityA || !entityB) return null;

    if (selectedIdA === selectedIdB) {
      return {
        classification: 'DEFINITE_MATCH',
        confidence: 100,
        explanation: 'Identical entity reference selected for both Subject A and Subject B.'
      };
    }

    // Evaluate shared CDRs from fetched dossiers
    const cdrsA = dossierA?.cdrs || [];
    const baseDisambig = disambiguateEntityPair(entityA, entityB, cdrsA);

    // Check direct relationship between A and B in dossierA or dossierB
    const relsA = dossierA?.relationships || [];
    const directRel = relsA.find((r: any) => 
      (r.source_entity_id === selectedIdB || r.target_entity_id === selectedIdB)
    );

    if (directRel) {
      return {
        classification: 'PROBABLE_MATCH',
        confidence: Math.max(baseDisambig.confidence, 88),
        explanation: `Direct verified relationship (${directRel.relationship_type || 'LINKED'}) recorded between ${entityA.name} and ${entityB.name} in MongoDB.`
      };
    }

    return baseDisambig;
  }, [selectedIdA, selectedIdB, entityA, entityB, dossierA, dossierB]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight font-heading">
            Pairwise Entity Comparison
          </h1>
          <span className="px-2.5 py-0.5 text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 rounded-full font-mono">
            Disambiguation Matrix
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Strict judicial entity resolution. Evaluate independent MongoDB evidence strength, CDR overlaps, and attribute claims.
        </p>
      </div>

      {/* Selector Strip */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl card-shadow space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Entity A Selector */}
          <div>
            <label className="block text-xs font-semibold text-blue-700 uppercase mb-1.5 font-mono">
              Subject A (Primary Node)
            </label>
            <select
              value={selectedIdA}
              onChange={(e) => setSelectedIdA(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-600 font-mono"
            >
              {(dataset.entities || []).map(e => {
                const info = getEntityDisplayInfo(e, dataset);
                return (
                  <option key={e.id} value={e.id}>
                    {info.title} ({info.subtitle || info.type.toUpperCase()})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Entity B Selector */}
          <div>
            <label className="block text-xs font-semibold text-purple-700 uppercase mb-1.5 font-mono">
              Subject B (Comparison Candidate)
            </label>
            <select
              value={selectedIdB}
              onChange={(e) => setSelectedIdB(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-purple-600 font-mono"
            >
              {(dataset.entities || []).map(e => {
                const info = getEntityDisplayInfo(e, dataset);
                return (
                  <option key={e.id} value={e.id}>
                    {info.title} ({info.subtitle || info.type.toUpperCase()})
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Disambiguation Verdict Card */}
      {disambiguationResult && (
        <div className={`p-5 rounded-xl border transition-all ${
          disambiguationResult.classification === 'DEFINITE_MATCH'
            ? 'bg-emerald-50 border-emerald-300'
            : disambiguationResult.classification === 'DEFINITE_DIFFERENT'
            ? 'bg-rose-50 border-rose-300'
            : 'bg-amber-50 border-amber-300'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl border ${
                disambiguationResult.classification === 'DEFINITE_MATCH'
                  ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                  : disambiguationResult.classification === 'DEFINITE_DIFFERENT'
                  ? 'bg-rose-100 border-rose-300 text-rose-800'
                  : 'bg-amber-100 border-amber-300 text-amber-800'
              }`}>
                {disambiguationResult.classification === 'DEFINITE_MATCH' ? (
                  <CheckCircle2 className="w-8 h-8" />
                ) : disambiguationResult.classification === 'DEFINITE_DIFFERENT' ? (
                  <XCircle className="w-8 h-8" />
                ) : (
                  <AlertTriangle className="w-8 h-8" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-xs uppercase font-bold text-slate-600">Disambiguation Verdict:</span>
                  <span className="px-2 py-0.5 text-xs font-bold rounded bg-white border border-slate-300 text-slate-900 shadow-xs">
                    {disambiguationResult.classification}
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1">
                  Pairwise Identity Similarity: <span className="text-blue-700">{disambiguationResult.confidence}%</span>
                </div>
                <p className="text-xs text-slate-700 mt-0.5 font-sans">
                  {disambiguationResult.explanation}
                </p>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <button
                onClick={() => {
                  if (entityA) onSelectEntity(entityA.id);
                }}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-xs"
              >
                Inspect {entityA?.name?.slice(0, 14) || selectedIdA}...
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Subject A Details */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 className="font-bold text-xs text-blue-700 uppercase font-mono tracking-wider">
              SUBJECT A: {entityA?.name || selectedIdA}
            </h3>
            <span className="text-[10px] font-mono bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200 font-bold">
              {(entityA?.type || selectedIdA.split('-')[0]).toUpperCase()}
            </span>
          </div>

          {loadingA ? (
            <div className="flex items-center justify-center p-8 text-blue-600 gap-2 text-xs font-mono">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Fetching MongoDB records for {selectedIdA}...</span>
            </div>
          ) : (
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Subject A ID:</span>
                <span className="font-bold text-slate-900">{selectedIdA}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Independent Evidence Confidence:</span>
                <span className="font-bold text-blue-700">{confidenceScoreA}% Score</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Flagged Risk:</span>
                <span className="font-bold text-red-600">{entityA?.flaggedRisk || 'MEDIUM'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Linked Cases Count:</span>
                <span className="font-bold text-slate-800">{dossierA?.cases?.length || 0} Cases</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Verified Relationships:</span>
                <span className="font-bold text-slate-800">{dossierA?.relationships?.length || 0} Hops</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Linked Exhibits / Evidence:</span>
                <span className="font-bold text-purple-700">{dossierA?.evidence?.length || 0} Items</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Call Detail Records (CDRs):</span>
                <span className="font-bold text-cyan-700">{dossierA?.cdrs?.length || 0} Calls</span>
              </div>

              {entityA?.attributes && Object.entries(entityA.attributes)
                .filter(([k]) => {
                  const key = k.toLowerCase();
                  return !['account', 'bank', 'balance', 'ifsc', 'card', 'financial', 'transaction'].some(f => key.includes(f));
                })
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 capitalize">{k.replace(/_/g, ' ')}:</span>
                    <span className="text-slate-800">{String(v)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Subject B Details */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 className="font-bold text-xs text-amber-700 uppercase font-mono tracking-wider">
              SUBJECT B: {entityB?.name || selectedIdB}
            </h3>
            <span className="text-[10px] font-mono bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200 font-bold">
              {(entityB?.type || selectedIdB.split('-')[0]).toUpperCase()}
            </span>
          </div>

          {loadingB ? (
            <div className="flex items-center justify-center p-8 text-amber-600 gap-2 text-xs font-mono">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Fetching MongoDB records for {selectedIdB}...</span>
            </div>
          ) : (
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Subject B ID:</span>
                <span className="font-bold text-slate-900">{selectedIdB}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Independent Evidence Confidence:</span>
                <span className="font-bold text-amber-700">{confidenceScoreB}% Score</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Flagged Risk:</span>
                <span className="font-bold text-red-600">{entityB?.flaggedRisk || 'MEDIUM'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Linked Cases Count:</span>
                <span className="font-bold text-slate-800">{dossierB?.cases?.length || 0} Cases</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Verified Relationships:</span>
                <span className="font-bold text-slate-800">{dossierB?.relationships?.length || 0} Hops</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Linked Exhibits / Evidence:</span>
                <span className="font-bold text-purple-700">{dossierB?.evidence?.length || 0} Items</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Call Detail Records (CDRs):</span>
                <span className="font-bold text-cyan-700">{dossierB?.cdrs?.length || 0} Calls</span>
              </div>

              {entityB?.attributes && Object.entries(entityB.attributes)
                .filter(([k]) => {
                  const key = k.toLowerCase();
                  return !['account', 'bank', 'balance', 'ifsc', 'card', 'financial', 'transaction'].some(f => key.includes(f));
                })
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 capitalize">{k.replace(/_/g, ' ')}:</span>
                    <span className="text-slate-800">{String(v)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
