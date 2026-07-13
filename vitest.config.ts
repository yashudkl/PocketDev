import { defineConfig } from 'vitest/config';

// Infra-free unit tests (no DB/Redis/Docker) over the pure, security- and
// correctness-critical logic. Integration flows are verified separately against
// real Docker/Postgres/Redis (see README → Verification).
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
