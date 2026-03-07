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

async function ensureEdgeLabelMode(
  page: Page,
  edgeId: string,
  mode: 'compact' | 'expanded',
  action: 'zoom-in' | 'zoom-out',
  maxClicks = 8,
) {
  const edgeLabel = page.locator(`.edge-label[data-edge-id="${edgeId}"]`)
  const control = page.locator('.react-flow__controls-button').nth(action === 'zoom-in' ? 0 : 1)

  for (let index = 0; index < maxClicks; index += 1) {
    if ((await edgeLabel.getAttribute('data-edge-label-mode')) === mode) {
      return edgeLabel
    }
    await control.click()
    await page.waitForTimeout(160)
  }

  throw new Error(`Edge ${edgeId} did not enter ${mode} label mode`)
}

async function architectureEdgeIsAnimated(page: Page, edgeId: string) {
  return page.locator(`.semantic-edge[data-edge-id="${edgeId}"]`).evaluate((element) => {
    const edge = element.closest('.react-flow__edge')
    return edge?.classList.contains('animated') ?? false
  })
}

async function nodeSurfaceStyles(page: Page, nodeId: string) {
  return page.locator(`.node-card[data-node-id="${nodeId}"]`).evaluate((element) => {
    const computed = getComputedStyle(element)
    return {
      backgroundColor: computed.backgroundColor,
      borderColor: computed.borderColor,
    }
  })
}

function hexToRgbString(hex: string) {
  const normalized = hex.replace('#', '')
  const value = normalized.length === 3
    ? normalized
        .split('')
        .map((char) => `${char}${char}`)
        .join('')
    : normalized

  const [r, g, b] = [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16))
  return `rgb(${r}, ${g}, ${b})`
}

async function expandedNoteIds(page: Page) {
  return page.evaluate(() => {
    const stored = window.localStorage.getItem('aea-architecture-ui')
    if (!stored) {
      return []
    }
    const parsed = JSON.parse(stored)
    return parsed.state?.projection?.expandedNoteIds ?? []
  })
}

async function svgBox(locator: Locator) {
  return locator.evaluate((element) => {
    if (!(element instanceof SVGGraphicsElement)) {
      return null
    }

    const box = element.getBBox()
    return {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    }
  })
}

