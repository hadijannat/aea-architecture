import { useEffect, useMemo, useRef } from 'react'
import {
  Background,
  ControlButton,
  Controls,
  MiniMap,
  Panel as FlowPanel,
  ReactFlow,
  type FitViewOptions,
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

type FocusPreset = 'overview' | 'gateway' | 'write' | 'lane-c'

const focusPresetNodeIds: Record<FocusPreset, string[]> = {
  overview: [],
  gateway: ['G1', 'G2', 'G3', 'VOI', 'S1', 'S2', 'DEC_K1', 'DEC_K2', 'DEC_R1', 'DEC_R2', 'DEC_G1', 'DEC_G2', 'ACT1'],
  write: ['DEC_G1', 'DEC_G2', 'ACT1', 'VOI', 'A3'],
  'lane-c': ['ACT2', 'ACT3', 'C1', 'C2'],
}

const focusPresetOptions: Array<{ id: FocusPreset; label: string }> = [
  { id: 'gateway', label: 'Gateway + AEA' },
  { id: 'overview', label: 'Full map' },
  { id: 'write', label: 'Write path' },
  { id: 'lane-c', label: 'Lane C' },
]

function isStructuralNode(node: DiagramFlowNode) {
  const kind = node.data?.spec.kind
  return kind === 'lane' || kind === 'container' || kind === 'band'
}

function hasCustomViewport(viewport: DiagramStore['ui']['viewport']) {
  const defaults = graphManifest.layoutDefaults.viewport
  return (
    Math.abs(viewport.x - defaults.x) > 1 ||
    Math.abs(viewport.y - defaults.y) > 1 ||
    Math.abs(viewport.zoom - defaults.zoom) > 0.01
  )
}

function fitViewToPreset(
  nodes: DiagramFlowNode[],
  fitView: (options?: FitViewOptions) => Promise<boolean>,
  preset: FocusPreset,
) {
  const semanticNodes = nodes.filter((node) => !isStructuralNode(node) && !node.hidden)
  const targetNodes =
    preset === 'overview'
      ? semanticNodes
      : semanticNodes.filter((node) => focusPresetNodeIds[preset].includes(node.id))

  if (targetNodes.length === 0) {
    return
  }

  const presetPadding =
    preset === 'overview' ? 0.12 : preset === 'gateway' ? 0.04 : preset === 'write' ? 0.08 : 0.1
  const presetMaxZoom =
    preset === 'overview' ? 0.92 : preset === 'gateway' ? 1.32 : preset === 'write' ? 1.38 : 1.22

  void fitView({
    nodes: targetNodes.map((node) => ({ id: node.id })),
    duration: 280,
    padding: presetPadding,
    maxZoom: presetMaxZoom,
  })
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
      fitViewToPreset(nodes, fitView, 'gateway')
    }

    initializedRef.current = true
  }, [fitView, layoutReady, nodes, selectedNodeId, setViewport, viewport])

  return null
}

function CanvasHud({
  nodes,
  activeSelection,
}: {
  nodes: DiagramFlowNode[]
  activeSelection?: string
}) {
  const { fitView } = useReactFlow()

  const selectionLabel = useMemo(() => {
    if (!activeSelection) {
      return 'Use a focus preset to inspect the architecture at working scale.'
    }
    return `Selection active: ${activeSelection}`
  }, [activeSelection])

  return (
    <div className="canvas-hud">
      <div className="canvas-hud__copy">
        <span className="canvas-hud__eyebrow">Focus presets</span>
        <strong>Readable default working views</strong>
        <p>{selectionLabel}</p>
      </div>
      <div className="canvas-hud__actions">
        {focusPresetOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            className="chip"
            onClick={() => fitViewToPreset(nodes, fitView, option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

interface ArchitectureCanvasProps {
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
    <div className="architecture-canvas" aria-label="Panel A architecture canvas">
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
        <FlowPanel position="top-left">
          <CanvasHud
            nodes={nodes}
            activeSelection={ui.selectedNodeId ?? ui.selectedEdgeId ?? ui.selectedStepId}
          />
        </FlowPanel>
        <Background color="#dde3eb" gap={24} size={1.2} />
        <Controls showInteractive={false}>
          <ControlButton onClick={onResetLayout} title="Reset layout">
            R
          </ControlButton>
        </Controls>
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  )
}
