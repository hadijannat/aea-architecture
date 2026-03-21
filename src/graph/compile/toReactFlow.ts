import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react'

import { buildEdgeAriaLabel, buildNodeAriaLabel } from '@/a11y/aria'
import {
  getSemanticShouldAnimate,
  matchesSemanticFamilies,
} from '@/graph/compile/semanticPresentation'
import { resolveNodeVisual } from '@/graph/compile/nodeVisuals'
import {
  edgeEntityKey,
  graphManifest,
  nodeEntityKey,
  resolveGraphEdge,
  resolveGraphNode,
  resolveSequenceStep,
} from '@/graph/spec/manifest'
import type { ClaimId, EdgeSpec, EntityKey, GraphManifest, NodeSpec } from '@/graph/spec/schema'
import { compareHandleIds, resolveEdgeHandles, type HandleId } from '@/layout/ports'
import { buildBoardGeometryFromPositions, buildBoardEdgeRouteFromPositions } from '@/layout/boardGeometry'
import { assignBoardRouteBridges } from '@/layout/board'
import type { DiagramStore } from '@/state/diagramStore'
import {
  resolveClaimDotColor,
  resolveEdgeLabelMode,
  resolveNodeRenderMode,
  resolveCanvasLod,
  type CanvasLod,
} from './visualSystem'

export interface BreadcrumbItem {
  id: string
  label: string
}

export interface CompileCallbacks {
  onSelectNode(id: string): void
  onSelectEdge(id: string): void
  onSelectStep(id: string): void
  onBadgeClaim(id: ClaimId): void
  onBadgeStandard(id: string): void
  onPathAction(nodeId: string, direction: 'upstream' | 'downstream'): void
  onHover(key?: EntityKey): void
}

export interface CompiledNodeData extends Record<string, unknown> {
  spec: NodeSpec
  visual: ReturnType<typeof resolveNodeVisual>
  ariaLabel: string
  standards: ReturnType<typeof getStandardsForSpec>
  claims: ReturnType<typeof getClaimsForSpec>
  claimDots: string[]
  annotation?: string
  selected: boolean
  highlighted: boolean
  dimmed: boolean
  authorMode: boolean
  collapsed: boolean
  renderMode: ReturnType<typeof resolveNodeRenderMode>
  notesExpanded: boolean
  sourceHandleIds: HandleId[]
  targetHandleIds: HandleId[]
  callbacks: CompileCallbacks
}

export interface CompiledEdgeData extends Record<string, unknown> {
  spec: EdgeSpec
  routeChannels: ReturnType<typeof buildBoardGeometryFromPositions>['routeChannels']
  route: ReturnType<typeof buildBoardEdgeRouteFromPositions>
  ariaLabel: string
  sourceTitle: string
  targetTitle: string
  standards: ReturnType<typeof getStandardsForSpec>
  claims: ReturnType<typeof getClaimsForSpec>
  optional: boolean
  selected: boolean
  hovered: boolean
  searchMatched: boolean
  localNeighborhood: boolean
  highlighted: boolean
  groupHighlighted: boolean
  dimmed: boolean
  supportive: boolean
  narrativeMatched: boolean
  sharedTagFocused: boolean
  highlightGroup?: string
  canvasLod: ReturnType<typeof resolveCanvasLod>
  labelMode: ReturnType<typeof resolveEdgeLabelMode>
  sourceHandle: HandleId
  targetHandle: HandleId
  callbacks: CompileCallbacks
}

export type DiagramFlowNode = FlowNode<CompiledNodeData, string>
export type DiagramFlowEdge = FlowEdge<CompiledEdgeData, string>

export interface DerivedDiagramState {
  visibleNodeIds: Set<string>
  visibleEdgeIds: Set<string>
  visibleStepIds: Set<string>
  highlightedNodeIds: Set<string>
  highlightedEdgeIds: Set<string>
  highlightedStepIds: Set<string>
  breadcrumbs: BreadcrumbItem[]
}

function getStandardsForSpec(ids: string[], manifest: GraphManifest) {
  return ids.map((id) => manifest.standards[id]).filter(Boolean)
}

