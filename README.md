<div align="center">

# Ghost AI

### Describe a system in plain English. Watch it become a clean, editable architecture or database diagram.

An AI-assisted system design workspace: generate architecture and ER diagrams from a sentence, refine them on an interactive canvas, and export a ready-to-use spec with SQL.

<br />

![Next.js](https://img.shields.io/badge/Next.js_15-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Zustand](https://img.shields.io/badge/Zustand-443E38?style=for-the-badge)
![Clerk](https://img.shields.io/badge/Clerk-6C47FF?style=for-the-badge&logo=clerk&logoColor=white)

![Python](https://img.shields.io/badge/Python_3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy_(async)-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white)
![Pydantic](https://img.shields.io/badge/Pydantic-E92063?style=for-the-badge&logo=pydantic&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)

![OpenRouter](https://img.shields.io/badge/OpenRouter-6467F2?style=for-the-badge)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

![Status](https://img.shields.io/badge/status-active-success?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)

**[Live demo](https://frontend-production-44d9.up.railway.app)** ·

</div>


---

## Why Ghost AI

Drawing a system design usually means dragging dozens of boxes around before you have even decided what the system is. Ghost AI flips that: **describe the system in a sentence, get a first draft in seconds, then refine it by hand.**

It works for two kinds of diagrams:

- **Architecture diagrams**: gateways, services, queues, caches, databases and the connections between them.
- **ER diagrams**: tables with typed columns, primary and foreign keys, and relationship lines that always match the foreign keys.

When the diagram is done, one click exports a Markdown spec, including generated PostgreSQL `CREATE TABLE` statements.

---

## What this project demonstrates

For hiring managers skimming this page, here is what is built, end to end:

| Skill | Where it shows up |
|---|---|
| **Full-stack engineering** | Next.js 15 + TypeScript frontend and FastAPI backend, wired together with a typed API layer |
| **Authentication and authorization** | Clerk sessions verified on the server against the JWKS (RS256), per-project access checks on every route |
| **Async Python and API design** | Async SQLAlchemy, Pydantic validation, clean REST routes, consistent error handling |
| **Database design** | Normalized schema for users, projects, collaborators, snapshots and saved canvases |
| **Applying AI in a real product** | Structured generation, validation, repair of bad model output, automatic model fallback |
| **Resilience engineering** | Free-tier models fail constantly, so the app discovers, skips and retries them gracefully |
| **Front-end craft** | A custom canvas with zoom, pan, drag, resize and right-angle connectors, all built without a diagram library |
| **Product thinking** | Autosave, dark mode, responsive layout, export, demo mode |
| **DevOps basics** | Docker Compose for local infrastructure, environment-based configuration, a free-tier deployment plan |

---

## Screenshots

> Add your own screenshots to `docs/screenshots/` and keep these lines.

| Architecture diagram | ER diagram (cards) |
|---|---|
| ![Architecture diagram](docs/screenshots/architecture.png) | ![ER diagram as cards](docs/screenshots/er-cards.png) |

| ER diagram (full columns) | Dark mode |
|---|---|
| ![ER diagram with columns](docs/screenshots/er-columns.png) | ![Dark mode](docs/screenshots/dark-mode.png) |

![Ghost AI demo](docs/screenshots/demo.gif)

---

## Features

### AI assistance
- **Generate from plain English.** Choose *Architecture* or *ER diagram*, describe the system, and the diagram appears on the canvas.
- **Ask about your design.** Type a question ("what is the single point of failure?") and get an answer based on the diagram that is currently on the canvas.
- **Model picker.** Choose a specific free model, or leave it on *Auto*.
- **Automatic fallback.** If a model is unavailable, rate limited, slow or returns garbage, the next one is tried automatically.
- **Smart ER repair.** Relationship lines are rebuilt from foreign key columns, so every foreign key gets a line and wrong lines are removed.
- **Demo mode.** Run the whole app with no AI key by setting `MOCK_AI=true`.

### Diagram editor
- **16 component types:** client, user, CDN, load balancer, gateway, service, function, auth, database, cache, object storage, search, queue, monitoring, external API, and database **table**.
- **Soft card design system:** ice-blue cards for compute, sage-green cards for data, bold titles, monospace technology subtitles and one-line descriptions.
- **Two table styles:** compact *Cards*, or full *Columns* with types, PK/FK badges and crow's-foot relationship ends (`1:1`, `1:N`, `N:M`).
- **Right-angle connectors** with rounded corners and lowercase labels (`calls`, `writes`, `publishes`).
- **Direct editing.** Double-click any card to edit its title, technology and description. Tables open a column editor (up to 12 columns).
- **Change type, connect, delete.** A floating action bar appears above the selected card.
- **Resize** any card with the arrow in its corner.
- **Zoom, pan and fit-to-screen** with the mouse wheel, buttons and drag.
- **Relabel or delete connections** by clicking them.

### Saving and collaboration
- **Autosave.** Changes are saved a moment after you stop editing, with a live status pill (*Saving...*, *Saved · 6:42 PM*, *Not saved · Retry*).
- **Safe loading.** Saving only starts after the stored canvas has loaded, so an empty canvas can never overwrite your work.
- **People tab.** See the owner and collaborators, and invite teammates by email.
- **Live presence layer.** WebSocket channel for remote cursors and shape updates.
- **Snapshots.** Save versions of a canvas to Vercel Blob.

### Export
- **Export spec.** One click downloads a Markdown document with a components table, a connections list, per-table column tables, and generated PostgreSQL `CREATE TABLE` SQL (with `REFERENCES` inferred from foreign key names).

### Experience
- **Dark mode** with a remembered preference and no flash on load.
- **Responsive.** The AI panel becomes a slide-in drawer on small screens.
- **Safe shortcuts.** `Delete` and `Esc` work on the canvas but never while you are typing.

---

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | ![Next.js](https://img.shields.io/badge/-Next.js-000000?logo=nextdotjs&logoColor=white) ![React](https://img.shields.io/badge/-React-20232A?logo=react&logoColor=61DAFB) ![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?logo=typescript&logoColor=white) | App Router, typed components, fast iteration |
| Styling | ![Tailwind CSS](https://img.shields.io/badge/-Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white) | Utility-first design system and dark mode |
| State | ![Zustand](https://img.shields.io/badge/-Zustand-443E38) | Small, fast store for shapes, edges and view settings |
| Auth | ![Clerk](https://img.shields.io/badge/-Clerk-6C47FF?logo=clerk&logoColor=white) | Hosted sign-in, JWT sessions verified server-side |
| Backend | ![Python](https://img.shields.io/badge/-Python-3776AB?logo=python&logoColor=white) ![FastAPI](https://img.shields.io/badge/-FastAPI-009688?logo=fastapi&logoColor=white) ![Pydantic](https://img.shields.io/badge/-Pydantic-E92063?logo=pydantic&logoColor=white) | Async API, validation, auto-generated docs |
| Database | ![PostgreSQL](https://img.shields.io/badge/-PostgreSQL-4169E1?logo=postgresql&logoColor=white) ![SQLAlchemy](https://img.shields.io/badge/-SQLAlchemy-D71F00?logo=sqlalchemy&logoColor=white) | Relational data with async access |
| AI | ![OpenRouter](https://img.shields.io/badge/-OpenRouter-6467F2) | One API for many models, including free ones |
| Storage | ![Vercel](https://img.shields.io/badge/-Vercel_Blob-000000?logo=vercel&logoColor=white) | Canvas snapshots |
| Infrastructure | ![Docker](https://img.shields.io/badge/-Docker-2496ED?logo=docker&logoColor=white) ![Redis](https://img.shields.io/badge/-Redis-DC382D?logo=redis&logoColor=white) | Local Postgres and Redis through Compose |
| Hosting | ![railwayl](https://img.shields.io/badge/-railway-000000?logo=railway&logoColor=white) | Free-tier friendly deployment |

---

## Architecture

```mermaid
flowchart LR
  U[Browser] --> FE[Next.js app]
  FE -->|Clerk session| CL[Clerk]
  FE -->|REST + JWT| API[FastAPI]
  FE <-->|WebSocket| WS[Realtime channel]
  API -->|verify JWT via JWKS| CL
  API --> DB[(PostgreSQL)]
  API -->|chat completions| OR[OpenRouter models]
  API --> BL[Vercel Blob]
```

### Request flow: generating a diagram

```mermaid
sequenceDiagram
  participant User
  participant Web as Next.js
  participant API as FastAPI
  participant AI as OpenRouter

  User->>Web: Describe a system (Architecture or ER)
  Web->>API: POST /api/chat (Clerk JWT)
  API->>API: Verify JWT, load free model list
  loop until one model gives a usable answer
    API->>AI: chat completion
    AI-->>API: JSON, or an error (404, 429, empty)
  end
  API->>API: Parse, salvage cut-off JSON, validate, link foreign keys
  API-->>Web: reply + design
  Web->>Web: Draw cards and connectors, fit to screen
  Web->>API: PUT /api/projects/{id}/canvas (autosave)
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design.

---

## How the AI pipeline works

Free models are great for a portfolio project and terrible at being reliable. The backend is built to handle that.

1. **Discover.** The backend asks OpenRouter which models are free *right now* (cached for 10 minutes), filters out unsuitable ones (image, audio, reasoning-only), and ranks the rest by how well their families follow "reply with JSON only".
2. **Try in order.** The model picked in the app goes first, then the others, with a per-model timeout and a total time budget.
3. **Remember failures.** A model that returns 404 is skipped for six hours. A model that is rate limited is skipped for ten minutes. Models that just failed also disappear from the picker.
4. **Detect the daily limit.** When the provider reports an account-wide daily cap, the backend stops immediately instead of burning more requests, and shows a clear message.
5. **Parse leniently.** Models wrap JSON in code fences or add text, so the parser extracts the object. If the answer is cut off mid-way, a recovery step salvages every complete shape, table and connection.
6. **Validate strictly.** Only known component types, finite coordinates, unique ids, capped counts and valid connections reach the canvas.
7. **Repair ER diagrams.** Foreign key columns are matched to their parent tables (`tenant_id` → `tenants`). Missing lines are added, reversed lines are flipped, and lines that no foreign key backs are removed.
8. **Two modes.** *Generate* returns a design for the canvas. *Ask* sends a compact copy of the current canvas and returns a plain-text answer.

---

## Engineering challenges and solutions

| Challenge | Solution |
|---|---|
| Free AI models rate limit, disappear and return malformed output | Discovery, cooldowns, fallback chain, daily-limit detection, tolerant parsing and recovery of cut-off JSON |
| ER diagrams from an LLM have missing or wrong relationship lines | A deterministic foreign-key linker rebuilds the lines from the columns |
| Verifying who is calling the API | Clerk JWT checked server-side against the JWKS with RS256, and the user row is created on the first request (no webhook needed locally) |
| Autosave could overwrite saved work with an empty canvas | Saving is disabled until the stored canvas has loaded, and a pending save is flushed when leaving the page |
| Dragging and cursors drifting when zoomed | Pointer deltas are divided by the zoom level and remote cursors are stored in canvas coordinates |
| Cards of different sizes and shapes still need tidy connectors | One routing function computes right-angle paths with rounded corners from each shape's own width and height |
| Browser showed "CORS error" for what was really a backend crash | Traced it to unhandled 500 responses skipping the CORS middleware, then fixed the response schemas |
| Dark mode without rewriting every component | A single theme layer plus a script that applies the saved theme before the first paint |
| A new table should not need a migration to try the feature | The saved-canvas table creates itself on first use (`checkfirst`), with a migration path for production |

---

## Data model

```mermaid
erDiagram
  users ||--o{ projects : owns
  users ||--o{ collaborators : joins
  projects ||--o{ collaborators : has
  projects ||--o{ snapshots : has
  projects ||--|| canvas_states : saves

  users {
    string id PK
    string clerk_id
    string email
    string name
  }
  projects {
    string id PK
    string name
    string owner_id FK
  }
  collaborators {
    string project_id FK
    string user_id FK
    string role
  }
  snapshots {
    string id PK
    string project_id FK
    string blob_url
  }
  canvas_states {
    string project_id PK
    json data
    datetime updated_at
  }
```

---

## API reference

Interactive docs are available at `http://localhost:8000/docs` while the backend is running. All routes require a Clerk bearer token.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/projects` | List your projects |
| `POST` | `/api/projects` | Create a project |
| `GET` | `/api/projects/{id}` | Get one project |
| `GET` | `/api/projects/{id}/canvas` | Load the saved canvas |
| `PUT` | `/api/projects/{id}/canvas` | Save the canvas (autosave) |
| `GET` | `/api/projects/{id}/members` | List the owner and collaborators |
| `POST` | `/api/projects/{id}/members` | Invite someone by email (owner only) |
| `POST` | `/api/chat` | Generate a diagram or ask a question about the current one |
| `GET` | `/api/chat/models` | List the free models that can be picked |
| `GET` | `/api/snapshots/{project_id}` | List snapshots |
| `POST` | `/api/snapshots` | Create a snapshot |

---

## Security

- **Server-side JWT verification** against Clerk's public keys, never trusting the client.
- **Access checks on every project route.** Only the owner and collaborators can read or save a canvas, and only the owner can invite.
- **Input limits.** Chat messages are capped, saved canvases are capped by shape, connection and byte count, and model ids are validated.
- **Output validation.** Nothing from an AI model reaches the database or canvas without being checked.
- **Secrets stay in environment variables.** `.env` files are git-ignored, and an `.env.example` documents what is needed.
- **CORS allowlist.** Only the configured frontend origins can call the API.

---

## Quick start

**Prerequisites:** Python 3.11+, Node.js 18.18+, Docker, and free accounts for [Clerk](https://clerk.com) and [OpenRouter](https://openrouter.ai).

### 1. Clone and install

```bash
git clone https://github.com/YOUR-USERNAME/Ghost-ai.git
cd Ghost-ai

# Backend
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### 2. Start the database

```bash
cd ..
docker compose up -d
docker compose ps                # the Postgres container should be running
```

### 3. Configure environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
# Fill in the values (see the table below)
```

### 4. Run

```bash
# Terminal 1: backend
cd backend
uvicorn app.main:app --reload --port 8000

# Terminal 2: frontend
cd frontend
npm run dev
```

Open http://localhost:3000, sign up, create a project, and describe a system in the AI panel.

> **No AI key yet?** Set `MOCK_AI=true` in `backend/.env`. The app returns sample diagrams so you can try every feature for free.

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Async Postgres URL, for example `postgresql+asyncpg://USER:PASSWORD@localhost:5433/ghost_ai` |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key (used to fetch the user's name and email) |
| `CLERK_JWKS_URL` | Yes | `https://<your-clerk-domain>/.well-known/jwks.json` |
| `OPENROUTER_API_KEY` | For live AI | OpenRouter key (free models need no card) |
| `AI_MODEL` | No | `auto` (default) or a specific model id to try first |
| `MOCK_AI` | No | `true` returns sample diagrams with no AI call |
| `OPENAI_API_KEY` | No | Optional fallback provider |
| `CORS_ORIGINS` | Production | JSON list, for example `["https://your-app.vercel.app"]` |
| `VERCEL_BLOB_TOKEN` | For snapshots | Vercel Blob read/write token |
| `REDIS_URL` | No | Redis connection (reserved for background jobs) |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend URL, for example `http://localhost:8000` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |

---

## Deployment

A free-tier setup that works for a portfolio demo:

| Part | Host | Notes |
|---|---|---|
| Frontend | **Vercel** | Set the root directory to `frontend` and add the three frontend variables |
| Backend | **Render** (web service) | Build `pip install -r requirements.txt`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, health check `/health` |
| Database | **Neon** | Use the direct connection string with the `+asyncpg` prefix; run `alembic upgrade head` once |
| Auth | **Clerk** | Add the deployed URL to the allowed origins and redirect URLs |

**Good to know:**
- Free Render web services sleep after about 15 minutes without traffic, so the first request can take around a minute to wake up.
- Set `MOCK_AI=true` on a public demo so visitors cannot use up your free AI quota.
- Set `CORS_ORIGINS` to your Vercel URL, and `NEXT_PUBLIC_API_URL` to your Render URL.

---

## Services to sign up for

| Service | Purpose | Cost | URL |
|---|---|---|---|
| ![Vercel](https://img.shields.io/badge/-Vercel-000000?logo=vercel&logoColor=white) | Frontend hosting and Blob storage | Free tier | https://vercel.com |
| ![Render](https://img.shields.io/badge/-Render-46E3B7?logo=render&logoColor=black) | Backend hosting | Free tier | https://render.com |
| ![Neon](https://img.shields.io/badge/-Neon-00E599?logo=neon&logoColor=black) | Serverless Postgres | Free tier | https://neon.tech |
| ![Clerk](https://img.shields.io/badge/-Clerk-6C47FF?logo=clerk&logoColor=white) | Authentication | Free tier | https://clerk.com |
| ![OpenRouter](https://img.shields.io/badge/-OpenRouter-6467F2) | AI models (free options) | Free models, no card | https://openrouter.ai |
| ![Docker](https://img.shields.io/badge/-Docker-2496ED?logo=docker&logoColor=white) | Local Postgres and Redis | Free | https://docker.com |

---

## Project structure

```text
Ghost-ai/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app, CORS, router registration
│   │   ├── config.py                # Settings loaded from .env
│   │   ├── database.py              # Async engine and session
│   │   ├── dependencies.py          # Clerk JWT verification, current user
│   │   ├── models/                  # SQLAlchemy models (user, project, collaborator, snapshot, canvas_state)
│   │   ├── routers/
│   │   │   ├── projects.py          # Project CRUD
│   │   │   ├── project_extras.py    # Members, invites, canvas save and load
│   │   │   ├── chat.py              # AI generation, ask mode, model list
│   │   │   └── snapshots.py         # Canvas snapshots
│   │   ├── services/
│   │   │   └── erd_links.py         # Foreign-key based relationship repair
│   │   └── ws/                      # WebSocket channel
│   ├── alembic/                     # Migrations
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   └── src/
│       ├── app/                     # Next.js routes (home, project page, sign-in)
│       ├── components/
│       │   ├── canvas/              # Canvas, Shape, Edge, Toolbar, SelectionBar, ShapeEditor, EdgeBar
│       │   ├── chat/                # ChatSidebar, PeoplePanel
│       │   └── ThemeToggle.tsx
│       ├── lib/                     # api.ts, types.ts, shapeConfig.ts, exportSpec.ts, ws.ts
│       └── store/canvas.ts          # Zustand store
├── docker-compose.yml
├── ARCHITECTURE.md
└── README.md
```

---

## Roadmap

- [x] **CI/CD** with GitHub Actions: lint, type-check, tests and Docker image build on every push
- [x] **Infrastructure as code** with Terraform for a production deployment
- [x] **Automated tests:** `pytest` for the API and the AI parsing pipeline, Playwright for the canvas
- [x] **Background jobs** (Celery + Redis) for long AI generations
- [x] **Multiple diagrams per project** with tabs
- [x] **Undo and redo**
- [x] **Image export** (PNG and SVG)
- [x] **Viewer role** with read-only access
- [x] **Per-user rate limits** for the AI endpoints
- [x] **Comparing models** side by side on one prompt

---

## About the author

Built by **Rita**, a full-stack engineer currently doing an internship. Ghost AI is a complete product that I designed and built end to end: the database schema, the authenticated API, the AI pipeline, the interactive canvas, and the deployment plan.

I'm open to **remote roles** worldwide.

---

<div align="center">

If this project is useful or interesting, a on the repo helps a lot.

</div>
