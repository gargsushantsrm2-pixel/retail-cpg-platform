import PageHeader from '../components/ui/PageHeader'
import { Tabs } from '../components/ui/Tabs'

const TABS = [
  { id: 'foundations', label: 'Foundations' },
  { id: 'threec', label: '3-C Framework' },
  { id: 'guardrails', label: 'Guardrails' },
  { id: 'engines', label: 'Engine Formulas' },
  { id: 'rgm', label: 'RGM Formulas' },
  { id: 'glossary', label: 'Glossary' },
]

// Styled monospace formula block + small helpers
const F = ({ children }: any) => (
  <div className="my-2 px-4 py-2.5 rounded-lg bg-bg-elevated border border-border font-mono text-xs text-accent-cyan overflow-x-auto whitespace-pre">{children}</div>
)
const H = ({ children }: any) => <h3 className="text-sm font-semibold text-text-primary mt-5 mb-1.5">{children}</h3>
const P = ({ children }: any) => <p className="text-sm text-text-secondary leading-relaxed">{children}</p>
const Card = ({ children }: any) => <div className="card p-5 mb-4">{children}</div>

export default function Methodology() {
  return (
    <div className="animate-slide-in">
      <PageHeader title="Methodology & Glossary"
        subtitle="The mathematics behind Triax — every engine, guardrail, and term, documented" />
      <Tabs tabs={TABS}>{(a) => (<>
        {a === 'foundations' && <Foundations />}
        {a === 'threec' && <ThreeC />}
        {a === 'guardrails' && <Guardrails />}
        {a === 'engines' && <Engines />}
        {a === 'rgm' && <RGM />}
        {a === 'glossary' && <Glossary />}
      </>)}</Tabs>
    </div>
  )
}

function Foundations() {
  return (
    <>
      <Card>
        <H>What Triax optimizes</H>
        <P>Classic RGM optimizes volume and revenue. Triax optimizes <b>margin</b> under a three-sided
          constraint. For any action <i>a</i> (price / promo / assortment) it computes three normalized
          sub-scores and accepts <i>a</i> only if their weighted geometric mean clears a threshold and a
          chain of guardrails passes — otherwise it falls back to a safe baseline.</P>
        <F>s_company(a), s_customer(a), s_consumer(a) ∈ [0, 1]</F>
      </Card>
      <Card>
        <H>Fixed-point money</H>
        <P>All margin math uses Decimal (not binary float) to avoid drift across gross-to-net waterfalls.
          Money is quantized to 1e-4, percentages to 1e-6, display to 1e-2. Division is zero-safe.</P>
        <F>margin_pct(P, C) = (P − C) / P      (0 if P = 0)</F>
      </Card>
      <Card>
        <H>Demand simulation model</H>
        <P>Synthetic weekly volume for SKU i, customer c, week t is multiplicative:</P>
        <F>{`Q(i,c,t) = B(i,c) · σ_cat(month) · τ(t) · ε · (1 − d)^β · (1 + ℓ)`}</F>
        <P>where B = base velocity × customer volume-share, σ = category-month seasonality index,
          τ = 1 + (g/52)·t linear trend, ε ~ Normal(1, 0.06²) noise, β &lt; 0 price elasticity
          (so (1−d)^β &gt; 1 for discount d), and ℓ = promo mechanic lift. List prices rise 3.5%/yr.</P>
        <F>{`P(t) = P0 · (1 + 0.035 · Δyear)        Q_incr = max(0, Q − Q_baseline)`}</F>
      </Card>
      <Card>
        <H>Dataset</H>
        <F>10 SKUs (2 per category × 5) × 4 customers × ~105 weeks ≈ 4,200 sales rows</F>
      </Card>
    </>
  )
}

