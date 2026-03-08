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
      outlineColor: computed.outlineColor,
      outlineStyle: computed.outlineStyle,
      outlineWidth: computed.outlineWidth,
      matchesFocusVisible: element.matches(':focus-visible'),
    }
  })

  expect(styles.matchesFocusVisible).toBe(true)
  expect(styles.boxShadow !== 'none' || styles.outlineStyle !== 'none').toBe(true)

  if (styles.outlineStyle !== 'none') {
    expect(styles.outlineWidth).not.toBe('0px')
    expect(styles.outlineColor).toContain('59, 130, 246')
    return
  }

  expect(styles.boxShadow).not.toBe('none')
}

async function ensureNodeRenderMode(
  page: Page,
  nodeId: string,
  mode: 'icon' | 'navigation' | 'detail' | 'collapsed',
  action: 'zoom-in' | 'zoom-out' = 'zoom-out',
  maxClicks = 8,
) {
  const node = page.locator(`.node-card[data-node-id="${nodeId}"]`)
  const control = page.locator(
    action === 'zoom-in'
      ? '.architecture-canvas .react-flow__controls-zoomin:not([disabled])'
      : '.architecture-canvas .react-flow__controls-zoomout:not([disabled])',
  )

  for (let index = 0; index < maxClicks; index += 1) {
    if ((await node.getAttribute('data-node-density')) === mode) {
      return node
    }

    await control.click()
    await page.waitForTimeout(160)
  }

  throw new Error(`Node ${nodeId} did not enter ${mode} render mode`)
}

async function getArchitectureEdgeLabelMode(page: Page, edgeId: string) {
  const edgeLabel = page.locator(`.edge-label[data-edge-id="${edgeId}"]`)
  if ((await edgeLabel.count()) === 0) {
    return 'hidden'
  }

  return (await edgeLabel.getAttribute('data-edge-label-mode')) ?? 'hidden'
}

async function ensureEdgeLabelMode(
  page: Page,
  edgeId: string,
  mode: 'hidden' | 'chip' | 'detail',
  action: 'zoom-in' | 'zoom-out',
  maxClicks = 8,
) {
  const edgeLabel = page.locator(`.edge-label[data-edge-id="${edgeId}"]`)
  const control = page.locator(
    action === 'zoom-in'
      ? '.architecture-canvas .react-flow__controls-zoomin:not([disabled])'
      : '.architecture-canvas .react-flow__controls-zoomout:not([disabled])',
  )

  for (let index = 0; index < maxClicks; index += 1) {
    if ((await getArchitectureEdgeLabelMode(page, edgeId)) === mode) {
      return edgeLabel
    }
    await control.click()
    await page.waitForTimeout(160)
  }

  throw new Error(`Edge ${edgeId} did not enter ${mode} label mode`)
}

function architectureMainEdgePath(page: Page, edgeId: string) {
  return page.locator(`.semantic-edge[data-edge-id="${edgeId}"] .react-flow__edge-path`).last()
}

async function viewportTransform(page: Page) {
  return page.locator('.react-flow__viewport').evaluate((element) => getComputedStyle(element).transform)
}

async function boxHeight(locator: Locator) {
  return locator.evaluate((element) => element.getBoundingClientRect().height)
}

async function intersectsScrollContainer(container: Locator, subject: Locator) {
  return container.evaluate(
    (containerElement, subjectElement) => {
      if (!(containerElement instanceof HTMLElement) || !(subjectElement instanceof HTMLElement)) {
        return false
      }

      const containerRect = containerElement.getBoundingClientRect()
      const subjectRect = subjectElement.getBoundingClientRect()
      return subjectRect.bottom > containerRect.top && subjectRect.top < containerRect.bottom
    },
    await subject.elementHandle(),
  )
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

async function computedStyleValue(locator: Locator, property: string) {
  return locator.evaluate(
    (element, styleProperty) => getComputedStyle(element).getPropertyValue(styleProperty),
    property,
  )
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
  const f5Edge = await ensureEdgeLabelMode(page, 'F5', 'chip', 'zoom-in')
  await expect(f5Edge).toBeVisible()
  await f5Edge.dispatchEvent('click')
  await expect(page.getByRole('heading', { name: 'F5' })).toBeVisible()
  await expect(page.locator('.sequence-step.is-highlighted')).toHaveCount(5)
})

