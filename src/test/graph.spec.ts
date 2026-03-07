import { buildSearchResults } from '@/graph/compile/searchIndex'
import {
  getSemanticFamilyStrokeDash,
  getSemanticPresentation,
  semanticFamilyOrder,
  resolveSemanticFamilies,
} from '@/graph/compile/semanticPresentation'
import { compileSequenceBoard } from '@/graph/compile/sequenceBoard'
import { buildExportSvgDocument } from '@/graph/compile/toExportSvg'
import mermaid from 'mermaid'
import { describe, expect, it } from 'vitest'

import { deriveDiagramState } from '@/graph/compile/toReactFlow'
import { toMermaid } from '@/graph/compile/toMermaid'
import { defaultProjectionOverrides, graphManifest, resolveGraphEdge, resolveGraphNode } from '@/graph/spec/manifest'
import { projectionOverridesSchema } from '@/graph/spec/schema'
import { buildBoardEdgeRoute, resolveBoardLabelPosition } from '@/layout/board'
import { validateGraphManifest } from '@/graph/spec/validators'
import { computeBoardNodePositions } from '@/layout/boardLayout'
import { resolveEdgeHandles, type HandleId } from '@/layout/ports'
import { useDiagramStore, type DiagramStore } from '@/state/diagramStore'
import { buildUiSearchParams, parseUiSearchParams } from '@/state/urlState'

async function createState(overrides?: Partial<DiagramStore['ui']>): Promise<DiagramStore> {
  const positions = await computeBoardNodePositions(graphManifest, defaultProjectionOverrides)
  return {
    graph: graphManifest,
    projection: defaultProjectionOverrides,
    layout: {
      ready: true,
      running: false,
      positions,
    },
    ui: {
      mode: 'explore',
      filters: {
        claims: [],
        standards: [],
        semanticFamilies: [],
        lanes: [],
        search: '',
        pathPreset: 'all',
      },
      highlightedEntityKeys: [],
      viewport: graphManifest.layoutDefaults.viewport,
      panelBVisible: true,
      panelBSize: 24,
      viewportLocked: false,
      reduceMotion: false,
      systemReduceMotion: false,
      ...overrides,
    },
    actions: {} as DiagramStore['actions'],
  }
}

function anchorPoint(
  state: DiagramStore,
  nodeId: string,
  handleId: HandleId,
) {
  const node = resolveGraphNode(nodeId)
  const position = state.layout.positions[nodeId]

  if (!node || !position) {
    throw new Error(`Missing anchor state for ${nodeId}`)
  }

  switch (handleId) {
    case 'left':
      return { x: position.x, y: position.y + node.height / 2 }
    case 'right':
      return { x: position.x + node.width, y: position.y + node.height / 2 }
    case 'top':
      return { x: position.x + node.width / 2, y: position.y }
    case 'bottom':
      return { x: position.x + node.width / 2, y: position.y + node.height }
  }
}

function buildArchitectureRoute(state: DiagramStore, edgeId: string) {
  const edge = resolveGraphEdge(edgeId)
  if (!edge) {
    throw new Error(`Missing edge ${edgeId}`)
  }

  const handles = resolveEdgeHandles(edge, state.projection.edgeHandles)
  return buildBoardEdgeRoute(
    edge,
    anchorPoint(state, edge.source, handles.sourceHandle),
    anchorPoint(state, edge.target, handles.targetHandle),
  )
}

function routeIsAxisAligned(points: Array<{ x: number; y: number }>) {
  return points.every((point, index) => {
    if (index === 0) {
      return true
    }

    const previous = points[index - 1]
    return previous.x === point.x || previous.y === point.y
  })
}

function nodeBounds(state: DiagramStore, nodeId: string) {
  const node = resolveGraphNode(nodeId)
  const position = state.layout.positions[nodeId]

  if (!node || !position) {
    throw new Error(`Missing bounds for ${nodeId}`)
  }

  return {
    left: position.x,
    top: position.y,
    right: position.x + node.width,
    bottom: position.y + node.height,
  }
}

