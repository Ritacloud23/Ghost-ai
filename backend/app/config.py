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

    # Vercel Blob
    vercel_blob_token: str = ""

    # App
    cors_origins: list[str] = ["http://localhost:3000"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
