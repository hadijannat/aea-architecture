import { graphManifest } from '@/graph/spec/manifest'
import type { EdgeSpec } from '@/graph/spec/schema'

export interface Point {
  x: number
  y: number
}

export type RoutedLabelSide = 'top' | 'right' | 'bottom' | 'left'

export interface RoutedBoardLabel {
  x: number
  y: number
  side: RoutedLabelSide
  offset: number
}

export interface RoutedBoardEdge {
  path: string
  points: Point[]
  label: RoutedBoardLabel
}

function point(x: number, y: number): Point {
  return { x, y }
}

function formatCoordinate(value: number) {
  return Number.isInteger(value) ? `${value}` : `${Number(value.toFixed(2))}`
}

function formatPoint(entry: Point) {
  return `${formatCoordinate(entry.x)} ${formatCoordinate(entry.y)}`
}

function segmentLength(start: Point, end: Point) {
  return Math.abs(start.x - end.x) + Math.abs(start.y - end.y)
}

function isColinear(start: Point, middle: Point, end: Point) {
  return (start.x === middle.x && middle.x === end.x) || (start.y === middle.y && middle.y === end.y)
}

function moveToward(start: Point, target: Point, distance: number): Point {
  if (start.x === target.x) {
    return {
      x: start.x,
      y: start.y + Math.sign(target.y - start.y) * distance,
    }
  }

  return {
    x: start.x + Math.sign(target.x - start.x) * distance,
    y: start.y,
  }
}

function smoothPolyline(points: Point[], radius = 14): string {
  if (points.length === 0) {
    return ''
  }

  if (points.length === 1) {
    return `M ${formatPoint(points[0])}`
  }

  const commands = [`M ${formatPoint(points[0])}`]

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    const next = points[index + 1]

    const incomingLength = segmentLength(previous, current)
    const outgoingLength = segmentLength(current, next)
    const cornerRadius = Math.min(radius, incomingLength / 2, outgoingLength / 2)

    if (
      incomingLength === 0 ||
      outgoingLength === 0 ||
      cornerRadius < 0.5 ||
      isColinear(previous, current, next)
    ) {
      commands.push(`L ${formatPoint(current)}`)
      continue
    }

    const entry = moveToward(current, previous, cornerRadius)
    const exit = moveToward(current, next, cornerRadius)

    commands.push(`L ${formatPoint(entry)}`)
    commands.push(`Q ${formatPoint(current)} ${formatPoint(exit)}`)
  }

  commands.push(`L ${formatPoint(points[points.length - 1])}`)
  return commands.join(' ')
}

function compactPoints(points: Point[]): Point[] {
  return points.filter((entry, index) => {
    if (index === 0) {
      return true
    }

    const previous = points[index - 1]
    return previous.x !== entry.x || previous.y !== entry.y
  })
}

function midpoint(start: Point, end: Point): Point {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  }
}

function doglegX(source: Point, target: Point, viaX = Math.round((source.x + target.x) / 2)) {
  return compactPoints([source, point(viaX, source.y), point(viaX, target.y), target])
}

function doglegY(source: Point, target: Point, viaY = Math.round((source.y + target.y) / 2)) {
  return compactPoints([source, point(source.x, viaY), point(target.x, viaY), target])
}

function segmentLabel(points: Point[], segmentIndex: number, side: RoutedLabelSide, offset: number): RoutedBoardLabel {
  const start = points[Math.max(0, Math.min(segmentIndex, points.length - 2))] ?? point(0, 0)
  const end = points[Math.max(1, Math.min(segmentIndex + 1, points.length - 1))] ?? point(0, 0)
  const mid = midpoint(start, end)

  return {
    x: mid.x,
    y: mid.y,
    side,
    offset,
  }
}

export function resolveBoardLabelPosition(label: RoutedBoardLabel): Point {
  switch (label.side) {
    case 'top':
      return { x: label.x, y: label.y - label.offset }
    case 'right':
      return { x: label.x + label.offset, y: label.y }
    case 'bottom':
      return { x: label.x, y: label.y + label.offset }
    case 'left':
      return { x: label.x - label.offset, y: label.y }
  }
}

