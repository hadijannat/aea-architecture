import { describe, expect, it } from 'vitest'

import {
  canvasLodThresholds,
  publicationScale,
  edgeOptionalOpacity,
  resolveCanvasLod,
  resolveNodeRenderMode,
  resolveEdgeLabelMode,
  resolveSemanticVisual,
  resolveSemanticStrokeWidth,
  resolveBandVisual,
  resolveLaneVisual,
  resolveNodeBandAccent,
  resolveKindGlyph,
  resolveClaimDotColor,
  hexToRgba,
  kindGlyphs,
  laneVisuals,
  bandVisuals,
  themeSurfaceTokens,
  type CanvasLod,
} from '@/graph/compile/visualSystem'
import type { NodeSpec } from '@/graph/spec/schema'

// Minimal node spec factory for testing resolveNodeRenderMode
function makeNode(kind: NodeSpec['kind']): NodeSpec {
  return {
    id: 'TEST',
    title: 'Test',
    kind,
    panel: ['architecture'],
    tags: [],
    standardIds: [],
    claimIds: [],
    width: 180,
    height: 80,
    description: '',
    visual: { fill: '#fff', border: '#ccc', badgeStyle: 'band' },
    inspector: { relatedEdgeIds: [], relatedStepIds: [] },
    fixed: true,
  } as unknown as NodeSpec
}

describe('canvasLodThresholds constants', () => {
  it('exposes the three LOD threshold values', () => {
    expect(canvasLodThresholds.overview).toBe(0.5)
    expect(canvasLodThresholds.navigation).toBe(1)
    expect(canvasLodThresholds.detail).toBe(1.4)
  })

  it('exports publicationScale as 1.5', () => {
    expect(publicationScale).toBe(1.5)
  })

  it('exports edgeOptionalOpacity as 0.6', () => {
    expect(edgeOptionalOpacity).toBe(0.6)
  })
})

describe('resolveCanvasLod', () => {
  it('returns overview when zoom is strictly below the overview threshold', () => {
    expect(resolveCanvasLod(0)).toBe('overview')
    expect(resolveCanvasLod(0.1)).toBe('overview')
    expect(resolveCanvasLod(0.49)).toBe('overview')
  })

  it('returns navigation exactly at the overview threshold boundary', () => {
    // zoom < 0.5 → overview; zoom >= 0.5 → navigation (or detail)
    expect(resolveCanvasLod(0.5)).toBe('navigation')
  })

  it('returns navigation between 0.5 and 1.0 inclusive', () => {
    expect(resolveCanvasLod(0.6)).toBe('navigation')
    expect(resolveCanvasLod(0.8)).toBe('navigation')
    expect(resolveCanvasLod(1.0)).toBe('navigation')
  })

  it('returns detail when zoom is above the navigation threshold', () => {
    expect(resolveCanvasLod(1.01)).toBe('detail')
    expect(resolveCanvasLod(1.4)).toBe('detail')
    expect(resolveCanvasLod(2.0)).toBe('detail')
  })
})

describe('resolveNodeRenderMode', () => {
  it('returns collapsed when the collapsed flag is set, regardless of zoom', () => {
    const node = makeNode('cpc-block')
    expect(resolveNodeRenderMode(node, 2.0, true, true)).toBe('collapsed')
    expect(resolveNodeRenderMode(node, 0.1, false, true)).toBe('collapsed')
  })

  it('returns navigation for structural lane/band/container nodes at navigation zoom', () => {
    for (const kind of ['lane', 'band', 'container'] as const) {
      const node = makeNode(kind)
      expect(resolveNodeRenderMode(node, 0.6, false, false)).toBe('navigation')
      expect(resolveNodeRenderMode(node, 1.0, false, false)).toBe('navigation')
    }
  })

  it('returns detail for structural nodes only when zoom enters detail tier', () => {
    const node = makeNode('lane')
    expect(resolveNodeRenderMode(node, 1.5, false, false)).toBe('detail')
  })

  it('returns detail for a selected non-structural node at any zoom above the overview threshold', () => {
    const node = makeNode('cpc-block')
    // zoom >= 0.5 and selected → detail
    expect(resolveNodeRenderMode(node, 0.5, true, false)).toBe('detail')
    expect(resolveNodeRenderMode(node, 1.0, true, false)).toBe('detail')
    expect(resolveNodeRenderMode(node, 0.1, true, false)).toBe('icon') // below threshold even when selected
  })

  it('maps overview LOD to icon for non-structural, non-selected nodes', () => {
    const node = makeNode('agent')
    expect(resolveNodeRenderMode(node, 0.3, false, false)).toBe('icon')
  })

  it('maps navigation LOD to navigation for non-structural, non-selected nodes', () => {
    const node = makeNode('cpc-block')
    expect(resolveNodeRenderMode(node, 0.8, false, false)).toBe('navigation')
  })

  it('maps detail LOD to detail for non-structural, non-selected nodes', () => {
    const node = makeNode('repository')
    expect(resolveNodeRenderMode(node, 1.5, false, false)).toBe('detail')
  })
})

