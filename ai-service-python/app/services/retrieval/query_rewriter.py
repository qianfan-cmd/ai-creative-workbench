"""
Query 改写 — RAG 检索阶段 query 扩展。

LLM 生成 main_rewrite + sub_queries，经实体保留过滤后供
hybrid_search 多路检索。QUERY_REWRITE_ENABLED=0 时透传原问。
"""
from __future__ import annotations

import json
import re

from app.services.llm_service import chat_with_llm
from app.services.retrieval.config import QUERY_REWRITE_ENABLED
from app.services.retrieval.source_anchor import tokenize_for_match
from app.services.rag_prompts import query_rewrite_prompt


def _parse_rewrite_json(raw: str) -> dict:
    """解析 LLM 改写 JSON — 支持 markdown fence。"""
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    return json.loads(text)


def _entity_tokens(question: str) -> set[str]:
    """从原问提取长度>=2 的实体 token — 用于子查询实体保留校验。"""
    tokens = tokenize_for_match(question)
    return {t for t in tokens if len(t) >= 2}


def _pick_anchor_entity(entities: set[str]) -> str:
    """选取锚点实体 — 优先最长 ASCII token，否则最长任意 token。"""
    ascii_tokens = sorted(
        [e for e in entities if re.match(r"^[a-z0-9_\-]+$", e)],
        key=len,
        reverse=True,
    )
    if ascii_tokens:
        return ascii_tokens[0]
    return sorted(entities, key=len, reverse=True)[0]


def _filter_sub_queries(question: str, sub_queries: list[str]) -> list[str]:
    """
    过滤/补全子查询 — 确保每条 sub_query 保留原问核心实体。

    若 sub_query 与原问实体无交集，则前缀拼接 anchor entity。
    """
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
    """
    LLM Query 改写 — hybrid_search 检索前调用。

    参数:
        question: 原始用户问题

    返回:
        ``{"main_rewrite": str, "sub_queries": list[str]}``；失败或未启用时 sub_queries 为空

    副作用:
        可能调用 chat_with_llm
    """
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
    """
    合并原问、main_rewrite、sub_queries 为去重有序检索 query 列表。

    参数:
        question: 原问
        rewrite: rewrite_query 返回值

    返回:
        至少含原问（非空时）的 query 列表，供 hybrid_search 逐条检索
    """
    seen: set[str] = set()
    ordered: list[str] = []
    for q in [question.strip(), rewrite.get("main_rewrite", ""), *rewrite.get("sub_queries", [])]:
        q = (q or "").strip()
        if not q or q in seen:
            continue
        seen.add(q)
        ordered.append(q)
    return ordered
