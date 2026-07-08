# Expo NativeWind Template

A reusable Expo starter with a simple tab app shell and a neutral default setup that does not assume your branding, backend, or Expo account.

## Stack

- Expo SDK 54
- Expo Router v6
- NativeWind v4
- TanStack Query v5
- Axios
- Expo Image Picker
- React Native Toast Message
- React Native SVG Transformer

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

On Windows PowerShell, use `cmd /c` if script execution is blocked:

```powershell
cmd /c npm install
cmd /c copy .env.example .env
cmd /c npm run dev
```

## Template Defaults

- The app opens into `/(tabs)/home` after a short loading state in `app/index.tsx`.
- The project does not include authentication or persisted session handling by default.
- `app.json` does not include an EAS project ID or OTA updates URL.
- No app icons or splash assets are wired by default.

## Environment

Create a `.env` file from `.env.example` and set:

```bash
EXPO_PUBLIC_API_URL=https://api.example.com
```

The shared Axios client in `api/axios.ts` fails fast when `EXPO_PUBLIC_API_URL` is missing, so fresh clones do not silently call a fake placeholder backend.

## Project Structure

```text
app/
  _layout.tsx
  index.tsx
  +not-found.tsx
  (tabs)/
    _layout.tsx
    home.tsx
    explore.tsx
    notifications.tsx
    profile.tsx
api/
  axios.ts
components/
lib/
assets/
global.css
tailwind.config.js
babel.config.js
metro.config.js
app.json
eas.json
```

## Customize Before Shipping

- Update the app identity fields in `app.json`.
- Replace the default color palette in `tailwind.config.js`.
- Add your own icons and splash assets, then reference them in `app.json`.
- Expand `api/axios.ts` with auth headers, interceptors, or other API behavior if your app needs them.
- Run `eas init` when you are ready to connect the app to your own Expo account and project.

## Notes

- `expo-router`, `nativewind`, and the SVG transformer are already configured.
- TanStack Query is wired at the app root so you can add server-state hooks without more setup.
- Toast support is already mounted in the root layout.
