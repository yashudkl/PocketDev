# PocketDev Mobile

The Expo mobile client for PocketDev, a mobile-native cloud development environment.

## Stack

- Expo SDK 57 and React Native 0.86
- Expo Router
- Expo development client
- NativeWind
- TanStack Query and Axios
- Expo notifications, image picker, secure store, and haptics
- `llama.rn` with Metal-enabled iOS entitlements for on-device error help

## Requirements

- Node.js 20 or newer
- pnpm 10.28.2
- An Expo account with access to EAS project
  `353633f1-556d-46a1-9a50-cb14d6e45e7f`
- For a physical iPhone development build, an Apple Developer account and a
  registered device

Install dependencies from the repository root:

```bash
pnpm install
```

Copy the environment template and set the backend URL:

```bash
cp mobile/.env.example mobile/.env
```

For a physical iPhone, `EXPO_PUBLIC_API_URL` must be an HTTPS endpoint or a LAN
address reachable from the phone. `localhost` points to the phone itself.

## Development

Start Metro for the development client:

```bash
pnpm mobile:dev
```

Build the iOS development client:

```bash
pnpm exec eas build --platform ios --profile development
```

The `development` profile creates an internal-distribution development client.
Because native modules are compiled into this client, rerun the EAS build after
adding or changing a package with native iOS code or an Expo config plugin.
JavaScript-only dependency changes generally do not require rebuilding it.

## Pre-build checks

Run these from `mobile/` before submitting an EAS build:

```bash
pnpm exec expo install --check
pnpm dlx expo-doctor@latest
pnpm run typecheck
pnpm run lint
```

## App configuration

The application identity is defined in `app.json`:

- Display name: `PocketDev`
- Slug and URL scheme: `pocketdev`
- iOS bundle identifier: `com.billjeshbaidya.pocketdev`
- Android application ID: `com.pocketdev.app`

Native config plugins are registered for Router, image picking, secure storage,
notifications, Files app access, Face ID, fonts, images, splash screen, sharing,
updates, and `llama.rn`.

## Dependency audit

The mobile dependencies cover the backend and demo scope:

- Auth and API state: React Hook Form, Zod, Axios, TanStack Query, secure storage,
  AsyncStorage, and Zustand
- File editing and Git: document picker, file system, clipboard, sharing, SVG,
  WebView, and `diff`
- Terminal: React Native WebSocket, WebView, xterm.js, keyboard controller,
  keep-awake, NetInfo, and haptics
- On-device assistance: `llama.rn`, file system, and crypto checksums for
  downloaded GGUF models
- App lifecycle: development client, notifications, device/application metadata,
  and EAS Updates

React Native provides the raw WebSocket client, so a Node `ws` package or
Socket.IO client is not needed. The backend uses raw WebSocket protocols.

## Project structure

```text
mobile/
  app/             Expo Router screens and layouts
  api/             HTTP client
  components/      Shared UI
  lib/             Shared client configuration
  types/           Asset type declarations
  app.json         Expo and native application configuration
  eas.json         EAS build profiles
```
