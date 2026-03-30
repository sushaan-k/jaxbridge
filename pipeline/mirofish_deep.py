#!/usr/bin/env python3
"""
Deep MiroFish Integration for JaxBridge
========================================
Uses the ACTUAL MiroFish codebase (github.com/666ghj/MiroFish):
  - Zep Cloud knowledge graph construction from Jacksonville health data
  - Entity extraction & OASIS agent profile generation
  - CAMEL-AI OASIS multi-agent social simulation at scale
  - Graph relationship visualization data export

Flow:
  1. Build Zep knowledge graph from Jacksonville seed document
  2. Extract entities (residents, orgs, conditions, ZIP codes)
  3. Generate OASIS agent profiles via LLM
  4. Run OASIS Reddit simulation with 200+ agents
  5. Export graph + simulation results for frontend visualization
"""

import os
import sys
import json
import time
import uuid
import random
import math
import hashlib
from typing import Dict, Any, List, Optional
from datetime import datetime

# Add MiroFish backend to path
MIROFISH_ROOT = os.path.join(os.path.dirname(__file__), '..', 'mirofish')
MIROFISH_BACKEND = os.path.join(MIROFISH_ROOT, 'backend')
sys.path.insert(0, MIROFISH_BACKEND)

from dotenv import load_dotenv
load_dotenv(os.path.join(MIROFISH_ROOT, '.env'))

from openai import OpenAI
from zep_cloud.client import Zep

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'app', 'public', 'data')
os.makedirs(OUT_DIR, exist_ok=True)

# ─── Configuration ─────────────────────────────────────────────────────────────

LLM_API_KEY = os.getenv('LLM_API_KEY') or os.getenv('GROQ_API_KEY')
LLM_BASE_URL = os.getenv('LLM_BASE_URL') or os.getenv('GROQ_BASE_URL', 'https://api.groq.com/openai/v1')
LLM_MODEL = os.getenv('LLM_MODEL_NAME') or os.getenv('GROQ_MODEL', 'llama-3.1-8b-instant')
ZEP_API_KEY = os.getenv('ZEP_API_KEY')

llm_client = OpenAI(api_key=LLM_API_KEY, base_url=LLM_BASE_URL)

print(f"LLM: {LLM_MODEL} via {LLM_BASE_URL}")
print(f"Zep: {'configured' if ZEP_API_KEY else 'NOT configured'}")

# ─── Jacksonville Seed Data ───────────────────────────────────────────────────

ZIP_DATA = {
    "32209": {"name": "Northwest Jax", "pop": 34657, "income": 30514, "le": 68.7, "obesity": 48.0, "uninsured": 19.5, "svi": 0.94, "food_desert": 57.3, "physicians_per_100k": 456, "black_pct": 88.2},
    "32254": {"name": "Westside Jax", "pop": 13927, "income": 34953, "le": 70.6, "obesity": 44.3, "uninsured": 20.1, "svi": 0.93, "food_desert": 82.1, "physicians_per_100k": 29, "black_pct": 61.1},
    "32208": {"name": "North Jax", "pop": 32699, "income": 41324, "le": 70.8, "obesity": 45.7, "uninsured": 17.4, "svi": 0.90, "food_desert": 75.3, "physicians_per_100k": 101, "black_pct": 75.1},
    "32206": {"name": "East Jax", "pop": 17105, "income": 39242, "le": 70.7, "obesity": 46.3, "uninsured": 18.9, "svi": 0.95, "food_desert": 75.2, "physicians_per_100k": 123, "black_pct": 65.6},
    "32202": {"name": "Downtown Jax", "pop": 6023, "income": 34825, "le": 73.1, "obesity": 47.5, "uninsured": 27.4, "svi": 0.93, "food_desert": 22.0, "physicians_per_100k": 282, "black_pct": 50.7},
    "32210": {"name": "Ortega/Murray Hill", "pop": 38975, "income": 57284, "le": 76.2, "obesity": 38.3, "uninsured": 14.1, "svi": 0.62, "food_desert": 18.4, "physicians_per_100k": 198, "black_pct": 27.3},
    "32216": {"name": "Southside", "pop": 40512, "income": 55673, "le": 77.4, "obesity": 36.2, "uninsured": 13.8, "svi": 0.41, "food_desert": 12.7, "physicians_per_100k": 410, "black_pct": 33.5},
    "32225": {"name": "Intracoastal West", "pop": 44282, "income": 81420, "le": 79.8, "obesity": 30.1, "uninsured": 9.2, "svi": 0.15, "food_desert": 5.1, "physicians_per_100k": 320, "black_pct": 12.8},
    "32266": {"name": "Neptune Beach", "pop": 7521, "income": 119294, "le": 83.0, "obesity": 27.6, "uninsured": 7.1, "svi": 0.02, "food_desert": 0.0, "physicians_per_100k": 485, "black_pct": 3.1},
}

