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

async function viewportTransform(page: Page) {
  return page.locator('.architecture-canvas .react-flow__viewport').evaluate((element) => getComputedStyle(element).transform)
}

function parseEdgePoints(value: string) {
  return value
    .split(' ')
    .map((entry) => entry.split(',').map(Number))
    .map(([x, y]) => ({ x, y }))
}

function boxesOverlap(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
  clearance = 4,
) {
  return !(
    first.x + first.width + clearance <= second.x ||
    second.x + second.width + clearance <= first.x ||
    first.y + first.height + clearance <= second.y ||
    second.y + second.height + clearance <= first.y
  )
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

test('desktop canvas uses the semantic overview instead of a floating HUD', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/?node=ACT1')

  await expect(page.locator('.canvas-hud')).toHaveCount(0)
  await expect(page.locator('.semantic-overview')).toBeVisible()
  await expect(page.locator('[data-overview-map]')).toBeVisible()
  await expect(page.locator('[data-write-arrow-id]')).toHaveCount(4)

  const beforePreset = await viewportTransform(page)
  await page.locator('[data-focus-preset="lane-c"]').click()
  await expect.poll(() => viewportTransform(page)).not.toBe(beforePreset)

  const afterPreset = await viewportTransform(page)
  await page.locator('[data-hotspot-id="gateway"]').click()
  await expect.poll(() => viewportTransform(page)).not.toBe(afterPreset)
})

test('write-corridor routes stay orthogonal and labels avoid nearby nodes', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/?edge=F_VoR_ACK')

  const edgePointsValue = await page.locator('.semantic-edge[data-edge-id="F4"]').getAttribute('data-edge-points')
  expect(edgePointsValue).toBeTruthy()

  const edgePoints = parseEdgePoints(edgePointsValue ?? '')
  for (let index = 1; index < edgePoints.length; index += 1) {
    const previous = edgePoints[index - 1]
    const current = edgePoints[index]
    expect(previous.x === current.x || previous.y === current.y).toBe(true)
  }

  const labelLocators = ['F5', 'F6', 'F_VoR_ACK'].map((edgeId) =>
    page.locator(`.edge-label[data-edge-id="${edgeId}"]`),
  )
  const nodeLocators = ['VOI', 'ACT1', 'A3'].map((nodeId) =>
    page.locator(`.node-card[data-node-id="${nodeId}"]`),
  )

  const labelBoxes = await Promise.all(labelLocators.map((locator) => locator.boundingBox()))
  const nodeBoxes = await Promise.all(nodeLocators.map((locator) => locator.boundingBox()))

  for (const labelBox of labelBoxes) {
    expect(labelBox).not.toBeNull()
  }
  for (const nodeBox of nodeBoxes) {
    expect(nodeBox).not.toBeNull()
  }

  for (const labelBox of labelBoxes) {
    for (const nodeBox of nodeBoxes) {
      expect(boxesOverlap(labelBox!, nodeBox!, 6)).toBe(false)
    }
  }

  for (let index = 0; index < labelBoxes.length; index += 1) {
    for (let other = index + 1; other < labelBoxes.length; other += 1) {
      expect(boxesOverlap(labelBoxes[index]!, labelBoxes[other]!, 10)).toBe(false)
    }
  }
})
