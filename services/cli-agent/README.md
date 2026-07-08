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
