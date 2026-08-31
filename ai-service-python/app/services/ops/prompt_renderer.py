"""
Prompt 模板渲染 — 将 {{variable}} 替换为实际值。
Phase 1 Campaign 文案、Phase 2 抠图/生图 prompt 都会复用。
带占位符的字符串，例如 "写一篇关于{{theme}}的帖子"
"""

import re
from typing import Dict, List

# 匹配 {{theme}}、{{ copy }} 这类占位符（允许变量名两侧有空格）
_PLACEHOLDER_PATTERN = re.compile(r"\{\{\s*(\w+)\s*\}\}")

def render_prompt(template: str, variables: Dict[str, str]) -> tuple[str, List[str]]:
    """
    渲染模板，返回 (最终 prompt, 未提供的变量名列表)。
    variables 里缺失的 key（占位符） 不会报错，占位符保留原样并记入 missing，
    方便 Java 侧日志排查。
    示例：render_prompt("主题是{{theme}}，风格{{tone}}", {"theme": "春招"})
# → ("主题是春招，风格{{tone}}", ["tone"])
    """
    missing: List[str] = []

    def replace(match: re.Match[str]) -> str:
        key = match.group(1) # 取第一个捕获组，即 {{theme}} 中的 theme
        if key not in variables:
            missing.append(key)
            return match.group(0) # 保留占位符原样，{{theme}} 保持原样
        value = variables[key]
        return "" if value is None else str(value)

    # re.sub(模式, 替换函数, 字符串) 在template中找到所有占位符，调用replace函数替换
    rendered = _PLACEHOLDER_PATTERN.sub(replace, template)

    # 去重并保持顺序
    unique_missing = list(dict.fromkeys(missing))
    return rendered, unique_missing # 返回最终渲染的prompt和未提供的变量名列表