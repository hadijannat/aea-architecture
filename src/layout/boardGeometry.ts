import { graphManifest, resolveGraphNode } from '@/graph/spec/manifest'
import type { EdgeSpec, GraphManifest } from '@/graph/spec/schema'
import { BAND_INSET_X, BAND_INSET_Y, BAND_SPACING } from '@/layout/boardLayout'
import type { NodePositionMap } from '@/layout/boardLayout'
import { buildBoardEdgeRoute, type BoardRouteChannels, type Point, type RoutedBoardEdge } from '@/layout/board'
import type { HandleId } from '@/layout/ports'

export interface BoardRect {
  x: number
  y: number
  width: number
  height: number
}

export interface BoardRouteLike {
  id: string
  path: string
  points: Point[]
}

export interface BoardGeometry {
  canvas: BoardRect
  lanes: Record<'A' | 'B' | 'C', BoardRect>
  gateway: BoardRect
  aea: BoardRect
  bands: Record<'Sense' | 'Decide' | 'Act', BoardRect>
  routeChannels: BoardRouteChannels
  horizontalDividers: number[]
  routeGuideYs: number[]
  verticalGuideXs: number[]
  writeCorridorBounds?: BoardRect
  writeRoutes?: BoardRouteLike[]
}

interface NodeLike {
  id: string
  position: { x: number; y: number }
  width?: number
  height?: number
  hidden?: boolean
  data?: {
    spec?: {
      width: number
      height: number
    }
  }
}

interface EdgeLike {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  hidden?: boolean
  data?: {
    spec?: EdgeSpec
  }
}

const writeCorridorEdgeIds = new Set(['F5', 'F6', 'F_VoR_ACK'])
const routeGuideOffsets = {
  gatewayApproach: 38,
  gatewayLabel: 38,
  laneReturn: 58,
  toolEntry: 16,
  toolCross: 50,
  actTelemetry: 7,
  write: 34,
  ack: 20,
  divider: 18,
  monitorSpine: 90,
  laneCSpine: 38,
  cpcSpine: 34,
} as const

const decideRowIds = {
  one: ['DEC_K1', 'DEC_R0', 'DEC_R1', 'DEC_T0'] as const,
  two: ['DEC_K2', 'DEC_G0', 'DEC_R2', 'DEC_G1A'] as const,
  three: ['DEC_H1', 'DEC_M1', 'DEC_G1', 'DEC_G2'] as const,
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function centerY(rect: BoardRect) {
  return rect.y + rect.height / 2
}

function bottom(rect: BoardRect) {
  return rect.y + rect.height
}

function fallbackRectMap(manifest: GraphManifest): Record<string, BoardRect> {
  const { layoutDefaults } = manifest

  return {
    LANE_A: { ...layoutDefaults.lanes.A },
    LANE_B: { ...layoutDefaults.lanes.B },
    LANE_C: { ...layoutDefaults.lanes.C },
    GW: { ...layoutDefaults.gateway },
    AEA: { ...layoutDefaults.aea },
    BAND_SENSE: {
      x: layoutDefaults.aea.x + BAND_INSET_X,
      y: layoutDefaults.aea.y + BAND_INSET_Y,
      width: layoutDefaults.aea.width - BAND_INSET_X * 2,
      height: layoutDefaults.aea.bandHeights.Sense,
    },
    BAND_DECIDE: {
      x: layoutDefaults.aea.x + BAND_INSET_X,
      y: layoutDefaults.aea.y + BAND_INSET_Y + layoutDefaults.aea.bandHeights.Sense + BAND_SPACING,
      width: layoutDefaults.aea.width - BAND_INSET_X * 2,
      height: layoutDefaults.aea.bandHeights.Decide,
    },
    BAND_ACT: {
      x: layoutDefaults.aea.x + BAND_INSET_X,
      y:
        layoutDefaults.aea.y +
        BAND_INSET_Y +
        layoutDefaults.aea.bandHeights.Sense +
        BAND_SPACING +
        layoutDefaults.aea.bandHeights.Decide +
        BAND_SPACING,
      width: layoutDefaults.aea.width - BAND_INSET_X * 2,
      height: layoutDefaults.aea.bandHeights.Act,
    },
  }
}

function rectForNode(node?: NodeLike, manifest: GraphManifest = graphManifest): BoardRect | undefined {
  if (!node) {
    return undefined
  }

  const fallbackSpec = resolveGraphNode(node.id) ?? manifest.nodes.find((candidate) => candidate.id === node.id)
  const width = node.width ?? node.data?.spec?.width ?? fallbackSpec?.width
  const height = node.height ?? node.data?.spec?.height ?? fallbackSpec?.height

  if (typeof width !== 'number' || typeof height !== 'number') {
    return undefined
  }

  return {
    x: node.position.x,
    y: node.position.y,
    width,
    height,
  }
}

function unionRects(rects: Array<BoardRect | undefined>) {
  const visibleRects = rects.filter((rect): rect is BoardRect => Boolean(rect))
  if (visibleRects.length === 0) {
    return undefined
  }

  const left = Math.min(...visibleRects.map((rect) => rect.x))
  const top = Math.min(...visibleRects.map((rect) => rect.y))
  const right = Math.max(...visibleRects.map((rect) => rect.x + rect.width))
  const bottomEdge = Math.max(...visibleRects.map((rect) => rect.y + rect.height))

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottomEdge - top,
  }
}

