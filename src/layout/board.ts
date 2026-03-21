import type { EdgeSpec } from '@/graph/spec/schema'
import { parseHandleId, type HandleId } from '@/layout/ports'
import { compactOrthogonalPoints, smoothOrthogonalPath } from '@/layout/pathGeometry'

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

export interface RoutedBoardBridge {
  x: number
  y: number
  orientation: 'horizontal' | 'vertical'
}

export interface RoutedBoardEdge {
  path: string
  points: Point[]
  label: RoutedBoardLabel
  bridges?: RoutedBoardBridge[]
}

export interface BoardRouteHandles {
  sourceHandle: HandleId
  targetHandle: HandleId
}

export interface BoardRouteChannels {
  gatewayApproachX: number
  gatewayLabelX: number
  laneReturnX: number
  telemetryY: number
  policyY: number
  contextY: number
  rejectionY: number
  validationY: number
  toolCrossY: number
  toolEntryY: number
  actTelemetryY: number
  writeY: number
  ackY: number
  monitorSpineX: number
  laneCSpineX: number
  cpcSpineX: number
  decideCol01GapX: number
  decideCol12GapX: number
  decideCol23GapX: number
  decideAboveGridY: number
  decideRow12GapY: number
  decideBelowGridY: number
}

function point(x: number, y: number): Point {
  return { x, y }
}

function midpoint(start: Point, end: Point): Point {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  }
}

function doglegX(source: Point, target: Point, viaX = Math.round((source.x + target.x) / 2)) {
  return compactOrthogonalPoints([source, point(viaX, source.y), point(viaX, target.y), target])
}

function doglegY(source: Point, target: Point, viaY = Math.round((source.y + target.y) / 2)) {
  return compactOrthogonalPoints([source, point(source.x, viaY), point(target.x, viaY), target])
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

function anchoredLabel(x: number, y: number, side: RoutedLabelSide, offset: number): RoutedBoardLabel {
  return { x, y, side, offset }
}

function gatewayGutterLabel(points: Point[], channels: BoardRouteChannels): RoutedBoardLabel {
  const start = points[0] ?? point(0, 0)
  const end = points[points.length - 1] ?? start

  return anchoredLabel(channels.gatewayLabelX, midpoint(start, end).y, 'right', 0)
}

function findLongestSegmentIndex(points: Point[], axis: 'horizontal' | 'vertical'): number {
  let selectedIndex = 0
  let selectedLength = -1

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]
    const matchesAxis =
      axis === 'horizontal'
        ? start.y === end.y && start.x !== end.x
        : start.x === end.x && start.y !== end.y

    if (!matchesAxis) {
      continue
    }

    const length = Math.abs(start.x - end.x) + Math.abs(start.y - end.y)
    if (length > selectedLength) {
      selectedIndex = index
      selectedLength = length
    }
  }

  return selectedIndex
}

function routeStub(anchor: Point, handle: HandleId, distance = 12): Point {
  const parsed = parseHandleId(handle)
  if (!parsed) {
    return anchor
  }

  switch (parsed.side) {
    case 'left':
      return point(anchor.x - distance, anchor.y)
    case 'right':
      return point(anchor.x + distance, anchor.y)
    case 'top':
      return point(anchor.x, anchor.y - distance)
    case 'bottom':
      return point(anchor.x, anchor.y + distance)
  }
}

function corridorTrackOffset(priority = 0) {
  if (priority <= 0) {
    return 0
  }

  const magnitude = Math.ceil(priority / 2) * 22
  return priority % 2 === 1 ? -magnitude : magnitude
}

function corridorBranchDistance(offset: number) {
  return 30 + Math.round(Math.abs(offset) / 3)
}

function routeViaHorizontalCorridor(
  source: Point,
  target: Point,
  handles: BoardRouteHandles,
  corridorY: number,
  priority = 0,
) {
  const sourceStub = routeStub(source, handles.sourceHandle)
  const targetStub = routeStub(target, handles.targetHandle)
  const offset = corridorTrackOffset(priority)
  const branchY = corridorY + offset
  const direction = sourceStub.x <= targetStub.x ? 1 : -1
  const branchDistance = corridorBranchDistance(offset)
  const sourceJoinX = sourceStub.x + direction * branchDistance
  const targetJoinX = targetStub.x - direction * branchDistance

  return compactOrthogonalPoints([
    source,
    sourceStub,
    point(sourceStub.x, branchY),
    point(sourceJoinX, branchY),
    point(sourceJoinX, corridorY),
    point(targetJoinX, corridorY),
    point(targetJoinX, branchY),
    point(targetStub.x, branchY),
    targetStub,
    target,
  ])
}