function getClaimsForSpec(ids: readonly string[], manifest: GraphManifest) {
  return ids
    .map((id) => manifest.claims[id as keyof typeof manifest.claims])
    .filter(Boolean)
}

function isStructuralNode(node: NodeSpec): boolean {
  return node.kind === 'lane' || node.kind === 'container' || node.kind === 'band'
}

function isSequenceTerminal(node: NodeSpec): boolean {
  return node.panel.includes('vor-sequence')
}

function includesPathTag(tags: string[], preset: DiagramStore['ui']['filters']['pathPreset']) {
  if (preset === 'all') {
    return true
  }
  return tags.includes(`${preset}-path`)
}

function matchesSearch(query: string, values: string[]) {
  if (!query) {
    return true
  }

  const haystack = values.join(' ').toLowerCase()
  return haystack.includes(query.toLowerCase())
}

function nodeMatchesFilters(node: NodeSpec, state: DiagramStore, manifest: GraphManifest): boolean {
  const { filters } = state.ui
  const standards = getStandardsForSpec(node.standardIds, manifest)
  const claims = getClaimsForSpec(node.claimIds, manifest)

  if (filters.lanes.length > 0 && node.lane && !filters.lanes.includes(node.lane)) {
    return false
  }
  if (filters.claims.length > 0 && !filters.claims.some((claimId) => node.claimIds.includes(claimId))) {
    return false
  }
  if (
    filters.standards.length > 0 &&
    !filters.standards.some((standardId) => node.standardIds.includes(standardId))
  ) {
    return false
  }

  return matchesSearch(filters.search, [
    node.id,
    node.title,
    node.subtitle ?? '',
    node.description,
    ...node.tags,
    ...standards.map((item) => item.label),
    ...claims.map((item) => item.label),
  ])
}

function edgeMatchesFilters(edge: EdgeSpec, state: DiagramStore, manifest: GraphManifest): boolean {
  const { filters } = state.ui

  if (filters.claims.length > 0 && !filters.claims.some((claimId) => edge.claimIds.includes(claimId))) {
    return false
  }
  if (
    filters.standards.length > 0 &&
    !filters.standards.some((standardId) => edge.standardIds.includes(standardId))
  ) {
    return false
  }
  if (!matchesSemanticFamilies(edge.semantic, filters.semanticFamilies)) {
    return false
  }

  return edgeMatchesSearchQuery(edge, filters.search, manifest)
}

function edgeMatchesSearchQuery(edge: EdgeSpec, query: string, manifest: GraphManifest): boolean {
  const standards = getStandardsForSpec(edge.standardIds, manifest)
  const claims = getClaimsForSpec(edge.claimIds, manifest)
  const source = resolveGraphNode(edge.source)?.title ?? edge.source
  const target = resolveGraphNode(edge.target)?.title ?? edge.target

  return matchesSearch(query, [
    edge.id,
    edge.label,
    edge.detail ?? '',
    edge.semantic,
    source,
    target,
    ...edge.tags,
    ...standards.map((item) => item.label),
    ...claims.map((item) => item.label),
  ])
}

function sharesEndpoint(left: EdgeSpec, right: EdgeSpec) {
  return (
    left.source === right.source ||
    left.source === right.target ||
    left.target === right.source ||
    left.target === right.target
  )
}

function edgeMatchesNarrativePreset(edge: EdgeSpec, preset: DiagramStore['ui']['filters']['pathPreset']) {
  return preset === 'all' || includesPathTag(edge.tags, preset)
}

function edgeSupportiveByDefault(edge: EdgeSpec) {
  if (edge.interactive.optional) {
    return true
  }

  return new Set(['status-ack', 'rejection', 'tool-call', 'subscription', 'audit', 'kpi']).has(edge.semantic)
}

function isLodHidden(
  lod: CanvasLod,
  supportive: boolean,
  selected: boolean,
  highlighted: boolean,
  groupHighlighted: boolean,
  hovered: boolean,
): boolean {
  if (selected || highlighted || groupHighlighted || hovered) {
    return false
  }

  if (lod === 'overview') {
    return supportive
  }

  return false
}

