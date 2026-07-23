# SoulSync

Free, open-source music streaming platform with AI-generated playlists, real-time shared listening sessions, offline playback, and native Android support.

[![Stars](https://img.shields.io/github/stars/itslokeshx/SoulSync)](https://github.com/itslokeshx/SoulSync/stargazers)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](https://github.com/itslokeshx/SoulSync/blob/main/LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-live-blue)](https://soul-sync-beta.vercel.app)

[Live Demo](https://soul-sync-beta.vercel.app) · [Report a Bug](https://github.com/itslokeshx/SoulSync/issues) · [Request a Feature](https://github.com/itslokeshx/SoulSync/issues)

---

## Overview

SoulSync is a full-stack music streaming application built as an ad-free, subscription-free alternative to commercial platforms. It provides AI-assisted playlist generation, synchronized group listening, offline downloads, and listening analytics, all built on an open-source stack.

The project is currently used by roughly 180 users, with over 8,000 songs streamed to date.

## Downloads

| Platform | Link                                                                                               | Requirement  |
| -------- | -------------------------------------------------------------------------------------------------- | ------------ |
| Web      | [soul-sync-beta.vercel.app](https://soul-sync-beta.vercel.app)                                     | None         |
| Android  | [SoulSync v5.0 APK](https://github.com/itslokeshx/SoulSync/releases/download/v5.0/SoulSync_v5.apk) | Android 7.0+ |

## Features

### AI Playlist Generation

Generates playlists from natural-language prompts (e.g. "late night drive under rain") using an open-weight 120B-parameter LLM served via Groq. Supports matching pasted song lists against catalog metadata, and importing playlists from Spotify, YouTube Music, Apple Music, or plain text. Uses a multi-key rotation strategy across Groq API keys for rate-limit resilience, with a 30-minute cache layer.

### SoulLink — Shared Listening Sessions

Real-time synchronized listening rooms using WebSockets. Playback state (play/pause, seek, queue, track changes) propagates instantly to all connected participants. Rooms use six-character join codes and do not require an account. Includes in-room chat and automatic cleanup of disconnected sessions via heartbeat monitoring.

### Listening Analytics ("Wrapped")

A visual summary of listening activity — total minutes, play counts, and top tracks — computed live from stored history, presented as a shareable, story-style deck.

### Sleep Timer

Configurable playback timer with preset durations (5–60 minutes), custom minute entry, and an "end of track" mode that stops playback at the end of the current song.

### Feedback

In-app feedback submission with a history view and read-status tracking for staff replies.

## Architecture

SoulSync consists of a React frontend (web and Android, via Capacitor), an Express/Socket.io backend, and three managed data services: MongoDB Atlas for persistent storage, Upstash Redis for caching, and Groq Cloud for LLM inference.

```
┌────────────────────┐     ┌────────────────────┐
│    Web Frontend     │     │   Android (APK)     │
│  React + Zustand    │     │  React + Capacitor   │
└──────────┬───────────┘     └──────────┬───────────┘
           │        REST API + WebSocket (Socket.io)     │
           └──────────────────────┬──────────────────────┘
                                   │
                     ┌─────────────▼─────────────┐
                     │   Backend (Express 4 +    │
                     │      Socket.io 4)          │
                     │                             │
                     │  Routes: auth, search,     │
                     │  dashboard, playlist, ai,   │
                     │  import, share, session,    │
                     │  user, feedback             │
                     │                             │
                     │  Services: JioSaavn client,│
                     │  search ranker, Groq        │
                     │  integration, intent        │
                     │  parser, Redis cache        │
                     └──────┬──────┬──────┬────────┘
                            │      │      │
                 ┌──────────▼┐ ┌───▼────┐ ┌▼─────────┐
                 │ MongoDB   │ │ Redis  │ │ Groq API │
                 │ Atlas     │ │(Upstash│ │(LLM infer│
                 │           │ │)       │ │ ence)    │
                 └───────────┘ └────────┘ └──────────┘
```

**Key backend routes:**

| Route                               | Purpose                               |
| ----------------------------------- | ------------------------------------- |
| `/api/auth/google`                  | Google OAuth 2.0 login                |
| `/api/search`                       | Ranked search                         |
| `/api/dashboard`                    | Personalized/guest dashboard sections |
| `/api/playlist/*`                   | Playlist CRUD                         |
| `/api/ai/generate`, `/api/ai/match` | AI playlist generation and matching   |
| `/api/import/detect`                | External playlist import              |
| `/api/share/*`                      | Public share links                    |
| `/api/session/*`                    | SoulLink room creation and join       |
| `/api/user/*`                       | Profile, preferences, and stats       |
| `/api/feedback`                     | Feedback and support                  |

**Key Socket.io events:** `duo:join`, `duo:sync-song-change`, `duo:sync-play`, `duo:sync-seek`, `duo:message`, `duo:end-session`, `heartbeat`.

## Tech Stack

| Layer    | Technologies                                                      |
| -------- | ----------------------------------------------------------------- |
| Frontend | React 18.3, TypeScript 5.7, Vite 6.1, Tailwind CSS 3.4, Zustand 5 |
| Mobile   | Capacitor 8.1, Android API 24+                                    |
| Backend  | Node.js 18+, Express 4.21, Socket.io 4.8, TypeScript 5.7          |
| Database | MongoDB 8.9 (Mongoose), Upstash Redis                             |
| AI       | GPT OSS 120B LLM via Groq Cloud SDK, 5-key failover rotation      |
| Auth     | Google OAuth 2.0, JWT (RS256), httpOnly secure cookies            |
| Hosting  | Vercel (frontend), Render (backend), MongoDB Atlas (database)     |

## Project Structure

```
SoulSync/
├── backend/
│   └── src/
│       ├── middleware/     # auth, rate limiting
│       ├── models/         # Mongoose schemas
│       ├── routes/         # API route handlers
│       ├── services/       # business logic, integrations
│       └── socket/         # real-time event handlers
│
└── frontend/
    └── src/
        ├── api/            # backend and JioSaavn clients
        ├── capacitor/      # native Android bridge modules
        ├── components/     # UI components by domain
        ├── hooks/          # shared React hooks
        ├── store/          # Zustand state stores
        └── pages/          # top-level route pages
```

## Getting Started

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- A MongoDB Atlas instance (free tier is sufficient)
- A Google Cloud OAuth 2.0 client ID
- A Groq API key (for AI features)

### Local Setup

```bash
git clone https://github.com/itslokeshx/SoulSync.git
cd SoulSync

npm run install:all

cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env

npm run dev:backend   # Express on port 4000
npm run dev:frontend  # Vite on http://localhost:5173
```

## Contributing

Contributions are welcome, including bug reports, feature proposals, UI improvements, and documentation fixes.

1. Fork the repository and clone your fork.
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Install dependencies: `npm run install:all`
4. Make changes and verify types:
   ```bash
   cd backend && npx tsc --noEmit
   cd frontend && npx tsc --noEmit
   ```
5. Commit using [Conventional Commits](https://www.conventionalcommits.org/):

   | Prefix      | Meaning                               |
   | ----------- | ------------------------------------- |
   | `feat:`     | New feature                           |
   | `fix:`      | Bug fix                               |
   | `docs:`     | Documentation                         |
   | `style:`    | Formatting, no logic change           |
   | `refactor:` | Restructuring without behavior change |
   | `perf:`     | Performance improvement               |
   | `chore:`    | Build/dependency maintenance          |

6. Push your branch and open a pull request.

## License

Distributed under the [MIT License](https://github.com/itslokeshx/SoulSync/blob/main/LICENSE).
