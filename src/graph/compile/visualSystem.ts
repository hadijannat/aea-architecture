import type {
  BandId,
  EdgeSemantic,
  EdgeStyle,
  LaneId,
  NodeKind,
  NodeSpec,
  ProjectionTheme,
} from '@/graph/spec/schema'

export type CanvasLod = 'overview' | 'navigation' | 'detail'
export type NodeRenderMode = 'icon' | 'navigation' | 'detail' | 'collapsed'
export type EdgeLabelMode = 'hidden' | 'chip' | 'detail'

export interface LaneVisualTokens {
  fill: string
  border: string
  outerStrip: string
  outerShadow: string
  label: string
}

export interface BandVisualTokens {
  accent: string
  fill: string
  stripFill: string
  label: string
}

export interface SemanticVisualTokens {
  stroke: string
  chipText: string
  halo: string
  marker: 'arrow' | 'arrowclosed' | 'circle' | 'tee' | 'diamond'
  dash?: string
  width: number
  label: string
}

export interface KindGlyph {
  label: string
  path: string
  viewBox?: string
}

export const canvasLodThresholds = {
  overview: 0.5,
  navigation: 1,
  detail: 1.4,
} as const

export const publicationScale = 1.5
export const edgeOptionalOpacity = 0.6

export const laneVisuals: Record<LaneId, LaneVisualTokens> = {
  A: {
    fill: '#FFF7ED',
    border: '#FED7AA',
    outerStrip: '#F97316',
    outerShadow: 'rgba(249, 115, 22, 0.12)',
    label: 'Core Process Control (CPC / OT)',
  },
  B: {
    fill: '#EFF6FF',
    border: '#BFDBFE',
    outerStrip: '#2B7BE9',
    outerShadow: 'rgba(43, 123, 233, 0.12)',
    label: 'Plant-specific M+O (psM+O edge)',
  },
  C: {
    fill: '#F0FDF4',
    border: '#BBF7D0',
    outerStrip: '#10B981',
    outerShadow: 'rgba(16, 185, 129, 0.12)',
    label: 'Central M+O (off-prem)',
  },
}

export const bandVisuals: Record<BandId, BandVisualTokens> = {
  Sense: {
    accent: '#2B7BE9',
    fill: '#F5FAFF',
    stripFill: 'rgba(43, 123, 233, 0.15)',
    label: 'Sense',
  },
  Decide: {
    accent: '#6D5CE7',
    fill: '#F7F5FF',
    stripFill: 'rgba(109, 92, 231, 0.15)',
    label: 'Decide',
  },
  Act: {
    accent: '#F59E0B',
    fill: '#FFF8EB',
    stripFill: 'rgba(245, 158, 11, 0.15)',
    label: 'Act',
  },
}

export const themeSurfaceTokens: Record<
  ProjectionTheme,
  {
    page: string
    panel: string
    panelBorder: string
    board: string
    sequence: string
    text: string
    subtleText: string
    mutedText: string
  }
> = {
  default: {
    page: 'linear-gradient(180deg, #fbfcfd 0%, #f5f8fb 54%, #eef3f7 100%)',
    panel: 'rgba(255, 255, 255, 0.94)',
    panelBorder: 'rgba(203, 213, 225, 0.94)',
    board: 'linear-gradient(180deg, rgba(250, 252, 255, 0.98) 0%, rgba(242, 246, 252, 0.96) 100%)',
    sequence: 'linear-gradient(180deg, rgba(255, 252, 247, 0.98) 0%, rgba(255, 255, 255, 0.96) 100%)',
    text: '#111827',
    subtleText: '#374151',
    mutedText: '#6B7280',
  },
  analysis: {
    page: 'linear-gradient(180deg, #fbfcfd 0%, #f6f8fb 56%, #f2f5f8 100%)',
    panel: 'rgba(255, 255, 255, 0.98)',
    panelBorder: 'rgba(214, 221, 231, 0.94)',
    board: 'linear-gradient(180deg, rgba(251, 252, 253, 0.98) 0%, rgba(244, 247, 250, 0.96) 100%)',
    sequence: 'linear-gradient(180deg, rgba(252, 253, 255, 0.98) 0%, rgba(255, 255, 255, 0.96) 100%)',
    text: '#111827',
    subtleText: '#374151',
    mutedText: '#6B7280',
  },
}

