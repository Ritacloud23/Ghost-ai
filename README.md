# Ghost AI

A real-time collaborative system design workspace. Draw architecture diagrams together, with an AI agent that generates designs and writes specs.

## Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS, Zustand, Clerk
- **Backend:** FastAPI, SQLAlchemy, Celery, Redis, Postgres
- **Storage:** Vercel Blob

## Quick Start

### 1. Clone and install

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### 2. Start infrastructure

```bash
docker compose up -d
```

### 3. Configure environment

```bash
# Backend
cp backend/.env.example backend/.env
# Edit .env with your API keys

# Frontend
cp frontend/.env.local.example frontend/.env.local
# Edit .env.local with your Clerk keys
```

### 4. Run

```bash
# Terminal 1 — Backend
cd backend
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Celery worker
cd backend
celery -A app.tasks.celery_app worker --loglevel=info

# Terminal 3 — Frontend
cd frontend
npm run dev
```

### 5. Sign up and create a project

Open http://localhost:3000, sign in, create a project, and start drawing.

## Services to sign up for

| Service | Purpose | URL |
|---|---|---|
| Vercel | Hosting + Blob | https://vercel.com |
| Neon | Postgres | https://neon.tech |
| Clerk | Auth | https://clerk.com |
| Redis | Celery broker | (included in docker-compose) |
| OpenAI | AI agent | https://platform.openai.com |

## Project Structure

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design.
