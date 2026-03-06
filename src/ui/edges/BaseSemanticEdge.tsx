import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react'
import clsx from 'clsx'

import type { DiagramFlowEdge } from '@/graph/compile/toReactFlow'
import { edgeEntityKey } from '@/graph/spec/manifest'

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
  sourcePosition,
  targetPosition,
}: EdgeProps<DiagramFlowEdge>) {
  if (!data) {
    return null
  }

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition: sourcePosition ?? Position.Right,
    targetPosition: targetPosition ?? Position.Left,
    borderRadius: 14,
  })

  const strokeColor = strokeColors[data.spec.semantic] ?? strokeColors.default
  const strokeWidth = strokeWidths[data.spec.style] ?? 1.5
  const strokeDasharray =
    data.spec.style === 'dashed' ? '8 4' : data.spec.style === 'dotted' ? '2 5' : undefined
  const labelYOffset =
    data.spec.semantic === 'status-ack'
      ? 22
      : data.spec.semantic === 'rejection'
        ? 22
      : data.spec.semantic === 'writeback'
        ? -18
        : data.spec.semantic === 'tool-call'
          ? 16
          : 0

  return (
    <g
      className={clsx('semantic-edge', data.selected && 'is-selected', data.highlighted && 'is-highlighted', data.dimmed && 'is-dimmed')}
      onMouseEnter={() => data.callbacks.onHover(edgeEntityKey(id))}
      onMouseLeave={() => data.callbacks.onHover(undefined)}
      onClick={() => data.callbacks.onSelectEdge(id)}
    >
      <title>{data.ariaLabel}</title>
      <desc>{data.spec.inspector.rationale}</desc>
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={18} />
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray,
        }}
      />
      <EdgeLabelRenderer>
        <button
          type="button"
          className={clsx('edge-label', data.selected && 'is-selected', data.highlighted && 'is-highlighted')}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + labelYOffset}px)`,
          }}
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
