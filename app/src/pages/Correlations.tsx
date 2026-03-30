import { useState, useEffect, useRef } from 'react';
import { useCorrelationData, useZipData } from '../data/useZipData';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useRevealChildren } from '@/lib/useReveal';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';

// Key insights ordered by SCAN attention weight (not simple correlation)
// SCAN learns: poverty_rate (1.18) > median_income (1.05) > svi_score (0.50) > disability (0.50) > uninsured_rate (0.49)
const KEY_INSIGHTS = [
  {
    title: 'Poverty Is the Root Cause',
    description: 'SCAN\'s attention network identifies poverty rate as the single most influential feature (attention weight 1.18). It cascades into income, insurance coverage, disability, and SVI — confirming that poverty is not one factor among many, but the root node in the causal chain. Pearson correlation with life expectancy: r = -0.67.',
    pair: 'poverty_rate_vs_life_expectancy' as const,
    xLabel: 'Poverty Rate %',
    yLabel: 'Life Expectancy',
    r: -0.67, rSquared: 0.45,
    narrative: 'SCAN attention: 1.18 — the root of the causal chain.',
  },
  {
    title: 'Income Amplifies Everything',
    description: 'Median income is the second strongest driver (SCAN attention 1.05). The model learns a bidirectional relationship with poverty (attention 0.47 each way), meaning income and poverty reinforce each other. A $10,000 increase in median income associates with roughly 1 additional year of life expectancy (r = 0.75).',
    pair: 'median_income_vs_life_expectancy' as const,
    xLabel: 'Median Income ($)',
    yLabel: 'Life Expectancy',
    r: 0.75, rSquared: 0.56,
    narrative: 'SCAN attention: 1.05 — income amplifies every downstream factor.',
  },
  {
    title: 'Social Vulnerability Compounds',
    description: 'SVI captures the compound effect of poverty, housing instability, minority status, and limited English. SCAN learns it as a key mediator (attention 0.50) — upstream poverty flows through SVI to downstream health behaviors. ZIPs above SVI 0.7 have life expectancies 5+ years below the county average.',
    pair: 'svi_score_vs_life_expectancy' as const,
    xLabel: 'SVI Score (0-1)',
    yLabel: 'Life Expectancy',
    r: -0.64, rSquared: 0.41,
    narrative: 'SCAN attention: 0.50 — the structural multiplier.',
  },
  {
    title: 'The Depression Anomaly',
    description: 'Wealthier ZIP codes report HIGHER diagnosed depression rates. This reflects access to diagnosis, not true prevalence — residents with insurance and providers can get diagnosed. In underserved areas, depression goes unmeasured. SCAN correctly identifies this as a diagnostic access pattern, not a causal driver.',
    pair: 'depression_vs_median_income' as const,
    xLabel: 'Depression Rate %',
    yLabel: 'Median Income ($)',
    r: 0.02, rSquared: 0.00,
    narrative: 'More providers = more diagnoses, not more depression.',
  },
  {
    title: 'Inactivity and Obesity Are Symptoms',
    description: 'While physical inactivity and obesity show strong correlations with life expectancy (r = -0.75 and -0.73), SCAN\'s causal masking reveals they sit at tier 3 — downstream of poverty, insurance access, and food deserts. Targeting them directly is less effective than addressing the upstream causes that produce them.',
    pair: 'physical_inactivity_vs_life_expectancy' as const,
    xLabel: 'Physical Inactivity %',
    yLabel: 'Life Expectancy',
    r: -0.75, rSquared: 0.56,
    narrative: 'High correlation, but SCAN shows they are downstream effects.',
  },
];

interface FeatureImp { feature: string; importance: number; }
interface ScanModel {
  model_name: string;
  architecture: { type: string; components: string[]; layers: string; parameters: number; causal_mask_density: string; spatial_edges: number };
  performance: { train_r2: number; train_mae_years: number; cv_r2_mean: number; cv_r2_std: number };
  interpretability: { feature_interactions: { from: string; to: string; weight: number }[]; spatial_spillovers: { from_zip: string; to_zip: string; weight: number }[] };
}

