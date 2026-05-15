# score-backend（Fabric Gateway + Express + JWT）

在 **`test-network`** 的 **`mychannel`** 上，对 **`score`** 链码提供 **REST**。  
**身份**：用户经 **`POST /api/auth/login`** 登录后获得 **JWT**；后端按 **`user.role`** 选择 **Org1** 或 **Org2** 的 **Fabric Gateway**（磁盘证书），再调用 **`evaluateTransaction` / `submitAsync`**。

与 **`操作说明.md`**、**`实验报告.md` §6.3**、**`项目设计.md` §4.1** 描述一致。

---

## 架构与设计要点

| 层次 | 职责 | 本仓库落点 |
|------|------|------------|
| **链码** | 业务状态、历史、验真；**写入 ABAC** | **`score-chaincode`**： **`PutScore` / `CorrectScore` / `RevokeScore`** 入口 **`assertOrg1Mutate`**（仅 **Org1MSP**；可选 **`abac.role`** 拒绝 `student`/`verifier`）。**须链码升版部署后链上生效**。 |
| **Gateway** | gRPC TLS、签名、连接复用 | **`src/fabric.ts`**：按 **`FabricProfile`**（**`org1` | `org2`**）各维护一套 **`Gateway`** 缓存；**`fabricProfileForRole(role)`** 将 **`Academic_Affairs` / `DepartmentTeacher` → org1`**，**`Student` / `ExternalVerifier` → org2**。 |
| **REST** | HTTP 契约、**JWT**、角色授权 | **`src/server.ts`** + **`src/auth.ts`** + **`src/authMiddleware.ts`** + **`src/userService.ts`**（登录用户：MySQL 或内存）。 |
| **配置** | 可复现、路径不随 **`cwd`** 漂移 | **`dotenv`** 从 **`backend/.env`** 加载（相对 **`dist/`** 的上一级）。 |

- **读**：**`evaluateTransaction`**（查询、历史、验真）。  
- **写**：**`submitAsync`** + **`getStatus()`**；失败时返回 **502** 及 **`transactionId`/`code`** 等 JSON。  
- **背书**：与 **`peer chaincode invoke`（双 Peer TLS）** 一致；若 **`submitAsync`** 报背书失败，请对照 **`score-chaincode/README-VM.md`** 中的 invoke 示例。

---

## 前置条件

1. 虚拟机里 **Fabric 已起**（`docker ps` 可见 orderer、peer 等）。  
2. **`score`** 已 **commit** 到 **`mychannel`**（版本以你 **`querycommitted`** 为准）。  
3. **Node.js ≥ 18**（`node -v`）。  
4. **`organizations`** 下同时存在 **Org1** 与 **Org2** 材料（**`test-network` 默认**）；学生/用人单位使用 **Org2 User1** 连接 **`peer0.org2`**（默认 **`localhost:9051`**）。

---

## 配置

```bash
cd backend
cp .env.example .env
```

编辑 **`.env`**，**必须**设置：

| 变量 | 说明 |
|------|------|
| **`FABRIC_CRYPTO_BASE`** | **Linux 绝对路径**，指向 **`…/peerOrganizations/org1.example.com`**（含 **`users/User1@org1.example.com`**）。 |
| **`JWT_SECRET`** | 签发 JWT 的密钥；**生产与答辩环境务必改为随机长字符串**。未设置时开发环境使用内置弱默认值。 |
| **`JWT_EXPIRES_IN`** | 可选，默认 **`12h`**（见 **`jsonwebtoken` SignOptions**）。 |
| **`DEMO_REGISTRATION_INVITE`** | 可选：**演示注册**时「教务处 **`Academic_Affairs`**」所需的邀请码；默认 **`CHAIN-EDU-2026`**。 |
| **`MYSQL_HOST`** | **可选**。若设置（非空），则 **`/api/auth/login` / `register`** 读写 **MySQL** 表 **`app_users`**（**bcrypt** 密码）；启动时会 **`CREATE DATABASE IF NOT EXISTS`**（库名见 **`MYSQL_DATABASE`**）并建表。不配则仍为**内存用户表**（重启丢失）。 |
| **`MYSQL_PORT`** | 默认 **`3306`**。 |
| **`MYSQL_USER`** / **`MYSQL_PASSWORD`** | MySQL 账号；需具备 **`CREATE DATABASE`**（或已手动建库）、**`CREATE TABLE`**、**`INSERT`** 等权限。 |
| **`MYSQL_DATABASE`** | 默认 **`score_app`**。 |

**Org2（可选覆盖）**：默认将 **`FABRIC_CRYPTO_BASE`** 中的 **`org1.example.com`** 替换为 **`org2.example.com`** 推导 Org2 根路径。若不对称，可显式设置：

- **`FABRIC_CRYPTO_BASE_ORG2`**
- **`MSP_ID_ORG2`**（默认 **`Org2MSP`**）
- **`PEER_ENDPOINT_ORG2`**（默认 **`localhost:9051`**）
- **`PEER_HOST_ALIAS_ORG2`**（默认 **`peer0.org2.example.com`**）

其余 **`CHANNEL_NAME`**、**`CHAINCODE_NAME`**、**`PEER_ENDPOINT`**（Org1）等与 **`test-network`** 一致即可，详见 **`.env.example`**。

---

## 安装与启动

```bash
cd backend
npm install
npm run build
npm start
```

默认 **`http://localhost:3000`**。请在 **`backend`** 目录内启动，避免 **`.env`** 未加载。

