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


class PromoTemplate(Base):
    """Quick-copy promotion template (Module 2 / Feature 5)."""
    __tablename__ = "promo_template"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(120), nullable=False)
    promo_type = Column(String(50), nullable=False)          # TPR, Display, Feature, BOGO, ...
    discount_pct = Column(Numeric(5, 4), default=0)          # fraction
    duration_weeks = Column(Integer, default=1)
    display = Column(Boolean, default=False)
    feature = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())


class PromoEvent(Base):
    """A scheduled promotion on the multi-week calendar (Module 2 / Feature 5).
    Carries the pre-event prediction and the committed trade liability."""
    __tablename__ = "promo_event"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(String(20), ForeignKey("products.product_id"), nullable=False)
    customer_id = Column(String(20), ForeignKey("customers.customer_id"))
    template_id = Column(Integer, ForeignKey("promo_template.id"))
    start_week = Column(Date, nullable=False)
    end_week = Column(Date, nullable=False)
    promo_type = Column(String(50), nullable=False)
    discount_pct = Column(Numeric(5, 4), default=0)
    display = Column(Boolean, default=False)
    feature = Column(Boolean, default=False)
    predicted_lift_pct = Column(Numeric(8, 2))
    predicted_incremental_revenue = Column(Numeric(16, 2))
    trade_liability = Column(Numeric(16, 2), default=0)      # committed trade spend
    status = Column(String(20), default="DRAFT")             # DRAFT/APPROVED/EXECUTED
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("ix_promoevent_product", "product_id"),
        Index("ix_promoevent_start", "start_week"),
    )


class DealApproval(Base):
    """G2N workflow approval record (Module 4 / Feature 9)."""
    __tablename__ = "deal_approval"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(String(20), ForeignKey("products.product_id"))
    customer_id = Column(String(20), ForeignKey("customers.customer_id"))
    proposed_discount_pct = Column(Numeric(5, 4), nullable=False)
    resulting_gm_pct = Column(Numeric(6, 3))
    gm_threshold_pct = Column(Numeric(6, 3))
    status = Column(String(20))                              # AUTO_APPROVED/ESCALATED
    routed_to = Column(String(60))
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (Index("ix_dealapproval_status", "status"),)


class TradeClaim(Base):
    """Retailer deduction / claim reconciliation (Module 4 / Feature 11)."""
    __tablename__ = "trade_claim"

    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(String(20), ForeignKey("customers.customer_id"), nullable=False)
    claim_amount = Column(Numeric(16, 2), nullable=False)
    contracted_amount = Column(Numeric(16, 2), nullable=False)
    variance = Column(Numeric(16, 2))                        # claim - contracted (unauthorized leakage)
    reason = Column(String(200))
    status = Column(String(20), default="PENDING")          # PENDING/APPROVED/DISPUTED
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (Index("ix_tradeclaim_customer", "customer_id"),)


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
