import type { EdgeSpec, GraphManifest, NodeSpec } from './schema'

const requiredNodeIds = [
  'A1',
  'A2',
  'A3',
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
  'ACT2',
  'ACT3',
  'C1',
  'C2',
  'PB_AEA',
  'PB_REJECT_OUT',
] as const

const requiredEdgeIds = [
  'F_GW1',
  'F_GW2',
  'F_GW3',
  'F1',
  'F2',
  'F3a',
  'F3b',
  "F3b'",
  'F3c',
  'F3d',
  'F_R0_out',
  'F_G0_pol',
  'F_G0_out',
  'F3e',
  'F_G1A_pass',
  'F_G1A_reject',
  'F3f',
  'F3f_reject',
  'F3g',
  'F3h',
  'F3i',
  'F_G2_reject',
  'F_T0_req',
  'F_T1',
  'F_T2',
  'F_T0_obs',
  'F4',
  'F_H1_revalidate',
  'F_H1_reject',
  'F_H1_pass',
  'F_M1_G0',
  'F_M1_R0',
  'F_M1_T0',
  'F_M1_G1A',
  'F_M1_H1',
  'F_M1_out',
  'F_KPI',
  'F_AUDIT',
  'F5',
  'F6',
  'F_VoR_ACK',
  'F_CPC_INT',
  'F7a',
  'F7b',
  'F7_sub',
  'PB_F1',
  'PB_F2',
  'PB_F3',
  'PB_F4',
  'PB_ACK',
  'PB_REJECT',
] as const

const requiredStepIds = ['PB1', 'PB2', 'PB3', 'PB4', 'PB5'] as const
const requiredSequenceTerminalIds = ['PB_AEA', 'PB_REJECT_OUT'] as const
const requiredInteractionRuleIds = [
  'RULE_VOR_CHAIN',
  'RULE_VOR_EXECUTION',
  'RULE_VOR_ACK',
  'RULE_VOR_REJECT',
  'RULE_GUARDRAIL_LAYER',
] as const

type CanonicalNodeRule = Partial<
  Pick<NodeSpec, 'kind' | 'nodeType' | 'title' | 'subtitle' | 'parentId' | 'lane' | 'band'>
> & {
  forbiddenAliases?: readonly string[]
}

const canonicalNodeRules: Record<string, CanonicalNodeRule> = {
  GW: {
    kind: 'container',
    nodeType: 'ContainerNode',
    title: 'NOA Security Gateway',
    subtitle: 'NE 177 / NE 178',
  },
  AEA: {
    kind: 'container',
    nodeType: 'ContainerNode',
    title: 'Autonomous Edge Agent (AEA)',
    lane: 'B',
  },
  BAND_SENSE: {
    kind: 'band',
    nodeType: 'ContainerNode',
    title: 'Sense',
    parentId: 'AEA',
    lane: 'B',
    band: 'Sense',
  },
  BAND_DECIDE: {
    kind: 'band',
    nodeType: 'ContainerNode',
    title: 'Decide',
    parentId: 'AEA',
    lane: 'B',
    band: 'Decide',
  },
  BAND_ACT: {
    kind: 'band',
    nodeType: 'ContainerNode',
    title: 'Act',
    parentId: 'AEA',
    lane: 'B',
    band: 'Act',
  },
  G1: {
    kind: 'gateway-module',
    nodeType: 'GatewayModuleNode',
    title: 'G1',
    parentId: 'GW',
  },
  G2: {
    kind: 'gateway-module',
    nodeType: 'GatewayModuleNode',
    title: 'G2',
    parentId: 'GW',
  },
  G3: {
    kind: 'gateway-module',
    nodeType: 'GatewayModuleNode',
    title: 'G3',
    parentId: 'GW',
  },
  VOI: {
    kind: 'gateway-interface',
    nodeType: 'GatewayInterfaceNode',
    title: 'VoR Interface',
    subtitle: 'NE 178 interface',
    parentId: 'GW',
    forbiddenAliases: ['G4'],
  },
  DEC_R0: {
    kind: 'gateway-module',
    nodeType: 'GatewayModuleNode',
    title: 'Retrieval Guard',
    parentId: 'BAND_DECIDE',
    lane: 'B',
    band: 'Decide',
  },
  DEC_G0: {
    kind: 'policy',
    nodeType: 'PolicyNode',
    title: 'Input / Context Guard',
    parentId: 'BAND_DECIDE',
    lane: 'B',
    band: 'Decide',
  },
  DEC_T0: {
    kind: 'gateway-module',
    nodeType: 'GatewayModuleNode',
    title: 'Tool Guard / Broker',
    parentId: 'BAND_DECIDE',
    lane: 'B',
    band: 'Decide',
  },
  DEC_G1A: {
    kind: 'policy',
    nodeType: 'PolicyNode',
    title: 'Output Guard / Schema Checker',
    parentId: 'BAND_DECIDE',
    lane: 'B',
    band: 'Decide',
  },
  DEC_H1: {
    kind: 'gateway-module',
    nodeType: 'GatewayModuleNode',
    title: 'Human Approval Gate',
    parentId: 'BAND_DECIDE',
    lane: 'B',
    band: 'Decide',
  },
  DEC_M1: {
    kind: 'audit',
    nodeType: 'AuditNode',
    title: 'Guardrail Monitor / Evals',
    parentId: 'BAND_DECIDE',
    lane: 'B',
    band: 'Decide',
  },
  PB_AEA: {
    title: 'AEA Return',
  },
  PB_REJECT_OUT: {
    title: 'Rejection Output',
  },
}

