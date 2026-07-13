#!/usr/bin/env node
// PocketDev PTY test client — drives a real terminal session end-to-end WITHOUT
// the mobile app, so you can verify the execution engine from a laptop.
//
//   node scripts/pty-client.mjs --email free@pocketdev.dev --password password123
//   node scripts/pty-client.mjs --email paid@pocketdev.dev --password password123 --command "node -v"
//
// It logs in, picks your first project (or --project <id>), asks the API for a
// session (POST /jobs), then connects to the PTY WebSocket it hands back (cloud
// worker OR your desktop agent, whichever the API routed to) and streams a live
// terminal. Ctrl+C to quit. Requires the repo's node_modules (run from repo root).
import WebSocket from 'ws';

const API = process.env.POCKETDEV_API || 'http://localhost:3000';
const args = parseArgs(process.argv.slice(2));

const email = args.email || 'free@pocketdev.dev';
const password = args.password || 'password123';

async function main() {
  // 1. Auth
  const login = await post(`${API}/auth/login`, { email, password });
  const token = login.accessToken;
  console.error(`[client] logged in as ${login.user.email} (${login.user.tier})`);

  // 2. Project
  let projectId = args.project;
  if (!projectId) {
    const projects = await get(`${API}/projects`, token);
    if (!projects.length) throw new Error('No projects — create one or pass --project');
    projectId = projects[0].id;
  }
  console.error(`[client] project ${projectId}`);

  // 3. Start a session (interactive if no --command)
  const body = { projectId };
  if (args.command) body.command = args.command;
  const session = await post(`${API}/jobs`, body, token);
  console.error(
    `[client] session ${session.sessionId} routed to ${session.target} → ${session.wsUrl}`,
  );

  // 4. Connect the PTY WebSocket
  const ws = new WebSocket(session.wsUrl);
  const cols = process.stdout.columns || 80;
  const rows = process.stdout.rows || 24;

  ws.on('open', () => {
    ws.send(
      JSON.stringify({
        type: 'start',
        sessionId: session.sessionId,
        projectId,
        command: args.command,
        token: session.wsToken,
        cols,
        rows,
      }),
    );
    // Pipe local keystrokes to the remote PTY.
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (d) =>
      ws.send(JSON.stringify({ type: 'input', sessionId: session.sessionId, data: d.toString() })),
    );
    process.stdout.on('resize', () =>
      ws.send(
        JSON.stringify({
          type: 'resize',
          sessionId: session.sessionId,
          cols: process.stdout.columns,
          rows: process.stdout.rows,
        }),
      ),
    );
  });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type === 'data') process.stdout.write(msg.data);
    else if (msg.type === 'ready') console.error('[client] --- session ready, streaming ---');
    else if (msg.type === 'exit') {
      console.error(`\n[client] session exited (code ${msg.exitCode})`);
      cleanup(msg.exitCode ?? 0);
    } else if (msg.type === 'error') {
      console.error(`\n[client] error: ${msg.message}`);
      cleanup(1);
    }
  });

  ws.on('close', () => cleanup(0));
  ws.on('error', (err) => {
    console.error(`[client] ws error: ${err.message}`);
    cleanup(1);
  });

  process.on('SIGINT', () => {
    ws.send(JSON.stringify({ type: 'kill', sessionId: session.sessionId }));
    cleanup(0);
  });

  function cleanup(code) {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    try {
      ws.close();
    } catch {
      /* ignore */
    }
    process.exit(code);
  }
}

// ── tiny helpers ─────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (argv[i]?.startsWith('--')) out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

async function post(url, body, token) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${url} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function get(url, token) {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${await res.text()}`);
  return res.json();
}

main().catch((err) => {
  console.error(`[client] ${err.message}`);
  process.exit(1);
});