test('filtering by C4 keeps the write path visible', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'C4: Actuation is exclusive to the VoR path' }).click()
  await expect(await ensureEdgeLabelMode(page, 'F5', 'chip', 'zoom-in')).toBeVisible()
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
  const vorAckEdge = await ensureEdgeLabelMode(page, 'F_VoR_ACK', 'chip', 'zoom-in')
  await expect(vorAckEdge).toBeVisible()
  await vorAckEdge.dispatchEvent('click')
  await expect(page.getByRole('heading', { name: 'F_VoR_ACK' })).toBeVisible()
  await expect(page.getByRole('button', { name: /PB_ACK/ })).toBeVisible()
  await expect(page.locator('.sequence-edge-label.is-highlighted')).toContainText('ACK signal')
})

test('edge controls expose semantic accessible names', async ({ page }) => {
  await page.goto('/')
  await expect(await ensureEdgeLabelMode(page, 'F5', 'chip', 'zoom-in')).toHaveAccessibleName(
    /^F5: writeback edge from/,
  )
  await expect(await ensureEdgeLabelMode(page, 'F_VoR_ACK', 'chip', 'zoom-in')).toHaveAccessibleName(
    /^F_VoR_ACK: status-ack edge from/,
  )
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
  await page.getByRole('button', { name: 'Expand legend' }).click()
  await expect(page.locator('[data-overview-legend-panel]')).toBeVisible()
  await expect(page.locator('[data-legend-item="status-ack"]')).toBeVisible()
  await expect(page.locator('#legend-marker-status-ack')).toHaveAttribute('markerUnits', 'userSpaceOnUse')
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
  await expect(ackLabel).toContainText('ACK signal')
  await expect(sequenceLabel).toHaveAttribute('data-edge-label-mode', 'compact')
  await expect(sequenceLabel).toHaveText('PB_F1')
})

test('architecture edge labels retain ids in chip and detail modes', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')
  await page.waitForTimeout(700)

  await ensureEdgeLabelMode(page, 'F4', 'hidden', 'zoom-out')
  await expect(page.locator('.edge-label[data-edge-id="F4"]')).toHaveCount(0)

  const edgeLabel = await ensureEdgeLabelMode(page, 'F4', 'chip', 'zoom-in')
  await expect(edgeLabel).toHaveAttribute('data-edge-label-mode', 'chip')
  await expect(edgeLabel).toHaveText('F4 · Await approval')

  await page.goto('/?edge=F4')
  const detailedLabel = await ensureEdgeLabelMode(page, 'F4', 'detail', 'zoom-in')
  await expect(detailedLabel).toHaveAttribute('data-edge-label-mode', 'detail')
  await expect(detailedLabel).toContainText('F4 · Await approval')
})

test('diode edges use dedicated diode markers with readable labels', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')
  await page.waitForTimeout(700)

  const edgeLabel = await ensureEdgeLabelMode(page, 'F_GW2', 'chip', 'zoom-in')
  await expect(edgeLabel).toHaveAttribute('data-edge-label-mode', 'chip')
  await expect(edgeLabel).toHaveText('F_GW2 · Ingress')

  await expect(architectureMainEdgePath(page, 'F_GW2')).toHaveAttribute(
    'marker-end',
    /architecture-marker-gateway-internal-diode/,
  )
})

test('F3e and F3g display labels stay separated at the desktop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')
  await page.waitForTimeout(700)

  const f3eLabel = await ensureEdgeLabelMode(page, 'F3e', 'chip', 'zoom-in')
  const f3gLabel = await ensureEdgeLabelMode(page, 'F3g', 'chip', 'zoom-in')

  await expect(f3eLabel).toHaveAttribute('data-edge-label-mode', 'chip')
  await expect(f3gLabel).toHaveAttribute('data-edge-label-mode', 'chip')

  const [f3eBox, f3gBox] = await Promise.all([f3eLabel.boundingBox(), f3gLabel.boundingBox()])

  expect(f3eBox).not.toBeNull()
  expect(f3gBox).not.toBeNull()
  expect(boxesOverlap(f3eBox!, f3gBox!, 0)).toBe(false)
})