type CanonicalEdgeRule = Pick<
  EdgeSpec,
  'source' | 'target' | 'semantic' | 'style' | 'direction'
> & {
  markers?: readonly EdgeSpec['markers'][number][]
  optional?: boolean
}

const canonicalEdgeRules: Record<(typeof requiredEdgeIds)[number], CanonicalEdgeRule> = {
  F_GW1: {
    source: 'A2',
    target: 'G1',
    semantic: 'gateway-internal',
    style: 'medium',
    direction: 'ltr',
  },
  F_GW2: {
    source: 'G1',
    target: 'G2',
    semantic: 'gateway-internal',
    style: 'medium',
    direction: 'ttb',
    markers: ['diode'],
  },
  F_GW3: {
    source: 'G2',
    target: 'G3',
    semantic: 'gateway-internal',
    style: 'medium',
    direction: 'ttb',
    markers: ['diode'],
  },
  F1: {
    source: 'G3',
    target: 'S1',
    semantic: 'read-only',
    style: 'medium',
    direction: 'ltr',
  },
  F2: {
    source: 'S1',
    target: 'S2',
    semantic: 'normalization',
    style: 'thin',
    direction: 'ltr',
  },
  F3a: {
    source: 'DEC_K1',
    target: 'DEC_R0',
    semantic: 'retrieval',
    style: 'thin',
    direction: 'ltr',
  },
  F3b: {
    source: 'DEC_K2',
    target: 'DEC_R0',
    semantic: 'policy-soft',
    style: 'thin',
    direction: 'ltr',
  },
  "F3b'": {
    source: 'DEC_K2',
    target: 'DEC_G1',
    semantic: 'policy-hard',
    style: 'medium',
    direction: 'ltr',
  },
  F3c: {
    source: 'DEC_R1',
    target: 'DEC_G0',
    semantic: 'retrieval',
    style: 'medium',
    direction: 'ltr',
  },
  F3d: {
    source: 'S2',
    target: 'DEC_G0',
    semantic: 'retrieval',
    style: 'medium',
    direction: 'ttb',
  },
  F_R0_out: {
    source: 'DEC_R0',
    target: 'DEC_R1',
    semantic: 'retrieval',
    style: 'medium',
    direction: 'ltr',
  },
  F_G0_pol: {
    source: 'DEC_K2',
    target: 'DEC_G0',
    semantic: 'policy-hard',
    style: 'thin',
    direction: 'ltr',
  },
  F_G0_out: {
    source: 'DEC_G0',
    target: 'DEC_R2',
    semantic: 'retrieval',
    style: 'medium',
    direction: 'ltr',
  },
  F3e: {
    source: 'DEC_R2',
    target: 'DEC_G1A',
    semantic: 'proposal',
    style: 'medium',
    direction: 'ltr',
  },
  F_G1A_pass: {
    source: 'DEC_G1A',
    target: 'DEC_G1',
    semantic: 'validation',
    style: 'medium',
    direction: 'ttb',
  },
  F_G1A_reject: {
    source: 'DEC_G1A',
    target: 'DEC_R2',
    semantic: 'rejection',
    style: 'dashed',
    direction: 'rtl',
  },
  F3f: {
    source: 'DEC_G1',
    target: 'DEC_G2',
    semantic: 'validation',
    style: 'medium',
    direction: 'ltr',
  },
  F3f_reject: {
    source: 'DEC_G1',
    target: 'DEC_R2',
    semantic: 'rejection',
    style: 'dashed',
    direction: 'rtl',
  },
  F3g: {
    source: 'DEC_K1',
    target: 'DEC_G2',
    semantic: 'validation',
    style: 'thin',
    direction: 'ltr',
  },
  F3h: {
    source: 'S2',
    target: 'DEC_G2',
    semantic: 'validation',
    style: 'thin',
    direction: 'ttb',
  },
  F3i: {
    source: 'VOI',
    target: 'DEC_G2',
    semantic: 'validation',
    style: 'thin',
    direction: 'ltr',
  },
  F_G2_reject: {
    source: 'DEC_G2',
    target: 'DEC_R2',
    semantic: 'rejection',
    style: 'dashed',
    direction: 'rtl',
  },
  F_T0_req: {
    source: 'DEC_R2',
    target: 'DEC_T0',
    semantic: 'tool-call',
    style: 'dotted',
    direction: 'btt',
  },
  F_T1: {
    source: 'DEC_T0',
    target: 'S1',
    semantic: 'tool-call',
    style: 'dotted',
    direction: 'btt',
  },
  F_T2: {
    source: 'DEC_T0',
    target: 'DEC_K1',
    semantic: 'tool-call',
    style: 'dotted',
    direction: 'rtl',
  },
  F_T0_obs: {
    source: 'DEC_T0',
    target: 'DEC_G0',
    semantic: 'retrieval',
    style: 'medium',
    direction: 'rtl',
  },
  F4: {
    source: 'DEC_G2',
    target: 'DEC_H1',
    semantic: 'validation',
    style: 'medium',
    direction: 'rtl',
  },
  F_H1_revalidate: {
    source: 'DEC_H1',
    target: 'DEC_G2',
    semantic: 'validation',
    style: 'dashed',
    direction: 'ltr',
  },
  F_H1_reject: {
    source: 'DEC_H1',
    target: 'DEC_R2',
    semantic: 'rejection',
    style: 'dashed',
    direction: 'btt',
  },
  F_H1_pass: {
    source: 'DEC_H1',
    target: 'ACT1',
    semantic: 'validation',
    style: 'medium',
    direction: 'ttb',
  },
  F_M1_G0: {
    source: 'DEC_G0',
    target: 'DEC_M1',
    semantic: 'audit',
    style: 'thin',
    direction: 'ltr',
    optional: true,
  },
  F_M1_R0: {
    source: 'DEC_R0',
    target: 'DEC_M1',
    semantic: 'audit',
    style: 'thin',
    direction: 'ltr',
    optional: true,
  },
  F_M1_T0: {
    source: 'DEC_T0',
    target: 'DEC_M1',
    semantic: 'audit',
    style: 'thin',
    direction: 'ltr',
    optional: true,
  },
  F_M1_G1A: {
    source: 'DEC_G1A',
    target: 'DEC_M1',
    semantic: 'audit',
    style: 'thin',
    direction: 'ltr',
    optional: true,
  },
  F_M1_H1: {
    source: 'DEC_H1',
    target: 'DEC_M1',
    semantic: 'audit',
    style: 'thin',
    direction: 'ltr',
    optional: true,
  },
  F_M1_out: {
    source: 'DEC_M1',
    target: 'ACT3',
    semantic: 'audit',
    style: 'thin',
    direction: 'ttb',
  },
  F_KPI: {
    source: 'S2',
    target: 'ACT2',
    semantic: 'kpi',
    style: 'thin',
    direction: 'ttb',
  },
  F_AUDIT: {
    source: 'ACT1',
    target: 'ACT3',
    semantic: 'audit',
    style: 'thin',
    direction: 'ltr',
  },
  F5: {
    source: 'ACT1',
    target: 'VOI',
    semantic: 'writeback',
    style: 'bold',
    direction: 'rtl',
  },
  F6: {
    source: 'VOI',
    target: 'A3',
    semantic: 'writeback',
    style: 'bold',
    direction: 'ltr',
  },
  F_VoR_ACK: {
    source: 'VOI',
    target: 'ACT1',
    semantic: 'status-ack',
    style: 'dashed',
    direction: 'rtl',
  },
  F_CPC_INT: {
    source: 'A3',
    target: 'A1',
    semantic: 'writeback',
    style: 'medium',
    direction: 'ttb',
    optional: true,
  },
  F7a: {
    source: 'ACT2',
    target: 'C1',
    semantic: 'kpi',
    style: 'thin',
    direction: 'ltr',
  },
  F7b: {
    source: 'C1',
    target: 'C2',
    semantic: 'kpi',
    style: 'thin',
    direction: 'ltr',
  },
  F7_sub: {
    source: 'C2',
    target: 'C1',
    semantic: 'subscription',
    style: 'dotted',
    direction: 'rtl',
    optional: true,
  },
  PB_F1: {
    source: 'PB1',
    target: 'PB2',
    semantic: 'sequence',
    style: 'medium',
    direction: 'ltr',
  },
  PB_F2: {
    source: 'PB2',
    target: 'PB3',
    semantic: 'sequence',
    style: 'medium',
    direction: 'ltr',
  },
  PB_F3: {
    source: 'PB3',
    target: 'PB4',
    semantic: 'sequence',
    style: 'medium',
    direction: 'ltr',
  },
  PB_F4: {
    source: 'PB4',
    target: 'PB5',
    semantic: 'sequence',
    style: 'medium',
    direction: 'ltr',
  },
  PB_ACK: {
    source: 'PB5',
    target: 'PB_AEA',
    semantic: 'status-ack',
    style: 'dashed',
    direction: 'rtl',
  },
  PB_REJECT: {
    source: 'PB4',
    target: 'PB_REJECT_OUT',
    semantic: 'rejection',
    style: 'dashed',
    direction: 'ttb',
  },
}

