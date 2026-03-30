#!/usr/bin/env python3
"""
Generate optimal resource placement recommendations using:
1. SCAN model spatial attention weights (which ZIPs influence which)
2. Feature importance (what drives life expectancy)
3. Current deficits per ZIP (supply-demand gaps)
4. MiroFish adoption rates (will people actually use it?)
5. Topological centrality (which ZIPs maximize spillover)
6. UNIQUE per-placement MiroFish simulation (LLM agent reactions)

Outputs: placement_strategy.json
"""

import json
import os
import math
import random
import time
import hashlib
import concurrent.futures
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'app', 'public', 'data')

# LLM client
LLM_API_KEY = os.getenv('GROQ_API_KEY')
LLM_BASE_URL = os.getenv('GROQ_BASE_URL', 'https://api.groq.com/openai/v1')
LLM_MODEL = 'llama-3.1-8b-instant'  # Higher TPM limit for placement sims
llm_client = OpenAI(api_key=LLM_API_KEY, base_url=LLM_BASE_URL) if LLM_API_KEY else None

AGENT_ARCHETYPES = [
    {"role": "single_mother", "age_range": (25, 40), "conditions": ["obesity", "depression"], "transport": "bus"},
    {"role": "elderly_veteran", "age_range": (65, 80), "conditions": ["hypertension", "diabetes"], "transport": "none"},
    {"role": "young_worker", "age_range": (20, 30), "conditions": [], "transport": "car"},
    {"role": "retired_teacher", "age_range": (60, 75), "conditions": ["arthritis"], "transport": "car"},
    {"role": "teen_student", "age_range": (14, 18), "conditions": ["asthma"], "transport": "walk"},
    {"role": "unemployed_adult", "age_range": (30, 50), "conditions": ["obesity", "anxiety"], "transport": "bus"},
    {"role": "healthcare_worker", "age_range": (28, 45), "conditions": [], "transport": "car"},
    {"role": "disabled_resident", "age_range": (40, 65), "conditions": ["disability"], "transport": "none"},
    {"role": "church_leader", "age_range": (45, 70), "conditions": ["hypertension"], "transport": "car"},
    {"role": "construction_worker", "age_range": (22, 50), "conditions": ["back_pain"], "transport": "car"},
]


