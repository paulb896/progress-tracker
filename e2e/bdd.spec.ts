import { test, expect } from '@playwright/test'

const isScenarioGifRun = process.env.PROGRESS_TRACKER_SCENARIO_GIF === '1'

type Page = import('@playwright/test').Page
type Locator = import('@playwright/test').Locator

const pauseIfGif = async (page: Page, ms = 450) => {
  if (!isScenarioGifRun) return
  await page.waitForTimeout(ms)
}

const acceptAllDialogs = (page: Page) => {
  page.on('dialog', async (dialog) => {
    await dialog.accept()
  })
}

const clearAppStorage = async (page: Page) => {
  await page.goto('/')
  await page.evaluate(() => {
    window.localStorage.clear()
  })
}

const enableScenarioGifUi = async (page: Page) => {
  if (!isScenarioGifRun) return
  await page.addInitScript(() => {
    ;(window as any).__PROGRESS_TRACKER_SCENARIO_GIF__ = true
  })
}

const createMouseHelpers = (page: Page) => {
  let last = { x: 12, y: 12 }

  const moveTo = async (locator: Locator) => {
    if (!isScenarioGifRun) return
    await locator.scrollIntoViewIfNeeded()
    const box = await locator.boundingBox()
    if (!box) return

    const targetX = box.x + Math.max(8, Math.min(box.width - 8, box.width * 0.35))
    const targetY = box.y + Math.max(8, Math.min(box.height - 8, box.height * 0.55))

    await page.mouse.move(last.x, last.y)
    await page.mouse.move(targetX, targetY, { steps: 14 })
    last = { x: targetX, y: targetY }
  }

  const click = async (locator: Locator) => {
    if (!isScenarioGifRun) {
      await locator.click()
      return
    }
    await moveTo(locator)
    await pauseIfGif(page, 180)
    await locator.click()
    await pauseIfGif(page, 220)
  }

  const check = async (locator: Locator) => {
    if (!isScenarioGifRun) {
      await locator.check()
      return
    }
    await moveTo(locator)
    await pauseIfGif(page, 160)
    await locator.check()
    await pauseIfGif(page, 220)
  }

  const fill = async (locator: Locator, value: string) => {
    if (!isScenarioGifRun) {
      await locator.fill(value)
      return
    }

    await moveTo(locator)
    await locator.click()
    await pauseIfGif(page, 160)

    await locator.fill('')
    if (value) {
      // Per-character typing so it's visible in the recording.
      await locator.type(value, { delay: 70 })
    }
    await pauseIfGif(page, 240)
  }

  return { moveTo, click, check, fill }
}

