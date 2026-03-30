#!/usr/bin/env python3
"""
JaxBridge Data Preprocessing Pipeline
Merges 9 CSV datasets, computes Resource Desert Composite Score (RDCS),
runs K-means clustering, fits regression impact model, generates narratives.
Outputs static JSON files for the React frontend.
"""

import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import MinMaxScaler
from sklearn.linear_model import LinearRegression
from scipy import stats
import json
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'Datasets')
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'data')
os.makedirs(OUT_DIR, exist_ok=True)

# ─── Step 1: Load and merge all datasets ─────────────────────────────────────

def load_csv(filename):
    path = os.path.join(DATA_DIR, filename)
    df = pd.read_csv(path)
    # Standardize geoid column
    if 'geoid' not in df.columns:
        for col in df.columns:
            if 'geoid' in col.lower():
                df = df.rename(columns={col: 'geoid'})
                break
    df['geoid'] = df['geoid'].astype(str)
    return df

print("Loading datasets...")
demographics = load_csv('Census-Demographics.csv')
cdc = load_csv('CDCPlaces.csv')
housing = load_csv('Census-Housing&Poverty.csv')
fema = load_csv('FEMA.csv')
food = load_csv('USDA-FoodAccess.csv')
parks = load_csv('Parks.csv')
svi = load_csv('SocialVulnerabilityIndex.csv')
hcw = load_csv('HealthCareWorkers.csv')
hca = load_csv('HealthCareAccess.csv')

# Merge all on geoid
print("Merging datasets...")
# Start with demographics as base
merged = demographics[['geoid', 'feature label',
    'Total Population (2020-2024)',
    'Black (Not Hispanic or Latino) (2020-2024)',
    'White (Not Hispanic or Latino) (2020-2024)',
    'Hispanic or Latino (2020-2024)',
    'Education Bachelor\'s Degree (2020-2024)',
    'Education Graduate Degree (2020-2024)',
    'Income Less than $25,000 (2020-2024)',
]].copy()

merged.columns = ['geoid', 'label', 'population', 'black_pop', 'white_pop',
                   'hispanic_pop', 'edu_bachelors', 'edu_graduate', 'income_under_25k']

# Convert numeric columns
for col in merged.columns[2:]:
    merged[col] = pd.to_numeric(merged[col], errors='coerce')

# CDC Places
cdc_cols = cdc[['geoid',
    'Life Expectancy at Birth (2010-2015)',
    'Fair or Poor General Health Among Adults (2023)',
    'Diagnosed Depression Among Adults (2023)',
    'Any Disability Among Adults (2023)',
    'Poor Physical Health Among Adults (2023)',
    'Regular Smoking Among Adults (2023)',
    'Obesity Among Adults (2023)',
    'No Leisure-Time Physical Activity Among Adults (2023)',
    'Poor Mental Health Among Adults (2023)',
    'Doctor Checkup in Past Year Among Adults (2023)',
    'Lack of Health Insurance Among Adults (2023)',
    'High Blood Pressure Among Adults (2023)',
    'High Cholesterol Among Adults (2023)',
]].copy()
cdc_cols.columns = ['geoid', 'life_expectancy', 'fair_poor_health', 'depression',
                     'disability', 'poor_physical_health', 'smoking', 'obesity',
                     'physical_inactivity', 'poor_mental_health', 'doctor_checkup',
                     'uninsured_rate', 'high_blood_pressure', 'high_cholesterol']
for col in cdc_cols.columns[1:]:
    cdc_cols[col] = pd.to_numeric(cdc_cols[col], errors='coerce')
merged = merged.merge(cdc_cols, on='geoid', how='left')

# Housing & Poverty
housing_cols = housing[['geoid',
    'Median Household Income (2020-2024)',
    'Excessive Housing Costs (Housing Costs 30 Percent or More of Income) (2020-2024)',
    'People Below Poverty Level (2020-2024)',
    'Low Income Population (Income is 200% or Under the Poverty Level) (2020-2024)',
]].copy()
housing_cols.columns = ['geoid', 'median_income', 'excessive_housing_costs',
                         'below_poverty', 'low_income_pop']
for col in housing_cols.columns[1:]:
    housing_cols[col] = pd.to_numeric(housing_cols[col], errors='coerce')
merged = merged.merge(housing_cols, on='geoid', how='left')

