"""入库 embedding 文本构建 — 与 rerank 元数据格式对齐。"""
from __future__ import annotations


def build_embed_text(
    *,
    filename: str,
    content: str,
    heading: str = "",
    chunk_summary: str = "",
) -> str:
    prefix = f"文档:{filename}"
    if heading:
        prefix += f" 小节:{heading}"
    if chunk_summary:
        prefix += f" 摘要:{chunk_summary}"
    return f"{prefix}\n{content}"