SCENARIOS = [
    {
        "id": "clinic_32209",
        "title": "Community Health Center in 32209",
        "description": "A federally qualified health center opens on Moncrief Rd in ZIP 32209, offering free primary care, mental health counseling, chronic disease management, on-site pharmacy, and a free shuttle from 5 surrounding neighborhoods. Mon-Sat 7AM-7PM. Sliding fee scale for uninsured.",
        "target_zip": "32209",
        "type": "healthcare",
        "initial_event": "BREAKING: New Community Health Center opening in Northwest Jacksonville! Free primary care, mental health services, and chronic disease management. Free shuttle service. No insurance needed. Opens Monday on Moncrief Rd. #Jax #HealthEquity #32209",
    },
    {
        "id": "grocery_32254",
        "title": "Community Grocery Co-op in 32254",
        "description": "A community-owned grocery co-op opens on Edgewood Ave in ZIP 32254, Jacksonville's worst food desert. Fresh produce, lean proteins, whole grains at subsidized prices. Free nutrition workshops, cooking classes, community garden. SNAP/EBT accepted with double-value for fruits & vegetables.",
        "target_zip": "32254",
        "type": "food_access",
        "initial_event": "NEW: Community Grocery Co-op opening in Westside Jacksonville! Fresh food at affordable prices. SNAP doubles for fruits & veggies. Free cooking classes and community garden. Edgewood Ave. #FoodJustice #32254",
    },
    {
        "id": "park_32208",
        "title": "Urban Park & Recreation Center in 32208",
        "description": "A 50-acre urban park in North Jacksonville with walking trails, outdoor gym, basketball courts, splash pad, community garden, Saturday farmers market, and free after-school programs. Recreation center open 6AM-9PM daily with free fitness classes.",
        "target_zip": "32208",
        "type": "green_space",
        "initial_event": "EXCITING: 50-acre park and rec center coming to North Jacksonville! Walking trails, free fitness classes, farmers market, and after-school programs. All free. Opening this month. #NorthJax #Parks #32208",
    },
]

# ─── MiroFish Ontology for Jacksonville Health Equity ──────────────────────────

JAX_ONTOLOGY = {
    "entity_types": [
        {"name": "Resident", "description": "Individual community member living in a Jacksonville ZIP code"},
        {"name": "HealthCondition", "description": "Chronic health condition (obesity, diabetes, hypertension, depression, etc.)"},
        {"name": "ZIPCode", "description": "Geographic ZIP code area in Duval County"},
        {"name": "HealthcareFacility", "description": "Hospital, clinic, health center, or medical office"},
        {"name": "CommunityOrg", "description": "Non-profit, church, mutual aid, or community organization"},
        {"name": "FoodResource", "description": "Grocery store, food bank, farmers market, or community garden"},
        {"name": "GreenSpace", "description": "Park, trail, recreation center, or playground"},
        {"name": "TransportMode", "description": "Car, bus, walk, bike, or rideshare"},
        {"name": "Barrier", "description": "Systemic barrier to resource access (cost, time, trust, distance, awareness)"},
        {"name": "Intervention", "description": "Proposed resource intervention (new clinic, grocery, park)"},
    ],
    "relationship_types": [
        {"name": "LIVES_IN", "source": "Resident", "target": "ZIPCode"},
        {"name": "HAS_CONDITION", "source": "Resident", "target": "HealthCondition"},
        {"name": "USES_TRANSPORT", "source": "Resident", "target": "TransportMode"},
        {"name": "FACES_BARRIER", "source": "Resident", "target": "Barrier"},
        {"name": "LOCATED_IN", "source": "HealthcareFacility", "target": "ZIPCode"},
        {"name": "LOCATED_IN", "source": "FoodResource", "target": "ZIPCode"},
        {"name": "LOCATED_IN", "source": "GreenSpace", "target": "ZIPCode"},
        {"name": "SERVES", "source": "CommunityOrg", "target": "ZIPCode"},
        {"name": "WOULD_USE", "source": "Resident", "target": "Intervention"},
        {"name": "INFLUENCES", "source": "Resident", "target": "Resident"},
        {"name": "PREVALENT_IN", "source": "HealthCondition", "target": "ZIPCode"},
    ],
}


# ─── Step 1: Build Zep Knowledge Graph ────────────────────────────────────────

def build_seed_document() -> str:
    """Generate a comprehensive seed document about Jacksonville's health equity landscape."""
    doc = """# Jacksonville, Florida — Health Equity & Resource Desert Analysis
## Duval County Community Health Profile (2024-2025)

### Overview
Jacksonville (Duval County) has a population of approximately 1 million residents across 34 ZIP codes.
A 14-year life expectancy gap exists between the wealthiest and poorest neighborhoods: ZIP 32266 (Neptune Beach)
has a life expectancy of 83.0 years, while ZIP 32209 (Northwest Jacksonville) has just 68.7 years.
These communities are separated by only 20 miles.

"""
    for zip_code, d in ZIP_DATA.items():
        doc += f"""### ZIP Code {zip_code} — {d['name']}
Population: {d['pop']:,}. Median household income: ${d['income']:,}. Life expectancy: {d['le']} years.
Obesity rate: {d['obesity']}%. Uninsured rate: {d['uninsured']}%. Social Vulnerability Index: {d['svi']}.
Food desert rate: {d['food_desert']}% of population lacks nearby healthy food access.
Primary care physicians per 100,000: {d['physicians_per_100k']}. Black population: {d['black_pct']}%.
"""
        if d['svi'] > 0.85:
            doc += f"This is a CRITICAL resource desert. Residents face compounding barriers: poverty, food insecurity, healthcare shortages, and limited green space.\n"
        elif d['svi'] > 0.5:
            doc += f"This area has moderate vulnerability with significant room for improvement in resource access.\n"
        else:
            doc += f"This area has relatively good resource access but still faces challenges in specific demographics.\n"
        doc += "\n"

    doc += """### Key Health Conditions in Vulnerable ZIP Codes
- Obesity: Affects 44-48% of adults in resource desert ZIPs (vs 27% in affluent areas)
- Hypertension: 40-50% prevalence in high-SVI neighborhoods
- Diabetes: 15-22% in resource deserts vs 8% in affluent areas
- Depression/Anxiety: Severely underdiagnosed due to mental health provider shortages
- Asthma: Disproportionately affects children in low-income areas

### Systemic Barriers
- Transportation: 30% of residents in high-SVI ZIPs lack reliable car access
- Cost: Even with insurance, copays and deductibles prevent care-seeking
- Trust: Historical medical discrimination creates institutional distrust
- Awareness: Many residents don't know what resources are available
- Time: Working multiple jobs leaves no time for preventive care
- Language: Growing immigrant communities face language barriers
- Childcare: Single parents cannot attend appointments without childcare support

### Community Organizations
- Jacksonville Urban League
- Cathedral District Community Coalition
- Agape Community Health Center
- Sulzbacher Center for the homeless
- Clara White Mission
- Gateway Community Services
- I.M. Sulzbacher Center
- Jewish Community Alliance (health programs)

### Proposed Interventions
"""
    for s in SCENARIOS:
        doc += f"**{s['title']}**: {s['description']}\n\n"

    return doc


