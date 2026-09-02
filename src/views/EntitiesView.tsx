import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  Building2, 
  Phone, 
  CreditCard, 
  Car, 
  MapPin, 
  Shield, 
  Search, 
  Filter, 
  ArrowRight,
  GitBranch,
  GitCompare,
  Layers,
  LayoutGrid,
  List,
  AlertTriangle,
  ArrowUpRight,
  ExternalLink,
  Lock,
  Camera,
  FileText,
  Loader2
} from 'lucide-react';
import { InvestigationDataset } from '../services/datasetNormalizer';
import { Entity, EntityType } from '../types/investigation';
import { fetchEntityDossier } from '../services/apiService';

interface EntitiesViewProps {
  dataset: InvestigationDataset;
  selectedCaseId?: string | null;
  onSelectEntity: (entityId: string) => void;
  onOpenInGraph: (entityId: string) => void;
  onOpenInCompare: (entityId: string) => void;
}

export const EntitiesView: React.FC<EntitiesViewProps> = ({
  dataset,
  selectedCaseId,
  onSelectEntity,
  onOpenInGraph,
  onOpenInCompare
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [selectedEntityId, setSelectedEntityId] = useState<string>(
    dataset.entities[0]?.id || 'PERSON-000001'
  );
  const [dossier, setDossier] = useState<any>(null);
  const [loadingDossier, setLoadingDossier] = useState<boolean>(false);

  useEffect(() => {
    if (!selectedEntityId) return;
    const controller = new AbortController();
    setDossier(null);
    setLoadingDossier(true);

    fetchEntityDossier(selectedEntityId, selectedCaseId || undefined, controller.signal)
      .then(res => {
        if (!controller.signal.aborted) {
          if (res && (res.entity?.id === selectedEntityId || res.entity?.attributes?.person_id === selectedEntityId)) {
            setDossier(res);
          }
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setDossier(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingDossier(false);
      });

    return () => {
      controller.abort();
    };
  }, [selectedEntityId, selectedCaseId]);

  const selectedEntityInDataset = useMemo(() => {
    return dataset.entities.find(e => e.id === selectedEntityId);
  }, [dataset.entities, selectedEntityId]);

  const activeEntityData = useMemo(() => {
    if (dossier?.entity && (dossier.entity.id === selectedEntityId || dossier.entity.attributes?.person_id === selectedEntityId)) {
      return dossier.entity;
    }
    if (selectedEntityInDataset) {
      return selectedEntityInDataset;
    }
    return {
      id: selectedEntityId,
      name: selectedEntityId,
      type: 'person' as EntityType,
      flaggedRisk: 'ASSOCIATE',
      aliases: [],
      attributes: { person_id: selectedEntityId }
    };
  }, [dossier, selectedEntityId, selectedEntityInDataset]);

  const filteredEntities = useMemo(() => {
    return dataset.entities.filter(e => {
      if (typeFilter !== 'ALL') {
        if (typeFilter === 'PERSON' && e.type !== 'person') return false;
        if (typeFilter === 'ORG' && e.type !== 'organization') return false;
        if (typeFilter === 'VEHICLE' && e.type !== 'vehicle') return false;
        if (typeFilter === 'ACCOUNT' && e.type !== 'account') return false;
        if (typeFilter === 'PHONE' && e.type !== 'phone') return false;
      }
      if (!searchTerm.trim()) return true;

      const term = searchTerm.toLowerCase();
      return (
        e.name.toLowerCase().includes(term) ||
        e.id.toLowerCase().includes(term) ||
        e.aliases?.some(a => a.toLowerCase().includes(term)) ||
        Object.values(e.attributes || {}).some(v => String(v).toLowerCase().includes(term))
      );
    });
  }, [dataset.entities, searchTerm, typeFilter]);

  const getEntityIcon = (type: EntityType) => {
    switch (type) {
      case 'person': return <Users className="w-4 h-4 text-blue-600" />;
      case 'organization': return <Building2 className="w-4 h-4 text-purple-600" />;
      case 'phone': return <Phone className="w-4 h-4 text-cyan-600" />;
      case 'account': return <CreditCard className="w-4 h-4 text-amber-600" />;
      case 'vehicle': return <Car className="w-4 h-4 text-emerald-600" />;
      case 'location': return <MapPin className="w-4 h-4 text-rose-600" />;
      default: return <Shield className="w-4 h-4 text-slate-600" />;
    }
  };

  const attributes = activeEntityData.attributes || {};
  const entityName = activeEntityData.name || 'Not available';
  const entityType = activeEntityData.type || 'person';
  const entityRisk = activeEntityData.flaggedRisk || (attributes.role ? attributes.role.toUpperCase() : 'ASSOCIATE');
  const entityAliases = activeEntityData.aliases || (attributes.alias ? [attributes.alias] : []);

  const dobVal = attributes.dob || attributes.date_of_birth || attributes.dateOfBirth || (attributes.age ? `${attributes.age} yrs` : 'Not available');
  const nationalityVal = attributes.nationality || attributes.country || (attributes.state ? `Indian (${attributes.state})` : 'Not available');
  const primaryAliasVal = entityAliases[0] ? `"${entityAliases[0]}"` : 'Not available';

  const eyeColorVal = attributes.eye_color || attributes.eyeColor || attributes.eyecolor || attributes.eye_colour || attributes.eye || 'Not available';
  const hairColorVal = attributes.hair_color || attributes.hairColor || attributes.haircolor || attributes.hair_colour || attributes.hair || 'Not available';
  const bloodTypeVal = attributes.blood_type || attributes.bloodType || attributes.blood_group || attributes.bloodGroup || attributes.blood || 'Not available';
  const maritalStatusVal = attributes.marital_status || attributes.maritalStatus || attributes.marital_state || attributes.marital || 'Not available';
  const addressVal = attributes.address || attributes.full_address || attributes.location || attributes.street_address || (
    (attributes.district || attributes.state)
      ? `District: ${attributes.district || 'N/A'}, State: ${attributes.state || 'N/A'}`
      : 'Not available'
  );

  const isDossierValid = dossier && (dossier.entity?.id === selectedEntityId || dossier.entity?.attributes?.person_id === selectedEntityId);
  const linkedCases = isDossierValid ? (dossier.cases || []) : [];
  const linkedEvidence = isDossierValid ? (dossier.evidence || []) : [];
  const linkedRelsCount = isDossierValid ? (dossier.relationships?.length ?? 0) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight font-heading">
              Entities Database
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-mono">
              {dataset.entities.length} Indexed Targets
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Cross-referenced subjects, proxy corporations, financial accounts, and tactical phone nodes.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onOpenInGraph(selectedEntityId)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-2 shadow-xs transition-colors"
          >
            <GitBranch className="w-4 h-4" />
            <span>Open in Graph</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (4 Cols): Entity Query Drawer */}
        <div className="lg:col-span-4 space-y-3">
          <div className="p-4 bg-white border border-slate-200 rounded-xl card-shadow space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                Entity Query Filter
              </h3>
              <span className="text-xs text-slate-500 font-medium font-mono">
                {filteredEntities.length} Targets
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search name, ID, or alias..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-colors font-mono"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(['ALL', 'PERSON', 'ORG', 'VEHICLE', 'ACCOUNT'] as const).map(pill => (
                <button
                  key={pill}
                  onClick={() => setTypeFilter(pill)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                    typeFilter === pill
                      ? 'bg-blue-600 border-blue-600 text-white font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {pill}
                </button>
              ))}
            </div>

            {/* Entity List Items */}
            <div className="space-y-2 pt-2 max-h-[520px] overflow-y-auto pr-1">
              {filteredEntities.map((entity) => {
                const isSelected = entity.id === selectedEntityId;
                const isWarrant = entity.flaggedRisk === 'CRITICAL';

                return (
                  <div
                    key={entity.id}
                    onClick={() => setSelectedEntityId(entity.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-2.5 ${
                      isSelected
                        ? 'bg-blue-50/60 border-blue-400 ring-1 ring-blue-400/50'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Photo / Icon avatar */}
                      <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-slate-200">
                        {getEntityIcon(entity.type)}
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 truncate">
                          {entity.name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 truncate">
                          ID: {entity.id}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isWarrant && (
                        <span className="p-1 rounded-full bg-red-50 text-red-700 border border-red-200" title="Active High Risk">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                        </span>
                      )}
                      <span className="text-[10px] font-semibold uppercase text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                        {entity.type.slice(0, 4)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (8 Cols): Entity Detailed Dossier */}
        <div className="lg:col-span-8 space-y-4">
          {selectedEntityId ? (
            <div className="space-y-4">
              {/* Top Identity Header Card */}
              <div className="p-5 bg-white border border-slate-200 rounded-xl card-shadow flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-20 h-24 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 shrink-0 shadow-xs flex items-center justify-center">
                  <div className="text-slate-400 flex flex-col items-center">
                    {getEntityIcon(entityType)}
                    <span className="text-[10px] font-medium mt-1 uppercase font-mono">{entityType}</span>
                  </div>
                </div>

                {/* Identity Information */}
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900 font-heading">
                        {entityName}
                      </h2>
                      {loadingDossier && (
                        <span className="flex items-center text-xs text-blue-600 space-x-1 font-mono">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Fetching MongoDB...</span>
                        </span>
                      )}
                    </div>
                    <span className="px-2.5 py-0.5 text-xs font-semibold uppercase rounded-full border border-red-200 bg-red-50 text-red-700 flex items-center gap-1 font-mono">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                      {entityRisk}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">TARGET ID: {selectedEntityId}</p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs text-slate-600">
                    <div>
                      <span className="text-[11px] text-slate-400 block uppercase font-medium">DOB / Age</span>
                      <strong className="text-slate-900 font-semibold">{dobVal}</strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block uppercase font-medium">Nationality</span>
                      <strong className="text-slate-900 font-semibold">{nationalityVal}</strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block uppercase font-medium">Primary Alias</span>
                      <strong className="text-blue-700 font-semibold">{primaryAliasVal}</strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block uppercase font-medium">Occupation / Role</span>
                      <strong className="text-slate-900 font-semibold capitalize">{attributes.occupation || attributes.role || 'Not available'}</strong>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <button
                      onClick={() => onSelectEntity(selectedEntityId)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Full Dossier Modal</span>
                    </button>
                    <button
                      onClick={() => onOpenInCompare(selectedEntityId)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <GitCompare className="w-3.5 h-3.5 text-purple-600" />
                      <span>Pairwise Compare</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Dossier Attributes Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Subcard: Biographical Data */}
                <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
                  <h3 className="font-bold text-xs text-slate-900 uppercase font-mono tracking-wider border-b border-slate-100 pb-2">
                    Biographical Data
                  </h3>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Eye Color:</span>
                      <span className="text-slate-800 font-bold">{eyeColorVal}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Hair Color:</span>
                      <span className="text-slate-800 font-bold">{hairColorVal}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Blood Type:</span>
                      <span className="text-slate-800 font-bold">{bloodTypeVal}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Marital Status:</span>
                      <span className="text-slate-800 font-bold">{maritalStatusVal}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-xs">
                    <span className="text-[10px] font-mono text-slate-400 block">Last Known Location / Jurisdiction:</span>
                    <p className="text-slate-800 font-medium mt-0.5 font-mono">
                      {addressVal}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[10px] font-mono text-slate-400">Known Links / Network:</span>
                    <span className="font-bold text-slate-900 font-mono">{linkedRelsCount} Links</span>
                  </div>
                </div>

                {/* Right Subcard: System Flags & Evidence Gallery */}
                <div className="space-y-4">
                  {/* System Flags */}
                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
                    <h3 className="font-bold text-xs text-slate-900 uppercase font-mono tracking-wider">
                      System Flags
                    </h3>
                    <ul className="text-xs space-y-1.5 text-slate-800 font-mono">
                      <li className="flex items-start gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                        Role: <strong className="uppercase">{attributes.role || 'ASSOCIATE'}</strong>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                        Jurisdiction: <strong>{attributes.state || 'Not available'}</strong>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                        Status: <strong>{attributes.synthetic_flag ? 'Verified Operational Record' : 'Active Subject Record'}</strong>
                      </li>
                    </ul>
                  </div>

                  {/* Evidence Gallery */}
                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-xs text-slate-900 uppercase font-mono tracking-wider">
                        Evidence Records ({linkedEvidence.length})
                      </h3>
                      <button 
                        onClick={() => onSelectEntity(selectedEntityId)}
                        className="text-[10px] font-mono font-bold text-blue-600 hover:underline"
                      >
                        VIEW ALL
                      </button>
                    </div>

                    {linkedEvidence.length > 0 ? (
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {linkedEvidence.slice(0, 3).map((e: any, idx: number) => (
                          <div key={e.id || idx} className="p-2 bg-slate-50 border border-slate-200 rounded text-xs flex items-center justify-between">
                            <span className="font-semibold text-slate-900 truncate">{e.title || e.description}</span>
                            <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 uppercase">{e.evidenceType || e.evidence_type}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded border border-dashed border-slate-200">
                        Not available
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom: Known Aliases */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
                <h3 className="font-bold text-xs text-slate-900 uppercase font-mono tracking-wider">
                  Known Aliases
                </h3>
                <div className="flex flex-wrap gap-2">
                  {entityAliases.length > 0 ? (
                    entityAliases.map((alias: string, idx: number) => (
                      <span 
                        key={idx}
                        className="px-3 py-1 bg-slate-100 border border-slate-300 rounded-full text-xs font-mono text-slate-800 font-semibold"
                      >
                        "{alias}"
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500 italic">Not available</span>
                  )}
                </div>
              </div>

              {/* Associated Cases Section */}
              {linkedCases.length > 0 && (
                <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
                  <h3 className="font-bold text-xs text-slate-900 uppercase font-mono tracking-wider">
                    Linked Cases ({linkedCases.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {linkedCases.slice(0, 4).map((c: any) => (
                      <div key={c.id || c.case_id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-blue-700 font-mono">{c.case_id || c.id}</span>
                          <span className="text-[10px] font-semibold bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded">{c.status || c.priority}</span>
                        </div>
                        <div className="font-bold text-slate-900 truncate">{c.crime_type || c.title}</div>
                        <div className="text-[11px] text-slate-500 truncate">{c.jurisdiction || c.dates}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => onOpenInCompare(selectedEntityId)}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <GitCompare className="w-3.5 h-3.5 text-purple-600" />
                  Compare Node
                </button>
                <button
                  onClick={() => onSelectEntity(selectedEntityId)}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Open Full Dossier
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 bg-white border border-slate-200 rounded-xl text-center text-slate-500">
              Select an entity node from the registry to inspect full intelligence dossier.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
