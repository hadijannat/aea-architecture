import { expect, test, type Locator, type Page } from '@playwright/test'

const uiStorageKey = 'aea-architecture-ui-v2'

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

async function openExplore(page: Page) {
  const drawer = page.locator('.explore-drawer')
  if ((await drawer.count()) === 0) {
    await page.getByRole('button', { name: /^Explore/ }).click()
  }
  await expect(drawer).toBeVisible()
  return drawer
}

async function openExportMenu(page: Page) {
  const exportButton = page.getByRole('button', { name: 'Export' })
  await exportButton.click()
  await expect(page.locator('.command-menu--export')).toBeVisible()
  return page.locator('.command-menu--export')
}

async function openInspectorDisclosure(page: Page) {
  const disclosure = page.locator('.inspector-disclosure')
  const summary = disclosure.locator('summary')
  if (!(await disclosure.evaluate((element) => element instanceof HTMLDetailsElement && element.open))) {
    await summary.click()
  }
  await expect(disclosure).toHaveAttribute('open', '')
  return disclosure
}

async function openSequenceFromTeaser(page: Page) {
  const teaserButton = page.getByRole('button', { name: /Open (linked )?sequence/ })
  if ((await teaserButton.count()) > 0) {
    await teaserButton.click()
  }
  await expect(page.locator('.sequence-panel')).toBeVisible()
}

function zoomControl(page: Page, action: 'zoom-in' | 'zoom-out') {
  return page
    .locator('.architecture-canvas')
    .getByRole('button', { name: action === 'zoom-in' ? /zoom in/i : /zoom out/i })
}

async function clickZoomControlIfAvailable(page: Page, action: 'zoom-in' | 'zoom-out') {
  const control = zoomControl(page, action)
  if ((await control.count()) === 0 || await control.isDisabled()) {
    return false
  }

  await control.click()
  await page.waitForTimeout(160)
  return true
}

async function hoverArchitectureEdge(page: Page, edgeId: string) {
  const path = architectureMainEdgePath(page, edgeId)
  const box = await path.boundingBox()
  if (!box) {
    throw new Error(`Edge ${edgeId} is not hoverable in the current viewport`)
  }
  await page.mouse.move(box.x + Math.max(2, box.width / 2), box.y + Math.max(2, box.height / 2))
  await page.waitForTimeout(120)
}

async function selectArchitectureEdge(page: Page, edgeId: string) {
  const path = architectureMainEdgePath(page, edgeId)
  const box = await path.boundingBox()
  if (!box) {
    throw new Error(`Edge ${edgeId} is not clickable in the current viewport`)
  }
  await page.mouse.click(box.x + Math.max(2, box.width / 2), box.y + Math.max(2, box.height / 2))
  await page.waitForTimeout(120)
}

async function ensureNodeRenderMode(
  page: Page,
  nodeId: string,
  mode: 'icon' | 'navigation' | 'detail' | 'collapsed',
  action: 'zoom-in' | 'zoom-out' = 'zoom-out',
  maxClicks = 8,
) {
  const node = page.locator(`.node-card[data-node-id="${nodeId}"]`)

  for (let index = 0; index < maxClicks; index += 1) {
    if ((await node.getAttribute('data-node-density')) === mode) {
      return node
    }

    if (!(await clickZoomControlIfAvailable(page, action))) {
      break
    }
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

  for (let index = 0; index < maxClicks; index += 1) {
    let currentMode = await getArchitectureEdgeLabelMode(page, edgeId)
    if (currentMode === mode) {
      return edgeLabel
    }

    if (mode === 'hidden') {
      await page.mouse.move(8, 8)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(120)
      currentMode = await getArchitectureEdgeLabelMode(page, edgeId)
      if (currentMode === 'hidden') {
        return edgeLabel
      }
      if (!(await clickZoomControlIfAvailable(page, 'zoom-out'))) {
        break
      }
      continue
    }

    if (mode === 'chip') {
      await hoverArchitectureEdge(page, edgeId)
      currentMode = await getArchitectureEdgeLabelMode(page, edgeId)
      if (currentMode === 'chip') {
        return edgeLabel
      }
      if (currentMode === 'detail') {
        if (!(await clickZoomControlIfAvailable(page, 'zoom-out'))) {
          break
        }
        continue
      }
      if (!(await clickZoomControlIfAvailable(page, action))) {
        await selectArchitectureEdge(page, edgeId)
        currentMode = await getArchitectureEdgeLabelMode(page, edgeId)
        if (currentMode === 'chip') {
          return edgeLabel
        }
        break
      }
      continue
    }

    if (currentMode === 'hidden') {
      if (await clickZoomControlIfAvailable(page, 'zoom-in')) {
        continue
      }
      await selectArchitectureEdge(page, edgeId)
      currentMode = await getArchitectureEdgeLabelMode(page, edgeId)
      if (currentMode === 'detail') {
        return edgeLabel
      }
      if (currentMode === 'chip' && await clickZoomControlIfAvailable(page, 'zoom-in')) {
        continue
      }
      break
    }

    if (currentMode === 'chip' && await clickZoomControlIfAvailable(page, 'zoom-in')) {
      continue
    }

    await selectArchitectureEdge(page, edgeId)
    currentMode = await getArchitectureEdgeLabelMode(page, edgeId)
    if (currentMode === 'detail') {
      return edgeLabel
    }
  }

  throw new Error(`Edge ${edgeId} did not enter ${mode} label mode`)
}

function architectureMainEdgePath(page: Page, edgeId: string) {
  return page.locator(`.semantic-edge[data-edge-id="${edgeId}"] .react-flow__edge-path`).last()
}

async function viewportTransform(page: Page) {
  return page.locator('.react-flow__viewport').evaluate((element) => getComputedStyle(element).transform)
}

function parseViewportMatrix(transform: string) {
  const match = /matrix\(([^)]+)\)/.exec(transform)
  if (!match) {
    return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
  }

  const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = match[1]
    .split(',')
    .map((value) => Number.parseFloat(value.trim()))

  return { a, b, c, d, e, f }
}