const semanticVisuals: Record<EdgeSemantic, SemanticVisualTokens> = {
  'gateway-internal': {
    stroke: '#2B7BE9',
    chipText: '#0F3F7A',
    halo: 'rgba(255, 255, 255, 0.95)',
    marker: 'diamond',
    width: 1.8,
    label: 'Gateway internal',
  },
  'read-only': {
    stroke: '#2B7BE9',
    chipText: '#0F3F7A',
    halo: 'rgba(255, 255, 255, 0.95)',
    marker: 'arrow',
    width: 1.8,
    label: 'Read-only',
  },
  normalization: {
    stroke: '#2B7BE9',
    chipText: '#0F3F7A',
    halo: 'rgba(255, 255, 255, 0.95)',
    marker: 'arrow',
    width: 1.8,
    label: 'Normalization',
  },
  retrieval: {
    stroke: '#2B7BE9',
    chipText: '#0F3F7A',
    halo: 'rgba(255, 255, 255, 0.95)',
    marker: 'arrow',
    width: 1.8,
    label: 'Retrieval',
  },
  'policy-soft': {
    stroke: '#8B5CF6',
    chipText: '#4C1D95',
    halo: 'rgba(255, 255, 255, 0.95)',
    marker: 'diamond',
    dash: '6 3',
    width: 1.8,
    label: 'Policy soft gate',
  },
  'policy-hard': {
    stroke: '#8B5CF6',
    chipText: '#4C1D95',
    halo: 'rgba(255, 255, 255, 0.95)',
    marker: 'diamond',
    width: 2.4,
    label: 'Policy hard gate',
  },
  proposal: {
    stroke: '#F59E0B',
    chipText: '#7C2D12',
    halo: 'rgba(255, 255, 255, 0.95)',
    marker: 'diamond',
    width: 2.4,
    label: 'Proposal',
  },
  validation: {
    stroke: '#F59E0B',
    chipText: '#7C2D12',
    halo: 'rgba(255, 255, 255, 0.95)',
    marker: 'diamond',
    width: 2.4,
    label: 'Validation',
  },
  'tool-call': {
    stroke: '#F59E0B',
    chipText: '#7C2D12',
    halo: 'rgba(255, 255, 255, 0.95)',
    marker: 'circle',
    width: 2.4,
    label: 'Tool call',
  },
  subscription: {
    stroke: '#10B981',
    chipText: '#065F46',
    halo: 'rgba(255, 255, 255, 0.95)',
    marker: 'circle',
    dash: '1 5',
    width: 1.8,
    label: 'Subscription',
  },
  writeback: {
    stroke: '#EF4444',
    chipText: '#7F1D1D',
    halo: 'rgba(255, 255, 255, 0.98)',
    marker: 'arrowclosed',
    width: 2.4,
    label: 'Writeback',
  },
  'status-ack': {
    stroke: '#EF4444',
    chipText: '#7F1D1D',
    halo: 'rgba(255, 255, 255, 0.98)',
    marker: 'arrow',
    width: 2.4,
    label: 'Status acknowledgement',
  },
  rejection: {
    stroke: '#DC2626',
    chipText: '#7F1D1D',
    halo: 'rgba(255, 255, 255, 0.98)',
    marker: 'tee',
    dash: '7 4',
    width: 1.8,
    label: 'Rejection',
  },
  kpi: {
    stroke: '#10B981',
    chipText: '#065F46',
    halo: 'rgba(255, 255, 255, 0.95)',
    marker: 'circle',
    dash: '1 5',
    width: 1.8,
    label: 'KPI',
  },
  audit: {
    stroke: '#10B981',
    chipText: '#065F46',
    halo: 'rgba(255, 255, 255, 0.95)',
    marker: 'tee',
    dash: '1 5',
    width: 1.8,
    label: 'Audit',
  },
  sequence: {
    stroke: '#6B7280',
    chipText: '#374151',
    halo: 'rgba(255, 255, 255, 0.95)',
    marker: 'arrowclosed',
    width: 1.2,
    label: 'Sequence transition',
  },
}

