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

const boardHandleOverrides: Partial<Record<string, { sourceHandle: HandleId; targetHandle: HandleId }>> = {
  F3e: { sourceHandle: 'bottom', targetHandle: 'top' },
  F3g: { sourceHandle: 'bottom', targetHandle: 'top' },
  F3i: { sourceHandle: 'right', targetHandle: 'left' },
  F_KPI: { sourceHandle: 'right', targetHandle: 'left' },
  F7b: { sourceHandle: 'bottom', targetHandle: 'top' },
  F7_sub: { sourceHandle: 'top', targetHandle: 'bottom' },
}

export function getHandlePosition(handle: HandleId): Position {
  return handlePositionMap[handle]
}

export function resolveEdgeHandles(
  edge: EdgeSpec,
  overrides: ProjectionOverrides['edgeHandles'],
): { sourceHandle: HandleId; targetHandle: HandleId } {
  const override = overrides[edge.id]
  const boardOverride = boardHandleOverrides[edge.id]
  const fallback = fallbackByDirection[edge.direction]

  return {
    sourceHandle:
      override?.sourceHandle ??
      boardOverride?.sourceHandle ??
      edge.interactive.sourceHandle ??
      fallback.source,
    targetHandle:
      override?.targetHandle ??
      boardOverride?.targetHandle ??
      edge.interactive.targetHandle ??
      fallback.target,
  }
}
