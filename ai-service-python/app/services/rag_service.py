"""
RAG 问答服务 — 串联：混合检索 + 大模型生成。
"""
from app.services.retrieval.langchain_retriever import hybrid_search
from app.services.retrieval.rag_trace import RagTrace, is_trace_enabled
from app.services.llm_service import chat_with_llm, stream_chat_with_llm
from app.services.rag_prompts import rag_generation_rules


def _build_history_block(history: list[dict]) -> str:
    if not history:
        return ""
    lines: list[str] = []
    for i, turn in enumerate(history, 1):
        q = turn.get("question", "").strip()
        a = turn.get("answer", "").strip()
        if not q:
            continue
        if len(a) > 500:
            a = a[:500] + "…"
        lines.append(f"第{i}轮\n用户：{q}\n助手：{a}")
    if not lines:
        return ""
    return "对话历史（供理解上下文；回答仍须严格基于下方「参考资料」）：\n" + "\n\n".join(lines) + "\n\n"


def _retrieve_context(
    question: str,
    top_k: int = 6,
    history: list[dict] | None = None,
    trace: RagTrace | None = None,
) -> tuple[list[dict], str]:
    q = question.strip()
    if not q:
        raise ValueError("问题不能为空")

    hits = hybrid_search(q, top_k=top_k, trace=trace)
    if not hits:
        return [], ""

    references: list[dict] = []
    context_lines: list[str] = []

    for i, hit in enumerate(hits):
        content = hit["content"]
        source = hit["source"]
        index = hit["index"]
        cite_num = i + 1

        ref: dict = {
            "content": content,
            "source": source,
            "index": index,
        }
        for key in ("distance", "retrieval_source", "rrf_score", "rerank_score", "section", "heading", "tags", "chunk_summary", "tag_overlap"):
            if hit.get(key) is not None:
                ref[key] = hit[key]
        references.append(ref)
        heading = hit.get("heading") or ""
        summary = hit.get("chunk_summary") or ""
        meta_parts = [f"文档:{source}"]
        if heading:
            meta_parts.append(f"小节:{heading}")
        if summary:
            meta_parts.append(f"摘要:{summary}")
        meta_parts.append(f"第{index}段")
        context_lines.append(f"[{cite_num}] {' | '.join(meta_parts)}\n{content}")

    context_block = "\n\n".join(context_lines)
    history_block = _build_history_block(history or [])
    prompt = f"""你是一个知识库问答助手。请严格根据下面「参考资料」回答用户问题。

{rag_generation_rules()}

{history_block}参考资料：
{context_block}

用户问题：{q}

请用中文回答。"""

    return references, prompt


def rag_query(question: str, top_k: int = 6, history: list[dict] | None = None) -> dict:
    trace = RagTrace() if is_trace_enabled() else None
    references, prompt = _retrieve_context(question, top_k, history, trace=trace)

    if not references:
        out = {
            "answer": "知识库中没有相关文档，请提供更多信息或知识库更新。",
            "references": [],
        }
        if trace:
            out["trace"] = trace.to_dict()
        return out

    answer = chat_with_llm(prompt)
    out = {"answer": answer, "references": references}
    if trace:
        out["trace"] = trace.to_dict()
    return out


def rag_query_stream(question: str, top_k: int = 6, history: list[dict] | None = None):
    yield {"type": "status", "data": "retrieving"}

    trace = RagTrace() if is_trace_enabled() else None
    references, prompt = _retrieve_context(question, top_k, history, trace=trace)

    if trace:
        yield {"type": "trace", "data": trace.to_dict()}

    yield {"type": "references", "data": references}

    if not references:
        yield {"type": "message", "data": "知识库中没有相关文档，请提供更多信息或知识库更新。"}
        return

    for chunk in stream_chat_with_llm(prompt):
        yield {"type": "message", "data": chunk}
