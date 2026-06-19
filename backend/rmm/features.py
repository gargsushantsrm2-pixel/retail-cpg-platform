"""
Feature registry + progressive scope scaffolding (Module 22 / Feature 42).

The full 44-feature surface is registered here with a maturity TIER. Module 22
mandates that advanced predictive/prescriptive capabilities stay behind feature
flags, serving diagnostic & indexing data first to establish user trust before
expanding permissions. The registry is the single source of truth for:

    * which features exist (all 44, mapped to their 24 modules)
    * their rollout tier (diagnostic -> indexing -> predictive -> prescriptive)
    * their implementation status (LIVE engine vs SCAFFOLD interface)
    * whether they are currently enabled for serving

`is_enabled(feature_id)` gates an endpoint; disabled/scaffold features return a
safe-baseline payload (integration rule #4) instead of raising.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from enum import IntEnum
from typing import Dict, List, Optional


class FeatureTier(IntEnum):
    """Progressive rollout tiers. Lower tiers unlock first."""
    DIAGNOSTIC = 1     # read-only assessment, no automation
    INDEXING = 2       # descriptive indices, benchmarks
    PREDICTIVE = 3     # forecasts, simulations
    PRESCRIPTIVE = 4   # autonomous recommendations / actions


class ImplStatus(str):
    LIVE = "LIVE"          # backed by a working engine in this build
    SCAFFOLD = "SCAFFOLD"  # interface defined, returns safe-baseline


@dataclass(frozen=True)
class Feature:
    id: int
    module: int
    module_name: str
    name: str
    tier: FeatureTier
    status: str          # ImplStatus.*
    enabled: bool

    def to_dict(self) -> Dict:
        d = asdict(self)
        d["tier"] = self.tier.name
        return d


def _f(id_, module, module_name, name, tier, status=ImplStatus.SCAFFOLD, enabled=None):
    # By default, DIAGNOSTIC + INDEXING tiers are enabled; higher tiers gated off
    # until trust is established (M22). LIVE features are enabled regardless.
    if enabled is None:
        enabled = (tier <= FeatureTier.INDEXING) or (status == ImplStatus.LIVE)
    return Feature(id_, module, module_name, name, tier, status, enabled)


# All 44 features. status=LIVE marks the ones with real engines in this build.
FEATURES: List[Feature] = [
    # M1 Pricing Optimization & Elasticity Engine
    _f(1, 1, "Pricing Optimization & Elasticity Engine", "Multi-Variant Price Elasticity Modeling", FeatureTier.PREDICTIVE, ImplStatus.LIVE),
    _f(2, 1, "Pricing Optimization & Elasticity Engine", "Cross-Elasticity & Cannibalization Tracker", FeatureTier.PREDICTIVE, ImplStatus.LIVE),
    _f(3, 1, "Pricing Optimization & Elasticity Engine", "Dynamic Competitor Indexing & Alerts", FeatureTier.INDEXING),
    # M2 TPM/TPO
    _f(4, 2, "Trade Promotion Management & Optimization", "Predictive Promotion Scenario Simulator", FeatureTier.PREDICTIVE, ImplStatus.LIVE),
    _f(5, 2, "Trade Promotion Management & Optimization", "Multi-Level Promotion Calendar & Workspace", FeatureTier.INDEXING, ImplStatus.LIVE),
    _f(6, 2, "Trade Promotion Management & Optimization", "Post-Event ROI Balanced Scorecard", FeatureTier.DIAGNOSTIC, ImplStatus.LIVE),
    # M3 PPA Designer
    _f(7, 3, "Price Pack Architecture Designer", "Margin Contribution & Per-Ounce Matrix", FeatureTier.INDEXING),
    _f(8, 3, "Price Pack Architecture Designer", "Premiumization & Channel Pack Alignment", FeatureTier.PRESCRIPTIVE),
    # M4 Trade Terms & G2N
    _f(9, 4, "Trade Terms & Gross-to-Net Controls", "Automated Workflow Approval Engines", FeatureTier.PRESCRIPTIVE, ImplStatus.LIVE),
    _f(10, 4, "Trade Terms & Gross-to-Net Controls", "Trade Fund Budgetary Allocation & Guardrails", FeatureTier.INDEXING, ImplStatus.LIVE),
    _f(11, 4, "Trade Terms & Gross-to-Net Controls", "Compliance Auditing & Claims Reconciliation", FeatureTier.DIAGNOSTIC, ImplStatus.LIVE),
    # M5 Assortment, Distribution & Demand Forecasting
    _f(12, 5, "Assortment, Distribution & Demand Forecasting", "Store-Level Assortment Recommendation Engine", FeatureTier.PRESCRIPTIVE),
    _f(13, 5, "Assortment, Distribution & Demand Forecasting", "ML Demand Forecasting with Disruption Indicators", FeatureTier.PREDICTIVE),
    # M6 Data Ingestion & Interoperability
    _f(14, 6, "Data Ingestion & Interoperability", "Automated Ingestion, Harmonization & Cleansing", FeatureTier.DIAGNOSTIC),
    _f(15, 6, "Data Ingestion & Interoperability", "OpenAPI Connected Extensibility", FeatureTier.DIAGNOSTIC),
    # M7 AI Prescriptive Analytics
    _f(16, 7, "AI Prescriptive Analytics", "Automated Strategic Growth Decision Guides", FeatureTier.PRESCRIPTIVE),
    # M8 Commercial Investment Allocation & ROI
    _f(17, 8, "Commercial Investment Allocation & ROI", "Cross-Lever Investment Optimization Workspace", FeatureTier.PRESCRIPTIVE),
    _f(18, 8, "Commercial Investment Allocation & ROI", "Internal Servicing Cost-to-Serve Modeler", FeatureTier.PREDICTIVE, ImplStatus.LIVE),
    _f(19, 8, "Commercial Investment Allocation & ROI", "B2B Commercial Deal & Contract Pricer", FeatureTier.PREDICTIVE),
    # M9 Demand Driver Analytics
    _f(20, 9, "Demand Driver Analytics", "Segmented Consumer Demand Response Dashboard", FeatureTier.PREDICTIVE),
    _f(21, 9, "Demand Driver Analytics", "Promotion Duration & Timing Optimizer", FeatureTier.PREDICTIVE),
    # M10 Dynamic Elasticity & Non-Linear Demand
    _f(22, 10, "Dynamic Elasticity & Non-Linear Demand", "Context-Dependent Elasticity Field Matrix", FeatureTier.PREDICTIVE, ImplStatus.LIVE),
    _f(23, 10, "Dynamic Elasticity & Non-Linear Demand", "Non-Linear Demand Function Core", FeatureTier.PREDICTIVE, ImplStatus.LIVE),
    # M11 Micro-Segmentation & WTP Guardrails
    _f(24, 11, "Micro-Segmentation & WTP Guardrails", "Raw-Data Distribution Viewer (Anti-Aggregation)", FeatureTier.DIAGNOSTIC),
    _f(25, 11, "Micro-Segmentation & WTP Guardrails", "95% Correlation Confidence Engine", FeatureTier.PREDICTIVE, ImplStatus.LIVE),
    # M12 Behavioral Pricing & Survey Realism
    _f(26, 12, "Behavioral Pricing & Survey Realism", "Cross-Option Survey Calibration Engine", FeatureTier.PREDICTIVE),
    # M13 Agent-Based Simulation
    _f(27, 13, "Agent-Based Simulation", "Agent-Based Virtual Shopper Simulator", FeatureTier.PREDICTIVE),
    # M14 Commodity Volatility & Margin Buffers
    _f(28, 14, "Commodity Volatility & Margin Buffers", "Multi-Tier Raw Ingredient Cost Tracker", FeatureTier.INDEXING, ImplStatus.LIVE),
    _f(29, 14, "Commodity Volatility & Margin Buffers", "Temporal Price Change Frequency Gatekeeper", FeatureTier.PRESCRIPTIVE, ImplStatus.LIVE),
    # M15 Strategic Intent & Corporate Constraint Gates
    _f(30, 15, "Strategic Intent & Constraint Gates", "Brand Indexing & Competitor Ceiling Lock", FeatureTier.PRESCRIPTIVE, ImplStatus.LIVE),
    _f(31, 15, "Strategic Intent & Constraint Gates", "Rounding & Charm Price Profile Selector", FeatureTier.INDEXING, ImplStatus.LIVE),
    _f(32, 15, "Strategic Intent & Constraint Gates", "Growth vs. Profitability Trade-Off Slider", FeatureTier.PRESCRIPTIVE, ImplStatus.LIVE),
    # M16 Operational Complexity Quantification
    _f(33, 16, "Operational Complexity Quantification", "Complexity-to-Margin Friction Modeler", FeatureTier.PREDICTIVE, ImplStatus.LIVE),
    # M17 RGM Maturity Diagnostics
    _f(34, 17, "RGM Maturity Diagnostics", "RGM Capability & Execution Maturity Assessment", FeatureTier.DIAGNOSTIC, ImplStatus.LIVE),
    # M18 Surgical Price-Tiering & Inflation
    _f(35, 18, "Surgical Price-Tiering & Inflation", "Granular Multi-Tier Pricing Tier Editor", FeatureTier.INDEXING),
    _f(36, 18, "Surgical Price-Tiering & Inflation", "Arbitrary Price-Smoothing Alert System", FeatureTier.PRESCRIPTIVE, ImplStatus.LIVE),
    # M19 3-C Joint Optimization Matrix
    _f(37, 19, "3-C Joint Optimization Matrix", "Retailer Gross Margin Protection Tracker", FeatureTier.DIAGNOSTIC, ImplStatus.LIVE),
    _f(38, 19, "3-C Joint Optimization Matrix", "Joint 3-C Optimization Scorecard", FeatureTier.PREDICTIVE, ImplStatus.LIVE),
    # M20 Cross-Functional Operating Model Governance
    _f(39, 20, "Cross-Functional Operating Model Governance", "Cross-Functional RMM Workflow Orchestrator", FeatureTier.PRESCRIPTIVE),
    _f(40, 20, "Cross-Functional Operating Model Governance", "SKU Proliferation & Complexity Cost Governor", FeatureTier.PREDICTIVE, ImplStatus.LIVE),
    # M21 Stakeholder Personalization
    _f(41, 21, "Stakeholder Personalization", "Stakeholder-Specific UX Views", FeatureTier.INDEXING),
    # M22 Change-Management Scope & Horizon Scaffolding
    _f(42, 22, "Change-Management Scaffolding", "Progressive Scope Scaffolding Engine", FeatureTier.DIAGNOSTIC, ImplStatus.LIVE),
    # M23 Omni-Channel Synchronization
    _f(43, 23, "Omni-Channel Synchronization", "Omni-Channel Shelf Velocity & Constraint Synchronizer", FeatureTier.PREDICTIVE),
    # M24 Contextual Value Indices
    _f(44, 24, "Contextual Value Indices", "Attribute-Based Portfolio Price Architecture Indexer", FeatureTier.INDEXING),
]

_BY_ID: Dict[int, Feature] = {f.id: f for f in FEATURES}


def get_feature(feature_id: int) -> Optional[Feature]:
    return _BY_ID.get(feature_id)


def is_enabled(feature_id: int) -> bool:
    f = _BY_ID.get(feature_id)
    return bool(f and f.enabled)


def is_live(feature_id: int) -> bool:
    f = _BY_ID.get(feature_id)
    return bool(f and f.status == ImplStatus.LIVE)


def registry_summary() -> Dict:
    by_module: Dict[int, Dict] = {}
    for f in FEATURES:
        m = by_module.setdefault(f.module, {"module": f.module, "module_name": f.module_name, "features": []})
        m["features"].append(f.to_dict())
    live = sum(1 for f in FEATURES if f.status == ImplStatus.LIVE)
    return {
        "total_features": len(FEATURES),
        "total_modules": len({f.module for f in FEATURES}),
        "live": live,
        "scaffolded": len(FEATURES) - live,
        "enabled": sum(1 for f in FEATURES if f.enabled),
        "tiers": {t.name: sum(1 for f in FEATURES if f.tier == t) for t in FeatureTier},
        "modules": list(by_module.values()),
    }
