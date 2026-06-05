from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ...core.database import get_db

router = APIRouter(prefix="/data", tags=["Reference Data"])


@router.get("/products")
def list_products(db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT * FROM products ORDER BY category, brand, sku_name")).mappings().all()
    return [dict(r) for r in rows]


@router.get("/customers")
def list_customers(db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT * FROM customers ORDER BY volume_share_pct DESC")).mappings().all()
    return [dict(r) for r in rows]


@router.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT DISTINCT category FROM products ORDER BY category")).fetchall()
    return [r[0] for r in rows]


@router.get("/brands")
def list_brands(db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT DISTINCT brand, category FROM products ORDER BY brand")).mappings().all()
    return [dict(r) for r in rows]
