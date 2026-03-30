import { useRef } from 'react';
import HalideTopoHero from '../components/ui/halide-topo-hero';
import { Link } from 'react-router-dom';
import { Activity, BarChart3, TrendingUp, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRevealChildren } from '@/lib/useReveal';

export function Landing() {
  const mainRef = useRef<HTMLDivElement>(null);
  useRevealChildren(mainRef);

  return (
    <div ref={mainRef} className="snap-container" style={{ background: 'var(--bg)' }}>
      {/* Grain overlay */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <filter id="grain-global">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </svg>
      <div className="grain-overlay" style={{ filter: 'url(#grain-global)' }} />

      {/* Hero */}
      <HalideTopoHero />

      {/* The Gap Section */}
      <section className="snap-section section-pad section-inner">
        <div data-reveal className="reveal font-mono text-[10px] tracking-[0.3em] mb-4" style={{ color: 'var(--accent-red)' }}>
          [ 001 — THE DIVIDE ]
        </div>
        <h2 data-reveal className="reveal reveal-delay-1 font-display text-4xl md:text-6xl font-bold mb-6" style={{ color: 'var(--silver)', lineHeight: 0.9 }}>
          TWO ZIP CODES.<br />ONE CITY.
        </h2>
        <p data-reveal className="reveal reveal-delay-2 font-body text-lg mb-12" style={{ color: 'rgba(224,224,224,0.5)', maxWidth: '600px' }}>
          Separated by 20 miles. Divided by 14 years of life expectancy. Your neighborhood determines your lifespan.
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          {/* 32209 */}
          <Card data-reveal className="reveal overflow-hidden glass-accent" style={{ borderLeft: '3px solid var(--accent-red)' }}>
            <CardHeader className="pb-3">
              <div className="font-mono text-[10px] tracking-[0.2em]" style={{ color: 'var(--accent-red)' }}>
                CRITICAL DESERT
              </div>
              <CardTitle className="font-display text-2xl" style={{ color: 'var(--silver)' }}>
                32209
              </CardTitle>
              <div className="font-body text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Northwest Jacksonville — Urban Core
              </div>
            </CardHeader>
            <CardContent>
              <div className="font-display text-5xl font-bold mb-4" style={{ color: 'var(--accent-red)' }}>
                68.7
                <span className="text-lg ml-2" style={{ color: 'var(--muted-foreground)' }}>yr</span>
              </div>
              <div className="space-y-3 font-mono text-xs">
                <StatLine label="MEDIAN INCOME" value="$30,514" accent />
                <StatLine label="OBESITY" value="48.0%" accent />
                <StatLine label="SVI SCORE" value="0.94 / 1.0" accent />
                <StatLine label="UNINSURED" value="19.5%" accent />
                <StatLine label="PHYSICAL INACTIVITY" value="44.0%" accent />
                <StatLine label="POPULATION" value="34,657" />
              </div>
            </CardContent>
          </Card>

          {/* 32266 */}
          <Card data-reveal className="reveal reveal-delay-2 overflow-hidden glass-teal" style={{ borderLeft: '3px solid var(--teal)' }}>
            <CardHeader className="pb-3">
              <div className="font-mono text-[10px] tracking-[0.2em]" style={{ color: 'var(--teal)' }}>
                RESOURCED CORRIDOR
              </div>
              <CardTitle className="font-display text-2xl" style={{ color: 'var(--silver)' }}>
                32266
              </CardTitle>
              <div className="font-body text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Neptune Beach
              </div>
            </CardHeader>
            <CardContent>
              <div className="font-display text-5xl font-bold mb-4" style={{ color: 'var(--teal)' }}>
                83.0
                <span className="text-lg ml-2" style={{ color: 'var(--muted-foreground)' }}>yr</span>
              </div>
              <div className="space-y-3 font-mono text-xs">
                <StatLine label="MEDIAN INCOME" value="$119,294" />
                <StatLine label="OBESITY" value="27.6%" />
                <StatLine label="SVI SCORE" value="0.02 / 1.0" />
                <StatLine label="UNINSURED" value="7.1%" />
                <StatLine label="PHYSICAL INACTIVITY" value="16.9%" />
                <StatLine label="POPULATION" value="7,168" />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Resource Desert Explanation */}
      <section className="snap-section section-pad" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div data-reveal className="reveal font-mono text-[10px] tracking-[0.3em] mb-4" style={{ color: 'var(--accent-red)' }}>
            [ 002 — METHODOLOGY ]
          </div>
          <h2 data-reveal className="reveal reveal-delay-1 font-display text-3xl md:text-5xl font-bold mb-4" style={{ color: 'var(--silver)', lineHeight: 0.9 }}>
            RESOURCE DESERTS<br />SHORTEN LIVES.
          </h2>
          <p data-reveal className="reveal reveal-delay-2 font-body text-base mb-12" style={{ color: 'rgba(224,224,224,0.5)', maxWidth: '500px' }}>
            These neighborhoods don't lack willpower — they lack grocery stores, doctors, and parks. Our Resource Desert Score quantifies exactly what's missing.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricIcon icon={<Activity className="w-5 h-5" />} label="HEALTHCARE" value="3,482:1" desc="People per physician (ZIP 32254)" />
            <MetricIcon icon={<BarChart3 className="w-5 h-5" />} label="FOOD ACCESS" value="596K" desc="Residents with low food access" />
            <MetricIcon icon={<TrendingUp className="w-5 h-5" />} label="GREEN SPACE" value="2.0%" desc="Park area in ZIP 32209" />
            <MetricIcon icon={<Shield className="w-5 h-5" />} label="VULNERABILITY" value="0.95" desc="Highest SVI score (ZIP 32206)" />
          </div>

          {/* RDCS Formula */}
          <div className="mt-12 p-6" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }}>
            <div className="font-mono text-center">
              <span style={{ color: 'var(--muted-foreground)', fontSize: '11px' }}>RESOURCE DESERT COMPOSITE SCORE</span>
              <div className="text-lg mt-2" style={{ color: 'var(--silver)' }}>
                RDCS = (<span style={{ color: 'var(--accent-red)' }}>Demand</span> − <span style={{ color: 'var(--teal)' }}>Supply</span>) / max_gap
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MiroFish Teaser */}
      <section className="snap-section section-pad">
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div data-reveal className="reveal font-mono text-[10px] tracking-[0.3em] mb-4" style={{ color: 'var(--accent-red)' }}>
            [ 003 — COUNTERFACTUAL SIMULATION ]
          </div>
          <h2 data-reveal className="reveal reveal-delay-1 font-display text-3xl md:text-5xl font-bold mb-4" style={{ color: 'var(--silver)', lineHeight: 0.9 }}>
            1,035 SIMULATED RESIDENTS<br />TELL US WHAT WORKS.
          </h2>
          <p className="font-body text-base mb-8" style={{ color: 'rgba(224,224,224,0.5)', maxWidth: '600px' }}>
            Powered by MiroFish swarm intelligence. We simulate Jacksonville residents as AI agents with distinct
            personas, demographics, and health profiles — then observe how they react when resources are placed
            in their neighborhoods.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <Card data-reveal className="reveal glass">
              <CardContent className="pt-6">
                <div className="font-display text-3xl font-bold" style={{ color: 'var(--accent-red)' }}>1,035</div>
                <div className="font-mono text-[10px] tracking-[0.15em] mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  SIMULATED AGENTS
                </div>
                <div className="font-body text-xs mt-2" style={{ color: 'rgba(224,224,224,0.4)' }}>
                  Across 9 Jacksonville ZIP codes
                </div>
              </CardContent>
            </Card>
            <Card data-reveal className="reveal reveal-delay-1 glass">
              <CardContent className="pt-6">
                <div className="font-display text-3xl font-bold" style={{ color: 'var(--accent-red)' }}>3</div>
                <div className="font-mono text-[10px] tracking-[0.15em] mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  INTERVENTION SCENARIOS
                </div>
                <div className="font-body text-xs mt-2" style={{ color: 'rgba(224,224,224,0.4)' }}>
                  Health center, grocery co-op, urban park
                </div>
              </CardContent>
            </Card>
            <Card data-reveal className="reveal reveal-delay-2 glass">
              <CardContent className="pt-6">
                <div className="font-display text-3xl font-bold" style={{ color: 'var(--teal)' }}>76%</div>
                <div className="font-mono text-[10px] tracking-[0.15em] mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  AVG ADOPTION RATE
                </div>
                <div className="font-body text-xs mt-2" style={{ color: 'rgba(224,224,224,0.4)' }}>
                  Projected resource utilization
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      {/* THE BOTTOM LINE */}
      <section className="snap-section section-pad-sm">
        <div className="max-w-4xl mx-auto">
          <div data-reveal className="reveal font-mono text-[10px] tracking-[0.3em] mb-4" style={{ color: '#ff3c00' }}>
            [ THE BOTTOM LINE ]
          </div>
          <p data-reveal className="reveal reveal-delay-1 font-display text-2xl md:text-3xl font-bold leading-tight mb-4" style={{ color: '#e0e0e0' }}>
            A targeted <span style={{ color: '#ff3c00' }}>$8.5M annual investment</span> in three neighborhoods could serve <span style={{ color: '#0d9488' }}>133,085 residents</span> and add up to <span style={{ color: '#22c55e' }}>4.6 years of life expectancy</span> in Jacksonville's most underserved ZIP codes.
          </p>
          <p className="text-sm" style={{ color: 'rgba(224,224,224,0.35)', maxWidth: 640 }}>
            Sources: CDC PLACES 2023, U.S. Census ACS, FEMA SVI, USDA Food Access. Projections from SCAN neural network (R²=0.99, 218 census tracts) validated by 1,035 simulated resident agents. Full methodology on Insights and Scorecard pages.
          </p>
        </div>
      </section>

      <section className="snap-section section-pad" style={{ textAlign: 'center' }}>
        <h2 className="font-display text-3xl md:text-4xl font-bold mb-8" style={{ color: 'var(--silver)' }}>
          EXPLORE THE DATA
        </h2>
        <div className="flex gap-4 justify-center">
          <Link to="/atlas" className="btn-tech">EXPLORE ATLAS</Link>
          <Link to="/simulator/32209" className="btn-tech btn-tech-primary">RUN SCENARIO</Link>
          <Link to="/agents" className="btn-tech btn-tech-teal">VIEW AGENTS</Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '2rem', borderTop: '1px solid var(--border)' }}>
        <div className="font-mono text-[10px] text-center tracking-[0.1em]" style={{ color: 'rgba(224,224,224,0.3)' }}>
          JAXBRIDGE — AI4GOOD DATATHON 2026 — DATA: U.S. CENSUS, CDC PLACES, FEMA, EPA, USDA, MYSIDEWALK
        </div>
      </footer>
    </div>
  );
}

function StatLine({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
      <span style={{ color: 'var(--muted-foreground)' }}>{label}</span>
      <span style={{ color: accent ? 'var(--accent-red)' : 'var(--silver)', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function MetricIcon({ icon, label, value, desc }: { icon: React.ReactNode; label: string; value: string; desc: string }) {
  return (
    <Card className="glass transition-all duration-300 hover:border-[rgba(255,60,0,0.15)]">
      <CardContent className="pt-6">
        <div style={{ color: 'var(--accent-red)' }} className="mb-3">{icon}</div>
        <div className="font-mono text-[10px] tracking-[0.15em] mb-1" style={{ color: 'var(--muted-foreground)' }}>{label}</div>
        <div className="font-display text-xl font-bold" style={{ color: 'var(--silver)' }}>{value}</div>
        <div className="font-body text-xs mt-1" style={{ color: 'rgba(224,224,224,0.4)' }}>{desc}</div>
      </CardContent>
    </Card>
  );
}
