import React, { useState, useRef, useEffect } from 'react';
import { 
  Home, 
  ChevronRight, 
  ChevronDown, 
  ArrowLeft, 
  Briefcase, 
  Users, 
  User, 
  Building2, 
  Phone, 
  CreditCard, 
  Car, 
  Shield, 
  Lock, 
  Clock, 
  PhoneCall, 
  Activity, 
  HeartPulse, 
  Bot, 
  Search, 
  GitCompare, 
  GitBranch, 
  LayoutDashboard,
  Check, 
  Copy, 
  X
} from 'lucide-react';
import { InvestigationDataset } from '../../services/datasetNormalizer';
import { EntityType } from '../../types/investigation';
import { NavigationTab } from './AppShell';

export interface BreadcrumbTrailProps {
  currentTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  dataset: InvestigationDataset;
  selectedCaseId: string | null;
  onSelectCaseId: (caseId: string | null) => void;
  activeEntityId: string | null;
  onSelectEntity: (entityId: string | null) => void;
  onOpenEntityDossier?: (entityId: string) => void;
  onGoBack?: () => void;
  canGoBack?: boolean;
}

const TAB_CONFIG: Record<NavigationTab, { label: string; icon: React.FC<{ className?: string }> }> = {
  dashboard: { label: 'Dashboard', icon: LayoutDashboard },
  cases: { label: 'Active Cases', icon: Briefcase },
  entities: { label: 'Entities Database', icon: Users },
  knowledge_graph: { label: 'Network Graph', icon: GitBranch },
  timeline: { label: 'Chronology Timeline', icon: Clock },
  evidence_vault: { label: 'Evidence Vault', icon: Lock },
  financial: { label: 'Financial Intel (AML)', icon: CreditCard },
  anomaly_radar: { label: 'Anomaly Radar', icon: Activity },
  telecom: { label: 'Telecom / CDR', icon: PhoneCall },
  investigate: { label: 'Deep Query / Filter', icon: Search },
  compare: { label: 'Cross-Entity Compare', icon: GitCompare },
  data_health: { label: 'System Data Health', icon: HeartPulse },
  ai_copilot: { label: 'AI Case Copilot', icon: Bot }
};

const getEntityIcon = (type?: EntityType | string) => {
  switch (type) {
    case 'person':
      return User;
    case 'organization':
      return Building2;
    case 'vehicle':
      return Car;
    case 'account':
      return CreditCard;
    case 'phone':
      return Phone;
    default:
      return Shield;
  }
};