describe('resolveEdgeLabelMode', () => {
  const edgeState = (overrides: Partial<Parameters<typeof resolveEdgeLabelMode>[1]> = {}) => ({
    selected: false,
    hovered: false,
    highlighted: false,
    searchMatched: false,
    localNeighborhood: false,
    exportMode: false,
    ...overrides,
  })

  it('always returns detail in export mode regardless of zoom or activity state', () => {
    expect(resolveEdgeLabelMode(0.1, edgeState({ exportMode: true }))).toBe('detail')
    expect(resolveEdgeLabelMode(2.0, edgeState({ exportMode: true, selected: true }))).toBe('detail')
  })

  it('hides all labels at overview zoom', () => {
    expect(resolveEdgeLabelMode(0.0, edgeState())).toBe('hidden')
    expect(resolveEdgeLabelMode(0.49, edgeState({ selected: true }))).toBe('hidden')
    expect(resolveEdgeLabelMode(0.49, edgeState({ localNeighborhood: true }))).toBe('hidden')
  })

  it('shows chips for active and local-neighborhood edges at navigation zoom', () => {
    expect(resolveEdgeLabelMode(0.8, edgeState({ selected: true }))).toBe('chip')
    expect(resolveEdgeLabelMode(1.0, edgeState({ hovered: true }))).toBe('chip')
    expect(resolveEdgeLabelMode(1.0, edgeState({ highlighted: true }))).toBe('chip')
    expect(resolveEdgeLabelMode(1.0, edgeState({ searchMatched: true }))).toBe('chip')
    expect(resolveEdgeLabelMode(1.0, edgeState())).toBe('hidden')
    expect(resolveEdgeLabelMode(1.0, edgeState({ localNeighborhood: true }))).toBe('chip')
  })

  it('shows detail labels for active edges, chips for all others at detail zoom', () => {
    const detailZoom = canvasLodThresholds.detail // 1.4
    expect(resolveEdgeLabelMode(detailZoom, edgeState({ selected: true }))).toBe('detail')
    expect(resolveEdgeLabelMode(detailZoom, edgeState({ hovered: true }))).toBe('detail')
    expect(resolveEdgeLabelMode(detailZoom, edgeState({ highlighted: true }))).toBe('detail')
    expect(resolveEdgeLabelMode(detailZoom, edgeState({ searchMatched: true }))).toBe('detail')
    expect(resolveEdgeLabelMode(detailZoom, edgeState({ localNeighborhood: true }))).toBe('chip')
    expect(resolveEdgeLabelMode(1.5, edgeState())).toBe('chip')
  })
})

describe('resolveSemanticVisual — all 16 semantic tokens', () => {
  const expectedStrokes: Record<string, string> = {
    'gateway-internal': '#2B7BE9',
    'read-only': '#2B7BE9',
    normalization: '#2B7BE9',
    retrieval: '#2B7BE9',
    'policy-soft': '#8B5CF6',
    'policy-hard': '#8B5CF6',
    proposal: '#F59E0B',
    validation: '#F59E0B',
    'tool-call': '#F59E0B',
    subscription: '#10B981',
    writeback: '#EF4444',
    'status-ack': '#EF4444',
    rejection: '#DC2626',
    kpi: '#10B981',
    audit: '#10B981',
    sequence: '#6B7280',
  }

  for (const [semantic, expectedStroke] of Object.entries(expectedStrokes)) {
    it(`resolves the correct stroke for "${semantic}"`, () => {
      const tokens = resolveSemanticVisual(semantic as Parameters<typeof resolveSemanticVisual>[0])
      expect(tokens.stroke).toBe(expectedStroke)
    })
  }

  it('returns dashed pattern for policy-soft', () => {
    expect(resolveSemanticVisual('policy-soft').dash).toBe('6 3')
  })

  it('returns dashed pattern for subscription', () => {
    expect(resolveSemanticVisual('subscription').dash).toBe('1 5')
  })

  it('returns dashed pattern for rejection', () => {
    expect(resolveSemanticVisual('rejection').dash).toBe('7 4')
  })

  it('returns no dash for writeback (solid bold edge)', () => {
    expect(resolveSemanticVisual('writeback').dash).toBeUndefined()
  })

  it('uses arrowclosed marker for writeback', () => {
    expect(resolveSemanticVisual('writeback').marker).toBe('arrowclosed')
  })

  it('uses tee marker for rejection', () => {
    expect(resolveSemanticVisual('rejection').marker).toBe('tee')
  })

  it('uses circle marker for tool-call', () => {
    expect(resolveSemanticVisual('tool-call').marker).toBe('circle')
  })

  it('uses diamond marker for policy-soft and policy-hard', () => {
    expect(resolveSemanticVisual('policy-soft').marker).toBe('diamond')
    expect(resolveSemanticVisual('policy-hard').marker).toBe('diamond')
  })
})

