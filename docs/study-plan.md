# 全栈学习路线

可以，你这个判断我认可：**如果你只做传统 CRUD 项目，差异化确实不够。**

但我也要帮你把路线摆正：



> 你不是要变成“传统 Java 后端”，也不是要硬冲“算法工程师”，而是要成为：
>
> **懂前端复杂交互 \+ 懂 Java 工程闭环 \+ 懂 Python AI 服务/RAG/工作流的大模型应用工程型候选人。**
>
>



这才是差异化。



结合前面搜索结果里的信息：



- CSDN 有 AI 产品转型案例提到，边工作边学、每天 2 小时、约 3 个月可以入门 AI 产品经理，但重点是“概念 \+ 工作流 \+ 项目实战”。来源：CSDN《3个月从产品小白到AI产品经理》。

- 学业无忧网提到，人工智能自学时间因基础不同差异很大，零基础入门通常约半年；有编程经验者深入机器学习、深度学习等主题可压缩到 3 到 4 个月左右，但持续实践很重要。来源：学业无忧网《自学人工智能大概需要多久》。

- 掘金文章提到，2026 年很多岗位已经开始把 AI 使用能力、AI 项目能力纳入考核，AI 编程和 AI 项目逐渐从加分项变成门槛。来源：掘金《2026年，简历上没有AI项目已经很难拿到面试了》。

- 36氪文章强调，用 AI 的关键不是会多少提示词或多少模型，而是有没有把工作流建起来。来源：36氪《你用AI搭建的不该是大系统，而是这5个小流程》。

- 网易 / 腾讯新闻相关文章也提醒，不要追逐每一个新工具，要把少数工具真正嵌入自己的工作流，避免一直停留在新手期。来源：网易、腾讯《别急着做新工具的“小白鼠”》。



所以我们现在做 **16 周完整版**，不砍 Python / RAG / AI 工作流，但会把它们放在合理顺序里：



> **先用 Java 建工程底座，再用 Python 做 AI 能力层，最后用前端把 AI 体验做出来。**
>
>



---



# 一、16 周总目标



## 最终你要交付的不是一个普通项目，而是这个：



# AI 创意资产与知识工作台

英文名：**AI Creative Asset \& Knowledge Workbench**



项目定位：



> 面向游戏、美术、运营、内容团队的 AI 素材管理、知识问答、文案生成和工作流辅助平台。
>
>



它要体现你和普通开发的区别：



|能力|体现方式|
|---|---|
|前端能力|AI 对话、SSE 流式输出、虚拟列表、Canvas 素材预览/标注|
|Java 工程能力|用户、素材、标签、会话、权限、文件上传、接口分层|
|Python AI 能力|FastAPI、RAG、文档解析、Embedding、向量检索|
|AI 应用能力|Prompt 模板、知识库问答、素材分析、工作流|
|工程化能力|Docker、接口文档、README、部署说明|
|面试表达能力|能讲业务场景、架构设计、难点、优化、取舍|



---



# 二、学习时间假设



你说周末可以加到 8 小时，那么我们按下面节奏设计。



## 每周时间



|时间|学习量|
|---|---|
|周一到周五|每天 2 小时，共 10 小时|
|周六|8 小时|
|周日|8 小时|
|每周合计|约 26 小时|
|16 周总计|约 416 小时|



416 小时足够你做出一个有竞争力的 AI 应用项目。



但注意：



> 这 416 小时的目标是“求职可用 \+ 项目能讲 \+ 技术链路打通”，不是成为算法专家，也不是精通 Spring 源码。
>
>



---



# 三、最终技术栈



## 前端



本项目统一采用 React 技术栈。



```Plain Text
React 19 + TypeScript + Vite + Zustand + React Router + Ant Design
```



前端核心能力：



- 登录注册；

- 素材上传；

- 图片预览；

- Canvas 标注；

- AI 对话；

- SSE 流式输出；

- Markdown 渲染；

- 虚拟列表；

- 历史会话；

- 知识库问答页面。



---



## Java 后端



```Plain Text
Java 17
Spring Boot 3.x
Maven
MyBatis-Plus
MySQL 8
JWT
Lombok
Validation
Knife4j / Swagger 可选
```



Java 后端负责：



- 用户系统；

- 登录鉴权；

- 素材管理；

- 标签管理；

- 会话管理；

- 文件上传；

- 调用 Python AI 服务；

- 对外统一接口。



---



## Python AI 服务



```Plain Text
Python 3.11 / 3.12
FastAPI
Uvicorn
Pydantic
requests / httpx
LangChain 可选
Chroma / FAISS
Embedding API
大模型 API
```



Python 服务负责：



- 文档解析；

- 文本切分；

- Embedding；

- 向量存储；

- RAG 检索问答；

- Prompt 模板；

- AI 工作流接口。



---



## 工程化



```Plain Text
Git
GitHub / Gitee
Apifox
Docker
Docker Compose
DBeaver
VS Code
IntelliJ IDEA
```



---



# 四、学习前准备



## 4\.1 必装软件



### 基础开发工具



