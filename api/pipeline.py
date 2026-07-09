from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

from .config import get_settings

ROOT = Path(__file__).resolve().parents[1]
EXTRACT_SCRIPT = ROOT / "scripts" / "extract_colored_footprint.py"
BUILD_SCRIPT = ROOT / "scripts" / "build_footprint_glb.mjs"


class PipelineError(Exception):
    pass


def process_plan_image(image_bytes: bytes) -> dict:
    settings = get_settings()

    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        input_path = work / "input.png"
        out_json = work / "floor.json"
        out_plan = work / "plan.png"
        out_glb = work / "footprint.glb"

        input_path.write_bytes(image_bytes)

        extract_cmd = [
            settings.python_bin,
            str(EXTRACT_SCRIPT),
            str(input_path),
            "--out-json",
            str(out_json),
            "--out-plan",
            str(out_plan),
            "--glb-name",
            "footprint.glb",
        ]
        result = subprocess.run(extract_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise PipelineError(result.stderr or result.stdout or "Extraction failed")

        build_cmd = [
            settings.node_bin,
            str(BUILD_SCRIPT),
            "--json",
            str(out_json),
            "--out",
            str(out_glb),
        ]
        result = subprocess.run(build_cmd, capture_output=True, text=True, cwd=str(ROOT))
        if result.returncode != 0:
            raise PipelineError(result.stderr or result.stdout or "GLB build failed")

        floor_data = json.loads(out_json.read_text(encoding="utf-8"))

        return {
            "floor_json": floor_data,
            "plan_bytes": out_plan.read_bytes(),
            "glb_bytes": out_glb.read_bytes(),
        }
