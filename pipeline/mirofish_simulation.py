#!/usr/bin/env python3
"""
MiroFish-Inspired Agent Simulation for JaxBridge — SCALED VERSION
Simulates 200+ Jacksonville residents as AI agents reacting to resource interventions.
Generates force-directed graph data for visualization.

Inspired by MiroFish (github.com/666ghj/MiroFish) — a multi-agent
swarm intelligence engine for counterfactual reasoning.
"""

import json
import os
import time
import random
import math
import hashlib
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'app', 'public', 'data')

client = OpenAI(
    api_key=os.getenv('GROQ_API_KEY'),
    base_url=os.getenv('GROQ_BASE_URL', 'https://api.groq.com/openai/v1'),
)
MODEL = os.getenv('GROQ_MODEL', 'llama-3.1-8b-instant')

# ─── ZIP Code Profiles ────────────────────────────────────────────────────────

ZIP_PROFILES = {
    "32209": {"name": "Northwest Jacksonville", "population": 34657, "median_income": 30514, "life_expectancy": 68.7, "obesity": 48.0, "uninsured": 19.5, "physical_inactivity": 44.0, "black_pct": 88.2, "svi": 0.94, "food_desert_rate": 57.3, "physician_ratio": 219, "mental_health_providers": 54, "parks": 24},
    "32254": {"name": "Westside Jacksonville", "population": 13927, "median_income": 34953, "life_expectancy": 70.6, "obesity": 44.3, "uninsured": 20.1, "physical_inactivity": 40.5, "black_pct": 61.1, "svi": 0.93, "food_desert_rate": 82.1, "physician_ratio": 3482, "mental_health_providers": 90, "parks": 10},
    "32208": {"name": "North Jacksonville", "population": 32699, "median_income": 41324, "life_expectancy": 70.8, "obesity": 45.7, "uninsured": 17.4, "physical_inactivity": 40.7, "black_pct": 75.1, "svi": 0.90, "food_desert_rate": 75.3, "physician_ratio": 991, "mental_health_providers": 72, "parks": 30},
    "32206": {"name": "East Jacksonville", "population": 17105, "median_income": 39242, "life_expectancy": 70.7, "obesity": 46.3, "uninsured": 18.9, "physical_inactivity": 40.9, "black_pct": 65.6, "svi": 0.95, "food_desert_rate": 75.2, "physician_ratio": 815, "mental_health_providers": 21, "parks": 26},
    "32202": {"name": "Downtown Jacksonville", "population": 6023, "median_income": 34825, "life_expectancy": 73.1, "obesity": 47.5, "uninsured": 27.4, "physical_inactivity": 45.4, "black_pct": 50.7, "svi": 0.93, "food_desert_rate": 22.0, "physician_ratio": 354, "mental_health_providers": 33, "parks": 14},
}

AGENT_ARCHETYPES = [
    {"role": "single_mother", "age_range": (25, 40), "conditions": ["obesity", "depression"], "employed": True, "transport": "bus", "color": "#ff6b6b"},
    {"role": "elderly_veteran", "age_range": (65, 80), "conditions": ["hypertension", "diabetes"], "employed": False, "transport": "none", "color": "#ffa94d"},
    {"role": "young_worker", "age_range": (20, 30), "conditions": [], "employed": True, "transport": "car", "color": "#69db7c"},
    {"role": "retired_teacher", "age_range": (60, 75), "conditions": ["arthritis", "high_cholesterol"], "employed": False, "transport": "car", "color": "#748ffc"},
    {"role": "teen_student", "age_range": (14, 18), "conditions": ["asthma"], "employed": False, "transport": "walk", "color": "#da77f2"},
    {"role": "unemployed_adult", "age_range": (30, 50), "conditions": ["obesity", "anxiety"], "employed": False, "transport": "bus", "color": "#ff8787"},
    {"role": "healthcare_worker", "age_range": (28, 45), "conditions": [], "employed": True, "transport": "car", "color": "#38d9a9"},
    {"role": "small_business_owner", "age_range": (35, 55), "conditions": ["hypertension"], "employed": True, "transport": "car", "color": "#4dabf7"},
    {"role": "disabled_resident", "age_range": (40, 65), "conditions": ["disability", "chronic_pain"], "employed": False, "transport": "none", "color": "#e599f7"},
    {"role": "new_immigrant", "age_range": (25, 45), "conditions": [], "employed": True, "transport": "bus", "color": "#ffd43b"},
    {"role": "church_leader", "age_range": (45, 70), "conditions": ["hypertension"], "employed": True, "transport": "car", "color": "#66d9e8"},
    {"role": "construction_worker", "age_range": (22, 50), "conditions": ["back_pain"], "employed": True, "transport": "car", "color": "#a9e34b"},
    {"role": "home_aide", "age_range": (30, 55), "conditions": ["obesity"], "employed": True, "transport": "bus", "color": "#f783ac"},
    {"role": "college_student", "age_range": (18, 24), "conditions": ["anxiety"], "employed": False, "transport": "bus", "color": "#9775fa"},
    {"role": "grandparent_caretaker", "age_range": (55, 75), "conditions": ["diabetes", "arthritis"], "employed": False, "transport": "none", "color": "#ffa8a8"},
]

