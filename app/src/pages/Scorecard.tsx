import { useState, useEffect, useMemo, useRef } from 'react';
import { useClusterProfiles, useZipData } from '../data/useZipData';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, Tooltip as LeafletTooltip } from 'react-leaflet';
import { useRevealChildren } from '@/lib/useReveal';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';

const CLUSTER_COLORS: Record<string, string> = {
  'Critical Desert': '#ff3c00',
  'Struggling Suburban': '#ff6b35',
  'Resourced Suburban': '#0d9488',
  'Urban Transitional': '#4dabf7',
  'Stable Middle': '#fbbf24',
  'Resourced Corridor': '#0d9488',
};

interface FeatureImportance {
  feature: string;
  importance: number;
}

interface Counterfactual {
  geoid: string;
  label: string;
  actual_life_exp: number;
  counterfactual_life_exp: number;
  projected_gain: number;
  changes_applied: Record<string, { from: number; to: number }>;
}

interface PlacementZip {
  zip: string;
  name: string;
  score: number;
  need: number;
  spillover: number;
  adoption: number;
  population: number;
  life_expectancy: number;
  rdcs: number;
  projected_le_gain: number;
  projected_lives_impacted: number;
  top_neighbors: { zip: string; weight: number; name: string }[];
  deficit_breakdown: Record<string, number>;
}

interface PlacementResource {
  id: string;
  name: string;
  icon: string;
  cost: string;
  features: string[];
  description: string;
}

interface Placement {
  resource: PlacementResource;
  recommended_zip: PlacementZip | null;
  top_5: PlacementZip[];
}

interface PlacementStrategy {
  placements: Placement[];
  combined_strategy: {
    total_cost: string;
    zips_directly_served: { zip: string; resource: string; icon: string }[];
    zips_spillover: string[];
    total_population_served: number;
    projected_total_le_gain: number;
  };
  centrality_ranking: { zip: string; centrality: number }[];
}

const FEATURE_LABELS: Record<string, string> = {
  uninsured_rate: 'Uninsured Rate',
  smoking: 'Smoking Rate',
  high_blood_pressure: 'Blood Pressure',
  obesity: 'Obesity Rate',
  poverty_rate: 'Poverty Rate',
  physical_inactivity: 'Physical Inactivity',
  svi_score: 'Social Vulnerability',
  median_income: 'Median Income',
  depression: 'Depression Rate',
  food_desert_rate: 'Food Desert Rate',
  physician_access: 'Physician Access',
  park_acres_per_1k: 'Park Acres/1K',
  mental_health_per_10k: 'MH Providers/10K',
  air_quality_index: 'Air Quality',
  poor_mental_health_pct: 'Poor Mental Health',
};

const PIPELINE_STEPS = [
  { label: 'RAW DATA', sub: '218 tracts × 20 features' },
  { label: 'FEATURE ENG.', sub: 'Causal ordering + RDCS' },
  { label: 'SCAN', sub: 'CV R²=0.99 (5-fold)' },
  { label: 'GRAPH ATT.', sub: '5,112 spatial edges' },
  { label: 'COUNTERFACTUAL', sub: 'Causal intervention' },
  { label: 'MIROFISH', sub: '1,035 agent sim' },
];

