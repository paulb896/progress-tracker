# E2E (BDD) tests

This repo uses Playwright E2E tests written in a BDD-ish style.

## Run

- `npm run test:e2e`
- `npm run test:e2e:ui`

## Conventions

- Each test uses `test.step('Given/When/Then …', ...)`.
- Prefer accessible selectors: `getByRole`, `getByLabel`, `getByPlaceholder`, `getByText`.
- Clear `localStorage` before each test.
- Auto-accept confirmation dialogs (delete prompts).
- Keep selectors stable on both the desktop and mobile Playwright projects.

## Source of truth

- `e2e/SCENARIOS.md` is the human-readable spec.
- `e2e/bdd.spec.ts` implements key scenarios end-to-end.

## Agent Skill

Guidance for writing/maintaining BDD-style tests is packaged as an Agent Skill:
- `.github/skills/progress-tracker-bdd-e2e/SKILL.md`
