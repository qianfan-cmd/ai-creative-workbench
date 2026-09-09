"""语义切片 ops 模式单元测试。"""
import json
from unittest.mock import patch

import pytest

from app.services.semantic_chunker import (
    SemanticChunk,
    _apply_chunk_ops,
    _format_numbered_blocks,
    _llm_refine_chunks,
    _structured_to_semantic,
    _validate_chunk_ops,
    semantic_chunk_document,
)
from app.services.text_splitter import StructuredChunk


def _blocks(*contents: str) -> list[StructuredChunk]:
    return [StructuredChunk(content=c, section="body") for c in contents]


def test_validate_chunk_ops_requires_full_coverage():
    ops = [
        {"op": "keep", "indices": [0], "section_hint": "general", "summary": "a"},
        {"op": "merge", "indices": [1, 2], "section_hint": "general", "summary": "b"},
    ]
    _validate_chunk_ops(ops, 3)


def test_validate_chunk_ops_rejects_missing_index():
    ops = [{"op": "keep", "indices": [0], "section_hint": "general", "summary": "a"}]
    with pytest.raises(ValueError, match="missing indices"):
        _validate_chunk_ops(ops, 2)


def test_validate_chunk_ops_rejects_non_contiguous_merge():
    ops = [{"op": "merge", "indices": [0, 2], "section_hint": "general", "summary": "a"}]
    with pytest.raises(ValueError, match="contiguous"):
        _validate_chunk_ops(ops, 3)


def test_apply_chunk_ops_merge_and_keep():
    structured = _blocks("段落A", "段落B", "段落C")
    ops = [
        {"op": "keep", "indices": [0], "section_hint": "technical", "summary": "首段"},
        {"op": "merge", "indices": [1, 2], "section_hint": "general", "summary": "合并"},
    ]
    chunks = _apply_chunk_ops(structured, ops)
    assert len(chunks) == 2
    assert chunks[0].content == "段落A"
    assert chunks[0].section == "technical"
    assert chunks[1].content == "段落B\n\n段落C"
    assert chunks[1].chunk_summary == "合并"


def test_format_numbered_blocks_truncates_long_content():
    structured = [StructuredChunk(content="x" * 1000, section="body", heading="H1")]
    text = _format_numbered_blocks(structured)
    assert text.startswith("[0] section=body heading=H1")
    assert "…" in text


def test_llm_refine_chunks_applies_ops_from_mock():
    structured = _blocks("A", "B")
    ops_json = json.dumps(
        [
            {"op": "merge", "indices": [0, 1], "section_hint": "general", "summary": "ab"},
        ]
    )
    with patch("app.services.semantic_chunker.chat_with_llm", return_value=ops_json):
        chunks = _llm_refine_chunks("test.md", structured)
    assert len(chunks) == 1
    assert "A" in chunks[0].content and "B" in chunks[0].content


def test_llm_refine_chunks_fallback_on_empty_response():
    structured = _blocks("A", "B")
    with patch("app.services.semantic_chunker.chat_with_llm", return_value="   "):
        chunks = _llm_refine_chunks("test.md", structured)
    assert len(chunks) == 2
    assert chunks[0].content == "A"


def test_llm_refine_chunks_fallback_on_invalid_ops():
    structured = _blocks("A", "B", "C")
    bad_ops = json.dumps([{"op": "keep", "indices": [0], "section_hint": "general", "summary": ""}])
    with patch("app.services.semantic_chunker.chat_with_llm", return_value=bad_ops):
        chunks = _llm_refine_chunks("test.md", structured)
    assert len(chunks) == 3


def test_semantic_chunk_document_disabled_skips_llm():
    text = "短文档内容 " * 30
    with patch("app.services.semantic_chunker.SEMANTIC_CHUNK_ENABLED", False):
        with patch("app.services.semantic_chunker.chat_with_llm") as mock_llm:
            chunks = semantic_chunk_document(text, filename="t.md")
    mock_llm.assert_not_called()
    assert len(chunks) >= 1


def test_structured_to_semantic_passthrough():
    structured = _blocks("hello")
    out = _structured_to_semantic(structured)
    assert len(out) == 1
    assert out[0].content == "hello"