const canonicalEdgeStepRules: Record<string, readonly string[]> = {
  F5: ['PB1', 'PB2', 'PB3', 'PB4', 'PB5'],
  F6: ['PB5'],
  F_VoR_ACK: ['PB5'],
  F_AUDIT: ['PB5'],
  PB_ACK: ['PB5'],
  PB_REJECT: ['PB4'],
  F3f_reject: ['PB4'],
}

/**
 * Edges allowed to target DEC_R2 (LLM Agent / Planner).
 * F_G0_out is the sole context ingress; the others are rejection feedback loops.
 */
const allowedPlannerInboundEdges = new Set([
  'F_G0_out',
  'F_G1A_reject',
  'F3f_reject',
  'F_G2_reject',
  'F_H1_reject',
])

const canonicalInteractionRuleRequirements: Record<
  (typeof requiredInteractionRuleIds)[number],
  {
    triggerIds?: readonly string[]
    relatedNodeIds?: readonly string[]
    relatedEdgeIds?: readonly string[]
    relatedStepIds?: readonly string[]
    focusPath?: GraphManifest['interactionRules'][number]['focusPath']
  }
> = {
  RULE_VOR_CHAIN: {
    triggerIds: ['edge:F5', 'node:ACT1', 'node:VOI'],
    relatedNodeIds: ['node:DEC_H1'],
    relatedEdgeIds: [
      'edge:F4',
      'edge:F_H1_revalidate',
      'edge:F_H1_reject',
      'edge:F_H1_pass',
      'edge:F5',
      'edge:F6',
      'edge:F_VoR_ACK',
      'edge:F_AUDIT',
    ],
    relatedStepIds: ['step:PB1', 'step:PB2', 'step:PB3', 'step:PB4', 'step:PB5'],
    focusPath: 'write',
  },
  RULE_VOR_EXECUTION: {
    triggerIds: ['edge:F6', 'node:A3'],
    relatedEdgeIds: ['edge:F6', 'edge:PB_ACK'],
    relatedStepIds: ['step:PB5'],
    focusPath: 'write',
  },
  RULE_VOR_ACK: {
    triggerIds: ['edge:F_VoR_ACK'],
    relatedNodeIds: ['node:VOI', 'node:ACT1'],
    relatedEdgeIds: ['edge:F_VoR_ACK', 'edge:PB_ACK'],
    relatedStepIds: ['step:PB5'],
    focusPath: 'write',
  },
  RULE_VOR_REJECT: {
    triggerIds: ['edge:PB_REJECT'],
    relatedNodeIds: ['node:ACT1', 'node:VOI', 'node:DEC_G1'],
    relatedEdgeIds: ['edge:PB_REJECT', 'edge:F3f_reject'],
    relatedStepIds: ['step:PB4'],
    focusPath: 'write',
  },
  RULE_GUARDRAIL_LAYER: {
    triggerIds: [
      'node:DEC_G0',
      'node:DEC_R0',
      'node:DEC_T0',
      'node:DEC_G1A',
      'node:DEC_G2',
      'node:DEC_H1',
      'node:DEC_M1',
    ],
    relatedNodeIds: [
      'node:DEC_K2',
      'node:DEC_G0',
      'node:DEC_R0',
      'node:DEC_R2',
      'node:DEC_T0',
      'node:DEC_G1A',
      'node:DEC_G2',
      'node:DEC_H1',
      'node:DEC_M1',
      'node:ACT3',
    ],
    relatedEdgeIds: [
      'edge:F_G0_pol',
      'edge:F_G0_out',
      'edge:F_R0_out',
      'edge:F_T0_req',
      'edge:F_T0_obs',
      'edge:F_G1A_pass',
      'edge:F_G1A_reject',
      'edge:F_G2_reject',
      'edge:F_H1_revalidate',
      'edge:F_H1_reject',
      'edge:F_H1_pass',
      'edge:F_M1_G0',
      'edge:F_M1_R0',
      'edge:F_M1_T0',
      'edge:F_M1_G1A',
      'edge:F_M1_H1',
      'edge:F_M1_out',
    ],
    relatedStepIds: [],
    focusPath: 'policy',
  },
}

