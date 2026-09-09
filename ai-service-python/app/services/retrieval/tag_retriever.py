"""Wave D1.7 — LLM 推断 query 相关标签 + 标签定向召回。"""
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
    tags: list[str]
    requires_exhaustive: bool = False


def _parse_json_obj(raw: str) -> dict:
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    return json.loads(text)


def infer_query_tags(question: str, vocabulary: list[str] | None = None) -> TagInferenceResult:
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
    if not tags:
        return []
    return search_by_tags(tags, top_k=top_k)
