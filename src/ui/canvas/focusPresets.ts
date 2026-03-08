import type { FitViewOptions } from '@xyflow/react'

import type { DiagramFlowNode } from '@/graph/compile/toReactFlow'
import { graphManifest } from '@/graph/spec/manifest'
import type { Point } from '@/layout/board'

export type FocusPreset = 'overview' | 'gateway' | 'guardrail' | 'write' | 'lane-c'

export interface FocusPresetOption {
  id: FocusPreset
  label: string
}

export interface OverviewRegion {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  accent: 'lane-a' | 'gateway' | 'lane-b' | 'lane-c' | 'write'
  preset?: FocusPreset
}

export interface OverviewRouteGeometry {
  id: string
  points: Point[]
}

export const focusPresetNodeIds: Record<FocusPreset, string[]> = {
  overview: [],
  gateway: [
    'G1',
    'G2',
    'G3',
    'VOI',
    'S1',
    'S2',
    'DEC_K1',
    'DEC_K2',
    'DEC_R0',
    'DEC_R1',
    'DEC_G0',
    'DEC_R2',
    'DEC_T0',
    'DEC_G1A',
    'DEC_G1',
    'DEC_G2',
    'DEC_H1',
    'DEC_M1',
    'ACT1',
    'ACT3',
  ],
  guardrail: [
    'S2',
    'DEC_K1',
    'DEC_K2',
    'DEC_R0',
    'DEC_G0',
    'DEC_R2',
    'DEC_T0',
    'DEC_G1A',
    'DEC_G1',
    'DEC_G2',
    'DEC_H1',
    'DEC_M1',
    'ACT3',
  ],
  write: ['DEC_G1', 'DEC_G2', 'DEC_H1', 'ACT1', 'VOI', 'A3', 'ACT3'],
  'lane-c': ['ACT2', 'ACT3', 'C1', 'C2'],
}

export const focusPresetOptions: FocusPresetOption[] = [
  { id: 'gateway', label: 'Gateway + AEA' },
  { id: 'guardrail', label: 'Guardrails' },
  { id: 'overview', label: 'Full map' },
  { id: 'write', label: 'Write corridor' },
  { id: 'lane-c', label: 'Central M+O' },
]

const presetViewOptions: Record<FocusPreset, { padding: number; maxZoom: number }> = {
  overview: { padding: 0.12, maxZoom: 0.92 },
  gateway: { padding: 0.04, maxZoom: 1.32 },
  guardrail: { padding: 0.08, maxZoom: 1.2 },
  write: { padding: 0.12, maxZoom: 1.1 },
  'lane-c': { padding: 0.1, maxZoom: 1.22 },
}

const { lanes, gateway, aea, canvas } = graphManifest.layoutDefaults

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

const fallbackOverviewRegions: OverviewRegion[] = [
  {
    id: 'lane-a',
    label: 'Lane A',
    x: lanes.A.x,
    y: lanes.A.y,
    width: lanes.A.width,
    height: lanes.A.height,
    accent: 'lane-a',
  },
  {
    id: 'gateway',
    label: 'Gateway + AEA',
    x: gateway.x,
    y: aea.y - 24,
    width: aea.x + aea.width - gateway.x,
    height: aea.height + 24,
    accent: 'gateway',
    preset: 'gateway',
  },
  {
    id: 'lane-b',
    label: 'Lane B',
    x: lanes.B.x,
    y: lanes.B.y,
    width: lanes.B.width,
    height: lanes.B.height,
    accent: 'lane-b',
  },
  {
    id: 'lane-c',
    label: 'Central M+O',
    x: lanes.C.x,
    y: lanes.C.y,
    width: lanes.C.width,
    height: lanes.C.height,
    accent: 'lane-c',
    preset: 'lane-c',
  },
  {
    id: 'write',
    label: 'Write corridor',
    x: gateway.x - 92,
    y: aea.y + 760,
    width: canvas.width - (gateway.x - 92) - 356,
    height: 358,
    accent: 'write',
    preset: 'write',
  },
]

function getNodeBounds(node?: DiagramFlowNode): Bounds | undefined {
  if (!node) {
    return undefined
  }

  const width = node.width ?? node.data.spec.width
  const height = node.height ?? node.data.spec.height

  return {
    x: node.position.x,
    y: node.position.y,
    width,
    height,
  }
}

function unionBounds(bounds: Bounds[]): Bounds | undefined {
  if (bounds.length === 0) {
    return undefined
  }

  const x1 = Math.min(...bounds.map((entry) => entry.x))
  const y1 = Math.min(...bounds.map((entry) => entry.y))
  const x2 = Math.max(...bounds.map((entry) => entry.x + entry.width))
  const y2 = Math.max(...bounds.map((entry) => entry.y + entry.height))

  return {
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1,
  }
}

