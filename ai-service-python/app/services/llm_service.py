"""
大模型调用服务（≈ Java 的 ChatService / XxxServiceImpl）

职责：把「用户一句话」发给 DeepSeek API，拿回模型回复文本。
本层不关心 HTTP 路由，只关心「怎么调外部 AI 接口」。

被谁调用：app/routers/chat.py 里的 chat() 函数。
"""

# os：Python 标准库，os.getenv("KEY") 读环境变量（来自 .env 或系统）
import os

# httpx：第三方 HTTP 客户端，用来 POST 请求 DeepSeek（≈ Java RestTemplate / WebClient）
import httpx
import json


def chat_with_llm(message: str) -> str:
    """
    调用 DeepSeek Chat Completions API，返回 assistant 的文本内容。

    参数:
        message: 用户输入的问题（纯文本）

    返回:
        str: 模型回复的正文（choices[0].message.content）

    异常:
        ValueError: .env 未配置 KEY，或模型返回空 content
        httpx.HTTPStatusError: DeepSeek 返回 4xx/5xx（由调用方捕获转 HTTPException）
    """
    # 从环境变量读取配置（.env 里 MODEL_API_KEY=sk-xxx）
    api_key = os.getenv("MODEL_API_KEY")
    # rstrip("/") 去掉末尾斜杠，避免拼 URL 时出现 //chat
    base_url = os.getenv("MODEL_BASE_URL", "https://api.deepseek.com").rstrip("/")
    model = os.getenv("MODEL_NAME", "deepseek-v4-flash")

    if not api_key:
        # raise 主动抛出异常，上层 router 会 catch 并返回 500 给客户端
        raise ValueError("MODEL_API_KEY 未配置，请检查 .env")

    # DeepSeek 文档：POST {base_url}/chat/completions
    url = f"{base_url}/chat/completions"  # f-string：字符串里嵌入变量

    # 请求体 JSON，格式与 OpenAI 兼容（DeepSeek 官方文档相同）
    payload = {
        "model": model,
        # messages 是对话列表；这里只做单轮，一条 user 消息
        "messages": [
            {"role": "user", "content": message},
        ],
        # DeepSeek V4 默认开启「思考模式」；disabled 时响应更快、更省 token
        "thinking": {"type": "disabled"},
    }

    headers = {
        # Bearer Token：行业通用的 API Key 鉴权方式
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    # with 语句：用完自动关闭连接（类似 Java try-with-resources）
    # timeout=60.0：最多等 60 秒，防止模型卡住一直不返回
    with httpx.Client(timeout=60.0) as client:
        resp = client.post(url, json=payload, headers=headers)
        # 若状态码是 4xx/5xx，这里会抛 httpx.HTTPStatusError
        resp.raise_for_status()
        # resp.json() 把响应体解析成 Python dict（≈ JSON.parse）
        data = resp.json()

    # DeepSeek 响应结构：data["choices"][0]["message"]["content"] 是最终回答
    # 思考模式下还有 reasoning_content（思维链），本接口只取 content 给用户看
    content = data["choices"][0]["message"]["content"]
    if not content:
        raise ValueError("模型返回内容为空")

    return content

def stream_chat_with_llm(message: str):
    """
    流式调用 DeepSeek Chat Completions。
    这是一个生成器（generator）：用 yield 一块块返回文本，而不是 return 整段。
    用法:
        for chunk in stream_chat_with_llm("你好"):
            print(chunk, end="", flush=True)
    """
    api_key = os.getenv("MODEL_API_KEY")
    base_url = os.getenv("MODEL_BASE_URL", "https://api.deepseek.com").rstrip("/")
    model = os.getenv("MODEL_NAME", "deepseek-v4-flash")

    if not api_key:
        raise ValueError("MODEL_API_KEY 未配置，请检查 .env")

    url = f"{base_url}/chat/completions"
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": message}],
        "thinking": {"type": "disabled"},
        "stream": True, # 开启流式响应，响应不再是单个JSON，而是多行 data: JSON 串
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    # client.stream: httpx 的流式请求方法，返回 AsyncGenerator[bytes, None],在with块内可以iter_lines()逐行读
    with httpx.Client(timeout=120.0) as client:
        with client.stream("POST", url, json=payload, headers=headers) as resp:
            resp.raise_for_status()
            # DeepSeek 流式格式（OpenAI 兼容）：
            #   data: {"choices":[{"delta":{"content":"你"}}]}
            #   data: {"choices":[{"delta":{"content":"好"}}]}
            #   data: [DONE]
            for line in resp.iter_lines():
                if not line or not line.startswith("data:"):
                    continue

                data = line[5:].strip()
                if data == "[DONE]":
                    break

                obj = json.loads(data)
                delta = obj["choices"][0]["delta"].get("content")
                if delta:
                    yield delta
