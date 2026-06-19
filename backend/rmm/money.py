"""
Fixed-point financial primitives (integration rule #1).

All margin / price / fund math in the RMM layer flows through these helpers so
that money never touches binary floating point, which would accumulate rounding
drift across gross-to-net waterfalls and per-ounce matrices.

Conventions:
    * Money is quantized to 4 decimal places internally (sub-cent precision),
      presented to 2 dp at the API boundary.
    * Percentages are decimal fractions quantized to 6 dp (e.g. 0.235000 == 23.5%).
    * Division guards against zero -> returns Decimal("0").
"""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from typing import Union

Number = Union[int, float, str, Decimal]

_MONEY_Q = Decimal("0.0001")   # internal money precision (sub-cent)
_PCT_Q = Decimal("0.000001")   # fraction precision
_DISPLAY_Q = Decimal("0.01")   # 2dp for presentation


def D(value: Number) -> Decimal:
    """Coerce any numeric input to Decimal, routing through str to avoid float
    binary artifacts (Decimal(0.1) != Decimal('0.1'))."""
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal("0")


def money(value: Number) -> Decimal:
    """Quantize to internal money precision."""
    return D(value).quantize(_MONEY_Q, rounding=ROUND_HALF_UP)


def display_money(value: Number) -> float:
    """2dp float for JSON payloads."""
    return float(D(value).quantize(_DISPLAY_Q, rounding=ROUND_HALF_UP))


def frac(value: Number) -> Decimal:
    """Quantize a fraction (0..1) to percentage precision."""
    return D(value).quantize(_PCT_Q, rounding=ROUND_HALF_UP)


def safe_div(numerator: Number, denominator: Number) -> Decimal:
    """Zero-safe Decimal division."""
    d = D(denominator)
    if d == 0:
        return Decimal("0")
    return D(numerator) / d


def margin_pct(price: Number, unit_cost: Number) -> Decimal:
    """Gross margin as a fraction: (price - cost) / price."""
    p = D(price)
    if p == 0:
        return Decimal("0")
    return frac((p - D(unit_cost)) / p)


def markup_pct(price: Number, unit_cost: Number) -> Decimal:
    """Markup over cost: (price - cost) / cost."""
    c = D(unit_cost)
    if c == 0:
        return Decimal("0")
    return frac((D(price) - c) / c)


def apply_pct_change(base: Number, pct_change: Number) -> Decimal:
    """base * (1 + pct_change) where pct_change is a fraction."""
    return money(D(base) * (Decimal("1") + D(pct_change)))


def to_pct_display(fraction: Number, digits: int = 1) -> float:
    """Fraction -> percentage float for display (0.235 -> 23.5)."""
    q = Decimal("1").scaleb(-digits)  # 10**-digits
    return float((D(fraction) * Decimal("100")).quantize(q, rounding=ROUND_HALF_UP))
