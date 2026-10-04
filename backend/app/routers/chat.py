import json
import logging
import re
import time
import uuid
from typing import Callable

import httpx
from fastapi import APIRouter, Depends, HTTPException
from openai import APIError, AsyncOpenAI, RateLimitError
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services.erd_links import link_entities

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/chat", tags=["chat"])

OPENROUTER_URL = "https://openrouter.ai/api/v1"
OPENAI_MODEL = "gpt-4o-mini"  # used only when OPENAI_API_KEY is set and no OpenRouter key

VALID_TYPES = {
    "client", "user", "cdn", "loadbalancer", "gateway",
    "service", "function", "auth",
    "database", "cache", "storage", "search",
    "queue", "monitoring", "external",
    "entity",
}

MAX_SHAPES = 14
MAX_EDGES = 20
MAX_COLUMNS = 12

# How many different models to try for one message, and the longest we will keep trying.
MAX_MODELS_TRIED = 8
MODEL_TIMEOUT_SECONDS = 45.0
TOTAL_TIME_BUDGET_SECONDS = 75.0

# Models that failed recently are skipped for a while, so they do not waste attempts.
UNAVAILABLE_COOLDOWN_SECONDS = 6 * 3600  # removed or no longer free
RATE_LIMIT_COOLDOWN_SECONDS = 10 * 60  # busy right now
_cooldown_until: dict[str, float] = {}

# Free model list from OpenRouter is cached so we do not fetch it on every message.
FREE_CACHE_SECONDS = 600
_free_cache: dict = {"at": 0.0, "items": []}

MODEL_ID_RE = re.compile(r"^[A-Za-z0-9._:/\-]{1,100}$")

# Families that tend to follow "reply with JSON only" well. Earlier in the list = tried first.
PREFERRED = ("gpt-oss", "llama", "qwen", "gemma", "deepseek", "nemotron", "mistral", "glm", "hermes")
# Models that are a poor fit (reasoning-only, image, audio, safety filters, and so on).
AVOID = (
    "thinking", "reason", "-r1", "image", "vision", "embed", "audio", "tts",
    "whisper", "guard", "moderation", "safeguard", "safety", "shield", "classif",
    "lyria", "veo", "ocr",
)

# Words that mean the user wants a database diagram (used by mock mode when no type is chosen).
ERD_WORDS = ("erd", "entity relationship", "schema", "database design", "tables", "data model")

SYSTEM_PROMPT = """You are Ghost AI, an assistant that designs software systems and database models on a canvas.

Always reply with a single JSON object and nothing else, in exactly this shape:
{
  "message": "short explanation of the design for the chat (2-3 sentences)",
  "design": {
    "shapes": [
      {"id": "s1", "type": "client", "x": 60, "y": 120, "label": "Admin Web App", "tech": "React", "description": "Admins manage properties"}
    ],
    "edges": [
      {"id": "e1", "from": "s1", "to": "s2", "label": "calls"}
    ]
  }
}

Rules for architecture diagrams:
- "type" must be one of: client, user, cdn, loadbalancer, gateway, service, function, auth, database, cache, storage, search, queue, monitoring, external.
  Use "user" for people or roles, "client" for apps and browsers, "external" for third-party APIs,
  "storage" for files and images, "auth" for login or identity, "monitoring" for logs and metrics,
  "function" for serverless or scheduled jobs.
- "label" is a short title (1-3 words). "tech" is the technology (1-2 words, for example PostgreSQL, Node.js, Redis, Kong).
  "description" is at most 6 words. Edge "label" is one short verb such as calls, reads, writes, publishes, authenticates.
- Keep each shape's keys in this order: id, type, x, y, label, tech, description.
  Keep each edge's keys in this order: id, from, to, label.
- Each card is large, so space them out. Lay shapes out left to right in layers
  (users and clients, edge, services, then data stores). Use x between 60 and 1100 and y between 60 and 560.
  Keep at least 300 units between shapes horizontally and 130 vertically so nothing overlaps.
   - Use 5 to 11 shapes and at most 14 edges. By default show only the main flows and do NOT connect monitoring,
     audit logs, or the cache to every service (connect each to one or two representative components).
     If the user asks for more detail, all connections, or every relationship, use up to 20 edges and show every
     connection between components, including auth, cache, queue, audit and monitoring links.

Rules for database diagrams (ERD, schema, tables, data model):
- Use type "entity" for every table, and use ONLY entities in that diagram.
- An entity looks like this, with NO "tech" and NO "description":
  {"id": "t1", "type": "entity", "x": 40, "y": 40, "label": "users", "columns": [{"name": "id", "type": "uuid", "key": "pk"}, {"name": "email", "type": "varchar"}]}
- "label" is the table name in snake_case. Each column has "name" and "type", plus "key": "pk" for a primary key
  or "key": "fk" for a foreign key (leave "key" out for other columns).
- Keep an entity's keys in this order: id, type, x, y, label, columns.
- Use at most 8 tables and at most 6 columns per table.
- Connect tables with edges from the parent table to the child table, labeled "1:1", "1:N" or "N:M".
- Tables are tall, so place them in a grid at least 340 units apart horizontally and 320 vertically
  (x between 40 and 1100, y between 40 and 700).

General rules:
- Every shape id is unique; every edge "from" and "to" must be an existing shape id.
- If the user is only asking a question and not describing a system, set "design" to null.
- Even for a long description, summarize it into the main components.
- Keep the JSON compact. Output raw JSON only. No markdown, no code fences, no text before or after.
"""