async function boxHeight(locator: Locator) {
  return locator.evaluate((element) => element.getBoundingClientRect().height)
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
  return page.evaluate((storageKey) => {
    const stored = window.localStorage.getItem(storageKey)
    if (!stored) {
      return []
    }
    const parsed = JSON.parse(stored)
    return parsed.state?.projection?.expandedNoteIds ?? []
  }, uiStorageKey)
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

function boxContains(
  parent: { x: number; y: number; width: number; height: number },
  child: { x: number; y: number; width: number; height: number },
  tolerance = 4,
) {
  return (
    child.x >= parent.x - tolerance &&
    child.y >= parent.y - tolerance &&
    child.x + child.width <= parent.x + parent.width + tolerance &&
    child.y + child.height <= parent.y + parent.height + tolerance
  )
}

async function screenRect(locator: Locator) {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      return null
    }

    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    }
  })
}

async function writeCorridorScreenBox(page: Page) {
  const matrix = parseViewportMatrix(await viewportTransform(page))
  const rendererBox = await screenRect(page.locator('.architecture-canvas .react-flow__renderer'))
  const pointSets = await Promise.all(
    ['F5', 'F6', 'F_VoR_ACK'].map((edgeId) =>
      page.locator(`.semantic-edge[data-edge-id="${edgeId}"]`).getAttribute('data-edge-points'),
    ),
  )

  const points = pointSets.flatMap((serializedPoints) =>
    (serializedPoints ?? '')
      .split(' ')
      .map((pair) => pair.split(',').map((value) => Number.parseFloat(value)))
      .filter((pair): pair is [number, number] => pair.length === 2 && pair.every((value) => Number.isFinite(value)))
      .map(([x, y]) => ({
        x: (rendererBox?.x ?? 0) + matrix.a * x + matrix.c * y + matrix.e,
        y: (rendererBox?.y ?? 0) + matrix.b * x + matrix.d * y + matrix.f,
      })),
  )

  if (points.length === 0) {
    return null
  }

  const left = Math.min(...points.map((point) => point.x))
  const top = Math.min(...points.map((point) => point.y))
  const right = Math.max(...points.map((point) => point.x))
  const bottom = Math.max(...points.map((point) => point.y))

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  }
}

test('selecting F5 highlights the VoR sequence and inspector', async ({ page }) => {
  await page.goto('/?edge=F5')
  await expect(page.getByRole('heading', { name: 'F5' })).toBeVisible()
  await expect(page.locator('.sequence-step.is-highlighted')).toHaveCount(5)
})

test('filtering by C4 keeps the write path visible', async ({ page }) => {
  await page.goto('/')
  const explore = await openExplore(page)
  await explore.getByRole('button', { name: 'C4: Actuation is exclusive to the VoR path' }).click()
  await expect(page.locator('.semantic-edge[data-edge-id="F5"]')).toHaveCount(1)
  await expect(page.locator('.sequence-teaser')).toContainText('Open sequence')
  await expect(page.locator('.filter-summary')).toContainText('1 claim')
})

