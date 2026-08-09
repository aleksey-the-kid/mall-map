## ADDED Requirements

### Requirement: Detect shops by accent color
The admin 2D editor SHALL provide a control that runs accent-color shop detection on the current floor plan image and creates overlay figures for detected shopping regions. If figures already exist, the system SHALL confirm with the admin and, on confirmation, replace those figures with the detection results.

#### Scenario: Successful detection on empty canvas
- **WHEN** an admin clicks Detect shops on a floor that has a plan image and no existing figures
- **THEN** the system detects accent-colored regions (default: green), creates a filled figure for each detected region, and overlays those figures on the plan

#### Scenario: Confirm then replace existing figures
- **WHEN** an admin clicks Detect shops on a floor that already has figures
- **THEN** the system asks for confirmation before proceeding
- **WHEN** the admin confirms
- **THEN** existing figures are replaced by the detection results
- **WHEN** the admin cancels
- **THEN** existing figures remain unchanged and detection does not run (or results are discarded)

#### Scenario: No regions found
- **WHEN** detection completes and no accent-colored regions are found
- **THEN** the system creates no new figures (and after a confirmed replace, the canvas has no shop figures) and informs the admin that nothing was detected

#### Scenario: Detection unavailable without plan
- **WHEN** the floor has no plan image
- **THEN** the Detect shops control is disabled or shows that a plan is required

### Requirement: Detection results are editable figures
Figures created by detection SHALL behave like manually drawn figures: unselected by default, selectable, movable, reshapeable via vertices, and deletable.

#### Scenario: Edit detected figure
- **WHEN** an admin selects a figure created by detection and drags a vertex
- **THEN** the figure reshapes the same way as a manually drawn polygon

### Requirement: Default accent and fill color
Detection SHALL use green as the default accent color for finding shops, and created figures (detected or drawn) SHALL use green fill until a different fill color is configured later.

#### Scenario: Default green
- **WHEN** detection or drawing creates a new figure
- **THEN** the figure is filled green on the canvas
