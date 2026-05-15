# 在虚拟机上部署 score 链码前（必做顺序）

**链码已提交到通道后**，启动 **Node 后端** 与 **宿主机前端** 的推荐顺序见根目录 **`操作说明.md` §〇**（**Fabric → 后端 → 自检 → 前端**），并与 **`backend/README.md`**、**`frontend/README.md`** 中「日常启动 / 联调顺序」一致；当日未改链码逻辑时**不必**重复 **`deployCC`**。

---

## 宿主机拖拽到 `~/work` 时：权限怎么一劳永逸

从 Windows **拖进 VMware** 的文件夹，经常出现**目录没有写权限**（`dr-xr-xr-x`），于是 **`go mod vendor`** 无法创建 **`vendor/`**。这与是否「共享文件夹」无关，是拖拽/拷贝带来的 **Unix 权限丢失**。

### 做法 A（推荐，真正一劳永逸）

在虚拟机里用 **Git** 拿代码，不要在资源管理器里拖整个项目：

- Windows：在仓库里正常改代码 → **`git push`** 到远程（或局域网裸仓库）。
- 虚拟机：`git clone … ~/work/final-project` 或已有仓库则 **`git pull`**。

这样文件/目录权限由 Linux 和 Git 管理，**一般不会再出现**「目录不可写」问题。

### 做法 B（仍要拖拽时：一条命令，不必手敲长 chmod）

1. 在虚拟机 **`~/.bashrc`** 末尾追加：

```bash
fixwork() {
  local d="${1:-$HOME/work}"
  [ -d "$d" ] || { echo "not a directory: $d"; return 1; }
  find "$d" -type d -exec chmod u+rwx {} +
  find "$d" -type f -exec chmod u+rw {} +
  echo "fixed permissions under $d"
}
```

2. 执行 **`source ~/.bashrc`**。

3. **每次从宿主机拖完/覆盖完代码后**，在虚拟机终端执行一次：

```bash
fixwork              # 默认修复整个 $HOME/work
# 或只修链码目录：
# fixwork ~/work/score-chaincode
```

之后照常 **`go mod tidy`**、**`go mod vendor`** 即可。

---

### 做法 C（不配置 `fixwork` 时）：每次拖拽后用手动 chmod

若尚未把 **`fixwork`** 写进 **`~/.bashrc`**，从宿主机拖完代码后至少执行一次（再去做下面的「步骤 1」）：

```bash
chmod -R u+w ~/work/score-chaincode
# 或整个工作区：
# chmod -R u+w ~/work
ls -ld ~/work/score-chaincode   # 确认目录为 drwx...（含 w）
```

---

## 拖到 **`~/work`（文件管理器里常显示为 Home/work）** 时的约定

在 Linux 里 **`~/work`** 与 **`/home/你的用户名/work`** 是**同一路径**（例如 **`/home/tony/work`**）。你把 **`backend`、`score-chaincode`、`fabric-packages`** 拖到这里时，建议固定成：

| 拖入内容 | 虚拟机上的路径 |
|----------|----------------|
| 后端 | **`~/work/backend`** |
| 链码 | **`~/work/score-chaincode`** |
| Fabric 样本与网络 | **`~/work/fabric-packages/.../fabric-samples/test-network`** |

下面「拖拽 backend」与上文 **`fixwork`** / **`chmod`** 均按 **`~/work/...`** 来写。

---

## 拖拽 `backend/` 到 **`~/work/backend`** 后（除权限外多出来的几步）

与 **`score-chaincode`** 一样，从 Windows 拖进 **`~/work/backend`** 后，**权限**仍建议 **`fixwork ~/work`**（整区修一次）或 **`fixwork ~/work/backend`**；并额外注意：

| 步骤 | 说明 |
|------|------|
| **属主** | 若 **`npm install` / `rm node_modules`** 报 **EACCES**：**`sudo chown -R $USER:$USER ~/work/backend`** 后再装依赖。 |
| **不要拖 Windows 里的 `node_modules`** | 在虚拟机里 **`rm -rf ~/work/backend/node_modules`** 后执行 **`npm install`**；否则易出现权限混乱或 **`@grpc/grpc-js`** 与 **`fabric-gateway`** 类型/版本不一致。 |
| **`.env`** | 拖完后检查 **`~/work/backend/.env`** 是否还在、**`FABRIC_CRYPTO_BASE`** 是否指向 **`~/work/fabric-packages/.../test-network/organizations/peerOrganizations/org1.example.com`** 的**绝对路径**（不要用 Windows 盘符）。若丢失：**`cd ~/work/backend && cp .env.example .env`** 再填。 |
| **启动方式** | 使用仓库里已加固的 **`server.ts`**（**`npm run build`** 后）：**`.env`** 会相对 **`dist/`** 加载；仍建议 **`cd ~/work/backend && npm start`**。健康检查里的 **`fabricConfigured`** 应为 **`true`**。 |
| **链码目录** | 若 **`score-chaincode`** 在 **`~/work/score-chaincode`**，改链码后仍在 **`test-network`** 下 **`deployCC -ccp "$HOME/work/score-chaincode"`**，并在链码目录执行 **`go mod tidy` + `vendor`**（权限同上）。 |

---

## Docker：`permission denied` 连不上 daemon（`/var/run/docker.sock`）

**现象**：执行 **`docker ps`** 或 **`./network.sh up`** 时出现  
`permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock`。

**原因**：当前用户不在 **`docker`** 组，或**已加组但当前终端会话未刷新组信息**，无法读写 **`docker.sock`**。

### 一次性配置（推荐）

1. 将用户加入 **`docker`** 组（**`tony` 改为你的用户名**）：

```bash
sudo usermod -aG docker tony
```

2. 确认组里已有该用户：

```bash
getent group docker
```

