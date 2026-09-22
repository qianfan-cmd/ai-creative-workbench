# AI应用开发 / Agent开发岗位技能清单（对照真实JD，校招/后端转AI应用方向）
> 区分两个岗位侧重点：
> - **AI应用开发**：把大模型封装进业务系统，做LLM调用、RAG、Prompt工程、接口服务，偏后端工程落地
> - **Agent开发**：在AI应用基础上，增加工具调用、规划、记忆、多智能体协作，偏向智能体编排、状态管理

## 一、编程语言 & 基础工程能力（必备）
1. **Python（核心主力）**
    - 基础语法、面向对象、异步`async/await`（LLM调用大量异步IO）
    - 包管理：pip、poetry、uv；熟悉pydantic做数据校验
    - 并发：多线程、异步任务处理（大模型API调用是IO密集）
2. **Java / TypeScript（加分，看团队栈）**
    - 如果你是Java后端背景：很多公司用Java封装LLM服务、做Agent后端网关，Java写业务服务，Python做模型编排
3. 基础工具：Git、Linux、Docker（容器打包部署AI服务）、API调试（Postman）

## 二、大模型基础（面试必问）
1. LLM基础：Transformer简单原理、Token、上下文窗口、温度temperature、top_p、流式输出（stream）
2. 调用能力：OpenAI / 通义千问 / 文心一言 / DeepSeek 等模型API调用；**函数调用（Function Call）**
3. Prompt工程：Few-shot、思维链CoT、角色设定、Prompt优化、Prompt防注入

## 三、RAG 检索增强生成（AI应用开发最高频考点）
几乎所有AI应用JD都会写RAG
1. 向量数据库：Chroma、FAISS、Milvus、Qdrant（知道优缺点，会做简单Demo）
2. 文本处理：文档加载（PDF/Word/markdown）、文本分割（chunk策略，重叠窗口）、文本清洗
3. Embedding（嵌入模型）：BGE、text-embedding，向量相似度计算
4. RAG全链路：文档入库 → 向量化存入向量库 → 用户query向量化 → 检索topK片段 → 拼接进Prompt交给大模型
5. RAG优化：重排Reranker、混合检索（关键词+向量）、检索召回评估、幻觉问题处理

## 四、Agent 智能体核心技能（Agent岗位重点）
> Agent = LLM + 记忆 + 规划 + 工具调用
1. 工具调用（Function calling）：让大模型调用自定义函数、API、数据库查询
2. 记忆模块：短期上下文记忆、长期向量记忆、会话管理
3. 规划能力：ReAct、Plan-and-Solve、Self-Ask 等Agent经典框架思想
4. Agent框架：
    - 轻量：LangChain、LlamaIndex（做Demo、原型，面试高频）
    - 企业级：Dify、Flowise、AutoGen（多智能体）
> ⚠️面试注意：不要只会套LangChain API，要懂底层原理，面试官很爱问LangChain的弊端
5. MCP（Model Context Protocol）：模型上下文协议，标准化工具调用（你之前问过这个！很多新JD开始出现）

## 五、后端 & 服务化能力（AI应用开发和普通后端分水岭）
把LLM能力封装成线上可用服务
1. Web框架：FastAPI（Python首选）/ Flask；Java：SpringBoot
    - 写接口、流式SSE返回（前端打字机效果）、请求限流、超时控制
2. 缓存：Redis。缓存Embedding、用户会话、模型结果，减少LLM调用成本
3. 消息队列：RabbitMQ/RocketMQ，异步处理文档解析、长任务（文档向量化耗时很长）
4. 数据库：MySQL，存储会话、用户、业务元数据
5. 可观测：日志、链路追踪；模型调用耗时、token消耗统计、错误捕获

## 六、部署、运维与性能优化（加分项）
1. Docker打包AI应用，简单K8s基础（了解即可，校招不要求精通）
2. 性能优化：
    - 减少token消耗、chunk调优、缓存热点检索结果
    - 模型推理加速（如果涉及私有化部署：vLLM、TensorRT-LLM，校招了解概念就行）
3. 安全：Prompt注入防护、输入输出内容审核

## 七、项目方向（简历能写的，对应岗位JD）
### AI应用开发简历项目
- 基于RAG的企业知识库问答系统：文档解析、向量库、FastAPI后端、SSE流式输出、Redis会话缓存

### Agent简历项目
- 个人智能助手Agent：支持联网/数据库查询等工具调用，ReAct思考流程，会话记忆；可以用LangChain或手写简易Agent（**手写简易Agent比直接套LangChain更加分**）

## 八、算法&基础（校招面试）
1. 基础算法：链表、哈希、二叉树，力扣简单~中等
2. NLP基础（浅）：词向量、相似度，不用深度学习底层
> 注意：**AI应用/Agent开发 ≠ 算法岗，不需要训练大模型，重点是工程落地**

## 九、岗位区分总结（一句话）
- AI应用开发：**RAG + LLM API + 后端服务**，做知识库、AI对话业务系统
- Agent开发：在AI应用之上，**增加工具调用、思考规划、记忆、多智能体**，能自主完成复杂任务

## 十、学习顺序（推荐，适合你，Java后端底子）
1. Python + FastAPI 快速上手
2. LLM API调用 + Prompt工程 + SSE流式输出
3. RAG全套：文档切片、Embedding、向量库、Reranker，做知识库项目
4. Agent原理 + Function Call，手写简易Agent（不要直接LangChain一把梭）
5. Redis、MQ，把项目改成生产可用的服务
6. Docker部署；了解MCP、AutoGen等新框架
