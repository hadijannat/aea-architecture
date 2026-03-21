import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
import {
  anchorPointForRect,
  buildBoardEdgeRouteFromPositions,
  buildBoardGeometryFromNodes,
  buildBoardGeometryFromPositions,
} from '@/layout/boardGeometry'
import { compareHandleIds, normalizeHandleId, parseHandleId, resolveEdgeHandles } from '@/layout/ports'
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
      width: graphManifest.layoutDefaults.aea.width - 56,
      height: graphManifest.layoutDefaults.aea.bandHeights.Sense,
    },
    BAND_DECIDE: {
      width: graphManifest.layoutDefaults.aea.width - 56,
      height: graphManifest.layoutDefaults.aea.bandHeights.Decide,
    },
    BAND_ACT: {
      width: graphManifest.layoutDefaults.aea.width - 56,
      height: graphManifest.layoutDefaults.aea.bandHeights.Act,
    },
  } as const
}

function findRepoRoot(startDir: string) {
  let current = startDir

  while (true) {
    if (
      existsSync(resolve(current, 'package.json')) &&
      existsSync(resolve(current, 'docs/AEA_Figure_Specification.md')) &&
      existsSync(resolve(current, 'src/test/graph.spec.ts'))
    ) {
      return current
    }

    const parent = resolve(current, '..')
    if (parent === current) {
      return startDir
    }
    current = parent
  }
}

const repoRoot = findRepoRoot(process.cwd())
const readRepoText = (relativePath: string) => readFileSync(resolve(repoRoot, relativePath), 'utf8')

const masterSpecMarkdown = readRepoText('docs/AEA_Figure_Specification.md')
const infographicBlueprintMarkdown = readRepoText('docs/AEA_Infographic_Blueprint.md')
const readmeMarkdown = readRepoText('README.md')

const canonicalSpecCriticalEdgeIds = [
  'F_G0_pol',
  'F_G2_reject',
  'F_H1_revalidate',
  'F_H1_reject',
  'F_M1_G0',
  'F_M1_R0',
  'F_M1_T0',
  'F_M1_G1A',
  'F_M1_H1',
  'PB_F1',
  'PB_F2',
  'PB_F3',
  'PB_F4',
] as const

