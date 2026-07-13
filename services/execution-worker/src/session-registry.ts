import type Docker from 'dockerode';

/**
 * Bridges the two halves of the worker: the BullMQ job (which provisions a
 * container and then blocks, holding a concurrency slot = the FREE-tier pool)
 * and the PTY gateway (which the phone connects to and `docker exec`s into that
 * container). The job registers an entry; the gateway looks it up by sessionId.
 */
export interface SessionEntry {
  sessionId: string;
  jobId: string;
  userId: string;
  projectId: string;
  containerId: string;
  container: Docker.Container;
  /** Called by the gateway when the phone attaches — cancels the connect timeout. */
  attached: () => void;
  /** Called on PTY exit/kill/disconnect — resolves the job's blocking wait. */
  release: (exitCode: number) => void;
}

export class SessionRegistry {
  private readonly map = new Map<string, SessionEntry>();

  set(entry: SessionEntry): void {
    this.map.set(entry.sessionId, entry);
  }

  get(sessionId: string): SessionEntry | undefined {
    return this.map.get(sessionId);
  }

  delete(sessionId: string): void {
    this.map.delete(sessionId);
  }

  /** Poll until a session is registered (handles the phone-connects-first race). */
  async waitFor(sessionId: string, timeoutMs: number): Promise<SessionEntry | undefined> {
    const deadline = Date.now() + timeoutMs;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const entry = this.map.get(sessionId);
      if (entry) return entry;
      if (Date.now() >= deadline) return undefined;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}