# FEMA
fema_cols = fema[['geoid',
    'Environmental Hazard Community Resilience Score (2025)',
    'Environmental Hazard Expected Annual Loss Total (2025)',
    'Social Vulnerability to Environmental Hazards (2024)',
    'Air Toxics Cancer Risk Environmental Justice Index (2023)',
    'Traffic Proximity and Volume Environmental Justice Index (2024)',
]].copy()
fema_cols.columns = ['geoid', 'resilience_score', 'env_annual_loss',
                      'env_social_vulnerability', 'air_toxics_ej', 'traffic_ej']
for col in fema_cols.columns[1:]:
    fema_cols[col] = pd.to_numeric(fema_cols[col], errors='coerce')
merged = merged.merge(fema_cols, on='geoid', how='left')

# Food Access
food_cols = food[['geoid',
    'People 1/2 Mile Urban/10 Miles Rural with Low Access to Healthy Food (2019)',
    'People 1 Miles Urban/10 Miles Rural with Low Access to Healthy Food (2019)',
    'Low Income People (USDA) (2019)',
]].copy()
food_cols.columns = ['geoid', 'low_food_access_half_mile', 'low_food_access_1_mile',
                      'usda_low_income']
for col in food_cols.columns[1:]:
    food_cols[col] = pd.to_numeric(food_cols[col], errors='coerce')
merged = merged.merge(food_cols, on='geoid', how='left')

# Parks
parks_cols = parks[['geoid',
    'Number of Parks (2018)',
    'Percent Area Covered by Parks (2018)',
    'Park Area (acres) (2018)',
]].copy()
parks_cols.columns = ['geoid', 'num_parks', 'park_pct_area', 'park_acres']
for col in parks_cols.columns[1:]:
    parks_cols[col] = pd.to_numeric(parks_cols[col], errors='coerce')
merged = merged.merge(parks_cols, on='geoid', how='left')

# SVI
svi_cols = svi[['geoid',
    'Social Vulnerability Index Within the State (2022)',
    'Social Vulnerability Index Highly Vulnerable Factors Within the State (2022)',
]].copy()
svi_cols.columns = ['geoid', 'svi_score', 'svi_vulnerable_factors']
for col in svi_cols.columns[1:]:
    svi_cols[col] = pd.to_numeric(svi_cols[col], errors='coerce')
merged = merged.merge(svi_cols, on='geoid', how='left')

# Healthcare Workers
hcw_cols = hcw[['geoid',
    'Pediatrician Ratio (2025)',
    'Primary Care Physician Ratio (2025)',
    'Primary Care Nurse Practitioner Ratio (2025)',
    'Child Care Centers (2023)',
]].copy()
hcw_cols.columns = ['geoid', 'pediatrician_ratio', 'physician_ratio',
                      'nurse_practitioner_ratio', 'child_care_centers']
for col in hcw_cols.columns[1:]:
    hcw_cols[col] = pd.to_numeric(hcw_cols[col], errors='coerce')
merged = merged.merge(hcw_cols, on='geoid', how='left')

# Healthcare Access
hca_cols = hca[['geoid',
    'Mental Health Providers (2025)',
    'Total Health Care Workers (2025)',
    'People with Health Insurance (2020-2024)',
    'People without Health Insurance (2020-2024)',
]].copy()
hca_cols.columns = ['geoid', 'mental_health_providers', 'total_hc_workers',
                      'insured_pop', 'uninsured_pop']
for col in hca_cols.columns[1:]:
    hca_cols[col] = pd.to_numeric(hca_cols[col], errors='coerce')
merged = merged.merge(hca_cols, on='geoid', how='left')

# ─── Step 2: Filter to usable ZIP codes ───────────────────────────────────────

# Drop county-level row and zero-population ZIPs
merged = merged[merged['geoid'].str.startswith('32')].copy()
merged = merged[merged['population'] > 0].copy()
merged = merged.dropna(subset=['life_expectancy']).copy()
merged = merged.reset_index(drop=True)

print(f"Usable ZIP codes: {len(merged)}")
print(f"ZIPs: {sorted(merged['geoid'].tolist())}")

# ─── Step 3: Compute derived metrics ──────────────────────────────────────────

# Per-capita metrics
merged['poverty_rate'] = (merged['below_poverty'] / merged['population'] * 100).round(1)
merged['low_income_rate'] = (merged['low_income_pop'] / merged['population'] * 100).round(1)
merged['excessive_housing_rate'] = (merged['excessive_housing_costs'] / merged['population'] * 100).round(1)
merged['food_desert_rate'] = (merged['low_food_access_half_mile'] / merged['population'] * 100).round(1)
merged['food_desert_1mi_rate'] = (merged['low_food_access_1_mile'] / merged['population'] * 100).round(1)
merged['park_acres_per_1k'] = (merged['park_acres'] / merged['population'] * 1000).round(2)
merged['mental_health_per_10k'] = (merged['mental_health_providers'] / merged['population'] * 10000).round(2)
merged['hc_workers_per_10k'] = (merged['total_hc_workers'] / merged['population'] * 10000).round(2)
merged['insurance_rate'] = (merged['insured_pop'] / (merged['insured_pop'] + merged['uninsured_pop']) * 100).round(1)
merged['black_pct'] = (merged['black_pop'] / merged['population'] * 100).round(1)
merged['child_care_per_10k'] = (merged['child_care_centers'] / merged['population'] * 10000).round(2)

