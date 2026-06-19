"""
Trade Promotion Management & Optimization engines (Module 2).

Features:
    4   Predictive Promotion Scenario Simulator (pre-event)
    6   Post-Event ROI Balanced Scorecard (lagging POS, baseline-stripped)

Both produce the company-vs-retailer balanced view the spec requires and reuse
the seeded sales fact table. Decimal money throughout (rule #1); thin data
degrades to safe baseline (rule #4).
"""

from __future__ import annotations

from decimal import Decimal

import numpy as np
from sqlalchemy.orm import Session

from .base import OptimizationEngine, EngineResult
from ..money import D, money, frac, margin_pct, to_pct_display, safe_div
from ...services.analytics import _load_sales
from ...services.data_generator import PROMO_LIFTS

# Assumed retailer markup over our net price when shelf price is unknown.
DEFAULT_RETAIL_MARKUP = Decimal("1.35")
# Fixed execution fees layered onto trade spend.
DISPLAY_FEE = Decimal("2500")
FEATURE_FEE = Decimal("1500")


def _lift_midpoint(promo_type: str) -> Decimal:
    lo, hi = PROMO_LIFTS.get(promo_type, (0.20, 0.40))
    return frac((D(lo) + D(hi)) / 2)


class PromoSimulatorEngine(OptimizationEngine):
    """Feature 4: pre-event predicted incremental lift vs baseline for a proposed
    promo, with company net profit and retailer gross margin side by side."""

    feature_id = 4
    name = "promo_simulator"

    def run(self, db: Session, product_id: str = None, customer_id: str = None,
            promo_type: str = "Display+Feature", discount_pct: float = 0.15,
            duration_weeks: int = 1, display: bool = False, feature: bool = False,
            **kwargs) -> EngineResult:
        if not product_id:
            return self._baseline("No product_id supplied.")
        df = _load_sales(db, years=[2024])
        prod = df[df["product_id"] == product_id]
        if customer_id:
            prod = prod[prod["customer_id"] == customer_id]
        if prod.empty:
            return self._baseline(f"No sales for {product_id}.", product_id=product_id)

        # Baseline = average weekly non-promo volume.
        non_promo = prod[prod["promo_flag"] == False]
        base_weekly_vol = D(non_promo["volume_cases"].mean() if len(non_promo) else prod["volume_cases"].mean())
        avg_price = D(prod["net_price"].mean())
        unit_cogs = safe_div(prod["cogs"].sum(), prod["volume_cases"].sum())

        disc = frac(discount_pct)
        # Base lift from promo mechanic + extra lift from depth of discount via
        # the SKU's elasticity (deeper discount -> more lift).
        base_lift = _lift_midpoint(promo_type)
        elasticity = D(abs(_quick_elasticity(prod)))
        depth_lift = frac(disc * elasticity)             # e.g. 15% disc * 2.5 = 37.5%
        total_lift = base_lift + depth_lift

        dur = max(1, int(duration_weeks))
        promo_price = money(avg_price * (D(1) - disc))
        promo_weekly_vol = money(base_weekly_vol * (D(1) + total_lift))
        incremental_weekly_vol = money(promo_weekly_vol - base_weekly_vol)

        total_promo_vol = money(promo_weekly_vol * dur)
        incremental_vol = money(incremental_weekly_vol * dur)
        incremental_rev = money(incremental_vol * promo_price)

        # Trade spend = discount on ALL promoted units + fixed execution fees.
        discount_cost = money(total_promo_vol * avg_price * disc)
        fees = (DISPLAY_FEE if display else D(0)) + (FEATURE_FEE if feature else D(0))
        trade_spend = money(discount_cost + fees)

        incremental_gp = money(incremental_vol * (promo_price - unit_cogs))
        company_net = money(incremental_gp - fees)         # GP already nets the discount via promo_price
        roi = safe_div(incremental_rev - trade_spend, trade_spend)

        # Retailer view.
        retail_price = money(avg_price * DEFAULT_RETAIL_MARKUP)
        retail_promo_price = money(retail_price * (D(1) - disc))
        retailer_margin = margin_pct(retail_promo_price, promo_price)

        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message=f"Predicted {promo_type} promo for {prod['sku_name'].iloc[0]}.",
            data={
                "product_id": product_id, "customer_id": customer_id,
                "promo_type": promo_type, "discount_pct": float(disc),
                "duration_weeks": dur, "display": display, "feature": feature,
                "predicted_lift_pct": to_pct_display(total_lift, 1),
                "baseline_weekly_volume": float(base_weekly_vol),
                "incremental_volume": float(incremental_vol),
                "incremental_revenue": float(incremental_rev),
                "trade_spend": float(trade_spend),
                "company": {
                    "net_profit": float(company_net),
                    "incremental_gross_profit": float(incremental_gp),
                    "roi_pct": to_pct_display(roi, 1),
                },
                "retailer": {
                    "shelf_price": float(retail_price),
                    "promo_shelf_price": float(retail_promo_price),
                    "gross_margin_pct": to_pct_display(retailer_margin, 1),
                },
            },
            telemetry={"elasticity_used": float(elasticity), "base_lift": float(base_lift),
                       "depth_lift": float(depth_lift)},
        )