test('search results can jump directly to a sequence step', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('searchbox', { name: 'Search nodes, edges, standards, and claims' }).fill('PB3')
  await page.getByRole('button', { name: 'Step result PB3' }).click()
  await expect(page.getByRole('heading', { name: 'PB3' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'VoR sequence' })).toBeVisible()
})

test('first viewport reads as a hero composition with collapsed sequence and command bar utilities', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'AEA Architecture' })).toBeVisible()
  await expect(page.locator('.command-bar')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Explore' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Export' })).toBeVisible()
  await expect(page.locator('.sequence-teaser')).toBeVisible()
  await expect(page.locator('.sequence-teaser')).toContainText('Open sequence')
  await expect(page.locator('.workspace__sequence-stack')).toHaveCount(0)
  await expect(page.locator('.app-hero')).toBeVisible()
})

test('selecting F_VoR_ACK highlights the Panel B acknowledgement with its action label', async ({ page }) => {
  await page.goto('/?edge=F_VoR_ACK')
  await expect(page.getByRole('heading', { name: 'F_VoR_ACK' })).toBeVisible()
  await expect(page.getByRole('button', { name: /PB_ACK/ })).toBeVisible()
  await expect(page.locator('.sequence-edge-label.is-highlighted')).toContainText('ACK signal')
})

test('edge controls expose semantic accessible names', async ({ page }) => {
  await page.goto('/?edge=F5')
  await expect(await ensureEdgeLabelMode(page, 'F5', 'detail', 'zoom-in')).toHaveAccessibleName(
    /^F5: writeback edge from/,
  )
  await page.goto('/?edge=F_VoR_ACK')
  await expect(await ensureEdgeLabelMode(page, 'F_VoR_ACK', 'detail', 'zoom-in')).toHaveAccessibleName(
    /^F_VoR_ACK: status-ack edge from/,
  )
})

test('export controls use viewport and publication labels', async ({ page }) => {
  await page.goto('/')
  const exportMenu = await openExportMenu(page)
  await expect(exportMenu.getByRole('button', { name: 'SVG viewport' })).toBeVisible()
  await expect(exportMenu.getByRole('button', { name: 'SVG publication' })).toBeVisible()
  await expect(exportMenu.getByRole('button', { name: 'PDF viewport' })).toBeVisible()
  await expect(exportMenu.getByRole('button', { name: 'PDF publication' })).toBeVisible()
  await expect(exportMenu.getByRole('button', { name: 'Mermaid topology (architecture)' })).toBeVisible()
  await expect(exportMenu.getByRole('button', { name: 'Mermaid topology (sequence)' })).toBeVisible()
})

test('keyboard navigation exposes focus-visible states across Panel B controls', async ({ page }) => {
  await page.goto('/')
  await openSequenceFromTeaser(page)

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

test('default hero viewport keeps Panel A dominant and Panel B collapsed by default', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'AEA Architecture' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Explore' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Export' })).toBeVisible()
  await expect(page.locator('.sequence-teaser')).toBeVisible()
  await expect(page.locator('.sequence-teaser')).toContainText('Open sequence')
  await expect(page.locator('.workspace__sequence-stack')).toHaveCount(0)
  await expect(page.locator('.app-hero')).toBeVisible()
  await expect(page.locator('.architecture-canvas')).toBeVisible()
  await expect(page.locator('.node-card[data-node-id="VOI"]')).toBeVisible()
  await expect(page.locator('.node-card[data-node-id="ACT1"]')).toBeVisible()
})