function containsPoint(bounds: ReturnType<typeof nodeBounds>, point: { x: number; y: number }) {
  return point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom
}

describe('graph manifest', () => {
  it('passes integrity and semantic validation', () => {
    const issues = validateGraphManifest(graphManifest)
    expect(issues).toEqual([])
  })

  it('rejects gateway node drift and broken cross-panel correspondences', () => {
    const mutated = structuredClone(graphManifest)
    const voi = mutated.nodes.find((node) => node.id === 'VOI')
    const pbAck = mutated.edges.find((edge) => edge.id === 'PB_ACK')
    const ackRule = mutated.interactionRules.find((rule) => rule.id === 'RULE_VOR_ACK')

    if (!voi || !pbAck || !ackRule) {
      throw new Error('Expected canonical VOI, PB_ACK, and RULE_VOR_ACK objects to exist')
    }

    voi.kind = 'gateway-module'
    voi.title = 'G4'
    pbAck.target = 'PB_REJECT_OUT'
    ackRule.relatedEdgeIds = ['edge:F_VoR_ACK']

    const issues = validateGraphManifest(mutated)
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'invalid-node-kind',
        'invalid-node-title',
        'invalid-edge-target',
        'invalid-interaction-edge',
      ]),
    )
  })

  it('keeps the canonical connection inventory aligned with the spec', () => {
    const expectedEdges = {
      F_GW1: { source: 'A2', target: 'G1', semantic: 'gateway-internal', style: 'medium', direction: 'ltr' },
      F_GW2: { source: 'G1', target: 'G2', semantic: 'gateway-internal', style: 'medium', direction: 'ttb' },
      F_GW3: { source: 'G2', target: 'G3', semantic: 'gateway-internal', style: 'medium', direction: 'ttb' },
      F1: { source: 'G3', target: 'S1', semantic: 'read-only', style: 'medium', direction: 'ltr' },
      F2: { source: 'S1', target: 'S2', semantic: 'normalization', style: 'thin', direction: 'ttb' },
      F3a: { source: 'DEC_K1', target: 'DEC_R1', semantic: 'retrieval', style: 'thin', direction: 'ltr' },
      F3b: { source: 'DEC_K2', target: 'DEC_R1', semantic: 'policy-soft', style: 'thin', direction: 'ltr' },
      "F3b'": { source: 'DEC_K2', target: 'DEC_G1', semantic: 'policy-hard', style: 'medium', direction: 'ltr' },
      F3c: { source: 'DEC_R1', target: 'DEC_R2', semantic: 'retrieval', style: 'medium', direction: 'ltr' },
      F3d: { source: 'S2', target: 'DEC_R2', semantic: 'retrieval', style: 'medium', direction: 'ttb' },
      F3e: { source: 'DEC_R2', target: 'DEC_G1', semantic: 'proposal', style: 'medium', direction: 'ltr' },
      F3f: { source: 'DEC_G1', target: 'DEC_G2', semantic: 'validation', style: 'medium', direction: 'ltr' },
      F3f_reject: { source: 'DEC_G1', target: 'DEC_R2', semantic: 'rejection', style: 'dashed', direction: 'rtl' },
      F3g: { source: 'DEC_K1', target: 'DEC_G2', semantic: 'validation', style: 'thin', direction: 'ltr' },
      F3h: { source: 'S2', target: 'DEC_G2', semantic: 'validation', style: 'thin', direction: 'ttb' },
      F3i: { source: 'VOI', target: 'DEC_G2', semantic: 'validation', style: 'thin', direction: 'ltr' },
      F_T1: { source: 'DEC_R2', target: 'S1', semantic: 'tool-call', style: 'dotted', direction: 'btt' },
      F_T2: { source: 'DEC_R2', target: 'DEC_K1', semantic: 'tool-call', style: 'dotted', direction: 'rtl' },
      F4: { source: 'DEC_G2', target: 'ACT1', semantic: 'validation', style: 'medium', direction: 'ttb' },
      F_KPI: { source: 'S2', target: 'ACT2', semantic: 'kpi', style: 'thin', direction: 'ttb' },
      F_AUDIT: { source: 'ACT1', target: 'ACT3', semantic: 'audit', style: 'thin', direction: 'ltr' },
      F5: { source: 'ACT1', target: 'VOI', semantic: 'writeback', style: 'bold', direction: 'rtl' },
      F6: { source: 'VOI', target: 'A3', semantic: 'writeback', style: 'medium', direction: 'ltr' },
      F_VoR_ACK: { source: 'VOI', target: 'ACT1', semantic: 'status-ack', style: 'dashed', direction: 'rtl' },
      F7a: { source: 'ACT2', target: 'C1', semantic: 'kpi', style: 'medium', direction: 'ltr' },
      F7b: { source: 'C1', target: 'C2', semantic: 'kpi', style: 'medium', direction: 'ltr' },
      F7_sub: { source: 'C2', target: 'C1', semantic: 'subscription', style: 'dotted', direction: 'rtl' },
      PB_F1: { source: 'PB1', target: 'PB2', semantic: 'sequence', style: 'medium', direction: 'ltr', displayLabel: 'Authorise' },
      PB_F2: { source: 'PB2', target: 'PB3', semantic: 'sequence', style: 'medium', direction: 'ltr', displayLabel: 'Map request' },
      PB_F3: { source: 'PB3', target: 'PB4', semantic: 'sequence', style: 'medium', direction: 'ltr', displayLabel: 'Accept request' },
      PB_F4: { source: 'PB4', target: 'PB5', semantic: 'sequence', style: 'medium', direction: 'ltr', displayLabel: 'Execute request' },
      PB_ACK: { source: 'PB5', target: 'PB_AEA', semantic: 'status-ack', style: 'dashed', direction: 'rtl', displayLabel: 'Return status' },
      PB_REJECT: { source: 'PB4', target: 'PB_REJECT_OUT', semantic: 'rejection', style: 'dashed', direction: 'ttb', displayLabel: 'Return rejection' },
    } as const

    for (const [id, expected] of Object.entries(expectedEdges)) {
      const edge = graphManifest.edges.find((candidate) => candidate.id === id)
      expect(edge, `Missing edge ${id}`).toBeDefined()
      expect(edge).toMatchObject(expected)
    }
  })

  it('keeps diode, write-back, and sequence terminals explicit', () => {
    const fGw2 = graphManifest.edges.find((edge) => edge.id === 'F_GW2')
    const fGw3 = graphManifest.edges.find((edge) => edge.id === 'F_GW3')
    const pbAck = graphManifest.edges.find((edge) => edge.id === 'PB_ACK')
    const pbReject = graphManifest.edges.find((edge) => edge.id === 'PB_REJECT')
    const pbAea = graphManifest.nodes.find((node) => node.id === 'PB_AEA')
    const rejectOut = graphManifest.nodes.find((node) => node.id === 'PB_REJECT_OUT')
    const boldEdges = graphManifest.edges.filter((edge) => edge.style === 'bold')

    expect(fGw2?.markers).toContain('diode')
    expect(fGw3?.markers).toContain('diode')
    expect(pbAck?.target).toBe('PB_AEA')
    expect(pbReject?.target).toBe('PB_REJECT_OUT')
    expect(pbAea?.panel).toContain('vor-sequence')
    expect(rejectOut?.panel).toContain('vor-sequence')
    expect(boldEdges).toHaveLength(1)
    expect(boldEdges[0]?.id).toBe('F5')
  })

  it('keeps F3i sourced from VOI and DEC_G2 aliased from DEC3', () => {
    const f3i = graphManifest.edges.find((edge) => edge.id === 'F3i')
    const validatorNode = graphManifest.nodes.find((node) => node.id === 'DEC_G2')
    expect(f3i?.source).toBe('VOI')
    expect(validatorNode?.aliases).toContain('DEC3')
  })
})