class PostEventROIEngine(OptimizationEngine):
    """Feature 6: ingest realized (POS) promo weeks, strip baseline to isolate
    true incremental, and report the balanced company-vs-retailer scorecard."""

    feature_id = 6
    name = "post_event_roi"

    def run(self, db: Session, product_id: str = None, customer_id: str = None,
            **kwargs) -> EngineResult:
        df = _load_sales(db, years=[2024])
        if product_id:
            df = df[df["product_id"] == product_id]
        if customer_id:
            df = df[df["customer_id"] == customer_id]
        promo = df[df["promo_flag"] == True]
        if promo.empty:
            return self._baseline("No realized promo weeks in scope.", product_id=product_id)

        results = []
        for ptype, grp in promo.groupby("promo_type"):
            incr_vol = D(grp["incremental_volume"].sum())
            incr_rev = money(D((grp["incremental_volume"] * grp["net_price"]).sum()))
            trade_spend = money(D((grp["volume_cases"] * grp["list_price"] * grp["promo_discount_pct"]).sum()))
            unit_cogs = safe_div(grp["cogs"].sum(), grp["volume_cases"].sum())
            incr_gp = money(D((grp["incremental_volume"] * (grp["net_price"] - unit_cogs)).sum()))
            roi = safe_div(incr_rev - trade_spend, trade_spend)
            baseline_vol = D(grp["baseline_volume"].sum())
            lift = safe_div(incr_vol, baseline_vol)
            retail_margin = margin_pct(D(grp["net_price"].mean()) * DEFAULT_RETAIL_MARKUP,
                                       D(grp["net_price"].mean()))
            results.append({
                "promo_type": ptype,
                "events": int(grp.groupby(["product_id", "customer_id", "week_date"]).ngroups),
                "realized_lift_pct": to_pct_display(lift, 1),
                "incremental_revenue": float(incr_rev),
                "trade_spend": float(trade_spend),
                "company_net_profit": float(money(incr_gp - trade_spend)),
                "company_roi_pct": to_pct_display(roi, 1),
                "retailer_gross_margin_pct": to_pct_display(retail_margin, 1),
            })
        results.sort(key=lambda r: r["company_roi_pct"], reverse=True)
        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message="Post-event balanced ROI scorecard (baseline-stripped).",
            data={"product_id": product_id, "customer_id": customer_id, "by_promo_type": results},
            telemetry={"promo_rows": int(len(promo))},
        )


def _quick_elasticity(prod) -> float:
    """Cheap log-log slope for the SKU; fallback -2.5."""
    p = prod["net_price"].values.astype(float)
    v = prod["volume_cases"].values.astype(float)
    mask = (p > 0) & (v > 0)
    p, v = p[mask], v[mask]
    if p.size < 10 or np.unique(p).size < 3:
        return -2.5
    b, _ = np.polyfit(np.log(p), np.log(v), 1)
    return float(b) if b < 0 else -2.5
