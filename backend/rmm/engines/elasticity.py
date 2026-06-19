"""
Elasticity & non-linear demand engines (Module 1 + Module 10).

Features:
    1   Multi-Variant Price Elasticity Modeling
    2   Cross-Elasticity & Cannibalization Tracker
    22  Context-Dependent Elasticity Field Matrix (4 scenarios)
    23  Non-Linear Demand Function Core (linear vs constant-elasticity)

These extend the existing log-log elasticity in services.analytics with
context segmentation and an explicit non-linear demand fit, and feed the
3-C consumer axis. They never raise on thin data — they degrade to a
safe-baseline elasticity (rule #4).
"""

from __future__ import annotations

import numpy as np
from sqlalchemy.orm import Session

from .base import OptimizationEngine, EngineResult
from ...services.analytics import _load_sales  # reuse existing joined loader

# A conservative default elasticity used when a context has too few points.
SAFE_BASELINE_ELASTICITY = -2.0
MIN_POINTS = 10


def _loglog_elasticity(price: np.ndarray, volume: np.ndarray):
    """Return (elasticity, r2, n) from a log-log OLS fit, or (None, None, n)."""
    mask = (price > 0) & (volume > 0)
    p, v = price[mask], volume[mask]
    n = int(mask.sum())
    if n < MIN_POINTS or np.unique(p).size < 3:
        return None, None, n
    lp, lv = np.log(p), np.log(v)
    # slope of lv ~ lp via least squares
    b, a = np.polyfit(lp, lv, 1)
    pred = a + b * lp
    ss_res = float(np.sum((lv - pred) ** 2))
    ss_tot = float(np.sum((lv - lv.mean()) ** 2)) or 1.0
    r2 = 1.0 - ss_res / ss_tot
    return float(b), float(r2), n


class ContextElasticityEngine(OptimizationEngine):
    """Feature 22: elasticity as a dynamic field across 4 contexts, plus the
    feature-23 non-linear demand classification for the SKU."""

    feature_id = 22
    name = "context_elasticity"

    def run(self, db: Session, product_id: str = None, **kwargs) -> EngineResult:
        if not product_id:
            return self._baseline("No product_id supplied.")
        df = _load_sales(db)
        prod = df[df["product_id"] == product_id]
        if prod.empty:
            return self._baseline(f"No sales for product {product_id}.", product_id=product_id)

        brand = prod["brand"].iloc[0]
        category = prod["category"].iloc[0]
        sku_name = prod["sku_name"].iloc[0]

        # ── 4 contexts (Module 22) ──────────────────────────────────────────
        contexts = {}

        # Isolated Shift: non-promo weeks for this SKU
        iso = prod[prod["promo_flag"] == False]
        contexts["isolated"] = self._ctx(iso["net_price"].values, iso["volume_cases"].values,
                                         "Isolated single-SKU price moves (non-promo)")

        # Promotional Shift: promo weeks for this SKU
        promo = prod[prod["promo_flag"] == True]
        contexts["promotional"] = self._ctx(promo["net_price"].values, promo["volume_cases"].values,
                                            "Discount-context elasticity")

        # Brand-Wide Shift: aggregate weekly across the whole brand
        brand_df = df[df["brand"] == brand]
        bw = brand_df.groupby("week_date").agg(
            price=("net_price", "mean"), vol=("volume_cases", "sum")).reset_index()
        contexts["brand_wide"] = self._ctx(bw["price"].values, bw["vol"].values,
                                           "Uniform brand-line shift")

        # Category-Wide Inflation: aggregate weekly across the category
        cat_df = df[df["category"] == category]
        cw = cat_df.groupby("week_date").agg(
            price=("net_price", "mean"), vol=("volume_cases", "sum")).reset_index()
        contexts["category_wide"] = self._ctx(cw["price"].values, cw["vol"].values,
                                              "Industry-wide / category inflation shift")

        # ── Non-linear demand core (Module 23) ──────────────────────────────
        nonlinear = self._nonlinear(prod["net_price"].values, prod["volume_cases"].values)

        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message=f"Context elasticity matrix for {sku_name}.",
            data={
                "product_id": product_id, "sku_name": sku_name,
                "brand": brand, "category": category,
                "context_matrix": contexts,
                "non_linear_demand": nonlinear,
            },
            telemetry={"rows": int(len(prod))},
        )

    def _ctx(self, price, volume, desc):
        e, r2, n = _loglog_elasticity(np.asarray(price, float), np.asarray(volume, float))
        if e is None:
            return {"elasticity": SAFE_BASELINE_ELASTICITY, "r_squared": None,
                    "n": n, "safe_baseline": True, "description": desc}
        return {"elasticity": round(e, 3), "r_squared": round(r2, 3),
                "n": n, "safe_baseline": False, "description": desc}

    def _nonlinear(self, price, volume):
        """Fit linear demand Q = a + b*P and constant-elasticity Q = a*P^b.
        Linear demand => optimal cost pass-through ~50% (absolute);
        constant-elasticity => maintain constant gross-margin % (proportional)."""
        price = np.asarray(price, float)
        volume = np.asarray(volume, float)
        mask = (price > 0) & (volume > 0)
        p, v = price[mask], volume[mask]
        if p.size < MIN_POINTS or np.unique(p).size < 3:
            return {"recommended_rule": "constant_gross_margin_pct", "safe_baseline": True,
                    "reason": "insufficient price variation"}

        # Linear fit
        b_lin, a_lin = np.polyfit(p, v, 1)
        lin_pred = a_lin + b_lin * p
        r2_lin = 1.0 - np.sum((v - lin_pred) ** 2) / (np.sum((v - v.mean()) ** 2) or 1.0)

        # Power fit via log-log
        b_pow, a_pow_log = np.polyfit(np.log(p), np.log(v), 1)
        pow_pred = np.exp(a_pow_log) * p ** b_pow
        r2_pow = 1.0 - np.sum((v - pow_pred) ** 2) / (np.sum((v - v.mean()) ** 2) or 1.0)

        if r2_lin >= r2_pow:
            rule = "half_cost_absolute_passthrough"
            note = ("Linear demand dominates: pass through ~50% of an absolute cost "
                    "change to maximize profit.")
        else:
            rule = "constant_gross_margin_pct"
            note = ("Constant-elasticity (exponential) demand dominates: maintain a "
                    "constant gross-margin % (full proportional pass-through).")
        return {
            "linear_fit": {"slope": round(float(b_lin), 4), "r_squared": round(float(r2_lin), 3)},
            "power_fit": {"exponent": round(float(b_pow), 4), "r_squared": round(float(r2_pow), 3)},
            "recommended_rule": rule,
            "note": note,
            "safe_baseline": False,
        }


