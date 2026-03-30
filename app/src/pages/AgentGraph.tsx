import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';

/* ─── Types ─────────────────────────────────────────────────────────────────── */

interface GraphNode {
  id: string;
  label: string;
  sublabel?: string;
  type: string;
  color: string;
  val: number;
  agent?: {
    role: string;
    age: number;
    zip: string;
    income: number;
    conditions: string[];
    transport: string;
    insured: boolean;
  };
  profile?: {
    username: string;
    bio: string;
    persona: string;
    mbti: string;
    topics: string[];
  };
  reaction?: {
    sentiment: number;
    would_use: boolean;
    content: string | null;
    influence: number;
    visits: number;
  };
  details?: Record<string, unknown>;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  color: string;
  condition?: string;
}

interface SimScenario {
  scenario: {
    id: string;
    title: string;
    description: string;
    target_zip: string;
    type: string;
    initial_event: string;
  };
  num_agents: number;
  num_llm_simulated: number;
  aggregate: {
    adoption_rate: number;
    avg_sentiment: number;
    total_weekly_visits: number;
    top_barriers: [string, number][];
    by_zip: Record<string, { agents: number; adoption_rate: number; avg_sentiment: number }>;
  };
  featured_quotes: {
    agent_id: string;
    role: string;
    age: number;
    zip: string;
    username?: string;
    content: string;
    sentiment: number;
    would_use: boolean;
  }[];
  graph: {
    nodes: GraphNode[];
    links: GraphLink[];
    stats: { total_nodes: number; total_links: number; agent_nodes: number; structural_nodes: number };
    nodeTypes: Record<string, string>;
  };
}

interface SimData {
  engine: string;
  model: string;
  timestamp: string;
  total_agents: number;
  scenarios: SimScenario[];
  methodology: {
    description: string;
    engine: string;
    pipeline: string[];
    limitations: string[];
  };
}

/* ─── Node Type Legend ───────────────────────────────────────────────────────── */

const NODE_TYPE_LABELS: Record<string, string> = {
  Resident: 'Agent',
  HealthCondition: 'Condition',
  ZIPCode: 'ZIP Code',
  CommunityOrg: 'Organization',
  Barrier: 'Barrier',
  Intervention: 'Intervention',
  HealthcareFacility: 'Facility',
  FoodResource: 'Food',
  GreenSpace: 'Green Space',
  TransportMode: 'Transport',
};

/* ─── Sentiment color helper ────────────────────────────────────────────────── */

function sentimentColor(s: number): string {
  if (s > 0.5) return '#22c55e';
  if (s > 0.2) return '#86efac';
  if (s > -0.2) return '#fbbf24';
  if (s > -0.5) return '#f97316';
  return '#ef4444';
}

/* ─── Component ─────────────────────────────────────────────────────────────── */