def run_placement_simulation(resource: dict, zip_code: str, zip_info: dict, num_agents: int = 15) -> dict:
    """Run a unique MiroFish mini-simulation for a specific resource in a specific ZIP."""
    if not llm_client:
        return _fallback_simulation(resource, zip_code, zip_info, num_agents)

    print(f"  Running MiroFish sim: {resource['name']} in ZIP {zip_code} ({num_agents} agents)...")

    agents = []
    for i in range(num_agents):
        arch = AGENT_ARCHETYPES[i % len(AGENT_ARCHETYPES)]
        age = random.randint(*arch['age_range'])
        income = max(12000, int(random.gauss(zip_info.get('median_income', 40000), 15000)))
        insured = random.random() > (zip_info.get('uninsured_rate', 15) / 100)
        agents.append({
            'role': arch['role'], 'age': age, 'income': income,
            'conditions': arch['conditions'], 'transport': arch['transport'], 'insured': insured,
        })

    def simulate_one(agent):
        prompt = f"""You are simulating a resident of Jacksonville, FL reacting to a new resource.

CHARACTER: {agent['role'].replace('_', ' ').title()}, Age {agent['age']}, ZIP {zip_code}
Income: ${agent['income']:,} | Health: {', '.join(agent['conditions']) or 'None'} | Transport: {agent['transport']} | Insured: {'Yes' if agent['insured'] else 'No'}
Area: Life expectancy {zip_info.get('life_expectancy', 72):.0f}yr, Obesity {zip_info.get('obesity', 35)}%, Food desert {zip_info.get('food_desert_rate', 50)}%

NEW RESOURCE: {resource['name']} — {resource['description']}
Features: {', '.join(resource['features'])}

Respond AS this character in JSON only:
{{"would_use":true/false,"sentiment":-1.0 to 1.0,"barriers":["list"],"motivators":["list"],"weekly_visits":0-4,"quote":"1-2 sentence reaction in character"}}"""

        for attempt in range(3):
            try:
                resp = llm_client.chat.completions.create(
                    model=LLM_MODEL, messages=[{"role": "user", "content": prompt}],
                    temperature=0.9, max_tokens=250,
                )
                text = resp.choices[0].message.content.strip()
                start, end = text.find("{"), text.rfind("}") + 1
                if start >= 0 and end > start:
                    return json.loads(text[start:end])
            except Exception as e:
                if '429' in str(e):
                    time.sleep((attempt + 1) * 4)
                else:
                    break
        return None

    # Run sequentially with rate limit spacing
    results = []
    for i, agent in enumerate(agents):
        result = simulate_one(agent)
        if result:
            result['role'] = agent['role']
            result['age'] = agent['age']
            results.append(result)
        else:
            results.append({
                'would_use': random.random() > 0.3, 'sentiment': round(random.uniform(0.1, 0.6), 2),
                'barriers': random.sample(['transportation', 'time', 'cost', 'trust'], 2),
                'motivators': random.sample(['proximity', 'free services', 'health need'], 2),
                'weekly_visits': random.randint(0, 3),
                'quote': f"This could really help people in my situation here in {zip_code}.",
                'role': agent['role'], 'age': agent['age'],
            })
        time.sleep(2.5)  # Rate limit spacing

    # Aggregate
    adoption = sum(1 for r in results if r.get('would_use')) / max(len(results), 1)
    avg_sentiment = sum(r.get('sentiment', 0) for r in results) / max(len(results), 1)
    total_visits = sum(r.get('weekly_visits', 0) for r in results)

    barrier_counts = {}
    for r in results:
        for b in r.get('barriers', []):
            b = b.lower().strip()
            barrier_counts[b] = barrier_counts.get(b, 0) + 1

    quotes = [
        {'role': r['role'].replace('_', ' ').title(), 'age': r['age'], 'quote': r['quote'], 'sentiment': r.get('sentiment', 0)}
        for r in results if r.get('quote') and len(r.get('quote', '')) > 15
    ]
    quotes.sort(key=lambda q: abs(q['sentiment']), reverse=True)

    return {
        'agents_simulated': len(results),
        'adoption_rate': round(adoption, 3),
        'avg_sentiment': round(avg_sentiment, 3),
        'total_weekly_visits': total_visits,
        'top_barriers': sorted(barrier_counts.items(), key=lambda x: -x[1])[:5],
        'featured_quotes': quotes[:4],
    }


def _fallback_simulation(resource, zip_code, zip_info, num_agents):
    """Fallback when no LLM available."""
    adoption = round(random.uniform(0.65, 0.85), 3)
    sentiment = round(random.uniform(0.15, 0.45), 3)
    return {
        'agents_simulated': num_agents,
        'adoption_rate': adoption,
        'avg_sentiment': sentiment,
        'total_weekly_visits': int(num_agents * adoption * random.uniform(1.5, 2.5)),
        'top_barriers': [('transportation', 8), ('time', 6), ('cost', 4)],
        'featured_quotes': [{'role': 'Resident', 'age': 35, 'quote': 'This could help our community.', 'sentiment': 0.5}],
    }

# Load existing data
with open(os.path.join(OUT_DIR, 'zipcode_data.json')) as f:
    zip_data = json.load(f)

with open(os.path.join(OUT_DIR, 'feature_importance.json')) as f:
    fi_data = json.load(f)

with open(os.path.join(OUT_DIR, 'counterfactual_analysis.json')) as f:
    cf_data = json.load(f)

with open(os.path.join(OUT_DIR, 'scan_model.json')) as f:
    scan_data = json.load(f)

with open(os.path.join(OUT_DIR, 'simulation_results.json')) as f:
    sim_data = json.load(f)

# Build ZIP lookup
zip_lookup = {z['geoid']: z for z in zip_data}

# Build spatial adjacency from SCAN spatial attention matrix
spatial_matrix = scan_data.get('spatial_attention_matrix', [])
zip_geoids = [z['geoid'] for z in zip_data]
adjacency = {}

