<div align="center">

# JaxBridge

**Health equity decision engine for Jacksonville, FL**

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.0-EE4C2C?logo=pytorch&logoColor=white)](https://pytorch.org)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-ff3c00)](LICENSE)

[Live Demo](#getting-started) &middot; [Architecture](#scan-spatial-causal-attention-network) &middot; [Data Sources](#data-sources) &middot; [Setup](#getting-started)

</div>

---

In Jacksonville, a **14-year life expectancy gap** separates neighborhoods 20 miles apart. ZIP 32209: 68.7 years. ZIP 32266: 83.0 years. Same city. Completely different outcomes.

JaxBridge is a full-stack decision engine that identifies what drives this gap, lets users design resource interventions in plain English, simulates how 1,035 residents would react, and recommends exactly where to invest.

<br>

## How It Works

```
User describes intervention in English
        │
        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  NL Parser       │───▶│  SCAN Neural Net  │───▶│  MiroFish Sim   │
│  Groq LLM        │    │  Graph Attention   │    │  1,035 Agents   │
│  → Structured    │    │  Causal Masking    │    │  32 LLM Threads │
│    allocations   │    │  → Life Exp Δ      │    │  → Adoption %   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                    ┌──────────────────────────────────────┐
                    │  Placement Strategy                   │
                    │  Satellite topology · Spillover map   │
                    │  Cost analysis · Per-ZIP reports      │
                    └──────────────────────────────────────┘
```

**Six pages, one narrative arc:**

| Page | What It Does |
|------|-------------|
| **Landing** | 3D parallax hero. The 14-year gap in context. Scroll-driven storytelling. |
| **Atlas** | Choropleth map of all 34 ZIP codes. Toggle between RDCS, life expectancy, obesity, food access, SVI, physician ratio, income. |
| **Simulator** | Type an intervention in English. AI structures it, auto-adjusts sliders, projects life expectancy impact via SCAN. Export to MiroFish. |
| **Agents** | Force-directed knowledge graph. 1,035 agent nodes, ~5,500 edges. Per-ZIP adoption breakdown, sentiment analysis, agent voice quotes, automated report. |
| **Insights** | Scatter plots, 10x10 correlation matrix, SCAN architecture diagram, causal interaction weights, spatial spillover map, AI verification audit. |
| **Scorecard** | ML pipeline visualization, SCAN feature importance, counterfactual analysis, network-optimized placement strategy with satellite topology and per-placement MiroFish simulation. |

<br>

## SCAN: Spatial Causal Attention Network

A novel PyTorch architecture purpose-built for health equity prediction. Most models treat each geographic unit independently. SCAN doesn't.

```
Input (20 features × 218 tracts)
  │
  ├── Feature Interaction Attention ─── 4 heads, causal mask
  │   Discovers which health factors compound each other.
  │   Mask enforces epidemiological direction:
  │   poverty → insurance → food access → obesity → heart disease
  │   (never backwards)
  │
  ├── Graph Attention Network ────────── 5,112 spatial edges
  │   Models neighborhood spillover. A clinic in 32209
  │   benefits adjacent 32254 and 32208.
  │
  ├── Causal Residual Blocks ─────────── Gated skip connections
  │   Separates baseline trajectory from intervention effect.
  │
  └── Physics-Informed Loss ──────────── MSE + monotonicity + smoothness
      Hard constraints from epidemiology. The model cannot learn
      that higher obesity leads to longer life.
```

**Performance:**

| Metric | Value |
|--------|-------|
| 5-Fold CV R² | **0.99** |
| MAE | **0.09 years** |
| Training samples | 218 census tracts |
| Features | 20 (health, economic, environmental) |
| Spatial edges | 5,112 |
| Parameters | 33,050 |

Trained on real CDC PLACES 2023 data pulled at census tract resolution via the Socrata API.

<br>

## MiroFish Agent Simulation

Inspired by [MiroFish](https://github.com/666ghj/MiroFish). 1,035 AI agents simulate how Jacksonville residents would actually react to proposed interventions.

- **20 archetypal roles** across 9 ZIP codes (single mothers, veterans, students, healthcare workers, disabled residents, etc.)
- Each agent has specific demographics, health conditions, transportation mode, insurance status, and personality traits derived from Census/CDC data
- Agent personas enriched with real community concerns from r/jacksonville
- LLM-simulated reactions via Groq API with 32 concurrent threads
- Knowledge graph per scenario: ~1,100 nodes, ~5,500 edges encoding proximity, shared conditions, influence chains, and role networks

<br>

## Data Sources

| Source | Geographic Resolution | Year | Used For |
|--------|-----------------------|------|----------|
| CDC PLACES | Census tract | 2023 | 28 health measures (obesity, smoking, depression, etc.) |
| U.S. Census ACS | ZIP / tract | 2020-2024 | Income, poverty, demographics, insurance |
| CDC/ATSDR SVI | ZIP | 2022 | Social vulnerability index |
| USDA Food Access Research Atlas | ZIP | 2019 | Food desert rates |
| FEMA National Risk Index | ZIP | 2025 | Environmental resilience, hazard exposure |
| EPA EJScreen | ZIP | 2024 | Air toxics, environmental justice |
| MySidewalk | ZIP | 2018-2025 | Parks, healthcare workers, physician ratios |

<br>

## Project Structure

```
jaxbridge/
│
├── app/                          React frontend (Vite + TypeScript + Tailwind)
│   ├── src/
│   │   ├── pages/                Landing, Atlas, Simulator, AgentGraph, Correlations, Scorecard
│   │   ├── components/           Nav, ZipDetailPanel, LoadingSkeleton, ui/
│   │   ├── lib/                  scoring.ts, nlInterventionParser.ts, useReveal.ts
│   │   └── data/                 useZipData.ts
│   └── public/
│       ├── data/                 Pre-computed JSON (SCAN, simulation, placements, correlations)
│       ├── geo/                  Duval County ZIP GeoJSON boundaries
│       └── images/               AI-generated mockup renders
│
├── pipeline/                     Python ML & data pipeline
│   ├── preprocess.py             Raw CSV → zipcode_data.json (34 ZIPs × 50+ features)
│   ├── build_tract_dataset.py    CDC PLACES API → 218-tract dataset
│   ├── train_scan_model.py       SCAN architecture definition + training loop
│   ├── mirofish_deep.py          1,035-agent simulation with Zep knowledge graph
│   ├── generate_placements.py    Network-optimized resource placement
│   ├── api_server.py             Flask API for live NL → agent simulation
│   └── scrape_community_voices.py Reddit data enrichment for agent personas
│
└── data/Datasets/                Raw source CSVs from CDC, Census, FEMA, USDA, EPA
```

<br>

## Getting Started

### Frontend

```bash
cd app
cp .env.example .env    # add your Groq API key for NL features
npm install
npm run dev             # → http://localhost:5175
```

The frontend works standalone with pre-computed data. No Python or API keys needed for browsing.

### ML Pipeline (optional)

Pre-computed outputs are included in `app/public/data/`. To retrain or regenerate:

```bash
python3.11 -m venv .venv && source .venv/bin/activate
pip install torch numpy scikit-learn openai python-dotenv flask flask-cors zep-cloud shapely

python pipeline/preprocess.py            # Process raw CSVs
python pipeline/build_tract_dataset.py   # Pull 218 tracts from CDC PLACES API
python pipeline/train_scan_model.py      # Train SCAN (outputs scan_model.json)
python pipeline/mirofish_deep.py         # Run 1,035-agent simulation
python pipeline/generate_placements.py   # Compute optimal placements
```

### Live Simulation API

For the NL intervention → live agent simulation flow:

```bash
cp .env.example .env    # add Groq API key
python pipeline/api_server.py   # → http://localhost:5001
```

<br>

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite 8, Tailwind CSS 4 |
| Visualization | Leaflet + react-leaflet, react-force-graph-2d, Recharts |
| Scroll & Animation | Lenis, CSS keyframes, IntersectionObserver |
| Neural Network | PyTorch (SCAN architecture) |
| Agent Simulation | Groq LLM API, MiroFish-inspired pipeline, Zep Cloud |
| API | Flask, Flask-CORS |
| Data | CDC PLACES API (Socrata), Census ACS, FEMA, USDA, EPA |

<br>

## License

MIT

<br>

<div align="center">
<sub>Built for AI4Good Datathon 2026</sub>
</div>
