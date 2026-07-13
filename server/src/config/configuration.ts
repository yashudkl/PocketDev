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
    root: process.env.FILE_STORE_ROOT ?? './.pocketdev-store',
  },
  execution: {
    workerWsUrl: process.env.WORKER_WS_URL ?? 'ws://localhost:4100',
    wsTokenTtl: process.env.PTY_TOKEN_TTL ?? '5m',
    desktopHeartbeatWindowMs: parseInt(
      process.env.DESKTOP_HEARTBEAT_WINDOW_MS ?? '30000',
      10,
    ),
  },
});
