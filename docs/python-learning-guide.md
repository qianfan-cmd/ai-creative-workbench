# Python / FastAPI 学习约定（ai-service-python）

> **给 AI 导师的硬性要求**：用户对 Python 使用较少，后续所有 `ai-service-python` 相关代码必须按**初学者**标准输出——**详细中文注释 + 库/语法作用说明**，禁止只甩代码块。

---

## 1. 用户背景

| 维度 | 说明 |
|------|------|
| 前端 | 有 React/TypeScript 工程经验 |
| Java | 已学 Spring Boot，理解 Controller / Service 分层 |
| **Python** | **使用较少**，不熟悉标准库、第三方库、Python 特有语法 |
| 学习诉求 | 看懂每一行在干什么，知道「为什么用这个库」 |

类比帮助用户理解：

| Python 概念 | 前端/Java 对照 |
|-------------|----------------|
| `FastAPI` | 类似 Spring Boot Web 层 |
| `@router.post(...)` | 类似 `@PostMapping` |
| `Pydantic BaseModel` | 类似 Java DTO + `@Valid` 校验 |
| `httpx` | 类似 Java `RestTemplate` / `WebClient` |
| `uvicorn` | 类似内嵌 Tomcat，跑 ASGI 应用 |
| `.env` + `load_dotenv()` | 类似 `application-local.yml` 读配置 |
| `import os; os.getenv()` | 类似 `@Value` 读环境变量 |

---

## 2. AI 导师输出 Python 代码时必须包含

### 2.1 文件头注释

每个 `.py` 文件顶部用 3～5 行说明：

- 这个文件在整个服务里扮演什么角色
- 被谁 import、会调用谁

### 2.2 逐段 / 逐行注释（初学者级别）

- **每个 `import`**：这个库是干什么的、在本文件里用来做什么
- **每个函数**：入参、返回值、调用链
- **Python 特有语法**：`with`、`f"..."`、`-> str`、装饰器 `@...`、`try/except` 等，第一次出现要解释
- **HTTP / AI 相关**：URL 怎么拼、Header 含义、JSON 字段对应 DeepSeek 文档哪一节

### 2.3 单文件讲解五要素（与 Java 教学一致）

1. **这个文件解决什么问题**
2. **在架构哪一层**（router / service / schema）
3. **和 Java 后端怎么类比**
4. **关键代码逐段说明**
5. **怎么验证**（启动命令、Apifox 用例）

### 2.4 禁止

- ❌ 一次性贴 5 个 Python 文件且不逐文件讲解
- ❌ 假设用户熟悉 `pip`、`venv`、装饰器、类型注解
- ❌ 用「标准写法」省略解释
- ❌ 引入 LangChain 等重型框架时不说明「为什么需要、替代方案是什么」

---

## 3. ai-service-python 目录说明（当前 W10）

```text
ai-service-python/
├── app/
│   ├── main.py              # 入口：创建 FastAPI 应用、挂载路由、加载 .env
│   ├── routers/chat.py      # HTTP 接口层（≈ Java Controller）
│   ├── services/llm_service.py  # 业务逻辑：调 DeepSeek API（≈ Java Service）
│   └── schemas/chat.py      # 请求/响应数据结构（≈ Java DTO/VO）
├── .env                     # 本地密钥（不提交 Git）
├── .env.example             # 配置模板（可提交）
├── requirements.txt         # Python 依赖清单（≈ pom.xml）
└── .venv/                   # 虚拟环境（不提交 Git）
```

**请求链路（W10-2 当前）：**

```text
Apifox / 浏览器
  → POST /ai/chat
  → routers/chat.py（校验 JSON、捕获异常）
  → services/llm_service.py（httpx 调 DeepSeek）
  → 返回 JSON { reply, model }
```

**下一步 W10-3：** Java `ChatService` 也会 HTTP 调用这里的 `/ai/chat`。

---

## 4. 常用库速查（本项目）

| 库 | 作用 | 何时接触 |
|----|------|----------|
| `fastapi` | Web 框架，定义路由、自动 OpenAPI 文档 | W10-1 |
| `uvicorn` | ASGI 服务器，启动 FastAPI | W10-1 |
| `python-dotenv` | 从 `.env` 文件加载环境变量 | W10-2 |
| `httpx` | 发 HTTP 请求（调 DeepSeek） | W10-2 |
| `pydantic` | 数据校验与序列化（FastAPI 内置依赖） | W10-2 |

---

## 5. 本地启动（Git Bash vs PowerShell）

**Git Bash：**

```bash
cd /e/ai-creative-workbench/ai-service-python
source .venv/Scripts/activate    # 激活虚拟环境，提示符前出现 (.venv)
uvicorn app.main:app --reload --port 8000
```

**PowerShell：**

```powershell
cd E:\ai-creative-workbench\ai-service-python
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

> ⚠️ 不要在 Git Bash 里运行 `Activate.ps1`（那是 PowerShell 脚本）。

---

## 6. DeepSeek 配置（.env）

```env
MODEL_API_KEY=sk-你的key
MODEL_BASE_URL=https://api.deepseek.com
MODEL_NAME=deepseek-v4-flash
```

官方文档：https://api-docs.deepseek.com/zh-cn/

---

## 7. 验收清单

- [ ] `/health` 返回 ok
- [ ] `/docs` 能打开 Swagger
- [ ] `POST /ai/chat` 返回 DeepSeek 真实回复
- [ ] 读代码能说出：router → service → 外部 API 的调用顺序

---

*本文档随 W10～W11 Python 学习更新。*
