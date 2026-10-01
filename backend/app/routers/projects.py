from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.collaborator import Collaborator, Role

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    name: str


class ProjectResponse(BaseModel):
    id: str
    name: str
    owner_id: str
    created_at: str

    class Config:
        from_attributes = True


class CollaboratorAdd(BaseModel):
    email: str
    role: Role = Role.EDITOR


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Projects owned by user
    result = await db.execute(select(Project).where(Project.owner_id == current_user.id))
    owned = result.scalars().all()

    # Projects where user is a collaborator
    result = await db.execute(
        select(Project)
        .join(Collaborator, Collaborator.project_id == Project.id)
        .where(Collaborator.user_id == current_user.id)
    )
    collab = result.scalars().all()

    # Deduplicate
    seen = set()
    projects = []
    for p in list(owned) + list(collab):
        if p.id not in seen:
            seen.add(p.id)
            projects.append(p)

    return projects


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = Project(name=body.name, owner_id=current_user.id)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check access
    if project.owner_id != current_user.id:
        result = await db.execute(
            select(Collaborator).where(
                Collaborator.project_id == project_id,
                Collaborator.user_id == current_user.id,
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Access denied")

    return project


@router.post("/{project_id}/collaborators", status_code=status.HTTP_201_CREATED)
async def add_collaborator(
    project_id: str,
    body: CollaboratorAdd,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Only owner can add collaborators
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can add collaborators")

    # Find user by email
    result = await db.execute(select(User).where(User.email == body.email))
    target_user = result.scalar_one_or_none()

    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if already a collaborator
    result = await db.execute(
        select(Collaborator).where(
            Collaborator.project_id == project_id,
            Collaborator.user_id == target_user.id,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already a collaborator")

    collab = Collaborator(project_id=project_id, user_id=target_user.id, role=body.role)
    db.add(collab)
    await db.commit()
    return {"status": "ok"}
