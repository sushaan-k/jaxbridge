# JaxBridge

**Health equity decision engine for Jacksonville, FL.**

JaxBridge identifies the biggest threats to life expectancy across Jacksonville's 34 ZIP codes and lets users design, simulate, and validate resource interventions before a single dollar is spent.

Built for the AI4Good Datathon 2026. Team Stanton-4.

---

## The Problem

In Jacksonville, a 14-year life expectancy gap separates the wealthiest and poorest neighborhoods — ZIP 32266 (83.0 years) and ZIP 32209 (68.7 years) are just 20 miles apart. This gap is driven by unequal access to healthcare, food, green space, and social infrastructure.

## What JaxBridge Does

1. **Maps the gap** — Interactive choropleth atlas showing resource deserts, life expectancy, obesity, food access, and social vulnerability across all 34 ZIP codes
2. **Designs interventions** — Natural language input ("Build a clinic with 8 doctors and a food bank") auto-structures into resource allocations and projects life expectancy impact
3. **Simulates resident reactions** — 1,035 AI agents with distinct personas react to proposed interventions via MiroFish swarm intelligence, reporting adoption rates, barriers, and sentiment
4. **Proves what works** — Statistical evidence page with SCAN attention weights, correlation matrix, scatter plots, and AI verification audit
5. **Recommends where to invest** — Network-optimized placement strategy with per-ZIP reports, satellite topology, MiroFish validation, and spillover analysis

## Architecture

### SCAN: Spatial Causal Attention Network

A novel PyTorch architecture for health equity prediction:

- **Feature Interaction Attention** — 4-head self-attention with causal masking encoding 5 tiers of epidemiological causation (socioeconomic → structural → environmental → behavioral → clinical)
- **Graph Attention Network** — 5,112 spatial edges across 218 census tracts model neighborhood spillover effects
- **Causal Residual Blocks** — Gated skip connections with intervention-aware path separation
- **Physics-Informed Loss** — MSE + monotonicity constraints + spatial smoothness regularization

Performance: **5-fold CV R² = 0.99**, MAE = 0.09 years, trained on 218 Duval County census tracts with 20 features from CDC PLACES 2023.

### MiroFish Agent Simulation

Inspired by [MiroFish](https://github.com/666ghj/MiroFish), the multi-agent swarm intelligence engine:

- 1,035 agents across 9 ZIP codes with 20 archetypal roles
- Each agent has demographics, health conditions, transportation, insurance status, and personality traits
- Personas enriched with real community data from r/jacksonville
- LLM-simulated reactions via Groq API (32 concurrent threads)
- Knowledge graph with ~1,100 nodes and ~5,500 edges per scenario

### Frontend

React + TypeScript + Vite + Tailwind CSS. Halide-inspired dark aesthetic with:

- 3D parallax hero with topographic layers
- Lenis smooth scroll with section snapping
- Force-directed knowledge graph (react-force-graph-2d)
- Leaflet choropleth with CARTO dark tiles
- Custom trailing cursor with shimmer effect
- Glassmorphism cards and page transitions

## Data Sources

| Source | Resolution | Year |
|--------|-----------|------|
| CDC PLACES | Census tract | 2023 |
| U.S. Census ACS | ZIP code | 2020-2024 |
| CDC/ATSDR SVI | ZIP code | 2022 |
| USDA Food Access Research Atlas | ZIP code | 2019 |
| FEMA National Risk Index | ZIP code | 2025 |
| EPA EJScreen | ZIP code | 2024 |
| MySidewalk (Parks, Healthcare) | ZIP code | 2018-2025 |

## Project Structure

```
jaxbridge/
├── app/                    # React frontend
│   ├── src/
│   │   ├── pages/          # Landing, Atlas, Simulator, AgentGraph, Correlations, Scorecard
│   │   ├── components/     # Nav, ZipDetailPanel, ui/
│   │   ├── lib/            # scoring.ts, nlInterventionParser.ts
│   │   └── data/           # useZipData.ts hook
│   └── public/
│       ├── data/           # Pre-computed JSON (SCAN model, simulation results, placements)
│       ├── geo/            # GeoJSON boundaries
│       └── images/         # Mockup renders
├── pipeline/               # Python data & ML pipeline
│   ├── preprocess.py       # Raw CSV → zipcode_data.json
│   ├── build_tract_dataset.py  # CDC PLACES API → 218-tract dataset
│   ├── train_scan_model.py     # SCAN architecture + training
│   ├── mirofish_deep.py        # 1,035-agent simulation
│   ├── generate_placements.py  # Optimal resource placement
│   ├── api_server.py           # Flask API for live simulation
│   └── scrape_community_voices.py  # Reddit data enrichment
├── data/Datasets/          # Raw source CSVs
├── pitch/index.html        # Presentation deck
└── DEMO_SCRIPT.md          # 5-minute demo script (3 speakers)
```

## Setup

### Prerequisites

- Node.js 18+
- Python 3.11+ (for SCAN training and MiroFish simulation)
- Groq API key (for LLM-powered features)

### Frontend

```bash
cd app
cp .env.example .env        # Add your Groq API key
npm install
npm run dev                 # http://localhost:5175
```

### Pipeline (optional — pre-computed data included)

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install torch numpy scikit-learn openai python-dotenv flask flask-cors zep-cloud shapely

# Preprocess raw data
python pipeline/preprocess.py

# Build tract dataset from CDC PLACES API
python pipeline/build_tract_dataset.py

# Train SCAN model
python pipeline/train_scan_model.py

# Run MiroFish agent simulation
python pipeline/mirofish_deep.py

# Generate optimal placements
python pipeline/generate_placements.py
```

### Live Simulation API (for NL intervention → agent simulation)

```bash
cp .env.example .env        # Add Groq API key
python pipeline/api_server.py   # http://localhost:5001
```

## Key Numbers

| Metric | Value | Source |
|--------|-------|--------|
| SCAN CV R² | 0.99 | 5-fold cross-validation, 218 tracts |
| SCAN MAE | 0.09 years | Mean absolute error |
| Training data | 218 census tracts | CDC PLACES 2023 |
| Features | 20 | Health, socioeconomic, environmental |
| Spatial edges | 5,112 | Distance-weighted adjacency |
| Parameters | 33,050 | PyTorch |
| Agents simulated | 1,035 | LLM-generated reactions |
| Counterfactual gain | +3.8 to +5.3 yr/ZIP | If features reach county median |
| Placement cost | $8.5M/year | 3 resources, 133K residents |

## License

MIT
