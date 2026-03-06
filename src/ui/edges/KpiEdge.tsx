import type { EdgeProps } from '@xyflow/react'

import type { DiagramFlowEdge } from '@/graph/compile/toReactFlow'

import { BaseSemanticEdge } from './BaseSemanticEdge'

export default function KpiEdge(props: EdgeProps<DiagramFlowEdge>) {
  return <BaseSemanticEdge {...props} />
}
