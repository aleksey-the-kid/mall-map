from __future__ import annotations

from typing import Any

SEARCHABLE_ZONE_KEYS = frozenset({"id", "name", "category", "description", "tags"})
SEARCHABLE_OBJECT_KEYS = frozenset(
    {"id", "assetId", "name", "category", "description", "tags", "position"}
)


def _zone_geometry(zone: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in zone.items() if key not in SEARCHABLE_ZONE_KEYS}


def _normalize_tags(tags: Any) -> list[str]:
    if not isinstance(tags, list):
        return []
    seen: set[str] = set()
    result: list[str] = []
    for tag in tags:
        value = str(tag).strip()
        if not value or value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def sync_floor_normalized_data(sb, floor_id: str, floor_json: dict[str, Any]) -> None:
    zones = floor_json.get("zones") or []
    objects = floor_json.get("objects") or []

    existing_zones = (
        sb.table("zones").select("external_id").eq("floor_id", floor_id).execute().data or []
    )
    existing_objects = (
        sb.table("scene_objects")
        .select("external_id")
        .eq("floor_id", floor_id)
        .execute()
        .data
        or []
    )

    zone_ids = {str(zone.get("id")) for zone in zones if zone.get("id") is not None}
    object_ids = {str(obj.get("id")) for obj in objects if obj.get("id") is not None}

    for row in existing_zones:
        external_id = row["external_id"]
        if external_id not in zone_ids:
            sb.table("zones").delete().eq("floor_id", floor_id).eq(
                "external_id", external_id
            ).execute()

    for row in existing_objects:
        external_id = row["external_id"]
        if external_id not in object_ids:
            sb.table("scene_objects").delete().eq("floor_id", floor_id).eq(
                "external_id", external_id
            ).execute()

    for zone in zones:
        external_id = zone.get("id")
        if external_id is None:
            continue
        sb.table("zones").upsert(
            {
                "floor_id": floor_id,
                "external_id": str(external_id),
                "name": str(zone.get("name") or ""),
                "category": str(zone.get("category") or "shop"),
                "description": str(zone.get("description") or ""),
                "tags": _normalize_tags(zone.get("tags")),
                "geometry": _zone_geometry(zone),
            },
            on_conflict="floor_id,external_id",
        ).execute()

    for obj in objects:
        external_id = obj.get("id")
        asset_id = obj.get("assetId")
        if external_id is None or not asset_id:
            continue
        position = obj.get("position") or [0, 0]
        sb.table("scene_objects").upsert(
            {
                "floor_id": floor_id,
                "external_id": str(external_id),
                "asset_id": str(asset_id),
                "position": position,
                "name": str(obj.get("name") or ""),
                "category": str(obj.get("category") or "poi"),
                "description": str(obj.get("description") or ""),
                "tags": _normalize_tags(obj.get("tags")),
            },
            on_conflict="floor_id,external_id",
        ).execute()
