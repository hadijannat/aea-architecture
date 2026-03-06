import type { EdgeProps } from '@xyflow/react'

import type { DiagramFlowEdge } from '@/graph/compile/toReactFlow'

import { BaseSemanticEdge } from './BaseSemanticEdge'

export default function ReadEdge(props: EdgeProps<DiagramFlowEdge>) {
  return <BaseSemanticEdge {...props} />
}
