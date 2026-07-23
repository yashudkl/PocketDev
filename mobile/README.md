# PocketDev Mobile

PocketDev Mobile is the Expo client for the PocketDev cloud development
environment. It is a native, touch-first workspace for browsing a synced project,
editing files, running terminal commands, and handling Git from an iPhone or
Android device.

## What works

- Email registration, login, secure JWT persistence, session restoration, and
  logout
- Runtime API server selection with a `/health` connection check
- Project list, creation, workspace summary, refresh, and deletion
- Searchable file tree, file and folder deletion, text-file creation, editing,
  saving, and clipboard copy
- Real queued terminal jobs over the PocketDev raw WebSocket PTY protocol,
  including interactive input, live output, cancellation, and cloud/desktop
  target status
- Activity dashboard with job filters and live-session polling
- Git initialization, status, file diffs, commit history, commit-all, origin
  configuration, push, and pull
- Account, demo plan, runner, API, secure-session, and device-biometric status
- Optional offline explanations for failed commands with a user-imported GGUF
  model through `llama.rn`

The UI uses Expo Router, NativeWind, TanStack Query, and shared components under
`components/ui`. API calls are centralized in `api/`, and authentication,
terminal, and local-model behavior are kept out of route components.

## Requirements

- Node.js 20 or newer
- pnpm 10.28.2
- PostgreSQL and Redis for the PocketDev API
- Docker for cloud terminal execution
- An Expo account with access to EAS project
  `353633f1-556d-46a1-9a50-cb14d6e45e7f`
- For a physical iPhone development build, an Apple Developer account and a
  registered device

## Run the full local stack

From the repository root:

```bash
pnpm install
docker compose up -d
cp server/.env.example server/.env
cp mobile/.env.example mobile/.env
pnpm db:migrate
pnpm --filter @pocketdev/server db:seed
```

Then run the API, execution worker, and Metro in separate terminals:

```bash
pnpm server:dev
pnpm worker:dev
pnpm mobile:dev
```

The API defaults to `http://localhost:3000`. The cloud execution worker needs
Docker and Redis. To import an existing local repository, use the PocketDev CLI
sync agent described in the [repository-level README](../README.md). The desktop
agent is optional; when it is online with a valid tunnel, terminal jobs can run
there instead of in the cloud worker.

## Configure the API URL

`EXPO_PUBLIC_API_URL` in `mobile/.env` supplies the initial API URL:

```dotenv
EXPO_PUBLIC_API_URL=http://localhost:3000
```

The connection screen can change that URL without rebuilding the native app. It
stores the selected URL on the device and restores it on startup; a saved runtime
value takes precedence over the value compiled from `.env`. The login screen
links to this connection screen, and authenticated users can open it from
Settings.

Use the address appropriate for the device:

| Client | Typical local URL |
| --- | --- |
| iOS simulator | `http://localhost:3000` |
| Android emulator | `http://10.0.2.2:3000` |
| Physical device | `http://<computer-LAN-IP>:3000` |
| Remote/test server | `https://api.example.com` |

The phone must be able to reach the address. `localhost` on a physical phone is
the phone itself, not the development computer. Prefer HTTPS for remote and
production servers. Never put secrets in an `EXPO_PUBLIC_*` variable because
Expo embeds those values in the client bundle.

If the selected server changes, its existing JWT may not be valid on the new
server; sign out and log in against the new server when that happens.

## Develop with a custom client

From the repository root, start Metro:

```bash
pnpm mobile:dev
```

To explicitly target an installed development client:

```bash
cd mobile
pnpm exec expo start --dev-client
```

Expo Go is not enough for this project because the app includes custom native
modules such as `llama.rn` and React Native Keyboard Controller.

## Build the iOS development client

Run the EAS command from `mobile/`:

```bash
cd mobile
pnpm dlx eas-cli build --platform ios --profile development
```

If `eas-cli` is already installed globally, the equivalent command is:

```bash
eas build --platform ios --profile development
```

The `development` profile creates an internal-distribution development client.
Its app identity is:

- Display name: `PocketDev`
- Slug and URL scheme: `pocketdev`
- iOS bundle identifier: `com.billjeshbaidya.pocketdev`
- Android application ID: `com.billjeshbaidya.pocketdev`

Rebuild the development client after adding, removing, or upgrading a dependency
with native iOS code, changing an Expo config plugin, or changing native
entitlements. Normal TypeScript, NativeWind, and component changes can be loaded
through Metro without another EAS build.

## Pre-build checks

Run these from `mobile/` before spending time on an EAS build:

```bash
pnpm exec expo install --check
pnpm dlx expo-doctor@latest
pnpm run typecheck
pnpm run lint
```

An additional production-style JavaScript bundle check is:

```bash
pnpm exec expo export --platform ios --output-dir .tmp-ios-export
```

Delete that temporary export directory after inspection. Keep `pnpm-lock.yaml`
committed so EAS installs the exact dependency graph that passed these checks.

## Local GGUF assistant

Open **Settings > Local Assistant**, then choose **Import GGUF model**. PocketDev
copies the selected model into its application documents directory; the model is
not bundled in the app and is never uploaded.

A small instruct model with Q4_K_M quantization around 1-2 GB is a practical
starting point on a supported iPhone. Larger models require substantially more
storage and memory. After a terminal command exits with a non-zero status, use
**Explain locally** to pass the command, exit code, and recent output to the
on-device model. The feature works offline after the model has been imported.

Removing the model from Local Assistant settings deletes PocketDev's copied file,
not the source file selected from the Files app.

## Current workflow constraints

- A terminal WebSocket is live only while its terminal screen is connected.
  Sessions cannot yet be reattached after navigating away or losing the socket.
- Free-tier jobs can wait in the shared queue. Keep the terminal screen open
  while a job is waiting.
- The mobile editor handles backend-supported text files, with the server's
  current 2 MiB per-file limit.
- Git commit stages every changed file; per-file staging is not implemented.
- Push and pull use Git credentials configured on the PocketDev server or desktop
  runtime. The mobile app does not collect GitHub passwords or SSH keys.
- The biometric row verifies device support and can run a local authentication
  test; it is not a replacement for the server login.

## Project structure

```text
mobile/
  app/             Expo Router layouts and screens
    (auth)/        Login, registration, and server connection
    (tabs)/        Projects, activity, and settings
    projects/      Workspace, files, editor, terminal, and Git
    settings/      Local assistant and shared settings routes
  api/             Axios client and typed PocketDev endpoint wrappers
  components/      Reusable feature and UI components
  constants/       Theme tokens
  hooks/           Network and terminal-session behavior
  providers/       Authentication/session provider
  services/        Runtime API settings and local GGUF lifecycle
  types/           API and asset declarations
  utils/           Formatting, class-name, and error helpers
  app.json         Expo identity, plugins, entitlements, icon, and splash
  eas.json         EAS development, preview, and production profiles
```
