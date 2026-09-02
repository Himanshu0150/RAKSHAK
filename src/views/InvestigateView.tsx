import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Users, 
  Phone, 
  CreditCard, 
  Car, 
  Building2, 
  MapPin, 
  Lock, 
  GitBranch, 
  GitCompare, 
  ArrowRight,
  ExternalLink,
  Shield,
  Layers,
  Sparkles,
  ArrowUpRight,
  Loader2
} from 'lucide-react';
import { InvestigationDataset } from '../services/datasetNormalizer';
import { Entity, EntityType } from '../types/investigation';
import { NavigationTab } from '../components/layout/AppShell';
import { fetchRealEntities } from '../services/apiService';

interface InvestigateViewProps {
  dataset: InvestigationDataset;
  onSelectEntity: (entityId: string) => void;
  onNavigateTab: (tab: NavigationTab) => void;
  onOpenInGraph: (entityId: string) => void;
  onOpenInCompare: (entityId: string) => void;
}

export const InvestigateView: React.FC<InvestigateViewProps> = ({
  dataset,
  onSelectEntity,
  onNavigateTab,
  onOpenInGraph,
  onOpenInCompare
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedRisk, setSelectedRisk] = useState<string>('ALL');
  const [matchMode, setMatchMode] = useState<'FUZZY' | 'EXACT'>('FUZZY');
  const [entities, setEntities] = useState<Entity[]>(dataset.entities);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchRealEntities(200, selectedType === 'ALL' ? undefined : selectedType, searchTerm, selectedRisk === 'ALL' ? undefined : selectedRisk)
      .then(data => {
        if (active) {
          setEntities(data || []);
        }
      })
      .catch(() => {
        if (active) setEntities([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [searchTerm, selectedType, selectedRisk]);

  const quickSearches = [
    { label: 'High Risk Targets', filter: () => { setSelectedRisk('HIGH'); setSelectedType('ALL'); setSearchTerm(''); } },
    { label: 'Bank Accounts', filter: () => { setSelectedType('account'); setSelectedRisk('ALL'); setSearchTerm(''); } },
    { label: 'Phone Intercepts', filter: () => { setSelectedType('phone'); setSelectedRisk('ALL'); setSearchTerm(''); } },
    { label: 'Vehicles / ANPR', filter: () => { setSelectedType('vehicle'); setSelectedRisk('ALL'); setSearchTerm(''); } },
    { label: 'Offshore Entities', filter: () => { setSelectedType('organization'); setSelectedRisk('ALL'); setSearchTerm(''); } }
  ];

  const searchResults = entities;

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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight font-heading">
            Deep Target Investigation & Query Builder
          </h1>
          <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-mono">
            Cross-Dataset Search
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Execute multi-attribute queries across indexed targets, financial accounts, vehicle passes, and phone logs.
        </p>
      </div>

      {/* Query Bar */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl card-shadow space-y-4">
        {/* Search Bar Input */}
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search any keyword, name, IMEI, phone number, vehicle plate, SWIFT code, or wallet..."
            className="w-full pl-11 pr-24 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner font-mono"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              onClick={() => setMatchMode(matchMode === 'FUZZY' ? 'EXACT' : 'FUZZY')}
              className="px-2.5 py-1 text-xs font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors font-semibold"
            >
              {matchMode} MATCH
            </button>
          </div>
        </div>

        {/* Quick Search Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-slate-500 font-semibold">Quick Filters:</span>
          {quickSearches.map((qs, i) => (
            <button
              key={i}
              onClick={qs.filter}
              className="px-2.5 py-1 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-lg text-xs font-mono transition-colors font-medium"
            >
              {qs.label}
            </button>
          ))}
          {(searchTerm || selectedType !== 'ALL' || selectedRisk !== 'ALL') && (
            <button
              onClick={() => { setSearchTerm(''); setSelectedType('ALL'); setSelectedRisk('ALL'); }}
              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-mono transition-colors font-semibold ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Filter Selectors Row */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500">Node Type:</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
            >
              <option value="ALL">All Types</option>
              <option value="person">Persons</option>
              <option value="organization">Organizations</option>
              <option value="phone">Phones</option>
              <option value="account">Accounts</option>
              <option value="vehicle">Vehicles</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500">Threat Level:</span>
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
            >
              <option value="ALL">All Threat Levels</option>
              <option value="CRITICAL">Critical Priority</option>
              <option value="HIGH">High Risk</option>
              <option value="MEDIUM">Medium Risk</option>
              <option value="LOW">Low Risk</option>
              <option value="ASSOCIATE">Associate / Suspect</option>
            </select>
          </div>

          <div className="ml-auto flex items-center gap-2 text-xs font-mono text-slate-500">
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />}
            <span>Found <strong className="text-slate-900 font-bold">{searchResults.length}</strong> matching records</span>
          </div>
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {searchResults.length > 0 ? (
          searchResults.map(entity => {
            const links = (dataset.relationships || []).filter(r => r.source === entity.id || r.target === entity.id).length;
            const isCritical = entity.flaggedRisk === 'CRITICAL' || entity.flaggedRisk === 'HIGH';

            return (
              <div 
                key={entity.id}
                className="p-4 bg-white border border-slate-200 hover:border-blue-400 rounded-xl shadow-xs flex flex-col justify-between transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getEntityIcon(entity.type)}
                      <span className="text-xs font-mono text-slate-500 uppercase">{entity.type}</span>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                      isCritical ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {entity.flaggedRisk}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{entity.name}</h3>
                    <p className="text-[11px] font-mono text-slate-500">ID: {entity.id}</p>
                  </div>

                  {entity.aliases && entity.aliases.length > 0 && (
                    <div className="text-xs text-slate-600 font-mono">
                      <span className="text-slate-400 font-mono text-[10px]">Aliases: </span>
                      {entity.aliases.join(', ')}
                    </div>
                  )}
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-500">{links} Graph Edges</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onOpenInGraph(entity.id)}
                      className="p-1.5 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded border border-slate-200"
                      title="Open in Graph"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onSelectEntity(entity.id)}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold font-mono transition-colors"
                    >
                      Dossier ➔
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          !loading && (
            <div className="col-span-full p-12 bg-white border border-slate-200 rounded-xl text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">No Matching Targets Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No indexed entities match your current query parameters ({searchTerm || selectedType || selectedRisk}). Try clearing filters or searching another keyword.
              </p>
              <button
                onClick={() => { setSearchTerm(''); setSelectedType('ALL'); setSelectedRisk('ALL'); }}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold font-mono"
              >
                Reset All Filters
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
};
