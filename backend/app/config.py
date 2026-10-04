from pydantic_settings import BaseSettings


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

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()