ASK_PROMPT = """You are Ghost AI, an assistant that helps people understand and improve system designs.
The user will ask a question about the design that is currently on their canvas. It is given below as JSON.
Answer in plain text, in 2 to 6 short sentences. Refer to components by their names.
If the canvas is empty, say so and suggest what to draw. Do not output JSON and do not draw anything."""

MOCK_DESIGN = {
    "shapes": [
        {"id": "s1", "type": "client", "x": 60, "y": 200, "label": "Admin Web App", "tech": "React", "description": "Admins manage properties"},
        {"id": "s2", "type": "gateway", "x": 380, "y": 200, "label": "API Gateway", "tech": "Kong", "description": "Public entry point"},
        {"id": "s3", "type": "auth", "x": 700, "y": 60, "label": "Auth Service", "tech": "OAuth 2.0", "description": "Role-based access"},
        {"id": "s4", "type": "service", "x": 700, "y": 200, "label": "Property Service", "tech": "Node.js", "description": "Manages properties"},
        {"id": "s5", "type": "service", "x": 700, "y": 340, "label": "Payments", "tech": "Python", "description": "Handles payments"},
        {"id": "s6", "type": "database", "x": 1020, "y": 130, "label": "Main DB", "tech": "PostgreSQL", "description": "Stores core data"},
        {"id": "s7", "type": "external", "x": 1020, "y": 340, "label": "Payment Provider", "tech": "Stripe", "description": "Card processing"},
    ],
    "edges": [
        {"id": "e1", "from": "s1", "to": "s2", "label": "calls"},
        {"id": "e2", "from": "s2", "to": "s3", "label": "authenticates"},
        {"id": "e3", "from": "s2", "to": "s4", "label": "routes"},
        {"id": "e4", "from": "s2", "to": "s5", "label": "routes"},
        {"id": "e5", "from": "s4", "to": "s6", "label": "writes"},
        {"id": "e6", "from": "s5", "to": "s7", "label": "calls"},
    ],
}

