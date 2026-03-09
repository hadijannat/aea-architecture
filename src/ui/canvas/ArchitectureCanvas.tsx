import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react'
import {
  Background,
  ControlButton,
  Controls,
  Panel as FlowPanel,
  ReactFlow,
  ViewportPortal,
  useReactFlow,
  useViewport,
  type OnNodeDrag,
} from '@xyflow/react'

import type { DiagramFlowEdge, DiagramFlowNode } from '@/graph/compile/toReactFlow'
import {
  getSemanticFamilyLabel,
  getSemanticMarkerGeometry,
  getSemanticMarkerRefX,
  getSemanticMarkerTokens,
  getSemanticPresentation,
  semanticFamilyOrder,
} from '@/graph/compile/semanticPresentation'
import { graphManifest, resolveGraphEdge, resolveGraphNode, resolveSequenceStep } from '@/graph/spec/manifest'
import type { ProjectionTheme } from '@/graph/spec/schema'
import type { DiagramStore } from '@/state/diagramStore'
import { bandVisuals, laneVisuals, resolveSemanticVisual } from '@/graph/compile/visualSystem'
import { buildBoardGeometryFromNodes, clampRectToCanvas } from '@/layout/boardGeometry'

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

const architectureMarkerTokens = getSemanticMarkerTokens('architecture')

function resolveMarkerKind(edge: (typeof graphManifest.edges)[number]) {
  if (edge.markers.includes('diode')) {
    return 'diode'
  }

  return getSemanticPresentation(edge.semantic).marker
}

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
  const markerIds = [
    ...new Map(
      graphManifest.edges
        .filter((edge) => edge.panel.includes('architecture'))
        .map((edge) => {
          const marker = resolveMarkerKind(edge)
          return [`${edge.semantic}:${marker}`, { semantic: edge.semantic, marker }]
        }),
    ).values(),
  ]

  return (
    <svg className="architecture-edge-markers" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        {markerIds.map(({ semantic, marker }) => {
          const presentation = getSemanticPresentation(semantic)
          return (
            <marker
              key={`${semantic}-${marker}`}
              id={`architecture-marker-${semantic}-${marker}`}
              viewBox={architectureMarkerTokens.viewBox}
              markerWidth={architectureMarkerTokens.width}
              markerHeight={architectureMarkerTokens.height}
              refX={getSemanticMarkerRefX(marker)}
              refY={architectureMarkerTokens.refY}
              orient="auto"
              markerUnits={architectureMarkerTokens.units}
            >
              {renderMarkerShape(marker, presentation.stroke)}
            </marker>
          )
        })}
      </defs>
    </svg>
  )
}