describe('derived projections', () => {
  it('maps raw semantics into the grouped semantic families', () => {
    expect(resolveSemanticFamilies(['validation', 'writeback', 'status-ack'])).toEqual(['policy', 'write', 'feedback'])
    expect(getSemanticPresentation('status-ack')).toMatchObject({
      family: 'feedback',
      label: 'Status acknowledgement',
    })
    expect(getSemanticPresentation('rejection').stroke).not.toBe(getSemanticPresentation('status-ack').stroke)
  })

  it('assigns a unique dash rhythm to each semantic family', () => {
    const dashes = semanticFamilyOrder.map((family) => getSemanticFamilyStrokeDash(family) ?? 'solid')

    expect(new Set(dashes).size).toBe(semanticFamilyOrder.length)
    expect(getSemanticPresentation('tool-call')).toMatchObject({
      marker: 'circle',
      stroke: '#0f9ba8',
    })
    expect(getSemanticPresentation('rejection')).toMatchObject({
      marker: 'tee',
      stroke: '#b91c1c',
    })
    expect(getSemanticPresentation('retrieval').stroke).toBe('#15803d')
  })

  it('filters claim C4 to the VoR path and sequence', async () => {
    const state = await createState({
      filters: {
        claims: ['C4'],
        standards: [],
        semanticFamilies: [],
        lanes: [],
        search: '',
        pathPreset: 'all',
      },
    })

    const derived = deriveDiagramState(state)
    expect(derived.visibleNodeIds.has('ACT1')).toBe(true)
    expect(derived.visibleNodeIds.has('VOI')).toBe(true)
    expect(derived.visibleStepIds.has('PB1')).toBe(true)
    expect(derived.visibleStepIds.has('PB5')).toBe(true)
  })

  it('filters edges through semantic families instead of raw semantic chips', async () => {
    const state = await createState({
      filters: {
        claims: [],
        standards: [],
        semanticFamilies: ['feedback'],
        lanes: [],
        search: '',
        pathPreset: 'all',
      },
    })

    const derived = deriveDiagramState(state)
    expect(derived.visibleEdgeIds.has('F_VoR_ACK')).toBe(true)
    expect(derived.visibleEdgeIds.has('F3f_reject')).toBe(true)
    expect(derived.visibleEdgeIds.has('PB_ACK')).toBe(true)
    expect(derived.visibleEdgeIds.has('PB_REJECT')).toBe(true)
    expect(derived.visibleEdgeIds.has('F5')).toBe(false)
  })

  it('translates legacy semantics query params into grouped families and writes families back out', () => {
    const parsed = parseUiSearchParams(new URLSearchParams('semantics=validation,status-ack&node=VOI'))
    expect(parsed.selectedNodeId).toBe('VOI')
    expect(parsed.filters.semanticFamilies).toEqual(['policy', 'feedback'])

    const serialized = buildUiSearchParams({
      selectedNodeId: 'VOI',
      selectedEdgeId: undefined,
      selectedStepId: undefined,
      filters: parsed.filters,
    })
    expect(serialized.get('families')).toBe('policy,feedback')
    expect(serialized.has('semantics')).toBe(false)
  })

  it('uses a typed default theme and rejects invalid projection themes', () => {
    expect(projectionOverridesSchema.parse({ version: '1' }).theme).toBe('default')
    expect(projectionOverridesSchema.safeParse({ version: '1', theme: 'flat-print' }).success).toBe(false)
  })

  it('sorts Panel B steps by sequence order and keeps terminal nodes visible', async () => {
    const scrambledManifest = {
      ...graphManifest,
      steps: [...graphManifest.steps].reverse(),
      edges: [...graphManifest.edges].sort((left, right) => right.id.localeCompare(left.id)),
    }
    const state = await createState()
    const derived = deriveDiagramState(state, scrambledManifest)
    const model = compileSequenceBoard(state, derived, scrambledManifest)
    const ackEdge = model.edges.find((edge) => edge.edge.id === 'PB_ACK')
    const rejectEdge = model.edges.find((edge) => edge.edge.id === 'PB_REJECT')
    const stepFour = model.steps.find((step) => step.step.id === 'PB4')
    const stepFourAnchorX = stepFour ? stepFour.rect.x + stepFour.rect.width / 2 : 0

    expect(model.steps.map((step) => step.step.id)).toEqual(['PB1', 'PB2', 'PB3', 'PB4', 'PB5'])
    expect(
      model.edges
        .filter((edge) => !edge.hidden)
        .map((edge) => `${edge.edge.source}->${edge.edge.target}`),
    ).toEqual([
      'PB1->PB2',
      'PB2->PB3',
      'PB3->PB4',
      'PB4->PB5',
      'PB4->PB_REJECT_OUT',
      'PB5->PB_AEA',
    ])
    expect(model.terminals.map((terminal) => terminal.node.id)).toEqual(['PB_AEA', 'PB_REJECT_OUT'])
    expect(ackEdge?.path).toContain(` ${model.ackRouteY}`)
    expect(ackEdge?.labelY).toBe(model.ackRouteY)
    expect(rejectEdge?.path.startsWith(`M ${stepFourAnchorX}`)).toBe(true)
  })

  it('builds direct search results for ids and standards', () => {
    const edgeResults = buildSearchResults('F5', graphManifest)
    const standardResults = buildSearchResults('NAMUR NE 178', graphManifest)

    expect(edgeResults[0]?.kind).toBe('edge')
    expect(edgeResults[0]?.id).toBe('F5')
    expect(standardResults.some((result) => result.kind === 'standard' && result.id === 'NE178')).toBe(true)
  })
})

