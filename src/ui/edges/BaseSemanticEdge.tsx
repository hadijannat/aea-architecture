import type { CSSProperties } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
} from '@xyflow/react'
import clsx from 'clsx'

import {
  edgeStrokeDash,
  edgeStrokeWidth,
  getSemanticPresentation,
} from '@/graph/compile/semanticPresentation'
import type { DiagramFlowEdge } from '@/graph/compile/toReactFlow'
import { edgeEntityKey } from '@/graph/spec/manifest'
import { buildBoardEdgeRoute, resolveBoardLabelPosition } from '@/layout/board'

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

  const presentation = getSemanticPresentation(data.spec.semantic)
  const strokeColor = presentation.stroke
  const strokeWidth = edgeStrokeWidth(data.spec.style)
  const strokeDasharray = edgeStrokeDash(data.spec.style)

  return (
    <g
      className={clsx(
        'semantic-edge',
        `semantic-edge--${data.spec.semantic}`,
        `semantic-edge-family--${presentation.family}`,
        data.selected && 'is-selected',
        data.highlighted && 'is-highlighted',
        data.dimmed && 'is-dimmed',
      )}
      data-edge-id={id}
      data-edge-semantic={data.spec.semantic}
      data-edge-family={presentation.family}
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
          className={clsx(
            'edge-label',
            `edge-label--${data.spec.semantic}`,
            data.selected && 'is-selected',
            data.highlighted && 'is-highlighted',
          )}
          aria-label={data.ariaLabel}
          data-edge-id={id}
          data-edge-label-mode="compact"
          style={{
            '--semantic-stroke': presentation.stroke,
            transform: `translate(-50%, -50%) translate(${labelPosition.x}px, ${labelPosition.y}px)`,
          } as CSSProperties}
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