|软件|用途|
|---|---|
|Git|代码版本管理|
|VS Code|前端、Python、Markdown|
|IntelliJ IDEA|Java / Spring Boot|
|Apifox|接口调试|
|DBeaver|数据库管理|
|Typora / Obsidian / 飞书文档|学习笔记|
|Chrome|前端调试|



---



### 前端环境



|软件|建议版本|
|---|---|
|Node\.js|LTS，20 或 22|
|pnpm|最新稳定版|



检查命令：



```Bash
node -v
npm -v
pnpm -v
```



安装 pnpm：



```Bash
npm install -g pnpm
```



---



### Java 环境



|软件|建议|
|---|---|
|JDK|17|
|Maven|3\.8\+ / 3\.9\+|
|Spring Boot|3\.x|



检查：



```Bash
java -version
mvn -v
```



---



### 数据库



|软件|建议|
|---|---|
|MySQL|8\.0|
|DBeaver|免费数据库客户端|
|Redis|后面可选，不作为主线|



检查：



```Bash
mysql --version
```



---



### Python 环境



|软件|建议|
|---|---|
|Python|3\.11 或 3\.12|
|pip|默认即可|
|venv|Python 自带虚拟环境|



检查：



```Bash
python --version
pip --version
```



---



### AI 平台账号



至少准备一个大模型 API Key。



可选：



- 通义千问；

- 智谱 GLM；

- DeepSeek；

- Moonshot；

- 百度千帆；

- OpenAI，如果可用。



提醒：模型平台的价格、限额、接口格式会变化，实际以官方文档为准。



---



# 五、项目目录结构



最终项目建议这样放：



```Plain Text
ai-creative-workbench
├── frontend                 # React 前端
├── backend-java             # Spring Boot 业务后端
├── ai-service-python        # FastAPI AI 服务
├── docs                     # 文档
│   ├── architecture.md
│   ├── api.md
│   ├── deploy.md
│   ├── interview.md
│   └── weekly-review.md
├── docker-compose.yml
└── README.md
```



---



# 六、16 周总览



|周数|主题|核心产出|
|---|---|---|
|第 0 周|环境安装与学习系统搭建|工具装好、仓库建好|
|第 1 周|Java 基础语法|能看懂基础 Java|
|第 2 周|面向对象、集合、异常、Maven|能写小型 Java 程序|
|第 3 周|Spring Boot 目录结构与接口|能理解请求流程|
|第 4 周|MySQL \+ MyBatis\-Plus|能写 CRUD|
|第 5 周|Java 小项目：文章管理系统|后端基础闭环|
|第 6 周|正式项目 Java 后端：用户与鉴权|注册、登录、JWT|
|第 7 周|正式项目 Java 后端：素材、标签、文件|素材管理闭环|
|第 8 周|前端项目骨架与联调|登录、素材页|
|第 9 周|AI 对话与 SSE 流式输出|项目第一亮点|
|第 10 周|Python FastAPI AI 服务|Java 调 Python|
|第 11 周|RAG 知识库问答|项目第二亮点|
|第 12 周|AI 工作流、Prompt 模板、评估日志|差异化增强|
|第 13 周|前端高级交互：Canvas、虚拟列表、性能|前端优势强化|
|第 14 周|Docker、部署、README、架构图|工程化闭环|
|第 15 周|简历、八股、算法、模拟面试|求职材料完成|
|第 16 周|查漏补缺、集中投递、项目包装|开始强投|



---



# 七、每周详细计划



---



# 第 0 周：环境安装与学习系统搭建



## 目标



把所有工具装好，不要边学边卡环境。



## 周一到周五，每天 2 小时



### Day 1：安装基础工具



安装：



- Git；

- VS Code；

- IntelliJ IDEA；

- Chrome；

- DBeaver；

- Apifox。



检查 Git：



```Bash
git --version
```



配置 Git：



```Bash
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"
```



---



### Day 2：安装前端环境



安装：



- Node\.js LTS；

- pnpm。



检查：



```Bash
node -v
npm -v
pnpm -v
```



创建前端测试项目：



```Bash
pnpm create vite test-frontend --template react-ts
cd test-frontend
pnpm install
pnpm dev
```



---



### Day 3：安装 Java 环境



安装：



- JDK 17；

- Maven；

- IDEA 插件。



检查：



```Bash
java -version
mvn -v
```



在 IDEA 里创建一个普通 Java 项目，跑：



```Java
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello Java");
    }
}
```



---



### Day 4：安装 MySQL 和 DBeaver



创建数据库：



```SQL
CREATE DATABASE ai_workbench_test;
```



用 DBeaver 连上。



---



### Day 5：安装 Python



安装 Python 3\.11 或 3\.12。



检查：



```Bash
python --version
pip --version
```



创建虚拟环境：



```Bash
python -m venv .venv
```



激活环境后安装：



```Bash
pip install fastapi uvicorn requests python-dotenv
```



---



## 周六 8 小时



完成正式仓库初始化：



```Plain Text
ai-creative-workbench
├── frontend
├── backend-java
├── ai-service-python
├── docs
└── README.md
```



建立 Git 仓库：



```Bash
git init
git add .
git commit -m "init project structure"
```



---



## 周日 8 小时



