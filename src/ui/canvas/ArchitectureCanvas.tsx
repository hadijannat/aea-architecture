import { useEffect, useRef, type RefObject } from 'react'
import {
  Background,
  ControlButton,
  Controls,
  Panel as FlowPanel,
  ReactFlow,
  useReactFlow,
  type OnNodeDrag,
} from '@xyflow/react'

import type { DiagramFlowEdge, DiagramFlowNode } from '@/graph/compile/toReactFlow'
import { graphManifest } from '@/graph/spec/manifest'
import type { DiagramStore } from '@/state/diagramStore'

import AckEdge from '@/ui/edges/AckEdge'
import KpiEdge from '@/ui/edges/KpiEdge'
import ReadEdge from '@/ui/edges/ReadEdge'
import ToolCallEdge from '@/ui/edges/ToolCallEdge'
import WriteBackEdge from '@/ui/edges/WriteBackEdge'
import AgentNode from '@/ui/nodes/AgentNode'
import AuditNode from '@/ui/nodes/AuditNode'
import BrokerNode from '@/ui/nodes/BrokerNode'
import ContainerNode from '@/ui/nodes/ContainerNode'
import GatewayInterfaceNode from '@/ui/nodes/GatewayInterfaceNode'
import GatewayModuleNode from '@/ui/nodes/GatewayModuleNode'
import LaneNode from '@/ui/nodes/LaneNode'
import PolicyNode from '@/ui/nodes/PolicyNode'
import PublisherNode from '@/ui/nodes/PublisherNode'
import RepositoryNode from '@/ui/nodes/RepositoryNode'
import SystemNode from '@/ui/nodes/SystemNode'

import { fitNodesToPreset } from './focusPresets'
import { SemanticOverviewMap } from './SemanticOverviewMap'

const nodeTypes = {
  AgentNode,
  AuditNode,
  BrokerNode,
  ContainerNode,
  GatewayInterfaceNode,
  GatewayModuleNode,
  LaneNode,
  PolicyNode,
  PublisherNode,
  RepositoryNode,
  SystemNode,
}

const edgeTypes = {
  AckEdge,
  KpiEdge,
  ReadEdge,
  ToolCallEdge,
  WriteBackEdge,
}

function hasCustomViewport(viewport: DiagramStore['ui']['viewport']) {
  const defaults = graphManifest.layoutDefaults.viewport
  return (
    Math.abs(viewport.x - defaults.x) > 1 ||
    Math.abs(viewport.y - defaults.y) > 1 ||
    Math.abs(viewport.zoom - defaults.zoom) > 0.01
  )
}

function AutoFocusSelection({
  nodes,
  selectedNodeId,
}: {
  nodes: DiagramFlowNode[]
  selectedNodeId?: string
}) {
  const { fitView } = useReactFlow()

  useEffect(() => {
    if (!selectedNodeId) {
      return
    }

    const targetNode = nodes.find((node) => node.id === selectedNodeId)
    if (!targetNode) {
      return
    }

    void fitView({
      nodes: [{ id: targetNode.id }],
      duration: 320,
      padding: 0.16,
      maxZoom: 1.48,
    })
  }, [fitView, nodes, selectedNodeId])

  return null
}

function ViewportCoordinator({
  nodes,
  layoutReady,
  selectedNodeId,
  viewport,
}: {
  nodes: DiagramFlowNode[]
  layoutReady: boolean
  selectedNodeId?: string
  viewport: DiagramStore['ui']['viewport']
}) {
  const initializedRef = useRef(false)
  const { fitView, setViewport } = useReactFlow()

  useEffect(() => {
    if (!layoutReady || initializedRef.current || nodes.length === 0 || selectedNodeId) {
      return
    }

    if (hasCustomViewport(viewport)) {
      void setViewport(viewport, { duration: 0 })
    } else {
      fitNodesToPreset(nodes, fitView, 'gateway')
    }

    initializedRef.current = true
  }, [fitView, layoutReady, nodes, selectedNodeId, setViewport, viewport])

  return null
}

interface ArchitectureCanvasProps {
  containerRef?: RefObject<HTMLDivElement | null>
  nodes: DiagramFlowNode[]
  edges: DiagramFlowEdge[]
  ui: DiagramStore['ui']
  layoutReady: boolean
  onViewport(viewport: DiagramStore['ui']['viewport']): void
  onClearSelection(): void
  onNodeDragStop: OnNodeDrag<DiagramFlowNode>
  onResetLayout(): void
}

export function ArchitectureCanvas({
  containerRef,
  nodes,
  edges,
  ui,
  layoutReady,
  onViewport,
  onClearSelection,
  onNodeDragStop,
  onResetLayout,
}: ArchitectureCanvasProps) {
  return (
    <div ref={containerRef} className="architecture-canvas" aria-label="Panel A architecture canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.45}
        maxZoom={1.55}
        nodesConnectable={false}
        elementsSelectable
        panOnDrag={!ui.viewportLocked}
        zoomOnScroll={!ui.viewportLocked}
        zoomOnPinch={!ui.viewportLocked}
        zoomOnDoubleClick={!ui.viewportLocked}
        onPaneClick={onClearSelection}
        onMoveEnd={(_, viewport) => onViewport(viewport)}
        onNodeDragStop={onNodeDragStop}
      >
        <ViewportCoordinator
          nodes={nodes}
          layoutReady={layoutReady}
          selectedNodeId={ui.selectedNodeId}
          viewport={ui.viewport}
        />
        <AutoFocusSelection nodes={nodes} selectedNodeId={ui.selectedNodeId} />
        <Background color="#dde3eb" gap={24} size={1.2} />
        <Controls showInteractive={false}>
          <ControlButton onClick={onResetLayout} title="Reset layout">
            R
          </ControlButton>
        </Controls>
        <FlowPanel position="bottom-right">
          <SemanticOverviewMap
            containerRef={containerRef}
            nodes={nodes}
            edges={edges}
            activeSelection={ui.selectedNodeId ?? ui.selectedEdgeId ?? ui.selectedStepId}
          />
        </FlowPanel>
      </ReactFlow>
    </div>
  )
}
