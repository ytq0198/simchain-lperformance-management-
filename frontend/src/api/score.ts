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
}): Promise<{ ok: boolean; transactionId: string }> {
  const { data } = await api.post('/api/scores', body);
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