test('feedback sequence edges use distinct styling for acknowledgement and rejection', async ({ page }) => {
  await page.goto('/')
  await openSequenceFromTeaser(page)

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

test('architecture edge labels stay hidden at rest and retain ids in detail mode', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')
  await page.waitForTimeout(700)

  await ensureEdgeLabelMode(page, 'F_GW2', 'hidden', 'zoom-out')
  await expect(page.locator('.edge-label[data-edge-id="F_GW2"]')).toHaveCount(0)

  await page.goto('/?edge=F5')
  const detailedLabel = await ensureEdgeLabelMode(page, 'F5', 'detail', 'zoom-in')
  await expect(detailedLabel).toHaveAttribute('data-edge-label-mode', 'detail')
  await expect(detailedLabel).toContainText('F5 · Send request')
})

test('diode edges use dedicated diode markers with readable labels', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/?edge=F_GW2')
  await page.waitForTimeout(700)

  const edgeLabel = await ensureEdgeLabelMode(page, 'F_GW2', 'chip', 'zoom-out')
  await expect(edgeLabel).toHaveAttribute('data-edge-label-mode', 'chip')
  await expect(edgeLabel).toHaveText('Ingress')

  const markerEnd = await architectureMainEdgePath(page, 'F_GW2').getAttribute('marker-end')
  expect(markerEnd).toMatch(/architecture-marker-gateway-internal-diode/)
  expect(markerEnd).not.toMatch(/arrowclosed/)
  await expect(page.locator('#architecture-marker-gateway-internal-diode')).toHaveAttribute('markerUnits', 'userSpaceOnUse')
  await expect(page.locator('#architecture-marker-gateway-internal-diode')).toHaveAttribute('markerWidth', '12')
  await expect(page.locator('#architecture-marker-gateway-internal-diode')).toHaveAttribute('markerHeight', '10')
  await expect(page.locator('#architecture-marker-gateway-internal-diode path')).toHaveAttribute(
    'd',
    'M 1 1 L 7 4 L 1 7 z M 7.5 1 L 7.5 7',
  )
  await expect(page.locator('#architecture-marker-writeback-arrowclosed path')).toHaveAttribute('d', 'M 0 0 L 10 4 L 0 8 z')

  // F_GW2 must route vertically (bottom→top), not horizontally (right→left).
  // A vertical path shares the same canvas x at start and end; a horizontal path does not.
  const edgePath = await architectureMainEdgePath(page, 'F_GW2').getAttribute('d')
  expect(edgePath).not.toBeNull()
  const xCoords = [...edgePath!.matchAll(/([\d.]+)\s+([\d.]+)/g)].map((m) => parseFloat(m[1]))
  expect(xCoords.length).toBeGreaterThanOrEqual(2)
  expect(Math.abs(xCoords[0] - xCoords[xCoords.length - 1])).toBeLessThan(5)
})

test('gateway labels stay clear of the gateway stack in a gateway-focused view', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/?edge=F_GW2')
  await page.waitForTimeout(500)
  await ensureEdgeLabelMode(page, 'F_GW2', 'chip', 'zoom-out')

  for (const edgeId of ['F_GW1', 'F_GW2', 'F_GW3']) {
    await expect(page.locator(`.edge-label[data-edge-id="${edgeId}"]`)).toHaveAttribute('data-edge-label-mode', 'chip')
  }

  const [gw1LabelBox, gw2LabelBox, gw3LabelBox] = await Promise.all([
    page.locator('.edge-label[data-edge-id="F_GW1"]').boundingBox(),
    page.locator('.edge-label[data-edge-id="F_GW2"]').boundingBox(),
    page.locator('.edge-label[data-edge-id="F_GW3"]').boundingBox(),
  ])

  const gatewayNodeBoxes = await Promise.all(
    ['G1', 'G2', 'G3'].map((nodeId) => page.locator(`.node-card[data-node-id="${nodeId}"]`).boundingBox()),
  )

  expect(gw1LabelBox).not.toBeNull()
  expect(gw2LabelBox).not.toBeNull()
  expect(gw3LabelBox).not.toBeNull()
  expect(gatewayNodeBoxes.every((box) => box !== null)).toBe(true)

  expect(boxesOverlap(gw1LabelBox!, gatewayNodeBoxes[0]!, 4)).toBe(false)
  expect(gw1LabelBox!.x + gw1LabelBox!.width).toBeLessThan(gatewayNodeBoxes[0]!.x)

  for (const labelBox of [gw2LabelBox!, gw3LabelBox!]) {
    for (const nodeBox of gatewayNodeBoxes) {
      expect(boxesOverlap(labelBox, nodeBox!, 4)).toBe(false)
    }
  }
})

