---
name: progress-tracker-bdd-e2e
description: Maintain BDD-style Playwright E2E tests and a human-readable scenario catalog for the Progress Tracker repo. Use when adding/updating scenarios in e2e/SCENARIOS.md, implementing them in e2e/bdd.spec.ts, or fixing flaky selectors across desktop + mobile Playwright projects.
---

# Progress Tracker – BDD + Playwright E2E

Maintain the Progress Tracker app’s BDD scenario spec and Playwright E2E tests.

## Outputs (source of truth)
- `e2e/SCENARIOS.md`: human-readable scenarios that describe user-visible behavior
- `e2e/bdd.spec.ts`: Playwright tests that implement the most important scenarios end-to-end

## Workflow (follow in order)
1. Read the relevant scenario(s) in `e2e/SCENARIOS.md`.
2. If behavior changed or is missing, update the scenario text first.
3. Implement/adjust tests in `e2e/bdd.spec.ts` to match the scenarios.
4. Run `npm run test:e2e`.
5. If anything is flaky, fix selectors and waits (never add arbitrary sleeps).

## Guardrails (non-negotiable)
- Use Playwright via `@playwright/test`.
- Write tests in BDD flavor using `test.step('Given …')`, `test.step('When …')`, `test.step('Then …')`.
- Prefer accessibility-first selectors:
  - `getByRole`, `getByLabel`, `getByPlaceholder`, `getByText`
  - Use `locator('.class')` only as a last resort.
- Avoid strict-mode ambiguity:
  - If text appears multiple places, scope to a container or use role+name.
- Reset state between tests:
  - Start at `/`.
  - Clear `localStorage`.
  - Auto-accept confirmation dialogs.
- Keep tests stable on both projects configured in `playwright.config.ts` (desktop + mobile).
- Do not add product features to make tests easier. Only spec/tests.
- Keep conditionals on their own lines (no one-line `if`/`else`).

## Product behavior you must encode

### Routing
- Routing is SPA-style.
- Start tests from home using `page.goto('/')`.

### Create/Edit routine
- Exercise name input uses `list="exercise-presets"` for preset autocomplete.
- Preset image auto-fill only occurs when the Image URL field is empty.
- Image preview shows only when Image URL is non-empty.
- Broken images show a fallback message (do not assert on browser broken-image icons).

### Run routine
- Exercises are minimized by default.
- Expanding an exercise reveals meta controls.
- Completion is gated: the completion button stays disabled until all exercises are checked.

### Completion detail
- Supports edit mode.
- Preset autocomplete is available.
- Optional preset image auto-fill applies only when Image URL is empty.

## Implementation playbook

### Test setup (recommended pattern)
Put all global setup in `test.beforeEach`:

```ts
test.beforeEach(async ({ page }) => {
  page.on('dialog', async (dialog) => {
    await dialog.accept();
  });

  await page.goto('/');

  await page.evaluate(() => {
    window.localStorage.clear();
  });

  await page.reload();
});
```

Notes:
- Clearing storage after navigation is fine; reloading ensures the app reads cleared state.
- If a test needs an intentional confirm “Cancel” path, temporarily override the dialog handler in that test.

### Selector cookbook (stable patterns)
Prefer these patterns, in this order:

1. Role + accessible name

```ts
await page.getByRole('button', { name: 'Create routine' }).click();
await expect(page.getByRole('heading', { name: 'Run routine' })).toBeVisible();
```

2. Label / placeholder for form fields

```ts
await page.getByLabel('Routine name').fill('My Routine');
await page.getByPlaceholder('Exercise name').fill('Squat');
```

3. Scope within a container to avoid strict-mode ambiguity

```ts
const row = page.getByRole('article', { name: /completion/i });
await row.getByRole('button', { name: 'Delete' }).click();
```

4. Text as last resort (only when unique and user-visible)

```ts
await expect(page.getByText('Routine not found')).toBeVisible();
```

Avoid:
- `page.waitForTimeout(...)`
- brittle positional selectors like `nth(0)` unless there is no better affordance
- asserting exact timestamps; prefer “exists/visible” or a broader invariant

### Waiting strategy (avoid flakes)
- Default: rely on Playwright auto-wait + `expect(...).toBeVisible()`.
- Wait for UI state transitions using assertions, not sleeps.
- If a click triggers navigation (route change), assert on a heading or unique page content for the destination.

### Desktop + mobile stability
- Do not rely on hover.
- Keep click targets as role-based.
- When interacting with minimized exercise rows, explicitly expand before asserting on controls.

## Examples

### Example: Add a new scenario + test
When adding a new user-visible behavior:
1. Add scenario text to `e2e/SCENARIOS.md`.
2. Add a matching test in `e2e/bdd.spec.ts`.
3. Use one test per “happy path” scenario; add smaller tests only for critical regressions.

### Example: Fix strict-mode ambiguity
Symptom: Playwright errors due to multiple elements matching the same text.

Fix by scoping:

```ts
const completionRow = page.getByRole('listitem', { name: /bdd routine/i });
await expect(completionRow.getByRole('button', { name: 'Delete' })).toBeVisible();
```

### Example: Encode preset image auto-fill rule correctly
When asserting auto-fill behavior:
- Ensure the Image URL input is empty first.
- Then trigger the preset selection and assert the URL is now populated.

## Debugging
- Run in UI mode: `npm run test:e2e:ui`
- If only one project fails, reproduce by running just that project (see `playwright.config.ts`).
- If a test fails only on mobile, check assumptions about minimized/expanded rows and tap targets.