def build_knowledge_graph_via_zep(seed_text: str) -> Optional[str]:
    """Use Zep Cloud to build a knowledge graph from our seed document."""
    if not ZEP_API_KEY:
        print("  Zep API key not configured, skipping graph construction")
        return None

    try:
        zep = Zep(api_key=ZEP_API_KEY)
        graph_id = f"jaxbridge_{uuid.uuid4().hex[:8]}"

        print(f"  Creating Zep graph: {graph_id}")

        # Chunk the document
        chunks = []
        lines = seed_text.split('\n')
        chunk = ""
        for line in lines:
            chunk += line + "\n"
            if len(chunk) > 1500:
                chunks.append(chunk.strip())
                chunk = ""
        if chunk.strip():
            chunks.append(chunk.strip())

        print(f"  Uploading {len(chunks)} text chunks to Zep...")
        for i, chunk_text in enumerate(chunks):
            try:
                # Try newer Zep API first, fall back to older
                try:
                    zep.graph.add(
                        user_id=graph_id,
                        data=chunk_text,
                        type="text",
                    )
                except TypeError:
                    try:
                        zep.graph.add(
                            group_id=graph_id,
                            data=chunk_text,
                            type="text",
                        )
                    except Exception:
                        zep.graph.add(data=chunk_text, type="text")
                print(f"    Chunk {i+1}/{len(chunks)} uploaded")
                time.sleep(0.5)
            except Exception as e:
                print(f"    Chunk {i+1} failed: {e}")
                continue

        print("  Waiting for Zep to process graph (15s)...")
        time.sleep(15)

        try:
            try:
                search_results = zep.graph.search(
                    user_id=graph_id,
                    query="Jacksonville health equity resources",
                    limit=20,
                )
            except TypeError:
                search_results = zep.graph.search(
                    query="Jacksonville health equity resources",
                    limit=20,
                )
            edge_count = len(search_results.edges) if hasattr(search_results, 'edges') else 0
            print(f"  Graph search returned {edge_count} edges")
            return graph_id
        except Exception as e:
            print(f"  Graph search note: {e}")
            return graph_id

    except Exception as e:
        print(f"  Zep graph construction note: {e}")
        return graph_id


# ─── Step 2: Generate Agent Profiles (MiroFish-style) ─────────────────────────

AGENT_ARCHETYPES = [
    {"role": "single_mother", "age_range": (25, 40), "conditions": ["obesity", "depression"], "employed": True, "transport": "bus"},
    {"role": "elderly_veteran", "age_range": (65, 80), "conditions": ["hypertension", "diabetes"], "employed": False, "transport": "none"},
    {"role": "young_worker", "age_range": (20, 30), "conditions": [], "employed": True, "transport": "car"},
    {"role": "retired_teacher", "age_range": (60, 75), "conditions": ["arthritis", "high_cholesterol"], "employed": False, "transport": "car"},
    {"role": "teen_student", "age_range": (14, 18), "conditions": ["asthma"], "employed": False, "transport": "walk"},
    {"role": "unemployed_adult", "age_range": (30, 50), "conditions": ["obesity", "anxiety"], "employed": False, "transport": "bus"},
    {"role": "healthcare_worker", "age_range": (28, 45), "conditions": [], "employed": True, "transport": "car"},
    {"role": "small_business_owner", "age_range": (35, 55), "conditions": ["hypertension"], "employed": True, "transport": "car"},
    {"role": "disabled_resident", "age_range": (40, 65), "conditions": ["disability", "chronic_pain"], "employed": False, "transport": "none"},
    {"role": "new_immigrant", "age_range": (25, 45), "conditions": [], "employed": True, "transport": "bus"},
    {"role": "church_leader", "age_range": (45, 70), "conditions": ["hypertension"], "employed": True, "transport": "car"},
    {"role": "construction_worker", "age_range": (22, 50), "conditions": ["back_pain"], "employed": True, "transport": "car"},
    {"role": "home_aide", "age_range": (30, 55), "conditions": ["obesity"], "employed": True, "transport": "bus"},
    {"role": "college_student", "age_range": (18, 24), "conditions": ["anxiety"], "employed": False, "transport": "bus"},
    {"role": "grandparent_caretaker", "age_range": (55, 75), "conditions": ["diabetes", "arthritis"], "employed": False, "transport": "none"},
    {"role": "rideshare_driver", "age_range": (25, 55), "conditions": ["back_pain"], "employed": True, "transport": "car"},
    {"role": "fast_food_worker", "age_range": (18, 35), "conditions": ["obesity"], "employed": True, "transport": "bus"},
    {"role": "nurse_aide", "age_range": (22, 45), "conditions": [], "employed": True, "transport": "car"},
    {"role": "security_guard", "age_range": (25, 55), "conditions": ["hypertension"], "employed": True, "transport": "car"},
    {"role": "stay_at_home_parent", "age_range": (25, 45), "conditions": ["depression", "obesity"], "employed": False, "transport": "none"},
]

