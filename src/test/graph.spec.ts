import { buildSearchResults } from '@/graph/compile/searchIndex'
import mermaid from 'mermaid'
import { describe, expect, it } from 'vitest'

import { compileSequencePanel, deriveDiagramState } from '@/graph/compile/toReactFlow'
import { toMermaid } from '@/graph/compile/toMermaid'
import { toPublicationSvg } from '@/graph/compile/toPublicationSvg'
import { defaultProjectionOverrides, graphManifest } from '@/graph/spec/manifest'
import { validateGraphManifest } from '@/graph/spec/validators'
import { computeNodePositions } from '@/layout/elk'
import type { DiagramStore } from '@/state/diagramStore'

async function createState(overrides?: Partial<DiagramStore['ui']>): Promise<DiagramStore> {
  const positions = await computeNodePositions(graphManifest, defaultProjectionOverrides)
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
    const model = compileSequencePanel(state, derived, scrambledManifest)

    expect(model.steps.map((step) => step.step.id)).toEqual(['PB1', 'PB2', 'PB3', 'PB4', 'PB5'])
    expect(model.terminals.map((terminal) => terminal.node.id)).toEqual(['PB_AEA', 'PB_REJECT_OUT'])
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
    expect(sequenceMermaid).toContain('PB_AEA')
    expect(sequenceMermaid).toContain('PB_REJECT_OUT')
  })

  it('includes title and desc tags in SVG export', async () => {
    const state = await createState()
    const svg = toPublicationSvg(state, 'current')
    expect(svg).toContain('<title>AEA Architecture Graph Export</title>')
    expect(svg).toContain('<desc>Publication export of the AEA architecture graph application including Panel A and Panel B.</desc>')
    expect(svg).toContain('id="edge-F5"')
    expect(svg).toContain('id="sequence-node-PB_AEA"')
    expect(svg).toContain('id="sequence-node-PB_REJECT_OUT"')
  })
})
