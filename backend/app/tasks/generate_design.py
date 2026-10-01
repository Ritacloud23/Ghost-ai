from app.tasks.celery_app import celery_app


@celery_app.task(name="generate_design")
def generate_design(project_id: str, prompt: str) -> dict:
    """
    Generate a system design from a text prompt using an LLM.
    Returns a dict with shapes and edges.
    """
    # TODO: Call LLM with prompt, parse response into shapes + edges
    # TODO: Broadcast design to WebSocket room
    return {"project_id": project_id, "status": "completed", "shapes": [], "edges": []}
