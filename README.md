# Triax — Revenue Margin Intelligence

> A production-grade **Retail & CPG decision-intelligence platform** that moves beyond volume-only
> Revenue Growth Management (RGM) into a unified **Revenue *Margin* Management (RMM)** framework,
> governed by a **3‑C Joint Optimization** constraint: every price, promotion, or assortment action is
> balanced simultaneously across **Company margin**, **Customer (retailer) margin**, and
> **Consumer willingness‑to‑pay (WTP)**.

**Live demo:** http://35.209.74.91 · **API docs (Swagger):** http://35.209.74.91/docs
**Repository:** https://github.com/gargsushantsrm2-pixel/retail-cpg-platform

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Repository Structure](#4-repository-structure)
5. [Data Model & Synthetic Data Generation](#5-data-model--synthetic-data-generation)
6. [Core Engineering Principles](#6-core-engineering-principles)
7. [The 3‑C Joint Optimization Framework (Mathematics)](#7-the-3c-joint-optimization-framework-mathematics)
8. [Guardrail Mathematics](#8-guardrail-mathematics)
9. [Analytics & Optimization Engines (Feature-by-Feature Math)](#9-analytics--optimization-engines-feature-by-feature-math)
10. [Legacy RGM Analytics (Mathematics)](#10-legacy-rgm-analytics-mathematics)
11. [Feature Registry & Progressive Scaffolding](#11-feature-registry--progressive-scaffolding)
12. [API Reference](#12-api-reference)
13. [Frontend Architecture](#13-frontend-architecture)
14. [Deployment](#14-deployment)
15. [Performance & Operational Notes](#15-performance--operational-notes)
16. [Author](#16-author)

---

## 1. Executive Summary

Traditional RGM optimizes **volume and revenue**. Triax reframes the problem as **margin**
optimization under a three-sided constraint. Concretely, for any commercial action $a$ (a price
change, a promotion, an assortment edit) the platform computes three normalized sub-scores

$$
s_{\text{company}}(a),\quad s_{\text{customer}}(a),\quad s_{\text{consumer}}(a) \in [0,1]
$$

and accepts $a$ only if their **weighted geometric mean** clears a threshold *and* a chain of
mathematical guardrails (WTP correlation, competitor corridor, charm rounding, change-frequency)
passes. If any guardrail trips, the system **falls back to a safe baseline** and emits telemetry.

The platform implements **44 features across 24 modules**, all backed by working engines and exposed
both as REST endpoints and an interactive React UI organized as a closed-loop workflow
(*Diagnose → Decide → Optimize → Execute → Monitor*).

---

## 2. System Architecture

```
                          ┌──────────────────────────────────────────────┐
                          │                  Browser (SPA)                │
                          │   React 18 + TS + Vite + Tailwind + Recharts  │
                          └───────────────┬──────────────────────────────┘
                                          │  HTTPS/HTTP  (relative /api/*)
                                          ▼
                          ┌──────────────────────────────────────────────┐
                          │             Nginx (reverse proxy)             │
                          │   /            → React static bundle (dist)   │
                          │   /api/*       → backend:8000/api/*           │
                          │   /docs,/openapi.json → backend (Swagger)     │
                          └───────────────┬──────────────────────────────┘
                                          │
                                          ▼
                          ┌──────────────────────────────────────────────┐
                          │              FastAPI (Uvicorn)                │
                          │  api/v1/*  routers  →  rmm/ engines           │
                          │  services/analytics.py  (RGM analytics)       │
                          │  rmm/{money,guardrails,three_c,features}      │
                          │  rmm/engines/{elasticity,promotions,...}      │
                          └───────────────┬──────────────────────────────┘
                                          │  SQLAlchemy 2.0 / pandas.read_sql
                                          ▼
                          ┌──────────────────────────────────────────────┐
                          │                 PostgreSQL 16                 │
                          │  products, customers, sales_data, ...         │
                          │  + RMM entities (Numeric/Decimal)             │
                          └──────────────────────────────────────────────┘
```

All three tiers run as containers via a single `docker-compose.yml`. Startup order is enforced with
health checks: `postgres → backend (seeds DB) → frontend`.

---

## 3. Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Recharts, TanStack Query v5, React Router v6, Lucide, react-hot-toast |
| **Backend** | Python 3.11, FastAPI, Uvicorn, SQLAlchemy 2.0, Pydantic v2 |
| **Data science** | NumPy, pandas, scikit-learn, statsmodels, SciPy (transitive) |
| **Database** | PostgreSQL 16 |
| **Infra** | Docker, Docker Compose, Nginx, GCP Compute Engine |

---

## 4. Repository Structure

```
retail-cpg-platform/
├── docker-compose.yml          # 3 services: postgres, backend, frontend
├── backend/
│   ├── Dockerfile
│   ├── init_db.py              # waits for DB → create_all → seed → uvicorn
│   ├── main.py                 # FastAPI app, routers, CORS, lifespan
│   ├── core/
│   │   ├── config.py           # Pydantic settings
│   │   └── database.py         # engine (echo=False), SessionLocal, Base
│   ├── models/
│   │   ├── entities.py         # Product, Customer, SalesData, ...
│   │   └── rmm_entities.py     # Numeric/Decimal RMM tables
│   ├── services/
│   │   ├── analytics.py        # RGM analytics + in-memory result cache
│   │   └── data_generator.py   # synthetic data simulator
│   ├── rmm/
│   │   ├── money.py            # Decimal fixed-point primitives
│   │   ├── guardrails.py       # validation gate framework
│   │   ├── features.py         # 44-feature registry + tiers
│   │   ├── three_c.py          # 3-C joint optimization core
│   │   └── engines/
│   │       ├── base.py         # OptimizationEngine ABC, EngineResult
│   │       ├── elasticity.py   # F1/F2/F22/F23
│   │       ├── promotions.py   # F4/F6
│   │       ├── trade_terms.py  # F9/F10/F11
│   │       ├── governance.py   # F18/F28/F33/F34/F36/F40
│   │       ├── consumer.py     # F24/F26/F27
│   │       ├── pricing_arch.py # F3/F7/F8/F35/F44
│   │       ├── demand.py       # F12/F13/F20/F21
│   │       ├── investment.py   # F16/F17/F19
│   │       └── platform.py     # F14/F15/F39/F41/F43
│   └── api/v1/                 # executive, rgm, category, forecasting,
│                               # supply_chain, commercial, data,
│                               # rmm, rmm_tpm, rmm_ext
└── frontend/
    ├── Dockerfile, nginx.conf
    └── src/
        ├── api/{client,queries,rmm}.ts
        ├── components/{layout,ui,charts}/
        ├── lib/{chartTheme,utils,guides}.ts
        └── pages/{...}, pages/rmm/{...}
```

---

## 5. Data Model & Synthetic Data Generation

### 5.1 Core tables

| Table | Grain | Key fields |
|---|---|---|
| `products` | SKU | `product_id, sku_name, brand, category, subcategory, pack_size, base_price, cogs, gross_margin_pct` |
| `customers` | Retail account | `customer_id, channel, region, tier, volume_share_pct` |
| `sales_data` | SKU × Customer × Week | `volume_cases, list_price, net_price, revenue, cogs, gross_profit, promo_flag, promo_type, promo_discount_pct, baseline_volume, incremental_volume` |
| `inventory_data` | SKU × Warehouse × Week | `on_hand_cases, in_transit_cases, weeks_of_cover, oos_flag, reorder_point` |
| `market_data` | Category × Brand × Week | `total_market_volume, brand_volume, volume_share_pct, avg_selling_price` |
| `forecast_data` | SKU × Customer × Week | `forecast_volume, lower_bound, upper_bound` |

### 5.2 RMM entities (fixed-point `Numeric`)

`pricing_guardrail_config`, `commodity_cost`, `trade_fund_ledger`, `three_c_score`,
`promo_template`, `promo_event`, `deal_approval`, `trade_claim`. Money columns use
`Numeric(p, s)` so PostgreSQL stores exact decimals (no float drift).

### 5.3 Dataset scale

The seed is deliberately compact for fast analytics on a small host:

$$
\underbrace{10\ \text{SKUs}}_{\text{2 per category} \times 5}\ \times\ \underbrace{4\ \text{customers}}_{\text{WMT, KRG, TGT, CST}}\ \times\ \underbrace{105\ \text{weeks}}_{\text{2 yr weekly}} \approx 4{,}200\ \text{sales rows}
$$

### 5.4 Demand simulation model

Weekly volume for SKU $i$, customer $c$, week $t$ is generated as a multiplicative model:

$$
Q_{i,c,t} = B_{i,c}\cdot \sigma_{\text{cat}(i)}(m_t)\cdot \tau_{i}(t)\cdot \varepsilon_t \cdot \underbrace{(1-d_{i,c,t})^{\,\beta_i}}_{\text{price effect}} \cdot \underbrace{(1+\ell_{i,c,t})}_{\text{promo lift}}
$$

where

- $B_{i,c} = v_{\text{cat}(i)} \cdot \text{volshare}_c \cdot U(0.8,1.2)$ — base velocity scaled by customer size,
- $\sigma_{\text{cat}}(m)$ — category-month **seasonality index** (a 12-vector per category),
- $\tau_i(t) = 1 + (g_{\text{cat}(i)}/52)\,t$ — linear annual **trend** (growth rate $g$ by category),
- $\varepsilon_t \sim \mathcal{N}(1, 0.06^2)$ — multiplicative **noise**,
- $\beta_i < 0$ — SKU **price elasticity**; $d$ is the promo discount fraction so $(1-d)^{\beta}>1$,
- $\ell$ — promo mechanic **lift** drawn from type-specific ranges (TPR $0.15$–$0.25$, …, Display+Feature+TPR $0.65$–$1.00$).

List prices apply a YoY increase of $3.5\%$: $P_t = P_0\,(1 + 0.035\,\Delta\text{year})$.
Incremental volume is recovered as $Q_{\text{incr}} = \max(0,\,Q - Q_{\text{baseline}})$ on promoted weeks.

---

## 6. Core Engineering Principles

These map to the four integration rules the platform was built under.

### 6.1 Fixed-point money (`rmm/money.py`)
All margin math routes through `Decimal` to avoid binary-float drift across gross-to-net waterfalls.

- `D(x)` coerces via `str(x)` to avoid `Decimal(0.1)` artifacts.
- Money quantized to $10^{-4}$; percentages to $10^{-6}$; display to $10^{-2}$.
- Zero-safe division: $\text{safe\_div}(a,b)=a/b$ if $b\neq 0$ else $0$.
- $\text{margin\_pct}(P,C)=\dfrac{P-C}{P}$ (returns 0 if $P=0$).

### 6.2 Guardrail framework (`rmm/guardrails.py`)
A `Guardrail` ABC with `.evaluate(ctx) → GuardrailResult{status, message, adjusted_value, telemetry}`.
Statuses: `PASS | WARN | BLOCK | SAFE_BASELINE`. A chain runs gates in order; a clamped value from one
feeds the next; any `BLOCK` ends the chain and returns the **baseline** value.

### 6.3 In-memory result cache (`services/analytics.py`)
Seeded data is immutable post-startup, so every analytics function is wrapped by a `@_cached`
decorator keyed by `(function, args)`. First call computes; subsequent calls are $O(1)$.

### 6.4 Engine abstraction (`rmm/engines/base.py`)
Every engine subclasses `OptimizationEngine` and returns an `EngineResult{ok, data, safe_baseline,
telemetry, message}`. Engines never raise on thin data — they call `self._baseline(...)`.

---

## 7. The 3‑C Joint Optimization Framework (Mathematics)

Implemented in `rmm/three_c.py`. Inputs are three profiles; outputs are three sub-scores and a joint
score.

### 7.1 Company axis

Given our net price $P$, unit cost $C$, and target gross margin $m^\*$:

$$
\mu = \frac{P - C}{P}, \qquad s_{\text{company}} = \mathrm{clip}_{[0,1]}\!\left(\frac{\mu}{m^\*}\right)
$$

i.e. full score once actual margin reaches target, degrading linearly toward 0.

### 7.2 Customer (retailer) axis

Given shelf price $R$, the retailer's cost (= our price) $P$, and contractual margin floor $f$:

$$
\mu_R = \frac{R - P}{R}, \qquad
s_{\text{customer}} =
\begin{cases}
1 & \mu_R \ge f \\[4pt]
\mathrm{clip}_{[0,1]}\!\left(\dfrac{\mu_R}{f}\right) & \mu_R < f
\end{cases}
$$

### 7.3 Consumer axis

Given proposed price $P$ and WTP distribution summaries (median $w_{50}$, 90th pct $w_{90}$), define the
**headroom ratio**

$$
h = \frac{P - w_{50}}{w_{90} - w_{50}}, \qquad
s_{\text{consumer}} =
\begin{cases}
1 & h \le 0 \quad(\text{at/below median}) \\
1 - h & 0 < h < 1 \\
0 & h \ge 1 \quad(\text{past the cliff})
\end{cases}
$$

### 7.4 Joint score (weighted geometric mean)

With weights $w=(0.34, 0.33, 0.33)$ summing to $W$:

$$
S_{\text{joint}} = \exp\!\left(\frac{1}{W}\sum_{k\in\{\text{co,cu,cn}\}} w_k \ln s_k\right)
\quad\Longrightarrow\quad
S_{\text{joint}} = 0 \ \text{if any } s_k = 0.
$$

The geometric mean is the mathematical heart of "joint" optimization: a near-zero on **any** axis
collapses the total, so a strong company margin cannot paper over a broken retailer margin. The
**binding constraint** is $\arg\min_k s_k$. Rating: **GREEN** $\ge 0.80$, **AMBER** $\ge 0.55$, else **RED**
(displayed as $100\cdot S_{\text{joint}}$).

---

## 8. Guardrail Mathematics

| Gate (feature) | Rule |
|---|---|
| **WTP 95% gate** (F25) | If predicted-vs-actual WTP correlation $\rho < 0.95$ → **BLOCK**, force flat baseline price. |
| **Competitor corridor** (F30) | Clamp $P$ to $[\phi\cdot P_{\text{comp}},\ \psi\cdot P_{\text{comp}}]$ with floor index $\phi$, ceiling index $\psi$. |
| **Charm rounding** (F31) | Snap to nearest dollar then apply allowed ending $e$ (e.g. $.95$): choose $\arg\min$ over $\{\lfloor P\rfloor\!-\!1\!+\!e,\ \lfloor P\rfloor\!+\!e\}$ of $|P-\cdot|$; ban $.99$. |
| **Change frequency** (F29) | If structural changes YTD $\ge N_{\max}$ (default 2/yr/region) → **BLOCK**. |
| **3‑C intercept** (F19) | **BLOCK** if $s_{\text{company}}<\theta_1 \lor s_{\text{customer}}<\theta_2 \lor s_{\text{consumer}}<\theta_3$ (defaults $0.4$). |

The chain returns `allowed=False, final_value=baseline_price` on the first BLOCK; otherwise the
sequentially clamped/rounded `final_value`.

---

## 9. Analytics & Optimization Engines (Feature-by-Feature Math)

### Module 1 / 10 — Elasticity & non-linear demand (`elasticity.py`)

**F1/F22 — Log-log elasticity.** For observations $(P_k, Q_k)$ with $P_k,Q_k>0$, fit OLS

$$
\ln Q = \alpha + \beta\,\ln P + \epsilon,\qquad \hat\beta = \frac{\sum (\ln P_k-\overline{\ln P})(\ln Q_k-\overline{\ln Q})}{\sum(\ln P_k-\overline{\ln P})^2},
$$

$\hat\beta$ **is** the price elasticity. Goodness of fit $R^2 = 1 - \frac{\sum(\ln Q_k-\widehat{\ln Q}_k)^2}{\sum(\ln Q_k-\overline{\ln Q})^2}$.
The **context matrix** computes $\hat\beta$ separately on four slices: *isolated* (non-promo weeks),
*promotional* (promo weeks), *brand-wide* (weekly brand aggregate), *category-wide* (weekly category
aggregate). Slices with $<10$ points or $<3$ distinct prices fall back to $\beta = -2.0$ (safe baseline).

**F23 — Non-linear demand core.** Fit both a linear demand $Q = a + bP$ and a constant-elasticity
power law $Q = a\,P^{b}$ (via log-log), compare $R^2$, and emit a pass-through rule:

$$
\text{rule} =
\begin{cases}
\textbf{half-cost absolute pass-through} & R^2_{\text{lin}} \ge R^2_{\text{pow}} \\
\textbf{constant gross-margin \%} & \text{otherwise.}
\end{cases}
$$

(Linear demand → optimal profit passes through ~50% of an absolute cost change; constant-elasticity →
maintain a constant GM%.)

**F2 — Cannibalization.** For target SKU price series and each sibling's weekly volume, compute
$\rho_j = \mathrm{corr}(Q^{\text{sib}}_j,\, P^{\text{target}})$. Own-portfolio **recapture ratio**
$r = \min\!\big(1,\ \sum_j \max(0,\rho_j)\big)$; **competitor leakage** $= (1-r)\cdot 100\%$.

### Module 2 — Trade promotion (`promotions.py`)

**F4 — Predictive promo simulator.** With clamped elasticity $\beta\in[1,4]$, discount $d$, mechanic
lift $\ell$ (type midpoint), duration $T$:

$$
Q_{\text{promo}} = B\,(1-d)^{-\beta}(1+\ell),\quad
\text{lift} = \frac{Q_{\text{promo}}-B}{B}
$$

$$
\text{net} = T\big[Q_{\text{promo}}(P_d - C) - B(P - C)\big] - \text{fees},\quad
\text{spend} = T\,Q_{\text{promo}}\,P\,d + \text{fees},\quad
\text{ROI} = \frac{\text{net}}{\text{spend}}
$$

where $P_d = P(1-d)$. Net profit is the **true incremental** (promo GP − baseline GP − fixed fees), so
its sign is always consistent with ROI.

**F6 — Post-event balanced ROI.** From realized POS, per promo type: incremental revenue
$\sum Q_{\text{incr}}P_d$, trade spend $\sum Q\,P_{\text{list}}\,d$, realized lift
$\sum Q_{\text{incr}}/\sum Q_{\text{base}}$, company ROI, and retailer GM — side by side.

### Module 4 — Trade terms / G2N (`trade_terms.py`)

- **F9 — Deal approval.** $\mu = (P(1-d)-C)/(P(1-d))$; if $\mu < \theta$ → **escalate to Finance**, else auto-approve. Persists to `deal_approval`.
- **F10 — Trade fund guardrail.** Uncommitted $= \text{allocated}-\text{committed}$; a commit of $x$ is blocked if $x>\text{uncommitted}$.
- **F11 — Claims reconciliation.** Variance $= \text{claim}-\text{contracted}$; variance $>0$ ⇒ **DISPUTED** (unauthorized leakage).

### Modules 11/12/13 — Consumer science (`consumer.py`)

**F27 — Agent-based virtual shopper (random-utility / multinomial logit).** For $N$ agents over $J$
SKUs plus an outside option, agent $i$'s utility for SKU $j$ is

$$
U_{ij} = \alpha_{ij} - \beta_i P_j + \epsilon_{ij},\qquad
\beta_i \sim \mathrm{Gamma}(3,\,0.03),\ \ \alpha_{ij}\sim\mathcal N(0,1),\ \ \epsilon_{ij}\sim \mathrm{Gumbel}(0,1)
$$

with outside utility $U_{i0} = -1.5 + \epsilon_{i0}$. Each agent chooses $\arg\max_j U_{ij}$; predicted
share $\hat\pi_j = \frac1N\sum_i \mathbf 1[\text{choice}_i = j]$. A price shock on one SKU re-runs the
simulation to measure substitution (where the lost share migrates, including to no-purchase). This
replaces generic LLM estimation with an explicit discrete-choice micro-simulation.

**F24 — Raw WTP distribution (anti-aggregation).** Sample WTP as a 3-component Gaussian mixture
(value/mainstream/premium segments centered at $0.78/1.02/1.45 \times \bar P$). The **demand curve** is the
survival function $S(p) = \Pr[\text{WTP} \ge p]$; **drop-off cliffs** are the grid points maximizing
$-\Delta S$ (steepest share loss) — the gaps a single "average WTP" hides.

**F26 — Survey calibration.** Smooth the raw stated-intent step function with a monotone
(cumulative-min) pass + 3-point moving average, then apply an outside-option correction
$\text{calibrated}(p) = \text{smoothed}(p)\cdot\big(1 - \lambda\cdot \text{rank}(p)\big)$, converting
"buy-or-nothing" intent into realistic shelf choice. Reports the average realism gap.

### Modules 1/3/18/24 — Price-pack architecture (`pricing_arch.py`)

- **F7 — Per-ounce matrix.** Parse pack `N x M oz` ⇒ total $=NM$ oz; report price/oz $=P/NM$ and margin/oz $=(P-C)/NM$.
- **F3 — Competitor index.** Index $=P_{\text{ours}}/\bar P_{\text{comp}}$; alert if outside $[\phi,\psi]$.
- **F8 — Premiumization.** In each category's sorted price ladder, the largest gap $\max_k(P_{k+1}-P_k)$ is white-space; suggest the midpoint.
- **F35 — Tier editor.** Terciles of price → Good/Better/Best; flag spacing violations where $\frac{\bar P_{\text{next}}-\bar P_{\text{cur}}}{\bar P_{\text{cur}}} < 15\%$.
- **F44 — Attribute value index.** $V = \big(0.4\,\tilde b + 0.35\,\tilde\mu + 0.25\,\tilde p\big)\cdot 100$, with normalized brand equity $\tilde b=\min(b/30,1)$, margin $\tilde\mu=\min(\mu/60,1)$, price premium $\tilde p=\min((P/\bar P_{\text{cat}})/1.6,1)$.

### Modules 5/9 — Demand & assortment (`demand.py`)

- **F12 — Store assortment.** Weekly velocity $=\frac{\text{volume}}{\#\text{weeks}}$; SKUs at/below the customer's $20$th percentile → **DELIST**.
- **F13 — Forecast + disruption.** Adjustment factor $\kappa = (1 - 0.004\cdot\text{infl}\%)(1 - \text{supply}\%/100)$ applied to the forward forecast and its bounds.
- **F20 — Segmented demand.** For segment $s$ with elasticity $\beta_s$ and switch-bias $b_s$: $\Delta Q_s = \beta_s\,\Delta p$; lost $=\max(0,-\Delta Q_s)$; switch-to-competitor $=$ lost$\cdot b_s$; drop-out $=$ lost$\cdot(1-b_s)$; blended $\Delta Q = \sum_s \text{share}_s\,\Delta Q_s$.
- **F21 — Promo timing.** Seasonality index $\sigma_m = \text{vol}_m/\overline{\text{vol}}$; peaks ($\ge1.10$) → avoid promo; troughs ($\le0.92$) → promote.

### Modules 7/8 — Investment & deals (`investment.py`)

**F19 — B2B deal pricer.** Win probability is logistic in the discount $d$ vs competitor benchmark $d_0$:

$$
\Pr(\text{win}\mid d) = \frac{1}{1+e^{-25(d - d_0)}},\qquad
\mathrm{EV}(d) = \Pr(\text{win}\mid d)\cdot V\big(P(1-d) - C\big)
$$

for committed volume $V$. Optimal discount $d^\* = \arg\max_d \mathrm{EV}(d)$ over a grid.

**F17 — Cross-lever investment optimizer.** Maximize concave return subject to budget $B$:

$$
\max_{x_1,x_2,x_3}\ \sum_i a_i\sqrt{x_i}\quad\text{s.t.}\ \sum_i x_i = B,\ x_i\ge0,
$$

with $a=(3.2, 2.6, 3.8)$ for (brand marketing, trade spend, NPD). Solved by greedy marginal allocation
(each increment to the lever with the highest marginal return $a_i(\sqrt{x_i+\delta}-\sqrt{x_i})$),
which converges to the KKT condition of equalized marginal returns.

**F16 — Decision guides.** For the lowest-margin SKUs under a cost spike $c\%$: prescribe a
$+\tfrac{c}{2}\%$ list increase (half-cost pass-through), $-10\%$ promo frequency, and $-5\%$ pack size.

### Module 14/16/17 — Governance (`governance.py`)

- **F18 — Cost-to-serve.** Inject per-case logistics cost $\gamma$ into COGS: $\mu_{\text{w/}} = \frac{P_d-(C+\gamma)}{P_d}$; flag if $\mu_{\text{w/}}<0$ or $< \tfrac12\mu_{\text{w/o}}$.
- **F28 — Commodity exposure.** COGS impact $= \sum_k \text{formulation}_k \cdot \text{shock}$ (formulation = share of COGS).
- **F33 — Complexity friction.** Net $=$ uplift $-$ (setup $+$ carry); recommend standard catalog if net $\le 0$.
- **F34 — Maturity assessment.** Weighted capability scores from data-asset presence; overall $=$ mean; localized step-up tasks for dimensions $<70$.
- **F36 — Price-smoothing alert.** **BLOCK** blanket changes if $\mathrm{std}(\%\Delta)<0.005$ or $\mathrm{std}(\$\Delta)<0.01$ across $\ge3$ items.
- **F40 — SKU governor.** Prune candidates: revenue $\le$ percentile **and** GM% $<$ floor.

### Modules 6/20/21/23 — Platform (`platform.py`)

- **F14** ingestion/harmonization status, **F15** OpenAPI catalog, **F41** role views, **F43** omni-channel (online = dynamic, B&M = shelf-reset cadence).
- **F39 — Workflow orchestrator.** Parallel checkpoints: **Finance** (GM $\ge$ threshold), **Supply** (WoC $\ge$ min), **Brand** ($|\Delta P|\le 15\%$). Approved $\iff$ all PASS.

---

## 10. Legacy RGM Analytics (Mathematics)

In `services/analytics.py`:

**Revenue waterfall (Price/Mix/Volume bridge), CY vs PY, per SKU:**

$$
\text{Volume effect} = \sum_i (Q_i^{cy}-Q_i^{py})\,P_i^{py},\quad
\text{Price effect} = \sum_i (P_i^{cy}-P_i^{py})\,Q_i^{py},
$$
$$
\text{Mix effect} = \sum_i (Q_i^{cy}-Q_i^{py})(P_i^{cy}-P_i^{py}).
$$

**Forecast accuracy:**

$$
\text{MAPE}=\frac1n\sum\frac{|A_t-F_t|}{\max(A_t,1)},\quad
\text{WMAPE}=\frac{\sum|A_t-F_t|}{\sum A_t},\quad
\text{Bias}=\frac{\sum(A_t-F_t)}{\sum A_t},\quad \text{FA}=100-\text{WMAPE}.
$$

**Demand decomposition:** centered 13-week rolling mean for trend $T_t$; seasonal $= Q_t - T_t$;
irregular $= Q_t - T_t - \text{seasonal}$. **Holt-Winters** (statsmodels `ExponentialSmoothing`,
additive trend + seasonal, period 52) is used for the fitted forecast when $\ge24$ points exist.

**Inventory:** Weeks-of-Cover $= \text{on\_hand}/\text{weekly demand}$; fill rate $=(1-\text{OOS rate})\cdot100$.

**Customer P&L:** net revenue $=$ gross $-$ trade spend; trade spend $=\sum \text{rev}\cdot d$;
contribution $=$ GP $-$ trade $-$ SG&A (SG&A $\approx 8\%$ of net).

---

## 11. Feature Registry & Progressive Scaffolding

`rmm/features.py` is the single source of truth for all 44 features. Each carries a **maturity tier**

$$
\text{DIAGNOSTIC} \prec \text{INDEXING} \prec \text{PREDICTIVE} \prec \text{PRESCRIPTIVE}
$$

and an implementation status (`LIVE` vs `SCAFFOLD`). `is_enabled(id)` gates each endpoint — disabled or
gated features return **423 Locked** rather than failing. `GET /api/v1/rmm/features` returns the full
registry summary (counts by tier, per-module feature lists). All 44 are currently **LIVE**.

---

## 12. API Reference

Base path `/api/v1`. Selected endpoints (full interactive list at `/docs`):

| Group | Endpoint | Feature |
|---|---|---|
| Registry | `GET /rmm/features` | M22 |
| 3‑C | `POST /rmm/three-c/score` | F37/F38 |
| Elasticity | `POST /rmm/elasticity/context-matrix?product_id=` | F1/F22/F23 |
| Elasticity | `POST /rmm/cannibalization?product_id=&price_change_pct=` | F2 |
| Guardrails | `POST /rmm/guardrails/evaluate` | F25/F29/F30/F31 |
| TPM | `POST /rmm/tpm/simulate` · `POST /rmm/tpm/post-event-roi` | F4/F6 |
| TPM | `GET/POST /rmm/tpm/calendar` (+`/{id}/copy`, templates) | F5 |
| G2N | `POST /rmm/g2n/approve` · `GET/POST /rmm/g2n/trade-fund(/allocate,/commit)` · `POST /rmm/g2n/claims/reconcile` | F9/F10/F11 |
| Consumer | `GET /rmm/consumer/wtp-distribution` · `POST /rmm/consumer/survey-calibration` · `GET /rmm/consumer/agent-sim` | F24/F26/F27 |
| PPA | `GET /rmm/ppa/{per-ounce,competitor-index,premiumization,tiers,value-index}` | F7/F3/F8/F35/F44 |
| Demand | `GET /rmm/demand/{assortment,forecast-disruption,segmented,promo-timing}` | F12/F13/F20/F21 |
| Investment | `GET /rmm/invest/{b2b-pricer,optimize,decision-guides}` | F19/F17/F16 |
| Governance | `GET /rmm/{maturity,sku-governor,commodity/exposure}` · `POST /rmm/{cost-to-serve,complexity-friction,price-smoothing/check}` | F34/F40/F28/F18/F33/F36 |
| Platform | `GET /rmm/platform/{ingestion,openapi-catalog,stakeholder,omni-channel,workflow}` | F14/F15/F41/F43/F39 |

All POST payloads are strictly typed via Pydantic v2 with bounded fields (`gt`, `ge`, `le`,
`min_length`). Engine responses share the envelope `{ feature_id, ok, safe_baseline, message,
telemetry, data }`.

---

## 13. Frontend Architecture

- **Routing/Layout:** React Router v6; a single `Layout` with a responsive off-canvas sidebar
  (hamburger drawer on mobile, static on desktop), a sticky top bar, and a route-driven
  `SectionGuide` ("how to use this section") rendered from `lib/guides.ts`.
- **Data layer:** TanStack Query v5 hooks wrap an axios client (`baseURL=/api/v1`); 5-min `staleTime`.
- **Navigation** follows the closed loop: **Command Center → Diagnose → Decide (levers) → Optimize →
  Execute & Monitor → Reference.**
- **Command Center** is a role-aware home that *pushes* competitor-breach alerts (F3) and cost-spike
  decision guides (F16), with portfolio KPIs and playbook launchers.
- **Charts:** Recharts with a centralized dark theme; a custom waterfall built from stacked bars.

---

## 14. Deployment

### 14.1 Local (Docker)

```bash
git clone https://github.com/gargsushantsrm2-pixel/retail-cpg-platform.git
cd retail-cpg-platform
# build the frontend bundle once (served via the mounted ./frontend/dist)
cd frontend && npm install && npm run build && cd ..
docker compose up --build
# App → http://localhost   ·   API docs → http://localhost/docs
```

The backend container waits for Postgres, runs `create_all`, seeds ~4,200 rows if empty, then starts
Uvicorn. To re-seed after changing the generator: `docker compose down -v && docker compose up -d`.

### 14.2 Cloud (GCP)

Runs on a GCP Compute Engine VM behind Nginx. Because the host is memory-constrained, the deploy
**avoids building the frontend on the VM** (the npm/vite build OOMs ~1 GB hosts): the bundle is built
locally and the static `dist/` is shipped and mounted into the Nginx container; backend source is
volume-mounted so code changes apply on `docker compose restart backend` (no image rebuild). A 2 GB
swapfile backstops the pandas analytics.

---

## 15. Performance & Operational Notes

- **SQLAlchemy `echo=False`** and **in-memory result caching** make cached analytics responses
  effectively instant; cold endpoints respond in well under a second on ~4k rows.
- Engines **degrade gracefully**: insufficient price variation or missing feeds yield a labeled
  `safe_baseline` payload instead of an error.
- Money math is **exact** (`Decimal`/`Numeric`); pandas column math stays in float and is wrapped back
  to `Decimal` only at boundaries (mixing the two raises `TypeError`).

---

## 16. Author

**Sushant Garg** — Full-Stack & Data/AI Engineer · Builder of Triax
*Open to Contract & Full-time opportunities.*

- 📞 +91 90878 60807
- ✉️ sgargandcompany@gmail.com
- 💼 https://www.linkedin.com/in/garg-sushant/
- 🌐 https://sushantgarg.netlify.app

© 2026 **Sushant Garg & Co.** All rights reserved.
