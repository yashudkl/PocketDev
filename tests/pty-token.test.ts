import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { jwtVerifier } from '../packages/pty-core/src/auth';

const SECRET = 'test-secret';
const verify = jwtVerifier(SECRET);
const claims = { sub: 'u1', sessionId: 's1', projectId: 'p1', scope: 'pty' as const };

describe('jwtVerifier (PTY WebSocket auth)', () => {
  it('accepts a valid pty-scoped token', () => {
    expect(verify(jwt.sign(claims, SECRET))).toEqual(claims);
  });

  it('rejects a token signed with a different secret', () => {
    expect(verify(jwt.sign(claims, 'other-secret'))).toBeNull();
  });

  it('rejects a token whose scope is not "pty"', () => {
    expect(verify(jwt.sign({ ...claims, scope: 'access' }, SECRET))).toBeNull();
  });

  it('rejects a token missing required claims', () => {
    expect(verify(jwt.sign({ sub: 'u1', scope: 'pty' }, SECRET))).toBeNull();
  });

  it('rejects an expired token', () => {
    expect(verify(jwt.sign(claims, SECRET, { expiresIn: -10 }))).toBeNull();
  });

  it('rejects an empty/garbage token', () => {
    expect(verify('')).toBeNull();
    expect(verify('not-a-jwt')).toBeNull();
  });
});
