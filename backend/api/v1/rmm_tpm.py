"""
TPM/TPO + Trade Terms (G2N) API controllers (Modules 2 & 4).

Strict Pydantic payloads (rule #3); feature-flag gated (M22); safe-baseline on
thin data (rule #4). Routes are under /api/v1/rmm.

    POST /tpm/simulate                 Predictive promo scenario simulator (F4)
    POST /tpm/post-event-roi           Post-event balanced ROI scorecard (F6)
    GET  /tpm/calendar                 List scheduled promos + liability rollup (F5)
    POST /tpm/calendar                 Schedule a promo (auto-predicts via F4)
    POST /tpm/calendar/{id}/copy       Quick-copy a promo to a new start week (F5)
    DELETE /tpm/calendar/{id}          Remove a scheduled promo
    GET  /tpm/templates                List quick-copy templates (F5)
    POST /tpm/templates                Create a template
    POST /g2n/approve                  G2N discount approval workflow (F9)
    GET  /g2n/trade-fund               Trade fund ledger status (F10)
    POST /g2n/trade-fund/allocate      Allocate funds to a region (F10)
    POST /g2n/trade-fund/commit        Commit spend with overspend guardrail (F10)
    POST /g2n/claims/reconcile         Reconcile a retailer deduction (F11)
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...rmm import features as feat
from ...models.rmm_entities import PromoEvent, PromoTemplate
from ...rmm.engines.promotions import PromoSimulatorEngine, PostEventROIEngine
from ...rmm.engines.trade_terms import (
    G2NApprovalEngine, TradeFundService, ClaimsReconciliationEngine,
)

router = APIRouter(prefix="/rmm", tags=["RMM: TPM & Trade Terms"])


def _gate(feature_id: int):
    if not feat.is_enabled(feature_id):
        f = feat.get_feature(feature_id)
        raise HTTPException(423, {"feature_id": feature_id,
                                  "name": f.name if f else "unknown",
                                  "reason": "Gated by progressive scope scaffolding (Module 22)."})


# ── F4: promo simulator ───────────────────────────────────────────────────────

class PromoSimRequest(BaseModel):
    product_id: str
    customer_id: Optional[str] = None
    promo_type: str = Field("Display+Feature", description="TPR/Display/Feature/Display+Feature/BOGO...")
    discount_pct: float = Field(0.15, ge=0, le=0.9, description="fraction")
    duration_weeks: int = Field(1, ge=1, le=12)
    display: bool = False
    feature: bool = False


@router.post("/tpm/simulate")
def tpm_simulate(req: PromoSimRequest, db: Session = Depends(get_db)):
    _gate(4)
    return PromoSimulatorEngine().run(db, **req.model_dump()).to_dict()


# ── F6: post-event ROI ────────────────────────────────────────────────────────

@router.post("/tpm/post-event-roi")
def tpm_post_event(product_id: Optional[str] = Query(None),
                   customer_id: Optional[str] = Query(None),
                   db: Session = Depends(get_db)):
    _gate(6)
    return PostEventROIEngine().run(db, product_id=product_id, customer_id=customer_id).to_dict()


# ── F5: promo calendar & workspace ────────────────────────────────────────────

class PromoEventRequest(BaseModel):
    product_id: str
    customer_id: Optional[str] = None
    start_week: date
    duration_weeks: int = Field(1, ge=1, le=12)
    promo_type: str = "Display+Feature"
    discount_pct: float = Field(0.15, ge=0, le=0.9)
    display: bool = False
    feature: bool = False


def _serialize_event(e: PromoEvent) -> dict:
    return {
        "id": e.id, "product_id": e.product_id, "customer_id": e.customer_id,
        "template_id": e.template_id,
        "start_week": e.start_week.isoformat() if e.start_week else None,
        "end_week": e.end_week.isoformat() if e.end_week else None,
        "promo_type": e.promo_type, "discount_pct": float(e.discount_pct or 0),
        "display": e.display, "feature": e.feature,
        "predicted_lift_pct": float(e.predicted_lift_pct or 0),
        "predicted_incremental_revenue": float(e.predicted_incremental_revenue or 0),
        "trade_liability": float(e.trade_liability or 0),
        "status": e.status,
    }


@router.get("/tpm/calendar")
def calendar_list(start: Optional[date] = Query(None), end: Optional[date] = Query(None),
                  db: Session = Depends(get_db)):
    _gate(5)
    q = db.query(PromoEvent)
    if start:
        q = q.filter(PromoEvent.end_week >= start)
    if end:
        q = q.filter(PromoEvent.start_week <= end)
    events = [_serialize_event(e) for e in q.order_by(PromoEvent.start_week).all()]
    total_liability = round(sum(e["trade_liability"] for e in events), 2)
    return {"events": events, "count": len(events), "total_trade_liability": total_liability}


@router.post("/tpm/calendar")
def calendar_create(req: PromoEventRequest, db: Session = Depends(get_db)):
    _gate(5)
    # Auto-predict via the F4 simulator to populate liability + lift.
    sim = PromoSimulatorEngine().run(
        db, product_id=req.product_id, customer_id=req.customer_id,
        promo_type=req.promo_type, discount_pct=req.discount_pct,
        duration_weeks=req.duration_weeks, display=req.display, feature=req.feature)
    d = sim.data if sim.ok else {}
    end_week = req.start_week + timedelta(weeks=req.duration_weeks - 1)
    e = PromoEvent(
        product_id=req.product_id, customer_id=req.customer_id,
        start_week=req.start_week, end_week=end_week,
        promo_type=req.promo_type, discount_pct=req.discount_pct,
        display=req.display, feature=req.feature,
        predicted_lift_pct=d.get("predicted_lift_pct", 0),
        predicted_incremental_revenue=d.get("incremental_revenue", 0),
        trade_liability=d.get("trade_spend", 0),
        status="DRAFT",
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return {"event": _serialize_event(e), "prediction": d}


@router.post("/tpm/calendar/{event_id}/copy")
def calendar_copy(event_id: int, start_week: date = Query(...), db: Session = Depends(get_db)):
    _gate(5)
    src = db.get(PromoEvent, event_id)
    if not src:
        raise HTTPException(404, f"No promo event {event_id}")
    dur = ((src.end_week - src.start_week).days // 7) + 1
    clone = PromoEvent(
        product_id=src.product_id, customer_id=src.customer_id, template_id=src.template_id,
        start_week=start_week, end_week=start_week + timedelta(weeks=dur - 1),
        promo_type=src.promo_type, discount_pct=src.discount_pct,
        display=src.display, feature=src.feature,
        predicted_lift_pct=src.predicted_lift_pct,
        predicted_incremental_revenue=src.predicted_incremental_revenue,
        trade_liability=src.trade_liability, status="DRAFT")
    db.add(clone)
    db.commit()
    db.refresh(clone)
    return {"event": _serialize_event(clone)}


@router.delete("/tpm/calendar/{event_id}")
def calendar_delete(event_id: int, db: Session = Depends(get_db)):
    _gate(5)
    e = db.get(PromoEvent, event_id)
    if not e:
        raise HTTPException(404, f"No promo event {event_id}")
    db.delete(e)
    db.commit()
    return {"deleted": event_id}


class TemplateRequest(BaseModel):
    name: str
    promo_type: str
    discount_pct: float = Field(0.15, ge=0, le=0.9)
    duration_weeks: int = Field(1, ge=1, le=12)
    display: bool = False
    feature: bool = False


@router.get("/tpm/templates")
def template_list(db: Session = Depends(get_db)):
    _gate(5)
    rows = db.query(PromoTemplate).all()
    return {"templates": [{
        "id": t.id, "name": t.name, "promo_type": t.promo_type,
        "discount_pct": float(t.discount_pct or 0), "duration_weeks": t.duration_weeks,
        "display": t.display, "feature": t.feature} for t in rows]}


@router.post("/tpm/templates")
def template_create(req: TemplateRequest, db: Session = Depends(get_db)):
    _gate(5)
    t = PromoTemplate(**req.model_dump())
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"id": t.id, "name": t.name}


# ── F9: G2N approval ──────────────────────────────────────────────────────────

class G2NApproveRequest(BaseModel):
    product_id: str
    customer_id: Optional[str] = None
    proposed_discount_pct: float = Field(..., ge=0, le=0.9)
    gm_threshold_pct: float = Field(20.0, ge=0, le=100)


@router.post("/g2n/approve")
def g2n_approve(req: G2NApproveRequest, db: Session = Depends(get_db)):
    _gate(9)
    return G2NApprovalEngine().run(db, **req.model_dump()).to_dict()


# ── F10: trade fund ───────────────────────────────────────────────────────────

@router.get("/g2n/trade-fund")
def trade_fund_status(region: Optional[str] = Query(None),
                      fiscal_year: int = Query(2024),
                      db: Session = Depends(get_db)):
    _gate(10)
    return TradeFundService().run(db, region=region, fiscal_year=fiscal_year).to_dict()


class FundAllocateRequest(BaseModel):
    region: str
    fiscal_year: int = 2024
    amount: float = Field(..., gt=0)


@router.post("/g2n/trade-fund/allocate")
def trade_fund_allocate(req: FundAllocateRequest, db: Session = Depends(get_db)):
    _gate(10)
    return TradeFundService().allocate(db, req.region, req.fiscal_year, req.amount)


class FundCommitRequest(BaseModel):
    region: str
    fiscal_year: int = 2024
    amount: float = Field(..., gt=0)


@router.post("/g2n/trade-fund/commit")
def trade_fund_commit(req: FundCommitRequest, db: Session = Depends(get_db)):
    _gate(10)
    return TradeFundService().commit_spend(db, req.region, req.fiscal_year, req.amount)


# ── F11: claims reconciliation ────────────────────────────────────────────────

class ClaimRequest(BaseModel):
    customer_id: str
    claim_amount: float = Field(..., ge=0)
    contracted_amount: float = Field(..., ge=0)
    reason: str = ""


@router.post("/g2n/claims/reconcile")
def claims_reconcile(req: ClaimRequest, db: Session = Depends(get_db)):
    _gate(11)
    return ClaimsReconciliationEngine().run(db, **req.model_dump()).to_dict()