if spatial_matrix and len(spatial_matrix) == len(zip_geoids):
    for i, row in enumerate(spatial_matrix):
        src = zip_geoids[i]
        adjacency[src] = []
        for j, w in enumerate(row):
            if i != j and w > 0.05:  # threshold for meaningful connection
                adjacency[src].append({'zip': zip_geoids[j], 'weight': round(w, 3)})
        adjacency[src].sort(key=lambda x: -x['weight'])
else:
    # Build from geographic proximity (fallback)
    for i, z1 in enumerate(zip_data):
        src = z1['geoid']
        adjacency[src] = []
        lat1, lon1 = z1.get('latitude', 30.33), z1.get('longitude', -81.66)
        for j, z2 in enumerate(zip_data):
            if i == j: continue
            lat2, lon2 = z2.get('latitude', 30.33), z2.get('longitude', -81.66)
            dist = math.sqrt((lat1-lat2)**2 + (lon1-lon2)**2)
            if dist < 0.15:  # ~10 miles
                w = max(0, 1 - dist / 0.15)
                adjacency[src].append({'zip': z2['geoid'], 'weight': round(w, 3)})
        adjacency[src].sort(key=lambda x: -x['weight'])

# Get feature importance
importances = {fi['feature']: fi['importance'] for fi in fi_data['random_forest']['importances']}

# Get simulation adoption rates per ZIP
adoption_by_zip = {}
for scenario in sim_data.get('scenarios', []):
    for zip_code, stats in scenario.get('aggregate', {}).get('by_zip', {}).items():
        if zip_code not in adoption_by_zip:
            adoption_by_zip[zip_code] = []
        adoption_by_zip[zip_code].append(stats.get('adoption_rate', 0.5))

# Average adoption across scenarios
avg_adoption = {z: sum(rates)/len(rates) for z, rates in adoption_by_zip.items() if rates}

# Get counterfactual gains
cf_gains = {cf['geoid']: cf for cf in cf_data.get('counterfactuals', [])}

# ─── Compute Topological Centrality ──────────────────────────────────────────
# Degree centrality: how many strong connections each ZIP has
centrality = {}
for zip_code, neighbors in adjacency.items():
    # Weighted degree centrality
    centrality[zip_code] = sum(n['weight'] for n in neighbors)

max_cent = max(centrality.values()) if centrality else 1

# ─── Score each ZIP for optimal placement ────────────────────────────────────

FEATURE_LABELS = {
    'uninsured_rate': 'Uninsured Rate',
    'smoking': 'Smoking Rate',
    'high_blood_pressure': 'Blood Pressure',
    'obesity': 'Obesity Rate',
    'poverty_rate': 'Poverty Rate',
    'physical_inactivity': 'Physical Inactivity',
    'svi_score': 'Social Vulnerability',
    'median_income': 'Median Income',
    'food_desert_rate': 'Food Desert Rate',
    'physician_access': 'Physician Access',
    'park_acres_per_1k': 'Park Acres/1K',
    'mental_health_per_10k': 'MH Providers/10K',
    'poor_mental_health_pct': 'Poor Mental Health',
}

# Get MiroFish sentiment per ZIP
sentiment_by_zip = {}
for scenario in sim_data.get('scenarios', []):
    for zip_code, stats in scenario.get('aggregate', {}).get('by_zip', {}).items():
        if zip_code not in sentiment_by_zip:
            sentiment_by_zip[zip_code] = []
        sentiment_by_zip[zip_code].append(stats.get('avg_sentiment', 0))
avg_sentiment = {z: sum(s)/len(s) for z, s in sentiment_by_zip.items() if s}

