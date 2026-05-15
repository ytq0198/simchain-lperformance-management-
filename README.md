# 成绩链上存证（final-project）

Hyperledger Fabric **`test-network`** 上的 **`score`** 链码 + 虚拟机 **Node 后端（REST + JWT）** + 宿主机 **Vue 3 前端**。日常**不修改业务源码**的启动顺序见根目录 **[`操作说明.md`](./操作说明.md) §〇**（Fabric → 后端 → 自检 → 前端）。

---

## 文档入口

| 文档 | 用途 |
|------|------|
| **[`操作说明.md`](./操作说明.md)** | 虚拟机与 Windows 联调的主流程、演示账号、FAQ |
| **[`项目设计.md`](./项目设计.md)** | 架构、分工、**§14.3** 联调顺序 |
| **[`实验报告.md`](./实验报告.md)** | 实验记录与取证；**§6.3.2** 日常启动 |
| **[`backend/README.md`](./backend/README.md)** | 后端 **`.env`**、API、**日常启动**、`curl` |
| **[`frontend/README.md`](./frontend/README.md)** | **`VITE_API_BASE`**、与后端联调、登录与 Bearer |
| **[`score-chaincode/README-VM.md`](./score-chaincode/README-VM.md)** | 链码 **vendor**、`deployCC`、拖拽权限 |

---

## 仓库子目录（源码）

- **`score-chaincode/`** — Go 链码  
- **`backend/`** — Express + Fabric Gateway + JWT  
- **`frontend/`** — Vite + Vue 3 + Element Plus  

**Fabric 离线包**（如 `fabric-packages/`）通常不提交远程；虚拟机按课程资源自备 **`test-network`**，与 **`操作说明.md` §二** 一致。
