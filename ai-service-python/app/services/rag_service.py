"""
RAG 问答服务 — 检索与生成编排层。

在 RAG 流水线中的角色：
  1. ``_retrieve_context``：调用 hybrid_search → 组装 references + LLM Prompt
  2. ``rag_query``：同步调用 chat_with_llm 返回完整回答
  3. ``rag_query_stream``：先 yield references，再 stream_chat_with_llm 逐 token 输出

被 ``routers/rag.py`` 的 /query 与 /query-stream 调用。
"""
from app.services.retrieval.langchain_retriever import hybrid_search
from app.services.retrieval.rag_trace import RagTrace, is_trace_enabled
from app.services.llm_service import chat_with_llm, stream_chat_with_llm
from app.services.rag_prompts import rag_generation_rules


def _build_history_block(history: list[dict]) -> str:
    """
    将多轮对话历史格式化为 Prompt 文本块。

    参数:
        history: ``[{question, answer}, ...]`` 列表

    返回:
        带说明前缀的历史字符串；无有效轮次时返回空串

    副作用:
        无；answer 超 500 字截断
    """
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
    """
    检索上下文并构建 LLM Prompt — RAG 核心中间步骤。

    参数:
        question: 用户问题
        top_k: 传给 hybrid_search 的最终 chunk 数
        history: 多轮历史，写入 Prompt 供指代消解
        trace: 可选 RagTrace，由 hybrid_search 填充调试字段

    返回:
        (references, prompt)：references 供 API 返回；prompt 送 LLM 生成

    副作用:
        调用 hybrid_search、embedding、可能 LLM 改写/打标（在检索层内）

    异常:
        ValueError：问题为空
    """
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
    """
    RAG 同步问答 — 检索 + 一次性 LLM 生成。

    参数:
        question: 用户问题
        top_k: 检索 chunk 上限
        history: 可选多轮历史

    返回:
        ``{"answer": str, "references": list, "trace"?: dict}``
        无检索命中时 answer 为固定提示语，references 为空

    副作用:
        调用混合检索与 chat_with_llm
    """
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
    """
    RAG 流式问答生成器 — 供 SSE 层消费。

    产出事件顺序:
        status → trace(可选) → references → message(0..n) → 结束

    参数:
        同 rag_query

    产出:
        ``{"type": "status"|"trace"|"references"|"message", "data": ...}``

    副作用:
        同 rag_query；stream_chat_with_llm 逐 chunk yield
    """
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
