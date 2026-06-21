// In-section guidance copy, keyed by route. Rendered by <SectionGuide/> in the
// layout so every page gets a consistent, dismissible "how to use this" panel.

export interface GuideContent {
  purpose: string
  howToRead: string[]
  nextAction?: string
}

export const GUIDES: Record<string, GuideContent> = {
  '/executive': {
    purpose: 'One-glance portfolio health — revenue, margin, volume and share vs prior year.',
    howToRead: [
      'Green/red deltas compare current year to the same period last year.',
      'Use it to spot which categories or customers are dragging the portfolio.',
    ],
    nextAction: 'Drill into a weak lever via Revenue Growth or the RMM levers.',
  },
  '/rgm': {
    purpose: 'Classic RGM view: revenue bridge, elasticity, promo ROI and mix.',
    howToRead: [
      'The waterfall decomposes revenue change into price, mix and volume effects.',
      'Elasticity nearer 0 = more pricing power; below −3 = highly price-sensitive.',
    ],
    nextAction: 'Take a pricing play into Price Architecture or the 3-C Scorecard.',
  },
  '/category': {
    purpose: 'Category & assortment economics — what to range, grow, or prune.',
    howToRead: ['Pareto flags the SKUs driving 80% of revenue.', 'Low GM% + low velocity = prune candidates.'],
    nextAction: 'Confirm prunes in Margin Governance → SKU Governor.',
  },
  '/forecasting': {
    purpose: 'Demand forecast accuracy and decomposition.',
    howToRead: ['MAPE/WMAPE lower = more accurate; bias shows over/under-forecasting.',
      'Decomposition splits demand into trend, seasonal and irregular.'],
    nextAction: 'Stress the forecast in Demand & Assortment → Forecast + Disruption.',
  },
  '/supply': {
    purpose: 'Inventory health, service levels and replenishment alerts.',
    howToRead: ['Weeks-of-Cover (WoC) under ~2 = stock-out risk (red).',
      'Fill rate / OTIF below 95% signals a service gap.'],
  },
  '/commercial': {
    purpose: 'Customer P&L and trade-spend effectiveness.',
    howToRead: ['Contribution margin % is the true bottom line per customer after trade + SG&A.',
      'Negative trade ROI = spend destroying value.'],
    nextAction: 'Tighten terms in Trade Terms (G2N).',
  },
  '/scenario': {
    purpose: 'What-if simulator for price and promo before you commit.',
    howToRead: ['The sensitivity curve shows revenue impact across the price range.',
      'Elasticity drives the volume response — override it if you have a better estimate.'],
    nextAction: 'Validate the winning scenario in the 3-C Scorecard.',
  },
  '/rmm': {
    purpose: 'The full RMM capability map — all 24 modules / 44 features and their rollout tier.',
    howToRead: ['Green = a live engine you can use now.',
      'Tiers (Diagnostic→Prescriptive) reflect progressive scope scaffolding (Module 22).'],
    nextAction: 'Jump into any lever from the sidebar.',
  },
  '/rmm/three-c': {
    purpose: 'The core constraint: score any action on Company margin, Customer (retailer) margin and Consumer WTP together.',
    howToRead: ['Joint score is a weighted geometric mean — a low score on any axis tanks the total.',
      'The "binding constraint" tells you which C is holding you back.',
      'GREEN ≥ 80, AMBER ≥ 55, RED below.'],
    nextAction: 'If blocked, adjust price/cost and re-score, then send to Workflow approval.',
  },
  '/rmm/elasticity': {
    purpose: 'How volume responds to price — across four contexts and a non-linear demand fit.',
    howToRead: ['Compare elasticity across isolated / promotional / brand-wide / category-wide contexts.',
      '"Safe baseline" means thin data — treat that context cautiously.',
      'Cannibalization splits a price move into own-portfolio recapture vs competitor leakage.'],
    nextAction: 'Feed the elasticity into the Scenario Planner or 3-C Scorecard.',
  },
  '/rmm/promo': {
    purpose: 'Plan, predict and review trade promotions (TPM/TPO).',
    howToRead: ['Pre-event: predicted lift vs baseline, company net profit AND retailer margin side by side.',
      'Post-event strips baseline to isolate true incremental ROI.',
      'Calendar liability = committed trade spend across scheduled events.'],
    nextAction: 'Route deep-discount deals through Trade Terms → G2N approval.',
  },
  '/rmm/trade-terms': {
    purpose: 'Gross-to-Net controls: deal approval, fund guardrails and claims.',
    howToRead: ['Deals below the margin threshold auto-escalate to Finance.',
      'Committing more than the uncommitted fund balance is blocked.',
      'Claim variance above contracted terms = unauthorized leakage.'],
  },
  '/rmm/governance': {
    purpose: 'Margin guardrails and capability diagnostics.',
    howToRead: ['Maturity scores each capability 0–100 with localized step-up tasks.',
      'The guardrail chain shows PASS/BLOCK and the safe-baseline fallback.'],
  },
  '/rmm/consumer': {
    purpose: 'Consumer science — agent-based shelf simulation, raw WTP distribution and survey calibration.',
    howToRead: ['Agent sim runs thousands of discrete shoppers; "no-purchase share" is the outside option.',
      'WTP distribution exposes edge-buyer cliffs a single "average" would hide.',
      'Survey calibration corrects "buy-or-nothing" intent into realistic shelf choice.'],
    nextAction: 'Use the WTP median/p90 as inputs to the 3-C Scorecard.',
  },
  '/rmm/price-arch': {
    purpose: 'Price-pack architecture — per-ounce economics, corridors, premiumization and tiers.',
    howToRead: ['Margin-per-ounce reveals where smaller packs clear entry prices without diluting profit.',
      'Competitor index outside the corridor triggers an alert.',
      'Tier spacing violations mean Good/Better/Best are too close together.'],
  },
  '/rmm/demand': {
    purpose: 'Demand drivers — assortment, forecast disruption, segmented response and promo timing.',
    howToRead: ['Disruption overlays inflation drag and supply caps on the base forecast.',
      'Segmented view predicts who switches brands vs exits the category on a price move.',
      'Promote in demand troughs (green); hold list price in natural peaks (red).'],
  },
  '/rmm/investment': {
    purpose: 'Where to put commercial money — B2B deals, cross-lever budget, and cost-spike playbooks.',
    howToRead: ['B2B pricer maximizes win-probability × account value to find the optimal discount.',
      'The optimizer allocates budget by marginal return across levers.',
      'Decision guides generate explicit actions for a cost shock.'],
  },
  '/rmm/platform': {
    purpose: 'Operating model — cross-functional sign-off, role views, omni-channel and data plumbing.',
    howToRead: ['Workflow requires parallel Finance / Supply / Brand checkpoints before go-live.',
      'Stakeholder views reshape the data per role.',
      'Online channels price dynamically; brick-and-mortar follows shelf resets.'],
  },
}