function routeViaVerticalCorridor(
  source: Point,
  target: Point,
  handles: BoardRouteHandles,
  corridorX: number,
  priority = 0,
) {
  const sourceStub = routeStub(source, handles.sourceHandle)
  const targetStub = routeStub(target, handles.targetHandle)
  const offset = corridorTrackOffset(priority)
  const branchX = corridorX + offset
  const direction = sourceStub.y <= targetStub.y ? 1 : -1
  const branchDistance = corridorBranchDistance(offset)
  const sourceJoinY = sourceStub.y + direction * branchDistance
  const targetJoinY = targetStub.y - direction * branchDistance

  return compactOrthogonalPoints([
    source,
    sourceStub,
    point(branchX, sourceStub.y),
    point(branchX, sourceJoinY),
    point(corridorX, sourceJoinY),
    point(corridorX, targetJoinY),
    point(branchX, targetJoinY),
    point(branchX, targetStub.y),
    targetStub,
    target,
  ])
}

function buildRoutingLabel(edge: EdgeSpec, points: Point[], channels: BoardRouteChannels): RoutedBoardLabel {
  if (edge.routing?.labelPlacement === 'gutter') {
    return gatewayGutterLabel(points, channels)
  }

  if (edge.id === 'F_GW1') {
    return anchoredLabel(channels.gatewayApproachX - 6, points.at(-2)?.y ?? 0, 'top', 14)
  }

  const corridor = edge.routing?.corridor
  const axis = corridor === 'gateway' ? 'vertical' : 'horizontal'
  const segmentIndex = findLongestSegmentIndex(points, axis)

  switch (corridor) {
    case 'writeback':
      return segmentLabel(points, segmentIndex, 'bottom', 24)
    case 'ack':
      return segmentLabel(points, segmentIndex, 'top', 20)
    case 'gateway':
      return segmentLabel(points, segmentIndex, 'right', 16)
    case 'policy':
    case 'runtime':
    case 'validation':
    default:
      return segmentLabel(points, segmentIndex, 'top', 18)
  }
}

function buildCorridorPoints(
  edge: EdgeSpec,
  source: Point,
  target: Point,
  channels: BoardRouteChannels,
  handles: BoardRouteHandles,
): Point[] | null {
  if (!edge.routing) {
    return null
  }

  switch (edge.routing.corridor) {
    case 'gateway':
      if (edge.id === 'F_GW2' || edge.id === 'F_GW3') {
        return compactOrthogonalPoints([source, target])
      }
      return routeViaVerticalCorridor(source, target, handles, channels.gatewayApproachX, edge.routing.priority)
    case 'policy':
      return routeViaHorizontalCorridor(source, target, handles, channels.policyY, edge.routing.priority)
    case 'runtime':
      return routeViaHorizontalCorridor(source, target, handles, channels.contextY, edge.routing.priority)
    case 'validation':
      return routeViaHorizontalCorridor(
        source,
        target,
        handles,
        edge.source === 'DEC_G2' ? channels.validationY : channels.decideRow12GapY,
        edge.routing.priority,
      )
    case 'writeback':
      return routeViaHorizontalCorridor(source, target, handles, channels.writeY, edge.routing.priority)
    case 'ack':
      return routeViaHorizontalCorridor(source, target, handles, channels.ackY, edge.routing.priority)
    default:
      return null
  }
}

