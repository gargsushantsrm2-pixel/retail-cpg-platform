"""
3-C Joint Optimization core (Modules 19 / 37 / 38).

The central RMM constraint: any price/promo/assortment action is scored on three
axes simultaneously and only accepted if it does not unduly sacrifice one for
another:

    Company   — internal contribution margin vs target
    Customer  — retailer (distributor) gross margin vs contractual floor
    Consumer  — willingness-to-pay headroom vs the elasticity cliff

Each axis yields a normalized 0..1 sub-score; the joint score is their weighted
geometric mean (geometric so that a near-zero on any axis tanks the whole score —
this is what enforces "joint" optimization rather than letting a strong company
margin paper over a broken retailer margin).

All financial math uses Decimal (rule #1).
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Dict, Optional

from .money import D, money, frac, margin_pct, to_pct_display, safe_div


# ── Profiles (inputs) ─────────────────────────────────────────────────────────

@dataclass
class CompanyMarginProfile:
    unit_price: Decimal          # our net price to retailer
    unit_cost: Decimal           # our COGS (+ cost-to-serve if injected)
    target_margin: Decimal       # target gross margin fraction

    @classmethod
    def build(cls, unit_price, unit_cost, target_margin=0.35) -> "CompanyMarginProfile":
        return cls(D(unit_price), D(unit_cost), D(target_margin))

    def actual_margin(self) -> Decimal:
        return margin_pct(self.unit_price, self.unit_cost)

    def score(self) -> Decimal:
        """1.0 when actual >= target; degrades linearly to 0 as margin -> 0."""
        actual = self.actual_margin()
        if self.target_margin <= 0:
            return Decimal("1")
        ratio = safe_div(actual, self.target_margin)
        return _clamp01(ratio)


@dataclass
class CustomerMarginProfile:
    retail_price: Decimal        # shelf price to shopper
    retailer_cost: Decimal       # what retailer pays us (our net price)
    margin_floor: Decimal        # contractual retailer gross-margin floor

    @classmethod
    def build(cls, retail_price, retailer_cost, margin_floor=0.25) -> "CustomerMarginProfile":
        return cls(D(retail_price), D(retailer_cost), D(margin_floor))

    def retailer_margin(self) -> Decimal:
        return margin_pct(self.retail_price, self.retailer_cost)

    def score(self) -> Decimal:
        """1.0 at/above floor; hard degrade below floor (retailer will resist)."""
        rm = self.retailer_margin()
        if self.margin_floor <= 0:
            return Decimal("1")
        if rm >= self.margin_floor:
            return Decimal("1")
        return _clamp01(safe_div(rm, self.margin_floor))


@dataclass
class ConsumerWTPProfile:
    proposed_price: Decimal      # price shopper would face
    wtp_median: Decimal          # median willingness-to-pay
    wtp_p90: Decimal             # 90th percentile WTP (top of headroom)

    @classmethod
    def build(cls, proposed_price, wtp_median, wtp_p90) -> "ConsumerWTPProfile":
        return cls(D(proposed_price), D(wtp_median), D(wtp_p90))

    def headroom_ratio(self) -> Decimal:
        """Where the price sits in the [median, p90] WTP band. <0 below median
        (lots of headroom), >1 above p90 (past the cliff)."""
        span = self.wtp_p90 - self.wtp_median
        if span <= 0:
            return Decimal("0")
        return safe_div(self.proposed_price - self.wtp_median, span)

    def score(self) -> Decimal:
        """1.0 at or below median WTP; degrades to 0 as price approaches/exceeds
        the p90 cliff."""
        hr = self.headroom_ratio()
        if hr <= 0:
            return Decimal("1")
        if hr >= 1:
            return Decimal("0")
        return Decimal("1") - hr


# ── Scorecard ─────────────────────────────────────────────────────────────────

@dataclass
class ThreeCWeights:
    company: Decimal = Decimal("0.34")
    customer: Decimal = Decimal("0.33")
    consumer: Decimal = Decimal("0.33")


class ThreeCScorecard:
    """Computes the joint 3-C health score for a proposed action."""

    def __init__(self, weights: Optional[ThreeCWeights] = None):
        self.weights = weights or ThreeCWeights()

    def evaluate(
        self,
        company: CompanyMarginProfile,
        customer: CustomerMarginProfile,
        consumer: ConsumerWTPProfile,
    ) -> Dict[str, Any]:
        s_company = company.score()
        s_customer = customer.score()
        s_consumer = consumer.score()

        joint = _weighted_geomean(
            [(s_company, self.weights.company),
             (s_customer, self.weights.customer),
             (s_consumer, self.weights.consumer)]
        )

        # The binding (worst) constraint drives the narrative.
        axes = {"company": s_company, "customer": s_customer, "consumer": s_consumer}
        binding = min(axes, key=lambda k: axes[k])

        return {
            "joint_score": to_pct_display(joint, 1),               # 0..100
            "rating": _rating(joint),
            "binding_constraint": binding,
            "axes": {
                "company": {
                    "score": to_pct_display(s_company, 1),
                    "actual_margin_pct": to_pct_display(company.actual_margin(), 1),
                    "target_margin_pct": to_pct_display(company.target_margin, 1),
                },
                "customer": {
                    "score": to_pct_display(s_customer, 1),
                    "retailer_margin_pct": to_pct_display(customer.retailer_margin(), 1),
                    "margin_floor_pct": to_pct_display(customer.margin_floor, 1),
                },
                "consumer": {
                    "score": to_pct_display(s_consumer, 1),
                    "wtp_headroom_ratio": float(consumer.headroom_ratio()),
                    "proposed_price": float(money(consumer.proposed_price)),
                },
            },
            "three_c_subscores": {  # raw 0..1 for the guardrail intercept
                "company": float(s_company),
                "customer": float(s_customer),
                "consumer": float(s_consumer),
            },
        }


# ── helpers ───────────────────────────────────────────────────────────────────

def _clamp01(x: Decimal) -> Decimal:
    if x < 0:
        return Decimal("0")
    if x > 1:
        return Decimal("1")
    return x


def _weighted_geomean(pairs) -> Decimal:
    """Weighted geometric mean via exp(sum w_i * ln x_i), using float internally
    for the transcendental step then re-quantizing. A zero on any axis -> 0."""
    import math
    total_w = sum(float(w) for _, w in pairs) or 1.0
    acc = 0.0
    for value, weight in pairs:
        v = float(value)
        if v <= 0:
            return Decimal("0")
        acc += (float(weight) / total_w) * math.log(v)
    return frac(Decimal(str(math.exp(acc))))


def _rating(joint: Decimal) -> str:
    j = float(joint)
    if j >= 0.80:
        return "GREEN"
    if j >= 0.55:
        return "AMBER"
    return "RED"
