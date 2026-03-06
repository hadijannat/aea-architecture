import { graphManifest } from '@/graph/spec/manifest'
import type { EdgeSpec } from '@/graph/spec/schema'

interface Point {
  x: number
  y: number
}

export interface RoutedBoardEdge {
  path: string
  labelX: number
  labelY: number
}

function point(x: number, y: number): Point {
  return { x, y }
}

function polyline(points: Point[]): string {
  return points.map((entry, index) => `${index === 0 ? 'M' : 'L'} ${entry.x} ${entry.y}`).join(' ')
}

function labelPoint(points: Point[]): Point {
  let longestDistance = -1
  let longestMidpoint = points[0] ?? { x: 0, y: 0 }

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const distance = Math.abs(current.x - next.x) + Math.abs(current.y - next.y)
    if (distance > longestDistance) {
      longestDistance = distance
      longestMidpoint = {
        x: (current.x + next.x) / 2,
        y: (current.y + next.y) / 2,
      }
    }
  }

  return longestMidpoint
}

const { lanes, gateway, aea } = graphManifest.layoutDefaults
const channels = {
  gatewayApproachX: gateway.x - 28,
  laneReturnX: gateway.x - 44,
  telemetryY: aea.y + 160,
  policyY: aea.y + 446,
  validationY: aea.y + 598,
  rejectionY: aea.y + 692,
  toolY: aea.y + 760,
  actTelemetryY: aea.y + 756,
  writeY: aea.y + 846,
  ackY: aea.y + 786,
  laneCSpineX: lanes.C.x + lanes.C.width - 28,
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
    case 'F3a':
    case 'F3b\'':
    case 'F3c':
    case 'F3f':
    case 'F4':
    case 'F_AUDIT':
    case 'F7b':
      points = [source, target]
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
        point(target.x, channels.rejectionY),
        target,
      ]
      break
    case 'F3g':
    case 'F3h':
    case 'F3i':
      points = [
        source,
        point(source.x, channels.validationY),
        point(target.x, channels.validationY),
        target,
      ]
      break
    case 'F_T1':
    case 'F_T2':
      points = [
        source,
        point(source.x, channels.toolY),
        point(target.x, channels.toolY),
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
    default:
      points = [
        source,
        point((source.x + target.x) / 2, source.y),
        point((source.x + target.x) / 2, target.y),
        target,
      ]
  }

  const label = labelPoint(points)
  return {
    path: polyline(points),
    labelX: label.x,
    labelY: label.y,
  }
}
