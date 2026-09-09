import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Search, 
  Briefcase, 
  Users, 
  GitCompare, 
  GitBranch, 
  Lock, 
  Clock, 
  PhoneCall, 
  CreditCard, 
  Activity, 
  HeartPulse, 
  Bot, 
  Shield, 
  ShieldAlert, 
  CheckCircle2, 
  Bell, 
  Database, 
  ChevronDown,
  Sparkles,
  LogOut,
  ShieldCheck
} from 'lucide-react';
import { InvestigationDataset } from '../../services/datasetNormalizer';
import { BreadcrumbTrail } from './BreadcrumbTrail';
import { useAuth, hasTabPermission, isCaseAuthorized } from '../../context/AuthContext';

export type NavigationTab = 
  | 'dashboard'
  | 'investigate'
  | 'cases'
  | 'entities'
  | 'compare'
  | 'knowledge_graph'
  | 'evidence_vault'
  | 'timeline'
  | 'investigation_story'
  | 'telecom'
  | 'financial'
  | 'anomaly_radar'
  | 'data_health'
  | 'ai_copilot';

interface AppShellProps {
  currentTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  dataset: InvestigationDataset;
  selectedCaseId: string | null;
  onSelectCaseId: (caseId: string | null) => void;
  activeEntityId?: string | null;
  onSelectEntity?: (entityId: string | null) => void;
  onOpenEntityDossier?: (entityId: string) => void;
  onGoBack?: () => void;
  canGoBack?: boolean;
  tamperSimulated: boolean;
  onOpenDatasetModal: () => void;
  onOpenNotifications: () => void;
  unreadAlertsCount: number;
  children: React.ReactNode;
  summaryData?: any;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentTab,
  onTabChange,
  dataset,
  selectedCaseId,
  onSelectCaseId,
  activeEntityId = null,
  onSelectEntity = () => {},
  onOpenEntityDossier,
  onGoBack,
  canGoBack = false,
  tamperSimulated,
  onOpenDatasetModal,
  onOpenNotifications,
  unreadAlertsCount,
  children,
  summaryData
}) => {
  const { user, logout } = useAuth();
  const [caseMenuOpen, setCaseMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  const authorizedCases = (dataset.cases || []).filter(c => isCaseAuthorized(user, c.id));
  const selectedCase = authorizedCases.find(c => c.id === selectedCaseId) || dataset.cases.find(c => c.id === selectedCaseId);

  // Grouped Navigation Items matching Stitch design structure
  const navGroups: Array<{
    title: string;
    items: Array<{ id: NavigationTab; label: string; icon: React.FC<{ className?: string }>; badge?: string | number }>;
  }> = [
    {
      title: 'Intelligence Operations',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'cases', label: 'Active Cases', icon: Briefcase, badge: summaryData?.activeCasesCount ?? authorizedCases.length },
        { id: 'entities', label: 'Entities Database', icon: Users, badge: summaryData?.indexedEntitiesCount ?? (dataset.entities || []).length },
        { id: 'knowledge_graph', label: 'Network Graph', icon: GitBranch },
      ]
    },
    {
      title: 'Analysis & Intel',
      items: [
        { id: 'investigation_story', label: 'Investigation Story', icon: Sparkles, badge: 'AI' },
        { id: 'financial', label: 'Financial Intel (AML)', icon: CreditCard, badge: summaryData?.transactionsCount ?? (dataset.transactions || []).length },
        { id: 'timeline', label: 'Chronology Timeline', icon: Clock, badge: summaryData?.eventsCount ?? (dataset.timelineEvents || []).length },
        { id: 'telecom', label: 'Telecom / CDR', icon: PhoneCall, badge: summaryData?.cdrsCount ?? (dataset.cdrRecords || []).length },
        { id: 'anomaly_radar', label: 'Anomaly Radar', icon: Activity, badge: summaryData?.anomaliesCount ?? (dataset.anomalies || []).length },
      ]
    },
    {
      title: 'Evidence & Tools',
      items: [
        { id: 'evidence_vault', label: 'Evidence Vault', icon: Lock, badge: summaryData?.evidenceRecordsCount ?? (dataset.evidenceRecords || []).length },
        { id: 'investigate', label: 'Deep Query / Filter', icon: Search },
        { id: 'compare', label: 'Cross-Entity Compare', icon: GitCompare },
        { id: 'data_health', label: 'System Data Health', icon: HeartPulse },
        { id: 'ai_copilot', label: 'AI Case Copilot', icon: Bot },
      ]
    }
  ];

  const visibleNavGroups = navGroups.map(group => ({
    ...group,
    items: group.items.filter(item => hasTabPermission(user, item.id))
  })).filter(group => group.items.length > 0);

  return (
    <div className="min-h-screen bg-[#F8F7F3] text-slate-900 flex flex-col font-sans selection:bg-[#283593] selection:text-white">
      {/* ----------------- TOP WORKSPACE APP BAR ----------------- */}
      <header 
        id="top-navigation-bar"
        className="h-14 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between z-30 sticky top-0 text-slate-900 shadow-xs"
      >
        {/* Left: Brand & Search */}
        <div className="flex items-center gap-4 lg:gap-6">
          <div 
            className="flex items-center gap-2.5 cursor-pointer select-none group" 
            onClick={() => onTabChange('dashboard')}
          >
            <img src="/rakshak_logo.png" alt="RAKSHAK Logo" className="w-9 h-9 object-contain" />
            <div>
              <div className="flex items-center gap-2 leading-none">
                <span className="font-bold text-base tracking-tight text-slate-900 font-mono">RAKSHAK</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-none mt-0.5">
                National Crime Intelligence Platform
              </p>
            </div>
          </div>

          <div className="h-5 w-px bg-slate-200 hidden md:block" />

          {/* Global Search Bar */}
          <div className="relative hidden lg:flex items-center">
            <div className="relative w-80 xl:w-96">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search cases, entities, evidence, phone, accounts..."
                className="w-full pl-8 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Right: Active Case, Merkle Audit, Dataset Switcher, Notifications & Profile */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Active Case Selector Dropdown */}
          <div className="relative hidden sm:block">
            <button
              id="case-selector-dropdown-btn"
              onClick={() => setCaseMenuOpen(!caseMenuOpen)}
              className={`px-3 py-1.5 text-xs rounded-lg border flex items-center gap-2 transition-all ${
                selectedCase
                  ? 'bg-blue-50 border-blue-300 text-blue-900 font-semibold'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-slate-500 font-medium">Case:</span>
              <span className="text-xs font-medium max-w-[130px] truncate">
                {selectedCase ? selectedCase.caseNumber : 'All Active'}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {caseMenuOpen && (
              <div className="absolute top-full mt-1.5 right-0 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-2 space-y-1 text-slate-900">
                <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Active Investigation Scope
                </div>
                <button
                  onClick={() => { onSelectCaseId(null); setCaseMenuOpen(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                    selectedCaseId === null ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>All Authorized Cases</span>
                  <span className="text-[10px] opacity-80">{authorizedCases.length} Cases</span>
                </button>
                {authorizedCases.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { onSelectCaseId(c.id); setCaseMenuOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                      selectedCaseId === c.id ? 'bg-blue-600 text-white font-semibold' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-[11px] font-bold text-blue-700">{c.caseNumber}</div>
                    <div className="truncate text-xs text-slate-800">{c.title}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Evidence Integrity Status Indicator */}
          <div 
            onClick={() => onTabChange('evidence_vault')}
            className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all ${
              tamperSimulated 
                ? 'bg-red-50 text-red-700 border-red-200 font-semibold' 
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
            title="Evidence Merkle audit status"
          >
            {tamperSimulated ? (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span className="hidden sm:inline">Tamper Alert</span>
                <span className="sm:hidden font-bold">Alert</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="hidden sm:inline">Evidence Verified</span>
                <span className="sm:hidden">Verified</span>
              </>
            )}
          </div>

          {/* Dataset Switcher Button */}
          <button
            id="btn-dataset-switcher"
            onClick={onOpenDatasetModal}
            className="px-3 py-1.5 text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-medium flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Database className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden md:inline font-mono">{dataset.codeName}</span>
          </button>

          {/* Live Alerts Notification button */}
          <button
            id="btn-notifications-drawer"
            onClick={onOpenNotifications}
            className="relative p-2 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors shadow-xs"
            title="Investigation Alerts"
          >
            <Bell className="w-4 h-4" />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-white">
                {unreadAlertsCount}
              </span>
            )}
          </button>

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          {/* Officer Profile Dropdown & Logout Menu */}
          <div className="relative">
            <button
              id="btn-user-profile-menu"
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="flex items-center gap-2.5 pl-1 py-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold font-mono shadow-xs">
                {user?.full_name ? user.full_name.split(' ').map(n => n[0]).join('') : 'SM'}
              </div>
              <div className="leading-tight hidden md:block text-left">
                <div className="text-xs font-semibold text-slate-900">{user?.full_name || 'Sgt. Miller'}</div>
                <div className="text-[10px] text-slate-500 font-mono">{user?.badge_number || 'Badge #4412'}</div>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" />
            </button>

            {profileMenuOpen && (
              <div className="absolute top-full mt-1.5 right-0 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 space-y-1 text-slate-900">
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <div className="text-xs font-bold text-slate-900">{user?.full_name || 'Sgt. Miller'}</div>
                  <div className="text-[11px] text-slate-500">{user?.email || 'miller@agency.gov'}</div>
                  <div className="text-[10px] font-mono text-blue-600 mt-0.5">{user?.role || 'Senior Investigator'}</div>
                </div>
                <button
                  id="btn-logout"
                  onClick={async () => {
                    setProfileMenuOpen(false);
                    await logout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4 text-red-600" />
                  <span>Sign Out / Lock Session</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ----------------- BREADCRUMB NAVIGATION TRAIL ----------------- */}
      <BreadcrumbTrail
        currentTab={currentTab}
        onTabChange={onTabChange}
        dataset={dataset}
        selectedCaseId={selectedCaseId}
        onSelectCaseId={onSelectCaseId}
        activeEntityId={activeEntityId}
        onSelectEntity={onSelectEntity}
        onOpenEntityDossier={onOpenEntityDossier}
        onGoBack={onGoBack}
        canGoBack={canGoBack}
      />

      {/* ----------------- MAIN LAYOUT (SIDEBAR + WORKSPACE) ----------------- */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Navigation */}
        <aside 
          id="main-sidebar-navigation"
          className="w-64 shrink-0 bg-[#202833] flex flex-col justify-between py-4 overflow-y-auto hidden md:flex text-[#B8BEC7] select-none shadow-md"
        >
          <div className="space-y-6 px-3">
            {/* Header Brand Badge inside Sidebar */}
            <div className="px-3 py-2 bg-[#303945]/60 border border-[#303945] rounded-xl flex items-center gap-3">
              <img src="/rakshak_logo.jpg" alt="RAKSHAK" className="w-9 h-9 object-contain rounded-lg" />
              <div className="leading-tight">
                <div className="font-bold text-sm text-[#FFFFFF] tracking-tight font-mono">RAKSHAK</div>
                <div className="text-[11px] text-[#B8BEC7] font-medium">Crime Records & Intel</div>
              </div>
            </div>

            {/* Navigation Menu Groups */}
            <div className="space-y-5">
              {visibleNavGroups.map((group, gIdx) => (
                <div key={gIdx} className="space-y-1">
                  <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#B8BEC7]">
                    {group.title}
                  </div>
                  {group.items.map(item => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;

                    return (
                      <button
                        key={item.id}
                        id={`nav-item-${item.id}`}
                        onClick={() => onTabChange(item.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          isActive
                            ? 'bg-[#303945] text-[#EAE0C8] font-semibold shadow-xs'
                            : 'text-[#B8BEC7] hover:text-[#FFFFFF] hover:bg-[#303945]/50'
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#EAE0C8]' : 'text-[#B8BEC7]'}`} />
                          <span className="truncate">{item.label}</span>
                        </div>

                        {item.badge !== undefined && (
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full font-semibold ${
                            isActive 
                              ? 'bg-[#202833] text-[#EAE0C8] border border-[#303945]' 
                              : 'bg-[#303945]/40 text-[#B8BEC7] border border-[#303945]/60'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Quick System Status Footer */}
          <div className="px-3 pt-3 mt-6 border-t border-[#303945] text-[11px] text-[#B8BEC7] space-y-2">
            <div className="p-3 bg-[#303945]/30 rounded-xl border border-[#303945] space-y-1.5">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-[#B8BEC7] uppercase font-semibold">SYSTEM STATUS</span>
                <span className="text-[#EAE0C8] font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#EAE0C8] animate-pulse" />
                  ONLINE
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-[#B8BEC7]">
                <span>Ingested Feeds:</span>
                <span className="text-[#FFFFFF] font-mono font-semibold">{dataset.healthReport.totalRecords}</span>
              </div>
              <div className="flex justify-between text-[11px] text-[#B8BEC7]">
                <span>Active Targets:</span>
                <span className="text-[#FFFFFF] font-mono font-semibold">{dataset.entities.length}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Horizontal Navigation Tabs */}
        <div className="md:hidden flex overflow-x-auto bg-[#202833] border-b border-[#303945] px-2 py-2 gap-1.5 shrink-0">
          {navGroups.flatMap(g => g.items).map(item => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`px-3 py-1.5 text-xs whitespace-nowrap rounded-lg font-medium transition-colors ${
                currentTab === item.id ? 'bg-[#303945] text-[#EAE0C8] font-semibold' : 'text-[#B8BEC7] bg-[#303945]/50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Primary View Workspace Canvas */}
        <main className="flex-1 overflow-y-auto bg-[var(--color-bg-base)] relative">
          <div className="absolute inset-0 tactical-grid-bg pointer-events-none opacity-40 z-0" />
          <div className="relative z-10 p-4 md:p-6 lg:p-8 animate-in fade-in duration-300 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};


