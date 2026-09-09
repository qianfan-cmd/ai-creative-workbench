"""Wave D1.8 — 主体锚定 + 元数据 rerank 辅助。"""
import os

os.environ["QUERY_REWRITE_ENABLED"] = "0"
os.environ["RERANK_ENABLED"] = "0"

from app.services.retrieval.context_selector import select_context
from app.services.retrieval.query_rewriter import _filter_sub_queries
from app.services.retrieval.source_anchor import (
    filename_overlap_boost,
    pick_anchor_sources,
    rerank_text_for_hit,
    tokenize_for_match,
)


def test_tokenize_for_match_finds_png():
    tokens = tokenize_for_match("PNG 文件上传报错")
    assert "png" in tokens
    assert len(tokens) >= 2


def test_filename_overlap_boost():
    boost = filename_overlap_boost("PNG 上传报错", "PNG文件上传报错修复过程.md")
    assert boost > 0


def test_rerank_text_includes_metadata():
    text = rerank_text_for_hit({
        "source": "a.md",
        "heading": "修复",
        "chunk_summary": "步骤说明",
        "content": "正文",
    })
    assert "文档:a.md" in text
    assert "修复" in text
    assert "正文" in text


def test_pick_anchor_sources_prefers_png_doc():
    candidates = [
        {"id": "png-0", "source": "PNG文件上传报错修复过程.md", "rerank_score": 2.0},
        {"id": "png-1", "source": "PNG文件上传报错修复过程.md", "rerank_score": 1.8},
        {"id": "bug-0", "source": "通用bug排查流程.md", "rerank_score": 2.5},
    ]
    anchors = pick_anchor_sources(candidates, "PNG 上传报错原因和修复")
    assert anchors[0] == "PNG文件上传报错修复过程.md"


def test_select_context_anchor_fills_primary_source():
    candidates = [
        {"id": "png-0", "source": "PNG.md", "index": 0, "rerank_score": 3.0, "content": "原因"},
        {"id": "png-1", "source": "PNG.md", "index": 1, "rerank_score": 2.8, "content": "修复"},
        {"id": "bug-0", "source": "bug.md", "index": 0, "rerank_score": 4.0, "content": "流程"},
    ]
    selected = select_context(candidates, top_k=2, query="PNG 报错修复", anchor_mode=True)
    sources = {h["source"] for h in selected}
    assert sources == {"PNG.md"}


def test_filter_sub_queries_keeps_entity():
    subs = _filter_sub_queries("PNG 报错怎么修复", ["报错的修复步骤与代码改动"])
    assert any("png" in s.lower() for s in subs)
