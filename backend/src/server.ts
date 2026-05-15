import path from 'path';
import { config as loadEnv } from 'dotenv';
import cors from 'cors';
import express, { Request, Response, NextFunction } from 'express';
import {
  closeFabric,
  decodeResult,
  evaluateGetScoreJson,
  fabricProfileForRole,
  getScoreContract,
  getSignCertPemPreview,
} from './fabric';
import { requireAuth, requireRoles, requireAuthSse } from './authMiddleware';
import { signAuthToken } from './auth';
import type { AppRole } from './auth';
import {
  closeUserStore,
  initUserStore,
  isMysqlUserStore,
  pingUserStore,
  registerUser,
  tryLoginUser,
} from './userService';
import type { Contract } from '@hyperledger/fabric-gateway';
import { commitBus, emitFabricCommit, type FabricCommitPayload } from './commitBus';

loadEnv({ path: path.join(__dirname, '..', '.env') });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3000);

const writeRoles: AppRole[] = ['Academic_Affairs', 'DepartmentTeacher'];

/** 链码 PutScore 第六参：教师 → PENDING；教务处 → ACTIVE */
function putScoreActor(role: AppRole): string {
  if (role === 'DepartmentTeacher') return 'TEACHER';
  return 'DEAN';
}

async function scoreContract(req: Request): Promise<Contract> {
  if (!req.auth) {
    throw new Error('missing auth');
  }
  const profile = fabricProfileForRole(req.auth.role);
  return getScoreContract(profile);
}

app.get('/api/health', async (_req: Request, res: Response) => {
  const hasCrypto = Boolean(process.env.FABRIC_CRYPTO_BASE?.trim());
  const mysqlOn = isMysqlUserStore();
  const mysqlOk = mysqlOn ? await pingUserStore() : false;
  res.json({
    ok: true,
    service: 'score-backend',
    channel: process.env.CHANNEL_NAME || 'mychannel',
    chaincode: process.env.CHAINCODE_NAME || 'score',
    fabricConfigured: hasCrypto,
    userStore: mysqlOn ? 'mysql' : 'memory',
    mysqlReachable: mysqlOn ? mysqlOk : null,
  });
});

app.post('/api/auth/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = (req.body || {}) as { username?: string; password?: string };
    if (!username || !password) {
      res.status(400).json({ error: '缺少 username 或 password' });
      return;
    }
    const user = await tryLoginUser(String(username).trim(), String(password));
    if (!user) {
      res.status(401).json({ error: '用户名或密码错误' });
      return;
    }
    const token = signAuthToken(user);
    res.json({
      token,
      user: {
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        org: user.org,
        attributes: user.attributes,
      },
      fabricProfile: fabricProfileForRole(user.role),
    });
  } catch (e) {
    next(e);
  }
});

const REGISTER_ROLES: AppRole[] = [
  'Academic_Affairs',
  'DepartmentTeacher',
  'Student',
  'ExternalVerifier',
];

app.post('/api/auth/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = (req.body || {}) as {
      username?: string;
      password?: string;
      displayName?: string;
      role?: string;
      inviteCode?: string;
    };
    const { username, password, displayName, role, inviteCode } = body;
    if (!username || !password || !displayName || !role) {
      res.status(400).json({ error: '缺少 username、password、displayName 或 role' });
      return;
    }
    if (!REGISTER_ROLES.includes(role as AppRole)) {
      res.status(400).json({ error: `role 须为 ${REGISTER_ROLES.join(' | ')}` });
      return;
    }
    const result = await registerUser({
      username: String(username).trim(),
      password: String(password),
      displayName: String(displayName).trim(),
      role: role as AppRole,
      inviteCode: inviteCode !== undefined && inviteCode !== null ? String(inviteCode) : undefined,
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    const persist = isMysqlUserStore() ? '已写入 MySQL（app_users）' : '已写入进程内存（重启丢失）';
    res.status(201).json({
      message: `注册成功：${persist}。链上操作仍使用后端配置的固定 Gateway 证书；生产环境应对接 Fabric CA。`,
    });
  } catch (e) {
    next(e);
  }
});