function clampBounds(bounds: Bounds, paddingX: number, paddingY: number): Bounds {
  const x1 = Math.max(0, bounds.x - paddingX)
  const y1 = Math.max(0, bounds.y - paddingY)
  const x2 = Math.min(canvas.width, bounds.x + bounds.width + paddingX)
  const y2 = Math.min(canvas.height, bounds.y + bounds.height + paddingY)

  return {
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1,
  }
}

function routeBounds(writeRoutes: OverviewRouteGeometry[]): Bounds | undefined {
  const points = writeRoutes.flatMap((route) => route.points)
  if (points.length === 0) {
    return undefined
  }

  const x1 = Math.min(...points.map((point) => point.x))
  const y1 = Math.min(...points.map((point) => point.y))
  const x2 = Math.max(...points.map((point) => point.x))
  const y2 = Math.max(...points.map((point) => point.y))

  return {
    x: x1,
    y: y1,
    width: Math.max(1, x2 - x1),
    height: Math.max(1, y2 - y1),
  }
}

export function getFocusPresetButtonLabel(preset: FocusPreset) {
  return focusPresetOptions.find((option) => option.id === preset)?.label ?? preset
}

export function getFocusPresetAccessibleLabel(preset: FocusPreset) {
  if (preset === 'write') {
    return 'Write corridor focus'
  }

  if (preset === 'guardrail') {
    return 'Guardrail control focus'
  }

  return getFocusPresetButtonLabel(preset)
}

export function deriveOverviewRegions(
  nodes: DiagramFlowNode[],
  writeRoutes: OverviewRouteGeometry[],
): OverviewRegion[] {
  const visibleNodes = nodes.filter((node) => !node.hidden)
  const nodesById = new Map(visibleNodes.map((node) => [node.id, node]))

  const laneABounds = getNodeBounds(nodesById.get('LANE_A'))
  const laneBBounds = getNodeBounds(nodesById.get('LANE_B'))
  const laneCBounds = getNodeBounds(nodesById.get('LANE_C'))
  const gatewayBounds = getNodeBounds(nodesById.get('GW'))
  const aeaBounds = getNodeBounds(nodesById.get('AEA'))
  const writeBounds =
    routeBounds(writeRoutes) ??
    unionBounds(
      focusPresetNodeIds.write
        .map((nodeId) => getNodeBounds(nodesById.get(nodeId)))
        .filter((entry): entry is Bounds => Boolean(entry)),
    )

  const liveRegions: Array<OverviewRegion | undefined> = [
    laneABounds && {
      id: 'lane-a',
      label: 'Lane A',
      accent: 'lane-a',
      ...laneABounds,
    },
    gatewayBounds &&
      aeaBounds && {
        id: 'gateway',
        label: 'Gateway + AEA',
        accent: 'gateway',
        preset: 'gateway',
        ...clampBounds(unionBounds([gatewayBounds, aeaBounds]) ?? gatewayBounds, 24, 24),
      },
    laneBBounds && {
      id: 'lane-b',
      label: 'Lane B',
      accent: 'lane-b',
      ...laneBBounds,
    },
    laneCBounds && {
      id: 'lane-c',
      label: 'Central M+O',
      accent: 'lane-c',
      preset: 'lane-c',
      ...laneCBounds,
    },
    writeBounds && {
      id: 'write',
      label: 'Write corridor',
      accent: 'write',
      preset: 'write',
      ...clampBounds(writeBounds, 72, 56),
    },
  ]

  return fallbackOverviewRegions.map((fallbackRegion) => {
    const liveRegion = liveRegions.find((region) => region?.id === fallbackRegion.id)
    return liveRegion ?? fallbackRegion
  })
}

export function isStructuralNode(node: DiagramFlowNode) {
  const kind = node.data?.spec.kind
  return kind === 'lane' || kind === 'container' || kind === 'band'
}

export function getFocusTargetNodes(nodes: DiagramFlowNode[], preset: FocusPreset) {
  const semanticNodes = nodes.filter((node) => !isStructuralNode(node) && !node.hidden)
  return preset === 'overview'
    ? semanticNodes
    : semanticNodes.filter((node) => focusPresetNodeIds[preset].includes(node.id))
}

export function getFocusPresetViewOptions(preset: FocusPreset): Pick<FitViewOptions, 'padding' | 'maxZoom'> {
  return presetViewOptions[preset]
}

export function fitNodesToPreset(
  nodes: DiagramFlowNode[],
  fitView: (options?: FitViewOptions) => Promise<boolean>,
  preset: FocusPreset,
) {
  const targetNodes = getFocusTargetNodes(nodes, preset)

  if (targetNodes.length === 0) {
    return
  }

  const options = getFocusPresetViewOptions(preset)
  void fitView({
    nodes: targetNodes.map((node) => ({ id: node.id })),
    duration: 280,
    padding: options.padding,
    maxZoom: options.maxZoom,
  })
}
