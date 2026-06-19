"""
Margin-governance & diagnostic engines.

Features:
    18  Internal Servicing Cost-to-Serve Modeler
    28  Multi-Tier Raw Ingredient Cost Tracker (commodity exposure)
    33  Complexity-to-Margin Friction Modeler
    34  RGM Capability & Execution Maturity Assessment
    36  Arbitrary Price-Smoothing Alert System
    40  SKU Proliferation & Complexity Cost Governor

Financial math uses Decimal (rule #1). All engines degrade to safe baseline
when their inputs/feeds are absent (rule #4).
"""

from __future__ import annotations

import numpy as np
from sqlalchemy import text
from sqlalchemy.orm import Session

from .base import OptimizationEngine, EngineResult
from ..money import D, money, margin_pct, to_pct_display, safe_div
from ...services.analytics import _load_sales


class CostToServeEngine(OptimizationEngine):
    """Feature 18: inject logistics / handling cost per case into the margin and
    flag promo suggestions whose distribution complexity erodes profitability."""

    feature_id = 18
    name = "cost_to_serve"

    def run(self, db: Session, product_id: str = None,
            cost_to_serve_per_case: float = 0.0, promo_volume_cases: float = 0.0,
            promo_discount_pct: float = 0.15, **kwargs) -> EngineResult:
        if not product_id:
            return self._baseline("No product_id supplied.")
        df = _load_sales(db, years=[2024])
        prod = df[df["product_id"] == product_id]
        if prod.empty:
            return self._baseline(f"No sales for {product_id}.", product_id=product_id)

        avg_price = D(prod["net_price"].mean())
        unit_cogs = safe_div(prod["cogs"].sum(), prod["volume_cases"].sum())
        cts = D(cost_to_serve_per_case)
        disc = D(promo_discount_pct)

        promo_price = avg_price * (D(1) - disc)
        gm_without_cts = margin_pct(promo_price, unit_cogs)
        gm_with_cts = margin_pct(promo_price, unit_cogs + cts)

        degraded = gm_with_cts < 0 or (gm_without_cts > 0 and gm_with_cts < gm_without_cts * D("0.5"))
        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message="Cost-to-serve adjusted promo margin computed.",
            data={
                "product_id": product_id,
                "promo_price": float(money(promo_price)),
                "unit_cogs": float(money(unit_cogs)),
                "cost_to_serve_per_case": float(money(cts)),
                "gross_margin_pct_excl_cts": to_pct_display(gm_without_cts, 1),
                "gross_margin_pct_incl_cts": to_pct_display(gm_with_cts, 1),
                "block_recommendation": bool(degraded),
                "verdict": "BLOCK: distribution complexity degrades profitability"
                           if degraded else "OK: profitable after cost-to-serve",
            },
            telemetry={"promo_volume_cases": promo_volume_cases},
        )


class ComplexityFrictionEngine(OptimizationEngine):
    """Feature 33: compare operational overhead of a custom/segmented offer
    against its projected revenue expansion; recommend standard catalog pricing
    if friction exceeds upside."""

    feature_id = 33
    name = "complexity_friction"

    def run(self, db: Session, projected_revenue_uplift: float = 0.0,
            custom_setup_cost: float = 0.0, annual_carry_cost: float = 0.0,
            **kwargs) -> EngineResult:
        uplift = D(projected_revenue_uplift)
        friction = D(custom_setup_cost) + D(annual_carry_cost)
        net = uplift - friction
        ratio = safe_div(friction, uplift) if uplift > 0 else D(99)
        keep_standard = net <= 0
        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message="Complexity-to-margin friction evaluated.",
            data={
                "projected_revenue_uplift": float(money(uplift)),
                "total_friction_cost": float(money(friction)),
                "net_value": float(money(net)),
                "friction_to_uplift_ratio": float(round(ratio, 4)),
                "recommendation": "MAINTAIN_STANDARD_CATALOG_PRICING" if keep_standard
                                  else "PROCEED_WITH_CUSTOM_OFFER",
            },
        )


