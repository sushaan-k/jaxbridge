<div align="center">

# JaxBridge

**Health equity decision engine for Jacksonville, FL**

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.0-EE4C2C?logo=pytorch&logoColor=white)](https://pytorch.org)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-ff3c00)](LICENSE)

[Architecture](#scan-spatial-causal-attention-network) · [Agent Simulation](#mirofish-agent-simulation) · [Screenshots](#screenshots) · [Setup](#getting-started)

---

![Landing Page](docs/screenshot-landing.png)

</div>

In Jacksonville, a **14-year life expectancy gap** separates neighborhoods 20 miles apart. ZIP 32209: 68.7 years. ZIP 32266: 83.0 years. Same city, completely different outcomes.

JaxBridge identifies what drives this gap, lets users design interventions in plain English, simulates how 1,035 residents would react, and recommends exactly where to invest.

## System Architecture

```mermaid
graph LR
    subgraph Input
        A[Natural Language<br/>Intervention] --> B[NL Parser<br/>Groq LLM]
        C[Raw Data<br/>CDC · Census · FEMA] --> D[Preprocessing<br/>218 Tracts × 20 Features]
    end

    subgraph "SCAN Neural Network"
        D --> E[Feature Interaction<br/>Attention<br/>4 heads · causal mask]
        E --> F[Graph Attention<br/>Network<br/>5,112 spatial edges]
        F --> G[Causal Residual<br/>Blocks<br/>gated skip]
        G --> H[Life Expectancy<br/>Prediction<br/>CV R²=0.99]
    end

    subgraph "MiroFish Simulation"
        B --> I[Agent Generation<br/>1,035 personas]
        I --> J[LLM Reactions<br/>32 threads · Groq]
        J --> K[Knowledge Graph<br/>~1,100 nodes · ~5,500 edges]
    end

    subgraph Output
        H --> L[Counterfactual<br/>Analysis]
        K --> M[Adoption Rate<br/>Sentiment · Barriers]
        L --> N[Placement<br/>Strategy]
        M --> N
    end

    style E fill:#ff3c00,color:#fff,stroke:none
    style F fill:#ff3c00,color:#fff,stroke:none
    style G fill:#ff3c00,color:#fff,stroke:none
    style H fill:#0d9488,color:#fff,stroke:none
```

## SCAN: Spatial Causal Attention Network

A novel PyTorch architecture for health equity prediction. Most models treat each geographic unit independently — SCAN models how neighborhoods influence each other.

```mermaid
graph TD
    subgraph "Causal Feature Ordering"
        T0["Tier 0: Root Causes<br/>poverty_rate · median_income"]
        T1["Tier 1: Structural<br/>svi_score · uninsured_rate · disability"]
        T2["Tier 2: Environmental<br/>food_desert · parks · physicians · MH providers"]
        T3["Tier 3: Behavioral<br/>smoking · obesity · inactivity · drinking · depression"]
        T4["Tier 4: Clinical<br/>blood_pressure · diabetes · heart_disease · COPD · stroke"]
    end

    T0 -->|"attention flows forward"| T1
    T1 --> T2
    T2 --> T3
    T3 --> T4
    T4 -->|"blocked: no backward flow"| T0

    style T0 fill:#ff3c00,color:#fff,stroke:none
    style T1 fill:#c53000,color:#fff,stroke:none
    style T2 fill:#8a2000,color:#fff,stroke:none
    style T3 fill:#5a1500,color:#fff,stroke:none
    style T4 fill:#3a0d00,color:#fff,stroke:none
```

**Key innovations:**

| Component | What It Does | Why It Matters |
|-----------|-------------|----------------|
| Feature Interaction Attention | 4-head self-attention with causal masking | Discovers compounding health factors while enforcing epidemiological direction |
| Graph Attention Network | 5,112 distance-weighted edges across 218 tracts | Models spatial spillover — a clinic in 32209 benefits adjacent 32254 |
| Causal Residual Blocks | Gated skip connections | Separates baseline health trajectory from intervention effect |
| Physics-Informed Loss | MSE + monotonicity + smoothness | Prevents learning that more obesity → longer life |

**Performance:**

| Metric | Value |
|--------|-------|
| 5-Fold CV R² | **0.99** |
| MAE | **0.09 years** |
| Training samples | 218 census tracts (CDC PLACES 2023) |
| Features | 20 (health, economic, environmental) |
| Spatial edges | 5,112 |
| Parameters | 33,050 |

## MiroFish Agent Simulation

Inspired by [MiroFish](https://github.com/666ghj/MiroFish). 1,035 AI agents simulate how Jacksonville residents would actually react to proposed interventions.

```mermaid
graph LR
    subgraph "Agent Generation"
        A1[20 Archetypes] --> A2[9 ZIP Codes]
        A2 --> A3[1,035 Agents<br/>with demographics,<br/>health conditions,<br/>personality traits]
    end

    subgraph "Simulation"
        A3 --> B1[LLM Reaction<br/>per agent]
        B1 --> B2[Adoption?<br/>Barriers?<br/>Sentiment?]
        B2 --> B3[Knowledge<br/>Graph]
    end

    subgraph "Analysis"
        B3 --> C1[Per-ZIP<br/>Breakdown]
        B3 --> C2[Agent<br/>Voices]
        B3 --> C3[Barrier<br/>Analysis]
        B3 --> C4[Automated<br/>Report]
    end

    style B1 fill:#ff3c00,color:#fff,stroke:none
    style B3 fill:#0d9488,color:#fff,stroke:none
```

Each agent has: role, age, income, health conditions, transportation mode, insurance status, and personality traits (openness, trust, health concern). Personas are enriched with real community data from r/jacksonville.

## Screenshots

<details>
<summary><strong>Atlas — Interactive Choropleth Map</strong></summary>

![Atlas](docs/screenshot-atlas.png)

34 ZIP code polygons with 7 switchable data layers: Resource Desert Score, Life Expectancy, Obesity, Food Desert Rate, Social Vulnerability, Physician Ratio, Median Income.

</details>

<details>
<summary><strong>Simulator — NL Intervention Designer</strong></summary>

![Simulator](docs/screenshot-simulator.png)

Type an intervention in plain English. AI structures it into resource allocations, auto-adjusts sliders, and projects life expectancy impact via SCAN. Export directly to MiroFish agent simulation.

</details>

<details>
<summary><strong>Agents — MiroFish Knowledge Graph</strong></summary>

![Agents](docs/screenshot-agents.png)

Force-directed graph of 1,035 agent nodes with ~5,500 edges. Filter by type, search agents, toggle adopters. Per-ZIP adoption breakdown, impact cascade, agent voice quotes, and automated analysis report.

</details>

<details>
<summary><strong>Insights — Statistical Evidence</strong></summary>

![Insights](docs/screenshot-insights.png)

Key drivers ranked by SCAN attention weights (not just correlation). Interactive scatter plots, 10x10 correlation matrix, SCAN architecture diagram, causal interaction map, and AI verification audit.

</details>

<details>
<summary><strong>Scorecard — Investment Playbook</strong></summary>

![Scorecard](docs/screenshot-scorecard.png)

ML pipeline visualization, SCAN feature importance, counterfactual analysis (+3.8 to +5.3 yr/ZIP), network-optimized placement strategy with satellite topology, per-placement MiroFish simulations, and neighborhood archetypes.

</details>

## Data Pipeline

```mermaid
flowchart TD
    subgraph "Raw Sources"
        S1[CDC PLACES API<br/>28 health measures<br/>218 census tracts]
        S2[Census ACS<br/>Income · Poverty<br/>Demographics]
        S3[FEMA SVI<br/>Social Vulnerability]
        S4[USDA · EPA<br/>Food Access · EJ]
        S5[MySidewalk<br/>Parks · Healthcare<br/>Workers]
    end

    subgraph "Processing"
        S1 & S2 & S3 & S4 & S5 --> P1[preprocess.py<br/>34 ZIPs × 50+ features]
        S1 --> P2[build_tract_dataset.py<br/>218 tracts × 29 features]
    end

    subgraph "Models"
        P2 --> M1[train_scan_model.py<br/>SCAN architecture]
        P1 --> M2[mirofish_deep.py<br/>1,035 agent simulation]
        M1 & M2 --> M3[generate_placements.py<br/>Optimal placement]
    end

    subgraph "Frontend"
        M1 --> F1[scan_model.json]
        M2 --> F2[simulation_results.json]
        M3 --> F3[placement_strategy.json]
        P1 --> F4[zipcode_data.json]
    end

    style M1 fill:#ff3c00,color:#fff,stroke:none
    style M2 fill:#0d9488,color:#fff,stroke:none
```

## Project Structure

```
jaxbridge/
├── app/                          React frontend
│   ├── src/
│   │   ├── pages/                6 pages: Landing, Atlas, Simulator, AgentGraph, Correlations, Scorecard
│   │   ├── components/           Nav, ZipDetailPanel, LoadingSkeleton, ui/
│   │   ├── lib/                  scoring.ts, nlInterventionParser.ts, useReveal.ts
│   │   └── data/                 useZipData.ts
│   └── public/
│       ├── data/                 Pre-computed JSON outputs
│       ├── geo/                  Duval County ZIP GeoJSON
│       └── images/               AI-generated mockup renders
├── pipeline/                     Python ML & data pipeline
│   ├── preprocess.py             Raw CSV → JSON
│   ├── build_tract_dataset.py    CDC PLACES API → 218-tract dataset
│   ├── train_scan_model.py       SCAN architecture + training
│   ├── mirofish_deep.py          1,035-agent simulation
│   ├── generate_placements.py    Network-optimized placement
│   ├── api_server.py             Flask API for live simulation
│   └── scrape_community_voices.py  Reddit data enrichment
├── data/Datasets/                Raw source CSVs
└── docs/                         Screenshots
```

## Getting Started

### Frontend

```bash
cd app
cp .env.example .env    # add Groq API key for NL features
npm install
npm run dev             # http://localhost:5175
```

Works standalone with pre-computed data. No Python or API keys needed for browsing.

### ML Pipeline (optional)

```bash
python3.11 -m venv .venv && source .venv/bin/activate
pip install torch numpy scikit-learn openai python-dotenv flask flask-cors zep-cloud shapely

python pipeline/preprocess.py            # Process raw CSVs
python pipeline/build_tract_dataset.py   # Pull 218 tracts from CDC API
python pipeline/train_scan_model.py      # Train SCAN
python pipeline/mirofish_deep.py         # Run 1,035-agent simulation
python pipeline/generate_placements.py   # Compute optimal placements
```

### Live Simulation API

```bash
python pipeline/api_server.py   # http://localhost:5001
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite 8, Tailwind CSS 4 |
| Visualization | Leaflet, react-force-graph-2d, Recharts |
| Animation | Lenis smooth scroll, CSS keyframes, IntersectionObserver |
| Neural Network | PyTorch (SCAN) |
| Agent Simulation | Groq LLM API, MiroFish pipeline, Zep Cloud |
| API | Flask |
| Data | CDC PLACES, Census ACS, FEMA SVI, USDA, EPA |

## License

MIT

<div align="center">
<sub>AI4Good Datathon 2026</sub>
</div>