export const kindGlyphs: Record<NodeKind, KindGlyph> = {
  lane: {
    label: 'Lane',
    path: 'M3 3 H13 V13 H3 Z M5 5 V11 M8 5 V11 M11 5 V11',
  },
  band: {
    label: 'Band',
    path: 'M2 5 H14 M2 8 H14 M2 11 H14',
  },
  container: {
    label: 'Zone',
    path: 'M3 4 H13 V12 H3 Z M5 6 H11',
  },
  'gateway-module': {
    label: 'Gateway',
    path: 'M3 6 L8 3 L13 6 L13 10 L8 13 L3 10 Z',
  },
  'gateway-interface': {
    label: 'Interface',
    path: 'M2.5 6 L8 2.5 L13.5 6 L13.5 10 L8 13.5 L2.5 10 Z M8 5 V11',
  },
  'cpc-block': {
    label: 'System',
    path: 'M3 4 H13 V12 H3 Z M5 6 H11 M5 9 H11',
  },
  'aea-block': {
    label: 'Process',
    path: 'M4 4 H12 V12 H4 Z M8 5 V11 M5 8 H11',
  },
  repository: {
    label: 'Store',
    path: 'M3 5 C3 3.5 13 3.5 13 5 V11 C13 12.5 3 12.5 3 11 Z M3 8 C3 9.5 13 9.5 13 8',
  },
  policy: {
    label: 'Policy',
    path: 'M4 4 H12 V12 H4 Z M8 4 V12 M5 6 L8 9 L11 6',
  },
  agent: {
    label: 'Agent',
    path: 'M8 4 A2 2 0 1 1 7.99 4 M5 12 V10 C5 8.9 6.34 8 8 8 C9.66 8 11 8.9 11 10 V12',
  },
  publisher: {
    label: 'Publisher',
    path: 'M3 8 H10 M8 5 L11 8 L8 11 M11.5 4 A1.5 1.5 0 1 1 11.49 4',
  },
  broker: {
    label: 'Broker',
    path: 'M3 5 H13 V8 H3 Z M5 10 H11 M5 12 H11',
  },
  audit: {
    label: 'Audit',
    path: 'M4 3.5 H10.5 L12.5 5.5 V12.5 H4 Z M10.5 3.5 V5.5 H12.5 M6 8 H10 M6 10.5 H10',
  },
}

export function resolveCanvasLod(zoom: number): CanvasLod {
  if (zoom < canvasLodThresholds.overview) {
    return 'overview'
  }

  if (zoom <= canvasLodThresholds.navigation) {
    return 'navigation'
  }

  return 'detail'
}

export function resolveNodeRenderMode(
  spec: NodeSpec,
  zoom: number,
  selected: boolean,
  collapsed: boolean,
): NodeRenderMode {
  if (collapsed) {
    return 'collapsed'
  }

  if (spec.kind === 'lane' || spec.kind === 'band' || spec.kind === 'container') {
    return resolveCanvasLod(zoom) === 'detail' ? 'detail' : 'navigation'
  }

  if (selected && zoom >= canvasLodThresholds.overview) {
    return 'detail'
  }

  switch (resolveCanvasLod(zoom)) {
    case 'overview':
      return 'icon'
    case 'navigation':
      return 'navigation'
    case 'detail':
    default:
      return 'detail'
  }
}

export function resolveEdgeLabelMode(
  zoom: number,
  selected: boolean,
  highlighted: boolean,
  exportMode = false,
): EdgeLabelMode {
  if (exportMode) {
    return 'detail'
  }

  if (zoom < 0.8) {
    return 'hidden'
  }

  if (zoom >= canvasLodThresholds.detail && (selected || highlighted)) {
    return 'detail'
  }

  return 'chip'
}

export function resolveSemanticVisual(semantic: EdgeSemantic): SemanticVisualTokens {
  return semanticVisuals[semantic]
}

export function resolveSemanticStrokeWidth(style: EdgeStyle, semantic: EdgeSemantic, lod?: CanvasLod): number {
  if (lod === 'overview') {
    return 1
  }

  const semanticWidth = semanticVisuals[semantic].width

  switch (style) {
    case 'bold':
      return Math.max(semanticWidth + 0.8, 2.6)
    case 'medium':
      return Math.max(semanticWidth + 0.2, 1.9)
    case 'dashed':
      return Math.max(semanticWidth, 1.6)
    case 'dotted':
      return Math.max(semanticWidth - 0.1, 1.4)
    case 'thin':
    default:
      return Math.max(semanticWidth - 0.1, 1.35)
  }
}

export function resolveBandVisual(spec: Pick<NodeSpec, 'band'>) {
  return spec.band ? bandVisuals[spec.band] : undefined
}

export function resolveLaneVisual(spec: Pick<NodeSpec, 'lane'>) {
  return spec.lane ? laneVisuals[spec.lane] : undefined
}

export function resolveNodeBandAccent(spec: Pick<NodeSpec, 'band'>): string {
  return spec.band ? bandVisuals[spec.band].accent : '#9CA3AF'
}

export function resolveKindGlyph(kind: NodeKind): KindGlyph {
  return kindGlyphs[kind]
}

const claimDotPalette = ['#2B7BE9', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#6B7280']

export function resolveClaimDotColor(index: number): string {
  return claimDotPalette[index % claimDotPalette.length]
}

export function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '')
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized

  const [r, g, b] = [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

