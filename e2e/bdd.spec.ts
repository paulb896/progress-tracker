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

const waitForThreeDemoToRender = async (page: Page) => {
  if (!isScenarioGifRun) return

  const readCenterPixel = async (): Promise<[number, number, number, number] | null> => {
    return page.evaluate(() => {
      const canvas = document.querySelector('.headerCube canvas') as HTMLCanvasElement | null
      if (!canvas) return null

      const gl =
        (canvas.getContext('webgl2', { preserveDrawingBuffer: true }) as WebGL2RenderingContext | null) ||
        (canvas.getContext('webgl', { preserveDrawingBuffer: true }) as WebGLRenderingContext | null)
      if (!gl) return null

      const x = Math.max(0, Math.floor(canvas.width / 2))
      const y = Math.max(0, Math.floor(canvas.height / 2))
      const px = new Uint8Array(4)
      try {
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
      } catch {
        return null
      }

      return [px[0]!, px[1]!, px[2]!, px[3]!] as [number, number, number, number]
    })
  }

  // Wait until we see a non-empty pixel AND it changes over time (animation is running).
  const deadline = Date.now() + 7000
  while (Date.now() < deadline) {
    const a = await readCenterPixel()
    if (!a) {
      await page.waitForTimeout(150)
      continue
    }
    const aNonEmpty = a[0] !== 0 || a[1] !== 0 || a[2] !== 0 || a[3] !== 0
    if (!aNonEmpty) {
      await page.waitForTimeout(150)
      continue
    }

    await page.waitForTimeout(350)
    const b = await readCenterPixel()
    if (!b) continue

    const changed = a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2] || a[3] !== b[3]
    if (changed) return
  }
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
    await waitForThreeDemoToRender(page)
  })

  test('Scenario: Create a routine, run it, and record completion history', async ({ page }) => {
    await test.step('Given I am on the home screen', async () => {
      await page.goto('/')
      await expect(page.getByRole('heading', { name: 'Crush Your Fitness Goals' })).toBeVisible()
      await pauseIfGif(page)
    })

    await test.step('When I create a routine with preset exercises', async () => {
      const m = createMouseHelpers(page)

      await m.click(page.getByRole('button', { name: 'Start New Routine' }))
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
      await expect(page.getByText('Active Session')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'BDD Routine' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Complete routine' })).toBeDisabled()
      await pauseIfGif(page)

      await m.check(page.getByRole('checkbox', { name: /Mark Bench Press done/ }))
      await pauseIfGif(page, 300)
      await m.check(page.getByRole('checkbox', { name: /Mark Planks done/ }))
      await pauseIfGif(page, 300)

      await expect(page.getByRole('button', { name: 'Complete routine' })).toBeEnabled()
      await m.click(page.getByRole('button', { name: 'Complete routine' }))
      await pauseIfGif(page)

      await expect(page.getByText('Recent Activity')).toBeVisible()
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
      await m.click(page.getByRole('button', { name: 'Start New Routine' }))
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
      await m.click(page.getByRole('button', { name: 'Start New Routine' }))
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

      await expect(page.getByText('Active Session')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Routine Edited' })).toBeVisible()
      await m.click(page.getByRole('button', { name: 'Go back' }))
      await pauseIfGif(page)
    })

    await test.step('And I can delete the routine from home', async () => {
      const m = createMouseHelpers(page)
      await expect(page.getByText('Routine Edited')).toBeVisible()
      await pauseIfGif(page)

      await m.click(page.locator('.summaryCard', { hasText: 'Routine Edited' }).getByRole('button', { name: 'Delete' }))

      await pauseIfGif(page)

      await expect(page.getByText('Routine Edited')).not.toBeVisible()
    })
  })
})
