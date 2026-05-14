# score-backend（Fabric Gateway + Express）

与 **`test-network`** 默认 **Org1 / User1** 身份连接 **`localhost:7051`**，对 **`mychannel`** 上的 **`score`** 链码提供 **REST**。

## 架构与设计要点

- **分层**：链码负责业务状态与规则；本仓库只做 **「HTTP → Contract」** 的薄层，链上仍为唯一权威源（与课程设计「链上存证」一致）。  
- **`fabric.ts`**：进程内 **单例 `Gateway` + gRPC Client`**，复用 TLS 与身份；**`getScoreContract()`** 返回 **`Contract`**，供各路由 **`evaluateTransaction` / `submitAsync`**。证书路径由 **`FABRIC_CRYPTO_BASE`** 解析，兼容 cryptogen 常见 **`signcerts/*.pem`** 命名。  
- **`server.ts`**：**`dotenv`** 固定从 **`backend/.env`** 加载（相对 **`dist/`** 的上一级），避免在 **`~`** 启动时读不到环境变量；**`/api/health`** 带 **`fabricConfigured`** 便于答辩前自检。  
- **读 / 写**：只读接口走 **`evaluateTransaction`**；写接口走 **`submitAsync`** 并检查 **`commit`** 是否成功，失败时以 JSON **`error`** 返回（可再映射中文，见下表「高分中间件」）。  
- **背书**：**`test-network`** 默认策略常涉及 **多组织**；若 **`submitAsync`** 报背书失败，需与 **`peer chaincode invoke`（双 Peer）** 对照（见下文「背书说明」）。

## 前置条件

1. 虚拟机里 **Fabric 已起**（`docker ps` 可见 orderer、peer、cli）。  
2. **`score`** 已 **commit** 到 **`mychannel`**（你当前为 **1.1 / Sequence 2** 即可）。  
3. 已安装 **Node.js ≥ 18**（`node -v`）。

## 配置

```bash
cd backend
cp .env.example .env
```

编辑 **`.env`**，将 **`FABRIC_CRYPTO_BASE`** 设为 **绝对路径**，指向：

`.../fabric-samples/test-network/organizations/peerOrganizations/org1.example.com`

示例（用户名按你机器修改）：

```env
FABRIC_CRYPTO_BASE=/home/tony/work/fabric-packages/fabric/fabric/scripts/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com
```

若 **`ls …/signcerts/cert.pem`** 提示不存在：先在 **`test-network`** 下执行 **`./network.sh up`**（会生成 **`organizations/`**）；cryptogen 常见文件名为 **`User1@org1.example.com-cert.pem`**，本仓库后端已自动在 **`signcerts/`** 下解析 **`.pem`**，无需手工改名。

## 安装与启动

```bash
cd backend
npm install
npm run build
npm start
```

默认 **`http://localhost:3000`**。

## API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/scores?studentId=&courseId=&semester=` | 链码 **`GetScore`** |
| GET | `/api/scores/history?studentId=&courseId=&semester=` | **`GetScoreHistory`** |
| POST | `/api/verify` | body JSON：`studentId, courseId, semester, claimedScore` → **`VerifyScore`** |
| POST | `/api/scores` | body：`studentId, courseId, semester, score` → **`PutScore`**；响应含 **`transactionId`** |
| POST | `/api/scores/correct` | body：`studentId, courseId, semester, score, remark` |
| POST | `/api/scores/revoke` | body：`studentId, courseId, semester, remark` |

### curl 示例

```bash
curl -s http://localhost:3000/api/health | jq .

curl -s "http://localhost:3000/api/scores?studentId=2021003&courseId=PHYS101&semester=2024-3" | jq .

curl -s -X POST http://localhost:3000/api/scores \
  -H "Content-Type: application/json" \
  -d '{"studentId":"2099001","courseId":"CS100","semester":"2024-9","score":88}' | jq .
```

## 背书说明

写交易（**`PutScore` / `CorrectScore` / `RevokeScore`**）依赖通道上的**背书策略**。若 **`submitAsync`** 报背书失败，请与 **`peer chaincode invoke`（双 org）** 对照；必要时在 Peer 上开启 **服务发现** 或使用 **Org2 身份** 另行封装（进阶）。

## 与前端联调

浏览器访问 **`http://虚拟机IP:3000`** 需在防火墙 / NAT 放行 **3000**；或前端开发机将 **`VITE_API_BASE`** / **`axios` baseURL** 指向该地址。

---

## 与「高分中间件」建议的对照（Gemini 类思路，如何取舍）

你当前栈是 **`test-network` + `cryptogen` 证书 + LevelDB + Fabric Gateway**。下面按**性价比**说明：不必把后端做成「全功能生产平台」，**选 1～3 项写进报告即可显著加分**。

| 维度 | Gemini 常见说法 | 与你当前环境的匹配度 | 建议 |
|------|----------------|----------------------|------|
| **多用户钱包 + fabric-ca 注册/登记** | 动态发证书、CA Register/Enroll | **`test-network` 用 `cryptogen`**，用户目录是**静态生成**的；再搭 **fabric-ca 流程**工作量大、易与课程脚本冲突 | **大作业可不做**。答辩话术：**「演示阶段用预置 Org 用户；生产环境再接 CA 与 KMS」**。若一定要做：单独开分支 + 大量时间。 |
| **JWT + 钱包绑定** | 登录后按用户选私钥 | 在**无 CA 动态发证**前提下，只能做「**演示用户 → 固定钱包目录**」的弱绑定 | **可选**：做一个 **`X-Demo-Role: org1|org2`** 映射到 **两套 `FABRIC_CRYPTO_BASE`**（仍用磁盘证书），**不写真实 JWT 安全模型**也能讲清思路。 |
| **异步 + TxID 快速返回** | 先返 txId，再确认入块 | 你已有 **`submitAsync` + `transactionId`**，已是正确方向 | **保留并在报告里画序列图**（请求 → txId → 前端轮询 `GetScore` 或查块高）。 |
| **事件监听 + WebSocket** | Commit 后推前端 | Fabric **Gateway / Network** 能订阅事件，但要维护**长连接与重连** | **选做**：链码里 **`SetEvent`**（若尚未加）+ 后端 **`socket.io`** 监听；**4GB VM** 注意别常驻太重。 |
| **背书/ MVCC 中文错误** | 优雅错误提示 | SDK 抛错多为英文 | **建议做**：集中 **`catch`**，用关键字映射 **`背书失败` / `版本冲突` / `链码拒绝`** 等中文 **`message`**，写进 **`项目设计.md` / 实验报告 §9**。 |
| **历史「增量」时间轴** | 对比相邻版本算 diff | 链码已返回 **`GetScoreHistory`** | **建议做**：在 **Node 里解析 JSON 数组**，相邻 **`record`** 对比 **`score`/`status`/`remark`/`operator`/`txId`**，输出 **`{ changes:[...] }`**，前端直接画时间轴。**不必改链码**。 |
| **CouchDB Rich Query** | 复杂条件检索 | 你网络是 **LevelDB**，上 Couch 要 **改 compose + 重建通道/链码** | **除非课程强制**，否则写报告：**「本实验以单键 + 历史为主；富查询需 CouchDB 索引」** 即可。 |
| **链上 SHA-256 脱敏** | 敏感字段哈希上链 | 需链码与前端字段协议一起改 | **选做加分**；与 **`项目设计.md` §3.4** 对齐再做。 |
| **OpenAPI（Swagger）** | 规范 API 文档 | 与 Express 集成成本低 | **建议做**：**`swagger-ui-express`** + **`openapi.json`**，答辩可现场点开文档页。 |
| **日志（Winston）** | 每笔 txId、操作者 | 无 ELK 也可 | **建议做**：**`winston`** 打 **`txId`、路径、耗时、错误栈`**；**不必上 ELK**。 |
| **单元测试** | Mock / 集成测试 | 链码集成需 Fabric 环境 | **可选**：对 **「历史 diff 纯函数」**写 **Jest** 单测（无需链）；集成测试保留 **`curl` 脚本**即可。 |

**一句话**：后端**不必**为了「像 Gemini 全文」而在虚拟机里堆 **CA + ELK + CouchDB**；在现有 Gateway 外包一层 **「异步语义 + 中文错误 + 历史 diff + Swagger + 日志」**，在老师眼里已经是**「会做中间件」**；其余写进 **「生产扩展」** 小节即可拿分。
