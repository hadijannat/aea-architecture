import { graphManifest } from '@/graph/spec/manifest'
import type { EdgeSpec } from '@/graph/spec/schema'
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

export interface RoutedBoardEdge {
  path: string
  points: Point[]
  label: RoutedBoardLabel
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
    case 'F_R0_out':
    case 'F_G0_pol':
    case 'F_G0_out':
    case 'F3e':
    case 'F3f':
    case 'F_H1_revalidate':
    case 'F_T0_req':
    case 'F_T2':
    case 'F4':
      return segmentLabel(points, 0, 'top', 14)
    case 'F3c':
      return segmentLabel(points, 1, 'top', 14)
    case 'F3d':
      return segmentLabel(points, 1, 'top', 16)
    case 'F_G1A_pass':
      return segmentLabel(points, 1, 'right', 18)
    case 'F_G1A_reject':
      return segmentLabel(points, 1, 'bottom', 18)
    case 'F_T0_obs':
      return segmentLabel(points, 1, 'top', 56)
    case 'F_H1_pass':
      return segmentLabel(points, 0, 'right', 20)
    case 'F_M1_G0':
    case 'F_M1_R0':
    case 'F_M1_T0':
    case 'F_M1_G1A':
    case 'F_M1_H1':
    case 'F_M1_out':
      return segmentLabel(points, 0, 'top', 12)
    case 'F3b':
      return segmentLabel(points, 1, 'top', 18)
    case "F3b'":
      return segmentLabel(points, 0, 'top', 14)
    case 'F3i':
      return segmentLabel(points, 1, 'top', 16)
    case 'F3g':
      return segmentLabel(points, 1, 'top', 16)
    case 'F3h':
      return segmentLabel(points, 2, 'left', 18)
    case 'F3f_reject':
      return segmentLabel(points, 1, 'bottom', 18)
    case 'F_H1_reject':
      return segmentLabel(points, 1, 'bottom', 18)
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
  policyY: aea.y + 432,
  contextY: aea.y + 496,
  rejectionY: aea.y + 614,
  validationY: aea.y + 766,
  toolCrossY: aea.y + 256,
  toolEntryY: aea.y + 78,
  actTelemetryY: aea.y + 960,
  writeY: aea.y + 988,
  ackY: aea.y + 904,
  monitorSpineX: lanes.B.x + lanes.B.width - 68,
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
    case 'F_R0_out':
    case 'F_G0_pol':
    case 'F_G0_out':
    case 'F3e':
    case 'F3f':
    case 'F_H1_revalidate':
    case 'F_T2':
    case 'F4':
      points = source.y === target.y || source.x === target.x ? [source, target] : doglegX(source, target)
      break
    case "F3b'":
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
        point(source.x, channels.contextY - 76),
        point(target.x, channels.contextY - 76),
        target,
      ]
      break
    case 'F_G1A_pass':
      points = [
        source,
        point(source.x, channels.rejectionY + 34),
        point(target.x, channels.rejectionY + 34),
        target,
      ]
      break
    case 'F_G1A_reject':
      points = [
        source,
        point(source.x, channels.rejectionY),
        point(target.x, channels.rejectionY),
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
        point(source.x, channels.rejectionY - 14),
        point(target.x, channels.rejectionY - 14),
        target,
      ]
      break
    case 'F3g':
      points = [
        source,
        point(source.x, channels.validationY - 20),
        point(target.x, channels.validationY - 20),
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
    case 'F_M1_R0':
    case 'F_M1_T0':
    case 'F_M1_G1A':
    case 'F_M1_H1':
      points = doglegX(source, target, channels.monitorSpineX)
      break
    case 'F_M1_out':
      points = doglegY(source, target, source.y + 58)
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
    path: smoothOrthogonalPath(compactedPoints, 14),
    points: compactedPoints,
    label: buildLabel(edge, compactedPoints),
  }
}