export interface ValidationIssue {
  code: string
  message: string
}

function validateSolePlannerIngress(manifest: GraphManifest): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const edge of manifest.edges) {
    if (edge.target === 'DEC_R2' && !allowedPlannerInboundEdges.has(edge.id)) {
      issues.push({
        code: 'unauthorized-planner-ingress',
        message: `${edge.id} targets DEC_R2 but is not in the allowed planner inbound set (${[...allowedPlannerInboundEdges].join(', ')})`,
      })
    }
  }
  return issues
}

function validateClaimCoverage(manifest: GraphManifest): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const claimIds = Object.keys(manifest.claims) as Array<keyof typeof manifest.claims>
  for (const claimId of claimIds) {
    const onNode = manifest.nodes.some((node) => node.claimIds.includes(claimId))
    if (!onNode) {
      issues.push({
        code: 'orphaned-claim-node',
        message: `Claim ${claimId} is not referenced by any node`,
      })
    }
    const onEdge = manifest.edges.some((edge) => edge.claimIds.includes(claimId))
    if (!onEdge) {
      issues.push({
        code: 'orphaned-claim-edge',
        message: `Claim ${claimId} is not referenced by any edge`,
      })
    }
  }
  return issues
}

function validateStandardCoverage(manifest: GraphManifest): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const standardId of Object.keys(manifest.standards)) {
    const onNode = manifest.nodes.some((node) => node.standardIds.includes(standardId))
    const onEdge = manifest.edges.some((edge) => edge.standardIds.includes(standardId))
    if (!onNode && !onEdge) {
      issues.push({
        code: 'orphaned-standard',
        message: `Standard ${standardId} is not referenced by any node or edge`,
      })
    }
  }
  return issues
}

