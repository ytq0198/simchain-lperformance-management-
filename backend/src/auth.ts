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
