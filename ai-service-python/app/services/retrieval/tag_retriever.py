"""
标签检索 — RAG 检索阶段 Tag 通路。

infer_query_tags：LLM 从词表推断 query 相关标签与 requires_exhaustive；
tag_directed_search：调用 vector_store.search_by_tags 定向召回。
"""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass

from app.services.llm_service import chat_with_llm
from app.services.rag_prompts import query_tag_infer_prompt
from app.services.retrieval.config import TAG_INFERENCE_ENABLED
from app.services.vector_store import list_all_tags, search_by_tags

logger = logging.getLogger(__name__)


@dataclass
class TagInferenceResult:
    """Query 标签推断结果 — tags 驱动 tag 召回；requires_exhaustive 驱动 context 选取策略。"""

    tags: list[str]
    requires_exhaustive: bool = False


def _parse_json_obj(raw: str) -> dict:
    """解析 LLM JSON 对象 — 支持 markdown fence。"""
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    return json.loads(text)


def infer_query_tags(question: str, vocabulary: list[str] | None = None) -> TagInferenceResult:
    """
    LLM 推断 query 相关标签 — hybrid_search 第一步。

    参数:
        question: 用户问题
        vocabulary: 可选标签词表；默认 list_all_tags()

    返回:
        TagInferenceResult，最多 5 个标签；失败或未启用时 tags 为空

    副作用:
        可能调用 chat_with_llm、list_all_tags
    """
    q = question.strip()
    if not q or not TAG_INFERENCE_ENABLED:
        return TagInferenceResult(tags=[], requires_exhaustive=False)

    vocab = vocabulary if vocabulary is not None else list_all_tags()
    vocab_sample = vocab[:200]
    vocab_hint = ", ".join(vocab_sample) if vocab_sample else "（词表为空，可输出新标签）"

    prompt = query_tag_infer_prompt(q, vocab_hint)

    try:
        raw = chat_with_llm(prompt)
        parsed = _parse_json_obj(raw)
        tags_raw = parsed.get("tags") or []
        tags: list[str] = []
        seen: set[str] = set()
        for t in tags_raw:
            if not isinstance(t, str):
                continue
            name = t.strip()[:32]
            if name and name not in seen:
                seen.add(name)
                tags.append(name)
        exhaustive = bool(parsed.get("requires_exhaustive"))
        return TagInferenceResult(tags=tags[:5], requires_exhaustive=exhaustive)
    except Exception as exc:
        logger.warning("Tag inference failed: %s", exc)
        return TagInferenceResult(tags=[], requires_exhaustive=False)


def tag_directed_search(tags: list[str], top_k: int = 20) -> list[dict]:
    """
    标签定向召回 — 将 infer_query_tags 结果转为 chunk hit 列表。

    参数:
        tags: 推断出的标签
        top_k: 返回上限

    返回:
        search_by_tags 结果；tags 为空时 []

    副作用:
        可能全表扫描 Chroma chunk（经 list_all_chunks）
    """
    if not tags:
        return []
    return search_by_tags(tags, top_k=top_k)