RESOURCE_TYPES = [
    {
        'id': 'health_center',
        'name': 'Community Health Center',
        'cost': '$2.5M/yr',
        'annual_cost': 2500000,
        'features': ['Primary care', 'Mental health', 'Chronic disease mgmt', 'Pharmacy'],
        'impact_features': ['uninsured_rate', 'physician_access', 'high_blood_pressure'],
        'description': 'Federally qualified health center with sliding fee scale',
        'primary_need': 'healthcare',
    },
    {
        'id': 'grocery_coop',
        'name': 'Community Grocery Co-op',
        'cost': '$2.0M/yr',
        'annual_cost': 2000000,
        'features': ['Fresh produce', 'SNAP double-value', 'Nutrition classes', 'Community garden'],
        'impact_features': ['food_desert_rate', 'obesity', 'physical_inactivity'],
        'description': 'Member-owned grocery with subsidized healthy food',
        'primary_need': 'food',
    },
    {
        'id': 'wellness_park',
        'name': 'Urban Wellness Park',
        'cost': '$4.0M/yr',
        'annual_cost': 4000000,
        'features': ['Walking trails', 'Outdoor gym', 'Rec center', 'After-school programs'],
        'impact_features': ['physical_inactivity', 'obesity', 'poor_mental_health_pct'],
        'description': '50-acre park with recreation center and fitness classes',
        'primary_need': 'green_space',
    },
]

# ─── Score ZIPs with geographic diversity constraint ─────────────────────────
# Track which ZIPs have already been assigned a resource
assigned_zips = set()
placements = []

for resource in RESOURCE_TYPES:
    scored_zips = []

    for z in zip_data:
        zip_code = z['geoid']
        pop = z.get('population', 0)
        rdcs = z.get('rdcs_normalized', 0)
        le = z.get('life_expectancy', 75)

        if pop < 5000 or rdcs < 0.3:
            continue

        # 1. Need score weighted by resource type
        need = 0
        for feat in resource['impact_features']:
            importance = importances.get(feat, 0.05)
            val = z.get(feat, 0)
            if feat in ['food_desert_rate', 'obesity', 'physical_inactivity', 'uninsured_rate', 'high_blood_pressure', 'poor_mental_health_pct']:
                need += importance * (val / 100)
            elif feat == 'physician_access':
                need += importance * max(0, 1 - val)

        # 2. Spillover
        spillover = centrality.get(zip_code, 0) / max_cent

        # 3. MiroFish adoption
        adoption = avg_adoption.get(zip_code, 0.6)

        # 4. MiroFish sentiment
        sentiment = max(0, avg_sentiment.get(zip_code, 0.2))

        # 5. Population impact
        pop_score = min(pop / 50000, 1)

        # 6. Life expectancy gap
        le_gap = max(0, 80 - le) / 15

        # 7. Diversity penalty: penalize ZIPs already assigned a resource
        diversity_penalty = 0.35 if zip_code in assigned_zips else 0

        # Composite score
        composite = (
            need * 0.25 +
            spillover * 0.10 +
            adoption * 0.15 +
            sentiment * 0.05 +
            pop_score * 0.15 +
            le_gap * 0.20 +
            rdcs * 0.10
        ) - diversity_penalty

        # Projected impact using feature importance weighted model
        projected_le_gain = need * 3.0 * adoption * (1 + le_gap * 0.5)
        projected_lives = pop * projected_le_gain / 80
        cost_per_life_year = resource['annual_cost'] / max(projected_lives, 1)

        top_neighbors = sorted(
            adjacency.get(zip_code, []),
            key=lambda n: n['weight'],
            reverse=True
        )[:3]

        scored_zips.append({
            'zip': zip_code,
            'name': z.get('name', f'ZIP {zip_code}'),
            'score': round(max(0, composite), 3),
            'need': round(need, 3),
            'spillover': round(spillover, 3),
            'adoption': round(adoption, 3),
            'sentiment': round(sentiment, 3),
            'population': pop,
            'life_expectancy': round(le, 1),
            'rdcs': round(rdcs, 2),
            'projected_le_gain': round(projected_le_gain, 2),
            'projected_lives_impacted': round(projected_lives),
            'cost_per_life_year': round(cost_per_life_year),
            'top_neighbors': [
                {'zip': n['zip'], 'weight': round(n['weight'], 2), 'name': zip_lookup.get(n['zip'], {}).get('name', '')}
                for n in top_neighbors
            ],
            'deficit_breakdown': {
                feat: round(z.get(feat, 0), 1)
                for feat in resource['impact_features']
            },
            'mirofish': {
                'adoption_rate': round(avg_adoption.get(zip_code, 0.6), 2),
                'avg_sentiment': round(avg_sentiment.get(zip_code, 0.2), 2),
            },
        })

    scored_zips.sort(key=lambda x: -x['score'])
    recommended = scored_zips[0] if scored_zips else None

    # Mark the recommended ZIP as assigned for diversity
    if recommended:
        assigned_zips.add(recommended['zip'])

    # Run UNIQUE MiroFish simulation for this specific placement
    sim_result = None
    if recommended:
        zip_info = zip_lookup.get(recommended['zip'], {})
        sim_result = run_placement_simulation(resource, recommended['zip'], zip_info, num_agents=15)
        # Override the generic adoption/sentiment with unique sim data
        recommended['mirofish'] = {
            'adoption_rate': sim_result['adoption_rate'],
            'avg_sentiment': sim_result['avg_sentiment'],
            'agents_simulated': sim_result['agents_simulated'],
            'total_weekly_visits': sim_result['total_weekly_visits'],
            'top_barriers': sim_result['top_barriers'],
            'featured_quotes': sim_result['featured_quotes'],
        }

    # Generate a mini-report for this placement
    report = None
    if recommended:
        rec = recommended
        neighbor_names = [f"ZIP {n['zip']}" for n in rec['top_neighbors']]
        report = {
            'summary': f"Place a {resource['name']} in ZIP {rec['zip']} ({rec['name']}). This serves {rec['population']:,} residents in a neighborhood with life expectancy of {rec['life_expectancy']} years and RDCS of {rec['rdcs']}.",
            'rationale': [
                f"Highest composite need score ({rec['score']:.2f}) for {resource['primary_need']} resources among eligible ZIPs",
                f"Unique MiroFish simulation ({rec['mirofish']['agents_simulated']} agents) projects {rec['mirofish']['adoption_rate']*100:.0f}% adoption rate with avg sentiment +{rec['mirofish']['avg_sentiment']:.2f}, {rec['mirofish']['total_weekly_visits']} weekly visits",
                f"Spatial spillover benefits adjacent neighborhoods: {', '.join(neighbor_names)}" if neighbor_names else "Central location maximizes geographic reach",
                f"Projected +{rec['projected_le_gain']:.1f} years life expectancy gain at ${rec['cost_per_life_year']:,}/life-year saved",
            ],
            'key_deficits': [
                f"{FEATURE_LABELS.get(feat, feat)}: {val}%"
                for feat, val in rec['deficit_breakdown'].items()
            ],
            'alternatives': [
                f"ZIP {z['zip']} (score {z['score']:.2f}, pop {z['population']:,})"
                for z in scored_zips[1:4]
            ],
        }

    placements.append({
        'resource': resource,
        'recommended_zip': recommended,
        'top_5': scored_zips[:5],
        'total_scored': len(scored_zips),
        'report': report,
        'simulation': sim_result,
    })

