import { buildSearchResults } from '@/graph/compile/searchIndex'
import {
  edgeStrokeWidth,
  getSemanticFamilyStrokeDash,
  getSemanticMarkerGeometry,
  getSemanticMarkerTokens,
  getSemanticPresentation,
  getSemanticStrokeDash,
  semanticFamilyOrder,
  resolveSemanticFamilies,
} from '@/graph/compile/semanticPresentation'
import { compileSequenceBoard } from '@/graph/compile/sequenceBoard'
import { buildExportSvgDocument } from '@/graph/compile/toExportSvg'
import mermaid from 'mermaid'
import { describe, expect, it } from 'vitest'

import { compileArchitectureEdges, deriveDiagramState, type CompileCallbacks } from '@/graph/compile/toReactFlow'
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

function exportArchitectureEdgePath(svg: string, edgeId: string) {
  const match = svg.match(new RegExp(`<g id="edge-${edgeId}"[^>]*>[\\s\\S]*?<path d="([^"]+)"`))
  return match?.[1]
}

const callbacks: CompileCallbacks = {
  onSelectNode() {},
  onSelectEdge() {},
  onSelectStep() {},
  onBadgeClaim() {},
  onBadgeStandard() {},
  onPathAction() {},
  onHover() {},
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
      F3a: { source: 'DEC_K1', target: 'DEC_R0', semantic: 'retrieval', style: 'thin', direction: 'ltr' },
      F3b: { source: 'DEC_K2', target: 'DEC_R0', semantic: 'policy-soft', style: 'thin', direction: 'ltr' },
      F_R0_out: { source: 'DEC_R0', target: 'DEC_R1', semantic: 'retrieval', style: 'medium', direction: 'ltr' },
      "F3b'": { source: 'DEC_K2', target: 'DEC_G1', semantic: 'policy-hard', style: 'medium', direction: 'ltr' },
      F3c: { source: 'DEC_R1', target: 'DEC_G0', semantic: 'retrieval', style: 'medium', direction: 'ltr' },
      F3d: { source: 'S2', target: 'DEC_G0', semantic: 'retrieval', style: 'medium', direction: 'ttb' },
      F_G0_pol: { source: 'DEC_K2', target: 'DEC_G0', semantic: 'policy-hard', style: 'thin', direction: 'ltr' },
      F_G0_out: { source: 'DEC_G0', target: 'DEC_R2', semantic: 'retrieval', style: 'medium', direction: 'ltr' },
      F3e: { source: 'DEC_R2', target: 'DEC_G1A', semantic: 'proposal', style: 'medium', direction: 'ltr' },
      F_G1A_pass: { source: 'DEC_G1A', target: 'DEC_G1', semantic: 'validation', style: 'medium', direction: 'ttb' },
      F_G1A_reject: { source: 'DEC_G1A', target: 'DEC_R2', semantic: 'rejection', style: 'dashed', direction: 'rtl' },
      F3f: { source: 'DEC_G1', target: 'DEC_G2', semantic: 'validation', style: 'medium', direction: 'ltr' },
      F3f_reject: { source: 'DEC_G1', target: 'DEC_R2', semantic: 'rejection', style: 'dashed', direction: 'rtl' },
      F3g: { source: 'DEC_K1', target: 'DEC_G2', semantic: 'validation', style: 'thin', direction: 'ltr' },
      F3h: { source: 'S2', target: 'DEC_G2', semantic: 'validation', style: 'thin', direction: 'ttb' },
      F3i: { source: 'VOI', target: 'DEC_G2', semantic: 'validation', style: 'thin', direction: 'ltr' },
      F_T1: { source: 'DEC_T0', target: 'S1', semantic: 'tool-call', style: 'dotted', direction: 'btt' },
      F_T2: { source: 'DEC_T0', target: 'DEC_K1', semantic: 'tool-call', style: 'dotted', direction: 'rtl' },
      F_T0_req: { source: 'DEC_R2', target: 'DEC_T0', semantic: 'tool-call', style: 'dotted', direction: 'btt' },
      F_T0_obs: { source: 'DEC_T0', target: 'DEC_G0', semantic: 'retrieval', style: 'medium', direction: 'rtl' },
      F4: { source: 'DEC_G2', target: 'DEC_H1', semantic: 'validation', style: 'medium', direction: 'rtl' },
      F_H1_pass: { source: 'DEC_H1', target: 'ACT1', semantic: 'validation', style: 'medium', direction: 'ttb' },
      F_M1_G0: { source: 'DEC_G0', target: 'DEC_M1', semantic: 'audit', style: 'thin', direction: 'ltr' },
      F_M1_R0: { source: 'DEC_R0', target: 'DEC_M1', semantic: 'audit', style: 'thin', direction: 'ltr' },
      F_M1_T0: { source: 'DEC_T0', target: 'DEC_M1', semantic: 'audit', style: 'thin', direction: 'ltr' },
      F_M1_G1A: { source: 'DEC_G1A', target: 'DEC_M1', semantic: 'audit', style: 'thin', direction: 'ltr' },
      F_M1_H1: { source: 'DEC_H1', target: 'DEC_M1', semantic: 'audit', style: 'thin', direction: 'ltr' },
      F_M1_out: { source: 'DEC_M1', target: 'ACT3', semantic: 'audit', style: 'thin', direction: 'ttb' },
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

  it('assigns short display labels to every architecture edge', () => {
    const expectedArchitectureDisplayLabels = {
      F_GW1: 'Subscribe',
      F_GW2: 'Ingress',
      F_GW3: 'No return',
      F1: 'Read PA-DIM',
      F2: 'Normalise',
      F3a: 'Gate AAS',
      F3b: 'Gate policy',
      F_R0_out: 'Pass context',
      "F3b'": 'Enforce rules',
      F3c: 'Deliver ctx',
      F3d: 'Load t0',
      F_G0_pol: 'Refusal rules',
      F_G0_out: 'Guard ctx',
      F3e: 'Submit plan',
      F_G1A_pass: 'Pass schema',
      F_G1A_reject: 'Schema reject',
      F3f: 'Pass plan',
      F3f_reject: 'Reject',
      F3g: 'Provide bounds',
      F3h: 'Load t0 vals',
      F3i: 'Limit writes',
      F_T1: 'Run read',
      F_T2: 'Query AAS',
      F_T0_req: 'Broker tools',
      F_T0_obs: 'Guard obs',
      F4: 'Await approval',
      F_H1_pass: 'Approve plan',
      F_M1_G0: 'Log input',
      F_M1_R0: 'Log retrieval',
      F_M1_T0: 'Log tools',
      F_M1_G1A: 'Log schema',
      F_M1_H1: 'Log approval',
      F_M1_out: 'Guardrail log',
      F_KPI: 'Feed KPI',
      F_AUDIT: 'Record VoR',
      F5: 'Send request',
      F6: 'Send change',
      F_VoR_ACK: 'Status',
      F_CPC_INT: 'Execute',
      F7a: 'Publish MQTT',
      F7b: 'Consume',
      F7_sub: 'Subscribe',
    } as const

    for (const [id, displayLabel] of Object.entries(expectedArchitectureDisplayLabels)) {
      const edge = graphManifest.edges.find((candidate) => candidate.id === id)
      expect(edge, `Missing edge ${id}`).toBeDefined()
      expect(edge?.displayLabel).toBe(displayLabel)
    }

    expect(
      graphManifest.edges
        .filter((edge) => edge.panel.includes('architecture'))
        .every((edge) => typeof edge.displayLabel === 'string' && edge.displayLabel.length > 0),
    ).toBe(true)
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

  it('enforces guardrail node presence and kinds', () => {
    const expectedKinds = {
      DEC_G0: 'policy',
      DEC_R0: 'gateway-module',
      DEC_T0: 'gateway-module',
      DEC_G1A: 'policy',
      DEC_H1: 'gateway-module',
      DEC_M1: 'audit',
    } as const

    for (const [id, kind] of Object.entries(expectedKinds)) {
      const node = graphManifest.nodes.find((candidate) => candidate.id === id)
      expect(node, `Missing node ${id}`).toBeDefined()
      expect(node?.kind).toBe(kind)
      expect(node?.claimIds).toContain('C6')
    }
  })

  it('forces planner ingress, tool brokering, and approval through guardrail edges', () => {
    const edgeMap = Object.fromEntries(graphManifest.edges.map((edge) => [edge.id, edge]))

    expect(edgeMap.F3c?.target).toBe('DEC_G0')
    expect(edgeMap.F3d?.target).toBe('DEC_G0')
    expect(edgeMap.F_T0_req?.target).toBe('DEC_T0')
    expect(edgeMap.F_T1?.source).toBe('DEC_T0')
    expect(edgeMap.F_T2?.source).toBe('DEC_T0')
    expect(edgeMap.F4?.target).toBe('DEC_H1')
  })

  it('keeps ACT1 validation ingress exclusive to the approval gate while preserving VoR feedback', () => {
    const incomingAct1 = graphManifest.edges.filter((edge) => edge.target === 'ACT1')
    const validationEdges = incomingAct1.filter((edge) => edge.semantic === 'validation')
    const feedbackEdges = incomingAct1.filter((edge) => edge.semantic === 'status-ack')

    expect(validationEdges).toHaveLength(1)
    expect(validationEdges[0]?.id).toBe('F_H1_pass')
    expect(validationEdges[0]?.source).toBe('DEC_H1')
    expect(feedbackEdges).toHaveLength(1)
    expect(feedbackEdges[0]?.id).toBe('F_VoR_ACK')
  })

  it('requires the guardrail monitor and interaction rule to stay complete', () => {
    const monitorInputs = ['DEC_G0', 'DEC_R0', 'DEC_T0', 'DEC_G1A', 'DEC_H1']
    for (const sourceId of monitorInputs) {
      const edge = graphManifest.edges.find((candidate) => candidate.source === sourceId && candidate.target === 'DEC_M1')
      expect(edge, `Missing monitor feed from ${sourceId}`).toBeDefined()
      expect(edge?.semantic).toBe('audit')
    }

    const monitorOutput = graphManifest.edges.find((edge) => edge.id === 'F_M1_out')
    expect(monitorOutput?.source).toBe('DEC_M1')
    expect(monitorOutput?.target).toBe('ACT3')

    const rule = graphManifest.interactionRules.find((candidate) => candidate.id === 'RULE_GUARDRAIL_LAYER')
    expect(rule).toBeDefined()
    expect(rule?.triggerIds.every((id) => id.startsWith('node:'))).toBe(true)
    expect(rule?.relatedEdgeIds.every((id) => id.startsWith('edge:'))).toBe(true)
    expect(rule?.focusPath).toBe('policy')
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

  it('keeps styled writeback edges solid while retaining the family dash as a fallback rhythm', () => {
    expect(getSemanticStrokeDash('writeback', 'medium')).toBeUndefined()
    expect(getSemanticFamilyStrokeDash('write')).toBe('18 5 4 5')
  })

  it('uses surface-aware marker tokens while keeping the canonical marker coordinates shared', () => {
    expect(getSemanticMarkerTokens('architecture')).toMatchObject({
      width: 14,
      height: 11,
      refY: 4,
      viewBox: '0 0 10 8',
      units: 'strokeWidth',
    })
    expect(getSemanticMarkerTokens('legend')).toMatchObject({
      width: 10,
      height: 8,
      refY: 4,
      viewBox: '0 0 10 8',
      units: 'userSpaceOnUse',
    })
    expect(getSemanticMarkerTokens('sequence')).toMatchObject({
      width: 10,
      height: 8,
      refY: 4,
      viewBox: '0 0 10 8',
      units: 'userSpaceOnUse',
    })
    expect(getSemanticMarkerTokens('export-viewport')).toMatchObject({
      width: 10,
      height: 8,
      refY: 4,
      viewBox: '0 0 10 8',
      units: 'userSpaceOnUse',
    })
    expect(getSemanticMarkerTokens('export-publication')).toMatchObject({
      width: 7,
      height: 5.5,
      refY: 4,
      viewBox: '0 0 10 8',
      units: 'userSpaceOnUse',
    })
  })

  it('strengthens open markers and runtime stroke widths for the default zoom', () => {
    expect(getSemanticMarkerGeometry('arrow')).toMatchObject({
      element: 'path',
      d: 'M 0.5 0.8 L 9.5 4 L 0.5 7.2',
      strokeWidth: 2.2,
    })
    expect(getSemanticMarkerGeometry('tee')).toMatchObject({
      element: 'path',
      d: 'M 1 1 L 1 7 M 1 4 L 9 4',
      strokeWidth: 2.3,
    })
    expect(edgeStrokeWidth('bold')).toBe(3.6)
    expect(edgeStrokeWidth('medium')).toBe(2.7)
    expect(edgeStrokeWidth('dashed')).toBe(2.2)
    expect(edgeStrokeWidth('dotted')).toBe(1.8)
    expect(edgeStrokeWidth('thin')).toBe(1.7)
  })

  it('marks optional architecture edges explicitly and animates tool-call edges', async () => {
    const state = await createState()
    const derived = deriveDiagramState(state)
    const edges = compileArchitectureEdges(state, callbacks, derived)

    expect(edges.find((edge) => edge.id === 'F_CPC_INT')).toMatchObject({
      animated: false,
      data: {
        optional: true,
      },
    })
    expect(edges.find((edge) => edge.id === 'F7_sub')).toMatchObject({
      animated: false,
      data: {
        optional: true,
      },
    })
    expect(edges.find((edge) => edge.id === 'F_T1')).toMatchObject({
      animated: true,
      data: {
        optional: false,
      },
    })
    expect(edges.find((edge) => edge.id === 'F_T2')).toMatchObject({
      animated: true,
      data: {
        optional: false,
      },
    })
  })

  it('links shared t0 edges during active inspection', async () => {
    const state = await createState({
      selectedEdgeId: 'F3d',
    })
    const derived = deriveDiagramState(state)
    const edges = compileArchitectureEdges(state, callbacks, derived)

    expect(edges.find((edge) => edge.id === 'F3d')).toMatchObject({
      data: {
        sharedTagFocused: true,
      },
    })
    expect(edges.find((edge) => edge.id === 'F3h')).toMatchObject({
      data: {
        sharedTagFocused: true,
      },
    })
    expect(edges.find((edge) => edge.id === 'F3g')).toMatchObject({
      data: {
        sharedTagFocused: false,
      },
    })
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
    expect(architectureMermaid).toContain('stroke-width:3.6px')
    expect(sequenceMermaid).toContain('%% Canonical topology export only; schematic and not viewport/state-aware.')
    expect(sequenceMermaid).toContain('PB_AEA')
    expect(sequenceMermaid).toContain('PB_REJECT_OUT')
  })

  it('keeps critical architecture routes on their reserved board channels', async () => {
    const state = await createState()
    const expectedRoutes = {
      F3e: {
        path: 'M 1325 743 L 1383 743 Q 1397 743 1397 729 L 1397 692 Q 1397 678 1411 678 L 1468 678',
        labelPoint: { x: 1361, y: 729 },
      },
      F_G1A_pass: {
        path: 'M 1583 742 L 1583 784 Q 1583 798 1569 798 L 1324 798 Q 1310 798 1310 784 L 1310 770',
        labelPoint: { x: 1464.5, y: 798 },
      },
      F_G1A_reject: {
        path: 'M 1468 678 L 1468 755 Q 1468 764 1459 764 L 1459 764 Q 1450 764 1450 755 L 1450 678',
        labelPoint: { x: 1459, y: 782 },
      },
      F3f_reject: {
        path: 'M 1310 890 L 1310 778 Q 1310 764 1296 764 L 1244 764 Q 1230 764 1230 750 L 1230 692 Q 1230 678 1216 678 L 1200 678',
        labelPoint: { x: 1270, y: 782 },
      },
      F3g: {
        path: 'M 774 586 L 774 882 Q 774 896 788 896 L 1574 896 Q 1588 896 1588 882 L 1588 766',
        labelPoint: { x: 1181, y: 880 },
      },
      F3h: {
        path: 'M 1250 310 L 1250 740 Q 1250 754 1264 754 L 1546 754 Q 1552 754 1552 760 L 1552 760 Q 1552 766 1558 766 L 1588 766',
        labelPoint: { x: 1534, y: 760 },
      },
      F3i: {
        path: 'M 534 823 L 534 902 Q 534 916 548 916 L 1454 916 Q 1468 916 1468 902 L 1468 830',
        labelPoint: { x: 1001, y: 900 },
      },
      F_T0_req: {
        path: 'M 1325 743 L 1325 574 Q 1325 560 1339 560 L 1569 560 Q 1583 560 1583 546 L 1583 466',
        labelPoint: { x: 1325, y: 637.5 },
      },
      F_T1: {
        path: 'M 1468 526 L 1468 420 Q 1468 406 1454 406 L 654 406 Q 640 406 640 392 L 640 242 Q 640 228 654 228 L 744 228 Q 758 228 758 242 L 758 256',
        labelPoint: { x: 640, y: 335 },
      },
      F_T2: {
        path: 'M 1468 526 L 884 526',
        labelPoint: { x: 1176, y: 512 },
      },
      F_T0_obs: {
        path: 'M 1583 466 L 1583 632 Q 1583 646 1569 646 L 1061 646 Q 1047 646 1047 660 L 1047 742',
        labelPoint: { x: 1315, y: 590 },
      },
      F4: {
        path: 'M 1588 894 L 1198 894 Q 1184 894 1184 880 L 1184 784 Q 1184 770 1170 770 L 779 770',
        labelPoint: { x: 1386, y: 880 },
      },
      F_H1_pass: {
        path: 'M 779 890 L 779 929.5 Q 779 932 781.5 932 L 781.5 932 Q 784 932 784 934.5 L 784 990',
        labelPoint: { x: 799, y: 911 },
      },
      F5: {
        path: 'M 664 1050 L 642 1050 Q 628 1050 628 1064 L 628 1124 Q 628 1138 614 1138 L 576 1138 Q 562 1138 562 1124 L 562 837 Q 562 823 548 823 L 534 823',
        labelPoint: { x: 595, y: 1162 },
      },
      F6: {
        path: 'M 424 823 L 374 823 Q 360 823 360 837 L 360 1126 Q 360 1138 348 1138 L 348 1138 Q 336 1138 336 1126 L 336 1007 Q 336 993 322 993 L 308 993',
        labelPoint: { x: 380, y: 980.5 },
      },
      F_VoR_ACK: {
        path: 'M 534 823 L 548 823 Q 562 823 562 837 L 562 1040 Q 562 1054 576 1054 L 632 1054 Q 634 1054 634 1052 L 634 1052 Q 634 1050 636 1050 L 664 1050',
        labelPoint: { x: 590, y: 938.5 },
      },
      F_CPC_INT: {
        path: 'M 80 993 L 62 993 Q 48 993 48 979 L 48 279 Q 48 265 62 265 L 80 265',
        labelPoint: { x: 64, y: 629 },
      },
      F7a: {
        path: 'M 1670 1043 L 1690 1043 Q 1704 1043 1704 1057 L 1704 1104 Q 1704 1118 1718 1118 L 1818 1118 Q 1832 1118 1832 1104 L 1832 997 Q 1832 984 1845 984 L 1858 984',
        labelPoint: { x: 1768, y: 1138 },
      },
      F7_sub: {
        path: 'M 1958 1100 L 2102 1100 Q 2116 1100 2116 1086 L 2116 1052 Q 2116 1038 2102 1038 L 1958 1038',
        labelPoint: { x: 2037, y: 1082 },
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
    const edgeIds = [
      'F3e',
      'F_G1A_pass',
      'F_G1A_reject',
      'F3f_reject',
      'F3g',
      'F3h',
      'F3i',
      'F_T0_req',
      'F_T1',
      'F_T2',
      'F_T0_obs',
      'F4',
      'F_H1_pass',
      'F5',
      'F6',
      'F_VoR_ACK',
      'F_AUDIT',
      'F_CPC_INT',
      'F7a',
      'F7_sub',
    ]

    for (const edgeId of edgeIds) {
      expect(routeIsAxisAligned(buildArchitectureRoute(state, edgeId).points)).toBe(true)
    }
  })

  it('renders rounded board paths while keeping orthogonal control points intact', async () => {
    const state = await createState()
    const curvedRoute = buildArchitectureRoute(state, 'F5')
    const straightRoute = buildArchitectureRoute(state, 'F_GW2')

    expect(curvedRoute.path).toContain('Q')
    expect(routeIsAxisAligned(curvedRoute.points)).toBe(true)
    expect(straightRoute.path).not.toContain('Q')
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

  it('keeps newly rerouted labels outside their guarded node boxes', async () => {
    const state = await createState()
    const checks = [
      { edgeId: 'F_G1A_pass', nodes: ['DEC_G1A', 'DEC_G1', 'DEC_M1'] },
      { edgeId: 'F_T1', nodes: ['S1', 'S2', 'DEC_T0'] },
      { edgeId: 'F_T0_obs', nodes: ['DEC_T0', 'DEC_G0', 'DEC_R2'] },
      { edgeId: 'F_H1_pass', nodes: ['DEC_H1', 'ACT1', 'ACT3'] },
      { edgeId: 'F_CPC_INT', nodes: ['A1', 'A2', 'A3'] },
    ] as const

    for (const check of checks) {
      const point = resolveBoardLabelPosition(buildArchitectureRoute(state, check.edgeId).label)
      const guardedBounds = check.nodes.map((nodeId) => nodeBounds(state, nodeId))
      expect(
        guardedBounds.some((bounds) => containsPoint(bounds, point)),
        `${check.edgeId} label overlaps a guarded node`,
      ).toBe(false)
    }
  })

  it('keeps Panel B acknowledgement and rejection routes on the shared sequence geometry', async () => {
    const state = await createState()
    const derived = deriveDiagramState(state)
    const board = compileSequenceBoard(state, derived)
    const ackEdge = board.edges.find((edge) => edge.edge.id === 'PB_ACK')
    const rejectEdge = board.edges.find((edge) => edge.edge.id === 'PB_REJECT')

    expect(board.ackRouteY).toBe(206)
    expect(ackEdge?.path).toContain('Q')
    expect(ackEdge).toMatchObject({
      labelX: 711.5,
      labelY: 206,
    })
    expect(rejectEdge?.path).toContain('Q')
    expect(rejectEdge).toMatchObject({
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
    for (const edgeId of ['F_G1A_pass', 'F_T1', 'F_T0_obs', 'F4', 'F_H1_pass', 'F5', 'F6', 'F_VoR_ACK', 'F_CPC_INT', 'F7a', 'F7_sub']) {
      const route = buildArchitectureRoute(state, edgeId)
      const label = resolveBoardLabelPosition(route.label)
      expect(viewportDocument.svg).toContain(`d="${route.path}"`)
      expect(viewportDocument.svg).toContain(`id="edge-label-${edgeId}" x="${label.x}" y="${label.y}"`)
    }
    expect(viewportDocument.svg).toContain('id="edge-F7_sub" data-edge-optional="true" opacity="0.6"')
    expect(viewportDocument.svg).toContain('F7_sub · subscribe (optional)')
    expect(viewportDocument.svg).toContain('id="edge-F_CPC_INT" data-edge-optional="true" opacity="0.6"')
    expect(viewportDocument.svg).toContain('F_CPC_INT · execute verified change (optional)')
    expect(viewportDocument.svg).toContain(`d="${ackEdge?.path}"`)
    expect(viewportDocument.svg).toContain(`d="${rejectEdge?.path}"`)
    expect(viewportDocument.svg).toContain('id="sequence-node-PB_AEA"')
    expect(viewportDocument.svg).toContain('id="sequence-edge-PB_ACK"')
  })

  it('builds a fixed-size publication export with both panels', async () => {
    const state = await createState({ panelBVisible: false })
    const publicationDocument = buildExportSvgDocument(state, { mode: 'publication' })
    const publicationF5Path = exportArchitectureEdgePath(publicationDocument.svg, 'F5')
    const route = buildArchitectureRoute(state, 'F5')
    const figureWidthPt = (183 / 25.4) * 72
    const scale = figureWidthPt / graphManifest.layoutDefaults.canvas.width
    const start = route.points[0]
    const publicationStart = publicationF5Path?.match(/^M (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/)

    expect(publicationDocument.svg).toContain('<title>AEA Architecture Publication Export</title>')
    expect(publicationDocument.svg).toContain('data-export-theme="analysis"')
    expect(publicationDocument.svg).toContain('width="183mm"')
    expect(publicationDocument.svg).toContain('font-size="9pt"')
    expect(publicationDocument.svg).toContain('font-size="6.5pt"')
    expect(publicationDocument.svg).toContain('font-size="5pt"')
    expect(publicationDocument.svg).toContain('stroke-dasharray="11 7"')
    expect(publicationDocument.svg).toContain('id="sequence-edge-PB_ACK"')
    expect(publicationDocument.svg).toContain('VoR Domain-Transition Sequence')
    expect(publicationF5Path).toContain('Q')
    expect(publicationF5Path).not.toBe(route.path)
    expect(Number(publicationStart?.[1])).toBeCloseTo(start.x * scale, 2)
    expect(Number(publicationStart?.[2])).toBeCloseTo(start.y * scale + 34, 2)
  })

  it('exports shared marker definitions and semantic-specific dash rhythms', async () => {
    const state = await createState()
    const viewportDocument = buildExportSvgDocument(state, { mode: 'viewport' })
    const publicationDocument = buildExportSvgDocument(state, { mode: 'publication' })

    expect(viewportDocument.svg).toContain('id="marker-gateway-internal"')
    expect(viewportDocument.svg).toContain('id="marker-tool-call"')
    expect(viewportDocument.svg).toContain('id="marker-rejection"')
    expect(viewportDocument.svg).toContain('markerWidth="10"')
    expect(viewportDocument.svg).toContain('markerHeight="8"')
    expect(viewportDocument.svg).toContain('refY="4"')
    expect(viewportDocument.svg).toContain('markerUnits="userSpaceOnUse"')
    expect(viewportDocument.svg).toContain('stroke-width="3.6"')
    expect(viewportDocument.svg).toContain('stroke-width="2.7"')
    expect(viewportDocument.svg).toContain('stroke-width="1.7"')
    expect(viewportDocument.svg).toContain('stroke-dasharray="3.2 7.2 1.6 7.2"')
    expect(viewportDocument.svg).toContain('stroke-dasharray="5 7"')
    expect(viewportDocument.svg).toContain('stroke-dasharray="1.2 8.4"')
    expect(publicationDocument.svg).toContain('markerWidth="7"')
    expect(publicationDocument.svg).toContain('markerHeight="5.5"')
    expect(publicationDocument.svg).toContain('refY="4"')
    expect(publicationDocument.svg).toContain('markerUnits="userSpaceOnUse"')
    expect(publicationDocument.svg).toContain('stroke-width="1.7"')
    expect(publicationDocument.svg).toContain('stroke-width="1.2"')
    expect(publicationDocument.svg).toContain('stroke-width="0.7"')
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
