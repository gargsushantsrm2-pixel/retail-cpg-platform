"""
RGM Copilot agent.

Two backends, same tool registry:
  * LLM (Claude) — used when ANTHROPIC_API_KEY is set and the `anthropic` SDK is
    importable. A manual tool-use loop with claude-opus-4-8 + adaptive thinking.
  * Deterministic intent router — zero-config fallback that keyword-matches the
    question to a tool, resolves the product/category from the catalog, runs the
    engine, and templates a natural-language answer.
"""

from __future__ import annotations

import os
import re
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from .tools import TOOLS, anthropic_tool_defs, execute_tool, _list_catalog

MODEL = "claude-opus-4-8"
MAX_TOOL_ITERATIONS = 6

SYSTEM_PROMPT = (
    "You are the Triax RGM Copilot, an assistant for Retail & CPG Revenue Margin "
    "Management. You help commercial, finance, and RGM teams reason about pricing "
    "elasticity, promotions, trade terms, portfolio/assortment, and the 3-C "
    "(Company / Customer / Consumer) balance.\n\n"
    "Use the provided tools to ground every answer in the platform's live engines "
    "and seeded data — do not invent numbers. Product IDs look like 'BEV-001'; if "
    "the user names a brand or product in words, call list_catalog first to resolve "
    "it. Be concise and lead with a recommendation, then the supporting numbers."
)


def llm_available() -> bool:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return False
    try:
        import anthropic  # noqa: F401
        return True
    except Exception:
        return False


class Copilot:
    def ask(self, db: Session, question: str) -> Dict[str, Any]:
        if llm_available():
            try:
                return self._ask_llm(db, question)
            except Exception as e:  # fall back rather than 500
                res = self._ask_deterministic(db, question)
                res["llm_error"] = str(e)
                return res
        return self._ask_deterministic(db, question)

    # ── Claude tool-use loop ──────────────────────────────────────────────────
    def _ask_llm(self, db: Session, question: str) -> Dict[str, Any]:
        import anthropic
        client = anthropic.Anthropic()
        tools = anthropic_tool_defs()
        messages: List[Dict[str, Any]] = [{"role": "user", "content": question}]
        tools_used: List[str] = []

        for _ in range(MAX_TOOL_ITERATIONS):
            resp = client.messages.create(
                model=MODEL,
                max_tokens=16000,
                thinking={"type": "adaptive"},
                system=SYSTEM_PROMPT,
                tools=tools,
                messages=messages,
            )
            if resp.stop_reason != "tool_use":
                answer = "".join(b.text for b in resp.content if b.type == "text")
                return {"mode": "llm", "answer": answer.strip(), "tools_used": tools_used}

            messages.append({"role": "assistant", "content": resp.content})
            results = []
            for block in resp.content:
                if block.type == "tool_use":
                    tools_used.append(block.name)
                    out = execute_tool(db, block.name, block.input)
                    results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": _json(out),
                    })
            messages.append({"role": "user", "content": results})

        return {"mode": "llm", "answer": "Reached the tool-call limit before finishing. "
                "Try a more specific question.", "tools_used": tools_used}

    # ── Deterministic intent router ───────────────────────────────────────────
    def _ask_deterministic(self, db: Session, question: str) -> Dict[str, Any]:
        q = question.lower()
        catalog = _list_catalog(db)
        product_id = self._resolve_product(q, catalog)
        category = self._resolve_category(q, catalog)
        pct = self._resolve_pct(q)

        tool = self._match_tool(q)
        if tool is None:
            tips = ", ".join(t["name"] for t in TOOLS if t["name"] != "list_catalog")
            return {"mode": "deterministic",
                    "answer": ("I can help with pricing elasticity, promotions, cannibalization, "
                               "competitor index, B2B deals, cost-spike playbooks, SKU pruning, promo "
                               "timing, segmented demand, and maturity. Try naming a product (e.g. BEV-001) "
                               "or a category. Available skills: " + tips),
                    "tools_used": []}

        args: Dict[str, Any] = {}
        if product_id:
            args["product_id"] = product_id
        if category:
            args["category"] = category
        if pct is not None:
            if tool["name"] == "simulate_promo":
                args["discount_pct"] = pct / 100 if pct > 1 else pct
            elif tool["name"] in ("cannibalization", "segmented_demand"):
                args["price_change_pct"] = pct
            elif tool["name"] == "decision_guides":
                args["cost_spike_pct"] = pct

        # tools needing a product but none resolved
        if tool["name"] in ("price_elasticity", "cannibalization", "simulate_promo", "b2b_deal_pricer") and not product_id:
            return {"mode": "deterministic",
                    "answer": f"Which product? Name a SKU id (e.g. {catalog['products'][0]['product_id']}) "
                              f"or a brand. I have {len(catalog['products'])} SKUs across {len(catalog['categories'])} categories.",
                    "tools_used": []}

        out = execute_tool(db, tool["name"], args)
        return {"mode": "deterministic", "answer": _format(tool["name"], out, args),
                "tools_used": [tool["name"]], "data": out}

    # ── resolution helpers ────────────────────────────────────────────────────
    def _resolve_product(self, q: str, catalog) -> str | None:
        m = re.search(r"\b([a-z]{2,4}-\d{3})\b", q)
        if m:
            pid = m.group(1).upper()
            if any(p["product_id"] == pid for p in catalog["products"]):
                return pid
        for p in catalog["products"]:
            if p["sku_name"].lower() in q or p["brand"].lower() in q:
                return p["product_id"]
        return None

    def _resolve_category(self, q: str, catalog) -> str | None:
        for c in catalog["categories"]:
            if c.lower() in q:
                return c
        return None

    def _resolve_pct(self, q: str) -> float | None:
        m = re.search(r"(\d+(?:\.\d+)?)\s*%", q)
        return float(m.group(1)) if m else None

    def _match_tool(self, q: str):
        best, best_hits = None, 0
        for t in TOOLS:
            hits = sum(1 for kw in t["keywords"] if kw in q)
            if hits > best_hits:
                best, best_hits = t, hits
        return best