SCENARIOS = [
    {
        "id": "clinic_32209",
        "title": "New Community Health Center in ZIP 32209",
        "description": "A federally qualified health center opens at the corner of Moncrief Rd and Soutel Dr in ZIP 32209, offering free primary care, mental health counseling, and chronic disease management. The center has a pharmacy, lab, and 10 exam rooms. It accepts all insurance and offers a sliding fee scale for uninsured patients. Hours: Mon-Sat 7AM-7PM. A free shuttle runs from 5 surrounding neighborhoods.",
        "zip": "32209",
        "type": "healthcare",
    },
    {
        "id": "grocery_32254",
        "title": "Community Grocery Co-op in ZIP 32254",
        "description": "A community-owned grocery cooperative opens on Edgewood Ave in ZIP 32254, the worst food desert in Jacksonville. The store stocks fresh produce, lean proteins, and whole grains at subsidized prices. It offers free nutrition workshops, cooking classes, and a community garden. SNAP/EBT accepted with a double-value program for fruits and vegetables. Open daily 6AM-10PM.",
        "zip": "32254",
        "type": "food_access",
    },
    {
        "id": "park_32208",
        "title": "50-Acre Urban Park & Recreation Center in ZIP 32208",
        "description": "A new 50-acre park opens in North Jacksonville (32208) with walking trails, an outdoor gym, basketball courts, a splash pad, a community garden, and a recreation center offering free fitness classes. The park includes a farmers market every Saturday. Free after-school programs for youth. Open dawn to dusk. The rec center is open 6AM-9PM daily.",
        "zip": "32208",
        "type": "green_space",
    },
]

# ─── Agent Generation at Scale ────────────────────────────────────────────────

def generate_agent(zip_code: str, archetype: dict, agent_idx: int) -> dict:
    zip_data = ZIP_PROFILES[zip_code]
    age = random.randint(*archetype["age_range"])
    income = max(10000, int(random.gauss(zip_data["median_income"], zip_data["median_income"] * 0.35)))
    has_insurance = random.random() > (zip_data["uninsured"] / 100)

    # Generate a deterministic "personality" seed
    seed = hashlib.md5(f"{zip_code}_{agent_idx}_{archetype['role']}".encode()).hexdigest()
    openness = int(seed[:2], 16) / 255  # 0-1
    trust = int(seed[2:4], 16) / 255
    health_concern = int(seed[4:6], 16) / 255

    return {
        "agent_id": f"agent_{zip_code}_{agent_idx:04d}",
        "zip_code": zip_code,
        "neighborhood": zip_data["name"],
        "role": archetype["role"].replace("_", " ").title(),
        "age": age,
        "income": income,
        "health_conditions": archetype["conditions"],
        "employed": archetype["employed"],
        "transportation": archetype["transport"],
        "has_insurance": has_insurance,
        "color": archetype["color"],
        "personality": {
            "openness": round(openness, 2),
            "trust": round(trust, 2),
            "health_concern": round(health_concern, 2),
        },
    }


def generate_population(agents_per_zip: int = 40) -> list:
    """Generate a large agent population across all ZIP codes."""
    agents = []
    for zip_code in ZIP_PROFILES:
        for i in range(agents_per_zip):
            arch = AGENT_ARCHETYPES[i % len(AGENT_ARCHETYPES)]
            agent = generate_agent(zip_code, arch, i)
            agents.append(agent)
    return agents


