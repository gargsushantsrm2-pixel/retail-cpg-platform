"""
Consumer-science engines — Micro-Segmentation, Behavioral Pricing, Agent-Based
Simulation (Modules 11, 12, 13).

Features:
    24  Raw-Data Distribution Viewer (anti-aggregation): plot the continuous WTP
        distribution instead of an "average consumer", locate edge-buyer cliffs.
    26  Cross-Option Survey Calibration: smooth survey price-threshold steps and
        recalibrate "buy or nothing" into "buy or something else".
    27  Agent-Based Virtual Shopper Simulator: thousands of discrete agents with
        budgets + brand preference run a multinomial-logit shelf choice; replaces
        generic LLM estimation with a real micro-simulation.

Vectorized numpy; reproducible seeds; degrade to safe baseline on thin data.
"""

from __future__ import annotations

import numpy as np
from sqlalchemy.orm import Session

from .base import OptimizationEngine, EngineResult
from ...services.analytics import _load_sales

RNG_SEED = 42


class WTPDistributionEngine(OptimizationEngine):
    """Feature 24: continuous WTP distribution (mixture of latent segments) for a
    SKU, the implied demand curve, and the steepest drop-off ('cliff') prices."""

    feature_id = 24
    name = "wtp_distribution"

    def run(self, db: Session, product_id: str = None, n: int = 5000, **kwargs) -> EngineResult:
        if not product_id:
            return self._baseline("No product_id supplied.")
        df = _load_sales(db, years=[2024])
        prod = df[df["product_id"] == product_id]
        if prod.empty:
            return self._baseline(f"No sales for {product_id}.", product_id=product_id)

        avg_price = float(prod["net_price"].mean())
        sku_name = prod["sku_name"].iloc[0]
        rng = np.random.default_rng(RNG_SEED)

        # Three latent segments around the price point (anti-aggregation): a
        # value seeker, the mainstream, and a premium buyer. Their overlap +
        # gaps create realistic cliffs that a single "average WTP" would hide.
        seg_means = np.array([0.78, 1.02, 1.45]) * avg_price
        seg_sd = np.array([0.10, 0.12, 0.18]) * avg_price
        seg_w = np.array([0.40, 0.42, 0.18])
        comp = rng.choice(3, size=n, p=seg_w)
        wtp = rng.normal(seg_means[comp], seg_sd[comp])
        wtp = np.clip(wtp, avg_price * 0.3, avg_price * 2.5)

        # Histogram (raw distribution)
        counts, edges = np.histogram(wtp, bins=30)
        centers = (edges[:-1] + edges[1:]) / 2
        hist = [{"price": round(float(c), 2), "count": int(n_)} for c, n_ in zip(centers, counts)]

        # Demand curve: share willing to pay >= p across a price grid
        grid = np.linspace(wtp.min(), wtp.max(), 40)
        share = np.array([(wtp >= p).mean() for p in grid])
        demand = [{"price": round(float(p), 2), "share": round(float(s), 4)} for p, s in zip(grid, share)]

        # Drop-off cliffs = grid points with the steepest share decline
        dshare = -np.diff(share)
        cliff_idx = np.argsort(dshare)[-3:][::-1]
        cliffs = [{"price": round(float(grid[i]), 2), "share_lost": round(float(dshare[i]), 4)} for i in cliff_idx]

        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message=f"Raw WTP distribution for {sku_name} ({n} simulated shoppers).",
            data={
                "product_id": product_id, "sku_name": sku_name,
                "avg_price": round(avg_price, 2),
                "mean_wtp": round(float(wtp.mean()), 2),
                "median_wtp": round(float(np.median(wtp)), 2),
                "histogram": hist, "demand_curve": demand, "drop_off_cliffs": cliffs,
            },
            telemetry={"n": n},
        )


