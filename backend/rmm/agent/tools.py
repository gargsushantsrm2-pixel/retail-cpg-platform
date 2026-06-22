"""
Tool registry for the RGM Copilot.

Each tool wraps an existing RMM engine. The same registry powers both backends:
the Claude tool-use loop (consumes `schema`) and the deterministic router
(consumes `keywords` + `fn`). Every `fn` takes a DB session plus parsed args and
returns a JSON-serializable dict.
"""

from __future__ import annotations

from typing import Any, Callable, Dict, List
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..engines.elasticity import ContextElasticityEngine, CannibalizationEngine
from ..engines.promotions import PromoSimulatorEngine
from ..engines.governance import SkuProliferationGovernor, MaturityAssessmentEngine
from ..engines.investment import B2BDealPricerEngine, DecisionGuideEngine
from ..engines.pricing_arch import CompetitorIndexEngine
from ..engines.demand import SegmentedDemandEngine, PromoTimingEngine


def _data(result) -> Dict[str, Any]:
    d = result.to_dict()
    return {"ok": d.get("ok"), "message": d.get("message"),
            "safe_baseline": d.get("safe_baseline"), **d.get("data", {})}


# ── tool implementations ──────────────────────────────────────────────────────

def _elasticity(db, product_id: str = None, **_):
    return _data(ContextElasticityEngine().run(db, product_id=product_id))

def _cannibalization(db, product_id: str = None, price_change_pct: float = 5.0, **_):
    return _data(CannibalizationEngine().run(db, product_id=product_id, price_change_pct=price_change_pct))

def _promo(db, product_id: str = None, promo_type: str = "Display+Feature",
           discount_pct: float = 0.15, duration_weeks: int = 4, **_):
    return _data(PromoSimulatorEngine().run(db, product_id=product_id, promo_type=promo_type,
                                            discount_pct=discount_pct, duration_weeks=duration_weeks,
                                            display=True, feature=True))

def _b2b(db, product_id: str = None, committed_volume: float = 20000, **_):
    return _data(B2BDealPricerEngine().run(db, product_id=product_id, committed_volume=committed_volume))

def _decision_guides(db, cost_spike_pct: float = 4.0, **_):
    return _data(DecisionGuideEngine().run(db, cost_spike_pct=cost_spike_pct))

def _competitor_alerts(db, **_):
    return _data(CompetitorIndexEngine().run(db))

def _sku_governor(db, margin_floor_pct: float = 30.0, **_):
    return _data(SkuProliferationGovernor().run(db, margin_floor_pct=margin_floor_pct))

def _maturity(db, **_):
    return _data(MaturityAssessmentEngine().run(db))

def _segmented(db, price_change_pct: float = 5.0, **_):
    return _data(SegmentedDemandEngine().run(db, price_change_pct=price_change_pct))

def _promo_timing(db, category: str = "Beverages", **_):
    return _data(PromoTimingEngine().run(db, category=category))

def _list_catalog(db, **_):
    prods = db.execute(text("SELECT product_id, sku_name, brand, category FROM products")).fetchall()
    return {"products": [{"product_id": p[0], "sku_name": p[1], "brand": p[2], "category": p[3]} for p in prods],
            "categories": sorted({p[3] for p in prods})}


