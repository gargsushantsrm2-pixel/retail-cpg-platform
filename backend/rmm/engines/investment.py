"""
Commercial Investment & AI Prescriptive engines (Modules 7, 8).

Features:
    16  Automated Strategic Growth Decision Guides
    17  Cross-Lever Investment Optimization Workspace
    19  B2B Commercial Deal & Contract Pricer (win-probability optimizer)
"""

from __future__ import annotations

import numpy as np
from sqlalchemy.orm import Session

from .base import OptimizationEngine, EngineResult
from ..money import D, money, margin_pct, to_pct_display, safe_div
from ...services.analytics import _load_sales


class B2BDealPricerEngine(OptimizationEngine):
    """Feature 19: find the discount that maximizes expected account value
    (win-probability x contribution) for a B2B volume commitment."""

    feature_id = 19
    name = "b2b_deal_pricer"

    def run(self, db: Session, product_id: str = None, committed_volume: float = 10000,
            competitor_discount_pct: float = 0.12, **kwargs) -> EngineResult:
        if not product_id:
            return self._baseline("No product_id supplied.")
        df = _load_sales(db, years=[2024])
        prod = df[df["product_id"] == product_id]
        if prod.empty:
            return self._baseline(f"No sales for {product_id}.", product_id=product_id)
        base_price = float(prod["net_price"].mean())
        unit_cogs = float(prod["cogs"].sum() / max(prod["volume_cases"].sum(), 1))

        discounts = np.linspace(0, 0.40, 41)
        d0 = competitor_discount_pct
        # Win probability rises with how much we beat the competitor benchmark.
        win_prob = 1.0 / (1.0 + np.exp(-25.0 * (discounts - d0)))
        net_price = base_price * (1 - discounts)
        unit_contribution = net_price - unit_cogs
        account_value = unit_contribution * committed_volume
        expected_value = win_prob * account_value

        best = int(np.argmax(expected_value))
        curve = [{
            "discount_pct": round(float(discounts[i]) * 100, 1),
            "win_probability": round(float(win_prob[i]), 3),
            "account_value": round(float(account_value[i]), 0),
            "expected_value": round(float(expected_value[i]), 0),
        } for i in range(0, 41, 2)]
        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message="Optimal B2B contract discount computed.",
            data={
                "product_id": product_id, "committed_volume": committed_volume,
                "base_price": round(base_price, 2),
                "optimal_discount_pct": round(float(discounts[best]) * 100, 1),
                "win_probability_at_optimal": round(float(win_prob[best]), 3),
                "expected_value_at_optimal": round(float(expected_value[best]), 0),
                "net_price_at_optimal": round(float(net_price[best]), 2),
                "margin_at_optimal_pct": to_pct_display(margin_pct(net_price[best], unit_cogs), 1),
                "curve": curve,
            },
        )


class InvestmentOptimizerEngine(OptimizationEngine):
    """Feature 17: allocate a commercial budget across brand marketing, trade
    spend and NPD using concave (diminishing-return) response curves; greedy
    marginal allocation maximizes total return."""

    feature_id = 17
    name = "investment_optimizer"

    # response coefficient (return = coef * sqrt(spend)); higher = more efficient
    LEVERS = {"brand_marketing": 3.2, "trade_spend": 2.6, "npd_capital": 3.8}

    def run(self, db: Session, total_budget: float = 1_000_000, increments: int = 100,
            **kwargs) -> EngineResult:
        step = total_budget / increments
        alloc = {k: 0.0 for k in self.LEVERS}

        def marginal(lever, current):
            coef = self.LEVERS[lever]
            return coef * (np.sqrt(current + step) - np.sqrt(current))

        for _ in range(increments):
            best = max(self.LEVERS, key=lambda k: marginal(k, alloc[k]))
            alloc[best] += step
        total_return = sum(self.LEVERS[k] * np.sqrt(v) for k, v in alloc.items())
        breakdown = [{
            "lever": k.replace("_", " ").title(),
            "allocation": round(v, 0),
            "allocation_pct": round(v / total_budget * 100, 1),
            "projected_return": round(self.LEVERS[k] * float(np.sqrt(v)), 0),
        } for k, v in alloc.items()]
        breakdown.sort(key=lambda x: x["allocation"], reverse=True)
        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message="Optimal cross-lever budget allocation computed.",
            data={"total_budget": total_budget,
                  "projected_total_return": round(float(total_return), 0),
                  "roi_multiple": round(float(total_return) / total_budget, 3),
                  "allocation": breakdown},
        )


class DecisionGuideEngine(OptimizationEngine):
    """Feature 16: generate prescriptive action items from the current portfolio
    state and a what-if cost shock."""

    feature_id = 16
    name = "decision_guides"

    def run(self, db: Session, cost_spike_pct: float = 4.0, **kwargs) -> EngineResult:
        df = _load_sales(db, years=[2024])
        if df.empty:
            return self._baseline("No sales data.")
        sku = df.groupby(["product_id", "sku_name", "category"]).agg(
            rev=("revenue", "sum"), gp=("gross_profit", "sum"),
            vol=("volume_cases", "sum")).reset_index()
        sku["gm_pct"] = sku["gp"] / sku["rev"].replace(0, np.nan) * 100
        guides = []
        # most cost-exposed (lowest margin, high volume) SKUs get the playbook
        exposed = sku.sort_values("gm_pct").head(3)
        for _, r in exposed.iterrows():
            # absorb half the spike via price, rest via pack/promo
            price_move = round(cost_spike_pct * 0.5, 1)
            guides.append({
                "product_id": r["product_id"], "sku_name": r["sku_name"],
                "current_gm_pct": round(float(r["gm_pct"]), 1),
                "trigger": f"{cost_spike_pct}% raw-material cost spike",
                "actions": [
                    f"Take a +{price_move}% list price increase (half-cost pass-through).",
                    "Reduce promo frequency by 10% to protect realized margin.",
                    "Scale pack size down ~5% to hold the entry price point.",
                ],
            })
        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message=f"{len(guides)} decision guide(s) for a {cost_spike_pct}% cost spike.",
            data={"cost_spike_pct": cost_spike_pct, "guides": guides},
        )