function ThreeC() {
  return (
    <>
      <Card>
        <H>Company axis</H>
        <P>Net price P, unit cost C, target gross margin m*:</P>
        <F>{`μ = (P − C) / P        s_company = clip[0,1]( μ / m* )`}</F>
      </Card>
      <Card>
        <H>Customer (retailer) axis</H>
        <P>Shelf price R, retailer cost = our price P, contractual floor f:</P>
        <F>{`μ_R = (R − P) / R
s_customer = 1            if μ_R ≥ f
           = clip(μ_R/f)  if μ_R < f`}</F>
      </Card>
      <Card>
        <H>Consumer axis</H>
        <P>Proposed price P, WTP median w50, 90th percentile w90. Headroom ratio h:</P>
        <F>{`h = (P − w50) / (w90 − w50)
s_consumer = 1        if h ≤ 0   (at/below median)
           = 1 − h    if 0 < h < 1
           = 0        if h ≥ 1   (past the cliff)`}</F>
      </Card>
      <Card>
        <H>Joint score — weighted geometric mean</H>
        <P>Weights w = (0.34, 0.33, 0.33), W = Σw:</P>
        <F>{`S_joint = exp( (1/W) · Σ_k  w_k · ln(s_k) )      → 0 if any s_k = 0`}</F>
        <P>The geometric mean is the heart of "joint" optimization: a near-zero on <b>any</b> axis
          collapses the total, so strong company margin can't paper over a broken retailer margin.
          The binding constraint is argmin_k s_k.</P>
        <F>Rating:  GREEN ≥ 0.80     AMBER ≥ 0.55     RED otherwise    (shown as 100 · S_joint)</F>
      </Card>
    </>
  )
}

