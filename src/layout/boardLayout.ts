import { graphManifest } from '@/graph/spec/manifest'
import type { GraphManifest, ProjectionOverrides } from '@/graph/spec/schema'

export interface NodePosition {
  x: number
  y: number
}

export type NodePositionMap = Record<string, NodePosition>

export async function computeBoardNodePositions(
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

  const bandInsetX = 20
  const bandInsetY = 66
  const bandSpacing = 26

  positions.BAND_SENSE = { x: aea.x + bandInsetX, y: aea.y + bandInsetY }
  positions.BAND_DECIDE = {
    x: aea.x + bandInsetX,
    y: positions.BAND_SENSE.y + aea.bandHeights.Sense + bandSpacing,
  }
  positions.BAND_ACT = {
    x: aea.x + bandInsetX,
    y: positions.BAND_DECIDE.y + aea.bandHeights.Decide + bandSpacing,
  }

  const decideBandX = positions.BAND_DECIDE.x
  const decideBandY = positions.BAND_DECIDE.y
  const decideColumnOffsets = [24, 292, 560, 828] as const
  const decideRowOffsets = [34, 254, 474] as const

  Object.assign(positions, {
    A1: { x: lanes.A.x + 56, y: lanes.A.y + 176 },
    A2: { x: lanes.A.x + 56, y: lanes.A.y + 442 },
    A3: { x: lanes.A.x + 56, y: lanes.A.y + 1184 },
  })

  Object.assign(positions, {
    G1: { x: gateway.x + 26, y: gateway.y + 80 },
    G2: { x: gateway.x + 26, y: gateway.y + 204 },
    G3: { x: gateway.x + 26, y: gateway.y + 328 },
    VOI: { x: gateway.x + 20, y: gateway.y + gateway.height - 250 },
  })

  Object.assign(positions, {
    S1: { x: positions.BAND_SENSE.x + 24, y: positions.BAND_SENSE.y + 40 },
    S2: { x: positions.BAND_SENSE.x + 360, y: positions.BAND_SENSE.y + 34 },
  })

  Object.assign(positions, {
    DEC_K1: { x: decideBandX + decideColumnOffsets[0], y: decideBandY + decideRowOffsets[0] },
    DEC_R0: { x: decideBandX + decideColumnOffsets[1], y: decideBandY + decideRowOffsets[0] },
    DEC_R1: { x: decideBandX + decideColumnOffsets[2], y: decideBandY + decideRowOffsets[0] },
    DEC_T0: { x: decideBandX + decideColumnOffsets[3], y: decideBandY + decideRowOffsets[0] },
    DEC_K2: { x: decideBandX + decideColumnOffsets[0], y: decideBandY + decideRowOffsets[1] },
    DEC_G0: { x: decideBandX + decideColumnOffsets[1], y: decideBandY + decideRowOffsets[1] },
    DEC_R2: { x: decideBandX + decideColumnOffsets[2], y: decideBandY + decideRowOffsets[1] },
    DEC_G1A: { x: decideBandX + decideColumnOffsets[3], y: decideBandY + decideRowOffsets[1] },
    DEC_H1: { x: decideBandX + decideColumnOffsets[0], y: decideBandY + decideRowOffsets[2] },
    DEC_M1: { x: decideBandX + decideColumnOffsets[1], y: decideBandY + decideRowOffsets[2] },
    DEC_G1: { x: decideBandX + decideColumnOffsets[2], y: decideBandY + decideRowOffsets[2] },
    DEC_G2: { x: decideBandX + decideColumnOffsets[3], y: decideBandY + decideRowOffsets[2] },
  })

  Object.assign(positions, {
    ACT1: { x: positions.BAND_ACT.x + 24, y: positions.BAND_ACT.y + 42 },
    ACT3: { x: positions.BAND_ACT.x + 396, y: positions.BAND_ACT.y + 44 },
    ACT2: { x: positions.BAND_ACT.x + 820, y: positions.BAND_ACT.y + 40 },
  })

  Object.assign(positions, {
    C1: { x: lanes.C.x + 58, y: lanes.C.y + 1196 },
    C2: { x: lanes.C.x + 38, y: lanes.C.y + 1366 },
  })

  for (const [nodeId, position] of Object.entries(overrides?.nodePositions ?? {})) {
    positions[nodeId] = position
  }

  return positions
}
