import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Users, TrendingUp, MessageSquare, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts';

interface ScenarioResult {
  scenario: {
    id: string;
    title: string;
    description: string;
    zip: string;
    type: string;
  };
  agents: Array<{
    agent_id: string;
    role: string;
    age: number;
    income: number;
    health_conditions: string[];
    transportation: string;
    has_insurance: boolean;
  }>;
  num_agents: number;
  num_rounds: number;
  round_summaries: Array<{
    round: number;
    adoption_rate: number;
    avg_sentiment: number;
    avg_weekly_visits: number;
    top_barriers: [string, number][];
    top_motivators: [string, number][];
  }>;
  aggregate: {
    final_adoption_rate: number;
    avg_sentiment: number;
    sentiment_trend: number[];
    adoption_trend: number[];
    top_barriers: [string, number][];
    top_motivators: [string, number][];
    projected_weekly_visits: number;
  };
  featured_quotes: Array<{
    agent_id: string;
    role: string;
    age: number;
    quote: string;
    sentiment: number;
    would_use: boolean;
  }>;
}

interface SimulationData {
  engine: string;
  model: string;
  timestamp: string;
  methodology: {
    description: string;
    inspiration: string;
    agent_generation: string;
    limitations: string[];
  };
  scenarios: ScenarioResult[];
}