function buildBreadcrumbs(state: DiagramStore, manifest: GraphManifest): BreadcrumbItem[] {
  if (state.ui.selectedNodeId) {
    const node = resolveGraphNode(state.ui.selectedNodeId)
    if (!node) {
      return []
    }
    const items: BreadcrumbItem[] = []
    if (node.lane) {
      items.push({ id: `lane-${node.lane}`, label: manifest.nodes.find((item) => item.id === `LANE_${node.lane}`)?.title ?? `Lane ${node.lane}` })
    }
    if (node.band) {
      items.push({ id: node.band, label: node.band })
    }
    items.push({ id: node.id, label: node.title })
    return items
  }
  if (state.ui.selectedEdgeId) {
    const edge = resolveGraphEdge(state.ui.selectedEdgeId)
    if (!edge) {
      return []
    }
    return [
      { id: edge.source, label: resolveGraphNode(edge.source)?.title ?? edge.source },
      { id: edge.id, label: edge.id },
      { id: edge.target, label: resolveGraphNode(edge.target)?.title ?? edge.target },
    ]
  }
  if (state.ui.selectedStepId) {
    const step = resolveSequenceStep(state.ui.selectedStepId)
    if (!step) {
      return []
    }
    return [
      { id: 'panel-b', label: 'VoR sequence' },
      { id: step.id, label: step.title },
    ]
  }

  return [
    { id: 'overview', label: 'Overview' },
    { id: state.ui.filters.pathPreset, label: state.ui.filters.pathPreset === 'all' ? 'All paths' : `${state.ui.filters.pathPreset} path` },
  ]
}

function mergeRuleHighlights(
  triggerKey: EntityKey,
  manifest: GraphManifest,
  highlightedNodeIds: Set<string>,
  highlightedEdgeIds: Set<string>,
  highlightedStepIds: Set<string>,
) {
  for (const rule of manifest.interactionRules) {
    if (!rule.triggerIds.includes(triggerKey)) {
      continue
    }
    for (const relatedNode of rule.relatedNodeIds) {
      if (relatedNode.startsWith('node:')) {
        highlightedNodeIds.add(relatedNode.replace('node:', ''))
      }
    }
    for (const relatedEdge of rule.relatedEdgeIds) {
      if (relatedEdge.startsWith('edge:')) {
        highlightedEdgeIds.add(relatedEdge.replace('edge:', ''))
      }
    }
    for (const relatedStep of rule.relatedStepIds) {
      if (relatedStep.startsWith('step:')) {
        highlightedStepIds.add(relatedStep.replace('step:', ''))
      }
    }
  }
}

function collectPathFromNode(nodeId: string, direction: 'upstream' | 'downstream') {
  const nodes = new Set<string>([nodeId])
  const edges = new Set<string>()
  const queue = [nodeId]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) {
      continue
    }
    visited.add(current)

    for (const edge of graphManifest.edges.filter((item) => item.panel.includes('architecture'))) {
      if (direction === 'upstream' && edge.target === current) {
        edges.add(edge.id)
        nodes.add(edge.source)
        queue.push(edge.source)
      }
      if (direction === 'downstream' && edge.source === current) {
        edges.add(edge.id)
        nodes.add(edge.target)
        queue.push(edge.target)
      }
    }
  }

  return {
    nodes: [...nodes].map((id) => nodeEntityKey(id)),
    edges: [...edges].map((id) => edgeEntityKey(id)),
  }
}

