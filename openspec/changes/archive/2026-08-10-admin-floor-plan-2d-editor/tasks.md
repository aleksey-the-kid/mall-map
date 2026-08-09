## 1. Editor shell and data wiring

- [x] 1.1 Add `FloorPlan2DEditor.vue` (plan image background, empty state when no plan URL)
- [x] 1.2 Embed editor in `AdminView.vue` (tab/panel) for the selected floor with plan
- [x] 1.3 Load existing `floor_json.zones` into editor figures (plan-space `points`)
- [x] 1.4 Wire save/autosave so figure polygons update zones via existing `useFloorAdmin` / zones PATCH

## 2. Drawing tools

- [x] 2.1 Add toolbar modes: select (default), polygon, rectangle; Esc cancels in-progress draw
- [x] 2.2 Implement freeform polygon: click vertices, close when clicking near first point (≥3 verts), fill green
- [x] 2.3 Implement rectangle draw (two corners → four-point polygon), fill green
- [x] 2.4 Convert screen clicks to plan coordinates (support pan/zoom if needed for large plans)

## 3. Selection, edit, delete

- [x] 3.1 Click figure to select (highlight vertices); unselected figures have no handles
- [x] 3.2 Drag selected figure fill to translate all vertices
- [x] 3.3 Drag selected vertex handles to reshape
- [x] 3.4 Delete selected figure (toolbar/keyboard) and remove from zones on save
- [x] 3.5 Click empty canvas to deselect

## 4. Accent shop detection

- [x] 4.1 Expose Detect shops action in the editor toolbar (disabled without plan)
- [x] 4.2 Reuse or add API path to run OpenCV extract on current plan and return zone polygons
- [x] 4.3 Merge detection results with confirm-then-replace (prompt if figures exist; on confirm replace all shop figures; skip prompt when empty)
- [x] 4.4 Show loading / empty-result feedback for Detect shops

## 5. Polish and verification

- [x] 5.1 Ensure 3D map reflects saved 2D edits (same `points` / plan bounds)
- [x] 5.2 Manual QA: upload plan → detect → edit vertices → draw polygon/rect → delete → reload persists
- [x] 5.3 Keep green as default fill/accent; document non-goals (no color picker yet)