function Guardrails() {
  return (
    <Card>
      <H>Validation gates (fail closed → safe baseline)</H>
      <table className="w-full text-xs mt-2">
        <thead><tr className="border-b border-border text-text-muted uppercase tracking-wider">
          <th className="pb-2 text-left font-medium">Gate</th><th className="pb-2 text-left font-medium">Rule</th>
        </tr></thead>
        <tbody className="align-top">
          {[
            ['WTP 95% gate (F25)', 'If predicted-vs-actual WTP correlation ρ < 0.95 → BLOCK; force flat baseline price.'],
            ['Competitor corridor (F30)', 'Clamp P to [φ·P_comp, ψ·P_comp] (floor index φ, ceiling index ψ).'],
            ['Charm rounding (F31)', 'Snap to nearest dollar, apply allowed ending e (e.g. .95); choose nearest of {⌊P⌋−1+e, ⌊P⌋+e}; ban .99.'],
            ['Change frequency (F29)', 'If structural changes YTD ≥ N_max (default 2/yr/region) → BLOCK.'],
            ['3-C intercept (F19)', 'BLOCK if s_company<θ₁ ∨ s_customer<θ₂ ∨ s_consumer<θ₃ (defaults 0.4).'],
          ].map(([g, r]) => (
            <tr key={g} className="border-b border-border/50">
              <td className="py-2 text-text-primary font-medium pr-4 whitespace-nowrap">{g}</td>
              <td className="py-2 text-text-secondary">{r}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <P>The chain runs gates in order; a clamped value from one feeds the next. On the first BLOCK it
        returns the baseline value; otherwise the sequentially clamped/rounded final value.</P>
    </Card>
  )
}

function Engines() {
  return (
    <>
      <Card>
        <H>Elasticity & non-linear demand (M1/M10)</H>
        <P><b>F1/F22 — Log-log elasticity.</b> OLS on log price/volume; the slope IS the elasticity:</P>
        <F>{`ln Q = α + β · ln P + ε        β̂ = Σ(lnP−lnP̄)(lnQ−lnQ̄) / Σ(lnP−lnP̄)²
R² = 1 − SS_res / SS_tot`}</F>
        <P>Computed across 4 contexts (isolated / promotional / brand-wide / category-wide). Slices with
          &lt;10 points or &lt;3 distinct prices fall back to β = −2.0.</P>
        <P><b>F23 — Non-linear core.</b> Fit linear Q=a+bP vs power Q=a·P^b; pick higher R²:</P>
        <F>{`R²_lin ≥ R²_pow  → half-cost absolute pass-through
otherwise        → constant gross-margin %`}</F>
        <P><b>F2 — Cannibalization.</b> ρ_j = corr(sibling volume, target price):</P>
        <F>{`recapture r = min(1, Σ_j max(0, ρ_j))      competitor leakage = (1 − r) · 100%`}</F>
      </Card>

      <Card>
        <H>Trade promotion (M2)</H>
        <P><b>F4 — Promo simulator.</b> Clamped elasticity β ∈ [1,4], discount d, mechanic lift ℓ, duration T:</P>
        <F>{`Q_promo = B · (1 − d)^(−β) · (1 + ℓ)        lift = (Q_promo − B) / B
net   = T·[ Q_promo·(P_d − C) − B·(P − C) ] − fees      (P_d = P(1−d))
spend = T · Q_promo · P · d + fees                     ROI = net / spend`}</F>
        <P>Net is the true incremental profit, so its sign is always consistent with ROI.</P>
        <P><b>F6 — Post-event ROI.</b> Baseline-stripped incremental from realized POS, company ROI and
          retailer GM side by side.</P>
      </Card>

      <Card>
        <H>Consumer science (M11/M12/M13)</H>
        <P><b>F27 — Agent-based shopper (multinomial logit).</b> N agents, J SKUs + outside option:</P>
        <F>{`U_ij = α_ij − β_i · P_j + ε_ij
β_i ~ Gamma(3, 0.03)   α_ij ~ Normal(0,1)   ε_ij ~ Gumbel(0,1)   U_i0 = −1.5 + ε
choice_i = argmax_j U_ij        share_j = (1/N) Σ_i 1[choice_i = j]`}</F>
        <P><b>F24 — Raw WTP distribution.</b> 3-component Gaussian mixture (value/mainstream/premium at
          0.78/1.02/1.45 × P̄). Demand curve = survival S(p)=Pr[WTP ≥ p]; cliffs = argmax(−ΔS).</P>
        <P><b>F26 — Survey calibration.</b> Monotone (cumulative-min) + 3-pt moving-average smoothing,
          then outside-option correction:</P>
        <F>{`calibrated(p) = smoothed(p) · (1 − λ · rank(p))`}</F>
      </Card>

      <Card>
        <H>Price-pack architecture (M1/M3/M18/M24)</H>
        <F>{`F7  per-ounce:  price/oz = P / (N·M)      margin/oz = (P − C) / (N·M)   [pack "N x M oz"]
F3  index:      P_ours / P_comp_avg ; alert if outside [φ, ψ]
F8  premium:    white-space = max_k (P_{k+1} − P_k) in the price ladder
F35 tiers:      terciles → Good/Better/Best; violation if spacing < 15%
F44 value idx:  V = (0.4·b̃ + 0.35·μ̃ + 0.25·p̃) · 100
                b̃=min(b/30,1)  μ̃=min(μ/60,1)  p̃=min((P/P̄_cat)/1.6,1)`}</F>
      </Card>

      <Card>
        <H>Demand & assortment (M5/M9)</H>
        <F>{`F12 assortment:  velocity = volume / #weeks ; delist if ≤ 20th percentile
F13 disruption:  κ = (1 − 0.004·infl%)·(1 − supply%/100) applied to forecast
F20 segmented:   ΔQ_s = β_s · Δp ; lost = max(0,−ΔQ_s)
                 switch = lost·b_s ; dropout = lost·(1−b_s) ; blended = Σ share_s·ΔQ_s
F21 timing:      σ_m = vol_m / mean(vol) ; peak ≥ 1.10 (avoid) ; trough ≤ 0.92 (promote)`}</F>
      </Card>

      <Card>
        <H>Investment & deals (M7/M8)</H>
        <P><b>F19 — B2B pricer.</b> Logistic win-probability in discount d vs benchmark d₀:</P>
        <F>{`P(win | d) = 1 / (1 + e^(−25·(d − d0)))
EV(d) = P(win|d) · V · (P(1−d) − C)        d* = argmax_d EV(d)`}</F>
        <P><b>F17 — Investment optimizer.</b> Concave allocation under budget B:</P>
        <F>{`max Σ a_i · √(x_i)  s.t.  Σ x_i = B, x_i ≥ 0      a = (3.2, 2.6, 3.8)
greedy marginal allocation → equalized marginal returns (KKT)`}</F>
        <P><b>F16 — Decision guides.</b> For a cost spike c%: +c/2% list (half-cost pass-through),
          −10% promo frequency, −5% pack size.</P>
      </Card>

      <Card>
        <H>Governance (M14/M16/M17)</H>
        <F>{`F18 cost-to-serve:  μ_with = (P_d − (C + γ)) / P_d ; flag if < 0 or < ½·μ_without
F28 commodity:      COGS impact = Σ_k formulation_k · shock
F33 complexity:     net = uplift − (setup + carry) ; standard if net ≤ 0
F34 maturity:       weighted capability scores from data-asset presence
F36 smoothing:      BLOCK if std(%Δ) < 0.005 or std($Δ) < 0.01 across ≥3 items
F40 SKU governor:   prune if revenue ≤ percentile AND GM% < floor`}</F>
      </Card>

      <Card>
        <H>Platform & operating model (M6/M20/M21/M23)</H>
        <F>{`F39 workflow:  Finance(GM ≥ thr) ∧ Supply(WoC ≥ min) ∧ Brand(|ΔP| ≤ 15%) → approved
F41 roles · F43 omni-channel (online = dynamic, B&M = shelf-reset) · F14/F15 data/API`}</F>
      </Card>
    </>
  )
}

function RGM() {
  return (
    <>
      <Card>
        <H>Revenue waterfall — Price / Mix / Volume bridge (CY vs PY)</H>
        <F>{`Volume effect = Σ_i (Q_cy − Q_py) · P_py
Price effect  = Σ_i (P_cy − P_py) · Q_py
Mix effect    = Σ_i (Q_cy − Q_py)(P_cy − P_py)`}</F>
      </Card>
      <Card>
        <H>Forecast accuracy</H>
        <F>{`MAPE  = (1/n) Σ |A − F| / max(A,1)
WMAPE = Σ|A − F| / ΣA        Bias = Σ(A − F) / ΣA        FA = 100 − WMAPE`}</F>
      </Card>
      <Card>
        <H>Decomposition · Inventory · P&L</H>
        <F>{`trend T_t = centered 13-week rolling mean ; seasonal = Q_t − T_t
Weeks-of-Cover = on_hand / weekly_demand ; fill rate = (1 − OOS_rate)·100
net revenue = gross − trade spend ; contribution = GP − trade − SG&A (≈8% of net)`}</F>
        <P>Holt-Winters (additive trend + seasonal, period 52) provides the fitted forecast when ≥ 24
          weekly points exist.</P>
      </Card>
    </>
  )
}

const TERMS: [string, string][] = [
  ['Price elasticity (β)', 'The % change in volume for a 1% change in price. β = −2 means a 1% price rise cuts volume ~2%. Estimated by the slope of a log-log regression.'],
  ['Cross-elasticity / cannibalization', 'How a price change on one SKU shifts volume to/from other SKUs in your own portfolio (recapture) vs out to competitors (leakage).'],
  ['WTP (willingness-to-pay)', 'The maximum price a shopper will pay. Triax models the full WTP distribution, not a single average, to locate edge-buyer "cliffs".'],
  ['3-C', 'Company margin, Customer (retailer) margin, Consumer WTP — the three axes balanced jointly on every action.'],
  ['Gross-to-Net (G2N)', 'The bridge from gross (list) revenue to net revenue after trade spend, discounts and deductions.'],
  ['Trade spend', 'Money paid to retailers for promotions/discounts. Tracked as a fund with committed vs uncommitted balances.'],
  ['Baseline vs incremental', 'Baseline = volume that would have sold without a promo; incremental = the extra lift the promo caused. True ROI uses only incremental.'],
  ['Lift', 'The % uplift in volume from a promotion relative to baseline.'],
  ['MAPE / WMAPE / Bias', 'Forecast error metrics. MAPE = mean abs % error; WMAPE = volume-weighted; Bias = systematic over/under-forecasting.'],
  ['Weeks-of-Cover (WoC)', 'On-hand inventory ÷ weekly demand. Under ~2 weeks signals stock-out risk.'],
  ['OTIF / Fill rate', 'On-Time-In-Full and the % of demand fulfilled from stock — service-level metrics.'],
  ['Pareto (80/20)', 'The small set of SKUs driving ~80% of revenue; the rest are prune candidates.'],
  ['Price-Pack Architecture (PPA)', 'Designing pack sizes & price points (per-ounce economics, Good-Better-Best tiers) across channels.'],
  ['Premiumization', 'Launching higher-margin packs/bundles into price white-space without triggering price wars.'],
  ['Charm pricing', 'Psychological endings (e.g. .95/.99). Triax enforces a chosen charm policy and can ban endings.'],
  ['Cost-to-serve', 'Logistics/handling cost per case injected into COGS; can turn a "profitable" promo negative.'],
  ['Multinomial logit (MNL)', 'A discrete-choice model where each agent picks the option with highest random utility — used in the agent-based shopper simulator.'],
  ['Geometric mean', 'A product-based average. Used for the joint 3-C score because a zero on any axis forces the whole score to zero.'],
  ['Pass-through', 'How much of a cost change is passed into price. Linear demand → ~50% absolute; constant-elasticity → maintain GM%.'],
  ['Safe baseline', 'When data is thin or a guardrail trips, the engine returns a labeled fallback instead of an error.'],
  ['Maturity tiers', 'Diagnostic → Indexing → Predictive → Prescriptive — the progressive unlock order for capabilities.'],
]

function Glossary() {
  return (
    <Card>
      <H>Glossary of terms</H>
      <div className="divide-y divide-border/50 mt-2">
        {TERMS.map(([term, def]) => (
          <div key={term} className="py-2.5 grid md:grid-cols-[200px_1fr] gap-2">
            <span className="text-sm font-semibold text-text-primary">{term}</span>
            <span className="text-sm text-text-secondary">{def}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