# Inverse physician ratio (higher = better access) - handle the ratio being people-per-doctor
# Lower physician_ratio = better (fewer people per doctor)
# We want a score where higher = better access
merged['physician_access'] = merged['physician_ratio'].apply(
    lambda x: 1000 / x if pd.notna(x) and x > 0 else 0
).round(4)

# ─── Step 4: Compute RDCS (Resource Desert Composite Score) ──────────────────

print("Computing RDCS scores...")

scaler = MinMaxScaler()

# Supply-side indicators (higher = more resources = better)
supply_features = [
    'physician_access',       # Inverse physician ratio
    'mental_health_per_10k',  # Mental health provider density
    'insurance_rate',         # Insurance coverage
    'park_acres_per_1k',      # Green space per capita
    'child_care_per_10k',     # Child care density
    'doctor_checkup',         # Checkup access rate
]

# Demand-side indicators (higher = more need = worse)
demand_features = [
    'obesity',                # Health burden
    'physical_inactivity',    # Health burden
    'smoking',                # Health burden
    'poor_mental_health',     # Health burden
    'poverty_rate',           # Economic stress
    'excessive_housing_rate', # Economic stress
    'svi_score',              # Vulnerability
    'air_toxics_ej',          # Environmental burden
    'food_desert_rate',       # Food access deficit
]

# Fill NaN with median for scoring
for col in supply_features + demand_features:
    merged[col] = merged[col].fillna(merged[col].median())

# Normalize 0-1
supply_data = merged[supply_features].values
demand_data = merged[demand_features].values

supply_norm = scaler.fit_transform(supply_data)
demand_norm = MinMaxScaler().fit_transform(demand_data)

# Compute composite scores
merged['supply_score'] = supply_norm.mean(axis=1).round(4)
merged['demand_score'] = demand_norm.mean(axis=1).round(4)

# RDCS = demand - supply (higher = bigger gap = worse desert)
merged['rdcs'] = (merged['demand_score'] - merged['supply_score']).round(4)

# Normalize RDCS to 0-1 range for visualization
rdcs_min = merged['rdcs'].min()
rdcs_max = merged['rdcs'].max()
merged['rdcs_normalized'] = ((merged['rdcs'] - rdcs_min) / (rdcs_max - rdcs_min)).round(4)

print("\nTop 5 Resource Deserts (highest RDCS):")
for _, row in merged.nlargest(5, 'rdcs')[['geoid', 'label', 'rdcs', 'rdcs_normalized', 'life_expectancy', 'population']].iterrows():
    print(f"  {row['geoid']} ({row['label']}): RDCS={row['rdcs_normalized']:.2f}, LE={row['life_expectancy']:.1f}, Pop={row['population']:,.0f}")

print("\nBottom 5 (most resourced):")
for _, row in merged.nsmallest(5, 'rdcs')[['geoid', 'label', 'rdcs', 'rdcs_normalized', 'life_expectancy']].iterrows():
    print(f"  {row['geoid']} ({row['label']}): RDCS={row['rdcs_normalized']:.2f}, LE={row['life_expectancy']:.1f}")

# ─── Step 5: K-Means Clustering ──────────────────────────────────────────────

print("\nRunning K-Means clustering...")

cluster_features = [
    'life_expectancy', 'median_income', 'obesity', 'physical_inactivity',
    'svi_score', 'physician_access', 'food_desert_rate', 'park_acres_per_1k',
    'mental_health_per_10k', 'poverty_rate', 'uninsured_rate',
]

cluster_data = merged[cluster_features].fillna(merged[cluster_features].median())
cluster_scaled = MinMaxScaler().fit_transform(cluster_data)

# Use 4 clusters
kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
merged['cluster'] = kmeans.fit_predict(cluster_scaled)

# Label clusters based on their characteristics
cluster_means = merged.groupby('cluster')[['life_expectancy', 'median_income', 'rdcs_normalized', 'svi_score', 'population']].mean()

# Sort clusters by RDCS (worst first)
cluster_order = cluster_means.sort_values('rdcs_normalized', ascending=False).index.tolist()

