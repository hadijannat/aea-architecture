import { expect, test, type Locator, type Page } from '@playwright/test'

async function pressKeyUntilFocused(page: Page, key: 'Tab' | 'Shift+Tab', target: Locator, maxTabs = 160) {
  for (let index = 0; index < maxTabs; index += 1) {
    await page.keyboard.press(key)
    if (await target.evaluate((element) => element === document.activeElement)) {
      return
    }
  }

  throw new Error(`Target was not reached through keyboard navigation using ${key}`)
}

async function assertFocusVisible(locator: Locator) {
  await locator.page().waitForTimeout(200)
  const styles = await locator.evaluate((element) => {
    const computed = getComputedStyle(element)
    return {
      boxShadow: computed.boxShadow,
      matchesFocusVisible: element.matches(':focus-visible'),
    }
  })

  expect(styles.matchesFocusVisible).toBe(true)
  expect(styles.boxShadow).not.toBe('none')
  expect(styles.boxShadow).toContain('17, 24, 39')
}

test('selecting F5 highlights the VoR sequence and inspector', async ({ page }) => {
  await page.goto('/')
  const f5Edge = page.getByRole('button', { name: /^F5:/ })
  await expect(f5Edge).toBeVisible()
  await f5Edge.dispatchEvent('click')
  await expect(page.getByRole('heading', { name: 'F5' })).toBeVisible()
  await expect(page.locator('.sequence-step.is-highlighted')).toHaveCount(5)
})

test('filtering by C4 keeps the write path visible', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'C4' }).first().click()
  await expect(page.getByRole('button', { name: /^F5:/ })).toBeVisible()
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
  const vorAckEdge = page.getByRole('button', { name: /^F_VoR_ACK:/ })
  await expect(vorAckEdge).toBeVisible()
  await vorAckEdge.dispatchEvent('click')
  await expect(page.getByRole('heading', { name: 'F_VoR_ACK' })).toBeVisible()
  await expect(page.getByRole('button', { name: /PB_ACK/ })).toBeVisible()
  await expect(page.locator('.sequence-edge-label.is-highlighted')).toContainText('PB_ACK')
})

test('edge controls expose semantic accessible names', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /^F5: writeback edge from/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^F_VoR_ACK: status-ack edge from/ })).toBeVisible()
})

test('export controls use viewport and publication labels', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'SVG viewport' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'SVG publication' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'PDF viewport' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'PDF publication' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mermaid topology (architecture)' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mermaid topology (sequence)' })).toBeVisible()
})

test('keyboard navigation exposes focus-visible states across Panel B controls', async ({ page }) => {
  await page.goto('/')

  const rejectionTerminal = page.getByRole('button', { name: /^PB_REJECT_OUT:/ })
  await rejectionTerminal.click()

  const terminal = page.getByRole('button', { name: /^PB_AEA:/ })
  await pressKeyUntilFocused(page, 'Shift+Tab', terminal, 4)
  await expect(terminal).toBeFocused()
  await assertFocusVisible(terminal)

  await rejectionTerminal.click()
  const sequenceStep = page.getByRole('button', { name: /^PB1:/ })
  await pressKeyUntilFocused(page, 'Tab', sequenceStep, 4)
  await expect(sequenceStep).toBeFocused()
  await assertFocusVisible(sequenceStep)

  await page.getByRole('button', { name: /^PB5:/ }).click()
  const ackEdgeLabel = page.getByRole('button', { name: /^PB_ACK:/ })
  await pressKeyUntilFocused(page, 'Tab', ackEdgeLabel, 8)
  await expect(ackEdgeLabel).toBeFocused()
  await assertFocusVisible(ackEdgeLabel)
})
