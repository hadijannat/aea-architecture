import type { EdgeSemantic, EdgeSemanticFamily, EdgeStyle } from '@/graph/spec/schema'

export type SemanticMarkerKind = 'arrow' | 'arrowclosed' | 'circle' | 'tee' | 'diamond'

export interface SemanticMarkerDimensions {
  width: number
  height: number
  refY: number
  viewBox: string
}

export type SemanticMarkerUnits = 'strokeWidth' | 'userSpaceOnUse'

export type SemanticMarkerSurface =
  | 'architecture'
  | 'legend'
  | 'sequence'
  | 'export-viewport'
  | 'export-publication'

export interface SemanticMarkerTokens extends SemanticMarkerDimensions {
  units: SemanticMarkerUnits
}

export type SemanticMarkerGeometry =
  | {
      element: 'path'
      d: string
      fill: 'currentColor' | 'none'
      stroke?: 'currentColor'
      strokeWidth?: number
      strokeLinecap?: 'round'
    }
  | {
      element: 'circle'
      cx: number
      cy: number
      r: number
      fill: 'currentColor'
    }

export interface SemanticPresentation {
  semantic: EdgeSemantic
  family: EdgeSemanticFamily
  familyLabel: string
  label: string
  stroke: string
  marker: SemanticMarkerKind
  referenceStyle: EdgeStyle
  icon?: string
}

export const semanticFamilyOrder: EdgeSemanticFamily[] = [
  'context',
  'policy',
  'runtime',
  'write',
  'feedback',
  'telemetry',
  'sequence',
]

export const semanticFamilyLabels: Record<EdgeSemanticFamily, string> = {
  context: 'Context',
  policy: 'Policy',
  runtime: 'Runtime',
  write: 'Write',
  feedback: 'Feedback',
  telemetry: 'Telemetry',
  sequence: 'Sequence',
}

const semanticFamilyDashMap: Record<EdgeSemanticFamily, string | undefined> = {
  context: undefined,
  policy: '12 6',
  runtime: '2 6',
  write: '18 5 4 5',
  feedback: '7 4',
  telemetry: '1 5',
  sequence: '10 4 2 4',
}

const semanticMarkerCoordinateSystem: Pick<SemanticMarkerDimensions, 'refY' | 'viewBox'> = {
  refY: 4,
  viewBox: '0 0 10 8',
}

const semanticMarkerTokensMap: Record<SemanticMarkerSurface, SemanticMarkerTokens> = {
  architecture: {
    width: 14,
    height: 11,
    refY: semanticMarkerCoordinateSystem.refY,
    viewBox: semanticMarkerCoordinateSystem.viewBox,
    units: 'strokeWidth',
  },
  legend: {
    width: 10,
    height: 8,
    refY: semanticMarkerCoordinateSystem.refY,
    viewBox: semanticMarkerCoordinateSystem.viewBox,
    units: 'userSpaceOnUse',
  },
  sequence: {
    width: 10,
    height: 8,
    refY: semanticMarkerCoordinateSystem.refY,
    viewBox: semanticMarkerCoordinateSystem.viewBox,
    units: 'userSpaceOnUse',
  },
  'export-viewport': {
    width: 10,
    height: 8,
    refY: semanticMarkerCoordinateSystem.refY,
    viewBox: semanticMarkerCoordinateSystem.viewBox,
    units: 'userSpaceOnUse',
  },
  'export-publication': {
    width: 7,
    height: 5.5,
    refY: semanticMarkerCoordinateSystem.refY,
    viewBox: semanticMarkerCoordinateSystem.viewBox,
    units: 'userSpaceOnUse',
  },
}

export const semanticFamilyMembers: Record<EdgeSemanticFamily, EdgeSemantic[]> = {
  context: ['gateway-internal', 'read-only', 'normalization', 'retrieval'],
  policy: ['proposal', 'policy-soft', 'policy-hard', 'validation'],
  runtime: ['tool-call'],
  write: ['writeback'],
  feedback: ['status-ack', 'rejection'],
  telemetry: ['kpi', 'subscription', 'audit'],
  sequence: ['sequence'],
}

