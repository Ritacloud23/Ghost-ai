import asyncio
import logging

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User

logger = logging.getLogger("uvicorn.error")

security = HTTPBearer(auto_error=False)

# Cached client: downloads Clerk's public keys once and reuses them.
_jwks_client = PyJWKClient(settings.clerk_jwks_url) if settings.clerk_jwks_url else None


async def _verify_clerk_token(token: str) -> str:
    """Verify the Clerk session JWT and return the Clerk user id (the `sub` claim)."""
    if _jwks_client is None:
        logger.error("CLERK_JWKS_URL is not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="CLERK_JWKS_URL is not configured",
        )
    try:
        # PyJWKClient is synchronous, so run it off the event loop.
        signing_key = await asyncio.to_thread(_jwks_client.get_signing_key_from_jwt, token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            leeway=30,  # tolerate small clock differences between machines
            options={"verify_aud": False},  # Clerk session tokens usually have no `aud`
        )
    except jwt.PyJWTError as e:
        # The real reason is logged here; the client only sees "Invalid token".
        logger.error("JWT ERROR: %s: %s", type(e).__name__, e)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    clerk_id = claims.get("sub")
    if not clerk_id:
        logger.error("JWT ERROR: token has no 'sub' claim")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return clerk_id


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    clerk_id = await _verify_clerk_token(credentials.credentials)

    result = await db.execute(select(User).where(User.clerk_id == clerk_id))
    user = result.scalar_one_or_none()

    if not user:
        # First request from this Clerk user: create the row (no webhook needed).
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.clerk.com/v1/users/{clerk_id}",
                headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
            )
            resp.raise_for_status()
            data = resp.json()

        emails = data.get("email_addresses") or [{}]
        user = User(
            clerk_id=clerk_id,
            email=emails[0].get("email_address", ""),
            name=" ".join(filter(None, [data.get("first_name"), data.get("last_name")])) or None,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    return user