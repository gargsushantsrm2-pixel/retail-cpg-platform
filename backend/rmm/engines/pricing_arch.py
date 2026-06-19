"""
Price Pack Architecture + Strategic pricing engines
(Modules 1, 3, 18, 24).

Features:
    3   Dynamic Competitor Indexing & Alerts
    7   Margin Contribution & Per-Ounce Matrix
    8   Premiumization & Channel Pack Alignment (white-space finder)
    35  Granular Multi-Tier Pricing Tier Editor (Good-Better-Best spacing)
    44  Attribute-Based Portfolio Price Architecture Indexer
"""

from __future__ import annotations

import re

import numpy as np
from sqlalchemy import text
from sqlalchemy.orm import Session

from .base import OptimizationEngine, EngineResult
from ..money import D, margin_pct, to_pct_display
from ...services.analytics import _load_sales, _load_market, OUR_BRANDS

_PACK_OZ = re.compile(r"(\d+)\s*x\s*([\d.]+)\s*oz", re.I)


def _pack_total_oz(pack: str):
    m = _PACK_OZ.search(pack or "")
    if not m:
        return None
    return float(m.group(1)) * float(m.group(2))


class PerOunceMatrixEngine(OptimizationEngine):
    """Feature 7: price-per-ounce and margin-per-ounce across the portfolio to
    expose where pack sizing clears entry price points without diluting per-oz
    profitability."""

    feature_id = 7
    name = "per_ounce_matrix"

    def run(self, db: Session, category: str = None, **kwargs) -> EngineResult:
        df = _load_sales(db, years=[2024])
        sql = ("SELECT product_id, sku_name, brand, category, subcategory, pack_size, base_price, cogs "
               "FROM products" + (" WHERE category = :c" if category else ""))
        prods = db.execute(text(sql), {"c": category} if category else {}).fetchall()
        rows = []
        avg_price = df.groupby("product_id")["net_price"].mean().to_dict()
        for p in prods:
            oz = _pack_total_oz(p[5])
            price = float(avg_price.get(p[0], p[6]))
            cogs = float(p[7])
            row = {
                "product_id": p[0], "sku_name": p[1], "brand": p[2],
                "category": p[3], "subcategory": p[4], "pack_size": p[5],
                "price": round(price, 2),
                "gross_margin_pct": to_pct_display(margin_pct(price, cogs), 1),
            }
            if oz:
                row["total_oz"] = round(oz, 1)
                row["price_per_oz"] = round(price / oz, 4)
                row["margin_per_oz"] = round((price - cogs) / oz, 4)
            rows.append(row)
        with_oz = [r for r in rows if "price_per_oz" in r]
        with_oz.sort(key=lambda r: r["price_per_oz"])
        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message=f"Per-ounce matrix ({len(with_oz)} oz-denominated SKUs).",
            data={"category": category, "matrix": with_oz,
                  "non_oz_skus": [r for r in rows if "price_per_oz" not in r]},
        )


class CompetitorIndexEngine(OptimizationEngine):
    """Feature 3: index our brands' prices against the category competitor
    average and alert when outside a strategic premium/discount corridor."""

    feature_id = 3
    name = "competitor_index"

    def run(self, db: Session, floor_index: float = 0.90, ceiling_index: float = 1.20,
            **kwargs) -> EngineResult:
        mkt = _load_market(db)
        if mkt.empty:
            return self._baseline("No market data feed.")
        latest = mkt.sort_values("week_date").groupby(["category", "brand"]).tail(1)
        alerts = []
        index_rows = []
        for cat, grp in latest.groupby("category"):
            comp = grp[~grp["brand"].isin(OUR_BRANDS)]
            comp_avg = float(comp["avg_selling_price"].mean()) if len(comp) else None
            if not comp_avg:
                continue
            for _, r in grp[grp["brand"].isin(OUR_BRANDS)].iterrows():
                idx = float(r["avg_selling_price"]) / comp_avg
                status = "WITHIN"
                if idx > ceiling_index:
                    status = "ABOVE_CEILING"
                elif idx < floor_index:
                    status = "BELOW_FLOOR"
                row = {"category": cat, "brand": r["brand"],
                       "our_price": round(float(r["avg_selling_price"]), 2),
                       "competitor_avg": round(comp_avg, 2),
                       "price_index": round(idx, 3), "status": status}
                index_rows.append(row)
                if status != "WITHIN":
                    alerts.append(row)
        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message=f"Competitor index computed; {len(alerts)} corridor breach alert(s).",
            data={"corridor": {"floor": floor_index, "ceiling": ceiling_index},
                  "index": index_rows, "alerts": alerts},
        )