app.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
  const a = req.auth!;
  res.json({
    username: a.username,
    displayName: a.displayName,
    role: a.role,
    org: a.org,
    attributes: a.attributes,
    fabricProfile: fabricProfileForRole(a.role),
  });
});

app.get('/api/scores', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId, courseId, semester } = req.query;
    if (!studentId || !courseId || !semester) {
      res.status(400).json({ error: 'missing query: studentId, courseId, semester' });
      return;
    }
    const contract = await scoreContract(req);
    const bytes = await contract.evaluateTransaction(
      'GetScore',
      String(studentId),
      String(courseId),
      String(semester),
    );
    res.type('application/json').send(decodeResult(bytes));
  } catch (e) {
    next(e);
  }
});

app.get('/api/scores/history', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId, courseId, semester } = req.query;
    if (!studentId || !courseId || !semester) {
      res.status(400).json({ error: 'missing query: studentId, courseId, semester' });
      return;
    }
    const contract = await scoreContract(req);
    const bytes = await contract.evaluateTransaction(
      'GetScoreHistory',
      String(studentId),
      String(courseId),
      String(semester),
    );
    res.type('application/json').send(decodeResult(bytes));
  } catch (e) {
    next(e);
  }
});

app.post('/api/verify', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId, courseId, semester, claimedScore } = req.body || {};
    if (!studentId || !courseId || !semester || claimedScore === undefined || claimedScore === null) {
      res.status(400).json({ error: 'missing body: studentId, courseId, semester, claimedScore' });
      return;
    }
    const contract = await scoreContract(req);
    const bytes = await contract.evaluateTransaction(
      'VerifyScore',
      String(studentId),
      String(courseId),
      String(semester),
      String(claimedScore),
    );
    res.type('application/json').send(decodeResult(bytes));
  } catch (e) {
    next(e);
  }
});

app.post(
  '/api/scores',
  requireAuth,
  requireRoles(...writeRoles),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId, courseId, semester, score } = req.body || {};
      if (!studentId || !courseId || !semester || score === undefined || score === null) {
        res.status(400).json({ error: 'missing body: studentId, courseId, semester, score' });
        return;
      }
      const contract = await scoreContract(req);
      const actor = putScoreActor(req.auth!.role);
      const commit = await contract.submitAsync('PutScore', {
        arguments: [String(studentId), String(courseId), String(semester), String(score), actor],
      });
      const status = await commit.getStatus();
      if (!status.successful) {
        res.status(502).json({
          ok: false,
          transactionId: status.transactionId,
          code: status.code,
          error: 'commit not successful',
        });
        return;
      }
      const payload: FabricCommitPayload = {
        kind: 'PutScore',
        transactionId: status.transactionId,
        at: Date.now(),
        detail: { studentId, courseId, semester, actor },
      };
      emitFabricCommit(payload);
      res.status(201).json({ ok: true, transactionId: status.transactionId, actor });
    } catch (e) {
      next(e);
    }
  },
);

app.post(
  '/api/scores/approve',
  requireAuth,
  requireRoles('Academic_Affairs'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId, courseId, semester } = req.body || {};
      if (!studentId || !courseId || !semester) {
        res.status(400).json({ error: 'missing body: studentId, courseId, semester' });
        return;
      }
      const contract = await scoreContract(req);
      const commit = await contract.submitAsync('ApproveScore', {
        arguments: [String(studentId), String(courseId), String(semester)],
      });
      const status = await commit.getStatus();
      if (!status.successful) {
        res.status(502).json({ ok: false, transactionId: status.transactionId, code: status.code });
        return;
      }
      emitFabricCommit({
        kind: 'ApproveScore',
        transactionId: status.transactionId,
        at: Date.now(),
        detail: { studentId, courseId, semester },
      });
      res.json({ ok: true, transactionId: status.transactionId });
    } catch (e) {
      next(e);
    }
  },
);

