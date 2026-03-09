import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import clsx from 'clsx'
import { useReactFlow, useViewport } from '@xyflow/react'

import { isStructuralNodeSpec } from '@/graph/compile/nodeVisuals'
import type { DiagramFlowEdge, DiagramFlowNode } from '@/graph/compile/toReactFlow'
import { graphManifest } from '@/graph/spec/manifest'
import type { Point } from '@/layout/board'
import { buildBoardGeometryFromNodes } from '@/layout/boardGeometry'
import { resolveLaneVisual } from '@/graph/compile/visualSystem'

import {
  deriveOverviewRegions,
  fitNodesToPreset,
  getFocusPresetAccessibleLabel,
} from './focusPresets'
import { SemanticLegend } from './SemanticLegend'

interface SemanticOverviewMapProps {
  containerRef?: RefObject<HTMLDivElement | null>
  nodes: DiagramFlowNode[]
  edges: DiagramFlowEdge[]
  activeSelectionLabel?: string
}

interface OverviewWriteRoute {
  id: string
  path: string
  points: Point[]
}

interface OverviewNodeDot {
  id: string
  x: number
  y: number
  accent: string
  selected: boolean
}

const { canvas } = graphManifest.layoutDefaults

export function SemanticOverviewMap({
  containerRef,
  nodes,
  edges,
  activeSelectionLabel,
}: SemanticOverviewMapProps) {
  const viewport = useViewport()
  const { fitView, setCenter } = useReactFlow()
  const [compactMode, setCompactMode] = useState(() => window.innerWidth < 900)
  const [open, setOpen] = useState(() => window.innerWidth >= 900)
  const [legendOpen, setLegendOpen] = useState(false)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [draggingViewport, setDraggingViewport] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 900px)')
    const syncMode = () => {
      setCompactMode(mediaQuery.matches)
      if (mediaQuery.matches) {
        setOpen(false)
      }
    }

    syncMode()
    mediaQuery.addEventListener('change', syncMode)
    return () => mediaQuery.removeEventListener('change', syncMode)
  }, [])

  useEffect(() => {
    const element = containerRef?.current
    if (!element) {
      return
    }

    const syncSize = () => {
      setContainerSize({
        width: element.clientWidth,
        height: element.clientHeight,
      })
    }

    syncSize()
    const observer = new ResizeObserver(syncSize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [containerRef])

  useEffect(() => {
    if (!draggingViewport) {
      return
    }

    function endDrag() {
      setDraggingViewport(false)
    }

    window.addEventListener('pointerup', endDrag)
    return () => window.removeEventListener('pointerup', endDrag)
  }, [draggingViewport])

  const selectionLabel = useMemo(() => {
    if (!activeSelectionLabel) {
      return 'Jump between gateway, write corridor, and central telemetry zones.'
    }

    return `Selection: ${activeSelectionLabel}`
  }, [activeSelectionLabel])

  const viewportRect = useMemo(() => {
    const { width, height } = containerSize
    if (width === 0 || height === 0 || viewport.zoom === 0) {
      return { x: 0, y: 0, width: 0, height: 0 }
    }

    return {
      x: -viewport.x / viewport.zoom,
      y: -viewport.y / viewport.zoom,
      width: width / viewport.zoom,
      height: height / viewport.zoom,
    }
  }, [containerSize, viewport.x, viewport.y, viewport.zoom])

  const boardGeometry = useMemo(() => buildBoardGeometryFromNodes(nodes, edges), [edges, nodes])
  const writeRoutes = (boardGeometry.writeRoutes ?? []) as OverviewWriteRoute[]

  const overviewRegions = useMemo(() => deriveOverviewRegions(nodes, writeRoutes), [nodes, writeRoutes])
  const nodesById = useMemo(() => new Map(nodes.filter((node) => !node.hidden).map((node) => [node.id, node])), [nodes])

  const bandRegions = useMemo(() => {
    return ['BAND_SENSE', 'BAND_DECIDE', 'BAND_ACT']
      .map((id) => nodesById.get(id))
      .filter((node): node is DiagramFlowNode => Boolean(node))
      .map((node) => ({
        id: node.id,
        x: node.position.x,
        y: node.position.y,
        width: node.width ?? node.data.spec.width,
        height: node.height ?? node.data.spec.height,
        accent: node.data.visual.bandAccent,
      }))
  }, [nodesById])

  const aeaRect = useMemo(() => {
    const node = nodesById.get('AEA')
    if (!node) {
      return undefined
    }

    return {
      x: node.position.x,
      y: node.position.y,
      width: node.width ?? node.data.spec.width,
      height: node.height ?? node.data.spec.height,
    }
  }, [nodesById])

  const overviewNodes = useMemo<OverviewNodeDot[]>(() => {
    return nodes
      .filter((node) => !node.hidden && !isStructuralNodeSpec(node.data.spec))
      .map((node) => {
        const width = node.width ?? node.data.spec.width
        const height = node.height ?? node.data.spec.height

        return {
          id: node.id,
          x: node.position.x + width / 2,
          y: node.position.y + height / 2,
          accent: node.data.visual.accent,
          selected: node.selected || node.data.selected,
        }
      })
  }, [nodes])

  function centerFromPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      return undefined
    }

    const clickX = ((event.clientX - rect.left) / rect.width) * canvas.width
    const clickY = ((event.clientY - rect.top) / rect.height) * canvas.height

    return { x: clickX, y: clickY }
  }

  function viewportHit(point?: { x: number; y: number }) {
    if (!point) {
      return false
    }

    return (
      point.x >= viewportRect.x &&
      point.x <= viewportRect.x + viewportRect.width &&
      point.y >= viewportRect.y &&
      point.y <= viewportRect.y + viewportRect.height
    )
  }

  function moveViewport(event: ReactPointerEvent<HTMLDivElement>) {
    const boardPoint = centerFromPointer(event)
    if (!boardPoint) {
      return
    }

    void setCenter(boardPoint.x, boardPoint.y, {
      zoom: viewport.zoom,
      duration: draggingViewport ? 0 : 260,
    })
  }

  function onMapPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const boardPoint = centerFromPointer(event)
    if (!boardPoint) {
      return
    }

    if (viewportHit(boardPoint)) {
      setDraggingViewport(true)
      moveViewport(event)
      return
    }

    moveViewport(event)
  }

  function onMapPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingViewport) {
      return
    }

    moveViewport(event)
  }

  if (!open) {
    return (
      <button
        type="button"
        className="semantic-overview semantic-overview--collapsed-button"
        data-overview-toggle
        aria-expanded={false}
        onClick={() => setOpen(true)}
      >
        <span className="semantic-overview__collapsed-icon" aria-hidden="true">
          ▣
        </span>
        <span className="semantic-overview__collapsed-arrow" aria-hidden="true">
          ↗
        </span>
      </button>
    )
  }

  return (
    <div className={clsx('semantic-overview', compactMode && 'is-compact')}>
      <div className="semantic-overview__header">
        <div className="semantic-overview__copy">
          <span className="semantic-overview__eyebrow">Canvas navigator</span>
          <strong>Zone map</strong>
          <p>{selectionLabel}</p>
        </div>
        <button
          type="button"
          className="chip semantic-overview__toggle"
          onClick={() => setOpen(false)}
          aria-expanded={open}
          data-overview-toggle
        >
          Collapse
        </button>
      </div>

      <div className="semantic-overview__body">
        <div
          className="semantic-overview__map-shell"
          role="img"
          aria-label="Semantic board overview map"
          onPointerDown={onMapPointerDown}
          onPointerMove={onMapPointerMove}
          data-overview-map
        >
          <svg className="semantic-overview__map" viewBox={`0 0 ${canvas.width} ${canvas.height}`} aria-hidden="true">
            {overviewRegions.map((region) => {
              const laneKey =
                region.accent === 'gateway' || region.accent === 'write'
                  ? 'B'
                  : region.accent === 'lane-a'
                    ? 'A'
                    : region.accent === 'lane-c'
                      ? 'C'
                      : 'B'
              const laneVisual = resolveLaneVisual({ lane: laneKey })
              return (
                <rect
                  key={region.id}
                  x={region.x}
                  y={region.y}
                  width={region.width}
                  height={region.height}
                  rx={region.accent === 'gateway' ? 24 : 18}
                  className={`semantic-overview__region semantic-overview__region--${region.accent}`}
                  fill={laneVisual?.fill}
                  stroke={laneVisual?.border}
                  data-overview-region-id={region.id}
                />
              )
            })}
            {bandRegions.map((region) => (
              <rect
                key={region.id}
                x={region.x}
                y={region.y}
                width={region.width}
                height={region.height}
                rx="18"
                className="semantic-overview__band"
                fill={region.accent}
                opacity="0.12"
              />
            ))}
            {aeaRect ? (
              <rect
                x={aeaRect.x}
                y={aeaRect.y}
                width={aeaRect.width}
                height={aeaRect.height}
                rx="24"
                className="semantic-overview__aea"
              />
            ) : null}
            {writeRoutes.map((route) => (
              <path
                key={route.id}
                d={route.path}
                className="semantic-overview__write-path"
                data-write-route-id={route.id}
                data-overview-write-arrow={route.id === 'F5' ? 'corridor' : undefined}
              />
            ))}
            {overviewNodes.map((node) => (
              <circle
                key={node.id}
                cx={node.x}
                cy={node.y}
                r={node.selected ? 10 : 7}
                className={clsx('semantic-overview__node-dot', node.selected && 'is-selected')}
                data-overview-node-id={node.id}
                data-overview-node-accent-id={node.id}
                fill={node.accent}
              />
            ))}
            <rect
              x={viewportRect.x}
              y={viewportRect.y}
              width={viewportRect.width}
              height={viewportRect.height}
              rx="18"
              className="semantic-overview__viewport"
            />
          </svg>

          {overviewRegions.map((region) => (
            <button
              key={region.id}
              type="button"
              className={clsx('semantic-overview__hotspot', `semantic-overview__hotspot--${region.accent}`)}
              style={{
                left: `${(region.x / canvas.width) * 100}%`,
                top: `${(region.y / canvas.height) * 100}%`,
                width: `${(region.width / canvas.width) * 100}%`,
                height: `${(region.height / canvas.height) * 100}%`,
              }}
              data-hotspot-id={region.id}
              aria-label={region.preset ? `Focus ${region.label}` : `Center ${region.label}`}
              onClick={(event) => {
                event.stopPropagation()
                if (region.preset) {
                  fitNodesToPreset(nodes, fitView, region.preset)
                  return
                }

                void setCenter(region.x + region.width / 2, region.y + region.height / 2, {
                  zoom: viewport.zoom,
                  duration: 260,
                })
              }}
            >
              {region.id === 'write' ? (
                <span className="semantic-overview__hotspot-label" aria-hidden="true">
                  Write corridor
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="semantic-overview__action-grid">
          <button
            type="button"
            className="chip semantic-overview__action semantic-overview__action--primary"
            data-focus-preset="overview"
            aria-label={getFocusPresetAccessibleLabel('overview')}
            onClick={() => fitNodesToPreset(nodes, fitView, 'overview')}
          >
            Full map
          </button>
          <button
            type="button"
            className="chip semantic-overview__action semantic-overview__action--jump"
            data-focus-preset="gateway"
            aria-label={getFocusPresetAccessibleLabel('gateway')}
            onClick={() => fitNodesToPreset(nodes, fitView, 'gateway')}
          >
            Gateway + AEA
          </button>
          <button
            type="button"
            className="chip semantic-overview__action semantic-overview__action--jump"
            data-focus-preset="lane-c"
            aria-label={getFocusPresetAccessibleLabel('lane-c')}
            onClick={() => fitNodesToPreset(nodes, fitView, 'lane-c')}
          >
            Central M+O
          </button>
          <button
            type="button"
            className="chip semantic-overview__action semantic-overview__action--jump"
            data-focus-preset="write"
            aria-label={getFocusPresetAccessibleLabel('write')}
            onClick={() => fitNodesToPreset(nodes, fitView, 'write')}
          >
            Write corridor
          </button>
          <button
            type="button"
            className="chip semantic-overview__action semantic-overview__action--ghost"
            data-focus-preset="guardrail"
            aria-label={getFocusPresetAccessibleLabel('guardrail')}
            onClick={() => fitNodesToPreset(nodes, fitView, 'guardrail')}
          >
            Guardrails
          </button>
          <button
            type="button"
            className={clsx(
              'chip semantic-overview__action semantic-overview__action--ghost semantic-overview__legend-toggle',
              legendOpen && 'is-active',
            )}
            aria-expanded={legendOpen}
            data-overview-legend-toggle
            onClick={() => setLegendOpen((current) => !current)}
          >
            {legendOpen ? 'Hide legend' : 'Expand legend'}
          </button>
        </div>
        {legendOpen ? (
          <div className="semantic-overview__legend-shell" data-overview-legend-panel>
            <SemanticLegend />
          </div>
        ) : null}
      </div>
    </div>
  )
}
