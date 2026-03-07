import {
  normalizeSemanticFamilies,
  resolveSemanticFamilies,
} from '@/graph/compile/semanticPresentation'
import type { ClaimId, EdgeSemantic, LaneId } from '@/graph/spec/schema'

import type { DiagramFilters, DiagramUiState } from './diagramStore'

const validPathPresets = new Set<DiagramFilters['pathPreset']>(['all', 'write', 'policy', 'telemetry'])
const validLanes = new Set<LaneId>(['A', 'B', 'C'])

function parseSearchParamList(value: string | null) {
  return value ? value.split(',').filter(Boolean) : []
}

function parsePathPreset(value: string | null): DiagramFilters['pathPreset'] {
  return value && validPathPresets.has(value as DiagramFilters['pathPreset'])
    ? (value as DiagramFilters['pathPreset'])
    : 'all'
}

function parseLanes(value: string | null): LaneId[] {
  return parseSearchParamList(value).filter((lane): lane is LaneId => validLanes.has(lane as LaneId))
}

export interface ParsedUiSearchState {
  selectedNodeId?: string
  selectedEdgeId?: string
  selectedStepId?: string
  filters: DiagramFilters
}

export function parseUiSearchParams(params: URLSearchParams): ParsedUiSearchState {
  const legacySemantics = parseSearchParamList(params.get('semantics')) as EdgeSemantic[]
  const semanticFamilies = normalizeSemanticFamilies([
    ...parseSearchParamList(params.get('families')),
    ...resolveSemanticFamilies(legacySemantics),
  ])

  return {
    selectedNodeId: params.get('node') ?? undefined,
    selectedEdgeId: params.get('edge') ?? undefined,
    selectedStepId: params.get('step') ?? undefined,
    filters: {
      claims: parseSearchParamList(params.get('claims')) as ClaimId[],
      standards: parseSearchParamList(params.get('standards')),
      semanticFamilies,
      lanes: parseLanes(params.get('lanes')),
      search: params.get('search') ?? '',
      pathPreset: parsePathPreset(params.get('path')),
    },
  }
}

export function buildUiSearchParams(ui: Pick<DiagramUiState, 'selectedNodeId' | 'selectedEdgeId' | 'selectedStepId' | 'filters'>) {
  const params = new URLSearchParams()

  if (ui.selectedNodeId) {
    params.set('node', ui.selectedNodeId)
  }
  if (ui.selectedEdgeId) {
    params.set('edge', ui.selectedEdgeId)
  }
  if (ui.selectedStepId) {
    params.set('step', ui.selectedStepId)
  }
  if (ui.filters.claims.length > 0) {
    params.set('claims', ui.filters.claims.join(','))
  }
  if (ui.filters.standards.length > 0) {
    params.set('standards', ui.filters.standards.join(','))
  }
  if (ui.filters.semanticFamilies.length > 0) {
    params.set('families', ui.filters.semanticFamilies.join(','))
  }
  if (ui.filters.lanes.length > 0) {
    params.set('lanes', ui.filters.lanes.join(','))
  }
  if (ui.filters.search) {
    params.set('search', ui.filters.search)
  }
  if (ui.filters.pathPreset !== 'all') {
    params.set('path', ui.filters.pathPreset)
  }

  return params
}
