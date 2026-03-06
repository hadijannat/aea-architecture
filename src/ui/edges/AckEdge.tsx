import type { EdgeProps } from '@xyflow/react'

import type { DiagramFlowEdge } from '@/graph/compile/toReactFlow'

import { BaseSemanticEdge } from './BaseSemanticEdge'

export default function AckEdge(props: EdgeProps<DiagramFlowEdge>) {
  return <BaseSemanticEdge {...props} />
}