function validateStructuralNodeLayoutSync(manifest: GraphManifest): ValidationIssue[] {
  const expectedStructuralSizes = {
    LANE_A: {
      width: manifest.layoutDefaults.lanes.A.width,
      height: manifest.layoutDefaults.lanes.A.height,
    },
    LANE_B: {
      width: manifest.layoutDefaults.lanes.B.width,
      height: manifest.layoutDefaults.lanes.B.height,
    },
    LANE_C: {
      width: manifest.layoutDefaults.lanes.C.width,
      height: manifest.layoutDefaults.lanes.C.height,
    },
    GW: {
      width: manifest.layoutDefaults.gateway.width,
      height: manifest.layoutDefaults.gateway.height,
    },
    AEA: {
      width: manifest.layoutDefaults.aea.width,
      height: manifest.layoutDefaults.aea.height,
    },
    BAND_SENSE: {
      width: manifest.layoutDefaults.aea.width - 56,
      height: manifest.layoutDefaults.aea.bandHeights.Sense,
    },
    BAND_DECIDE: {
      width: manifest.layoutDefaults.aea.width - 56,
      height: manifest.layoutDefaults.aea.bandHeights.Decide,
    },
    BAND_ACT: {
      width: manifest.layoutDefaults.aea.width - 56,
      height: manifest.layoutDefaults.aea.bandHeights.Act,
    },
  } satisfies Record<string, Pick<NodeSpec, 'width' | 'height'>>

  const issues: ValidationIssue[] = []

  for (const [nodeId, expected] of Object.entries(expectedStructuralSizes)) {
    const node = manifest.nodes.find((candidate) => candidate.id === nodeId)
    if (!node) {
      continue
    }

    for (const dimension of ['width', 'height'] as const) {
      if (node[dimension] !== expected[dimension]) {
        issues.push({
          code: `invalid-structural-node-${dimension}`,
          message: `${nodeId} must use ${dimension}=${expected[dimension]} to stay synchronized with layoutDefaults (found ${node[dimension]})`,
        })
      }
    }
  }

  return issues
}

