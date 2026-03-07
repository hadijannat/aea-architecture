import type { FitViewOptions } from '@xyflow/react'

import type { DiagramFlowNode } from '@/graph/compile/toReactFlow'
import { graphManifest } from '@/graph/spec/manifest'

export type FocusPreset = 'overview' | 'gateway' | 'write' | 'lane-c'

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

export const focusPresetNodeIds: Record<FocusPreset, string[]> = {
  overview: [],
  gateway: ['G1', 'G2', 'G3', 'VOI', 'S1', 'S2', 'DEC_K1', 'DEC_K2', 'DEC_R1', 'DEC_R2', 'DEC_G1', 'DEC_G2', 'ACT1'],
  write: ['DEC_G1', 'DEC_G2', 'ACT1', 'VOI', 'A3'],
  'lane-c': ['ACT2', 'ACT3', 'C1', 'C2'],
}

export const focusPresetOptions: FocusPresetOption[] = [
  { id: 'gateway', label: 'Gateway + AEA' },
  { id: 'overview', label: 'Full map' },
  { id: 'write', label: 'Write corridor focus' },
  { id: 'lane-c', label: 'Central M+O' },
]

const presetViewOptions: Record<FocusPreset, { padding: number; maxZoom: number }> = {
  overview: { padding: 0.12, maxZoom: 0.92 },
  gateway: { padding: 0.04, maxZoom: 1.32 },
  write: { padding: 0.08, maxZoom: 1.38 },
  'lane-c': { padding: 0.1, maxZoom: 1.22 },
}

const { lanes, gateway, aea, canvas } = graphManifest.layoutDefaults

export const overviewRegions: OverviewRegion[] = [
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
    y: aea.y + 574,
    width: canvas.width - (gateway.x - 92) - 356,
    height: 322,
    accent: 'write',
    preset: 'write',
  },
]

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
