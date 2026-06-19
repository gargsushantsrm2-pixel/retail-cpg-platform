"""
Platform / operating-model engines (Modules 6, 21, 23).

Features:
    14  Automated Data Ingestion, Harmonization & Cleansing (status + taxonomy)
    15  OpenAPI Connected Extensibility (live endpoint catalog)
    41  Stakeholder-Specific UX Views ("Speak Furbish" role filter)
    43  Omni-Channel Shelf Velocity & Constraint Synchronizer
"""

from __future__ import annotations

import numpy as np
from sqlalchemy import text
from sqlalchemy.orm import Session

from .base import OptimizationEngine, EngineResult
from ...services.analytics import _load_sales


class DataIngestionEngine(OptimizationEngine):
    """Feature 14: report on source harmonization — which canonical sources are
    present, row counts, and the unified taxonomy each maps into."""

    feature_id = 14
    name = "data_ingestion"

    SOURCES = [
        {"source": "ERP (SAP/Oracle)", "maps_to": "sales_data", "taxonomy": "product_id, customer_id, net_price, volume"},
        {"source": "Syndicated (Nielsen/IRI)", "maps_to": "market_data", "taxonomy": "category, brand, volume_share, asp"},
        {"source": "Retailer POS", "maps_to": "sales_data", "taxonomy": "promo_flag, baseline/incremental volume"},
        {"source": "Forecast system", "maps_to": "forecast_data", "taxonomy": "forecast_volume, bounds"},
        {"source": "Inventory/WMS", "maps_to": "inventory_data", "taxonomy": "on_hand, weeks_of_cover, oos"},
    ]

    def run(self, db: Session, **kwargs) -> EngineResult:
        rows = []
        healthy = 0
        for s in self.SOURCES:
            try:
                n = int(db.execute(text(f"SELECT COUNT(*) FROM {s['maps_to']}")).scalar() or 0)
            except Exception:
                n = 0
            status = "HARMONIZED" if n > 0 else "MISSING"
            if n > 0:
                healthy += 1
            rows.append({**s, "rows": n, "status": status})
        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message=f"{healthy}/{len(self.SOURCES)} sources harmonized into the unified taxonomy.",
            data={"sources": rows, "harmonized": healthy, "total_sources": len(self.SOURCES)},
        )


class OpenAPIExtensibilityEngine(OptimizationEngine):
    """Feature 15: expose the live, connectable API surface (the OpenAPI catalog)
    so billing/CRM/CPQ integrations can be wired against a stable contract."""

    feature_id = 15
    name = "openapi_extensibility"

    def run(self, db: Session, **kwargs) -> EngineResult:
        # Lazy import to avoid circulars; read the app's generated schema.
        from ...main import app
        schema = app.openapi()
        paths = schema.get("paths", {})
        catalog = {}
        for path, methods in paths.items():
            group = "rmm" if "/rmm/" in path else (path.strip("/").split("/")[2] if path.count("/") >= 3 else "core")
            catalog.setdefault(group, 0)
            catalog[group] += len(methods)
        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message=f"{len(paths)} connectable endpoints across {len(catalog)} domains.",
            data={
                "openapi_url": "/openapi.json", "docs_url": "/docs",
                "total_endpoints": len(paths),
                "by_domain": [{"domain": k, "operations": v} for k, v in sorted(catalog.items())],
                "integration_targets": ["Billing", "CRM", "CPQ"],
            },
        )


class StakeholderViewEngine(OptimizationEngine):
    """Feature 41: role-specific view — surface the metrics each function cares
    about (Brand=share/positioning, Sales=deal metrics, Finance=G2N/margin)."""

    feature_id = 41
    name = "stakeholder_view"

    def run(self, db: Session, role: str = "finance", **kwargs) -> EngineResult:
        df = _load_sales(db, years=[2024])
        role = (role or "finance").lower()
        rev = float(df["revenue"].sum())
        gp = float(df["gross_profit"].sum())
        trade = float((df["revenue"] * df["promo_discount_pct"]).sum())
        if role == "brand_marketing":
            payload = {
                "headline": "Share & Positioning",
                "metrics": {
                    "portfolio_revenue": round(rev, 0),
                    "promo_revenue_pct": round(float(df[df["promo_flag"]]["revenue"].sum()) / max(rev, 1) * 100, 1),
                    "brands": int(df["brand"].nunique()),
                },
            }
        elif role == "sales":
            cust = df.groupby("customer_name").agg(rev=("revenue", "sum")).reset_index()
            payload = {
                "headline": "Deal Metrics & Objection Mitigation",
                "metrics": {
                    "active_customers": int(df["customer_id"].nunique()),
                    "top_account": cust.sort_values("rev", ascending=False).iloc[0]["customer_name"],
                    "avg_deal_discount_pct": round(float(df[df["promo_flag"]]["promo_discount_pct"].mean()) * 100, 1),
                },
            }
        else:  # finance
            payload = {
                "headline": "G2N Ledger & Margin",
                "metrics": {
                    "gross_revenue": round(rev, 0),
                    "trade_spend": round(trade, 0),
                    "net_revenue": round(rev - trade, 0),
                    "gross_profit": round(gp, 0),
                    "gross_margin_pct": round(gp / max(rev, 1) * 100, 1),
                },
            }
        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message=f"Stakeholder view for role '{role}'.",
            data={"role": role, **payload,
                  "available_roles": ["brand_marketing", "sales", "finance"]},
        )


