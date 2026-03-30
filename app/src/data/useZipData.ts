import { useState, useEffect } from 'react';

export interface ZipData {
  geoid: string;
  label: string;
  population: number;
  black_pop: number;
  white_pop: number;
  hispanic_pop: number;
  life_expectancy: number;
  median_income: number;
  obesity: number;
  physical_inactivity: number;
  smoking: number;
  depression: number;
  poor_mental_health: number;
  uninsured_rate: number;
  fair_poor_health: number;
  high_blood_pressure: number;
  high_cholesterol: number;
  disability: number;
  poor_physical_health: number;
  doctor_checkup: number;
  below_poverty: number;
  low_income_pop: number;
  excessive_housing_costs: number;
  svi_score: number;
  svi_vulnerable_factors: number;
  physician_ratio: number;
  pediatrician_ratio: number;
  nurse_practitioner_ratio: number;
  mental_health_providers: number;
  total_hc_workers: number;
  insured_pop: number;
  uninsured_pop: number;
  child_care_centers: number;
  num_parks: number;
  park_pct_area: number;
  park_acres: number;
  low_food_access_half_mile: number;
  low_food_access_1_mile: number;
  air_toxics_ej: number;
  traffic_ej: number;
  resilience_score: number;
  env_annual_loss: number;
  // Derived
  poverty_rate: number;
  food_desert_rate: number;
  park_acres_per_1k: number;
  mental_health_per_10k: number;
  hc_workers_per_10k: number;
  insurance_rate: number;
  physician_access: number;
  black_pct: number;
  child_care_per_10k: number;
  // Scores
  supply_score: number;
  demand_score: number;
  rdcs: number;
  rdcs_normalized: number;
  cluster: number;
  cluster_label: string;
}

export interface ImpactModel {
  predictor: string;
  target: string;
  description: string;
  coefficient: number;
  intercept: number;
  r_squared: number;
  correlation_r: number;
  p_value: number;
  n_samples: number;
  predictor_range: [number, number];
  target_range: [number, number];
}

export interface CostBenchmark {
  unit_cost: number;
  label: string;
  unit: string;
}

export interface ImpactModelData {
  models: Record<string, ImpactModel>;
  cost_benchmarks: Record<string, CostBenchmark>;
  county_averages: Record<string, number>;
  methodology: {
    description: string;
    limitations: string[];
  };
}

export interface ClusterProfile {
  label: string;
  description: string;
  zip_codes: string[];
  count: number;
  avg_metrics: Record<string, number>;
}

export interface CorrelationData {
  features: string[];
  labels: Record<string, string>;
  matrix: number[][];
  scatter_data: Record<string, { x: number; y: number; geoid: string; label: string }[]>;
}

export function useZipData() {
  const [zipData, setZipData] = useState<ZipData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/zipcode_data.json')
      .then(r => r.json())
      .then(data => { setZipData(data); setLoading(false); })
      .catch(err => { console.error('Failed to load zip data:', err); setLoading(false); });
  }, []);

  return { zipData, loading };
}

export function useImpactModel() {
  const [model, setModel] = useState<ImpactModelData | null>(null);

  useEffect(() => {
    fetch('/data/impact_model.json')
      .then(r => r.json())
      .then(setModel)
      .catch(console.error);
  }, []);

  return model;
}

export function useClusterProfiles() {
  const [clusters, setClusters] = useState<Record<string, ClusterProfile>>({});

  useEffect(() => {
    fetch('/data/cluster_profiles.json')
      .then(r => r.json())
      .then(setClusters)
      .catch(console.error);
  }, []);

  return clusters;
}

export function useCorrelationData() {
  const [corrData, setCorrData] = useState<CorrelationData | null>(null);

  useEffect(() => {
    fetch('/data/correlation_matrix.json')
      .then(r => r.json())
      .then(setCorrData)
      .catch(console.error);
  }, []);

  return corrData;
}

export function useNarratives() {
  const [narratives, setNarratives] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/data/narratives.json')
      .then(r => r.json())
      .then(setNarratives)
      .catch(console.error);
  }, []);

  return narratives;
}
