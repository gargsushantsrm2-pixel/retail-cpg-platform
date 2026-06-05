from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...services import analytics as svc

router = APIRouter(prefix="/category", tags=["Category Intelligence"])


@router.get("/assortment")
def assortment_analysis(db: Session = Depends(get_db)):
    return svc.get_assortment_analysis(db)


@router.get("/subcategory-trends")
def subcategory_trends(db: Session = Depends(get_db)):
    return svc.get_subcategory_trends(db)
