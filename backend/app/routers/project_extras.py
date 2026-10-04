import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import engine, get_db
from app.dependencies import get_current_user
from app.models.canvas_state import CanvasState
from app.models.collaborator import Collaborator
from app.models.project import Project
from app.models.user import User

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/projects", tags=["project-extras"])

MAX_SHAPES = 200
MAX_EDGES = 600
MAX_CANVAS_BYTES = 1_000_000

_table_ready = False


async def _ensure_table() -> None:
    """Create the canvas_states table the first time it is needed."""
    global _table_ready
    if _table_ready:
        return
    async with engine.begin() as conn:
        await conn.run_sync(
            lambda sync_conn: CanvasState.__table__.create(sync_conn, checkfirst=True)
        )
    _table_ready = True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_project(db: AsyncSession, project_id: str) -> Project:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _require_access(db: AsyncSession, project: Project, user: User) -> None:
    """The owner and collaborators may use a project."""
    if project.owner_id == user.id:
        return
    result = await db.execute(
        select(Collaborator).where(
            Collaborator.project_id == project.id,
            Collaborator.user_id == user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=403, detail="You do not have access to this project")


def _role_text(role: object) -> str:
    return str(getattr(role, "value", role)).lower()


def _default_role():
    """The role given to someone invited from the People tab (an editor)."""
    column_type = Collaborator.__table__.c.role.type

    enum_class = getattr(column_type, "enum_class", None)
    if enum_class is not None:
        members = list(enum_class)
        for member in members:
            if "edit" in str(member.name).lower() or "edit" in str(member.value).lower():
                return member
        if members:
            return members[-1]

    enums = getattr(column_type, "enums", None)
    if enums:
        for name in enums:
            if "edit" in str(name).lower():
                return name
        return enums[-1]

    return "editor"


# ---------------------------------------------------------------------------
# People
# ---------------------------------------------------------------------------


class MemberOut(BaseModel):
    user_id: str
    name: str | None = None
    email: str
    role: str
    is_you: bool = False


class InviteIn(BaseModel):
    email: str


@router.get("/{project_id}/members", response_model=list[MemberOut])
async def list_members(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project(db, project_id)
    await _require_access(db, project, user)

    members: list[MemberOut] = []

    owner = await db.get(User, project.owner_id)
    if owner is not None:
        members.append(
            MemberOut(
                user_id=owner.id,
                name=owner.name,
                email=owner.email,
                role="owner",
                is_you=owner.id == user.id,
            )
        )

    result = await db.execute(
        select(Collaborator, User)
        .join(User, User.id == Collaborator.user_id)
        .where(Collaborator.project_id == project_id)
    )
    for collab, member_user in result.all():
        if member_user.id == project.owner_id:
            continue
        members.append(
            MemberOut(
                user_id=member_user.id,
                name=member_user.name,
                email=member_user.email,
                role=_role_text(collab.role),
                is_you=member_user.id == user.id,
            )
        )
    return members


@router.post("/{project_id}/members", response_model=MemberOut)
async def invite_member(
    project_id: str,
    body: InviteIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project(db, project_id)
    if project.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only the owner can invite people")

    email = body.email.strip().lower()
    if "@" not in email or len(email) > 254:
        raise HTTPException(status_code=400, detail="Enter a valid email address")

    result = await db.execute(select(User).where(func.lower(User.email) == email))
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(
            status_code=404,
            detail="No Ghost AI account has that email. Ask them to sign in once first.",
        )
    if target.id == project.owner_id:
        raise HTTPException(status_code=409, detail="That person already owns this project")

    existing = await db.execute(
        select(Collaborator).where(
            Collaborator.project_id == project_id,
            Collaborator.user_id == target.id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Already a collaborator")

    role = _default_role()
    db.add(Collaborator(project_id=project_id, user_id=target.id, role=role))
    await db.commit()

    return MemberOut(
        user_id=target.id,
        name=target.name,
        email=target.email,
        role=_role_text(role),
        is_you=False,
    )


# ---------------------------------------------------------------------------
# Saving the canvas
# ---------------------------------------------------------------------------


class CanvasIn(BaseModel):
    shapes: list[dict]
    edges: list[dict]


@router.get("/{project_id}/canvas")
async def get_canvas(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_table()
    project = await _get_project(db, project_id)
    await _require_access(db, project, user)

    row = await db.get(CanvasState, project_id)
    if row is None:
        return {"shapes": [], "edges": [], "updated_at": None}

    data = row.data or {}
    return {
        "shapes": data.get("shapes", []),
        "edges": data.get("edges", []),
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.put("/{project_id}/canvas")
async def save_canvas(
    project_id: str,
    body: CanvasIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_table()
    project = await _get_project(db, project_id)
    await _require_access(db, project, user)

    if len(body.shapes) > MAX_SHAPES or len(body.edges) > MAX_EDGES:
        raise HTTPException(status_code=413, detail="This canvas is too large to save")

    payload = {"shapes": body.shapes, "edges": body.edges}
    if len(json.dumps(payload)) > MAX_CANVAS_BYTES:
        raise HTTPException(status_code=413, detail="This canvas is too large to save")

    row = await db.get(CanvasState, project_id)
    if row is None:
        db.add(CanvasState(project_id=project_id, data=payload))
    else:
        row.data = payload  # a new object, so the change is detected
    await db.commit()

    return {"saved": True, "updated_at": datetime.now(timezone.utc).isoformat()}