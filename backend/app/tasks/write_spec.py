from app.tasks.celery_app import celery_app


@celery_app.task(name="write_spec")
def write_spec(project_id: str, design: dict) -> dict:
    """
    Generate a markdown spec from a design (shapes + edges).
    Upload to Vercel Blob and return the URL.
    """
    # TODO: Convert design to markdown
    # TODO: Upload to Vercel Blob
    # TODO: Save snapshot to DB
    return {"project_id": project_id, "status": "completed", "blob_url": ""}
