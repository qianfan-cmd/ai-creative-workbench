"""
文本切分服务 — 固定窗口 + Wave D1.5b 结构化切分。
"""
from __future__ import annotations

import re
from dataclasses import dataclass

SECTION_HEADING_RE = re.compile(
    r"^(#{1,3}\s+.+|"
    r".*(?:工作经历|实习经历|项目经历|教育经历|教育背景|个人信息|专业技能|自我评价|"
    r"离职证明|实习单位|工作单位|任职单位|工作经[历验]).*)$",
    re.MULTILINE,
)

SECTION_TYPE_MAP = {
    "实习": "internship",
    "工作经历": "experience",
    "工作经": "experience",
    "离职证明": "certificate",
    "实习单位": "employment",
    "工作单位": "employment",
    "任职单位": "employment",
    "项目": "project",
    "教育": "education",
    "个人信息": "profile",
    "技能": "skills",
}


@dataclass
class StructuredChunk:
    content: str
    section: str = "body"
    heading: str = ""


def _detect_section_type(heading_line: str) -> str:
    for key, value in SECTION_TYPE_MAP.items():
        if key in heading_line:
            return value
    if heading_line.strip().startswith("#"):
        return "heading"
    return "body"


def split_text(
    text: str,
    *,
    chunk_size: int = 400,
    overlap: int = 50,
) -> list[str]:
    text = text.strip()
    if not text:
        return []
    if len(text) <= chunk_size:
        return [text]

    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start = end - overlap
        if start >= len(text):
            break
        if end >= len(text):
            break
    return chunks


def split_text_structured(
    text: str,
    *,
    chunk_size: int = 400,
    overlap: int = 50,
) -> list[StructuredChunk]:
    """
    优先按空行 / 标题切段，超长块再 fallback 固定窗口。
    """
    text = text.strip()
    if not text:
        return []

    blocks = re.split(r"\n\s*\n+", text)
    current_section = "body"
    current_heading = ""
    out: list[StructuredChunk] = []

    for block in blocks:
        block = block.strip()
        if not block:
            continue

        first_line = block.split("\n", 1)[0].strip()
        if SECTION_HEADING_RE.match(first_line):
            current_heading = first_line[:120]
            current_section = _detect_section_type(first_line)

        if len(block) <= chunk_size:
            out.append(
                StructuredChunk(
                    content=block,
                    section=current_section,
                    heading=current_heading,
                )
            )
        else:
            for piece in split_text(block, chunk_size=chunk_size, overlap=overlap):
                out.append(
                    StructuredChunk(
                        content=piece,
                        section=current_section,
                        heading=current_heading,
                    )
                )
    return out