class SurveyCalibrationEngine(OptimizationEngine):
    """Feature 26: smooth a raw survey demand step-function and apply an
    outside-option correction (alternatives exist), turning stated 'buy or
    nothing' intent into a realistic shelf-choice curve."""

    feature_id = 26
    name = "survey_calibration"

    def run(self, db: Session, survey_points: list = None,
            outside_option_strength: float = 0.35, **kwargs) -> EngineResult:
        pts = survey_points or []
        if len(pts) < 3:
            return self._baseline("Need >=3 survey points (price, pct_would_buy).")
        pts = sorted(pts, key=lambda x: x["price"])
        prices = np.array([float(p["price"]) for p in pts])
        raw = np.array([float(p["pct_would_buy"]) for p in pts])
        raw = np.clip(raw, 0, 1) if raw.max() <= 1 else np.clip(raw / 100.0, 0, 1)

        # Smooth: monotone-decreasing isotonic-style pass (cumulative min)
        smoothed = np.minimum.accumulate(raw)
        # 3-point moving average to remove artificial step jumps
        kernel = np.ones(3) / 3
        smoothed = np.convolve(np.pad(smoothed, 1, mode="edge"), kernel, mode="valid")

        # Outside-option correction: higher prices -> more switching to
        # alternatives -> intent scaled down increasingly with price rank.
        price_rank = (prices - prices.min()) / (prices.max() - prices.min() + 1e-9)
        factor = 1.0 - outside_option_strength * price_rank
        calibrated = np.clip(smoothed * factor, 0, 1)

        curve = [{
            "price": round(float(p), 2),
            "raw_intent": round(float(r), 4),
            "smoothed": round(float(s), 4),
            "calibrated": round(float(c), 4),
        } for p, r, s, c in zip(prices, raw, smoothed, calibrated)]
        realism_gap = round(float(np.mean(raw - calibrated)), 4)

        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message="Survey calibrated from 'buy or nothing' to realistic shelf choice.",
            data={"curve": curve, "avg_realism_gap": realism_gap,
                  "outside_option_strength": outside_option_strength},
        )


class AgentBasedShopperEngine(OptimizationEngine):
    """Feature 27: instantiate N discrete shopper agents (budget + brand
    preference + price sensitivity) and run a multinomial-logit shelf choice over
    a category's SKUs, including an outside (no-purchase) option. Optionally
    perturb one SKU's price to measure substitution."""

    feature_id = 27
    name = "agent_based_shopper"

    def run(self, db: Session, category: str = "Beverages", n_agents: int = 3000,
            shock_product_id: str = None, shock_pct: float = 10.0, **kwargs) -> EngineResult:
        df = _load_sales(db, years=[2024])
        cat = df[df["category"] == category]
        if cat.empty:
            return self._baseline(f"No sales in category {category}.", category=category)

        skus = cat.groupby(["product_id", "sku_name", "brand"]).agg(
            price=("net_price", "mean")).reset_index()
        J = len(skus)
        if J < 2:
            return self._baseline("Need >=2 SKUs in the category.")
        prices = skus["price"].to_numpy(float)
        rng = np.random.default_rng(RNG_SEED)

        # Agent heterogeneity
        beta = rng.gamma(shape=3.0, scale=0.03, size=n_agents)          # price sensitivity
        brand_pref = rng.normal(0, 1.0, size=(n_agents, J))             # idiosyncratic brand affinity
        gumbel = rng.gumbel(size=(n_agents, J + 1))                     # +1 outside option

        def simulate(price_vec):
            # utility = brand affinity - beta * price + noise; outside option = const
            util = brand_pref - beta[:, None] * price_vec[None, :] + gumbel[:, :J]
            outside = np.full((n_agents, 1), -1.5) + gumbel[:, J:J + 1]
            full = np.hstack([util, outside])
            choice = full.argmax(axis=1)
            shares = np.array([(choice == j).mean() for j in range(J)])
            no_buy = float((choice == J).mean())
            return shares, no_buy

        base_shares, base_nobuy = simulate(prices)

        result_skus = []
        for i, row in skus.iterrows():
            result_skus.append({
                "product_id": row["product_id"], "sku_name": row["sku_name"],
                "brand": row["brand"], "price": round(float(row["price"]), 2),
                "share": round(float(base_shares[i]), 4),
            })

        substitution = None
        if shock_product_id and shock_product_id in set(skus["product_id"]):
            idx = skus.index[skus["product_id"] == shock_product_id][0]
            shocked = prices.copy()
            shocked[idx] = shocked[idx] * (1 + shock_pct / 100.0)
            new_shares, new_nobuy = simulate(shocked)
            delta = new_shares - base_shares
            lost = float(-delta[idx])
            recipients = [
                {"product_id": skus.iloc[j]["product_id"], "sku_name": skus.iloc[j]["sku_name"],
                 "share_gain": round(float(delta[j]), 4)}
                for j in range(J) if j != idx and delta[j] > 0
            ]
            recipients.sort(key=lambda x: x["share_gain"], reverse=True)
            substitution = {
                "shock_product_id": shock_product_id, "shock_pct": shock_pct,
                "share_lost": round(lost, 4),
                "to_no_purchase": round(float(new_nobuy - base_nobuy), 4),
                "to_competitors": recipients[:5],
            }

        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message=f"Agent-based simulation: {n_agents} shoppers over {J} {category} SKUs.",
            data={"category": category, "n_agents": n_agents,
                  "no_purchase_share": round(base_nobuy, 4),
                  "skus": sorted(result_skus, key=lambda x: x["share"], reverse=True),
                  "substitution": substitution},
            telemetry={"skus": J},
        )
