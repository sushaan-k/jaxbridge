import { Link } from 'react-router-dom';
import type { ZipData } from '../data/useZipData';

interface Props {
  zip: ZipData;
  narrative: string;
  onClose: () => void;
}

const CLUSTER_COLORS: Record<string, string> = {
  'Critical Desert': '#dc2626',
  'Struggling Suburban': '#ea580c',
  'Stable Middle': '#d97706',
  'Resourced Corridor': '#16a34a',
};

interface MetricBarProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  invert?: boolean; // if true, lower is better
}

function MetricBar({ label, value, min, max, unit = '', invert = false }: MetricBarProps) {
  const norm = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const displayNorm = invert ? 1 - norm : norm;
  const color = displayNorm > 0.66 ? '#16a34a' : displayNorm > 0.33 ? '#d97706' : '#dc2626';

  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[rgba(224,224,224,0.4)]">{label}</span>
        <span className="text-[rgba(224,224,224,0.7)] font-medium">{typeof value === 'number' ? (value >= 1000 ? `$${(value / 1000).toFixed(0)}K` : value.toFixed(1)) : value}{unit}</span>
      </div>
      <div className="h-2 bg-[rgba(224,224,224,0.08)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${norm * 100}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function ZipDetailPanel({ zip, narrative, onClose }: Props) {
  const clusterColor = CLUSTER_COLORS[zip.cluster_label] || '#64748b';

  return (
    <div className="w-96 h-full overflow-y-auto" style={{ background: '#0f0f0f', borderLeft: '1px solid rgba(224,224,224,0.06)' }}>
      {/* Header */}
      <div className="sticky top-0 backdrop-blur-sm p-4 flex items-start justify-between" style={{ background: 'rgba(15,15,15,0.95)', borderBottom: '1px solid rgba(224,224,224,0.06)' }}>
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#e0e0e0' }}>{zip.label}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-mono" style={{ color: 'rgba(224,224,224,0.4)' }}>{zip.geoid}</span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: `${clusterColor}20`, color: clusterColor, border: `1px solid ${clusterColor}40` }}
            >
              {zip.cluster_label}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1" style={{ color: 'rgba(224,224,224,0.4)' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* Narrative */}
        <div>
          <h3 className="text-xs font-semibold text-[rgba(224,224,224,0.3)] uppercase tracking-wider mb-2">Neighborhood Profile</h3>
          <p className="text-sm text-[rgba(224,224,224,0.7)] leading-relaxed">{narrative}</p>
        </div>

        {/* Key Metrics */}
        <div>
          <h3 className="text-xs font-semibold text-[rgba(224,224,224,0.3)] uppercase tracking-wider mb-3">Key Metrics</h3>
          <MetricBar label="Life Expectancy" value={zip.life_expectancy} min={68} max={83} unit=" yr" />
          <MetricBar label="Median Income" value={zip.median_income} min={30000} max={120000} />
          <MetricBar label="Obesity Rate" value={zip.obesity} min={25} max={50} unit="%" invert />
          <MetricBar label="SVI Score" value={zip.svi_score} min={0} max={1} invert />
          <MetricBar label="Food Desert Rate" value={zip.food_desert_rate} min={0} max={80} unit="%" invert />
          <MetricBar label="RDCS Score" value={zip.rdcs_normalized} min={0} max={1} invert />
        </div>

        {/* Quick Stats Grid */}
        <div>
          <h3 className="text-xs font-semibold text-[rgba(224,224,224,0.3)] uppercase tracking-wider mb-3">Details</h3>
          <div className="grid grid-cols-2 gap-3">
            <QuickStat label="Population" value={zip.population.toLocaleString()} />
            <QuickStat label="Physician Ratio" value={zip.physician_ratio ? `1:${Math.round(zip.physician_ratio)}` : 'N/A'} />
            <QuickStat label="MH Providers" value={String(zip.mental_health_providers || 0)} />
            <QuickStat label="Parks" value={String(zip.num_parks || 0)} />
            <QuickStat label="Uninsured" value={`${zip.uninsured_rate}%`} />
            <QuickStat label="Smoking" value={`${zip.smoking}%`} />
            <QuickStat label="Depression" value={`${zip.depression}%`} />
            <QuickStat label="Inactivity" value={`${zip.physical_inactivity}%`} />
          </div>
        </div>

        {/* Action Button */}
        <Link
          to={`/simulator/${zip.geoid}`}
          className="block w-full text-center py-3 font-semibold rounded-lg no-underline transition-colors"
          style={{ background: '#ff3c00', color: 'white' }}
        >
          Run Simulation for {zip.geoid}
        </Link>
      </div>
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
      <div className="text-xs font-mono" style={{ color: 'rgba(224,224,224,0.3)' }}>{label}</div>
      <div className="text-sm font-semibold" style={{ color: '#e0e0e0' }}>{value}</div>
    </div>
  );
}
