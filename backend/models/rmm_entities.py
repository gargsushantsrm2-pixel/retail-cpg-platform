"""
RMM domain entities (additive — integration rule #2).

These extend the existing declarative Base and are auto-created by
`Base.metadata.create_all` on startup. They do not modify or relate-into the
existing RGM tables destructively; they reference products/customers by id.

Money columns use Numeric(precision, scale) so Postgres stores fixed-point
decimals (rule #1) rather than float.
"""

from sqlalchemy import (
    Column, String, Integer, Boolean, Date, DateTime, Numeric, Text, Index, ForeignKey
)
from sqlalchemy.sql import func
from ..core.database import Base


class PricingGuardrailConfig(Base):
    """Per-scope guardrail thresholds (Modules 29/30/31/32). Scope is a free
    string: 'GLOBAL', a region, a category, or a product_id."""
    __tablename__ = "pricing_guardrail_config"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scope = Column(String(60), nullable=False, default="GLOBAL")
    # M29 frequency gate
    max_structural_changes_per_year = Column(Integer, default=2)
    # M30 competitor corridor
    competitor_floor_index = Column(Numeric(6, 4), default=0.9000)
    competitor_ceiling_index = Column(Numeric(6, 4), default=1.1500)
    # M31 charm rounding
    charm_allowed_ending = Column(Numeric(4, 2), default=0.95)
    charm_banned_endings = Column(String(100), default="0.99")
    # M32 growth vs profit slider (0=pure volume/growth, 1=pure profit)
    growth_profit_bias = Column(Numeric(4, 3), default=0.500)
    # M25 WTP gate threshold
    wtp_correlation_threshold = Column(Numeric(4, 3), default=0.950)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (Index("ix_guardrail_scope", "scope"),)


class CommodityCost(Base):
    """Multi-tier raw ingredient cost tracker (Module 14 / Feature 28).
    formulation_pct is the fraction of a product's COGS attributable to this
    commodity, so an index move maps to a precise COGS impact."""
    __tablename__ = "commodity_cost"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(String(20), ForeignKey("products.product_id"), nullable=False)
    commodity = Column(String(80), nullable=False)
    formulation_pct = Column(Numeric(6, 4), nullable=False, default=0)  # 0..1 share of COGS
    index_price = Column(Numeric(14, 4))   # current commodity index level
    index_source = Column(String(60))
    as_of = Column(Date)

    __table_args__ = (
        Index("ix_commodity_product", "product_id"),
        Index("ix_commodity_name", "commodity"),
    )


class TradeFundLedger(Base):
    """Trade fund budgetary allocation & guardrails (Module 4 / Feature 10).
    Top-down committed vs uncommitted tracking per region."""
    __tablename__ = "trade_fund_ledger"

    id = Column(Integer, primary_key=True, autoincrement=True)
    region = Column(String(80), nullable=False)
    fiscal_year = Column(Integer, nullable=False)
    allocated_amount = Column(Numeric(16, 2), nullable=False, default=0)
    committed_amount = Column(Numeric(16, 2), nullable=False, default=0)
    settled_amount = Column(Numeric(16, 2), nullable=False, default=0)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (Index("ix_tradefund_region_year", "region", "fiscal_year"),)


class ThreeCScoreRecord(Base):
    """Persisted 3-C joint optimization scores for audit (Module 19 / Feature 38)."""
    __tablename__ = "three_c_score"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(String(20), ForeignKey("products.product_id"))
    customer_id = Column(String(20), ForeignKey("customers.customer_id"))
    proposed_price = Column(Numeric(14, 4))
    company_score = Column(Numeric(5, 4))
    customer_score = Column(Numeric(5, 4))
    consumer_score = Column(Numeric(5, 4))
    joint_score = Column(Numeric(6, 2))
    rating = Column(String(10))
    binding_constraint = Column(String(20))
    allowed = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("ix_threec_product", "product_id"),
        Index("ix_threec_created", "created_at"),
    )