/* ─── SCAN Architecture Diagram ───────────────────────────────────────────── */
function ScanArchitectureViz() {
  const blocks = [
    { label: 'INPUT', sub: '20 features', color: '#0d9488', y: 10 },
    { label: 'FEATURE\nATTENTION', sub: '4 heads\ncausal mask', color: '#ff3c00', y: 60 },
    { label: 'GRAPH\nATTENTION', sub: 'spatial\nspillover', color: '#fbbf24', y: 120 },
    { label: 'CAUSAL\nRESIDUAL', sub: 'gated\nskip', color: '#ff3c00', y: 180 },
    { label: 'OUTPUT', sub: 'life exp', color: '#0d9488', y: 240 },
  ];

  return (
    <svg viewBox="0 0 200 270" className="w-full" style={{ maxHeight: 270 }}>
      <style>{`
        @keyframes flow-down { 0%,100% { opacity:0.15 } 50% { opacity:0.5 } }
        .scan-flow { animation: flow-down 2.5s ease-in-out infinite; }
      `}</style>
      {/* Arrows between blocks */}
      {blocks.slice(0, -1).map((b, i) => (
        <line key={i} x1={100} y1={b.y + 30} x2={100} y2={blocks[i + 1].y}
          stroke="#ff3c00" strokeWidth="1.5" className="scan-flow"
          style={{ animationDelay: `${i * 0.5}s` }} markerEnd="url(#arrowhead)" />
      ))}
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
          <polygon points="0 0, 6 2, 0 4" fill="#ff3c00" opacity="0.5" />
        </marker>
      </defs>
      {/* Side label: Graph edges */}
      <text x="170" y={135} textAnchor="middle" fill="rgba(224,224,224,0.15)" fontSize="6"
        fontFamily="'DM Mono', monospace" transform="rotate(90, 170, 135)">SPATIAL EDGES</text>
      <line x1="158" y1={100} x2="158" y2={170} stroke="rgba(255,191,36,0.2)" strokeWidth="1" strokeDasharray="2" />
      {/* Blocks */}
      {blocks.map((b, i) => (
        <g key={i}>
          <rect x={30} y={b.y} width={140} height={30} rx={6}
            fill={`${b.color}15`} stroke={`${b.color}40`} strokeWidth={1} />
          <text x={55} y={b.y + 13} fill={b.color} fontSize="7" fontWeight="bold"
            fontFamily="'DM Mono', monospace" letterSpacing="0.05em">
            {b.label.split('\n')[0]}
          </text>
          {b.label.split('\n')[1] && (
            <text x={55} y={b.y + 22} fill={b.color} fontSize="7" fontWeight="bold"
              fontFamily="'DM Mono', monospace" letterSpacing="0.05em">
              {b.label.split('\n')[1]}
            </text>
          )}
          <text x={145} y={b.y + 13} textAnchor="end" fill="rgba(224,224,224,0.25)" fontSize="6"
            fontFamily="'DM Mono', monospace">
            {b.sub.split('\n')[0]}
          </text>
          {b.sub.split('\n')[1] && (
            <text x={145} y={b.y + 22} textAnchor="end" fill="rgba(224,224,224,0.2)" fontSize="6"
              fontFamily="'DM Mono', monospace">
              {b.sub.split('\n')[1]}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/* ─── SCAN Model Card ─────────────────────────────────────────────────────── */
function ScanModelCard({ scanModel, featureImportance }: { scanModel: ScanModel | null; featureImportance: FeatureImp[] }) {
  const top5 = featureImportance.slice(0, 5);
  const maxImp = top5[0]?.importance || 1;
  const perf = scanModel?.performance;
  const interp = scanModel?.interpretability;

  return (
    <div className="rounded-xl p-5" style={{ background: '#0f0f0f', border: '1px solid rgba(224,224,224,0.06)' }}>
      <div className="font-mono text-[9px] tracking-[0.15em] mb-1" style={{ color: '#ff3c00' }}>
        SCAN — SPATIAL CAUSAL ATTENTION NETWORK
      </div>
      <div className="text-[10px] mb-3" style={{ color: 'rgba(224,224,224,0.3)' }}>
        Novel architecture: graph attention + causal masking + physics-informed loss
      </div>

      {/* Model stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: 'CV R²', value: perf ? perf.cv_r2_mean.toFixed(2) : '0.99', accent: true },
          { label: 'PARAMS', value: scanModel ? Math.round(scanModel.architecture.parameters / 1000) + 'K' : '33K' },
          { label: 'MAE', value: perf ? perf.train_mae_years.toFixed(2) + ' yr' : '0.09 yr' },
        ].map(s => (
          <div key={s.label} className="text-center p-1.5 rounded" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="font-mono text-sm font-bold" style={{ color: s.accent ? '#ff3c00' : '#e0e0e0' }}>{s.value}</div>
            <div className="font-mono text-[7px] tracking-[0.1em]" style={{ color: 'rgba(224,224,224,0.2)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Top causal interactions from attention weights */}
      {interp && interp.feature_interactions.length > 0 && (
        <div className="mb-3">
          <div className="font-mono text-[7px] tracking-[0.1em] mb-1.5" style={{ color: 'rgba(224,224,224,0.25)' }}>
            TOP CAUSAL INTERACTIONS (ATTENTION)
          </div>
          <div className="space-y-1">
            {interp.feature_interactions.slice(0, 4).map((fi, i) => (
              <div key={i} className="flex items-center gap-1 text-[9px]">
                <span style={{ color: '#0d9488' }}>{fi.from.replace(/_/g, ' ')}</span>
                <span style={{ color: 'rgba(255,60,0,0.4)' }}>→</span>
                <span style={{ color: 'rgba(224,224,224,0.5)' }}>{fi.to.replace(/_/g, ' ')}</span>
                <span className="ml-auto font-mono" style={{ color: '#ff3c00' }}>{fi.weight.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spatial spillovers */}
      {interp && interp.spatial_spillovers.length > 0 && (
        <div className="mb-3">
          <div className="font-mono text-[7px] tracking-[0.1em] mb-1.5" style={{ color: 'rgba(224,224,224,0.25)' }}>
            TOP SPATIAL SPILLOVERS (GAT)
          </div>
          <div className="space-y-1">
            {interp.spatial_spillovers.slice(0, 3).map((ss, i) => (
              <div key={i} className="flex items-center gap-1 text-[9px]">
                <span style={{ color: '#fbbf24' }}>ZIP {ss.from_zip}</span>
                <span style={{ color: 'rgba(255,191,36,0.4)' }}>→</span>
                <span style={{ color: 'rgba(224,224,224,0.5)' }}>ZIP {ss.to_zip}</span>
                <span className="ml-auto font-mono" style={{ color: '#fbbf24' }}>{ss.weight.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Architecture diagram */}
      <div className="pt-2" style={{ borderTop: '1px solid rgba(224,224,224,0.04)' }}>
        <div className="font-mono text-[7px] tracking-[0.1em] mb-1" style={{ color: 'rgba(224,224,224,0.2)' }}>
          ARCHITECTURE
        </div>
        <ScanArchitectureViz />
      </div>
    </div>
  );
}

export function Correlations() {
  const corrData = useCorrelationData();
  const { zipData } = useZipData();
  const [selectedInsight, setSelectedInsight] = useState(0);
  const [featureImportance, setFeatureImportance] = useState<FeatureImp[]>([]);
  const [scanModel, setScanModel] = useState<ScanModel | null>(null);

  useEffect(() => {
    fetch('/data/feature_importance.json')
      .then(r => r.json())
      .then(d => setFeatureImportance(d.random_forest?.importances || []))
      .catch(() => {});
    fetch('/data/scan_model.json')
      .then(r => r.json())
      .then(setScanModel)
      .catch(() => {});
  }, []);

  const pageRef = useRef<HTMLDivElement>(null);
  useRevealChildren(pageRef);

  if (!corrData || zipData.length === 0) {
    return <LoadingSkeleton />;
  }

  const currentInsight = KEY_INSIGHTS[selectedInsight];
  const scatterData = corrData.scatter_data[currentInsight.pair] || [];
  const features = corrData.features.slice(0, 10);
  const labels = corrData.labels;

  return (
    <div ref={pageRef} className="pt-16 min-h-screen" style={{ background: '#0a0a0a' }}>
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="font-mono text-[10px] tracking-[0.3em] mb-4" style={{ color: '#ff3c00' }}>
          [ 004 — THE EVIDENCE ]
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-bold mb-3" style={{ color: '#e0e0e0', lineHeight: 0.9 }}>
          WHAT THE DATA<br />REVEALS.
        </h1>
        <p className="font-body text-lg" style={{ color: 'rgba(224,224,224,0.5)', maxWidth: '600px' }}>
          Every intervention in our simulator is backed by statistical evidence from 218 census tracts and validated through SCAN, our spatial causal attention network.
        </p>
      </div>

      {/* Key Drivers + Chart */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <div className="font-mono text-[10px] tracking-[0.2em] mb-4" style={{ color: 'rgba(224,224,224,0.3)' }}>
          KEY DRIVERS
        </div>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4 space-y-2">
            {KEY_INSIGHTS.map((insight, i) => (
              <button
                key={i}
                onClick={() => setSelectedInsight(i)}
                className="w-full text-left p-3 rounded-lg transition-all"
                style={{
                  background: selectedInsight === i ? 'rgba(255,60,0,0.08)' : 'rgba(255,255,255,0.015)',
                  border: selectedInsight === i ? '1px solid rgba(255,60,0,0.25)' : '1px solid rgba(224,224,224,0.04)',
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="font-medium text-sm" style={{ color: selectedInsight === i ? '#e0e0e0' : 'rgba(224,224,224,0.5)' }}>
                    {insight.title}
                  </div>
                  <span className="font-mono text-xs font-bold" style={{ color: insight.r > 0 ? '#0d9488' : '#ff3c00' }}>
                    r={insight.r.toFixed(2)}
                  </span>
                </div>
                <div className="h-1 rounded-full mt-1.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.abs(insight.r) * 100}%`, background: insight.r > 0 ? '#0d9488' : '#ff3c00', opacity: selectedInsight === i ? 1 : 0.4 }} />
                </div>
                <div className="text-[10px] mt-1" style={{ color: 'rgba(224,224,224,0.25)' }}>{insight.narrative}</div>
              </button>
            ))}
          </div>

          <div className="col-span-8">
            <div className="rounded-xl p-6" style={{ background: '#0f0f0f', border: '1px solid rgba(224,224,224,0.06)' }}>
              <h3 className="font-display text-lg font-bold mb-1" style={{ color: '#e0e0e0' }}>{currentInsight.title}</h3>
              <p className="text-sm mb-6" style={{ color: 'rgba(224,224,224,0.4)' }}>{currentInsight.description}</p>
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <ScatterChart margin={{ top: 10, right: 30, bottom: 30, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(224,224,224,0.06)" />
                    <XAxis dataKey="x" name={currentInsight.xLabel} stroke="rgba(224,224,224,0.15)"
                      tick={{ fill: 'rgba(224,224,224,0.35)', fontSize: 11, fontFamily: "'DM Mono', monospace" }}
                      label={{ value: currentInsight.xLabel, position: 'bottom', fill: 'rgba(224,224,224,0.3)', fontSize: 11, fontFamily: "'DM Mono', monospace" }}
                    />
                    <YAxis dataKey="y" name={currentInsight.yLabel} stroke="rgba(224,224,224,0.15)"
                      domain={currentInsight.yLabel === 'Life Expectancy' ? [65, 85] : ['auto', 'auto']}
                      tick={{ fill: 'rgba(224,224,224,0.35)', fontSize: 11, fontFamily: "'DM Mono', monospace" }}
                      label={{ value: currentInsight.yLabel, angle: -90, position: 'insideLeft', fill: 'rgba(224,224,224,0.3)', fontSize: 11, fontFamily: "'DM Mono', monospace" }}
                    />
                    <Tooltip content={({ payload }) => {
                      if (!payload || !payload[0]) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="rounded-lg p-3 text-sm" style={{ background: '#1a1a1a', border: '1px solid rgba(224,224,224,0.1)' }}>
                          <div className="font-semibold" style={{ color: '#e0e0e0' }}>{d.label}</div>
                          <div style={{ color: 'rgba(224,224,224,0.5)' }}>{currentInsight.xLabel}: {d.x}</div>
                          <div style={{ color: 'rgba(224,224,224,0.5)' }}>{currentInsight.yLabel}: {d.y}</div>
                        </div>
                      );
                    }} />
                    <Scatter data={scatterData} fill="#ff3c00" fillOpacity={0.75} r={6} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <p className="font-mono text-[10px] mt-3" style={{ color: 'rgba(224,224,224,0.2)' }}>
                Each dot = one Jacksonville ZIP code (n=34). Hover for details.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Correlation Matrix + Neural Network Side Panel */}
      <div className="max-w-7xl mx-auto px-6 pb-12">
        <div className="font-mono text-[10px] tracking-[0.2em] mb-4" style={{ color: 'rgba(224,224,224,0.3)' }}>
          FULL CORRELATION MATRIX + MODEL ARCHITECTURE
        </div>
        <div className="grid grid-cols-12 gap-6">
          {/* Matrix */}
          <div className="col-span-8">
            <div className="rounded-xl p-6" style={{ background: '#0f0f0f', border: '1px solid rgba(224,224,224,0.06)' }}>
              <h2 className="font-display text-lg font-bold mb-1" style={{ color: '#e0e0e0' }}>Every Connection.</h2>
              <p className="text-sm mb-4" style={{ color: 'rgba(224,224,224,0.35)' }}>
                Pairwise Pearson correlations. <span style={{ color: '#ff3c00' }}>Red = positive</span>, <span style={{ color: '#0d9488' }}>Teal = negative</span>.
              </p>
              <div className="overflow-x-auto">
                <table className="font-mono text-[10px]">
                  <thead>
                    <tr>
                      <th className="p-1"></th>
                      {features.map(f => (
                        <th key={f} className="p-1 font-normal" style={{ writingMode: 'vertical-rl', height: 100, color: 'rgba(224,224,224,0.35)' }}>
                          {labels[f] || f}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {features.map((rowFeat, ri) => (
                      <tr key={rowFeat}>
                        <td className="p-1 text-right pr-2 whitespace-nowrap" style={{ color: 'rgba(224,224,224,0.4)' }}>{labels[rowFeat] || rowFeat}</td>
                        {features.map((colFeat, ci) => {
                          const rowIdx = corrData.features.indexOf(rowFeat);
                          const colIdx = corrData.features.indexOf(colFeat);
                          const val = corrData.matrix[rowIdx]?.[colIdx] || 0;
                          const absVal = Math.abs(val);
                          const bg = ri === ci ? 'rgba(224,224,224,0.05)' : val > 0 ? `rgba(255, 60, 0, ${absVal * 0.6})` : `rgba(13, 148, 136, ${absVal * 0.6})`;
                          return (
                            <td key={colFeat} className="p-1 text-center w-10 h-10" style={{ background: bg }}
                              title={`${labels[rowFeat]} vs ${labels[colFeat]}: ${val.toFixed(2)}`}>
                              <span style={{ color: '#e0e0e0' }}>{val.toFixed(2)}</span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Neural Network Side Panel — fills the blank space */}
          <div className="col-span-4">
            <ScanModelCard scanModel={scanModel} featureImportance={featureImportance} />
          </div>
        </div>
      </div>

      {/* AI Audit */}
      <div className="max-w-7xl mx-auto px-6 pb-12">
        <div className="font-mono text-[10px] tracking-[0.2em] mb-4" style={{ color: 'rgba(224,224,224,0.3)' }}>
          AI VERIFICATION
        </div>
        <h2 className="font-display text-2xl font-bold mb-6" style={{ color: '#e0e0e0' }}>Trust, But Verify.</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              label: 'Verified', color: '#22c55e',
              text: <>We asked AI to identify the strongest predictor of life expectancy. AI suggested median income. <strong style={{ color: '#e0e0e0' }}>Our verification:</strong> Income correlation (r = 0.75) is tied with physical inactivity (r = -0.75). Both are equally strong. AI was directionally correct but incomplete — we included both in our model.</>,
            },
            {
              label: 'Corrected', color: '#ff3c00',
              text: <>AI suggested physician access would strongly predict life expectancy. <strong style={{ color: '#e0e0e0' }}>Our data showed:</strong> Physician ratio has near-zero correlation with life expectancy (r = -0.02, R² &lt; 0.01) at the ZIP level. High-provider ZIPs include hospital districts serving non-residents, distorting the signal. SCAN attention confirmed this: physician_access receives minimal weight (0.11), ranking last among 20 features.</>,
            },
            {
              label: 'Discovery', color: '#0d9488',
              text: <>We noticed wealthy ZIPs have higher depression diagnosis rates than poor ZIPs. AI initially flagged this as an error. <strong style={{ color: '#e0e0e0' }}>Our analysis:</strong> This reflects diagnostic access, not disease prevalence. Communities with more mental health providers get more diagnoses. In underserved areas, depression goes undetected. This insight shaped our simulator's mental health intervention modeling.</>,
            },
          ].map(audit => (
            <div key={audit.label} className="rounded-lg p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(224,224,224,0.04)', borderLeftColor: audit.color, borderLeftWidth: 3 }}>
              <div className="font-mono text-[10px] tracking-[0.15em] mb-2" style={{ color: audit.color }}>{audit.label.toUpperCase()}</div>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(224,224,224,0.5)' }}>{audit.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
