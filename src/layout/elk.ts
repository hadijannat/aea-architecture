import ELK from 'elkjs/lib/elk.bundled.js'

import { graphManifest } from '@/graph/spec/manifest'
import type { GraphManifest, ProjectionOverrides } from '@/graph/spec/schema'

export interface NodePosition {
  x: number
  y: number
}

export type NodePositionMap = Record<string, NodePosition>

const elk = new ELK()

async function layoutGroup(
  nodeIds: string[],
  edgeIds: string[],
  options: {
    x: number
    y: number
    width: number
    height: number
    direction?: 'RIGHT' | 'DOWN'
    nodeSpacing?: number
    layerSpacing?: number
  },
): Promise<NodePositionMap> {
  const nodes = nodeIds.map((id) => {
    const node = graphManifest.nodes.find((item) => item.id === id)
    if (!node) {
      throw new Error(`Missing node ${id} for ELK layout`)
    }
    return {
      id,
      width: node.width,
      height: node.height,
    }
  })

  const edges = edgeIds
    .map((id) => graphManifest.edges.find((edge) => edge.id === id))
    .filter((edge): edge is GraphManifest['edges'][number] => Boolean(edge))
    .filter((edge) => nodeIds.includes(edge.source) && nodeIds.includes(edge.target))
    .map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    }))

  const layout = await elk.layout({
    id: `group-${nodeIds.join('-')}`,
    layoutOptions: {
      ...graphManifest.layoutDefaults.elk,
      'elk.direction': options.direction ?? 'RIGHT',
      'elk.padding': '[top=0,left=0,bottom=0,right=0]',
      'elk.layered.spacing.nodeNodeBetweenLayers': String(
        options.layerSpacing ?? (options.direction === 'DOWN' ? 34 : 68),
      ),
      'elk.spacing.nodeNode': String(options.nodeSpacing ?? 34),
    },
    children: nodes,
    edges,
  })

  return Object.fromEntries(
    (layout.children ?? []).map((child) => [
      child.id,
      {
        x: options.x + (child.x ?? 0),
        y: options.y + (child.y ?? 0),
      },
    ]),
  )
}

export async function computeNodePositions(
  manifest: GraphManifest = graphManifest,
  overrides?: ProjectionOverrides,
): Promise<NodePositionMap> {
  const positions: NodePositionMap = {}
  const { lanes, gateway, aea } = manifest.layoutDefaults

  positions.LANE_A = { x: lanes.A.x, y: lanes.A.y }
  positions.LANE_B = { x: lanes.B.x, y: lanes.B.y }
  positions.LANE_C = { x: lanes.C.x, y: lanes.C.y }
  positions.GW = { x: gateway.x, y: gateway.y }
  positions.AEA = { x: aea.x, y: aea.y }

  const bandSpacing = 18
  const bandInsetX = 20
  const bandInsetY = 58
  positions.BAND_SENSE = { x: aea.x + bandInsetX, y: aea.y + bandInsetY }
  positions.BAND_DECIDE = {
    x: aea.x + bandInsetX,
    y: positions.BAND_SENSE.y + aea.bandHeights.Sense + bandSpacing,
  }
  positions.BAND_ACT = {
    x: aea.x + bandInsetX,
    y: positions.BAND_DECIDE.y + aea.bandHeights.Decide + bandSpacing,
  }

  Object.assign(
    positions,
    await layoutGroup(['A1', 'A2', 'A3'], ['F_CPC_INT'], {
      x: lanes.A.x + 56,
      y: lanes.A.y + 170,
      width: 228,
      height: 456,
      direction: 'DOWN',
      nodeSpacing: 38,
      layerSpacing: 40,
    }),
  )

  Object.assign(
    positions,
    await layoutGroup(['G1', 'G2', 'G3'], ['F_GW2', 'F_GW3'], {
      x: gateway.x + 20,
      y: gateway.y + 72,
      width: 100,
      height: gateway.ne177Height - 72,
      direction: 'DOWN',
      nodeSpacing: 34,
      layerSpacing: 38,
    }),
  )

  positions.VOI = {
    x: gateway.x + 15,
    y: gateway.y + gateway.ne177Height + 86,
  }

  Object.assign(
    positions,
    await layoutGroup(['S1', 'S2'], ['F2'], {
      x: positions.BAND_SENSE.x + 34,
      y: positions.BAND_SENSE.y + 36,
      width: 640,
      height: 120,
      direction: 'RIGHT',
      nodeSpacing: 40,
      layerSpacing: 74,
    }),
  )

  const decideColumns = [
    {
      nodeIds: ['DEC_K1', 'DEC_K2'],
      edgeIds: [],
      x: positions.BAND_DECIDE.x + 18,
      y: positions.BAND_DECIDE.y + 34,
    },
    {
      nodeIds: ['DEC_R1', 'DEC_R2'],
      edgeIds: ['F3c'],
      x: positions.BAND_DECIDE.x + 288,
      y: positions.BAND_DECIDE.y + 34,
    },
    {
      nodeIds: ['DEC_G1', 'DEC_G2'],
      edgeIds: ['F3f'],
      x: positions.BAND_DECIDE.x + 560,
      y: positions.BAND_DECIDE.y + 34,
    },
  ]

  for (const column of decideColumns) {
    Object.assign(
      positions,
      await layoutGroup(column.nodeIds, column.edgeIds, {
        x: column.x,
        y: column.y,
        width: 240,
        height: 248,
        direction: 'DOWN',
        nodeSpacing: 40,
        layerSpacing: 48,
      }),
    )
  }

  Object.assign(
    positions,
    await layoutGroup(['ACT1', 'ACT2', 'ACT3'], ['F_AUDIT'], {
      x: positions.BAND_ACT.x + 18,
      y: positions.BAND_ACT.y + 28,
      width: 660,
      height: 120,
      direction: 'RIGHT',
      nodeSpacing: 42,
      layerSpacing: 72,
    }),
  )

  Object.assign(
    positions,
    await layoutGroup(['C1', 'C2'], ['F7b'], {
      x: lanes.C.x + 42,
      y: lanes.C.y + 240,
      width: 280,
      height: 260,
      direction: 'DOWN',
      nodeSpacing: 38,
      layerSpacing: 44,
    }),
  )

  for (const [nodeId, position] of Object.entries(overrides?.nodePositions ?? {})) {
    positions[nodeId] = position
  }

  return positions
}