function resolveHighlights(state: DiagramStore, manifest: GraphManifest) {
  const highlightedNodeIds = new Set<string>()
  const highlightedEdgeIds = new Set<string>()
  const highlightedStepIds = new Set<string>()

  if (state.ui.selectedNodeId) {
    const node = resolveGraphNode(state.ui.selectedNodeId)
    if (node) {
      highlightedNodeIds.add(node.id)
      for (const edgeId of node.inspector.relatedEdgeIds) {
        highlightedEdgeIds.add(edgeId)
      }
      for (const stepId of node.inspector.relatedStepIds) {
        highlightedStepIds.add(stepId)
      }
      for (const edge of manifest.edges) {
        if (edge.source === node.id || edge.target === node.id) {
          highlightedEdgeIds.add(edge.id)
          highlightedNodeIds.add(edge.source)
          highlightedNodeIds.add(edge.target)
        }
      }
      mergeRuleHighlights(nodeEntityKey(node.id), manifest, highlightedNodeIds, highlightedEdgeIds, highlightedStepIds)
    }
  }

  if (state.ui.selectedEdgeId) {
    const edge = resolveGraphEdge(state.ui.selectedEdgeId)
    if (edge) {
      highlightedEdgeIds.add(edge.id)
      highlightedNodeIds.add(edge.source)
      highlightedNodeIds.add(edge.target)
      for (const stepId of edge.interactive.relatedStepIds) {
        highlightedStepIds.add(stepId)
      }
      mergeRuleHighlights(edgeEntityKey(edge.id), manifest, highlightedNodeIds, highlightedEdgeIds, highlightedStepIds)
    }
  }

  if (state.ui.selectedStepId) {
    const step = resolveSequenceStep(state.ui.selectedStepId)
    if (step) {
      highlightedStepIds.add(step.id)
      for (const nodeId of step.linkedNodeIds) {
        highlightedNodeIds.add(nodeId)
      }
      for (const edgeId of step.linkedEdgeIds) {
        highlightedEdgeIds.add(edgeId)
      }
    }
  }

  if (state.ui.hoveredEntityKey) {
    if (state.ui.hoveredEntityKey.startsWith('node:')) {
      const nodeId = state.ui.hoveredEntityKey.replace('node:', '')
      highlightedNodeIds.add(nodeId)
      for (const edge of manifest.edges) {
        if (edge.source === nodeId || edge.target === nodeId) {
          highlightedEdgeIds.add(edge.id)
          highlightedNodeIds.add(edge.source)
          highlightedNodeIds.add(edge.target)
        }
      }
    } else if (state.ui.hoveredEntityKey.startsWith('edge:')) {
      const edgeId = state.ui.hoveredEntityKey.replace('edge:', '')
      const edge = resolveGraphEdge(edgeId)
      if (edge) {
        highlightedEdgeIds.add(edge.id)
        highlightedNodeIds.add(edge.source)
        highlightedNodeIds.add(edge.target)
      }
    } else if (state.ui.hoveredEntityKey.startsWith('step:')) {
      const stepId = state.ui.hoveredEntityKey.replace('step:', '')
      const step = resolveSequenceStep(stepId)
      if (step) {
        highlightedStepIds.add(step.id)
        step.linkedNodeIds.forEach((id) => highlightedNodeIds.add(id))
        step.linkedEdgeIds.forEach((id) => highlightedEdgeIds.add(id))
      }
    }
  }

  for (const key of state.ui.highlightedEntityKeys) {
    if (key.startsWith('node:')) {
      highlightedNodeIds.add(key.replace('node:', ''))
    } else if (key.startsWith('edge:')) {
      highlightedEdgeIds.add(key.replace('edge:', ''))
    } else if (key.startsWith('step:')) {
      highlightedStepIds.add(key.replace('step:', ''))
    }
  }

  return {
    highlightedNodeIds,
    highlightedEdgeIds,
    highlightedStepIds,
  }
}

export function getEntityPathHighlights(
  nodeId: string,
  direction: 'upstream' | 'downstream',
): EntityKey[] {
  const path = collectPathFromNode(nodeId, direction)
  return [...path.nodes, ...path.edges]
}

