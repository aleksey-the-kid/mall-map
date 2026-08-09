## Why

Admins currently upload a 2D plan and get green shop blobs auto-extracted into 3D zones, but they cannot annotate or refine geometry on the plan image itself. Vertex-accurate shopping footprints need a 2D editor: draw freeform polygons, place rectangles, auto-detect accent-colored shops, then select/move/delete and reshape only when a figure is selected.

## What Changes

- Add an admin **2D floor-plan editor** that shows the uploaded plan image and overlays editable shop figures (polygons filled green for now).
- Add a **Detect shops** action that finds accent-colored regions on the plan and creates figures over them (reuse/extend the existing OpenCV green-detection pipeline; keep green as the default accent).
- Support **manual rectangle drawing** on the image.
- Support **freeform polygon drawing**: click to place vertices; clicking near the first vertex closes the polygon and fills it.
- Figures are **not editable by default**. Clicking a figure selects it (highlights vertices); selected figures can be moved, reshaped by dragging vertices, or deleted.
- Persist edited figures as zone polygons in the existing `floor_json` / zones model so the 3D map stays in sync.
- Keep existing upload + background processing; the 2D editor is the primary place to create and refine zones after (or instead of relying only on) automatic extraction.

## Capabilities

### New Capabilities
- `floor-plan-2d-editor`: Interactive 2D canvas in admin for viewing a floor plan image, drawing rectangles and freeform polygons, selecting figures, moving/reshaping/deleting them, and saving geometry as zones.
- `accent-shop-detection`: Admin action to auto-detect shopping regions by accent color on the plan image and create overlay figures for those regions.

### Modified Capabilities
- (none — no existing OpenSpec specs yet)

## Impact

- **Frontend:** `AdminView.vue` and related admin composables; new 2D canvas/editor component(s); zone create/update/delete flows from `useFloorAdmin.js` / `useMallData.js`.
- **Backend / pipeline:** Existing `POST /floors/{id}/upload-plan` and OpenCV extract script; may add or expose a re-detect endpoint or reuse status/zones PATCH for detection results.
- **Data:** Zone `points` polygons in `floors.floor_json` (and normalized `zones` via existing sync); no breaking schema change expected.
- **UX:** Complements (does not remove) the current 3D admin map tools; 2D editor becomes the source of truth for footprint outlines.