async function viewportTransform(page: Page) {
  return page.locator('.react-flow__viewport').evaluate((element) => getComputedStyle(element).transform)
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
  await page.getByRole('button', { name: 'C4: Actuation is exclusive to the VoR path' }).click()
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

test('desktop canvas keeps topology visible while the legend stays collapsed by default', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/?node=ACT1')

  await expect(page.locator('.canvas-hud')).toHaveCount(0)
  await expect(page.locator('.semantic-overview')).toBeVisible()
  await expect(page.locator('[data-overview-map]')).toBeVisible()
  await expect(page.locator('[data-overview-node-id="VOI"]')).toBeVisible()
  await expect(page.locator('[data-overview-node-id="ACT1"]')).toBeVisible()
  await expect(page.locator('[data-overview-legend-panel]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Show legend' }).click()
  await expect(page.locator('[data-overview-legend-panel]')).toBeVisible()
  await expect(page.locator('[data-legend-item="status-ack"]')).toBeVisible()
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

test('architecture edge labels expand with zoom and truncate to human-readable labels', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')

  const edgeLabel = await ensureEdgeLabelMode(page, 'F4', 'compact', 'zoom-out')
  await expect(edgeLabel).toHaveText('F4')

  await ensureEdgeLabelMode(page, 'F4', 'expanded', 'zoom-in')
  await expect(edgeLabel).toHaveAttribute('data-edge-label-mode', 'expanded')
  await expect(edgeLabel).toContainText('validated candidate plan')
})

test('toggle chips expose pressed state and the updated lane copy', async ({ page }) => {
  await page.goto('/')

  const laneA = page.getByRole('button', { name: 'Lane A: CPC / external systems' })
  await expect(laneA).toHaveAttribute('aria-pressed', 'false')
  await expect(laneA).toContainText('CPC')
  await laneA.click()
  await expect(laneA).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Lane B: AEA / gateway / decisioning' })).toContainText('psM+O')
  await expect(page.getByRole('button', { name: 'Lane C: central analytics / historian' })).toContainText(
    'Central M+O',
  )
  await expect(page.getByRole('button', { name: 'Hide VoR sequence' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Write corridor focus' })).toBeVisible()

  const claimC4 = page.getByRole('button', { name: 'C4: Actuation is exclusive to the VoR path' })
  await expect(claimC4).toHaveAttribute('aria-pressed', 'false')
  await expect(claimC4).toContainText('Actuation is exclusive to the VoR path')
  await expect(claimC4).toHaveAttribute(
    'title',
    'The only write-back initiation path is F5 through NE 178 and the VoR Interface.',
  )
  await claimC4.click()
  await expect(claimC4).toHaveAttribute('aria-pressed', 'true')
})

test('write corridor preset stays single-line in the 2x2 focus grid', async ({ page }) => {
  await page.goto('/?node=ACT1')

  const writePreset = page.locator('[data-focus-preset="write"]')
  const overviewPreset = page.locator('[data-focus-preset="overview"]')

  await expect(writePreset).toContainText('Write corridor')
  const writeHeight = (await writePreset.boundingBox())?.height ?? 0
  const overviewHeight = (await overviewPreset.boundingBox())?.height ?? 0

  expect(writeHeight).toBeGreaterThan(0)
  expect(Math.abs(writeHeight - overviewHeight)).toBeLessThanOrEqual(2)
})

test('reduce motion toggle disables animated writeback and tool-call edges', async ({ page }) => {
  await page.goto('/')

  const reduceMotion = page.getByRole('button', { name: 'Reduce motion' })
  await expect(reduceMotion).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(() => architectureEdgeIsAnimated(page, 'F5')).toBe(true)
  await expect.poll(() => architectureEdgeIsAnimated(page, 'F_VoR_ACK')).toBe(false)
  await expect.poll(() => architectureEdgeIsAnimated(page, 'F_T1')).toBe(true)
  await expect.poll(() => architectureEdgeIsAnimated(page, 'F_T2')).toBe(true)

  await reduceMotion.click()
  await expect(reduceMotion).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => architectureEdgeIsAnimated(page, 'F5')).toBe(false)
  await expect.poll(() => architectureEdgeIsAnimated(page, 'F_T1')).toBe(false)
  await expect.poll(() => architectureEdgeIsAnimated(page, 'F_T2')).toBe(false)
})

test('system reduced-motion preference disables animated architecture edges', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  await expect(page.getByRole('button', { name: 'Reduce motion' })).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(() => architectureEdgeIsAnimated(page, 'F5')).toBe(false)
  await expect.poll(() => architectureEdgeIsAnimated(page, 'F_T1')).toBe(false)
  await expect.poll(() => architectureEdgeIsAnimated(page, 'F_T2')).toBe(false)
})

test('optional architecture edges expose reduced-emphasis state and expanded labels', async ({ page }) => {
  await page.goto('/?edge=F7_sub')

  const edge = page.locator('.semantic-edge[data-edge-id="F7_sub"]')
  const label = page.locator('.edge-label[data-edge-id="F7_sub"]')

  await expect(edge).toHaveAttribute('data-edge-optional', 'true')
  await expect(label).toHaveAttribute('data-edge-optional', 'true')
  await expect(label).toContainText('(optional)')

  const styles = await Promise.all([
    edge.evaluate((element) => getComputedStyle(element).opacity),
    label.evaluate((element) => getComputedStyle(element).opacity),
  ])

  expect(styles).toEqual(['0.6', '0.6'])
})

test('architecture marker defs stay stroke-relative and the write ribbon follows zoom visibility', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')

  await expect(page.locator('#architecture-marker-writeback')).toHaveAttribute('markerUnits', 'strokeWidth')

  const writePreset = page.locator('[data-focus-preset="write"]')
  await writePreset.click({ force: true })

  const ribbon = page.locator('[data-write-ribbon]')
  await expect.poll(() => ribbon.getAttribute('data-write-ribbon-visible')).toBe('true')

  const zoomIn = page.locator('.react-flow__controls-button').first()
  for (let index = 0; index < 6; index += 1) {
    if ((await ribbon.getAttribute('data-write-ribbon-visible')) === 'false') {
      break
    }
    await zoomIn.click()
    await page.waitForTimeout(160)
  }

  await expect(ribbon).toHaveAttribute('data-write-ribbon-visible', 'false')
})

test('wheel zoom still works when the cursor is over the write ribbon', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')

  await page.locator('[data-focus-preset="write"]').click({ force: true })
  const ribbon = page.locator('[data-write-ribbon]')
  await expect(ribbon).toHaveAttribute('data-write-ribbon-visible', 'true')

  const ribbonBox = await ribbon.boundingBox()
  expect(ribbonBox).not.toBeNull()

  const before = await viewportTransform(page)
  await page.mouse.move((ribbonBox?.x ?? 0) + (ribbonBox?.width ?? 0) / 2, (ribbonBox?.y ?? 0) + (ribbonBox?.height ?? 0) / 2)
  await page.mouse.wheel(0, -600)
  await page.waitForTimeout(220)
  const after = await viewportTransform(page)

  expect(after).not.toBe(before)
})