export function deriveDiagramState(state: DiagramStore, manifest: GraphManifest = graphManifest): DerivedDiagramState {
  const visibleNodeIds = new Set<string>()
  const visibleEdgeIds = new Set<string>()
  const visibleStepIds = new Set<string>()

  const hasActiveFilters =
    state.ui.filters.claims.length > 0 ||
    state.ui.filters.standards.length > 0 ||
    state.ui.filters.semanticFamilies.length > 0 ||
    state.ui.filters.lanes.length > 0 ||
    state.ui.filters.search.length > 0

  if (!hasActiveFilters) {
    manifest.nodes.forEach((node) => visibleNodeIds.add(node.id))
    manifest.edges.forEach((edge) => visibleEdgeIds.add(edge.id))
    manifest.steps.forEach((step) => visibleStepIds.add(step.id))
  } else {
    for (const node of manifest.nodes) {
      if (isStructuralNode(node) || nodeMatchesFilters(node, state, manifest)) {
        visibleNodeIds.add(node.id)
      }
    }

    for (const edge of manifest.edges) {
      if (edgeMatchesFilters(edge, state, manifest)) {
        visibleEdgeIds.add(edge.id)
        if (resolveGraphNode(edge.source)) {
          visibleNodeIds.add(edge.source)
        }
        if (resolveGraphNode(edge.target)) {
          visibleNodeIds.add(edge.target)
        }
      }
    }

    for (const node of manifest.nodes) {
      let currentParent = node.parentId
      while (currentParent) {
        visibleNodeIds.add(currentParent)
        currentParent = resolveGraphNode(currentParent)?.parentId
      }
    }

    for (const step of manifest.steps) {
      if (
        step.linkedNodeIds.some((nodeId) => visibleNodeIds.has(nodeId)) ||
        step.linkedEdgeIds.some((edgeId) => visibleEdgeIds.has(edgeId))
      ) {
        visibleStepIds.add(step.id)
      }
    }

    const sequenceTerminalIds = new Set(
      manifest.nodes.filter((node) => isSequenceTerminal(node)).map((node) => node.id),
    )

    for (const edge of manifest.edges.filter((item) => item.panel.includes('vor-sequence'))) {
      const sourceVisible = visibleStepIds.has(edge.source) || sequenceTerminalIds.has(edge.source)
      const targetVisible = visibleStepIds.has(edge.target) || sequenceTerminalIds.has(edge.target)
      if (sourceVisible && targetVisible) {
        visibleEdgeIds.add(edge.id)
      }
    }
  }

  const highlights = resolveHighlights(state, manifest)
  return {
    visibleNodeIds,
    visibleEdgeIds,
    visibleStepIds,
    ...highlights,
    breadcrumbs: buildBreadcrumbs(state, manifest),
  }
}

function edgeTypeForSpec(edge: EdgeSpec) {
  if (edge.semantic === 'writeback') {
    return 'WriteBackEdge'
  }
  if (edge.semantic === 'status-ack') {
    return 'AckEdge'
  }
  if (edge.semantic === 'rejection') {
    return 'AckEdge'
  }
  if (edge.semantic === 'tool-call') {
    return 'ToolCallEdge'
  }
  if (edge.semantic === 'subscription') {
    return 'KpiEdge'
  }
  if (edge.semantic === 'kpi') {
    return 'KpiEdge'
  }
  return 'ReadEdge'
}

function collectArchitectureHandleMaps(
  state: DiagramStore,
  manifest: GraphManifest,
) {
  const sourceHandleIds = new Map<string, Set<HandleId>>()
  const targetHandleIds = new Map<string, Set<HandleId>>()

  for (const edge of manifest.edges.filter((candidate) => candidate.panel.includes('architecture'))) {
    const { sourceHandle, targetHandle } = resolveEdgeHandles(edge, state.projection.edgeHandles)
    sourceHandleIds.set(edge.source, new Set([...(sourceHandleIds.get(edge.source) ?? []), sourceHandle]))
    targetHandleIds.set(edge.target, new Set([...(targetHandleIds.get(edge.target) ?? []), targetHandle]))
  }

  return {
    sourceHandleIds,
    targetHandleIds,
  }
}

