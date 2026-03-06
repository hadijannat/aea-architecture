import type { NodeProps } from '@xyflow/react'

import type { DiagramFlowNode } from '@/graph/compile/toReactFlow'

import { BaseNodeCard } from './BaseNodeCard'

export default function PolicyNode(props: NodeProps<DiagramFlowNode>) {
  return <BaseNodeCard {...props} variant="policy" />
}
