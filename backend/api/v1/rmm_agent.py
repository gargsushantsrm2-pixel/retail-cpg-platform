"""RGM Copilot API — a tool-calling agent over the RMM engines."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...rmm.agent.agent import Copilot, llm_available
from ...rmm.agent.tools import TOOLS

router = APIRouter(prefix="/rmm/agent", tags=["RMM: Copilot Agent"])


class AskRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=1000)


@router.get("/status")
def status():
    return {
        "mode": "llm" if llm_available() else "deterministic",
        "model": "claude-opus-4-8" if llm_available() else None,
        "tools": [{"name": t["name"], "description": t["description"]} for t in TOOLS],
        "note": ("Claude-powered tool-use is active." if llm_available() else
                 "Running the deterministic router. Set ANTHROPIC_API_KEY (and install the "
                 "anthropic package) to enable Claude-powered reasoning."),
    }


@router.post("/ask")
def ask(req: AskRequest, db: Session = Depends(get_db)):
    return Copilot().ask(db, req.question)
