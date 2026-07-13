import jwt from 'jsonwebtoken';
import type { PtyTokenClaims } from '@pocketdev/shared';

/**
 * Build a verifier for the short-lived PTY tokens the API mints. Both the worker
 * and the desktop agent share the API's JWT secret and use this to authorize a
 * WebSocket without any DB lookup — the token itself carries userId + sessionId.
 */
export function jwtVerifier(secret: string): (token: string) => PtyTokenClaims | null {
  return (token: string): PtyTokenClaims | null => {
    if (!token) return null;
    try {
      const decoded = jwt.verify(token, secret) as Partial<PtyTokenClaims>;
      if (
        decoded &&
        decoded.scope === 'pty' &&
        typeof decoded.sub === 'string' &&
        typeof decoded.sessionId === 'string' &&
        typeof decoded.projectId === 'string'
      ) {
        return {
          sub: decoded.sub,
          sessionId: decoded.sessionId,
          projectId: decoded.projectId,
          scope: 'pty',
        };
      }
      return null;
    } catch {
      return null;
    }
  };
}