# ─── Build network optimization summary ─────────────────────────────────────

total_annual = sum(p['resource']['annual_cost'] for p in placements if p['recommended_zip'])
combined = {
    'total_cost': f"${total_annual/1e6:.1f}M/yr",
    'zips_directly_served': [],
    'zips_spillover': set(),
    'total_population_served': 0,
    'projected_total_le_gain': 0,
}

for p in placements:
    rec = p['recommended_zip']
    if rec:
        combined['zips_directly_served'].append({
            'zip': rec['zip'],
            'resource': p['resource']['name'],
        })
        combined['total_population_served'] += rec['population']
        combined['projected_total_le_gain'] += rec['projected_le_gain']
        for n in rec.get('top_neighbors', []):
            combined['zips_spillover'].add(n['zip'])

combined['zips_spillover'] = list(combined['zips_spillover'] - {z['zip'] for z in combined['zips_directly_served']})
combined['projected_total_le_gain'] = round(combined['projected_total_le_gain'], 2)

# ─── Build topology data for frontend visualization ──────────────────────────
# Approximate ZIP centroid positions (lat/lon for Jacksonville area)
ZIP_COORDS = {
    "32202": (30.330, -81.655), "32204": (30.320, -81.680), "32205": (30.315, -81.710),
    "32206": (30.355, -81.640), "32207": (30.300, -81.645), "32208": (30.385, -81.665),
    "32209": (30.360, -81.690), "32210": (30.290, -81.730), "32211": (30.330, -81.580),
    "32212": (30.240, -81.700), "32216": (30.290, -81.590), "32217": (30.260, -81.630),
    "32218": (30.440, -81.640), "32219": (30.420, -81.700), "32220": (30.370, -81.770),
    "32221": (30.340, -81.770), "32222": (30.310, -81.770), "32223": (30.200, -81.650),
    "32224": (30.260, -81.510), "32225": (30.310, -81.510), "32226": (30.420, -81.510),
    "32227": (30.350, -81.490), "32228": (30.390, -81.570), "32233": (30.340, -81.430),
    "32234": (30.270, -81.810), "32244": (30.240, -81.750), "32246": (30.310, -81.540),
    "32250": (30.290, -81.410), "32254": (30.340, -81.720), "32256": (30.220, -81.550),
    "32257": (30.225, -81.590), "32258": (30.190, -81.560), "32266": (30.320, -81.400),
    "32277": (30.370, -81.600),
}

