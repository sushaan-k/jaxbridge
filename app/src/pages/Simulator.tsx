import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useZipData, useImpactModel } from '../data/useZipData';
import { simulateIntervention, DEFAULT_INTERVENTION, formatCurrency } from '../lib/scoring';
import { parseNaturalLanguageIntervention } from '../lib/nlInterventionParser';
import type { Intervention } from '../lib/scoring';

const CLUSTER_COLORS: Record<string, string> = {
  'Critical Desert': '#dc2626',
  'Struggling Suburban': '#ea580c',
  'Stable Middle': '#d97706',
  'Resourced Corridor': '#16a34a',
};

interface SliderConfig {
  key: keyof Intervention;
  label: string;
  max: number;
  step: number;
  unit: string;
  costKey: string;
}

const SLIDERS: SliderConfig[] = [
  { key: 'physicians', label: 'Primary Care Physicians', max: 20, step: 1, unit: '', costKey: 'physician' },
  { key: 'mentalHealthProviders', label: 'Mental Health Providers', max: 15, step: 1, unit: '', costKey: 'mental_health' },
  { key: 'groceryStores', label: 'Grocery Stores', max: 5, step: 1, unit: '', costKey: 'grocery_store' },
  { key: 'parkAcres', label: 'Park Acres', max: 200, step: 10, unit: ' acres', costKey: 'park_acre' },
  { key: 'childCareCenters', label: 'Child Care Centers', max: 10, step: 1, unit: '', costKey: 'child_care' },
  { key: 'insuranceSubsidyPct', label: 'Insurance Subsidy', max: 30, step: 5, unit: '%', costKey: 'insurance_subsidy' },
];

function LifeExpectancyDial({ current, projected, min = 65, max = 85 }: { current: number; projected: number; min?: number; max?: number }) {
  const range = max - min;
  const currentPct = ((current - min) / range) * 100;
  const projectedPct = ((projected - min) / range) * 100;
  const gain = projected - current;

  return (
    <div className="flex flex-col items-center px-4">
      {/* Big number */}
      <div className="font-display text-6xl font-bold mb-1" style={{ color: '#e0e0e0' }}>
        {projected.toFixed(1)}
      </div>
      <div className="font-mono text-[10px] tracking-[0.2em] mb-6" style={{ color: 'rgba(224,224,224,0.35)' }}>
        YEARS PROJECTED
      </div>

      {/* Horizontal gauge */}
      <div className="w-full">
        <div className="relative h-3 rounded-full" style={{ background: 'rgba(224,224,224,0.06)' }}>
          {/* Current value fill */}
          <div className="absolute h-full rounded-full" style={{ width: `${currentPct}%`, background: 'rgba(224,224,224,0.15)' }} />
          {/* Gain fill */}
          {gain > 0 && (
            <div className="absolute h-full rounded-r-full" style={{
              left: `${currentPct}%`,
              width: `${projectedPct - currentPct}%`,
              background: '#ff3c00',
              boxShadow: '0 0 12px rgba(255,60,0,0.4)',
            }} />
          )}
          {/* Current marker */}
          <div className="absolute top-1/2 -translate-y-1/2 w-1 h-5 rounded-full" style={{ left: `${currentPct}%`, background: 'rgba(224,224,224,0.5)' }} />
          {/* Projected marker */}
          {gain > 0.05 && (
            <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-full" style={{ left: `${projectedPct}%`, background: '#ff3c00', boxShadow: '0 0 8px rgba(255,60,0,0.5)' }} />
          )}
        </div>
        {/* Scale labels */}
        <div className="flex justify-between mt-1.5">
          <span className="font-mono text-[10px]" style={{ color: 'rgba(224,224,224,0.2)' }}>{min} yr</span>
          <span className="font-mono text-[10px]" style={{ color: 'rgba(224,224,224,0.2)' }}>{max} yr</span>
        </div>
      </div>

      {/* Gain indicator */}
      {gain > 0 && (
        <div className="flex items-center gap-2 mt-4">
          <span className="font-display font-bold text-2xl" style={{ color: '#ff3c00' }}>+{gain.toFixed(1)}</span>
          <span style={{ color: 'rgba(224,224,224,0.4)' }}>years gained</span>
        </div>
      )}
    </div>
  );
}