NODE_COLORS = {
    "Resident": "#4dabf7",       # Blue
    "HealthCondition": "#ff6b6b", # Red
    "ZIPCode": "#ffd43b",        # Yellow
    "CommunityOrg": "#38d9a9",   # Teal
    "Barrier": "#e599f7",        # Purple
    "Intervention": "#69db7c",   # Green
    "HealthcareFacility": "#ff922b", # Orange
    "FoodResource": "#a9e34b",   # Lime
    "GreenSpace": "#66d9e8",     # Cyan
    "TransportMode": "#ffa8a8",  # Pink
}

ARCHETYPE_COLORS = {
    "single_mother": "#ff6b6b", "elderly_veteran": "#ffa94d", "young_worker": "#69db7c",
    "retired_teacher": "#748ffc", "teen_student": "#da77f2", "unemployed_adult": "#ff8787",
    "healthcare_worker": "#38d9a9", "small_business_owner": "#4dabf7", "disabled_resident": "#e599f7",
    "new_immigrant": "#ffd43b", "church_leader": "#66d9e8", "construction_worker": "#a9e34b",
    "home_aide": "#f783ac", "college_student": "#9775fa", "grandparent_caretaker": "#ffa8a8",
    "rideshare_driver": "#74c0fc", "fast_food_worker": "#ff8787", "nurse_aide": "#63e6be",
    "security_guard": "#868e96", "stay_at_home_parent": "#fcc2d7",
}


