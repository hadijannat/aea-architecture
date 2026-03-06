import type { NodeProps } from '@xyflow/react'

import type { DiagramFlowNode } from '@/graph/compile/toReactFlow'

import { BaseNodeCard } from './BaseNodeCard'

export default function BrokerNode(props: NodeProps<DiagramFlowNode>) {
  return <BaseNodeCard {...props} variant="broker" />
}
