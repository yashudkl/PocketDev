# PocketDev — Mobile UI/UX & Component Structure

A planning doc for the React Native (Expo + expo-router + NativeWind) app. Focus is
**component architecture** and **reference material**, not final visuals — tweak the
opinions here against your own UX judgment. Everything maps to endpoints the backend
already exposes.

> Stack in place: Expo SDK 54, expo-router 6, React 19, NativeWind 4, React Query,
> axios. Tokens already defined in `tailwind.config.js` (primary `#6C63FF`, neutral
> scale, `surface.dark #1A1A1A`, radius + z-index scales). Build on those.

---

## 1. Product tenets (what the UI must nail)

1. **Touch-first, one-handed.** Primary actions reachable by a thumb; bottom sheets over
   top nav; big hit targets. This is *not* a desktop IDE shrunk down.
2. **Dark-first.** It's a terminal tool. Design dark, offer light. The terminal/editor
   are near-black regardless of app theme.
3. **The terminal is sacred.** The single most important surface. Its keyboard accessory
   bar makes or breaks the app (see §6.1). Budget real design time here.
4. **Surface the two differentiators.** (a) *Synced from your machine* — show source +
   last-synced. (b) *Runs on your desktop when it's on* — a prominent `DESKTOP`/`CLOUD`
   chip. Nobody else does these; make them visible.
5. **Freemium is a visible experience, not a hidden flag.** Free = a queue position you can
   watch; Paid = instant. The wait itself is the upgrade pitch.
6. **Fast & glanceable.** Skeletons not spinners, optimistic writes, relative timestamps,
   status as color/dots.

---

## 2. Information architecture / navigation

Replace the generic `home / explore / notifications / profile` tabs with a project-centric
IA. Proposed expo-router structure:

```
app/
  _layout.tsx                 # providers (exists) + AuthGate (redirect if no token)
  index.tsx                   # splash → route to (auth) or (app)
  (auth)/
    _layout.tsx               # stack, headerless
    login.tsx
    register.tsx
  (app)/
    _layout.tsx               # bottom tab bar (3 tabs)
    (tabs)/
      projects.tsx            # ← home: project list
      activity.tsx            # sessions + jobs history
      settings.tsx            # account, tier/billing, desktop, model, appearance
    project/
      [id]/
        _layout.tsx           # workspace shell + segmented control (Files|Terminal|Git)
        index.tsx             # redirects to files
        files.tsx             # file tree pane
        terminal.tsx          # session list / new terminal
        git.tsx               # git panel
        editor.tsx            # full-screen code editor (?path=)
        session.tsx           # full-screen live terminal (?sessionId=)
```

**Two-level model:** global tabs (Projects / Activity / Settings) + a per-project
**workspace** with a segmented control for **Files · Terminal · Git**. Editor and live
terminal open full-screen via stack push (immersive, keyboard-heavy).

> Decision point: segmented control vs nested bottom tabs inside a project. I lean
> segmented control at the top of the workspace (keeps the global tab bar for escape),
> but nested tabs are valid — Working Copy uses a hybrid. Your call.

---

## 3. Screen-by-screen component structure

Notation: component tree + the API it consumes + the states to design (loading / empty /
error / success).

### 3.1 Auth — `login.tsx` / `register.tsx`
```
<AuthScreen>
  <Logo />
  <Heading /> <Subtext />
  <Form>
    <TextField label="Email" keyboard=email-address autoCapitalize=none />
    <PasswordField label="Password" />          # register: + name, confirm
    <FormError />                               # 401 → "Invalid credentials"
    <PrimaryButton loading>Log in</PrimaryButton>
  </Form>
  <LinkButton>New here? Create an account</LinkButton>
</AuthScreen>
```
API `POST /auth/login|register` → store `accessToken` in **expo-secure-store**; axios
interceptor attaches `Authorization: Bearer`. States: idle, submitting, error.

