import { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import type { Layer } from 'leaflet';
import { useZipData, useNarratives } from '../data/useZipData';
import type { ZipData } from '../data/useZipData';
import { ZipDetailPanel } from '../components/ZipDetailPanel';

type MapLayer = 'rdcs' | 'life_expectancy' | 'obesity' | 'food_desert' | 'svi' | 'physician' | 'income';

const LAYERS: { id: MapLayer; label: string; description: string }[] = [
  { id: 'rdcs', label: 'Resource Desert Score', description: 'Supply-demand gap composite' },
  { id: 'life_expectancy', label: 'Life Expectancy', description: 'Years at birth (2010-2015)' },
  { id: 'obesity', label: 'Obesity Rate', description: '% of adults (2023)' },
  { id: 'food_desert', label: 'Food Desert Rate', description: '% low access (half mile)' },
  { id: 'svi', label: 'Social Vulnerability', description: 'CDC/ATSDR SVI (0-1)' },
  { id: 'physician', label: 'Physician Ratio', description: 'People per doctor' },
  { id: 'income', label: 'Median Income', description: 'Household (2020-2024)' },
];

function getLayerValue(zip: ZipData, layer: MapLayer): number {
  switch (layer) {
    case 'rdcs': return zip.rdcs_normalized;
    case 'life_expectancy': return zip.life_expectancy;
    case 'obesity': return zip.obesity;
    case 'food_desert': return zip.food_desert_rate;
    case 'svi': return zip.svi_score;
    case 'physician': return zip.physician_ratio || 0;
    case 'income': return zip.median_income;
    default: return 0;
  }
}

function getLayerColor(value: number, layer: MapLayer): string {
  let norm: number;
  let invert = false;

  switch (layer) {
    case 'rdcs':
      norm = Math.max(0, Math.min(1, value));
      invert = true; // higher is worse
      break;
    case 'life_expectancy':
      norm = Math.max(0, Math.min(1, (value - 68) / (83 - 68)));
      break;
    case 'obesity':
      norm = Math.max(0, Math.min(1, (value - 25) / (50 - 25)));
      invert = true;
      break;
    case 'food_desert':
      norm = Math.max(0, Math.min(1, value / 80));
      invert = true;
      break;
    case 'svi':
      norm = Math.max(0, Math.min(1, value));
      invert = true;
      break;
    case 'physician':
      norm = Math.max(0, Math.min(1, (value - 50) / (4000 - 50)));
      invert = true;
      break;
    case 'income':
      norm = Math.max(0, Math.min(1, (value - 30000) / (120000 - 30000)));
      break;
    default:
      norm = 0.5;
  }

  const t = invert ? 1 - norm : norm;

  // Interpolate from red to yellow to green
  if (t < 0.5) {
    const p = t / 0.5;
    const r = 220;
    const g = Math.round(38 + (151 - 38) * p);
    const b = Math.round(38 + (6 - 38) * p);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    const p = (t - 0.5) / 0.5;
    const r = Math.round(220 + (22 - 220) * p);
    const g = Math.round(151 + (163 - 151) * p);
    const b = Math.round(6 + (74 - 6) * p);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

export function Atlas() {
  const { zipData, loading } = useZipData();
  const narratives = useNarratives();
  const [geoJson, setGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [activeLayer, setActiveLayer] = useState<MapLayer>('rdcs');
  const [selectedZip, setSelectedZip] = useState<ZipData | null>(null);
  const [geoJsonKey, setGeoJsonKey] = useState(0);

  useEffect(() => {
    fetch('/geo/duval_zips.geojson')
      .then(r => r.json())
      .then(data => setGeoJson(data))
      .catch(err => console.error('Failed to load GeoJSON:', err));
  }, []);

  // Re-render GeoJSON when layer changes
  useEffect(() => {
    setGeoJsonKey(prev => prev + 1);
  }, [activeLayer, zipData]);

  const zipLookup = useMemo(() => {
    const map: Record<string, ZipData> = {};
    zipData.forEach(z => { map[z.geoid] = z; });
    return map;
  }, [zipData]);

  const onEachFeature = useCallback((feature: GeoJSON.Feature, layer: Layer) => {
    const geoid = feature.properties?.geoid;
    const zip = zipLookup[geoid];
    if (!zip) return;

    const value = getLayerValue(zip, activeLayer);
    const layerInfo = LAYERS.find(l => l.id === activeLayer);

    (layer as any).bindTooltip(
      `<strong>${zip.label}</strong><br/>${layerInfo?.label}: ${
        activeLayer === 'income' ? `$${(value / 1000).toFixed(0)}K` :
        activeLayer === 'life_expectancy' ? `${value.toFixed(1)} yr` :
        activeLayer === 'physician' ? `1:${Math.round(value)}` :
        `${value.toFixed(1)}`
      }`,
      { sticky: true, className: 'custom-tooltip' }
    );

    (layer as any).on('click', () => {
      setSelectedZip(zip);
    });
  }, [zipLookup, activeLayer]);

  const geoJsonStyle = useCallback((feature?: GeoJSON.Feature) => {
    if (!feature) return {};
    const geoid = feature.properties?.geoid;
    const zip = zipLookup[geoid];
    if (!zip) return { fillColor: '#334155', fillOpacity: 0.3, weight: 1, color: '#475569' };

    const value = getLayerValue(zip, activeLayer);
    const color = getLayerColor(value, activeLayer);

    return {
      fillColor: color,
      fillOpacity: 0.7,
      weight: selectedZip?.geoid === geoid ? 3 : 1,
      color: selectedZip?.geoid === geoid ? '#fff' : '#475569',
    };
  }, [zipLookup, activeLayer, selectedZip]);

  if (loading) {
    return (
      <div className="pt-16 flex items-center justify-center min-h-screen" style={{ background: '#0a0a0a' }}>
        <div style={{ color: 'rgba(224,224,224,0.4)' }}>Loading map data...</div>
      </div>
    );
  }

  return (
    <div className="pt-14 flex h-screen" style={{ background: '#0a0a0a' }}>
      {/* Left Sidebar - Layer Controls */}
      <div data-lenis-prevent className="w-64 overflow-y-auto shrink-0" style={{ background: '#0f0f0f', borderRight: '1px solid rgba(224,224,224,0.06)' }}>
        <div className="p-4">
          <h2 className="font-mono text-[10px] tracking-[0.2em] mb-3" style={{ color: 'rgba(224,224,224,0.4)' }}>MAP LAYERS</h2>
          <div className="space-y-1">
            {LAYERS.map(layer => (
              <button
                key={layer.id}
                onClick={() => setActiveLayer(layer.id)}
                className="w-full text-left p-2.5 rounded-lg transition-all"
                style={{
                  background: activeLayer === layer.id ? 'rgba(255,60,0,0.1)' : 'transparent',
                  border: activeLayer === layer.id ? '1px solid rgba(255,60,0,0.25)' : '1px solid transparent',
                }}
              >
                <div className="text-sm font-medium" style={{ color: activeLayer === layer.id ? '#ff3c00' : 'rgba(224,224,224,0.7)' }}>
                  {layer.label}
                </div>
                <div className="text-xs" style={{ color: 'rgba(224,224,224,0.3)' }}>{layer.description}</div>
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-6 pt-4" style={{ borderTop: '1px solid rgba(224,224,224,0.06)' }}>
            <h3 className="font-mono text-[10px] tracking-[0.2em] mb-2" style={{ color: 'rgba(224,224,224,0.3)' }}>LEGEND</h3>
            <div className="flex items-center gap-1">
              <span className="text-xs" style={{ color: 'rgba(224,224,224,0.3)' }}>Worse</span>
              <div className="flex-1 h-3 rounded-full" style={{
                background: 'linear-gradient(to right, #dc2626, #d97706, #16a34a)',
              }} />
              <span className="text-xs" style={{ color: 'rgba(224,224,224,0.3)' }}>Better</span>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 pt-4" style={{ borderTop: '1px solid rgba(224,224,224,0.06)' }}>
            <h3 className="font-mono text-[10px] tracking-[0.2em] mb-2" style={{ color: 'rgba(224,224,224,0.3)' }}>COVERAGE</h3>
            <div className="text-sm" style={{ color: 'rgba(224,224,224,0.5)' }}>
              <div>{zipData.length} ZIP codes</div>
              <div>{zipData.reduce((sum, z) => sum + z.population, 0).toLocaleString()} residents</div>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={[30.33, -81.66]}
          zoom={11}
          className="h-full w-full"
          zoomControl={true}
        >
          <TileLayer
            url="https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />
          {geoJson && (
            <GeoJSON
              key={geoJsonKey}
              data={geoJson}
              style={geoJsonStyle}
              onEachFeature={onEachFeature}
            />
          )}
        </MapContainer>

        {/* Active layer badge */}
        <div className="absolute top-4 left-4 z-[500] rounded-lg px-4 py-2" style={{ background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(224,224,224,0.06)' }}>
          <div className="font-mono text-[10px] tracking-[0.15em]" style={{ color: 'rgba(224,224,224,0.4)' }}>Showing</div>
          <div className="text-sm font-semibold" style={{ color: '#ff3c00' }}>
            {LAYERS.find(l => l.id === activeLayer)?.label}
          </div>
        </div>
      </div>

      {/* Right Panel - ZIP Details */}
      {selectedZip && (
        <ZipDetailPanel
          zip={selectedZip}
          narrative={narratives[selectedZip.geoid] || 'No narrative available.'}
          onClose={() => setSelectedZip(null)}
        />
      )}
    </div>
  );
}