写第一份文档：



```Plain Text
docs/study-plan.md
docs/project-idea.md
```



内容包括：



- 为什么做这个项目；

- 技术栈；

- 目标岗位；

- 16 周计划；

- 每周验收标准。



## 验收标准



- 所有软件装好；

- Git 仓库建好；

- 前端测试项目能跑；

- Java Hello World 能跑；

- MySQL 能连接；

- Python FastAPI 环境准备好。



---



# 第 1 周：Java 基础语法



## 目标



你要能看懂 Java 基础代码，不再怕 `.java` 文件。



## 周一：Java 程序怎么运行



学：



- JDK；java开发工具包

- JRE；java运行环境

- JVM；java虚拟机，执行\.class，内存管理，垃圾回收，跨平台，使得java可以一次编写到处运行

- `.java` 和 `.class`；

- main 方法；

- `System.out.println`。



练：



写 3 个小程序：



1. 输出个人信息；

2. 两个数字相加；

3. 输入分数判断等级。



---



## 周二：变量、类型、运算符



学：



- int；

- long；

- double；

- boolean；

- String；

- 类型转换；

- 运算符。



练：



写一个“订单金额计算”小程序：



```Plain Text
单价 * 数量 - 优惠 = 实付金额
```



---



## 周三：if、switch、for、while



练：



1. 判断奇偶；

2. 打印 1 到 100；

3. 统计 1 到 100 的偶数和；

4. 简单菜单选择系统。



---



## 周四：方法



学：



- 方法定义；

- 参数；

- 返回值；

- 方法重载。



练：



写：



```Java
calculateTotalPrice()
checkLogin()
formatUsername()
```



---



## 周五：数组✔



学：



- 数组定义；

- 遍历；

- 最大值；

- 平均值。



练：



用数组存 5 个成绩，输出最高分、最低分、平均分。



---



## 周六 8 小时：综合练习



做一个控制台版“小型学生管理系统”。



功能：



- 新增学生；

- 查询学生；

- 删除学生；

- 修改学生；

- 显示全部学生。



先用数组做，不用数据库。



---



## 周日 8 小时：复盘 \+ AI 辅助学习



任务：



1. 写笔记：



```Plain Text
docs/java-week1.md
```



2. 用 AI 帮你解释不懂的 Java 代码，但不要直接复制答案。

3. 整理 10 个 Java 基础问题。



## 验收标准



你能解释：



- main 方法是什么；

- 变量和类型是什么；

- 方法为什么要有参数和返回值；

- 数组怎么遍历；

- Java 代码怎么运行。



---



# 第 2 周：面向对象、集合、异常、Maven



## 目标



能看懂后端项目里的 class、对象、List、Map、异常和 Maven。



---



## 周一：类和对象



学：



- class；

- 属性；

- 方法；

- new；

- 构造方法。



练：



写：



```Java
User
Article
Asset
```



每个类包含属性和方法。



---



## 周二：封装、getter/setter、Lombok



学：



- private；

- getter；

- setter；

- `@Data`；

- `@NoArgsConstructor`；

- `@AllArgsConstructor`。



练：



手写一遍 getter/setter，再用 Lombok 简化。



---



## 周三：继承、接口



学：



- extends；

- implements；

- interface；

- 多态。



练：



设计：



```Plain Text
FileProcessor
    ImageProcessor
    PdfProcessor
    TxtProcessor
```



为后面素材处理埋伏笔。



---



## 周四：集合 List、Map



学：



- ArrayList；

- HashMap；

- 遍历；

- add；

- get；

- remove；

- containsKey。



练：



用 `List<User>` 做用户列表，用 `Map<Long, User>` 做用户索引。



---



## 周五：异常



学：



- try/catch；

- throw；

- RuntimeException；

- 自定义异常。



练：



写：



```Java
BusinessException
```



模拟：



- 用户不存在；

- 密码错误；

- 文件类型不支持。



---



## 周六 8 小时：Maven



学：



- Maven 是什么；

- `pom.xml`；

- dependency；

- 本地仓库；

- Maven reload；

- 依赖冲突初步。



练：



创建 Maven 项目，引入 Lombok。



---



## 周日 8 小时：控制台项目重构



把第 1 周学生管理系统改成面向对象版本。



目录：



```Plain Text
student-manager
├── entity
├── service
├── exception
└── Main.java
```



## 验收标准



你能解释：



- 类和对象的区别；

- interface 有什么用；

- List 和 Map 区别；

- 异常为什么不能乱吞；

- Maven 是干什么的；

- `pom.xml` 是什么。



---



# 第 3 周：Spring Boot 目录结构与接口



## 目标



不急着做业务，先搞懂 Spring Boot 项目怎么启动、请求怎么进来。



---



## 周一：创建 Spring Boot 项目



用 Spring Initializr 创建：



依赖：



- Spring Web；

- Lombok；

- Spring Boot DevTools。



启动类：



```Java
@SpringBootApplication
public class BackendJavaApplication {
    public static void main(String[] args) {
        SpringApplication.run(BackendJavaApplication.class, args);
    }
}
```



你要知道：



> 这个文件就是后端服务的入口。
>
>