export function compileArchitectureNodes(
  state: DiagramStore,
  callbacks: CompileCallbacks,
  derivedState: DerivedDiagramState,
  manifest: GraphManifest = graphManifest,
): DiagramFlowNode[] {
  const handleMaps = collectArchitectureHandleMaps(state, manifest)

  return manifest.nodes
    .filter((node) => node.panel.includes('architecture'))
    .map((node) => {
      const position = state.layout.positions[node.id] ?? { x: 0, y: 0 }
      const visual = resolveNodeVisual(node)
      const highlighted = derivedState.highlightedNodeIds.has(node.id)
      const hasHighlights =
        derivedState.highlightedNodeIds.size > 0 ||
        derivedState.highlightedEdgeIds.size > 0 ||
        derivedState.highlightedStepIds.size > 0
      const selected = state.ui.selectedNodeId === node.id
      const collapsed = state.projection.collapsedNodeIds.includes(node.id)

      return {
        id: node.id,
        type: node.nodeType,
        position,
        hidden: !derivedState.visibleNodeIds.has(node.id),
        draggable: state.ui.mode === 'author' && !node.fixed,
        selectable: !isStructuralNode(node),
        focusable: !isStructuralNode(node),
        className: isStructuralNode(node) ? 'rf-node--structural' : 'rf-node--interactive',
        width: node.width,
        height: node.height,
        ariaLabel: buildNodeAriaLabel(node, manifest),
        data: {
          spec: node,
          visual,
          ariaLabel: buildNodeAriaLabel(node, manifest),
          standards: getStandardsForSpec(node.standardIds, manifest),
          claims: getClaimsForSpec(node.claimIds, manifest),
          claimDots: node.claimIds.map((_, index) => resolveClaimDotColor(index)),
          annotation: state.projection.annotations[node.id],
          selected,
          highlighted,
          dimmed: hasHighlights && !highlighted,
          authorMode: state.ui.mode === 'author',
          collapsed,
          renderMode: resolveNodeRenderMode(node, state.ui.viewport.zoom, selected, collapsed),
          notesExpanded: state.projection.expandedNoteIds.includes(node.id),
          sourceHandleIds: [...(handleMaps.sourceHandleIds.get(node.id) ?? [])].sort(compareHandleIds),
          targetHandleIds: [...(handleMaps.targetHandleIds.get(node.id) ?? [])].sort(compareHandleIds),
          callbacks,
        },
        style: {
          width: node.width,
          height: node.height,
        },
      }
    })
}

