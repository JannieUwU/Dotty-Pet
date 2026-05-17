# Dotty Pet

A Windows desktop productivity companion with an AI-powered 3D virtual pet. Dotty lives as a transparent overlay on your desktop, tracks your daily activity, and reflects on your day through AI-generated memos and reviews.

![Electron](https://img.shields.io/badge/Electron-41-47848F?logo=electron) ![React](https://img.shields.io/badge/React-18-61DAFB?logo=react) ![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi) ![Unity](https://img.shields.io/badge/Unity-6-000000?logo=unity) ![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)

---

## Features

- **Desktop Pet** — 3D VRM avatar rendered in Unity as a transparent always-on-top window. Supports custom VRM model imports.
- **AI Chat** — Floating chat window to talk to Dotty. Powered by Ollama (local) or Anthropic Claude.
- **Daily Memo** — AI-generated morning summary of yesterday's activity, delivered by Dotty.
- **Daily Review** — AI-generated end-of-day reflection with rating, mood, and personalized feedback.
- **Personality** — Customize Dotty's communication style with a free-form personality prompt.
- **Schedule** — Calendar with daily / weekly / monthly views, event countdowns, and reminders.
- **Habits** — Habit tracker with icons, reminders, active days, and completion history.
- **Focus Timer** — Pomodoro timer with task breakdown, session logging, and statistics.
- **Goals** — Monthly goal list with completion tracking.
- **Resource Library** — File manager for storing and organizing reference documents and images.
- **Git Monitor** — Built-in panel to view repo status, file diffs, stage files, and commit.
- **Dashboard** — Daily note, upcoming deadlines, habit snapshot, and recent activity.
- **Multi-account** — Local account system with email verification for registration and password changes.
- **Themes** — Light and dark mode. English and Chinese (简体中文) UI.
- **Field Encryption** — All sensitive database fields encrypted at rest using AES-128-CBC + HMAC-SHA256 (Fernet).

---

## Architecture

Three independent processes communicate over localhost:

```
dotty-pet/
├── frontend/        Electron 41 + React 18 + Vite + TypeScript   :5173
├── backend/         Python 3.11 + FastAPI + SQLite                :8766
└── unity/           Unity 6 + C# + UniVRM                        :8765
```

```
Frontend  ←── HTTP / WebSocket ──→  Backend
Frontend  ←── HTTP              ──→  Unity
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 41 |
| Frontend | React 18, TypeScript, Vite, Zustand |
| Backend | FastAPI, Uvicorn, SQLAlchemy, APScheduler |
| Database | SQLite (field-level Fernet encryption) |
| 3D Pet | Unity 6, UniVRM10, DynamicBone |
| AI | Ollama (local) · Anthropic Claude |
| Realtime | WebSocket (FastAPI) |

---

## Project Structure

```
dotty-pet/
├── frontend/
│   ├── src/
│   │   ├── pages/          # Dashboard, Schedule, Pomodoro, DesktopPet, …
│   │   ├── components/     # Auth modal, Git panel, layout, notifications
│   │   ├── store/          # Zustand stores (auth, schedule, pomodoro, …)
│   │   └── utils/          # API client, account scope, avatar helpers
│   ├── public/             # Icons, habit images, pet HTML overlays
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── routers/        # events, habits, focus, pet, dashboard, auth, …
│   │   ├── services/       # AI backend, WebSocket, memo/review generators
│   │   ├── database/       # SQLAlchemy models + connection
│   │   └── crypto.py       # Fernet field encryption
│   ├── data/               # SQLite DB + uploaded resources (gitignored)
│   ├── main.py             # Entry point, migrations, scheduler
│   └── requirements.txt
└── unity/                  # Unity project source
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- [Ollama](https://ollama.com) for local AI — run `ollama pull qwen2.5` after installing

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
python main.py
```

Backend starts on `http://127.0.0.1:8766`. The database and schema are created automatically on first run.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Starts Vite on port 5173 and launches Electron automatically.

### 3. Unity Pet (optional)

Open the `unity/` folder in Unity 6, then press Play. The pet window appears as a transparent overlay on your desktop.

### Build installer (Windows)

```bash
cd frontend
npm run dist
```

Output is in `frontend/release/`.

---

## AI Configuration

Dotty uses **Ollama** with `qwen2.5` by default. Switch providers in **Settings → AI**.

| Provider | Setup |
|---|---|
| Ollama (local) | Install from [ollama.com](https://ollama.com), run `ollama pull qwen2.5` |

---

## Data & Privacy

- All data is stored locally — no cloud sync, no telemetry.
- Sensitive fields (chat messages, events, habits, notes, memos, reviews) are encrypted at rest using Fernet (AES-128-CBC + HMAC-SHA256).
- The encryption key is derived from your machine hostname via PBKDF2-SHA256 — no key is written to disk.
- Files uploaded to the Resource Library are stored in `backend/data/resources/` (gitignored).

---

## License

MIT