cluster_labels = {}
cluster_descriptions = {}
label_names = [
    ("Critical Desert", "Severe resource gaps across all dimensions. Lowest life expectancy, highest poverty, worst health outcomes. Requires comprehensive multi-resource investment."),
    ("Struggling Suburban", "Large populations with moderate-to-high needs. Not the worst per-capita rates, but massive absolute numbers of underserved residents."),
    ("Resourced Suburban", "Well-resourced suburban communities with highest life expectancy and income. Low RDCS indicates strong existing infrastructure."),
    ("Urban Transitional", "Small urban neighborhoods with good resource access (low RDCS) but mixed health outcomes. Dense, walkable areas with older housing stock."),
]

for i, cluster_id in enumerate(cluster_order):
    cluster_labels[int(cluster_id)] = label_names[i][0]
    cluster_descriptions[int(cluster_id)] = label_names[i][1]

merged['cluster_label'] = merged['cluster'].map(cluster_labels)

print("\nCluster assignments:")
for cluster_id in cluster_order:
    zips = merged[merged['cluster'] == cluster_id]['geoid'].tolist()
    label = cluster_labels[cluster_id]
    avg_le = merged[merged['cluster'] == cluster_id]['life_expectancy'].mean()
    avg_rdcs = merged[merged['cluster'] == cluster_id]['rdcs_normalized'].mean()
    print(f"  {label}: ZIPs={zips}, Avg LE={avg_le:.1f}, Avg RDCS={avg_rdcs:.2f}")

# ─── Step 6: Regression Impact Model ─────────────────────────────────────────

print("\nFitting impact model regressions...")

impact_models = {}

# Define regression targets
regressions = [
    # (predictor, target, name, description)
    ('physician_access', 'life_expectancy', 'physician_to_life_exp',
     'Effect of physician access on life expectancy'),
    ('food_desert_rate', 'obesity', 'food_desert_to_obesity',
     'Effect of food desert severity on obesity rate'),
    ('park_acres_per_1k', 'physical_inactivity', 'parks_to_inactivity',
     'Effect of park acreage on physical inactivity'),
    ('mental_health_per_10k', 'poor_mental_health', 'mh_providers_to_mental_health',
     'Effect of mental health provider density on poor mental health'),
    ('insurance_rate', 'doctor_checkup', 'insurance_to_checkups',
     'Effect of insurance coverage on regular checkups'),
    ('food_desert_rate', 'life_expectancy', 'food_desert_to_life_exp',
     'Effect of food desert severity on life expectancy'),
    ('physical_inactivity', 'life_expectancy', 'inactivity_to_life_exp',
     'Effect of physical inactivity on life expectancy'),
    ('obesity', 'life_expectancy', 'obesity_to_life_exp',
     'Effect of obesity rate on life expectancy'),
    ('median_income', 'life_expectancy', 'income_to_life_exp',
     'Effect of median income on life expectancy'),
]

for predictor, target, name, desc in regressions:
    valid = merged[[predictor, target]].dropna()
    if len(valid) < 5:
        continue
    X = valid[predictor].values.reshape(-1, 1)
    y = valid[target].values

    reg = LinearRegression()
    reg.fit(X, y)

    # Correlation
    r, p_value = stats.pearsonr(valid[predictor], valid[target])

    impact_models[name] = {
        'predictor': predictor,
        'target': target,
        'description': desc,
        'coefficient': round(float(reg.coef_[0]), 6),
        'intercept': round(float(reg.intercept_), 4),
        'r_squared': round(float(reg.score(X, y)), 4),
        'correlation_r': round(float(r), 4),
        'p_value': round(float(p_value), 6),
        'n_samples': len(valid),
        'predictor_range': [round(float(valid[predictor].min()), 2), round(float(valid[predictor].max()), 2)],
        'target_range': [round(float(valid[target].min()), 2), round(float(valid[target].max()), 2)],
    }
    print(f"  {name}: coef={reg.coef_[0]:.4f}, R²={reg.score(X, y):.3f}, r={r:.3f}, p={p_value:.4f}")

# ─── Step 7: Correlation Matrix ───────────────────────────────────────────────

print("\nComputing correlation matrix...")

corr_features = [
    'life_expectancy', 'median_income', 'obesity', 'physical_inactivity',
    'smoking', 'depression', 'poor_mental_health', 'uninsured_rate',
    'svi_score', 'food_desert_rate', 'park_acres_per_1k', 'physician_access',
    'mental_health_per_10k', 'poverty_rate', 'air_toxics_ej',
    'high_blood_pressure', 'fair_poor_health',
]

