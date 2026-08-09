from __future__ import annotations

import socket
from functools import lru_cache

import httpx
from supabase import Client, create_client
from supabase.lib.client_options import SyncClientOptions

from .config import get_settings

_orig_getaddrinfo = socket.getaddrinfo
_preferred_ip: dict[str, str] = {}


def _getaddrinfo_prefer_reachable(host, port, family=0, type=0, proto=0, flags=0):
    """Reorder DNS results so a known-reachable Supabase IP is tried first.

    From some networks one of the A records for *.supabase.co is blackholed;
    the default TCP timeout for that address is ~75s before the next IP is tried.
    """
    infos = _orig_getaddrinfo(host, port, family, type, proto, flags)
    if not isinstance(host, str) or "supabase.co" not in host or len(infos) < 2:
        return infos

    preferred = _preferred_ip.get(host)
    if preferred:
        hit = [i for i in infos if i[4][0] == preferred]
        if hit:
            return hit + [i for i in infos if i[4][0] != preferred]

    for info in infos:
        ip = info[4][0]
        sock = socket.socket(info[0], info[1], info[2])
        sock.settimeout(0.5)
        try:
            sock.connect(info[4])
        except OSError:
            continue
        finally:
            sock.close()
        _preferred_ip[host] = ip
        return [i for i in infos if i[4][0] == ip] + [
            i for i in infos if i[4][0] != ip
        ]

    return infos


socket.getaddrinfo = _getaddrinfo_prefer_reachable


@lru_cache
def get_supabase() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

    # Short connect timeout so a blackholed first A-record fails fast (~2s)
    # instead of the OS default (~75s) if DNS reordering did not help.
    timeout = httpx.Timeout(60.0, connect=2.0)
    options = SyncClientOptions(
        httpx_client=httpx.Client(
            timeout=timeout,
            limits=httpx.Limits(max_keepalive_connections=10, keepalive_expiry=120.0),
        ),
        postgrest_client_timeout=timeout,
    )
    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key,
        options=options,
    )


def storage_public_url(path: str) -> str:
    settings = get_settings()
    base = settings.supabase_url.rstrip("/")
    return f"{base}/storage/v1/object/public/floor-assets/{path}"