function buildLabel(edge: EdgeSpec, points: Point[]): RoutedBoardLabel {
  switch (edge.id) {
    case 'F_GW1':
      return segmentLabel(points, 1, 'left', 20)
    case 'F_GW2':
    case 'F_GW3':
      return segmentLabel(points, 0, 'right', 18)
    case 'F1':
      return segmentLabel(points, 3, 'top', 18)
    case 'F2':
      return segmentLabel(points, 0, 'top', 16)
    case 'F3a':
      return segmentLabel(points, 0, 'top', 14)
    case 'F3b':
      return segmentLabel(points, 2, 'top', 18)
    case "F3b'":
    case 'F3c':
    case 'F3f':
      return segmentLabel(points, 0, 'top', 14)
    case 'F3d':
    case 'F3e':
    case 'F3i':
      return segmentLabel(points, 1, 'top', 16)
    case 'F3g':
      return segmentLabel(points, 1, 'bottom', 18)
    case 'F3h':
      return segmentLabel(points, 2, 'left', 18)
    case 'F3f_reject':
      return segmentLabel(points, 1, 'bottom', 18)
    case 'F_T1':
      return segmentLabel(points, 2, 'bottom', 18)
    case 'F_T2':
      return segmentLabel(points, 2, 'left', 18)
    case 'F_CPC_INT':
      return segmentLabel(points, 1, 'right', 16)
    case 'F4':
      return segmentLabel(points, 1, 'top', 18)
    case 'F_KPI':
      return segmentLabel(points, 2, 'bottom', 18)
    case 'F_AUDIT':
      return segmentLabel(points, 0, 'top', 16)
    case 'F5':
      return segmentLabel(points, 2, 'bottom', 24)
    case 'F6':
      return segmentLabel(points, 1, 'right', 20)
    case 'F_VoR_ACK':
      return segmentLabel(points, 1, 'right', 28)
    case 'F7a':
      return segmentLabel(points, 2, 'bottom', 20)
    case 'F7b':
      return segmentLabel(points, 1, 'left', 24)
    case 'F7_sub':
      return segmentLabel(points, 0, 'top', 18)
    default:
      return segmentLabel(points, 0, 'top', 16)
  }
}

const { lanes, gateway, aea } = graphManifest.layoutDefaults
const channels = {
  gatewayApproachX: gateway.x - 28,
  laneReturnX: gateway.x - 44,
  telemetryY: aea.y + 160,
  policyY: aea.y + 446,
  validationY: aea.y + 598,
  rejectionY: aea.y + 642,
  toolCrossY: aea.y + 242,
  toolEntryY: aea.y + 78,
  actTelemetryY: aea.y + 756,
  writeY: aea.y + 846,
  ackY: aea.y + 786,
  laneCSpineX: lanes.C.x + lanes.C.width - 28,
  cpcSpineX: lanes.A.x + 24,
}

