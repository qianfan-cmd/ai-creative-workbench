"""Wave D1.5 单元测试。"""
import os
from unittest.mock import patch

os.environ["QUERY_REWRITE_ENABLED"] = "0"
os.environ["RERANK_ENABLED"] = "0"

from app.services.retrieval.context_selector import expand_adjacent_chunks, select_context
from app.services.retrieval.query_intent import is_list_intent, is_procedure_intent
from app.services.text_splitter import split_text_structured


def test_list_intent_detects_enumeration():
    assert is_list_intent("部署方式有哪些？请列举全部")
    assert not is_list_intent("什么是 RAG？")


def test_procedure_intent_detects_fix_questions():
    assert is_procedure_intent("PNG 上传报错最后怎么修复的？")
    assert is_procedure_intent("部署流程有哪些步骤？")
    assert not is_procedure_intent("什么是 RAG？")


def test_rewrite_query_fallback_empty_sub_queries():
    from app.services.retrieval import query_rewriter

    with patch.object(query_rewriter, "QUERY_REWRITE_ENABLED", True):
        with patch.object(query_rewriter, "chat_with_llm", side_effect=RuntimeError("llm down")):
            result = query_rewriter.rewrite_query("部署流程有哪些步骤？")
    assert result == {"main_rewrite": "部署流程有哪些步骤？", "sub_queries": []}


def test_structured_split_keeps_sections():
    text = "个人信息\n张三\n\n实习经历\n公司A 2023\n\n实习经历\n公司B 2024"
    chunks = split_text_structured(text, chunk_size=400, overlap=50)
    assert len(chunks) >= 2
    sections = {c.section for c in chunks}
    assert "internship" in sections or "body" in sections


def test_select_context_allows_multiple_per_source_for_list():
    candidates = [
        {"id": "a-0", "source": "resume.pdf", "index": 0, "content": "公司A"},
        {"id": "a-1", "source": "resume.pdf", "index": 2, "content": "公司B"},
        {"id": "b-0", "source": "other.md", "index": 0, "content": "x"},
    ]
    selected = select_context(candidates, top_k=3, list_intent=True)
    resume_count = sum(1 for h in selected if h["source"] == "resume.pdf")
    assert resume_count >= 2


def test_select_context_requires_exhaustive_from_llm():
    candidates = [
        {"id": "a-0", "source": "resume.pdf", "index": 0, "content": "公司A"},
        {"id": "a-1", "source": "resume.pdf", "index": 2, "content": "公司B"},
    ]
    selected = select_context(candidates, top_k=2, requires_exhaustive=True)
    assert len(selected) == 2


def test_select_context_procedure_allows_adjacent_chunks():
    candidates = [
        {"id": "fix-0", "source": "png.md", "index": 0, "content": "根因"},
        {"id": "fix-1", "source": "png.md", "index": 1, "content": "修复步骤"},
        {"id": "fix-2", "source": "png.md", "index": 2, "content": "代码改动"},
        {"id": "other-0", "source": "other.md", "index": 0, "content": "x"},
    ]
    selected = select_context(candidates, top_k=4, procedure_intent=True)
    png_indices = sorted(int(h["index"]) for h in selected if h["source"] == "png.md")
    assert png_indices == [0, 1, 2]


def test_expand_adjacent_chunks_fills_neighbors():
    pool = [
        {"id": "doc-3", "source": "doc.md", "index": 3, "content": "修复"},
        {"id": "doc-4", "source": "doc.md", "index": 4, "content": "代码"},
        {"id": "doc-5", "source": "doc.md", "index": 5, "content": "验证"},
    ]
    selected = [{"id": "doc-4", "source": "doc.md", "index": 4, "content": "代码"}]
    expanded = expand_adjacent_chunks(selected, pool, max_total=3)
    ids = {h["id"] for h in expanded}
    assert ids == {"doc-3", "doc-4", "doc-5"}


def test_semantic_merge_short_chunks():
    from app.services.semantic_chunker import SemanticChunk, _merge_short_chunks

    chunks = [
        SemanticChunk(content="短", section="body"),
        SemanticChunk(content="也是短段落", section="body"),
    ]
    merged = _merge_short_chunks(chunks)
    assert len(merged) == 1
    assert "短" in merged[0].content