describe('resolveSemanticStrokeWidth', () => {
  it('returns 1 for any LOD overview regardless of style', () => {
    const lod: CanvasLod = 'overview'
    expect(resolveSemanticStrokeWidth('bold', 'writeback', lod)).toBe(1)
    expect(resolveSemanticStrokeWidth('thin', 'retrieval', lod)).toBe(1)
  })

  it('returns the correct bold width for writeback (width=2.8, bold adds 1.0, min 3.0)', () => {
    // writeback base width=2.8; bold: max(2.8+1.0, 3.0) = max(3.8, 3.0) = 3.8
    expect(resolveSemanticStrokeWidth('bold', 'writeback')).toBe(3.8)
  })

  it('returns the correct medium width for validation (base=2.4, medium adds 0.3)', () => {
    // validation base=2.4; medium: max(2.4+0.3, 2.0) = 2.7
    expect(resolveSemanticStrokeWidth('medium', 'validation')).toBeCloseTo(2.7)
  })

  it('returns the correct dashed width for rejection (base=1.6, dashed uses max(base, 1.4))', () => {
    // rejection base=1.6; dashed: max(1.6, 1.4) = 1.6
    expect(resolveSemanticStrokeWidth('dashed', 'rejection')).toBe(1.6)
  })

  it('returns the correct thin width for retrieval (base=1.8, thin: max(1.8-0.3, 1.0))', () => {
    // retrieval base=1.8; thin: max(1.8-0.3, 1.0) = max(1.5, 1.0) = 1.5
    expect(resolveSemanticStrokeWidth('thin', 'retrieval')).toBeCloseTo(1.5)
  })

  it('applies the floor (1.0) for sequence edges at thin style (base=1.0)', () => {
    // sequence base=1.0; thin: max(1.0-0.3, 1.0) = max(0.7, 1.0) = 1.0
    expect(resolveSemanticStrokeWidth('thin', 'sequence')).toBe(1.0)
  })
})

describe('resolveLaneVisual', () => {
  it('returns the correct tokens for lane A', () => {
    const tokens = resolveLaneVisual({ lane: 'A' })
    expect(tokens).toBeDefined()
    expect(tokens?.fill).toBe('#FFF7ED')
    expect(tokens?.outerStrip).toBe('#F97316')
  })

  it('returns the correct tokens for lane B', () => {
    const tokens = resolveLaneVisual({ lane: 'B' })
    expect(tokens?.fill).toBe('#EFF6FF')
    expect(tokens?.outerStrip).toBe('#2B7BE9')
  })

  it('returns the correct tokens for lane C', () => {
    const tokens = resolveLaneVisual({ lane: 'C' })
    expect(tokens?.fill).toBe('#F0FDF4')
    expect(tokens?.outerStrip).toBe('#10B981')
  })

  it('returns undefined when no lane is set', () => {
    expect(resolveLaneVisual({})).toBeUndefined()
  })
})

describe('resolveBandVisual', () => {
  it('returns the correct tokens for Sense band', () => {
    const tokens = resolveBandVisual({ band: 'Sense' })
    expect(tokens).toBeDefined()
    expect(tokens?.accent).toBe('#2B7BE9')
  })

  it('returns the correct tokens for Decide band', () => {
    const tokens = resolveBandVisual({ band: 'Decide' })
    expect(tokens?.accent).toBe('#6D5CE7')
  })

  it('returns the correct tokens for Act band', () => {
    const tokens = resolveBandVisual({ band: 'Act' })
    expect(tokens?.accent).toBe('#F59E0B')
  })

  it('returns undefined when no band is set', () => {
    expect(resolveBandVisual({})).toBeUndefined()
  })
})