corr_labels = {
    'life_expectancy': 'Life Expectancy',
    'median_income': 'Median Income',
    'obesity': 'Obesity Rate',
    'physical_inactivity': 'Physical Inactivity',
    'smoking': 'Smoking Rate',
    'depression': 'Depression Rate',
    'poor_mental_health': 'Poor Mental Health',
    'uninsured_rate': 'Uninsured Rate',
    'svi_score': 'Social Vulnerability',
    'food_desert_rate': 'Food Desert Rate',
    'park_acres_per_1k': 'Park Acres/1K',
    'physician_access': 'Physician Access',
    'mental_health_per_10k': 'MH Providers/10K',
    'poverty_rate': 'Poverty Rate',
    'air_toxics_ej': 'Air Toxics Risk',
    'high_blood_pressure': 'High Blood Pressure',
    'fair_poor_health': 'Poor General Health',
}

corr_data = merged[corr_features].fillna(merged[corr_features].median())
corr_matrix = corr_data.corr().round(4)

correlation_output = {
    'features': corr_features,
    'labels': corr_labels,
    'matrix': corr_matrix.values.tolist(),
    'scatter_data': {}
}

# Pre-compute scatter data for key pairs
key_pairs = [
    ('median_income', 'life_expectancy'),
    ('food_desert_rate', 'obesity'),
    ('park_acres_per_1k', 'physical_inactivity'),
    ('svi_score', 'life_expectancy'),
    ('obesity', 'life_expectancy'),
    ('physical_inactivity', 'life_expectancy'),
    ('smoking', 'life_expectancy'),
    ('uninsured_rate', 'life_expectancy'),
    ('physician_access', 'life_expectancy'),
    ('depression', 'median_income'),
]

for x_feat, y_feat in key_pairs:
    key = f"{x_feat}_vs_{y_feat}"
    points = []
    for _, row in merged.iterrows():
        if pd.notna(row[x_feat]) and pd.notna(row[y_feat]):
            points.append({
                'x': round(float(row[x_feat]), 2),
                'y': round(float(row[y_feat]), 2),
                'geoid': row['geoid'],
                'label': row['label'],
            })
    correlation_output['scatter_data'][key] = points

# ─── Step 8: Generate Narratives ──────────────────────────────────────────────

print("\nGenerating neighborhood narratives...")

county_avg = {
    'life_expectancy': 76.4,
    'median_income': 71277,
    'obesity': 34.3,
    'physical_inactivity': 27.1,
    'uninsured_rate': 13.6,
    'svi_score': 0.697,
    'smoking': 13.9,
}

narratives = {}

for _, row in merged.iterrows():
    geoid = row['geoid']
    parts = []

    # Opening
    pop = int(row['population'])
    parts.append(f"In {row['label']}, approximately {pop:,} residents")

    # Life expectancy
    le = row['life_expectancy']
    le_diff = le - county_avg['life_expectancy']
    if le_diff < -5:
        parts.append(f" face a life expectancy of just {le:.1f} years — {abs(le_diff):.1f} years below the county average of {county_avg['life_expectancy']}.")
    elif le_diff < -2:
        parts.append(f" have a life expectancy of {le:.1f} years, {abs(le_diff):.1f} years below the county average.")
    elif le_diff > 3:
        parts.append(f" enjoy a life expectancy of {le:.1f} years, {le_diff:.1f} years above the county average.")
    else:
        parts.append(f" have a life expectancy of {le:.1f} years, close to the county average of {county_avg['life_expectancy']}.")

    # Income context
    income = row['median_income']
    if pd.notna(income):
        if income < 40000:
            parts.append(f" The median household income of ${income:,.0f} is well below the county median of ${county_avg['median_income']:,}, placing significant financial strain on families.")
        elif income > 100000:
            parts.append(f" With a median household income of ${income:,.0f}, residents are financially well-positioned relative to the county median of ${county_avg['median_income']:,}.")

    # Health outcomes
    if row['obesity'] > 40:
        parts.append(f" Nearly half of adults ({row['obesity']}%) struggle with obesity,")
        if row['food_desert_rate'] > 40:
            parts.append(f" compounded by the fact that {row['food_desert_rate']:.0f}% of residents lack nearby access to healthy food.")
        else:
            parts.append(f" a rate well above the county average of {county_avg['obesity']}%.")
    elif row['obesity'] > 35:
        parts.append(f" The obesity rate of {row['obesity']}% exceeds the county average of {county_avg['obesity']}%.")

    if row['physical_inactivity'] > 35:
        parts.append(f" {row['physical_inactivity']}% of adults report no leisure-time physical activity.")

    # Healthcare access
    if pd.notna(row['physician_ratio']) and row['physician_ratio'] > 2000:
        parts.append(f" Healthcare access is severely limited, with only one primary care physician per {row['physician_ratio']:,.0f} residents.")

    if row['uninsured_rate'] > 18:
        parts.append(f" {row['uninsured_rate']}% of adults lack health insurance, limiting preventive care access.")

    # SVI
    if pd.notna(row['svi_score']) and row['svi_score'] > 0.85:
        parts.append(f" The Social Vulnerability Index of {row['svi_score']:.2f} (on a 0-1 scale) places this ZIP in the most vulnerable tier statewide.")

    # Resource desert summary
    rdcs = row['rdcs_normalized']
    if rdcs > 0.75:
        parts.append(f" Our Resource Desert Composite Score of {rdcs:.2f} confirms this neighborhood as one of Jacksonville's most critical resource deserts, with significant gaps across healthcare, food access, and green space.")
    elif rdcs > 0.5:
        parts.append(f" With a Resource Desert Score of {rdcs:.2f}, this area shows meaningful resource gaps that warrant targeted intervention.")
    elif rdcs < 0.25:
        parts.append(f" With a low Resource Desert Score of {rdcs:.2f}, this area is relatively well-served across most dimensions.")

    narratives[geoid] = ''.join(parts)

