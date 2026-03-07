import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
} from '@xyflow/react'
import clsx from 'clsx'

import type { DiagramFlowEdge } from '@/graph/compile/toReactFlow'
import { edgeEntityKey } from '@/graph/spec/manifest'
import { buildBoardEdgeRoute, resolveBoardLabelPosition } from '@/layout/board'

const strokeColors: Record<string, string> = {
  writeback: '#d35400',
  'status-ack': '#7d8597',
  rejection: '#7d8597',
  'tool-call': '#148a8a',
  subscription: '#2d6cdf',
  kpi: '#2d6cdf',
  audit: '#8d6e63',
  'read-only': '#2d6cdf',
  default: '#455a75',
}

const strokeWidths: Record<string, number> = {
  bold: 3.2,
  medium: 2.2,
  thin: 1.3,
  dashed: 1.8,
  dotted: 1.4,
}

export function BaseSemanticEdge({
  id,
  data,
  markerEnd,
  sourceX,
  sourceY,
  targetX,
  targetY,
}: EdgeProps<DiagramFlowEdge>) {
  if (!data) {
    return null
  }

  const route = buildBoardEdgeRoute(
    data.spec,
    { x: sourceX, y: sourceY },
    { x: targetX, y: targetY },
  )
  const edgePath = route.path
  const labelPosition = resolveBoardLabelPosition(route.label)
  const edgePoints = route.points.map((point) => `${point.x},${point.y}`).join(' ')

  const strokeColor = strokeColors[data.spec.semantic] ?? strokeColors.default
  const strokeWidth = strokeWidths[data.spec.style] ?? 1.5
  const strokeDasharray =
    data.spec.style === 'dashed' ? '8 4' : data.spec.style === 'dotted' ? '2 5' : undefined

  return (
    <g
      className={clsx('semantic-edge', data.selected && 'is-selected', data.highlighted && 'is-highlighted', data.dimmed && 'is-dimmed')}
      data-edge-id={id}
      data-edge-points={edgePoints}
      data-label-position={`${labelPosition.x},${labelPosition.y}`}
      onMouseEnter={() => data.callbacks.onHover(edgeEntityKey(id))}
      onMouseLeave={() => data.callbacks.onHover(undefined)}
      onClick={() => data.callbacks.onSelectEdge(id)}
    >
      <title>{data.ariaLabel}</title>
      <desc>{data.spec.inspector.rationale}</desc>
      <path d={edgePath} data-edge-id={id} data-edge-path={edgePath} fill="none" stroke="transparent" strokeWidth={18} />
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={18}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          vectorEffect: 'non-scaling-stroke',
        }}
      />
      <EdgeLabelRenderer>
        <button
          type="button"
          className={clsx('edge-label', data.selected && 'is-selected', data.highlighted && 'is-highlighted')}
          aria-label={data.ariaLabel}
          data-edge-id={id}
          style={{
            transform: `translate(-50%, -50%) translate(${labelPosition.x}px, ${labelPosition.y}px)`,
          }}
          onFocus={() => data.callbacks.onHover(edgeEntityKey(id))}
          onBlur={() => data.callbacks.onHover(undefined)}
          onPointerDown={(event) => {
            event.stopPropagation()
            data.callbacks.onSelectEdge(id)
          }}
          onClick={(event) => {
            event.stopPropagation()
            data.callbacks.onSelectEdge(id)
          }}
        >
          {data.spec.id}
          {data.spec.markers.includes('diode') ? ' ⊘' : ''}
        </button>
      </EdgeLabelRenderer>
    </g>
  )
}