class PremiumizationEngine(OptimizationEngine):
    """Feature 8: find white-space gaps in each category's price ladder where a
    higher-margin pack/bundle could slot without triggering cross-channel wars."""

    feature_id = 8
    name = "premiumization"

    def run(self, db: Session, **kwargs) -> EngineResult:
        df = _load_sales(db, years=[2024])
        sku = df.groupby(["product_id", "sku_name", "brand", "category"]).agg(
            price=("net_price", "mean"), gp=("gross_profit", "sum"),
            rev=("revenue", "sum")).reset_index()
        sku["gm_pct"] = sku["gp"] / sku["rev"].replace(0, np.nan) * 100
        whitespace = []
        for cat, grp in sku.groupby("category"):
            ladder = grp.sort_values("price")
            prices = ladder["price"].to_numpy()
            if len(prices) < 2:
                continue
            gaps = np.diff(prices)
            gi = int(np.argmax(gaps))
            top_gm = float(ladder["gm_pct"].max())
            whitespace.append({
                "category": cat,
                "gap_low": round(float(prices[gi]), 2),
                "gap_high": round(float(prices[gi + 1]), 2),
                "suggested_price": round(float((prices[gi] + prices[gi + 1]) / 2), 2),
                "headroom": round(float(gaps[gi]), 2),
                "target_margin_pct": round(top_gm, 1),
                "rationale": "Largest unfilled price step — slot a premium multi-pack here.",
            })
        whitespace.sort(key=lambda x: x["headroom"], reverse=True)
        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message=f"{len(whitespace)} premiumization white-space opportunities.",
            data={"opportunities": whitespace},
        )


class TierEditorEngine(OptimizationEngine):
    """Feature 35: derive Good-Better-Best tiers per category and validate that
    premium tiers scale cleanly above entry tiers (spacing rule check)."""

    feature_id = 35
    name = "tier_editor"

    def run(self, db: Session, category: str = "Beverages", min_spacing_pct: float = 15.0,
            **kwargs) -> EngineResult:
        df = _load_sales(db, years=[2024])
        cat = df[df["category"] == category]
        if cat.empty:
            return self._baseline(f"No sales in {category}.", category=category)
        sku = cat.groupby(["product_id", "sku_name", "brand"]).agg(
            price=("net_price", "mean")).reset_index().sort_values("price")
        prices = sku["price"].to_numpy()
        q1, q2 = np.quantile(prices, [1 / 3, 2 / 3])

        def tier(p):
            return "Good" if p <= q1 else ("Better" if p <= q2 else "Best")
        sku["tier"] = [tier(p) for p in prices]
        tiers = {}
        for t in ["Good", "Better", "Best"]:
            tp = sku[sku["tier"] == t]["price"]
            if len(tp):
                tiers[t] = {"min": round(float(tp.min()), 2), "max": round(float(tp.max()), 2),
                            "avg": round(float(tp.mean()), 2), "count": int(len(tp))}
        # spacing check between tier averages
        violations = []
        order = [t for t in ["Good", "Better", "Best"] if t in tiers]
        for a, b in zip(order, order[1:]):
            spacing = (tiers[b]["avg"] - tiers[a]["avg"]) / tiers[a]["avg"] * 100
            if spacing < min_spacing_pct:
                violations.append({"between": f"{a}->{b}", "spacing_pct": round(spacing, 1),
                                   "required_pct": min_spacing_pct})
        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message=f"{category} Good-Better-Best ladder; {len(violations)} spacing violation(s).",
            data={"category": category, "tiers": tiers,
                  "skus": sku.assign(price=sku["price"].round(2)).to_dict(orient="records"),
                  "spacing_violations": violations},
        )


class AttributeValueIndexEngine(OptimizationEngine):
    """Feature 44: build a non-linear value index for SKUs from attribute proxies
    (brand equity via market share, realized margin, price premium) where a clean
    per-ounce metric doesn't apply."""

    feature_id = 44
    name = "attribute_value_index"

    def run(self, db: Session, **kwargs) -> EngineResult:
        df = _load_sales(db, years=[2024])
        mkt = _load_market(db)
        share = (mkt.sort_values("week_date").groupby("brand").tail(1)
                 .set_index("brand")["volume_share_pct"].to_dict()) if not mkt.empty else {}
        sku = df.groupby(["product_id", "sku_name", "brand", "category"]).agg(
            price=("net_price", "mean"), gp=("gross_profit", "sum"),
            rev=("revenue", "sum")).reset_index()
        sku["gm_pct"] = sku["gp"] / sku["rev"].replace(0, np.nan) * 100
        cat_avg_price = sku.groupby("category")["price"].transform("mean")
        sku["price_premium"] = sku["price"] / cat_avg_price
        rows = []
        for _, r in sku.iterrows():
            brand_equity = float(share.get(r["brand"], 5.0))  # 0..~30
            # weighted value index (normalized-ish 0..100)
            idx = (0.4 * min(brand_equity / 30, 1) +
                   0.35 * min(float(r["gm_pct"]) / 60, 1) +
                   0.25 * min(float(r["price_premium"]) / 1.6, 1)) * 100
            rows.append({
                "product_id": r["product_id"], "sku_name": r["sku_name"],
                "brand": r["brand"], "category": r["category"],
                "brand_equity_share": round(brand_equity, 1),
                "gm_pct": round(float(r["gm_pct"]), 1),
                "price_premium": round(float(r["price_premium"]), 2),
                "value_index": round(idx, 1),
            })
        rows.sort(key=lambda x: x["value_index"], reverse=True)
        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message="Attribute-based portfolio value index computed.",
            data={"index": rows},
        )
