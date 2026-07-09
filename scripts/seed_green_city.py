#!/usr/bin/env python3
"""Seed GREEN CITY mall and floor 1 into Supabase (run after applying migration)."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

MALL_NAME = "GREEN CITY"
MALL_ADDRESS = "г. Минск, ул. Притыцкого, 156/1"
FLOOR_JSON = ROOT / "src" / "data" / "generated" / "floor1.json"
GLB_FILE = ROOT / "public" / "floor-footprint.glb"
PLAN_FILE = ROOT / "public" / "floor-plan.png"


def main() -> int:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        return 1

    from supabase import create_client

    sb = create_client(url, key)

    with open(FLOOR_JSON, encoding="utf-8") as f:
        floor_data = json.load(f)

    malls = sb.table("malls").select("id").eq("name", MALL_NAME).execute()
    if malls.data:
        mall_id = malls.data[0]["id"]
        print(f"Mall already exists: {mall_id}")
    else:
        mall = sb.table("malls").insert({"name": MALL_NAME, "address": MALL_ADDRESS}).execute()
        mall_id = mall.data[0]["id"]
        print(f"Created mall: {mall_id}")

    floors = sb.table("floors").select("id").eq("mall_id", mall_id).execute()
    if floors.data:
        floor_id = floors.data[0]["id"]
        print(f"Floor already exists: {floor_id}")
    else:
        floor = (
            sb.table("floors")
            .insert(
                {
                    "mall_id": mall_id,
                    "label": "1 этаж",
                    "sort_order": 1,
                    "status": "processing",
                    "footprint_height": floor_data.get("footprintHeight", 2.4),
                }
            )
            .execute()
        )
        floor_id = floor.data[0]["id"]
        print(f"Created floor: {floor_id}")

    prefix = f"malls/{mall_id}/floors/{floor_id}"

    if PLAN_FILE.exists():
        plan_path = f"{prefix}/plan.png"
        with open(PLAN_FILE, "rb") as f:
            sb.storage.from_("floor-assets").upload(
                plan_path, f.read(), {"content-type": "image/png", "upsert": "true"}
            )
        print(f"Uploaded plan: {plan_path}")
    else:
        plan_path = None
        print("No plan.png found, skipping")

    glb_path = f"{prefix}/footprint.glb"
    with open(GLB_FILE, "rb") as f:
        sb.storage.from_("floor-assets").upload(
            glb_path, f.read(), {"content-type": "model/gltf-binary", "upsert": "true"}
        )
    print(f"Uploaded GLB: {glb_path}")

    sb.table("floors").update(
        {
            "status": "ready",
            "plan_image_path": plan_path,
            "glb_path": glb_path,
            "floor_json": floor_data,
        }
    ).eq("id", floor_id).execute()

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
