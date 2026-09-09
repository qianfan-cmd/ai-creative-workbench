"""Wave D3.5 — 点踩 LLM 分诊。"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.services.llm_service import chat_with_llm
from app.services.rag_prompts import feedback_triage_prompt

logger = logging.getLogger(__name__)


def _parse_json_obj(raw: str) -> dict:
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    return json.loads(text)


def triage_feedback(
    *,
    question: str,
    answer: str,
    references: list[dict[str, Any]],
    reason: str | None,
    user_reason_detail: str | None = None,
) -> dict[str, Any]:
    refs_preview = json.dumps(references[:8], ensure_ascii=False)[:4000]
    prompt = feedback_triage_prompt(
        reason=reason,
        user_reason_detail=user_reason_detail,
        question=question,
        answer=answer,
        refs_preview=refs_preview,
    )

    try:
        raw = chat_with_llm(prompt)
        return _parse_json_obj(raw)
    except Exception as exc:
        logger.warning("feedback triage failed: %s", exc)
        return {
            "root_step": 9,
            "reason_detail": str(exc),
            "bad_chunk_ids": [],
            "good_chunk_ids_missing": [],
            "suggested_document_tags": {},
            "suggested_actions": [],
        }
