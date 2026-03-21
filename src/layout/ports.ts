import { Position } from '@xyflow/react'

import type { CorridorId, EdgeSpec, ProjectionOverrides } from '@/graph/spec/schema'

export type HandleSide = 'left' | 'right' | 'top' | 'bottom'
export type HandleFamily = 'default' | CorridorId
export type HandleId = `${HandleSide}:${HandleFamily}:${number}`

export interface ParsedHandleId {
  raw: HandleId
  side: HandleSide
  family: HandleFamily
  index: number
  legacy: boolean
}

const handleSides: readonly HandleSide[] = ['left', 'right', 'top', 'bottom']
const handleFamilies: readonly HandleFamily[] = [
  'default',
  'gateway',
  'telemetry',
  'policy',
  'runtime',
  'ceiling',
  'validation',
  'monitor',
  'writeback',
  'feedback',
  'ack',
]

const handleSideSet = new Set<HandleSide>(handleSides)
const handleFamilySet = new Set<HandleFamily>(handleFamilies)

const handlePositionMap: Record<HandleSide, Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
}

const sideOrder: Record<HandleSide, number> = {
  left: 0,
  right: 1,
  top: 2,
  bottom: 3,
}

const fallbackByDirection: Record<EdgeSpec['direction'], { source: HandleId; target: HandleId }> = {
  ltr: { source: 'right:default:0', target: 'left:default:0' },
  rtl: { source: 'left:default:0', target: 'right:default:0' },
  ttb: { source: 'bottom:default:0', target: 'top:default:0' },
  btt: { source: 'top:default:0', target: 'bottom:default:0' },
}

function normalizeBareSide(value: string): HandleId | null {
  return handleSideSet.has(value as HandleSide) ? (`${value}:default:0` as HandleId) : null
}

export function parseHandleId(value?: string | null): ParsedHandleId | null {
  if (!value) {
    return null
  }

  const normalizedBare = normalizeBareSide(value)
  if (normalizedBare) {
    return {
      raw: normalizedBare,
      side: value as HandleSide,
      family: 'default',
      index: 0,
      legacy: true,
    }
  }

  const [side, family, index] = value.split(':')
  if (!handleSideSet.has(side as HandleSide) || !handleFamilySet.has(family as HandleFamily)) {
    return null
  }

  const parsedIndex = Number.parseInt(index ?? '', 10)
  if (!Number.isInteger(parsedIndex) || parsedIndex < 0) {
    return null
  }

  return {
    raw: `${side}:${family}:${parsedIndex}` as HandleId,
    side: side as HandleSide,
    family: family as HandleFamily,
    index: parsedIndex,
    legacy: false,
  }
}

export function normalizeHandleId(value?: string | null): HandleId | null {
  return parseHandleId(value)?.raw ?? null
}

export function getHandlePosition(handle: HandleId | string): Position {
  const parsed = parseHandleId(handle)
  return handlePositionMap[parsed?.side ?? 'right']
}

export function getHandleOffset(handle: HandleId | string, slotSpacing = 16): number {
  const parsed = parseHandleId(handle)
  if (!parsed || parsed.index === 0) {
    return 0
  }

  const magnitude = Math.ceil(parsed.index / 2) * slotSpacing
  return parsed.index % 2 === 1 ? -magnitude : magnitude
}

export function compareHandleIds(first: HandleId | string, second: HandleId | string): number {
  const parsedFirst = parseHandleId(first)
  const parsedSecond = parseHandleId(second)

  if (!parsedFirst || !parsedSecond) {
    return `${first}`.localeCompare(`${second}`)
  }

  if (parsedFirst.side !== parsedSecond.side) {
    return sideOrder[parsedFirst.side] - sideOrder[parsedSecond.side]
  }

  const offsetDelta = getHandleOffset(parsedFirst.raw) - getHandleOffset(parsedSecond.raw)
  if (offsetDelta !== 0) {
    return offsetDelta
  }

  if (parsedFirst.family !== parsedSecond.family) {
    return parsedFirst.family.localeCompare(parsedSecond.family)
  }

  return parsedFirst.raw.localeCompare(parsedSecond.raw)
}

function resolveProjectedHandle(
  overrideHandle: string | undefined,
  routedHandle: string | undefined,
  interactiveHandle: string | undefined,
  fallbackHandle: HandleId,
): HandleId {
  const parsedOverride = parseHandleId(overrideHandle)
  const parsedRouted = parseHandleId(routedHandle)

  if (
    parsedOverride?.legacy &&
    parsedRouted &&
    parsedRouted.family !== 'default' &&
    parsedOverride.side === parsedRouted.side
  ) {
    return parsedRouted.raw
  }

  return normalizeHandleId(overrideHandle ?? routedHandle ?? interactiveHandle ?? fallbackHandle) ?? fallbackHandle
}

export function resolveEdgeHandles(
  edge: EdgeSpec,
  overrides: ProjectionOverrides['edgeHandles'],
): { sourceHandle: HandleId; targetHandle: HandleId } {
  const override = overrides[edge.id]
  const fallback = fallbackByDirection[edge.direction]

  return {
    sourceHandle: resolveProjectedHandle(
      override?.sourceHandle,
      edge.routing?.sourceHandle,
      edge.interactive.sourceHandle,
      fallback.source,
    ),
    targetHandle: resolveProjectedHandle(
      override?.targetHandle,
      edge.routing?.targetHandle,
      edge.interactive.targetHandle,
      fallback.target,
    ),
  }
}
