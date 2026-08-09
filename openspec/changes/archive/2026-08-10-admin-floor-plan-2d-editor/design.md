## Context

Mall Map already supports uploading a 2D floor plan in admin (`AdminView.vue`), running an OpenCV green-blob pipeline (`scripts/extract_colored_footprint.py` via `api/pipeline.py`), and storing zone polygons in `floors.floor_json`. Geometry editing today is 3D-first: select extruded zones, move with TransformControls, tweak size in `AdminPanel.vue`, or insert an axis-aligned rectangle via `useFloorAdmin.addZone()`. There is no interactive 2D annotation surface on the plan image, no click-to-close freeform polygons, and no vertex handles.

This change adds a 2D plan editor as the primary way to create and refine shop footprints, while keeping the existing upload/pipeline and zone persistence model.

## Goals / Non-Goals

**Goals:**
- Interactive 2D canvas over the floor plan image in admin
- Modes: select, rectangle draw, freeform polygon draw, delete
- Auto-detect accent-colored shops (green default) and place figures
- Select-to-edit: vertex handles and move only when selected
- Persist polygons as existing zone `points` in plan space

**Non-Goals:**
- Configurable accent-color picker UI (keep green default; pipeline can stay green HSV)
- Replacing the 3D admin map (it remains for heights, offsets, scene objects)
- Client-side OpenCV rewrite (prefer existing server pipeline)
- Multi-select, boolean ops (union/subtract), or bezier curves
- Changing visitor-facing map UX

## Decisions

### 1. Canvas approach: HTML canvas / SVG overlay in Vue, not Three.js
- **Choice:** Implement a dedicated Vue component (e.g. `FloorPlan2DEditor.vue`) with the plan as an `<img>` or canvas background and figures as SVG or canvas polygons.
- **Why:** 2D hit-testing, vertex handles, and click-to-close are simpler and more precise in screen space than projecting through the 3D renderer.
- **Alternatives:** Annotate on the Three.js plan plane — rejected for awkward pointer UX and harder vertex editing.

### 2. Coordinate system: plan space as source of truth
- **Choice:** Store all figure vertices in existing plan coordinates (`points: [x,y][]`, origin top-left, Y down, same units as today / `PX_PER_UNIT`).
- **Why:** Compatibility with `zoneGeometry.js`, pipeline output, and 3D extrusion without a migration.
- **Alternatives:** Pixel-only storage — rejected; would break 3D and normalized zones.

### 3. Tool modes and interaction model
- **Choice:** Explicit toolbar modes: `select` (default), `polygon`, `rectangle`, plus Detect and Delete (delete acts on selection).
- **Polygon:** click adds vertex; click near first vertex (pixel threshold, e.g. 8–12px screen space) closes if ≥3 points; Esc/cancel drops draft.
- **Rectangle:** click-drag or two-corner click → four-point polygon.
- **Select:** click figure → select; show vertex handles; drag handle → reshape; drag fill → translate; click empty → deselect.
- **Why:** Matches the requested UX (“not editable until selected”) and avoids accidental edits.

### 4. Detection: reuse server pipeline, surface as editor action
- **Choice:** “Detect shops” calls backend processing against the current plan (reuse extract script / upload-plan pipeline or a dedicated re-detect endpoint that returns polygons without requiring a fresh file upload when the plan already exists). Merge results into editor figures / zones.
- **Why:** Detection quality already exists in Python/OpenCV; no need to ship CV in the browser for MVP.
- **Alternatives:** Pure client-side color threshold — possible later for instant feedback, but weaker than connected-components + contour approx already in the script.
- **Merge policy (MVP):** **Confirm then replace.** If the floor already has figures/zones, Detect shops asks for confirmation; on confirm, existing shop figures are replaced by detection results. If there are no existing figures, run detection without a confirm prompt.

### 5. Persistence
- **Choice:** Map each figure ↔ zone (`id`, `name`, `category: shop`, `points`, default `color` green). Use existing `PATCH /floors/{id}/zones` / `useFloorAdmin` autosave path.
- **Why:** No schema change; 3D map updates from same `floor_json`.

### 6. Admin UI placement
- **Choice:** Add a Plan / 2D tab or panel in `AdminView` alongside the existing 3D map, visible when a floor is selected and a plan URL exists (and after upload).
- **Why:** Keeps upload flow intact; editor is where geometry is refined.

## Risks / Trade-offs

- **[Risk] Detection + manual edits conflict** → Mitigation: confirm-then-replace before overwriting existing figures; cancel leaves the canvas unchanged.
- **[Risk] Zoom/pan precision on large plans** → Mitigation: support pan/zoom on the canvas with screen-space close threshold for polygon close.
- **[Risk] Dual editors (2D vs 3D) diverge UX** → Mitigation: 2D owns outline `points`; 3D keeps height/offset/objects; document that moving in 3D uses `offset` while 2D edits vertices.
- **[Trade-off] Server-side detect latency** → Acceptable for admin; show loading state on Detect button.

## Migration Plan

1. Ship 2D editor reading existing `floor_json.zones` (no data migration).
2. New figures save through current zones PATCH + `floor_sync`.
3. Rollback: hide editor UI; existing zones and 3D tools remain.

## Open Questions

- Minimum vertex count and close-threshold in px (propose ≥3 verts, ~10px screen radius).
- Whether rectangle mode is required in v1 if freeform polygon can approximate rectangles (proposal includes both; rectangle is a convenience).