function buildLabel(
  edge: EdgeSpec,
  points: Point[],
  channels: BoardRouteChannels,
  handles?: BoardRouteHandles,
): RoutedBoardLabel {
  if (edge.routing && handles) {
    return buildRoutingLabel(edge, points, channels)
  }

  switch (edge.id) {
    case 'F_GW1':
      return anchoredLabel(channels.gatewayApproachX - 6, points.at(-2)?.y ?? 0, 'top', 14)
    case 'F_GW2':
    case 'F_GW3':
      return gatewayGutterLabel(points, channels)
    case 'F1':
      return segmentLabel(points, 2, 'top', 18)
    case 'F2':
      return segmentLabel(points, 0, 'top', 16)
    case 'F3a':
    case 'F3f':
    case 'F_T0_req':
      return segmentLabel(points, 0, 'top', 14)
    case 'F_T2':
      return segmentLabel(points, 1, 'top', 14)
    case 'F4':
      return segmentLabel(points, 2, 'bottom', 18)
    case 'F_H1_revalidate':
      return segmentLabel(points, 1, 'bottom', 18)
    case 'F_G0_out':
      return segmentLabel(points, 0, 'bottom', 18)
    case 'F_R0_out':
      return segmentLabel(points, 1, 'right', 16)
    case 'F_G0_pol':
      return segmentLabel(points, 0, 'bottom', 24)
    case 'F3e':
      return segmentLabel(points, 0, 'bottom', 18)
    case 'F3c':
      return segmentLabel(points, 1, 'top', 14)
    case 'F3d':
      return segmentLabel(points, 1, 'left', 14)
    case 'F_G1A_pass':
      return segmentLabel(points, 2, 'right', 22)
    case 'F_G1A_reject':
      return segmentLabel(points, 0, 'left', 20)
    case 'F_T0_obs':
      return segmentLabel(points, 1, 'top', 42)
    case 'F_H1_pass':
      return segmentLabel(points, 0, 'right', 20)
    case 'F_M1_G0':
      return segmentLabel(points, 1, 'bottom', 22)
    case 'F_M1_R0':
      return segmentLabel(points, 1, 'right', 18)
    case 'F_M1_T0':
      return segmentLabel(points, 2, 'top', 16)
    case 'F_M1_G1A':
      return segmentLabel(points, 2, 'bottom', 16)
    case 'F_M1_H1':
    case 'F_M1_out':
      return segmentLabel(points, 0, 'top', 16)
    case 'F3b':
      return segmentLabel(points, 1, 'top', 18)
    case "F3b'":
      return segmentLabel(points, 2, 'top', 18)
    case 'F3i':
      return segmentLabel(points, 1, 'bottom', 18)
    case 'F3g':
      return segmentLabel(points, 2, 'top', 18)
    case 'F3h':
      return segmentLabel(points, 2, 'left', 18)
    case 'F3f_reject':
      return segmentLabel(points, 1, 'bottom', 18)
    case 'F_H1_reject':
      return segmentLabel(points, 0, 'left', 22)
    case 'F_T1':
      return segmentLabel(points, 2, 'bottom', 18)
    case 'F_CPC_INT':
      return segmentLabel(points, 1, 'right', 16)
    case 'F_KPI':
      return segmentLabel(points, 2, 'bottom', 18)
    case 'F_AUDIT':
      return segmentLabel(points, 0, 'top', 16)
    case 'F5':
      return segmentLabel(points, 2, 'bottom', 24)
    case 'F6':
      return segmentLabel(points, 1, 'left', 28)
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

export function buildBoardEdgeRoute(
  edge: EdgeSpec,
  source: Point,
  target: Point,
  channels: BoardRouteChannels,
  handles?: BoardRouteHandles,
): RoutedBoardEdge {
  let points: Point[]

  if (edge.routing && handles) {
    const routedPoints = buildCorridorPoints(edge, source, target, channels, handles)
    if (routedPoints) {
      return {
        path: smoothOrthogonalPath(routedPoints, 22),
        points: routedPoints,
        label: buildLabel(edge, routedPoints, channels, handles),
        bridges: [],
      }
    }
  }

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
    case 'F_R0_out':
    case 'F_G0_pol':
    case 'F_G0_out':
    case 'F3e':
    case 'F3f':
      points = source.y === target.y || source.x === target.x ? [source, target] : doglegX(source, target)
      break
    case 'F_T2':
      points = [
        source,
        point(source.x, channels.decideAboveGridY),
        point(target.x, channels.decideAboveGridY),
        target,
      ]
      break
    case 'F4':
      points = [
        source,
        point(channels.decideCol23GapX, source.y),
        point(channels.decideCol23GapX, channels.decideRow12GapY),
        point(channels.decideCol01GapX, channels.decideRow12GapY),
        point(channels.decideCol01GapX, target.y),
        target,
      ]
      break
    case 'F_H1_revalidate':
      points = [
        source,
        point(source.x, channels.decideBelowGridY),
        point(target.x, channels.decideBelowGridY),
        target,
      ]
      break
    case "F3b'":
      points = [
        source,
        point(channels.decideCol01GapX, source.y),
        point(channels.decideCol01GapX, channels.decideRow12GapY),
        point(channels.decideCol12GapX, channels.decideRow12GapY),
        point(channels.decideCol12GapX, target.y),
        target,
      ]
      break
    case 'F_AUDIT':
      points = doglegX(source, target)
      break
    case 'F3c':
      points = [
        source,
        point(source.x, channels.policyY),
        point(target.x + 112, channels.policyY),
        point(target.x + 112, target.y),
        target,
      ]
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
        point(channels.decideCol01GapX, source.y),
        point(channels.decideCol01GapX, target.y),
        target,
      ]
      break
    case 'F_G1A_pass':
      points = [
        source,
        point(source.x, channels.rejectionY + 100),
        point(target.x, channels.rejectionY + 100),
        target,
      ]
      break
    case 'F_G1A_reject':
      points = [
        source,
        point(source.x, channels.rejectionY - 60),
        point(target.x, channels.rejectionY - 60),
        target,
      ]
      break
    case 'F3f_reject':
      points = [
        source,
        point(source.x, channels.rejectionY),
        point(target.x + 30, channels.rejectionY),
        point(target.x + 30, target.y),
        target,
      ]
      break
    case 'F_H1_reject':
      points = [
        source,
        point(source.x, channels.rejectionY + 60),
        point(target.x, channels.rejectionY + 60),
        target,
      ]
      break
    case 'F3g':
      points = [
        source,
        point(channels.decideCol01GapX, source.y),
        point(channels.decideCol01GapX, channels.decideRow12GapY),
        point(channels.decideCol23GapX, channels.decideRow12GapY),
        point(channels.decideCol23GapX, target.y),
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
        point(source.x, channels.decideBelowGridY),
        point(channels.decideCol23GapX, channels.decideBelowGridY),
        point(channels.decideCol23GapX, target.y),
        target,
      ]
      break
    case 'F_T0_req':
      points = doglegY(source, target)
      break
    case 'F_T1':
      points = [
        source,
        point(source.x, channels.toolCrossY),
        point(target.x - 118, channels.toolCrossY),
        point(target.x - 118, channels.toolEntryY),
        point(target.x, channels.toolEntryY),
        target,
      ]
      break
    case 'F_T0_obs':
      points = [
        source,
        point(source.x, channels.contextY),
        point(target.x, channels.contextY),
        target,
      ]
      break
    case 'F_H1_pass':
      points = doglegY(source, target, source.y + 42)
      break
    case 'F_M1_G0':
      points = doglegY(source, target)
      break
    case 'F_M1_R0':
      points = doglegX(source, target, channels.decideCol12GapX)
      break
    case 'F_M1_T0':
      points = [
        source,
        point(channels.monitorSpineX, source.y),
        point(channels.monitorSpineX, channels.decideRow12GapY),
        point(channels.decideCol01GapX, channels.decideRow12GapY),
        point(channels.decideCol01GapX, target.y),
        target,
      ]
      break
    case 'F_M1_G1A':
      points = [
        source,
        point(channels.monitorSpineX - 36, source.y),
        point(channels.monitorSpineX - 36, channels.decideRow12GapY + 30),
        point(channels.decideCol01GapX + 20, channels.decideRow12GapY + 30),
        point(channels.decideCol01GapX + 20, target.y),
        target,
      ]
      break
    case 'F_M1_H1':
      points = [source, target]
      break
    case 'F_M1_out':
      points = doglegY(source, target, source.y + 58)
      break
    case 'F_KPI':
      points = [
        source,
        point(channels.decideCol12GapX, source.y),
        point(channels.decideCol12GapX, channels.actTelemetryY),
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
    case 'F7b':
      points = doglegX(source, target, channels.laneCSpineX)
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

  const compactedPoints = compactOrthogonalPoints(points)
  return {
    path: smoothOrthogonalPath(compactedPoints, 22),
    points: compactedPoints,
    label: buildLabel(edge, compactedPoints, channels, handles),
    bridges: [],
  }
}

interface RoutedSegment {
  start: Point
  end: Point
  orientation: 'horizontal' | 'vertical'
}

function toSegments(points: Point[]): RoutedSegment[] {
  const segments: RoutedSegment[] = []

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]

    if (start.x === end.x && start.y !== end.y) {
      segments.push({ start, end, orientation: 'vertical' })
    } else if (start.y === end.y && start.x !== end.x) {
      segments.push({ start, end, orientation: 'horizontal' })
    }
  }

  return segments
}

