import { graphManifest, resolveGraphNode } from '@/graph/spec/manifest'
import type { EdgeSpec, GraphManifest, ProjectionOverrides } from '@/graph/spec/schema'
import { resolveEdgeHandles } from '@/layout/ports'
import type { DiagramStore } from '@/state/diagramStore'

import { deriveDiagramState } from './toReactFlow'

function sortSequenceSteps(steps: GraphManifest['steps']) {
  return [...steps].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
}

function esc(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function anchorPoint(nodeId: string, handleId: 'left' | 'right' | 'top' | 'bottom', state: DiagramStore) {
  const node = resolveGraphNode(nodeId)
  const position = state.layout.positions[nodeId]
  if (!node || !position) {
    return { x: 0, y: 0 }
  }

  switch (handleId) {
    case 'left':
      return { x: position.x, y: position.y + node.height / 2 }
    case 'right':
      return { x: position.x + node.width, y: position.y + node.height / 2 }
    case 'top':
      return { x: position.x + node.width / 2, y: position.y }
    case 'bottom':
      return { x: position.x + node.width / 2, y: position.y + node.height }
  }
}

function buildEdgePath(edge: EdgeSpec, state: DiagramStore, projection: ProjectionOverrides) {
  const handles = resolveEdgeHandles(edge, projection.edgeHandles)
  const source = anchorPoint(edge.source, handles.sourceHandle, state)
  const target = anchorPoint(edge.target, handles.targetHandle, state)
  const midX = (source.x + target.x) / 2
  return {
    path: `M ${source.x} ${source.y} L ${midX} ${source.y} L ${midX} ${target.y} L ${target.x} ${target.y}`,
    source,
    target,
  }
}

function edgeStroke(edge: EdgeSpec) {
  switch (edge.semantic) {
    case 'writeback':
      return '#d35400'
    case 'status-ack':
    case 'rejection':
      return '#7d8597'
    case 'tool-call':
      return '#148a8a'
    case 'subscription':
    case 'kpi':
    case 'read-only':
      return '#2d6cdf'
    case 'audit':
      return '#8d6e63'
    default:
      return '#455a75'
  }
}

function edgeWidth(edge: EdgeSpec) {
  switch (edge.style) {
    case 'bold':
      return 3
    case 'medium':
      return 2
    case 'thin':
    case 'dotted':
      return 1.2
    case 'dashed':
      return 1.6
  }
}

function edgeDash(edge: EdgeSpec) {
  if (edge.style === 'dashed') {
    return 'stroke-dasharray="8 4"'
  }
  if (edge.style === 'dotted') {
    return 'stroke-dasharray="2 5"'
  }
  return ''
}

export function toPublicationSvg(
  state: DiagramStore,
  exportMode: 'current' | 'full',
  manifest: GraphManifest = graphManifest,
): string {
  const effectiveState =
    exportMode === 'full'
      ? {
          ...state,
          ui: {
            ...state.ui,
            filters: {
              claims: [],
              standards: [],
              semantics: [],
              lanes: [],
              search: '',
              pathPreset: 'all' as const,
            },
          },
        }
      : state

  const derived = deriveDiagramState(effectiveState as DiagramStore, manifest)
  const width = manifest.layoutDefaults.canvas.width
  const height = manifest.layoutDefaults.canvas.height + 290

  const architectureNodes = manifest.nodes.filter(
    (node) => node.panel.includes('architecture') && derived.visibleNodeIds.has(node.id),
  )
  const architectureEdges = manifest.edges.filter(
    (edge) => edge.panel.includes('architecture') && derived.visibleEdgeIds.has(edge.id),
  )
  const sequenceSteps = sortSequenceSteps(
    manifest.steps.filter((step) => derived.visibleStepIds.has(step.id)),
  )
  const sequenceEdges = manifest.edges.filter(
    (edge) => edge.panel.includes('vor-sequence') && derived.visibleEdgeIds.has(edge.id),
  )
  const sequenceTerminals = manifest.nodes.filter(
    (node) => node.panel.includes('vor-sequence') && derived.visibleNodeIds.has(node.id),
  )

  const stepStartX = 230
  const stepY = manifest.layoutDefaults.canvas.height + 80
  const stepWidth = 270
  const stepGap = 24
  const terminalMap = Object.fromEntries(sequenceTerminals.map((node) => [node.id, node]))
  const stepAnchors = Object.fromEntries(
    sequenceSteps.map((step, index) => [
      step.id,
      {
        x: stepStartX + index * (stepWidth + stepGap),
        y: stepY,
        width: stepWidth,
        height: 110,
      },
    ]),
  )
  const leftTerminal = terminalMap.PB_AEA
  const rejectTerminal = terminalMap.PB_REJECT_OUT
  const terminalAnchors: Record<string, { x: number; y: number; width: number; height: number }> = {}

  if (leftTerminal) {
    terminalAnchors[leftTerminal.id] = {
      x: 32,
      y: stepY + 12,
      width: leftTerminal.width,
      height: leftTerminal.height,
    }
  }

  if (rejectTerminal) {
    const pb4Anchor = stepAnchors.PB4
    terminalAnchors[rejectTerminal.id] = {
      x: (pb4Anchor?.x ?? stepStartX) + 42,
      y: stepY + 152,
      width: rejectTerminal.width,
      height: rejectTerminal.height,
    }
  }

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
  <title>AEA Architecture Graph Export</title>
  <desc>Publication export of the AEA architecture graph application including Panel A and Panel B.</desc>
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 10 4 L 0 8 z" fill="#455a75" />
    </marker>
    <marker id="arrowhead-write" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 10 4 L 0 8 z" fill="#d35400" />
    </marker>
    <marker id="arrowhead-blue" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 10 4 L 0 8 z" fill="#2d6cdf" />
    </marker>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" fill="#f4f6f9" />
  <text x="32" y="40" fill="#1f2937" font-size="24" font-family="Arial, sans-serif" font-weight="700">(a) Architecture Across NOA Zones</text>
  ${architectureNodes
    .map((node) => {
      const position = effectiveState.layout.positions[node.id]
      if (!position) {
        return ''
      }
      const isStructural = node.kind === 'lane' || node.kind === 'container' || node.kind === 'band'
      const titleY = position.y + (isStructural ? 28 : 24)
      const subtitleY = titleY + 20
      const badgeY = subtitleY + 18
      const standards = node.standardIds
        .map((id) => manifest.standards[id]?.label)
        .filter(Boolean)
        .slice(0, 2)
        .join(' · ')

      return `
  <g id="node-${node.id}">
    <title>${esc(node.id)}: ${esc(node.title)}</title>
    <desc>${esc(node.description)}</desc>
    <rect x="${position.x}" y="${position.y}" width="${node.width}" height="${node.height}" rx="${isStructural ? 20 : 16}" fill="${node.visual.fill}" stroke="${node.visual.border}" stroke-width="${isStructural ? 1.4 : 1.8}" />
    <text x="${position.x + 16}" y="${titleY}" fill="#1f2937" font-size="${isStructural ? 18 : 15}" font-family="Arial, sans-serif" font-weight="700">${esc(node.id === node.title ? node.title : `${node.id} · ${node.title}`)}</text>
    ${node.subtitle ? `<text x="${position.x + 16}" y="${subtitleY}" fill="#4b5563" font-size="${isStructural ? 13 : 12}" font-family="Arial, sans-serif">${esc(node.subtitle)}</text>` : ''}
    ${standards ? `<text x="${position.x + 16}" y="${badgeY}" fill="#455a75" font-size="11" font-family="Arial, sans-serif">${esc(standards)}</text>` : ''}
  </g>`
    })
    .join('\n')}
  ${architectureEdges
    .map((edge) => {
      const { path, source, target } = buildEdgePath(edge, effectiveState as DiagramStore, effectiveState.projection)
      const labelX = (source.x + target.x) / 2
      const labelY = (source.y + target.y) / 2 - 8
      const marker =
        edge.semantic === 'writeback'
          ? 'arrowhead-write'
          : edge.semantic === 'kpi' ||
              edge.semantic === 'read-only' ||
              edge.semantic === 'subscription'
            ? 'arrowhead-blue'
            : 'arrowhead'
      return `
  <g id="edge-${edge.id}">
    <title>${esc(edge.id)}: ${esc(edge.label)}</title>
    <desc>${esc(edge.inspector.rationale)}</desc>
    <path d="${path}" fill="none" stroke="${edgeStroke(edge)}" stroke-width="${edgeWidth(edge)}" ${edgeDash(edge)} marker-end="url(#${marker})" />
    <text x="${labelX}" y="${labelY}" text-anchor="middle" fill="#334155" font-size="11" font-family="Arial, sans-serif">${esc(edge.id)}${edge.markers.includes('diode') ? ' ⊘' : ''} · ${esc(edge.label)}</text>
  </g>`
    })
    .join('\n')}
  <text x="32" y="${manifest.layoutDefaults.canvas.height + 36}" fill="#1f2937" font-size="24" font-family="Arial, sans-serif" font-weight="700">(b) VoR Domain-Transition Sequence (NE 178, 2025)</text>
  ${sequenceTerminals
    .map((node) => {
      const anchor = terminalAnchors[node.id]
      if (!anchor) {
        return ''
      }
      return `
  <g id="sequence-node-${node.id}">
    <title>${esc(node.id)}: ${esc(node.title)}</title>
    <desc>${esc(node.description)}</desc>
    <rect x="${anchor.x}" y="${anchor.y}" width="${anchor.width}" height="${anchor.height}" rx="18" fill="${esc(node.visual.fill)}" stroke="${esc(node.visual.border)}" stroke-width="1.6" />
    <text x="${anchor.x + 16}" y="${anchor.y + 26}" fill="#1f2937" font-size="12" font-family="Arial, sans-serif" font-weight="700">${esc(node.id)}</text>
    <text x="${anchor.x + 16}" y="${anchor.y + 46}" fill="#1f2937" font-size="14" font-family="Arial, sans-serif" font-weight="700">${esc(node.title)}</text>
    ${node.subtitle ? `<text x="${anchor.x + 16}" y="${anchor.y + 64}" fill="#4b5563" font-size="11" font-family="Arial, sans-serif">${esc(node.subtitle)}</text>` : ''}
  </g>`
    })
    .join('\n')}
  ${sequenceSteps
    .map((step, index) => {
      const x = stepStartX + index * (stepWidth + stepGap)
      return `
  <g id="step-${step.id}">
    <title>${esc(step.id)}: ${esc(step.title)}</title>
    <desc>${esc(step.summary)}</desc>
    <rect x="${x}" y="${stepY}" width="${stepWidth}" height="110" rx="18" fill="#ffffff" stroke="#d35400" stroke-width="1.8" />
    <text x="${x + 18}" y="${stepY + 28}" fill="#1f2937" font-size="15" font-family="Arial, sans-serif" font-weight="700">${esc(step.id)} · ${esc(step.title)}</text>
    <text x="${x + 18}" y="${stepY + 52}" fill="#4b5563" font-size="12" font-family="Arial, sans-serif">${esc(step.summary)}</text>
  </g>`
    })
    .join('\n')}
  ${sequenceEdges
    .map((edge) => {
      const sourceAnchor =
        stepAnchors[edge.source] ?? terminalAnchors[edge.source]
      const targetAnchor =
        stepAnchors[edge.target] ?? terminalAnchors[edge.target]
      if (!sourceAnchor || !targetAnchor) {
        return ''
      }
      const sourceX =
        edge.source.startsWith('PB') && stepAnchors[edge.source]
          ? sourceAnchor.x + sourceAnchor.width
          : sourceAnchor.x + sourceAnchor.width / 2
      const sourceY =
        edge.source.startsWith('PB') && stepAnchors[edge.source]
          ? sourceAnchor.y + sourceAnchor.height / 2
          : sourceAnchor.y + sourceAnchor.height / 2
      const targetX =
        edge.target.startsWith('PB') && stepAnchors[edge.target]
          ? targetAnchor.x
          : targetAnchor.x + targetAnchor.width / 2
      const targetY =
        edge.target === 'PB_REJECT_OUT'
          ? targetAnchor.y
          : targetAnchor.y + targetAnchor.height / 2
      const isStatusEdge = edge.semantic === 'status-ack' || edge.semantic === 'rejection'
      const path = isStatusEdge
        ? edge.id === 'PB_REJECT'
          ? `M ${sourceAnchor.x + sourceAnchor.width / 2} ${sourceAnchor.y + sourceAnchor.height} L ${sourceAnchor.x + sourceAnchor.width / 2} ${targetAnchor.y - 16} L ${targetAnchor.x + targetAnchor.width / 2} ${targetAnchor.y - 16} L ${targetAnchor.x + targetAnchor.width / 2} ${targetAnchor.y}`
          : `M ${sourceAnchor.x + sourceAnchor.width - 20} ${sourceAnchor.y + sourceAnchor.height + 8} L ${sourceAnchor.x + sourceAnchor.width - 20} ${stepY + 154} L ${targetAnchor.x + targetAnchor.width / 2} ${stepY + 154} L ${targetAnchor.x + targetAnchor.width / 2} ${targetAnchor.y + targetAnchor.height}`
        : `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`
      const labelX = (sourceX + targetX) / 2
      const labelY = isStatusEdge ? Math.max(sourceY, targetY) + 34 : stepY + 44
      const marker =
        edge.semantic === 'writeback'
          ? 'arrowhead-write'
          : edge.semantic === 'kpi' ||
              edge.semantic === 'read-only' ||
              edge.semantic === 'subscription'
            ? 'arrowhead-blue'
            : 'arrowhead'
      return `
  <g id="sequence-edge-${edge.id}">
    <title>${esc(edge.id)}: ${esc(edge.label)}</title>
    <desc>${esc(edge.inspector.rationale)}</desc>
    <path d="${path}" fill="none" stroke="${edgeStroke(edge)}" stroke-width="${edgeWidth(edge)}" ${edgeDash(edge)} marker-end="url(#${marker})" />
    <text x="${labelX}" y="${labelY}" text-anchor="middle" fill="#334155" font-size="11" font-family="Arial, sans-serif">${esc(edge.label)}</text>
  </g>`
    })
    .join('\n')}
</svg>`.trim()
}
