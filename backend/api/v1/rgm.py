from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...services import analytics as svc

router = APIRouter(prefix="/rgm", tags=["Revenue Growth Management"])


@router.get("/price-elasticity")
def price_elasticity(
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return svc.get_price_elasticity(db, category=category)


@router.get("/revenue-waterfall")
def revenue_waterfall(db: Session = Depends(get_db)):
    return svc.get_revenue_waterfall(db)


@router.get("/promo-roi")
def promo_roi(db: Session = Depends(get_db)):
    return svc.get_promo_roi(db)


@router.get("/mix-analysis")
def mix_analysis(db: Session = Depends(get_db)):
    return svc.get_mix_analysis(db)


@router.post("/simulate-price")
def simulate_price(
    product_id: str,
    price_change_pct: float,
    elasticity_override: Optional[float] = None,
    db: Session = Depends(get_db),
):
    return svc.simulate_price_scenario(db, product_id, price_change_pct, elasticity_override)


@router.post("/simulate-promo")
def simulate_promo(
    product_id: str,
    promo_type: str,
    num_events: int = 4,
    discount_pct: float = 15.0,
    db: Session = Depends(get_db),
):
    return svc.simulate_promo_scenario(db, product_id, promo_type, num_events, discount_pct)