export function AgentGraph() {
  const [data, setData] = useState<SimData | null>(null);
  const [activeScenario, setActiveScenario] = useState(0);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showOnlyAdopters, setShowOnlyAdopters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasCustom, setHasCustom] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'overview' | 'report'>('overview');
  const graphRef = useRef<ForceGraphMethods>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Load data — check for custom simulation first
  useEffect(() => {
    fetch('/data/simulation_results.json')
      .then(r => r.json())
      .then(baseData => {
        // Check if there's a custom simulation from the Simulator
        const customJson = localStorage.getItem('jaxbridge_custom_sim');
        if (customJson) {
          try {
            const custom = JSON.parse(customJson);
            // Prepend custom scenario to the list
            const customScenario = {
              scenario: custom.scenario,
              num_agents: custom.num_agents,
              num_llm_simulated: custom.num_agents,
              aggregate: {
                ...custom.aggregate,
                by_zip: { [custom.scenario.target_zip]: { agents: custom.num_agents, adoption_rate: custom.aggregate.adoption_rate, avg_sentiment: custom.aggregate.avg_sentiment } },
              },
              featured_quotes: custom.featured_quotes,
              graph: {
                ...custom.graph,
                nodeTypes: { Resident: '#4dabf7', Intervention: '#69db7c', Barrier: '#e599f7' },
              },
            };
            baseData.scenarios = [customScenario, ...baseData.scenarios];
            setHasCustom(true);
            setActiveScenario(0); // Show custom first
            localStorage.removeItem('jaxbridge_custom_sim');
          } catch (e) {
            console.warn('Failed to load custom simulation:', e);
          }
        }
        setData(baseData);
      })
      .catch(console.error);
  }, []);

  // Resize handler — re-run when sidebar toggles
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };
    // Delay to let CSS transition finish
    const timer = setTimeout(updateSize, 50);
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => { window.removeEventListener('resize', updateSize); clearTimeout(timer); };
  }, [sidebarOpen]);

  // Graph data for current scenario
  const graphData = useMemo(() => {
    if (!data?.scenarios?.[activeScenario]?.graph) return { nodes: [], links: [] };
    const g = data.scenarios[activeScenario].graph;
    let nodes = [...g.nodes];
    let links = [...g.links];

    // Filter by type
    if (filterType) {
      const nodeIds = new Set(nodes.filter(n => n.type === filterType).map(n => n.id));
      // Also include connected nodes
      links.forEach(l => {
        const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
        const tgt = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
        if (nodeIds.has(src)) nodeIds.add(tgt);
        if (nodeIds.has(tgt)) nodeIds.add(src);
      });
      nodes = nodes.filter(n => nodeIds.has(n.id));
      links = links.filter(l => {
        const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
        const tgt = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
        return nodeIds.has(src) && nodeIds.has(tgt);
      });
    }

    // Filter adopters only
    if (showOnlyAdopters) {
      const adopterIds = new Set(
        nodes.filter(n => n.type === 'Resident' && n.reaction?.would_use).map(n => n.id)
      );
      // Keep structural nodes + adopters
      const keepIds = new Set(nodes.filter(n => n.type !== 'Resident' || adopterIds.has(n.id)).map(n => n.id));
      nodes = nodes.filter(n => keepIds.has(n.id));
      links = links.filter(l => {
        const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
        const tgt = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
        return keepIds.has(src) && keepIds.has(tgt);
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchIds = new Set(
        nodes.filter(n =>
          n.label?.toLowerCase().includes(q) ||
          n.sublabel?.toLowerCase().includes(q) ||
          n.type?.toLowerCase().includes(q) ||
          n.agent?.zip?.includes(q) ||
          n.agent?.role?.toLowerCase().includes(q) ||
          n.profile?.username?.toLowerCase().includes(q)
        ).map(n => n.id)
      );
      if (matchIds.size > 0) {
        // Also show connected nodes
        links.forEach(l => {
          const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
          const tgt = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
          if (matchIds.has(src)) matchIds.add(tgt);
          if (matchIds.has(tgt)) matchIds.add(src);
        });
        nodes = nodes.filter(n => matchIds.has(n.id));
        links = links.filter(l => {
          const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
          const tgt = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
          return matchIds.has(src) && matchIds.has(tgt);
        });
      }
    }

    return { nodes, links };
  }, [data, activeScenario, filterType, showOnlyAdopters, searchQuery]);

  // Node canvas rendering
  const paintNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const x = node.x || 0;
    const y = node.y || 0;
    const r = Math.sqrt(node.val || 3) * 2.5;
    const isSelected = selectedNode?.id === node.id;
    const isHovered = hoveredNode?.id === node.id;
    const isResident = node.type === 'Resident';

    // Glow for selected/hovered
    if (isSelected || isHovered) {
      ctx.beginPath();
      ctx.arc(x, y, r + 4, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)';
      ctx.fill();
    }

    // Main circle
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);

    if (isResident && node.reaction) {
      // Gradient based on sentiment for residents
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, node.reaction.would_use ? sentimentColor(node.reaction.sentiment) : 'rgba(100,100,100,0.6)');
      grad.addColorStop(1, node.color + '80');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = node.color;
    }
    ctx.fill();

    // Border
    ctx.strokeStyle = isSelected ? '#ffffff' : (isHovered ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.1)');
    ctx.lineWidth = isSelected ? 1.5 : 0.5;
    ctx.stroke();

    // Label (only when zoomed in or for structural nodes)
    if (globalScale > 2 || !isResident || isSelected || isHovered) {
      const fontSize = Math.max(8 / globalScale, isResident ? 2.5 : 3.5);
      ctx.font = `${isResident ? '' : 'bold '}${fontSize}px 'DM Sans', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isSelected || isHovered ? '#ffffff' : 'rgba(255,255,255,0.7)';
      ctx.fillText(node.label || '', x, y + r + 2);
    }
  }, [selectedNode, hoveredNode]);

  const scenario = data?.scenarios?.[activeScenario];
  const stats = scenario?.graph?.stats;
  const agg = scenario?.aggregate;
  const nodeTypes = scenario?.graph?.nodeTypes || {};

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#ff3c00] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p style={{ color: '#888', fontFamily: "'DM Mono', monospace" }}>Loading MiroFish simulation data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0a0a', fontFamily: "'DM Sans', sans-serif" }}>
      {/* ─── Header Bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#0f0f0f' }}>
        <div className="flex items-center gap-4">
          <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: '0.85rem', color: '#e0e0e0', letterSpacing: '0.05em' }}>
            MIROFISH
          </span>
          <span style={{ color: '#333', fontSize: '0.75rem' }}>×</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: '#ff3c00' }}>JAXBRIDGE</span>
        </div>

        {/* Scenario tabs */}
        <div className="flex gap-1">
          {data.scenarios.map((s, i) => {
            const isCustom = s.scenario.id === 'custom';
            const icon = isCustom ? '⚡' : s.scenario.type === 'healthcare' ? '🏥' : s.scenario.type === 'food_access' ? '🥦' : '🌳';
            return (
              <button
                key={`${s.scenario.id}-${i}`}
                onClick={() => { setActiveScenario(i); setSelectedNode(null); }}
                className="px-3 py-1.5 rounded text-xs transition-all"
                style={{
                  background: i === activeScenario ? (isCustom ? 'rgba(251,191,36,0.15)' : 'rgba(255,60,0,0.15)') : 'transparent',
                  color: i === activeScenario ? (isCustom ? '#fbbf24' : '#ff3c00') : '#666',
                  border: i === activeScenario ? `1px solid ${isCustom ? 'rgba(251,191,36,0.3)' : 'rgba(255,60,0,0.3)'}` : '1px solid transparent',
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                {icon}{' '}{isCustom ? 'YOUR DESIGN' : s.scenario.target_zip}
              </button>
            );
          })}
        </div>

        {/* Stats */}
        <div className="flex gap-6 text-xs" style={{ fontFamily: "'DM Mono', monospace", color: '#666' }}>
          <span>{stats?.total_nodes || 0} nodes</span>
          <span>{stats?.total_links || 0} edges</span>
          <span style={{ color: '#ff3c00' }}>{data.total_agents} agents</span>
        </div>
      </div>

      {/* ─── Main content ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ─── Graph viewport ─────────────────────────────────────────────── */}
        <div ref={containerRef} className="flex-1 relative min-w-0 overflow-hidden">
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="#0a0a0a"
            nodeCanvasObject={paintNode}
            nodePointerAreaPaint={(node: GraphNode, color, ctx) => {
              const r = Math.sqrt(node.val || 3) * 2.5 + 2;
              ctx.beginPath();
              ctx.arc(node.x || 0, node.y || 0, r, 0, 2 * Math.PI);
              ctx.fillStyle = color;
              ctx.fill();
            }}
            linkColor={(link: GraphLink) => link.color || 'rgba(255,255,255,0.03)'}
            linkWidth={0.3}
            linkDirectionalParticles={0}
            onNodeClick={(node: GraphNode) => setSelectedNode(node)}
            onNodeHover={(node: GraphNode | null) => setHoveredNode(node)}
            cooldownTicks={200}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
            warmupTicks={50}
          />

          {/* ─── Legend (bottom-left) ──────────────────────────────────────── */}
          <div className="absolute bottom-4 left-4 flex flex-wrap gap-2 max-w-[400px]">
            {Object.entries(nodeTypes).map(([type, color]) => (
              <button
                key={type}
                onClick={() => setFilterType(filterType === type ? null : type)}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all"
                style={{
                  background: filterType === type ? `${color}20` : 'rgba(0,0,0,0.6)',
                  border: `1px solid ${filterType === type ? color : 'rgba(255,255,255,0.08)'}`,
                  color: filterType === type ? color : '#888',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                {NODE_TYPE_LABELS[type] || type}
              </button>
            ))}
          </div>

          {/* ─── Top bar: Search + Stats ──────────────────────────────────── */}
          <div className="absolute top-4 left-4 right-[340px] flex items-center gap-3 z-10">
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="text"
                placeholder="Search agents, ZIPs..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="px-3 py-2 rounded text-xs w-52"
                style={{
                  background: 'rgba(0,0,0,0.7)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e0e0e0',
                  backdropFilter: 'blur(8px)',
                  fontFamily: "'DM Mono', monospace",
                }}
              />
              <label className="flex items-center gap-1.5 text-[10px] cursor-pointer whitespace-nowrap" style={{ color: '#666' }}>
                <input
                  type="checkbox"
                  checked={showOnlyAdopters}
                  onChange={e => setShowOnlyAdopters(e.target.checked)}
                  className="accent-[#22c55e] w-3 h-3"
                />
                Adopters only
              </label>
            </div>

            <div className="flex-1" />

            {agg && (
              <div className="flex gap-2">
                {[
                  { label: 'Adoption', value: `${(agg.adoption_rate * 100).toFixed(0)}%`, color: agg.adoption_rate > 0.6 ? '#22c55e' : '#fbbf24' },
                  { label: 'Target ZIP', value: (() => { const tz = scenario?.scenario?.target_zip; const zd = agg.by_zip?.[tz || '']; return zd ? `+${zd.avg_sentiment.toFixed(2)}` : agg.avg_sentiment.toFixed(2); })(), color: (() => { const tz = scenario?.scenario?.target_zip; const zd = agg.by_zip?.[tz || '']; return sentimentColor(zd?.avg_sentiment ?? agg.avg_sentiment); })() },
                  { label: 'Visits/wk', value: agg.total_weekly_visits.toLocaleString(), color: '#4dabf7' },
                ].map(s => (
                  <div key={s.label} className="px-2.5 py-1.5 rounded text-center" style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)' }}>
                    <div className="text-[9px]" style={{ color: '#555', fontFamily: "'DM Mono', monospace" }}>{s.label}</div>
                    <div className="text-base font-bold" style={{ color: s.color, fontFamily: "'DM Mono', monospace" }}>{s.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── Impact Timeline Strip (bottom of graph) ─────────────────────── */}
        {agg && scenario && (
          <div className="absolute bottom-0 left-0 right-0 z-10" style={{ background: 'linear-gradient(to top, rgba(10,10,10,0.95) 70%, transparent)', pointerEvents: 'none' }}>
            <div className="px-6 pb-4 pt-10" style={{ pointerEvents: 'auto' }}>
              <div className="font-mono text-[8px] tracking-[0.2em] mb-2" style={{ color: 'rgba(255,60,0,0.5)' }}>
                IMPACT TIMELINE — HOW CHANGE RIPPLES THROUGH {scenario.scenario.target_zip}
              </div>
              <div className="flex items-stretch gap-0 overflow-x-auto">
                {[
                  {
                    phase: 'WEEK 1', title: 'Resource Opens',
                    detail: scenario.scenario.type === 'healthcare' ? 'Health center doors open' : scenario.scenario.type === 'food_access' ? 'Grocery co-op launches' : 'Park opens to public',
                    metric: '0% aware', color: '#ff3c00',
                    agents: 0,
                  },
                  {
                    phase: 'WEEKS 2-4', title: 'Awareness Spreads',
                    detail: 'Word of mouth, community leaders, social media',
                    metric: `${Math.round((agg.adoption_rate || 0) * 40)}% aware`,
                    color: '#ff6b35',
                    agents: Math.round((data?.total_agents || 1035) * 0.3),
                  },
                  {
                    phase: 'MONTH 2', title: 'Early Adopters',
                    detail: `${agg.by_zip?.[scenario.scenario.target_zip]?.agents || 115} target ZIP residents try it first`,
                    metric: `${Math.round((agg.adoption_rate || 0) * 60)}% tried`,
                    color: '#fbbf24',
                    agents: Math.round((data?.total_agents || 1035) * 0.45),
                  },
                  {
                    phase: 'MONTHS 3-6', title: 'Barriers Surface',
                    detail: (agg.top_barriers?.slice(0, 2).map((b: [string, number]) => b[0]).join(', ')) || 'transport, time',
                    metric: `${Math.round((agg.adoption_rate || 0) * 80)}% regular`,
                    color: '#e599f7',
                    agents: Math.round((data?.total_agents || 1035) * 0.6),
                  },
                  {
                    phase: 'MONTH 6', title: 'Steady State',
                    detail: `${(agg.adoption_rate * 100).toFixed(0)}% adoption across ${Object.keys(agg.by_zip || {}).length} ZIPs`,
                    metric: `${agg.total_weekly_visits} visits/wk`,
                    color: '#22c55e',
                    agents: Math.round((data?.total_agents || 1035) * (agg.adoption_rate || 0.7)),
                  },
                  {
                    phase: 'YEAR 1+', title: 'Health Outcomes Shift',
                    detail: 'Obesity ↓, activity ↑, mental health ↑, life expectancy ↑',
                    metric: `${agg.total_weekly_visits} visits/wk sustained`,
                    color: '#0d9488',
                    agents: data?.total_agents || 1035,
                  },
                ].map((step, i, arr) => (
                  <div key={i} className="flex items-stretch shrink-0">
                    <div className="w-44 p-2.5 rounded-lg relative" style={{ background: `${step.color}08`, border: `1px solid ${step.color}20` }}>
                      {/* Phase label */}
                      <div className="font-mono text-[8px] tracking-[0.1em] mb-0.5" style={{ color: step.color }}>{step.phase}</div>
                      {/* Title */}
                      <div className="text-[11px] font-bold mb-0.5" style={{ color: '#e0e0e0' }}>{step.title}</div>
                      {/* Detail */}
                      <div className="text-[9px] mb-1.5" style={{ color: 'rgba(224,224,224,0.35)' }}>{step.detail}</div>
                      {/* Agent count bar */}
                      <div className="h-1 rounded-full mb-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <div className="h-full rounded-full transition-all" style={{
                          width: `${(step.agents / (data?.total_agents || 1035)) * 100}%`,
                          background: step.color,
                        }} />
                      </div>
                      {/* Metric */}
                      <div className="font-mono text-[9px] font-bold" style={{ color: step.color }}>{step.metric}</div>
                      {/* Agent dots */}
                      <div className="flex gap-0.5 mt-1">
                        {Array.from({ length: Math.min(12, Math.ceil(step.agents / 86)) }).map((_, j) => (
                          <div key={j} className="w-1 h-1 rounded-full" style={{ background: step.color, opacity: 0.3 + (j / 12) * 0.7 }} />
                        ))}
                      </div>
                    </div>
                    {/* Arrow connector */}
                    {i < arr.length - 1 && (
                      <div className="flex items-center px-1">
                        <div className="font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.15)' }}>→</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Detail Panel (right sidebar) ────────────────────────────────── */}
        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 px-1 py-4 rounded-l"
          style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.06)', borderRight: 'none', right: sidebarOpen ? '320px' : 0 }}
        >
          <span className="font-mono text-[10px]" style={{ color: '#666' }}>{sidebarOpen ? '›' : '‹'}</span>
        </button>

        <div className="border-l overflow-y-auto transition-all" style={{ width: sidebarOpen ? 360 : 0, minWidth: sidebarOpen ? 360 : 0, borderColor: 'rgba(255,255,255,0.06)', background: '#0f0f0f', overflow: sidebarOpen ? 'auto' : 'hidden' }}>
          {/* Tab bar */}
          <div className="flex sticky top-0 z-10" style={{ background: '#0f0f0f', borderBottom: '1px solid rgba(224,224,224,0.06)' }}>
            {(['overview', 'report'] as const).map(tab => (
              <button key={tab} onClick={() => { setSidebarTab(tab); setSelectedNode(null); }}
                className="flex-1 py-2.5 font-mono text-[10px] tracking-[0.15em] transition-all"
                style={{
                  color: sidebarTab === tab ? '#ff3c00' : 'rgba(224,224,224,0.3)',
                  borderBottom: sidebarTab === tab ? '2px solid #ff3c00' : '2px solid transparent',
                  background: sidebarTab === tab ? 'rgba(255,60,0,0.04)' : 'transparent',
                }}>
                {tab.toUpperCase()}
              </button>
            ))}
          </div>

          {/* REPORT TAB */}
          {sidebarTab === 'report' && scenario && agg ? (
            <div className="p-5">
              <div className="font-mono text-[9px] tracking-[0.2em] mb-3" style={{ color: '#ff3c00' }}>SIMULATION ANALYSIS REPORT</div>

              {/* Executive Summary */}
              <div className="mb-4">
                <h3 className="text-sm font-bold mb-2" style={{ color: '#e0e0e0' }}>Executive Summary</h3>
                <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(224,224,224,0.5)' }}>
                  The proposed intervention in ZIP {scenario.scenario.target_zip} was simulated across {data?.total_agents || 1035} AI agents representing residents of 9 Jacksonville neighborhoods. The simulation projects a <strong style={{ color: '#e0e0e0' }}>{(agg.adoption_rate * 100).toFixed(0)}% adoption rate</strong> with an average sentiment of {agg.avg_sentiment.toFixed(2)} and {agg.total_weekly_visits} projected weekly visits.
                </p>
              </div>

              {/* Key Findings */}
              <div className="mb-4">
                <div className="font-mono text-[8px] tracking-[0.15em] mb-2" style={{ color: 'rgba(224,224,224,0.25)' }}>KEY FINDINGS</div>
                <div className="space-y-2">
                  {[
                    { label: 'Adoption Rate', value: `${(agg.adoption_rate * 100).toFixed(0)}%`, color: agg.adoption_rate > 0.7 ? '#22c55e' : '#fbbf24', insight: agg.adoption_rate > 0.7 ? 'Strong community buy-in expected' : 'Moderate adoption; targeted outreach needed' },
                    { label: 'Target ZIP Sentiment', value: (() => { const tz = scenario?.scenario?.target_zip; const zd = agg.by_zip?.[tz || '']; return zd ? `+${zd.avg_sentiment.toFixed(2)}` : agg.avg_sentiment.toFixed(2); })(), color: (() => { const tz = scenario?.scenario?.target_zip; const zd = agg.by_zip?.[tz || '']; return sentimentColor(zd?.avg_sentiment ?? agg.avg_sentiment); })(), insight: (() => { const tz = scenario?.scenario?.target_zip; const zd = agg.by_zip?.[tz || '']; const s = zd?.avg_sentiment ?? agg.avg_sentiment; return s > 0.25 ? 'Positive reception in target community' : 'Mixed reception; targeted outreach recommended'; })() },
                    { label: 'Weekly Visits', value: agg.total_weekly_visits.toString(), color: '#4dabf7', insight: `Projected ${Math.round(agg.total_weekly_visits * 52)} annual visits` },
                  ].map(f => (
                    <div key={f.label} className="p-2.5 rounded" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(224,224,224,0.04)' }}>
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="font-mono text-[9px]" style={{ color: 'rgba(224,224,224,0.35)' }}>{f.label}</span>
                        <span className="font-mono text-sm font-bold" style={{ color: f.color }}>{f.value}</span>
                      </div>
                      <div className="text-[10px]" style={{ color: 'rgba(224,224,224,0.3)' }}>{f.insight}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Barrier Analysis */}
              {agg.top_barriers && agg.top_barriers.length > 0 && (
                <div className="mb-4">
                  <div className="font-mono text-[8px] tracking-[0.15em] mb-2" style={{ color: 'rgba(224,224,224,0.25)' }}>BARRIER ANALYSIS</div>
                  <p className="text-[11px] mb-2" style={{ color: 'rgba(224,224,224,0.4)' }}>
                    Primary barriers identified by simulated residents:
                  </p>
                  <div className="space-y-1.5">
                    {agg.top_barriers.slice(0, 5).map(([barrier, count]: [string, number], i: number) => (
                      <div key={barrier} className="flex items-center gap-2">
                        <span className="font-mono text-[9px] w-4 text-right" style={{ color: 'rgba(224,224,224,0.2)' }}>{i + 1}</span>
                        <div className="flex-1 h-2 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <div className="h-full rounded" style={{ width: `${(count / (agg.top_barriers[0]?.[1] || 1)) * 100}%`, background: '#e599f7', opacity: 1 - i * 0.15 }} />
                        </div>
                        <span className="text-[10px] w-24 truncate" style={{ color: 'rgba(224,224,224,0.4)' }}>{barrier}</span>
                        <span className="font-mono text-[9px]" style={{ color: '#e599f7' }}>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Geographic Distribution */}
              {agg.by_zip && (
                <div className="mb-4">
                  <div className="font-mono text-[8px] tracking-[0.15em] mb-2" style={{ color: 'rgba(224,224,224,0.25)' }}>GEOGRAPHIC DISTRIBUTION</div>
                  <p className="text-[11px] mb-2" style={{ color: 'rgba(224,224,224,0.4)' }}>
                    Adoption varies by neighborhood. {scenario.scenario.target_zip === Object.entries(agg.by_zip).sort(([,a],[,b]) => (b as any).adoption_rate - (a as any).adoption_rate)[0]?.[0]
                      ? 'The target ZIP shows the highest adoption, confirming demand alignment.'
                      : 'Interestingly, adjacent ZIPs show higher adoption than the target, suggesting spillover demand.'}
                  </p>
                  <div className="space-y-1">
                    {Object.entries(agg.by_zip)
                      .sort(([,a],[,b]) => (b as any).adoption_rate - (a as any).adoption_rate)
                      .slice(0, 5)
                      .map(([zip, d]: [string, any]) => (
                        <div key={zip} className="flex items-center gap-2 text-[10px]">
                          <span className="font-mono w-12" style={{ color: zip === scenario.scenario.target_zip ? '#ff3c00' : 'rgba(224,224,224,0.4)' }}>{zip}</span>
                          <div className="flex-1 h-1.5 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <div className="h-full rounded" style={{ width: `${d.adoption_rate * 100}%`, background: zip === scenario.scenario.target_zip ? '#ff3c00' : '#22c55e' }} />
                          </div>
                          <span className="font-mono w-8 text-right" style={{ color: '#22c55e' }}>{(d.adoption_rate * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              <div className="mb-4">
                <div className="font-mono text-[8px] tracking-[0.15em] mb-2" style={{ color: 'rgba(224,224,224,0.25)' }}>RECOMMENDATIONS</div>
                <div className="space-y-2">
                  {[
                    agg.top_barriers?.[0]?.[0] === 'transportation' || agg.top_barriers?.[0]?.[0] === 'time'
                      ? 'Add shuttle service or extend operating hours to address the #1 barrier'
                      : `Address "${agg.top_barriers?.[0]?.[0] || 'access'}" as the primary barrier to adoption`,
                    agg.adoption_rate < 0.7
                      ? 'Increase community outreach through local churches and schools'
                      : 'Leverage high adoption for phased expansion to adjacent ZIPs',
                    'Partner with existing community organizations for trust-building',
                    'Monitor actual vs. projected visits in months 1-3 for model calibration',
                  ].map((rec, i) => (
                    <div key={i} className="flex gap-2 text-[11px]">
                      <span style={{ color: '#0d9488' }}>→</span>
                      <span style={{ color: 'rgba(224,224,224,0.45)' }}>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Methodology */}
              <div className="pt-3" style={{ borderTop: '1px solid rgba(224,224,224,0.04)' }}>
                <div className="font-mono text-[8px] tracking-[0.15em] mb-1" style={{ color: 'rgba(224,224,224,0.15)' }}>METHODOLOGY</div>
                <p className="text-[9px] leading-relaxed" style={{ color: 'rgba(224,224,224,0.2)' }}>
                  {data?.total_agents || 1035} agents simulated via MiroFish swarm intelligence engine using CAMEL-AI OASIS framework. Agent personas enriched with Reddit r/jacksonville community data. Reactions generated by {data?.model || 'Groq LLM'} with personality-weighted extrapolation. SCAN (Spatial Causal Attention Network) used for health outcome forecasting.
                </p>
              </div>
            </div>
          ) : sidebarTab === 'overview' && selectedNode ? (
            <div className="p-5">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold" style={{ color: '#e0e0e0' }}>{selectedNode.label}</h3>
                  {selectedNode.sublabel && (
                    <p className="text-xs mt-0.5" style={{ color: '#666' }}>{selectedNode.sublabel}</p>
                  )}
                </div>
                <button onClick={() => setSelectedNode(null)} className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(255,60,0,0.15)', color: '#ff3c00', border: '1px solid rgba(255,60,0,0.3)' }}>
                  Close
                </button>
              </div>

              {/* Type badge */}
              <div className="mb-4">
                <span className="px-2 py-0.5 rounded text-xs" style={{ background: selectedNode.color + '20', color: selectedNode.color, border: `1px solid ${selectedNode.color}40` }}>
                  {NODE_TYPE_LABELS[selectedNode.type] || selectedNode.type}
                </span>
              </div>

              {/* Agent details */}
              {selectedNode.agent && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#555', fontFamily: "'DM Mono', monospace" }}>Demographics</h4>
                  <div className="space-y-1.5">
                    {[
                      ['Role', selectedNode.agent.role.replace(/_/g, ' ')],
                      ['Age', selectedNode.agent.age],
                      ['ZIP', selectedNode.agent.zip],
                      ['Income', `$${selectedNode.agent.income.toLocaleString()}`],
                      ['Transport', selectedNode.agent.transport],
                      ['Insured', selectedNode.agent.insured ? 'Yes' : 'No'],
                    ].map(([k, v]) => (
                      <div key={String(k)} className="flex justify-between text-xs" style={{ color: '#888' }}>
                        <span>{k}</span>
                        <span style={{ color: '#ccc' }}>{String(v)}</span>
                      </div>
                    ))}
                    {selectedNode.agent.conditions.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-1">
                        {selectedNode.agent.conditions.map(c => (
                          <span key={c} className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'rgba(255,107,107,0.15)', color: '#ff6b6b' }}>
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Profile */}
              {selectedNode.profile?.persona && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#555', fontFamily: "'DM Mono', monospace" }}>OASIS Profile</h4>
                  {selectedNode.profile.username && (
                    <p className="text-xs mb-1" style={{ color: '#ff3c00', fontFamily: "'DM Mono', monospace" }}>@{selectedNode.profile.username}</p>
                  )}
                  <p className="text-xs leading-relaxed" style={{ color: '#888' }}>{selectedNode.profile.persona}</p>
                  {selectedNode.profile.mbti && (
                    <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'rgba(77,171,247,0.15)', color: '#4dabf7' }}>
                      {selectedNode.profile.mbti}
                    </span>
                  )}
                  {selectedNode.profile.topics?.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-1.5">
                      {selectedNode.profile.topics.map(t => (
                        <span key={t} className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'rgba(255,255,255,0.05)', color: '#666' }}>
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Reaction */}
              {selectedNode.reaction && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#555', fontFamily: "'DM Mono', monospace" }}>Simulation Reaction</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: '#888' }}>Would Use</span>
                      <span className="text-xs font-bold" style={{ color: selectedNode.reaction.would_use ? '#22c55e' : '#ef4444' }}>
                        {selectedNode.reaction.would_use ? '✓ YES' : '✗ NO'}
                      </span>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: '#888' }}>Sentiment</span>
                        <span style={{ color: sentimentColor(selectedNode.reaction.sentiment) }}>
                          {selectedNode.reaction.sentiment.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${((selectedNode.reaction.sentiment + 1) / 2) * 100}%`,
                            background: sentimentColor(selectedNode.reaction.sentiment),
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: '#888' }}>Influence</span>
                      <span className="text-xs" style={{ color: '#ccc' }}>
                        {selectedNode.reaction.influence.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: '#888' }}>Est. visits/wk</span>
                      <span className="text-xs" style={{ color: '#ccc' }}>
                        {selectedNode.reaction.visits}
                      </span>
                    </div>
                    {selectedNode.reaction.content && (
                      <div className="mt-2 p-3 rounded" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <p className="text-[11px] italic leading-relaxed" style={{ color: '#aaa' }}>
                          "{selectedNode.reaction.content}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ZIP details */}
              {selectedNode.type === 'ZIPCode' && selectedNode.details && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#555', fontFamily: "'DM Mono', monospace" }}>ZIP Statistics</h4>
                  <div className="space-y-1.5">
                    {Object.entries(selectedNode.details as Record<string, unknown>).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs" style={{ color: '#888' }}>
                        <span>{k.replace(/_/g, ' ')}</span>
                        <span style={{ color: '#ccc' }}>{typeof v === 'number' ? v.toLocaleString() : String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Connections */}
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#555', fontFamily: "'DM Mono', monospace" }}>Connections</h4>
                <div className="space-y-1">
                  {graphData.links
                    .filter(l => {
                      const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
                      const tgt = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
                      return src === selectedNode.id || tgt === selectedNode.id;
                    })
                    .slice(0, 15)
                    .map((l, i) => {
                      const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
                      const tgt = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
                      const otherId = src === selectedNode.id ? tgt : src;
                      const other = graphData.nodes.find(n => n.id === otherId);
                      return (
                        <div key={i} className="flex items-center gap-2 text-[10px] px-2 py-1 rounded cursor-pointer hover:bg-white/5"
                          onClick={() => other && setSelectedNode(other as GraphNode)}
                          style={{ color: '#888' }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: other?.color || '#666' }} />
                          <span className="truncate" style={{ color: '#aaa' }}>{other?.label || otherId}</span>
                          <span className="ml-auto text-[9px]" style={{ color: '#444' }}>{l.type}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          ) : sidebarTab === 'overview' ? (
            /* Default: scenario overview + mechanistic interpretability */
            <div className="p-5">
              {/* Scenario header */}
              <div className="font-mono text-[9px] tracking-[0.2em] mb-2" style={{ color: '#ff3c00' }}>SCENARIO</div>
              <h3 className="text-sm font-semibold mb-1" style={{ color: '#e0e0e0' }}>
                {scenario?.scenario.title}
              </h3>
              <p className="text-[11px] leading-relaxed mb-3" style={{ color: '#666' }}>
                {scenario?.scenario.description}
              </p>

              {/* Impact cascade — mechanistic interpretability */}
              <div className="mb-4">
                <div className="font-mono text-[9px] tracking-[0.2em] mb-2" style={{ color: '#ff3c00' }}>IMPACT CASCADE</div>
                <div className="p-3 rounded" style={{ background: 'rgba(255,60,0,0.04)', border: '1px solid rgba(255,60,0,0.1)' }}>
                  <div className="space-y-1.5">
                    {[
                      { step: 'Resource Placed', detail: scenario?.scenario.type === 'healthcare' ? 'Health center opens' : scenario?.scenario.type === 'food_access' ? 'Grocery co-op opens' : 'Park & rec center opens' },
                      { step: 'Agents React', detail: `${data.total_agents} residents simulate behavior` },
                      { step: 'Adoption Spreads', detail: `${(agg?.adoption_rate ?? 0) * 100 | 0}% would use the resource` },
                      { step: 'Barriers Surface', detail: agg?.top_barriers?.slice(0, 2).map(b => b[0]).join(', ') || 'transport, time' },
                      { step: 'Behavior Changes', detail: `${agg?.total_weekly_visits || 0} weekly visits projected` },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="flex flex-col items-center" style={{ minWidth: 12 }}>
                          <div className="w-2 h-2 rounded-full mt-0.5" style={{ background: i === 0 ? '#ff3c00' : i < 3 ? '#ff3c0080' : '#ff3c0040' }} />
                          {i < 4 && <div className="w-px flex-1 mt-0.5" style={{ background: 'rgba(255,60,0,0.15)' }} />}
                        </div>
                        <div>
                          <div className="text-[10px] font-medium" style={{ color: '#ccc' }}>{item.step}</div>
                          <div className="text-[10px]" style={{ color: '#666' }}>{item.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Per-ZIP mechanistic breakdown */}
              {agg?.by_zip && (
                <div className="mb-4">
                  <div className="font-mono text-[9px] tracking-[0.2em] mb-2" style={{ color: '#ff3c00' }}>BEHAVIOR BY NEIGHBORHOOD</div>
                  <div className="space-y-2">
                    {Object.entries(agg.by_zip)
                      .sort(([, a], [, b]) => b.adoption_rate - a.adoption_rate)
                      .map(([zip, d]) => {
                        const isTarget = zip === scenario?.scenario.target_zip;
                        return (
                          <div key={zip} className="p-2 rounded" style={{
                            background: isTarget ? 'rgba(255,60,0,0.06)' : 'rgba(255,255,255,0.015)',
                            border: isTarget ? '1px solid rgba(255,60,0,0.15)' : '1px solid rgba(255,255,255,0.03)',
                          }}>
                            <div className="flex justify-between items-center mb-1">
                              <div className="flex items-center gap-1.5">
                                {isTarget && <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#ff3c00' }} />}
                                <span className="text-[11px] font-medium" style={{ color: isTarget ? '#ff3c00' : '#aaa' }}>
                                  ZIP {zip}
                                </span>
                                {isTarget && <span className="text-[8px] px-1 rounded" style={{ background: 'rgba(255,60,0,0.15)', color: '#ff3c00' }}>TARGET</span>}
                              </div>
                              <span className="font-mono text-[11px] font-bold" style={{ color: d.adoption_rate > 0.8 ? '#22c55e' : d.adoption_rate > 0.6 ? '#fbbf24' : '#ef4444' }}>
                                {(d.adoption_rate * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }}>
                              <div className="h-full rounded-full transition-all" style={{
                                width: `${d.adoption_rate * 100}%`,
                                background: isTarget ? '#ff3c00' : (d.adoption_rate > 0.7 ? '#22c55e' : '#fbbf24'),
                              }} />
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-[9px]" style={{ color: '#555' }}>
                                sentiment: {d.avg_sentiment > 0 ? '+' : ''}{d.avg_sentiment.toFixed(2)}
                              </span>
                              <span className="text-[9px]" style={{ color: '#555' }}>
                                {d.agents} agents
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Top agent voices — simplified */}
              {scenario?.featured_quotes && scenario.featured_quotes.length > 0 && (
                <div>
                  <div className="font-mono text-[9px] tracking-[0.2em] mb-2" style={{ color: '#ff3c00' }}>AGENT VOICES</div>
                  <div className="space-y-2">
                    {scenario.featured_quotes.slice(0, 3).map((q, i) => (
                      <div key={i} className="p-2 rounded" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: sentimentColor(q.sentiment) }} />
                          <span className="text-[10px]" style={{ color: '#888' }}>
                            {q.username ? `@${q.username}` : q.role}
                          </span>
                          <span className="text-[9px] ml-auto" style={{ color: '#444' }}>ZIP {q.zip}</span>
                        </div>
                        <p className="text-[10px] italic leading-relaxed" style={{ color: '#777' }}>
                          "{q.content?.slice(0, 150)}{(q.content?.length || 0) > 150 ? '...' : ''}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Engine credit */}
              <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="font-mono text-[8px] tracking-[0.15em]" style={{ color: '#333' }}>
                  POWERED BY MIROFISH × CAMEL-AI OASIS
                </div>
                <div className="text-[9px] mt-1" style={{ color: '#444' }}>
                  Click any node to inspect agent details
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
