import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, Enum, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.models.base import Base


class Role(str, enum.Enum):
    VIEWER = "VIEWER"
    EDITOR = "EDITOR"


class Collaborator(Base):
    __tablename__ = "collaborators"
    __table_args__ = (UniqueConstraint("project_id", "user_id", name="uq_project_user"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.EDITOR, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="collaborators")
    user = relationship("User", back_populates="collaborations")
