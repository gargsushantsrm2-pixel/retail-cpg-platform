from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...services import analytics as svc

router = APIRouter(prefix="/forecasting", tags=["Demand Forecasting"])


@router.get("/accuracy")
def forecast_accuracy(db: Session = Depends(get_db)):
    return svc.get_forecast_accuracy(db)


@router.get("/sales-vs-forecast")
def sales_vs_forecast(
    product_id: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return svc.get_sales_vs_forecast(db, product_id=product_id, customer_id=customer_id)


@router.get("/decomposition")
def demand_decomposition(
    category: str = Query("Beverages"),
    db: Session = Depends(get_db),
):
    return svc.get_demand_decomposition(db, category=category)
