import uuid
from datetime import datetime
from pathlib import Path


async def upload_snapshot(filename: str, content: bytes) -> str:
    """Store a snapshot locally as a fallback when no blob provider is configured."""
    base_dir = Path("uploads") / "snapshots" / datetime.now().strftime("%Y/%m/%d")
    base_dir.mkdir(parents=True, exist_ok=True)

    file_name = f"{uuid.uuid4()}-{filename}"
    file_path = base_dir / file_name
    file_path.write_bytes(content)

    return f"file://{file_path.resolve()}"