### 3.2 Projects — `(tabs)/projects.tsx`  *(home)*
```
<ProjectsScreen>
  <ScreenHeader title="Projects">
    <DesktopStatusChip />          # GET /desktop/status → "On your Mac" / "Cloud"
    <IconButton icon=plus />       # → CreateProjectSheet
    <AvatarButton />               # → Settings
  </ScreenHeader>
  <TierBanner />                   # free: quota used; paid: subtle badge (GET /billing/subscription)
  <RefreshControl>
    <ProjectList>                  # GET /projects
      <ProjectCard>                # name, slug, lastSyncedAt (relative), job count
        <SourceChip />             # "synced" / "not synced yet"
        <QuickActions>Terminal · Files · Git</QuickActions>
      </ProjectCard> …
    </ProjectList>
  </RefreshControl>
  <EmptyState                      # no projects
    title="No projects yet"
    body="Install the CLI agent and run `pocketdev sync` to push your first project."
    action=<CopyCommand /> />
  <FAB icon=plus />                # → CreateProjectSheet (POST /projects)
</ProjectsScreen>
```

### 3.3 Project workspace — `project/[id]/_layout.tsx`
```
<WorkspaceShell>
  <WorkspaceHeader>
    <BackButton /> <ProjectName />
    <TargetChip />                 # DESKTOP / CLOUD (from /desktop/status)
    <OverflowMenu>Settings · Delete · Copy sync cmd</OverflowMenu>
  </WorkspaceHeader>
  <SegmentedControl segments=[Files, Terminal, Git] />
  <Slot />                         # files.tsx | terminal.tsx | git.tsx
</WorkspaceShell>
```

#### Files pane — `files.tsx`
```
<FilesPane>
  <Breadcrumb />                   # current path
  <Toolbar>Search · New file · New folder · Refresh</Toolbar>
  <FileTree>                       # GET /projects/:id/files (recursive FileNode)
    <FileTreeNode dir  onPress=toggle>
      <FileTreeNode file onPress=openEditor />   # → editor.tsx?path=
    </FileTreeNode> …
  </FileTree>
  # long-press file → <FileActionsSheet>Open · Rename · Delete</FileActionsSheet>
  # swipe file → Delete (DELETE /projects/:id/file?path=)
  <EmptyState>Nothing synced here yet</EmptyState>
</FilesPane>
```

#### Editor — `editor.tsx` (full screen)
```
<EditorScreen>
  <EditorHeader>filename · SaveStateDot(saved/dirty) · CloseButton</EditorHeader>
  <EditorView />                   # WebView(CodeMirror 6). load GET file, save PUT file
  <EditorKeyBar>Tab · ⇥ · { } ( ) · " ' · / · undo · redo · find</EditorKeyBar>
</EditorScreen>
```
States: loading file, read-only (binary/too-large → 400), dirty (unsaved guard),
save error. Save = `PUT /projects/:id/file` (debounced autosave or explicit ⌘S button).

#### Terminal pane — `terminal.tsx` → live terminal `session.tsx`
```
<TerminalPane>
  <ActiveSessions />               # GET /sessions (active) → SessionRow[]
  <CommandBar placeholder="Run a command…" />   # → POST /jobs → open session.tsx
  <QuickCommands>npm test · git status · ls</QuickCommands>
</TerminalPane>

<SessionScreen>                    # full screen
  <SessionHeader>cmd · TargetChip · KillButton(POST /sessions/:id/close)</SessionHeader>
  <QueueOverlay />                 # FREE + not ready: "Waiting in queue…" + upgrade CTA
  <TerminalView />                 # WebView(xterm.js) ⇄ WebSocket(wsUrl, wsToken)
  <TerminalKeyBar />               # §6.1 — the critical control row
  <ErrorExplainerSheet />          # on non-zero exit: on-device LLM explanation
</SessionScreen>
```
Flow: `POST /jobs` → `{sessionId, target, wsUrl, wsToken}` → open WS to `wsUrl` → send
`{type:'start', sessionId, projectId, token, cols, rows}` → stream `data` → on `exit`
show code; if ≠0 trigger the explainer. Keep-alive ping ~30s (Cloudflare idle).