MOCK_ERD = {
    "shapes": [
        {
            "id": "t1", "type": "entity", "x": 40, "y": 160, "label": "users",
            "columns": [
                {"name": "id", "type": "uuid", "key": "pk"},
                {"name": "clerk_id", "type": "varchar"},
                {"name": "email", "type": "varchar"},
                {"name": "name", "type": "varchar"},
            ],
        },
        {
            "id": "t2", "type": "entity", "x": 420, "y": 40, "label": "projects",
            "columns": [
                {"name": "id", "type": "uuid", "key": "pk"},
                {"name": "name", "type": "varchar"},
                {"name": "owner_id", "type": "uuid", "key": "fk"},
                {"name": "created_at", "type": "timestamp"},
            ],
        },
        {
            "id": "t3", "type": "entity", "x": 800, "y": 60, "label": "snapshots",
            "columns": [
                {"name": "id", "type": "uuid", "key": "pk"},
                {"name": "project_id", "type": "uuid", "key": "fk"},
                {"name": "blob_url", "type": "text"},
                {"name": "created_at", "type": "timestamp"},
            ],
        },
        {
            "id": "t4", "type": "entity", "x": 420, "y": 360, "label": "collaborators",
            "columns": [
                {"name": "project_id", "type": "uuid", "key": "fk"},
                {"name": "user_id", "type": "uuid", "key": "fk"},
                {"name": "role", "type": "varchar"},
            ],
        },
    ],
    "edges": [
        {"id": "e1", "from": "t1", "to": "t2", "label": "1:N"},
        {"id": "e2", "from": "t1", "to": "t4", "label": "1:N"},
        {"id": "e3", "from": "t2", "to": "t4", "label": "1:N"},
        {"id": "e4", "from": "t2", "to": "t3", "label": "1:N"},
    ],
}

# Used to recover whatever is complete when the AI's JSON is cut off in the middle.
_NUM = r"-?\d+(?:\.\d+)?"
_STR = r'"((?:[^"\\]|\\.)*)"'
SHAPE_RE = re.compile(
    r'\{\s*"id"\s*:\s*"([^"]+)"\s*,\s*"type"\s*:\s*"([^"]+)"\s*,'
    rf'\s*"x"\s*:\s*({_NUM})\s*,\s*"y"\s*:\s*({_NUM})\s*,'
    rf'\s*"label"\s*:\s*{_STR}'
    rf'(?:\s*,\s*"tech"\s*:\s*{_STR})?'
    rf'(?:\s*,\s*"description"\s*:\s*{_STR})?'
    r"\s*\}"
)
ENTITY_RE = re.compile(
    r'\{\s*"id"\s*:\s*"([^"]+)"\s*,\s*"type"\s*:\s*"entity"\s*,'
    rf'\s*"x"\s*:\s*({_NUM})\s*,\s*"y"\s*:\s*({_NUM})\s*,'
    rf'\s*"label"\s*:\s*{_STR}\s*,\s*"columns"\s*:\s*\['
    r"((?:\s*\{[^{}]*\}\s*,?)*)"
    r"\s*\]\s*\}"
)
COLUMN_RE = re.compile(
    rf'\{{\s*"name"\s*:\s*{_STR}\s*,\s*"type"\s*:\s*{_STR}(?:\s*,\s*"key"\s*:\s*{_STR})?\s*\}}'
)
EDGE_RE = re.compile(
    r'\{\s*"id"\s*:\s*"([^"]+)"\s*,\s*"from"\s*:\s*"([^"]+)"\s*,\s*"to"\s*:\s*"([^"]+)"'
    rf'(?:\s*,\s*"label"\s*:\s*{_STR})?\s*\}}'
)
MESSAGE_RE = re.compile(rf'"message"\s*:\s*{_STR}', re.DOTALL)


class ChatRequest(BaseModel):
    project_id: str
    message: str
    # "architecture" or "erd": what kind of diagram to draw (generate mode).
    diagram: str | None = None
    # "generate" draws on the canvas; "ask" answers a question about the current design.
    mode: str = "generate"
    # A specific OpenRouter model to try first. Missing or "auto" means pick for me.
    model: str | None = None
    # The current canvas, sent in ask mode so the AI can talk about it.
    context: dict | None = None


class ChatResponse(BaseModel):
    task_id: str
    status: str
    reply: str | None = None
    design: dict | None = None


class ModelOut(BaseModel):
    id: str
    name: str


# ---------------------------------------------------------------------------
# Choosing which AI model to call
# ---------------------------------------------------------------------------


