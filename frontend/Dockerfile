# ========== 阶段 1：构建 ==========
# 用node把react项目构建成静态文件 dist/
# 行	含义
# FROM ... node:20-alpine AS build
# 基于 Node 20 Alpine 镜像，并命名为 build 阶段。docker.m.daocloud.io 是 DaoCloud 镜像加速，国内拉镜像更快

# WORKDIR /app
# 容器内工作目录设为 /app

# corepack enable && corepack prepare pnpm@latest
# 启用 Corepack 并安装 pnpm（Node 自带包管理器切换工具）

# COPY package.json pnpm-lock.yaml ./
# 先只复制依赖清单，利用 Docker 层缓存：依赖不变时，下次构建可跳过 pnpm install

# pnpm install --frozen-lockfile
# 严格按 lockfile 安装，保证版本一致、可复现

# COPY . .
# 复制整个 frontend 源码（含 src/、vite.config 等）

# pnpm build
# 执行 package.json 里的 build：tsc -b && vite build，产物在 /app/dist

# 阶段2
# 行	含义
# FROM ... nginx:alpine
# 新的最终镜像，只有 Nginx，不含 Node

# COPY --from=build /app/dist ...
# 从 build 阶段拷贝编译好的静态文件到 Nginx 默认站点目录

# COPY nginx.conf .../default.conf
# 挂载自定义 Nginx 配置（SPA 路由、/api/ 反向代理等）

# EXPOSE 80
# 声明监听 80 端口（文档性质，实际映射在 docker run -p 或 compose 里）

# CMD ["nginx", "-g", "daemon off;"]
# 前台运行 Nginx；daemon off 让进程不后台化，容器才能一直运行

# ========== 阶段 1：构建 ==========
FROM docker.m.daocloud.io/library/node:22-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ========== 阶段 2：Nginx 托管静态文件 ==========
# 用nginx把dist/目录下的静态文件托管起来
FROM docker.m.daocloud.io/library/nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]