from __future__ import annotations

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from .config import get_settings

security = HTTPBearer(auto_error=False)

_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient | None:
    global _jwks_client
    settings = get_settings()
    if not settings.supabase_url:
        return None
    if _jwks_client is None:
        jwks_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url)
    return _jwks_client


def _decode_token(token: str) -> dict:
    settings = get_settings()
    errors: list[str] = []

    jwks = _get_jwks_client()
    if jwks:
        try:
            signing_key = jwks.get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256", "RS256"],
                audience="authenticated",
            )
        except jwt.PyJWTError as exc:
            errors.append(f"JWKS: {exc}")

    if settings.supabase_jwt_secret:
        try:
            return jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
        except jwt.PyJWTError as exc:
            errors.append(f"HS256: {exc}")

    detail = "Invalid token"
    if errors:
        detail = f"Invalid token ({'; '.join(errors)})"
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail)


def verify_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    settings = get_settings()
    if not settings.supabase_jwt_secret and not settings.supabase_url:
        return {"role": "service", "sub": "dev"}

    if not credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing authorization token")

    return _decode_token(credentials.credentials)
