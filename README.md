# SoulSync

Free, open-source music streaming platform with natural language search, AI-generated playlists, real-time shared listening rooms, listening analytics, and native Android support.

[![Stars](https://img.shields.io/github/stars/itslokeshx/SoulSync)](https://github.com/itslokeshx/SoulSync/stargazers)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](https://github.com/itslokeshx/SoulSync/blob/main/LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-live-blue)](https://soul-sync-beta.vercel.app)

[Live Demo](https://soul-sync-beta.vercel.app) · [Report a Bug](https://github.com/itslokeshx/SoulSync/issues) · [Request a Feature](https://github.com/itslokeshx/SoulSync/issues)

---

## Overview

SoulSync is a full-stack music streaming platform engineered as an ad-free, subscription-free alternative to commercial streaming services. It combines an intelligent intent-aware search engine, automated recommendation pipelines, LLM-powered playlist generation, real-time synchronized listening rooms, and detailed user listening analytics.

The application serves both web clients and native Android devices via Capacitor, providing continuous audio streaming, offline playback management, and cross-platform synchronization.

---

## Downloads & Access

| Platform | Download Link | Requirement |
| :--- | :--- | :--- |
| **Web Application** | [soul-sync-beta.vercel.app](https://soul-sync-beta.vercel.app) | Modern Browser |
| **Android Client** | [SoulSync_5.1.1.apk](https://sourceforge.net/projects/soulsync/files/v5.1.1/SoulSync_5.1.1.apk/download) | Android 7.0+ (API 24+) |
| **Windows Desktop** | [SoulSync_5.1.1.exe](https://sourceforge.net/projects/soulsync/files/v5.1.1/SoulSync_5.1.1.exe/download) | Windows 10/11 (64-bit) |
| **Linux (Debian/Ubuntu)** | [SoulSync_5.1.1.deb](https://sourceforge.net/projects/soulsync/files/v5.1.1/SoulSync_5.1.1.deb/download) | Debian / Ubuntu (x86_64) |

---

## Core Capabilities

### 1. Intent-Aware Natural Language Search
SoulSync includes a specialized search engine optimized for human search behavior rather than strict keyword matching:
- **Entity Relationship Graph**: Traverses relationships across Directors, Actors, Movies, Soundtracks, and Artists (e.g., *Christopher Nolan* $\rightarrow$ *The Odyssey*, *Oppenheimer*, *Interstellar*; *Rajinikanth* $\rightarrow$ *Coolie*, *Jailer*, *Vettaiyan*).
- **Natural Language Parsing**: Infers user intent for queries such as `"songs from nolan movie"`, `"latest anirudh"`, `"that pushpa song"`, `"new tamil hit"`, `"best gym songs"`, and `"movie bgm"`.
- **Typo Resilience**: Uses Damerau-Levenshtein edit distance and phonetic mapping to resolve misspellings (*"odessy"*, *"hukm"*, *"katci sera"*, *"anrudh"*, *"tailor swift"*) without degrading exact title matches.
- **Adaptive Telemetry Signals**: Ranks search candidate pools dynamically based on click-through rates (CTR), completion rates, like rates, and early skip penalties.

### 2. AI Playlist Generation & Importer
- **Prompt-to-Playlist**: Uses open-weight LLMs served via Groq Cloud SDK to generate themed playlists from natural language prompts.
- **Multi-Key Failover**: Features automatic rotation across multiple Groq API keys for rate-limit resilience.
- **Multi-Platform Import**: Parses and imports playlists from Spotify, Apple Music, YouTube Music, or raw text lists, matching catalog metadata in parallel.

### 3. SoulLink — Real-Time Shared Listening Rooms
- **Synchronized Playback**: Enables real-time listening sessions over WebSockets using Socket.io. Playback state, track changes, seek offsets, and queue updates propagate instantly across connected clients.
- **Session Control**: Rooms operate via 6-character room codes with heartbeat monitoring, automatic disconnect cleanup, and in-room text chat.

### 4. Taste Profile & Personalization Engine
- **Behavior Weighting**: Computes implicit user taste vectors from listening history, track completions, replays, likes, and skips.
- **Dynamic Recommendations**: Generates personalized home feeds and automated up-next queues while filtering negative affinity items and enforcing artist diversity.

### 5. Listening Analytics ("SoulSync Wrapped")
- Computes comprehensive user stats including top tracks, top artists, primary languages, and total listening duration, presented in an interactive story-deck layout.

---

## Architecture

SoulSync follows a decoupled client-server architecture consisting of a React frontend (Web + Capacitor Android bridge), an Express/Socket.io Node.js backend, and managed cloud infrastructure services.

```
┌──────────────────────────┐         ┌──────────────────────────┐
│      Web Frontend        │         │      Android APK         │
│  React 18 + TypeScript   │         │  Capacitor Native Bridge │
└────────────┬─────────────┘         └────────────┬─────────────┘
             │                                    │
             └───────────────┬────────────────────┘
                             │ REST API + Socket.io WebSockets
                             ▼
              ┌──────────────────────────────┐
              │    Backend Engine (Node.js)  │
              │  Express 4 + Socket.io 4     │
              │                              │
              │  - Intent & Search Ranker    │
              │  - Taste & Rec Pipeline      │
              │  - Telemetry Learning Store  │
              │  - Duo Session Manager       │
              └──────┬────────┬────────┬─────┘
                     │        │        │
           ┌─────────▼┐   ┌───▼────┐  ┌▼──────────┐
           │ MongoDB  │   │ Upstash│  │ Groq Cloud│
           │ Atlas    │   │ Redis  │  │ LLM API   │
           └──────────┘   └────────┘  └───────────┘
```

### Key API Endpoint Summary

| Module | Route Prefix | Primary Operations |
| :--- | :--- | :--- |
| **Authentication** | `/api/auth` | Google OAuth 2.0, JWT authentication, cookie management |
| **Search Engine** | `/api/search` | Intent-parsed search, auto-suggestions, click & playback telemetry |
| **Recommendations**| `/api/recommendations` | Home feed recommendations, up-next autoplay, feed pagination |
| **AI Generator** | `/api/ai` | Prompt-to-playlist generation, natural language track matching |
| **Importer** | `/api/import` | Spotify, Apple Music, YT Music playlist parsing |
| **Playlists** | `/api/playlist` | Playlist CRUD, track reordering, public link sharing |
| **SoulLink** | `/api/session` | Duo session creation, joining, and status polling |
| **User Analytics** | `/api/user` | History logging, liked songs, Wrapped stats, taste preferences |
| **Dashboard** | `/api/dashboard` | Aggregated home feed data for guest and authenticated sessions |

---

## Technology Stack

| Layer | System Components |
| :--- | :--- |
| **Frontend** | React 18.3, TypeScript 5.7, Vite 6.4, Tailwind CSS 3.4, Zustand 5, Framer Motion, Lucide Icons |
| **Mobile** | Capacitor 8.1, Android API 24+ |
| **Backend** | Node.js 18+, Express 4.21, Socket.io 4.8, TypeScript 5.7 |
| **Database** | MongoDB 8.9 (Mongoose ORM), Upstash Redis |
| **AI / Machine Learning** | Groq Cloud SDK (OSS 120B LLM), Multi-Key Failover Engine |
| **Authentication** | Google OAuth 2.0, JWT (RS256/HS256), HttpOnly Cookies |
| **Deployment** | Vercel (Frontend), Render (Backend), MongoDB Atlas (Database) |

---

## Repository Structure

```
SoulSync/
├── backend/
│   ├── scripts/            # Benchmark and diagnostic utilities
│   └── src/
│       ├── data/           # Entity dictionaries and relationship graphs
│       ├── middleware/     # Authentication and rate limiting
│       ├── models/         # Mongoose schemas (Users, Events, Telemetry)
│       ├── routes/         # REST API route handlers
│       ├── services/       # Search engine, recommendation, and AI services
│       └── socket/         # Real-time WebSocket handlers
│
└── frontend/
    └── src/
        ├── api/            # HTTP and service clients
        ├── capacitor/      # Native mobile bridge hooks
        ├── components/     # UI components grouped by domain
        ├── hooks/          # Shared custom React hooks
        ├── pages/          # Primary application page views
        ├── store/          # Zustand application state stores
        └── styles/         # Global CSS and tailwind configurations
```

---

## Development Setup

### Prerequisites

- Node.js ≥ 18.0.0
- npm ≥ 9.0.0
- MongoDB Atlas database instance
- Upstash Redis instance (or local Redis)
- Groq Cloud API Key(s)

### Installation & Execution

1. Clone the repository:
   ```bash
   git clone https://github.com/itslokeshx/SoulSync.git
   cd SoulSync
   ```

2. Install dependencies across all packages:
   ```bash
   npm run install:all
   ```

3. Configure environment variables:
   ```bash
   cp frontend/.env.example frontend/.env
   cp backend/.env.example backend/.env
   ```

4. Launch the local development servers:
   ```bash
   # Terminal 1: Backend API (Express on http://localhost:4000)
   npm run dev:backend

   # Terminal 2: Web Client (Vite on http://localhost:5173)
   npm run dev:frontend
   ```

5. Verify TypeScript types:
   ```bash
   cd backend && npm run typecheck
   cd ../frontend && npm run build
   ```

---

## Contribution Workflow

1. Fork the repository and create a feature branch (`git checkout -b feat/feature-name`).
2. Implement your changes following project conventions.
3. Ensure type safety across both packages (`npm run typecheck` in backend, `npm run build` in frontend).
4. Commit using Conventional Commits guidelines (`feat:`, `fix:`, `docs:`, `perf:`, `refactor:`).
5. Push to your branch and open a Pull Request.

---

## License

Distributed under the [MIT License](https://github.com/itslokeshx/SoulSync/blob/main/LICENSE).