function boundsFromPoints(points: Point[]) {
  if (points.length === 0) {
    return undefined
  }

  const left = Math.min(...points.map((point) => point.x))
  const top = Math.min(...points.map((point) => point.y))
  const right = Math.max(...points.map((point) => point.x))
  const bottomEdge = Math.max(...points.map((point) => point.y))

  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottomEdge - top),
  }
}

function isHandleId(value?: string | null): value is HandleId {
  return value === 'left' || value === 'right' || value === 'top' || value === 'bottom'
}

export function buildBoardRectMapFromNodes(
  nodes: NodeLike[],
  manifest: GraphManifest = graphManifest,
) {
  return nodes
    .filter((node) => !node.hidden)
    .reduce<Record<string, BoardRect>>((accumulator, node) => {
      const rect = rectForNode(node, manifest)
      if (rect) {
        accumulator[node.id] = rect
      }
      return accumulator
    }, {})
}

export function buildBoardRectMapFromPositions(
  positions: NodePositionMap,
  manifest: GraphManifest = graphManifest,
) {
  return manifest.nodes
    .filter((node) => node.panel.includes('architecture'))
    .reduce<Record<string, BoardRect>>((accumulator, node) => {
      const position = positions[node.id]
      if (!position) {
        return accumulator
      }

      accumulator[node.id] = {
        x: position.x,
        y: position.y,
        width: node.width,
        height: node.height,
      }
      return accumulator
    }, {})
}

export function anchorPointForRect(rect: BoardRect, handleId: HandleId): Point {
  switch (handleId) {
    case 'left':
      return { x: rect.x, y: rect.y + rect.height / 2 }
    case 'right':
      return { x: rect.x + rect.width, y: rect.y + rect.height / 2 }
    case 'top':
      return { x: rect.x + rect.width / 2, y: rect.y }
    case 'bottom':
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height }
  }
}

