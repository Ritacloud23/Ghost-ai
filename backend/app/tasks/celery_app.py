from celery import Celery

from app.config import settings

celery_app = Celery(
    "ghost_ai",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 min max per task
)

# Auto-discover tasks
celery_app.autodiscover_tasks(["app.tasks"])