TOOLS: List[Dict[str, Any]] = [
    {
        "name": "list_catalog",
        "description": "List all products (id, name, brand, category) and categories. Call this first if you need to resolve a product or category mentioned by the user.",
        "schema": {"type": "object", "properties": {}},
        "fn": _list_catalog,
        "keywords": ["list", "catalog", "products", "skus", "what products"],
    },
    {
        "name": "price_elasticity",
        "description": "Get price elasticity for a SKU across 4 contexts (isolated, promotional, brand-wide, category-wide) plus a non-linear demand pass-through recommendation.",
        "schema": {"type": "object", "properties": {"product_id": {"type": "string"}}, "required": ["product_id"]},
        "fn": _elasticity,
        "keywords": ["elasticity", "price sensitive", "sensitivity", "demand curve"],
    },
    {
        "name": "cannibalization",
        "description": "Estimate how a price change on a SKU shifts volume to own-portfolio siblings (recapture) vs out to competitors (leakage).",
        "schema": {"type": "object", "properties": {"product_id": {"type": "string"}, "price_change_pct": {"type": "number"}}, "required": ["product_id"]},
        "fn": _cannibalization,
        "keywords": ["cannibal", "leakage", "recapture", "steal volume", "switch"],
    },
    {
        "name": "simulate_promo",
        "description": "Predict a promotion's lift, incremental revenue, trade spend, company ROI and retailer margin for a SKU.",
        "schema": {"type": "object", "properties": {
            "product_id": {"type": "string"},
            "promo_type": {"type": "string", "enum": ["TPR", "Display", "Feature", "Display+Feature", "Display+Feature+TPR"]},
            "discount_pct": {"type": "number", "description": "fraction e.g. 0.15"},
            "duration_weeks": {"type": "integer"}}, "required": ["product_id"]},
        "fn": _promo,
        "keywords": ["promo", "promotion", "discount", "bogo", "tpr", "feature", "lift", "roi"],
    },
    {
        "name": "b2b_deal_pricer",
        "description": "Find the optimal B2B contract discount that maximizes win-probability x account value for a SKU and committed volume.",
        "schema": {"type": "object", "properties": {"product_id": {"type": "string"}, "committed_volume": {"type": "number"}}, "required": ["product_id"]},
        "fn": _b2b,
        "keywords": ["b2b", "contract", "deal", "bid", "win probability", "tender"],
    },
    {
        "name": "decision_guides",
        "description": "Generate prescriptive action items for the lowest-margin SKUs in response to a raw-material cost spike (percent).",
        "schema": {"type": "object", "properties": {"cost_spike_pct": {"type": "number"}}},
        "fn": _decision_guides,
        "keywords": ["cost spike", "cost increase", "inflation", "what should i do", "playbook", "recommend"],
    },
    {
        "name": "competitor_alerts",
        "description": "Index our brands' prices vs the category competitor average and flag corridor breaches.",
        "schema": {"type": "object", "properties": {}},
        "fn": _competitor_alerts,
        "keywords": ["competitor", "competition", "index", "corridor", "price gap", "alert"],
    },
    {
        "name": "sku_governor",
        "description": "Flag low-revenue, low-margin SKUs as prune candidates (portfolio rationalization).",
        "schema": {"type": "object", "properties": {"margin_floor_pct": {"type": "number"}}},
        "fn": _sku_governor,
        "keywords": ["prune", "delist", "rationalize", "too many skus", "proliferation", "cut"],
    },
    {
        "name": "rgm_maturity",
        "description": "Assess RGM/RMM capability maturity (0-100 per dimension) with localized step-up tasks.",
        "schema": {"type": "object", "properties": {}},
        "fn": _maturity,
        "keywords": ["maturity", "capability", "readiness", "how good", "assessment"],
    },
    {
        "name": "segmented_demand",
        "description": "Predict, for a price change, which consumer segments switch brands vs drop out of the category.",
        "schema": {"type": "object", "properties": {"price_change_pct": {"type": "number"}}},
        "fn": _segmented,
        "keywords": ["segment", "demographic", "who switches", "drop out", "shopper"],
    },
    {
        "name": "promo_timing",
        "description": "Identify demand peaks/troughs for a category to time promotions (promote in troughs, hold list price in peaks).",
        "schema": {"type": "object", "properties": {"category": {"type": "string"}}},
        "fn": _promo_timing,
        "keywords": ["timing", "when to promote", "seasonality", "calendar", "best time"],
    },
]

TOOLS_BY_NAME: Dict[str, Dict[str, Any]] = {t["name"]: t for t in TOOLS}


def anthropic_tool_defs() -> List[Dict[str, Any]]:
    """Tool definitions in the Anthropic tool-use format."""
    return [{"name": t["name"], "description": t["description"], "input_schema": t["schema"]} for t in TOOLS]


def execute_tool(db: Session, name: str, args: Dict[str, Any]) -> Dict[str, Any]:
    tool = TOOLS_BY_NAME.get(name)
    if not tool:
        return {"error": f"unknown tool {name}"}
    try:
        return tool["fn"](db, **(args or {}))
    except Exception as e:  # tools never crash the agent
        return {"error": str(e)}