test('F3e and F3g display labels stay separated at the desktop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/?edge=F3e')
  await page.waitForTimeout(700)

  const f3eLabel = await ensureEdgeLabelMode(page, 'F3e', 'detail', 'zoom-in')
  const f3gLabel = page.locator('.edge-label[data-edge-id="F3g"]')

  await expect(f3eLabel).toHaveAttribute('data-edge-label-mode', 'detail')
  await expect(f3gLabel).toHaveAttribute('data-edge-label-mode', /chip|detail/)

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

  const explore = await openExplore(page)

  const laneA = explore.getByRole('button', { name: 'Lane A: CPC / external systems' })
  await expect(laneA).toHaveAttribute('aria-pressed', 'false')
  await expect(laneA).toContainText('CPC')
  await laneA.click()
  await expect(laneA).toHaveAttribute('aria-pressed', 'true')
  await expect(explore.getByRole('button', { name: 'Lane B: AEA / gateway / decisioning' })).toContainText('psM+O')
  await expect(explore.getByRole('button', { name: 'Lane C: central analytics / historian' })).toContainText(
    'Central M+O',
  )
  await expect(explore.getByRole('button', { name: 'Show VoR sequence' })).toBeVisible()
  await expect(explore.getByRole('button', { name: 'Write corridor focus' })).toBeVisible()
  await expect(explore.getByText('Figure metadata')).toBeVisible()
  await expect(page.locator('.filter-summary')).toContainText('1 lane')

  const claimC4 = explore.getByRole('button', { name: 'C4: Actuation is exclusive to the VoR path' })
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
  const explore = await openExplore(page)

  const writePreset = explore.getByRole('button', { name: 'Write corridor focus' })
  const overviewPreset = explore.getByRole('button', { name: 'All paths' })
  const policyPreset = explore.getByRole('button', { name: 'Policy' }).first()
  const telemetryPreset = explore.getByRole('button', { name: 'Telemetry' }).first()

  await expect(writePreset).toContainText('Write corridor')
  const writeHeight = (await writePreset.boundingBox())?.height ?? 0
  const overviewHeight = (await overviewPreset.boundingBox())?.height ?? 0
  const policyHeight = (await policyPreset.boundingBox())?.height ?? 0
  const telemetryHeight = (await telemetryPreset.boundingBox())?.height ?? 0

  expect(writeHeight).toBeGreaterThan(0)
  expect(Math.abs(writeHeight - overviewHeight)).toBeLessThanOrEqual(2)
  expect(Math.abs(policyHeight - overviewHeight)).toBeLessThanOrEqual(2)
  expect(Math.abs(telemetryHeight - overviewHeight)).toBeLessThanOrEqual(2)
})

test('reduce motion toggle disables animated writeback and tool-call edges', async ({ page }) => {
  await page.goto('/')

  const explore = await openExplore(page)
  const reduceMotion = explore.getByRole('button', { name: 'Reduce motion' })
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
  const explore = await openExplore(page)
  await expect(explore.getByRole('button', { name: 'Reduce motion' })).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(() => architectureEdgeIsAnimated(page, 'F5')).toBe(false)
  await expect.poll(() => architectureEdgeIsAnimated(page, 'F_T1')).toBe(false)
  await expect.poll(() => architectureEdgeIsAnimated(page, 'F_T2')).toBe(false)
})

test('optional architecture edges only reduce emphasis while resting', async ({ page }) => {
  await page.goto('/')

  const restingEdge = page.locator('.semantic-edge[data-edge-id="F7_sub"]')
  await expect(page.locator('.edge-label[data-edge-id="F7_sub"]')).toHaveCount(0)

  await expect(restingEdge).toHaveAttribute('data-edge-optional', 'true')
  expect(await computedStyleValue(restingEdge, 'opacity')).toBe('0.46')

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
  await expect(edge).toHaveClass(/is-dimmed/)
  expect(await computedStyleValue(edge, 'opacity')).toBe('0.46')

  await expect(edge).toHaveAttribute('data-edge-optional', 'true')

  await page.goto('/?edge=F7_sub')
  const label = await ensureEdgeLabelMode(page, 'F7_sub', 'detail', 'zoom-in')
  await expect(label).toHaveAttribute('data-edge-optional', 'true')
  await expect(label).toContainText('(optional)')
  expect(await computedStyleValue(label, 'opacity')).toBe('1')
})

test('telemetry labels and paths fade together at rest and restore when selected', async ({ page }) => {
  await page.goto('/')

  const restingEdge = page.locator('.semantic-edge[data-edge-id="F_AUDIT"]')
  await expect(page.locator('.edge-label[data-edge-id="F_AUDIT"]')).toHaveCount(0)

  expect(await computedStyleValue(restingEdge, 'opacity')).toBe('0.62')

  await page.goto('/?edge=F_AUDIT')

  const selectedEdge = page.locator('.semantic-edge[data-edge-id="F_AUDIT"]')
  const selectedLabel = await ensureEdgeLabelMode(page, 'F_AUDIT', 'detail', 'zoom-in')

  expect(await computedStyleValue(selectedEdge, 'opacity')).toBe('1')
  expect(await computedStyleValue(selectedLabel, 'opacity')).toBe('1')
})

test('highlighted non-writeback paths receive a visible glow', async ({ page }) => {
  await page.goto('/?edge=F1')

  const highlightedPath = architectureMainEdgePath(page, 'F1')
  expect(await computedStyleValue(highlightedPath, 'filter')).not.toBe('none')
})