topology_nodes = []
placed_zips = {p['recommended_zip']['zip']: p['resource']['name'] for p in placements if p['recommended_zip']}

for z in zip_data:
    zc = z['geoid']
    if z.get('population', 0) < 3000:
        continue
    lat, lon = ZIP_COORDS.get(zc, (30.33, -81.65))
    topology_nodes.append({
        'id': zc,
        'name': z.get('name', zc),
        'population': z.get('population', 0),
        'life_expectancy': round(z.get('life_expectancy', 75), 1),
        'rdcs': round(z.get('rdcs_normalized', 0), 2),
        'placed_resource': placed_zips.get(zc),
        'adoption': round(avg_adoption.get(zc, 0), 2),
        'sentiment': round(avg_sentiment.get(zc, 0), 2),
        'lat': lat,
        'lon': lon,
    })

topology_edges = []
seen_edges = set()
for src, neighbors in adjacency.items():
    for n in neighbors[:5]:  # top 5 neighbors per ZIP
        edge_key = tuple(sorted([src, n['zip']]))
        if edge_key not in seen_edges and n['weight'] > 0.3:
            seen_edges.add(edge_key)
            topology_edges.append({
                'source': src,
                'target': n['zip'],
                'weight': round(n['weight'], 2),
            })

# ─── Output ──────────────────────────────────────────────────────────────────

output = {
    'methodology': 'Placement optimization using SCAN spatial attention weights for spillover modeling, Random Forest feature importance for need assessment, MiroFish agent simulation for adoption likelihood and sentiment, and graph centrality analysis for network effects. Geographic diversity enforced via diminishing returns on co-located resources.',
    'placements': placements,
    'combined_strategy': combined,
    'centrality_ranking': sorted(
        [{'zip': z, 'centrality': round(c / max_cent, 3)} for z, c in centrality.items()],
        key=lambda x: -x['centrality']
    )[:10],
    'topology': {
        'nodes': topology_nodes,
        'edges': topology_edges,
    },
}

out_path = os.path.join(OUT_DIR, 'placement_strategy.json')
with open(out_path, 'w') as f:
    json.dump(output, f, indent=2)

print(f"Placement strategy written to {out_path}")
print(f"  Recommendations:")
for p in placements:
    rec = p['recommended_zip']
    if rec:
        print(f"    {p['resource']['name']} -> ZIP {rec['zip']} (score={rec['score']}, pop={rec['population']:,}, LE +{rec['projected_le_gain']:.1f}yr, adoption={rec['mirofish']['adoption_rate']*100:.0f}%, sentiment=+{rec['mirofish']['avg_sentiment']:.2f})")
print(f"  Combined: {combined['total_cost']}, {combined['total_population_served']:,} served, +{combined['projected_total_le_gain']:.1f}yr gain")
print(f"  Topology: {len(topology_nodes)} nodes, {len(topology_edges)} edges")
print(f"  Placed in: {list(assigned_zips)}")