#### Git pane — `git.tsx`
```
<GitPane>
  <BranchChip />                   # GET /projects/:id/git/status → branch, ahead/behind
  <SubTabs>Changes · History · Branches</SubTabs>

  Changes:                          # status.files
    <GitFileRow staged toggle />   #   M/A/D badges, tap → DiffSheet (GET git/diff?path=)
    <CommitComposer>               #   message field + Commit (POST git/commit)
    <SyncRow>Pull (git/pull) · Push (git/push)</SyncRow>
  History:                          # GET git/log → CommitRow[] (hash, msg, author, date)
  Branches:                         # GET git/branches → current + list

  <EmptyState>Not a repo — Initialize (POST git/init)</EmptyState>
</GitPane>
```

### 3.4 Activity — `(tabs)/activity.tsx`
```
<ActivityScreen>
  <SubTabs>Sessions · Jobs</SubTabs>
  Sessions: GET /sessions/history → <SessionRow>(project, target, status, started)</>
  Jobs:     GET /jobs            → <JobRow>(command, StatusChip, exitCode, duration)</>
  # tap job → detail / re-run
</ActivityScreen>
```

### 3.5 Settings — `(tabs)/settings.tsx`
```
<SettingsScreen>
  <ProfileCard />                  # GET /users/me — email, name, sign out
  <Section title="Plan">
    <TierCard /> <QuotaMeter />    # GET /billing/subscription
    <UpgradeCTA />                 # POST /billing/upgrade  (demo: instant flip)
  </Section>
  <Section title="Desktop runtime">
    <DesktopStatusRow /> <LinkDesktopHelp />   # tunnel URL, how to run the agent
  </Section>
  <Section title="On-device AI">
    <ModelManager />               # download/enable GGUF model (llama.rn), size, on/off
  </Section>
  <Section title="Appearance">
    <ThemePicker>System·Dark·Light</> <TerminalThemePicker /> <FontSizeStepper />
  </Section>
</SettingsScreen>
```

---

## 4. Shared component library (design system)

Build these once; compose screens from them. Group into **primitives** and **domain**.

**Primitives**
```
Text / Heading / Mono        Button (primary|secondary|ghost|danger) / IconButton / FAB
TextField / PasswordField / TextArea / SearchInput
Card / ListItem / Section / Divider
Badge / Chip / StatusDot / ProgressBar
Avatar / Icon (@expo/vector-icons)
SegmentedControl / SubTabs / TabBar
BottomSheet (@gorhom/bottom-sheet) / Modal / ActionSheet / Menu
Skeleton / Spinner / EmptyState / ErrorState / Toast(exists)
KeyboardAccessoryBar   ← shared base for editor + terminal key rows
```

**Domain**
```
ProjectCard / SourceChip / DesktopStatusChip / TargetChip(DESKTOP|CLOUD)
FileTree / FileTreeNode / Breadcrumb / FileActionsSheet
EditorView(WebView bridge) / EditorKeyBar / SaveStateDot
TerminalView(WebView bridge) / TerminalKeyBar / QueueOverlay / QueuePositionPill
GitPanel / GitFileRow / BranchChip / CommitComposer / DiffView / CommitRow
SessionRow / JobRow / StatusChip(QUEUED|RUNNING|SUCCEEDED|FAILED)
TierCard / QuotaMeter / UpgradeCTA
ErrorExplainerCard   # renders on-device LLM output
CommandBar / QuickCommands / CopyCommand
```

---

## 5. Theming & tokens

Extend the existing `tailwind.config.js` rather than replacing it. **Updated palette
already applied** (was consumer-violet `#6C63FF` + coral — wrong register for a terminal
tool):

- **Accent (primary): cyan/teal `#22D3EE`.** Technical, infra-tool feel (Netlify/Supabase
  family), pairs with a near-black base + monospace, and stays distinct from the semantic
  greens/ambers below. Alternatives if you want to explore: **signal blue `#3B82F6`**
  (safe, VS-Code-familiar) or **warm amber `#F59E0B` on near-monochrome** (Warp-like,
  distinctive). Avoid green-as-accent — it collides with "success/online."
- **Semantic** colors added: `success` green (running/online/exit 0), `warning` amber
  (queued/dirty), `danger` red (failed/exit≠0), `info` blue. Wire `StatusChip`, online
  dots, and exit codes to these.