function rangeContainsInterior(value: number, first: number, second: number, clearance = 10) {
  const min = Math.min(first, second) + clearance
  const max = Math.max(first, second) - clearance
  return value > min && value < max
}

function bridgePriority(edge: EdgeSpec) {
  if (edge.interactive.optional) {
    return 10
  }

  switch (edge.routing?.corridor) {
    case 'writeback':
      return 500
    case 'validation':
      return 420
    case 'policy':
      return 340
    case 'runtime':
      return 240
    case 'gateway':
      return 220
    case 'ack':
      return 120
    default:
      break
  }

  switch (edge.semantic) {
    case 'writeback':
      return 520
    case 'validation':
      return 430
    case 'policy-hard':
      return 360
    case 'policy-soft':
      return 320
    case 'status-ack':
      return 110
    case 'rejection':
      return 90
    case 'tool-call':
      return 80
    case 'kpi':
    case 'audit':
    case 'subscription':
      return 70
    default:
      return 200
  }
}

function chooseBridgeEdge(left: EdgeSpec, right: EdgeSpec) {
  const leftPriority = bridgePriority(left)
  const rightPriority = bridgePriority(right)

  if (leftPriority === rightPriority) {
    return left.id > right.id ? left : right
  }

  return leftPriority < rightPriority ? left : right
}

