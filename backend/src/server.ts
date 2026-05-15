import path from 'path';
import { config as loadEnv } from 'dotenv';
import cors from 'cors';
import express, { Request, Response, NextFunction } from 'express';
import { closeFabric, decodeResult, fabricProfileForRole, getScoreContract } from './fabric';
import { requireAuth, requireRoles } from './authMiddleware';
import { signAuthToken, tryLogin } from './auth';
import type { AppRole } from './auth';
import type { Contract } from '@hyperledger/fabric-gateway';

loadEnv({ path: path.join(__dirname, '..', '.env') });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3000);

const writeRoles: AppRole[] = ['Academic_Affairs', 'DepartmentTeacher'];

async function scoreContract(req: Request): Promise<Contract> {
  if (!req.auth) {
    throw new Error('missing auth');
  }
  const profile = fabricProfileForRole(req.auth.role);
  return getScoreContract(profile);
}

app.get('/api/health', (_req: Request, res: Response) => {
  const hasCrypto = Boolean(process.env.FABRIC_CRYPTO_BASE?.trim());
  res.json({
    ok: true,
    service: 'score-backend',
    channel: process.env.CHANNEL_NAME || 'mychannel',
    chaincode: process.env.CHAINCODE_NAME || 'score',
    fabricConfigured: hasCrypto,
  });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password } = (req.body || {}) as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: '缺少 username 或 password' });
    return;
  }
  const user = tryLogin(String(username).trim(), String(password));
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
      const commit = await contract.submitAsync('PutScore', {
        arguments: [String(studentId), String(courseId), String(semester), String(score)],
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
      res.status(201).json({ ok: true, transactionId: status.transactionId });
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

const server = app.listen(PORT, () => {
  console.log(`score-backend listening on http://localhost:${PORT}`);
});

async function shutdown(): Promise<void> {
  server.close();
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
