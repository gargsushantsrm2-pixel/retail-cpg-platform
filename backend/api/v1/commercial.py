from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...services import analytics as svc

router = APIRouter(prefix="/commercial", tags=["Commercial Excellence"])


@router.get("/customer-pl")
def customer_pl(db: Session = Depends(get_db)):
    return svc.get_customer_pl(db)


@router.get("/trade-effectiveness")
def trade_effectiveness(db: Session = Depends(get_db)):
    return svc.get_trade_effectiveness(db)