function segmentsCross(left: RoutedSegment, right: RoutedSegment) {
  const horizontal = left.orientation === 'horizontal' ? left : right.orientation === 'horizontal' ? right : null
  const vertical = left.orientation === 'vertical' ? left : right.orientation === 'vertical' ? right : null

  if (!horizontal || !vertical) {
    return null
  }

  const x = vertical.start.x
  const y = horizontal.start.y
  if (
    !rangeContainsInterior(x, horizontal.start.x, horizontal.end.x) ||
    !rangeContainsInterior(y, vertical.start.y, vertical.end.y)
  ) {
    return null
  }

  return {
    x,
    y,
    horizontal,
    vertical,
  }
}

function hasSharedEndpoint(left: EdgeSpec, right: EdgeSpec) {
  return (
    left.source === right.source ||
    left.source === right.target ||
    left.target === right.source ||
    left.target === right.target
  )
}

export function assignBoardRouteBridges(routes: Array<{ edge: EdgeSpec; route: RoutedBoardEdge }>) {
  const bridges = new Map<string, RoutedBoardBridge[]>()

  for (let index = 0; index < routes.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < routes.length; otherIndex += 1) {
      const left = routes[index]
      const right = routes[otherIndex]

      if (hasSharedEndpoint(left.edge, right.edge)) {
        continue
      }

      const leftSegments = toSegments(left.route.points)
      const rightSegments = toSegments(right.route.points)

      for (const leftSegment of leftSegments) {
        for (const rightSegment of rightSegments) {
          const crossing = segmentsCross(leftSegment, rightSegment)
          if (!crossing) {
            continue
          }

          const bridgeEdge = chooseBridgeEdge(left.edge, right.edge)
          const bridgeSegment = bridgeEdge.id === left.edge.id
            ? leftSegment
            : rightSegment
          const existing = bridges.get(bridgeEdge.id) ?? []
          if (existing.some((bridge) => bridge.orientation === bridgeSegment.orientation && Math.abs(bridge.x - crossing.x) < 16 && Math.abs(bridge.y - crossing.y) < 16)) {
            continue
          }

          existing.push({
            x: crossing.x,
            y: crossing.y,
            orientation: bridgeSegment.orientation,
          })
          bridges.set(bridgeEdge.id, existing)
        }
      }
    }
  }

  return bridges
}
