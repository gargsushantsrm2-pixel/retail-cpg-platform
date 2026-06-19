"""
Trade Terms & Gross-to-Net (G2N) financial controls (Module 4).

Features:
    9   Automated Workflow Approval Engines (route to finance below GM threshold)
    10  Trade Fund Budgetary Allocation & Guardrails (committed vs uncommitted)
    11  Compliance Auditing & Claims Reconciliation (deduction vs contracted terms)

These are stateful — they read/write the trade_fund_ledger, deal_approval and
trade_claim tables. All money is Decimal (rule #1); over-commit and threshold
breaches fail closed with telemetry (rule #4).
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from .base import OptimizationEngine, EngineResult
from ..money import D, money, margin_pct, to_pct_display, safe_div
from ...services.analytics import _load_sales
from ...models.rmm_entities import TradeFundLedger, DealApproval, TradeClaim


class G2NApprovalEngine(OptimizationEngine):
    """Feature 9: evaluate a proposed discount; auto-approve if resulting gross
    margin clears the threshold, otherwise escalate to finance leadership."""

    feature_id = 9
    name = "g2n_approval"

    def run(self, db: Session, product_id: str = None, customer_id: str = None,
            proposed_discount_pct: float = 0.15, gm_threshold_pct: float = 20.0,
            persist: bool = True, **kwargs) -> EngineResult:
        if not product_id:
            return self._baseline("No product_id supplied.")
        df = _load_sales(db, years=[2024])
        prod = df[df["product_id"] == product_id]
        if prod.empty:
            return self._baseline(f"No sales for {product_id}.", product_id=product_id)

        avg_price = D(prod["net_price"].mean())
        unit_cogs = safe_div(prod["cogs"].sum(), prod["volume_cases"].sum())
        disc = D(proposed_discount_pct)
        net_price = money(avg_price * (D(1) - disc))
        resulting_gm = margin_pct(net_price, unit_cogs)
        threshold = D(gm_threshold_pct) / D(100)

        escalate = resulting_gm < threshold
        status = "ESCALATED" if escalate else "AUTO_APPROVED"
        routed_to = "Finance Leadership" if escalate else "Auto (within policy)"

        if persist:
            try:
                db.add(DealApproval(
                    product_id=product_id, customer_id=customer_id,
                    proposed_discount_pct=disc,
                    resulting_gm_pct=round(float(resulting_gm) * 100, 3),
                    gm_threshold_pct=gm_threshold_pct,
                    status=status, routed_to=routed_to))
                db.commit()
            except Exception:
                db.rollback()

        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message=f"G2N deal {status.lower().replace('_', ' ')}.",
            data={
                "product_id": product_id, "customer_id": customer_id,
                "proposed_discount_pct": float(disc),
                "net_price": float(net_price),
                "resulting_gm_pct": to_pct_display(resulting_gm, 1),
                "gm_threshold_pct": gm_threshold_pct,
                "status": status, "routed_to": routed_to,
                "requires_finance_signoff": escalate,
            },
        )


class TradeFundService(OptimizationEngine):
    """Feature 10: top-down trade fund ledger with overspend guardrail."""

    feature_id = 10
    name = "trade_fund_service"

    def run(self, db: Session, region: str = None, fiscal_year: int = 2024,
            **kwargs) -> EngineResult:
        """Read-only status (uncommitted balance) for a region/year, or all."""
        q = db.query(TradeFundLedger)
        if region:
            q = q.filter(TradeFundLedger.region == region)
        q = q.filter(TradeFundLedger.fiscal_year == fiscal_year)
        rows = q.all()
        ledger = [_ledger_row(r) for r in rows]
        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message=f"Trade fund ledger ({len(ledger)} region(s)).",
            data={"fiscal_year": fiscal_year, "ledger": ledger},
        )

    # ── mutations ────────────────────────────────────────────────────────────
    def allocate(self, db: Session, region: str, fiscal_year: int, amount: float) -> Dict[str, Any]:
        row = (db.query(TradeFundLedger)
               .filter_by(region=region, fiscal_year=fiscal_year).one_or_none())
        if not row:
            row = TradeFundLedger(region=region, fiscal_year=fiscal_year,
                                  allocated_amount=0, committed_amount=0, settled_amount=0)
            db.add(row)
        row.allocated_amount = D(row.allocated_amount or 0) + D(amount)
        db.commit()
        return _ledger_row(row)

    def commit_spend(self, db: Session, region: str, fiscal_year: int, amount: float) -> Dict[str, Any]:
        """Guardrail: block commit that exceeds the uncommitted balance."""
        row = (db.query(TradeFundLedger)
               .filter_by(region=region, fiscal_year=fiscal_year).one_or_none())
        if not row:
            return {"allowed": False, "reason": "No allocation for region/year.",
                    "region": region, "fiscal_year": fiscal_year}
        allocated = D(row.allocated_amount or 0)
        committed = D(row.committed_amount or 0)
        uncommitted = allocated - committed
        req = D(amount)
        if req > uncommitted:
            return {"allowed": False,
                    "reason": "Commit exceeds uncommitted balance (overspend blocked).",
                    "requested": float(money(req)), "uncommitted": float(money(uncommitted)),
                    **_ledger_row(row)}
        row.committed_amount = committed + req
        db.commit()
        return {"allowed": True, "committed": float(money(req)), **_ledger_row(row)}


class ClaimsReconciliationEngine(OptimizationEngine):
    """Feature 11: reconcile a retailer deduction against contracted terms and
    isolate unauthorized margin leakage (positive variance)."""

    feature_id = 11
    name = "claims_reconciliation"

    def run(self, db: Session, customer_id: str = None, claim_amount: float = 0.0,
            contracted_amount: float = 0.0, reason: str = "", persist: bool = True,
            **kwargs) -> EngineResult:
        if not customer_id:
            return self._baseline("No customer_id supplied.")
        claim = D(claim_amount)
        contracted = D(contracted_amount)
        variance = money(claim - contracted)
        unauthorized = variance > 0
        status = "DISPUTED" if unauthorized else "APPROVED"

        if persist:
            try:
                db.add(TradeClaim(
                    customer_id=customer_id, claim_amount=claim,
                    contracted_amount=contracted, variance=variance,
                    reason=reason, status=status))
                db.commit()
            except Exception:
                db.rollback()

        return EngineResult(
            feature_id=self.feature_id, ok=True,
            message=f"Claim reconciled: {status}.",
            data={
                "customer_id": customer_id,
                "claim_amount": float(money(claim)),
                "contracted_amount": float(money(contracted)),
                "variance": float(variance),
                "unauthorized_leakage": float(variance) if unauthorized else 0.0,
                "status": status,
                "reason": reason,
            },
        )


def _ledger_row(r: TradeFundLedger) -> Dict[str, Any]:
    allocated = D(r.allocated_amount or 0)
    committed = D(r.committed_amount or 0)
    settled = D(r.settled_amount or 0)
    uncommitted = allocated - committed
    return {
        "region": r.region, "fiscal_year": r.fiscal_year,
        "allocated": float(money(allocated)),
        "committed": float(money(committed)),
        "settled": float(money(settled)),
        "uncommitted": float(money(uncommitted)),
        "utilization_pct": to_pct_display(safe_div(committed, allocated), 1),
    }