---



## 周二：理解目录结构



建立：



```Plain Text
controller
service
service.impl
entity
dto
vo
mapper
common
config
exception
```



每个目录写一个 README：



```Plain Text
这个目录放什么？
为什么要有这一层？
```



---



## 周三：第一个 Controller



写：



```HTTP
GET /api/hello
```



返回：



```JSON
{
  "message": "hello spring boot"
}
```



学：



- `@RestController`

- `@RequestMapping`

- `@GetMapping`



---



## 周四：接收参数



练习：



```HTTP
GET /api/hello?name=Tom
GET /api/users/{id}
POST /api/users
```



学：



- `@RequestParam`

- `@PathVariable`

- `@RequestBody`



---



## 周五：统一返回 Result



写：



```Java
Result.success(data)
Result.fail(message)
```



所有接口统一返回：



```JSON
{
  "code": 0,
  "message": "success",
  "data": {}
}
```



---



## 周六 8 小时：Controller \+ Service 分层



写一个不连数据库的用户模块：



```Plain Text
UserController
UserService
UserServiceImpl
UserDTO
UserVO
```



接口：



```HTTP
GET /api/users
GET /api/users/{id}
POST /api/users
```



数据先存在内存 List 里。



---



## 周日 8 小时：Apifox 测试与复盘



用 Apifox 测所有接口。



写文档：



```Plain Text
docs/springboot-request-flow.md
```



画流程：



```Plain Text
浏览器 / Apifox
    ↓
Controller
    ↓
Service
    ↓
返回 Result
```



## 验收标准



你能解释：



- Spring Boot 怎么启动；

- Controller 是什么；

- Service 是什么；

- DTO 和 VO 是什么；

- 请求参数怎么接收；

- 统一返回有什么好处。



---



# 第 4 周：MySQL \+ MyBatis\-Plus



## 目标



能用 Java 操作 MySQL，完成基础 CRUD。



---



## 周一：SQL 基础



学：



- database；

- table；

- insert；

- select；

- update；

- delete；

- where；

- order by。



练：



```SQL
CREATE TABLE article (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255),
  content TEXT,
  author VARCHAR(100),
  created_at DATETIME,
  updated_at DATETIME
);
```



---



## 周二：Spring Boot 连接 MySQL



引入依赖：



- MySQL Driver；

- MyBatis\-Plus。



配置 `application.yml`：



```YAML
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/ai_workbench_test
    username: root
    password: 你的密码
```



---



## 周三：Entity 和 Mapper



写：



```Java
@TableName("article")
public class Article {
    private Long id;
    private String title;
    private String content;
    private String author;
}
```



写：



```Java
public interface ArticleMapper extends BaseMapper<Article> {
}
```



---



## 周四：Service 操作数据库



完成：



```Java
createArticle()
getArticleById()
listArticles()
updateArticle()
deleteArticle()
```



---



## 周五：Controller 暴露接口



接口：



```HTTP
POST /api/articles
GET /api/articles
GET /api/articles/{id}
PUT /api/articles/{id}
DELETE /api/articles/{id}
```



---



## 周六 8 小时：分页和条件查询



实现：



```HTTP
GET /api/articles?page=1&pageSize=10&keyword=AI
```



学：



- 分页；

- 模糊查询；

- QueryWrapper / LambdaQueryWrapper。



---



## 周日 8 小时：小结



写：



```Plain Text
docs/mysql-mybatis-plus.md
```



内容：



- Entity 和表怎么对应；

- Mapper 为什么能操作数据库；

- MyBatis\-Plus 帮你做了什么；

- 分页怎么实现。



## 验收标准



你能不用看教程写出一个文章 CRUD。



---



# 第 5 周：Java 小项目——文章管理系统



## 目标



用一个小项目把后端基础跑熟，为正式项目做准备。



---



## 功能



文章管理系统：



- 用户登录，先简化为固定用户；

- 新增文章；

- 修改文章；

- 删除文章；

- 查询文章；

- 按标题搜索；

- 分页；

- 统一异常处理；

- 统一返回；

- Apifox 文档。



---



## 周一到周五



每天做一个模块：



|天|内容|
|---|---|
|周一|项目结构整理|
|周二|Article 增删改查|
|周三|DTO / VO 重构|
|周四|全局异常处理|
|周五|参数校验 Validation|



---



## 周六 8 小时



完善 Apifox 文档。



每个接口写：



- 请求路径；

- 请求参数；

- 响应示例；

- 错误示例。



---



## 周日 8 小时



复盘并录音讲项目 5 分钟。



你要讲清楚：



1. 为什么分 Controller / Service / Mapper；

2. DTO 和 VO 为什么分开；

3. MyBatis\-Plus 怎么用；

4. 异常怎么处理；

5. 参数校验怎么做。



## 验收标准



这个小项目能独立写出来，正式项目才能开始。



---



# 第 6 周：正式项目 Java 后端——用户与鉴权



## 目标



正式项目启动，完成用户注册、登录、JWT。



---



## 数据表



```SQL
CREATE TABLE user (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  role VARCHAR(50),
  created_at DATETIME,
  updated_at DATETIME
);
```