def _cool_down(model: str, seconds: float) -> None:
    """Skip this model for a while."""
    _cooldown_until[model] = time.time() + seconds


def _is_cooling(model: str) -> bool:
    until = _cooldown_until.get(model)
    if until is None:
        return False
    if time.time() >= until:
        _cooldown_until.pop(model, None)
        return False
    return True


def _is_daily_limit(text: str) -> bool:
    """OpenRouter's free models share one daily request limit for the whole account."""
    lowered = text.lower()
    return "per-day" in lowered or "per day" in lowered or "daily" in lowered


def _is_zero(value: object) -> bool:
    try:
        return float(value) == 0.0  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return False


def _score(model_id: str) -> int:
    lowered = model_id.lower()
    for i, key in enumerate(PREFERRED):
        if key in lowered:
            return i
    return len(PREFERRED)


async def _free_model_items() -> list[dict]:
    """Ask OpenRouter which models are free right now. Free models change often."""
    now = time.time()
    if _free_cache["items"] and now - _free_cache["at"] < FREE_CACHE_SECONDS:
        return _free_cache["items"]

    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            resp = await http.get(f"{OPENROUTER_URL}/models")
            resp.raise_for_status()
            items = resp.json().get("data", [])
    except Exception:
        logger.exception("CHAT: could not load the OpenRouter model list")
        return _free_cache["items"]

    found: list[dict] = []
    for item in items:
        model_id = str(item.get("id", ""))
        if not model_id or model_id == "openrouter/free":
            continue

        pricing = item.get("pricing") or {}
        is_free = model_id.endswith(":free") or (
            _is_zero(pricing.get("prompt")) and _is_zero(pricing.get("completion"))
        )
        if not is_free:
            continue

        outputs = (item.get("architecture") or {}).get("output_modalities")
        if outputs and outputs != ["text"]:
            continue
        if any(bad in model_id.lower() for bad in AVOID):
            continue
        if (item.get("context_length") or 0) < 8000:
            continue

        found.append({"id": model_id, "name": str(item.get("name") or model_id)})

    found.sort(key=lambda m: _score(m["id"]))
    _free_cache["at"] = now
    _free_cache["items"] = found
    logger.info("CHAT: %d free models available on OpenRouter", len(found))
    return found


async def _candidate_models(preferred: str | None) -> list[str]:
    """Models to try, in order. Returns an empty list if no AI key is set."""
    if settings.openrouter_api_key:
        candidates: list[str] = []
        configured = (settings.ai_model or "").strip()
        # The model picked in the app comes first, then one from .env, then free models.
        if preferred and preferred != "auto":
            candidates.append(preferred)
        if configured and configured not in ("auto", "openrouter/free"):
            candidates.append(configured)
        candidates.extend(m["id"] for m in await _free_model_items())

        seen: set[str] = set()
        unique = [m for m in candidates if not (m in seen or seen.add(m))]
        # Leave out models that failed recently. The automatic router is always the last resort.
        available = [m for m in unique if not _is_cooling(m) and m != "openrouter/free"]
        return available[: MAX_MODELS_TRIED - 1] + ["openrouter/free"]
    if settings.openai_api_key:
        return [OPENAI_MODEL]
    return []


def _make_client() -> AsyncOpenAI | None:
    # max_retries=0: if a model fails we move on to the next one right away.
    if settings.openrouter_api_key:
        return AsyncOpenAI(
            api_key=settings.openrouter_api_key,
            base_url=OPENROUTER_URL,
            timeout=MODEL_TIMEOUT_SECONDS,
            max_retries=0,
        )
    if settings.openai_api_key:
        return AsyncOpenAI(
            api_key=settings.openai_api_key,
            timeout=MODEL_TIMEOUT_SECONDS,
            max_retries=0,
        )
    return None


# ---------------------------------------------------------------------------
# Reading the AI's answer
# ---------------------------------------------------------------------------


def _unescape(text: str) -> str:
    try:
        return json.loads(f'"{text}"')
    except json.JSONDecodeError:
        return text


