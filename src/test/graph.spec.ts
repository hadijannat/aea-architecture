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
import { resolveBoardLabelPosition } from '@/layout/board'
import { validateGraphManifest } from '@/graph/spec/validators'
import { computeBoardNodePositions } from '@/layout/boardLayout'
import { buildBoardEdgeRouteFromPositions, buildBoardGeometryFromPositions } from '@/layout/boardGeometry'
import { resolveEdgeHandles } from '@/layout/ports'
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
      panelBSize: 34,
      viewportLocked: false,
      reduceMotion: false,
      systemReduceMotion: false,
      ...overrides,
    },
    actions: {} as DiagramStore['actions'],
  }
}

function buildArchitectureRoute(state: DiagramStore, edgeId: string) {
  const edge = resolveGraphEdge(edgeId)
  if (!edge) {
    throw new Error(`Missing edge ${edgeId}`)
  }

  const handles = resolveEdgeHandles(edge, state.projection.edgeHandles)
  return buildBoardEdgeRouteFromPositions(edge, state.layout.positions, graphManifest, handles)
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

function containsBounds(outer: ReturnType<typeof nodeBounds>, inner: ReturnType<typeof nodeBounds>) {
  return (
    inner.left >= outer.left &&
    inner.top >= outer.top &&
    inner.right <= outer.right &&
    inner.bottom <= outer.bottom
  )
}

function expectedStructuralSizes() {
  return {
    LANE_A: {
      width: graphManifest.layoutDefaults.lanes.A.width,
      height: graphManifest.layoutDefaults.lanes.A.height,
    },
    LANE_B: {
      width: graphManifest.layoutDefaults.lanes.B.width,
      height: graphManifest.layoutDefaults.lanes.B.height,
    },
    LANE_C: {
      width: graphManifest.layoutDefaults.lanes.C.width,
      height: graphManifest.layoutDefaults.lanes.C.height,
    },
    GW: {
      width: graphManifest.layoutDefaults.gateway.width,
      height: graphManifest.layoutDefaults.gateway.height,
    },
    AEA: {
      width: graphManifest.layoutDefaults.aea.width,
      height: graphManifest.layoutDefaults.aea.height,
    },
    BAND_SENSE: {
      width: graphManifest.layoutDefaults.aea.width - 40,
      height: graphManifest.layoutDefaults.aea.bandHeights.Sense,
    },
    BAND_DECIDE: {
      width: graphManifest.layoutDefaults.aea.width - 40,
      height: graphManifest.layoutDefaults.aea.bandHeights.Decide,
    },
    BAND_ACT: {
      width: graphManifest.layoutDefaults.aea.width - 40,
      height: graphManifest.layoutDefaults.aea.bandHeights.Act,
    },
  } as const
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

  it('rejects structural container drift from layout defaults', () => {
    const mutated = structuredClone(graphManifest)
    const gateway = mutated.nodes.find((node) => node.id === 'GW')
    const laneB = mutated.nodes.find((node) => node.id === 'LANE_B')
    const decideBand = mutated.nodes.find((node) => node.id === 'BAND_DECIDE')

    if (!gateway || !laneB || !decideBand) {
      throw new Error('Expected GW, LANE_B, and BAND_DECIDE objects to exist')
    }

    gateway.height -= 12
    laneB.width -= 24
    decideBand.height -= 18

    const issues = validateGraphManifest(mutated)
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid-structural-node-height',
          message: expect.stringContaining('GW'),
        }),
        expect.objectContaining({
          code: 'invalid-structural-node-width',
          message: expect.stringContaining('LANE_B'),
        }),
        expect.objectContaining({
          code: 'invalid-structural-node-height',
          message: expect.stringContaining('BAND_DECIDE'),
        }),
      ]),
    )
  })

  it('rejects unauthorized planner ingress edges targeting DEC_R2', () => {
    const mutated = structuredClone(graphManifest)
    mutated.edges.push({
      ...mutated.edges.find((edge) => edge.id === 'F1')!,
      id: 'F_ROGUE',
      source: 'S2',
      target: 'DEC_R2',
      semantic: 'retrieval',
      style: 'medium',
      direction: 'ttb',
    })

    const issues = validateGraphManifest(mutated)
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unauthorized-planner-ingress',
          message: expect.stringContaining('F_ROGUE'),
        }),
      ]),
    )
  })

  it('allows the four canonical planner inbound edges', () => {
    const plannerInbound = graphManifest.edges.filter((edge) => edge.target === 'DEC_R2')
    expect(plannerInbound.map((edge) => edge.id).sort()).toEqual([
      'F3f_reject',
      'F_G0_out',
      'F_G1A_reject',
      'F_H1_reject',
    ])

    const issues = validateGraphManifest(graphManifest)
    const plannerIssues = issues.filter((issue) => issue.code === 'unauthorized-planner-ingress')
    expect(plannerIssues).toEqual([])
  })

  it('rejects orphaned claims that appear on no node or edge', () => {
    const mutated = structuredClone(graphManifest)
    for (const node of mutated.nodes) {
      node.claimIds = node.claimIds.filter((id) => id !== 'C5')
    }
    for (const edge of mutated.edges) {
      edge.claimIds = edge.claimIds.filter((id) => id !== 'C5')
    }

    const issues = validateGraphManifest(mutated)
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'orphaned-claim-node', message: expect.stringContaining('C5') }),
        expect.objectContaining({ code: 'orphaned-claim-edge', message: expect.stringContaining('C5') }),
      ]),
    )
  })

  it('rejects orphaned standards that appear on no node or edge', () => {
    const mutated = structuredClone(graphManifest)
    for (const node of mutated.nodes) {
      node.standardIds = node.standardIds.filter((id) => id !== 'MQTT5')
    }
    for (const edge of mutated.edges) {
      edge.standardIds = edge.standardIds.filter((id) => id !== 'MQTT5')
    }

    const issues = validateGraphManifest(mutated)
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'orphaned-standard', message: expect.stringContaining('MQTT5') }),
      ]),
    )
  })

  it('validates F_AUDIT step correspondence', () => {
    const fAudit = graphManifest.edges.find((edge) => edge.id === 'F_AUDIT')
    expect(fAudit).toBeDefined()
    expect(fAudit!.interactive.relatedStepIds).toEqual(['PB5'])

    const mutated = structuredClone(graphManifest)
    const mutatedAudit = mutated.edges.find((edge) => edge.id === 'F_AUDIT')!
    mutatedAudit.interactive.relatedStepIds = []

    const issues = validateGraphManifest(mutated)
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid-edge-step-correspondence',
          message: expect.stringContaining('F_AUDIT'),
        }),
      ]),
    )
  })

  it('keeps structural container dimensions synchronized with layout defaults', () => {
    for (const [nodeId, expected] of Object.entries(expectedStructuralSizes())) {
      const node = resolveGraphNode(nodeId)
      expect(node, `Missing structural node ${nodeId}`).toBeDefined()
      expect(node).toMatchObject(expected)
    }
  })

  it('locks PR-corrected structural dimensions against future layoutDefaults drift', () => {
    expect(resolveGraphNode('GW')?.height).toBe(1140)
    expect(resolveGraphNode('BAND_DECIDE')?.height).toBe(730)
    expect(resolveGraphNode('LANE_A')?.height).toBe(1540)
    expect(resolveGraphNode('LANE_B')?.height).toBe(1540)
    expect(resolveGraphNode('LANE_B')?.width).toBe(1180)
    expect(resolveGraphNode('LANE_C')?.height).toBe(1540)
    expect(resolveGraphNode('AEA')?.height).toBe(1280)
    expect(resolveGraphNode('AEA')?.width).toBe(1100)
  })

  it('keeps the canonical connection inventory aligned with the spec', () => {
    const expectedEdges = {
      F_GW1: { source: 'A2', target: 'G1', semantic: 'gateway-internal', style: 'medium', direction: 'ltr' },
      F_GW2: { source: 'G1', target: 'G2', semantic: 'gateway-internal', style: 'medium', direction: 'ttb' },
      F_GW3: { source: 'G2', target: 'G3', semantic: 'gateway-internal', style: 'medium', direction: 'ttb' },
      F1: { source: 'G3', target: 'S1', semantic: 'read-only', style: 'medium', direction: 'ltr' },
      F2: { source: 'S1', target: 'S2', semantic: 'normalization', style: 'thin', direction: 'ltr' },
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
      F_H1_revalidate: { source: 'DEC_H1', target: 'DEC_G2', semantic: 'validation', style: 'dashed', direction: 'ltr' },
      F_H1_reject: { source: 'DEC_H1', target: 'DEC_R2', semantic: 'rejection', style: 'dashed', direction: 'btt' },
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
      F_H1_revalidate: 'Revalidate',
      F_H1_reject: 'Reject plan',
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
    expect(edgeMap.F_H1_revalidate?.source).toBe('DEC_H1')
    expect(edgeMap.F_H1_revalidate?.target).toBe('DEC_G2')
    expect(edgeMap.F_H1_reject?.source).toBe('DEC_H1')
    expect(edgeMap.F_H1_reject?.target).toBe('DEC_R2')
  })

  it('keeps deterministic external-control claims on policy feedback and approval-loop edges', () => {
    const requiredC6Edges = ["F3b'", 'F3f_reject', 'F_H1_revalidate', 'F_H1_reject'] as const

    for (const edgeId of requiredC6Edges) {
      const edge = graphManifest.edges.find((candidate) => candidate.id === edgeId)
      expect(edge, `Missing edge ${edgeId}`).toBeDefined()
      expect(edge?.claimIds).toContain('C6')
    }
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

  it('C1: no agent-kind node exists in Lane A (CPC/OT)', () => {
    const agentsInLaneA = graphManifest.nodes.filter((node) => node.kind === 'agent' && node.lane === 'A')
    expect(agentsInLaneA, 'Agent node found inside CPC lane').toHaveLength(0)
    const agentNode = graphManifest.nodes.find((node) => node.kind === 'agent')
    expect(agentNode?.lane).toBe('B')
  })

  it('C2: sensing path is read-only with diode enforcement and zero write-back bypass into sensing chain', () => {
    // The NE177 gateway chain enforces unidirectionality via diode markers on the gateway-internal edges
    const diodeEdges = graphManifest.edges.filter((edge) => edge.markers.includes('diode'))
    expect(diodeEdges.length, 'Expected at least two diode-marked edges in the NE177 chain').toBeGreaterThanOrEqual(2)
    expect(diodeEdges.every((edge) => edge.id.startsWith('F_GW'))).toBe(true)

    // The read-only entry from gateway to Lane B must carry the read-only semantic
    const readOnlyEdges = graphManifest.edges.filter((edge) => edge.semantic === 'read-only')
    expect(readOnlyEdges.length, 'Expected at least one read-only edge from the gateway').toBeGreaterThan(0)

    // No writeback-semantic edge from Lane B may target Lane A directly (bypass check)
    // Legitimate path: ACT1 (Lane B) → VOI (gateway) → A3 (Lane A) — VOI is the only allowed bridge
    const nodes = Object.fromEntries(graphManifest.nodes.map((node) => [node.id, node]))
    const illegalBypasses = graphManifest.edges.filter((edge) => {
      if (edge.semantic !== 'writeback') return false
      const source = nodes[edge.source]
      const target = nodes[edge.target]
      return source?.lane === 'B' && target?.lane === 'A'
    })
    expect(illegalBypasses, 'Writeback edge crosses directly from Lane B to Lane A, bypassing VOI').toHaveLength(0)
  })

  it('C4: the only write-back initiation path from Lane B is F5 from ACT1 through VOI', () => {
    // F5 must source from ACT1 and terminate at VOI
    const f5 = graphManifest.edges.find((edge) => edge.id === 'F5')
    expect(f5?.source).toBe('ACT1')
    expect(f5?.target).toBe('VOI')
    expect(f5?.semantic).toBe('writeback')

    // The full write-back chain: F5 (ACT1→VOI) → F6 (VOI→A3) → F_CPC_INT (A3→A1)
    // Only F5 may cross from Lane B into the VoR interface — no other Lane-B writeback exists
    const nodes = Object.fromEntries(graphManifest.nodes.map((node) => [node.id, node]))
    const laneBWritebacks = graphManifest.edges.filter((edge) => {
      if (edge.semantic !== 'writeback') return false
      const source = nodes[edge.source]
      return source?.lane === 'B'
    })
    expect(laneBWritebacks, 'Multiple writeback edges originate from Lane B').toHaveLength(1)
    expect(laneBWritebacks[0]?.id).toBe('F5')

    // Only one edge may carry writeback semantics inbound to VOI
    const edgesTargetingVoi = graphManifest.edges.filter((edge) => edge.target === 'VOI')
    expect(edgesTargetingVoi, 'Multiple edges target VOI directly').toHaveLength(1)
    expect(edgesTargetingVoi[0]?.id).toBe('F5')

    // VOI outbound must include the write-back delivery edge (F6) and the ACK edge (F_VoR_ACK)
    const edgesFromVoi = graphManifest.edges.filter((edge) => edge.source === 'VOI')
    const writeFromVoi = edgesFromVoi.filter((edge) => edge.id === 'F6')
    const ackFromVoi = edgesFromVoi.filter((edge) => edge.id === 'F_VoR_ACK')
    expect(writeFromVoi, 'Missing VoR write-back delivery edge F6 from VOI').toHaveLength(1)
    expect(ackFromVoi, 'Missing acknowledgement edge F_VoR_ACK from VOI').toHaveLength(1)
  })

  it('C5: KPI publication flows northbound only and never writes back into actuation', () => {
    const kpiEdges = graphManifest.edges.filter((edge) => edge.semantic === 'kpi')
    expect(kpiEdges.length).toBeGreaterThan(0)

    for (const edge of kpiEdges) {
      const target = graphManifest.nodes.find((node) => node.id === edge.target)
      // KPI must not target nodes in Lane A or the actuation chain
      expect(target?.lane, `${edge.id} KPI edge targets Lane A`).not.toBe('A')
      expect(target?.id, `${edge.id} KPI edge targets actuation node`).not.toBe('ACT1')
      expect(target?.id, `${edge.id} KPI edge targets VoR interface`).not.toBe('VOI')
    }

    // KPI edges must carry C5 claim
    for (const edge of kpiEdges) {
      expect(edge.claimIds, `${edge.id} missing C5 claim`).toContain('C5')
    }
  })

  it('derives board support geometry from live positions rather than static manifest channels', async () => {
    const state = await createState()
    const geometry = buildBoardGeometryFromPositions(state.layout.positions, graphManifest)

    expect(geometry.routeChannels.gatewayApproachX).toBe(geometry.gateway.x - 28)
    expect(geometry.routeChannels.writeY).toBe(geometry.bands.Act.y + 25)
    expect(geometry.routeGuideYs).toContain(geometry.routeChannels.writeY)
    expect(geometry.verticalGuideXs).toContain(geometry.routeChannels.monitorSpineX)
  })

  it('board support geometry follows persisted structural overrides', async () => {
    const positions = await computeBoardNodePositions(graphManifest, {
      ...defaultProjectionOverrides,
      nodePositions: {
        LANE_A: { x: 96, y: 72 },
        GW: { x: 440, y: 160 },
      },
    })

    const geometry = buildBoardGeometryFromPositions(positions, graphManifest)

    expect(geometry.lanes.A.x).toBe(96)
    expect(geometry.lanes.A.y).toBe(72)
    expect(geometry.gateway.x).toBe(440)
    expect(geometry.gateway.y).toBe(160)
    expect(geometry.routeChannels.cpcSpineX).toBe(120)
    expect(geometry.routeChannels.gatewayApproachX).toBe(412)
  })

  it('keeps architecture children inside their parent bounds with the computed board layout', async () => {
    const state = await createState()
    const containmentPairs = [
      { childId: 'AEA', parentId: 'LANE_B' },
      ...graphManifest.nodes
        .filter((node) => node.panel.includes('architecture') && typeof node.parentId === 'string')
        .map((node) => ({ childId: node.id, parentId: node.parentId })),
    ]

    for (const { childId, parentId } of containmentPairs) {
      const childBounds = nodeBounds(state, childId)
      const parentBounds = nodeBounds(state, parentId)
      expect(
        containsBounds(parentBounds, childBounds),
        `${childId} should remain inside ${parentId} after applying layoutDefaults`,
      ).toBe(true)
    }
  })

  it('keeps standards provenance populated and exposes the new NAMUR references to search', () => {
    for (const standard of Object.values(graphManifest.standards)) {
      expect(standard.sourceUrl, `${standard.id} is missing a provenance source URL`).toBeDefined()
      expect(standard.lastReviewed, `${standard.id} is missing a last-reviewed date`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }

    expect(graphManifest.standards.NE176).toMatchObject({
      id: 'NE176',
      label: 'NAMUR NE 176',
      releaseDate: '2022',
    })
    expect(graphManifest.standards.NE179).toMatchObject({
      id: 'NE179',
      label: 'NAMUR NE 179',
      releaseDate: '2023',
    })

    expect(
      buildSearchResults('NAMUR NE 176', graphManifest).some(
        (result) => result.kind === 'standard' && result.id === 'NE176',
      ),
    ).toBe(true)
    expect(
      buildSearchResults('NAMUR NE 179', graphManifest).some(
        (result) => result.kind === 'standard' && result.id === 'NE179',
      ),
    ).toBe(true)
  })
})

describe('derived projections', () => {
  it('maps raw semantics into the grouped semantic families', () => {
    expect(resolveSemanticFamilies(['validation', 'writeback', 'status-ack'])).toEqual(['policy', 'write'])
    expect(getSemanticPresentation('status-ack')).toMatchObject({
      family: 'write',
      label: 'Status acknowledgement',
    })
    expect(getSemanticPresentation('rejection').stroke).not.toBe(getSemanticPresentation('status-ack').stroke)
  })

  it('assigns a unique dash rhythm to each semantic family', () => {
    const dashes = semanticFamilyOrder.map((family) => getSemanticFamilyStrokeDash(family) ?? 'solid')

    expect(new Set(dashes).size).toBe(semanticFamilyOrder.length)
    expect(getSemanticPresentation('tool-call')).toMatchObject({
      marker: 'circle',
      stroke: '#F59E0B',
    })
    expect(getSemanticPresentation('rejection')).toMatchObject({
      marker: 'tee',
      stroke: '#DC2626',
    })
    expect(getSemanticPresentation('retrieval').stroke).toBe('#2B7BE9')
  })

  it('keeps styled writeback edges solid while retaining the family dash as a fallback rhythm', () => {
    expect(getSemanticStrokeDash('writeback', 'medium')).toBeUndefined()
    expect(getSemanticFamilyStrokeDash('write')).toBe('18 5 4 5')
  })

  it('uses surface-aware marker tokens while keeping the canonical marker coordinates shared', () => {
    expect(getSemanticMarkerTokens('architecture')).toMatchObject({
      width: 12,
      height: 10,
      refY: 4,
      viewBox: '0 0 10 8',
      units: 'userSpaceOnUse',
    })
    expect(getSemanticMarkerTokens('legend')).toMatchObject({
      width: 12,
      height: 10,
      refY: 4,
      viewBox: '0 0 10 8',
      units: 'userSpaceOnUse',
    })
    expect(getSemanticMarkerTokens('sequence')).toMatchObject({
      width: 12,
      height: 10,
      refY: 4,
      viewBox: '0 0 10 8',
      units: 'userSpaceOnUse',
    })
    expect(getSemanticMarkerTokens('export-viewport')).toMatchObject({
      width: 12,
      height: 10,
      refY: 4,
      viewBox: '0 0 10 8',
      units: 'userSpaceOnUse',
    })
    expect(getSemanticMarkerTokens('export-publication')).toMatchObject({
      width: 10,
      height: 8,
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
    expect(edgeStrokeWidth('bold', 'writeback')).toBe(2.8)
    expect(edgeStrokeWidth('medium', 'validation')).toBe(2.2)
    expect(edgeStrokeWidth('dashed', 'rejection')).toBe(1.6)
    expect(edgeStrokeWidth('dotted', 'tool-call')).toBe(1.9)
    expect(edgeStrokeWidth('thin', 'retrieval')).toBe(1.4)
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
        semanticFamilies: ['write'],
        lanes: [],
        search: '',
        pathPreset: 'all',
      },
    })

    const derived = deriveDiagramState(state)
    expect(derived.visibleEdgeIds.has('F_VoR_ACK')).toBe(true)
    expect(derived.visibleEdgeIds.has('F3f_reject')).toBe(false)
    expect(derived.visibleEdgeIds.has('PB_ACK')).toBe(true)
    expect(derived.visibleEdgeIds.has('PB_REJECT')).toBe(true)
    expect(derived.visibleEdgeIds.has('F5')).toBe(true)
  })

  it('translates legacy semantics query params into grouped families and writes families back out', () => {
    const parsed = parseUiSearchParams(new URLSearchParams('semantics=validation,status-ack&node=VOI'))
    expect(parsed.selectedNodeId).toBe('VOI')
    expect(parsed.filters.semanticFamilies).toEqual(['policy', 'write'])

    const serialized = buildUiSearchParams({
      selectedNodeId: 'VOI',
      selectedEdgeId: undefined,
      selectedStepId: undefined,
      filters: parsed.filters,
    })
    expect(serialized.get('families')).toBe('policy,write')
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
    expect(architectureMermaid).toContain('stroke:#EF4444,stroke-width:2.8px')
    expect(sequenceMermaid).toContain('%% Canonical topology export only; schematic and not viewport/state-aware.')
    expect(sequenceMermaid).toContain('PB_AEA')
    expect(sequenceMermaid).toContain('PB_REJECT_OUT')
  })

  it('keeps the shifted Decide columns aligned and preserves 38 px gaps across the full grid', async () => {
    const positions = await computeBoardNodePositions(graphManifest, defaultProjectionOverrides)
    const columns = [
      ['DEC_K1', 'DEC_K2', 'DEC_H1'],
      ['DEC_R0', 'DEC_G0', 'DEC_M1'],
      ['DEC_R1', 'DEC_R2', 'DEC_G1'],
      ['DEC_T0', 'DEC_G1A', 'DEC_G2'],
    ] as const
    const routedRows = [
      ['DEC_K1', 'DEC_R0', 'DEC_R1', 'DEC_T0'],
      ['DEC_K2', 'DEC_G0', 'DEC_R2', 'DEC_G1A'],
      ['DEC_H1', 'DEC_M1', 'DEC_G1', 'DEC_G2'],
    ] as const

    expect(resolveGraphNode('DEC_K1')?.width).toBe(230)
    expect(resolveGraphNode('DEC_K2')?.width).toBe(230)
    expect(resolveGraphNode('DEC_R2')?.width).toBe(230)
    expect(resolveGraphNode('DEC_G1')?.width).toBe(230)
    expect(resolveGraphNode('DEC_G2')?.width).toBe(230)
    expect(resolveGraphNode('DEC_M1')?.width).toBe(230)

    for (const column of columns) {
      const [anchorId, ...rest] = column
      const anchorX = positions[anchorId]?.x

      for (const nodeId of rest) {
        expect(positions[nodeId]?.x, `${nodeId} drifted off the shared Decide column`).toBe(anchorX)
      }
    }

    for (const row of routedRows) {
      for (let index = 0; index < row.length - 1; index += 1) {
        const leftId = row[index]
        const rightId = row[index + 1]
        const leftNode = resolveGraphNode(leftId)
        const leftPosition = positions[leftId]
        const rightPosition = positions[rightId]

        if (!leftNode || !leftPosition || !rightPosition) {
          throw new Error(`Missing routed Decide-band layout state for ${leftId} or ${rightId}`)
        }

        expect(
          rightPosition.x - (leftPosition.x + leftNode.width),
          `${leftId} and ${rightId} should keep a 38 px gap`,
        ).toBe(38)
      }
    }
  })

  it('keeps critical architecture routes on their reserved board channels', async () => {
    const state = await createState()
    const expectedRoutes = {
      F3e: {
        path: 'M 1315 818 L 1378 818 Q 1392 818 1392 804 L 1392 766 Q 1392 752 1406 752 L 1468 752',
        labelPoint: { x: 1353.5, y: 798 },
      },
      F_G1A_pass: {
        path: 'M 1583 816 L 1583 866 Q 1583 880 1569 880 L 1329 880 Q 1315 880 1315 894 L 1315 928',
        labelPoint: { x: 1467, y: 880 },
      },
      F_G1A_reject: {
        path: 'M 1468 752 L 1468 810 Q 1468 824 1454 824 L 1444 824 Q 1430 824 1430 810 L 1430 753',
        labelPoint: { x: 1449, y: 842 },
      },
      F3f_reject: {
        path: 'M 1315 1048 L 1315 860 Q 1315 846 1301 846 L 1244 846 Q 1230 846 1230 832 L 1230 767 Q 1230 753 1216 753 L 1200 753',
        labelPoint: { x: 1272.5, y: 864 },
      },
      F3g: {
        path: 'M 779 568 L 779 992 Q 779 1006 793 1006 L 1569 1006 Q 1583 1006 1583 992 L 1583 928',
        labelPoint: { x: 1181, y: 978 },
      },
      F3h: {
        path: 'M 1230 292 L 1230 902 Q 1230 916 1244 916 L 1541 916 Q 1547 916 1547 922 L 1547 922 Q 1547 928 1553 928 L 1583 928',
        labelPoint: { x: 1529, y: 922 },
      },
      F3i: {
        path: 'M 534 1109 L 534 1040 Q 534 1026 548 1026 L 1454 1026 Q 1468 1026 1468 1012 L 1468 992',
        labelPoint: { x: 1001, y: 1012 },
      },
      F_T0_req: {
        path: 'M 1315 688 L 1315 642 Q 1315 628 1329 628 L 1569 628 Q 1583 628 1583 614 L 1583 568',
        labelPoint: { x: 1315, y: 644 },
      },
      F_T1: {
        path: 'M 1468 508 L 1468 441 Q 1468 427 1454 427 L 654 427 Q 640 427 640 413 L 640 224 Q 640 210 654 210 L 744 210 Q 758 210 758 224 L 758 238',
        labelPoint: { x: 640, y: 336.5 },
      },
      F_T2: {
        path: 'M 1468 508 L 894 508',
        labelPoint: { x: 1181, y: 494 },
      },
      F_T0_obs: {
        path: 'M 1583 448 L 1583 620 Q 1583 634 1569 634 L 1061 634 Q 1047 634 1047 648 L 1047 816',
        labelPoint: { x: 1315, y: 592 },
      },
      F4: {
        path: 'M 1583 1056 L 1195 1056 Q 1181 1056 1181 1042 L 1181 942 Q 1181 928 1167 928 L 779 928',
        labelPoint: { x: 1382, y: 1042 },
      },
      F_H1_revalidate: {
        path: 'M 894 988 L 1179 988 Q 1181 988 1181 990 L 1181 990 Q 1181 992 1183 992 L 1468 992',
        labelPoint: { x: 1037.5, y: 974 },
      },
      F_H1_reject: {
        path: 'M 779 928 L 779 882 Q 779 868 793 868 L 1301 868 Q 1315 868 1315 854 L 1315 818',
        labelPoint: { x: 1047, y: 850 },
      },
      F_H1_pass: {
        path: 'M 779 1048 L 779 1087.5 Q 779 1090 781.5 1090 L 781.5 1090 Q 784 1090 784 1092.5 L 784 1212',
        labelPoint: { x: 799, y: 1069 },
      },
      F5: {
        path: 'M 664 1272 L 642 1272 Q 628 1272 628 1258 L 628 1209 Q 628 1195 614 1195 L 576 1195 Q 562 1195 562 1181 L 562 1123 Q 562 1109 548 1109 L 534 1109',
        labelPoint: { x: 595, y: 1219 },
      },
      F6: {
        path: 'M 424 1109 L 374 1109 Q 360 1109 360 1123 L 360 1183 Q 360 1195 348 1195 L 348 1195 Q 336 1195 336 1207 L 336 1253 Q 336 1267 322 1267 L 308 1267',
        labelPoint: { x: 332, y: 1152 },
      },
      F_VoR_ACK: {
        path: 'M 534 1109 L 548 1109 Q 562 1109 562 1123 L 562 1141 Q 562 1155 576 1155 L 620 1155 Q 634 1155 634 1169 L 634 1258 Q 634 1272 648 1272 L 664 1272',
        labelPoint: { x: 590, y: 1132 },
      },
      F_CPC_INT: {
        path: 'M 80 1267 L 62 1267 Q 48 1267 48 1253 L 48 269 Q 48 255 62 255 L 80 255',
        labelPoint: { x: 64, y: 761 },
      },
      F7a: {
        path: 'M 1670 1265 L 1690 1265 Q 1704 1265 1704 1251 L 1704 1197 Q 1704 1183 1718 1183 L 1818 1183 Q 1832 1183 1832 1197 L 1832 1261 Q 1832 1274 1845 1274 L 1858 1274',
        labelPoint: { x: 1768, y: 1203 },
      },
      F7_sub: {
        path: 'M 1958 1390 L 2102 1390 Q 2116 1390 2116 1376 L 2116 1342 Q 2116 1328 2102 1328 L 1958 1328',
        labelPoint: { x: 2037, y: 1372 },
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
      'F_H1_revalidate',
      'F_H1_reject',
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

  it('routes gateway diode edges vertically with dedicated gutter labels', async () => {
    const state = await createState()
    const fGw1 = resolveGraphEdge('F_GW1')
    const fGw2 = resolveGraphEdge('F_GW2')
    const fGw3 = resolveGraphEdge('F_GW3')

    if (!fGw1 || !fGw2 || !fGw3) {
      throw new Error('Expected gateway edges F_GW1, F_GW2, F_GW3 to exist')
    }

    expect(resolveEdgeHandles(fGw1, state.projection.edgeHandles)).toEqual({
      sourceHandle: 'right',
      targetHandle: 'left',
    })
    expect(resolveEdgeHandles(fGw2, state.projection.edgeHandles)).toEqual({
      sourceHandle: 'bottom',
      targetHandle: 'top',
    })
    expect(resolveEdgeHandles(fGw3, state.projection.edgeHandles)).toEqual({
      sourceHandle: 'bottom',
      targetHandle: 'top',
    })

    const routeGw1 = buildArchitectureRoute(state, 'F_GW1')
    const routeGw2 = buildArchitectureRoute(state, 'F_GW2')
    const routeGw3 = buildArchitectureRoute(state, 'F_GW3')

    expect(routeGw2.points).toEqual([
      { x: 480, y: 312 },
      { x: 480, y: 348 },
    ])
    expect(routeGw3.points).toEqual([
      { x: 480, y: 440 },
      { x: 480, y: 472 },
    ])
    expect(resolveBoardLabelPosition(routeGw1.label)).toEqual({ x: 370, y: 254 })
    expect(resolveBoardLabelPosition(routeGw2.label)).toEqual({ x: 584, y: 330 })
    expect(resolveBoardLabelPosition(routeGw3.label)).toEqual({ x: 584, y: 456 })
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
      { edgeId: 'F_H1_revalidate', nodes: ['DEC_H1', 'DEC_G2', 'DEC_G1'] },
      { edgeId: 'F_H1_reject', nodes: ['DEC_H1', 'DEC_R2', 'DEC_M1'] },
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

  it('keeps rejection and monitor reroutes on distinct local channels', async () => {
    const state = await createState()
    const rejectionRoutes = {
      F_G1A_reject: 824,
      F3f_reject: 846,
      F_H1_reject: 868,
    } as const

    for (const [edgeId, expectedY] of Object.entries(rejectionRoutes)) {
      const route = buildArchitectureRoute(state, edgeId)
      expect(route.points[1]?.y).toBe(expectedY)
      expect(route.points[2]?.y).toBe(expectedY)
    }

    expect(buildArchitectureRoute(state, 'F_M1_G0').points).toEqual([
      { x: 1162, y: 752 },
      { x: 1162, y: 870 },
      { x: 932, y: 870 },
      { x: 932, y: 988 },
    ])
    expect(buildArchitectureRoute(state, 'F_M1_H1').points).toEqual([
      { x: 894, y: 988 },
      { x: 932, y: 988 },
    ])
  })

  it('keeps Panel B acknowledgement and rejection routes on the shared sequence geometry', async () => {
    const state = await createState()
    const derived = deriveDiagramState(state)
    const board = compileSequenceBoard(state, derived)
    const ackEdge = board.edges.find((edge) => edge.edge.id === 'PB_ACK')
    const rejectEdge = board.edges.find((edge) => edge.edge.id === 'PB_REJECT')

    expect(board.ackRouteY).toBe(220)
    expect(ackEdge?.path).toContain('Q')
    expect(ackEdge).toMatchObject({
      labelX: 655.5,
      labelY: 220,
    })
    expect(rejectEdge?.path).toContain('Q')
    expect(rejectEdge).toMatchObject({
      labelX: 1042,
      labelY: 261,
    })
    expect(board.height).toBe(432)
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
    for (const edgeId of ['F_G1A_pass', 'F_T1', 'F_T0_obs', 'F4', 'F_H1_revalidate', 'F_H1_reject', 'F_H1_pass', 'F5', 'F6', 'F_VoR_ACK', 'F_CPC_INT', 'F7a', 'F7_sub']) {
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
    expect(publicationDocument.svg).toContain('stroke-dasharray="7 4"')
    expect(publicationDocument.svg).toContain('id="marker-gateway-internal-diode"')
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

    expect(viewportDocument.svg).toContain('id="marker-gateway-internal-diamond"')
    expect(viewportDocument.svg).toContain('id="marker-tool-call-circle"')
    expect(viewportDocument.svg).toContain('id="marker-rejection-tee"')
    expect(viewportDocument.svg).toContain('markerWidth="12"')
    expect(viewportDocument.svg).toContain('markerHeight="10"')
    expect(viewportDocument.svg).toContain('refY="4"')
    expect(viewportDocument.svg).toContain('markerUnits="userSpaceOnUse"')
    expect(viewportDocument.svg).toContain('stroke-width="3.6"')
    expect(viewportDocument.svg).toContain('stroke-width="2.7"')
    expect(viewportDocument.svg).toContain('stroke-width="1.7"')
    expect(viewportDocument.svg).toContain('stroke-dasharray="7 4"')
    expect(viewportDocument.svg).toContain('stroke-dasharray="2 5"')
    expect(viewportDocument.svg).toContain('stroke-dasharray="1 5"')
    expect(publicationDocument.svg).toContain('markerWidth="10"')
    expect(publicationDocument.svg).toContain('markerHeight="8"')
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