const semanticPresentationMap: Record<EdgeSemantic, SemanticPresentation> = {
  'gateway-internal': {
    semantic: 'gateway-internal',
    family: 'context',
    familyLabel: semanticFamilyLabels.context,
    label: 'Gateway internal',
    stroke: '#3b5998',
    marker: 'diamond',
    referenceStyle: 'medium',
    icon: 'GW',
  },
  'read-only': {
    semantic: 'read-only',
    family: 'context',
    familyLabel: semanticFamilyLabels.context,
    label: 'Read-only',
    stroke: '#2563eb',
    marker: 'arrow',
    referenceStyle: 'medium',
    icon: 'RO',
  },
  normalization: {
    semantic: 'normalization',
    family: 'context',
    familyLabel: semanticFamilyLabels.context,
    label: 'Normalization',
    stroke: '#7c3aed',
    marker: 'arrow',
    referenceStyle: 'thin',
    icon: 'NM',
  },
  retrieval: {
    semantic: 'retrieval',
    family: 'context',
    familyLabel: semanticFamilyLabels.context,
    label: 'Retrieval',
    stroke: '#15803d',
    marker: 'arrow',
    referenceStyle: 'medium',
    icon: 'RT',
  },
  proposal: {
    semantic: 'proposal',
    family: 'policy',
    familyLabel: semanticFamilyLabels.policy,
    label: 'Proposal',
    stroke: '#b45309',
    marker: 'diamond',
    referenceStyle: 'medium',
    icon: 'PR',
  },
  'policy-soft': {
    semantic: 'policy-soft',
    family: 'policy',
    familyLabel: semanticFamilyLabels.policy,
    label: 'Policy soft gate',
    stroke: '#7c6f18',
    marker: 'diamond',
    referenceStyle: 'thin',
    icon: 'PS',
  },
  'policy-hard': {
    semantic: 'policy-hard',
    family: 'policy',
    familyLabel: semanticFamilyLabels.policy,
    label: 'Policy hard gate',
    stroke: '#9a3412',
    marker: 'diamond',
    referenceStyle: 'medium',
    icon: 'PH',
  },
  validation: {
    semantic: 'validation',
    family: 'policy',
    familyLabel: semanticFamilyLabels.policy,
    label: 'Validation',
    stroke: '#0f766e',
    marker: 'diamond',
    referenceStyle: 'medium',
    icon: 'VL',
  },
  'tool-call': {
    semantic: 'tool-call',
    family: 'runtime',
    familyLabel: semanticFamilyLabels.runtime,
    label: 'Tool call',
    stroke: '#0f9ba8',
    marker: 'circle',
    referenceStyle: 'dotted',
    icon: 'TC',
  },
  writeback: {
    semantic: 'writeback',
    family: 'write',
    familyLabel: semanticFamilyLabels.write,
    label: 'Writeback',
    stroke: '#d35400',
    marker: 'arrowclosed',
    referenceStyle: 'medium',
    icon: 'WR',
  },
  'status-ack': {
    semantic: 'status-ack',
    family: 'feedback',
    familyLabel: semanticFamilyLabels.feedback,
    label: 'Status acknowledgement',
    stroke: '#64748b',
    marker: 'arrow',
    referenceStyle: 'dashed',
    icon: 'AK',
  },
  rejection: {
    semantic: 'rejection',
    family: 'feedback',
    familyLabel: semanticFamilyLabels.feedback,
    label: 'Rejection',
    stroke: '#b91c1c',
    marker: 'tee',
    referenceStyle: 'dashed',
    icon: 'RJ',
  },
  kpi: {
    semantic: 'kpi',
    family: 'telemetry',
    familyLabel: semanticFamilyLabels.telemetry,
    label: 'KPI',
    stroke: '#0284c7',
    marker: 'circle',
    referenceStyle: 'medium',
    icon: 'KP',
  },
  subscription: {
    semantic: 'subscription',
    family: 'telemetry',
    familyLabel: semanticFamilyLabels.telemetry,
    label: 'Subscription',
    stroke: '#6366f1',
    marker: 'circle',
    referenceStyle: 'dotted',
    icon: 'SB',
  },
  audit: {
    semantic: 'audit',
    family: 'telemetry',
    familyLabel: semanticFamilyLabels.telemetry,
    label: 'Audit',
    stroke: '#7c5a32',
    marker: 'tee',
    referenceStyle: 'thin',
    icon: 'AU',
  },
  sequence: {
    semantic: 'sequence',
    family: 'sequence',
    familyLabel: semanticFamilyLabels.sequence,
    label: 'Sequence transition',
    stroke: '#455a75',
    marker: 'arrowclosed',
    referenceStyle: 'dashed',
    icon: 'SQ',
  },
}

const edgeStyleDashMap: Partial<Record<EdgeStyle, string>> = {
  dashed: '12 7',
  dotted: '2.2 7.4',
}

const semanticDashMap: Partial<Record<EdgeSemantic, string>> = {
  sequence: '10 4 2 4',
  'status-ack': '11 7',
  rejection: '5 7',
  'tool-call': '3.2 7.2 1.6 7.2',
  subscription: '1.2 8.4',
}

