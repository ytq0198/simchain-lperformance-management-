# 成绩链上存证 · 前端

Vue 3 + Vite + TypeScript + Vue Router + **Element Plus** + **Tailwind CSS** + **ECharts（vue-echarts）** + **Axios**，深色「联盟链管理后台」风格；对接仓库内 `backend/` 的 REST API。

## 配置

1. 复制或编辑 `frontend/.env.development`，将 **`VITE_API_BASE`** 设为虚拟机后端地址（含端口），例如：

   `VITE_API_BASE=http://192.168.x.x:3000`

2. 确保虚拟机上的 **`npm start`**（或等价方式）已在 **3000** 端口提供 API，且本机防火墙 / 网络可访问该地址。

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

## 说明

- 顶栏角色切换为**演示用**，不连接真实校园身份；写页面（录入 / 更正 / 作废）在路由层对非教务处、教师角色会拦截并提示。
- API 路径与请求体以 **`backend/README.md`** 为准。
- **全局 Loading**：Axios 请求期间顶部 **NProgress** 条（链上提交较慢时避免「假死」感）。
- **演示数据**：综合看板中的「近 7 日写入曲线」「区块高度」「最新区块流」、链上浏览器列表为**占位/静态演示**，答辩前可接后端 **`/api/chain/summary`** 或 Orderer 查询替换为实时数据。
