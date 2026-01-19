# Progress Tracker — BDD Scenario Catalog

This file is a *human-readable* BDD-style specification of the app.
The Playwright tests in `e2e/bdd.spec.ts` implement a subset of these scenarios end-to-end.

If the product changes, update this document first, then update/extend Playwright tests to match.

## Glossary

- **Routine**: A template workout. Has a name and an ordered list of exercises.
- **Exercise**: An item in a routine. Has a name and optional metadata:
  - `imageUrls` (0..n), currently edited as a single **Image URL** field
  - `sets` (positive integer)
  - `reps` (positive integer)
  - `weight` (positive number)
  - `timeSeconds` (positive integer, edited as mins/secs)
- **Run**: The interactive checklist view where exercises are marked done, and optional metadata can be adjusted.
- **Completion**: A historical record created when a routine run is completed.
  - Stores a snapshot of exercises at completion time (name + images + metadata).

## Features & Scenarios

### Feature: Home / Landing

- Scenario: Empty state
  - Given there are no routines
  - And there are no completions
  - Then the home screen shows an empty message for routines and completions

- Scenario: Hero headline copy
  - Given I am on the home screen
  - Then the hero headline reads "Create your routines"

- Scenario: Routine list actions
  - Given one or more routines exist
  - Then each routine row provides actions: Run, Edit, Delete
  - And Delete asks for confirmation

- Scenario: Completion list actions
  - Given one or more completions exist
  - Then each completion row is clickable to open details
  - And each completion row provides a Delete action
  - And Delete asks for confirmation

- Scenario: Completion list does not navigate on Delete
  - Given a completion row is clickable to open details
  - When I click the Delete button inside that row
  - Then the delete confirmation is shown
  - And the completion detail view is not opened as a side-effect

- Scenario: Completion list is capped
  - Given more than 25 completions exist
  - Then the home screen shows at most 25 completion rows

- Scenario: Keyboard opens completion detail
  - Given a completion row is focused
  - When I press Enter
  - Then the completion detail view opens
  - When I go back
  - And I focus a completion row
  - And I press Space
  - Then the completion detail view opens

- Scenario: Mobile delete button layout
  - Given I am on a small screen
  - Then the Completed routine row Delete button does not overlap the right border
  - And the button has breathing room from the card edge

### Feature: Create Routine

- Scenario: Create a routine
  - Given I click "Start New Routine"
  - When I enter a routine name
  - And I enter at least one exercise name
  - Then I can save the routine
  - And the app navigates to Run routine

- Scenario: Create routine validation
  - Given I am on Create routine
  - When I try to save with an empty routine name
  - Then I see an error that routine name is required
  - When I provide a routine name
  - And I leave all exercise names blank
  - And I try to save
  - Then I see an error requiring at least one exercise

- Scenario: Add exercise creates a new blank row
  - Given I am on Create routine
  - When I click Add exercise
  - Then a new exercise row is added
  - And it starts with empty name and empty image URL

- Scenario: Exercise name preset auto-fills image only when empty
  - Given an exercise row has a non-empty Image URL
  - When I change the exercise name to match a preset that has an image
  - Then the existing Image URL is not overwritten

- Scenario: Exercise image URL supports relative paths
  - Given I set Image URL to a relative path like "exercises/push-ups.webp"
  - Then the preview image loads correctly when the app is served from a base path

- Scenario: Remove exercise is guarded
  - Given there is only one exercise row
  - Then the Remove exercise action is disabled

- Scenario: Reorder exercises via buttons
  - Given a routine has 2+ exercises
  - When I press Move exercise up/down
  - Then the order changes accordingly

- Scenario: Reorder exercises via drag and drop
  - Given a routine has 2+ exercises
  - When I drag an exercise row onto another row
  - Then the dragged exercise is inserted at the drop position