class CommodityExposureEngine(OptimizationEngine):
    """Feature 28: track variable-margin vulnerability as commodity indices move.
    Reads the commodity_cost table; degrades to safe baseline if unseeded."""

    feature_id = 28
    name = "commodity_exposure"

    def run(self, db: Session, index_shock_pct: float = 10.0, **kwargs) -> EngineResult:
        try:
            rows = db.execute(text(
                "SELECT product_id, commodity, formulation_pct, index_price "
                "FROM commodity_cost")).fetchall()
        except Exception:
            rows = []
        if not rows:
            return self._baseline(
                "No commodity_cost feed present; margin-vulnerability defaults to flat.",
                index_shock_pct=index_shock_pct)

        shock = D(index_shock_pct) / D(100)
        by_prod = {}
        for r in rows:
            pid = r[0]
            formulation = D(r[2])  # fraction of COGS this commodity represents
            # COGS impact = formulation_share * shock
            impact = formulation * shock
            by_prod.setdefault(pid, D(0))
            by_prod[pid] += impact

        exposure = [
            {"product_id": pid, "cogs_impact_pct": to_pct_display(impact, 2)}
            for pid, impact in sorted(by_prod.items(), key=lambda kv: kv[1], reverse=True)
        ]
        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message=f"Commodity exposure for a {index_shock_pct}% index shock.",
            data={"index_shock_pct": index_shock_pct, "exposure": exposure},
            telemetry={"products": len(exposure)},
        )


class SkuProliferationGovernor(OptimizationEngine):
    """Feature 40: flag low-margin / low-velocity SKUs as prune candidates."""

    feature_id = 40
    name = "sku_proliferation_governor"

    def run(self, db: Session, revenue_percentile: float = 0.25,
            margin_floor_pct: float = 25.0, **kwargs) -> EngineResult:
        df = _load_sales(db, years=[2024])
        if df.empty:
            return self._baseline("No sales data.")
        sku = df.groupby(["product_id", "sku_name", "brand", "category"]).agg(
            revenue=("revenue", "sum"), gp=("gross_profit", "sum"),
            volume=("volume_cases", "sum")).reset_index()
        sku["gm_pct"] = (sku["gp"] / sku["revenue"].replace(0, np.nan) * 100).fillna(0)
        rev_cut = sku["revenue"].quantile(revenue_percentile)
        candidates = sku[(sku["revenue"] <= rev_cut) & (sku["gm_pct"] < margin_floor_pct)]
        recs = candidates.sort_values("revenue").to_dict(orient="records")
        for r in recs:
            r["revenue"] = float(round(r["revenue"], 0))
            r["gp"] = float(round(r["gp"], 0))
            r["volume"] = float(round(r["volume"], 0))
            r["gm_pct"] = float(round(r["gm_pct"], 1))
        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message=f"{len(recs)} SKU(s) flagged for prune review.",
            data={"revenue_cut": float(round(rev_cut, 0)),
                  "margin_floor_pct": margin_floor_pct,
                  "prune_candidates": recs},
            telemetry={"total_skus": int(len(sku))},
        )


class PriceSmoothingAlert(OptimizationEngine):
    """Feature 36: block blanket uniform % or flat $ changes applied across a
    diverse portfolio. Detects near-identical deltas across items."""

    feature_id = 36
    name = "price_smoothing_alert"

    def run(self, db: Session, proposed_changes: list = None, **kwargs) -> EngineResult:
        # proposed_changes: [{"product_id","old_price","new_price"}]
        changes = proposed_changes or []
        if len(changes) < 3:
            return self._baseline("Fewer than 3 items; smoothing check skipped.")
        pct_deltas, abs_deltas = [], []
        for c in changes:
            old, new = D(c.get("old_price", 0)), D(c.get("new_price", 0))
            if old > 0:
                pct_deltas.append(float((new - old) / old))
            abs_deltas.append(float(new - old))
        pct_std = float(np.std(pct_deltas)) if pct_deltas else 1.0
        abs_std = float(np.std(abs_deltas)) if abs_deltas else 1.0
        blanket_pct = pct_std < 0.005          # all ~same % change
        blanket_abs = abs_std < 0.01           # all ~same $ change
        blocked = blanket_pct or blanket_abs
        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message="Arbitrary price-smoothing check complete.",
            data={
                "items": len(changes),
                "uniform_pct_change_detected": blanket_pct,
                "uniform_abs_change_detected": blanket_abs,
                "block_recommendation": blocked,
                "verdict": "BLOCK: non-methodical blanket change across diverse portfolio"
                           if blocked else "OK: changes are differentiated",
            },
            telemetry={"pct_std": round(pct_std, 5), "abs_std": round(abs_std, 5)},
        )


