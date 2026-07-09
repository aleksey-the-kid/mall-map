from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from .config import get_settings


@lru_cache
def get_supabase() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def storage_public_url(path: str) -> str:
    settings = get_settings()
    base = settings.supabase_url.rstrip("/")
    return f"{base}/storage/v1/object/public/floor-assets/{path}"