行末应出现 **`tony`**（或你的用户名）。

3. **让组权限生效**（任选其一，**推荐都做**）：

   - **注销 Ubuntu 再登录**（图形界面：电源菜单 → **Log Out**；不要用 Suspend）；或 **SSH 断开重连**。  
   - 若暂时不想注销，在当前终端执行：

```bash
newgrp docker
```

4. **不要加 `sudo`**，验证：

```bash
docker ps
```

能列出容器（或空列表且无 `permission denied`）即正常。

### 仍报错时检查 socket

```bash
ls -l /var/run/docker.sock
```

常见为 **`root docker`**、权限 **`srw-rw----`**。若属组不对，可执行：

```bash
sudo chown root:docker /var/run/docker.sock
sudo chmod 660 /var/run/docker.sock
sudo systemctl restart docker
```

### 与 Fabric 脚本的关系

- **`./network.sh`** 会调 **`docker`** / **`docker-compose`**，须与 **`docker ps`** 在**同一类权限环境**下运行。  
- **新开终端**若仍报 **`permission denied`**，先执行 **`groups`** 看是否含 **`docker`**；没有则再 **注销登录**一次，或在该终端执行 **`newgrp docker`** 后再进 **`test-network`**。

---

**以下步骤从 1 开始；凡从 Windows 拖拽覆盖过 `~/work` 下文件，建议先做上文「拖拽与权限」或本段 `chmod`。**

1. **`go.mod` 中的 `go` 版本须与打包环境一致**（建议 **`go 1.18`**，与 Fabric 2.4 **ccenv** 及本机 `go mod vendor` 一致）。若出现 **`inconsistent vendoring` / `not marked as explicit in vendor/modules.txt`**：在链码目录删除 **`vendor/`** 后执行 **`go mod tidy`** 再 **`go mod vendor`**，勿混用旧版 **`go 1.14`** 与新版 Go 生成的 **`vendor`**。

2. **PATH 必须用 Go 1.18**（与 Fabric ccenv 一致）：

   `export PATH="/usr/local/go118/bin:$PATH"`

3. **必须先 `tidy`，再 `vendor`**。若 `go mod vendor` 提示 `updates to go.mod needed`，**不要**跳过 tidy 直接去跑 `./network.sh deployCC`。

```bash
cd ~/work/score-chaincode
rm -rf vendor
go mod tidy
go mod vendor
```

4. 确认 `vendor/` 目录存在且非空后，再执行 `test-network` 里的：

```bash
cd ~/work/fabric-packages/fabric/fabric/scripts/fabric-samples/test-network
rm -f score.tar.gz log.txt
./network.sh deployCC -ccn score -ccp "$HOME/work/score-chaincode" -ccl go
```

## 部署后用 `peer` 验证（注意 JSON 格式）

`fabric-contract-api-go` 链码在 **`peer chaincode invoke` / `query`** 下请使用 **`Args` 数组**，**首元素为函数名**（与 `asset-transfer-basic` 示例一致）。不要使用 `{"function":"PutScore","Args":[…]}`，否则可能出现 **invoke 显示成功但查询 not found** 的现象。

```bash
cd ~/work/fabric-packages/fabric/fabric/scripts/fabric-samples/test-network
export PATH="${PWD}/../bin:${PATH}"
export FABRIC_CFG_PATH="${PWD}/../config"
source ./scripts/envVar.sh && setGlobals 1

peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile "${PWD}/organizations/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem" \
  -C mychannel -n score \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/tlsca/tlsca.org1.example.com-cert.pem" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/tlsca/tlsca.org2.example.com-cert.pem" \
  -c '{"Args":["PutScore","2021001","MATH101","2024-1","88"]}'

peer chaincode query -C mychannel -n score \
  -c '{"Args":["GetScore","2021001","MATH101","2024-1"]}'
```

## 链码升级（已有 score 1.0 / sequence 1 时）

改代码后重新 **`tidy` + `vendor`**，再升版（版本号与序号按你当前 `querycommitted` 递增，下例为 **1.1 / sequence 2**）：

```bash
cd ~/work/fabric-packages/fabric/fabric/scripts/fabric-samples/test-network
./network.sh deployCC -ccn score -ccp "$HOME/work/score-chaincode" -ccl go -ccv 1.1 -ccs 2
```

若脚本参数名不同，以 `network.sh deployCC --help` 为准。

## 新增接口（企业化：更正 / 作废 / 历史 / 验真）

与 `PutScore` 相同，**一律使用 `{"Args":["函数名", ...]}`**。双组织写操作（`invoke`）仍须带 **两个 peer** 的 `--peerAddresses`（与上节一致，以下省略）。

```bash
# 更正分数（备注可写中文）
peer chaincode invoke ... \
  -c '{"Args":["CorrectScore","2021001","MATH101","2024-1","92","期中复核更正"]}'

# 作废（链上状态变为 REVOKED，键不删除）
peer chaincode invoke ... \
  -c '{"Args":["RevokeScore","2021001","MATH101","2024-1","录入错误作废"]}'

# 历史溯源（JSON 数组，含 txId、timestampUnix、record）
peer chaincode query -C mychannel -n score \
  -c '{"Args":["GetScoreHistory","2021001","MATH101","2024-1"]}'

# 验真：声称分数与链上 ACTIVE 是否一致
peer chaincode query -C mychannel -n score \
  -c '{"Args":["VerifyScore","2021001","MATH101","2024-1","92"]}'
```

**说明**：`GetScore` 返回的 JSON 含 **`status`**（`ACTIVE`/`REVOKED`）、**`operator`**（MSP，如 `Org1MSP`）、**`updatedAt`**、**`remark`**。旧账本数据若仅有旧字段，查询时会把缺省 `status` 视为 **`ACTIVE`**。
