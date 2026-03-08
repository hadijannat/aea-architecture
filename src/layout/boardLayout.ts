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

  Object.assign(positions, {
    A1: { x: lanes.A.x + 56, y: lanes.A.y + 186 },
    A2: { x: lanes.A.x + 56, y: lanes.A.y + 412 },
    A3: { x: lanes.A.x + 56, y: lanes.A.y + 1060 },
  })

  Object.assign(positions, {
    G1: { x: gateway.x + 26, y: gateway.y + 64 },
    G2: { x: gateway.x + 26, y: gateway.y + 174 },
    G3: { x: gateway.x + 26, y: gateway.y + 288 },
    VOI: { x: gateway.x + 20, y: gateway.y + gateway.ne177Height + 322 },
  })

  Object.assign(positions, {
    S1: { x: positions.BAND_SENSE.x + 24, y: positions.BAND_SENSE.y + 40 },
    S2: { x: positions.BAND_SENSE.x + 360, y: positions.BAND_SENSE.y + 34 },
  })

  Object.assign(positions, {
    DEC_K1: { x: positions.BAND_DECIDE.x + 24, y: positions.BAND_DECIDE.y + 34 },
    DEC_R0: { x: positions.BAND_DECIDE.x + 280, y: positions.BAND_DECIDE.y + 34 },
    DEC_R1: { x: positions.BAND_DECIDE.x + 548, y: positions.BAND_DECIDE.y + 34 },
    DEC_T0: { x: positions.BAND_DECIDE.x + 816, y: positions.BAND_DECIDE.y + 34 },
    DEC_K2: { x: positions.BAND_DECIDE.x + 24, y: positions.BAND_DECIDE.y + 224 },
    DEC_G0: { x: positions.BAND_DECIDE.x + 280, y: positions.BAND_DECIDE.y + 224 },
    DEC_R2: { x: positions.BAND_DECIDE.x + 548, y: positions.BAND_DECIDE.y + 224 },
    DEC_G1A: { x: positions.BAND_DECIDE.x + 816, y: positions.BAND_DECIDE.y + 224 },
    DEC_H1: { x: positions.BAND_DECIDE.x + 24, y: positions.BAND_DECIDE.y + 424 },
    DEC_M1: { x: positions.BAND_DECIDE.x + 280, y: positions.BAND_DECIDE.y + 424 },
    DEC_G1: { x: positions.BAND_DECIDE.x + 548, y: positions.BAND_DECIDE.y + 424 },
    DEC_G2: { x: positions.BAND_DECIDE.x + 816, y: positions.BAND_DECIDE.y + 424 },
  })

  Object.assign(positions, {
    ACT1: { x: positions.BAND_ACT.x + 24, y: positions.BAND_ACT.y + 42 },
    ACT3: { x: positions.BAND_ACT.x + 396, y: positions.BAND_ACT.y + 44 },
    ACT2: { x: positions.BAND_ACT.x + 820, y: positions.BAND_ACT.y + 40 },
  })

  Object.assign(positions, {
    C1: { x: lanes.C.x + 58, y: lanes.C.y + 1056 },
    C2: { x: lanes.C.x + 38, y: lanes.C.y + 1226 },
  })

  for (const [nodeId, position] of Object.entries(overrides?.nodePositions ?? {})) {
    positions[nodeId] = position
  }

  return positions
}