test('edge inspector surfaces diode and optional rendering semantics', async ({ page }) => {
  await page.goto('/?edge=F_GW2')

  const inspector = page.locator('.inspector-section').filter({ has: page.getByRole('heading', { name: 'F_GW2' }) })
  await expect(inspector).toContainText('Diode marker')
  await expect(inspector).toContainText('One-way boundary; the edge must not imply a return path.')

  await page.goto('/?edge=F7_sub')

  const optionalInspector = page.locator('.inspector-section').filter({ has: page.getByRole('heading', { name: 'F7_sub' }) })
  await expect(optionalInspector).toContainText('Optional path')
  await expect(optionalInspector).toContainText('Rendered with reduced emphasis because this flow is documentation-only or conditional.')
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

test('sequence background and ribbon label follow the active theme', async ({ page }) => {
  await page.goto('/')

  const sequenceBackground = page.locator('[data-sequence-background]')
  await expect(page.getByTestId('sequence').getByText('VoR boundary')).toBeVisible()
  await expect
    .poll(() => sequenceBackground.evaluate((element) => getComputedStyle(element).fill))
    .toBe('rgb(255, 249, 241)')

  await page.getByRole('button', { name: 'Analysis theme' }).click()
  await expect
    .poll(() => sequenceBackground.evaluate((element) => getComputedStyle(element).fill))
    .toBe('rgb(255, 255, 255)')
})

test('notes control toggles the expanded note set', async ({ page }) => {
  await page.goto('/')

  const notesToggle = page.getByRole('button', { name: 'Expand all notes' })
  await expect(notesToggle).toHaveAttribute('aria-pressed', 'false')
  await notesToggle.click()
  const collapseToggle = page.getByRole('button', { name: 'Collapse all notes' })
  await expect(collapseToggle).toHaveAttribute('aria-pressed', 'true')
  await expect(await expandedNoteIds(page)).not.toHaveLength(0)

  await collapseToggle.click()
  await expect(page.getByRole('button', { name: 'Expand all notes' })).toHaveAttribute('aria-pressed', 'false')
  await expect(await expandedNoteIds(page)).toHaveLength(0)
})

test('projection snapshots reveal the composer only when saving is requested', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByLabel('Snapshot name')).toHaveCount(0)
  await page.getByRole('button', { name: 'Save snapshot' }).click()

  const snapshotName = page.getByLabel('Snapshot name')
  const saveButton = page.getByRole('button', { name: 'Save' })

  await expect(saveButton).toBeDisabled()
  await snapshotName.fill('Review checkpoint')
  await snapshotName.press('Enter')

  await expect(page.locator('.snapshot-card').first()).toContainText('Review checkpoint')
  await expect(page.getByLabel('Snapshot name')).toHaveCount(0)
})