app.post(
  '/api/scores/correct',
  requireAuth,
  requireRoles(...writeRoles),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId, courseId, semester, score, remark } = req.body || {};
      if (!studentId || !courseId || !semester || score === undefined || remark === undefined) {
        res.status(400).json({ error: 'missing body: studentId, courseId, semester, score, remark' });
        return;
      }
      const contract = await scoreContract(req);
      const commit = await contract.submitAsync('CorrectScore', {
        arguments: [String(studentId), String(courseId), String(semester), String(score), String(remark)],
      });
      const status = await commit.getStatus();
      if (!status.successful) {
        res.status(502).json({ ok: false, transactionId: status.transactionId, code: status.code });
        return;
      }
      emitFabricCommit({
        kind: 'CorrectScore',
        transactionId: status.transactionId,
        at: Date.now(),
        detail: { studentId, courseId, semester },
      });
      res.json({ ok: true, transactionId: status.transactionId });
    } catch (e) {
      next(e);
    }
  },
);

app.post(
  '/api/scores/revoke',
  requireAuth,
  requireRoles(...writeRoles),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId, courseId, semester, remark } = req.body || {};
      if (!studentId || !courseId || !semester || remark === undefined) {
        res.status(400).json({ error: 'missing body: studentId, courseId, semester, remark' });
        return;
      }
      const contract = await scoreContract(req);
      const commit = await contract.submitAsync('RevokeScore', {
        arguments: [String(studentId), String(courseId), String(semester), String(remark)],
      });
      const status = await commit.getStatus();
      if (!status.successful) {
        res.status(502).json({ ok: false, transactionId: status.transactionId, code: status.code });
        return;
      }
      emitFabricCommit({
        kind: 'RevokeScore',
        transactionId: status.transactionId,
        at: Date.now(),
        detail: { studentId, courseId, semester },
      });
      res.json({ ok: true, transactionId: status.transactionId });
    } catch (e) {
      next(e);
    }
  },
);

app.get('/api/scores/tx-insight', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId, courseId, semester, txId } = req.query;
    if (!studentId || !courseId || !semester || !txId) {
      res.status(400).json({ error: 'missing query: studentId, courseId, semester, txId' });
      return;
    }
    const contract = await scoreContract(req);
    const bytes = await contract.evaluateTransaction(
      'GetScoreHistory',
      String(studentId),
      String(courseId),
      String(semester),
    );
    const raw = decodeResult(bytes);
    const list = JSON.parse(raw) as Array<{
      txId: string;
      timestampUnix: number;
      isDelete: boolean;
      record?: Record<string, unknown>;
    }>;
    const idx = list.findIndex((x) => x.txId === txId);
    if (idx < 0) {
      res.status(404).json({ error: 'txId not found in history for this key' });
      return;
    }
    const cur = list[idx];
    const prev = idx + 1 < list.length ? list[idx + 1] : null;
    const worldStateKey = `SCORE_${String(studentId)}_${String(courseId)}_${String(semester)}`;
    const readFrom = prev?.record ?? null;
    const writeTo = cur.record ?? null;
    res.json({
      txId: cur.txId,
      timestampUnix: cur.timestampUnix,
      worldStateKey,
      narrative: {
        summary: prev
          ? '本交易在仿真中读取上一版本世界状态并写入新版本（KV 单键覆盖）。'
          : '首笔写入：创建该键的世界状态。',
        readSet: readFrom
          ? [{ key: worldStateKey, valueBefore: readFrom }]
          : [{ key: worldStateKey, valueBefore: null }],
        writeSet: writeTo ? [{ key: worldStateKey, valueAfter: writeTo }] : [],
      },
      previous: prev,
      current: cur,
    });
  } catch (e) {
    next(e);
  }
});

app.get('/api/integrity/score-read', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId, courseId, semester } = req.query;
    if (!studentId || !courseId || !semester) {
      res.status(400).json({ error: 'missing query: studentId, courseId, semester' });
      return;
    }
    const s = String(studentId);
    const c = String(courseId);
    const m = String(semester);
    const org1 = await evaluateGetScoreJson('org1', s, c, m);
    const org2 = await evaluateGetScoreJson('org2', s, c, m);
    const same = org1.trim() === org2.trim();
    res.json({
      ok: same,
      message: same
        ? 'Org1 与 Org2 只读查询同一键的 JSON 一致（演示：通道内公共世界状态视图一致）。'
        : '两次读结果不一致，请检查通道/链码或节点同步（演示异常）。',
      org1Json: JSON.parse(org1),
      org2Json: JSON.parse(org2),
    });
  } catch (e) {
    next(e);
  }
});