test('overview node tiles hide subtitle and metadata at low zoom', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')
  await page.waitForTimeout(700)

  const plannerCard = await ensureNodeRenderMode(page, 'DEC_R2', 'icon', 'zoom-out')
  await expect(plannerCard).toHaveAttribute('data-node-density', 'icon')
  await expect(plannerCard.locator('.node-card__icon-tile')).toBeVisible()
  await expect(plannerCard.locator('.node-card__subtitle')).toHaveCount(0)
  await expect(plannerCard.locator('.node-card__description')).toHaveCount(0)
  await expect(plannerCard.locator('.node-card__meta')).toHaveCount(0)
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
  await expect(page.locator('[data-focus-preset="guardrail"]')).toContainText('Guardrails')
  await expect(page.locator('[data-hotspot-id="write"] .semantic-overview__hotspot-label')).toHaveText(
    'Write corridor',
  )

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

test('focus presets stay single-line after adding the guardrail control view', async ({ page }) => {
  await page.goto('/?node=ACT1')

  const writePreset = page.locator('[data-focus-preset="write"]')
  const overviewPreset = page.locator('[data-focus-preset="overview"]')
  const guardrailPreset = page.locator('[data-focus-preset="guardrail"]')

  await expect(writePreset).toContainText('Write corridor')
  await expect(guardrailPreset).toContainText('Guardrails')
  const writeHeight = (await writePreset.boundingBox())?.height ?? 0
  const overviewHeight = (await overviewPreset.boundingBox())?.height ?? 0
  const guardrailHeight = (await guardrailPreset.boundingBox())?.height ?? 0

  expect(writeHeight).toBeGreaterThan(0)
  expect(Math.abs(writeHeight - overviewHeight)).toBeLessThanOrEqual(2)
  expect(Math.abs(guardrailHeight - overviewHeight)).toBeLessThanOrEqual(2)
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

test('optional architecture edges only reduce emphasis while resting', async ({ page }) => {
  await page.goto('/')

  const restingEdge = page.locator('.semantic-edge[data-edge-id="F7_sub"]')
  const restingLabel = await ensureEdgeLabelMode(page, 'F7_sub', 'chip', 'zoom-in')

  await expect(restingEdge).toHaveAttribute('data-edge-optional', 'true')
  await expect(restingLabel).toHaveAttribute('data-edge-optional', 'true')
  expect(await computedStyleValue(restingEdge, 'opacity')).toBe('0.6')
  expect(await computedStyleValue(restingLabel, 'opacity')).toBe('0.6')

  await page.goto('/?edge=F7_sub')

  const selectedEdge = page.locator('.semantic-edge[data-edge-id="F7_sub"]')
  const selectedLabel = await ensureEdgeLabelMode(page, 'F7_sub', 'detail', 'zoom-in')

  await expect(selectedLabel).toContainText('(optional)')
  expect(await computedStyleValue(selectedEdge, 'opacity')).toBe('1')
  expect(await computedStyleValue(selectedLabel, 'opacity')).toBe('1')
})

test('dimmed optional labels inherit the same emphasis tier as their edge paths', async ({ page }) => {
  await page.goto('/?edge=F5')

  const edge = page.locator('.semantic-edge[data-edge-id="F7_sub"]')
  const label = await ensureEdgeLabelMode(page, 'F7_sub', 'chip', 'zoom-in')

  await expect(edge).toHaveAttribute('data-edge-optional', 'true')
  await expect(label).toHaveAttribute('data-edge-optional', 'true')
  await expect(label).toHaveClass(/is-dimmed/)
  expect(await computedStyleValue(edge, 'opacity')).toBe('0.46')
  expect(await computedStyleValue(label, 'opacity')).toBe('0.46')
})

test('telemetry labels and paths fade together at rest and restore when selected', async ({ page }) => {
  await page.goto('/')

  const restingPath = architectureMainEdgePath(page, 'F_AUDIT')
  const restingLabel = await ensureEdgeLabelMode(page, 'F_AUDIT', 'chip', 'zoom-in')

  await expect(restingLabel).toHaveAttribute('data-edge-family', 'telemetry')
  expect(await computedStyleValue(restingPath, 'opacity')).toBe('0.82')
  expect(await computedStyleValue(restingLabel, 'opacity')).toBe('0.82')

  await page.goto('/?edge=F_AUDIT')

  const selectedPath = architectureMainEdgePath(page, 'F_AUDIT')
  const selectedLabel = await ensureEdgeLabelMode(page, 'F_AUDIT', 'detail', 'zoom-in')

  expect(await computedStyleValue(selectedPath, 'opacity')).toBe('1')
  expect(await computedStyleValue(selectedLabel, 'opacity')).toBe('1')
})

test('highlighted non-writeback paths receive a visible glow', async ({ page }) => {
  await page.goto('/?edge=F1')

  const highlightedPath = architectureMainEdgePath(page, 'F1')
  expect(await computedStyleValue(highlightedPath, 'filter')).not.toBe('none')
})

test('architecture marker defs stay stroke-relative and the write ribbon follows zoom visibility', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')

  await expect(page.locator('#architecture-marker-writeback-arrowclosed')).toHaveAttribute('markerUnits', 'strokeWidth')
  await expect(page.locator('#architecture-marker-writeback-arrowclosed')).toHaveAttribute('markerWidth', '18')
  await expect(page.locator('#architecture-marker-writeback-arrowclosed')).toHaveAttribute('markerHeight', '14')
  await expect(page.locator('#architecture-marker-writeback-arrowclosed')).toHaveAttribute('refY', '4')
  await page.getByRole('button', { name: 'Expand legend' }).click()
  await expect(page.locator('[data-overview-legend-panel] #legend-marker-writeback')).toHaveAttribute(
    'markerUnits',
    'userSpaceOnUse',
  )
  await expect(page.locator('[data-overview-legend-panel] #legend-marker-writeback')).toHaveAttribute('markerWidth', '12')
  await expect(page.locator('[data-overview-legend-panel] #legend-marker-writeback')).toHaveAttribute('markerHeight', '10')
  await expect(page.locator('[data-overview-legend-panel] #legend-marker-writeback')).toHaveAttribute('refY', '4')

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

test('page scroll can reach the sequence while pinch-style zoom still works over the write ribbon', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')

  const beforeScroll = await page.evaluate(() => window.scrollY)
  await page.locator('.architecture-canvas').hover()
  await page.mouse.wheel(0, 900)
  await page.waitForTimeout(220)
  const afterScroll = await page.evaluate(() => window.scrollY)

  expect(afterScroll).toBeGreaterThan(beforeScroll)

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.locator('[data-focus-preset="write"]').click({ force: true })
  const ribbon = page.locator('[data-write-ribbon]')
  await expect(ribbon).toHaveAttribute('data-write-ribbon-visible', 'true')
  const ribbonBox = await ribbon.boundingBox()
  expect(ribbonBox).not.toBeNull()

  const before = await viewportTransform(page)
  await page.keyboard.down('Control')
  await page.mouse.move(ribbonBox!.x + ribbonBox!.width / 2, ribbonBox!.y + ribbonBox!.height / 2)
  await page.mouse.wheel(0, -600)
  await page.keyboard.up('Control')
  await page.waitForTimeout(220)
  const after = await viewportTransform(page)

  expect(after).not.toBe(before)
})

test('short desktop viewports keep the sequence panel reachable even with a stale persisted split', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'aea-architecture-ui',
      JSON.stringify({
        state: {
          ui: {
            panelBVisible: true,
            panelBSize: 6,
          },
          projection: {},
        },
        version: 0,
      }),
    )
  })
  await page.setViewportSize({ width: 1600, height: 760 })
  await page.goto('/')

  const sequencePanel = page.getByTestId('sequence')
  const sequenceShell = sequencePanel.locator('.sequence-board-shell')
  const rejectTerminal = sequencePanel.locator('.sequence-terminal--reject')
  await expect(sequencePanel).toBeVisible()
  await expect(sequencePanel.getByRole('heading', { name: 'VoR Domain-Transition Sequence' })).toBeVisible()
  await expect(sequencePanel.getByText('VoR boundary')).toBeVisible()

  const panelHeight = await boxHeight(sequencePanel)
  expect(panelHeight).toBeGreaterThan(150)

  const shellMetrics = await sequenceShell.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }))
  expect(shellMetrics.scrollHeight).toBeGreaterThan(shellMetrics.clientHeight)
  expect(await intersectsScrollContainer(sequenceShell, rejectTerminal)).toBe(false)

  await sequenceShell.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await page.waitForTimeout(140)

  await expect.poll(() => sequenceShell.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  expect(await intersectsScrollContainer(sequenceShell, rejectTerminal)).toBe(true)
})