---



## 周一：项目初始化



创建：



```Plain Text
backend-java
```



依赖：



- Spring Web；

- MyBatis\-Plus；

- MySQL；

- Lombok；

- Validation；

- JWT 工具库。



---



## 周二：用户注册



接口：



```HTTP
POST /api/auth/register
```



请求：



```JSON
{
  "username": "test",
  "password": "123456",
  "email": "test@qq.com"
}
```



要求：



- 用户名不能为空；

- 密码不能为空；

- 用户名不能重复；

- 密码不能明文存储。



---



## 周三：用户登录



接口：



```HTTP
POST /api/auth/login
```



返回：



```JSON
{
  "token": "xxx",
  "user": {}
}
```



---



## 周四：JWT 工具类



实现：



- 生成 token；

- 解析 token；

- 获取 userId；

- 判断是否过期。



---



## 周五：登录拦截器



实现：



```HTTP
GET /api/auth/me
```



必须带 token。



---



## 周六 8 小时：统一鉴权流程



实现：



- AuthInterceptor；

- WebMvcConfig；

- LoginUserContext；

- 排除登录注册接口。



---



## 周日 8 小时：接口文档 \+ 复盘



写：



```Plain Text
docs/auth-design.md
```



画流程：



```Plain Text
用户登录
  ↓
后端校验密码
  ↓
生成 JWT
  ↓
前端保存 token
  ↓
后续请求带 Authorization
  ↓
拦截器解析 token
```



## 验收标准



用户注册、登录、获取当前用户全部可用。



---



# 第 7 周：正式项目 Java 后端——素材、标签、文件上传



## 目标



完成项目的业务主体。



---



## 数据表



### asset



```SQL
CREATE TABLE asset (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT,
  name VARCHAR(255),
  type VARCHAR(50),
  url VARCHAR(500),
  size BIGINT,
  description TEXT,
  created_at DATETIME,
  updated_at DATETIME
);
```



### tag



```SQL
CREATE TABLE tag (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100),
  color VARCHAR(50)
);
```



### asset\_tag



```SQL
CREATE TABLE asset_tag (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  asset_id BIGINT,
  tag_id BIGINT
);
```



---



## 周一：文件上传基础



接口：



```HTTP
POST /api/assets/upload
```



学：



- MultipartFile；

- 文件大小；

- 文件类型；

- 保存路径。



---



## 周二：素材列表



接口：



```HTTP
GET /api/assets?page=1&pageSize=10
```



支持分页。



---



## 周三：素材详情与删除



接口：



```HTTP
GET /api/assets/{id}
DELETE /api/assets/{id}
```



删除时注意：



- 删除数据库记录；

- 文件是否物理删除可以先不做。



---



## 周四：标签模块



接口：



```HTTP
POST /api/tags
GET /api/tags
```



---



## 周五：素材绑定标签



接口：



```HTTP
POST /api/assets/{assetId}/tags/{tagId}
GET /api/assets?tagId=1
```



---



## 周六 8 小时：完善查询条件



支持：



- 按名称搜索；

- 按类型筛选；

- 按标签筛选；

- 按时间排序。



---



## 周日 8 小时：Apifox \+ 文档



写：



```Plain Text
docs/asset-module.md
```



## 验收标准



后端能完成素材上传、查询、标签管理。



---



# 第 8 周：前端项目骨架与后端联调



## 目标



正式项目有可展示页面。



---



## 周一：React 项目初始化



```Bash
pnpm create vite frontend --template react-ts
```



安装：



```Bash
pnpm install
pnpm add react-router-dom zustand axios
```



UI 库：



```Bash
pnpm add antd
```



---



## 周二：前端目录结构



```Plain Text
src
├── api
├── components
├── layouts
├── pages
├── routes
├── stores
└── utils
```



---



## 周三：登录注册页



实现：



- 登录；

- 注册；

- 保存 token；

- 路由跳转。



---



## 周四：主布局



实现：



- 左侧菜单；

- 顶部用户信息；

- 内容区域；

- 退出登录。



---



## 周五：素材上传页



实现：



- 文件选择；

- 上传进度；

- 成功提示；

- 错误提示。



---



## 周六 8 小时：素材列表页



实现：



- 表格；

- 分页；

- 搜索；

- 标签筛选；

- 删除。



---



## 周日 8 小时：前后端联调与修 Bug



重点处理：



- 跨域；

- token；

- 接口路径；

- 文件上传格式；

- 错误提示。



## 验收标准



前端可以登录、上传文件、查看素材列表。



---



# 第 9 周：AI 对话与 SSE 流式输出



## 目标



完成项目第一大差异化亮点。



---



## 周一：大模型 API 普通调用



后端实现：



```HTTP
POST /api/chat
```



请求：



```JSON
{
  "message": "帮我生成一段游戏活动文案"
}
```



先返回完整结果，不做流式。



---



## 周二：SSE 原理



学：



- SSE 是什么；

- SSE 和 WebSocket 区别；

- 为什么大模型常用 SSE；

- 前端怎么接收；

- 后端怎么推送。



---



## 周三：Java 后端 SSE



接口：



