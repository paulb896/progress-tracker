import { test, expect } from '@playwright/test'

const isScenarioGifRun = process.env.PROGRESS_TRACKER_SCENARIO_GIF === '1'

const pauseIfGif = async (page: import('@playwright/test').Page, ms = 450) => {
  if (!isScenarioGifRun) return
  await page.waitForTimeout(ms)
}

const acceptAllDialogs = (page: import('@playwright/test').Page) => {
  page.on('dialog', async (dialog) => {
    await dialog.accept()
  })
}

const clearAppStorage = async (page: import('@playwright/test').Page) => {
  await page.goto('/')
  await page.evaluate(() => {
    window.localStorage.clear()
  })
}

test.describe('Progress Tracker — BDD scenarios', () => {
  test.beforeEach(async ({ page }) => {
    acceptAllDialogs(page)
    await clearAppStorage(page)
  })

  test('Scenario: Create a routine, run it, and record completion history', async ({ page }) => {
    await test.step('Given I am on the home screen', async () => {
      await page.goto('/')
      await expect(page.getByRole('heading', { name: 'Progress Tracker' })).toBeVisible()
      await pauseIfGif(page)
    })

    await test.step('When I create a routine with preset exercises', async () => {
      await page.getByRole('button', { name: 'Create routine' }).click()
      await pauseIfGif(page)

      await page.getByLabel('Routine name').fill('BDD Routine')
      await pauseIfGif(page, 350)

      const exerciseNameInputs = page.getByPlaceholder('Exercise name (e.g., Push-ups)')
      const imageUrlInputs = page.getByPlaceholder('Image URL (optional)')

      await expect(exerciseNameInputs).toHaveCount(1)

      await exerciseNameInputs.nth(0).fill('Bench Press')
      await pauseIfGif(page, 350)

      await expect(imageUrlInputs.nth(0)).toHaveValue(/exercises\/bench-press\.webp$/)

      await page.getByRole('button', { name: 'Add exercise' }).click()
      await pauseIfGif(page)
      await expect(exerciseNameInputs).toHaveCount(2)
      await exerciseNameInputs.nth(1).fill('Planks')
      await pauseIfGif(page, 350)

      await page.getByRole('button', { name: 'Save routine' }).click()
      await pauseIfGif(page)
    })

    await test.step('Then I can run the routine and complete it', async () => {
      await expect(page.getByText('Run routine')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Complete routine' })).toBeDisabled()
      await pauseIfGif(page)

      await page.getByRole('checkbox', { name: /Mark Bench Press done/ }).check()
      await pauseIfGif(page, 300)
      await page.getByRole('checkbox', { name: /Mark Planks done/ }).check()
      await pauseIfGif(page, 300)

      await expect(page.getByRole('button', { name: 'Complete routine' })).toBeEnabled()
      await page.getByRole('button', { name: 'Complete routine' }).click()
      await pauseIfGif(page)

      await expect(page.getByText('Completed routines')).toBeVisible()
      await expect(page.getByLabel(/View completed routine: BDD Routine/)).toBeVisible()
      await pauseIfGif(page)
    })

    await test.step('And I can view completion details', async () => {
      await page.getByLabel(/View completed routine: BDD Routine/).click()
      await pauseIfGif(page)
      await expect(page.getByText('Completed routine')).toBeVisible()
      await expect(page.getByText('BDD Routine')).toBeVisible()
      await expect(page.getByText('Bench Press')).toBeVisible()
      await expect(page.getByText('Planks')).toBeVisible()
    })
  })

  test('Scenario: Edit a completed routine (name + exercises + images) and persist changes', async ({ page }) => {
    await test.step('Given I have a completed routine', async () => {
      await page.goto('/')
      await pauseIfGif(page)
      await page.getByRole('button', { name: 'Create routine' }).click()
      await pauseIfGif(page)
      await page.getByLabel('Routine name').fill('Edit Completion Routine')
      await pauseIfGif(page, 350)

      const exerciseNameInputs = page.getByPlaceholder('Exercise name (e.g., Push-ups)')
      await exerciseNameInputs.nth(0).fill('Bench Press')
      await pauseIfGif(page, 350)
      await page.getByRole('button', { name: 'Save routine' }).click()
      await pauseIfGif(page)

      await page.getByRole('checkbox', { name: /Mark Bench Press done/ }).check()
      await pauseIfGif(page, 300)
      await page.getByRole('button', { name: 'Complete routine' }).click()
      await pauseIfGif(page)

      await page.getByLabel(/View completed routine: Edit Completion Routine/).click()
      await pauseIfGif(page)
      await expect(page.getByText('Completed routine')).toBeVisible()
    })

    await test.step('When I edit the completion and save', async () => {
      await page.getByRole('button', { name: 'Edit' }).click()
      await pauseIfGif(page)

      await page.getByLabel('Routine name').fill('Edited Completion Name')
      await pauseIfGif(page, 350)

      const exerciseName = page.getByPlaceholder('Exercise name')
      const imageUrl = page.getByPlaceholder('Image URL (optional)')

      await expect(exerciseName).toHaveCount(1)

      await imageUrl.nth(0).fill('')
      await pauseIfGif(page, 250)
      await exerciseName.nth(0).fill('Push ups')
      await pauseIfGif(page, 350)

      await expect(imageUrl.nth(0)).toHaveValue(/exercises\/push-ups\.webp$/)

      await page.getByRole('button', { name: 'Save' }).click()
      await pauseIfGif(page)
    })

    await test.step('Then the completion reflects the edits and remains after navigation', async () => {
      await expect(page.getByText('Edited Completion Name')).toBeVisible()
      await expect(page.getByText('Push ups')).toBeVisible()
      await pauseIfGif(page)

      await page.getByRole('button', { name: 'Back' }).click()
      await pauseIfGif(page)
      await expect(page.getByText('Edited Completion Name')).toBeVisible()

      await page.getByLabel(/View completed routine: Edited Completion Name/).click()
      await pauseIfGif(page)
      await expect(page.getByText('Push ups')).toBeVisible()
    })
  })

  test('Scenario: Edit a routine and delete routine/history from home', async ({ page }) => {
    await test.step('Given I have a saved routine', async () => {
      await page.goto('/')
      await pauseIfGif(page)
      await page.getByRole('button', { name: 'Create routine' }).click()
      await pauseIfGif(page)
      await page.getByLabel('Routine name').fill('Routine To Edit/Delete')
      await pauseIfGif(page, 350)
      await page.getByPlaceholder('Exercise name (e.g., Push-ups)').nth(0).fill('Planks')
      await pauseIfGif(page, 350)
      await page.getByRole('button', { name: 'Save routine' }).click()
      await pauseIfGif(page)

      await page.getByRole('button', { name: 'Back' }).click()
      await pauseIfGif(page)
      await expect(page.getByText('Routine To Edit/Delete')).toBeVisible()
    })

    await test.step('When I edit the routine', async () => {
      await page.getByRole('button', { name: 'Edit' }).first().click()
      await expect(page.getByText('Edit routine')).toBeVisible()
      await pauseIfGif(page)

      await page.getByLabel('Routine name').fill('Routine Edited')
      await pauseIfGif(page, 350)
      await page.getByRole('button', { name: 'Save changes' }).click()
      await pauseIfGif(page)

      await expect(page.getByText('Run routine')).toBeVisible()
      await page.getByRole('button', { name: 'Back' }).click()
      await pauseIfGif(page)
    })

    await test.step('And I can delete the routine from home', async () => {
      await expect(page.getByText('Routine Edited')).toBeVisible()
      await pauseIfGif(page)

      await page
        .locator('.routineCard', { hasText: 'Routine Edited' })
        .getByRole('button', { name: 'Delete' })
        .click()

      await pauseIfGif(page)

      await expect(page.getByText('Routine Edited')).not.toBeVisible()
    })
  })
})
