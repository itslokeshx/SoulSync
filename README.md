# SoulSync

A free, open-source music streaming experience for discovering music, building playlists, and listening together.

[![Version](https://img.shields.io/badge/version-5.1.2-blue)](https://github.com/itslokeshx/SoulSync/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Live App](https://img.shields.io/badge/demo-live-brightgreen)](https://soul-sync-beta.vercel.app)

**[Open the web app](https://soul-sync-beta.vercel.app)** · **[Download releases](https://github.com/itslokeshx/SoulSync/releases)** · **[Report a bug](https://github.com/itslokeshx/SoulSync/issues)**

---

## What is SoulSync?

SoulSync brings music discovery, personalized listening, AI-assisted playlist creation, and shared listening into one application. It runs as a web app and also ships native Android and desktop builds.

The project uses a React and TypeScript client, a Node.js/Express API, MongoDB for persistent data, and Socket.IO for live listening sessions. Music discovery and playback metadata are integrated with JioSaavn-compatible catalog APIs.

## Features

### Music discovery and playback
- Search for tracks with natural-language and intent-aware query handling.
- Search ranking considers title and artist relevance alongside listening and engagement signals.
- Browse artists, albums, related tracks, trending music, and curated home sections.
- Keep the queue going with related-track and recommendation-based playback.

### AI playlists and importing
- Generate playlists from a mood, theme, or natural-language prompt using an open-weight model through the Groq API.
- Configure multiple Groq API keys for request failover.
- Import playlist track lists from Spotify, Apple Music, YouTube Music, or plain text, then match the tracks against the available catalog.

### SoulLink: listen together
- Create a shared listening room and invite someone with a six-character room code.
- Synchronize playback and queue changes over Socket.IO.
- Chat with other participants inside the room.
- Room creation requires an authenticated account; joining supports guest users.

### Personalization and listening history
- Personalized dashboards and recommendation feeds.
- Save playlists and liked songs, follow artists, and manage listening preferences.
- Listening history and statistics power **SoulSync Wrapped**, a shareable recap of listening activity.

### App experience
- Guest and signed-in listening experiences.
- Android app built with Capacitor, including native playback and offline/download-related functionality.
- Windows and Linux desktop packages built with Electron.
- Additional features include mixes, radio, announcements, a sleep timer, and in-app feedback/support.

> Music catalog availability and playback depend on the availability and terms of the configured third-party music API.

## Platforms and downloads

| Platform | Access | Notes |
|---|---|---|
| Web | [soul-sync-beta.vercel.app](https://soul-sync-beta.vercel.app) | Use a modern browser |
| Android | [Download APK](https://sourceforge.net/projects/soulsync/files/v5.1.2/SoulSync_5.1.2.apk/download) | Android 7.0+ (API 24+) |
| Windows | [Download installer](https://sourceforge.net/projects/soulsync/files/v5.1.2/SoulSync_5.1.2.exe/download) | Windows 10/11, 64-bit |
| Linux | [Download Debian package](https://sourceforge.net/projects/soulsync/files/v5.1.2/SoulSync_5.1.2.deb/download) | Debian/Ubuntu, x86_64 |

For the latest builds, check [GitHub Releases](https://github.com/itslokeshx/SoulSync/releases).

## Architecture

```text
                         ┌────────────────────────┐
                         │      React Client      │
                         │   React + TypeScript   │
                         └───────────┬────────────┘
                                     │
               ┌─────────────────────┼──────────────────────┐
               │                     │                      │
          Web Browser          Capacitor Android       Electron Desktop
               │                     │                      │
               └─────────────────────┴──────────────────────┘
                                     │
                         REST API + Socket.IO
                                     │
                         ┌───────────▼────────────┐
                         │   Express / Node.js   │
                         │    TypeScript API     │
                         └──────┬─────────┬──────┘
                                │         │
                    ┌───────────▼──┐   ┌──▼────────────────┐
                    │  MongoDB     │   │ External services │
                    │  via Mongoose│   │ Groq / Music API  │
                    └──────────────┘   └───────────────────┘
                                │
                         ┌──────▼──────┐
                         │ Upstash     │
                         │ Redis       │
                         │ (optional)  │
                         └─────────────┘
```

### Main technologies

| Area | Technologies |
|---|---|
| Web client | React 18, TypeScript, Vite, Tailwind CSS, Zustand, TanStack Query |
| UI | Framer Motion, React Router, Lucide |
| Mobile | Capacitor 8, Android |
| Desktop | Electron, electron-builder |
| Backend | Node.js 18+, Express 4, TypeScript |
| Realtime | Socket.IO |
| Data | MongoDB, Mongoose; optional Upstash Redis |
| AI | Groq Cloud SDK, configurable open-weight model |
| Authentication | Google OAuth 2.0, local email/password, JWT, bcryptjs |
| Hosting | Vercel frontend, Render backend, MongoDB Atlas |

### Backend API modules

The Express server mounts these route groups:

| Prefix | Responsibility |
|---|---|
| `/api/auth` | Registration, login, Google sign-in, session checks, password recovery |
| `/api/search` | Search, suggestions, trending and related tracks |
| `/api/playlists` | Playlist creation and management |
| `/api/user` | Profile, preferences, liked songs, history and statistics |
| `/api/ai` | AI playlist generation and track matching |
| `/api/session` | SoulLink room creation, joining and lookup |
| `/api/dashboard` | Guest and personalized dashboards |
| `/api/mixes` | Mix discovery |
| `/api/import` | Playlist import and source detection |
| `/api/recommendations` | Personalized and next-track recommendations |
| `/api/announcements` | In-app announcements |
| `/api/radio` | Track-seeded radio |
| `/api/feedback` | User feedback and support |
| `/api/admin` | Admin operations |
| `/api/daily-mix` | Daily mixes |
| `/api/lossless` | Lossless-related endpoints |

A health check is available at `GET /health`.

### Authentication notes

- Users can sign in with Google OAuth or register with an email and password.
- Local passwords are hashed with bcryptjs before they are stored.
- The backend signs JWTs with `JWT_SECRET` and sets an HttpOnly authentication cookie.
- Native clients can send the JWT as a Bearer token; the frontend persists the native token with Capacitor Preferences.
- Guest-capable routes use optional authentication, while protected routes require a valid token.

## Run locally

### Prerequisites

- Node.js 18 or newer
- npm 9 or newer
- A MongoDB database (MongoDB Atlas works)
- A Google OAuth client if you want Google sign-in
- A Groq API key if you want AI playlist generation
- Upstash Redis is optional; the backend has an in-memory fallback for the relevant cache/rate-limit use cases

### 1. Clone and install

```bash
git clone https://github.com/itslokeshx/SoulSync.git
cd SoulSync
npm run install:all
```

### 2. Configure environment variables

Create local environment files from the examples:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

At minimum, configure the backend values needed for your setup:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign authentication tokens |
| `FRONTEND_URL` | Frontend origin allowed by the backend |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID, for Google sign-in |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret, for the backend OAuth flow |
| `GROQ_KEY_1` | Groq API key, for AI playlist features |

The frontend commonly needs:

| Variable | Purpose |
|---|---|
| `VITE_BACKEND_URL` | Express backend URL |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `VITE_DUO_BACKEND` | Optional separate Socket.IO backend URL |

The example files document optional settings for Redis, admin access, notifications, and external music API overrides. Generate your own secrets and credentials. **Never commit real `.env` files or API keys.**

### 3. Start the application

Run both development servers together from the repository root:

```bash
npm run dev
```

Or run them separately:

```bash
npm run dev:backend   # Express API: http://localhost:4000
npm run dev:frontend  # Vite client: http://localhost:5173
```

Check backend availability at [http://localhost:4000/health](http://localhost:4000/health), then open [http://localhost:5173](http://localhost:5173).

### 4. Type-check and build

From the repository root:

```bash
npm run typecheck
npm run build:backend
npm run build:frontend
```

### Build native packages

These builds require the relevant platform toolchains in addition to Node.js dependencies.

**Android debug APK:**

```bash
cd frontend
npm run apk
```

**Windows and Linux desktop packages:**

```bash
cd frontend
npm run electron:build
```

The Electron build is configured to produce a Windows NSIS installer and a Linux Debian package.

## Repository layout

```text
SoulSync/
├── backend/
│   ├── scripts/             # Diagnostics and utility scripts
│   └── src/
│       ├── data/            # Search data and entity relationships
│       ├── middleware/      # Authentication and rate limiting
│       ├── models/          # Mongoose models
│       ├── routes/          # Express route modules
│       ├── services/        # Search, AI, database and recommendation logic
│       └── socket/          # Socket.IO connection and room handlers
├── frontend/
│   ├── android/             # Capacitor Android project
│   ├── electron/            # Electron desktop entry points
│   ├── scripts/             # Build and validation scripts
│   └── src/
│       ├── api/              # Backend API client
│       ├── components/       # UI components
│       ├── hooks/            # Shared React hooks
│       ├── pages/            # Application pages
│       ├── store/            # Zustand state stores
│       └── styles/           # Global styles
├── package.json             # Workspace-level scripts
└── README.md
```

## Contributing

Contributions, bug reports, and feature suggestions are welcome.

1. Fork the repository.
2. Create a branch: `git checkout -b feat/your-change`.
3. Install dependencies with `npm run install:all`.
4. Make your change and run `npm run typecheck`.
5. Run the relevant frontend/backend build if your change affects it.
6. Commit with a clear message and open a pull request.

Conventional Commit prefixes are preferred: `feat:`, `fix:`, `docs:`, `refactor:`, `perf:`, and `chore:`.

For security-sensitive issues, avoid posting exploit details publicly. Contact the maintainer privately.

## License

SoulSync is distributed under the [MIT License](LICENSE).