export function buildBoardRouteChannels(
  rectMap: Record<string, BoardRect>,
  manifest: GraphManifest = graphManifest,
): BoardRouteChannels {
  const fallbackRects = fallbackRectMap(manifest)
  const laneA = rectMap.LANE_A ?? fallbackRects.LANE_A
  const laneB = rectMap.LANE_B ?? fallbackRects.LANE_B
  const laneC = rectMap.LANE_C ?? fallbackRects.LANE_C
  const gateway = rectMap.GW ?? fallbackRects.GW
  const bandSense = rectMap.BAND_SENSE ?? fallbackRects.BAND_SENSE
  const bandAct = rectMap.BAND_ACT ?? fallbackRects.BAND_ACT

  const s1 = rectMap.S1
  const validator = rectMap.DEC_G2
  const rowOne = unionRects(decideRowIds.one.map((id) => rectMap[id]))
  const rowTwo = unionRects(decideRowIds.two.map((id) => rectMap[id]))
  const rowThree = unionRects(decideRowIds.three.map((id) => rectMap[id]))
  const bandDecide = rectMap.BAND_DECIDE ?? fallbackRects.BAND_DECIDE

  const telemetryY = Math.round(s1 ? centerY(s1) : bandSense.y + bandSense.height / 2)
  const policyY = rowOne && rowTwo
    ? Math.round(bottom(rowOne) + Math.max(18, (rowTwo.y - bottom(rowOne)) * 0.35))
    : Math.round(bandSense.y + bandSense.height + 215)
  const contextY = policyY + 56
  const rejectionY = rowTwo ? Math.round(bottom(rowTwo) + 28) : Math.round(policyY + 200)
  const validationY = validator
    ? Math.round(validator.y + validator.height - 30)
    : Math.round(bandAct.y - 184)

  const col0Right = rectMap.DEC_K1 ? rectMap.DEC_K1.x + rectMap.DEC_K1.width : bandDecide.x + 262
  const col1Left = rectMap.DEC_R0?.x ?? bandDecide.x + 362
  const col1Right = rectMap.DEC_R0 ? rectMap.DEC_R0.x + rectMap.DEC_R0.width : bandDecide.x + 592
  const col2Left = rectMap.DEC_R1?.x ?? bandDecide.x + 692
  const col2Right = rectMap.DEC_R1 ? rectMap.DEC_R1.x + rectMap.DEC_R1.width : bandDecide.x + 922
  const col3Left = rectMap.DEC_T0?.x ?? bandDecide.x + 1022

  const decideCol01GapX = Math.round((col0Right + col1Left) / 2)
  const decideCol12GapX = Math.round((col1Right + col2Left) / 2)
  const decideCol23GapX = Math.round((col2Right + col3Left) / 2)

  const decideAboveGridY = rowOne ? Math.round(rowOne.y - 20) : Math.round(bandDecide.y + 26)
  const decideRow12GapY = rowTwo && rowThree
    ? Math.round((bottom(rowTwo) + rowThree.y) / 2)
    : Math.round(bandAct.y - 380)
  const decideBelowGridY = rowThree
    ? Math.round(bottom(rowThree) + 26)
    : Math.round(bandAct.y - 130)

  return {
    gatewayApproachX: Math.round(gateway.x - routeGuideOffsets.gatewayApproach),
    gatewayLabelX: Math.round(gateway.x + gateway.width + routeGuideOffsets.gatewayLabel),
    laneReturnX: Math.round(gateway.x - routeGuideOffsets.laneReturn),
    telemetryY,
    policyY,
    contextY,
    rejectionY,
    validationY,
    toolCrossY: Math.round(bottom(bandSense) + routeGuideOffsets.toolCross),
    toolEntryY: Math.round(bandSense.y + routeGuideOffsets.toolEntry),
    actTelemetryY: Math.round(bandAct.y + routeGuideOffsets.actTelemetry),
    writeY: Math.round(bandAct.y + routeGuideOffsets.write),
    ackY: Math.round(bandAct.y - routeGuideOffsets.ack),
    monitorSpineX: Math.round(laneB.x + laneB.width - routeGuideOffsets.monitorSpine),
    laneCSpineX: Math.round(laneC.x + laneC.width - routeGuideOffsets.laneCSpine),
    cpcSpineX: Math.round(laneA.x + routeGuideOffsets.cpcSpine),
    decideCol01GapX,
    decideCol12GapX,
    decideCol23GapX,
    decideAboveGridY,
    decideRow12GapY,
    decideBelowGridY,
  }
}

function buildFlowRoute(
  edge: EdgeLike,
  nodesById: Map<string, NodeLike>,
  channels: BoardRouteChannels,
) {
  if (edge.hidden || !edge.data?.spec || !isHandleId(edge.sourceHandle) || !isHandleId(edge.targetHandle)) {
    return undefined
  }

  const sourceNode = nodesById.get(edge.source)
  const targetNode = nodesById.get(edge.target)
  const sourceRect = rectForNode(sourceNode)
  const targetRect = rectForNode(targetNode)

  if (!sourceRect || !targetRect) {
    return undefined
  }

  return buildBoardEdgeRoute(
    edge.data.spec,
    anchorPointForRect(sourceRect, edge.sourceHandle),
    anchorPointForRect(targetRect, edge.targetHandle),
    channels,
  )
}

export function buildWriteCorridorRoutes(
  nodes: NodeLike[],
  edges: EdgeLike[],
  channels: BoardRouteChannels,
) {
  const nodesById = new Map(nodes.filter((node) => !node.hidden).map((node) => [node.id, node]))

  return edges
    .filter((edge) => writeCorridorEdgeIds.has(edge.id))
    .map((edge) => {
      const route = buildFlowRoute(edge, nodesById, channels)
      if (!route) {
        return undefined
      }

      return {
        id: edge.id,
        path: route.path,
        points: route.points,
      } satisfies BoardRouteLike
    })
    .filter((route): route is BoardRouteLike => Boolean(route))
}

