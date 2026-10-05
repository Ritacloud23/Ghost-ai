from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import field_validator
from pydantic_settings import BaseSettings


def normalize_database_url(url: str) -> str:
    """Make any Postgres address work with the async driver (asyncpg).

    Hosts such as Railway, Render and Neon give a plain "postgresql://..." address.
    The app needs "postgresql+asyncpg://...", and asyncpg wants "ssl=" instead of "sslmode=".
    """
    url = url.strip()

    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]

    parts = urlsplit(url)
    query = [(k, v) for k, v in parse_qsl(parts.query) if k != "channel_binding"]
    query = [("ssl", v) if k == "sslmode" else (k, v) for k, v in query]
    return urlunsplit(parts._replace(query=urlencode(query)))


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://ghost:ghost@localhost:5432/ghost_ai"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Clerk
    clerk_secret_key: str = ""
    clerk_jwks_url: str = ""

    # AI
    openai_api_key: str = ""
    openrouter_api_key: str = ""
    ai_model: str = "openrouter/free"
    mock_ai: bool = False

    # Vercel Blob
    vercel_blob_token: str = ""

    # App
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    @field_validator("database_url")
    @classmethod
    def _use_async_driver(cls, value: str) -> str:
        return normalize_database_url(value)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()