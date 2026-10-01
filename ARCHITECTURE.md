# Ghost AI — System Architecture

A real-time collaborative system design workspace. Multiple users draw architecture diagrams together on a shared canvas. An AI agent generates designs, answers questions in a chat sidebar, and writes markdown specs from the diagram.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), React, TypeScript, Tailwind CSS, Zustand |
| Backend | FastAPI (Python), SQLAlchemy 2.0, Alembic |
| Auth | Clerk (JWT verification in FastAPI) |
| Real-time | Custom WebSockets (FastAPI + Redis pub/sub) |
| Task Queue | Celery + Redis |
| Database | Postgres (Neon) |
| File Storage | Vercel Blob (snapshots) |
| AI | LLM via OpenAI or Anthropic SDK |

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Browser                            │
│  ┌───────────────────────────────────────────────────┐  │
│  │              Next.js Frontend                     │  │
│  │                                                   │  │
│  │  ┌─────────┐  ┌──────────┐  ┌────────────────┐  │  │
│  │  │ Canvas  │  │  Chat    │  │  Auth (Clerk)  │  │  │
│  │  │ (shapes,│  │ Sidebar  │  │                │  │  │
│  │  │ edges,  │  │          │  │                │  │  │
│  │  │ cursors)│  │          │  │                │  │  │
│  │  └────┬────┘  └────┬─────┘  └───────┬────────┘  │  │
│  │       │            │                 │           │  │
│  │  ┌────┴────────────┴─────────────────┴────────┐  │  │
│  │  │        API Client (HTTP + WebSocket)        │  │  │
│  │  └───────┬──────────────────┬─────────────────┘  │  │
│  └──────────┼──────────────────┼────────────────────┘  │
└─────────────┼──────────────────┼────────────────────────┘
              │                  │
    HTTP REST │                  │ WebSocket
              ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│                 FastAPI Backend                         │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  REST API    │  │  WebSocket   │  │  Auth        │  │
│  │  /projects   │  │  /ws/{id}    │  │  Middleware  │  │
│  │  /snapshots  │  │  (presence,  │  │  (Clerk JWT  │  │
│  │  /chat       │  │   cursors,   │  │   verify)    │  │
│  │              │  │   shapes)    │  │              │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘  │
│         │                 │                             │
│  ┌──────┴─────────────────┴──────────────────────────┐  │
│  │              SQLAlchemy ORM                       │  │
│  └──────────────────────┬───────────────────────────┘  │
│                         │                               │
│  ┌──────────────────────┴───────────────────────────┐  │
│  │           Celery Task Runner                      │  │
│  │  ┌─────────────┐  ┌──────────────┐               │  │
│  │  │ generate_   │  │ write_spec   │               │  │
│  │  │ design      │  │              │               │  │
│  │  └─────────────┘  └──────────────┘               │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────┬──────────────┬──────────────┬─────────────┘
              │              │              │
              ▼              ▼              ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│   Postgres   │  │    Redis     │  │   Vercel Blob   │
│   (Neon)     │  │  (Celery     │  │   (snapshots)   │
│              │  │   broker +   │  │                  │
│  Users       │  │   WS pub/sub)│  │                  │
│  Projects    │  │              │  │                  │
│  Collaborators│  │              │  │                  │
│  Snapshots   │  │              │  │                  │
└──────────────┘  └──────────────┘  └──────────────────┘
```

## Data Flows

### 1. Auth Flow

```
User → Clerk (sign in) → JWT token → Next.js stores token
  → API calls include JWT in Authorization header
  → FastAPI middleware verifies JWT with Clerk's JWKS endpoint
  → Extracts user ID, looks up or creates User in Postgres
```

### 2. Real-time Canvas Collaboration

```
User A moves cursor → WebSocket message → FastAPI WS endpoint
  → Broadcast to all other clients in the same project room
  → Redis pub/sub for multi-server scaling

Message types:
  join / leave / presence
  cursor_move { x, y, user_id, color }
  shape_add / shape_update / shape_delete
  edge_add / edge_delete
```

### 3. AI Agent Flow

```
User types in chat → POST /api/chat { message, project_id }
  → FastAPI creates Celery task → task ID returned immediately
  → Celery worker picks up task
  → Calls LLM with system design prompt
  → LLM returns structured design (shapes + edges as JSON)
  → Worker broadcasts design to canvas via WebSocket
  → Worker generates markdown spec from the design
  → Worker uploads spec to Vercel Blob
  → Worker saves snapshot to Postgres
  → Worker sends chat response back via WebSocket
```

### 4. Auto-save / Snapshots

```
Canvas state changes → debounced (e.g. 30s) → POST /api/snapshots
  → FastAPI serializes canvas state to JSON
  → Uploads to Vercel Blob
  → Stores blob URL + timestamp in Postgres
```

## Database Schema

```python
class User:
    id: str (cuid)
    clerk_id: str (unique)
    email: str
    name: str | None
    projects: list[Project]          # owned
    collaborations: list[Collaborator]

class Project:
    id: str (cuid)
    name: str
    owner_id: str → User
    collaborators: list[Collaborator]
    snapshots: list[Snapshot]
    created_at, updated_at

class Collaborator:
    id: str (cuid)
    project_id: str → Project
    user_id: str → User
    role: "VIEWER" | "EDITOR"
    unique(project_id, user_id)