describe('resolveNodeBandAccent', () => {
  it('returns the correct accent for each band', () => {
    expect(resolveNodeBandAccent({ band: 'Sense' })).toBe('#2B7BE9')
    expect(resolveNodeBandAccent({ band: 'Decide' })).toBe('#6D5CE7')
    expect(resolveNodeBandAccent({ band: 'Act' })).toBe('#F59E0B')
  })

  it('returns the fallback grey when no band is set', () => {
    expect(resolveNodeBandAccent({})).toBe('#9CA3AF')
  })
})

describe('resolveKindGlyph — all 13 node kinds', () => {
  const expectedKinds: Array<keyof typeof kindGlyphs> = [
    'lane',
    'band',
    'container',
    'gateway-module',
    'gateway-interface',
    'cpc-block',
    'aea-block',
    'repository',
    'policy',
    'agent',
    'publisher',
    'broker',
    'audit',
  ]

  for (const kind of expectedKinds) {
    it(`resolves a non-empty path for kind "${kind}"`, () => {
      const glyph = resolveKindGlyph(kind)
      expect(glyph).toBeDefined()
      expect(glyph.path.length).toBeGreaterThan(0)
      expect(glyph.label.length).toBeGreaterThan(0)
    })
  }

  it('resolves "Gateway" as the label for gateway-module', () => {
    expect(resolveKindGlyph('gateway-module').label).toBe('Gateway')
  })

  it('resolves "Store" as the label for repository', () => {
    expect(resolveKindGlyph('repository').label).toBe('Store')
  })
})

describe('resolveClaimDotColor', () => {
  it('cycles through the 6-color palette', () => {
    const palette = ['#2B7BE9', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#6B7280']
    for (let index = 0; index < palette.length; index += 1) {
      expect(resolveClaimDotColor(index)).toBe(palette[index])
    }
    // Cycle wraps at 6
    expect(resolveClaimDotColor(6)).toBe(palette[0])
    expect(resolveClaimDotColor(7)).toBe(palette[1])
  })
})

describe('hexToRgba', () => {
  it('converts a 6-character hex to rgba', () => {
    expect(hexToRgba('#2B7BE9', 1)).toBe('rgba(43, 123, 233, 1)')
    expect(hexToRgba('#EF4444', 0.5)).toBe('rgba(239, 68, 68, 0.5)')
    expect(hexToRgba('#10B981', 0.12)).toBe('rgba(16, 185, 129, 0.12)')
  })

  it('expands 3-character hex shorthand before converting', () => {
    expect(hexToRgba('#fff', 0.9)).toBe('rgba(255, 255, 255, 0.9)')
    expect(hexToRgba('#000', 0)).toBe('rgba(0, 0, 0, 0)')
  })

  it('handles hex without the leading #', () => {
    expect(hexToRgba('2B7BE9', 0.5)).toBe('rgba(43, 123, 233, 0.5)')
  })
})

describe('themeSurfaceTokens', () => {
  it('defines both supported themes', () => {
    expect(themeSurfaceTokens.default).toBeDefined()
    expect(themeSurfaceTokens.analysis).toBeDefined()
  })

  it('default theme has the expected primary text token', () => {
    expect(themeSurfaceTokens.default.text).toBe('#111827')
  })

  it('analysis theme has the expected primary text token', () => {
    expect(themeSurfaceTokens.analysis.text).toBe('#111827')
  })

  it('both themes define a sequence gradient', () => {
    expect(themeSurfaceTokens.default.sequence).toContain('rgba(255, 252, 247')
    expect(themeSurfaceTokens.analysis.sequence).toContain('rgba(252, 253, 255')
  })
})

describe('laneVisuals completeness', () => {
  it('defines entries for all three lanes', () => {
    expect(Object.keys(laneVisuals)).toEqual(expect.arrayContaining(['A', 'B', 'C']))
  })

  it('each lane entry has required token fields', () => {
    for (const tokens of Object.values(laneVisuals)) {
      expect(tokens.fill).toBeDefined()
      expect(tokens.border).toBeDefined()
      expect(tokens.outerStrip).toBeDefined()
      expect(tokens.outerShadow).toBeDefined()
      expect(tokens.label).toBeDefined()
    }
  })
})

describe('bandVisuals completeness', () => {
  it('defines entries for all three bands', () => {
    expect(Object.keys(bandVisuals)).toEqual(expect.arrayContaining(['Sense', 'Decide', 'Act']))
  })

  it('each band entry has required token fields', () => {
    for (const tokens of Object.values(bandVisuals)) {
      expect(tokens.accent).toBeDefined()
      expect(tokens.fill).toBeDefined()
      expect(tokens.stripFill).toBeDefined()
      expect(tokens.label).toBeDefined()
    }
  })
})