- **Dark-first surfaces:** `surface.dark #0D1117` + `surface.elevated #161B22` (GitHub-dark
  family) replace the old flat `#1A1A1A`.
- **Secondary** is now a calm slate `#64748B` for secondary buttons/borders on dark.
- **Terminal palette** is its own thing: near-black bg + an ANSI-16 scheme. Pick one and
  map it: **One Dark**, **Tokyo Night**, **Catppuccin**, **Dracula**, **Gruvbox**, or
  **Nord**. (Recommend Tokyo Night or One Dark — legible, well-known.)
- **Typography:** system sans for UI; a **monospace** for code + terminal — load via
  `expo-font`. Options: **JetBrains Mono**, **Fira Code**, **IBM Plex Mono**, **Cascadia
  Code**, or **SF Mono/Menlo**. (Fira Code / JetBrains Mono are safe, ligature-friendly.)
- Radius + z-index scales already exist and are good.

---

## 6. Key mobile interaction patterns

### 6.1 Terminal keyboard accessory bar (design this first)
A phone keyboard has no `Esc`, `Tab`, `Ctrl`, or arrows — a terminal is unusable without
them. Build a horizontally-scrolling accessory row pinned above the keyboard:

```
[Esc] [Tab] [Ctrl] [Alt] [↑][↓][←][→] [Ctrl+C] [|] [~] [/] [-] [paste]
```
- `Ctrl`/`Alt` are **sticky modifiers**: tap to arm, next key sends the control char (e.g.
  `Ctrl` + `c` → `\x03`). Highlight while armed.
- Send raw bytes over the WS `input` frame: arrows → ANSI escapes (`\x1b[A` …), `Tab` →
  `\t`, `Esc` → `\x1b`, `Ctrl+C` → `\x03`.