class Snapshot:
    id: str (cuid)
    project_id: str → Project
    blob_url: str                    # Vercel Blob URL
    created_at: datetime
```

## WebSocket Protocol

### Client → Server

```json
{ "type": "join", "project_id": "..." }
{ "type": "cursor_move", "x": 100, "y": 200 }
{ "type": "shape_add", "shape": { "id": "...", "type": "database", "x": 0, "y": 0, "label": "Users" } }
{ "type": "shape_update", "shape_id": "...", "changes": { "x": 50 } }
{ "type": "shape_delete", "shape_id": "..." }
{ "type": "edge_add", "edge": { "id": "...", "from": "shape_1", "to": "shape_2" } }
{ "type": "edge_delete", "edge_id": "..." }
{ "type": "chat_message", "content": "Design a URL shortener" }
```

### Server → Client

```json
{ "type": "presence", "users": [{ "id": "...", "name": "...", "color": "#F00", "cursor": { "x": 0, "y": 0 } }] }
{ "type": "cursor_move", "user_id": "...", "x": 100, "y": 200 }
{ "type": "shape_add", "shape": { ... } }
{ "type": "shape_update", "shape_id": "...", "changes": { ... } }
{ "type": "shape_delete", "shape_id": "..." }
{ "type": "edge_add", "edge": { ... } }
{ "type": "edge_delete", "edge_id": "..." }
{ "type": "ai_message", "content": "Here's your design...", "design": { "shapes": [...], "edges": [...] } }
{ "type": "ai_spec", "content": "# URL Shortener\n...", "blob_url": "..." }
{ "type": "error", "message": "..." }
```

## Project Structure

```
ghost-ai/
├── frontend/                    # Next.js app
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                    # Landing / project list
│   │   │   ├── (auth)/                     # Clerk sign-in/sign-up
│   │   │   └── project/[id]/page.tsx       # Canvas workspace
│   │   ├── components/
│   │   │   ├── canvas/
│   │   │   │   ├── Canvas.tsx              # Main canvas component
│   │   │   │   ├── Shape.tsx               # Draggable shape
│   │   │   │   ├── Edge.tsx                # Connection line
│   │   │   │   ├── CursorOverlay.tsx       # Remote cursors
│   │   │   │   └── Toolbar.tsx             # Shape palette
│   │   │   ├── chat/
│   │   │   │   ├── ChatSidebar.tsx
│   │   │   │   └── MessageBubble.tsx
│   │   │   └── ui/                         # Shared primitives
│   │   ├── lib/
│   │   │   ├── api.ts                      # HTTP client
│   │   │   ├── ws.ts                       # WebSocket client
│   │   │   └── types.ts
│   │   └── store/
│   │       └── canvas.ts                   # Zustand store
│   ├── .env.local
│   └── package.json
│
├── backend/                     # FastAPI app
│   ├── app/
│   │   ├── main.py             # FastAPI app entry
│   │   ├── config.py           # Settings (pydantic-settings)
│   │   ├── dependencies.py     # Auth, DB session
│   │   ├── models/             # SQLAlchemy models
│   │   │   ├── user.py
│   │   │   ├── project.py
│   │   │   ├── collaborator.py
│   │   │   └── snapshot.py
│   │   ├── routers/
│   │   │   ├── projects.py     # CRUD + invite collaborators
│   │   │   ├── snapshots.py    # Save/load snapshots
│   │   │   └── chat.py         # AI chat endpoint
│   │   ├── ws/
│   │   │   └── manager.py      # WebSocket connection manager
│   │   ├── tasks/
│   │   │   ├── celery_app.py   # Celery instance
│   │   │   ├── generate_design.py
│   │   │   └── write_spec.py
│   │   └── services/
│   │       ├── ai.py           # LLM integration
│   │       └── blob.py         # Vercel Blob upload
│   ├── tests/
│   ├── alembic/                # DB migrations
│   ├── .env
│   └── requirements.txt
│
├── docker-compose.yml          # Redis + local Postgres for dev
└── README.md
```

## Key Dependencies

### Backend (`requirements.txt`)

```
fastapi
uvicorn[standard]
sqlalchemy[asyncio]
asyncpg                    # Async Postgres driver
alembic                    # Migrations
celery[redis]
redis
pydantic-settings
clerk-sdk-python           # JWT verification
httpx                      # Async HTTP client
openai                     # or anthropic
vercel-blob                # Snapshot storage
python-dotenv
```

### Frontend (`package.json`)

```
next, react, react-dom
@clerk/nextjs
zustand
tailwindcss
typescript
```

## Phased Roadmap

| Phase | What | Outcome |
|---|---|---|
| **1. Scaffold** | Next.js + FastAPI + Postgres + Redis + Clerk | Auth works, DB migrated, WS echo works |
| **2. Canvas** | Shapes, edges, drag-drop, WebSocket sync | Two browsers can draw together in real time |
| **3. AI Agent** | Chat sidebar + Celery tasks + LLM | AI generates a design onto the canvas |
| **4. Spec generation** | Markdown spec from diagram + Blob upload | Dev-team-ready spec document |
| **5. Projects & sharing** | Invite collaborators, roles, permissions | Multi-user projects with access control |
| **6. Polish** | Auto-save, snapshots, error handling, deployment | Production-ready |
