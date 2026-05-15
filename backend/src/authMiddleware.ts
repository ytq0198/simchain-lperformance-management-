import type { Request, Response, NextFunction } from 'express';
import { verifyAuthToken, type AppRole } from './auth';

function bearerToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h || typeof h !== 'string') return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1] : null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const raw = bearerToken(req);
  if (!raw) {
    res.status(401).json({ error: '未登录或缺少 Authorization: Bearer <token>' });
    return;
  }
  try {
    req.auth = verifyAuthToken(raw);
    next();
  } catch {
    res.status(401).json({ error: '登录已过期或令牌无效' });
  }
}

export function requireRoles(...roles: AppRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      res.status(401).json({ error: '未登录' });
      return;
    }
    if (!roles.includes(req.auth.role)) {
      res.status(403).json({ error: '当前身份无权执行此操作', code: 'FORBIDDEN' });
      return;
    }
    next();
  };
}
