import { api } from './client';

export interface HealthResponse {
  ok: boolean;
  service: string;
  channel: string;
  chaincode: string;
  fabricConfigured?: boolean;
}

export interface ScoreRecord {
  studentId: string;
  courseId: string;
  semester: string;
  score: number;
  status: string;
  updatedAt: number;
  operator: string;
  remark: string;
}

export interface HistoryEntry {
  txId: string;
  timestampUnix: number;
  isDelete: boolean;
  record: ScoreRecord;
}

export interface VerifyResponse {
  match: boolean;
  reason: string;
  current?: number;
  status?: string;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>('/api/health');
  return data;
}

export async function fetchScore(
  studentId: string,
  courseId: string,
  semester: string,
): Promise<ScoreRecord> {
  const { data } = await api.get<ScoreRecord>('/api/scores', {
    params: { studentId, courseId, semester },
  });
  return data;
}

export async function fetchHistory(
  studentId: string,
  courseId: string,
  semester: string,
): Promise<HistoryEntry[]> {
  const { data } = await api.get<HistoryEntry[]>('/api/scores/history', {
    params: { studentId, courseId, semester },
  });
  return data;
}

export async function postVerify(body: {
  studentId: string;
  courseId: string;
  semester: string;
  claimedScore: number;
}): Promise<VerifyResponse> {
  const { data } = await api.post<VerifyResponse>('/api/verify', body);
  return data;
}

export async function postScore(body: {
  studentId: string;
  courseId: string;
  semester: string;
  score: number;
}): Promise<{ ok: boolean; transactionId: string; actor?: string }> {
  const { data } = await api.post('/api/scores', body);
  return data;
}

export async function postApproveScore(body: {
  studentId: string;
  courseId: string;
  semester: string;
}): Promise<{ ok: boolean; transactionId: string }> {
  const { data } = await api.post('/api/scores/approve', body);
  return data;
}

export interface TxInsightResponse {
  txId: string;
  timestampUnix: number;
  worldStateKey: string;
  narrative: {
    summary: string;
    readSet: Array<{ key: string; valueBefore: unknown }>;
    writeSet: Array<{ key: string; valueAfter: unknown }>;
  };
  previous: unknown;
  current: unknown;
}

export async function fetchTxInsight(params: {
  studentId: string;
  courseId: string;
  semester: string;
  txId: string;
}): Promise<TxInsightResponse> {
  const { data } = await api.get<TxInsightResponse>('/api/scores/tx-insight', { params });
  return data;
}

export async function fetchIntegrityScoreRead(params: {
  studentId: string;
  courseId: string;
  semester: string;
}): Promise<{ ok: boolean; message: string; org1Json: unknown; org2Json: unknown }> {
  const { data } = await api.get('/api/integrity/score-read', { params });
  return data;
}

export interface AppealListItem {
  compositeKey: string;
  appeal: {
    studentId: string;
    courseId: string;
    semester: string;
    reason: string;
    status: string;
    resolution?: string;
    createdAt: number;
    resolvedAt?: number;
  };
}

export async function fetchOpenAppeals(): Promise<AppealListItem[]> {
  const { data } = await api.get<AppealListItem[]>('/api/appeals/open');
  return data;
}

export async function fetchMyAppeals(studentId: string): Promise<AppealListItem[]> {
  const { data } = await api.get<AppealListItem[]>('/api/appeals/mine', { params: { studentId } });
  return data;
}

export async function postAppeal(body: {
  studentId: string;
  courseId: string;
  semester: string;
  reason: string;
}): Promise<{ ok: boolean; transactionId: string }> {
  const { data } = await api.post('/api/appeals', body);
  return data;
}

export async function postResolveAppeal(body: {
  compositeKey: string;
  resolution: string;
}): Promise<{ ok: boolean; transactionId: string }> {
  const { data } = await api.post('/api/appeals/resolve', body);
  return data;
}

export async function fetchFabricIdentity(): Promise<{
  profile: string;
  mspId: string;
  certPath: string;
  pemPreview: string;
  note: string;
}> {
  const { data } = await api.get('/api/auth/fabric-identity');
  return data;
}

export async function postCorrect(body: {
  studentId: string;
  courseId: string;
  semester: string;
  score: number;
  remark: string;
}): Promise<{ ok: boolean; transactionId: string }> {
  const { data } = await api.post('/api/scores/correct', body);
  return data;
}

export async function postRevoke(body: {
  studentId: string;
  courseId: string;
  semester: string;
  remark: string;
}): Promise<{ ok: boolean; transactionId: string }> {
  const { data } = await api.post('/api/scores/revoke', body);
  return data;
}
