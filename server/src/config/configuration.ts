import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** Walk up to the monorepo root so FILE_STORE_ROOT resolves to the same absolute
 *  directory the execution worker uses (it anchors there too), regardless of cwd. */
function findRepoRoot(start: string = process.cwd()): string {
  let dir = resolve(start);
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(start);
}

export interface AppConfig {
  nodeEnv: string;
  port: number;
  jwt: {
    secret: string;
    expiresIn: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  /** On-disk store where the CLI agent's synced project files land (BUILD-PLAN
   *  Weeks 3–4). The execution worker bind-mounts subfolders of this into
   *  containers, so on the single demo VM both processes share this path. */
  fileStore: {
    root: string;
  };
  execution: {
    /** Public WebSocket URL of the cloud worker's PTY gateway, handed to the
     *  phone so it can stream a terminal (CLOUD target). */
    workerWsUrl: string;
    /** TTL of the short-lived per-session PTY token minted for the phone. */
    wsTokenTtl: string;
    /** Heartbeat freshness window: a desktop is "online" if it beat within this. */
    desktopHeartbeatWindowMs: number;
  };
  assistant: {
    apiKey?: string;
    baseUrl: string;
    model: string;
    timeoutMs: number;
  };
}

function assistantConfiguration(): AppConfig['assistant'] {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const usesGroqDefaults = !process.env.AI_API_KEY && !openRouterKey && !!groqKey;
  return {
    apiKey: process.env.AI_API_KEY || openRouterKey || groqKey || undefined,
    baseUrl:
      process.env.AI_BASE_URL ??
      (usesGroqDefaults ? 'https://api.groq.com/openai/v1' : 'https://openrouter.ai/api/v1'),
    model:
      process.env.AI_MODEL ??
      (usesGroqDefaults ? 'llama-3.3-70b-versatile' : 'meta-llama/llama-3.3-70b-instruct'),
    timeoutMs: parseInt(process.env.AI_TIMEOUT_MS ?? '60000', 10),
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-me-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  fileStore: {
    root: resolve(findRepoRoot(), process.env.FILE_STORE_ROOT ?? './.pocketdev-store'),
  },
  execution: {
    workerWsUrl: process.env.WORKER_WS_URL ?? 'ws://localhost:4100',
    wsTokenTtl: process.env.PTY_TOKEN_TTL ?? '5m',
    desktopHeartbeatWindowMs: parseInt(process.env.DESKTOP_HEARTBEAT_WINDOW_MS ?? '30000', 10),
  },
  assistant: assistantConfiguration(),
});
