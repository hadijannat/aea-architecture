import { Position } from '@xyflow/react'

import type { EdgeSpec, ProjectionOverrides } from '@/graph/spec/schema'

export type HandleId = 'left' | 'right' | 'top' | 'bottom'

const handlePositionMap: Record<HandleId, Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
}

const fallbackByDirection: Record<EdgeSpec['direction'], { source: HandleId; target: HandleId }> = {
  ltr: { source: 'right', target: 'left' },
  rtl: { source: 'left', target: 'right' },
  ttb: { source: 'bottom', target: 'top' },
  btt: { source: 'top', target: 'bottom' },
}

export function getHandlePosition(handle: HandleId): Position {
  return handlePositionMap[handle]
}

export function resolveEdgeHandles(
  edge: EdgeSpec,
  overrides: ProjectionOverrides['edgeHandles'],
): { sourceHandle: HandleId; targetHandle: HandleId } {
  const override = overrides[edge.id]
  const fallback = fallbackByDirection[edge.direction]

  return {
    sourceHandle:
      override?.sourceHandle ??
      edge.interactive.sourceHandle ??
      fallback.source,
    targetHandle:
      override?.targetHandle ??
      edge.interactive.targetHandle ??
      fallback.target,
  }
}
