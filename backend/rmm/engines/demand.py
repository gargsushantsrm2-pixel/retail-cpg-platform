"""
Assortment, Distribution & Demand-driver engines (Modules 5, 9).

Features:
    12  Store-Level Assortment Recommendation Engine
    13  ML Demand Forecasting with Disruption Indicators
    20  Segmented Consumer Demand Response
    21  Promotion Duration & Timing Optimizer
"""

from __future__ import annotations

import numpy as np
from sqlalchemy.orm import Session

from .base import OptimizationEngine, EngineResult
from ...services.analytics import _load_sales, _load_forecasts


class StoreAssortmentEngine(OptimizationEngine):
    """Feature 12: per-customer (format proxy) assortment — flag slow-moving SKUs
    to delist and high-velocity SKUs to prioritize."""

    feature_id = 12
    name = "store_assortment"

    def run(self, db: Session, customer_id: str = None, drop_percentile: float = 0.2,
            **kwargs) -> EngineResult:
        df = _load_sales(db, years=[2024])
        if customer_id:
            df = df[df["customer_id"] == customer_id]
        if df.empty:
            return self._baseline("No sales in scope.", customer_id=customer_id)
        vel = df.groupby(["customer_id", "customer_name", "product_id", "sku_name", "category"]).agg(
            volume=("volume_cases", "sum"), revenue=("revenue", "sum"),
            weeks=("week_date", "nunique")).reset_index()
        vel["weekly_velocity"] = vel["volume"] / vel["weeks"].replace(0, np.nan)
        recs = []
        for cust, grp in vel.groupby("customer_id"):
            cut = grp["weekly_velocity"].quantile(drop_percentile)
            for _, r in grp.iterrows():
                action = "DELIST" if r["weekly_velocity"] <= cut else "KEEP"
                if action == "DELIST":
                    recs.append({
                        "customer_id": cust, "customer_name": r["customer_name"],
                        "product_id": r["product_id"], "sku_name": r["sku_name"],
                        "category": r["category"],
                        "weekly_velocity": round(float(r["weekly_velocity"]), 1),
                        "revenue": round(float(r["revenue"]), 0),
                        "action": action,
                    })
        recs.sort(key=lambda x: x["weekly_velocity"])
        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message=f"{len(recs)} slow-moving SKU placements flagged for delist review.",
            data={"customer_id": customer_id, "delist_candidates": recs},
        )


class MLForecastDisruptionEngine(OptimizationEngine):
    """Feature 13: take the statistical forward forecast and overlay macro
    disruption indicators (inflation demand drag, supply bottleneck cap)."""

    feature_id = 13
    name = "ml_forecast_disruption"

    def run(self, db: Session, product_id: str = None, customer_id: str = None,
            inflation_pct: float = 4.0, supply_bottleneck_pct: float = 0.0,
            **kwargs) -> EngineResult:
        fc = _load_forecasts(db)
        if product_id:
            fc = fc[fc["product_id"] == product_id]
        if customer_id:
            fc = fc[fc["customer_id"] == customer_id]
        if fc.empty:
            return self._baseline("No forecast rows in scope.", product_id=product_id)

        weekly = fc.groupby("week_date").agg(
            base=("forecast_volume", "sum"),
            lo=("lower_bound", "sum"), hi=("upper_bound", "sum")).reset_index().sort_values("week_date")

        # Inflation demand drag: ~ -0.4% volume per 1% inflation (elastic staples)
        infl_drag = 1.0 - 0.004 * inflation_pct
        # Supply bottleneck caps fulfillable volume
        supply_cap = 1.0 - supply_bottleneck_pct / 100.0
        adj = infl_drag * supply_cap

        rows = [{
            "week_date": str(r["week_date"])[:10],
            "base_forecast": round(float(r["base"]), 1),
            "disruption_adjusted": round(float(r["base"] * adj), 1),
            "lower_bound": round(float(r["lo"] * adj), 1),
            "upper_bound": round(float(r["hi"] * adj), 1),
        } for _, r in weekly.iterrows()]
        total_base = float(weekly["base"].sum())
        total_adj = total_base * adj
        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message=f"Forecast adjusted for {inflation_pct}% inflation, {supply_bottleneck_pct}% supply cap.",
            data={
                "product_id": product_id, "customer_id": customer_id,
                "inflation_pct": inflation_pct, "supply_bottleneck_pct": supply_bottleneck_pct,
                "demand_adjustment_factor": round(adj, 4),
                "total_base_units": round(total_base, 0),
                "total_adjusted_units": round(total_adj, 0),
                "weekly": rows,
            },
        )


class SegmentedDemandEngine(OptimizationEngine):
    """Feature 20: predict, for a price change, which demographic segments switch
    brands vs drop out of the category entirely."""

    feature_id = 20
    name = "segmented_demand"

    SEGMENTS = [
        {"name": "Value Seekers", "share": 0.35, "elasticity": -3.2, "switch_bias": 0.7},
        {"name": "Mainstream", "share": 0.45, "elasticity": -2.0, "switch_bias": 0.5},
        {"name": "Premium Loyalists", "share": 0.20, "elasticity": -1.1, "switch_bias": 0.2},
    ]

    def run(self, db: Session, price_change_pct: float = 5.0, **kwargs) -> EngineResult:
        pc = price_change_pct / 100.0
        out = []
        for s in self.SEGMENTS:
            vol_change = s["elasticity"] * pc            # fractional volume change
            lost = max(0.0, -vol_change)                 # fraction of segment lost
            switched = lost * s["switch_bias"]           # to other brands (stay in category)
            dropped = lost * (1 - s["switch_bias"])      # exit category
            out.append({
                "segment": s["name"], "share": s["share"], "elasticity": s["elasticity"],
                "volume_change_pct": round(vol_change * 100, 1),
                "switch_to_competitor_pct": round(switched * 100, 1),
                "drop_out_pct": round(dropped * 100, 1),
            })
        blended = sum(s["share"] * o["volume_change_pct"] for s, o in zip(self.SEGMENTS, out))
        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message=f"Segmented demand response to a {price_change_pct}% price move.",
            data={"price_change_pct": price_change_pct,
                  "blended_volume_change_pct": round(blended, 1),
                  "segments": out},
        )


class PromoTimingEngine(OptimizationEngine):
    """Feature 21: identify natural demand peaks so promos aren't wasted during
    them, and recommend optimal promo windows + duration."""

    feature_id = 21
    name = "promo_timing"

    def run(self, db: Session, category: str = "Beverages", **kwargs) -> EngineResult:
        df = _load_sales(db, years=[2024])
        cat = df[df["category"] == category]
        if cat.empty:
            return self._baseline(f"No sales in {category}.", category=category)
        monthly = cat.groupby("month")["volume_cases"].sum()
        idx = (monthly / monthly.mean()).round(3)
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        seasonality = [{"month": months[m - 1], "index": float(idx.get(m, 1.0))} for m in range(1, 13)]
        peaks = [s["month"] for s in seasonality if s["index"] >= 1.10]
        troughs = [s["month"] for s in seasonality if s["index"] <= 0.92]
        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message=f"{category} demand timing: promote in troughs, hold list price in peaks.",
            data={
                "category": category, "seasonality": seasonality,
                "natural_peaks_avoid_promo": peaks,
                "recommended_promo_windows": troughs,
                "recommended_duration_weeks": 2,
                "note": "Promoting during natural peaks dilutes margin on volume that would sell anyway.",
            },
        )
