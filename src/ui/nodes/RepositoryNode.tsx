import type { NodeProps } from '@xyflow/react'

import type { DiagramFlowNode } from '@/graph/compile/toReactFlow'

import { BaseNodeCard } from './BaseNodeCard'

export default function RepositoryNode(props: NodeProps<DiagramFlowNode>) {
  return <BaseNodeCard {...props} variant="repository" />
}