describe('exports', () => {
  it('generates mermaid for both panels', async () => {
    const architectureMermaid = toMermaid('architecture')
    const sequenceMermaid = toMermaid('vor-sequence')
    mermaid.initialize({ startOnLoad: false })
    await expect(mermaid.parse(architectureMermaid)).resolves.toBeTruthy()
    await expect(mermaid.parse(sequenceMermaid)).resolves.toBeTruthy()
    expect(architectureMermaid).toContain('%% Canonical topology export only; schematic and not viewport/state-aware.')
    expect(architectureMermaid).toContain('subgraph GW["GW: NOA Security Gateway · NE 177 / NE 178"]')
    expect(architectureMermaid).toContain('subgraph GW_NE177["NE 177 read-only chain"]')
    expect(architectureMermaid).toContain('subgraph GW_NE178["NE 178 VoR interface"]')
    expect(architectureMermaid).toContain('F_GW2:')
    expect(architectureMermaid).toContain('[diode, medium]')
    expect(architectureMermaid).toContain('stroke-width:3.2px')
    expect(sequenceMermaid).toContain('%% Canonical topology export only; schematic and not viewport/state-aware.')
    expect(sequenceMermaid).toContain('PB_AEA')
    expect(sequenceMermaid).toContain('PB_REJECT_OUT')
  })

  it('keeps critical architecture routes on their reserved board channels', async () => {
    const state = await createState()
    const expectedRoutes = {
      F4: {
        path: 'M 1326 740 L 1326 812 L 790 812 L 790 840',
        labelPoint: { x: 1058, y: 794 },
      },
      F5: {
        path: 'M 670 900 L 634 900 L 634 996 L 562 996 L 562 823 L 534 823',
        labelPoint: { x: 598, y: 1020 },
      },
      F6: {
        path: 'M 424 823 L 360 823 L 360 996 L 336 996 L 336 843 L 308 843',
        labelPoint: { x: 380, y: 909.5 },
      },
      F_VoR_ACK: {
        path: 'M 534 823 L 562 823 L 562 936 L 640 936 L 640 900 L 670 900',
        labelPoint: { x: 590, y: 879.5 },
      },
      F7a: {
        path: 'M 1438 893 L 1472 893 L 1472 914 L 1584 914 L 1584 902 L 1610 902',
        labelPoint: { x: 1528, y: 934 },
      },
      F7_sub: {
        path: 'M 1710 1020 L 1868 1020 L 1868 956 L 1710 956',
        labelPoint: { x: 1789, y: 1002 },
      },
    } as const

    for (const [edgeId, expected] of Object.entries(expectedRoutes)) {
      const route = buildArchitectureRoute(state, edgeId)
      expect(route.path).toBe(expected.path)
      expect(resolveBoardLabelPosition(route.label)).toEqual(expected.labelPoint)
    }
  })

  it('keeps critical architecture routes axis-aligned', async () => {
    const state = await createState()
    const edgeIds = ['F4', 'F5', 'F6', 'F_VoR_ACK', 'F_AUDIT', 'F7a', 'F7_sub']

    for (const edgeId of edgeIds) {
      expect(routeIsAxisAligned(buildArchitectureRoute(state, edgeId).points)).toBe(true)
    }
  })

  it('keeps write-corridor label anchors outside nearby node boxes', async () => {
    const state = await createState()
    const guardedBounds = ['VOI', 'ACT1', 'A3'].map((nodeId) => nodeBounds(state, nodeId))
    const labelPoints = ['F5', 'F6', 'F_VoR_ACK'].map((edgeId) => ({
      edgeId,
      point: resolveBoardLabelPosition(buildArchitectureRoute(state, edgeId).label),
    }))

    for (const label of labelPoints) {
      expect(guardedBounds.some((bounds) => containsPoint(bounds, label.point)), `${label.edgeId} label overlaps a guarded node`).toBe(false)
    }

    expect(new Set(labelPoints.map((label) => `${label.point.x}:${label.point.y}`)).size).toBe(labelPoints.length)
  })

  it('keeps Panel B acknowledgement and rejection routes on the shared sequence geometry', async () => {
    const state = await createState()
    const derived = deriveDiagramState(state)
    const board = compileSequenceBoard(state, derived)
    const ackEdge = board.edges.find((edge) => edge.edge.id === 'PB_ACK')
    const rejectEdge = board.edges.find((edge) => edge.edge.id === 'PB_REJECT')

    expect(board.ackRouteY).toBe(206)
    expect(ackEdge).toMatchObject({
      path: 'M 1221 152 L 1221 206 L 202 206 L 202 104 L 188 104',
      labelX: 711.5,
      labelY: 206,
    })
    expect(rejectEdge).toMatchObject({
      path: 'M 997 152 L 997 208 L 1030 208 L 1030 226',
      labelX: 997,
      labelY: 180,
    })
  })

  it('reuses the shared sequence geometry in viewport export', async () => {
    const state = await createState({
      viewport: { x: -120, y: -80, zoom: 2 },
    })
    const derived = deriveDiagramState(state)
    const board = compileSequenceBoard(state, derived)
    const ackEdge = board.edges.find((edge) => edge.edge.id === 'PB_ACK')
    const rejectEdge = board.edges.find((edge) => edge.edge.id === 'PB_REJECT')
    const viewportDocument = buildExportSvgDocument(state, {
      mode: 'viewport',
      viewportMetrics: {
        architecture: { width: 640, height: 360 },
        sequence: { width: 640, height: 220 },
      },
    })

    expect(viewportDocument.svg).toContain('<title>AEA Architecture Viewport Export</title>')
    expect(viewportDocument.svg).toContain('data-export-theme="default"')
    expect(viewportDocument.svg).toContain('viewBox="60 40 320 180"')
    for (const edgeId of ['F4', 'F5', 'F6', 'F_VoR_ACK', 'F7a', 'F7_sub']) {
      const route = buildArchitectureRoute(state, edgeId)
      const label = resolveBoardLabelPosition(route.label)
      expect(viewportDocument.svg).toContain(`d="${route.path}"`)
      expect(viewportDocument.svg).toContain(`id="edge-label-${edgeId}" x="${label.x}" y="${label.y}"`)
    }
    expect(viewportDocument.svg).toContain(`d="${ackEdge?.path}"`)
    expect(viewportDocument.svg).toContain(`d="${rejectEdge?.path}"`)
    expect(viewportDocument.svg).toContain('id="sequence-node-PB_AEA"')
    expect(viewportDocument.svg).toContain('id="sequence-edge-PB_ACK"')
  })

  it('builds a fixed-size publication export with both panels', async () => {
    const state = await createState({ panelBVisible: false })
    const publicationDocument = buildExportSvgDocument(state, { mode: 'publication' })

    expect(publicationDocument.svg).toContain('<title>AEA Architecture Publication Export</title>')
    expect(publicationDocument.svg).toContain('data-export-theme="analysis"')
    expect(publicationDocument.svg).toContain('width="183mm"')
    expect(publicationDocument.svg).toContain('font-size="9pt"')
    expect(publicationDocument.svg).toContain('font-size="6.5pt"')
    expect(publicationDocument.svg).toContain('font-size="5pt"')
    expect(publicationDocument.svg).toContain('stroke-dasharray="11 7"')
    expect(publicationDocument.svg).toContain('id="sequence-edge-PB_ACK"')
    expect(publicationDocument.svg).toContain('VoR Domain-Transition Sequence')
  })

  it('exports shared marker definitions and semantic-specific dash rhythms', async () => {
    const state = await createState()
    const viewportDocument = buildExportSvgDocument(state, { mode: 'viewport' })

    expect(viewportDocument.svg).toContain('id="marker-gateway-internal"')
    expect(viewportDocument.svg).toContain('id="marker-tool-call"')
    expect(viewportDocument.svg).toContain('id="marker-rejection"')
    expect(viewportDocument.svg).toContain('markerUnits="userSpaceOnUse"')
    expect(viewportDocument.svg).toContain('stroke-dasharray="3.2 7.2 1.6 7.2"')
    expect(viewportDocument.svg).toContain('stroke-dasharray="5 7"')
    expect(viewportDocument.svg).toContain('stroke-dasharray="1.2 8.4"')
  })

  it('respects the active viewport theme while forcing publication exports to analysis mode', async () => {
    const state = await createState()
    state.projection = {
      ...state.projection,
      theme: 'analysis',
    }

    const analysisViewport = buildExportSvgDocument(state, { mode: 'viewport' })
    const publicationDocument = buildExportSvgDocument(
      {
        ...state,
        projection: {
          ...state.projection,
          theme: 'default',
        },
      },
      { mode: 'publication' },
    )

    expect(analysisViewport.svg).toContain('data-export-theme="analysis"')
    expect(analysisViewport.svg).toContain('fill="#f8fafc"')
    expect(publicationDocument.svg).toContain('data-export-theme="analysis"')
    expect(publicationDocument.svg).not.toContain('data-export-theme="default"')
  })

  it('resetLayout clears manual edge handles together with node positions', async () => {
    const initialState = useDiagramStore.getState()
    const positions = await computeBoardNodePositions(graphManifest, defaultProjectionOverrides)
    useDiagramStore.setState({
      projection: {
        ...initialState.projection,
        nodePositions: {
          A1: { x: 999, y: 888 },
        },
        edgeHandles: {
          F5: {
            sourceHandle: 'top',
            targetHandle: 'bottom',
          },
        },
      },
      layout: {
        ready: true,
        running: false,
        positions: {
          ...positions,
          A1: { x: 999, y: 888 },
        },
      },
    })

    await useDiagramStore.getState().actions.resetLayout()

    const nextState = useDiagramStore.getState()
    expect(nextState.projection.nodePositions).toEqual({})
    expect(nextState.projection.edgeHandles).toEqual({})
    expect(nextState.layout.positions.A1).toEqual(positions.A1)

    useDiagramStore.setState(initialState)
  })
})
