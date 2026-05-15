# 成绩链上存证 · 前端

Vue 3 + Vite + TypeScript + Vue Router + **Element Plus** + **Tailwind CSS** + **ECharts（vue-echarts）** + **Axios**，深色「联盟链管理后台」风格；对接仓库内 **`backend/`** 的 REST API。

---

## 与后端联调时的启动顺序（不修改源码）

与 **`操作说明.md` §〇**、**`项目设计.md` §14.3** 一致：先保证 **虚拟机** 上 **Fabric** 与 **`backend`** 已 **`npm start`**，且 **`curl`** **`/api/health`** 与 **`POST /api/auth/login`** 正常（见 **`backend/README.md` → 日常启动**）；再在 **Windows** 上：

1. 编辑 **`frontend/.env.development`**：**`VITE_API_BASE=http://<虚拟机IP>:3000`**（**不要**写成宿主访问自身的 **`http://localhost:3000`**，除非后端也在本机 **3000** 端口）。  
2. **`cd frontend`** → **`npm install`**（按需）→ **`npm run dev`**。  
3. 浏览器打开终端中的 **Local** 地址（多为 **`http://localhost:5173`**）；**API** 仍走 **`VITE_API_BASE`** 指向的虚拟机。

修改 **`VITE_API_BASE`** 后须**重启** **`npm run dev`** 才会重新加载环境变量。

---

## 配置

1. 复制或编辑 **`frontend/.env.development`**，将 **`VITE_API_BASE`** 设为虚拟机后端地址（含端口），例如：

   `VITE_API_BASE=http://192.168.x.x:3000`

2. 确保虚拟机上的 **`npm start`**（或等价方式）已在 **3000** 端口提供 API，且本机防火墙 / 网络可访问该地址。

---

## 常用命令

```bash
cd frontend
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

---

## 登录与 Bearer（与后端 JWT 一致）

1. **首次进入应用**会打开 **`/login`**（路由 **`meta.public`**），无有效令牌时其它业务路由会重定向到登录页并带上 **`?redirect=`** 原路径。  
2. **`POST /api/auth/login`** 由 **`src/api/authApi.ts`** 使用 **`fetch`** 调用（避免与 Axios 循环依赖）；成功后 **`src/stores/auth.ts`** 将 **`token`** 与 **`user`** 写入 **`localStorage`**（键名见 **`AUTH_TOKEN_KEY`**）。  
3. **`src/api/client.ts`**（Axios）在**每个请求**上自动附加：

   `Authorization: Bearer <token>`

   令牌从 **`localStorage`** 读取，与 **`stores/auth.ts`** 使用的键一致。  
4. **响应 401**（令牌缺失、过期或无效）：Axios 拦截器会 **`clearAuth()`** 并 **`router.replace('/login')`**，避免无限弹错。  
5. **响应 403**：提示后端返回的 **`error`**（如写接口用学生账号）。  
6. **演示账号与密码**与后端内置用户表一致，见 **`backend/README.md`**「演示用户」或根目录 **`操作说明.md` §3.6**（密码均为 **`demo`**）。

**API 契约**（路径、请求体、鉴权规则）以 **`backend/README.md`** 为唯一权威说明。

---

## 路由与角色（摘要）

- 侧栏与可访问路由由 **`authUser.role`** 决定（**非**顶栏假切换身份）。  
- **`/forbidden`**：无 **`meta.roles`** 或 **`meta.requiresWrite`** 权限时进入。  
- **用人单位**：默认仅 **`/verify`**、**`/explorer`**；**学生**：无验真、无浏览器直链（路由层限制）。  
- 具体路径表见 **`项目设计.md` §12.2、§12.7**。

---

## 其它说明

- **全局 Loading**：Axios 请求期间顶部 **NProgress** 条（链上提交较慢时避免「假死」感）。  
- **上链阶段文案**：录入 / 更正 / 作废页使用 **`useFabricSubmitFlow`**，轮播背书 → 排序 → 提交等说明（与 Fabric 流程叙事一致，仍为前端体验增强）。  
- **演示数据**：综合看板中的「近 7 日写入曲线」「区块高度」「最新区块流」、链上浏览器列表为**占位/静态演示**；答辩前可接后端 **`/api/chain/summary`** 或 Orderer 查询替换为实时数据。