export function Simulation() {
  const [data, setData] = useState<SimulationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedScenario, setSelectedScenario] = useState(0);

  useEffect(() => {
    fetch('/data/simulation_results.json')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="pt-16 min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <div className="animate-pulse-glow inline-block w-3 h-3 rounded-full mb-4" style={{ background: 'var(--accent-red)' }} />
          <div className="font-mono text-xs tracking-[0.2em]" style={{ color: 'var(--muted-foreground)' }}>
            LOADING SIMULATION DATA...
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.scenarios?.length) {
    return (
      <div className="pt-16 min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Activity className="w-8 h-8 mx-auto mb-4" style={{ color: 'var(--accent-red)' }} />
            <div className="font-display text-lg font-bold mb-2" style={{ color: 'var(--silver)' }}>
              SIMULATION PENDING
            </div>
            <div className="font-body text-sm" style={{ color: 'var(--muted-foreground)' }}>
              MiroFish agent simulation is still running. Results will appear here when complete.
              Run <code className="font-mono text-xs px-1 py-0.5 rounded" style={{ background: 'var(--secondary)' }}>python3 pipeline/mirofish_simulation.py</code> to generate data.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const scenario = data.scenarios[selectedScenario];
  const agg = scenario.aggregate;

  const barrierData = agg.top_barriers.slice(0, 5).map(([name, count]) => ({ name, count }));
  const motivatorData = agg.top_motivators.slice(0, 5).map(([name, count]) => ({ name, count }));

  return (
    <div className="pt-14 min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="px-6 py-8" style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div className="font-mono text-[10px] tracking-[0.3em] mb-3" style={{ color: 'var(--accent-red)' }}>
          [ MIROFISH SWARM INTELLIGENCE ENGINE ]
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-2" style={{ color: 'var(--silver)' }}>
          AGENT SIMULATION
        </h1>
        <p className="font-body text-sm" style={{ color: 'var(--muted-foreground)', maxWidth: '600px' }}>
          {data.methodology.description}
        </p>
        <div className="font-mono text-[10px] mt-2" style={{ color: 'rgba(224,224,224,0.3)' }}>
          ENGINE: {data.engine} | MODEL: {data.model} | TIMESTAMP: {data.timestamp}
        </div>
      </div>

      {/* Scenario Tabs */}
      <div className="px-6 pb-4" style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div className="flex gap-2">
          {data.scenarios.map((s, i) => (
            <button
              key={s.scenario.id}
              onClick={() => setSelectedScenario(i)}
              className="font-mono text-[10px] tracking-[0.1em] px-4 py-2 rounded transition-all"
              style={{
                background: selectedScenario === i ? 'var(--accent-red)' : 'var(--card)',
                color: selectedScenario === i ? 'white' : 'var(--muted-foreground)',
                border: `1px solid ${selectedScenario === i ? 'var(--accent-red)' : 'var(--border)'}`,
              }}
            >
              {s.scenario.type.toUpperCase().replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 pb-12" style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Scenario Description */}
        <Card className="mb-6" style={{ borderLeft: '3px solid var(--accent-red)' }}>
          <CardHeader>
            <CardTitle className="font-display text-lg" style={{ color: 'var(--silver)' }}>
              {scenario.scenario.title}
            </CardTitle>
            <CardDescription className="font-body text-sm">
              {scenario.scenario.description}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Aggregate Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <MetricCard
            icon={<Users className="w-4 h-4" />}
            label="AGENTS SIMULATED"
            value={String(scenario.num_agents)}
            desc={`${scenario.num_rounds} rounds of interaction`}
          />
          <MetricCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="ADOPTION RATE"
            value={`${(agg.final_adoption_rate * 100).toFixed(0)}%`}
            desc="Would use the new resource"
            accent
          />
          <MetricCard
            icon={<Activity className="w-4 h-4" />}
            label="AVG SENTIMENT"
            value={agg.avg_sentiment.toFixed(2)}
            desc="-1.0 (negative) to +1.0 (positive)"
          />
          <MetricCard
            icon={<BarChart3 className="w-4 h-4" />}
            label="WEEKLY VISITS"
            value={String(agg.projected_weekly_visits)}
            desc="Projected visits per week"
          />
        </div>

        {/* Barriers vs Motivators */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-mono text-xs tracking-[0.15em]" style={{ color: 'var(--accent-red)' }}>
                TOP BARRIERS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barrierData} layout="vertical" margin={{ left: 80, right: 10 }}>
                    <XAxis type="number" stroke="var(--muted-foreground)" tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }} />
                    <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }} width={75} />
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px' }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {barrierData.map((_, i) => (
                        <Cell key={i} fill="var(--accent-red)" fillOpacity={0.7 - i * 0.1} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-mono text-xs tracking-[0.15em]" style={{ color: 'var(--teal)' }}>
                TOP MOTIVATORS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={motivatorData} layout="vertical" margin={{ left: 80, right: 10 }}>
                    <XAxis type="number" stroke="var(--muted-foreground)" tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }} />
                    <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }} width={75} />
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px' }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {motivatorData.map((_, i) => (
                        <Cell key={i} fill="var(--teal)" fillOpacity={0.7 - i * 0.1} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Agent Quotes — The most compelling part */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" style={{ color: 'var(--accent-red)' }} />
              <CardTitle className="font-mono text-xs tracking-[0.15em]" style={{ color: 'var(--silver)' }}>
                AGENT VOICES
              </CardTitle>
            </div>
            <CardDescription>
              Direct quotes from simulated residents reacting to the intervention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {scenario.featured_quotes.map((q, i) => (
                <div
                  key={i}
                  className="p-4 rounded-lg"
                  style={{
                    background: 'var(--secondary)',
                    borderLeft: `3px solid ${q.would_use ? 'var(--teal)' : 'var(--accent-red)'}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={q.would_use ? "default" : "destructive"} className="font-mono text-[9px]">
                      {q.would_use ? 'WOULD USE' : 'UNLIKELY'}
                    </Badge>
                    <span className="font-mono text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                      {q.role} — AGE {q.age} — SENTIMENT: {q.sentiment.toFixed(1)}
                    </span>
                  </div>
                  <p className="font-body text-sm italic" style={{ color: 'var(--silver)', lineHeight: 1.6 }}>
                    "{q.quote}"
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <p className="font-mono text-[9px]" style={{ color: 'rgba(224,224,224,0.3)' }}>
              Agent responses generated by {data.model} LLM. Personas derived from Census/CDC ZIP-level demographics.
            </p>
          </CardFooter>
        </Card>

        {/* Methodology */}
        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-xs tracking-[0.15em]" style={{ color: 'var(--silver)' }}>
              METHODOLOGY & LIMITATIONS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 font-body text-xs" style={{ color: 'var(--muted-foreground)' }}>
              <p><strong style={{ color: 'var(--silver)' }}>Inspiration:</strong> {data.methodology.inspiration}</p>
              <p><strong style={{ color: 'var(--silver)' }}>Agent Generation:</strong> {data.methodology.agent_generation}</p>
              <div>
                <strong style={{ color: 'var(--silver)' }}>Limitations:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  {data.methodology.limitations.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, desc, accent }: { icon: React.ReactNode; label: string; value: string; desc: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-2">
          <div style={{ color: 'var(--muted-foreground)' }}>{icon}</div>
          <span className="font-mono text-[9px] tracking-[0.15em]" style={{ color: 'var(--muted-foreground)' }}>
            {label}
          </span>
        </div>
        <div className="font-display text-2xl font-bold" style={{ color: accent ? 'var(--accent-red)' : 'var(--silver)' }}>
          {value}
        </div>
        <div className="font-body text-xs mt-1" style={{ color: 'rgba(224,224,224,0.4)' }}>{desc}</div>
      </CardContent>
    </Card>
  );
}
