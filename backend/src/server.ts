import path from 'path';
import { config as loadEnv } from 'dotenv';
import cors from 'cors';
import express, { Request, Response, NextFunction } from 'express';
import { closeFabric, decodeResult, getScoreContract } from './fabric';

// 始终从 backend 根目录加载 .env（避免在 ~ 等目录启动进程时读不到 .env）
loadEnv({ path: path.join(__dirname, '..', '.env') });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3000);

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

/** GET /api/scores?studentId=&courseId=&semester= */
app.get('/api/scores', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId, courseId, semester } = req.query;
    if (!studentId || !courseId || !semester) {
      res.status(400).json({ error: 'missing query: studentId, courseId, semester' });
      return;
    }
    const contract = await getScoreContract();
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

/** GET /api/scores/history?studentId=&courseId=&semester= */
app.get('/api/scores/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId, courseId, semester } = req.query;
    if (!studentId || !courseId || !semester) {
      res.status(400).json({ error: 'missing query: studentId, courseId, semester' });
      return;
    }
    const contract = await getScoreContract();
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

/** POST /api/verify  body: { studentId, courseId, semester, claimedScore } */
app.post('/api/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId, courseId, semester, claimedScore } = req.body || {};
    if (!studentId || !courseId || !semester || claimedScore === undefined || claimedScore === null) {
      res.status(400).json({ error: 'missing body: studentId, courseId, semester, claimedScore' });
      return;
    }
    const contract = await getScoreContract();
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

/** POST /api/scores  body: { studentId, courseId, semester, score } */
app.post('/api/scores', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId, courseId, semester, score } = req.body || {};
    if (!studentId || !courseId || !semester || score === undefined || score === null) {
      res.status(400).json({ error: 'missing body: studentId, courseId, semester, score' });
      return;
    }
    const contract = await getScoreContract();
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
});

/** POST /api/scores/correct  body: { studentId, courseId, semester, score, remark } */
app.post('/api/scores/correct', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId, courseId, semester, score, remark } = req.body || {};
    if (!studentId || !courseId || !semester || score === undefined || remark === undefined) {
      res.status(400).json({ error: 'missing body: studentId, courseId, semester, score, remark' });
      return;
    }
    const contract = await getScoreContract();
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
});

/** POST /api/scores/revoke  body: { studentId, courseId, semester, remark } */
app.post('/api/scores/revoke', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId, courseId, semester, remark } = req.body || {};
    if (!studentId || !courseId || !semester || remark === undefined) {
      res.status(400).json({ error: 'missing body: studentId, courseId, semester, remark' });
      return;
    }
    const contract = await getScoreContract();
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
});

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