# ─── LLM Simulation for Representative Sample ────────────────────────────────

def simulate_agent_llm(agent: dict, scenario: dict) -> dict:
    """Use LLM to simulate reaction for a representative agent."""
    prompt = f"""You are simulating a resident of Jacksonville, FL for a public health study.

CHARACTER: {agent['role']}, Age {agent['age']}, ZIP {agent['zip_code']} ({agent['neighborhood']})
Income: ${agent['income']:,} | Health: {', '.join(agent['health_conditions']) or 'None'} | Transport: {agent['transportation']} | Insured: {'Yes' if agent['has_insurance'] else 'No'}

SCENARIO: {scenario['description']}

Respond AS this character. Answer in JSON only:
{{"would_use":true/false,"confidence":0.0-1.0,"sentiment":-1.0 to 1.0,"barriers":["list"],"motivators":["list"],"weekly_visits":0-4,"quote":"2-3 sentence in-character response"}}"""

    try:
        resp = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.85, max_tokens=300,
        )
        text = resp.choices[0].message.content.strip()
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            result = json.loads(text[start:end])
            return result
    except Exception as e:
        print(f"      LLM error: {e}")

    # Fallback
    return {
        "would_use": random.random() > 0.25,
        "confidence": round(random.uniform(0.4, 0.9), 2),
        "sentiment": round(random.uniform(0.1, 0.8), 2),
        "barriers": random.sample(["transportation", "time", "trust", "cost", "awareness"], 2),
        "motivators": random.sample(["proximity", "free services", "community", "health need"], 2),
        "weekly_visits": random.randint(0, 3),
        "quote": "I'd consider using it if it's convenient and affordable.",
    }


def extrapolate_behavior(agent: dict, llm_results: dict, scenario: dict) -> dict:
    """Extrapolate behavior for non-LLM agents based on similar profiles."""
    # Find the most similar LLM-simulated agent
    best_match = None
    best_score = -1

    for aid, result in llm_results.items():
        ref = result["agent"]
        score = 0
        if ref["zip_code"] == agent["zip_code"]: score += 3
        if ref["role"] == agent["role"]: score += 2
        if ref["has_insurance"] == agent["has_insurance"]: score += 1
        if ref["transportation"] == agent["transportation"]: score += 1
        if abs(ref["age"] - agent["age"]) < 10: score += 1
        if score > best_score:
            best_score = score
            best_match = result["reaction"]

    if not best_match:
        return {
            "would_use": random.random() > 0.3,
            "sentiment": round(random.uniform(0.2, 0.8), 2),
            "confidence": round(random.uniform(0.4, 0.8), 2),
            "weekly_visits": random.randint(0, 2),
        }

    # Add personality-based variation
    p = agent["personality"]
    sentiment_mod = (p["openness"] - 0.5) * 0.3 + (p["trust"] - 0.5) * 0.2
    base_sentiment = best_match.get("sentiment", 0.5)
    sentiment = max(-1, min(1, base_sentiment + sentiment_mod + random.gauss(0, 0.1)))

    would_use = best_match.get("would_use", True)
    if p["trust"] < 0.3 and random.random() > 0.5:
        would_use = False
    if p["health_concern"] > 0.7 and scenario["type"] == "healthcare":
        would_use = True

    return {
        "would_use": would_use,
        "sentiment": round(sentiment, 2),
        "confidence": round(max(0, min(1, best_match.get("confidence", 0.5) + random.gauss(0, 0.1))), 2),
        "weekly_visits": max(0, min(4, best_match.get("weekly_visits", 1) + random.randint(-1, 1))),
    }


# ─── Graph Data Generation ────────────────────────────────────────────────────