---

## 日常启动（不修改源码）

与根目录 **`操作说明.md` §〇**、**`项目设计.md` §14.3** 一致：**不改动** **`src/`** 目录中的业务代码，仅配置 **`.env`** 并执行构建与启动。

1. **Fabric**（与 **`test-network` 同机**）：**`docker ps`** 确认网络已起；当日未改链码则不必 **`deployCC`**。  
2. **`cd backend`**（虚拟机上多为 **`~/work/backend`**）：**`ls -la .env*`**；若无 **`.env`**：**`cp .env.example .env`** 并编辑 **`FABRIC_CRYPTO_BASE`**、**`JWT_SECRET`** 等（**`.`** 开头文件在 Ubuntu 文件管理器需 **`Ctrl+H`** 显示）。  
3. **`npm install`**（按需；勿从 Windows 拷贝 **`node_modules`**）→ **`npm run build`** → **`npm start`**。  
4. 自检：**`curl -s http://localhost:3000/api/health`**；**`curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"jiaowuchu","password":"demo"}'`** 须返回含 **`token`** 的 JSON（**404** 表示进程仍为旧版，需更新源码后重新 **`npm run build`** 并重启）。

宿主机前端将 **`VITE_API_BASE`** 指向 **`http://<VM_IP>:3000`** 后 **`npm run dev`**，详见 **`frontend/README.md`**。

---

## 鉴权规则（摘要）

| 路径 | JWT | 其它 |
|------|-----|------|
| **`GET /api/health`** | 不需要 | 用于自检 **`fabricConfigured`**、**`userStore`**（`mysql` \| `memory`）、**`mysqlReachable`** |
| **`POST /api/auth/login`** | 不需要 | body：`{ username, password }` |
| **`POST /api/auth/register`** | 不需要 | **`{ username, password, displayName, role, inviteCode? }`**；教务处须 **`inviteCode`**。启用 MySQL 时持久化 **`app_users`**；否则仅内存。**非链上 enroll** |
| **`GET /api/auth/me`** | **需要** | 校验令牌并返回当前用户 |
| **`GET /api/scores`**、**`GET /api/scores/history`**、**`POST /api/verify`** | **需要** | 任意已登录角色（按前端路由限制不同 UI） |
| **`POST /api/scores`**、**`POST /api/scores/correct`**、**`POST /api/scores/revoke`** | **需要** | 角色须为 **`Academic_Affairs`** 或 **`DepartmentTeacher`**；否则 **403** |

请求头格式：**`Authorization: Bearer <token>`**（登录响应中的 **`token`** 字段）。

---

## 演示用户（内置）

密码均为 **`demo`**（**`src/userService.ts`** 种子 **DEMO_USERS_SEED**；首次连 MySQL 且表空时自动插入）。生产请换真实认证与 Fabric CA。

| 用户名 | 角色（`user.role`） | Gateway | 说明 |
|--------|---------------------|-----------|------|
| **`jiaowuchu`** | `Academic_Affairs` | Org1 | 可写、可读、可验真 |
| **`teacher01`** | `DepartmentTeacher` | Org1 | 可写、可读、可验真 |
| **`student01`** | `Student` | Org2 | 读类接口；**写接口 403** |
| **`hr001`** | `ExternalVerifier` | Org2 | 读类 + 验真；**写接口 403** |