test('mapped architecture selections auto-open the sequence panel at a readable size', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'aea-architecture-ui',
      JSON.stringify({
        state: {
          ui: {
            panelBVisible: false,
            panelBSize: 6,
          },
          projection: {},
        },
        version: 0,
      }),
    )
  })
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/?edge=F_VoR_ACK')

  const sequencePanel = page.getByTestId('sequence')
  await expect(sequencePanel).toBeVisible()
  expect(await boxHeight(sequencePanel)).toBeGreaterThan(200)
  await expect(sequencePanel.getByRole('button', { name: /PB_ACK/ })).toBeVisible()
  await expect(sequencePanel.locator('.sequence-panel__header')).toHaveClass(/sequence-panel__header--active/)
  await expect(page.getByRole('button', { name: 'Hide VoR sequence' })).toBeVisible()
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

test('detail nodes expose claim dots and reveal claim ids on hover', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/?node=S2')

  const node = page.locator('.node-card[data-node-id="S2"]')
  const firstClaim = node.locator('.node-card__claim-dot').first()

  await expect(node).toHaveAttribute('data-node-density', 'detail')
  await expect(node.locator('.node-card__claim-dot')).toHaveCount(3)
  await expect(firstClaim.locator('.node-card__claim-dot-label')).toHaveCSS('opacity', '0')

  await firstClaim.hover()
  await expect(firstClaim.locator('.node-card__claim-dot-label')).toHaveCSS('opacity', '1')
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
    backgroundColor: hexToRgbString('#EFF6FF'),
    borderColor: hexToRgbString('#BFDBFE'),
  })
  expect(await nodeSurfaceStyles(page, 'DEC_G0')).toEqual({
    backgroundColor: hexToRgbString('#EFF6FF'),
    borderColor: hexToRgbString('#BFDBFE'),
  })
  expect(await nodeSurfaceStyles(page, 'DEC_M1')).toEqual({
    backgroundColor: hexToRgbString('#EFF6FF'),
    borderColor: hexToRgbString('#BFDBFE'),
  })
  expect(await nodeSurfaceStyles(page, 'LANE_A')).toEqual({
    backgroundColor: hexToRgbString('#FFF7ED'),
    borderColor: hexToRgbString('#FED7AA'),
  })
  expect(await nodeSurfaceStyles(page, 'BAND_SENSE')).toEqual({
    backgroundColor: hexToRgbString('#EFF6FF'),
    borderColor: hexToRgbString('#BFDBFE'),
  })
  expect(await nodeSurfaceStyles(page, 'BAND_DECIDE')).toEqual({
    backgroundColor: hexToRgbString('#EFF6FF'),
    borderColor: hexToRgbString('#BFDBFE'),
  })
  expect(await nodeSurfaceStyles(page, 'BAND_ACT')).toEqual({
    backgroundColor: hexToRgbString('#EFF6FF'),
    borderColor: hexToRgbString('#BFDBFE'),
  })
  await expect(computedStyleValue(page.locator('.node-card[data-node-id="BAND_SENSE"]'), '--node-band-accent')).resolves.toContain(
    '#2B7BE9',
  )
  await expect(
    computedStyleValue(page.locator('.node-card[data-node-id="BAND_DECIDE"]'), '--node-band-accent'),
  ).resolves.toContain('#6D5CE7')
  await expect(computedStyleValue(page.locator('.node-card[data-node-id="BAND_ACT"]'), '--node-band-accent')).resolves.toContain(
    '#F59E0B',
  )

  const humanGate = page.locator('.node-card[data-node-id="DEC_H1"]')
  await expect(computedStyleValue(humanGate, '--node-accent')).resolves.toContain('#b45309')
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

  expect(accentBox?.height ?? 0).toBeGreaterThan(10)
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