export function buildBoardEdgeRoute(
  edge: EdgeSpec,
  source: Point,
  target: Point,
): RoutedBoardEdge {
  let points: Point[]

  switch (edge.id) {
    case 'F_GW1':
      points = [
        source,
        point(channels.gatewayApproachX, source.y),
        point(channels.gatewayApproachX, target.y),
        target,
      ]
      break
    case 'F_GW2':
    case 'F_GW3':
      points = [source, target]
      break
    case 'F1':
      points = [
        source,
        point(source.x + 34, source.y),
        point(source.x + 34, channels.telemetryY),
        point(target.x - 30, channels.telemetryY),
        point(target.x - 30, target.y),
        target,
      ]
      break
    case 'F2':
      points = doglegX(source, target)
      break
    case 'F3a':
      points = source.y === target.y || source.x === target.x ? [source, target] : doglegX(source, target)
      break
    case "F3b'":
    case 'F3c':
    case 'F3f':
    case 'F_AUDIT':
      points = doglegX(source, target)
      break
    case 'F4':
      points = doglegY(source, target, target.y - 28)
      break
    case 'F7b':
      points = doglegX(source, target, channels.laneCSpineX)
      break
    case 'F3b':
      points = [
        source,
        point(source.x + 34, source.y),
        point(source.x + 34, channels.policyY),
        point(target.x - 32, channels.policyY),
        point(target.x - 32, target.y),
        target,
      ]
      break
    case 'F3d':
      points = [
        source,
        point(source.x, channels.policyY - 34),
        point(target.x, channels.policyY - 34),
        target,
      ]
      break
    case 'F3e':
      points = [
        source,
        point(source.x, channels.validationY - 28),
        point(target.x, channels.validationY - 28),
        target,
      ]
      break
    case 'F3f_reject':
      points = [
        source,
        point(source.x, channels.rejectionY),
        point(target.x - 30, channels.rejectionY),
        point(target.x - 30, target.y),
        target,
      ]
      break
    case 'F3g':
      points = [
        source,
        point(source.x, channels.validationY - 8),
        point(target.x, channels.validationY - 8),
        target,
      ]
      break
    case 'F3h':
      points = [
        source,
        point(source.x, target.y - 12),
        point(target.x - 36, target.y - 12),
        point(target.x - 36, target.y),
        target,
      ]
      break
    case 'F3i':
      points = [
        source,
        point(source.x, channels.validationY),
        point(target.x, channels.validationY),
        target,
      ]
      break
    case 'F_T1':
      points = [
        source,
        point(source.x - 20, source.y),
        point(source.x - 20, channels.toolCrossY),
        point(target.x - 118, channels.toolCrossY),
        point(target.x - 118, channels.toolEntryY),
        point(target.x, channels.toolEntryY),
        target,
      ]
      break
    case 'F_T2':
      points = [
        source,
        point(source.x, target.y + 74),
        point(target.x + 16, target.y + 74),
        point(target.x + 16, target.y),
        target,
      ]
      break
    case 'F_KPI':
      points = [
        source,
        point(source.x + 36, source.y),
        point(source.x + 36, channels.actTelemetryY),
        point(target.x - 32, channels.actTelemetryY),
        point(target.x - 32, target.y),
        target,
      ]
      break
    case 'F5':
      points = [
        source,
        point(source.x - 36, source.y),
        point(source.x - 36, channels.writeY),
        point(target.x + 28, channels.writeY),
        point(target.x + 28, target.y),
        target,
      ]
      break
    case 'F6':
      points = [
        source,
        point(channels.laneReturnX, source.y),
        point(channels.laneReturnX, channels.writeY),
        point(target.x + 28, channels.writeY),
        point(target.x + 28, target.y),
        target,
      ]
      break
    case 'F_VoR_ACK':
      points = [
        source,
        point(source.x + 28, source.y),
        point(source.x + 28, channels.ackY),
        point(target.x - 30, channels.ackY),
        point(target.x - 30, target.y),
        target,
      ]
      break
    case 'F7a':
      points = [
        source,
        point(source.x + 34, source.y),
        point(source.x + 34, channels.actTelemetryY + 8),
        point(target.x - 26, channels.actTelemetryY + 8),
        point(target.x - 26, target.y),
        target,
      ]
      break
    case 'F7_sub':
      points = [
        source,
        point(channels.laneCSpineX, source.y),
        point(channels.laneCSpineX, target.y),
        target,
      ]
      break
    case 'F_CPC_INT':
      points = [
        source,
        point(channels.cpcSpineX, source.y),
        point(channels.cpcSpineX, target.y),
        target,
      ]
      break
    default:
      points =
        source.x === target.x || source.y === target.y
          ? [source, target]
          : doglegX(source, target)
  }

  const compactedPoints = compactPoints(points)
  return {
    path: smoothPolyline(compactedPoints),
    points: compactedPoints,
    label: buildLabel(edge, compactedPoints),
  }
}
