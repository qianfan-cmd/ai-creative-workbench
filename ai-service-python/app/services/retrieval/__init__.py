"""Wave D1 — LangChain 混合检索（BM25 + Chroma 向量 + RRF）。"""

from app.services.retrieval.langchain_retriever import hybrid_search

__all__ = ["hybrid_search"]