def _extract_json(text: str) -> dict:
    """Free models often wrap JSON in code fences or add extra text. Pull out the object."""
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no JSON object found")
    return json.loads(text[start : end + 1])


def _salvage(text: str) -> dict | None:
    """Recover the complete shapes, tables and edges from JSON that was cut off."""
    found: list[tuple[int, dict]] = []

    for m in SHAPE_RE.finditer(text):
        g = m.groups()  # id, type, x, y, label, tech, description
        shape: dict = {
            "id": g[0],
            "type": g[1],
            "x": float(g[2]),
            "y": float(g[3]),
            "label": _unescape(g[4]),
        }
        if g[5]:
            shape["tech"] = _unescape(g[5])
        if g[6]:
            shape["description"] = _unescape(g[6])
        found.append((m.start(), shape))

    for m in ENTITY_RE.finditer(text):
        g = m.groups()  # id, x, y, label, columns
        columns: list[dict] = []
        for c in COLUMN_RE.finditer(g[4]):
            col: dict = {"name": _unescape(c.group(1)), "type": _unescape(c.group(2))}
            if c.group(3) in ("pk", "fk"):
                col["key"] = c.group(3)
            columns.append(col)
        found.append(
            (
                m.start(),
                {
                    "id": g[0],
                    "type": "entity",
                    "x": float(g[1]),
                    "y": float(g[2]),
                    "label": _unescape(g[3]),
                    "columns": columns,
                },
            )
        )

    if not found:
        return None
    found.sort(key=lambda pair: pair[0])
    shapes = [shape for _, shape in found]

    edges: list[dict] = []
    for m in EDGE_RE.finditer(text):
        edge: dict = {"id": m.group(1), "from": m.group(2), "to": m.group(3)}
        if m.group(4):
            edge["label"] = _unescape(m.group(4))
        edges.append(edge)

    msg = MESSAGE_RE.search(text)
    return {
        "message": _unescape(msg.group(1)) if msg else None,
        "design": {"shapes": shapes, "edges": edges},
    }


def _clean_columns(raw: object) -> list[dict]:
    if not isinstance(raw, list):
        return []
    columns: list[dict] = []
    for item in raw:
        if len(columns) >= MAX_COLUMNS:
            break
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        col: dict = {
            "name": name[:40],
            "type": (str(item.get("type") or "text").strip() or "text")[:24],
        }
        key = str(item.get("key") or "").strip().lower()
        if key in ("pk", "fk"):
            col["key"] = key
        columns.append(col)
    return columns


def _clean_design(raw: object) -> dict | None:
    """Keep only valid shapes and edges so the canvas never receives bad data."""
    if not isinstance(raw, dict):
        return None

    shapes: list[dict] = []
    seen_ids: set[str] = set()
    for item in raw.get("shapes") or []:
        if len(shapes) >= MAX_SHAPES:
            break
        try:
            shape_id = str(item["id"])
            shape_type = item["type"]
            if shape_type not in VALID_TYPES or shape_id in seen_ids:
                continue
            shape: dict = {
                "id": shape_id,
                "type": shape_type,
                "x": float(item["x"]),
                "y": float(item["y"]),
                "label": str(item.get("label", ""))[:40],
            }
            if shape_type == "entity":
                shape["columns"] = _clean_columns(item.get("columns"))
            else:
                tech = str(item.get("tech") or "").strip()
                description = str(item.get("description") or "").strip()
                if tech:
                    shape["tech"] = tech[:30]
                if description:
                    shape["description"] = description[:70]
            shapes.append(shape)
            seen_ids.add(shape_id)
        except (KeyError, TypeError, ValueError):
            continue

    edges: list[dict] = []
    seen_pairs: set[tuple[str, str]] = set()
    for i, item in enumerate(raw.get("edges") or []):
        if len(edges) >= MAX_EDGES:
            break
        try:
            src, dst = str(item["from"]), str(item["to"])
        except (KeyError, TypeError):
            continue
        if src in seen_ids and dst in seen_ids and src != dst and (src, dst) not in seen_pairs:
            seen_pairs.add((src, dst))
            edge: dict = {"id": str(item.get("id") or f"e{i + 1}"), "from": src, "to": dst}
            label = str(item.get("label") or "").strip()
            if label:
                edge["label"] = label[:20]
            edges.append(edge)

    if not shapes:
        return None
    return {"shapes": shapes, "edges": edges}