test('shared t0 edges expose a linked focus cue during inspection', async ({ page }) => {
  await page.goto('/?edge=F3d')
  await ensureEdgeLabelMode(page, 'F3d', 'chip', 'zoom-in')
  await ensureEdgeLabelMode(page, 'F3h', 'chip', 'zoom-in')

  for (const edgeId of ['F3d', 'F3h']) {
    const edge = page.locator(`.semantic-edge[data-edge-id="${edgeId}"]`)
    const label = page.locator(`.edge-label[data-edge-id="${edgeId}"]`)

    await expect(edge).toHaveAttribute('data-edge-tag-t0', 'true')
    await expect(edge).toHaveAttribute('data-edge-shared-tag-focus', 'true')
    await expect(label).toHaveAttribute('data-edge-shared-tag-focus', 'true')
    await expect(label.locator('[data-edge-tag="t0"]')).toHaveText('T0')
  }

  await expect(page.locator('.semantic-edge[data-edge-id="F3g"]')).toHaveAttribute('data-edge-shared-tag-focus', 'false')
})

test('selecting an already visible node does not refit the architecture viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')
  await page.waitForTimeout(450)

  const targetNodeId = await page.evaluate(() => {
    const canvas = document.querySelector('.architecture-canvas')
    if (!(canvas instanceof HTMLElement)) {
      return null
    }

    const canvasBox = canvas.getBoundingClientRect()
    const paddingX = canvasBox.width * 0.12
    const paddingY = canvasBox.height * 0.12
    const comfortableBounds = {
      left: canvasBox.left + paddingX,
      top: canvasBox.top + paddingY,
      right: canvasBox.right - paddingX,
      bottom: canvasBox.bottom - paddingY,
    }

    for (const nodeId of ['VOI', 'ACT1', 'S2', 'A3', 'G3', 'DEC_R2', 'DEC_G1', 'DEC_G2']) {
      const node = document.querySelector(`.node-card[data-node-id="${nodeId}"]`)
      if (!(node instanceof HTMLElement)) {
        continue
      }

      const box = node.getBoundingClientRect()
      if (
        box.left >= comfortableBounds.left &&
        box.top >= comfortableBounds.top &&
        box.right <= comfortableBounds.right &&
        box.bottom <= comfortableBounds.bottom
      ) {
        return nodeId
      }
    }

    return null
  })

  expect(targetNodeId).not.toBeNull()

  const before = await viewportTransform(page)

  await page.locator(`.node-card[data-node-id="${targetNodeId}"]`).click()
  await page.waitForTimeout(420)

  await expect(page.locator(`.node-card[data-node-id="${targetNodeId}"]`)).toHaveClass(/is-selected/)
  expect(await viewportTransform(page)).toBe(before)
})

