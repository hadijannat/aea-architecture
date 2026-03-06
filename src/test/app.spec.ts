import { expect, test } from '@playwright/test'

test('selecting F5 highlights the VoR sequence and inspector', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'F5' }).evaluate((element) => {
    ;(element as HTMLButtonElement).click()
  })
  await expect(page.getByRole('heading', { name: 'F5' })).toBeVisible()
  await expect(page.locator('.sequence-step.is-highlighted')).toHaveCount(5)
})

test('filtering by C4 keeps the write path visible', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'C4' }).first().click()
  await expect(page.getByRole('button', { name: 'F5' })).toBeVisible()
  await expect(page.getByRole('button', { name: /PB5: Mapping Verification \+ Execution/ })).toBeVisible()
})

test('search results can jump directly to a sequence step', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('searchbox', { name: 'Search nodes, edges, standards, and claims' }).fill('PB3')
  await page.getByRole('button', { name: 'Step result PB3 · Mapping' }).click()
  await expect(page.getByRole('heading', { name: 'PB3' })).toBeVisible()
  await expect(page.getByText('Sequence order')).toBeVisible()
})

test('selecting F_VoR_ACK highlights the Panel B acknowledgement', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'F_VoR_ACK' }).evaluate((element) => {
    ;(element as HTMLButtonElement).click()
  })
  await expect(page.getByRole('heading', { name: 'F_VoR_ACK' })).toBeVisible()
  await expect(page.getByRole('button', { name: /PB_ACK/ })).toBeVisible()
  await expect(page.locator('.sequence-status.is-highlighted')).toContainText('PB_ACK')
})
