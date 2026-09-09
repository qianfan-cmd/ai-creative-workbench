"""Wave D3.5 — 点踩全自动修复动作编排。"""
from __future__ import annotations

import logging
from typing import Any

from app.services.feedback_triage import triage_feedback

logger = logging.getLogger(__name__)


def _parse_action(raw: str) -> tuple[str, str, str | None]:
    """penalize:chunk_id | boost:chunk_id | penalize_source:filename | boost_source:filename | ..."""
    parts = raw.split(":", 2)
    if len(parts) < 2:
        return raw, "", None
    action = parts[0].strip()
    if action in ("penalize_source", "boost_source"):
        return action, parts[1].strip(), None
    if action == "add_tag" and len(parts) == 3:
        return action, parts[1].strip(), parts[2].strip()
    return action, parts[1].strip(), None


def run_feedback_fix(payload: dict[str, Any]) -> list[dict[str, Any]]:
    question = payload.get("question") or ""
    answer = payload.get("answer") or ""
    references = payload.get("references") or []
    reason = payload.get("reason")
    user_reason_detail = payload.get("reason_detail")
    feedback_id = payload.get("feedback_id")
    turn_id = payload.get("turn_id")

    triage = triage_feedback(
        question=question,
        answer=answer,
        references=references,
        reason=reason,
        user_reason_detail=user_reason_detail,
    )

    actions_out: list[dict[str, Any]] = []
    root_step = triage.get("root_step")

    actions_out.append({
        "action_type": "triage",
        "triage_step": root_step,
        "detail": triage.get("reason_detail"),
        "status": "success",
    })

    for chunk_id in triage.get("bad_chunk_ids") or []:
        if not chunk_id:
            continue
        source = chunk_id.rsplit("-", 1)[0] if "-" in chunk_id else None
        actions_out.append({
            "action_type": "penalize",
            "chunk_id": chunk_id,
            "source": source,
            "triage_step": root_step,
            "detail": f"penalize {chunk_id}",
            "status": "success",
        })

    for chunk_id in triage.get("good_chunk_ids_missing") or []:
        if not chunk_id:
            continue
        source = chunk_id.rsplit("-", 1)[0] if "-" in chunk_id else None
        actions_out.append({
            "action_type": "boost",
            "chunk_id": chunk_id,
            "source": source,
            "triage_step": root_step,
            "detail": f"boost {chunk_id}",
            "status": "success",
        })

    for action_raw in triage.get("suggested_actions") or []:
        action_type, target, extra = _parse_action(str(action_raw))
        if action_type == "reindex" and target:
            actions_out.append({
                "action_type": "reindex",
                "filename": target,
                "triage_step": 1,
                "detail": target,
                "status": "pending",
            })
        elif action_type == "penalize_source" and target:
            actions_out.append({
                "action_type": "penalize_source",
                "filename": target,
                "source": target,
                "triage_step": root_step,
                "detail": f"penalize_source {target}",
                "status": "success",
            })
        elif action_type == "boost_source" and target:
            actions_out.append({
                "action_type": "boost_source",
                "filename": target,
                "source": target,
                "triage_step": root_step,
                "detail": f"boost_source {target}",
                "status": "success",
            })
        elif action_type == "add_tag" and target and extra:
            actions_out.append({
                "action_type": "add_tag",
                "filename": target,
                "tag_name": extra,
                "triage_step": 1,
                "detail": f"{target}:{extra}",
                "status": "pending",
            })

    for filename, tags in (triage.get("suggested_document_tags") or {}).items():
        for tag in tags or []:
            actions_out.append({
                "action_type": "add_tag",
                "filename": filename,
                "tag_name": tag,
                "triage_step": 1,
                "detail": f"{filename}:{tag}",
                "status": "pending",
            })

    actions_out.append({
        "action_type": "golden_draft",
        "triage_step": 8,
        "detail": question[:200],
        "status": "success",
        "feedback_id": feedback_id,
        "turn_id": turn_id,
    })

    logger.info(
        "feedback fix triage feedback_id=%s turn_id=%s actions=%d",
        feedback_id,
        turn_id,
        len(actions_out),
    )
    return actions_out