test('runtime node surfaces consume the manifest visual tokens', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')

  await expect(page.locator('.node-card[data-node-id="VOI"]')).toBeVisible()

  expect(await nodeSurfaceStyles(page, 'VOI')).toEqual({
    backgroundColor: hexToRgbString('#fff7ef'),
    borderColor: hexToRgbString('#d35400'),
  })
  expect(await nodeSurfaceStyles(page, 'DEC_G1')).toEqual({
    backgroundColor: hexToRgbString('#ffffff'),
    borderColor: hexToRgbString('#455a75'),
  })
  expect(await nodeSurfaceStyles(page, 'LANE_A')).toEqual({
    backgroundColor: hexToRgbString('#f7f7f7'),
    borderColor: hexToRgbString('#c9d0d8'),
  })
  expect(await nodeSurfaceStyles(page, 'BAND_SENSE')).toEqual({
    backgroundColor: hexToRgbString('#edf5ff'),
    borderColor: hexToRgbString('#bfd4ef'),
  })
  expect(await nodeSurfaceStyles(page, 'BAND_DECIDE')).toEqual({
    backgroundColor: hexToRgbString('#f6f8fc'),
    borderColor: hexToRgbString('#ccd4e0'),
  })
  expect(await nodeSurfaceStyles(page, 'BAND_ACT')).toEqual({
    backgroundColor: hexToRgbString('#fdf1e7'),
    borderColor: hexToRgbString('#ddc8b6'),
  })
})

test('overview navigator keeps corridor routes behind nodes and retains visible accents', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/?node=ACT1')

  const actAccent = page.locator('[data-overview-node-accent-id="ACT1"]')
  const corridorArrow = page.locator('[data-overview-write-arrow="corridor"]')

  await expect(actAccent).toBeVisible()
  await expect(corridorArrow).toBeVisible()

  const accentBox = await svgBox(actAccent)
  const arrowBox = await svgBox(corridorArrow)

  expect(accentBox?.height ?? 0).toBeGreaterThan(40)
  expect(arrowBox?.width ?? 0).toBeGreaterThan(60)

  const routePrecedesNode = await page.evaluate(() => {
    const route = document.querySelector('[data-write-route-id="F5"]')
    const node = document.querySelector('[data-overview-node-id="ACT1"]')
    if (!route || !node) {
      return false
    }

    return Boolean(route.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)
  })

  expect(routePrecedesNode).toBe(true)
})

test('overview navigator regions follow persisted structural overrides', async ({ page }) => {
  await page.goto('/')

  const persisted = await page.evaluate(() => {
    const raw = window.localStorage.getItem('aea-architecture-ui')
    if (!raw) {
      throw new Error('Persisted state was not created')
    }

    const parsed = JSON.parse(raw)
    parsed.state.projection.nodePositions = {
      ...parsed.state.projection.nodePositions,
      LANE_A: { x: 96, y: 72 },
    }
    return JSON.stringify(parsed)
  })

  await page.addInitScript((value) => {
    window.localStorage.setItem('aea-architecture-ui', value)
  }, persisted)

  await page.reload()

  await expect.poll(() => page.locator('[data-overview-region-id="lane-a"]').getAttribute('x')).toBe('96')
  await expect.poll(() => page.locator('[data-overview-region-id="lane-a"]').getAttribute('y')).toBe('72')
})

test('hover cards stay clear of the overview panel', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')

  await page.locator('.node-card[data-node-id="ACT1"]').hover()

  const hoverCardBox = await page.locator('.hover-card').boundingBox()
  const overviewBox = await page.locator('.semantic-overview').boundingBox()

  expect(hoverCardBox).not.toBeNull()
  expect(overviewBox).not.toBeNull()
  expect(boxesOverlap(hoverCardBox!, overviewBox!, 12)).toBe(false)
})

test('write-corridor routes stay orthogonal and labels avoid nearby nodes', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/?edge=F_VoR_ACK')
  await page.keyboard.press('Escape')
  await ensureEdgeLabelMode(page, 'F5', 'compact', 'zoom-out')
  await ensureEdgeLabelMode(page, 'F6', 'compact', 'zoom-out')
  await ensureEdgeLabelMode(page, 'F_VoR_ACK', 'compact', 'zoom-out')

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
