import { buildSearchResults } from '@/graph/compile/searchIndex'
import { compileSequenceBoard } from '@/graph/compile/sequenceBoard'
import { buildExportSvgDocument } from '@/graph/compile/toExportSvg'
import mermaid from 'mermaid'
import { describe, expect, it } from 'vitest'

import { deriveDiagramState } from '@/graph/compile/toReactFlow'
import { toMermaid } from '@/graph/compile/toMermaid'
import { defaultProjectionOverrides, graphManifest } from '@/graph/spec/manifest'
import { validateGraphManifest } from '@/graph/spec/validators'
import { computeBoardNodePositions } from '@/layout/boardLayout'
import { useDiagramStore, type DiagramStore } from '@/state/diagramStore'

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
        semantics: [],
        lanes: [],
        search: '',
        pathPreset: 'all',
      },
      highlightedEntityKeys: [],
      viewport: graphManifest.layoutDefaults.viewport,
      panelBVisible: true,
      panelBSize: 24,
      viewportLocked: false,
      ...overrides,
    },
    actions: {} as DiagramStore['actions'],
  }
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
      PB_F1: { source: 'PB1', target: 'PB2', semantic: 'sequence', style: 'medium', direction: 'ltr' },
      PB_F2: { source: 'PB2', target: 'PB3', semantic: 'sequence', style: 'medium', direction: 'ltr' },
      PB_F3: { source: 'PB3', target: 'PB4', semantic: 'sequence', style: 'medium', direction: 'ltr' },
      PB_F4: { source: 'PB4', target: 'PB5', semantic: 'sequence', style: 'medium', direction: 'ltr' },
      PB_ACK: { source: 'PB5', target: 'PB_AEA', semantic: 'status-ack', style: 'dashed', direction: 'rtl' },
      PB_REJECT: { source: 'PB4', target: 'PB_REJECT_OUT', semantic: 'rejection', style: 'dashed', direction: 'ttb' },
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
  it('filters claim C4 to the VoR path and sequence', async () => {
    const state = await createState({
      filters: {
        claims: ['C4'],
        standards: [],
        semantics: [],
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
    expect(architectureMermaid).toContain('subgraph GW["GW: NOA Security Gateway · NE 177 / NE 178"]')
    expect(architectureMermaid).toContain('subgraph GW_NE177["NE 177 read-only chain"]')
    expect(architectureMermaid).toContain('subgraph GW_NE178["NE 178 VoR interface"]')
    expect(architectureMermaid).toContain('F_GW2:')
    expect(architectureMermaid).toContain('[diode, medium]')
    expect(architectureMermaid).toContain('stroke-width:3.2px')
    expect(sequenceMermaid).toContain('PB_AEA')
    expect(sequenceMermaid).toContain('PB_REJECT_OUT')
  })

  it('reuses the shared sequence geometry in viewport export', async () => {
    const state = await createState({
      viewport: { x: -120, y: -80, zoom: 2 },
    })
    const derived = deriveDiagramState(state)
    const board = compileSequenceBoard(state, derived)
    const ackEdge = board.edges.find((edge) => edge.edge.id === 'PB_ACK')
    const viewportDocument = buildExportSvgDocument(state, {
      mode: 'viewport',
      viewportMetrics: {
        architecture: { width: 640, height: 360 },
        sequence: { width: 640, height: 220 },
      },
    })

    expect(viewportDocument.svg).toContain('<title>AEA Architecture Viewport Export</title>')
    expect(viewportDocument.svg).toContain('viewBox="60 40 320 180"')
    expect(viewportDocument.svg).toContain(`d="${ackEdge?.path}"`)
    expect(viewportDocument.svg).toContain('id="sequence-node-PB_AEA"')
    expect(viewportDocument.svg).toContain('id="sequence-edge-PB_ACK"')
  })

  it('builds a fixed-size publication export with both panels', async () => {
    const state = await createState({ panelBVisible: false })
    const publicationDocument = buildExportSvgDocument(state, { mode: 'publication' })

    expect(publicationDocument.svg).toContain('<title>AEA Architecture Publication Export</title>')
    expect(publicationDocument.svg).toContain('width="183mm"')
    expect(publicationDocument.svg).toContain('font-size="9pt"')
    expect(publicationDocument.svg).toContain('font-size="6.5pt"')
    expect(publicationDocument.svg).toContain('font-size="5pt"')
    expect(publicationDocument.svg).toContain('stroke-dasharray="4 2"')
    expect(publicationDocument.svg).toContain('id="sequence-edge-PB_ACK"')
    expect(publicationDocument.svg).toContain('VoR Domain-Transition Sequence')
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