function ArchitectureStructureOverlay({
  geometry,
}: {
  geometry: ReturnType<typeof buildBoardGeometryFromNodes>
}) {
  const laneRects = [geometry.lanes.A, geometry.lanes.B, geometry.lanes.C]
  const { aea, gateway, bands, horizontalDividers, routeGuideYs, verticalGuideXs, canvas } = geometry

  return (
    <div
      className="architecture-structure-overlay"
      aria-hidden="true"
      style={{
        left: `${canvas.x}px`,
        top: `${canvas.y}px`,
        width: `${canvas.width}px`,
        height: `${canvas.height}px`,
      }}
    >
      {laneRects.map((rect, index) => {
        const laneId = (['A', 'B', 'C'] as const)[index]
        return (
          <div
            key={`lane-strip-${laneId}`}
            className={`architecture-structure-overlay__lane-strip architecture-structure-overlay__lane-strip--${laneId}`}
            data-structure-lane={laneId}
            style={{
              left: `${rect.x}px`,
              top: `${rect.y}px`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
              '--lane-strip': laneVisuals[laneId].outerStrip,
            } as React.CSSProperties}
          />
        )
      })}
      <div
        className="architecture-structure-overlay__aea-moat"
        style={{
          left: `${aea.x}px`,
          top: `${aea.y}px`,
          width: `${aea.width}px`,
          height: `${aea.height}px`,
        }}
      />
      <div
        className="architecture-structure-overlay__gateway-column"
        style={{
          left: `${gateway.x}px`,
          top: `${gateway.y}px`,
          width: `${gateway.width}px`,
          height: `${gateway.height}px`,
        }}
      />
      {horizontalDividers.map((y) => (
        <div key={`line-${y}`} className="architecture-structure-overlay__divider" style={{ top: `${y}px` }} />
      ))}
      {routeGuideYs.map((y) => (
        <div
          key={`channel-y-${y}`}
          className="architecture-structure-overlay__route-guide architecture-structure-overlay__route-guide--horizontal"
          style={{
            left: `${aea.x + 16}px`,
            top: `${y}px`,
            width: `${aea.width - 32}px`,
          }}
        />
      ))}
      {verticalGuideXs.map((x) => (
        <div
          key={`channel-x-${x}`}
          className="architecture-structure-overlay__route-guide architecture-structure-overlay__route-guide--vertical"
          style={{
            left: `${x}px`,
            top: `${bands.Sense.y + 24}px`,
            height: `${bands.Act.y + bands.Act.height - bands.Sense.y - 48}px`,
          }}
        />
      ))}
      {[
        { rect: bands.Sense, label: bandVisuals.Sense.label, accent: bandVisuals.Sense.accent },
        { rect: bands.Decide, label: bandVisuals.Decide.label, accent: bandVisuals.Decide.accent },
        { rect: bands.Act, label: bandVisuals.Act.label, accent: bandVisuals.Act.accent },
      ].map(({ rect, label, accent }) => (
        <div
          key={label}
          className="architecture-structure-overlay__band-strip"
          data-band-strip={label}
          style={{
            left: `${rect.x + 16}px`,
            top: `${rect.y + 12}px`,
            width: `${rect.width - 32}px`,
            '--band-strip': accent,
          } as React.CSSProperties}
        >
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}

function CanvasLegendStrip() {
  const familyToSemantic = {
    context: 'read-only',
    policy: 'policy-hard',
    runtime: 'tool-call',
    write: 'writeback',
    feedback: 'rejection',
    telemetry: 'kpi',
    sequence: 'sequence',
  } as const

  return (
    <div className="architecture-canvas__legend-strip" aria-label="Compact semantic legend">
      {semanticFamilyOrder.map((family) => {
        const semantic = familyToSemantic[family]
        const visual = resolveSemanticVisual(semantic)
        return (
          <div key={family} className="architecture-canvas__legend-item" data-legend-family={family}>
            <span
              className="architecture-canvas__legend-swatch"
              style={{ '--legend-swatch': visual.stroke } as React.CSSProperties}
              aria-hidden="true"
            />
            <span>{getSemanticFamilyLabel(family)}</span>
          </div>
        )
      })}
    </div>
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

function OverviewWriteRibbon({
  geometry,
}: {
  geometry: ReturnType<typeof buildBoardGeometryFromNodes>
}) {
  const { zoom } = useViewport()
  const ribbon = useMemo(() => {
    const corridor = geometry.writeCorridorBounds
    if (!corridor) {
      return undefined
    }

    const desiredWidth = Math.max(252, Math.min(420, corridor.width + 92))
    const desiredHeight = 56
    const ribbonRect = clampRectToCanvas(
      {
        x: corridor.x + corridor.width / 2 - desiredWidth / 2,
        y: corridor.y + corridor.height + 18,
        width: desiredWidth,
        height: desiredHeight,
      },
      {
        ...geometry.canvas,
        height: Math.min(geometry.canvas.height, geometry.bands.Act.y + geometry.bands.Act.height + 44),
      },
      24,
    )

    return {
      left: ribbonRect.x,
      top: ribbonRect.y,
      width: ribbonRect.width,
    }
  }, [geometry])

  if (!ribbon) {
    return null
  }

  const ribbonVisible = zoom <= 1.105

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
  const boardGeometry = useMemo(() => buildBoardGeometryFromNodes(nodes, edges), [edges, nodes])
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

  const handleMoveEnd = useCallback((_event: unknown, viewport: DiagramStore['ui']['viewport']) => {
    onViewport(viewport)
  }, [onViewport])

  return (
    <div
      ref={containerRef}
      className={`architecture-canvas architecture-canvas--${theme}`}
      data-theme={theme}
      aria-label="Panel A architecture canvas"
    >
      <span className="architecture-canvas__panel-label">(A)</span>
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
        onMoveEnd={handleMoveEnd}
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
        <ViewportPortal>
          <ArchitectureStructureOverlay geometry={boardGeometry} />
          <OverviewWriteRibbon geometry={boardGeometry} />
        </ViewportPortal>
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
      </ReactFlow>
      <CanvasLegendStrip />
    </div>
  )
}
