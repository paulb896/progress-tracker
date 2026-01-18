---
name: progress-tracker-scenario-gifs
description: Generate small animated GIFs for each Playwright BDD scenario and surface them in-app as usage instructions.
---

This skill adds a lightweight workflow to create **animated usage demos** for the Progress Tracker.
The demos are generated from the Playwright BDD scenario tests and saved into a stable directory so the app can display them as “how to use” instructions.

## Where Things Live

- Source of truth for implemented scenarios: `e2e/bdd.spec.ts`
- Generator script: `scripts/generate-scenario-gifs.mjs`
- Playwright config for GIF capture: `playwright.gifs.config.ts`
- Output GIF directory (served by Vite/GitHub Pages): `public/scenario-gifs/`
- App manifest consumed by UI: `src/scenarios/scenarioGifs.ts`

## Prerequisites

- `ffmpeg` must be installed and available on `PATH`.
  - If `ffmpeg` is missing, the script still updates the manifest but will skip GIF creation.

## Generate / Refresh GIFs

Run:

- `npm run generate:scenario-gifs`

This will:
- Parse `e2e/bdd.spec.ts` for tests named `Scenario: ...`
- Run each scenario individually with video capture enabled
- Convert the recorded video into a small GIF
- Write GIFs to `public/scenario-gifs/`
- Update `src/scenarios/scenarioGifs.ts` to keep titles + filenames in sync

## Pacing (Making Demos Readable)

The GIF capture pipeline intentionally slows interactions down so the steps are readable:

- `playwright.gifs.config.ts` sets a Chromium `slowMo` to make clicks/typing feel “human-paced”.
- `e2e/bdd.spec.ts` includes small pauses that only activate when `PROGRESS_TRACKER_SCENARIO_GIF=1`.
  - The generator sets this env var automatically when it runs Playwright, so normal `npm run test:e2e` runs are not slowed down.

## Adding a New Scenario Demo

1. Add a new Playwright test in `e2e/bdd.spec.ts` using the naming convention:
   - `test('Scenario: <your scenario title>', ...)`
2. Run `npm run generate:scenario-gifs`
3. Confirm the app shows the new demo on the **How to** screen.

## Guardrails

- Keep GIFs small: prefer short flows and avoid long waits.
- Keep the UI stable during recording: the generator uses a fixed viewport.
- Do not hard-code absolute URLs for GIFs; the app should always use `import.meta.env.BASE_URL`.