export function buildBoardGeometry(
  rectMap: Record<string, BoardRect>,
  options?: {
    writeRoutes?: BoardRouteLike[]
    manifest?: GraphManifest
  },
): BoardGeometry {
  const manifest = options?.manifest ?? graphManifest
  const fallbackRects = fallbackRectMap(manifest)
  const lanes = {
    A: rectMap.LANE_A ?? fallbackRects.LANE_A,
    B: rectMap.LANE_B ?? fallbackRects.LANE_B,
    C: rectMap.LANE_C ?? fallbackRects.LANE_C,
  }
  const gateway = rectMap.GW ?? fallbackRects.GW
  const aea = rectMap.AEA ?? fallbackRects.AEA
  const bands = {
    Sense: rectMap.BAND_SENSE ?? fallbackRects.BAND_SENSE,
    Decide: rectMap.BAND_DECIDE ?? fallbackRects.BAND_DECIDE,
    Act: rectMap.BAND_ACT ?? fallbackRects.BAND_ACT,
  }
  const routeChannels = buildBoardRouteChannels(rectMap, manifest)
  const corridorFromRoutes = boundsFromPoints(options?.writeRoutes?.flatMap((route) => route.points) ?? [])
  const corridorFallback = unionRects([
    rectMap.ACT1,
    rectMap.VOI,
    rectMap.A3,
  ])

  return {
    canvas: {
      x: 0,
      y: 0,
      width: manifest.layoutDefaults.canvas.width,
      height: manifest.layoutDefaults.canvas.height,
    },
    lanes,
    gateway,
    aea,
    bands,
    routeChannels,
    horizontalDividers: [
      Math.round(bands.Decide.y - routeGuideOffsets.divider),
      Math.round(bands.Act.y - routeGuideOffsets.divider),
    ],
    routeGuideYs: [
      routeChannels.telemetryY,
      routeChannels.policyY,
      routeChannels.rejectionY,
      routeChannels.validationY,
      routeChannels.writeY,
    ],
    verticalGuideXs: [
      routeChannels.cpcSpineX,
      routeChannels.monitorSpineX,
      routeChannels.laneCSpineX,
    ],
    writeCorridorBounds: corridorFromRoutes ?? corridorFallback,
    writeRoutes: options?.writeRoutes,
  }
}

export function buildBoardGeometryFromNodes(
  nodes: NodeLike[],
  edges: EdgeLike[],
  manifest: GraphManifest = graphManifest,
) {
  const rectMap = buildBoardRectMapFromNodes(nodes, manifest)
  const routeChannels = buildBoardRouteChannels(rectMap, manifest)
  const writeRoutes = buildWriteCorridorRoutes(nodes, edges, routeChannels)
  return buildBoardGeometry(rectMap, {
    manifest,
    writeRoutes,
  })
}

export function buildBoardGeometryFromPositions(
  positions: NodePositionMap,
  manifest: GraphManifest = graphManifest,
) {
  return buildBoardGeometry(buildBoardRectMapFromPositions(positions, manifest), { manifest })
}

export function clampRectToCanvas(
  rect: BoardRect,
  canvas: BoardRect,
  margin = 0,
) {
  const maxX = canvas.x + canvas.width - rect.width - margin
  const maxY = canvas.y + canvas.height - rect.height - margin

  return {
    x: clamp(rect.x, canvas.x + margin, maxX),
    y: clamp(rect.y, canvas.y + margin, maxY),
    width: rect.width,
    height: rect.height,
  }
}

export function buildBoardEdgeRouteFromPositions(
  edge: EdgeSpec,
  positions: NodePositionMap,
  manifest: GraphManifest = graphManifest,
  edgeHandles?: { sourceHandle: HandleId; targetHandle: HandleId },
): RoutedBoardEdge {
  const rectMap = buildBoardRectMapFromPositions(positions, manifest)
  const sourceRect = rectMap[edge.source]
  const targetRect = rectMap[edge.target]

  if (!sourceRect || !targetRect || !edgeHandles) {
    throw new Error(`Missing route state for ${edge.id}`)
  }

  return buildBoardEdgeRoute(
    edge,
    anchorPointForRect(sourceRect, edgeHandles.sourceHandle),
    anchorPointForRect(targetRect, edgeHandles.targetHandle),
    buildBoardRouteChannels(rectMap, manifest),
  )
}