export function Simulator() {
  const { zipCode } = useParams<{ zipCode?: string }>();
  const navigate = useNavigate();
  const { zipData, loading } = useZipData();
  const model = useImpactModel();
  const [selectedGeoid, setSelectedGeoid] = useState(zipCode || '32209');
  const [intervention, setIntervention] = useState<Intervention>({ ...DEFAULT_INTERVENTION });
  const [nlPrompt, setNlPrompt] = useState('');
  const [nlParsing, setNlParsing] = useState(false);
  const [nlResult, setNlResult] = useState<{ summary: string; confidence: number; reasoning: string } | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simError, setSimError] = useState('');

  const handleNlSubmit = useCallback(async () => {
    if (!nlPrompt.trim() || nlParsing) return;
    setNlParsing(true);
    setNlResult(null);
    try {
      const result = await parseNaturalLanguageIntervention(nlPrompt, selectedGeoid);
      setIntervention(result.intervention);
      setNlResult({ summary: result.summary, confidence: result.confidence, reasoning: result.reasoning });
    } catch (e) {
      console.error('NL parse error:', e);
    }
    setNlParsing(false);
  }, [nlPrompt, selectedGeoid, nlParsing]);

  const runMiroFishSimulation = useCallback(async () => {
    if (simulating) return;
    setSimulating(true);
    setSimError('');
    try {
      const resp = await fetch('http://localhost:5001/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zip_code: selectedGeoid,
          intervention,
          nl_prompt: nlPrompt,
          agent_count: 20,
        }),
      });
      if (!resp.ok) throw new Error('Simulation failed');
      const result = await resp.json();
      // Store in localStorage (persists across navigation)
      localStorage.setItem('jaxbridge_custom_sim', JSON.stringify(result));
      // Navigate via React Router (no full reload)
      navigate('/agents?custom=true');
    } catch (e) {
      setSimError('Could not reach simulation server. Using pre-computed scenarios.');
      setTimeout(() => navigate('/agents'), 1500);
    }
    setSimulating(false);
  }, [simulating, selectedGeoid, intervention, nlPrompt]);

  const selectedZip = useMemo(() =>
    zipData.find(z => z.geoid === selectedGeoid),
    [zipData, selectedGeoid]
  );

  const result = useMemo(() => {
    if (!selectedZip || !model) return null;
    return simulateIntervention(selectedZip, intervention, model);
  }, [selectedZip, intervention, model]);

  const updateSlider = (key: keyof Intervention, value: number) => {
    setIntervention(prev => ({ ...prev, [key]: value }));
  };

  const resetSliders = () => {
    setIntervention({ ...DEFAULT_INTERVENTION });
  };

  if (loading || !model) {
    return (
      <div className="pt-20 flex items-center justify-center min-h-screen" style={{ background: '#0a0a0a' }}>
        <div style={{ color: 'rgba(224,224,224,0.4)' }}>Loading simulator...</div>
      </div>
    );
  }

  const clusterColor = selectedZip ? (CLUSTER_COLORS[selectedZip.cluster_label] || '#64748b') : '#64748b';

  return (
    <div className="pt-14 min-h-screen" style={{ background: '#0a0a0a' }}>
      {/* ZIP Selector */}
      <div className="px-6 py-3" style={{ background: '#0f0f0f', borderBottom: '1px solid rgba(224,224,224,0.06)' }}>
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <label className="font-mono text-[10px] tracking-[0.15em]" style={{ color: 'rgba(224,224,224,0.4)' }}>Select ZIP Code:</label>
          <select
            value={selectedGeoid}
            onChange={e => { setSelectedGeoid(e.target.value); resetSliders(); }}
            className="font-mono text-sm rounded-lg px-3 py-1.5"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(224,224,224,0.1)', color: '#e0e0e0' }}
          >
            {zipData
              .sort((a, b) => b.rdcs_normalized - a.rdcs_normalized)
              .map(z => (
                <option key={z.geoid} value={z.geoid}>
                  {z.geoid} — {z.label} (RDCS: {z.rdcs_normalized.toFixed(2)})
                </option>
              ))}
          </select>
          {selectedZip && (
            <span
              className="text-xs px-2 py-1 rounded-full font-medium"
              style={{ backgroundColor: `${clusterColor}20`, color: clusterColor, border: `1px solid ${clusterColor}40` }}
            >
              {selectedZip.cluster_label}
            </span>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left - NL Input + Sliders */}
          <div className="col-span-3 space-y-4">
            {/* Natural Language Input */}
            <div className="rounded-xl p-4 glass-accent">
              <div className="font-mono text-[9px] tracking-[0.15em] mb-2" style={{ color: '#ff3c00' }}>
                AI INTERVENTION DESIGNER
              </div>
              <p className="text-[11px] mb-3" style={{ color: 'rgba(224,224,224,0.4)' }}>
                Describe your intervention in plain English — AI will structure it into resource allocations.
              </p>
              <textarea
                value={nlPrompt}
                onChange={e => setNlPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleNlSubmit(); } }}
                placeholder="e.g. Build a community health center with 8 doctors, a food bank, and 50 acres of parkland..."
                rows={3}
                className="w-full rounded-lg px-3 py-2 text-xs resize-none font-body"
                style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,60,0,0.2)', color: '#e0e0e0' }}
              />
              <button
                onClick={handleNlSubmit}
                disabled={nlParsing || !nlPrompt.trim()}
                className="mt-2 w-full py-2 rounded-lg font-mono text-[10px] tracking-[0.1em] font-bold transition-all"
                style={{
                  background: nlParsing ? 'rgba(255,60,0,0.1)' : '#ff3c00',
                  color: nlParsing ? '#ff3c00' : 'white',
                  opacity: !nlPrompt.trim() ? 0.4 : 1,
                }}
              >
                {nlParsing ? 'PARSING...' : 'DESIGN WITH AI'}
              </button>
              {nlResult && (
                <div className="mt-2 p-2.5 rounded" style={{ background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.2)' }}>
                  <div className="text-[10px] font-bold mb-1" style={{ color: '#0d9488' }}>AI parsed your intervention:</div>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {SLIDERS.filter(s => intervention[s.key] > 0).map(s => (
                      <span key={s.key} className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold"
                        style={{ background: 'rgba(255,60,0,0.15)', color: '#ff3c00' }}>
                        +{intervention[s.key]}{s.unit} {s.label}
                      </span>
                    ))}
                  </div>
                  <div className="text-[9px]" style={{ color: 'rgba(224,224,224,0.25)' }}>
                    Sliders auto-adjusted. Fine-tune below or export to MiroFish.
                  </div>
                </div>
              )}
            </div>

            {/* Manual Sliders */}
            <div className="rounded-xl p-5 sticky top-20 glass">
              <h2 className="font-display text-lg font-bold mb-1" style={{ color: '#e0e0e0' }}>Design Your Intervention</h2>
              <p className="font-mono text-[10px] tracking-[0.1em] mb-4" style={{ color: 'rgba(224,224,224,0.3)' }}>DRAG SLIDERS TO ADD RESOURCES</p>

              <div className="space-y-5">
                {SLIDERS.map(slider => {
                  const value = intervention[slider.key];
                  const unitCost = model.cost_benchmarks[slider.costKey]?.unit_cost || 0;
                  const cost = slider.key === 'insuranceSubsidyPct'
                    ? (value / 100) * (selectedZip?.uninsured_pop || 0) * unitCost
                    : value * unitCost;

                  return (
                    <div key={slider.key}>
                      <div className="flex justify-between items-baseline mb-1">
                        <label className="text-sm text-[rgba(224,224,224,0.7)]">{slider.label}</label>
                        <span className="text-sm font-mono text-[#e0e0e0]">
                          {value}{slider.unit}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={slider.max}
                        step={slider.step}
                        value={value}
                        onChange={e => updateSlider(slider.key, Number(e.target.value))}
                        className="w-full h-2 bg-[rgba(224,224,224,0.08)] rounded-lg appearance-none cursor-pointer accent-[#ff3c00]"
                      />
                      {value > 0 && (
                        <div className="text-xs text-[rgba(224,224,224,0.3)] mt-0.5">
                          {formatCurrency(cost)}/year
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Total Cost */}
              {result && result.totalCost > 0 && (
                <div className="mt-5 pt-4 border-t border-[rgba(224,224,224,0.06)]">
                  <div className="text-xs text-[rgba(224,224,224,0.3)] uppercase">Total Est. Cost</div>
                  <div className="text-2xl font-bold text-[#e0e0e0]">
                    {formatCurrency(result.totalCost)}
                    <span className="text-sm font-normal text-[rgba(224,224,224,0.3)]">/year</span>
                  </div>
                </div>
              )}

              <button
                onClick={resetSliders}
                className="mt-4 w-full py-2 bg-[rgba(224,224,224,0.08)] hover:bg-[rgba(224,224,224,0.12)] text-[rgba(224,224,224,0.7)] text-sm rounded-lg transition-colors"
              >
                Reset All
              </button>
            </div>
          </div>

          {/* Center - Impact Dashboard */}
          <div className="col-span-6 space-y-6">
            {/* Life Expectancy Dial */}
            <div className="rounded-xl p-6 glass">
              <h2 className="text-sm font-semibold text-[rgba(224,224,224,0.4)] uppercase tracking-wider mb-4 text-center">
                Projected Life Expectancy Impact
              </h2>
              {selectedZip && result && (
                <LifeExpectancyDial
                  current={selectedZip.life_expectancy}
                  projected={selectedZip.life_expectancy + result.lifeExpectancyGain}
                />
              )}
            </div>

            {/* Years of Life Saved */}
            {result && result.yearsOfLifeSaved > 0 && (
              <div className="bg-green-950/30 border border-green-900/30 rounded-xl p-6 text-center">
                <div className="text-4xl font-black text-[#ff3c00]">
                  {result.yearsOfLifeSaved.toLocaleString()}
                </div>
                <div className="text-lg text-green-300/80 mt-1">years of life saved</div>
                <div className="text-sm text-[rgba(224,224,224,0.4)] mt-1">
                  across {selectedZip?.population.toLocaleString()} residents
                </div>
                {result.costPerYearSaved > 0 && (
                  <div className="mt-3 pt-3 border-t border-green-900/30 text-sm text-[rgba(224,224,224,0.4)]">
                    Cost per year of life saved: <span className="text-[#e0e0e0] font-semibold">{formatCurrency(result.costPerYearSaved)}</span>
                    <span className="text-xs text-[rgba(224,224,224,0.3)] block mt-1">
                      (WHO cost-effectiveness threshold: ~$50K/DALY)
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Outcome Cards */}
            {result && result.outcomes.length > 1 && (
              <div>
                <h3 className="text-sm font-semibold text-[rgba(224,224,224,0.4)] uppercase tracking-wider mb-3">
                  Projected Outcome Changes
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {result.outcomes
                    .filter(o => o.metric !== 'life_expectancy')
                    .map(outcome => (
                      <div
                        key={outcome.metric}
                        className="bg-[#0f0f0f] rounded-lg border border-[rgba(224,224,224,0.06)] p-4"
                      >
                        <div className="text-xs text-[rgba(224,224,224,0.3)] mb-1">{outcome.label}</div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-bold text-[rgba(224,224,224,0.7)]">
                            {outcome.current}
                          </span>
                          <span className="text-[rgba(224,224,224,0.25)]">→</span>
                          <span className="text-lg font-bold text-[#e0e0e0]">
                            {outcome.projected}
                          </span>
                          <span className="text-xs text-[rgba(224,224,224,0.3)]">{outcome.unit}</span>
                        </div>
                        <div className={`text-sm font-semibold mt-1 ${outcome.change < 0 ? 'text-[#ff3c00]' : outcome.change > 0 ? 'text-red-400' : 'text-[rgba(224,224,224,0.3)]'}`}>
                          {outcome.change > 0 ? '+' : ''}{outcome.change} {outcome.unit}
                        </div>
                        {/* Progress bar */}
                        <div className="mt-2 h-1.5 bg-[rgba(224,224,224,0.08)] rounded-full overflow-hidden flex">
                          <div
                            className="h-full bg-[rgba(224,224,224,0.2)] rounded-full"
                            style={{ width: `${Math.min(100, Math.abs(outcome.current) / Math.max(Math.abs(outcome.current), Math.abs(outcome.projected)) * 100)}%` }}
                          />
                          {outcome.change !== 0 && (
                            <div
                              className={`h-full rounded-full ${outcome.change < 0 ? 'bg-green-500' : 'bg-red-500'}`}
                              style={{ width: `${Math.min(50, Math.abs(outcome.change / outcome.current) * 100)}%` }}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Export to MiroFish Agent Simulation */}
            {result && result.lifeExpectancyGain > 0 && (
              <div className="rounded-xl p-5" style={{ background: 'rgba(255,60,0,0.05)', border: '1px solid rgba(255,60,0,0.2)' }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-mono text-[9px] tracking-[0.15em] mb-1" style={{ color: '#ff3c00' }}>
                      LIVE COMMUNITY SIMULATION
                    </div>
                    <h3 className="font-display text-base font-bold" style={{ color: '#e0e0e0' }}>
                      See How Residents React
                    </h3>
                    <p className="text-xs mt-1" style={{ color: 'rgba(224,224,224,0.4)' }}>
                      {nlPrompt
                        ? `Your intervention "${nlPrompt.slice(0, 80)}${nlPrompt.length > 80 ? '...' : ''}" will be simulated across 1,000+ AI agents in ZIP ${selectedGeoid}.`
                        : `Export your intervention to simulate how 1,000+ AI agents in ZIP ${selectedGeoid} would react.`
                      }
                    </p>
                  </div>
                  <div className="relative flex items-center justify-center w-10 h-10 shrink-0">
                    <span className="absolute w-10 h-10 rounded-full animate-ping" style={{ background: 'rgba(255,60,0,0.15)' }} />
                    <span className="relative w-3 h-3 rounded-full" style={{ background: '#ff3c00' }} />
                  </div>
                </div>

                {/* Intervention summary chips */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {SLIDERS.filter(s => intervention[s.key] > 0).map(s => (
                    <div key={s.key} className="px-2 py-1 rounded text-center" style={{ background: 'rgba(255,60,0,0.08)' }}>
                      <div className="font-mono text-[10px] font-bold" style={{ color: '#ff3c00' }}>+{intervention[s.key]}{s.unit}</div>
                      <div className="text-[8px]" style={{ color: 'rgba(224,224,224,0.3)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {simulating ? (
                  <div className="py-4">
                    {/* Animated simulation progress */}
                    <div className="flex items-center justify-center gap-3 mb-3">
                      <div className="relative w-8 h-8">
                        <div className="absolute inset-0 rounded-full border-2 border-[#ff3c00] border-t-transparent animate-spin" />
                        <div className="absolute inset-1 rounded-full border border-[#fbbf24] border-b-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                      </div>
                      <div>
                        <div className="font-mono text-xs font-bold" style={{ color: '#ff3c00' }}>SIMULATING 1,035 AGENTS</div>
                        <div className="font-mono text-[9px]" style={{ color: 'rgba(224,224,224,0.4)' }}>40 LLM-simulated per scenario, extrapolated to 1,035</div>
                      </div>
                    </div>
                    {/* Fake progress steps */}
                    <div className="space-y-1.5">
                      {['Generating agent personas...', 'Running LLM reactions (32 threads)...', 'Computing spatial spillover...', 'Building knowledge graph...'].map((step, i) => (
                        <div key={i} className="flex items-center gap-2 text-[10px]" style={{ color: 'rgba(224,224,224,0.3)', animationDelay: `${i * 0.5}s` }}>
                          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#ff3c00', animationDelay: `${i * 0.3}s` }} />
                          {step}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={runMiroFishSimulation}
                    className="block w-full text-center py-2.5 rounded-lg font-mono text-xs tracking-[0.1em] font-bold transition-all hover:brightness-110"
                    style={{ background: '#ff3c00', color: 'white' }}
                  >
                    RUN LIVE AGENT SIMULATION →
                  </button>
                )}
                {simError && (
                  <div className="text-center mt-1.5 text-[10px]" style={{ color: '#fbbf24' }}>{simError}</div>
                )}
                <div className="text-center mt-2">
                  <span className="font-mono text-[8px]" style={{ color: 'rgba(224,224,224,0.2)' }}>
                    Each agent has a unique persona, health profile, and community context
                  </span>
                </div>
              </div>
            )}

            {/* Methodology */}
            <div className="rounded-lg p-4" style={{ background: 'rgba(255,255,255,0.02)', borderLeft: '3px solid rgba(255,60,0,0.2)', border: '1px solid rgba(224,224,224,0.04)', borderLeftWidth: 3, borderLeftColor: 'rgba(255,60,0,0.2)' }}>
              <p className="text-xs" style={{ color: 'rgba(224,224,224,0.3)' }}>
                <strong style={{ color: 'rgba(224,224,224,0.4)' }}>Methodology:</strong> Projections powered by SCAN (Spatial Causal Attention Network) trained on 218 Duval County census tracts with 20 health/socioeconomic features (5-fold CV R²=0.99, MAE=0.09 yr). SCAN attention weights rank feature importance: poverty rate (1.18), median income (1.05), SVI (0.50), disability (0.50), uninsured rate (0.49). Non-linear diminishing returns applied via log-transformed gain curves. These are model-based directional estimates informed by CDC PLACES 2023, Census ACS 2020-2024, FEMA SVI, and USDA Food Access data.
              </p>
            </div>
          </div>

          {/* Right - ZIP Context */}
          <div className="col-span-3">
            {selectedZip && (
              <div className="rounded-xl p-5 sticky top-20 glass">
                <h2 className="text-lg font-bold text-[#e0e0e0] mb-1">{selectedZip.label}</h2>
                <div className="text-sm text-[rgba(224,224,224,0.4)] mb-4">Current Status</div>

                <div className="space-y-3">
                  <ContextStat label="Life Expectancy" value={`${selectedZip.life_expectancy.toFixed(1)} yr`} />
                  <ContextStat label="Population" value={selectedZip.population.toLocaleString()} />
                  <ContextStat label="Median Income" value={`$${(selectedZip.median_income / 1000).toFixed(0)}K`} />
                  <ContextStat label="RDCS Score" value={selectedZip.rdcs_normalized.toFixed(2)} />
                  <ContextStat label="Obesity" value={`${selectedZip.obesity}%`} />
                  <ContextStat label="Physical Inactivity" value={`${selectedZip.physical_inactivity}%`} />
                  <ContextStat label="Uninsured" value={`${selectedZip.uninsured_rate}%`} />
                  <ContextStat label="Physician Ratio" value={selectedZip.physician_ratio ? `1:${Math.round(selectedZip.physician_ratio)}` : 'N/A'} />
                  <ContextStat label="MH Providers" value={String(selectedZip.mental_health_providers || 0)} />
                  <ContextStat label="Parks" value={`${selectedZip.num_parks || 0} (${selectedZip.park_acres?.toFixed(0) || 0} acres)`} />
                  <ContextStat label="Food Desert Rate" value={`${selectedZip.food_desert_rate?.toFixed(0) || 0}%`} />
                  <ContextStat label="SVI Score" value={selectedZip.svi_score?.toFixed(2) || 'N/A'} />
                </div>

                {/* Key Deficits */}
                <div className="mt-5 pt-4 border-t border-[rgba(224,224,224,0.06)]">
                  <h3 className="text-xs font-semibold text-[rgba(224,224,224,0.3)] uppercase tracking-wider mb-2">Key Deficits</h3>
                  <div className="space-y-1.5">
                    {selectedZip.rdcs_normalized > 0.5 && (
                      <Deficit text="Critical resource desert" />
                    )}
                    {selectedZip.obesity > 40 && (
                      <Deficit text={`Obesity ${selectedZip.obesity}% (county avg: 34.3%)`} />
                    )}
                    {selectedZip.physical_inactivity > 35 && (
                      <Deficit text={`Inactivity ${selectedZip.physical_inactivity}% (county avg: 27.1%)`} />
                    )}
                    {selectedZip.uninsured_rate > 15 && (
                      <Deficit text={`Uninsured ${selectedZip.uninsured_rate}% (county avg: 13.6%)`} />
                    )}
                    {selectedZip.food_desert_rate > 50 && (
                      <Deficit text="Severe food desert" />
                    )}
                    {(selectedZip.physician_ratio || 0) > 2000 && (
                      <Deficit text="Very limited physician access" />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ContextStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-[rgba(224,224,224,0.3)]">{label}</span>
      <span className="text-sm font-medium text-[#e0e0e0]">{value}</span>
    </div>
  );
}

function Deficit({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-red-400 text-xs mt-0.5">●</span>
      <span className="text-xs text-red-300/80">{text}</span>
    </div>
  );
}