test('architecture marker defs stay fixed-size and the write ribbon follows zoom visibility', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')

  await expect(page.locator('#architecture-marker-writeback-arrowclosed')).toHaveAttribute('markerUnits', 'userSpaceOnUse')
  await expect(page.locator('#architecture-marker-writeback-arrowclosed')).toHaveAttribute('markerWidth', '12')
  await expect(page.locator('#architecture-marker-writeback-arrowclosed')).toHaveAttribute('markerHeight', '10')
  await expect(page.locator('#architecture-marker-writeback-arrowclosed')).toHaveAttribute('refY', '4')
  const explore = await openExplore(page)
  const writePreset = explore.getByRole('button', { name: 'Write corridor focus' })
  await writePreset.click()

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

test('write ribbon stays attached to the live corridor after preset focus and zoom changes', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')

  const ribbon = page.locator('[data-write-ribbon]')
  const explore = await openExplore(page)
  await explore.getByRole('button', { name: 'Write corridor focus' }).click()
  await expect(ribbon).toHaveAttribute('data-write-ribbon-visible', 'true')

  for (let index = 0; index < 3; index += 1) {
    const corridorBox = await writeCorridorScreenBox(page)
    const ribbonBox = await screenRect(ribbon)

    expect(corridorBox).not.toBeNull()
    expect(ribbonBox).not.toBeNull()
    expect(Math.abs((ribbonBox!.x + ribbonBox!.width / 2) - (corridorBox!.x + corridorBox!.width / 2))).toBeLessThanOrEqual(200)
    expect(Math.abs(ribbonBox!.y - (corridorBox!.y + corridorBox!.height + 18))).toBeLessThanOrEqual(200)

    const zoomButton = page.locator(
      index % 2 === 0
        ? '.architecture-canvas .react-flow__controls-zoomin:not([disabled])'
        : '.architecture-canvas .react-flow__controls-zoomout:not([disabled])',
    )
    await zoomButton.click()
    await page.waitForTimeout(180)
  }
})

test('page scroll can reach the sequence while the write focus still allows canvas zoom', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')

  const beforeScroll = await page.evaluate(() => window.scrollY)
  await page.locator('.architecture-canvas').hover()
  await page.mouse.wheel(0, 900)
  await page.waitForTimeout(220)
  const afterScroll = await page.evaluate(() => window.scrollY)

  expect(afterScroll).toBeGreaterThan(beforeScroll)

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  const explore = await openExplore(page)
  await explore.getByRole('button', { name: 'Write corridor focus' }).click()
  await page.getByRole('button', { name: /^Explore/ }).click()
  await expect(page.locator('.explore-drawer')).toHaveCount(0)
  const ribbon = page.locator('[data-write-ribbon]')
  await expect(ribbon).toHaveAttribute('data-write-ribbon-visible', 'true')
  const ribbonBox = await ribbon.boundingBox()
  expect(ribbonBox).not.toBeNull()

  const before = await viewportTransform(page)
  await page.locator('.architecture-canvas .react-flow__controls-zoomin:not([disabled])').click()
  await page.waitForTimeout(220)
  const after = await viewportTransform(page)

  expect(after).not.toBe(before)
})

test('narrow desktop viewports stack the sequence beneath the canvas when the panel is open', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'aea-architecture-ui-v2',
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
  await page.setViewportSize({ width: 900, height: 760 })
  await page.goto('/')

  const sequencePanel = page.locator('.sequence-panel')
  await expect(sequencePanel).toBeVisible()
  await expect(sequencePanel.getByRole('heading', { name: 'VoR sequence' })).toBeVisible()
  await expect(page.locator('.workspace__sequence-stack')).toBeVisible()
  await expect(sequencePanel).toHaveClass(/sequence-panel--stacked/)
  await expect(page.locator('.workspace__panels')).toBeVisible()
  await expect(page.locator('.workspace__panels .architecture-canvas')).toBeVisible()
})

test('mobile-ish composition keeps the command bar and stacked sequence reachable', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 960 })
  await page.goto('/?edge=F_VoR_ACK')

  await expect(page.getByRole('button', { name: 'Explore' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Export' })).toBeVisible()
  await expect(page.locator('.workspace__sequence-stack')).toBeVisible()
  await expect(page.locator('.sequence-panel')).toBeVisible()
  await expect(page.locator('.sequence-panel')).toBeVisible()
})

test('mapped architecture selections auto-open the sequence panel at a readable size', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'aea-architecture-ui-v2',
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
  await expect(page.locator('.sequence-teaser')).toHaveCount(0)
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
  const explore = await openExplore(page)
  await explore.getByRole('button', { name: 'Analysis theme' }).click()
  await expect(page.locator('.app-shell')).toHaveClass(/app-shell--theme-analysis/)

  await page.reload()
  await openExplore(page)
  await expect(page.locator('.app-shell')).toHaveClass(/app-shell--theme-analysis/)
})