app.get('/api/auth/fabric-identity', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = fabricProfileForRole(req.auth!.role);
    const preview = await getSignCertPemPreview(profile);
    res.json({
      profile,
      ...preview,
      note: '演示环境使用 test-network 固定 User1 磁盘证书 + 应用层 JWT 角色；生产应使用 Fabric CA 与独立登记证书。',
    });
  } catch (e) {
    next(e);
  }
});

app.get('/api/events/stream', requireAuthSse, (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof (res as Response & { flushHeaders?: () => void }).flushHeaders === 'function') {
    (res as Response & { flushHeaders: () => void }).flushHeaders();
  }
  res.write(': stream-open\n\n');
  const onCommit = (p: FabricCommitPayload) => {
    res.write(`data: ${JSON.stringify(p)}\n\n`);
  };
  commitBus.on('commit', onCommit);
  req.on('close', () => {
    commitBus.off('commit', onCommit);
  });
});

app.post(
  '/api/appeals',
  requireAuth,
  requireRoles('Student'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId, courseId, semester, reason } = req.body || {};
      if (!studentId || !courseId || !semester || !reason) {
        res.status(400).json({ error: 'missing body: studentId, courseId, semester, reason' });
        return;
      }
      const contract = await scoreContract(req);
      const commit = await contract.submitAsync('SubmitAppeal', {
        arguments: [String(studentId), String(courseId), String(semester), String(reason)],
      });
      const status = await commit.getStatus();
      if (!status.successful) {
        res.status(502).json({ ok: false, transactionId: status.transactionId, code: status.code });
        return;
      }
      emitFabricCommit({
        kind: 'SubmitAppeal',
        transactionId: status.transactionId,
        at: Date.now(),
        detail: { studentId, courseId, semester },
      });
      res.status(201).json({ ok: true, transactionId: status.transactionId });
    } catch (e) {
      next(e);
    }
  },
);

app.get('/api/appeals/open', requireAuth, requireRoles(...writeRoles), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contract = await scoreContract(req);
    const bytes = await contract.evaluateTransaction('ListOpenAppeals');
    res.type('application/json').send(decodeResult(bytes));
  } catch (e) {
    next(e);
  }
});

app.get('/api/appeals/mine', requireAuth, requireRoles('Student'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.query;
    if (!studentId) {
      res.status(400).json({ error: 'missing query: studentId' });
      return;
    }
    const contract = await scoreContract(req);
    const bytes = await contract.evaluateTransaction('ListMyAppeals', String(studentId));
    res.type('application/json').send(decodeResult(bytes));
  } catch (e) {
    next(e);
  }
});

app.post(
  '/api/appeals/resolve',
  requireAuth,
  requireRoles(...writeRoles),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { compositeKey, resolution } = req.body || {};
      if (!compositeKey || !resolution) {
        res.status(400).json({ error: 'missing body: compositeKey, resolution' });
        return;
      }
      const contract = await scoreContract(req);
      const commit = await contract.submitAsync('ResolveAppeal', {
        arguments: [String(compositeKey), String(resolution)],
      });
      const status = await commit.getStatus();
      if (!status.successful) {
        res.status(502).json({ ok: false, transactionId: status.transactionId, code: status.code });
        return;
      }
      emitFabricCommit({
        kind: 'ResolveAppeal',
        transactionId: status.transactionId,
        at: Date.now(),
      });
      res.json({ ok: true, transactionId: status.transactionId });
    } catch (e) {
      next(e);
    }
  },
);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  const msg = err instanceof Error ? err.message : String(err);
  res.status(500).json({ error: msg });
});

let server: ReturnType<typeof app.listen> | undefined;

async function shutdown(): Promise<void> {
  if (server) {
    server.close();
  }
  await closeUserStore();
  await closeFabric();
}

process.on('SIGINT', async () => {
  await shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await shutdown();
  process.exit(0);
});

async function bootstrap(): Promise<void> {
  await initUserStore();
  server = app.listen(PORT, () => {
    console.log(`score-backend listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('[server] bootstrap failed:', err);
  process.exit(1);
});
