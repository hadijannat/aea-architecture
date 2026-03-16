import { graphManifest } from '@/graph/spec/manifest'
import type { GraphManifest, ProjectionOverrides } from '@/graph/spec/schema'

export interface NodePosition {
  x: number
  y: number
}

export type NodePositionMap = Record<string, NodePosition>

export const BAND_INSET_X = 28
export const BAND_INSET_Y = 78
export const BAND_SPACING = 40

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
  const decideColumnOffsets = [32, 362, 692, 1022] as const
  const decideRowOffsets = [46, 366, 686] as const

  Object.assign(positions, {
    A1: { x: lanes.A.x + 66, y: lanes.A.y + 210 },
    A2: { x: lanes.A.x + 66, y: lanes.A.y + 544 },
    A3: { x: lanes.A.x + 66, y: lanes.A.y + 1470 },
  })

  Object.assign(positions, {
    G1: { x: gateway.x + 32, y: gateway.y + 96 },
    G2: { x: gateway.x + 32, y: gateway.y + 252 },
    G3: { x: gateway.x + 32, y: gateway.y + 406 },
    VOI: { x: gateway.x + 26, y: gateway.y + gateway.height - 310 },
  })

  Object.assign(positions, {
    S1: { x: positions.BAND_SENSE.x + 30, y: positions.BAND_SENSE.y + 50 },
    S2: { x: positions.BAND_SENSE.x + 440, y: positions.BAND_SENSE.y + 46 },
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
    ACT1: { x: positions.BAND_ACT.x + 32, y: positions.BAND_ACT.y + 54 },
    ACT3: { x: positions.BAND_ACT.x + 490, y: positions.BAND_ACT.y + 56 },
    ACT2: { x: positions.BAND_ACT.x + 1000, y: positions.BAND_ACT.y + 52 },
  })

  Object.assign(positions, {
    C1: { x: lanes.C.x + 66, y: lanes.C.y + 1480 },
    C2: { x: lanes.C.x + 46, y: lanes.C.y + 1690 },
  })

  for (const [nodeId, position] of Object.entries(overrides?.nodePositions ?? {})) {
    positions[nodeId] = position
  }

  return positions
}
