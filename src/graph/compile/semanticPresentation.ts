import type { EdgeSemantic, EdgeSemanticFamily, EdgeStyle } from '@/graph/spec/schema'

export type SemanticMarkerKind = 'arrow' | 'arrowclosed' | 'circle' | 'tee' | 'diamond'

export interface SemanticMarkerDimensions {
  width: number
  height: number
  refY: number
  viewBox: string
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

export const semanticMarkerDimensions: SemanticMarkerDimensions = {
  width: 10,
  height: 8,
  refY: 4,
  viewBox: '0 0 10 8',
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
    stroke: '#5b6c88',
    marker: 'diamond',
    icon: 'GW',
  },
  'read-only': {
    semantic: 'read-only',
    family: 'context',
    familyLabel: semanticFamilyLabels.context,
    label: 'Read-only',
    stroke: '#2563eb',
    marker: 'arrow',
    icon: 'RO',
  },
  normalization: {
    semantic: 'normalization',
    family: 'context',
    familyLabel: semanticFamilyLabels.context,
    label: 'Normalization',
    stroke: '#7c3aed',
    marker: 'arrow',
    icon: 'NM',
  },
  retrieval: {
    semantic: 'retrieval',
    family: 'context',
    familyLabel: semanticFamilyLabels.context,
    label: 'Retrieval',
    stroke: '#15803d',
    marker: 'arrow',
    icon: 'RT',
  },
  proposal: {
    semantic: 'proposal',
    family: 'policy',
    familyLabel: semanticFamilyLabels.policy,
    label: 'Proposal',
    stroke: '#b45309',
    marker: 'diamond',
    icon: 'PR',
  },
  'policy-soft': {
    semantic: 'policy-soft',
    family: 'policy',
    familyLabel: semanticFamilyLabels.policy,
    label: 'Policy soft gate',
    stroke: '#7c6f18',
    marker: 'diamond',
    icon: 'PS',
  },
  'policy-hard': {
    semantic: 'policy-hard',
    family: 'policy',
    familyLabel: semanticFamilyLabels.policy,
    label: 'Policy hard gate',
    stroke: '#9a3412',
    marker: 'diamond',
    icon: 'PH',
  },
  validation: {
    semantic: 'validation',
    family: 'policy',
    familyLabel: semanticFamilyLabels.policy,
    label: 'Validation',
    stroke: '#0f766e',
    marker: 'diamond',
    icon: 'VL',
  },
  'tool-call': {
    semantic: 'tool-call',
    family: 'runtime',
    familyLabel: semanticFamilyLabels.runtime,
    label: 'Tool call',
    stroke: '#0f9ba8',
    marker: 'circle',
    icon: 'TC',
  },
  writeback: {
    semantic: 'writeback',
    family: 'write',
    familyLabel: semanticFamilyLabels.write,
    label: 'Writeback',
    stroke: '#d35400',
    marker: 'arrowclosed',
    icon: 'WR',
  },
  'status-ack': {
    semantic: 'status-ack',
    family: 'feedback',
    familyLabel: semanticFamilyLabels.feedback,
    label: 'Status acknowledgement',
    stroke: '#475569',
    marker: 'arrow',
    icon: 'AK',
  },
  rejection: {
    semantic: 'rejection',
    family: 'feedback',
    familyLabel: semanticFamilyLabels.feedback,
    label: 'Rejection',
    stroke: '#b91c1c',
    marker: 'tee',
    icon: 'RJ',
  },
  kpi: {
    semantic: 'kpi',
    family: 'telemetry',
    familyLabel: semanticFamilyLabels.telemetry,
    label: 'KPI',
    stroke: '#0284c7',
    marker: 'circle',
    icon: 'KP',
  },
  subscription: {
    semantic: 'subscription',
    family: 'telemetry',
    familyLabel: semanticFamilyLabels.telemetry,
    label: 'Subscription',
    stroke: '#059669',
    marker: 'circle',
    icon: 'SB',
  },
  audit: {
    semantic: 'audit',
    family: 'telemetry',
    familyLabel: semanticFamilyLabels.telemetry,
    label: 'Audit',
    stroke: '#7c5a32',
    marker: 'tee',
    icon: 'AU',
  },
  sequence: {
    semantic: 'sequence',
    family: 'sequence',
    familyLabel: semanticFamilyLabels.sequence,
    label: 'Sequence transition',
    stroke: '#455a75',
    marker: 'arrowclosed',
    icon: 'SQ',
  },
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

export function getSemanticStrokeDash(semantic: EdgeSemantic): string | undefined {
  return getSemanticFamilyStrokeDash(getSemanticPresentation(semantic).family)
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
        d: 'M 1 1 L 9 4 L 1 7',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.7,
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
        strokeWidth: 1.8,
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
      return 3.2
    case 'medium':
      return 2.2
    case 'dashed':
      return 1.8
    case 'dotted':
      return 1.4
    case 'thin':
    default:
      return 1.3
  }
}