- Long-press a key → alternates (e.g. hold `/` for `\`, hold `-` for `_`).
- **This is the #1 thing to copy from Termius / Blink Shell.** Study their bars closely.

### 6.2 Other patterns
- **Gestures:** swipe-back nav; swipe-to-delete files; long-press → context menu
  (`zeego` for native menus); pull-to-refresh lists.
- **Bottom sheets** for transient actions (create project, commit, diff, upgrade, file
  actions) — keeps hands low.
- **Haptics** (`expo-haptics`) on send/commit/errors.
- **Optimistic updates** (React Query) for file save + git staging; rollback on error.
- **Freemium UX:** free session shows `QueueOverlay` ("Waiting… position N") until the WS
  sends `ready`; paid streams instantly. The overlay carries the upgrade CTA.
- **Desktop presence:** live `TargetChip`; when the desktop is online the session header
  reads "Running on your machine," else "Cloud."
- **Terminal resilience:** ping/keepalive ~30s, auto-reconnect with backoff, restore
  scrollback (Cloudflare drops idle WS ~100s).

---

## 7. Dependencies

The app is on **Expo SDK 57** (React 19.2, RN 0.86). These are **installed** (run a
development build — Expo Go can't load custom native modules):

| Need | Package | Status |
|---|---|---|
| Terminal + editor rendering | `react-native-webview` (host xterm.js + CodeMirror 6) | ✅ installed |
| JWT storage | `expo-secure-store` | ✅ installed |
| Animation (Reanimated 4 → needs worklets) | `react-native-reanimated` + `react-native-worklets` | ✅ installed |
| Gestures | `react-native-gesture-handler` | ✅ (was present) |
| Bottom sheets | `@gorhom/bottom-sheet` (v5, supports Reanimated 4) | ✅ installed |
| Haptics | `expo-haptics` | ✅ installed |
| Relative times | `date-fns` | ✅ installed |
| Native context menus | `zeego` | ⏸️ optional, add if wanted |
| On-device LLM (later phase) | `llama.rn` + a Q4_K_M GGUF model via `expo-file-system` | ⏸️ its own phase (needs a rebuild) |

**Editor/terminal decision:** host **xterm.js** (terminal) and **CodeMirror 6** (editor)
inside a single `react-native-webview` each, bridging via `postMessage`. This is the
battle-tested path and matches the build plan's xterm.js choice. Alternative editors:
`@rivascva/react-native-code-editor` (simpler, less capable) or Monaco-in-WebView
(heavier). For read-only syntax highlight only, `react-native-syntax-highlighter`.

**RN component kits worth borrowing from** (all NativeWind/Tailwind-friendly, so they
slot into your stack): **React Native Reusables** (shadcn-for-RN — best fit),
**NativeWindUI**, **gluestack-ui**, **Tamagui**.

---

## 8. UI reference — apps to study

The closest analogs first; study the **specific surface** noted, not the whole app.

### The three you should study hardest (direct analogs)
- **Termius** (iOS/Android) — *the* mobile terminal reference. Copy: the **keyboard
  accessory bar**, host/session cards, snippets, connection status. Your terminal owes it the most.
- **Working Copy** (iOS) — *the* mobile Git + files + editor reference. Copy: file tree,
  **diff view**, staging + commit flow, repo list, the in-app editor. Your Files & Git panels.
- **Replit** (mobile) — a cloud IDE crammed onto a phone: file tree + editor + console +
  run button + AI. Closest to your whole product; study how they prioritize on a small screen.

### By surface
- **Terminal:** Termius, **Blink Shell** (keyboard handling, mosh), **Warp** (desktop —
  command *blocks* + input UX), a-Shell / iSH (rendering), Ghostty/iTerm2 (themes).
- **Code editor:** **Runestone** (open-source iOS editor engine — study its editor + key
  bar), Textastic, Koder, Buffer Editor, Kodex, **GitHub** mobile code view.
- **Git client:** Working Copy, **GitHub** mobile (PR review, file viewer), GitKraken /
  Tower (history graph, staging patterns).
- **File browser:** Working Copy, iOS **Files**, **Documents** (Readdle).
- **Auth / onboarding / paywall / settings:** **Linear**, **Raycast**, **Vercel**,
  **Railway**, **PlanetScale**, **Fly.io**, **Retool Mobile** — the dev-tool visual
  language (dense, dark, calm). For the upgrade/paywall screen: RevenueCat / Superwall
  paywall galleries.
- **Dev-tool RN app itself:** **Expo Go / EAS** app.

### Inspiration libraries (you asked specifically)
- **Mobbin** (mobbin.com) — real shipped screens + flows. Search: `developer`, `terminal`,
  `code editor`, `onboarding`, `paywall`, `settings`, `empty state`, `file`, `dark mode`.
  Filter iOS/Android + dark. Best signal-to-noise for *shippable* patterns.
- **Dribbble** — search: `developer app`, `code editor mobile`, `terminal ui`,
  `devtools`, `git client`, `dashboard dark`, `SaaS mobile`. Caveat: aspirational, often
  not buildable — use for **visual direction**, not IA.
- **Behance** — full case studies (end-to-end flows + rationale).
- **Page Flows / Screenlane / UI Sources / Nicelydone / Land-book** — real product flows
  (onboarding, upgrade, empty states) captured over time.
- **Godly** (godly.website) — bold/technical aesthetics; **Collect UI** — component-level.
- **Refactoring UI** (book) — practical visual rules; maps cleanly onto your Tailwind tokens.
- **Apple HIG** + **Material 3** — platform conventions (you ship both).

---

## 9. Suggested build order

1. **Foundations:** auth (secure-store + axios interceptor), AuthGate, theming/tokens,
   the primitive component set, tab shell.
2. **Projects + Files (read):** project list, file tree, read-only viewer. Proves the API wiring.
3. **Terminal (the hard, high-value one):** WebView xterm + WS + the **key bar** + queue
   overlay. This is the demo money shot — do it early enough to iterate.
4. **Editor (write):** CodeMirror WebView + save + editor key bar.
5. **Git panel:** status → commit → push, diff, history.
6. **Settings/billing + desktop status + Activity.**
7. **On-device error explainer** (llama.rn) — last, independent of everything else.

---

*This is a starting structure, not a spec. Where I've stated a preference (segmented
control, Tokyo Night, xterm-in-WebView), treat it as a default to accept or override with
your own UX reasoning.*
