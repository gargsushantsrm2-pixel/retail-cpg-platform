from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...services import analytics as svc

router = APIRouter(prefix="/executive", tags=["Executive"])


@router.get("/summary")
def executive_summary(db: Session = Depends(get_db)):
    return svc.get_executive_summary(db)


@router.get("/revenue-trend")
def revenue_trend(db: Session = Depends(get_db)):
    return svc.get_revenue_trend(db)


@router.get("/category-performance")
def category_performance(db: Session = Depends(get_db)):
    return svc.get_category_performance(db)


@router.get("/top-performers")
def top_performers(n: int = 10, db: Session = Depends(get_db)):
    return svc.get_top_performers(db, n=n)


@router.get("/market-share")
def market_share(db: Session = Depends(get_db)):
    return svc.get_market_share_trends(db)