def build_graph_data(agents: list, behaviors: dict) -> dict:
    """Build force-directed graph nodes and links for visualization."""
    nodes = []
    links = []

    # Node types for legend
    node_types = {
        "Single Mother": "#ff6b6b", "Elderly Veteran": "#ffa94d", "Young Worker": "#69db7c",
        "Retired Teacher": "#748ffc", "Teen Student": "#da77f2", "Unemployed Adult": "#ff8787",
        "Healthcare Worker": "#38d9a9", "Small Business Owner": "#4dabf7", "Disabled Resident": "#e599f7",
        "New Immigrant": "#ffd43b", "Church Leader": "#66d9e8", "Construction Worker": "#a9e34b",
        "Home Aide": "#f783ac", "College Student": "#9775fa", "Grandparent Caretaker": "#ffa8a8",
    }

    zip_colors = {
        "32209": "#ff3c00", "32254": "#ff6b35", "32208": "#ff9f1c",
        "32206": "#ffbf69", "32202": "#cbf3f0",
    }

    # Create nodes
    for agent in agents:
        beh = behaviors.get(agent["agent_id"], {})
        sentiment = beh.get("sentiment", 0)
        would_use = beh.get("would_use", True)

        # Position clustering by ZIP (polar coordinates with random spread)
        zip_idx = list(ZIP_PROFILES.keys()).index(agent["zip_code"])
        angle = (zip_idx / len(ZIP_PROFILES)) * 2 * math.pi + random.gauss(0, 0.3)
        radius = 150 + random.gauss(0, 60)

        nodes.append({
            "id": agent["agent_id"],
            "label": f"{agent['role']} ({agent['age']})",
            "role": agent["role"],
            "zip": agent["zip_code"],
            "neighborhood": agent["neighborhood"],
            "age": agent["age"],
            "income": agent["income"],
            "conditions": agent["health_conditions"],
            "transport": agent["transportation"],
            "insured": agent["has_insurance"],
            "sentiment": sentiment,
            "would_use": would_use,
            "confidence": beh.get("confidence", 0.5),
            "visits": beh.get("weekly_visits", 0),
            "color": agent["color"],
            "zipColor": zip_colors.get(agent["zip_code"], "#666"),
            "x": math.cos(angle) * radius,
            "y": math.sin(angle) * radius,
            "val": max(2, 4 + sentiment * 3),  # Node size based on sentiment
        })

    # Create edges
    # 1. Same ZIP proximity (sample, not all pairs)
    agent_by_zip = {}
    for agent in agents:
        agent_by_zip.setdefault(agent["zip_code"], []).append(agent["agent_id"])

    for zip_code, agent_ids in agent_by_zip.items():
        # Connect each agent to 2-3 random neighbors in same ZIP
        for aid in agent_ids:
            neighbors = [n for n in agent_ids if n != aid]
            for neighbor in random.sample(neighbors, min(2, len(neighbors))):
                links.append({
                    "source": aid,
                    "target": neighbor,
                    "type": "proximity",
                    "color": "rgba(255,255,255,0.03)",
                })

    # 2. Shared health conditions (stronger connections)
    condition_groups = {}
    for agent in agents:
        for cond in agent["health_conditions"]:
            condition_groups.setdefault(cond, []).append(agent["agent_id"])

    for cond, agent_ids in condition_groups.items():
        # Connect random pairs sharing a condition
        pairs = min(len(agent_ids) * 2, 50)
        for _ in range(pairs):
            a, b = random.sample(agent_ids, 2)
            links.append({
                "source": a, "target": b,
                "type": "shared_condition",
                "condition": cond,
                "color": "rgba(255,60,0,0.12)",
            })

    # 3. Influence chains (adopters → non-adopters in same ZIP)
    for zip_code, agent_ids in agent_by_zip.items():
        adopters = [a for a in agent_ids if behaviors.get(a, {}).get("would_use")]
        non_adopters = [a for a in agent_ids if not behaviors.get(a, {}).get("would_use")]
        for na in non_adopters:
            if adopters:
                influencer = random.choice(adopters)
                links.append({
                    "source": influencer, "target": na,
                    "type": "influence",
                    "color": "rgba(13,148,136,0.2)",
                })

    # 4. Role-based professional networks
    role_groups = {}
    for agent in agents:
        role_groups.setdefault(agent["role"], []).append(agent["agent_id"])

    for role, agent_ids in role_groups.items():
        if len(agent_ids) > 1:
            for _ in range(min(len(agent_ids), 8)):
                a, b = random.sample(agent_ids, 2)
                links.append({
                    "source": a, "target": b,
                    "type": "role_network",
                    "color": "rgba(255,255,255,0.04)",
                })

    return {
        "nodes": nodes,
        "links": links,
        "nodeTypes": node_types,
        "zipColors": zip_colors,
        "stats": {
            "total_nodes": len(nodes),
            "total_links": len(links),
            "by_zip": {z: len(ids) for z, ids in agent_by_zip.items()},
        }
    }


