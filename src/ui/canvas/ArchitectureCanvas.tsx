import { useEffect, useMemo, useRef, type RefObject } from 'react'
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
import {
  getSemanticMarkerGeometry,
  getSemanticMarkerRefX,
  getSemanticPresentation,
  semanticMarkerDimensions,
} from '@/graph/compile/semanticPresentation'
import { graphManifest, resolveGraphEdge, resolveGraphNode, resolveSequenceStep } from '@/graph/spec/manifest'
import type { ProjectionTheme } from '@/graph/spec/schema'
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

const architectureMarkerSemantics = [...new Set(graphManifest.edges.map((edge) => edge.semantic))]

function renderMarkerShape(marker: ReturnType<typeof getSemanticPresentation>['marker'], color: string) {
  const geometry = getSemanticMarkerGeometry(marker)

  if (geometry.element === 'circle') {
    return <circle cx={geometry.cx} cy={geometry.cy} r={geometry.r} fill={color} />
  }

  return (
    <path
      d={geometry.d}
      fill={geometry.fill === 'currentColor' ? color : geometry.fill}
      stroke={geometry.stroke === 'currentColor' ? color : undefined}
      strokeWidth={geometry.strokeWidth}
      strokeLinecap={geometry.strokeLinecap}
    />
  )
}

function ArchitectureEdgeMarkers() {
  return (
    <svg className="architecture-edge-markers" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        {architectureMarkerSemantics.map((semantic) => {
          const presentation = getSemanticPresentation(semantic)
          return (
            <marker
              key={semantic}
              id={`architecture-marker-${semantic}`}
              viewBox={semanticMarkerDimensions.viewBox}
              markerWidth={semanticMarkerDimensions.width}
              markerHeight={semanticMarkerDimensions.height}
              refX={getSemanticMarkerRefX(presentation.marker)}
              refY={semanticMarkerDimensions.refY}
              orient="auto"
              markerUnits="strokeWidth"
            >
              {renderMarkerShape(presentation.marker, presentation.stroke)}
            </marker>
          )
        })}
      </defs>
    </svg>
  )
}

function hasCustomViewport(viewport: DiagramStore['ui']['viewport']) {
  const defaults = graphManifest.layoutDefaults.viewport
  return (
    Math.abs(viewport.x - defaults.x) > 1 ||
    Math.abs(viewport.y - defaults.y) > 1 ||
    Math.abs(viewport.zoom - defaults.zoom) > 0.01
  )
}

function getNodeRect(node?: DiagramFlowNode) {
  if (!node) {
    return undefined
  }

  const width = node.width ?? node.data.spec.width
  const height = node.height ?? node.data.spec.height

  return {
    x: node.position.x,
    y: node.position.y,
    width,
    height,
  }
}

function OverviewWriteRibbon({
  nodes,
  viewport,
}: {
  nodes: DiagramFlowNode[]
  viewport: DiagramStore['ui']['viewport']
}) {
  const ribbon = useMemo(() => {
    const visibleNodes = new Map(nodes.filter((node) => !node.hidden).map((node) => [node.id, node]))
    const act = getNodeRect(visibleNodes.get('ACT1'))
    const gateway = getNodeRect(visibleNodes.get('VOI'))
    const cpc = getNodeRect(visibleNodes.get('A3'))
    const band = getNodeRect(visibleNodes.get('BAND_ACT'))

    if (!act || !gateway || !cpc || !band) {
      return undefined
    }

    const x1 = Math.min(act.x + act.width / 2, gateway.x + gateway.width / 2, cpc.x + cpc.width / 2) - 24
    const x2 = Math.max(act.x + act.width / 2, gateway.x + gateway.width / 2, cpc.x + cpc.width / 2) + 24
    const y = Math.max(band.y + band.height + 18, cpc.y + cpc.height + 18)

    return {
      left: x1 * viewport.zoom + viewport.x,
      top: y * viewport.zoom + viewport.y,
      width: (x2 - x1) * viewport.zoom,
    }
  }, [nodes, viewport.x, viewport.y, viewport.zoom])

  if (!ribbon) {
    return null
  }

  const ribbonVisible = viewport.zoom <= 1.105

  return (
    <div
      className={`architecture-canvas__write-ribbon${ribbonVisible ? '' : ' is-hidden'}`}
      data-write-ribbon
      data-write-ribbon-visible={ribbonVisible ? 'true' : 'false'}
      aria-hidden={!ribbonVisible}
      style={{
        left: `${ribbon.left}px`,
        top: `${ribbon.top}px`,
        width: `${ribbon.width}px`,
      }}
    >
      <span className="architecture-canvas__write-ribbon-title">VoR -&gt; Gateway -&gt; CPC</span>
      <span className="architecture-canvas__write-ribbon-detail">Exclusive actuation corridor</span>
    </div>
  )
}

