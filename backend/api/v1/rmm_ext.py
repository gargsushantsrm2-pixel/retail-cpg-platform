"""
Extended RMM API controllers — consumer science, price-pack architecture,
demand, investment, and platform engines. Feature-flag gated; safe-baseline on
thin data. Routes under /api/v1/rmm.
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...rmm import features as feat
from ...rmm.engines.consumer import (
    WTPDistributionEngine, SurveyCalibrationEngine, AgentBasedShopperEngine,
)
from ...rmm.engines.pricing_arch import (
    PerOunceMatrixEngine, CompetitorIndexEngine, PremiumizationEngine,
    TierEditorEngine, AttributeValueIndexEngine,
)
from ...rmm.engines.demand import (
    StoreAssortmentEngine, MLForecastDisruptionEngine, SegmentedDemandEngine, PromoTimingEngine,
)
from ...rmm.engines.investment import (
    B2BDealPricerEngine, InvestmentOptimizerEngine, DecisionGuideEngine,
)
from ...rmm.engines.platform import (
    DataIngestionEngine, OpenAPIExtensibilityEngine, StakeholderViewEngine, OmniChannelEngine,
    WorkflowOrchestratorEngine,
)

router = APIRouter(prefix="/rmm", tags=["RMM: Extended Engines"])


def _gate(fid: int):
    if not feat.is_enabled(fid):
        f = feat.get_feature(fid)
        raise HTTPException(423, {"feature_id": fid, "name": f.name if f else "?",
                                  "reason": "Gated by progressive scope scaffolding (Module 22)."})


# ── Consumer science (M11/12/13) ──────────────────────────────────────────────
@router.get("/consumer/wtp-distribution")
def wtp_distribution(product_id: str = Query(...), db: Session = Depends(get_db)):
    _gate(24); return WTPDistributionEngine().run(db, product_id=product_id).to_dict()


class SurveyPoint(BaseModel):
    price: float = Field(..., gt=0)
    pct_would_buy: float = Field(..., ge=0)


class SurveyRequest(BaseModel):
    survey_points: List[SurveyPoint] = Field(..., min_length=3)
    outside_option_strength: float = Field(0.35, ge=0, le=1)


@router.post("/consumer/survey-calibration")
def survey_calibration(req: SurveyRequest, db: Session = Depends(get_db)):
    _gate(26)
    return SurveyCalibrationEngine().run(
        db, survey_points=[p.model_dump() for p in req.survey_points],
        outside_option_strength=req.outside_option_strength).to_dict()


@router.get("/consumer/agent-sim")
def agent_sim(category: str = Query("Beverages"), n_agents: int = Query(3000, ge=100, le=20000),
              shock_product_id: Optional[str] = Query(None), shock_pct: float = Query(10.0),
              db: Session = Depends(get_db)):
    _gate(27)
    return AgentBasedShopperEngine().run(
        db, category=category, n_agents=n_agents,
        shock_product_id=shock_product_id, shock_pct=shock_pct).to_dict()


# ── Price-Pack Architecture (M1/3/18/24) ──────────────────────────────────────
@router.get("/ppa/per-ounce")
def per_ounce(category: Optional[str] = Query(None), db: Session = Depends(get_db)):
    _gate(7); return PerOunceMatrixEngine().run(db, category=category).to_dict()


@router.get("/ppa/competitor-index")
def competitor_index(floor_index: float = Query(0.90), ceiling_index: float = Query(1.20),
                     db: Session = Depends(get_db)):
    _gate(3); return CompetitorIndexEngine().run(db, floor_index=floor_index, ceiling_index=ceiling_index).to_dict()


@router.get("/ppa/premiumization")
def premiumization(db: Session = Depends(get_db)):
    _gate(8); return PremiumizationEngine().run(db).to_dict()


@router.get("/ppa/tiers")
def tiers(category: str = Query("Beverages"), min_spacing_pct: float = Query(15.0),
          db: Session = Depends(get_db)):
    _gate(35); return TierEditorEngine().run(db, category=category, min_spacing_pct=min_spacing_pct).to_dict()


@router.get("/ppa/value-index")
def value_index(db: Session = Depends(get_db)):
    _gate(44); return AttributeValueIndexEngine().run(db).to_dict()


# ── Demand & assortment (M5/9) ────────────────────────────────────────────────
@router.get("/demand/assortment")
def assortment(customer_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    _gate(12); return StoreAssortmentEngine().run(db, customer_id=customer_id).to_dict()


@router.get("/demand/forecast-disruption")
def forecast_disruption(product_id: Optional[str] = Query(None), inflation_pct: float = Query(4.0),
                        supply_bottleneck_pct: float = Query(0.0), db: Session = Depends(get_db)):
    _gate(13)
    return MLForecastDisruptionEngine().run(
        db, product_id=product_id, inflation_pct=inflation_pct,
        supply_bottleneck_pct=supply_bottleneck_pct).to_dict()


@router.get("/demand/segmented")
def segmented(price_change_pct: float = Query(5.0), db: Session = Depends(get_db)):
    _gate(20); return SegmentedDemandEngine().run(db, price_change_pct=price_change_pct).to_dict()


@router.get("/demand/promo-timing")
def promo_timing(category: str = Query("Beverages"), db: Session = Depends(get_db)):
    _gate(21); return PromoTimingEngine().run(db, category=category).to_dict()


# ── Investment & deals (M7/8) ─────────────────────────────────────────────────
@router.get("/invest/b2b-pricer")
def b2b_pricer(product_id: str = Query(...), committed_volume: float = Query(10000),
               competitor_discount_pct: float = Query(0.12), db: Session = Depends(get_db)):
    _gate(19)
    return B2BDealPricerEngine().run(
        db, product_id=product_id, committed_volume=committed_volume,
        competitor_discount_pct=competitor_discount_pct).to_dict()


@router.get("/invest/optimize")
def invest_optimize(total_budget: float = Query(1_000_000, gt=0), db: Session = Depends(get_db)):
    _gate(17); return InvestmentOptimizerEngine().run(db, total_budget=total_budget).to_dict()


@router.get("/invest/decision-guides")
def decision_guides(cost_spike_pct: float = Query(4.0), db: Session = Depends(get_db)):
    _gate(16); return DecisionGuideEngine().run(db, cost_spike_pct=cost_spike_pct).to_dict()


# ── Platform / operating model (M6/21/23) ─────────────────────────────────────
@router.get("/platform/ingestion")
def ingestion(db: Session = Depends(get_db)):
    _gate(14); return DataIngestionEngine().run(db).to_dict()


@router.get("/platform/openapi-catalog")
def openapi_catalog(db: Session = Depends(get_db)):
    _gate(15); return OpenAPIExtensibilityEngine().run(db).to_dict()


@router.get("/platform/stakeholder")
def stakeholder(role: str = Query("finance"), db: Session = Depends(get_db)):
    _gate(41); return StakeholderViewEngine().run(db, role=role).to_dict()


@router.get("/platform/omni-channel")
def omni_channel(category: Optional[str] = Query(None), db: Session = Depends(get_db)):
    _gate(43); return OmniChannelEngine().run(db, category=category).to_dict()


@router.get("/platform/workflow")
def workflow(product_id: str = Query(...), proposed_price: float = Query(...),
             gm_threshold_pct: float = Query(20.0), min_weeks_of_cover: float = Query(2.0),
             db: Session = Depends(get_db)):
    _gate(39)
    return WorkflowOrchestratorEngine().run(
        db, product_id=product_id, proposed_price=proposed_price,
        gm_threshold_pct=gm_threshold_pct, min_weeks_of_cover=min_weeks_of_cover).to_dict()