function validateEntityReference(
  entityKey: string,
  nodeIds: Set<string>,
  edgeIds: Set<string>,
  stepIds: Set<string>,
): ValidationIssue | undefined {
  const [kind, ...rest] = entityKey.split(':')
  const id = rest.join(':')

  if (!id) {
    return {
      code: 'invalid-entity-reference',
      message: `Entity reference ${entityKey} is missing an identifier`,
    }
  }

  if (kind === 'node') {
    return nodeIds.has(id)
      ? undefined
      : { code: 'missing-interaction-node', message: `${entityKey} does not resolve to a node` }
  }

  if (kind === 'edge') {
    return edgeIds.has(id)
      ? undefined
      : { code: 'missing-interaction-edge', message: `${entityKey} does not resolve to an edge` }
  }

  if (kind === 'step') {
    return stepIds.has(id)
      ? undefined
      : { code: 'missing-interaction-step', message: `${entityKey} does not resolve to a step` }
  }

  return {
    code: 'invalid-entity-reference',
    message: `Entity reference ${entityKey} must start with node:, edge:, or step:`,
  }
}

function validateCanonicalEdge(edge: EdgeSpec): ValidationIssue[] {
  const expected = canonicalEdgeRules[edge.id as keyof typeof canonicalEdgeRules]
  if (!expected) {
    return []
  }

  const issues: ValidationIssue[] = []

  for (const key of ['source', 'target', 'semantic', 'style', 'direction'] as const) {
    if (edge[key] !== expected[key]) {
      issues.push({
        code: `invalid-edge-${key}`,
        message: `${edge.id} must use ${key}=${expected[key]} (found ${edge[key]})`,
      })
    }
  }

  for (const marker of expected.markers ?? []) {
    if (!edge.markers.includes(marker)) {
      issues.push({
        code: 'missing-edge-marker',
        message: `${edge.id} must include marker ${marker}`,
      })
    }
  }

  if (typeof expected.optional === 'boolean' && edge.interactive.optional !== expected.optional) {
    issues.push({
      code: 'invalid-edge-optional',
      message: `${edge.id} must use interactive.optional=${expected.optional}`,
    })
  }

  return issues
}

function validateCanonicalNode(node: NodeSpec): ValidationIssue[] {
  const expected = canonicalNodeRules[node.id]
  if (!expected) {
    return []
  }

  const issues: ValidationIssue[] = []

  for (const key of ['kind', 'nodeType', 'title', 'subtitle', 'parentId', 'lane', 'band'] as const) {
    if (expected[key] !== undefined && node[key] !== expected[key]) {
      issues.push({
        code: `invalid-node-${key}`,
        message: `${node.id} must use ${key}=${expected[key]} (found ${node[key] ?? 'undefined'})`,
      })
    }
  }

  for (const forbiddenAlias of expected.forbiddenAliases ?? []) {
    if (node.aliases.includes(forbiddenAlias)) {
      issues.push({
        code: 'invalid-node-alias',
        message: `${node.id} must not include alias ${forbiddenAlias}`,
      })
    }
  }

  return issues
}

function validateSetMembership(
  actualValues: readonly string[],
  requiredValues: readonly string[],
  context: string,
  issueCode: string,
): ValidationIssue[] {
  return requiredValues
    .filter((value) => !actualValues.includes(value))
    .map((value) => ({
      code: issueCode,
      message: `${context} must include ${value}`,
    }))
}