def _looks_like_json(text: str) -> bool:
    return text.lstrip().startswith(("{", "```")) or '"design"' in text


def _parse_design(content: str, model: str, finish_reason: str | None) -> dict | None:
    try:
        return _extract_json(content)
    except ValueError:
        data = _salvage(content)
        if data is not None:
            logger.warning(
                "CHAT: %s JSON was cut off (finish_reason=%s). Recovered %d shapes.",
                model,
                finish_reason,
                len(data["design"]["shapes"]),
            )
        return data


def _parse_text(content: str, model: str, finish_reason: str | None) -> str | None:
    text = content.strip()
    # Too short to be an answer, or the output of a safety classifier ("User Safety: safe").
    if len(text) < 20 or re.match(r"^\s*(user\s*)?safety\s*:", text, re.IGNORECASE):
        return None
    return text


# ---------------------------------------------------------------------------
# Calling the models
# ---------------------------------------------------------------------------


async def _try_models(
    client: AsyncOpenAI,
    candidates: list[str],
    messages: list[dict],
    parse: Callable[[str, str, str | None], object | None],
) -> tuple[object | None, list[str], int, int, bool]:
    """Try one model after another until one gives an answer that `parse` accepts.

    Returns: (result, texts of failed answers, rate limit count, failure count, daily limit hit)
    """
    rate_limited = 0
    failed = 0
    daily_limit = False
    failed_contents: list[str] = []
    started = time.monotonic()

    for model in candidates:
        if time.monotonic() - started > TOTAL_TIME_BUDGET_SECONDS:
            logger.warning("CHAT: time budget used up, stopping")
            break

        try:
            completion = await client.chat.completions.create(
                model=model,
                max_tokens=4000,
                messages=messages,
            )
        except RateLimitError as e:
            rate_limited += 1
            text = str(e)
            if _is_daily_limit(text):
                # The limit is for the whole account, so other models would fail too.
                daily_limit = True
                logger.warning("CHAT: daily free limit reached (%s): %s", model, text[:200])
                break
            _cool_down(model, RATE_LIMIT_COOLDOWN_SECONDS)
            logger.warning("CHAT: %s is rate limited (%s), trying the next model", model, text[:120])
            continue
        except APIError as e:
            failed += 1
            text = str(e)
            if getattr(e, "status_code", None) == 404 or "unavailable" in text.lower():
                _cool_down(model, UNAVAILABLE_COOLDOWN_SECONDS)
            logger.warning("CHAT: %s failed (%s), trying the next model", model, text[:160])
            continue
        except Exception:
            failed += 1
            logger.exception("CHAT: %s raised an unexpected error, trying the next model", model)
            continue

        if not completion.choices:
            failed += 1
            logger.warning("CHAT: %s returned no choices, trying the next model", model)
            continue

        choice = completion.choices[0]
        content = choice.message.content or ""
        result = parse(content, model, choice.finish_reason)
        if result is not None:
            logger.info("CHAT: used model %s", model)
            return result, failed_contents, rate_limited, failed, daily_limit

        failed += 1
        failed_contents.append(content)
        logger.warning(
            "CHAT: %s gave no usable answer (finish_reason=%s, length=%d). Start: %r",
            model,
            choice.finish_reason,
            len(content),
            content[:200],
        )

    return None, failed_contents, rate_limited, failed, daily_limit