```HTTP
GET /api/chat/stream?message=xxx
```



或：



```HTTP
POST /api/chat/stream
```



实现逐步返回。



---



## 周四：前端 AI 对话页面



实现：



- 输入框；

- 发送按钮；

- 消息列表；

- assistant 流式输出；

- loading 状态。



---



## 周五：停止生成与错误处理



实现：



- 前端中断请求；

- 后端处理断连；

- 失败重试；

- 错误提示。



---



## 周六 8 小时：历史会话



数据表：



```SQL
CREATE TABLE conversation (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT,
  title VARCHAR(255),
  created_at DATETIME
);

CREATE TABLE message (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  conversation_id BIGINT,
  role VARCHAR(50),
  content TEXT,
  created_at DATETIME
);
```



接口：



```HTTP
GET /api/conversations
GET /api/conversations/{id}
```



---



## 周日 8 小时：Markdown 渲染与体验优化



实现：



- Markdown；

- 代码块；

- 复制回答；

- 重新生成；

- 自动滚动。



## 验收标准



AI 对话可以流式输出、保存历史、重新查看。



---



# 第 10 周：Python FastAPI AI 服务



## 目标



把 AI 能力从 Java 后端拆到 Python 服务，为 RAG 做准备。



---



## 周一：FastAPI 入门



创建：



```Plain Text
ai-service-python
├── app
│   ├── main.py
│   ├── routers
│   ├── services
│   └── schemas
```



实现：



```HTTP
GET /health
```



---



## 周二：Python 调大模型



实现：



```HTTP
POST /ai/chat
```



---



## 周三：Java 调 Python



Java 后端新增：



```HTTP
POST /api/ai/chat
```



内部调用 Python：



```Plain Text
Java Controller
  ↓
Java Service
  ↓
HTTP 调 FastAPI
  ↓
Python 调模型
  ↓
返回给 Java
  ↓
返回给前端
```



---



## 周四：配置管理



Python 使用 `.env`：



```Plain Text
MODEL_API_KEY=xxx
MODEL_BASE_URL=xxx
```



---



## 周五：异常和日志



Python 服务增加：



- 异常处理；

- 日志打印；

- 请求耗时；

- 错误返回格式。



---



## 周六 8 小时：Python 流式接口



实现 Python SSE 或流式生成接口。



如果太难，先保留 Java SSE，Python 负责非流式 AI 能力。



---



## 周日 8 小时：架构文档



写：



```Plain Text
docs/java-python-architecture.md
```



## 验收标准



Java 可以调用 Python AI 服务，项目从“传统后端”升级为“AI 应用架构”。



---



# 第 11 周：RAG 知识库问答



## 目标



完成项目第二大差异化亮点。



---



## RAG 基本流程



```Plain Text
上传文档
  ↓
解析文本
  ↓
文本切分
  ↓
生成 Embedding
  ↓
存入向量库
  ↓
用户提问
  ↓
检索相关片段
  ↓
拼接 Prompt
  ↓
大模型回答
  ↓
返回引用片段
```



---



## 周一：文档解析



先支持：



- txt；

- markdown；

- pdf 可后置。



接口：



```HTTP
POST /ai/documents/parse
```



---



## 周二：文本切分



实现：



- 按段落切；

- 每段 300 到 500 字；

- 保留文档来源。



---



## 周三：Embedding



调用 Embedding API。



如果 API 暂时不通，就先用模型平台文档调通一个最小 Demo。



---



## 周四：向量库 Chroma



安装：



```Bash
pip install chromadb
```



实现：



- 新增文档向量；

- 查询 TopK 片段。



---



## 周五：RAG 问答接口



接口：



```HTTP
POST /ai/rag/query
```



返回：



```JSON
{
  "answer": "xxx",
  "references": [
    {
      "content": "命中的片段",
      "source": "文档名"
    }
  ]
}
```



---



## 周六 8 小时：Java 接入 RAG



Java 暴露：



```HTTP
POST /api/rag/query
POST /api/knowledge/upload
```



---



## 周日 8 小时：前端知识库页面



实现：



- 上传知识文档；

- 文档列表；

- 知识库问答；

- 引用片段展示。



## 验收标准



能上传一篇文档，并根据文档内容回答问题。



---



# 第 12 周：AI 工作流、Prompt 模板、评估日志



## 目标



从“会调用模型”升级到“会设计 AI 应用工作流”。



这点很重要。36氪文章也强调，AI 的关键不是会多少提示词，而是有没有把工作流建起来。来源：36氪。



---



## 周一：Prompt 模板管理



设计表：



```SQL
CREATE TABLE prompt_template (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255),
  scene VARCHAR(100),
  content TEXT,
  created_at DATETIME
);
```



场景：



- 游戏活动文案；

- 美术素材描述；

- 运营公告；

- 用户反馈总结；

- 知识库问答。



---



## 周二：Prompt 模板接口



接口：



```HTTP
POST /api/prompts
GET /api/prompts
PUT /api/prompts/{id}
DELETE /api/prompts/{id}
```



---



## 周三：AI 工作流 1：素材描述生成



流程：