登录响应示例字段：**`token`**、**`user`**（**`username` / `displayName` / `role` / `org` / `attributes`**）、**`fabricProfile`**（**`org1` | `org2`**）。

### 用户存储：MySQL 与内存

- **`MYSQL_HOST` 已配置**：校验 **JWT** 所对应的用户记录来自表 **`app_users`**（密码 **bcrypt**）。首次启动若表为空，会写入上表四条演示账号。  
- **未配置 `MYSQL_HOST`**：逻辑同前，但用户仅在**进程内存**中，**重启 Node 后注册数据丢失**。  
- **链上证书**：Gateway 仍使用 **`.env` 中 `FABRIC_CRYPTO_BASE`** 指向的固定 **`User1@org1`** / **`User1@org2`**；**新注册用户不会自动获得独立 MSP 目录**，与课堂「双钱包映射」叙事一致——答辩需说明生产侧 **CA enroll + 用户与 MSP 绑定**。

### 运行位置：谁在连 MySQL？

**数据库调用代码跑在启动 `score-backend` 的那台机器 / 那个环境里**（Node.js 进程内 `mysql2`）：

| 你的习惯部署 | 行为 |
|--------------|------|
| 后端在 **虚拟机 (Linux)**，MySQL 在 **宿主机 (Windows)** | 虚拟机里的 Node 通过网络连 **`MYSQL_HOST=宿主机局域网 IP`**（或端口映射）；MySQL 需允许远程 **`%`** 或该 IP，并放行 **3306** 防火墙。 |
| 后端与 MySQL **同在虚拟机** | **`MYSQL_HOST=127.0.0.1`** 即可。 |
| 后端在 **Windows 宿主机**，MySQL 在本机 | **`MYSQL_HOST=127.0.0.1`**。 |

**结论**：没有「数据库在宿主机、驱动却在虚拟机里」的魔法——**谁在运行 `node dist/server.js`，谁就连 MySQL**；另一方只负责在网络上可达地提供 MySQL 服务。

---

## API 一览

| 方法 | 路径 | JWT | 说明 |
|------|------|-----|------|
| GET | `/api/health` | 否 | **`fabricConfigured`**、**`userStore`**、**`mysqlReachable`** |
| POST | `/api/auth/login` | 否 | 见上表 |
| POST | `/api/auth/register` | 否 | 注册；启用 MySQL 时写入 **`app_users`** |
| GET | `/api/auth/me` | 是 | 当前用户信息与 **`fabricProfile`** |
| GET | `/api/scores?studentId=&courseId=&semester=` | 是 | 链码 **`GetScore`** |
| GET | `/api/scores/history?studentId=&courseId=&semester=` | 是 | **`GetScoreHistory`** |
| POST | `/api/verify` | 是 | body：`studentId, courseId, semester, claimedScore` → **`VerifyScore`** |
| POST | `/api/scores` | 是 + 教务/教师 | **`PutScore`**（教师→**`PENDING`**，教务处→**`ACTIVE`**）；响应含 **`actor`** |
| POST | `/api/scores/approve` | 是 + **仅教务处** | **`ApproveScore`**（**`PENDING`→`ACTIVE`**） |
| POST | `/api/scores/correct` | 是 + 教务/教师 | **`CorrectScore`** |
| POST | `/api/scores/revoke` | 是 + 教务/教师 | **`RevokeScore`** |
| GET | `/api/scores/tx-insight?studentId=&courseId=&semester=&txId=` | 是 | 基于历史解析的**读写叙事**（教学演示） |
| GET | `/api/integrity/score-read?studentId=&courseId=&semester=` | 是 | **Org1 / Org2** 各 **`GetScore`** 后比对 JSON |
| GET | `/api/auth/fabric-identity` | 是 | 当前角色对应 **Gateway** 的签名证书 **PEM 前几行**（无私钥） |
| GET | `/api/events/stream?token=<JWT>` | 是（SSE） | 上链成功后 **Server-Sent Events** 推送（**`EventSource` 用 query 传 token**，仅演示内网） |
| POST | `/api/appeals` | 是 + **学生** | **`SubmitAppeal`**（Org2） |
| GET | `/api/appeals/open` | 是 + 教务/教师 | **`ListOpenAppeals`** |
| GET | `/api/appeals/mine?studentId=` | 是 + **学生** | **`ListMyAppeals`** |
| POST | `/api/appeals/resolve` | 是 + 教务/教师 | **`ResolveAppeal`**（body：`compositeKey`, `resolution`） |