# ─── Main Simulation ─────────────────────────────────────────────────────────

def run_simulation():
    print("=" * 60)
    print("MIROFISH AGENT SIMULATION — SCALED")
    print(f"Model: {MODEL} via Groq")
    print("=" * 60)

    AGENTS_PER_ZIP = 40  # 40 × 5 ZIPs = 200 agents
    LLM_SAMPLE_PER_ZIP = 6  # 6 × 5 = 30 LLM calls per scenario

    # Generate full population
    print(f"\nGenerating {AGENTS_PER_ZIP * len(ZIP_PROFILES)} agent profiles...")
    all_agents = generate_population(AGENTS_PER_ZIP)
    print(f"  Created {len(all_agents)} agents across {len(ZIP_PROFILES)} ZIP codes")

    all_scenario_results = []

    for scenario in SCENARIOS:
        print(f"\n{'='*60}")
        print(f"SCENARIO: {scenario['title']}")
        print(f"{'='*60}")

        # Select representative sample for LLM
        scenario_zip = scenario["zip"]
        zip_agents = [a for a in all_agents if a["zip_code"] == scenario_zip]
        other_agents = [a for a in all_agents if a["zip_code"] != scenario_zip]

        # Sample diverse archetypes from target ZIP
        llm_sample = []
        seen_roles = set()
        for agent in zip_agents:
            if agent["role"] not in seen_roles and len(llm_sample) < LLM_SAMPLE_PER_ZIP:
                llm_sample.append(agent)
                seen_roles.add(agent["role"])
        # Fill remaining with random from target ZIP
        remaining = [a for a in zip_agents if a not in llm_sample]
        llm_sample.extend(random.sample(remaining, min(LLM_SAMPLE_PER_ZIP - len(llm_sample), len(remaining))))

        # Also sample from other ZIPs (spillover effect)
        for other_zip in [z for z in ZIP_PROFILES if z != scenario_zip]:
            other_zip_agents = [a for a in other_agents if a["zip_code"] == other_zip]
            if other_zip_agents:
                llm_sample.extend(random.sample(other_zip_agents, min(3, len(other_zip_agents))))

        print(f"  LLM sample: {len(llm_sample)} agents")

        # Run LLM simulation on sample
        llm_results = {}
        featured_quotes = []
        for i, agent in enumerate(llm_sample):
            print(f"    [{i+1}/{len(llm_sample)}] {agent['role']} (ZIP {agent['zip_code']}, age {agent['age']})...", end=" ")
            reaction = simulate_agent_llm(agent, scenario)
            llm_results[agent["agent_id"]] = {"agent": agent, "reaction": reaction}
            print(f"sentiment={reaction.get('sentiment', '?')}")

            quote = reaction.get("quote", "")
            if quote and len(quote) > 20:
                featured_quotes.append({
                    "agent_id": agent["agent_id"],
                    "role": agent["role"],
                    "age": agent["age"],
                    "zip": agent["zip_code"],
                    "quote": quote,
                    "sentiment": reaction.get("sentiment", 0),
                    "would_use": reaction.get("would_use", True),
                })

            time.sleep(1.0)  # Rate limit

        # Extrapolate for all other agents
        print(f"  Extrapolating behavior for {len(all_agents) - len(llm_sample)} agents...")
        all_behaviors = {}
        all_barriers = []
        all_motivators = []

        for agent in all_agents:
            if agent["agent_id"] in llm_results:
                beh = llm_results[agent["agent_id"]]["reaction"]
            else:
                beh = extrapolate_behavior(agent, llm_results, scenario)

            all_behaviors[agent["agent_id"]] = beh
            all_barriers.extend(beh.get("barriers", []))
            all_motivators.extend(beh.get("motivators", []))

        # Compute aggregates
        adoption_count = sum(1 for b in all_behaviors.values() if b.get("would_use"))
        adoption_rate = adoption_count / len(all_behaviors)
        avg_sentiment = sum(b.get("sentiment", 0) for b in all_behaviors.values()) / len(all_behaviors)
        total_visits = sum(b.get("weekly_visits", 0) for b in all_behaviors.values())

        barrier_counts = {}
        for b in all_barriers:
            b = b.lower().strip()
            barrier_counts[b] = barrier_counts.get(b, 0) + 1

        motivator_counts = {}
        for m in all_motivators:
            m = m.lower().strip()
            motivator_counts[m] = motivator_counts.get(m, 0) + 1

        print(f"  Results: adoption={adoption_rate:.0%}, sentiment={avg_sentiment:.2f}, visits={total_visits}/week")

        # Build graph for this scenario
        graph = build_graph_data(all_agents, all_behaviors)

        all_scenario_results.append({
            "scenario": scenario,
            "num_agents": len(all_agents),
            "num_llm_simulated": len(llm_sample),
            "aggregate": {
                "adoption_rate": round(adoption_rate, 3),
                "avg_sentiment": round(avg_sentiment, 3),
                "total_weekly_visits": total_visits,
                "top_barriers": sorted(barrier_counts.items(), key=lambda x: -x[1])[:8],
                "top_motivators": sorted(motivator_counts.items(), key=lambda x: -x[1])[:8],
                "by_zip": {},
            },
            "featured_quotes": sorted(featured_quotes, key=lambda q: abs(q["sentiment"]), reverse=True)[:12],
            "graph": graph,
        })

        # Per-ZIP breakdown
        for zip_code in ZIP_PROFILES:
            zip_beh = {aid: b for aid, b in all_behaviors.items() if aid.startswith(f"agent_{zip_code}_")}
            if zip_beh:
                zip_adopt = sum(1 for b in zip_beh.values() if b.get("would_use")) / len(zip_beh)
                zip_sent = sum(b.get("sentiment", 0) for b in zip_beh.values()) / len(zip_beh)
                all_scenario_results[-1]["aggregate"]["by_zip"][zip_code] = {
                    "agents": len(zip_beh),
                    "adoption_rate": round(zip_adopt, 3),
                    "avg_sentiment": round(zip_sent, 3),
                }

    # Write output
    output = {
        "engine": "MiroFish-Inspired Multi-Agent Swarm Simulation",
        "model": MODEL,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "total_agents": len(all_agents),
        "methodology": {
            "description": f"{len(all_agents)} AI agents with distinct personas simulate Jacksonville residents reacting to resource interventions. {len(llm_sample)} representative agents are simulated via LLM (Groq/Llama-3.1-8b), and behavior is extrapolated to the full population using personality-weighted similarity matching.",
            "inspiration": "MiroFish (github.com/666ghj/MiroFish) — multi-agent swarm intelligence engine for counterfactual prediction.",
            "agent_generation": f"15 archetypal roles × {AGENTS_PER_ZIP} agents per ZIP × {len(ZIP_PROFILES)} ZIP codes. Personality traits (openness, trust, health_concern) derived from deterministic hashing for reproducibility.",
            "graph_construction": "Nodes represent agents; edges encode proximity (same ZIP), shared health conditions, influence chains (adopter → non-adopter), and professional role networks.",
            "limitations": [
                "LLM responses are synthetic approximations of human behavior",
                f"Only {len(llm_sample)} of {len(all_agents)} agents directly simulated via LLM; rest extrapolated",
                "Agent profiles are ZIP-level composites, not individual-level data",
                "Personality traits are synthetically generated, not measured",
                "Extrapolation assumes similar profiles yield similar behaviors",
            ],
        },
        "scenarios": all_scenario_results,
    }

    out_path = os.path.join(OUT_DIR, 'simulation_results.json')
    with open(out_path, 'w') as f:
        json.dump(output, f)  # No indent to save space

    print(f"\n{'='*60}")
    print(f"✓ Simulation complete!")
    print(f"  Total agents: {len(all_agents)}")
    print(f"  LLM calls: {len(llm_sample) * len(SCENARIOS)}")
    print(f"  Output: {out_path} ({os.path.getsize(out_path) / 1024:.0f} KB)")
    for r in all_scenario_results:
        a = r["aggregate"]
        print(f"  {r['scenario']['title']}: adoption={a['adoption_rate']:.0%}, sentiment={a['avg_sentiment']:.2f}, graph={r['graph']['stats']['total_nodes']} nodes/{r['graph']['stats']['total_links']} links")
    print(f"{'='*60}")


if __name__ == "__main__":
    run_simulation()