```Plain Text
选择素材
  ↓
填写目标风格
  ↓
调用 Prompt 模板
  ↓
生成描述
  ↓
保存结果
```



---



## 周四：AI 工作流 2：运营文案生成



输入：



- 活动主题；

- 用户群体；

- 文案风格；

- 字数；

- 禁用词。



输出：



- 标题；

- 正文；

- 短视频文案；

- 推送文案。



---



## 周五：AI 调用日志



设计表：



```SQL
CREATE TABLE ai_call_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT,
  scene VARCHAR(100),
  prompt TEXT,
  response TEXT,
  model VARCHAR(100),
  cost_time BIGINT,
  created_at DATETIME
);
```



---



## 周六 8 小时：前端工作流页面



做两个页面：



1. 素材描述生成；

2. 运营文案生成。



---



## 周日 8 小时：AI 评估



增加简单评估字段：



- 是否满意；

- 点赞 / 点踩；

- 重新生成原因；

- 用户反馈。



## 验收标准



项目不是简单 Chatbot，而是有可复用 AI 工作流。



---



# 第 13 周：前端高级交互强化



## 目标



把你的前端优势打出来，不能让项目看起来只是后端 CRUD \+ AI 接口。



---



## 周一：Canvas 图片预览



实现：



- 图片加载；

- 缩放；

- 拖拽；

- 适配容器。



---



## 周二：Canvas 标注



实现：



- 矩形框；

- 标注文字；

- 保存标注数据。



---



## 周三：虚拟列表



用于：



- 长会话消息；

- 大量素材列表。



实现目标：



- 1000 条消息不卡；

- 滚动平滑。



---



## 周四：前端性能优化



做：



- 路由懒加载；

- 组件拆分；

- 防抖节流；

- 大文件上传体验优化；

- loading 骨架屏。



---



## 周五：错误体验



统一处理：



- token 过期；

- 网络错误；

- AI 生成失败；

- 文件过大；

- 类型不支持。



---



## 周六 8 小时：实习经验复盘



写：



```Plain Text
docs/internship-review.md
```



结构：



1. 项目背景；

2. 你负责什么；

3. 技术难点；

4. 解决方案；

5. 结果；

6. 和当前项目的关联。



---



## 周日 8 小时：准备面试故事



写 8 个故事：



1. SSE 流式输出；

2. Java \+ Python AI 架构；

3. RAG 知识库；

4. Canvas 标注；

5. 虚拟列表；

6. 文件上传；

7. JWT 鉴权；

8. Prompt 工作流。



## 验收标准



你能证明自己不是普通前端，而是 AI 前端偏全栈。



---



# 第 14 周：Docker、部署、README、架构图



## 目标



项目工程化收尾。



---



## 周一：Docker 基础



学：



- image；

- container；

- port；

- volume；

- network。



---



## 周二：MySQL Docker



写：



```YAML
services:
  mysql:
    image: mysql:8.0
```



---



## 周三：Java Dockerfile



后端打包：



```Bash
mvn clean package
```



Dockerfile：



```Dockerfile
FROM eclipse-temurin:17-jre
COPY target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "/app.jar"]
```



---



## 周四：Python Dockerfile



```Dockerfile
FROM python:3.11
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```



---



## 周五：前端打包



```Bash
pnpm build
```



可用 Nginx，也可以先本地部署。



---



## 周六 8 小时：docker\-compose



整合：



- MySQL；

- Java 后端；

- Python AI 服务；

- 前端可选。



---



## 周日 8 小时：README



README 必须包含：



- 项目介绍；

- 技术栈；

- 架构图；

- 功能截图；

- 启动方式；

- 接口说明；

- 核心亮点；

- 遇到的问题与解决方案。



## 验收标准



别人能根据 README 跑起项目，至少能看懂你的架构。



---



# 第 15 周：简历、八股、算法、模拟面试



## 目标



开始从“学习状态”切换到“求职状态”。



---



## 简历 A：AI 前端 / 大模型应用前端



突出：



- 禅游 AI 中台实习；

- SSE；

- Canvas；

- 虚拟列表；

- AI 工作流；

- RAG；

- TypeScript；

- 前端性能优化。



---



## 简历 B：软件开发 / Java 偏全栈 / 国企银行



突出：



- Spring Boot；

- MySQL；

- JWT；

- 文件上传；

- Docker；

- Java \+ Python 架构；

- RAG；

- 完整项目闭环。



---



## 周一到周五



每天安排：



|时间|内容|
|---|---|
|40 分钟|算法|
|40 分钟|八股|
|40 分钟|项目讲解 / 简历修改|



算法优先：



- 数组；

- 哈希；

- 双指针；

- 栈；

- 二叉树；

- 动态规划基础。



---



## 周六 8 小时



模拟面试 1：



- 自我介绍；

- 实习；

- 项目；

- Java；

- 前端；

- AI。



---



## 周日 8 小时



模拟面试 2：



- 算法；

- 八股；

- 项目追问；

- 压力面。



## 验收标准



你能 3 分钟讲项目，10 分钟讲架构，30 分钟经得起追问。



---



# 第 16 周：查漏补缺、集中投递、项目包装



## 目标



不要再无限学习，开始真正投递。