# ── formatting ────────────────────────────────────────────────────────────────

def _json(obj) -> str:
    import json
    return json.dumps(obj, default=str)[:6000]


def _format(name: str, d: Dict[str, Any], args: Dict[str, Any]) -> str:
    if d.get("error"):
        return f"Couldn't run that: {d['error']}"
    if name == "price_elasticity":
        cm = d.get("context_matrix", {})
        parts = [f"{k.replace('_', ' ')}: {v.get('elasticity')}" for k, v in cm.items()]
        rule = (d.get("non_linear_demand") or {}).get("recommended_rule", "")
        return (f"Elasticity for {d.get('sku_name', args.get('product_id'))} — " + "; ".join(parts) +
                (f". Pass-through rule: {rule.replace('_', ' ')}." if rule else "."))
    if name == "cannibalization":
        return (f"On a +{d.get('price_change_pct')}% move, ~{d.get('own_portfolio_recapture_pct')}% of lost "
                f"volume is recaptured within your portfolio and ~{d.get('competitor_leakage_pct')}% leaks to competitors.")
    if name == "simulate_promo":
        c = d.get("company", {})
        return (f"Predicted lift {d.get('predicted_lift_pct')}%, incremental revenue "
                f"${d.get('incremental_revenue'):,.0f}, trade spend ${d.get('trade_spend'):,.0f}, "
                f"company ROI {c.get('roi_pct')}%, retailer margin {d.get('retailer', {}).get('gross_margin_pct')}%.")
    if name == "b2b_deal_pricer":
        return (f"Optimal discount {d.get('optimal_discount_pct')}% — win probability "
                f"{d.get('win_probability_at_optimal')}, expected value ${d.get('expected_value_at_optimal'):,.0f}, "
                f"margin {d.get('margin_at_optimal_pct')}%.")
    if name == "decision_guides":
        gs = d.get("guides", [])
        if not gs:
            return "No high-exposure SKUs flagged for that cost spike."
        g = gs[0]
        return (f"For a {d.get('cost_spike_pct')}% cost spike, top exposure is {g.get('sku_name')} "
                f"(GM {g.get('current_gm_pct')}%): " + "; ".join(g.get("actions", [])[:3]))
    if name == "competitor_alerts":
        a = d.get("alerts", [])
        return (f"{len(a)} corridor breach(es)." +
                ("" if not a else " e.g. " + ", ".join(f"{x['brand']} ({x['category']}) index {x['price_index']}" for x in a[:3])))
    if name == "sku_governor":
        recs = d.get("prune_candidates", [])
        return (f"{len(recs)} prune candidate(s) below the margin floor." +
                ("" if not recs else " e.g. " + ", ".join(r["sku_name"][:24] for r in recs[:4])))
    if name == "rgm_maturity":
        return f"RGM/RMM maturity {d.get('overall_score')}/100 ({d.get('stage')}). Weakest areas have step-up tasks."
    if name == "segmented_demand":
        segs = d.get("segments", [])
        return (f"Blended volume change {d.get('blended_volume_change_pct')}% on a {d.get('price_change_pct')}% price move. " +
                "; ".join(f"{s['segment']}: {s['volume_change_pct']}% (drop-out {s['drop_out_pct']}%)" for s in segs))
    if name == "promo_timing":
        return (f"{args.get('category', 'Category')} — promote in troughs ({', '.join(d.get('recommended_promo_windows', []))}); "
                f"avoid peaks ({', '.join(d.get('natural_peaks_avoid_promo', []))}).")
    if name == "list_catalog":
        return f"{len(d.get('products', []))} products across {', '.join(d.get('categories', []))}."
    return d.get("message", "Done.")
