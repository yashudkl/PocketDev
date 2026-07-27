# @pocketdev/cli-agent

The lightweight CLI that runs on the developer's PC. It does the initial sync and
then pushes only changed files — after that, the PC can be off (Project Brief §4).

- **Watch:** `chokidar` (fs.watch-based, ignore list, `awaitWriteFinish`).
- **Transfer:** delta-sync modeled on rsync — compare `mtime + size + hash` against a
  server-held manifest, send only changed files over WebSocket. Protocol types live in
  `@pocketdev/shared` (`SyncClientMessage` / `SyncServerMessage` / `FileManifest`).

## Run

```bash
pnpm --filter @pocketdev/cli-agent dev -- watch ./my-project --project <projectId>
```

To link an existing folder to a project that was created in the mobile app, run:

```bash
POCKETDEV_TOKEN=<jwt> pnpm --filter @pocketdev/cli-agent exec tsx src/index.ts \
  link C:/path/to/project --project <projectId> --server http://localhost:3000
```

`link` performs the first file sync, records the absolute desktop path on the
project, initializes Git in the synced server workspace, and copies the local
repository's `origin` URL when one exists. Continue syncing changes with
`watch`. The `.git` object database itself is deliberately not uploaded.