export function AutoFocusSelection({
  containerRef,
  nodes,
  selectedNodeId,
}: {
  containerRef?: RefObject<HTMLDivElement | null>
  nodes: DiagramFlowNode[]
  selectedNodeId?: string
}) {
  const { fitView, getNodesBounds, getViewport } = useReactFlow()
  const previousSelectedNodeIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!selectedNodeId) {
      previousSelectedNodeIdRef.current = undefined
      return
    }

    if (selectedNodeId === previousSelectedNodeIdRef.current) {
      return
    }

    const targetNode = nodes.find((node) => node.id === selectedNodeId)
    if (!targetNode) {
      return
    }

    previousSelectedNodeIdRef.current = selectedNodeId

    const container = containerRef?.current
    const nodeBounds = getNodesBounds([targetNode.id])
    const targetBounds =
      nodeBounds.width > 0 && nodeBounds.height > 0
        ? nodeBounds
        : {
            x: targetNode.position.x,
            y: targetNode.position.y,
            width: targetNode.width ?? targetNode.data.spec.width,
            height: targetNode.height ?? targetNode.data.spec.height,
          }

    if (container && container.clientWidth > 0 && container.clientHeight > 0) {
      const viewport = getViewport()
      const visibleBounds = {
        left: -viewport.x / viewport.zoom,
        top: -viewport.y / viewport.zoom,
        right: (container.clientWidth - viewport.x) / viewport.zoom,
        bottom: (container.clientHeight - viewport.y) / viewport.zoom,
      }
      const paddingX = (visibleBounds.right - visibleBounds.left) * 0.12
      const paddingY = (visibleBounds.bottom - visibleBounds.top) * 0.12
      const comfortableBounds = {
        left: visibleBounds.left + paddingX,
        top: visibleBounds.top + paddingY,
        right: visibleBounds.right - paddingX,
        bottom: visibleBounds.bottom - paddingY,
      }

      const isAlreadyVisible =
        targetBounds.x >= comfortableBounds.left &&
        targetBounds.y >= comfortableBounds.top &&
        targetBounds.x + targetBounds.width <= comfortableBounds.right &&
        targetBounds.y + targetBounds.height <= comfortableBounds.bottom

      if (isAlreadyVisible) {
        return
      }
    }

    void fitView({
      nodes: [{ id: targetNode.id }],
      duration: 320,
      padding: 0.16,
      maxZoom: 1.48,
    })
  }, [containerRef, fitView, getNodesBounds, getViewport, nodes, selectedNodeId])

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
  theme: ProjectionTheme
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
  theme,
  layoutReady,
  onViewport,
  onClearSelection,
  onNodeDragStop,
  onResetLayout,
}: ArchitectureCanvasProps) {
  const activeSelectionLabel = useMemo(() => {
    if (ui.selectedNodeId) {
      return resolveGraphNode(ui.selectedNodeId)?.title ?? ui.selectedNodeId
    }
    if (ui.selectedEdgeId) {
      const edge = resolveGraphEdge(ui.selectedEdgeId)
      if (!edge) {
        return ui.selectedEdgeId
      }
      return `${edge.id} · ${edge.displayLabel ?? edge.label}`
    }
    if (ui.selectedStepId) {
      const step = resolveSequenceStep(ui.selectedStepId)
      if (!step) {
        return ui.selectedStepId
      }
      return `${step.id} · ${step.title}`
    }
    return undefined
  }, [ui.selectedEdgeId, ui.selectedNodeId, ui.selectedStepId])

  return (
    <div
      ref={containerRef}
      className={`architecture-canvas architecture-canvas--${theme}`}
      data-theme={theme}
      aria-label="Panel A architecture canvas"
    >
      <ArchitectureEdgeMarkers />
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
        elevateEdgesOnSelect
        preventScrolling={false}
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
        <AutoFocusSelection containerRef={containerRef} nodes={nodes} selectedNodeId={ui.selectedNodeId} />
        <Background color="var(--canvas-grid-color)" gap={24} size={1.2} />
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
            activeSelectionLabel={activeSelectionLabel}
          />
        </FlowPanel>
        <OverviewWriteRibbon nodes={nodes} viewport={ui.viewport} />
      </ReactFlow>
    </div>
  )
}