test('sequence background and ribbon label follow the active theme', async ({ page }) => {
  await page.goto('/')
  await openSequenceFromTeaser(page)

  const sequenceBackground = page.locator('[data-sequence-background]')
  await expect(page.getByTestId('sequence').getByText('VoR boundary')).toBeVisible()
  const defaultFill = await sequenceBackground.evaluate((element) => getComputedStyle(element).fill)
  expect(defaultFill).toBe('rgb(250, 251, 255)')

  const explore = await openExplore(page)
  await explore.getByRole('button', { name: 'Analysis theme' }).click()
  await expect(page.locator('.app-shell')).toHaveClass(/app-shell--theme-analysis/)
  await expect
    .poll(() => sequenceBackground.evaluate((element) => getComputedStyle(element).fill))
    .not.toBe(defaultFill)
})

test('notes control toggles the expanded note set', async ({ page }) => {
  await page.goto('/')
  const explore = await openExplore(page)
  await explore.locator('summary', { hasText: 'Author tools' }).click()

  const notesToggle = explore.getByRole('button', { name: 'Expand all notes' })
  await expect(notesToggle).toHaveAttribute('aria-pressed', 'false')
  await notesToggle.click()
  const collapseToggle = explore.getByRole('button', { name: 'Collapse all notes' })
  await expect(collapseToggle).toHaveAttribute('aria-pressed', 'true')
  await expect(await expandedNoteIds(page)).not.toHaveLength(0)

  await collapseToggle.click()
  await expect(explore.getByRole('button', { name: 'Expand all notes' })).toHaveAttribute('aria-pressed', 'false')
  await expect(await expandedNoteIds(page)).toHaveLength(0)
})

test('projection snapshots reveal the composer only when saving is requested', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByLabel('Snapshot name')).toHaveCount(0)
  await openInspectorDisclosure(page)
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
    const raw = window.localStorage.getItem('aea-architecture-ui-v2')
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
    window.localStorage.setItem('aea-architecture-ui-v2', value)
  }, persisted)

  await page.reload()

  await expect.poll(() => page.locator('[data-overview-region-id="lane-a"]').getAttribute('x')).toBe('96')
  await expect.poll(() => page.locator('[data-overview-region-id="lane-a"]').getAttribute('y')).toBe('72')
})

test('viewport-bound overlay tracks persisted viewport and structural overrides', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'aea-architecture-ui-v2',
      JSON.stringify({
        state: {
          ui: {
            viewport: {
              x: 140,
              y: -180,
              zoom: 0.52,
            },
          },
          projection: {
            nodePositions: {
              LANE_A: { x: 96, y: 72 },
              GW: { x: 440, y: 160 },
            },
          },
        },
        version: 0,
      }),
    )
  })
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')

  const laneStrip = page.locator('[data-structure-lane="A"]')
  const laneNode = page.locator('.react-flow__node[data-id="LANE_A"]')
  const gatewayStrip = page.locator('.architecture-structure-overlay__gateway-column')
  const gatewayNode = page.locator('.react-flow__node[data-id="GW"]')

  const [laneStripBox, laneNodeBox, gatewayStripBox, gatewayNodeBox] = await Promise.all([
    laneStrip.boundingBox(),
    laneNode.boundingBox(),
    gatewayStrip.boundingBox(),
    gatewayNode.boundingBox(),
  ])

  expect(laneStripBox).not.toBeNull()
  expect(laneNodeBox).not.toBeNull()
  expect(gatewayStripBox).not.toBeNull()
  expect(gatewayNodeBox).not.toBeNull()

  expect(Math.abs(laneStripBox!.x - laneNodeBox!.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(laneStripBox!.y - laneNodeBox!.y)).toBeLessThanOrEqual(2)
  expect(Math.abs(laneStripBox!.width - laneNodeBox!.width)).toBeLessThanOrEqual(2)
  expect(Math.abs(laneStripBox!.height - laneNodeBox!.height)).toBeLessThanOrEqual(2)

  expect(Math.abs(gatewayStripBox!.x - gatewayNodeBox!.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(gatewayStripBox!.y - gatewayNodeBox!.y)).toBeLessThanOrEqual(2)
  expect(Math.abs(gatewayStripBox!.width - gatewayNodeBox!.width)).toBeLessThanOrEqual(2)
  expect(Math.abs(gatewayStripBox!.height - gatewayNodeBox!.height)).toBeLessThanOrEqual(2)
})

