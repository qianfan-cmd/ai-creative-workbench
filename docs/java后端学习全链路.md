# Java后端完整学习路线（参考黑马B站视频体系，校招向）
> 黑马课程主线：JavaSE → JavaWeb → SSM → SpringBoot → 单体项目（瑞吉外卖）→ SpringCloudAlibaba微服务 → 中间件 → 微服务项目 → 面试专题。
> 学习原则：**看视频+手写代码+做笔记，不要只看不动手；优先保证项目写进简历，原理配合面试去深挖**

## 阶段1：JavaSE（黑马Java基础+进阶，重中之重）
目标：吃透Java语言底层基础，校招笔试面试大量考点
1. Java基础：JDK环境、IDEA、变量、数据类型、运算符、分支循环、数组、方法、面向对象（类、对象、继承、多态、封装、this/super、static、final、抽象类、接口、内部类）
2. 常用API：String、StringBuilder、包装类、日期类、异常体系
3. 集合框架（面试高频）：ArrayList、LinkedList、HashMap、HashSet、TreeMap底层源码、扩容机制、哈希冲突
4. 进阶：泛型、IO流、NIO、反射、注解、JDK8新特性（Lambda、Stream流）
5. 多线程&并发：线程创建、线程状态、锁（synchronized、volatile、Lock）、线程池、CAS、AQS、并发集合
6. 网络编程：Socket TCP/UDP
> 黑马配套视频：黑马Java零基础入门 + JavaSE进阶
> 练习：每节课案例手写，额外刷简单算法（力扣简单难度）

## 阶段2：JavaWeb + MySQL（黑马Web阶段）
目标：学会数据库操作、HTTP协议，掌握后端最基础的Web开发能力
1. MySQL：SQL语句、多表查询、事务、索引、视图、存储过程、MySQL底层（B+树、MVCC、锁）
2. 工具：Maven（依赖管理）、Git（版本控制）、Linux基础命令
3. Web核心：HTTP/HTTPS协议、Tomcat服务器、Servlet、请求响应、Cookie、Session、过滤器Filter、监听器
4. JDBC、数据库连接池（Druid）
5. 前端简单了解：HTML/CSS/JS + Vue基础（后端不用深挖前端，看懂接口联调即可）
> 黑马配套：黑马JavaWeb全套
> 实战：写一个简单登录、增删改查后台管理页面

## 阶段3：SSM框架（黑马SSM）
> 现在企业很少原生SSM开发，但是**原理必学**，理解Spring核心思想，为SpringBoot打基础
1. MyBatis：ORM思想、Mapper、动态SQL、一对一/一对多映射
2. Spring：IoC容器、Bean生命周期、AOP、事务管理、注解开发
3. SpringMVC：请求接收、参数绑定、JSON、拦截器、异常处理器
> 实战：SSM整合，完成简单CRUD项目

## 阶段4：SpringBoot + MyBatis-Plus（黑马SpringBoot，校招最核心单体框架）
SpringBoot简化SSM，企业单体项目主流，简历第一个项目就用这个
1. SpringBoot：自动配置、起步依赖、配置文件、Bean管理、全局异常处理、跨域、拦截器
2. MyBatis-Plus：CRUD封装、条件构造器、分页插件、逻辑删除
3. 工具：Swagger/Knife4j接口文档、JWT登录认证、Redis基础
> 黑马重点项目：**瑞吉外卖（苍穹外卖）**，完整单体项目，写简历首选，黑马有全套视频，从需求分析到上线部署，包含登录、权限、文件上传、缓存等业务场景

## 阶段5：中间件（黑马微服务阶段配套）
秋招后端必考中间件，优先掌握Redis，再学消息队列
1. Redis：数据结构、持久化RDB/AOF、缓存击穿/穿透/雪崩、分布式锁、缓存一致性
2. MQ（RabbitMQ/RocketMQ任选其一，黑马主推RabbitMQ）：消息模型、可靠性、幂等性、死信队列、异步解耦、削峰填谷
3. Elasticsearch：分词、索引、检索，可选，有余力再学
4. Docker：容器、镜像、Docker Compose，项目部署必备

## 阶段6：微服务 Spring Cloud Alibaba（黑马微服务体系）
> 校招：看懂原理，会简单使用即可，不用死磕复杂调优；简历放微服务项目加分
组件：Nacos（注册中心+配置中心）、OpenFeign远程调用、Gateway网关、Sentinel熔断限流、Seata分布式事务
> 黑马项目：学成在线 / 好客租房，微服务实战项目，拆分多个服务，网关鉴权、分布式事务、MQ异步业务

## 阶段7：底层原理 + 面试专题（黑马大厂面试专题课，秋招冲刺）
校招Java后端面试高频，**必须单独刷一遍**
1. JVM：内存区域、垃圾回收、GC算法、CMS/G1、类加载机制、双亲委派、OOM排查
2. MySQL底层：索引底层、事务隔离级别、MVCC、锁机制、SQL优化、慢查询
3. Spring源码：Bean生命周期、AOP底层、SpringBoot自动配置原理
4. 分布式理论：CAP、BASE、分布式事务、幂等性
5. 算法：力扣简单+中等，链表、二叉树、哈希、动态规划基础

## 阶段8：项目打磨 + 简历+面试复盘
1. 2个项目保底：单体项目（瑞吉外卖，SpringBoot）+ 微服务项目（学成在线）
2. 项目不要只写CRUD，重点写难点：缓存方案、分布式锁、幂等、事务、性能优化、异常处理
3. 模拟面试：黑马面试专题配套真题，手写代码，口述原理

# 学习时间参考（自学，每天4~6h）
1. JavaSE：25~30天
2. MySQL+JavaWeb：15天
3. SSM：12天
4. SpringBoot+瑞吉外卖项目：20天
5. Redis+MQ+Docker：15天
6. SpringCloudAlibaba微服务+项目：20天
7. JVM/MySQL底层+面试刷题：持续贯穿到秋招

# 黑马视频B站搜索关键词（直接复制找）
1. 黑马程序员Java零基础视频教程
2. 黑马JavaWeb全套教程
3. 黑马SSM框架全套
4. 黑马SpringBoot+瑞吉外卖
5. 黑马SpringCloudAlibaba微服务
6. 黑马Java大厂面试专题

## 学习避坑（很关键）
1. 不要长时间只看视频，**每一节必须手写代码**，听懂不等于会写
2. SSM不用做复杂项目，理解IoC/AOP即可，重心放在SpringBoot
3. 校招优先吃透JavaSE、JVM、MySQL、Redis，微服务可以浅一点，面试官更爱问底层基础
4. 项目优先吃透瑞吉外卖，吃透一个比浅做3个项目简历效果更好
