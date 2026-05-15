import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import type { AppRole, AuthPayload } from './auth';

interface DemoUserSeed {
  username: string;
  password: string;
  displayName: string;
  role: AppRole;
  org: string;
  attributes: Record<string, string>;
}

/** 内置演示账号（首次写入 MySQL 或内存表） */
const DEMO_USERS_SEED: DemoUserSeed[] = [
  {
    username: 'jiaowuchu',
    password: 'demo',
    displayName: '教务处管理员',
    role: 'Academic_Affairs',
    org: 'Org1MSP',
    attributes: { 'abac.role': 'Academic_Affairs', scope: 'write,read,verify' },
  },
  {
    username: 'teacher01',
    password: 'demo',
    displayName: '李教师',
    role: 'DepartmentTeacher',
    org: 'Org1MSP',
    attributes: { 'abac.role': 'teacher', scope: 'write,read' },
  },
  {
    username: 'student01',
    password: 'demo',
    displayName: '张同学',
    role: 'Student',
    org: 'Org2MSP',
    attributes: { 'abac.role': 'student', scope: 'read' },
  },
  {
    username: 'hr001',
    password: 'demo',
    displayName: '用人单位核验员',
    role: 'ExternalVerifier',
    org: 'Org2MSP',
    attributes: { 'abac.role': 'verifier', scope: 'verify,read' },
  },
];

interface MemoryUser {
  username: string;
  password: string;
  displayName: string;
  role: AppRole;
  org: string;
  attributes: Record<string, string>;
}

let pool: mysql.Pool | null = null;
let usingMysql = false;
let memoryUsers: MemoryUser[] = DEMO_USERS_SEED.map((u) => ({ ...u }));

const USERNAME_RE = /^[a-zA-Z0-9_]{4,24}$/;
const BCRYPT_ROUNDS = 10;

export type RegisterDemoResult =
  | { ok: true }
  | { ok: false; error: string };

export function isMysqlUserStore(): boolean {
  return usingMysql;
}

function demoInviteCode(): string {
  return (process.env.DEMO_REGISTRATION_INVITE || 'CHAIN-EDU-2026').trim();
}

function attrsForRole(role: AppRole): Record<string, string> {
  switch (role) {
    case 'Academic_Affairs':
      return { 'abac.role': 'Academic_Affairs', scope: 'write,read,verify' };
    case 'DepartmentTeacher':
      return { 'abac.role': 'teacher', scope: 'write,read' };
    case 'Student':
      return { 'abac.role': 'student', scope: 'read' };
    case 'ExternalVerifier':
      return { 'abac.role': 'verifier', scope: 'verify,read' };
    default:
      return {};
  }
}

function orgForRole(role: AppRole): string {
  if (role === 'Student' || role === 'ExternalVerifier') return 'Org2MSP';
  return 'Org1MSP';
}

function toPayload(row: {
  username: string;
  display_name: string;
  role: string;
  org: string;
  attributes_json: unknown;
}): AuthPayload | null {
  const role = row.role as AppRole;
  if (!['Academic_Affairs', 'DepartmentTeacher', 'Student', 'ExternalVerifier'].includes(role)) {
    return null;
  }
  let attributes: Record<string, string> = {};
  try {
    const raw = row.attributes_json;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      attributes = raw as Record<string, string>;
    } else if (typeof raw === 'string') {
      attributes = JSON.parse(raw) as Record<string, string>;
    }
  } catch {
    attributes = {};
  }
  return {
    sub: `usr:${row.username}`,
    username: row.username,
    displayName: row.display_name,
    role,
    org: row.org,
    attributes: { ...attributes },
  };
}