test('node action menu is keyboard reachable and behaves like a menu button', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/?node=ACT1')

  const node = page.locator('.node-card[data-node-id="ACT1"]')
  const menuButton = node.locator('.node-card__menu-trigger')
  const menu = node.getByRole('menu')
  const focusItem = node.getByRole('menuitem', { name: 'Focus' })
  const upstreamItem = node.getByRole('menuitem', { name: 'Show upstream' })

  await expect(node).toBeVisible()
  await expect(menuButton).toBeVisible()
  await menuButton.focus()
  await expect(menuButton).toBeFocused()
  await assertFocusVisible(menuButton)

  await page.keyboard.press('Enter')
  await expect(node).toHaveClass(/is-selected/)
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true')
  await expect(menu).toBeVisible()
  await expect(focusItem).toBeFocused()

  await page.keyboard.press('ArrowDown')
  await expect(upstreamItem).toBeFocused()

  await page.keyboard.press('ArrowUp')
  await expect(focusItem).toBeFocused()

  await page.keyboard.press('ArrowUp')
  await expect(menu.getByRole('menuitem').last()).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(menuButton).toBeFocused()

  await menuButton.click()
  await expect(menu).toBeVisible()
  await node.getByRole('menuitem', { name: 'Show upstream' }).click()
  await expect(menu).toHaveCount(0)
})

test('write-corridor routes stay orthogonal and labels avoid nearby nodes', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/?edge=F_VoR_ACK')
  await page.keyboard.press('Escape')
  await ensureEdgeLabelMode(page, 'F5', 'chip', 'zoom-in')
  await ensureEdgeLabelMode(page, 'F6', 'chip', 'zoom-in')
  await ensureEdgeLabelMode(page, 'F_VoR_ACK', 'chip', 'zoom-in')

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
  await page.getByRole('button', { name: 'Expand legend' }).click()
  await page.mouse.move(0, 0)
  await expect(page.locator('.workspace__panels')).toHaveScreenshot('desktop-board-with-legend.png')
})

test('visual regression: selected sequence feedback states', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/?edge=F_VoR_ACK')
  await page.mouse.move(0, 0)
  await expect(page.getByTestId('sequence')).toHaveScreenshot('sequence-feedback-selected.png')
})

test('visual regression: compact-node summary state', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')
  await ensureNodeRenderMode(page, 'S2', 'icon', 'zoom-out')
  await page.mouse.move(0, 0)
  await expect(page.locator('.architecture-canvas')).toHaveScreenshot('compact-node-summary.png')
})

test('visual regression: open-marker readability and legend swatches', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Expand legend' }).click()
  await page.mouse.move(0, 0)
  await expect(page.locator('.architecture-canvas')).toHaveScreenshot('open-marker-readability.png')
})

test('visual regression: analysis theme', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Analysis theme' }).click()
  await page.mouse.move(0, 0)
  await expect(page.locator('.workspace')).toHaveScreenshot('analysis-theme.png')
})
