"""
RMM API controllers (integration rule #3: strict, fully-specified payloads).

Exposes the LIVE engines of the Revenue Margin Management layer. Every stateful
endpoint captures all input parameters and bounding conditions explicitly via
Pydantic models, and degrades to a safe-baseline payload rather than 500-ing
when analytical guardrails trip (rule #4).

Routes (prefix /api/v1/rmm):
    GET  /features                      24-module / 44-feature registry (M22/M42)
    GET  /features/{feature_id}         single feature flag state
    GET  /maturity                      RGM/RMM maturity assessment (F34)
    POST /three-c/score                 3-C joint optimization scorecard (F37/F38) + intercept
    POST /elasticity/context-matrix     context-dependent elasticity + non-linear core (F1/F22/F23)
    POST /cannibalization               cross-elasticity / portfolio leakage (F2)
    POST /guardrails/evaluate           run a proposed price action through the guardrail chain
    POST /cost-to-serve                 cost-to-serve adjusted promo margin (F18)
    POST /complexity-friction           complexity-to-margin friction (F33)
    GET  /commodity/exposure            commodity index shock exposure (F28)
    GET  /sku-governor                  SKU proliferation prune candidates (F40)
    POST /price-smoothing/check         arbitrary price-smoothing alert (F36)
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...models.rmm_entities import ThreeCScoreRecord
from ...rmm import features as feat
from ...rmm.three_c import (
    ThreeCScorecard, CompanyMarginProfile, CustomerMarginProfile, ConsumerWTPProfile,
)
from ...rmm.guardrails import (
    run_chain, WTPCorrelationGate, PriceChangeFrequencyGate, CharmRoundingPolicy,
    CompetitorCeilingLock, ThreeCCompromiseIntercept,
)
from ...rmm.engines.elasticity import ContextElasticityEngine, CannibalizationEngine
from ...rmm.engines.governance import (
    CostToServeEngine, ComplexityFrictionEngine, CommodityExposureEngine,
    SkuProliferationGovernor, PriceSmoothingAlert, MaturityAssessmentEngine,
)

router = APIRouter(prefix="/rmm", tags=["Revenue Margin Management"])


def _gate(feature_id: int):
    """Raise 423 (Locked) if a feature is disabled by the progressive-scaffolding
    flag (M22). LIVE features are enabled by default."""
    if not feat.is_enabled(feature_id):
        f = feat.get_feature(feature_id)
        raise HTTPException(
            status_code=423,
            detail={"feature_id": feature_id,
                    "name": f.name if f else "unknown",
                    "reason": "Feature is gated by progressive scope scaffolding (Module 22).",
                    "tier": f.tier.name if f else None},
        )


# ── Feature registry ──────────────────────────────────────────────────────────

@router.get("/features")
def list_features():
    return feat.registry_summary()


@router.get("/features/{feature_id}")
def get_feature(feature_id: int):
    f = feat.get_feature(feature_id)
    if not f:
        raise HTTPException(404, f"No feature {feature_id}")
    return f.to_dict()


# ── Maturity (F34) ────────────────────────────────────────────────────────────

@router.get("/maturity")
def maturity(db: Session = Depends(get_db)):
    _gate(34)
    return MaturityAssessmentEngine().run(db).to_dict()


# ── 3-C Joint Optimization Scorecard (F37/F38) ────────────────────────────────

class ThreeCRequest(BaseModel):
    product_id: Optional[str] = Field(None, description="Optional product reference for audit")
    customer_id: Optional[str] = Field(None, description="Optional customer reference for audit")
    # Company axis
    company_unit_price: float = Field(..., gt=0, description="Our net price to retailer")
    company_unit_cost: float = Field(..., ge=0, description="Our COGS (+ cost-to-serve)")
    company_target_margin: float = Field(0.35, ge=0, le=1, description="Target GM fraction")
    # Customer (retailer) axis
    retail_shelf_price: float = Field(..., gt=0, description="Shelf price to shopper")
    retailer_margin_floor: float = Field(0.25, ge=0, le=1, description="Contractual GM floor")
    # Consumer axis
    wtp_median: float = Field(..., gt=0, description="Median willingness-to-pay")
    wtp_p90: float = Field(..., gt=0, description="90th percentile WTP (cliff)")
    # Optional intercept floors
    min_company: float = Field(0.4, ge=0, le=1)
    min_customer: float = Field(0.4, ge=0, le=1)
    min_consumer: float = Field(0.4, ge=0, le=1)
    persist: bool = Field(True, description="Persist the score for audit")


@router.post("/three-c/score")
def three_c_score(req: ThreeCRequest, db: Session = Depends(get_db)):
    _gate(38)
    company = CompanyMarginProfile.build(req.company_unit_price, req.company_unit_cost, req.company_target_margin)
    customer = CustomerMarginProfile.build(req.retail_shelf_price, req.company_unit_price, req.retailer_margin_floor)
    consumer = ConsumerWTPProfile.build(req.retail_shelf_price, req.wtp_median, req.wtp_p90)

    card = ThreeCScorecard().evaluate(company, customer, consumer)

    # 3-C compromise intercept (guardrail M19)
    intercept = ThreeCCompromiseIntercept(req.min_company, req.min_customer, req.min_consumer)
    gate_res = intercept.evaluate({"three_c": card["three_c_subscores"]})
    allowed = not gate_res.blocked
    card["guardrail"] = gate_res.to_dict()
    card["allowed"] = allowed

    if req.persist:
        try:
            sub = card["three_c_subscores"]
            db.add(ThreeCScoreRecord(
                product_id=req.product_id, customer_id=req.customer_id,
                proposed_price=req.retail_shelf_price,
                company_score=round(sub["company"], 4),
                customer_score=round(sub["customer"], 4),
                consumer_score=round(sub["consumer"], 4),
                joint_score=card["joint_score"],
                rating=card["rating"], binding_constraint=card["binding_constraint"],
                allowed=allowed,
            ))
            db.commit()
        except Exception:
            db.rollback()  # audit persistence must never break the response
    return card


# ── Context elasticity + non-linear core (F1/F22/F23) ─────────────────────────

@router.post("/elasticity/context-matrix")
def context_matrix(
    product_id: str = Query(..., description="Target SKU"),
    db: Session = Depends(get_db),
):
    _gate(22)
    return ContextElasticityEngine().run(db, product_id=product_id).to_dict()


# ── Cannibalization (F2) ──────────────────────────────────────────────────────

@router.post("/cannibalization")
def cannibalization(
    product_id: str = Query(..., description="Target SKU"),
    price_change_pct: float = Query(5.0, ge=-50, le=50),
    db: Session = Depends(get_db),
):
    _gate(2)
    return CannibalizationEngine().run(db, product_id=product_id, price_change_pct=price_change_pct).to_dict()


# ── Guardrail chain (M25/M29/M30/M31) ─────────────────────────────────────────

class GuardrailRequest(BaseModel):
    optimized_price: float = Field(..., gt=0, description="Algorithm-proposed price")
    baseline_price: float = Field(..., gt=0, description="Safe fallback price")
    competitor_index_price: Optional[float] = Field(None, gt=0)
    wtp_correlation: Optional[float] = Field(None, ge=0, le=1)
    structural_changes_ytd: int = Field(0, ge=0)
    # config
    wtp_threshold: float = Field(0.95, ge=0, le=1)
    max_changes_per_year: int = Field(2, ge=0)
    floor_index: float = Field(0.90, gt=0)
    ceiling_index: float = Field(1.15, gt=0)
    charm_ending: str = Field("0.95")
    banned_endings: List[str] = Field(default_factory=lambda: ["0.99"])


@router.post("/guardrails/evaluate")
def guardrails_evaluate(req: GuardrailRequest):
    gates = [
        WTPCorrelationGate(req.wtp_threshold),
        PriceChangeFrequencyGate(req.max_changes_per_year),
        CompetitorCeilingLock(req.floor_index, req.ceiling_index),
        CharmRoundingPolicy(req.charm_ending, req.banned_endings),
    ]
    ctx = req.model_dump()
    return run_chain(gates, ctx).to_dict()


# ── Cost-to-serve (F18) ───────────────────────────────────────────────────────

class CostToServeRequest(BaseModel):
    product_id: str
    cost_to_serve_per_case: float = Field(0.0, ge=0)
    promo_volume_cases: float = Field(0.0, ge=0)
    promo_discount_pct: float = Field(0.15, ge=0, le=0.9)


@router.post("/cost-to-serve")
def cost_to_serve(req: CostToServeRequest, db: Session = Depends(get_db)):
    _gate(18)
    return CostToServeEngine().run(db, **req.model_dump()).to_dict()


# ── Complexity friction (F33) ─────────────────────────────────────────────────

class ComplexityRequest(BaseModel):
    projected_revenue_uplift: float = Field(..., ge=0)
    custom_setup_cost: float = Field(0.0, ge=0)
    annual_carry_cost: float = Field(0.0, ge=0)


@router.post("/complexity-friction")
def complexity_friction(req: ComplexityRequest, db: Session = Depends(get_db)):
    _gate(33)
    return ComplexityFrictionEngine().run(db, **req.model_dump()).to_dict()


# ── Commodity exposure (F28) ──────────────────────────────────────────────────

@router.get("/commodity/exposure")
def commodity_exposure(
    index_shock_pct: float = Query(10.0, ge=-90, le=200),
    db: Session = Depends(get_db),
):
    _gate(28)
    return CommodityExposureEngine().run(db, index_shock_pct=index_shock_pct).to_dict()


# ── SKU proliferation governor (F40) ──────────────────────────────────────────

@router.get("/sku-governor")
def sku_governor(
    revenue_percentile: float = Query(0.25, ge=0, le=1),
    margin_floor_pct: float = Query(25.0, ge=0, le=100),
    db: Session = Depends(get_db),
):
    _gate(40)
    return SkuProliferationGovernor().run(
        db, revenue_percentile=revenue_percentile, margin_floor_pct=margin_floor_pct).to_dict()


# ── Price smoothing alert (F36) ───────────────────────────────────────────────

class PriceChangeItem(BaseModel):
    product_id: str
    old_price: float = Field(..., gt=0)
    new_price: float = Field(..., gt=0)


class PriceSmoothingRequest(BaseModel):
    proposed_changes: List[PriceChangeItem] = Field(..., min_length=1)


@router.post("/price-smoothing/check")
def price_smoothing(req: PriceSmoothingRequest, db: Session = Depends(get_db)):
    _gate(36)
    changes = [c.model_dump() for c in req.proposed_changes]
    return PriceSmoothingAlert().run(db, proposed_changes=changes).to_dict()