class MaturityAssessmentEngine(OptimizationEngine):
    """Feature 34: self-diagnostic RGM/RMM maturity score across capability
    dimensions, derived from which data assets & engines are actually present."""

    feature_id = 34
    name = "maturity_assessment"

    DIMENSIONS = ["pricing", "data_ingestion", "trade_terms", "promo_mix",
                  "elasticity_science", "three_c_governance"]

    def run(self, db: Session, **kwargs) -> EngineResult:
        def count(tbl):
            try:
                return int(db.execute(text(f"SELECT COUNT(*) FROM {tbl}")).scalar() or 0)
            except Exception:
                return 0

        has_sales = count("sales_data") > 0
        has_market = count("market_data") > 0
        has_forecast = count("forecast_data") > 0
        has_inventory = count("inventory_data") > 0
        has_commodity = count("commodity_cost") > 0
        has_guardrails = count("pricing_guardrail_config") > 0

        scores = {
            "pricing": 70 if has_sales else 20,
            "data_ingestion": 40 + (20 if has_market else 0) + (20 if has_forecast else 0),
            "trade_terms": 55 if has_sales else 15,
            "promo_mix": 65 if has_sales else 20,
            "elasticity_science": 75 if has_sales else 25,
            "three_c_governance": 50 + (25 if has_guardrails else 0) + (10 if has_commodity else 0),
        }
        overall = round(sum(scores.values()) / len(scores), 1)
        # Localized step-up tasks for the weakest dimensions.
        tasks = []
        for dim, sc in sorted(scores.items(), key=lambda kv: kv[1]):
            if sc < 70:
                tasks.append({"dimension": dim, "score": sc,
                              "action": _maturity_task(dim, has_commodity, has_guardrails)})
        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message=f"RGM/RMM maturity score: {overall}/100.",
            data={
                "overall_score": overall,
                "stage": _maturity_stage(overall),
                "dimension_scores": scores,
                "step_up_tasks": tasks[:4],
                "signals": {
                    "sales": has_sales, "market": has_market, "forecast": has_forecast,
                    "inventory": has_inventory, "commodity_feed": has_commodity,
                    "guardrail_config": has_guardrails,
                },
            },
        )


def _maturity_stage(score: float) -> str:
    if score >= 80:
        return "Leading"
    if score >= 60:
        return "Established"
    if score >= 40:
        return "Developing"
    return "Nascent"


def _maturity_task(dim: str, has_commodity: bool, has_guardrails: bool) -> str:
    return {
        "pricing": "Stand up SKU/account-level elasticity baselines.",
        "data_ingestion": "Connect syndicated (Nielsen/IRI) and forecast feeds for harmonization.",
        "trade_terms": "Codify trade-fund guardrails and G2N approval thresholds.",
        "promo_mix": "Adopt pre-event promo simulation and post-event ROI scorecards.",
        "elasticity_science": "Enable context-dependent elasticity and non-linear demand fits.",
        "three_c_governance": ("Seed commodity cost feed." if not has_commodity
                               else "Configure pricing guardrail thresholds." if not has_guardrails
                               else "Adopt the joint 3-C scorecard in pricing reviews."),
    }.get(dim, "Review capability gaps.")
