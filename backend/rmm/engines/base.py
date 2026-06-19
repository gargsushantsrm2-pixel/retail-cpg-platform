"""
Optimization engine interface (integration rule #2: extend via clean abstractions).

Concrete engines (elasticity, cost-to-serve, complexity, etc.) inherit from
`OptimizationEngine` and return an `EngineResult` carrying the payload plus
telemetry and the feature id it serves. Engines never raise on bad analytical
input — they degrade to a safe-baseline result with telemetry (rule #4).
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

logger = logging.getLogger("rmm.engines")


@dataclass
class EngineResult:
    feature_id: int
    ok: bool
    data: Dict[str, Any] = field(default_factory=dict)
    safe_baseline: bool = False
    telemetry: Dict[str, Any] = field(default_factory=dict)
    message: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "feature_id": self.feature_id,
            "ok": self.ok,
            "safe_baseline": self.safe_baseline,
            "message": self.message,
            "telemetry": self.telemetry,
            "data": self.data,
        }


class OptimizationEngine(ABC):
    feature_id: int = 0
    name: str = "engine"

    @abstractmethod
    def run(self, db: Session, **kwargs) -> EngineResult:
        ...

    def _baseline(self, message: str, **telemetry) -> EngineResult:
        logger.info("[%s] safe-baseline: %s", self.name, message)
        return EngineResult(
            feature_id=self.feature_id, ok=True, safe_baseline=True,
            message=message, telemetry=telemetry, data={},
        )