- Scenario: Exercise preset autocomplete
  - Given I type a known exercise preset name
  - Then name autocomplete suggestions are available
  - And if Image URL is empty and the preset has an image, it is auto-filled

- Scenario: Exercise image preview
  - Given an exercise has a non-empty Image URL
  - Then an image preview is shown
  - And if the image fails to load, a fallback message is shown

- Scenario: Reorder exercises
  - Given a routine has 2+ exercises
  - When I drag an exercise up/down
  - Then the exercise order changes accordingly

- Scenario: Remove exercise
  - Given a routine has 2+ exercises
  - When I remove an exercise
  - Then it is removed
  - And the routine must always have at least 1 exercise row in the editor

- Scenario: Optional metadata entry
  - Given the Create/Edit screen shows sets/reps/weight/time inputs
  - When I enter valid values
  - Then they are stored on save
  - And invalid/non-positive values are treated as unset

- Scenario: Time entry normalization
  - Given I enter Minutes and Seconds
  - When I save
  - Then time is stored as total seconds
  - And time is treated as unset if the total is not positive

### Feature: Edit Routine

- Scenario: Edit an existing routine
  - Given I open Edit for a routine
  - When I change routine name and/or exercises
  - Then Save changes updates the routine

- Scenario: Edit routine remove exercise requires confirmation
  - Given I am editing an existing routine
  - When I click Remove exercise on an exercise
  - Then I am prompted to confirm removal
  - And if I cancel, the exercise is not removed

- Scenario: Routine edit shows history summary
  - Given a routine has completion history
  - When I open Edit
  - Then I see a history summary (count + last completed date)

### Feature: Run Routine

- Scenario: Run checklist
  - Given I am running a routine
  - Then exercises start unchecked
  - When I check an exercise
  - Then progress updates
  - And the completion button remains disabled until all exercises are checked

- Scenario: Reset clears the run state
  - Given I have checked one or more exercises
  - When I click Reset
  - Then all exercises become unchecked
  - And the completion button becomes disabled

- Scenario: Progress dots semantics
  - Given I am running a routine with at least one exercise
  - Then a dot is shown for each exercise
  - And the next undone exercise has the "next" styling
  - And completed exercises have the "done" styling

- Scenario: Progress dots visible in dark and light mode
  - Given my OS prefers a light color scheme
  - Then progress dots are visible and distinguishable
  - Given my OS prefers a dark color scheme
  - Then progress dots are visible and distinguishable

- Scenario: Minimize/expand exercises
  - Given I am running a routine
  - Then exercises are minimized by default
  - When I expand an exercise
  - Then I can see details and controls

- Scenario: Minimized exercise shows summary
  - Given an exercise is minimized
  - Then it shows the exercise name
  - And it shows a summary of sets/reps/weight/time (or a placeholder when unset)
  - And it shows a tiny thumbnail if an image URL exists

- Scenario: Adjust exercise metadata during run
  - Given an exercise is expanded
  - When I use +/- controls for sets/reps/weight/time
  - Then the routine’s stored exercise metadata updates

- Scenario: Run adjustments never go below minimum
  - Given sets/reps/time are set
  - When I decrement them below 1 (or below 10s/60s thresholds for time controls)
  - Then the decrement controls are disabled and do not change values
  - Given weight is set
  - When I decrement below zero
  - Then the decrement controls are disabled and do not change values

- Scenario: Run adjustments persist to future runs
  - Given I adjust sets/reps/weight/time during a run
  - When I go back to home
  - And I start a new run of the same routine
  - Then the adjusted values are shown as the routine defaults

- Scenario: Expanded exercise shows reference images
  - Given an exercise has one or more image URLs
  - When the exercise is expanded
  - Then the reference images are shown as thumbnails

### Feature: Completion History

- Scenario: Completing a routine creates a completion record
  - Given all exercises are marked done
  - When I click Complete routine
  - Then a completion is added to Completed routines list
  - And completion includes an exercise snapshot

