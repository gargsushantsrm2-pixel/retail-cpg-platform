from sqlalchemy import Column, String, Float, Integer, Boolean, Date, DateTime, Text, Index, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base


class Product(Base):
    __tablename__ = "products"

    product_id = Column(String(20), primary_key=True)
    sku_name = Column(String(200), nullable=False)
    brand = Column(String(100), nullable=False)
    category = Column(String(100), nullable=False)
    subcategory = Column(String(100), nullable=False)
    pack_size = Column(String(50))
    uom = Column(String(20), default="CASE")
    base_price = Column(Float, nullable=False)
    cogs = Column(Float, nullable=False)
    gross_margin_pct = Column(Float)
    launch_date = Column(Date)
    is_active = Column(Boolean, default=True)

    __table_args__ = (
        Index("ix_products_category", "category"),
        Index("ix_products_brand", "brand"),
    )


class Customer(Base):
    __tablename__ = "customers"

    customer_id = Column(String(20), primary_key=True)
    customer_name = Column(String(200), nullable=False)
    channel = Column(String(100), nullable=False)
    region = Column(String(100))
    tier = Column(String(50))
    annual_revenue_target = Column(Float)
    volume_share_pct = Column(Float)

    __table_args__ = (
        Index("ix_customers_channel", "channel"),
    )


class SalesData(Base):
    __tablename__ = "sales_data"

    id = Column(Integer, primary_key=True, autoincrement=True)
    week_date = Column(Date, nullable=False)
    year = Column(Integer, nullable=False)
    week_number = Column(Integer, nullable=False)
    quarter = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    product_id = Column(String(20), ForeignKey("products.product_id"), nullable=False)
    customer_id = Column(String(20), ForeignKey("customers.customer_id"), nullable=False)
    region = Column(String(100))
    volume_cases = Column(Float, nullable=False)
    list_price = Column(Float, nullable=False)
    net_price = Column(Float, nullable=False)
    revenue = Column(Float, nullable=False)
    cogs = Column(Float, nullable=False)
    gross_profit = Column(Float, nullable=False)
    promo_flag = Column(Boolean, default=False)
    promo_type = Column(String(50))
    promo_discount_pct = Column(Float, default=0.0)
    display_flag = Column(Boolean, default=False)
    feature_flag = Column(Boolean, default=False)
    baseline_volume = Column(Float)
    incremental_volume = Column(Float, default=0.0)

    __table_args__ = (
        Index("ix_sales_week_date", "week_date"),
        Index("ix_sales_product_id", "product_id"),
        Index("ix_sales_customer_id", "customer_id"),
        Index("ix_sales_year", "year"),
        Index("ix_sales_composite", "year", "product_id", "customer_id"),
    )


class InventoryData(Base):
    __tablename__ = "inventory_data"

    id = Column(Integer, primary_key=True, autoincrement=True)
    week_date = Column(Date, nullable=False)
    product_id = Column(String(20), ForeignKey("products.product_id"), nullable=False)
    warehouse = Column(String(100), nullable=False)
    region = Column(String(100))
    on_hand_cases = Column(Float, nullable=False)
    in_transit_cases = Column(Float, default=0.0)
    on_order_cases = Column(Float, default=0.0)
    weeks_of_cover = Column(Float)
    oos_flag = Column(Boolean, default=False)
    safety_stock = Column(Float)
    reorder_point = Column(Float)

    __table_args__ = (
        Index("ix_inventory_week_date", "week_date"),
        Index("ix_inventory_product_id", "product_id"),
    )


class MarketData(Base):
    __tablename__ = "market_data"

    id = Column(Integer, primary_key=True, autoincrement=True)
    week_date = Column(Date, nullable=False)
    category = Column(String(100), nullable=False)
    brand = Column(String(100), nullable=False)
    channel = Column(String(100))
    total_market_volume = Column(Float)
    total_market_value = Column(Float)
    brand_volume = Column(Float)
    brand_value = Column(Float)
    volume_share_pct = Column(Float)
    value_share_pct = Column(Float)
    avg_selling_price = Column(Float)

    __table_args__ = (
        Index("ix_market_week_date", "week_date"),
        Index("ix_market_category", "category"),
        Index("ix_market_brand", "brand"),
    )


class ForecastData(Base):
    __tablename__ = "forecast_data"

    id = Column(Integer, primary_key=True, autoincrement=True)
    week_date = Column(Date, nullable=False)
    product_id = Column(String(20), ForeignKey("products.product_id"), nullable=False)
    customer_id = Column(String(20), ForeignKey("customers.customer_id"), nullable=False)
    forecast_volume = Column(Float, nullable=False)
    forecast_revenue = Column(Float, nullable=False)
    lower_bound = Column(Float)
    upper_bound = Column(Float)
    model_type = Column(String(50), default="statistical")
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("ix_forecast_week_date", "week_date"),
        Index("ix_forecast_product_customer", "product_id", "customer_id"),
    )
