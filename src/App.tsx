import React, { useState } from 'react';
import { 
  AppShell, 
  NavigationTab 
} from './components/layout/AppShell';
import { 
  InvestigationDataset, 
  createPhantomLedgerDataset 
} from './services/datasetNormalizer';
import { Entity } from './types/investigation';

// Views
import { DashboardView } from './views/DashboardView';
import { InvestigateView } from './views/InvestigateView';
import { CasesView } from './views/CasesView';
import { EntitiesView } from './views/EntitiesView';
import { CompareView } from './views/CompareView';
import { KnowledgeGraphView } from './views/KnowledgeGraphView';
import { EvidenceVaultView } from './views/EvidenceVaultView';
import { TimelineView } from './views/TimelineView';
import { TelecomView } from './views/TelecomView';
import { FinancialView } from './views/FinancialView';
import { AnomalyRadarView } from './views/AnomalyRadarView';
import { DataHealthView } from './views/DataHealthView';
import { AiCopilotView } from './views/AiCopilotView';

// Modals
import { EntityDossierModal } from './components/modals/EntityDossierModal';
import { DatasetUploadModal } from './components/modals/DatasetUploadModal';
import { NotificationDrawer } from './components/modals/NotificationDrawer';

import { 
  fetchRealCases, 
  fetchRealEntities, 
  fetchAnalyticsSummary,
  fetchEvidenceList,
  fetchTimelineEvents,
  fetchCDRs,
  fetchTransactions,
  fetchGraphTopology,
  fetchAnomalies
} from './services/apiService';

import { LoginView } from './views/LoginView';
import { AuthProvider, useAuth } from './context/AuthContext';

export function getEntityTypeFromId(id: string): any {
  if (!id) return 'person';
  const u = id.toUpperCase();
  if (u.startsWith('PHONE-')) return 'phone';
  if (u.startsWith('PERSON-')) return 'person';
  if (u.startsWith('ACCT-')) return 'account';
  if (u.startsWith('VEH-')) return 'vehicle';
  if (u.startsWith('ORG-')) return 'organization';
  if (u.startsWith('CASE-')) return 'case';
  if (u.startsWith('DEVICE-')) return 'device';
  if (u.startsWith('LOC-')) return 'location';
  return 'person';
}

function MainAppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [dataset, setDataset] = useState<InvestigationDataset>(createPhantomLedgerDataset());
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set());
  const [summaryData, setSummaryData] = useState<any>(null);

  // Fetch summary analytics whenever selectedCaseId changes
  React.useEffect(() => {
    if (!isAuthenticated) return;
    const controller = new AbortController();
    fetchAnalyticsSummary(selectedCaseId || undefined, controller.signal).then(summary => {
      if (!controller.signal.aborted && summary) {
        setSummaryData(summary);
      }
    });
    return () => {
      controller.abort();
    };
  }, [isAuthenticated, selectedCaseId]);

  // Initial demo dataset loading on login
  React.useEffect(() => {
    if (!isAuthenticated) return;
    fetchRealCases(150).then(realCases => {
      if (realCases?.length) {
        setDataset(prev => ({ ...prev, cases: realCases }));
      }
    });
    fetchRealEntities(200).then(realEntities => {
      if (realEntities?.length) {
        setDataset(prev => ({ ...prev, entities: realEntities }));
      }
    });
    fetchAnalyticsSummary().then(analytics => {
      if (analytics?.totalRecords) {
        setDataset(prev => ({
          ...prev,
          healthReport: {
            ...prev.healthReport,
            totalRecords: analytics.totalRecords,
          },
        }));
      }
    });
    fetchAnomalies(200).then(anoms => {
      if (anoms?.length) {
        setDataset(prev => ({ ...prev, anomalies: anoms }));
      }
    });
    fetchEvidenceList(200).then(evis => {
      if (evis?.length) {
        setDataset(prev => ({ ...prev, evidenceRecords: evis }));
      }
    });
    fetchCDRs(200).then(cdrs => {
      if (cdrs?.length) {
        setDataset(prev => ({ ...prev, cdrRecords: cdrs }));
      }
    });
    fetchTransactions(200).then(txns => {
      if (txns?.length) {
        setDataset(prev => ({ ...prev, transactions: txns }));
      }
    });
    fetchTimelineEvents(200).then(evts => {
      if (evts?.length) {
        setDataset(prev => ({ ...prev, timelineEvents: evts }));
      }
    });
  }, [isAuthenticated]);

  // Lazy per-tab data loading: fetch module data when tab is first opened
  React.useEffect(() => {
    if (!isAuthenticated) return;
    if (loadedTabs.has(currentTab)) return;

    const markLoaded = () => setLoadedTabs(prev => new Set(prev).add(currentTab));

    switch (currentTab) {
      case 'anomalies':
        fetchAnomalies(200, selectedCaseId || undefined).then(data => {
          if (data?.length) setDataset(prev => ({ ...prev, anomalies: data }));
          markLoaded();
        });
        break;
      case 'evidence_vault':
        fetchEvidenceList(200).then(data => {
          if (data?.length) setDataset(prev => ({ ...prev, evidenceRecords: data }));
          markLoaded();
        });
        break;
      case 'timeline':
        fetchTimelineEvents(200).then(data => {
          if (data?.length) setDataset(prev => ({ ...prev, timelineEvents: data }));
          markLoaded();
        });
        break;
      case 'telecom':
        fetchCDRs(200).then(data => {
          if (data?.length) setDataset(prev => ({ ...prev, cdrRecords: data }));
          markLoaded();
        });
        break;
      case 'financial':
        fetchTransactions(200).then(data => {
          if (data?.length) setDataset(prev => ({ ...prev, transactions: data }));
          markLoaded();
        });
        break;
      case 'knowledge_graph':
        fetchGraphTopology(150, graphFocusEntityId || undefined).then(realGraph => {
          if (realGraph?.nodes?.length) {
            setDataset(prev => {
              const next = { ...prev };
              next.relationships = realGraph.edges.map((e: any) => ({
                id: e.id,
                source: e.source,
                target: e.target,
                relationType: e.type || e.relationType || 'LINKED',
                confidence: e.confidence || 0.95,
              }));
              const existingEntityIds = new Set(next.entities.map(e => e.id));
              realGraph.nodes.forEach((gn: any) => {
                if (!existingEntityIds.has(gn.id)) {
                  existingEntityIds.add(gn.id);
                  next.entities.push({
                    id: gn.id,
                    name: gn.name || gn.id,
                    type: gn.type || getEntityTypeFromId(gn.id),
                    flaggedRisk: gn.flaggedRisk || 'MEDIUM',
                    attributes: gn.attributes || { id: gn.id },
                  });
                }
              });
              return next;
            });
          }
          markLoaded();
        });
        break;
      default:
        break;
    }
  }, [isAuthenticated, currentTab, loadedTabs]);

  // Modal & Focus States (Declared unconditionally at top of component per React Rules of Hooks)
  const [selectedEntityIdForDossier, setSelectedEntityIdForDossier] = useState<string | null>(null);
  const [activeEntityId, setActiveEntityId] = useState<string | null>(null);
  const [compareEntityIdA, setCompareEntityIdA] = useState<string | null>(null);
  const [compareEntityIdB, setCompareEntityIdB] = useState<string | null>(null);
  const [graphFocusEntityId, setGraphFocusEntityId] = useState<string | null>(null);

  // Navigation History Stack for Back traversal
  const [historyStack, setHistoryStack] = useState<Array<{
    tab: NavigationTab;
    caseId: string | null;
    entityId: string | null;
  }>>([]);

  const [tamperSimulated, setTamperSimulated] = useState<boolean>(false);
  const [datasetModalOpen, setDatasetModalOpen] = useState<boolean>(false);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#151A21] flex flex-col items-center justify-center text-white font-sans">
        <div className="flex items-center gap-3 mb-4">
          <img src="/rakshak_logo.jpg" alt="RAKSHAK" className="w-10 h-10 object-contain rounded-xl bg-white p-1" />
          <span className="text-2xl font-bold font-mono tracking-tight">RAKSHAK</span>
        </div>
        <div className="text-xs text-slate-400 font-mono">Verifying Investigator Access & Session Status...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  // Selected entity object for dossier modal
  const selectedEntity = selectedEntityIdForDossier
    ? (dataset.entities.find(e => e.id === selectedEntityIdForDossier) || {
        id: selectedEntityIdForDossier,
        name: selectedEntityIdForDossier,
        type: getEntityTypeFromId(selectedEntityIdForDossier),
        attributes: { id: selectedEntityIdForDossier },
        confidence: 1,
        sourceCount: 1,
        linkedCaseIds: []
      })
    : null;

  // Push to history when state changes
  const recordNavigation = (newTab: NavigationTab, newCaseId: string | null, newEntityId: string | null) => {
    setHistoryStack(prev => {
      const last = prev[prev.length - 1];
      if (last && last.tab === currentTab && last.caseId === selectedCaseId && last.entityId === activeEntityId) {
        return prev;
      }
      return [...prev.slice(-25), { tab: currentTab, caseId: selectedCaseId, entityId: activeEntityId }];
    });
  };

  const handleTabChange = (newTab: NavigationTab) => {
    if (newTab !== currentTab) {
      recordNavigation(newTab, selectedCaseId, activeEntityId);
      setCurrentTab(newTab);
    }
  };

  const handleSelectCaseId = (caseId: string | null) => {
    if (caseId !== selectedCaseId) {
      setLoadedTabs(new Set());
      recordNavigation(currentTab, caseId, activeEntityId);
      setSelectedCaseId(caseId);
    }
  };

  const handleOpenInGraph = (entityId: string) => {
    recordNavigation('knowledge_graph', selectedCaseId, entityId);
    setGraphFocusEntityId(entityId);
    setActiveEntityId(entityId);
    fetchGraphTopology(150, entityId).then(realGraph => {
      if (realGraph?.nodes?.length) {
        setDataset(prev => ({
          ...prev,
          relationships: realGraph.edges.map((e: any) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            relationType: e.type || e.relationType || 'LINKED',
            confidence: e.confidence || 0.95,
          })),
          entities: [
            ...prev.entities,
            ...realGraph.nodes.filter((gn: any) => !prev.entities.some(e => e.id === gn.id)).map((gn: any) => ({
              id: gn.id,
              name: gn.name || gn.id,
              type: gn.type || getEntityTypeFromId(gn.id),
              flaggedRisk: gn.flaggedRisk || 'MEDIUM',
              attributes: gn.attributes || { id: gn.id },
            }))
          ]
        }));
      }
    });
    setCurrentTab('knowledge_graph');
  };

  const handleOpenInCompare = (entityId: string) => {
    recordNavigation('compare', selectedCaseId, entityId);
    setCompareEntityIdA(entityId);
    setActiveEntityId(entityId);
    setCurrentTab('compare');
  };

  const handleSelectEntity = (entityId: string | null) => {
    if (entityId) {
      recordNavigation(currentTab, selectedCaseId, entityId);
      setSelectedEntityIdForDossier(entityId);
      setActiveEntityId(entityId);
    } else {
      setSelectedEntityIdForDossier(null);
      setActiveEntityId(null);
    }
  };

  const handleGoBack = () => {
    if (historyStack.length === 0) return;
    const previous = historyStack[historyStack.length - 1];
    setHistoryStack(prev => prev.slice(0, -1));
    setCurrentTab(previous.tab);
    setSelectedCaseId(previous.caseId);
    setActiveEntityId(previous.entityId);
    if (previous.entityId) {
      setSelectedEntityIdForDossier(previous.entityId);
    } else {
      setSelectedEntityIdForDossier(null);
    }
  };

  const handleToggleTamper = () => {
    setTamperSimulated(!tamperSimulated);
  };

  const unreadAlertsCount = (dataset.anomalies || []).filter(a => a.severity === 'CRITICAL' || a.severity === 'HIGH').length + (tamperSimulated ? 1 : 0);

  return (
    <>
      <AppShell
      currentTab={currentTab}
      onTabChange={handleTabChange}
      dataset={dataset}
      selectedCaseId={selectedCaseId}
      onSelectCaseId={handleSelectCaseId}
      activeEntityId={activeEntityId}
      onSelectEntity={handleSelectEntity}
      onOpenEntityDossier={(entityId) => setSelectedEntityIdForDossier(entityId)}
      onGoBack={handleGoBack}
      canGoBack={historyStack.length > 0}
      tamperSimulated={tamperSimulated}
      onOpenDatasetModal={() => setDatasetModalOpen(true)}
      onOpenNotifications={() => setNotificationsOpen(true)}
      unreadAlertsCount={unreadAlertsCount}
      summaryData={summaryData}
    >
      {/* Dynamic View Switcher */}
      {currentTab === 'dashboard' && (
        <DashboardView
          dataset={dataset}
          selectedCaseId={selectedCaseId}
          onSelectCaseId={handleSelectCaseId}
          onNavigateTab={handleTabChange}
          onSelectEntity={handleSelectEntity}
          tamperSimulated={tamperSimulated}
          summaryData={summaryData}
        />
      )}

      {currentTab === 'investigate' && (
        <InvestigateView
          dataset={dataset}
          onSelectEntity={handleSelectEntity}
          onNavigateTab={handleTabChange}
          onOpenInGraph={handleOpenInGraph}
          onOpenInCompare={handleOpenInCompare}
        />
      )}

      {currentTab === 'cases' && (
        <CasesView
          dataset={dataset}
          selectedCaseId={selectedCaseId}
          onSelectCaseId={handleSelectCaseId}
          onSelectEntity={handleSelectEntity}
          onNavigateTab={handleTabChange}
        />
      )}

      {currentTab === 'entities' && (
        <EntitiesView
          dataset={dataset}
          selectedCaseId={selectedCaseId}
          onSelectEntity={handleSelectEntity}
          onOpenInGraph={handleOpenInGraph}
          onOpenInCompare={handleOpenInCompare}
        />
      )}

      {currentTab === 'compare' && (
        <CompareView
          dataset={dataset}
          selectedCaseId={selectedCaseId}
          preselectedEntityIdA={compareEntityIdA}
          preselectedEntityIdB={compareEntityIdB}
          onSelectEntity={handleSelectEntity}
        />
      )}

      {currentTab === 'knowledge_graph' && (
        <KnowledgeGraphView
          dataset={dataset}
          selectedCaseId={selectedCaseId}
          focusedEntityId={graphFocusEntityId}
          onSelectEntity={handleSelectEntity}
        />
      )}

      {currentTab === 'evidence_vault' && (
        <EvidenceVaultView
          dataset={dataset}
          selectedCaseId={selectedCaseId}
          onSelectCaseId={handleSelectCaseId}
          tamperSimulated={tamperSimulated}
          onToggleTamper={handleToggleTamper}
        />
      )}

      {currentTab === 'timeline' && (
        <TimelineView
          dataset={dataset}
          selectedCaseId={selectedCaseId}
          onSelectCaseId={handleSelectCaseId}
          onSelectEntity={handleSelectEntity}
        />
      )}

      {currentTab === 'telecom' && (
        <TelecomView
          dataset={dataset}
          selectedCaseId={selectedCaseId}
          onSelectCaseId={handleSelectCaseId}
          onSelectEntity={handleSelectEntity}
        />
      )}

      {currentTab === 'financial' && (
        <FinancialView
          dataset={dataset}
          selectedCaseId={selectedCaseId}
          onSelectCaseId={handleSelectCaseId}
          onSelectEntity={handleSelectEntity}
        />
      )}

      {currentTab === 'anomaly_radar' && (
        <AnomalyRadarView
          dataset={dataset}
          selectedCaseId={selectedCaseId}
          onSelectCaseId={handleSelectCaseId}
          onSelectEntity={handleSelectEntity}
        />
      )}

      {currentTab === 'data_health' && (
        <DataHealthView
          dataset={dataset}
          onOpenDatasetModal={() => setDatasetModalOpen(true)}
        />
      )}

      {currentTab === 'ai_copilot' && (
        <AiCopilotView
          dataset={dataset}
          selectedCaseId={selectedCaseId}
          onSelectEntity={handleSelectEntity}
        />
      )}
    </AppShell>

      {/* Entity Dossier Modal */}
      {selectedEntity && (
        <EntityDossierModal
          entity={selectedEntity}
          onClose={() => {
            setSelectedEntityIdForDossier(null);
          }}
          allRelationships={dataset.relationships}
          allEntities={dataset.entities}
          allCases={dataset.cases}
          allEvidence={dataset.evidenceRecords}
          allCdrs={dataset.cdrRecords}
          allTransactions={dataset.transactions}
          onSelectEntity={handleSelectEntity}
          onOpenInGraph={handleOpenInGraph}
          onOpenInCompare={handleOpenInCompare}
        />
      )}

      {/* Dataset Ingestion Modal */}
      {datasetModalOpen && (
        <DatasetUploadModal
          currentDataset={dataset}
          onSelectDataset={(newDataset) => {
            setDataset(newDataset);
            setSelectedCaseId(null);
            setActiveEntityId(null);
          }}
          onClose={() => setDatasetModalOpen(false)}
        />
      )}

      {/* Live Alerts Notification Drawer */}
      <NotificationDrawer
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        anomalies={dataset.anomalies}
        tamperAlert={tamperSimulated}
        onNavigateToAnomalies={() => handleTabChange('anomaly_radar')}
      />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}

