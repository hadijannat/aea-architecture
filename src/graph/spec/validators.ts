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
  'DEC_R1',
  'DEC_R2',
  'DEC_G1',
  'DEC_G2',
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
  'F3e',
  'F3f',
  'F3f_reject',
  'F3g',
  'F3h',
  'F3i',
  'F_T1',
  'F_T2',
  'F4',
  'F_KPI',
  'F_AUDIT',
  'F5',
  'F6',
  'F_VoR_ACK',
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
    direction: 'ttb',
  },
  F3a: {
    source: 'DEC_K1',
    target: 'DEC_R1',
    semantic: 'retrieval',
    style: 'thin',
    direction: 'ltr',
  },
  F3b: {
    source: 'DEC_K2',
    target: 'DEC_R1',
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
    target: 'DEC_R2',
    semantic: 'retrieval',
    style: 'medium',
    direction: 'ltr',
  },
  F3d: {
    source: 'S2',
    target: 'DEC_R2',
    semantic: 'retrieval',
    style: 'medium',
    direction: 'ttb',
  },
  F3e: {
    source: 'DEC_R2',
    target: 'DEC_G1',
    semantic: 'proposal',
    style: 'medium',
    direction: 'ltr',
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
  F_T1: {
    source: 'DEC_R2',
    target: 'S1',
    semantic: 'tool-call',
    style: 'dotted',
    direction: 'btt',
  },
  F_T2: {
    source: 'DEC_R2',
    target: 'DEC_K1',
    semantic: 'tool-call',
    style: 'dotted',
    direction: 'rtl',
  },
  F4: {
    source: 'DEC_G2',
    target: 'ACT1',
    semantic: 'validation',
    style: 'medium',
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
    style: 'medium',
    direction: 'ltr',
  },
  F_VoR_ACK: {
    source: 'VOI',
    target: 'ACT1',
    semantic: 'status-ack',
    style: 'dashed',
    direction: 'rtl',
  },
  F7a: {
    source: 'ACT2',
    target: 'C1',
    semantic: 'kpi',
    style: 'medium',
    direction: 'ltr',
  },
  F7b: {
    source: 'C1',
    target: 'C2',
    semantic: 'kpi',
    style: 'medium',
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
  PB_ACK: ['PB5'],
  PB_REJECT: ['PB4'],
  F3f_reject: ['PB4'],
}

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
    relatedEdgeIds: ['edge:F4', 'edge:F5', 'edge:F6', 'edge:F_VoR_ACK', 'edge:F_AUDIT'],
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
}

export interface ValidationIssue {
  code: string
  message: string
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

  if (manifest.edges.some((edge) => edge.id !== 'F5' && edge.style === 'bold')) {
    issues.push({
      code: 'multiple-bold-edges',
      message: 'Only F5 may use the bold edge style',
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