const semanticAnimationMap: Partial<Record<EdgeSemantic, boolean>> = {
  'tool-call': true,
  writeback: true,
}

function unique<T>(values: readonly T[]) {
  return [...new Set(values)]
}

export function getSemanticPresentation(semantic: EdgeSemantic): SemanticPresentation {
  return semanticPresentationMap[semantic]
}

export function getSemanticFamilyLabel(family: EdgeSemanticFamily): string {
  return semanticFamilyLabels[family]
}

export function getSemanticFamilyMembers(family: EdgeSemanticFamily): EdgeSemantic[] {
  return semanticFamilyMembers[family]
}

export function getSemanticPresentationsForFamily(family: EdgeSemanticFamily): SemanticPresentation[] {
  return semanticFamilyMembers[family].map((semantic) => semanticPresentationMap[semantic])
}

export function getSemanticMarkerTokens(surface: SemanticMarkerSurface): SemanticMarkerTokens {
  return semanticMarkerTokensMap[surface]
}

export function normalizeSemanticFamilies(values: readonly string[]): EdgeSemanticFamily[] {
  const allowed = new Set<EdgeSemanticFamily>(semanticFamilyOrder)

  return unique(values)
    .filter((value): value is EdgeSemanticFamily => allowed.has(value as EdgeSemanticFamily))
    .sort((left, right) => semanticFamilyOrder.indexOf(left) - semanticFamilyOrder.indexOf(right))
}

export function resolveSemanticFamilies(values: readonly EdgeSemantic[]): EdgeSemanticFamily[] {
  return normalizeSemanticFamilies(values.map((semantic) => getSemanticPresentation(semantic).family))
}

export function matchesSemanticFamilies(
  semantic: EdgeSemantic,
  families: readonly EdgeSemanticFamily[],
): boolean {
  return families.length === 0 || families.includes(getSemanticPresentation(semantic).family)
}

export function describeSemanticForSearch(semantic: EdgeSemantic): string {
  const presentation = getSemanticPresentation(semantic)
  return `${presentation.familyLabel} · ${semantic}`
}

export function getSemanticFamilyStrokeDash(family: EdgeSemanticFamily): string | undefined {
  return semanticFamilyDashMap[family]
}

export function getSemanticStrokeDash(semantic: EdgeSemantic, style?: EdgeStyle): string | undefined {
  if (!style) {
    return semanticDashMap[semantic] ?? getSemanticFamilyStrokeDash(getSemanticPresentation(semantic).family)
  }

  if (style === 'bold' || style === 'medium' || style === 'thin') {
    return semantic === 'sequence' ? semanticDashMap.sequence : undefined
  }

  return semanticDashMap[semantic] ?? edgeStyleDashMap[style]
}

export function getSemanticLegendStyle(semantic: EdgeSemantic): EdgeStyle {
  return getSemanticPresentation(semantic).referenceStyle
}

export function getSemanticShouldAnimate(semantic: EdgeSemantic): boolean {
  return semanticAnimationMap[semantic] ?? false
}

export function getSemanticMarkerRefX(marker: SemanticMarkerKind): number {
  if (marker === 'tee') {
    return 2
  }
  if (marker === 'circle') {
    return 5
  }
  return 9
}

export function getSemanticMarkerGeometry(marker: SemanticMarkerKind): SemanticMarkerGeometry {
  switch (marker) {
    case 'arrow':
      return {
        element: 'path',
        d: 'M 0.5 0.8 L 9.5 4 L 0.5 7.2',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2.2,
        strokeLinecap: 'round',
      }
    case 'circle':
      return {
        element: 'circle',
        cx: 5,
        cy: 4,
        r: 3,
        fill: 'currentColor',
      }
    case 'tee':
      return {
        element: 'path',
        d: 'M 1 1 L 1 7 M 1 4 L 9 4',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2.3,
        strokeLinecap: 'round',
      }
    case 'diamond':
      return {
        element: 'path',
        d: 'M 5 0.8 L 9.2 4 L 5 7.2 L 0.8 4 z',
        fill: 'currentColor',
      }
    case 'arrowclosed':
    default:
      return {
        element: 'path',
        d: 'M 0 0 L 10 4 L 0 8 z',
        fill: 'currentColor',
      }
  }
}

export function edgeStrokeWidth(style: EdgeStyle): number {
  switch (style) {
    case 'bold':
      return 3.6
    case 'medium':
      return 2.7
    case 'dashed':
      return 2.2
    case 'dotted':
      return 1.8
    case 'thin':
    default:
      return 1.7
  }
}
