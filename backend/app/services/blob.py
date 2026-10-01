import httpx

from app.config import settings


async def upload_snapshot(filename: str, content: bytes) -> str:
    """Upload a snapshot to Vercel Blob and return the URL."""
    # TODO: Use vercel-blob SDK or direct API call
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"https://blob.vercel.com/{filename}",
            headers={"Authorization": f"Bearer {settings.vercel_blob_token}"},
            content=content,
        )
        response.raise_for_status()
        data = response.json()
        return data["url"]
