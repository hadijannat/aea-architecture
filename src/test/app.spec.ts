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

async function ensureCompactDensity(page: Page, nodeId: string) {
  const node = page.locator(`.node-card[data-node-id="${nodeId}"]`)
  const zoomOut = page.locator('.react-flow__controls-button').nth(1)

  for (let index = 0; index < 7; index += 1) {
    if ((await node.getAttribute('data-node-density')) === 'compact') {
      return
    }
    await zoomOut.click()
    await page.waitForTimeout(160)
  }

  throw new Error(`Node ${nodeId} did not enter compact density`)
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

test('selecting F_VoR_ACK highlights the Panel B acknowledgement with its action label', async ({ page }) => {
  await page.goto('/')
  const vorAckEdge = page.getByRole('button', { name: /^F_VoR_ACK:/ })
  await expect(vorAckEdge).toBeVisible()
  await vorAckEdge.dispatchEvent('click')
  await expect(page.getByRole('heading', { name: 'F_VoR_ACK' })).toBeVisible()
  await expect(page.getByRole('button', { name: /PB_ACK/ })).toBeVisible()
  await expect(page.locator('.sequence-edge-label.is-highlighted')).toContainText('Return status')
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

test('desktop canvas includes the overview map and grouped semantic legend', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/?node=ACT1')

  await expect(page.locator('.canvas-hud')).toHaveCount(0)
  await expect(page.locator('.semantic-overview')).toBeVisible()
  await expect(page.locator('[data-overview-map]')).toBeVisible()
  await expect(page.locator('[data-write-arrow-id]')).toHaveCount(4)
  await expect(page.locator('[data-legend-family="feedback"]')).toBeVisible()
  await expect(page.locator('[data-legend-item="status-ack"]')).toBeVisible()
  await expect(page.locator('[data-legend-item="rejection"]')).toBeVisible()

  await page.locator('[data-focus-preset="lane-c"]').click({ force: true })
  await page.locator('[data-hotspot-id="gateway"]').click({ force: true })
  await expect(page.locator('[data-overview-map]')).toBeVisible()
})

test('feedback sequence edges use distinct styling for acknowledgement and rejection', async ({ page }) => {
  await page.goto('/')

  const ackStyles = await page.locator('.sequence-edge-label[data-edge-id="PB_ACK"]').evaluate((element) => {
    const computed = getComputedStyle(element)
    return {
      color: computed.color,
      borderStyle: computed.borderStyle,
    }
  })
  const rejectStyles = await page.locator('.sequence-edge-label[data-edge-id="PB_REJECT"]').evaluate((element) => {
    const computed = getComputedStyle(element)
    return {
      color: computed.color,
      borderStyle: computed.borderStyle,
    }
  })

  expect(ackStyles.color).not.toBe(rejectStyles.color)
  expect(ackStyles.borderStyle).toBe('solid')
  expect(rejectStyles.borderStyle).toContain('dashed')
})

test('selected sequence edges expand from ids into human-readable action labels', async ({ page }) => {
  await page.goto('/?edge=F_VoR_ACK')

  const ackLabel = page.locator('.sequence-edge-label[data-edge-id="PB_ACK"]')
  const sequenceLabel = page.locator('.sequence-edge-label[data-edge-id="PB_F1"]')

  await expect(ackLabel).toHaveAttribute('data-edge-label-mode', 'expanded')
  await expect(ackLabel).toContainText('Return status')
  await expect(sequenceLabel).toHaveAttribute('data-edge-label-mode', 'compact')
  await expect(sequenceLabel).toHaveText('PB_F1')
})

test('compact nodes summarize metadata and reveal the full chips on hover', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')
  await ensureCompactDensity(page, 'S2')

  const node = page.locator('.node-card[data-node-id="S2"]')
  await expect(node).toHaveAttribute('data-node-density', 'compact')
  await expect(node.locator('[data-node-meta-summary="standards"]')).toContainText('2 standards')
  await expect(node.locator('[data-node-meta-summary="claims"]')).toContainText('3 claims')

  await node.hover()
  await expect(node.locator('[data-node-meta-popover]')).toBeVisible()
  await expect(node.locator('[data-node-meta-popover]')).toContainText('C3')
  await expect(node.locator('[data-node-meta-popover]')).toContainText('PA-DIM')
})

test('analysis theme persists across reloads', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Analysis theme' }).click()
  await expect(page.locator('.app-shell')).toHaveClass(/app-shell--theme-analysis/)

  await page.reload()
  await expect(page.locator('.app-shell')).toHaveClass(/app-shell--theme-analysis/)
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

test('visual regression: desktop board with legend', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/?node=ACT1')
  await page.mouse.move(0, 0)
  await expect(page.locator('.workspace__panels')).toHaveScreenshot('desktop-board-with-legend.png')
})

test('visual regression: selected sequence feedback states', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/?edge=F_VoR_ACK')
  await page.mouse.move(0, 0)
  await expect(page.locator('.sequence-panel')).toHaveScreenshot('sequence-feedback-selected.png')
})

test('visual regression: compact-node summary state', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')
  await ensureCompactDensity(page, 'S2')
  await page.mouse.move(0, 0)
  await expect(page.locator('.architecture-canvas')).toHaveScreenshot('compact-node-summary.png')
})

test('visual regression: analysis theme', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Analysis theme' }).click()
  await page.mouse.move(0, 0)
  await expect(page.locator('.workspace')).toHaveScreenshot('analysis-theme.png')
})