describe('graph manifest', () => {
  it('passes integrity and semantic validation', () => {
    const issues = validateGraphManifest(graphManifest)
    expect(issues).toEqual([])
  })

  it('keeps published docs aligned on counts, ACK semantics, and the writeback model', () => {
    expect(masterSpecMarkdown).toMatch(/six independent architectural claims/i)
    expect(masterSpecMarkdown).toMatch(/five distinct arrow styles/i)
    expect(masterSpecMarkdown).toContain('0.75 pt dotted')
    expect(masterSpecMarkdown).toContain('status: {accepted | rejected | executed | timeout}')
    expect(masterSpecMarkdown).toContain('max_iterations')
    expect(masterSpecMarkdown).toContain('t1')
    expect(masterSpecMarkdown).toContain('`F_VoR_ACK` returns only to `ACT1`; `ACT3` receives the durable audit trail')

    expect(readmeMarkdown).toContain(
      '36 nodes, 51 edges, 5 sequence steps, 6 architectural claims, and 17 standards anchors.',
    )

    expect(infographicBlueprintMarkdown).toMatch(/\*\*Exactly 1\*\* exclusive writeback corridor can reach CPC\./)
    expect(infographicBlueprintMarkdown).toContain('accepted | rejected | executed | timeout')
    expect(infographicBlueprintMarkdown).toContain('AAS Part 1 and Part 2 run at **v3.1.1**.')
    expect(infographicBlueprintMarkdown).toContain('Metamodel and API references refreshed in **July 2025**.')
  })

  it('documents every critical manifest-backed edge in the master specification', () => {
    for (const edgeId of canonicalSpecCriticalEdgeIds) {
      expect(masterSpecMarkdown, `Missing ${edgeId} in master specification`).toContain(edgeId)
    }
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

  it('allows the five canonical planner inbound edges', () => {
    const plannerInbound = graphManifest.edges.filter((edge) => edge.target === 'DEC_R2')
    expect(plannerInbound.map((edge) => edge.id).sort()).toEqual([
      'F3f_reject',
      'F_G0_out',
      'F_G1A_reject',
      'F_G2_reject',
      'F_H1_reject',
    ])

    const issues = validateGraphManifest(graphManifest)
    const plannerIssues = issues.filter((issue) => issue.code === 'unauthorized-planner-ingress')
    expect(plannerIssues).toEqual([])
  })

  it('reports zero claim-coverage issues for the unmodified manifest', () => {
    const issues = validateGraphManifest(graphManifest)
    const claimIssues = issues.filter(
      (issue) => issue.code === 'orphaned-claim-node' || issue.code === 'orphaned-claim-edge',
    )
    expect(claimIssues).toEqual([])
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

  it('reports zero standard-coverage issues for the unmodified manifest', () => {
    const issues = validateGraphManifest(graphManifest)
    const standardIssues = issues.filter((issue) => issue.code === 'orphaned-standard')
    expect(standardIssues).toEqual([])
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
    expect(resolveGraphNode('GW')?.height).toBe(1432)
    expect(resolveGraphNode('BAND_DECIDE')?.height).toBe(982)
    expect(resolveGraphNode('LANE_A')?.height).toBe(1952)
    expect(resolveGraphNode('LANE_B')?.height).toBe(1952)
    expect(resolveGraphNode('LANE_B')?.width).toBe(1480)
    expect(resolveGraphNode('LANE_C')?.height).toBe(1952)
    expect(resolveGraphNode('AEA')?.height).toBe(1632)
    expect(resolveGraphNode('AEA')?.width).toBe(1340)
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
      F_G2_reject: { source: 'DEC_G2', target: 'DEC_R2', semantic: 'rejection', style: 'dashed', direction: 'rtl' },
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
      F6: { source: 'VOI', target: 'A3', semantic: 'writeback', style: 'bold', direction: 'ltr' },
      F_VoR_ACK: { source: 'VOI', target: 'ACT1', semantic: 'status-ack', style: 'dashed', direction: 'rtl' },
      F_CPC_INT: { source: 'A3', target: 'A1', semantic: 'writeback', style: 'medium', direction: 'ttb' },
      F7a: { source: 'ACT2', target: 'C1', semantic: 'kpi', style: 'thin', direction: 'ltr' },
      F7b: { source: 'C1', target: 'C2', semantic: 'kpi', style: 'thin', direction: 'ltr' },
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
      F_G2_reject: 'Reject bounds',
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
    expect(boldEdges).toHaveLength(2)
    expect(boldEdges.map((edge) => edge.id).sort()).toEqual(['F5', 'F6'])
  })

  it('keeps F3i sourced from VOI and DEC_G2 aliased from DEC3', () => {
    const f3i = graphManifest.edges.find((edge) => edge.id === 'F3i')
    const validatorNode = graphManifest.nodes.find((node) => node.id === 'DEC_G2')
    const validatorReject = graphManifest.edges.find((edge) => edge.id === 'F_G2_reject')
    expect(f3i?.source).toBe('VOI')
    expect(validatorNode?.aliases).toContain('DEC3')
    expect(validatorReject?.interactive.sourceHandle).toBe('top')
    expect(validatorReject?.interactive.targetHandle).toBe('bottom')
  })

  it('keeps VoR interface copy aligned with the audit-event model', () => {
    const voi = resolveGraphNode('VOI')
    expect(voi?.description).toContain('audit event emission')
    expect(voi?.inspector.notes.some((note) => note.includes('emits audit events for ACT3 to persist.'))).toBe(true)
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
    expect(edgeMap.F_G2_reject?.source).toBe('DEC_G2')
    expect(edgeMap.F_G2_reject?.target).toBe('DEC_R2')
    expect(edgeMap.F_H1_reject?.source).toBe('DEC_H1')
    expect(edgeMap.F_H1_reject?.target).toBe('DEC_R2')
  })

  it('keeps deterministic external-control claims on policy feedback and approval-loop edges', () => {
    const requiredC6Edges = ["F3b'", 'F3f_reject', 'F_G2_reject', 'F_H1_revalidate', 'F_H1_reject'] as const

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
    expect(rule?.triggerIds).toContain('node:DEC_G2')
    expect(rule?.relatedNodeIds).toContain('node:DEC_G2')
    expect(rule?.relatedEdgeIds).toContain('edge:F_G2_reject')
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

    expect(geometry.routeChannels.gatewayApproachX).toBe(geometry.gateway.x - 38)
    expect(geometry.routeChannels.writeY).toBe(geometry.bands.Act.y + 34)
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
    expect(geometry.routeChannels.cpcSpineX).toBe(130)
    expect(geometry.routeChannels.gatewayApproachX).toBe(402)
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
      if (!parentId) {
        throw new Error(`Missing parentId for ${childId}`)
      }
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
      releaseDate: '2021-06-16',
    })
    expect(graphManifest.standards.NE179).toMatchObject({
      id: 'NE179',
      label: 'NAMUR NE 179',
      releaseDate: '2023',
    })
    for (const standardId of ['IEC63278', 'NISTAIRMF10', 'NISTAI6001', 'OWASPLMM25', 'MQTT5', 'IEC61987'] as const) {
      expect(graphManifest.standards[standardId]?.lastReviewed).toBe('2026-03-21')
    }

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
    expect(edgeStrokeWidth('bold', 'writeback')).toBe(3.8)
    expect(edgeStrokeWidth('medium', 'validation')).toBeCloseTo(2.7)
    expect(edgeStrokeWidth('dashed', 'rejection')).toBe(1.6)
    expect(edgeStrokeWidth('dotted', 'tool-call')).toBeCloseTo(1.8)
    expect(edgeStrokeWidth('thin', 'retrieval')).toBeCloseTo(1.5)
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

  it('keeps supportive search matches visible at overview zoom', async () => {
    const state = await createState({
      filters: {
        claims: [],
        standards: [],
        semanticFamilies: [],
        lanes: [],
        search: 'F_T1',
        pathPreset: 'all',
      },
      viewport: {
        ...graphManifest.layoutDefaults.viewport,
        zoom: 0.49,
      },
    })

    const derived = deriveDiagramState(state)
    const edge = compileArchitectureEdges(state, callbacks, derived).find((candidate) => candidate.id === 'F_T1')

    expect(derived.visibleEdgeIds.has('F_T1')).toBe(true)
    expect(edge).toBeDefined()
    expect(edge?.hidden).toBe(false)
    expect(edge?.data?.labelMode).toBe('hidden')
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
    expect(architectureMermaid).toContain('stroke:#EF4444,stroke-width:3.8px')
    expect(sequenceMermaid).toContain('%% Canonical topology export only; schematic and not viewport/state-aware.')
    expect(sequenceMermaid).toContain('PB_AEA')
    expect(sequenceMermaid).toContain('PB_REJECT_OUT')
  })

  it('keeps the shifted Decide columns aligned and preserves 116 px gaps across the full grid', async () => {
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
          `${leftId} and ${rightId} should keep a 116 px gap`,
        ).toBe(116)
      }
    }
  })

  it('keeps critical architecture routes on their reserved board channels', async () => {
    const state = await createState()
    const expectedRoutes = {
      F3e: {
        points: [
          { x: 1686, y: 947 },
          { x: 1744, y: 947 },
          { x: 1744, y: 946 },
          { x: 1802, y: 946 },
        ],
        labelPoint: { x: 1715, y: 965 },
      },
      F_G1A_pass: {
        points: [
          { x: 1917, y: 1010 },
          { x: 1917, y: 1146 },
          { x: 1571, y: 1146 },
          { x: 1571, y: 1218 },
        ],
        labelPoint: { x: 1593, y: 1182 },
      },
      F_G1A_reject: {
        points: [
          { x: 1917, y: 1010 },
          { x: 1917, y: 1028 },
          { x: 1917, y: 1046 },
          { x: 1889, y: 1046 },
          { x: 1599, y: 1046 },
          { x: 1571, y: 1046 },
          { x: 1571, y: 1030 },
          { x: 1571, y: 1012 },
        ],
        labelPoint: { x: 1744, y: 1064 },
      },
      F3f_reject: {
        points: [
          { x: 1555, y: 1218 },
          { x: 1555, y: 1200 },
          { x: 1555, y: 1080 },
          { x: 1593, y: 1080 },
          { x: 1517, y: 1080 },
          { x: 1555, y: 1080 },
          { x: 1555, y: 1030 },
          { x: 1555, y: 1012 },
        ],
        labelPoint: { x: 1555, y: 1098 },
      },
      F3g: {
        points: [
          { x: 879, y: 546 },
          { x: 879, y: 528 },
          { x: 879, y: 518 },
          { x: 1744, y: 518 },
          { x: 1744, y: 1200 },
          { x: 1917, y: 1200 },
          { x: 1917, y: 1218 },
        ],
        labelPoint: { x: 1311.5, y: 500 },
      },
      F3h: {
        path: 'M 1418 352 L 1427 352 Q 1436 352 1436 361 L 1436 1123.5 Q 1436 1143 1455.5 1143 L 1461 1143 Q 1475 1143 1475 1129 L 1475 1129 Q 1475 1115 1489 1115 L 1880 1115 Q 1894 1115 1894 1129 L 1894 1129 Q 1894 1143 1908 1143 L 1913.5 1143 Q 1933 1143 1933 1162.5 L 1933 1200 L 1933 1218',
        labelPoint: { x: 1684.5, y: 1097 },
      },
      F3i: {
        points: [
          { x: 596, y: 1345 },
          { x: 614, y: 1345 },
          { x: 614, y: 494 },
          { x: 1744, y: 494 },
          { x: 1744, y: 1200 },
          { x: 1901, y: 1200 },
          { x: 1901, y: 1218 },
        ],
        labelPoint: { x: 1179, y: 476 },
      },
      F_T0_req: {
        points: [
          { x: 1686, y: 947 },
          { x: 1686, y: 807 },
          { x: 1917, y: 807 },
          { x: 1917, y: 666 },
        ],
        labelPoint: { x: 1686, y: 863 },
      },
      F_T1: {
        path: 'M 1802 606 L 1802 530 Q 1802 510 1782 510 L 774 510 Q 754 510 754 490 L 754 266 Q 754 246 774 246 L 855 246 Q 872 246 872 263 L 872 280',
        labelPoint: { x: 754, y: 396 },
      },
      F_T2: {
        path: 'M 1802 606 L 1802 546 Q 1802 526 1782 526 L 1014 526 Q 994 526 994 546 L 994 606',
        labelPoint: { x: 1398, y: 512 },
      },
      F_T0_obs: {
        path: 'M 1917 546 L 1917 778 Q 1917 798 1897 798 L 1245 798 Q 1225 798 1225 818 L 1225 1010',
        labelPoint: { x: 1571, y: 756 },
      },
      F4: {
        path: 'M 1917 1346 L 1917 1364 L 1917 1331 Q 1917 1316 1902 1316 L 1887 1316 L 909 1316 L 894 1316 Q 879 1316 879 1301 L 879 1200 L 879 1218',
        labelPoint: { x: 1398, y: 1298 },
      },
      F_H1_revalidate: {
        path: 'M 994 1278 L 994 1352 Q 994 1372 1014 1372 L 1782 1372 Q 1802 1372 1802 1352 L 1802 1282',
        labelPoint: { x: 1398, y: 1390 },
      },
      F_G2_reject: {
        path: 'M 1885 1218 L 1885 1200 L 1885 1168 Q 1885 1148 1865 1148 L 1827 1148 L 1597 1148 L 1559 1148 Q 1539 1148 1539 1128 L 1539 1030 L 1539 1012',
        labelPoint: { x: 1712, y: 1166 },
      },
      F_H1_reject: {
        points: [
          { x: 895, y: 1218 },
          { x: 895, y: 1200 },
          { x: 895, y: 1114 },
          { x: 943, y: 1114 },
          { x: 1539, y: 1114 },
          { x: 1587, y: 1114 },
          { x: 1587, y: 1030 },
          { x: 1587, y: 1012 },
        ],
        labelPoint: { x: 1241, y: 1132 },
      },
      F_H1_pass: {
        path: 'M 879 1338 L 879 1369.5 Q 879 1380 889.5 1380 L 889.5 1380 Q 900 1380 900 1390.5 L 900 1576',
        labelPoint: { x: 899, y: 1359 },
      },
      F5: {
        path: 'M 780 1620 L 771 1620 Q 762 1620 762 1611 L 762 1547.5 Q 762 1528 742.5 1528 L 737 1528 Q 723 1528 723 1542 L 723 1542 Q 723 1556 709 1556 L 667 1556 Q 653 1556 653 1542 L 653 1542 Q 653 1528 639 1528 L 633.5 1528 Q 614 1528 614 1508.5 L 614 1354 Q 614 1345 605 1345 L 596 1345',
        labelPoint: { x: 688, y: 1528 },
      },
      F6: {
        path: 'M 486 1377 L 477 1377 Q 468 1377 468 1386 L 468 1564.5 Q 468 1584 448.5 1584 L 443 1584 Q 429 1584 429 1570 L 429 1570 Q 429 1556 415 1556 L 395 1556 Q 381 1556 381 1570 L 381 1570 Q 381 1584 367 1584 L 346.5 1584 Q 342 1584 342 1579.5 L 342 1579.5 Q 342 1575 337.5 1575 L 324 1575',
        labelPoint: { x: 405, y: 1528 },
      },
      F_VoR_ACK: {
        path: 'M 596 1361 L 605 1361 Q 614 1361 614 1370 L 614 1487 Q 614 1502 629 1502 L 644 1502 L 732 1502 L 747 1502 Q 762 1502 762 1517 L 762 1627 Q 762 1636 771 1636 L 780 1636',
        labelPoint: { x: 688, y: 1482 },
      },
      F_CPC_INT: {
        path: 'M 96 1559 L 80 1559 Q 64 1559 64 1543 L 64 311 Q 64 295 80 295 L 96 295',
        labelPoint: { x: 80, y: 927 },
      },
      F7a: {
        path: 'M 1958 1629 L 1975 1629 Q 1992 1629 1992 1612 L 1992 1557 Q 1992 1537 2012 1537 L 2236.5 1537 Q 2250 1537 2250 1550.5 L 2250 1551 Q 2250 1564 2263 1564 L 2276 1564',
        labelPoint: { x: 2121, y: 1557 },
      },
      F7_sub: {
        path: 'M 2376 1720 L 2532 1720 Q 2552 1720 2552 1700 L 2552 1638 Q 2552 1618 2532 1618 L 2376 1618',
        labelPoint: { x: 2464, y: 1702 },
      },
    } as const

    for (const [edgeId, expected] of Object.entries(expectedRoutes)) {
      const route = buildArchitectureRoute(state, edgeId)
      if ('points' in expected) {
        expect(route.points).toEqual(expected.points)
      } else {
        expect(route.path).toBe(expected.path)
      }
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
      'F_G2_reject',
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
      sourceHandle: 'right:gateway:0',
      targetHandle: 'left:gateway:0',
    })
    expect(resolveEdgeHandles(fGw2, state.projection.edgeHandles)).toEqual({
      sourceHandle: 'bottom:gateway:0',
      targetHandle: 'top:gateway:0',
    })
    expect(resolveEdgeHandles(fGw3, state.projection.edgeHandles)).toEqual({
      sourceHandle: 'bottom:gateway:0',
      targetHandle: 'top:gateway:0',
    })

    const routeGw1 = buildArchitectureRoute(state, 'F_GW1')
    const routeGw2 = buildArchitectureRoute(state, 'F_GW2')
    const routeGw3 = buildArchitectureRoute(state, 'F_GW3')

    expect(routeGw2.points).toEqual([
      { x: 542, y: 348 },
      { x: 542, y: 416 },
    ])
    expect(routeGw3.points).toEqual([
      { x: 542, y: 508 },
      { x: 542, y: 570 },
    ])
    expect(resolveBoardLabelPosition(routeGw1.label)).toEqual({ x: 416, y: 290 })
    expect(resolveBoardLabelPosition(routeGw2.label)).toEqual({ x: 670, y: 382 })
    expect(resolveBoardLabelPosition(routeGw3.label)).toEqual({ x: 670, y: 539 })
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
      { edgeId: 'F1', nodes: ['S1', 'S2'] },
      { edgeId: 'F_R0_out', nodes: ['DEC_R0', 'DEC_R1'] },
      { edgeId: 'F3d', nodes: ['DEC_R0', 'DEC_K1', 'DEC_T0'] },
      { edgeId: 'F3e', nodes: ['DEC_R2', 'DEC_G1A'] },
      { edgeId: 'F3f_reject', nodes: ['DEC_R2', 'DEC_G1A'] },
      { edgeId: 'F3i', nodes: ['DEC_H1', 'DEC_M1', 'DEC_G1'] },
      { edgeId: 'F4', nodes: ['DEC_G1', 'DEC_G2', 'DEC_M1'] },
      { edgeId: 'F_G2_reject', nodes: ['DEC_R2', 'DEC_G2'] },
      { edgeId: 'F_G1A_pass', nodes: ['DEC_G1A', 'DEC_G1', 'DEC_M1'] },
      { edgeId: 'F_T1', nodes: ['S1', 'S2', 'DEC_T0'] },
      { edgeId: 'F_T0_obs', nodes: ['DEC_T0', 'DEC_G0', 'DEC_R2'] },
      { edgeId: 'F_H1_revalidate', nodes: ['DEC_M1', 'DEC_G1', 'DEC_G2'] },
      { edgeId: 'F_H1_reject', nodes: ['DEC_H1', 'DEC_R2', 'DEC_M1'] },
      { edgeId: 'F_H1_pass', nodes: ['DEC_H1', 'ACT1', 'ACT3'] },
      { edgeId: 'F_CPC_INT', nodes: ['A1', 'A2', 'A3'] },
      { edgeId: "F3b'", nodes: ['DEC_K2', 'DEC_G0', 'DEC_R2'] },
      { edgeId: 'F_M1_R0', nodes: ['DEC_R0', 'DEC_R1', 'DEC_R2', 'DEC_M1'] },
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
    const geometry = buildBoardGeometryFromPositions(state.layout.positions, graphManifest)
    const rejectionRoutes = {
      F_G1A_reject: { trenchY: geometry.routeChannels.rejectionY + 0, targetHandle: 'bottom:feedback:0' },
      F3f_reject: { trenchY: geometry.routeChannels.rejectionY + 34, targetHandle: 'bottom:feedback:1' },
      F_H1_reject: { trenchY: geometry.routeChannels.rejectionY + 68, targetHandle: 'bottom:feedback:2' },
      F_G2_reject: { trenchY: geometry.routeChannels.rejectionY + 102, targetHandle: 'bottom:feedback:3' },
    } as const

    for (const [edgeId, expected] of Object.entries(rejectionRoutes)) {
      const edge = resolveGraphEdge(edgeId)
      if (!edge) {
        throw new Error(`Expected rejection edge ${edgeId} to exist`)
      }

      const handles = resolveEdgeHandles(edge, state.projection.edgeHandles)
      const route = buildArchitectureRoute(state, edgeId)

      expect(handles.targetHandle).toBe(expected.targetHandle)
      expect(route.points[2]?.y).toBe(expected.trenchY)
      expect(route.points[3]?.y).toBe(expected.trenchY)
      expect(route.points[4]?.y).toBe(expected.trenchY)
      expect((route.points.at(-2)?.y ?? 0) > (route.points.at(-1)?.y ?? 0), `${edgeId} should enter DEC_R2 from below`).toBe(true)
    }

    const monitorEdgeIds = ['F_M1_G0', 'F_M1_R0', 'F_M1_T0', 'F_M1_G1A', 'F_M1_H1'] as const
    for (const edgeId of monitorEdgeIds) {
      const edge = resolveGraphEdge(edgeId)
      if (!edge) {
        throw new Error(`Expected monitor edge ${edgeId} to exist`)
      }

      const handles = resolveEdgeHandles(edge, state.projection.edgeHandles)
      const route = buildArchitectureRoute(state, edgeId)

      expect(handles.targetHandle).toBe('top:monitor:0')
      expect(route.points[2]?.x).toBe(geometry.routeChannels.monitorSpineX)
      expect(route.points[3]?.x).toBe(geometry.routeChannels.monitorSpineX)
      expect(route.points[3]?.y).toBe(geometry.routeChannels.monitorDropY)
      expect(route.points[4]?.y).toBe(geometry.routeChannels.monitorDropY)
    }

    expect(buildArchitectureRoute(state, 'F3d').points).toEqual([
      { x: 1319, y: 396 },
      { x: 1319, y: 414 },
      { x: 1319, y: 826 },
      { x: 1280, y: 826 },
      { x: 1280, y: 798 },
      { x: 1280, y: 826 },
      { x: 1241, y: 826 },
      { x: 1241, y: 864 },
      { x: 1241, y: 882 },
    ])
    expect(buildArchitectureRoute(state, 'F3g').points[3]?.y).toBe(geometry.routeChannels.ceilingY)
    expect(buildArchitectureRoute(state, 'F3i').points[3]?.y).toBe(geometry.routeChannels.ceilingY - 24)
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
    for (const edgeId of ['F_G1A_pass', 'F_T1', 'F_T0_obs', 'F4', 'F_H1_revalidate', 'F_G2_reject', 'F_H1_reject', 'F_H1_pass', 'F5', 'F6', 'F_VoR_ACK', 'F_CPC_INT', 'F7a', 'F7_sub']) {
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
    expect(publicationDocument.svg).toContain('F5 · VoR request (non-plant-specific, authenticated)')
    expect(publicationDocument.svg).toContain('F4 · validated candidate plan (approval pending)')
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
    expect(publicationDocument.svg).toContain('stroke-width="0.75"')
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

  it('normalizes slot handles while preserving bare-side compatibility', () => {
    expect(parseHandleId('left')).toEqual({
      raw: 'left:default:0',
      side: 'left',
      family: 'default',
      index: 0,
      legacy: true,
    })
    expect(parseHandleId('right:policy:2')).toEqual({
      raw: 'right:policy:2',
      side: 'right',
      family: 'policy',
      index: 2,
      legacy: false,
    })
    expect(parseHandleId('top:ceiling:1')).toEqual({
      raw: 'top:ceiling:1',
      side: 'top',
      family: 'ceiling',
      index: 1,
      legacy: false,
    })
    expect(parseHandleId('right:monitor:3')).toEqual({
      raw: 'right:monitor:3',
      side: 'right',
      family: 'monitor',
      index: 3,
      legacy: false,
    })
    expect(normalizeHandleId('top')).toBe('top:default:0')
    expect(compareHandleIds('right:policy:1', 'right:policy:2')).toBeLessThan(0)

    const f5 = resolveGraphEdge('F5')
    const f3b = resolveGraphEdge('F3b')
    const f3g = resolveGraphEdge('F3g')
    const fM1G0 = resolveGraphEdge('F_M1_G0')
    if (!f5 || !f3b || !f3g || !fM1G0) {
      throw new Error('Expected F5, F3b, F3g, and F_M1_G0 edge specs to exist')
    }

    expect(resolveEdgeHandles(f3b, {})).toEqual({
      sourceHandle: 'right:policy:0',
      targetHandle: 'left:policy:0',
    })
    expect(resolveEdgeHandles(f5, { F5: { sourceHandle: 'top', targetHandle: 'bottom' } })).toEqual({
      sourceHandle: 'top:default:0',
      targetHandle: 'bottom:default:0',
    })
    expect(resolveEdgeHandles(f3g, {})).toEqual({
      sourceHandle: 'top:ceiling:0',
      targetHandle: 'top:ceiling:0',
    })
    expect(resolveEdgeHandles(fM1G0, {})).toEqual({
      sourceHandle: 'right:monitor:0',
      targetHandle: 'top:monitor:0',
    })
  })

  it('uses the shifted Decide grid fallbacks when hidden nodes are omitted from board geometry', async () => {
    const positions = await computeBoardNodePositions(graphManifest, defaultProjectionOverrides)
    const nodes = graphManifest.nodes
      .filter((node) => node.panel.includes('architecture'))
      .map((node) => ({
        id: node.id,
        position: positions[node.id]!,
        width: node.width,
        height: node.height,
        hidden: node.id === 'DEC_R1' || node.id === 'DEC_T0',
      }))

    const geometry = buildBoardGeometryFromNodes(nodes, [])

    expect(geometry.routeChannels.decideCol12GapX).toBe(1398)
    expect(geometry.routeChannels.decideCol23GapX).toBe(1744)
  })

  it('keeps DEC_R2 on strict ingress, egress, and rejection handle families', () => {
    const edgeIds = {
      F_G0_out: { sourceHandle: 'right:default:0', targetHandle: 'top:default:0' },
      F3e: { sourceHandle: 'right:default:0', targetHandle: 'left:default:0' },
      F_T0_req: { sourceHandle: 'right:default:0', targetHandle: 'bottom:default:0' },
      F_G1A_reject: { sourceHandle: 'bottom:feedback:0', targetHandle: 'bottom:feedback:0' },
      F3f_reject: { sourceHandle: 'top:feedback:1', targetHandle: 'bottom:feedback:1' },
      F_H1_reject: { sourceHandle: 'top:feedback:2', targetHandle: 'bottom:feedback:2' },
      F_G2_reject: { sourceHandle: 'top:feedback:3', targetHandle: 'bottom:feedback:3' },
    } as const

    for (const [edgeId, expected] of Object.entries(edgeIds)) {
      const edge = resolveGraphEdge(edgeId)
      if (!edge) {
        throw new Error(`Expected ${edgeId} to exist`)
      }

      expect(resolveEdgeHandles(edge, {})).toEqual(expected)
    }
  })

  it('anchors slot handles away from the side midpoint without crossing node corners', () => {
    const rect = { x: 100, y: 200, width: 120, height: 80 }

    expect(anchorPointForRect(rect, 'right:default:0')).toEqual({ x: 220, y: 240 })
    expect(anchorPointForRect(rect, 'right:policy:1')).toEqual({ x: 220, y: 224 })
    expect(anchorPointForRect(rect, 'bottom:writeback:2')).toEqual({ x: 176, y: 280 })
    expect(anchorPointForRect(rect, 'left:validation:3')).toEqual({ x: 100, y: 214 })
  })
})