test.describe('Progress Tracker — BDD scenarios', () => {
  test.beforeEach(async ({ page }) => {
    acceptAllDialogs(page)
    await enableScenarioGifUi(page)
    await clearAppStorage(page)
  })

  test('Scenario: Create a routine, run it, and record completion history', async ({ page }) => {
    await test.step('Given I am on the home screen', async () => {
      await page.goto('/')
      await expect(page.getByRole('heading', { name: 'Progress Tracker' })).toBeVisible()
      await pauseIfGif(page)
    })

    await test.step('When I create a routine with preset exercises', async () => {
      const m = createMouseHelpers(page)

      await m.click(page.getByRole('button', { name: 'Create routine' }))
      await pauseIfGif(page)

      await m.fill(page.getByLabel('Routine name'), 'BDD Routine')
      await pauseIfGif(page, 350)

      const exerciseNameInputs = page.getByPlaceholder('Exercise name (e.g., Push-ups)')
      const imageUrlInputs = page.getByPlaceholder('Image URL (optional)')

      await expect(exerciseNameInputs).toHaveCount(1)

      await m.fill(exerciseNameInputs.nth(0), 'Bench Press')
      await pauseIfGif(page, 350)

      await expect(imageUrlInputs.nth(0)).toHaveValue(/exercises\/bench-press\.webp$/)

      await m.click(page.getByRole('button', { name: 'Add exercise' }))
      await pauseIfGif(page)
      await expect(exerciseNameInputs).toHaveCount(2)
      await m.fill(exerciseNameInputs.nth(1), 'Planks')
      await pauseIfGif(page, 350)

      await m.click(page.getByRole('button', { name: 'Save routine' }))
      await pauseIfGif(page)
    })

    await test.step('Then I can run the routine and complete it', async () => {
      const m = createMouseHelpers(page)
      await expect(page.getByText('Run routine')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Complete routine' })).toBeDisabled()
      await pauseIfGif(page)

      await m.check(page.getByRole('checkbox', { name: /Mark Bench Press done/ }))
      await pauseIfGif(page, 300)
      await m.check(page.getByRole('checkbox', { name: /Mark Planks done/ }))
      await pauseIfGif(page, 300)

      await expect(page.getByRole('button', { name: 'Complete routine' })).toBeEnabled()
      await m.click(page.getByRole('button', { name: 'Complete routine' }))
      await pauseIfGif(page)

      await expect(page.getByText('Completed routines')).toBeVisible()
      await expect(page.getByLabel(/View completed routine: BDD Routine/)).toBeVisible()
      await pauseIfGif(page)
    })

    await test.step('And I can view completion details', async () => {
      const m = createMouseHelpers(page)
      await m.click(page.getByLabel(/View completed routine: BDD Routine/))
      await pauseIfGif(page)
      await expect(page.getByText('Completed routine')).toBeVisible()
      await expect(page.getByText('BDD Routine')).toBeVisible()
      await expect(page.getByText('Bench Press')).toBeVisible()
      await expect(page.getByText('Planks')).toBeVisible()
    })
  })

  test('Scenario: Edit a completed routine (name + exercises + images) and persist changes', async ({ page }) => {
    await test.step('Given I have a completed routine', async () => {
      const m = createMouseHelpers(page)
      await page.goto('/')
      await pauseIfGif(page)
      await m.click(page.getByRole('button', { name: 'Create routine' }))
      await pauseIfGif(page)
      await m.fill(page.getByLabel('Routine name'), 'Edit Completion Routine')
      await pauseIfGif(page, 350)

      const exerciseNameInputs = page.getByPlaceholder('Exercise name (e.g., Push-ups)')
      await m.fill(exerciseNameInputs.nth(0), 'Bench Press')
      await pauseIfGif(page, 350)
      await m.click(page.getByRole('button', { name: 'Save routine' }))
      await pauseIfGif(page)

      await m.check(page.getByRole('checkbox', { name: /Mark Bench Press done/ }))
      await pauseIfGif(page, 300)
      await m.click(page.getByRole('button', { name: 'Complete routine' }))
      await pauseIfGif(page)

      await m.click(page.getByLabel(/View completed routine: Edit Completion Routine/))
      await pauseIfGif(page)
      await expect(page.getByText('Completed routine')).toBeVisible()
    })

    await test.step('When I edit the completion and save', async () => {
      const m = createMouseHelpers(page)

      await m.click(page.getByRole('button', { name: 'Edit' }))
      await pauseIfGif(page)

      await m.fill(page.getByLabel('Routine name'), 'Edited Completion Name')
      await pauseIfGif(page, 350)

      const exerciseName = page.getByPlaceholder('Exercise name')
      const imageUrl = page.getByPlaceholder('Image URL (optional)')

      await expect(exerciseName).toHaveCount(1)

      await m.fill(imageUrl.nth(0), '')
      await pauseIfGif(page, 250)
      await m.fill(exerciseName.nth(0), 'Push ups')
      await pauseIfGif(page, 350)

      await expect(imageUrl.nth(0)).toHaveValue(/exercises\/push-ups\.webp$/)

      await m.click(page.getByRole('button', { name: 'Save' }))
      await pauseIfGif(page)
    })

    await test.step('Then the completion reflects the edits and remains after navigation', async () => {
      const m = createMouseHelpers(page)
      await expect(page.getByText('Edited Completion Name')).toBeVisible()
      await expect(page.getByText('Push ups')).toBeVisible()
      await pauseIfGif(page)

      await m.click(page.getByRole('button', { name: 'Back' }))
      await pauseIfGif(page)
      await expect(page.getByText('Edited Completion Name')).toBeVisible()

      await m.click(page.getByLabel(/View completed routine: Edited Completion Name/))
      await pauseIfGif(page)
      await expect(page.getByText('Push ups')).toBeVisible()
    })
  })

  test('Scenario: Edit a routine and delete routine/history from home', async ({ page }) => {
    await test.step('Given I have a saved routine', async () => {
      const m = createMouseHelpers(page)
      await page.goto('/')
      await pauseIfGif(page)
      await m.click(page.getByRole('button', { name: 'Create routine' }))
      await pauseIfGif(page)
      await m.fill(page.getByLabel('Routine name'), 'Routine To Edit/Delete')
      await pauseIfGif(page, 350)
      await m.fill(page.getByPlaceholder('Exercise name (e.g., Push-ups)').nth(0), 'Planks')
      await pauseIfGif(page, 350)
      await m.click(page.getByRole('button', { name: 'Save routine' }))
      await pauseIfGif(page)

      await m.click(page.getByRole('button', { name: 'Back' }))
      await pauseIfGif(page)
      await expect(page.getByText('Routine To Edit/Delete')).toBeVisible()
    })

    await test.step('When I edit the routine', async () => {
      const m = createMouseHelpers(page)

      await m.click(page.getByRole('button', { name: 'Edit' }).first())
      await expect(page.getByText('Edit routine')).toBeVisible()
      await pauseIfGif(page)

      await m.fill(page.getByLabel('Routine name'), 'Routine Edited')
      await pauseIfGif(page, 350)
      await m.click(page.getByRole('button', { name: 'Save changes' }))
      await pauseIfGif(page)

      await expect(page.getByText('Run routine')).toBeVisible()
      await m.click(page.getByRole('button', { name: 'Back' }))
      await pauseIfGif(page)
    })

    await test.step('And I can delete the routine from home', async () => {
      const m = createMouseHelpers(page)
      await expect(page.getByText('Routine Edited')).toBeVisible()
      await pauseIfGif(page)

      await m.click(page.locator('.routineCard', { hasText: 'Routine Edited' }).getByRole('button', { name: 'Delete' }))

      await pauseIfGif(page)

      await expect(page.getByText('Routine Edited')).not.toBeVisible()
    })
  })
})