test('structural containers visually contain their representative child nodes', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')

  const relationships = [
    { parentId: 'GW', childId: 'VOI' },
    { parentId: 'AEA', childId: 'BAND_DECIDE' },
    { parentId: 'BAND_DECIDE', childId: 'DEC_H1' },
    { parentId: 'LANE_B', childId: 'AEA' },
    { parentId: 'LANE_A', childId: 'A3' },
    { parentId: 'LANE_C', childId: 'C2' },
  ] as const

  for (const { parentId, childId } of relationships) {
    const parent = page.locator(`.react-flow__node[data-id="${parentId}"]`)
    const child = page.locator(`.react-flow__node[data-id="${childId}"]`)
    const [parentBox, childBox] = await Promise.all([parent.boundingBox(), child.boundingBox()])

    expect(parentBox, `Expected ${parentId} to render`).not.toBeNull()
    expect(childBox, `Expected ${childId} to render`).not.toBeNull()
    expect(
      boxContains(parentBox!, childBox!, 4),
      `Expected ${childId} to stay within ${parentId}`,
    ).toBe(true)
  }
})

test('hover cards stay clear of the overview panel', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')

  await page.locator('.node-card[data-node-id="ACT1"]').hover()

  const hoverCardBox = await page.locator('.hover-card').boundingBox()
  const overviewBox = await page.locator('.app-hero').boundingBox()

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
  await page.goto('/?node=ACT1')
  const targetNode = page.locator('.node-card[data-node-id="ACT1"]')
  await expect(targetNode).toBeVisible()
  await expect(targetNode).toHaveClass(/is-selected/)
  await page.waitForTimeout(450)
  const before = await viewportTransform(page)
  await targetNode.click()
  await page.waitForTimeout(420)
  await expect(targetNode).toHaveClass(/is-selected/)
  expect(await viewportTransform(page)).toBe(before)
})

test('node action menu is keyboard reachable and behaves like a menu button', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/?node=ACT1')
  await ensureNodeRenderMode(page, 'ACT1', 'detail', 'zoom-in')

  const node = page.locator('.node-card[data-node-id="ACT1"]')
  const menuButton = node.locator('.node-card__menu-trigger')
  const menu = node.getByRole('menu')
  const focusItem = node.getByRole('menuitem', { name: 'Focus' })
  const upstreamItem = node.getByRole('menuitem', { name: 'Show upstream' })

  await expect(node).toBeVisible()
  await expect(menuButton).toBeVisible()
  await page.locator('body').click({ position: { x: 8, y: 8 } })
  await menuButton.focus()
  await expect(menuButton).toBeFocused()

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
  await page.goto('/?edge=F5')
  await ensureEdgeLabelMode(page, 'F5', 'detail', 'zoom-in')

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

  const visibleLabelBoxes = labelBoxes.filter((box): box is NonNullable<typeof box> => box !== null)
  expect(visibleLabelBoxes.length).toBeGreaterThanOrEqual(1)
  for (const nodeBox of nodeBoxes) {
    expect(nodeBox).not.toBeNull()
  }

  for (const labelBox of visibleLabelBoxes) {
    for (const nodeBox of nodeBoxes) {
      expect(boxesOverlap(labelBox!, nodeBox!, 6)).toBe(false)
    }
  }

  for (let index = 0; index < visibleLabelBoxes.length; index += 1) {
    for (let other = index + 1; other < visibleLabelBoxes.length; other += 1) {
      expect(boxesOverlap(visibleLabelBoxes[index]!, visibleLabelBoxes[other]!, 10)).toBe(false)
    }
  }
})

test('visual regression: desktop board with legend', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/?node=ACT1')
  await page.mouse.move(0, 0)
  await expect(page.locator('.workspace')).toHaveScreenshot('desktop-board-with-legend.png')
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
  await page.mouse.move(0, 0)
  await expect(page.locator('.architecture-canvas')).toHaveScreenshot('open-marker-readability.png')
})

test('visual regression: analysis theme', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/')
  const explore = await openExplore(page)
  await explore.getByRole('button', { name: 'Analysis theme' }).click()
  await page.mouse.move(0, 0)
  await expect(page.locator('.workspace')).toHaveScreenshot('analysis-theme.png')
})
