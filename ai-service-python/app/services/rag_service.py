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
from app.services.llm_service import chat_with_llm

def rag_query(question: str, top_k: int = 3) -> dict:
    """
    RAG 问答服务。
    参数:
        question: 用户问题
        top_k: 返回几条，默认 3
    返回:
        dict，含 answer 和 references
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
        return {
            "answer": "知识库中没有相关文档，请提供更多信息或知识库更新。",
            "references": [],
        }

    # 拼接 Prompt
    references: list[dict] = []
    context_lines: list[str] = []

    for i, hit in enumerate(hits):
        content = hit["content"]
        source = hit["source"]
        index = hit["index"]

        references.append({
            "content": content,
            "source": source,
            "index": index,
        })
        # 给模型看的资料，带编号方便引用
        context_lines.append(f"[{i}] 来源:{source} 第{index}段\n{content}")

    context_block = "\n\n".join(context_lines)
    # ④ 拼 Prompt：要求模型只根据资料回答，不要编造
    prompt = f"""你是一个知识库问答助手。请严格根据下面「参考资料」回答用户问题。
             规则：
             - 只使用参考资料中的信息；
             - 资料不足以回答时，明确说「根据现有资料无法确定」；
             - 不要编造参考资料中没有的内容。
             - 回答要详细，不要只回答一个关键词。

             参考资料：
             {context_block}

             用户问题：{q}

             请用中文简洁回答。"""
    
    # 大模型回答
    answer = chat_with_llm(prompt)
    
    return {
        "answer": answer,
        "references": references,
    }

