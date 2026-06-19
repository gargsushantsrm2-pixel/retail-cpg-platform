"""
Guardrail framework (integration rule #4).

Every optimization output is passed through a chain of guardrails before it can
be surfaced as a recommendation. A guardrail returns a structured result with
telemetry; if any guardrail BLOCKs, the orchestrator falls back to a safe
baseline state rather than emitting an unsafe action.

Implemented gates:
    WTPCorrelationGate          M25  — block micro-differentiation below 95% WTP correlation
    PriceChangeFrequencyGate    M29  — cap structural price changes per region/year
    CharmRoundingPolicy         M31  — enforce charm-ending rules (.95 allow / .99 ban)
    CompetitorCeilingLock       M30  — clamp to competitor index corridor
    ThreeCCompromiseIntercept   M19  — block actions that fail the 3-C joint balance
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import Any, Dict, List, Optional

from .money import D, money, frac

logger = logging.getLogger("rmm.guardrails")


class GuardrailStatus(str, Enum):
    PASS = "PASS"
    WARN = "WARN"             # surfaced but allowed
    BLOCK = "BLOCK"           # action rejected
    SAFE_BASELINE = "SAFE_BASELINE"  # fell back to safe default


@dataclass
class GuardrailResult:
    gate: str
    status: GuardrailStatus
    message: str
    # The value the gate produced (possibly clamped/rounded), plus telemetry.
    adjusted_value: Optional[float] = None
    telemetry: Dict[str, Any] = field(default_factory=dict)

    @property
    def blocked(self) -> bool:
        return self.status == GuardrailStatus.BLOCK

    def to_dict(self) -> Dict[str, Any]:
        return {
            "gate": self.gate,
            "status": self.status.value,
            "message": self.message,
            "adjusted_value": self.adjusted_value,
            "telemetry": self.telemetry,
        }


class Guardrail(ABC):
    """Abstract guardrail. Subclasses implement `evaluate`."""

    name: str = "guardrail"

    @abstractmethod
    def evaluate(self, ctx: Dict[str, Any]) -> GuardrailResult:
        ...


# ── M25: 95% WTP correlation gate ─────────────────────────────────────────────

class WTPCorrelationGate(Guardrail):
    """Block individual-level price differentiation unless predicted vs. actual
    willingness-to-pay correlate >= threshold. Below it, the model cannot
    distinguish buyers reliably and differentiation drives edge-buyer drop-off,
    so we force a single flat baseline price."""

    name = "wtp_correlation_gate"

    def __init__(self, threshold: float = 0.95):
        self.threshold = D(threshold)

    def evaluate(self, ctx: Dict[str, Any]) -> GuardrailResult:
        corr = ctx.get("wtp_correlation")
        baseline_price = ctx.get("baseline_price")
        if corr is None:
            return GuardrailResult(
                self.name, GuardrailStatus.SAFE_BASELINE,
                "No WTP correlation supplied; defaulting to flat baseline pricing.",
                adjusted_value=baseline_price,
                telemetry={"threshold": float(self.threshold)},
            )
        corr_d = D(corr)
        if corr_d < self.threshold:
            return GuardrailResult(
                self.name, GuardrailStatus.BLOCK,
                f"WTP correlation {float(corr_d):.3f} < {float(self.threshold):.2f}; "
                "micro-differentiation blocked, enforcing flat baseline price.",
                adjusted_value=baseline_price,
                telemetry={"correlation": float(corr_d), "threshold": float(self.threshold)},
            )
        return GuardrailResult(
            self.name, GuardrailStatus.PASS,
            f"WTP correlation {float(corr_d):.3f} >= threshold; differentiation permitted.",
            telemetry={"correlation": float(corr_d), "threshold": float(self.threshold)},
        )


# ── M29: price change frequency gate ──────────────────────────────────────────

class PriceChangeFrequencyGate(Guardrail):
    """Enforce operational limits on how often consumer-facing structural prices
    may change in a region/year window."""

    name = "price_change_frequency_gate"

    def __init__(self, max_changes_per_year: int = 2):
        self.max_changes = max_changes_per_year

    def evaluate(self, ctx: Dict[str, Any]) -> GuardrailResult:
        changes_ytd = int(ctx.get("structural_changes_ytd", 0))
        if changes_ytd >= self.max_changes:
            return GuardrailResult(
                self.name, GuardrailStatus.BLOCK,
                f"Region already executed {changes_ytd}/{self.max_changes} structural "
                "price changes this year; further changes blocked until next window.",
                telemetry={"changes_ytd": changes_ytd, "max": self.max_changes},
            )
        return GuardrailResult(
            self.name, GuardrailStatus.PASS,
            f"{changes_ytd}/{self.max_changes} structural changes used; change permitted.",
            telemetry={"changes_ytd": changes_ytd, "max": self.max_changes},
        )


# ── M31: charm-ending rounding policy ─────────────────────────────────────────

class CharmRoundingPolicy(Guardrail):
    """Map optimized prices onto an allowed charm-ending grid and ban disallowed
    endings (e.g. allow .95, ban .99)."""

    name = "charm_rounding_policy"

    def __init__(self, allowed_ending: str = "0.95", banned_endings: Optional[List[str]] = None):
        self.allowed_ending = D(allowed_ending)            # cents fraction, e.g. 0.95
        self.banned = [D(b) for b in (banned_endings or ["0.99"])]

    def evaluate(self, ctx: Dict[str, Any]) -> GuardrailResult:
        raw = ctx.get("optimized_price")
        if raw is None:
            return GuardrailResult(
                self.name, GuardrailStatus.SAFE_BASELINE,
                "No optimized price supplied; nothing to round.",
            )
        raw_d = D(raw)
        whole = raw_d.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        # Snap to nearest integer dollar then apply the allowed charm ending.
        candidate = (whole - Decimal("1")) + self.allowed_ending
        # choose whichever of {whole-1+ending, whole+ending} is closest to raw
        upper = whole + self.allowed_ending
        if abs(upper - raw_d) < abs(candidate - raw_d):
            candidate = upper
        msg = f"Price rounded to charm ending {float(self.allowed_ending):.2f} -> {float(money(candidate)):.2f}."
        return GuardrailResult(
            self.name, GuardrailStatus.PASS, msg,
            adjusted_value=float(money(candidate)),
            telemetry={"raw": float(raw_d), "allowed_ending": float(self.allowed_ending),
                       "banned_endings": [float(b) for b in self.banned]},
        )


# ── M30: competitor ceiling/floor lock ────────────────────────────────────────

class CompetitorCeilingLock(Guardrail):
    """Clamp price into a corridor defined relative to a competitor index
    (premium ceiling and discount floor as fractions of the index price)."""

    name = "competitor_ceiling_lock"

    def __init__(self, floor_index: float = 0.90, ceiling_index: float = 1.15):
        self.floor_index = D(floor_index)
        self.ceiling_index = D(ceiling_index)

    def evaluate(self, ctx: Dict[str, Any]) -> GuardrailResult:
        price = ctx.get("optimized_price")
        comp = ctx.get("competitor_index_price")
        if price is None or comp is None:
            return GuardrailResult(
                self.name, GuardrailStatus.SAFE_BASELINE,
                "Missing price or competitor index; corridor not enforced.",
                adjusted_value=price,
            )
        price_d, comp_d = D(price), D(comp)
        floor = comp_d * self.floor_index
        ceiling = comp_d * self.ceiling_index
        if price_d > ceiling:
            return GuardrailResult(
                self.name, GuardrailStatus.WARN,
                f"Price {float(price_d):.2f} above competitor ceiling {float(ceiling):.2f}; clamped.",
                adjusted_value=float(money(ceiling)),
                telemetry={"floor": float(money(floor)), "ceiling": float(money(ceiling))},
            )
        if price_d < floor:
            return GuardrailResult(
                self.name, GuardrailStatus.WARN,
                f"Price {float(price_d):.2f} below competitor floor {float(floor):.2f}; clamped.",
                adjusted_value=float(money(floor)),
                telemetry={"floor": float(money(floor)), "ceiling": float(money(ceiling))},
            )
        return GuardrailResult(
            self.name, GuardrailStatus.PASS,
            f"Price within competitor corridor [{float(floor):.2f}, {float(ceiling):.2f}].",
            adjusted_value=float(money(price_d)),
            telemetry={"floor": float(money(floor)), "ceiling": float(money(ceiling))},
        )


# ── M19: 3-C compromise intercept ─────────────────────────────────────────────

class ThreeCCompromiseIntercept(Guardrail):
    """Reject actions that satisfy company margin at the expense of breaching a
    retailer margin floor or pushing consumers past the elasticity cliff.
    Expects normalized 0..1 sub-scores in ctx['three_c'] for company/customer/
    consumer and a minimum acceptable score for each."""

    name = "three_c_compromise_intercept"

    def __init__(self, min_company: float = 0.4, min_customer: float = 0.4, min_consumer: float = 0.4):
        self.min_company = D(min_company)
        self.min_customer = D(min_customer)
        self.min_consumer = D(min_consumer)

    def evaluate(self, ctx: Dict[str, Any]) -> GuardrailResult:
        scores = ctx.get("three_c") or {}
        company = D(scores.get("company", 0))
        customer = D(scores.get("customer", 0))
        consumer = D(scores.get("consumer", 0))
        breaches = []
        if company < self.min_company:
            breaches.append(f"company {float(company):.2f}<{float(self.min_company):.2f}")
        if customer < self.min_customer:
            breaches.append(f"customer {float(customer):.2f}<{float(self.min_customer):.2f}")
        if consumer < self.min_consumer:
            breaches.append(f"consumer {float(consumer):.2f}<{float(self.min_consumer):.2f}")
        telem = {"company": float(company), "customer": float(customer), "consumer": float(consumer)}
        if breaches:
            return GuardrailResult(
                self.name, GuardrailStatus.BLOCK,
                "3-C compromise: " + "; ".join(breaches) + ". Action intercepted.",
                telemetry=telem,
            )
        return GuardrailResult(
            self.name, GuardrailStatus.PASS,
            "All three C sub-scores clear their minimum floors.",
            telemetry=telem,
        )


# ── Orchestration ─────────────────────────────────────────────────────────────

@dataclass
class GuardrailChainResult:
    allowed: bool
    final_value: Optional[float]
    results: List[GuardrailResult]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "allowed": self.allowed,
            "final_value": self.final_value,
            "results": [r.to_dict() for r in self.results],
        }


def run_chain(gates: List[Guardrail], ctx: Dict[str, Any]) -> GuardrailChainResult:
    """Run guardrails in order. A clamped/rounded value from one gate feeds the
    next via ctx['optimized_price']. Any BLOCK ends the chain disallowed."""
    results: List[GuardrailResult] = []
    working_ctx = dict(ctx)
    final_value = working_ctx.get("optimized_price")
    for gate in gates:
        res = gate.evaluate(working_ctx)
        results.append(res)
        if res.adjusted_value is not None:
            final_value = res.adjusted_value
            working_ctx["optimized_price"] = final_value
        if res.blocked:
            logger.info("Guardrail BLOCK at %s: %s", res.gate, res.message)
            return GuardrailChainResult(allowed=False, final_value=working_ctx.get("baseline_price"),
                                        results=results)
    return GuardrailChainResult(allowed=True, final_value=final_value, results=results)
