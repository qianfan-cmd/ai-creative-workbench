"""
RAG 问答服务 — 串联：Embedding 检索 + 大模型生成。
调用链：
  rag_query(question)
    → embed_text(question)        # 问题转向量
    → search_similar(vector)      # Chroma TopK
    → 拼接 Prompt（含检索到的资料）
    → chat_with_llm(prompt)       # DeepSeek 回答
    → 返回 answer + references
类比 Java：一个 Service 调多个其它 Service / Client。
"""
from app.services.embedding_service import embed_text
from app.services.vector_store import search_similar
from app.services.llm_service import chat_with_llm, stream_chat_with_llm

def _build_history_block(history: list[dict]) -> str:
    """把 prior Q/A 拼成 prompt 段，帮助模型理解指代与上下文。"""
    if not history:
        return ""
    lines: list[str] = []
    for i, turn in enumerate(history, 1):
        q = turn.get("question", "").strip()
        a = turn.get("answer", "").strip()
        if not q:
            continue
        # 回答截断，避免 history 占满 token
        if len(a) > 500:
            a = a[:500] + "…"
        lines.append(f"第{i}轮\n用户：{q}\n助手：{a}")
    if not lines:
        return ""
    return "对话历史（供理解上下文；回答仍须严格基于下方「参考资料」）：\n" + "\n\n".join(lines) + "\n\n"


def _retrieve_context(question: str, top_k: int = 3, history: list[dict] | None = None) -> tuple[list[dict], str]:
    """
    检索知识库并拼好给 LLM 的 prompt。
    返回:
        references: [{content, source, index}, ...]
        prompt:     发给大模型的完整提示词
    """
    q = question.strip()
    if not q:
        raise ValueError("问题不能为空")

    # 问题转向量
    query_vector = embed_text(q)

    # 检索相似片段
    hits = search_similar(query_vector, top_k = top_k)

    # 若知识库为空，返回无相关文档，后续可设计为调用联网工具
    if not hits:
        return [], ""

    # 拼接 Prompt
    references: list[dict] = []
    context_lines: list[str] = []

    for i, hit in enumerate(hits):
        content = hit["content"]
        source = hit["source"]
        index = hit["index"]
        # 引用编号从 1 开始，与前端 References 列表 [1][2] 对齐
        cite_num = i + 1

        references.append({
            "content": content,
            "source": source,
            "index": index,
        })
        # 给模型看的资料：编号 [1]、[2]… 方便在回答里写行内角标
        context_lines.append(f"[{cite_num}] 来源:{source} 第{index}段\n{content}")

    context_block = "\n\n".join(context_lines)
    history_block = _build_history_block(history or [])
    # 拼 Prompt：约束模型只用资料、用 Markdown 排版、写行内引用角标
    prompt = f"""你是一个知识库问答助手。请严格根据下面「参考资料」回答用户问题。

规则：
- 只使用参考资料中的信息，不要编造；
- 资料不足以回答时，明确说「根据现有资料无法确定」；
- 回答要详细，不要只回答一个关键词；
- 使用 Markdown 排版：可用 ## 小标题、- 列表、**加粗**、`代码`；
- 引用某条资料时，在句末标注角标 [1]、[2] 等，编号必须与「参考资料」里的编号一致；
- 不要输出 References 列表本身，角标写在正文里即可；
- 若存在对话历史，可结合历史理解当前问题的指代，但事实仍须来自参考资料。

{history_block}参考资料：
{context_block}

用户问题：{q}

请用中文回答。"""

    return references, prompt


def rag_query(question: str, top_k: int = 3, history: list[dict] | None = None) -> dict:
    """
    基于RAG回答(非流式)
    参数:
        question: 用户问题字符串
        top_k:    检索相似片段数量（默认3）
    返回:
        dict: {answer, references}
    """
    references, prompt = _retrieve_context(question, top_k, history)

    if not references:
        return {
            "answer": "知识库中没有相关文档，请提供更多信息或知识库更新。",
            "references": [],
        }
    
    # 大模型回答
    answer = chat_with_llm(prompt)
    
    return {
        "answer": answer,
        "references": references,
    }

def rag_query_stream(question: str, top_k: int = 3, history: list[dict] | None = None):
    """
    RAG 流式问答生成器。
    先 yield references，再 yield 一个个文本 chunk。
    每个 yield 是一个 dict:
        {"type": "references", "data": [...]}
        {"type": "message",   "data": "根据"}
    """
    references, prompt = _retrieve_context(question, top_k, history)

    # 先把引用片段推出去（检索结果，LLM还没开始）
    yield {"type": "references", "data": references}

    # 知识库为空，直接yield 固定文案，不再调LLM
    if not references:
        yield {"type": "message", "data": "知识库中没有相关文档，请提供更多信息或知识库更新。"}
        return

    # 流式调用大模型
    for chunk in stream_chat_with_llm(prompt):
        yield {"type": "message", "data": chunk}