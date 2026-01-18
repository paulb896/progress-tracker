# Progress Tracker

Workout routine tracker built with Vite + React + TypeScript.

## Quick start

- Install: `npm ci`
- Dev: `npm run dev`
- Build: `npm run build`
- Preview build: `npm run preview`

## Key folders

- `src/`: app code
- `e2e/`: Playwright E2E tests + BDD scenario catalog
- `public/`: static assets (exercise images, etc.)
- `docs/`: GitHub Pages build output (generated)
- `.github/skills/`: Agent Skills (Copilot/agent reusable workflows)

## Architecture (high level)

### App entry + routing

- Entry point: `src/main.tsx`
- Top-level composition + navigation: `src/App.tsx`
- Routing is intentionally minimal (no router lib): `src/app/usePathRoute.ts`

### Screens

- Home / list routines + completion history: `src/screens/HomeView.tsx`
- Create/edit routine template: `src/screens/CreateRoutineView.tsx`
- Run routine (checkboxes, per-exercise edits): `src/screens/RunRoutineView.tsx`
- View/edit a completion snapshot: `src/screens/CompletionDetailView.tsx`

### State + persistence

- Routine templates are managed by `src/routines/useRoutines.ts` and stored in `localStorage` via `src/routines/storage.ts`.
	- Storage key: `progress-tracker:routines:v1`
- Completion history is managed by `src/completions/useCompletions.ts` and stored in `localStorage` via `src/completions/storage.ts`.
	- Storage key: `progress-tracker:completions:v1` (stored as an object `{ completions: [...] }`)
- Both storage layers are defensive: they validate parsed JSON and tolerate invalid/legacy shapes.

### Exercise images

- Images are referenced as paths like `exercises/rowing-machine.jpg` and resolved against the app base path for GitHub Pages.
- The helper for base-path-safe rendering is `src/exercises/resolveImageUrl.ts`.

### 3D header demo

- The header 3D scene is implemented in `src/ThreeDemo.tsx` (Three.js via `@react-three/fiber`).

### E2E tests

- BDD scenario spec: `e2e/SCENARIOS.md`
- Playwright tests: `e2e/bdd.spec.ts`
- Config: `playwright.config.ts`

## Data model (persistence)

The app persists to `localStorage` (routines + completion history). Tests clear storage between runs.

## Exercise images

Put images in `public/exercises/` (example: `public/exercises/rowing-machine.jpg`).

Reference them in the UI using a path like:

- `exercises/rowing-machine.jpg`

This is base-path safe for GitHub Pages.

## E2E tests + scenarios

- Scenarios (source of truth): `e2e/SCENARIOS.md`
- Tests: `e2e/bdd.spec.ts`
- Run: `npm run test:e2e`

### Agent Skill (recommended)

Guidance for maintaining the BDD scenario catalog + Playwright tests is packaged as an Agent Skill:

- `.github/skills/progress-tracker-bdd-e2e/SKILL.md`

## GitHub Pages

This repo is set up to publish as a SPA on GitHub Pages (build output goes to `docs/`).
