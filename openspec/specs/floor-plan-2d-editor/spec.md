## Purpose

Admin 2D floor-plan editor for drawing and editing shop zone polygons on a plan image, persisted in plan-space coordinates for the 3D map.

## Requirements

### Requirement: Display floor plan image in 2D editor
The admin 2D editor SHALL display the selected floor's plan image as the canvas background when a plan image is available for that floor.

#### Scenario: Plan image available
- **WHEN** an admin opens the 2D editor for a floor that has a plan image
- **THEN** the plan image is shown as the editor background and existing zone figures are overlaid on it

#### Scenario: No plan image
- **WHEN** an admin opens the 2D editor for a floor without a plan image
- **THEN** the editor shows an empty or upload prompt state and drawing tools remain unavailable until a plan is present

### Requirement: Draw freeform polygon by placing points
The system SHALL allow an admin in polygon-draw mode to place vertices by clicking on the plan image, and SHALL close and fill the figure when the admin clicks near the first vertex.

#### Scenario: Close polygon on first point
- **WHEN** an admin has placed at least three vertices and clicks within the close-threshold of the first vertex
- **THEN** the polygon is closed, filled with the default figure fill color (green), and added as a shop zone figure

#### Scenario: Incomplete polygon cancelled
- **WHEN** an admin is placing polygon vertices and exits polygon-draw mode or cancels before closing
- **THEN** the in-progress vertices are discarded and no new figure is created

### Requirement: Draw rectangles manually
The system SHALL provide a rectangle-draw mode where an admin creates a rectangular figure on the plan image by defining two opposite corners (drag or two-click), filled with the default figure fill color (green).

#### Scenario: Create rectangle
- **WHEN** an admin in rectangle-draw mode completes a rectangle gesture on the plan
- **THEN** a four-vertex rectangular figure is created, filled green, and stored as a zone polygon

### Requirement: Figures are not editable until selected
Figures SHALL render without editable vertex handles until selected. Selecting a figure by clicking it SHALL highlight its vertices and enable editing for that figure only.

#### Scenario: Unselected figure
- **WHEN** a figure is not selected
- **THEN** it is drawn filled without vertex handles and cannot be reshaped by dragging vertices

#### Scenario: Select figure
- **WHEN** an admin clicks a figure
- **THEN** that figure becomes selected, its vertices are highlighted, and previously selected figures are deselected

### Requirement: Move and reshape selected figure
While a figure is selected, the system SHALL allow the admin to move the whole figure and to drag individual vertices to reshape it.

#### Scenario: Move figure
- **WHEN** an admin drags the interior of a selected figure
- **THEN** all of its vertices translate together and the overlay updates live

#### Scenario: Drag vertex
- **WHEN** an admin drags a highlighted vertex of a selected figure
- **THEN** that vertex moves and the filled polygon updates to the new shape

### Requirement: Delete selected figure
The system SHALL allow an admin to delete the currently selected figure from the editor and from persisted floor zones.

#### Scenario: Delete selected
- **WHEN** an admin triggers delete while a figure is selected
- **THEN** the figure is removed from the canvas and from the floor's zone list on save

### Requirement: Persist figures as zone polygons
Figures created or edited in the 2D editor SHALL be persisted as zone polygons (`points` in plan space) compatible with the existing floor zone model so the 3D map can render them.

#### Scenario: Save after edits
- **WHEN** an admin saves (or autosave runs) after creating, moving, reshaping, or deleting figures
- **THEN** the floor's zone geometry reflects those figures' polygons in plan coordinates