> **链码**：**`PutScore`** 现为 **6 个字符串参数**（最后一参 **`TEACHER` | `DEAN`**）；旧版 5 参 CLI 须追加 **`DEAN`** 以保持 **ACTIVE** 直写行为。部署后请 **`npm run build`** 重启后端。

---

## curl 示例（含登录与 Bearer）

需本机安装 **`jq`**（或去掉 **`| jq .`** 直接看原文）。

```bash
# 1）健康检查（无需 token）
curl -s http://localhost:3000/api/health | jq .

# 2）登录（教务处），取 token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"jiaowuchu","password":"demo"}' | jq -r .token)

# 3）当前用户
curl -s http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq .

# 4）查询成绩
curl -s "http://localhost:3000/api/scores?studentId=2021003&courseId=PHYS101&semester=2024-3" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 5）写入（须教务/教师 token）
curl -s -X POST http://localhost:3000/api/scores \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"studentId":"2099001","courseId":"CS100","semester":"2024-9","score":88}' | jq .
```

**学生 token 写成绩（预期 403）**：

```bash
ST=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student01","password":"demo"}' | jq -r .token)

curl -s -o /dev/stderr -w "%{http_code}" -X POST http://localhost:3000/api/scores \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ST" \
  -d '{"studentId":"2099001","courseId":"CS100","semester":"2024-9","score":88}'
# 期望 HTTP 403，body 含 FORBIDDEN 类说明
```

---

## 与前端联调

- 前端 **`VITE_API_BASE`**（或 Axios **`baseURL`**）指向 **`http://<虚拟机IP>:3000`**。  
- 浏览器需先走 **`/login`**；后续请求由前端自动带 **`Authorization`**（见 **`frontend/src/api/client.ts`**）。  
- 虚拟机防火墙 / NAT 放行 **3000**；详见 **`操作说明.md`**。

---

## 常见问题

| 现象 | 处理 |
|------|------|
| **`fabricConfigured": false`** | **`FABRIC_CRYPTO_BASE`** 未设置或路径错误；在 **`backend`** 目录下重启 **`npm start`**。 |
| **`userStore":"mysql"` 且 `mysqlReachable": false`** | MySQL 地址/账号/密码/防火墙错误；或 **`CREATE DATABASE`** 权限不足（本服务会尝试自动建库）。 |
| **业务接口 401** | 未带 **`Authorization`** 或 JWT 过期；重新 **`POST /api/auth/login`**。 |
| **写接口 403（学生）** | 预期：**`requireRoles`**；换 **教务/教师** 账号。 |
| **Org2 账号报证书/连接错误** | 检查 **`org2.example.com`** 目录是否存在；**`PEER_ENDPOINT_ORG2`** 是否与 **`test-network`** 一致。 |
| **`npm run build` 类型错误** | 勿从 Windows 拷贝 **`node_modules`** 到 Linux；保持 **`@grpc/grpc-js`** 与 **`@hyperledger/fabric-gateway`** 版本与 **`package.json`** 一致。 |
| **端口占用** | **`fuser -k 3000/tcp`** 或结束旧 **`node`** 进程后重启。 |

---

## 与「高分中间件」建议的对照（取舍）

| 维度 | 说明 |
|------|------|
| **JWT + 按角色选钱包** | **已实现**：登录后 **`fabricProfileForRole`** 映射 **Org1/Org2** Gateway，与答辩「身份 → 证书」叙事一致。 |
| **链码 ABAC** | **已实现（链码侧）**：**`assertOrg1Mutate`**；部署含该逻辑的链码版本后，**Org2** 无法在链上完成写入类提案（与 Express **403** 形成纵深）。 |
| **异步 + TxID** | **已有** **`submitAsync` + `transactionId`**；可在报告画序列图。 |
| **fabric-ca 动态发证** | **`cryptogen`** 仍为静态证书；生产再接 **CA** 可在报告「扩展」中说明。 |
| **事件 / WebSocket / Swagger / Winston** | 仍为**选做**；见原表思路，按需加。 |

**一句话**：在现有 **双 Gateway + JWT + 角色路由** 基础上，链码侧 **MSP 写入校验** 已可支撑「工程化身份与权限」答辩点；其余 **Swagger、日志、事件** 按时间与 VM 资源选做即可。
