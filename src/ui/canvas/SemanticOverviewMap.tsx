import { useEffect, useMemo, useState, type RefObject } from 'react'
import clsx from 'clsx'
import { useReactFlow, useViewport } from '@xyflow/react'

import { isStructuralNodeSpec, resolveNodeVisual } from '@/graph/compile/nodeVisuals'
import type { DiagramFlowEdge, DiagramFlowNode } from '@/graph/compile/toReactFlow'
import { graphManifest } from '@/graph/spec/manifest'
import { buildBoardEdgeRoute, type Point } from '@/layout/board'
import type { HandleId } from '@/layout/ports'

import {
  deriveOverviewRegions,
  fitNodesToPreset,
  focusPresetOptions,
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

interface OverviewNodeRect {
  id: string
  x: number
  y: number
  width: number
  height: number
  fill: string
  border: string
  accent: string
  selected: boolean
}

const { canvas } = graphManifest.layoutDefaults

function isHandleId(value?: string | null): value is HandleId {
  return value === 'left' || value === 'right' || value === 'top' || value === 'bottom'
}

function nodeAnchor(node: DiagramFlowNode, handleId: HandleId): Point {
  const width = node.width ?? node.data.spec.width
  const height = node.height ?? node.data.spec.height

  switch (handleId) {
    case 'left':
      return { x: node.position.x, y: node.position.y + height / 2 }
    case 'right':
      return { x: node.position.x + width, y: node.position.y + height / 2 }
    case 'top':
      return { x: node.position.x + width / 2, y: node.position.y }
    case 'bottom':
      return { x: node.position.x + width / 2, y: node.position.y + height }
  }
}

function buildCorridorArrow(
  region?: { x: number; y: number; width: number; height: number },
  routes: OverviewWriteRoute[] = [],
) {
  if (!region) {
    return ''
  }

  const averageDeltaX = routes.reduce((total, route) => {
    const start = route.points[0]
    const end = route.points[route.points.length - 1]
    if (!start || !end) {
      return total
    }
    return total + (end.x - start.x)
  }, 0)

  const direction = averageDeltaX <= 0 ? -1 : 1
  const length = Math.max(64, Math.min(128, region.width * 0.18))
  const thickness = Math.max(14, Math.min(24, region.height * 0.14))
  const wing = Math.max(20, Math.min(34, length * 0.28))
  const tipX = direction < 0 ? region.x + region.width * 0.32 : region.x + region.width * 0.68
  const tipY = region.y + region.height - 28
  const baseX = tipX - direction * length
  const shaftX = tipX - direction * (length - wing)

  return [
    `${tipX},${tipY}`,
    `${shaftX},${tipY - wing}`,
    `${shaftX},${tipY - thickness / 2}`,
    `${baseX},${tipY - thickness / 2}`,
    `${baseX},${tipY + thickness / 2}`,
    `${shaftX},${tipY + thickness / 2}`,
    `${shaftX},${tipY + wing}`,
  ].join(' ')
}

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

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 900px)')
    const syncMode = () => {
      setCompactMode(mediaQuery.matches)
      if (!mediaQuery.matches) {
        setOpen(true)
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

  const selectionLabel = useMemo(() => {
    if (!activeSelectionLabel) {
      return 'Navigate the topology or jump to a corridor.'
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

  const writeRoutes = useMemo<OverviewWriteRoute[]>(() => {
    const nodesById = new Map(nodes.map((node) => [node.id, node]))

    return edges
      .filter((edge) => {
        const spec = edge.data?.spec
        if (edge.hidden || !spec) {
          return false
        }
        return spec.semantic === 'writeback' || spec.tags.includes('write-path')
      })
      .map((edge) => {
        if (!edge.data) {
          return undefined
        }

        const sourceNode = nodesById.get(edge.source)
        const targetNode = nodesById.get(edge.target)
        if (!sourceNode || !targetNode || !isHandleId(edge.sourceHandle) || !isHandleId(edge.targetHandle)) {
          return undefined
        }

        const route = buildBoardEdgeRoute(
          edge.data.spec,
          nodeAnchor(sourceNode, edge.sourceHandle),
          nodeAnchor(targetNode, edge.targetHandle),
        )

        return {
          id: edge.id,
          path: route.path,
          points: route.points,
        }
      })
      .filter((route): route is OverviewWriteRoute => Boolean(route))
  }, [edges, nodes])

  const overviewRegions = useMemo(() => deriveOverviewRegions(nodes, writeRoutes), [nodes, writeRoutes])
  const writeRegion = overviewRegions.find((region) => region.id === 'write')
  const corridorArrow = useMemo(() => buildCorridorArrow(writeRegion, writeRoutes), [writeRegion, writeRoutes])

  const overviewNodes = useMemo<OverviewNodeRect[]>(() => {
    return nodes
      .filter((node) => !node.hidden && !isStructuralNodeSpec(node.data.spec))
      .map((node) => {
        const visual = resolveNodeVisual(node.data.spec)
        const width = node.width ?? node.data.spec.width
        const height = node.height ?? node.data.spec.height

        return {
          id: node.id,
          x: node.position.x,
          y: node.position.y,
          width,
          height,
          fill: visual.fill,
          border: visual.border,
          accent: visual.accent,
          selected: node.selected || node.data.selected,
        }
      })
  }, [nodes])

  function onMapClick(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      return
    }

    const clickX = ((event.clientX - rect.left) / rect.width) * canvas.width
    const clickY = ((event.clientY - rect.top) / rect.height) * canvas.height
    void setCenter(clickX, clickY, {
      zoom: viewport.zoom,
      duration: 260,
    })
  }

  return (
    <div className={clsx('semantic-overview', compactMode && 'is-compact', !open && 'is-collapsed')}>
      <div className="semantic-overview__header">
        <div className="semantic-overview__copy">
          <span className="semantic-overview__eyebrow">Canvas navigator</span>
          <strong>Map + focus</strong>
          {(!compactMode || open) ? <p>{selectionLabel}</p> : null}
        </div>
        {compactMode ? (
          <button
            type="button"
            className="chip semantic-overview__toggle"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            data-overview-toggle
          >
            {open ? 'Hide map' : 'Show map'}
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="semantic-overview__body">
          <div
            className="semantic-overview__map-shell"
            role="img"
            aria-label="Semantic board overview map"
            onClick={onMapClick}
            data-overview-map
          >
            <svg className="semantic-overview__map" viewBox={`0 0 ${canvas.width} ${canvas.height}`} aria-hidden="true">
              {writeRegion ? (
                <rect
                  x={writeRegion.x}
                  y={writeRegion.y}
                  width={writeRegion.width}
                  height={writeRegion.height}
                  rx="36"
                  className="semantic-overview__write-band"
                  data-overview-region-id="write"
                />
              ) : null}
              {overviewRegions
                .filter((region) => region.accent !== 'write')
                .map((region) => (
                  <rect
                    key={region.id}
                    x={region.x}
                    y={region.y}
                    width={region.width}
                    height={region.height}
                    rx={region.accent === 'gateway' ? 28 : 22}
                    className={`semantic-overview__region semantic-overview__region--${region.accent}`}
                    data-overview-region-id={region.id}
                  />
                ))}
              {writeRoutes.map((route) => (
                <path
                  key={route.id}
                  d={route.path}
                  className="semantic-overview__write-path"
                  data-write-route-id={route.id}
                />
              ))}
              {overviewNodes.map((node) => (
                <g key={node.id}>
                  <rect
                    x={node.x}
                    y={node.y}
                    width={node.width}
                    height={node.height}
                    rx="18"
                    className={clsx('semantic-overview__node', node.selected && 'is-selected')}
                    data-overview-node-id={node.id}
                    fill={node.fill}
                    stroke={node.border}
                  />
                  <rect
                    x={node.x}
                    y={node.y}
                    width={node.width}
                    height={Math.max(20, Math.min(32, node.height * 0.18))}
                    rx="5"
                    className="semantic-overview__node-accent"
                    fill={node.accent}
                    data-overview-node-accent-id={node.id}
                  />
                </g>
              ))}
              {corridorArrow ? (
                <polygon
                  points={corridorArrow}
                  className="semantic-overview__write-arrow"
                  data-overview-write-arrow="corridor"
                />
              ) : null}
              <rect
                x={viewportRect.x}
                y={viewportRect.y}
                width={viewportRect.width}
                height={viewportRect.height}
                rx="24"
                className="semantic-overview__viewport"
              />
            </svg>

            {overviewRegions.map((region) => {
              return (
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
                />
              )
            })}
          </div>

          <div className="semantic-overview__preset-grid">
            {focusPresetOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className="chip"
                data-focus-preset={option.id}
                aria-label={getFocusPresetAccessibleLabel(option.id)}
                title={getFocusPresetAccessibleLabel(option.id)}
                onClick={() => fitNodesToPreset(nodes, fitView, option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={clsx('chip semantic-overview__legend-toggle', legendOpen && 'is-active')}
            aria-expanded={legendOpen}
            data-overview-legend-toggle
            onClick={() => setLegendOpen((current) => !current)}
          >
            {legendOpen ? 'Hide legend' : 'Show legend'}
          </button>
          {legendOpen ? (
            <div className="semantic-overview__legend-shell" data-overview-legend-panel>
              <SemanticLegend />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