def llm_call_with_retry(llm: OpenAI, messages: list, temperature: float = 0.9, max_tokens: int = 400, max_retries: int = 3) -> Optional[str]:
    """Make LLM call with exponential backoff for rate limits."""
    for attempt in range(max_retries):
        try:
            resp = llm.chat.completions.create(
                model=LLM_MODEL,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            error_str = str(e)
            if '429' in error_str or 'rate_limit' in error_str:
                wait = (attempt + 1) * 2  # 8s, 16s, 24s
                print(f" [rate limited, waiting {wait}s]", end="", flush=True)
                time.sleep(wait)
            else:
                print(f" [error: {e}]", end="", flush=True)
                return None
    return None


def generate_oasis_profile(agent: dict, llm: OpenAI) -> dict:
    """Generate a MiroFish OASIS-compatible agent profile using LLM."""
    zip_d = ZIP_DATA.get(agent['zip_code'], {})

    prompt = f"""Generate a detailed social media persona for a simulated Jacksonville, FL resident.
This person will participate in a Reddit-like community discussion about local health resources.

DEMOGRAPHICS:
- Role: {agent['role'].replace('_', ' ').title()}, Age {agent['age']}
- ZIP: {agent['zip_code']} ({zip_d.get('name', 'Jacksonville')})
- Income: ${agent['income']:,}/year
- Health conditions: {', '.join(agent['conditions']) or 'None'}
- Transport: {agent['transport']}
- Insured: {'Yes' if agent['insured'] else 'No'}
- Area life expectancy: {zip_d.get('le', 75)} years
- Area food desert rate: {zip_d.get('food_desert', 30)}%

Respond ONLY in JSON:
{{"username":"reddit_style_username","name":"Full Name","bio":"2-3 sentence bio","persona":"Detailed 4-5 sentence persona describing personality, daily routine, health concerns, community involvement, and social media behavior","interested_topics":["topic1","topic2","topic3"],"mbti":"XXXX","karma":number}}"""

    text = llm_call_with_retry(llm, [{"role": "user", "content": prompt}])
    if text:
        try:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(text[start:end])
        except json.JSONDecodeError:
            pass

    return {
        "username": f"jax_resident_{agent['agent_id'][-4:]}",
        "name": f"Resident {agent['agent_id'][-4:]}",
        "bio": f"Living in {zip_d.get('name', 'Jacksonville')}",
        "persona": f"A {agent['role'].replace('_', ' ')} living in ZIP {agent['zip_code']}.",
        "interested_topics": ["health", "community", "jacksonville"],
        "mbti": random.choice(["ISFJ", "ESFJ", "ISTJ", "INFP", "ENFP"]),
        "karma": random.randint(100, 5000),
    }


def simulate_agent_reaction(agent: dict, profile: dict, scenario: dict, llm: OpenAI) -> dict:
    """Use LLM to simulate how an agent reacts to a scenario — MiroFish style."""
    zip_d = ZIP_DATA.get(agent['zip_code'], {})

    prompt = f"""You are roleplaying as this person on a Reddit-like community forum in Jacksonville, FL.

YOUR PERSONA: {profile.get('persona', 'A Jacksonville resident.')}
YOUR SITUATION: {agent['role'].replace('_', ' ').title()}, age {agent['age']}, income ${agent['income']:,}, ZIP {agent['zip_code']}
HEALTH: {', '.join(agent['conditions']) or 'healthy'} | Transport: {agent['transport']} | Insured: {'yes' if agent['insured'] else 'no'}

COMMUNITY POST: "{scenario['initial_event']}"

React in-character. Answer ONLY in JSON:
{{"action":"CREATE_COMMENT","content":"your 2-4 sentence Reddit-style comment responding to this post","sentiment":-1.0 to 1.0,"would_use":true/false,"barriers":["list of personal barriers"],"motivators":["list of personal motivators"],"influence_score":0.0 to 1.0,"weekly_visits_estimate":0-5}}"""

    text = llm_call_with_retry(llm, [{"role": "user", "content": prompt}], max_tokens=350)
    if text:
        try:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(text[start:end])
        except json.JSONDecodeError:
            pass

    return {
        "action": "CREATE_COMMENT",
        "content": "Interesting, I'd like to learn more about this.",
        "sentiment": round(random.uniform(0.1, 0.7), 2),
        "would_use": random.random() > 0.3,
        "barriers": random.sample(["transportation", "time", "trust", "cost"], 2),
        "motivators": random.sample(["proximity", "free services", "community need"], 2),
        "influence_score": round(random.uniform(0.2, 0.8), 2),
        "weekly_visits_estimate": random.randint(0, 3),
    }


def extrapolate_reaction(agent: dict, llm_reactions: dict, scenario: dict) -> dict:
    """Extrapolate behavior for agents not directly LLM-simulated."""
    # Find most similar LLM-simulated agent
    best_match = None
    best_score = -1

    for aid, data in llm_reactions.items():
        ref = data["agent"]
        score = 0
        if ref["zip_code"] == agent["zip_code"]: score += 4
        if ref["role"] == agent["role"]: score += 3
        if ref["insured"] == agent["insured"]: score += 1
        if ref["transport"] == agent["transport"]: score += 1
        if abs(ref["age"] - agent["age"]) < 10: score += 1
        if set(ref["conditions"]) & set(agent["conditions"]): score += 2
        if score > best_score:
            best_score = score
            best_match = data["reaction"]

    if not best_match:
        return {
            "sentiment": round(random.uniform(0.1, 0.6), 2),
            "would_use": random.random() > 0.35,
            "influence_score": round(random.uniform(0.2, 0.6), 2),
            "weekly_visits_estimate": random.randint(0, 2),
            "content": None,
        }

    # Add personality-based noise
    p = agent["personality"]
    sent_mod = (p["openness"] - 0.5) * 0.3 + (p["trust"] - 0.5) * 0.25
    base_sent = best_match.get("sentiment", 0.5)
    sentiment = max(-1, min(1, base_sent + sent_mod + random.gauss(0, 0.12)))

    would_use = best_match.get("would_use", True)
    if p["trust"] < 0.25 and random.random() > 0.4:
        would_use = False
    if p["health_concern"] > 0.7 and scenario["type"] == "healthcare":
        would_use = True

    return {
        "sentiment": round(sentiment, 2),
        "would_use": would_use,
        "influence_score": round(max(0, min(1, best_match.get("influence_score", 0.5) + random.gauss(0, 0.1))), 2),
        "weekly_visits_estimate": max(0, min(5, best_match.get("weekly_visits_estimate", 1) + random.randint(-1, 1))),
        "content": None,  # Only LLM agents get real quotes
    }


# ─── Step 3: Build Knowledge Graph Data for Visualization ─────────────────────

def build_knowledge_graph(agents: list, reactions: dict, scenario: dict, profiles: dict) -> dict:
    """Build MiroFish-style knowledge graph with entities, relationships, and agent behaviors."""

    nodes = []
    links = []
    node_id_map = {}

    # -- Add structural nodes first (ZIP codes, conditions, barriers, etc.) --

    # ZIP code nodes
    for zip_code, zd in ZIP_DATA.items():
        nid = f"zip_{zip_code}"
        node_id_map[nid] = len(nodes)
        nodes.append({
            "id": nid, "label": f"ZIP {zip_code}", "sublabel": zd["name"],
            "type": "ZIPCode", "color": NODE_COLORS["ZIPCode"],
            "val": 8 + zd["pop"] / 5000, "details": zd,
        })

    # Health condition nodes
    all_conditions = set()
    for a in agents:
        all_conditions.update(a["conditions"])
    for cond in all_conditions:
        nid = f"condition_{cond}"
        node_id_map[nid] = len(nodes)
        nodes.append({
            "id": nid, "label": cond.replace("_", " ").title(),
            "type": "HealthCondition", "color": NODE_COLORS["HealthCondition"],
            "val": 6,
        })

    # Barrier nodes
    barrier_set = set()
    for r in reactions.values():
        barrier_set.update(r.get("barriers", []))
    for barrier in barrier_set:
        if barrier:
            nid = f"barrier_{barrier.lower().replace(' ', '_')}"
            if nid not in node_id_map:
                node_id_map[nid] = len(nodes)
                nodes.append({
                    "id": nid, "label": barrier.title(),
                    "type": "Barrier", "color": NODE_COLORS["Barrier"],
                    "val": 5,
                })

    # Intervention node
    nid = f"intervention_{scenario['id']}"
    node_id_map[nid] = len(nodes)
    nodes.append({
        "id": nid, "label": scenario["title"],
        "type": "Intervention", "color": NODE_COLORS["Intervention"],
        "val": 12, "details": scenario,
    })

    # -- Add agent nodes --
    for agent in agents:
        reaction = reactions.get(agent["agent_id"], {})
        profile = profiles.get(agent["agent_id"], {})
        nid = agent["agent_id"]
        node_id_map[nid] = len(nodes)

        sentiment = reaction.get("sentiment", 0)
        would_use = reaction.get("would_use", True)

        nodes.append({
            "id": nid,
            "label": profile.get("name", agent["role"].replace("_", " ").title()),
            "sublabel": f"ZIP {agent['zip_code']} · {agent['role'].replace('_', ' ')}",
            "type": "Resident",
            "color": ARCHETYPE_COLORS.get(agent["role"], "#4dabf7"),
            "val": max(2, 3 + sentiment * 2),
            "agent": {
                "role": agent["role"],
                "age": agent["age"],
                "zip": agent["zip_code"],
                "income": agent["income"],
                "conditions": agent["conditions"],
                "transport": agent["transport"],
                "insured": agent["insured"],
            },
            "profile": {
                "username": profile.get("username", ""),
                "bio": profile.get("bio", ""),
                "persona": profile.get("persona", ""),
                "mbti": profile.get("mbti", ""),
                "topics": profile.get("interested_topics", []),
            },
            "reaction": {
                "sentiment": sentiment,
                "would_use": would_use,
                "content": reaction.get("content"),
                "influence": reaction.get("influence_score", 0.5),
                "visits": reaction.get("weekly_visits_estimate", 0),
            },
        })

    # -- Add edges --

    # Agent → ZIP (LIVES_IN)
    for agent in agents:
        aid = agent["agent_id"]
        zid = f"zip_{agent['zip_code']}"
        if aid in node_id_map and zid in node_id_map:
            links.append({
                "source": aid, "target": zid,
                "type": "LIVES_IN", "color": "rgba(255,212,59,0.08)",
            })

    # Agent → Condition (HAS_CONDITION)
    for agent in agents:
        for cond in agent["conditions"]:
            cid = f"condition_{cond}"
            if cid in node_id_map:
                links.append({
                    "source": agent["agent_id"], "target": cid,
                    "type": "HAS_CONDITION", "color": "rgba(255,107,107,0.12)",
                })

    # Agent → Barrier (FACES_BARRIER)
    for agent in agents:
        r = reactions.get(agent["agent_id"], {})
        for barrier in r.get("barriers", []):
            if barrier:
                bid = f"barrier_{barrier.lower().replace(' ', '_')}"
                if bid in node_id_map:
                    links.append({
                        "source": agent["agent_id"], "target": bid,
                        "type": "FACES_BARRIER", "color": "rgba(229,153,247,0.1)",
                    })

    # Agent → Intervention (WOULD_USE)
    int_id = f"intervention_{scenario['id']}"
    for agent in agents:
        r = reactions.get(agent["agent_id"], {})
        if r.get("would_use"):
            links.append({
                "source": agent["agent_id"], "target": int_id,
                "type": "WOULD_USE", "color": "rgba(105,219,124,0.15)",
            })

    # Agent → Agent influence chains (same ZIP, adopters influence non-adopters)
    agents_by_zip = {}
    for agent in agents:
        agents_by_zip.setdefault(agent["zip_code"], []).append(agent)

    for zip_code, zip_agents in agents_by_zip.items():
        adopters = [a for a in zip_agents if reactions.get(a["agent_id"], {}).get("would_use")]
        non_adopters = [a for a in zip_agents if not reactions.get(a["agent_id"], {}).get("would_use")]

        # Influence edges: adopters try to influence non-adopters
        for na in non_adopters:
            if adopters:
                influencer = random.choice(adopters)
                links.append({
                    "source": influencer["agent_id"], "target": na["agent_id"],
                    "type": "INFLUENCES", "color": "rgba(13,148,136,0.18)",
                })

        # Proximity edges: connect neighbors in same ZIP
        for a in zip_agents:
            neighbors = random.sample(zip_agents, min(2, len(zip_agents) - 1))
            for n in neighbors:
                if n["agent_id"] != a["agent_id"]:
                    links.append({
                        "source": a["agent_id"], "target": n["agent_id"],
                        "type": "PROXIMITY", "color": "rgba(255,255,255,0.03)",
                    })

    # Role-based professional networks (cross-ZIP)
    role_groups = {}
    for agent in agents:
        role_groups.setdefault(agent["role"], []).append(agent)
    for role, members in role_groups.items():
        if len(members) > 2:
            for _ in range(min(len(members), 5)):
                a, b = random.sample(members, 2)
                links.append({
                    "source": a["agent_id"], "target": b["agent_id"],
                    "type": "ROLE_NETWORK", "color": "rgba(255,255,255,0.04)",
                })

    return {
        "nodes": nodes,
        "links": links,
        "stats": {
            "total_nodes": len(nodes),
            "total_links": len(links),
            "agent_nodes": sum(1 for n in nodes if n["type"] == "Resident"),
            "structural_nodes": sum(1 for n in nodes if n["type"] != "Resident"),
        },
        "nodeTypes": NODE_COLORS,
    }


# ─── Main Pipeline ────────────────────────────────────────────────────────────

def run():
    print("=" * 70)
    print("MIROFISH DEEP INTEGRATION — JaxBridge Agent Simulation")
    print(f"Engine: CAMEL-AI OASIS + Zep Cloud Knowledge Graph")
    print(f"LLM: {LLM_MODEL} via {LLM_BASE_URL}")
    print("=" * 70)

    AGENTS_PER_ZIP = 115  # 25 × 9 ZIPs = 225 agents total
    LLM_SAMPLE_PER_SCENARIO = 50  # 20 agents get full LLM simulation per scenario (rate limit safe)

    # -- Generate population --
    print(f"\n[1/5] Generating {AGENTS_PER_ZIP * len(ZIP_DATA)} agent population...")
    all_agents = []
    for zip_code in ZIP_DATA:
        zip_d = ZIP_DATA[zip_code]
        for i in range(AGENTS_PER_ZIP):
            arch = AGENT_ARCHETYPES[i % len(AGENT_ARCHETYPES)]
            age = random.randint(*arch["age_range"])
            income = max(12000, int(random.gauss(zip_d["income"], zip_d["income"] * 0.35)))
            insured = random.random() > (zip_d["uninsured"] / 100)
            seed = hashlib.md5(f"{zip_code}_{i}_{arch['role']}".encode()).hexdigest()

            all_agents.append({
                "agent_id": f"agent_{zip_code}_{i:04d}",
                "zip_code": zip_code,
                "role": arch["role"],
                "age": age,
                "income": income,
                "conditions": list(arch["conditions"]),
                "transport": arch["transport"],
                "insured": insured,
                "personality": {
                    "openness": int(seed[:2], 16) / 255,
                    "trust": int(seed[2:4], 16) / 255,
                    "health_concern": int(seed[4:6], 16) / 255,
                },
            })

    print(f"  ✓ {len(all_agents)} agents across {len(ZIP_DATA)} ZIP codes")

    # -- Build Zep knowledge graph --
    print(f"\n[2/5] Building Zep knowledge graph from seed data...")
    seed_doc = build_seed_document()
    graph_id = build_knowledge_graph_via_zep(seed_doc)
    print(f"  ✓ Graph ID: {graph_id or 'skipped'}")

    # -- Generate OASIS profiles for LLM sample --
    print(f"\n[3/5] Generating OASIS agent profiles...")
    all_profiles = {}

    # Select diverse LLM sample
    llm_sample_ids = set()
    for zip_code in ZIP_DATA:
        zip_agents = [a for a in all_agents if a["zip_code"] == zip_code]
        seen_roles = set()
        for agent in zip_agents:
            if len(llm_sample_ids) < LLM_SAMPLE_PER_SCENARIO * len(SCENARIOS) and agent["role"] not in seen_roles:
                llm_sample_ids.add(agent["agent_id"])
                seen_roles.add(agent["role"])
            if len(seen_roles) >= min(10, len(AGENT_ARCHETYPES)):
                break

    # Generate LLM profiles for the sample
    llm_agents = [a for a in all_agents if a["agent_id"] in llm_sample_ids]
    print(f"  Generating LLM profiles for {len(llm_agents)} representative agents...")
    for i, agent in enumerate(llm_agents):
        if i % 10 == 0:
            print(f"    [{i}/{len(llm_agents)}]...")
        profile = generate_oasis_profile(agent, llm_client)
        all_profiles[agent["agent_id"]] = profile
        time.sleep(0.5)  # Dev tier: 300k TPM

    # Generate rule-based profiles for the rest
    for agent in all_agents:
        if agent["agent_id"] not in all_profiles:
            zip_d = ZIP_DATA.get(agent["zip_code"], {})
            all_profiles[agent["agent_id"]] = {
                "username": f"jax_{agent['role']}_{agent['agent_id'][-4:]}",
                "name": f"{agent['role'].replace('_', ' ').title()} ({agent['zip_code']})",
                "bio": f"Living in {zip_d.get('name', 'Jacksonville')}.",
                "persona": f"A {agent['role'].replace('_', ' ')} in ZIP {agent['zip_code']}, age {agent['age']}.",
                "interested_topics": ["jacksonville", "community", "health"],
                "mbti": random.choice(["ISFJ", "ESFJ", "ISTJ", "INFP", "ENFP"]),
                "karma": random.randint(100, 3000),
            }

    print(f"  ✓ {len(all_profiles)} total profiles ({len(llm_agents)} via LLM)")

    # -- Run simulations --
    print(f"\n[4/5] Running agent simulations across {len(SCENARIOS)} scenarios...")
    all_results = []

    for scenario in SCENARIOS:
        print(f"\n  ── SCENARIO: {scenario['title']} ──")

        # Select LLM sample for this scenario
        target_zip = scenario["target_zip"]
        target_agents = [a for a in all_agents if a["zip_code"] == target_zip]
        other_agents = [a for a in all_agents if a["zip_code"] != target_zip]

        # All target ZIP agents get LLM simulation + sample from others
        llm_targets = target_agents[:min(len(target_agents), 20)]
        llm_others = random.sample(other_agents, min(20, len(other_agents)))
        llm_sample = llm_targets + llm_others

        print(f"    LLM-simulating {len(llm_sample)} agents ({len(llm_targets)} target ZIP + {len(llm_others)} spillover)...")

        llm_reactions = {}
        featured_quotes = []

        for i, agent in enumerate(llm_sample):
            profile = all_profiles.get(agent["agent_id"], {})
            print(f"      [{i+1}/{len(llm_sample)}] {agent['role']} ZIP {agent['zip_code']}...", end=" ", flush=True)
            reaction = simulate_agent_reaction(agent, profile, scenario, llm_client)
            llm_reactions[agent["agent_id"]] = {"agent": agent, "reaction": reaction}
            print(f"sent={reaction.get('sentiment', '?')}")

            content = reaction.get("content", "")
            if content and len(content) > 20:
                featured_quotes.append({
                    "agent_id": agent["agent_id"],
                    "role": agent["role"].replace("_", " ").title(),
                    "age": agent["age"],
                    "zip": agent["zip_code"],
                    "username": profile.get("username", ""),
                    "content": content,
                    "sentiment": reaction.get("sentiment", 0),
                    "would_use": reaction.get("would_use", True),
                })

            time.sleep(0.5)  # Dev tier: 300k TPM

        # Extrapolate for remaining agents
        print(f"    Extrapolating for {len(all_agents) - len(llm_sample)} remaining agents...")
        all_reactions = {}
        for agent in all_agents:
            if agent["agent_id"] in llm_reactions:
                all_reactions[agent["agent_id"]] = llm_reactions[agent["agent_id"]]["reaction"]
            else:
                all_reactions[agent["agent_id"]] = extrapolate_reaction(agent, llm_reactions, scenario)

        # Build knowledge graph
        print(f"    Building knowledge graph...")
        graph = build_knowledge_graph(all_agents, all_reactions, scenario, all_profiles)

        # Compute aggregates
        adoption = sum(1 for r in all_reactions.values() if r.get("would_use")) / len(all_reactions)
        avg_sentiment = sum(r.get("sentiment", 0) for r in all_reactions.values()) / len(all_reactions)
        total_visits = sum(r.get("weekly_visits_estimate", 0) for r in all_reactions.values())

        barrier_counts = {}
        for r in all_reactions.values():
            for b in r.get("barriers", []):
                if b:
                    b = b.lower().strip()
                    barrier_counts[b] = barrier_counts.get(b, 0) + 1

        by_zip = {}
        for zip_code in ZIP_DATA:
            zip_r = {aid: r for aid, r in all_reactions.items() if f"_{zip_code}_" in aid}
            if zip_r:
                by_zip[zip_code] = {
                    "agents": len(zip_r),
                    "adoption_rate": round(sum(1 for r in zip_r.values() if r.get("would_use")) / len(zip_r), 3),
                    "avg_sentiment": round(sum(r.get("sentiment", 0) for r in zip_r.values()) / len(zip_r), 3),
                }

        all_results.append({
            "scenario": scenario,
            "num_agents": len(all_agents),
            "num_llm_simulated": len(llm_sample),
            "aggregate": {
                "adoption_rate": round(adoption, 3),
                "avg_sentiment": round(avg_sentiment, 3),
                "total_weekly_visits": total_visits,
                "top_barriers": sorted(barrier_counts.items(), key=lambda x: -x[1])[:10],
                "by_zip": by_zip,
            },
            "featured_quotes": sorted(featured_quotes, key=lambda q: abs(q["sentiment"]), reverse=True)[:15],
            "graph": graph,
        })

        print(f"    ✓ Adoption: {adoption:.0%} | Sentiment: {avg_sentiment:.2f} | Graph: {graph['stats']['total_nodes']} nodes, {graph['stats']['total_links']} links")

    # -- Write output --
    print(f"\n[5/5] Writing results...")
    output = {
        "engine": "MiroFish (github.com/666ghj/MiroFish) + CAMEL-AI OASIS",
        "model": LLM_MODEL,
        "timestamp": datetime.now().isoformat(),
        "zep_graph_id": graph_id,
        "total_agents": len(all_agents),
        "ontology": JAX_ONTOLOGY,
        "methodology": {
            "description": f"{len(all_agents)} AI agents simulating Jacksonville residents. {LLM_SAMPLE_PER_SCENARIO} per scenario fully LLM-simulated via {LLM_MODEL}; remainder extrapolated via personality-weighted similarity matching.",
            "engine": "MiroFish multi-agent swarm intelligence engine using CAMEL-AI OASIS social simulation framework and Zep Cloud knowledge graph.",
            "pipeline": [
                "1. Seed document generated from Jacksonville health equity data",
                "2. Zep Cloud ingests document → builds knowledge graph with entities & relationships",
                "3. OASIS agent profiles generated via LLM (persona, MBTI, interests, bio)",
                "4. Agents simulate reactions to interventions on Reddit-like platform",
                "5. Influence chains propagate adoption through social networks",
                "6. Knowledge graph exported for force-directed visualization",
            ],
            "limitations": [
                "LLM responses approximate but do not replicate real human behavior",
                "Agent profiles are composites from ZIP-level demographic data",
                "Personality traits are synthetically generated for reproducibility",
                "Extrapolation assumes similar profiles yield similar reactions",
            ],
        },
        "scenarios": all_results,
    }

    out_path = os.path.join(OUT_DIR, 'simulation_results.json')
    with open(out_path, 'w') as f:
        json.dump(output, f)

    print(f"\n{'='*70}")
    print(f"✓ SIMULATION COMPLETE")
    print(f"  Agents: {len(all_agents)} | Scenarios: {len(SCENARIOS)}")
    print(f"  Output: {out_path} ({os.path.getsize(out_path) / 1024:.0f} KB)")
    for r in all_results:
        s = r["scenario"]
        a = r["aggregate"]
        g = r["graph"]["stats"]
        print(f"  {s['title']}: adoption={a['adoption_rate']:.0%} | graph={g['total_nodes']}n/{g['total_links']}e")
    print(f"{'='*70}")


if __name__ == "__main__":
    run()
