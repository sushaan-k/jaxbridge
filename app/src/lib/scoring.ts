import type { ZipData, ImpactModelData } from '../data/useZipData';

export interface Intervention {
  physicians: number;
  mentalHealthProviders: number;
  groceryStores: number;
  parkAcres: number;
  childCareCenters: number;
  insuranceSubsidyPct: number;
}

export interface ProjectedOutcome {
  metric: string;
  label: string;
  current: number;
  projected: number;
  change: number;
  unit: string;
}

export interface SimulationResult {
  outcomes: ProjectedOutcome[];
  lifeExpectancyGain: number;
  yearsOfLifeSaved: number;
  totalCost: number;
  costPerYearSaved: number;
}

export const DEFAULT_INTERVENTION: Intervention = {
  physicians: 0,
  mentalHealthProviders: 0,
  groceryStores: 0,
  parkAcres: 0,
  childCareCenters: 0,
  insuranceSubsidyPct: 0,
};

export function simulateIntervention(
  zip: ZipData,
  intervention: Intervention,
  model: ImpactModelData
): SimulationResult {
  const outcomes: ProjectedOutcome[] = [];
  let totalLifeExpGain = 0;

  // 1. Adding physicians changes physician ratio
  if (intervention.physicians > 0) {
    const currentDoctors = zip.population / (zip.physician_ratio || zip.population);
    const newDoctors = currentDoctors + intervention.physicians;
    const newRatio = zip.population / newDoctors;
    outcomes.push({
      metric: 'physician_ratio',
      label: 'Physician Ratio',
      current: Math.round(zip.physician_ratio || zip.population),
      projected: Math.round(newRatio),
      change: Math.round(newRatio - (zip.physician_ratio || zip.population)),
      unit: 'people per doctor',
    });
  }

  // 2. Adding grocery stores reduces food desert severity
  if (intervention.groceryStores > 0) {
    // Each grocery store serves ~5,000 people within half mile
    const peopleServed = intervention.groceryStores * 5000;
    const newLowAccess = Math.max(0, (zip.low_food_access_half_mile || 0) - peopleServed);
    const newFoodDesertRate = (newLowAccess / zip.population) * 100;
    const currentRate = zip.food_desert_rate;
    const rateChange = newFoodDesertRate - currentRate;

    outcomes.push({
      metric: 'food_desert_rate',
      label: 'Food Desert Rate',
      current: Math.round(currentRate * 10) / 10,
      projected: Math.round(newFoodDesertRate * 10) / 10,
      change: Math.round(rateChange * 10) / 10,
      unit: '%',
    });

    // Food access → obesity (use literature estimate since regression is weak)
    // Literature: ~2% reduction in obesity per 10pp reduction in food desert rate
    const obesityReduction = Math.abs(rateChange) * 0.2;
    if (obesityReduction > 0) {
      const newObesity = Math.max(20, zip.obesity - obesityReduction);
      outcomes.push({
        metric: 'obesity',
        label: 'Obesity Rate',
        current: zip.obesity,
        projected: Math.round(newObesity * 10) / 10,
        change: Math.round((newObesity - zip.obesity) * 10) / 10,
        unit: '%',
      });

      // Obesity → life expectancy (strong regression: coef = -0.3954)
      const obesityModel = model.models['obesity_to_life_exp'];
      if (obesityModel) {
        const leGain = obesityReduction * Math.abs(obesityModel.coefficient);
        totalLifeExpGain += leGain;
      }
    }
  }

  // 3. Adding park acres reduces physical inactivity
  if (intervention.parkAcres > 0) {
    const newParkAcres = (zip.park_acres || 0) + intervention.parkAcres;
    const newParkPer1k = (newParkAcres / zip.population) * 1000;
    const currentPer1k = zip.park_acres_per_1k;

    outcomes.push({
      metric: 'park_acres_per_1k',
      label: 'Park Acres per 1K',
      current: Math.round(currentPer1k * 100) / 100,
      projected: Math.round(newParkPer1k * 100) / 100,
      change: Math.round((newParkPer1k - currentPer1k) * 100) / 100,
      unit: 'acres/1K pop',
    });

    // Parks → physical inactivity (use literature: ~1.5% reduction per 5 acres/1K added)
    const parkIncrease = newParkPer1k - currentPer1k;
    const inactivityReduction = parkIncrease * 0.3;
    if (inactivityReduction > 0) {
      const newInactivity = Math.max(15, zip.physical_inactivity - inactivityReduction);
      outcomes.push({
        metric: 'physical_inactivity',
        label: 'Physical Inactivity',
        current: zip.physical_inactivity,
        projected: Math.round(newInactivity * 10) / 10,
        change: Math.round((newInactivity - zip.physical_inactivity) * 10) / 10,
        unit: '%',
      });

      // Inactivity → life expectancy (strong regression: coef = -0.3342)
      const inactModel = model.models['inactivity_to_life_exp'];
      if (inactModel) {
        const leGain = inactivityReduction * Math.abs(inactModel.coefficient);
        totalLifeExpGain += leGain;
      }
    }
  }

  // 4. Mental health providers
  if (intervention.mentalHealthProviders > 0) {
    const newProviders = (zip.mental_health_providers || 0) + intervention.mentalHealthProviders;
    const newPer10k = (newProviders / zip.population) * 10000;

    outcomes.push({
      metric: 'mental_health_per_10k',
      label: 'MH Providers per 10K',
      current: Math.round(zip.mental_health_per_10k * 100) / 100,
      projected: Math.round(newPer10k * 100) / 100,
      change: Math.round((newPer10k - zip.mental_health_per_10k) * 100) / 100,
      unit: 'per 10K pop',
    });

    // Literature estimate: each provider per 10K reduces poor mental health by ~0.5%
    const mhReduction = (newPer10k - zip.mental_health_per_10k) * 0.5;
    if (mhReduction > 0) {
      outcomes.push({
        metric: 'poor_mental_health',
        label: 'Poor Mental Health',
        current: zip.poor_mental_health,
        projected: Math.round((zip.poor_mental_health - mhReduction) * 10) / 10,
        change: Math.round(-mhReduction * 10) / 10,
        unit: '%',
      });
    }
  }

  // 5. Insurance subsidy
  if (intervention.insuranceSubsidyPct > 0) {
    const newInsuranceRate = Math.min(100, zip.insurance_rate + intervention.insuranceSubsidyPct);

    outcomes.push({
      metric: 'insurance_rate',
      label: 'Insurance Coverage',
      current: Math.round(zip.insurance_rate * 10) / 10,
      projected: Math.round(newInsuranceRate * 10) / 10,
      change: Math.round((newInsuranceRate - zip.insurance_rate) * 10) / 10,
      unit: '%',
    });

    // Insurance → checkups → downstream health effects
    // Literature: 5% insurance increase → ~1% better checkup rates → ~0.2 year life exp
    const leGain = (intervention.insuranceSubsidyPct / 5) * 0.2;
    totalLifeExpGain += leGain;
  }

  // 6. Child care centers
  if (intervention.childCareCenters > 0) {
    const newCenters = (zip.child_care_centers || 0) + intervention.childCareCenters;
    const newPer10k = (newCenters / zip.population) * 10000;

    outcomes.push({
      metric: 'child_care_per_10k',
      label: 'Child Care per 10K',
      current: Math.round(zip.child_care_per_10k * 100) / 100,
      projected: Math.round(newPer10k * 100) / 100,
      change: Math.round((newPer10k - zip.child_care_per_10k) * 100) / 100,
      unit: 'per 10K pop',
    });
  }

  // Add physician direct effect on life expectancy (small but include)
  if (intervention.physicians > 0) {
    // Literature: each additional physician per 10K → 0.1 year life expectancy gain
    const addedPer10k = (intervention.physicians / zip.population) * 10000;
    totalLifeExpGain += addedPer10k * 0.1;
  }

  // Apply diminishing returns (logarithmic) — first interventions help more
  // This models the non-linear behavior observed in the SCAN model:
  // small gains are near-linear, large gains plateau due to compounding limits
  if (totalLifeExpGain > 0) {
    totalLifeExpGain = Math.log1p(totalLifeExpGain * 2) / Math.log1p(2); // normalize so gain(1)≈1
  }

  // Cap at reasonable maximum based on model ceiling
  totalLifeExpGain = Math.min(totalLifeExpGain, 6);

  // Calculate cost
  const benchmarks = model.cost_benchmarks;
  const totalCost =
    intervention.physicians * (benchmarks.physician?.unit_cost || 250000) +
    intervention.mentalHealthProviders * (benchmarks.mental_health?.unit_cost || 150000) +
    intervention.groceryStores * (benchmarks.grocery_store?.unit_cost || 2000000) +
    intervention.parkAcres * (benchmarks.park_acre?.unit_cost || 50000) +
    intervention.childCareCenters * (benchmarks.child_care?.unit_cost || 500000) +
    intervention.insuranceSubsidyPct * (zip.uninsured_pop || 0) * (benchmarks.insurance_subsidy?.unit_cost || 5000) / 100;

  // Years of life saved: population-weighted with age adjustment
  // Only ~60% of population benefits meaningfully (excludes very young children
  // and elderly whose outcomes are less modifiable by preventive interventions)
  const effectivePopulation = zip.population * 0.6;
  // Apply discount: life expectancy gain is an average, but individual
  // benefit follows a distribution — use sqrt scaling to avoid inflated numbers
  const yearsOfLifeSaved = Math.round(totalLifeExpGain * Math.sqrt(effectivePopulation) * 10);
  const costPerYearSaved = yearsOfLifeSaved > 0 ? totalCost / yearsOfLifeSaved : 0;

  // Add the life expectancy projection
  outcomes.unshift({
    metric: 'life_expectancy',
    label: 'Life Expectancy',
    current: zip.life_expectancy,
    projected: Math.round((zip.life_expectancy + totalLifeExpGain) * 10) / 10,
    change: Math.round(totalLifeExpGain * 10) / 10,
    unit: 'years',
  });

  return {
    outcomes,
    lifeExpectancyGain: Math.round(totalLifeExpGain * 100) / 100,
    yearsOfLifeSaved: Math.round(yearsOfLifeSaved),
    totalCost,
    costPerYearSaved: Math.round(costPerYearSaved),
  };
}

// Color utilities
export function getRDCSColor(value: number): string {
  if (value > 0.75) return '#dc2626'; // red
  if (value > 0.5) return '#ea580c';  // orange
  if (value > 0.25) return '#d97706'; // yellow
  return '#16a34a';                    // green
}

export function getLifeExpColor(le: number): string {
  if (le < 72) return '#dc2626';
  if (le < 75) return '#ea580c';
  if (le < 78) return '#d97706';
  return '#16a34a';
}

export function getMetricColor(value: number, min: number, max: number, invert = false): string {
  const norm = (value - min) / (max - min);
  const t = invert ? 1 - norm : norm;
  if (t > 0.75) return '#dc2626';
  if (t > 0.5) return '#ea580c';
  if (t > 0.25) return '#d97706';
  return '#16a34a';
}

export function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toLocaleString();
}

export function formatCurrency(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}