def _no_answer_error(rate_limited: int, failed: int, daily_limit: bool) -> HTTPException:
    if daily_limit:
        return HTTPException(
            status_code=429,
            detail=(
                "The free AI limit for today is used up. It resets once a day. "
                "Try again later, or turn on demo mode (MOCK_AI) in the backend."
            ),
        )
    if rate_limited and not failed:
        return HTTPException(
            status_code=429,
            detail="The free AI models are busy right now. Try again in a minute.",
        )
    return HTTPException(
        status_code=502,
        detail=(
            "None of the free AI models could answer right now. "
            "Try again in a minute or shorten your description."
        ),
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/models", response_model=list[ModelOut])
async def list_models(current_user: User = Depends(get_current_user)):
    """The free models that can be picked in the app (models that just failed are hidden)."""
    if not settings.openrouter_api_key:
        return []
    items = [m for m in await _free_model_items() if not _is_cooling(m["id"])]
    return [ModelOut(id=m["id"], name=m["name"]) for m in items[:25]]


@router.post("", response_model=ChatResponse)
async def send_chat_message(
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    message = body.message.strip()[:4000]
    if not message:
        raise HTTPException(status_code=400, detail="Message is empty")

    ask = body.mode == "ask"
    diagram = body.diagram if body.diagram in ("architecture", "erd") else None

    # Mock mode: no AI call. Returns a sample diagram, so the app can be tried for free.
    if settings.mock_ai:
        if ask:
            return ChatResponse(
                task_id=str(uuid.uuid4()),
                status="completed",
                reply=(
                    "Demo mode is on, so I can't analyze your design. "
                    "Set MOCK_AI=false in the backend .env to ask questions."
                ),
                design=None,
            )
        wants_erd = diagram == "erd" or (
            diagram is None and any(word in message.lower() for word in ERD_WORDS)
        )
        return ChatResponse(
            task_id=str(uuid.uuid4()),
            status="completed",
            reply=(
                "Here is a sample database diagram (demo mode, no live AI)."
                if wants_erd
                else "Here is a sample design (demo mode, no live AI)."
            ),
            design=MOCK_ERD if wants_erd else MOCK_DESIGN,
        )

    client = _make_client()
    preferred = body.model if body.model and MODEL_ID_RE.match(body.model) else None
    candidates = await _candidate_models(preferred)
    if client is None or not candidates:
        raise HTTPException(
            status_code=500,
            detail="No AI key configured. Set OPENROUTER_API_KEY or OPENAI_API_KEY.",
        )

    # ---- Ask: answer a question about the current design --------------------
    if ask:
        context_text = json.dumps(body.context or {}, ensure_ascii=False)[:6000]
        messages = [
            {"role": "system", "content": f"{ASK_PROMPT}\n\nCurrent design (JSON):\n{context_text}"},
            {"role": "user", "content": message},
        ]
        answer, _, rate_limited, failed, daily_limit = await _try_models(
            client, candidates, messages, _parse_text
        )
        if answer is None:
            raise _no_answer_error(rate_limited, failed, daily_limit)
        return ChatResponse(
            task_id=str(uuid.uuid4()), status="completed", reply=str(answer), design=None
        )

    # ---- Generate: draw a diagram -------------------------------------------
    if diagram == "erd":
        user_text = f"Draw an entity relationship diagram (database tables with columns) for: {message}"
    elif diagram == "architecture":
        user_text = f"Draw a system architecture diagram for: {message}"
    else:
        user_text = message

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_text},
    ]
    data, failed_contents, rate_limited, failed, daily_limit = await _try_models(
        client, candidates, messages, _parse_design
    )

    if data is None:
        # A model answered in plain text. Show it, with no design.
        for content in failed_contents:
            if len(content.strip()) >= 80 and not _looks_like_json(content):
                return ChatResponse(
                    task_id=str(uuid.uuid4()),
                    status="completed",
                    reply=content.strip(),
                    design=None,
                )
        raise _no_answer_error(rate_limited, failed, daily_limit)

    assert isinstance(data, dict)
    reply = str(data.get("message") or "Here is your design.")
    design = link_entities(_clean_design(data.get("design")))

    return ChatResponse(
        task_id=str(uuid.uuid4()),
        status="completed",
        reply=reply,
        design=design,
    )