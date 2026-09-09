"""Query 意图检测 — 列举型 / 流程修复型问题识别。"""
from __future__ import annotations

import re

LIST_INTENT_PATTERN = re.compile(
    r"哪些|所有|列举|几家|多少个|有没有|全部|都有|多少段|几处|列出|穷尽|分别",
    re.IGNORECASE,
)

PROCEDURE_INTENT_PATTERN = re.compile(
    r"怎么修复|如何修复|怎么解决|如何解决|修复步骤|修复过程|修复方案|"
    r"最后怎么|最终怎么|怎么改|如何改|fix|troubleshoot|"
    r"步骤|流程|操作|排查|处理办法|解决方法",
    re.IGNORECASE,
)


def is_list_intent(question: str) -> bool:
    return bool(LIST_INTENT_PATTERN.search(question.strip()))


def is_procedure_intent(question: str) -> bool:
    return bool(PROCEDURE_INTENT_PATTERN.search(question.strip()))
