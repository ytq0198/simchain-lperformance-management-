import jwt, { type SignOptions } from 'jsonwebtoken';

export type AppRole =
  | 'Academic_Affairs'
  | 'DepartmentTeacher'
  | 'Student'
  | 'ExternalVerifier';

export interface AuthPayload {
  sub: string;
  username: string;
  displayName: string;
  role: AppRole;
  org: string;
  attributes: Record<string, string>;
}

interface DemoUser {
  username: string;
  password: string;
  displayName: string;
  role: AppRole;
  org: string;
  attributes: Record<string, string>;
}

/** 演示账号：答辩时可说明生产环境对接 Fabric CA 与 LDAP */
const DEMO_USERS: DemoUser[] = [
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

function jwtSecret(): string {
  const s = process.env.JWT_SECRET?.trim();
  if (s) return s;
  return 'dev-insecure-change-me';
}

export function signAuthToken(payload: AuthPayload): string {
  const signOpts: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || '12h') as SignOptions['expiresIn'],
  };
  return jwt.sign(
    {
      sub: payload.sub,
      username: payload.username,
      displayName: payload.displayName,
      role: payload.role,
      org: payload.org,
      attributes: payload.attributes,
    },
    jwtSecret(),
    signOpts,
  );
}

export function verifyAuthToken(token: string): AuthPayload {
  const decoded = jwt.verify(token, jwtSecret()) as jwt.JwtPayload & Omit<AuthPayload, 'sub'> & { sub: string };
  return {
    sub: String(decoded.sub),
    username: String(decoded.username),
    displayName: String(decoded.displayName ?? decoded.username),
    role: decoded.role as AppRole,
    org: String(decoded.org),
    attributes:
      decoded.attributes && typeof decoded.attributes === 'object' && !Array.isArray(decoded.attributes)
        ? (decoded.attributes as Record<string, string>)
        : {},
  };
}

export function tryLogin(username: string, password: string): AuthPayload | null {
  const u = DEMO_USERS.find((x) => x.username === username && x.password === password);
  if (!u) return null;
  return {
    sub: `demo:${u.username}`,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    org: u.org,
    attributes: { ...u.attributes },
  };
}
