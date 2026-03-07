import type { EdgeSemantic, EdgeSemanticFamily, EdgeStyle } from '@/graph/spec/schema'

export type SemanticMarkerKind = 'arrow' | 'arrowclosed' | 'circle' | 'tee' | 'diamond'

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
    stroke: '#2d6cdf',
    marker: 'arrow',
    icon: 'RO',
  },
  normalization: {
    semantic: 'normalization',
    family: 'context',
    familyLabel: semanticFamilyLabels.context,
    label: 'Normalization',
    stroke: '#6a8bd6',
    marker: 'arrow',
    icon: 'NM',
  },
  retrieval: {
    semantic: 'retrieval',
    family: 'context',
    familyLabel: semanticFamilyLabels.context,
    label: 'Retrieval',
    stroke: '#4c7bc1',
    marker: 'arrow',
    icon: 'RT',
  },
  proposal: {
    semantic: 'proposal',
    family: 'policy',
    familyLabel: semanticFamilyLabels.policy,
    label: 'Proposal',
    stroke: '#946a14',
    marker: 'diamond',
    icon: 'PR',
  },
  'policy-soft': {
    semantic: 'policy-soft',
    family: 'policy',
    familyLabel: semanticFamilyLabels.policy,
    label: 'Policy soft gate',
    stroke: '#918129',
    marker: 'diamond',
    icon: 'PS',
  },
  'policy-hard': {
    semantic: 'policy-hard',
    family: 'policy',
    familyLabel: semanticFamilyLabels.policy,
    label: 'Policy hard gate',
    stroke: '#6b5f1a',
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
    stroke: '#148a8a',
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
    stroke: '#5a6f94',
    marker: 'arrow',
    icon: 'AK',
  },
  rejection: {
    semantic: 'rejection',
    family: 'feedback',
    familyLabel: semanticFamilyLabels.feedback,
    label: 'Rejection',
    stroke: '#b45309',
    marker: 'tee',
    icon: 'RJ',
  },
  kpi: {
    semantic: 'kpi',
    family: 'telemetry',
    familyLabel: semanticFamilyLabels.telemetry,
    label: 'KPI',
    stroke: '#2563eb',
    marker: 'circle',
    icon: 'KP',
  },
  subscription: {
    semantic: 'subscription',
    family: 'telemetry',
    familyLabel: semanticFamilyLabels.telemetry,
    label: 'Subscription',
    stroke: '#0f766e',
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

export function edgeStrokeDash(style: EdgeStyle): string | undefined {
  if (style === 'dashed') {
    return '8 4'
  }
  if (style === 'dotted') {
    return '2 5'
  }
  return undefined
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
