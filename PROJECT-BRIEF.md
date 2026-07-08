# PocketDev, Project Brief

**Course:** COMP 207, Kathmandu University, Department of Computer Science and Engineering
**Type:** Year II / Semester II project (4th semester)
**Team:** Billjesh Man Baidya, Sujan Bhatta, Yashwant Raj Dhakal, Shaikh Abdullah Nepal
**Supervisor:** Mr. Suman Shrestha

---

## 1. What It Is

PocketDev is a mobile-native cloud development environment. It lets a developer sync their local codebase off their PC, then browse, edit, run, and commit that code entirely from their phone, in a real terminal, with the PC powered off.

It is not a browser IDE shrunk onto a small screen. Everything is built touch-first as a native React Native app, with actual command execution happening inside isolated containers, either on a cloud VM or on the developer's own desktop when it's online.

One line: **your dev machine in your pocket, running real code, no laptop required.**

## 2. The Problem

Software development is still chained to a laptop. Phones have the raw power and the ubiquity, but no tool treats mobile as a first-class platform for actual development work.

The existing options each solve only a slice:

- GitHub Codespaces, Gitpod, Replit: browser IDEs designed for desktop, degraded and awkward on a phone, and metered by paid compute.
- Termius: good SSH client, but you bring your own server and get no file editing, Git panel, or assistance.
- Working Copy: solid iOS Git client, but no code execution or terminal at all.

Nothing combines file management, a real terminal, and Git in one native mobile app. And every cloud option bills ongoing compute, which prices out students and independent developers in regions where that's real money.

## 3. Who It's For

- Students and independent developers who don't always have a laptop on them but want to make a real fix, run a build, or push a commit from their phone.
- People in cost-sensitive regions who can't justify per-hour cloud IDE pricing.
- Anyone who wants to keep working against their own machine remotely without setting up SSH, port forwarding, or a VPN by hand.

## 4. What It Does

- **Sync once, then go untethered.** A lightweight CLI agent on the PC does an initial sync and pushes only changed files after that. Once synced, the PC can be off.
- **Real file editing on mobile.** Native file browser and a touch-optimized code editor, not a desktop editor forced onto a phone.
- **A real terminal, not a fake one.** Commands run in a genuine pseudo-terminal inside an isolated container, with live output (progress bars, prompts, long-running processes) streamed to the phone over WebSocket.
- **Git from the phone.** Commit, push, pull, diff, and branch operations in a dedicated panel.
- **Run locally or in the cloud.** When the developer's desktop is on, execution routes to that machine. When it's off, it falls back to the cloud VM. The phone reaches the desktop through a tunnel, so no manual networking setup.
- **On-device error help.** A small language model runs on the phone itself and explains errors in plain language when a command fails, with no internet call required.
- **Free and paid tiers.** Free users share a job queue; paid users get a dedicated container with instant execution.

## 5. How It Works (High Level)

1. Install the CLI agent on the PC and link a project folder. It syncs to per-user storage on the backend.
2. Open the mobile app, log in, and see the project. The PC can now be off.
3. Edit files, then hit run or build.
4. The job is scheduled through a Redis + BullMQ queue. Free tier waits in line; paid tier runs immediately.
5. An isolated container spins up, runs the command in a real terminal session, and streams output live to the phone.
6. If it fails, the on-device model explains why. Git actions can be done straight from the app.
7. Execution targets the developer's own desktop if it's online, otherwise the cloud VM.

## 6. Tech Stack (Summary)

| Layer | Technology |
|---|---|
| Mobile app | React Native + Expo |
| Backend | NestJS (modular monolith + one separate execution worker) |
| Database | PostgreSQL with Prisma |
| Queue / ephemeral state | Redis + BullMQ |
| Terminal execution | node-pty inside Docker, streamed over WebSocket |
| CLI sync agent | Node.js with chokidar and delta sync |
| Local-to-phone connection | Cloudflare Tunnel (demo), Tailscale (production path) |
| On-device AI | Quantized GGUF model via llama.rn |
| Container isolation | Hardened Docker + gVisor |
| Demo host | Oracle Cloud Free Tier ARM VM |

The full technical reasoning behind each of these choices lives in the separate build plan document.

## 7. What Makes It Different

| | Codespaces / Gitpod / Replit | Termius | Working Copy | **PocketDev** |
|---|---|---|---|---|
| Native mobile, touch-first | No | Yes | Yes | **Yes** |
| Real terminal execution | Yes (browser) | Yes | No | **Yes** |
| File editing | Yes | No | Yes | **Yes** |
| Git workflow | Yes | No | Yes | **Yes** |
| Syncs from your existing local codebase | No | No | No | **Yes** |
| Runs on your own machine when it's on | No | No | No | **Yes** |
| Zero recurring cost path | No | No | No | **Yes** |

The two things nobody else does: sync from an existing local codebase, and route execution back to the developer's own desktop.

## 8. Scope

**In scope for the demo:**
A working end-to-end system running 1 to 2 accounts on a single free-tier VM: CLI sync, mobile file editing, real terminal execution over WebSocket, Git operations, local-vs-cloud execution routing, on-device error explanation, and a visible free-vs-paid tier difference. This is a college project demo, not a hosted product, so scale is deliberately not a goal here.

**Documented but not built (production blueprint):**
The honest story for what production would take: managed database and Redis, a fleet of execution nodes, microVM isolation (Firecracker or Kata) for safely running untrusted code, egress filtering, cost modeling, and the security posture real cloud IDE companies use. This is covered in the build plan and is meant to be presented, not implemented for the demo.

## 9. Timeline

14 weeks, phased: foundations and backend setup, then the CLI sync agent, then the execution engine, then hardened isolation, then the local-desktop runtime feature, then Git and the on-device model, then polish and tier enforcement, and finally the production blueprint writeup and demo prep. The detailed week-by-week breakdown is in the build plan.

## 10. Definition of Done

The demo succeeds if, from a phone, with the PC off:

- A file can be edited and saved.
- A command can be run in a real terminal and its live output seen.
- A commit can be pushed.
- The same command can be routed to the developer's own desktop when it's on, and fall back to the VM when it's off.
- A failed command gets an on-device explanation.
- The free tier visibly queues while the paid tier runs immediately.

If all of that works on one VM with a couple of accounts, the project has proven its core thesis: real development, on a phone, without a laptop.