export function Scorecard() {
  const clusters = useClusterProfiles();
  const { zipData } = useZipData();
  const [featureImportance, setFeatureImportance] = useState<FeatureImportance[]>([]);
  const [counterfactuals, setCounterfactuals] = useState<Counterfactual[]>([]);
  const [strategy, setStrategy] = useState<PlacementStrategy | null>(null);
  const [expandedPlacement, setExpandedPlacement] = useState<number>(0);

  useEffect(() => {
    // Use SCAN attention weights for feature importance (not RF)
    fetch('/data/scan_model.json')
      .then(r => r.json())
      .then(scan => {
        // Derive feature importance from SCAN attention: sum outgoing attention per feature
        const importance: Record<string, number> = {};
        const interactions = scan.interpretability?.feature_interactions || [];
        for (const x of interactions) {
          importance[x.from] = (importance[x.from] || 0) + x.weight;
        }
        const sorted = Object.entries(importance)
          .map(([feature, imp]) => ({ feature, importance: imp }))
          .sort((a, b) => b.importance - a.importance);
        // Normalize to 0-1 scale
        const maxW = sorted[0]?.importance || 1;
        setFeatureImportance(sorted.map(s => ({ feature: s.feature, importance: s.importance / maxW })));
      })
      .catch(() => {
        // Fallback to RF
        fetch('/data/feature_importance.json')
          .then(r => r.json())
          .then(d => setFeatureImportance(d.random_forest?.importances || []))
          .catch(() => {});
      });
    fetch('/data/counterfactual_analysis.json')
      .then(r => r.json())
      .then(d => setCounterfactuals(d.counterfactuals || []))
      .catch(() => {});
    fetch('/data/placement_strategy.json')
      .then(r => r.json())
      .then(d => setStrategy(d))
      .catch(() => {});
  }, []);

  const pageRef = useRef<HTMLDivElement>(null);
  useRevealChildren(pageRef);

  const clusterList = Object.values(clusters);

  if (!clusterList.length || zipData.length === 0) {
    return <LoadingSkeleton />;
  }

  const COMPARE_METRICS = [
    { key: 'life_expectancy', label: 'Life Expectancy (years)' },
    { key: 'median_income', label: 'Median Income ($K)', transform: (v: number) => v / 1000 },
    { key: 'obesity', label: 'Obesity Rate (%)' },
    { key: 'uninsured_rate', label: 'Uninsured Rate (%)' },
    { key: 'poverty_rate', label: 'Poverty Rate (%)' },
    { key: 'rdcs_normalized', label: 'Resource Desert Score' },
  ];

  const maxImportance = featureImportance.length > 0 ? featureImportance[0].importance : 1;

  return (
    <div ref={pageRef} className="pt-16 min-h-screen" style={{ background: '#0a0a0a' }}>
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="font-mono text-[10px] tracking-[0.3em] mb-4" style={{ color: '#ff3c00' }}>
          [ 005 — THE PLAYBOOK ]
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-bold mb-3" style={{ color: '#e0e0e0', lineHeight: 0.9 }}>
          WHAT TO BUILD.<br />WHERE.
        </h1>
        <p className="font-body text-lg" style={{ color: 'rgba(224,224,224,0.5)', maxWidth: '600px' }}>
          Our models identify the highest-leverage interventions for each neighborhood. Here's the data-driven action plan.
        </p>
      </div>

      {/* Model Pipeline */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <div className="font-mono text-[10px] tracking-[0.2em] mb-4" style={{ color: 'rgba(224,224,224,0.3)' }}>
          ML PIPELINE
        </div>
        <div className="rounded-xl p-6" style={{ background: '#0f0f0f', border: '1px solid rgba(224,224,224,0.06)' }}>
          <div className="flex items-center justify-between gap-2 overflow-x-auto">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step.label} className="flex items-center gap-2 shrink-0">
                <div className="text-center px-3 py-3 rounded-lg" style={{
                  background: i < 2 ? 'rgba(224,224,224,0.03)' : i < 4 ? 'rgba(255,60,0,0.08)' : 'rgba(13,148,136,0.08)',
                  border: `1px solid ${i < 2 ? 'rgba(224,224,224,0.06)' : i < 4 ? 'rgba(255,60,0,0.2)' : 'rgba(13,148,136,0.2)'}`,
                  minWidth: 130,
                }}>
                  <div className="font-mono text-[9px] tracking-[0.15em] font-bold" style={{
                    color: i < 2 ? 'rgba(224,224,224,0.5)' : i < 4 ? '#ff3c00' : '#0d9488',
                  }}>
                    {step.label}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'rgba(224,224,224,0.3)' }}>{step.sub}</div>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <div className="font-mono text-xs" style={{ color: 'rgba(255,60,0,0.4)' }}>→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feature Importance */}
      {featureImportance.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 pb-8">
          <div className="font-mono text-[10px] tracking-[0.2em] mb-4" style={{ color: 'rgba(224,224,224,0.3)' }}>
            FEATURE IMPORTANCE — SCAN ATTENTION WEIGHTS
          </div>
          <div className="rounded-xl p-6" style={{ background: '#0f0f0f', border: '1px solid rgba(224,224,224,0.06)' }}>
            <h2 className="font-display text-lg font-bold mb-1" style={{ color: '#e0e0e0' }}>What Drives Life Expectancy?</h2>
            <p className="text-sm mb-6" style={{ color: 'rgba(224,224,224,0.35)' }}>
              Features ranked by SCAN causal attention weight — how much each feature influences others in the network.
            </p>
            <div className="space-y-2">
              {featureImportance.slice(0, 10).map((f, i) => (
                <div key={f.feature} className="flex items-center gap-3">
                  <div className="font-mono text-[10px] w-4 text-right" style={{ color: 'rgba(224,224,224,0.25)' }}>
                    {i + 1}
                  </div>
                  <div className="w-36 text-xs truncate" style={{ color: 'rgba(224,224,224,0.6)' }}>
                    {FEATURE_LABELS[f.feature] || f.feature}
                  </div>
                  <div className="flex-1 h-4 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${(f.importance / maxImportance) * 100}%`,
                        background: `linear-gradient(90deg, #ff3c00, rgba(255,60,0,0.4))`,
                      }}
                    />
                  </div>
                  <div className="font-mono text-xs w-14 text-right" style={{ color: '#ff3c00' }}>
                    {(f.importance * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Counterfactual Analysis — Redesigned */}
      {counterfactuals.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 pb-8">
          <div className="font-mono text-[10px] tracking-[0.2em] mb-4" style={{ color: 'rgba(224,224,224,0.3)' }}>
            COUNTERFACTUAL ANALYSIS — ALL-FEATURES-TO-MEDIAN
          </div>
          <div className="rounded-xl p-6" style={{ background: '#0f0f0f', border: '1px solid rgba(224,224,224,0.06)' }}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="font-display text-lg font-bold mb-1" style={{ color: '#e0e0e0' }}>If We Fix the Gaps.</h2>
                <p className="text-sm" style={{ color: 'rgba(224,224,224,0.35)' }}>
                  What happens if Critical Desert ZIPs receive resources equal to the county median?
                </p>
              </div>
              {/* Aggregate impact */}
              <div className="text-right">
                <div className="font-display text-3xl font-bold" style={{ color: '#ff3c00' }}>
                  +{counterfactuals.reduce((sum, cf) => sum + Math.max(0, cf.projected_gain), 0).toFixed(1)}
                </div>
                <div className="font-mono text-[9px] tracking-[0.1em]" style={{ color: 'rgba(224,224,224,0.3)' }}>
                  TOTAL YEARS GAINED
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {counterfactuals.map(cf => {
                const barMin = 65;
                const barMax = 85;
                const currentPct = ((cf.actual_life_exp - barMin) / (barMax - barMin)) * 100;
                const projectedPct = ((cf.counterfactual_life_exp - barMin) / (barMax - barMin)) * 100;
                const hasGain = cf.projected_gain > 0.05;

                return (
                  <div key={cf.geoid} className="p-4 rounded-lg" style={{
                    background: hasGain ? 'rgba(255,60,0,0.04)' : 'rgba(255,255,255,0.015)',
                    border: hasGain ? '1px solid rgba(255,60,0,0.15)' : '1px solid rgba(224,224,224,0.04)',
                  }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-bold" style={{ color: hasGain ? '#ff3c00' : 'rgba(224,224,224,0.5)' }}>
                          ZIP {cf.geoid}
                        </span>
                        <span className="font-mono text-[10px]" style={{ color: 'rgba(224,224,224,0.25)' }}>
                          {cf.label?.replace('ZIP Code ', '')}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-2xl font-bold" style={{ color: 'rgba(224,224,224,0.4)' }}>
                          {cf.actual_life_exp.toFixed(1)}
                        </span>
                        <span style={{ color: 'rgba(224,224,224,0.15)' }}>→</span>
                        <span className="font-mono text-2xl font-bold" style={{ color: hasGain ? '#ff3c00' : '#e0e0e0' }}>
                          {cf.counterfactual_life_exp.toFixed(1)}
                        </span>
                        {hasGain && (
                          <span className="font-mono text-sm font-bold px-2 py-0.5 rounded" style={{ background: 'rgba(13,148,136,0.15)', color: '#0d9488' }}>
                            +{cf.projected_gain.toFixed(1)} yr
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Visual bar */}
                    <div className="h-2 rounded-full relative" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="h-full rounded-full absolute left-0 top-0" style={{ width: `${currentPct}%`, background: 'rgba(224,224,224,0.15)' }} />
                      {hasGain && (
                        <div className="h-full rounded-full absolute top-0" style={{ left: `${currentPct}%`, width: `${projectedPct - currentPct}%`, background: '#ff3c00' }} />
                      )}
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="font-mono text-[9px]" style={{ color: 'rgba(224,224,224,0.2)' }}>{barMin} yr</span>
                      <span className="font-mono text-[9px]" style={{ color: 'rgba(224,224,224,0.2)' }}>{barMax} yr</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── OPTIMAL PLACEMENT STRATEGY ─────────────────────────────────── */}
      {strategy && strategy.placements.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 pb-8">
          <div className="font-mono text-[10px] tracking-[0.3em] mb-2" style={{ color: '#ff3c00' }}>
            [ 005.3 — OPTIMAL PLACEMENT ]
          </div>
          <div className="font-mono text-[10px] tracking-[0.2em] mb-4" style={{ color: 'rgba(224,224,224,0.3)' }}>
            NETWORK-OPTIMIZED RESOURCE PLACEMENT
          </div>

          {/* Combined strategy summary */}
          <div className="rounded-xl p-5 mb-4" style={{ background: 'rgba(255,60,0,0.03)', border: '1px solid rgba(255,60,0,0.12)' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-display text-lg font-bold" style={{ color: '#e0e0e0' }}>Combined Investment Strategy</h2>
                <p className="text-xs" style={{ color: 'rgba(224,224,224,0.35)' }}>
                  SCAN spatial attention + topology centrality + MiroFish adoption/sentiment
                </p>
              </div>
              <div className="text-right">
                <div className="font-display text-2xl font-bold" style={{ color: '#ff3c00' }}>{strategy.combined_strategy.total_cost}</div>
                <div className="font-mono text-[9px]" style={{ color: 'rgba(224,224,224,0.3)' }}>TOTAL ANNUAL INVESTMENT</div>
              </div>
            </div>
            <div className="flex gap-8">
              <div>
                <div className="font-mono text-xl font-bold" style={{ color: '#0d9488' }}>{strategy.combined_strategy.total_population_served.toLocaleString()}</div>
                <div className="font-mono text-[9px]" style={{ color: 'rgba(224,224,224,0.3)' }}>RESIDENTS DIRECTLY SERVED</div>
              </div>
              <div>
                <div className="font-mono text-xl font-bold" style={{ color: '#22c55e' }}>+{strategy.combined_strategy.projected_total_le_gain} yr</div>
                <div className="font-mono text-[9px]" style={{ color: 'rgba(224,224,224,0.3)' }}>PROJECTED LIFE EXPECTANCY GAIN</div>
              </div>
              <div>
                <div className="font-mono text-xl font-bold" style={{ color: '#fbbf24' }}>{strategy.combined_strategy.zips_spillover.length}</div>
                <div className="font-mono text-[9px]" style={{ color: 'rgba(224,224,224,0.3)' }}>ADDITIONAL ZIPS VIA SPILLOVER</div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              {strategy.combined_strategy.zips_directly_served.map((z: { zip: string; resource: string }, i: number) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(224,224,224,0.06)' }}>
                  <span className="font-mono text-xs" style={{ color: 'rgba(224,224,224,0.5)' }}>{z.resource}</span>
                  <span className="font-mono text-xs font-bold" style={{ color: '#ff3c00' }}>ZIP {z.zip}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Topology Map — Satellite Imagery */}
          {(strategy as any).topology && (
            <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid rgba(224,224,224,0.06)' }}>
              <div className="px-5 pt-4 pb-2" style={{ background: '#0f0f0f' }}>
                <div className="font-mono text-[8px] tracking-[0.15em]" style={{ color: 'rgba(224,224,224,0.25)' }}>
                  SPATIAL TOPOLOGY — SATELLITE VIEW
                </div>
              </div>
              <div style={{ height: 420 }}>
                <MapContainer
                  center={[30.33, -81.65]}
                  zoom={11}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={false}
                  zoomControl={false}
                  attributionControl={false}
                >
                  <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                  {/* Network edges */}
                  {((strategy as any).topology.edges || []).map((e: any, i: number) => {
                    const nodes = (strategy as any).topology.nodes;
                    const src = nodes.find((n: any) => n.id === e.source);
                    const tgt = nodes.find((n: any) => n.id === e.target);
                    if (!src?.lat || !tgt?.lat) return null;
                    const isPlaced = src.placed_resource || tgt.placed_resource;
                    return (
                      <Polyline key={i}
                        positions={[[src.lat, src.lon], [tgt.lat, tgt.lon]]}
                        pathOptions={{
                          color: isPlaced ? '#ff3c00' : 'rgba(255,255,255,0.15)',
                          weight: isPlaced ? 1.5 : 0.5,
                          opacity: isPlaced ? 0.4 : 0.2,
                        }}
                      />
                    );
                  })}
                  {/* ZIP nodes */}
                  {((strategy as any).topology.nodes || []).map((n: any) => {
                    if (!n.lat) return null;
                    const isPlaced = !!n.placed_resource;
                    const r = isPlaced ? 14 : 5 + n.rdcs * 8;
                    const fill = isPlaced ? '#ff3c00' : n.rdcs > 0.7 ? '#ff6b35' : n.rdcs > 0.4 ? '#fbbf24' : '#0d9488';
                    return (
                      <CircleMarker key={n.id}
                        center={[n.lat, n.lon]}
                        radius={r}
                        pathOptions={{
                          color: isPlaced ? '#ff3c00' : 'rgba(255,255,255,0.3)',
                          fillColor: fill,
                          fillOpacity: isPlaced ? 0.85 : 0.5,
                          weight: isPlaced ? 2 : 0.5,
                        }}
                      >
                        <LeafletTooltip permanent={isPlaced} direction="top" offset={[0, -r]}>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: isPlaced ? 700 : 400 }}>
                            <div>{n.id}{isPlaced ? ` — ${n.placed_resource}` : ''}</div>
                            <div style={{ fontSize: 9, opacity: 0.7 }}>LE: {n.life_expectancy}yr · RDCS: {n.rdcs}</div>
                          </div>
                        </LeafletTooltip>
                        {!isPlaced && (
                          <Popup>
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                              <strong>ZIP {n.id}</strong><br />
                              Life Exp: {n.life_expectancy} yr<br />
                              RDCS: {n.rdcs}<br />
                              Pop: {n.population?.toLocaleString()}
                            </div>
                          </Popup>
                        )}
                      </CircleMarker>
                    );
                  })}
                </MapContainer>
              </div>
              <div className="flex gap-4 px-5 py-3 justify-center" style={{ background: '#0f0f0f' }}>
                {[
                  { color: '#ff3c00', label: 'Resource placed' },
                  { color: '#ff6b35', label: 'Critical (RDCS > 0.7)' },
                  { color: '#fbbf24', label: 'Moderate (0.4-0.7)' },
                  { color: '#0d9488', label: 'Low need (< 0.4)' },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                    <span className="font-mono text-[9px]" style={{ color: 'rgba(224,224,224,0.3)' }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Individual placement cards */}
          <div className="space-y-3">
            {strategy.placements.map((p, idx) => {
              const rec = p.recommended_zip;
              if (!rec) return null;
              const isExpanded = expandedPlacement === idx;
              return (
                <div key={p.resource.id} className="rounded-xl overflow-hidden" style={{ background: '#0f0f0f', border: '1px solid rgba(224,224,224,0.06)' }}>
                  {/* Collapsed header */}
                  <button
                    onClick={() => setExpandedPlacement(isExpanded ? -1 : idx)}
                    className="w-full text-left p-5 flex items-center gap-4"
                    style={{ background: isExpanded ? 'rgba(255,60,0,0.04)' : 'transparent' }}
                  >
                    <div className="w-8 h-8 rounded flex items-center justify-center shrink-0" style={{ background: 'rgba(255,60,0,0.1)', border: '1px solid rgba(255,60,0,0.2)' }}>
                      <span className="font-mono text-[10px] font-bold" style={{ color: '#ff3c00' }}>{String(idx + 1).padStart(2, '0')}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-display text-base font-bold" style={{ color: '#e0e0e0' }}>{p.resource.name}</h3>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(255,60,0,0.1)', color: '#ff3c00', border: '1px solid rgba(255,60,0,0.2)' }}>
                          ZIP {rec.zip}
                        </span>
                        <span className="font-mono text-[10px]" style={{ color: 'rgba(224,224,224,0.25)' }}>{p.resource.cost}</span>
                        {rec.mirofish && (
                          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(13,148,136,0.08)', color: '#0d9488', border: '1px solid rgba(13,148,136,0.15)' }}>
                            {(rec.mirofish.adoption_rate * 100).toFixed(0)}% adoption / +{rec.mirofish.avg_sentiment.toFixed(2)} sentiment
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] mt-0.5" style={{ color: 'rgba(224,224,224,0.35)' }}>{p.resource.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-lg font-bold" style={{ color: '#0d9488' }}>
                        {(rec.score * 100).toFixed(0)}
                      </div>
                      <div className="font-mono text-[8px]" style={{ color: 'rgba(224,224,224,0.2)' }}>SCORE</div>
                    </div>
                    <span className="font-mono text-sm" style={{ color: 'rgba(224,224,224,0.2)' }}>{isExpanded ? '▾' : '▸'}</span>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2" style={{ borderTop: '1px solid rgba(224,224,224,0.04)' }}>
                      {/* Score breakdown */}
                      <div className="grid grid-cols-5 gap-4 mb-4">
                        {[
                          { label: 'RDCS', value: rec.rdcs, color: '#ff3c00' },
                          { label: 'Spillover', value: rec.spillover, color: '#fbbf24' },
                          { label: 'Adoption', value: rec.adoption, color: '#22c55e' },
                          { label: 'Pop Impact', value: Math.min(rec.population / 50000, 1), color: '#4dabf7' },
                          { label: 'LE Gap', value: Math.max(0, 80 - rec.life_expectancy) / 15, color: '#e599f7' },
                        ].map(s => (
                          <div key={s.label}>
                            <div className="font-mono text-[8px] tracking-[0.1em] mb-1" style={{ color: 'rgba(224,224,224,0.25)' }}>{s.label.toUpperCase()}</div>
                            <div className="h-2 rounded-full mb-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
                              <div className="h-full rounded-full" style={{ width: `${s.value * 100}%`, background: s.color }} />
                            </div>
                            <div className="font-mono text-[10px]" style={{ color: s.color }}>{(s.value * 100).toFixed(0)}%</div>
                          </div>
                        ))}
                      </div>

                      {/* ZIP details */}
                      <div className="flex gap-6 mb-4">
                        <div>
                          <div className="font-mono text-[8px] tracking-[0.1em] mb-1" style={{ color: 'rgba(224,224,224,0.2)' }}>TARGET ZIP</div>
                          <div className="font-mono text-2xl font-bold" style={{ color: '#ff3c00' }}>{rec.zip}</div>
                          <div className="text-[10px]" style={{ color: 'rgba(224,224,224,0.35)' }}>{rec.name}</div>
                        </div>
                        <div>
                          <div className="font-mono text-[8px] tracking-[0.1em] mb-1" style={{ color: 'rgba(224,224,224,0.2)' }}>POPULATION</div>
                          <div className="font-mono text-lg font-bold" style={{ color: '#e0e0e0' }}>{rec.population.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="font-mono text-[8px] tracking-[0.1em] mb-1" style={{ color: 'rgba(224,224,224,0.2)' }}>CURRENT LE</div>
                          <div className="font-mono text-lg font-bold" style={{ color: '#e0e0e0' }}>{rec.life_expectancy.toFixed(1)} yr</div>
                        </div>
                        <div>
                          <div className="font-mono text-[8px] tracking-[0.1em] mb-1" style={{ color: 'rgba(224,224,224,0.2)' }}>RDCS</div>
                          <div className="font-mono text-lg font-bold" style={{ color: '#ff3c00' }}>{rec.rdcs}</div>
                        </div>
                        <div>
                          <div className="font-mono text-[8px] tracking-[0.1em] mb-1" style={{ color: 'rgba(224,224,224,0.2)' }}>MIROFISH ADOPTION</div>
                          <div className="font-mono text-lg font-bold" style={{ color: '#22c55e' }}>{(rec.adoption * 100).toFixed(0)}%</div>
                        </div>
                      </div>

                      {/* Deficit breakdown */}
                      <div className="mb-4">
                        <div className="font-mono text-[8px] tracking-[0.1em] mb-2" style={{ color: 'rgba(224,224,224,0.2)' }}>DEFICIT BREAKDOWN</div>
                        <div className="flex gap-3">
                          {Object.entries(rec.deficit_breakdown).map(([feat, val]) => (
                            <div key={feat} className="px-3 py-2 rounded" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(224,224,224,0.04)' }}>
                              <div className="font-mono text-[9px]" style={{ color: 'rgba(224,224,224,0.3)' }}>{FEATURE_LABELS[feat] || feat}</div>
                              <div className="font-mono text-sm font-bold" style={{ color: '#ff3c00' }}>{val}%</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Spillover neighbors */}
                      {rec.top_neighbors.length > 0 && (
                        <div className="mb-4">
                          <div className="font-mono text-[8px] tracking-[0.1em] mb-2" style={{ color: 'rgba(224,224,224,0.2)' }}>SPATIAL SPILLOVER (SCAN GRAPH ATTENTION)</div>
                          <div className="flex gap-2">
                            {rec.top_neighbors.map(n => (
                              <div key={n.zip} className="flex items-center gap-2 px-3 py-2 rounded" style={{ background: 'rgba(13,148,136,0.05)', border: '1px solid rgba(13,148,136,0.15)' }}>
                                <span className="font-mono text-xs font-bold" style={{ color: '#0d9488' }}>{n.zip}</span>
                                <div className="h-1.5 w-12 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }}>
                                  <div className="h-full rounded-full" style={{ width: `${n.weight * 100}%`, background: '#0d9488' }} />
                                </div>
                                <span className="font-mono text-[9px]" style={{ color: 'rgba(224,224,224,0.3)' }}>{n.weight}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Alternatives */}
                      <div className="mb-4">
                        <div className="font-mono text-[8px] tracking-[0.1em] mb-2" style={{ color: 'rgba(224,224,224,0.2)' }}>ALTERNATIVE LOCATIONS (TOP 5)</div>
                        <div className="space-y-1">
                          {p.top_5.map((z, i) => (
                            <div key={z.zip} className="flex items-center gap-3">
                              <span className="font-mono text-[10px] w-4 text-right" style={{ color: i === 0 ? '#ff3c00' : 'rgba(224,224,224,0.2)' }}>{i + 1}</span>
                              <span className="font-mono text-[11px] w-12" style={{ color: i === 0 ? '#ff3c00' : 'rgba(224,224,224,0.5)' }}>{z.zip}</span>
                              <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                <div className="h-full rounded-full" style={{ width: `${(z.score / p.top_5[0].score) * 100}%`, background: i === 0 ? '#ff3c00' : 'rgba(224,224,224,0.15)' }} />
                              </div>
                              <span className="font-mono text-[10px] w-8 text-right" style={{ color: 'rgba(224,224,224,0.35)' }}>{(z.score * 100).toFixed(0)}</span>
                              <Link to={`/simulator/${z.zip}`} className="font-mono text-[9px] no-underline" style={{ color: '#0d9488' }}>SIM</Link>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* AI Mockup */}
                      <div className="mb-3 rounded-lg overflow-hidden" style={{ border: '1px solid rgba(224,224,224,0.06)' }}>
                        <img
                          src={`/images/mockup-${p.resource.id.replace('_', '-')}-${rec.zip}.png`}
                          alt={`${p.resource.name} rendering`}
                          className="w-full"
                          style={{ height: 200, objectFit: 'cover', filter: 'brightness(0.85) contrast(1.1)' }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>

                      {/* Placement Report */}
                      {(p as any).report && (
                        <div className="p-4 rounded-lg mb-3" style={{ background: 'rgba(255,255,255,0.015)', borderLeft: '3px solid #ff3c00' }}>
                          <div className="font-mono text-[8px] tracking-[0.15em] mb-2" style={{ color: '#ff3c00' }}>PLACEMENT REPORT</div>
                          <p className="text-[11px] leading-relaxed mb-3" style={{ color: 'rgba(224,224,224,0.55)' }}>
                            {(p as any).report.summary}
                          </p>
                          <div className="font-mono text-[8px] tracking-[0.1em] mb-1" style={{ color: 'rgba(224,224,224,0.25)' }}>RATIONALE</div>
                          <div className="space-y-1 mb-3">
                            {(p as any).report.rationale.map((r: string, i: number) => (
                              <div key={i} className="flex gap-2 text-[10px]">
                                <span style={{ color: '#0d9488' }}>→</span>
                                <span style={{ color: 'rgba(224,224,224,0.4)' }}>{r}</span>
                              </div>
                            ))}
                          </div>
                          {(p as any).report.alternatives.length > 0 && (
                            <>
                              <div className="font-mono text-[8px] tracking-[0.1em] mb-1" style={{ color: 'rgba(224,224,224,0.25)' }}>IF THIS SITE IS UNAVAILABLE</div>
                              <div className="space-y-0.5">
                                {(p as any).report.alternatives.map((a: string, i: number) => (
                                  <div key={i} className="text-[10px]" style={{ color: 'rgba(224,224,224,0.3)' }}>{i + 1}. {a}</div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* MiroFish Simulation Voices */}
                      {(p as any).simulation?.featured_quotes?.length > 0 && (
                        <div className="p-4 rounded-lg" style={{ background: 'rgba(13,148,136,0.03)', borderLeft: '3px solid #0d9488' }}>
                          <div className="font-mono text-[8px] tracking-[0.15em] mb-2" style={{ color: '#0d9488' }}>
                            MIROFISH AGENT VOICES — {(p as any).simulation.agents_simulated} SIMULATED RESIDENTS
                          </div>
                          <div className="flex gap-3 mb-3">
                            <div className="text-center">
                              <div className="font-mono text-lg font-bold" style={{ color: '#0d9488' }}>{((p as any).simulation.adoption_rate * 100).toFixed(0)}%</div>
                              <div className="font-mono text-[8px]" style={{ color: 'rgba(224,224,224,0.2)' }}>ADOPTION</div>
                            </div>
                            <div className="text-center">
                              <div className="font-mono text-lg font-bold" style={{ color: '#22c55e' }}>+{(p as any).simulation.avg_sentiment.toFixed(2)}</div>
                              <div className="font-mono text-[8px]" style={{ color: 'rgba(224,224,224,0.2)' }}>SENTIMENT</div>
                            </div>
                            <div className="text-center">
                              <div className="font-mono text-lg font-bold" style={{ color: '#fbbf24' }}>{(p as any).simulation.total_weekly_visits}</div>
                              <div className="font-mono text-[8px]" style={{ color: 'rgba(224,224,224,0.2)' }}>VISITS/WK</div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {(p as any).simulation.featured_quotes.slice(0, 3).map((q: any, i: number) => (
                              <div key={i} className="p-2 rounded" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-mono text-[9px] font-medium" style={{ color: 'rgba(224,224,224,0.5)' }}>
                                    {q.role}, {q.age}
                                  </span>
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: q.sentiment > 0.5 ? '#22c55e' : q.sentiment > 0 ? '#fbbf24' : '#ef4444' }} />
                                </div>
                                <p className="text-[10px] italic leading-relaxed" style={{ color: 'rgba(224,224,224,0.4)' }}>
                                  "{q.quote}"
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Network centrality */}
          {strategy.centrality_ranking.length > 0 && (
            <div className="mt-4 rounded-xl p-5" style={{ background: '#0f0f0f', border: '1px solid rgba(224,224,224,0.06)' }}>
              <div className="font-mono text-[8px] tracking-[0.15em] mb-3" style={{ color: 'rgba(224,224,224,0.25)' }}>TOPOLOGICAL CENTRALITY — GRAPH ATTENTION NETWORK</div>
              <p className="text-xs mb-3" style={{ color: 'rgba(224,224,224,0.35)' }}>
                ZIPs ranked by spatial influence. Resources placed in high-centrality nodes maximize network-wide impact.
              </p>
              <div className="flex gap-2 flex-wrap">
                {strategy.centrality_ranking.slice(0, 8).map((c, i) => (
                  <div key={c.zip} className="flex items-center gap-2 px-3 py-1.5 rounded" style={{
                    background: i < 3 ? 'rgba(255,60,0,0.05)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${i < 3 ? 'rgba(255,60,0,0.15)' : 'rgba(224,224,224,0.04)'}`,
                  }}>
                    <span className="font-mono text-[10px] font-bold" style={{ color: i < 3 ? '#ff3c00' : 'rgba(224,224,224,0.4)' }}>{c.zip}</span>
                    <div className="h-1 w-8 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="h-full rounded-full" style={{ width: `${c.centrality * 100}%`, background: i < 3 ? '#ff3c00' : 'rgba(224,224,224,0.15)' }} />
                    </div>
                    <span className="font-mono text-[9px]" style={{ color: 'rgba(224,224,224,0.25)' }}>{c.centrality}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cluster Profiles */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <div className="font-mono text-[10px] tracking-[0.2em] mb-4" style={{ color: 'rgba(224,224,224,0.3)' }}>
          NEIGHBORHOOD ARCHETYPES
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {clusterList.map(cluster => {
            const color = CLUSTER_COLORS[cluster.label] || '#666';
            const m = cluster.avg_metrics;
            return (
              <div key={cluster.label} className="rounded-xl p-5" style={{
                background: '#0f0f0f',
                border: '1px solid rgba(224,224,224,0.06)',
                borderLeftColor: color,
                borderLeftWidth: 3,
              }}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-display text-base font-bold" style={{ color: '#e0e0e0' }}>{cluster.label}</h3>
                  <span className="font-mono text-[10px]" style={{ color: 'rgba(224,224,224,0.3)' }}>
                    {cluster.count} ZIP codes
                  </span>
                </div>
                <p className="text-xs mb-4" style={{ color: 'rgba(224,224,224,0.35)' }}>
                  {cluster.description}
                </p>
                <div className="grid grid-cols-3 gap-x-4 gap-y-2 mb-3">
                  {[
                    { label: 'Life Exp', value: `${(m.life_expectancy || 0).toFixed(1)} yr` },
                    { label: 'Income', value: `$${Math.round((m.median_income || 0) / 1000)}K` },
                    { label: 'RDCS', value: (m.rdcs_normalized || 0).toFixed(2) },
                    { label: 'Obesity', value: `${(m.obesity || 0).toFixed(1)}%` },
                    { label: 'Poverty', value: `${(m.poverty_rate || 0).toFixed(0)}%` },
                    { label: 'Pop', value: `${Math.round((m.population || 0) / 1000)}K` },
                  ].map(metric => (
                    <div key={metric.label}>
                      <div className="font-mono text-[9px] tracking-[0.1em]" style={{ color: 'rgba(224,224,224,0.25)' }}>
                        {metric.label.toUpperCase()}
                      </div>
                      <div className="font-mono text-sm font-bold" style={{ color: metric.label === 'RDCS' ? color : '#e0e0e0' }}>
                        {metric.value}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {cluster.zip_codes.map((zip: string) => (
                    <Link
                      key={zip}
                      to={`/simulator/${zip}`}
                      className="font-mono text-[10px] px-2 py-0.5 rounded no-underline transition-all hover:opacity-80"
                      style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}
                    >
                      {zip}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cross-Cluster Comparison */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <div className="font-mono text-[10px] tracking-[0.2em] mb-4" style={{ color: 'rgba(224,224,224,0.3)' }}>
          CROSS-CLUSTER COMPARISON
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {COMPARE_METRICS.map(metric => {
            const chartData = clusterList.map(c => ({
              name: c.label.split(' ')[0],
              value: metric.transform ? metric.transform(c.avg_metrics[metric.key] || 0) : (c.avg_metrics[metric.key] || 0),
              color: CLUSTER_COLORS[c.label] || '#666',
            }));

            return (
              <div key={metric.key} className="rounded-xl p-4" style={{ background: '#0f0f0f', border: '1px solid rgba(224,224,224,0.06)' }}>
                <h3 className="font-mono text-[10px] tracking-[0.1em] mb-3" style={{ color: 'rgba(224,224,224,0.4)' }}>
                  {metric.label.toUpperCase()}
                </h3>
                <div style={{ width: '100%', height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={chartData} layout="vertical" margin={{ left: 60, right: 10 }}>
                      <XAxis type="number" stroke="rgba(224,224,224,0.15)" tick={{ fill: 'rgba(224,224,224,0.3)', fontSize: 10, fontFamily: "'DM Mono', monospace" }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke="rgba(224,224,224,0.15)"
                        tick={{ fill: 'rgba(224,224,224,0.4)', fontSize: 10, fontFamily: "'DM Mono', monospace" }}
                        width={55}
                      />
                      <Tooltip
                        contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(224,224,224,0.1)', borderRadius: 8 }}
                        itemStyle={{ color: '#e0e0e0' }}
                        labelStyle={{ color: 'rgba(224,224,224,0.5)' }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} fillOpacity={0.85}>
                        {chartData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Methodology */}
      <div className="max-w-7xl mx-auto px-6 pb-12">
        <div className="rounded-lg p-4" style={{ background: 'rgba(255,255,255,0.02)', borderLeft: '3px solid rgba(255,60,0,0.3)', border: '1px solid rgba(224,224,224,0.04)', borderLeftColor: 'rgba(255,60,0,0.3)', borderLeftWidth: 3 }}>
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(224,224,224,0.35)' }}>
            <strong style={{ color: 'rgba(224,224,224,0.6)' }}>Methodology:</strong> Clusters: K-Means (k=4) on 34 ZIPs with normalized features.
            Predictions: SCAN (Spatial Causal Attention Network) trained on 218 Duval County census tracts with 20 health/socioeconomic features, 5-fold CV R²=0.99, MAE=0.09 years.
            Feature importance derived from SCAN attention weights (outgoing causal attention sum per feature).
            Counterfactual: supply-side features replaced with county medians; SCAN predicts resulting life expectancy change.
            RDCS = (Demand - Supply) / max_gap, normalized 0-1. Placement optimization weighted by need (25%), LE gap (20%), MiroFish adoption (15%), population (15%), spillover (10%), RDCS (10%), sentiment (5%).
          </p>
        </div>
      </div>
    </div>
  );
}