export const BreadcrumbTrail: React.FC<BreadcrumbTrailProps> = ({
  currentTab,
  onTabChange,
  dataset,
  selectedCaseId,
  onSelectCaseId,
  activeEntityId,
  onSelectEntity,
  onOpenEntityDossier,
  onGoBack,
  canGoBack = false
}) => {
  const [copied, setCopied] = useState(false);
  const [tabDropdownOpen, setTabDropdownOpen] = useState(false);
  const [caseDropdownOpen, setCaseDropdownOpen] = useState(false);
  const [entityDropdownOpen, setEntityDropdownOpen] = useState(false);

  const tabDropdownRef = useRef<HTMLDivElement>(null);
  const caseDropdownRef = useRef<HTMLDivElement>(null);
  const entityDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tabDropdownRef.current && !tabDropdownRef.current.contains(event.target as Node)) {
        setTabDropdownOpen(false);
      }
      if (caseDropdownRef.current && !caseDropdownRef.current.contains(event.target as Node)) {
        setCaseDropdownOpen(false);
      }
      if (entityDropdownRef.current && !entityDropdownRef.current.contains(event.target as Node)) {
        setEntityDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeCase = dataset.cases.find(c => c.id === selectedCaseId);
  const activeEntity = dataset.entities.find(e => e.id === activeEntityId);
  const currentTabInfo = TAB_CONFIG[currentTab] || { label: currentTab, icon: LayoutDashboard };
  const TabIcon = currentTabInfo.icon;
  const EntityIcon = activeEntity ? getEntityIcon(activeEntity.type) : User;

  // Compute text trail for clipboard
  const generateTrailString = () => {
    const parts: string[] = ['Home'];
    if (currentTab !== 'dashboard') {
      parts.push(currentTabInfo.label);
    }
    if (activeCase) {
      parts.push(`Case: ${activeCase.caseNumber} (${activeCase.title})`);
    }
    if (activeEntity) {
      const risk = activeEntity.flaggedRisk ? ` [${activeEntity.flaggedRisk}]` : '';
      parts.push(`Subject: ${activeEntity.name}${risk}`);
    }
    return parts.join(' > ');
  };

  const handleCopyTrail = () => {
    const trailStr = generateTrailString();
    navigator.clipboard.writeText(trailStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <nav 
      id="breadcrumb-navigation-trail"
      aria-label="Investigation Breadcrumb Trail"
      className="h-10 bg-slate-100/90 border-b border-slate-200 px-4 md:px-6 flex items-center justify-between text-xs text-slate-700 select-none shadow-xs sticky top-14 z-20"
    >
      {/* Left: Interactive Trail Items */}
      <div className="flex items-center gap-2 overflow-x-auto py-1">
        {/* Back Button */}
        {onGoBack && (
          <button
            id="breadcrumb-back-btn"
            onClick={onGoBack}
            disabled={!canGoBack}
            title={canGoBack ? "Go back to previous investigation view" : "No previous history"}
            className={`p-1 rounded-lg transition-colors flex items-center justify-center ${
              canGoBack 
                ? 'text-slate-700 hover:text-slate-900 hover:bg-slate-200 cursor-pointer' 
                : 'text-slate-400 opacity-40 cursor-not-allowed'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Step 1: Home Root */}
        <button
          id="breadcrumb-home-btn"
          onClick={() => {
            onTabChange('dashboard');
            onSelectCaseId(null);
            onSelectEntity(null);
          }}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors font-medium text-xs ${
            currentTab === 'dashboard' && !activeCase && !activeEntity
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
          }`}
          title="Return to Primary Dashboard"
        >
          <Home className="w-3.5 h-3.5 shrink-0" />
          <span>Home</span>
        </button>

        {/* Step 2: Active Module / Tab */}
        {currentTab !== 'dashboard' && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />

            <div className="relative" ref={tabDropdownRef}>
              <button
                id="breadcrumb-tab-btn"
                onClick={() => {
                  if (!activeCase && !activeEntity) {
                    setTabDropdownOpen(!tabDropdownOpen);
                  } else {
                    onTabChange(currentTab);
                    onSelectEntity(null);
                  }
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors text-xs font-medium ${
                  !activeCase && !activeEntity
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/70'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">{currentTabInfo.label}</span>
                <ChevronDown 
                  onClick={(e) => {
                    e.stopPropagation();
                    setTabDropdownOpen(!tabDropdownOpen);
                  }}
                  className="w-3 h-3 text-slate-400 hover:text-slate-700 shrink-0 ml-0.5" 
                />
              </button>

              {/* Module Dropdown */}
              {tabDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 w-60 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-1.5 space-y-0.5 text-slate-800 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                    Switch Investigation Module
                  </div>
                  {Object.entries(TAB_CONFIG).map(([tabKey, config]) => {
                    const Icon = config.icon;
                    const isSelected = currentTab === tabKey;
                    return (
                      <button
                        key={tabKey}
                        onClick={() => {
                          onTabChange(tabKey as NavigationTab);
                          setTabDropdownOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors font-medium ${
                          isSelected ? 'bg-blue-600 text-white font-semibold' : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                        <span>{config.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Step 3: Focus Case ID & Title */}
        {activeCase && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />

            <div className="relative" ref={caseDropdownRef}>
              <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg p-0.5 shadow-xs">
                <button
                  id="breadcrumb-case-btn"
                  onClick={() => {
                    onTabChange('cases');
                    onSelectCaseId(activeCase.id);
                    onSelectEntity(null);
                  }}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-colors text-xs font-medium ${
                    !activeEntity
                      ? 'bg-blue-50 text-blue-900 font-semibold'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="font-mono text-xs font-bold text-blue-700">{activeCase.caseNumber}</span>
                  <span className="text-slate-500 hidden lg:inline max-w-[140px] truncate">
                    ({activeCase.title})
                  </span>
                </button>

                <button
                  onClick={() => setCaseDropdownOpen(!caseDropdownOpen)}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>

                <button
                  onClick={() => {
                    onSelectCaseId(null);
                    onSelectEntity(null);
                  }}
                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Clear Case Filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              {/* Case Switcher Dropdown */}
              {caseDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-1.5 space-y-1 text-slate-800">
                  <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    Switch Case Focus
                  </div>
                  <button
                    onClick={() => {
                      onSelectCaseId(null);
                      setCaseDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between font-medium ${
                      selectedCaseId === null ? 'bg-blue-600 text-white font-semibold' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>All Active Cases</span>
                    <span className="text-[10px] opacity-70">{(dataset.cases || []).length} Records</span>
                  </button>
                  {(dataset.cases || []).map(c => (
                    <button
                      key={c.id}
                      onClick={() => {
                        onSelectCaseId(c.id);
                        setCaseDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                        selectedCaseId === c.id ? 'bg-blue-600 text-white font-semibold' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="font-mono text-xs font-bold text-blue-700">{c.caseNumber}</div>
                      <div className="text-[11px] text-slate-600 truncate">{c.title}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Step 4: Focus Subject / Entity */}
        {activeEntity && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />

            <div className="relative" ref={entityDropdownRef}>
              <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg p-0.5 shadow-xs">
                <button
                  id="breadcrumb-entity-btn"
                  onClick={() => {
                    if (onOpenEntityDossier) {
                      onOpenEntityDossier(activeEntity.id);
                    }
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-600 text-white font-semibold text-xs shadow-xs hover:bg-blue-700 transition-colors"
                >
                  <EntityIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">{activeEntity.name}</span>
                  
                  {activeEntity.flaggedRisk && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                      activeEntity.flaggedRisk === 'CRITICAL' || activeEntity.flaggedRisk === 'HIGH'
                        ? 'bg-red-500 text-white'
                        : activeEntity.flaggedRisk === 'MEDIUM'
                        ? 'bg-amber-500 text-white'
                        : 'bg-emerald-500 text-white'
                    }`}>
                      {activeEntity.flaggedRisk}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setEntityDropdownOpen(!entityDropdownOpen)}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>

                <button
                  onClick={() => onSelectEntity(null)}
                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Clear Subject Focus"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              {/* Entity Switcher Dropdown */}
              {entityDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 w-72 max-h-80 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-1.5 space-y-1 text-slate-800">
                  <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    Select Target Subject
                  </div>
                  {(dataset.entities || []).slice(0, 15).map(e => {
                    const EIcon = getEntityIcon(e.type);
                    const isSelected = activeEntityId === e.id;
                    return (
                      <button
                        key={e.id}
                        onClick={() => {
                          onSelectEntity(e.id);
                          setEntityDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between font-medium ${
                          isSelected ? 'bg-blue-600 text-white font-semibold' : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <EIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{e.name}</span>
                        </div>
                        {e.flaggedRisk && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {e.flaggedRisk}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right: Path Copy */}
      <div className="flex items-center gap-2 shrink-0 pl-2">
        <button
          id="breadcrumb-copy-path-btn"
          onClick={handleCopyTrail}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors shadow-xs"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-600 font-semibold hidden sm:inline">Path Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Copy Path</span>
            </>
          )}
        </button>
      </div>
    </nav>
  );
};