class CannibalizationEngine(OptimizationEngine):
    """Feature 2: estimate own-portfolio volume leakage. For a target SKU's price
    move, approximate how much volume shifts to sibling SKUs (same category)
    vs. leaks out of the portfolio entirely, using weekly cross-correlations of
    volume against the target's price."""

    feature_id = 2
    name = "cannibalization"

    def run(self, db: Session, product_id: str = None, price_change_pct: float = 5.0, **kwargs) -> EngineResult:
        if not product_id:
            return self._baseline("No product_id supplied.")
        df = _load_sales(db)
        target = df[df["product_id"] == product_id]
        if target.empty:
            return self._baseline(f"No sales for {product_id}.", product_id=product_id)

        category = target["category"].iloc[0]
        brand = target["brand"].iloc[0]
        tgt_weekly = target.groupby("week_date").agg(
            tprice=("net_price", "mean"), tvol=("volume_cases", "sum")).reset_index()

        siblings = df[(df["category"] == category) & (df["product_id"] != product_id)]
        leakage = []
        for sib_id, grp in siblings.groupby("product_id"):
            sw = grp.groupby("week_date").agg(svol=("volume_cases", "sum")).reset_index()
            merged = tgt_weekly.merge(sw, on="week_date", how="inner")
            if len(merged) < MIN_POINTS or merged["tprice"].nunique() < 3:
                continue
            # cross-elasticity proxy: corr(sibling volume, target price)
            # positive => sibling gains when target price rises (substitution)
            corr = float(np.corrcoef(merged["svol"], merged["tprice"])[0, 1])
            if np.isnan(corr):
                continue
            leakage.append({
                "product_id": sib_id,
                "sku_name": grp["sku_name"].iloc[0],
                "brand": grp["brand"].iloc[0],
                "same_brand": bool(grp["brand"].iloc[0] == brand),
                "cross_corr": round(corr, 3),
            })

        # Split substitution into own-portfolio recapture vs competitor loss.
        own_pull = sum(max(0.0, l["cross_corr"]) for l in leakage)
        # Heuristic: own recapture ratio = own substitution strength capped at 1.
        recapture_ratio = float(min(1.0, own_pull))
        leaked_to_competitor = round((1.0 - recapture_ratio) * 100, 1)

        leakage.sort(key=lambda x: x["cross_corr"], reverse=True)
        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message=f"Cannibalization map for {target['sku_name'].iloc[0]} on +{price_change_pct}% price.",
            data={
                "product_id": product_id,
                "category": category,
                "price_change_pct": price_change_pct,
                "own_portfolio_recapture_pct": round(recapture_ratio * 100, 1),
                "competitor_leakage_pct": leaked_to_competitor,
                "top_recipients": leakage[:5],
            },
            telemetry={"siblings_evaluated": len(leakage)},
        )
