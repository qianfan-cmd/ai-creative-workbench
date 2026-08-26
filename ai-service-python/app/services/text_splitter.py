"""
文本切分服务 — 把长文档切成 RAG 用的 chunk 列表。
为什么需要切分？
  - Embedding / 向量检索按「段」工作，不是整篇文档
  - 每段太长会稀释语义，太短会丢失上下文
切分策略（本步简单版）：
  - 按固定字符数滑动窗口
  - chunk_size：每段最大字符数
  - overlap：相邻两段重叠字符数，避免句子在边界被截断
{
  "filename": "Agent入门.md",
  "char_count": 6922,
  "chunk_count": 18,
  "chunks": [
    { "index": 0, "source": "Agent入门.md", "content": "..." },
    { "index": 1, "source": "Agent入门.md", "content": "..." }
  ]
}

*, 关键字参数：chunk_size 和 overlap 是关键字参数，必须用关键字参数传入
例如：split_text("abcdefgh", chunk_size=400, overlap=50)，不可以直接写 split_text("abcdefgh", 400, 50)
"""

def split_text(
    text: str,
    *,
    chunk_size: int = 400,
    overlap: int = 50,
) -> list[str]:
    """
    把长文本切成固定大小的 chunk 列表。
    参数:
        text: 要切分的文本
        chunk_size: 每段最大字符数，默认 400
        overlap: 相邻两段重叠字符数，默认 50
    返回:
        chunk 列表
    示例:
        text = "abcdefgh" * 100
        split_text(text, chunk_size=400, overlap=50)
        → ["前400字...", "重叠50字+新内容...", ...]
    """
    text = text.strip() # 去掉文本两端的空格或换行符或指定字符
    if not text:
        return []

    # 文本比 chunk_size 短，整段返回
    if len(text) <= chunk_size:
        return [text]
    
    chunks: list[str] = []
    start = 0 # 起始位置

    while start < len(text):
        # 当前窗口结束位置
        end = start + chunk_size
        piece = text[start:end] # 当前窗口内容
        chunks.append(piece) # 添加到结果列表
        start = end - overlap # 更新起始位置，留出 overlap 字符作为重叠

        # 防止最后一段重复无限循环（start 不再前进时退出）
        if start >= len(text):
            break
        if end >= len(text):
            break

    return chunks



    