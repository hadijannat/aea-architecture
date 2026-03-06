import type { NodeProps } from '@xyflow/react'

import { BaseNodeCard } from './BaseNodeCard'
import type { DiagramFlowNode } from '@/graph/compile/toReactFlow'

export default function LaneNode(props: NodeProps<DiagramFlowNode>) {
  return <BaseNodeCard {...props} variant="lane" />
}