async function ensureSchema(): Promise<void> {
  const p = pool!;
  await p.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      username VARCHAR(64) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(128) NOT NULL,
      role VARCHAR(32) NOT NULL,
      org VARCHAR(64) NOT NULL,
      attributes_json JSON NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_username (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function seedMysqlIfEmpty(): Promise<void> {
  const p = pool!;
  const [rows] = await p.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS c FROM app_users');
  const c = Number(rows[0]?.c ?? 0);
  if (c > 0) return;
  for (const u of DEMO_USERS_SEED) {
    const hash = await bcrypt.hash(u.password, BCRYPT_ROUNDS);
    await p.execute(
      `INSERT INTO app_users (username, password_hash, display_name, role, org, attributes_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [u.username, hash, u.displayName, u.role, u.org, JSON.stringify(u.attributes)],
    );
  }
  console.log('[userService] 已向 MySQL 写入内置演示账号（密码均为 demo）');
}

/** 启动时调用：配置了 MYSQL_HOST 则连库并建表、按需种子数据；否则使用内存表 */
export async function initUserStore(): Promise<void> {
  const host = process.env.MYSQL_HOST?.trim();
  if (!host) {
    usingMysql = false;
    pool = null;
    memoryUsers = DEMO_USERS_SEED.map((u) => ({
      username: u.username,
      password: u.password,
      displayName: u.displayName,
      role: u.role,
      org: u.org,
      attributes: { ...u.attributes },
    }));
    console.log('[userService] 未设置 MYSQL_HOST，使用内存用户表（进程重启后注册数据丢失）');
    return;
  }

  usingMysql = true;
  const port = Number(process.env.MYSQL_PORT || 3306);
  const userDb = process.env.MYSQL_USER || 'root';
  const passwordDb = process.env.MYSQL_PASSWORD ?? '';
  const dbName = process.env.MYSQL_DATABASE || 'score_app';

  const bootstrapPool = mysql.createPool({
    host,
    port,
    user: userDb,
    password: passwordDb,
    waitForConnections: true,
    connectionLimit: 2,
  });
  try {
    await bootstrapPool.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName.replace(/`/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await bootstrapPool.end();
  }

  pool = mysql.createPool({
    host,
    port,
    user: userDb,
    password: passwordDb,
    database: dbName,
    waitForConnections: true,
    connectionLimit: 10,
  });

  await ensureSchema();
  await seedMysqlIfEmpty();
  console.log(`[userService] MySQL 用户库已连接: ${userDb}@${host}:${port}/${dbName}`);
}

export async function pingUserStore(): Promise<boolean> {
  if (!usingMysql || !pool) return false;
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function closeUserStore(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
  usingMysql = false;
}

export async function tryLoginUser(username: string, password: string): Promise<AuthPayload | null> {
  const u = String(username).trim();
  const pw = String(password);

  if (!usingMysql) {
    const row = memoryUsers.find((x) => x.username === u && x.password === pw);
    if (!row) return null;
    return {
      sub: `usr:${row.username}`,
      username: row.username,
      displayName: row.displayName,
      role: row.role,
      org: row.org,
      attributes: { ...row.attributes },
    };
  }

  const p = pool!;
  const [rows] = await p.execute<mysql.RowDataPacket[]>(
    'SELECT username, password_hash, display_name, role, org, attributes_json FROM app_users WHERE username = ? LIMIT 1',
    [u],
  );
  if (!rows.length) return null;
  const row = rows[0];
  const ok = await bcrypt.compare(pw, String(row.password_hash));
  if (!ok) return null;
  return toPayload({
    username: row.username,
    display_name: row.display_name,
    role: row.role,
    org: row.org,
    attributes_json: row.attributes_json,
  });
}

export async function registerUser(input: {
  username: string;
  password: string;
  displayName: string;
  role: AppRole;
  inviteCode?: string;
}): Promise<RegisterDemoResult> {
  const username = String(input.username || '').trim();
  const password = String(input.password || '');
  const displayName = String(input.displayName || '').trim();
  const role = input.role;

  if (!USERNAME_RE.test(username)) {
    return { ok: false, error: '用户名须为 4～24 位字母、数字或下划线' };
  }
  if (password.length < 6) {
    return { ok: false, error: '密码至少 6 位（演示环境）' };
  }
  if (!displayName || displayName.length > 32) {
    return { ok: false, error: '请填写显示名称（不超过 32 字）' };
  }
  if (role === 'Academic_Affairs') {
    const code = String(input.inviteCode || '').trim();
    if (code !== demoInviteCode()) {
      return {
        ok: false,
        error: '教务处注册需正确邀请码（与后端 DEMO_REGISTRATION_INVITE 或默认 CHAIN-EDU-2026 一致）',
      };
    }
  }

  const org = orgForRole(role);
  const attributes = attrsForRole(role);

  if (!usingMysql) {
    if (memoryUsers.some((x) => x.username.toLowerCase() === username.toLowerCase())) {
      return { ok: false, error: '用户名已被占用' };
    }
    memoryUsers.push({ username, password, displayName, role, org, attributes });
    return { ok: true };
  }

  const p = pool!;
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  try {
    await p.execute(
      `INSERT INTO app_users (username, password_hash, display_name, role, org, attributes_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, hash, displayName, role, org, JSON.stringify(attributes)],
    );
    return { ok: true };
  } catch (e) {
    const err = e as { code?: string; errno?: number };
    if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
      return { ok: false, error: '用户名已被占用' };
    }
    throw e;
  }
}
