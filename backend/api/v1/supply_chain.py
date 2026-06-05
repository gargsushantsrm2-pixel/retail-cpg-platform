from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...services import analytics as svc

router = APIRouter(prefix="/supply-chain", tags=["Supply Chain"])


@router.get("/inventory-health")
def inventory_health(db: Session = Depends(get_db)):
    return svc.get_inventory_health(db)


@router.get("/service-levels")
def service_levels(db: Session = Depends(get_db)):
    return svc.get_service_levels(db)


@router.get("/replenishment-alerts")
def replenishment_alerts(db: Session = Depends(get_db)):
    return svc.get_replenishment_alerts(db)