# ─── Step 9: Prepare cost benchmarks for simulator ────────────────────────────

cost_benchmarks = {
    'physician': {'unit_cost': 250000, 'label': 'Primary Care Physician (annual salary)', 'unit': 'per physician'},
    'mental_health': {'unit_cost': 150000, 'label': 'Mental Health Provider (annual salary)', 'unit': 'per provider'},
    'grocery_store': {'unit_cost': 2000000, 'label': 'Community Grocery Store', 'unit': 'per location'},
    'food_pantry': {'unit_cost': 200000, 'label': 'Food Pantry / Distribution Site', 'unit': 'per location'},
    'park_acre': {'unit_cost': 50000, 'label': 'Park Development', 'unit': 'per acre'},
    'child_care': {'unit_cost': 500000, 'label': 'Child Care Center', 'unit': 'per center'},
    'insurance_subsidy': {'unit_cost': 5000, 'label': 'Insurance Subsidy', 'unit': 'per person per year'},
}

# ─── Step 10: Output JSON files ───────────────────────────────────────────────

print("\nWriting output JSON files...")

# 1. zipcode_data.json — all merged data
zip_data = []
for _, row in merged.iterrows():
    entry = {}
    for col in merged.columns:
        val = row[col]
        if pd.isna(val):
            entry[col] = None
        elif isinstance(val, (np.integer, np.int64)):
            entry[col] = int(val)
        elif isinstance(val, (np.floating, np.float64)):
            entry[col] = round(float(val), 4)
        else:
            entry[col] = val
    zip_data.append(entry)

with open(os.path.join(OUT_DIR, 'zipcode_data.json'), 'w') as f:
    json.dump(zip_data, f, indent=2)
print(f"  zipcode_data.json: {len(zip_data)} ZIP codes")

# 2. correlation_matrix.json
with open(os.path.join(OUT_DIR, 'correlation_matrix.json'), 'w') as f:
    json.dump(correlation_output, f, indent=2)
print("  correlation_matrix.json")

# 3. cluster_profiles.json
cluster_profiles = {}
for cluster_id in range(4):
    cluster_zips = merged[merged['cluster'] == cluster_id]
    profile = {
        'label': cluster_labels.get(cluster_id, f'Cluster {cluster_id}'),
        'description': cluster_descriptions.get(cluster_id, ''),
        'zip_codes': cluster_zips['geoid'].tolist(),
        'count': len(cluster_zips),
        'avg_metrics': {
            'life_expectancy': round(float(cluster_zips['life_expectancy'].mean()), 1),
            'median_income': round(float(cluster_zips['median_income'].mean()), 0),
            'obesity': round(float(cluster_zips['obesity'].mean()), 1),
            'physical_inactivity': round(float(cluster_zips['physical_inactivity'].mean()), 1),
            'svi_score': round(float(cluster_zips['svi_score'].mean()), 3),
            'rdcs_normalized': round(float(cluster_zips['rdcs_normalized'].mean()), 3),
            'food_desert_rate': round(float(cluster_zips['food_desert_rate'].mean()), 1),
            'uninsured_rate': round(float(cluster_zips['uninsured_rate'].mean()), 1),
            'poverty_rate': round(float(cluster_zips['poverty_rate'].mean()), 1),
            'population': round(float(cluster_zips['population'].sum()), 0),
        }
    }
    cluster_profiles[str(cluster_id)] = profile