---



## 周一：整理投递材料



准备：



- A 版简历；

- B 版简历；

- 项目 README；

- 项目截图；

- 架构图；

- Apifox 文档；

- 实习复盘；

- 项目讲解稿。



---



## 周二：项目最后修 Bug



只修影响展示的问题，不再加大功能。



---



## 周三：录制项目演示视频



3 到 5 分钟：



1. 登录；

2. 上传素材；

3. AI 对话；

4. RAG 问答；

5. AI 工作流；

6. Canvas 标注；

7. 架构说明。



---



## 周四：开始投递



投递方向：



|方向|数量|
|---|---|
|AI 前端|20|
|大模型应用开发|20|
|前端偏全栈|20|
|Java 软件开发|20|
|国企银行信息科技|20|



---



## 周五：复盘投递反馈



记录：



- 哪些岗位有回应；

- 简历被卡在哪；

- 面试问了什么；

- 项目哪里讲不清。



---



## 周六 8 小时：集中补短板



根据反馈补：



- 某个八股；

- 某个项目问题；

- 某个算法类型；

- 某段简历描述。



---



## 周日 8 小时：下一轮投递



继续投。



## 验收标准



16 周结束时，你不应该还处在“准备学习”状态，而应该已经进入“投递 \+ 面试 \+ 迭代”状态。



---



# 八、每天固定学习模板



无论哪一周，每天都按这个节奏。



## 工作日 2 小时



|时间|内容|
|---|---|
|10 分钟|回顾昨天卡点|
|40 分钟|学一个知识点|
|50 分钟|写代码|
|15 分钟|记录笔记|
|5 分钟|Git commit|



---



## 周末 8 小时



|时间|内容|
|---|---|
|1 小时|复习本周知识|
|3 小时|项目编码|
|1 小时|调试和测试|
|1 小时|写文档|
|1 小时|面试表达整理|
|1 小时|算法 / 八股|



---



# 九、每周必须提交的东西



每周至少有：



1. Git commit 不少于 8 次；

2. 一篇学习笔记；

3. 一个可运行功能；

4. 一个 Apifox 接口记录；

5. 一个面试问题总结；

6. 一次周复盘。



复盘模板：



```Plain Text
本周完成：
1.
2.
3.

本周没完成：
1.
2.

最大卡点：
1.

我下周要解决：
1.
2.

本周 Git commit 数：
本周接口数量：
本周算法题数量：
本周项目功能：
```



---



# 十、最终项目亮点写法



简历里可以这样写：



> 基于 React \+ TypeScript \+ Spring Boot \+ FastAPI 实现 AI 创意资产与知识工作台，支持素材上传、标签管理、AI 流式对话、知识库问答和 Prompt 工作流。前端基于 SSE 实现大模型流式输出，结合虚拟列表优化长会话渲染性能，并使用 Canvas 实现图片素材预览与标注。后端采用 Spring Boot 完成用户鉴权、素材管理、会话持久化和 Java\-Python 服务编排；AI 服务基于 FastAPI 实现文档解析、Embedding、向量检索和 RAG 问答，支持返回引用片段，提升回答可追溯性。
>
>



---



# 十一、你必须能回答的面试问题



## Java 方向



1. Controller / Service / Mapper 分别负责什么？

2. DTO 和 VO 为什么要分开？

3. JWT 登录流程是什么？

4. MyBatis\-Plus 怎么完成 CRUD？

5. 文件上传怎么做？

6. 统一异常处理怎么做？

7. MySQL 表是怎么设计的？



---



## 前端方向



1. SSE 和 WebSocket 区别是什么？

2. 大模型流式输出前端怎么处理？

3. 虚拟列表为什么能优化性能？

4. Canvas 标注怎么实现？

5. token 怎么保存和携带？

6. 前端如何处理 AI 生成中断？

7. 长会话页面怎么优化？



---



## Python / AI 方向



1. FastAPI 服务为什么单独拆出来？

2. Java 怎么调用 Python？

3. RAG 是什么？

4. Embedding 是什么？

5. 向量检索 TopK 是什么？

6. RAG 为什么要返回引用片段？

7. Prompt 模板怎么设计？

8. AI 调用日志有什么价值？



---



# 十二、这套计划的核心原则



你想保留 Python 和 AI 是对的，但要记住：



> **AI 差异化不是堆名词，而是把 AI 能力做进真实业务流程。**
>
>



所以这 16 周里，不能只是写：



```Plain Text
我会 RAG
我会 Agent
我会 Prompt
```



而是要能展示：



```Plain Text
我做了素材上传
我做了知识库问答
我做了流式 AI 对话
我做了 Prompt 模板
我做了 AI 工作流
我做了调用日志
我做了引用片段展示
```



这才是求职有说服力的差异化。



---



# 十三、最终一句话路线



你这 16 周的路线就是：



> **用 Java 搭工程底座，用前端做 AI 交互体验，用 Python 承载 RAG 和 AI 工作流，最后包装成一个可展示、可讲、可投递的大模型应用项目。**
>
>



这不是传统开发。

这是更适合你当前背景的：



# AI 应用前端偏全栈路线。

