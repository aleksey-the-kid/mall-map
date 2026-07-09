from __future__ import annotations

import uuid
from typing import Any

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .config import get_settings
from .pipeline import PipelineError, process_plan_image
from .supabase_client import get_supabase, storage_public_url

app = FastAPI(title="Mall Map API", version="1.0.0")

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class MallCreate(BaseModel):
    name: str = Field(min_length=1)
    address: str = ""


class MallOut(BaseModel):
    id: str
    name: str
    address: str
    created_at: str


class FloorCreate(BaseModel):
    label: str = Field(min_length=1)


class FloorOut(BaseModel):
    id: str
    mall_id: str
    label: str
    sort_order: int
    status: str
    plan_image_path: str | None = None
    glb_path: str | None = None
    floor_json: dict | None = None
    footprint_height: float
    error_message: str | None = None
    plan_image_url: str | None = None
    glb_url: str | None = None


def _floor_out(row: dict) -> FloorOut:
    plan_path = row.get("plan_image_path")
    glb_path = row.get("glb_path")
    return FloorOut(
        id=row["id"],
        mall_id=row["mall_id"],
        label=row["label"],
        sort_order=row["sort_order"],
        status=row["status"],
        plan_image_path=plan_path,
        glb_path=glb_path,
        floor_json=row.get("floor_json"),
        footprint_height=row.get("footprint_height", 2.4),
        error_message=row.get("error_message"),
        plan_image_url=storage_public_url(plan_path) if plan_path else None,
        glb_url=storage_public_url(glb_path) if glb_path else None,
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/malls", response_model=list[MallOut])
def list_malls() -> list[MallOut]:
    sb = get_supabase()
    result = sb.table("malls").select("*").order("created_at").execute()
    return [MallOut(**row) for row in result.data]


@app.post("/malls", response_model=MallOut)
def create_mall(body: MallCreate) -> MallOut:
    sb = get_supabase()
    result = sb.table("malls").insert({"name": body.name, "address": body.address}).execute()
    return MallOut(**result.data[0])


@app.get("/malls/{mall_id}/floors", response_model=list[FloorOut])
def list_floors(mall_id: str) -> list[FloorOut]:
    sb = get_supabase()
    result = (
        sb.table("floors")
        .select("*")
        .eq("mall_id", mall_id)
        .order("sort_order")
        .execute()
    )
    return [_floor_out(row) for row in result.data]


@app.post("/malls/{mall_id}/floors", response_model=FloorOut)
def create_floor(
    mall_id: str,
    body: FloorCreate,
) -> FloorOut:
    sb = get_supabase()
    mall = sb.table("malls").select("id").eq("id", mall_id).execute()
    if not mall.data:
        raise HTTPException(404, "Mall not found")

    existing = sb.table("floors").select("sort_order").eq("mall_id", mall_id).execute()
    next_order = max((f["sort_order"] for f in existing.data), default=0) + 1

    result = (
        sb.table("floors")
        .insert(
            {
                "mall_id": mall_id,
                "label": body.label,
                "sort_order": next_order,
                "status": "empty",
            }
        )
        .execute()
    )
    return _floor_out(result.data[0])


def _run_upload_pipeline(floor_id: str, image_bytes: bytes) -> None:
    sb = get_supabase()
    try:
        floor = sb.table("floors").select("mall_id").eq("id", floor_id).single().execute()
        mall_id = floor.data["mall_id"]
        prefix = f"malls/{mall_id}/floors/{floor_id}"

        result = process_plan_image(image_bytes)
        floor_json = result["floor_json"]

        plan_path = f"{prefix}/plan.png"
        glb_path = f"{prefix}/footprint.glb"

        sb.storage.from_("floor-assets").upload(
            plan_path,
            result["plan_bytes"],
            {"content-type": "image/png", "upsert": "true"},
        )
        sb.storage.from_("floor-assets").upload(
            glb_path,
            result["glb_bytes"],
            {"content-type": "model/gltf-binary", "upsert": "true"},
        )

        sb.table("floors").update(
            {
                "status": "ready",
                "plan_image_path": plan_path,
                "glb_path": glb_path,
                "floor_json": floor_json,
                "footprint_height": floor_json.get("footprintHeight", 2.4),
                "error_message": None,
            }
        ).eq("id", floor_id).execute()
    except (PipelineError, Exception) as exc:
        sb.table("floors").update(
            {"status": "error", "error_message": str(exc)}
        ).eq("id", floor_id).execute()


@app.post("/floors/{floor_id}/upload-plan")
async def upload_plan(
    floor_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
) -> dict[str, str]:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Expected an image file")

    sb = get_supabase()
    floor = sb.table("floors").select("id, status").eq("id", floor_id).execute()
    if not floor.data:
        raise HTTPException(404, "Floor not found")
    if floor.data[0]["status"] == "processing":
        raise HTTPException(409, "Floor is already being processed")

    image_bytes = await file.read()
    sb.table("floors").update({"status": "processing", "error_message": None}).eq(
        "id", floor_id
    ).execute()

    background_tasks.add_task(_run_upload_pipeline, floor_id, image_bytes)
    return {"status": "processing"}


@app.get("/floors/{floor_id}/status", response_model=FloorOut)
def floor_status(floor_id: str) -> FloorOut:
    sb = get_supabase()
    result = sb.table("floors").select("*").eq("id", floor_id).execute()
    if not result.data:
        raise HTTPException(404, "Floor not found")
    return _floor_out(result.data[0])


class FloorZonesUpdate(BaseModel):
    floor_json: dict[str, Any]


@app.patch("/floors/{floor_id}/zones", response_model=FloorOut)
def update_floor_zones(
    floor_id: str,
    body: FloorZonesUpdate,
) -> FloorOut:
    sb = get_supabase()
    floor = sb.table("floors").select("id, status").eq("id", floor_id).execute()
    if not floor.data:
        raise HTTPException(404, "Floor not found")

    result = (
        sb.table("floors")
        .update({"floor_json": body.floor_json})
        .eq("id", floor_id)
        .execute()
    )
    return _floor_out(result.data[0])