with open(os.path.join(OUT_DIR, 'cluster_profiles.json'), 'w') as f:
    json.dump(cluster_profiles, f, indent=2)
print("  cluster_profiles.json")

# 4. impact_model.json
impact_output = {
    'models': impact_models,
    'cost_benchmarks': cost_benchmarks,
    'county_averages': county_avg,
    'methodology': {
        'description': 'Cross-sectional linear regressions across Jacksonville ZIP codes.',
        'limitations': [
            f'Small sample size (n={len(merged)} ZIP codes)',
            'Cross-sectional correlations, not causal estimates',
            'Ecological fallacy: ZIP-level associations may not apply to individuals',
            'Coefficients should be interpreted as directional estimates, not precise predictions',
        ],
    },
}

with open(os.path.join(OUT_DIR, 'impact_model.json'), 'w') as f:
    json.dump(impact_output, f, indent=2)
print("  impact_model.json")

# 5. narratives.json
with open(os.path.join(OUT_DIR, 'narratives.json'), 'w') as f:
    json.dump(narratives, f, indent=2)
print("  narratives.json")

# ─── Step 6B: Random Forest Feature Importance ───────────────────────────────

from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import cross_val_score
from sklearn.metrics import mean_absolute_error

print("\nFitting Random Forest for feature importance...")

rf_features = [
    'median_income', 'obesity', 'physical_inactivity', 'smoking', 'uninsured_rate',
    'svi_score', 'food_desert_rate', 'park_acres_per_1k', 'mental_health_per_10k',
    'physician_access', 'poverty_rate', 'air_toxics_ej', 'depression',
    'high_blood_pressure', 'fair_poor_health',
]

rf_data = merged[rf_features + ['life_expectancy']].dropna()
X_rf = rf_data[rf_features].values
y_rf = rf_data['life_expectancy'].values

rf = RandomForestRegressor(n_estimators=100, random_state=42, max_depth=5)
rf.fit(X_rf, y_rf)
rf_r2 = rf.score(X_rf, y_rf)

rf_importances = sorted(
    zip(rf_features, rf.feature_importances_),
    key=lambda x: -x[1]
)
print("  Random Forest R²:", round(rf_r2, 4))
print("  Top 5 features:")
for feat, imp in rf_importances[:5]:
    print(f"    {feat}: {imp:.4f}")

# ─── Step 6C: Gradient Boosting with Cross-Validation ─────────────────────────

print("\nFitting Gradient Boosting with 5-fold CV...")
gb = GradientBoostingRegressor(n_estimators=100, max_depth=3, random_state=42, learning_rate=0.1)
gb.fit(X_rf, y_rf)
gb_r2 = gb.score(X_rf, y_rf)
gb_pred = gb.predict(X_rf)
gb_mae = mean_absolute_error(y_rf, gb_pred)

cv_scores = cross_val_score(gb, X_rf, y_rf, cv=min(5, len(X_rf)), scoring='r2')
print(f"  GB R²: {gb_r2:.4f}")
print(f"  GB MAE: {gb_mae:.2f} years")
print(f"  CV R² scores: {[round(s, 3) for s in cv_scores]}")
print(f"  CV mean: {cv_scores.mean():.3f} ± {cv_scores.std():.3f}")

# ─── Step 6D: Counterfactual Analysis ─────────────────────────────────────────

print("\nRunning counterfactual analysis...")

critical_zips = ['32209', '32254', '32208', '32206', '32202']
county_medians = {}
for feat in rf_features:
    county_medians[feat] = float(merged[feat].median())

