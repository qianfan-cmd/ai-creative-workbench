"""Query 改写 — 主改写 + 子查询（Wave D1.5c / D1.8 实体保留）。"""
from __future__ import annotations

import json
import re

from app.services.llm_service import chat_with_llm
from app.services.retrieval.config import QUERY_REWRITE_ENABLED
from app.services.retrieval.source_anchor import tokenize_for_match
from app.services.rag_prompts import query_rewrite_prompt


def _parse_rewrite_json(raw: str) -> dict:
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    return json.loads(text)


def _entity_tokens(question: str) -> set[str]:
    tokens = tokenize_for_match(question)
    return {t for t in tokens if len(t) >= 2}


def _pick_anchor_entity(entities: set[str]) -> str:
    ascii_tokens = sorted(
        [e for e in entities if re.match(r"^[a-z0-9_\-]+$", e)],
        key=len,
        reverse=True,
    )
    if ascii_tokens:
        return ascii_tokens[0]
    return sorted(entities, key=len, reverse=True)[0]


def _filter_sub_queries(question: str, sub_queries: list[str]) -> list[str]:
    entities = _entity_tokens(question)
    if not entities:
        return sub_queries

    kept: list[str] = []
    for sq in sub_queries:
        sq_tokens = tokenize_for_match(sq)
        if sq_tokens & entities:
            kept.append(sq)
            continue
        anchor = _pick_anchor_entity(entities)
        kept.append(f"{anchor} {sq}")
    return kept


def rewrite_query(question: str) -> dict:
    q = question.strip()
    if not q or not QUERY_REWRITE_ENABLED:
        return {"main_rewrite": q, "sub_queries": []}

    prompt = query_rewrite_prompt(q)

    try:
        raw = chat_with_llm(prompt)
        parsed = _parse_rewrite_json(raw)
        main = (parsed.get("main_rewrite") or q).strip()
        subs = parsed.get("sub_queries") or []
        sub_queries = [s.strip() for s in subs if isinstance(s, str) and s.strip()][:2]
        sub_queries = _filter_sub_queries(q, sub_queries)
        return {"main_rewrite": main, "sub_queries": sub_queries}
    except Exception:
        return {"main_rewrite": q, "sub_queries": []}


def collect_search_queries(question: str, rewrite: dict) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for q in [question.strip(), rewrite.get("main_rewrite", ""), *rewrite.get("sub_queries", [])]:
        q = (q or "").strip()
        if not q or q in seen:
            continue
        seen.add(q)
        ordered.append(q)
    return ordered
