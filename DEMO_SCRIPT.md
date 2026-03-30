# JaxBridge Demo Script — 5 Minutes, 3 Speakers
## Team Stanton-4 / AI4Good Datathon 2026

**Roles:**
- **A** — Storyteller (opens & closes, handles the narrative)
- **B** — Tech lead (SCAN architecture, model defense, evidence page)
- **C** — Demo driver (controls laptop, types, clicks, reads agent quotes)

**Setup:** Chrome fullscreen on localhost:5175. API server running. Hide bookmarks bar. Practice handoffs.

---

## 0:00–0:40 — THE PROBLEM [Speaker A]

*[Hero page visible]*

**A:** Imagine two families in Jacksonville. One lives in ZIP 32209, the other twenty miles east in Neptune Beach. Same city, same county. One family's expected lifespan? 68 years. The other? 83. That's a fourteen-year difference, and it comes down to what's available in your neighborhood.

*[C scrolls to "TWO ZIP CODES. ONE CITY."]*

**A:** 32209 — thirty thousand people, median income $30K, half the adults are obese, almost no doctors. Neptune Beach — high income, low obesity, plenty of healthcare. We asked: what's actually driving this gap, and what would it take to close it?

*[C scrolls past methodology cards, pauses on the "1,035 agents" section]*

**A:** We didn't just analyze the data. We simulated a thousand Jacksonville residents as AI agents and asked them: if we put a clinic here, would you go?

## 0:40–1:00 — THE MAP [Speaker C]

*[C clicks ATLAS in nav]*

**C:** Every polygon is a real ZIP code boundary. Red means the biggest resource gaps. I'll switch to life expectancy —

*[C clicks "Life Expectancy" layer]*

**C:** Same neighborhoods. The places missing doctors and groceries are the same places where people die youngest. Now let me show you how we design a fix.

## 1:00–2:10 — THE SIMULATOR [Speaker C, then B]

*[C navigates to /simulator/32209]*

**C:** This is 32209, the most underserved ZIP. Instead of dragging sliders around, I can just describe what I want to build.

*[C types: "Build a community health center with 8 doctors, a mental health clinic, a grocery store with nutrition classes, and 30 acres of green space"]*

*[C clicks DESIGN WITH AI]*

**C:** It parsed the whole thing — eight physicians, five mental health providers, a grocery store, thirty acres of parks. About seven million a year. And look at the gauge — life expectancy goes from 68.7 up to [read number]. That's [X] additional years for 34,000 people.

**B** *(stepping in)*: Those numbers aren't from a linear regression. We built something called SCAN — a Spatial Causal Attention Network. Two things make it different from a standard model.

First, it knows that neighborhoods are connected. Build a clinic in 32209 and 32254 next door benefits too. We model that with a Graph Attention Network across 218 census tracts and 5,000 spatial edges.

Second, it knows causation has a direction. We encode five tiers from epidemiology — poverty causes insurance gaps, insurance gaps cause skipped checkups, skipped checkups cause unmanaged chronic disease. The model can only learn forward through that chain. It can't learn that heart disease causes poverty.

Result: R-squared 0.99 on five-fold cross-validation. Mean absolute error, less than five weeks of life. Every projection on this page comes from that model.

## 2:10–3:10 — THE AGENTS [Speaker C, then A]

*[C scrolls to MiroFish card, clicks "RUN LIVE AGENT SIMULATION" or navigates to /agents]*

**C:** So the model says it'll work. But will people actually show up? We export the exact intervention into MiroFish — our agent simulation engine.

*[Agents page loads — graph visible]*

**C:** 1,035 simulated residents. Each one has a role, an age, health conditions, transportation access, insurance status. They react to our proposed clinic as if it were posted in their community.

*[C points to adoption rate and per-ZIP breakdown]*

**C:** [X]% said they'd use it. Highest adoption in 32254 at [X]%, the target ZIP at [X]%. The barriers that came up most? Transportation and cost.

*[C clicks an agent node]*

**C:** This is [read name] — [role], age [X], ZIP [read ZIP]. Their response: "[read first sentence of quote]."

**A** *(stepping in)*: That's not a statistic. That's a simulated resident telling us what they actually need. And when you see a thousand of those voices pointing in the same direction, you know the intervention has real demand behind it.

## 3:10–3:50 — THE EVIDENCE [Speaker B]

*[C navigates to /correlations]*

**B:** Everything we showed is backed by this. Poverty rate is the number one predictor of life expectancy — not obesity, not physician access. SCAN's attention weights show poverty is the root. It cascades into insurance, disability, food access, and health outcomes.

*[B gestures at SCAN panel — don't read every number]*

**B:** Full correlation matrix on the left. SCAN architecture and causal interactions on the right. And at the bottom — we audited the AI. Where it was right, where we corrected it, and a finding it initially called an error: wealthy neighborhoods show higher depression rates because they have providers who diagnose it. That insight changed how we model mental health interventions.

## 3:50–4:40 — THE PLAYBOOK [Speaker B, then C]

*[C navigates to /scorecard]*

**B:** So where should the city invest? Three placements, each with its own simulation. Health center in 32209, grocery co-op in 32208, wellness park in 32210. Total cost: $8.5 million per year. 133,000 residents served.

*[C expands the first placement card]*

**C:** Each placement has a report — target ZIP, population, RDCS score, MiroFish adoption rate, agent voices, spillover neighborhoods, and fallback locations if the primary site isn't available.

*[C points at the satellite topology map]*

**C:** And this is the spatial network — where resources connect, where spillover flows, which neighborhoods benefit from each placement.

## 4:40–5:00 — THE CLOSE [Speaker A]

**A:** JaxBridge answers Problem 1 from start to finish. What are the biggest threats to life expectancy in Jacksonville? Poverty, cascading into everything else. What can be done? We let you design an intervention in plain English, forecast its impact with a novel neural network, and validate it against a thousand simulated residents — before a single dollar is spent.

**A:** Fourteen years separate the richest and poorest neighborhoods in this city. JaxBridge is how you start closing that gap. Thank you.

---

## IF JUDGES ASK

**"R-squared 0.99 seems too high."**
> Five-fold cross-validation, not training accuracy. 33,000 parameters on 218 census tracts. Plus physics-informed loss — monotonicity and smoothness constraints from epidemiology — which explicitly prevents overfitting.

**"How realistic are the agents?"**
> Each persona is built from CDC and Census demographics for their ZIP, enriched with real community concerns from r/jacksonville. The LLM generates in-character reactions based on their specific conditions, income, and transportation.

**"Where's the data from?"**
> CDC PLACES 2023 at census tract level, Census ACS 2020-2024, FEMA SVI 2022, USDA Food Access Atlas. All public, all at the finest available resolution.

**"What makes SCAN novel?"**
> It combines graph attention for spatial spillover with causal feature masking and physics-informed loss. The causal mask encodes five tiers of epidemiological causation. This specific combination hasn't been applied to health equity prediction before.

**"Why poverty and not insurance?"**
> Our earlier Random Forest ranked insurance highest. But SCAN's attention weights show poverty is upstream — it causes the insurance gap, the disability, and the vulnerability score. Treating insurance alone is treating a symptom.

**"What does $8.5M actually buy?"**
> Health center: ~$3.5M based on HRSA benchmarks. Grocery co-op: ~$2M per USDA estimates. Wellness park: ~$3M per NRPA data. All published cost references.

**"How is this different from a dashboard?"**
> Dashboards show what is. JaxBridge shows what could be. You type what you want to build, and it tells you whether it'll work — backed by a neural network and a thousand simulated voices.
