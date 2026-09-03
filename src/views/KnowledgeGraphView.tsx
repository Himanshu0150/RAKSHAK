import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { 
  GitBranch, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Layers, 
  Shield, 
  Activity, 
  MapPin, 
  ArrowRight, 
  Lock, 
  Sliders, 
  Filter,
  Eye,
  Info,
  Maximize2,
  Download,
  AlertTriangle,
  FileText,
  DollarSign,
  Building2,
  Phone,
  CreditCard,
  Flag,
  Share2,
  FileCheck2,
  CheckCircle2,
  Clock,
  Sparkles,
  Loader2
} from 'lucide-react';
import { InvestigationDataset } from '../services/datasetNormalizer';
import { 
  calculateDegreeCentrality, 
  calculateBetweennessCentrality, 
  detectCommunities,
  findShortestPathWithEvidence
} from '../services/graphEngine';
import { Entity, Relationship } from '../types/investigation';
import { fetchGraphTopology, fetchEntityDossier, fetchCaseRelatedPersons, traceGraphPath } from '../services/apiService';

interface KnowledgeGraphViewProps {
  dataset: InvestigationDataset;
  focusedEntityId?: string | null;
  selectedCaseId?: string | null;
  onSelectEntity: (entityId: string) => void;
}

function getEntityTypeFromId(id: string): any {
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

export const KnowledgeGraphView: React.FC<KnowledgeGraphViewProps> = ({
  dataset,
  focusedEntityId,
  selectedCaseId,
  onSelectEntity
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [highlightBridges, setHighlightBridges] = useState<boolean>(false);
  const [colorByCommunity, setColorByCommunity] = useState<boolean>(false);
  const [selectedRelationType, setSelectedRelationType] = useState<string>('ALL');
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    focusedEntityId || null
  );
  
  const [graphData, setGraphData] = useState<{ nodes: Entity[]; relationships: Relationship[] }>({
    nodes: [],
    relationships: []
  });
  const [dossierData, setDossierData] = useState<any | null>(null);
  const [isLoadingGraph, setIsLoadingGraph] = useState<boolean>(false);

  useEffect(() => {
    if (focusedEntityId && focusedEntityId !== selectedNodeId) {
      setSelectedNodeId(focusedEntityId);
    }
  }, [focusedEntityId]);

  // Dynamic API fetch whenever focus_id / selectedNodeId / selectedCaseId / selectedRelationType changes
  useEffect(() => {
    const controller = new AbortController();
    setIsLoadingGraph(true);

    // Clear old graph state and intelligence state while loading new context
    setGraphData({ nodes: [], relationships: [] });
    setDossierData(null);

    Promise.all([
      fetchGraphTopology(150, selectedNodeId || undefined, selectedCaseId || undefined, selectedRelationType !== 'ALL' ? selectedRelationType : undefined, controller.signal),
      selectedNodeId ? fetchEntityDossier(selectedNodeId, selectedCaseId || undefined, controller.signal) : Promise.resolve(null)
    ]).then(([topologyRes, dossierRes]) => {
      if (controller.signal.aborted) return;

      if (topologyRes && (topologyRes.nodes || topologyRes.edges)) {
        const nodes: Entity[] = (topologyRes.nodes || []).map((gn: any) => ({
          id: gn.id,
          name: gn.name || gn.id,
          type: gn.type || getEntityTypeFromId(gn.id),
          flaggedRisk: gn.flaggedRisk || 'MEDIUM',
          attributes: gn.attributes || { id: gn.id }
        }));
        const relationships: Relationship[] = (topologyRes.edges || []).map((ge: any) => ({
          id: ge.id,
          source: ge.source,
          target: ge.target,
          relationType: ge.type || ge.relationType || 'LINKED',
          confidence: ge.confidence || 0.95
        }));
        setGraphData({ nodes, relationships });
      }

      if (dossierRes) {
        setDossierData(dossierRes);
      }

      if (!controller.signal.aborted) {
        setIsLoadingGraph(false);
      }
    }).catch(err => {
      if (!controller.signal.aborted) {
        console.error('Error loading graph topology and dossier:', err);
        setGraphData({ nodes: [], relationships: [] });
        setDossierData(null);
        setIsLoadingGraph(false);
      }
    });

    return () => {
      controller.abort();
    };
  }, [selectedNodeId, selectedCaseId, selectedRelationType]);

  // Available relation types extracted dynamically
  const availableRelationTypes = useMemo(() => {
    const typesSet = new Set<string>();
    graphData.relationships.forEach(r => {
      const t = r.relationType || (r as any).type || (r as any).relationship_type;
      if (t) typesSet.add(t.toUpperCase());
    });
    ['CALLED', 'TRANSFERRED_FUNDS', 'ASSOCIATE_OF', 'MEMBER_OF', 'SIGHTED_AT', 'OWNER_OF', 'FAMILY'].forEach(t => typesSet.add(t));
    return Array.from(typesSet).sort();
  }, [graphData.relationships]);

  // Active dataset for D3 graph - strictly from real API response (Requirements 1, 2, 4, 15)
  const activeEntities = useMemo(() => {
    return graphData.nodes;
  }, [graphData.nodes]);

  const activeRelationships = useMemo(() => {
    const rawRels = graphData.relationships;
    if (!selectedRelationType || selectedRelationType === 'ALL') return rawRels;
    return rawRels.filter(r => {
      const t = (r.relationType || (r as any).type || (r as any).relationship_type || '').toUpperCase();
      return t === selectedRelationType.toUpperCase();
    });
  }, [graphData.relationships, selectedRelationType]);

  // Case-Scoped Persons State (Requirements 1-13)
  const [casePersons, setCasePersons] = useState<Array<{ id: string; person_id: string; name: string; displayName: string }>>([]);
  const [pathSourceId, setPathSourceId] = useState<string>('');
  const [pathTargetId, setPathTargetId] = useState<string>('');
  const [activePath, setActivePath] = useState<{ pathNodeIds: string[]; pathLinks: Relationship[] } | null>(null);
  const [isTracing, setIsTracing] = useState<boolean>(false);
  const [traceStatusMessage, setTraceStatusMessage] = useState<string | null>(null);

  // Target person options MUST exclude the currently selected pathSourceId (Requirement 7)
  const targetOptions = useMemo(() => {
    if (!pathSourceId) return casePersons;
    return casePersons.filter(p => p.id !== pathSourceId);
  }, [casePersons, pathSourceId]);

  // Immediate reset when selectedCaseId changes (Requirement 10, 12)
  const prevCaseIdRef = useRef<string | null>(selectedCaseId || null);

  useEffect(() => {
    if (prevCaseIdRef.current !== selectedCaseId) {
      prevCaseIdRef.current = selectedCaseId || null;
      setSelectedNodeId(null);
      setPathSourceId('');
      setPathTargetId('');
      setActivePath(null);
      setTraceStatusMessage(null);
      setCasePersons([]);
      setGraphData({ nodes: [], relationships: [] });
    }
  }, [selectedCaseId]);

  // Fetch case/person-scoped related persons from real MongoDB relationships (Requirements 1-13)
  useEffect(() => {
    const controller = new AbortController();
    fetchCaseRelatedPersons(selectedCaseId || undefined, selectedNodeId || undefined, controller.signal)
      .then(personsList => {
        if (controller.signal.aborted) return;
        setCasePersons(personsList);

        if (personsList.length > 0) {
          const isSelectedValid = selectedNodeId && personsList.some(p => p.id === selectedNodeId);
          if (!isSelectedValid) {
            setSelectedNodeId(personsList[0].id);
          }

          const srcId = pathSourceId && personsList.some(p => p.id === pathSourceId) ? pathSourceId : personsList[0].id;
          setPathSourceId(srcId);

          const validTargets = personsList.filter(p => p.id !== srcId);
          const tgtId = pathTargetId && validTargets.some(p => p.id === pathTargetId) ? pathTargetId : (validTargets[0]?.id || '');
          setPathTargetId(tgtId);
        } else {
          setPathSourceId('');
          setPathTargetId('');
        }
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          console.error('Error fetching case related persons:', err);
          setCasePersons([]);
          setPathSourceId('');
          setPathTargetId('');
          setActivePath(null);
        }
      });

    return () => controller.abort();
  }, [selectedCaseId, selectedNodeId]);

  // Zoom reference
  const zoomRef = useRef<any>(null);

  // Centrality & community calculations
  const degreeMap = useMemo(() => calculateDegreeCentrality(activeEntities, activeRelationships), [activeEntities, activeRelationships]);
  const betweennessMap = useMemo(() => calculateBetweennessCentrality(activeEntities, activeRelationships), [activeEntities, activeRelationships]);
  const communityMap = useMemo(() => detectCommunities(activeEntities, activeRelationships), [activeEntities, activeRelationships]);

  const selectedEntity = useMemo(() => {
    return activeEntities.find(e => e.id === selectedNodeId) || 
      (dossierData?.entity ? {
        id: dossierData.entity.id,
        name: dossierData.entity.name,
        type: dossierData.entity.type || getEntityTypeFromId(dossierData.entity.id),
        flaggedRisk: dossierData.entity.flaggedRisk || 'MEDIUM',
        attributes: dossierData.entity.attributes || {}
      } : null);
  }, [activeEntities, selectedNodeId, dossierData]);

  // Real Backend Path Trace Handler (Requirement 5, 6, 7, 8, 9, 10)
  const handleFindPath = async () => {
    if (!pathSourceId || !pathTargetId) return;
    setIsTracing(true);
    setTraceStatusMessage(null);

    try {
      const res = await traceGraphPath(pathSourceId, pathTargetId, selectedCaseId || undefined);
      if (res && res.found) {
        setActivePath({
          pathNodeIds: res.pathNodeIds || [],
          pathLinks: (res.pathLinks || []).map((l: any) => ({
            id: l.id,
            source: l.source,
            target: l.target,
            relationType: l.relationType || 'LINKED',
            confidence: l.confidence || 0.95
          }))
        });
        setTraceStatusMessage(null);
      } else {
        setActivePath(null);
        // Requirement 8: "No verified relationship path found for this case."
        setTraceStatusMessage(res?.message || 'No verified relationship path found for this case.');
      }
    } catch (err) {
      setActivePath(null);
      setTraceStatusMessage('No verified relationship path found for this case.');
    } finally {
      setIsTracing(false);
    }
  };

  // Zoom controls
  const handleZoomIn = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy, 1.3);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy, 0.7);
    }
  };

  const handleResetZoom = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().call(zoomRef.current.transform, d3.zoomIdentity);
    }
  };

  // Node styling helper
  const getNodeColor = (entity: Entity) => {
    if (entity.flaggedRisk === 'CRITICAL') return '#DC2626'; // Red
    if (entity.flaggedRisk === 'HIGH') return '#EA580C'; // Orange
    if (entity.type === 'account' || entity.type === 'organization') return '#2563EB'; // Blue
    if (entity.type === 'phone') return '#0284C7'; // Cyan
    return '#475569'; // Slate
  };

  // D3 Graph Simulation
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = 580;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous render

    svg.attr('width', width).attr('height', height);

    if (isLoadingGraph) return;

    // Zoom container
    const g = svg.append('g').attr('class', 'graph-container');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    zoomRef.current = zoom;
    svg.call(zoom);

    // Prepare D3 simulation nodes & links defensibly
    const rawEntities = [...(activeEntities || [])];
    const entityIdSet = new Set(rawEntities.map(e => e.id));

    // Auto-create lightweight placeholder nodes for any link targets/sources not in activeEntities
    (activeRelationships || []).forEach(l => {
      const src = typeof l.source === 'object' ? (l.source as any).id : (l.source || (l as any).source_entity_id);
      const tgt = typeof l.target === 'object' ? (l.target as any).id : (l.target || (l as any).target_entity_id);
      if (src && typeof src === 'string' && !entityIdSet.has(src)) {
        entityIdSet.add(src);
        rawEntities.push({
          id: src,
          name: src,
          type: src.startsWith('PHONE') ? 'phone' : src.startsWith('VEH') ? 'vehicle' : src.startsWith('ACCT') ? 'account' : 'person',
          flaggedRisk: 'LOW',
          attributes: { id: src }
        });
      }
      if (tgt && typeof tgt === 'string' && !entityIdSet.has(tgt)) {
        entityIdSet.add(tgt);
        rawEntities.push({
          id: tgt,
          name: tgt,
          type: tgt.startsWith('PHONE') ? 'phone' : tgt.startsWith('VEH') ? 'vehicle' : tgt.startsWith('ACCT') ? 'account' : 'person',
          flaggedRisk: 'LOW',
          attributes: { id: tgt }
        });
      }
    });

    const d3Nodes = rawEntities.map(d => ({
      ...d,
      degree: degreeMap.get(d.id) || 1,
      betweenness: betweennessMap.get(d.id) || 0
    }));

    const validNodeIds = new Set(d3Nodes.map(n => n.id));

    const d3Links = (activeRelationships || [])
      .map(l => {
        const srcId = typeof l.source === 'object' ? (l.source as any).id : (l.source || (l as any).source_entity_id);
        const tgtId = typeof l.target === 'object' ? (l.target as any).id : (l.target || (l as any).target_entity_id);
        return {
          ...l,
          source: srcId,
          target: tgtId,
          relationType: l.relationType || (l as any).type || (l as any).relationship_type || 'LINKED'
        };
      })
      .filter(l => l.source && l.target && validNodeIds.has(l.source) && validNodeIds.has(l.target));

    const simulation = d3.forceSimulation(d3Nodes as any)
      .force('link', d3.forceLink(d3Links).id((d: any) => d.id).distance(110))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(36));

    // Arrow markers
    svg.append('defs').selectAll('marker')
      .data(['arrow'])
      .enter().append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 24)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#94A3B8');

    // Draw Links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(d3Links)
      .enter().append('line')
      .attr('stroke', (d: any) => {
        const isPathLink = activePath?.pathLinks.some(pl => 
          (pl.source === d.source.id && pl.target === d.target.id) ||
          (pl.source === d.target.id && pl.target === d.source.id)
        );
        return isPathLink ? '#10B981' : '#CBD5E1';
      })
      .attr('stroke-width', (d: any) => {
        const isPathLink = activePath?.pathLinks.some(pl => 
          (pl.source === d.source.id && pl.target === d.target.id) ||
          (pl.source === d.target.id && pl.target === d.source.id)
        );
        return isPathLink ? 3.5 : 1.5;
      })
      .attr('stroke-dasharray', (d: any) => (d.confidence < 0.6 ? '4 4' : null))
      .attr('marker-end', 'url(#arrow)');

    // Draw Link Labels (relation type)
    const linkText = g.append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(d3Links)
      .enter().append('text')
      .attr('font-size', '8px')
      .attr('font-family', 'ui-monospace, monospace')
      .attr('fill', '#64748B')
      .attr('text-anchor', 'middle')
      .text((d: any) => d.relationType);

    // Draw Nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(d3Nodes)
      .enter().append('g')
      .attr('cursor', 'pointer')
      .call(d3.drag<any, any>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      )
      .on('click', (event, d: any) => {
        setSelectedNodeId(d.id);
      });

    // Node shapes: Rect for Targets, Circles for standard, rounded rect for orgs
    node.each(function(d: any) {
      const el = d3.select(this);
      const isTarget = d.flaggedRisk === 'CRITICAL';
      const isSelected = d.id === selectedNodeId;

      if (isTarget) {
        // Red Target Box with targeting ring
        el.append('rect')
          .attr('x', -16)
          .attr('y', -16)
          .attr('width', 32)
          .attr('height', 32)
          .attr('rx', 4)
          .attr('fill', '#DC2626')
          .attr('stroke', isSelected ? '#1E293B' : '#991B1B')
          .attr('stroke-width', isSelected ? 3 : 1.5)
          .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))');

        el.append('circle')
          .attr('r', 22)
          .attr('fill', 'none')
          .attr('stroke', '#DC2626')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '3 3')
          .attr('opacity', 0.8);
      } else if (d.type === 'organization' || d.type === 'account') {
        el.append('rect')
          .attr('x', -14)
          .attr('y', -14)
          .attr('width', 28)
          .attr('height', 28)
          .attr('rx', 6)
          .attr('fill', '#2563EB')
          .attr('stroke', isSelected ? '#0F172A' : '#1D4ED8')
          .attr('stroke-width', isSelected ? 3 : 1.5);
      } else {
        el.append('circle')
          .attr('r', 14)
          .attr('fill', getNodeColor(d))
          .attr('stroke', isSelected ? '#0F172A' : '#FFFFFF')
          .attr('stroke-width', isSelected ? 3 : 1.5)
          .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))');
      }
    });

    // Node Text Labels
    node.append('text')
      .attr('dy', 26)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .attr('font-family', 'sans-serif')
      .attr('fill', (d: any) => (d.id === selectedNodeId ? '#1E3A8A' : '#1E293B'))
      .text((d: any) => d.name);

    // Node Type Subtext
    node.append('text')
      .attr('dy', 37)
      .attr('text-anchor', 'middle')
      .attr('font-size', '8px')
      .attr('font-family', 'ui-monospace, monospace')
      .attr('fill', '#64748B')
      .text((d: any) => d.id);

    // Simulation Ticks
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      linkText
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [activeEntities, activeRelationships, colorByCommunity, highlightBridges, selectedNodeId, activePath, degreeMap, betweennessMap, communityMap, isLoadingGraph]);

  // Derived Financial Intelligence calculations for selected person
  const totalVolume = useMemo(() => {
    if (!dossierData?.transactions || dossierData.transactions.length === 0) return null;
    return dossierData.transactions.reduce((acc: number, t: any) => acc + (parseFloat(t.amount) || 0), 0);
  }, [dossierData]);

  const accountsList = dossierData?.accounts || [];
  const transactionsList = dossierData?.transactions || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight font-heading">
              Knowledge Graph Topology
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
              {activeEntities.length} Nodes • {activeRelationships.length} Edges
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time topology, cross-border financial conduits, multi-hop entity resolution & betweenness bridges.
          </p>
        </div>

        {/* Analytics Controls & Person Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-2.5 py-1 rounded-lg text-xs font-mono">
            <span className="text-slate-500 font-sans text-[11px]">Focus Person:</span>
            <select
              value={selectedNodeId || ''}
              onChange={(e) => setSelectedNodeId(e.target.value)}
              className="bg-transparent font-bold text-blue-600 focus:outline-none text-xs"
            >
              {casePersons.length > 0 ? (
                casePersons.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.displayName || `${p.name} — ${p.id}`}
                  </option>
                ))
              ) : (
                <option value="">No related persons</option>
              )}
            </select>
          </div>

          {/* Relationship Type Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-2.5 py-1 rounded-lg text-xs font-mono">
            <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="text-slate-500 font-sans text-[11px]">Rel Type:</span>
            <select
              value={selectedRelationType}
              onChange={(e) => setSelectedRelationType(e.target.value)}
              className="bg-transparent font-bold text-blue-600 focus:outline-none text-xs"
            >
              <option value="ALL">All Relationships</option>
              {availableRelationTypes.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setHighlightBridges(!highlightBridges)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
              highlightBridges
                ? 'bg-red-600 text-white font-semibold border-red-600'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Highlight Bridges</span>
          </button>

          <button
            onClick={() => setColorByCommunity(!colorByCommunity)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
              colorByCommunity
                ? 'bg-purple-600 text-white font-semibold border-purple-600'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Louvain Clusters</span>
          </button>
        </div>
      </div>

      {/* Main Grid: D3 Canvas (Left 2 cols) & Financial Intelligence Inspector (Right 1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Tactical Graph Canvas */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div 
            ref={containerRef}
            className="bg-[#F8FAFC] border border-slate-300 rounded-xl overflow-hidden relative min-h-[580px] tactical-grid-bg shadow-sm"
          >
            {/* Loading Overlay */}
            {isLoadingGraph && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-xs z-20 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                <span className="text-xs font-mono text-slate-600 font-semibold">Loading Topology for {selectedNodeId}...</span>
              </div>
            )}

            {/* Top Tactical Overlay Controls */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-xs p-1 rounded-lg border border-slate-300 shadow-sm">
              <button
                onClick={handleZoomIn}
                className="p-1.5 text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleZoomOut}
                className="p-1.5 text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={handleResetZoom}
                className="p-1.5 text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded"
                title="Reset View"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Path Tracing Quick Action in Top Right */}
            <div className="absolute top-3 right-3 z-10 hidden sm:flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-2 bg-white/90 backdrop-blur-xs px-2.5 py-1.5 rounded-lg border border-slate-300 shadow-sm text-xs font-mono">
                <span className="text-slate-500 text-[10px] uppercase font-semibold">Path:</span>
                <select
                  value={pathSourceId}
                  onChange={(e) => {
                    setPathSourceId(e.target.value);
                    setTraceStatusMessage(null);
                  }}
                  className="py-0.5 px-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-800 max-w-[150px] truncate focus:outline-none font-sans"
                >
                  {casePersons.length > 0 ? (
                    casePersons.map(p => (
                      <option key={p.id} value={p.id}>{p.displayName || `${p.name} — ${p.id}`}</option>
                    ))
                  ) : (
                    <option value="">No verified person connections found for this case.</option>
                  )}
                </select>
                <span className="text-slate-400">➔</span>
                <select
                  value={pathTargetId}
                  onChange={(e) => {
                    setPathTargetId(e.target.value);
                    setTraceStatusMessage(null);
                  }}
                  className="py-0.5 px-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-800 max-w-[150px] truncate focus:outline-none font-sans"
                >
                  {targetOptions.length > 0 ? (
                    targetOptions.map(p => (
                      <option key={p.id} value={p.id}>{p.displayName || `${p.name} — ${p.id}`}</option>
                    ))
                  ) : (
                    <option value="">No valid target</option>
                  )}
                </select>
                <button
                  onClick={handleFindPath}
                  disabled={isTracing || !pathSourceId || !pathTargetId || pathSourceId === pathTargetId}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-[11px] font-bold transition-colors flex items-center gap-1 font-sans cursor-pointer disabled:cursor-not-allowed"
                >
                  {isTracing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Trace'}
                </button>
              </div>

              {/* Empty state message when no verified connections exist */}
              {casePersons.length === 0 && !traceStatusMessage && (
                <div className="px-3 py-1 bg-slate-100 border border-slate-300 text-slate-600 rounded-lg text-[11px] font-sans shadow-sm flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>No verified person connections found for this case.</span>
                </div>
              )}

              {/* Requirement 8: Empty state message if no path found */}
              {traceStatusMessage && (
                <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-sans shadow-sm flex items-center gap-1.5 animate-in fade-in">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{traceStatusMessage}</span>
                </div>
              )}
            </div>

            {/* Empty state overlay when no topology edges/nodes exist for selected case */}
            {!isLoadingGraph && activeEntities.length === 0 && (
              <div className="absolute inset-0 bg-slate-50 flex flex-col items-center justify-center gap-2 z-10 text-slate-500 font-sans">
                <Info className="w-8 h-8 text-slate-400" />
                <span className="text-sm font-semibold">No verified network topology relationships found for this case.</span>
                <span className="text-xs text-slate-400 font-mono">Graph nodes and edges are derived directly from real MongoDB records.</span>
              </div>
            )}

            <svg ref={svgRef} className="w-full h-[580px] block" />

            {/* Tactical Legend Matching Image 1 & 2 */}
            <div className="absolute bottom-3 left-3 p-3 bg-white/95 backdrop-blur-xs border border-slate-300 rounded-lg text-xs font-sans text-slate-700 shadow-sm space-y-1.5">
              <div className="font-bold text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                TACTICAL SYMBOLOGY
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-600 inline-block" />
                  <span className="font-semibold text-slate-800">Primary Target</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-600 inline-block" />
                  <span>Known Entity</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block" />
                  <span>Corporate / Bank</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                  <span>High Risk Associate</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Processing Cards Drawer */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 rounded text-blue-600">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs text-slate-900">FIR-2023-1044.pdf</div>
                  <div className="text-[10px] text-slate-400 font-mono">Uploaded 10m ago</div>
                </div>
              </div>
              <span className="px-1.5 py-0.5 text-[9px] font-bold font-mono bg-emerald-100 text-emerald-700 border border-emerald-300 rounded">
                ✓ PARSED
              </span>
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 rounded text-amber-600">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs text-slate-900">SUSPECT_A_TRANS.csv</div>
                  <div className="text-[10px] text-slate-400 font-mono">Processing... 45%</div>
                </div>
              </div>
              <div className="w-12 bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                <div className="bg-amber-500 h-full w-[45%]" />
              </div>
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-50 rounded text-purple-600">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs text-slate-900">NEW_EVIDENCE_DROP.wav</div>
                  <div className="text-[10px] text-slate-400 font-mono">Queued for Ingest</div>
                </div>
              </div>
              <span className="px-1.5 py-0.5 text-[9px] font-bold font-mono bg-slate-100 text-slate-600 rounded">
                QUEUED
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Financial Intelligence Inspector */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-300 rounded-xl shadow-sm overflow-hidden relative">
            {/* Inspector Header */}
            <div className="bg-[#13222E] text-white p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-xs uppercase tracking-wider font-mono">
                  Financial Intelligence
                </span>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-red-600 text-white rounded">
                ! LEVEL 1
              </span>
            </div>

            <div className="p-4 space-y-4 text-slate-800">
              {/* Selected Entity Card */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-200">
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    {dossierData?.entity?.name || selectedEntity?.name || 'Not available'}
                  </h3>
                  <div className="text-xs font-mono text-slate-500">
                    ID: {selectedNodeId || 'Not available'}
                  </div>
                </div>

                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-red-100 text-red-700 border border-red-200 rounded">
                  RISK: {dossierData?.entity?.flaggedRisk || selectedEntity?.flaggedRisk || 'Not available'}
                </span>
              </div>

              {/* Metric Boxes */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] font-mono uppercase text-slate-500 block">TOTAL VOLUME (30D)</span>
                  <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                    {totalVolume !== null 
                      ? `₹${(totalVolume * 83).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                      : 'Not available'}
                  </div>
                  <span className="text-[9px] text-emerald-600 font-mono">
                    {transactionsList.length > 0 ? `${transactionsList.length} Transactions` : 'Not available'}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] font-mono uppercase text-slate-500 block">RISK SCORE</span>
                  <div className="text-lg font-bold text-red-600 font-mono mt-0.5">
                    {dossierData?.stats?.confidenceScore !== undefined 
                      ? `${dossierData.stats.confidenceScore} / 100`
                      : (dossierData?.entity?.confidenceScore !== undefined 
                          ? `${dossierData.entity.confidenceScore} / 100` 
                          : 'Not available')}
                  </div>
                  <span className="text-[9px] text-red-600 font-mono">
                    {dossierData?.entity?.flaggedRisk 
                      ? `${dossierData.entity.flaggedRisk} Risk` 
                      : 'Not available'}
                  </span>
                </div>
              </div>

              {/* Known Accounts */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block font-mono text-[11px]">
                  Known Accounts
                </span>
                <div className="space-y-1.5 text-xs font-mono">
                  {accountsList.length > 0 ? (
                    accountsList.slice(0, 5).map((acc: any, idx: number) => (
                      <div key={acc.account_id || idx} className="p-2 bg-slate-50 border border-slate-200 rounded flex justify-between items-center">
                        <div>
                          <span className="font-semibold text-slate-900 block">
                            {acc.institution_type || acc.bank_name || acc.account_type || 'Bank Account'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {acc.account_type || acc.status || 'Account'}
                          </span>
                        </div>
                        <span className="font-mono text-slate-600 text-[11px]">
                          {acc.masked_identifier || acc.account_id || 'Not available'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded text-center text-slate-400 font-mono text-xs">
                      Not available
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Transactions Table */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block font-mono text-[11px]">
                  Recent Transactions
                </span>
                <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 border-b border-slate-200 text-[10px] font-mono text-slate-500 uppercase">
                      <tr>
                        <th className="py-1.5 px-2">Date/Time</th>
                        <th className="py-1.5 px-2">Entity</th>
                        <th className="py-1.5 px-2 text-right">Amount</th>
                        <th className="py-1.5 px-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {transactionsList.length > 0 ? (
                        transactionsList.slice(0, 5).map((t: any, idx: number) => {
                          const amt = parseFloat(t.amount) || 0;
                          return (
                            <tr key={t.transaction_id || idx} className="hover:bg-slate-50">
                              <td className="py-1.5 px-2 text-slate-500">
                                {t.timestamp ? t.timestamp.replace('T', ' ').slice(5, 16) : (t.transaction_date || 'N/A')}
                              </td>
                              <td className="py-1.5 px-2 font-semibold text-slate-800 truncate max-w-[90px]">
                                {t.destination_account_id || t.source_account_id || t.transaction_id || 'Counterparty'}
                              </td>
                              <td className={`py-1.5 px-2 text-right font-bold ${amt >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {amt >= 0 ? `+₹${(amt * 83).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `-₹${(Math.abs(amt) * 83).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                              </td>
                              <td className="py-1.5 px-2 text-center">
                                <span className={`w-2 h-2 rounded-full inline-block ${amt > 50000 ? 'bg-red-500' : 'bg-emerald-500'}`} />
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-3 text-center text-slate-400 font-mono text-xs">
                            Not available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons matching Image 1 & 2 */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                <button
                  onClick={() => selectedNodeId && onSelectEntity(selectedNodeId)}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition-colors shadow"
                >
                  Generate Report
                </button>
                <button
                  onClick={() => alert(`Entity ${dossierData?.entity?.name || selectedEntity?.name || selectedNodeId || 'Not available'} flagged for Precinct Surveillance.`)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <Flag className="w-3.5 h-3.5 text-red-600" />
                  Flag Entity
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