counterfactuals = []
for geoid in critical_zips:
    row = merged[merged['geoid'] == geoid]
    if row.empty:
        continue
    row = row.iloc[0]

    # Actual prediction
    actual_features = [row[f] if pd.notna(row[f]) else county_medians[f] for f in rf_features]
    actual_pred = gb.predict([actual_features])[0]

    # Counterfactual: replace ALL features with county median
    # This models: "What if this ZIP had average resources AND health outcomes?"
    # Only replace features where the ZIP is worse than median
    cf_features = list(actual_features)
    changes = {}
    worse_is_higher = ['obesity', 'physical_inactivity', 'smoking', 'uninsured_rate',
                        'svi_score', 'food_desert_rate', 'poverty_rate', 'depression',
                        'high_blood_pressure', 'fair_poor_health', 'air_toxics_ej',
                        'physician_access']  # higher physician_access = more people per doctor = worse
    for feat in rf_features:
        idx = rf_features.index(feat)
        old_val = cf_features[idx]
        new_val = county_medians[feat]
        # Only replace if this ZIP is worse than median
        if feat in worse_is_higher:
            if old_val > new_val:
                cf_features[idx] = new_val
                changes[feat] = {'from': round(float(old_val), 2), 'to': round(float(new_val), 2)}
        elif feat == 'median_income':
            if old_val < new_val:
                cf_features[idx] = new_val
                changes[feat] = {'from': round(float(old_val), 2), 'to': round(float(new_val), 2)}
        elif feat in ['park_acres_per_1k', 'mental_health_per_10k']:
            if old_val < new_val:
                cf_features[idx] = new_val
                changes[feat] = {'from': round(float(old_val), 2), 'to': round(float(new_val), 2)}

    cf_pred = gb.predict([cf_features])[0]
    gain = cf_pred - actual_pred

    counterfactuals.append({
        'geoid': geoid,
        'label': row['label'],
        'actual_life_exp': round(float(row['life_expectancy']), 1),
        'predicted_life_exp': round(float(actual_pred), 1),
        'counterfactual_life_exp': round(float(cf_pred), 1),
        'projected_gain': round(float(gain), 2),
        'changes_applied': changes,
    })
    print(f"  {geoid}: actual={row['life_expectancy']:.1f}, predicted={actual_pred:.1f}, counterfactual={cf_pred:.1f}, gain={gain:+.1f}")

# ─── Step 6E: SHAP-style Feature Contributions ───────────────────────────────

print("\nComputing feature contributions for critical ZIPs...")

shap_contributions = {}
for geoid in critical_zips:
    row = merged[merged['geoid'] == geoid]
    if row.empty:
        continue
    row = row.iloc[0]

    contributions = []
    for feat, importance in rf_importances:
        actual = row[feat] if pd.notna(row[feat]) else county_medians[feat]
        median = county_medians[feat]
        deviation = actual - median
        # Normalize deviation by feature range
        feat_range = merged[feat].max() - merged[feat].min()
        if feat_range > 0:
            norm_deviation = deviation / feat_range
        else:
            norm_deviation = 0
        weighted_contribution = norm_deviation * importance
        contributions.append({
            'feature': feat,
            'actual': round(float(actual), 2),
            'median': round(float(median), 2),
            'deviation': round(float(deviation), 2),
            'importance': round(float(importance), 4),
            'contribution': round(float(weighted_contribution), 4),
        })

    # Sort by absolute contribution
    contributions.sort(key=lambda x: abs(x['contribution']), reverse=True)
    shap_contributions[geoid] = contributions[:10]

# Write enhanced model outputs
feature_importance_output = {
    'random_forest': {
        'importances': [{'feature': f, 'importance': round(float(i), 4)} for f, i in rf_importances],
        'r_squared': round(float(rf_r2), 4),
    },
    'gradient_boosting': {
        'r_squared': round(float(gb_r2), 4),
        'cv_scores': [round(float(s), 4) for s in cv_scores],
        'cv_mean': round(float(cv_scores.mean()), 4),
        'cv_std': round(float(cv_scores.std()), 4),
        'mae': round(float(gb_mae), 2),
    },
    'feature_contributions': shap_contributions,
}

with open(os.path.join(OUT_DIR, 'feature_importance.json'), 'w') as f:
    json.dump(feature_importance_output, f, indent=2)
print("  feature_importance.json")

counterfactual_output = {
    'methodology': 'Gradient Boosting counterfactual: all features where the ZIP is worse than the county median are replaced with median values. Models comprehensive equalization across healthcare access, health behaviors, socioeconomic factors, and environmental conditions.',
    'model_performance': {
        'r_squared': round(float(gb_r2), 4),
        'cv_mean': round(float(cv_scores.mean()), 4),
        'mae': round(float(gb_mae), 2),
    },
    'county_medians': {k: round(v, 2) for k, v in county_medians.items()},
    'counterfactuals': counterfactuals,
}

with open(os.path.join(OUT_DIR, 'counterfactual_analysis.json'), 'w') as f:
    json.dump(counterfactual_output, f, indent=2)
print("  counterfactual_analysis.json")

print("\n✓ Pipeline complete! All JSON files written to", OUT_DIR)
print(f"  Total ZIP codes processed: {len(merged)}")
print(f"  Life expectancy range: {merged['life_expectancy'].min():.1f} - {merged['life_expectancy'].max():.1f}")
print(f"  RDCS range: {merged['rdcs'].min():.4f} - {merged['rdcs'].max():.4f}")
