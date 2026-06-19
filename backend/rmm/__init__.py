"""
Revenue Margin Management (RMM) layer.

Extends the existing volume-oriented RGM analytics into a unified RMM framework
governed by the "3-C Joint Optimization" constraint: every price / promotion /
assortment action is balanced across Company margin, Consumer willingness-to-pay,
and Customer (retailer) gross margin.

This package is additive — it inherits from / orchestrates the existing domain
models and services and never mutates them (integration rule #2).

Sub-modules:
    money        Decimal fixed-point financial primitives (rule #1)
    guardrails   Validation gates with safe-baseline fallback (rule #4)
    features     24-module / 44-feature registry + progressive feature flags (M22/M42)
    three_c      3-C joint optimization core (M19/M37/M38)
    engines      Optimization engine interfaces and concrete implementations
"""

RMM_VERSION = "0.1.0"
