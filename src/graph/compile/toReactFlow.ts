import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react'

import { buildEdgeAriaLabel, buildNodeAriaLabel } from '@/a11y/aria'
import {
  getSemanticShouldAnimate,
  matchesSemanticFamilies,
} from '@/graph/compile/semanticPresentation'
import {
  edgeEntityKey,
  graphManifest,
  nodeEntityKey,
  resolveGraphEdge,
  resolveGraphNode,
  resolveSequenceStep,
} from '@/graph/spec/manifest'
import type { ClaimId, EdgeSpec, EntityKey, GraphManifest, NodeSpec } from '@/graph/spec/schema'
import { resolveEdgeHandles } from '@/layout/ports'
import type { DiagramStore } from '@/state/diagramStore'

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
  ariaLabel: string
  standards: ReturnType<typeof getStandardsForSpec>
  claims: ReturnType<typeof getClaimsForSpec>
  annotation?: string
  selected: boolean
  highlighted: boolean
  dimmed: boolean
  authorMode: boolean
  collapsed: boolean
  notesExpanded: boolean
  callbacks: CompileCallbacks
}

export interface CompiledEdgeData extends Record<string, unknown> {
  spec: EdgeSpec
  ariaLabel: string
  sourceTitle: string
  targetTitle: string
  standards: ReturnType<typeof getStandardsForSpec>
  claims: ReturnType<typeof getClaimsForSpec>
  optional: boolean
  selected: boolean
  highlighted: boolean
  dimmed: boolean
  sharedTagFocused: boolean
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
  if (!includesPathTag(node.tags, filters.pathPreset)) {
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
  const standards = getStandardsForSpec(edge.standardIds, manifest)
  const claims = getClaimsForSpec(edge.claimIds, manifest)

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
  if (!includesPathTag(edge.tags, filters.pathPreset)) {
    return false
  }

  const source = resolveGraphNode(edge.source)?.title ?? edge.source
  const target = resolveGraphNode(edge.target)?.title ?? edge.target
  return matchesSearch(filters.search, [
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
    state.ui.filters.search.length > 0 ||
    state.ui.filters.pathPreset !== 'all'

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

export function compileArchitectureNodes(
  state: DiagramStore,
  callbacks: CompileCallbacks,
  derivedState: DerivedDiagramState,
  manifest: GraphManifest = graphManifest,
): DiagramFlowNode[] {
  return manifest.nodes
    .filter((node) => node.panel.includes('architecture'))
    .map((node) => {
      const position = state.layout.positions[node.id] ?? { x: 0, y: 0 }
      const highlighted = derivedState.highlightedNodeIds.has(node.id)
      const hasHighlights =
        derivedState.highlightedNodeIds.size > 0 ||
        derivedState.highlightedEdgeIds.size > 0 ||
        derivedState.highlightedStepIds.size > 0

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
          ariaLabel: buildNodeAriaLabel(node, manifest),
          standards: getStandardsForSpec(node.standardIds, manifest),
          claims: getClaimsForSpec(node.claimIds, manifest),
          annotation: state.projection.annotations[node.id],
          selected: state.ui.selectedNodeId === node.id,
          highlighted,
          dimmed: hasHighlights && !highlighted,
          authorMode: state.ui.mode === 'author',
          collapsed: state.projection.collapsedNodeIds.includes(node.id),
          notesExpanded: state.projection.expandedNoteIds.includes(node.id),
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
  const sharedT0FocusActive = [...derivedState.highlightedEdgeIds].some((edgeId) => {
    const highlightedEdge = resolveGraphEdge(edgeId)
    return highlightedEdge?.panel.includes('architecture') && highlightedEdge.tags.includes('t0')
  })

  return manifest.edges
    .filter((edge) => edge.panel.includes('architecture'))
    .map((edge) => {
      const { sourceHandle, targetHandle } = resolveEdgeHandles(edge, state.projection.edgeHandles)
      const highlighted = derivedState.highlightedEdgeIds.has(edge.id)
      const hasHighlights =
        derivedState.highlightedNodeIds.size > 0 ||
        derivedState.highlightedEdgeIds.size > 0 ||
        derivedState.highlightedStepIds.size > 0

      return {
        id: edge.id,
        type: edgeTypeForSpec(edge),
        source: edge.source,
        target: edge.target,
        sourceHandle,
        targetHandle,
        hidden: !derivedState.visibleEdgeIds.has(edge.id),
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
          ariaLabel: buildEdgeAriaLabel(edge, manifest),
          sourceTitle: resolveGraphNode(edge.source)?.title ?? edge.source,
          targetTitle: resolveGraphNode(edge.target)?.title ?? edge.target,
          standards: getStandardsForSpec(edge.standardIds, manifest),
          claims: getClaimsForSpec(edge.claimIds, manifest),
          optional: edge.interactive.optional,
          selected: state.ui.selectedEdgeId === edge.id,
          highlighted,
          dimmed: hasHighlights && !highlighted,
          sharedTagFocused: sharedT0FocusActive && edge.tags.includes('t0'),
          callbacks,
        },
      }
    })
}