export function compileArchitectureEdges(
  state: DiagramStore,
  callbacks: CompileCallbacks,
  derivedState: DerivedDiagramState,
  manifest: GraphManifest = graphManifest,
): DiagramFlowEdge[] {
  if (!state.layout.ready) {
    return []
  }

  const routeChannels = buildBoardGeometryFromPositions(state.layout.positions, manifest).routeChannels
  const selectedEdge = state.ui.selectedEdgeId ? resolveGraphEdge(state.ui.selectedEdgeId) : undefined
  const hoveredEdgeId = state.ui.hoveredEntityKey?.startsWith('edge:')
    ? state.ui.hoveredEntityKey.replace('edge:', '')
    : undefined
  const hoveredEdge = hoveredEdgeId ? resolveGraphEdge(hoveredEdgeId) : undefined
  const selectedNodeId = state.ui.selectedNodeId
  const hoveredNodeId = state.ui.hoveredEntityKey?.startsWith('node:')
    ? state.ui.hoveredEntityKey.replace('node:', '')
    : undefined
  const selectedStep = state.ui.selectedStepId ? resolveSequenceStep(state.ui.selectedStepId) : undefined
  const hoveredStepId = state.ui.hoveredEntityKey?.startsWith('step:')
    ? state.ui.hoveredEntityKey.replace('step:', '')
    : undefined
  const hoveredStep = hoveredStepId ? resolveSequenceStep(hoveredStepId) : undefined
  const explicitlyHighlightedEdgeKeys = new Set(
    state.ui.highlightedEntityKeys
      .filter((key) => key.startsWith('edge:'))
      .map((key) => key.replace('edge:', '')),
  )
  const sharedT0FocusActive = [...derivedState.highlightedEdgeIds].some((edgeId) => {
    const highlightedEdge = resolveGraphEdge(edgeId)
    return highlightedEdge?.panel.includes('architecture') && highlightedEdge.tags.includes('t0')
  })
  const canvasLod = resolveCanvasLod(state.ui.viewport.zoom)
  const activeHighlightGroups = new Set(
    [...derivedState.highlightedEdgeIds]
      .map((edgeId) => resolveGraphEdge(edgeId)?.interactive.highlightGroup)
      .filter((group): group is string => Boolean(group)),
  )
  const hasHighlights =
    derivedState.highlightedNodeIds.size > 0 ||
    derivedState.highlightedEdgeIds.size > 0 ||
    derivedState.highlightedStepIds.size > 0

  const compiledEdges = manifest.edges
    .filter((edge) => edge.panel.includes('architecture'))
    .map((edge) => {
      const { sourceHandle, targetHandle } = resolveEdgeHandles(edge, state.projection.edgeHandles)
      const searchMatched = state.ui.filters.search.length > 0 && edgeMatchesSearchQuery(edge, state.ui.filters.search, manifest)
      const hovered = hoveredEdgeId === edge.id
      const explicitlyHighlighted = explicitlyHighlightedEdgeKeys.has(edge.id)
      const highlighted = derivedState.highlightedEdgeIds.has(edge.id)
      const groupHighlighted =
        !highlighted &&
        typeof edge.interactive.highlightGroup === 'string' &&
        activeHighlightGroups.has(edge.interactive.highlightGroup)
      const activePath =
        explicitlyHighlighted ||
        groupHighlighted ||
        (selectedStep?.linkedEdgeIds.includes(edge.id) ?? false)
      const localNeighborhood =
        !activePath &&
        (
          (selectedNodeId ? edge.source === selectedNodeId || edge.target === selectedNodeId : false) ||
          (hoveredNodeId ? edge.source === hoveredNodeId || edge.target === hoveredNodeId : false) ||
          (selectedEdge ? edge.id !== selectedEdge.id && sharesEndpoint(edge, selectedEdge) : false) ||
          (hoveredEdge ? edge.id !== hoveredEdge.id && sharesEndpoint(edge, hoveredEdge) : false) ||
          (hoveredStep?.linkedEdgeIds.includes(edge.id) ?? false)
        )
      const selected = state.ui.selectedEdgeId === edge.id
      const narrativeMatched = edgeMatchesNarrativePreset(edge, state.ui.filters.pathPreset)
      const supportive = edgeSupportiveByDefault(edge)
      const labelMode = resolveEdgeLabelMode(state.ui.viewport.zoom, {
        selected,
        hovered,
        highlighted: activePath,
        searchMatched,
        localNeighborhood,
      })
      const route = buildBoardEdgeRouteFromPositions(
        edge,
        state.layout.positions,
        manifest,
        { sourceHandle, targetHandle },
      )

      return {
        id: edge.id,
        type: edgeTypeForSpec(edge),
        source: edge.source,
        target: edge.target,
        sourceHandle,
        targetHandle,
        hidden: !derivedState.visibleEdgeIds.has(edge.id)
          || isLodHidden(canvasLod, supportive, selected, highlighted, groupHighlighted, hovered),
        selectable: true,
        focusable: true,
        ariaLabel: buildEdgeAriaLabel(edge, manifest),
        animated:
          !state.ui.reduceMotion &&
          !state.ui.systemReduceMotion &&
          !edge.interactive.optional &&
          getSemanticShouldAnimate(edge.semantic),
        data: {
          spec: edge,
          routeChannels,
          route,
          ariaLabel: buildEdgeAriaLabel(edge, manifest),
          sourceTitle: resolveGraphNode(edge.source)?.title ?? edge.source,
          targetTitle: resolveGraphNode(edge.target)?.title ?? edge.target,
          standards: getStandardsForSpec(edge.standardIds, manifest),
          claims: getClaimsForSpec(edge.claimIds, manifest),
          optional: edge.interactive.optional,
          selected,
          hovered,
          searchMatched,
          localNeighborhood,
          highlighted,
          groupHighlighted,
          dimmed: hasHighlights ? !highlighted && !groupHighlighted : state.ui.filters.pathPreset !== 'all' && !narrativeMatched,
          supportive,
          narrativeMatched,
          sharedTagFocused: sharedT0FocusActive && edge.tags.includes('t0'),
          highlightGroup: edge.interactive.highlightGroup,
          canvasLod,
          labelMode,
          sourceHandle,
          targetHandle,
          callbacks,
        },
      }
    })

  const routeBridgeMap = assignBoardRouteBridges(
    compiledEdges
      .filter((edge) => !edge.hidden)
      .map((edge) => ({
        edge: edge.data.spec,
        route: edge.data.route,
      })),
  )

  return compiledEdges.map((edge) => ({
    ...edge,
    data: {
      ...edge.data,
      route: {
        ...edge.data.route,
        bridges: routeBridgeMap.get(edge.id) ?? [],
      },
    },
  }))
}
