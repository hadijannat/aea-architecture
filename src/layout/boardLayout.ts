import { graphManifest } from '@/graph/spec/manifest'
import type { GraphManifest, ProjectionOverrides } from '@/graph/spec/schema'

export interface NodePosition {
  x: number
  y: number
}

export type NodePositionMap = Record<string, NodePosition>

export const BAND_INSET_X = 28
export const BAND_INSET_Y = 74
export const BAND_SPACING = 36

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

  const bandInsetX = BAND_INSET_X
  const bandInsetY = BAND_INSET_Y
  const bandSpacing = BAND_SPACING

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
  const decideColumnOffsets = [30, 315, 600, 885] as const
  const decideRowOffsets = [40, 310, 580] as const

  Object.assign(positions, {
    A1: { x: lanes.A.x + 62, y: lanes.A.y + 196 },
    A2: { x: lanes.A.x + 62, y: lanes.A.y + 498 },
    A3: { x: lanes.A.x + 62, y: lanes.A.y + 1340 },
  })

  Object.assign(positions, {
    G1: { x: gateway.x + 30, y: gateway.y + 90 },
    G2: { x: gateway.x + 30, y: gateway.y + 230 },
    G3: { x: gateway.x + 30, y: gateway.y + 370 },
    VOI: { x: gateway.x + 24, y: gateway.y + gateway.height - 280 },
  })

  Object.assign(positions, {
    S1: { x: positions.BAND_SENSE.x + 28, y: positions.BAND_SENSE.y + 46 },
    S2: { x: positions.BAND_SENSE.x + 400, y: positions.BAND_SENSE.y + 40 },
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
    ACT1: { x: positions.BAND_ACT.x + 28, y: positions.BAND_ACT.y + 48 },
    ACT3: { x: positions.BAND_ACT.x + 440, y: positions.BAND_ACT.y + 50 },
    ACT2: { x: positions.BAND_ACT.x + 900, y: positions.BAND_ACT.y + 46 },
  })

  Object.assign(positions, {
    C1: { x: lanes.C.x + 62, y: lanes.C.y + 1352 },
    C2: { x: lanes.C.x + 42, y: lanes.C.y + 1542 },
  })

  for (const [nodeId, position] of Object.entries(overrides?.nodePositions ?? {})) {
    positions[nodeId] = position
  }

  return positions
}
