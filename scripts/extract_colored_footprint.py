#!/usr/bin/env python3
"""
Extract store footprints from a colored mall floor plan (green_city style).

Each green blob is one shop footprint. All green areas on the plan become zones.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
PYTHON_DIR = ROOT / "python"
PUBLIC_DIR = ROOT / "public"
OUT_JSON = ROOT / "src" / "data" / "generated" / "floor1.json"

DEFAULT_INPUT = PYTHON_DIR / "data" / "green_city.png"

PX_PER_UNIT = 10
FOOTPRINT_HEIGHT_METERS = 2.4

GREEN_H_LO = 35
GREEN_H_HI = 85
GREEN_S_MIN = 25
GREEN_V_MIN = 25

# Keep every real shop footprint; drop only tiny noise pixels.
MIN_ZONE_AREA_PX = 120
MIN_ZONE_WIDTH_PX = 6
MIN_ZONE_HEIGHT_PX = 6

SIMPLIFY_EPS = 0.006
MAX_VERTICES = 32


def build_green_mask(img_bgr: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    return (
        (h >= GREEN_H_LO)
        & (h <= GREEN_H_HI)
        & (s >= GREEN_S_MIN)
        & (v >= GREEN_V_MIN)
    ).astype(np.uint8) * 255


def fill_holes_in_mask(mask: np.ndarray) -> np.ndarray:
    """Fill letter/icon holes inside a single connected component."""
    h, w = mask.shape[:2]
    flood = mask.copy()
    ff_mask = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(flood, ff_mask, (0, 0), 255)
    holes = cv2.bitwise_not(flood)
    return cv2.bitwise_or(mask, holes)


def contour_for_component(component_mask: np.ndarray) -> np.ndarray | None:
    filled = fill_holes_in_mask(component_mask)
    contours, _ = cv2.findContours(filled, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    cnt = max(contours, key=cv2.contourArea)
    peri = float(cv2.arcLength(cnt, True))
    if peri < 1:
        return None

    approx = cv2.approxPolyDP(cnt, SIMPLIFY_EPS * peri, True)
    if len(approx) < 3:
        return None
    if len(approx) > MAX_VERTICES:
        approx = cv2.approxPolyDP(cnt, SIMPLIFY_EPS * 2.5 * peri, True)
    if len(approx) < 3 or len(approx) > MAX_VERTICES:
        return None

    return approx.reshape(-1, 2)


def extract_green_footprints(img_bgr: np.ndarray) -> list[tuple[float, np.ndarray]]:
    mask = build_green_mask(img_bgr)
    num, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)

    regions: list[tuple[float, np.ndarray]] = []
    for i in range(1, num):
        x, y, w, h, area = stats[i]
        if area < MIN_ZONE_AREA_PX:
            continue
        if w < MIN_ZONE_WIDTH_PX or h < MIN_ZONE_HEIGHT_PX:
            continue

        component_mask = (labels == i).astype(np.uint8) * 255
        contour = contour_for_component(component_mask)
        if contour is None:
            continue

        regions.append((float(area), contour))

    regions.sort(key=lambda r: r[0], reverse=True)
    return regions


def build_zone_entry(idx: int, approx_points_px: np.ndarray) -> dict:
    scale = 1.0 / PX_PER_UNIT
    points = [[round(float(x) * scale, 2), round(float(y) * scale, 2)] for x, y in approx_points_px]
    return {
        "id": str(idx),
        "name": f"Зона {idx}",
        "category": "shop",
        "points": points,
    }


def main() -> int:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_INPUT
    if not src.exists():
        raise SystemExit(f"Cannot read input: {src}")

    img = cv2.imread(str(src))
    if img is None:
        raise SystemExit(f"cv2.imread failed for: {src}")

    regions = extract_green_footprints(img)
    zones = [build_zone_entry(i, pts) for i, (_, pts) in enumerate(regions, start=1)]

    h, w = img.shape[:2]
    plan_width = round(float(w) / PX_PER_UNIT, 2)
    plan_height = round(float(h) / PX_PER_UNIT, 2)

    data = {
        "planBounds": {"width": plan_width, "height": plan_height},
        "wallPxPerUnit": PX_PER_UNIT,
        "footprintModel": "floor-footprint.glb",
        "footprintHeight": FOOTPRINT_HEIGHT_METERS,
        "zones": zones,
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    cv2.imwrite(str(PUBLIC_DIR / "floor-plan.png"), img)

    print(f"Input: {src}")
    print(f"Image: {w}x{h} px -> planBounds {plan_width}x{plan_height} units")
    print(f"Zones: {len(zones)}")
    print(f"Written: {OUT_JSON}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
