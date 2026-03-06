import type { EdgeSpec, GraphManifest, SequenceStep } from '@/graph/spec/schema'

export function sortSequenceSteps(steps: readonly SequenceStep[]): SequenceStep[] {
  return [...steps].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
}

export function sortSequenceEdges(
  edges: readonly EdgeSpec[],
  manifest: Pick<GraphManifest, 'steps'>,
): EdgeSpec[] {
  const orderMap = new Map(sortSequenceSteps(manifest.steps).map((step) => [step.id, step.order]))
  const semanticRank: Record<EdgeSpec['semantic'], number> = {
    sequence: 0,
    'status-ack': 1,
    rejection: 2,
    writeback: 3,
    validation: 4,
    proposal: 5,
    retrieval: 6,
    normalization: 7,
    'policy-soft': 8,
    'policy-hard': 9,
    'tool-call': 10,
    subscription: 11,
    kpi: 12,
    audit: 13,
    'gateway-internal': 14,
    'read-only': 15,
  }

  const terminalOrder = (nodeId: string) => {
    if (nodeId === 'PB_AEA') {
      return 0
    }
    if (nodeId === 'PB_REJECT_OUT') {
      return Number.MAX_SAFE_INTEGER - 1
    }
    return Number.MAX_SAFE_INTEGER
  }

  return [...edges].sort((left, right) => {
    const leftSourceOrder = orderMap.get(left.source) ?? terminalOrder(left.source)
    const rightSourceOrder = orderMap.get(right.source) ?? terminalOrder(right.source)
    if (leftSourceOrder !== rightSourceOrder) {
      return leftSourceOrder - rightSourceOrder
    }

    const leftTargetOrder = orderMap.get(left.target) ?? terminalOrder(left.target)
    const rightTargetOrder = orderMap.get(right.target) ?? terminalOrder(right.target)
    if (leftTargetOrder !== rightTargetOrder) {
      return leftTargetOrder - rightTargetOrder
    }

    const leftSemanticRank = semanticRank[left.semantic] ?? Number.MAX_SAFE_INTEGER
    const rightSemanticRank = semanticRank[right.semantic] ?? Number.MAX_SAFE_INTEGER
    if (leftSemanticRank !== rightSemanticRank) {
      return leftSemanticRank - rightSemanticRank
    }

    return left.id.localeCompare(right.id)
  })
}