export function validateGraphManifest(manifest: GraphManifest): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const nodeIds = new Set<string>()
  const edgeIds = new Set<string>()
  const stepIds = new Set<string>()

  for (const node of manifest.nodes) {
    if (nodeIds.has(node.id)) {
      issues.push({ code: 'duplicate-node-id', message: `Duplicate node id ${node.id}` })
    }
    nodeIds.add(node.id)
    issues.push(...validateCanonicalNode(node))
  }

  issues.push(...validateStructuralNodeLayoutSync(manifest))
  issues.push(...validateSolePlannerIngress(manifest))
  issues.push(...validateClaimCoverage(manifest))
  issues.push(...validateStandardCoverage(manifest))

  for (const edge of manifest.edges) {
    if (edgeIds.has(edge.id)) {
      issues.push({ code: 'duplicate-edge-id', message: `Duplicate edge id ${edge.id}` })
    }
    edgeIds.add(edge.id)

    if (!nodeIds.has(edge.source) && !requiredStepIds.includes(edge.source as (typeof requiredStepIds)[number])) {
      issues.push({ code: 'missing-edge-source', message: `${edge.id} source ${edge.source} does not resolve` })
    }

    if (!nodeIds.has(edge.target) && !requiredStepIds.includes(edge.target as (typeof requiredStepIds)[number])) {
      issues.push({ code: 'missing-edge-target', message: `${edge.id} target ${edge.target} does not resolve` })
    }

    for (const relatedStepId of edge.interactive.relatedStepIds) {
      if (!stepIds.has(relatedStepId) && !manifest.steps.some((step) => step.id === relatedStepId)) {
        issues.push({
          code: 'missing-edge-step-link',
          message: `${edge.id} related step ${relatedStepId} does not resolve`,
        })
      }
    }

    issues.push(...validateCanonicalEdge(edge))
  }

  for (const step of manifest.steps) {
    if (stepIds.has(step.id)) {
      issues.push({ code: 'duplicate-step-id', message: `Duplicate step id ${step.id}` })
    }
    stepIds.add(step.id)

    for (const linkedNodeId of step.linkedNodeIds) {
      if (!nodeIds.has(linkedNodeId)) {
        issues.push({
          code: 'missing-step-node-link',
          message: `${step.id} linked node ${linkedNodeId} does not resolve`,
        })
      }
    }

    for (const linkedEdgeId of step.linkedEdgeIds) {
      if (!edgeIds.has(linkedEdgeId) && !manifest.edges.some((edge) => edge.id === linkedEdgeId)) {
        issues.push({
          code: 'missing-step-edge-link',
          message: `${step.id} linked edge ${linkedEdgeId} does not resolve`,
        })
        continue
      }

      const edge = manifest.edges.find((item) => item.id === linkedEdgeId)
      if (!edge) {
        continue
      }

      const edgeTouchesStep = edge.source === step.id || edge.target === step.id
      const edgeMentionsStep = edge.interactive.relatedStepIds.includes(step.id)
      if (!edgeTouchesStep && !edgeMentionsStep) {
        issues.push({
          code: 'step-edge-mapping-mismatch',
          message: `${step.id} links ${linkedEdgeId}, but ${linkedEdgeId} does not reference ${step.id}`,
        })
      }
    }
  }

  for (const rule of manifest.interactionRules) {
    for (const entityKey of [
      ...rule.triggerIds,
      ...rule.relatedNodeIds,
      ...rule.relatedEdgeIds,
      ...rule.relatedStepIds,
    ]) {
      const issue = validateEntityReference(entityKey, nodeIds, edgeIds, stepIds)
      if (issue) {
        issues.push({
          code: issue.code,
          message: `${rule.id}: ${issue.message}`,
        })
      }
    }
  }

  for (const requiredId of requiredNodeIds) {
    if (!nodeIds.has(requiredId)) {
      issues.push({ code: 'missing-required-node', message: `Required node ${requiredId} is missing` })
    }
  }

  for (const requiredId of requiredEdgeIds) {
    if (!edgeIds.has(requiredId)) {
      issues.push({ code: 'missing-required-edge', message: `Required edge ${requiredId} is missing` })
    }
  }

  for (const requiredId of requiredStepIds) {
    if (!stepIds.has(requiredId)) {
      issues.push({ code: 'missing-required-step', message: `Required step ${requiredId} is missing` })
    }
  }

  for (const requiredId of requiredInteractionRuleIds) {
    const rule = manifest.interactionRules.find((candidate) => candidate.id === requiredId)
    if (!rule) {
      issues.push({
        code: 'missing-required-interaction-rule',
        message: `Required interaction rule ${requiredId} is missing`,
      })
      continue
    }

    const expected = canonicalInteractionRuleRequirements[requiredId]
    issues.push(
      ...validateSetMembership(
        rule.triggerIds,
        expected.triggerIds ?? [],
        `${rule.id} triggerIds`,
        'invalid-interaction-trigger',
      ),
      ...validateSetMembership(
        rule.relatedNodeIds,
        expected.relatedNodeIds ?? [],
        `${rule.id} relatedNodeIds`,
        'invalid-interaction-node',
      ),
      ...validateSetMembership(
        rule.relatedEdgeIds,
        expected.relatedEdgeIds ?? [],
        `${rule.id} relatedEdgeIds`,
        'invalid-interaction-edge',
      ),
      ...validateSetMembership(
        rule.relatedStepIds,
        expected.relatedStepIds ?? [],
        `${rule.id} relatedStepIds`,
        'invalid-interaction-step',
      ),
    )

    if (expected.focusPath && rule.focusPath !== expected.focusPath) {
      issues.push({
        code: 'invalid-interaction-focus-path',
        message: `${rule.id} must use focusPath=${expected.focusPath}`,
      })
    }
  }

  const stepOrders = [...manifest.steps]
    .sort((left, right) => left.order - right.order)
    .map((step) => step.order)
  const expectedOrders = manifest.steps.map((_, index) => index + 1)
  if (
    stepOrders.length !== new Set(stepOrders).size ||
    stepOrders.some((order, index) => order !== expectedOrders[index])
  ) {
    issues.push({
      code: 'invalid-step-ordering',
      message: 'Sequence steps must use unique, contiguous order values starting at 1',
    })
  }

  for (const terminalId of requiredSequenceTerminalIds) {
    const terminal = manifest.nodes.find((node) => node.id === terminalId)
    if (!terminal || !terminal.panel.includes('vor-sequence')) {
      issues.push({
        code: 'invalid-sequence-terminal',
        message: `${terminalId} must exist as a vor-sequence terminal node`,
      })
    }
  }

  const pbFlowEdges = manifest.edges
    .filter((edge) => edge.panel.includes('vor-sequence') && edge.semantic === 'sequence')
    .sort((left, right) => left.source.localeCompare(right.source))
  const orderedSteps = [...manifest.steps].sort((left, right) => left.order - right.order)

  if (pbFlowEdges.length !== Math.max(orderedSteps.length - 1, 0)) {
    issues.push({
      code: 'invalid-pb-flow-count',
      message: 'Panel B must include exactly one sequence edge between each consecutive step pair',
    })
  }

  for (let index = 0; index < orderedSteps.length - 1; index += 1) {
    const current = orderedSteps[index]
    const next = orderedSteps[index + 1]
    const sequenceEdge = manifest.edges.find(
      (edge) =>
        edge.panel.includes('vor-sequence') &&
        edge.semantic === 'sequence' &&
        edge.source === current.id &&
        edge.target === next.id,
    )

    if (!sequenceEdge) {
      issues.push({
        code: 'missing-sequence-edge',
        message: `Missing Panel B flow edge from ${current.id} to ${next.id}`,
      })
    }
  }

  const f5Edges = manifest.edges.filter((edge) => edge.id === 'F5')
  if (f5Edges.length !== 1 || f5Edges[0]?.style !== 'bold') {
    issues.push({
      code: 'invalid-f5-style',
      message: 'F5 must be the only bold write-back initiation edge',
    })
  }

  if (manifest.edges.some((edge) => edge.id !== 'F5' && edge.id !== 'F6' && edge.style === 'bold')) {
    issues.push({
      code: 'multiple-bold-edges',
      message: 'Only F5 and F6 may use the bold edge style',
    })
  }

  const f3h = manifest.edges.find((edge) => edge.id === 'F3h')
  const f3d = manifest.edges.find((edge) => edge.id === 'F3d')
  if (!f3h || !f3d || !f3h.tags.includes('t0') || !f3d.tags.includes('t0')) {
    issues.push({
      code: 'invalid-t0-pair',
      message: 'F3d and F3h must share the same t0 snapshot semantics',
    })
  }

  for (const [edgeId, requiredStepIdsForEdge] of Object.entries(canonicalEdgeStepRules)) {
    const edge = manifest.edges.find((candidate) => candidate.id === edgeId)
    if (!edge) {
      continue
    }

    const actualStepIds = [...edge.interactive.relatedStepIds].sort()
    const expectedStepIds = [...requiredStepIdsForEdge].sort()
    if (
      actualStepIds.length !== expectedStepIds.length ||
      actualStepIds.some((stepId, index) => stepId !== expectedStepIds[index])
    ) {
      issues.push({
        code: 'invalid-edge-step-correspondence',
        message: `${edge.id} must map to steps ${expectedStepIds.join(', ')} (found ${actualStepIds.join(', ') || 'none'})`,
      })
    }
  }

  return issues
}

export function assertValidGraphManifest(manifest: GraphManifest): GraphManifest {
  const issues = validateGraphManifest(manifest)

  if (issues.length > 0) {
    throw new Error(issues.map((issue) => `${issue.code}: ${issue.message}`).join('\n'))
  }

  return manifest
}