- Scenario: Completion snapshot is a point-in-time copy
  - Given I complete a routine
  - When I later edit the underlying routine
  - Then the existing completion’s exercise snapshot does not change automatically

- Scenario: View completion details
  - Given a completion exists
  - When I open it
  - Then it shows routine name, completed timestamp, and exercise list

- Scenario: Completion detail without snapshot
  - Given a completion exists with no exercise snapshot
  - When I open it
  - Then it shows an empty-state message indicating no snapshot was saved

- Scenario: Edit completion snapshot
  - Given I open a completion
  - When I click Edit
  - Then I can edit routine name and exercise fields (name/image/metadata)
  - And presets autocomplete name and optionally fill image URL
  - When I click Save
  - Then changes persist and are visible on home list and detail view

- Scenario: Edit completion validation
  - Given I am editing a completion
  - When I clear the completion’s routine name
  - And I click Save
  - Then I see an error that routine name is required
  - Given I clear an exercise name
  - When I click Save
  - Then I see an error that exercise name cannot be blank

- Scenario: Edit completion cancel discards changes
  - Given I am editing a completion
  - When I make changes
  - And I click Cancel
  - Then the view returns to read-only mode
  - And the changes are not applied

- Scenario: Edit completion image preview and fallback
  - Given I am editing a completion
  - When I set Image URL to a valid image
  - Then a preview image is shown
  - When I set Image URL to a broken/invalid image
  - Then the preview shows a fallback message

- Scenario: Delete completion
  - Given a completion exists
  - When I delete it (from home or detail)
  - Then it is removed from history

- Scenario: Delete completion from detail returns home
  - Given I am viewing a completion detail
  - When I delete the completion
  - Then I am returned to the home screen
  - And the completion no longer appears in the list

### Feature: Storage / Persistence

- Scenario: Persistence across reload
  - Given I created routines and completions
  - When I reload the page
  - Then routines and completions are restored from localStorage

- Scenario: Storage tolerates missing optional fields
  - Given routines/completions exist in storage
  - And some exercises omit optional fields (images/sets/reps/weight/time)
  - When the app loads
  - Then it loads successfully
  - And missing optional fields are treated as unset

- Scenario: Storage ignores invalid shapes
  - Given localStorage contains malformed/invalid routine or completion records
  - When the app loads
  - Then invalid records are ignored rather than crashing the app

- Scenario: Storage ordering
  - Given multiple completions exist
  - Then they are sorted by completedAt descending

### Feature: GitHub Pages compatibility

- Scenario: Base path safe assets
  - Given the app is served under a non-root base path
  - Then in-app images using relative paths still render correctly

- Scenario: Deep linking (SPA routing)
  - Given the app is hosted on GitHub Pages
  - When I open a deep link URL (e.g. completion detail) directly
  - Then the app loads and shows the intended screen (not a 404)

### Feature: UI Modes (Light/Dark)

- Scenario: Light mode legibility
  - Given my OS prefers a light color scheme
  - Then interactive controls and progress indicators remain visible
  - And completion dots, run dots, and borders have sufficient contrast

### Feature: 3D Header Demo

- Scenario: 3D header renders
  - Given I am on the home screen
  - Then a 3D lifting-weight demo is rendered in the header area

- Scenario: 3D orbit control
  - Given the 3D demo is visible
  - When I click/touch and drag
  - Then the camera orbits around the scene

- Scenario: 3D press interaction
  - Given the 3D demo is visible
  - When I press/click
  - Then the weight lifts higher
  - And when I release, the lift returns to normal

### Feature: Developer Tooling

- Scenario: Image optimization script
  - Given I have a directory of source images
  - When I run `npm run optimize:images -- --input <dir> --output <dir> --max 600 --format webp`
  - Then optimized outputs are created (resized to fit within 600px)
  - And outputs are skipped when they are newer than inputs
  - And EXIF orientation is applied and metadata is stripped