class WorkflowOrchestratorEngine(OptimizationEngine):
    """Feature 39: require parallel validation checkpoints across Finance, Supply
    Chain and Brand Marketing before a pricing change can go live."""

    feature_id = 39
    name = "workflow_orchestrator"

    def run(self, db: Session, product_id: str = None, proposed_price: float = None,
            gm_threshold_pct: float = 20.0, min_weeks_of_cover: float = 2.0,
            **kwargs) -> EngineResult:
        if not product_id or proposed_price is None:
            return self._baseline("product_id and proposed_price required.")
        df = _load_sales(db, years=[2024])
        prod = df[df["product_id"] == product_id]
        if prod.empty:
            return self._baseline(f"No sales for {product_id}.", product_id=product_id)
        unit_cogs = float(prod["cogs"].sum() / max(prod["volume_cases"].sum(), 1))
        cur_price = float(prod["net_price"].mean())

        # Finance checkpoint: resulting gross margin vs threshold
        gm = (proposed_price - unit_cogs) / proposed_price * 100 if proposed_price else 0
        finance_ok = gm >= gm_threshold_pct

        # Supply checkpoint: latest weeks-of-cover from inventory
        try:
            woc = db.execute(text(
                "SELECT AVG(weeks_of_cover) FROM inventory_data WHERE product_id = :p "
                "AND week_date = (SELECT MAX(week_date) FROM inventory_data WHERE product_id = :p)"),
                {"p": product_id}).scalar()
            woc = float(woc) if woc is not None else None
        except Exception:
            woc = None
        supply_ok = woc is None or woc >= min_weeks_of_cover

        # Brand checkpoint: price move within a sane band vs current
        move_pct = (proposed_price - cur_price) / cur_price * 100 if cur_price else 0
        brand_ok = abs(move_pct) <= 15.0

        checkpoints = [
            {"function": "Finance", "status": "PASS" if finance_ok else "REJECT",
             "detail": f"Resulting GM {gm:.1f}% vs {gm_threshold_pct}% floor"},
            {"function": "Supply Chain", "status": "PASS" if supply_ok else "REJECT",
             "detail": f"Weeks of cover {('%.1f' % woc) if woc is not None else 'n/a'} vs {min_weeks_of_cover} min"},
            {"function": "Brand Marketing", "status": "PASS" if brand_ok else "REVIEW",
             "detail": f"Price move {move_pct:+.1f}% vs ±15% positioning band"},
        ]
        approved = all(c["status"] == "PASS" for c in checkpoints)
        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message="Cross-functional validation " + ("APPROVED" if approved else "BLOCKED") + ".",
            data={"product_id": product_id, "proposed_price": round(proposed_price, 2),
                  "current_price": round(cur_price, 2), "approved": approved,
                  "checkpoints": checkpoints},
        )


class OmniChannelEngine(OptimizationEngine):
    """Feature 43: synchronize channel pricing — brick-and-mortar pinned to shelf
    resets (rigid), e-commerce in a dynamic margin-test loop (flexible)."""

    feature_id = 43
    name = "omni_channel"

    def run(self, db: Session, category: str = None, **kwargs) -> EngineResult:
        df = _load_sales(db, years=[2024])
        if category:
            df = df[df["category"] == category]
        if df.empty:
            return self._baseline("No sales in scope.", category=category)
        # Channel mapping from customer channel field
        chan = df.groupby("channel").agg(
            revenue=("revenue", "sum"), volume=("volume_cases", "sum"),
            avg_price=("net_price", "mean")).reset_index()
        rows = []
        for _, r in chan.iterrows():
            online = any(k in str(r["channel"]).lower() for k in ["e-", "online", "club"])
            rows.append({
                "channel": r["channel"],
                "revenue": round(float(r["revenue"]), 0),
                "avg_price": round(float(r["avg_price"]), 2),
                "pricing_mode": "DYNAMIC (algorithmic loop)" if online else "RIGID (shelf-reset cadence)",
                "reprice_cadence": "real-time" if online else "quarterly reset",
            })
        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message="Omni-channel pricing synchronization map.",
            data={"category": category, "channels": rows},
        )
