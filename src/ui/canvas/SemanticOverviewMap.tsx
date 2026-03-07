import { useEffect, useMemo, useState, type RefObject } from 'react'
import clsx from 'clsx'
import { useReactFlow, useViewport } from '@xyflow/react'

import type { DiagramFlowEdge, DiagramFlowNode } from '@/graph/compile/toReactFlow'
import { graphManifest } from '@/graph/spec/manifest'
import { buildBoardEdgeRoute, resolveBoardLabelPosition, type Point } from '@/layout/board'
import type { HandleId } from '@/layout/ports'

import {
  fitNodesToPreset,
  focusPresetOptions,
  overviewRegions,
} from './focusPresets'
import { SemanticLegend } from './SemanticLegend'

interface SemanticOverviewMapProps {
  containerRef?: RefObject<HTMLDivElement | null>
  nodes: DiagramFlowNode[]
  edges: DiagramFlowEdge[]
  activeSelection?: string
}

interface OverviewWriteRoute {
  id: string
  path: string
  points: Point[]
  label: Point
}

const writeEdgeIds = new Set(['F4', 'F5', 'F6', 'F_VoR_ACK'])
const { canvas, gateway } = graphManifest.layoutDefaults

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

function hotspotBounds(region: (typeof overviewRegions)[number]) {
  if (region.id === 'gateway') {
    return {
      x: gateway.x,
      y: region.y,
      width: gateway.width,
      height: region.height,
    }
  }

  return region
}

function buildArrowPolygon(points: Point[]) {
  const end = points[points.length - 1]
  const previous = points[points.length - 2]

  if (!end || !previous) {
    return ''
  }

  const dx = end.x - previous.x
  const dy = end.y - previous.y
  const length = Math.hypot(dx, dy)
  if (length === 0) {
    return ''
  }

  const unitX = dx / length
  const unitY = dy / length
  const size = 34
  const wing = 14
  const baseX = end.x - unitX * size
  const baseY = end.y - unitY * size
  const perpX = -unitY
  const perpY = unitX

  return [
    `${end.x},${end.y}`,
    `${baseX + perpX * wing},${baseY + perpY * wing}`,
    `${baseX - perpX * wing},${baseY - perpY * wing}`,
  ].join(' ')
}

export function SemanticOverviewMap({
  containerRef,
  nodes,
  edges,
  activeSelection,
}: SemanticOverviewMapProps) {
  const viewport = useViewport()
  const { fitView, setCenter } = useReactFlow()
  const [compactMode, setCompactMode] = useState(() => window.innerWidth < 900)
  const [open, setOpen] = useState(() => window.innerWidth >= 900)
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
    if (!activeSelection) {
      return 'Jump to a clean board region.'
    }

    return `Selection active: ${activeSelection}`
  }, [activeSelection])

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
      .filter((edge) => writeEdgeIds.has(edge.id) && !edge.hidden)
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
          label: resolveBoardLabelPosition(route.label),
        }
      })
      .filter((route): route is OverviewWriteRoute => Boolean(route))
  }, [edges, nodes])

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
          <span className="semantic-overview__eyebrow">Board overview</span>
          <strong>Map + presets</strong>
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
            {open ? 'Hide map' : 'Overview'}
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
                  />
                ))}
              <rect
                x={overviewRegions.find((region) => region.id === 'write')?.x ?? 0}
                y={overviewRegions.find((region) => region.id === 'write')?.y ?? 0}
                width={overviewRegions.find((region) => region.id === 'write')?.width ?? 0}
                height={overviewRegions.find((region) => region.id === 'write')?.height ?? 0}
                rx="36"
                className="semantic-overview__write-band"
              />
              {writeRoutes.map((route) => (
                <g key={route.id}>
                  <path d={route.path} className="semantic-overview__write-path" data-write-route-id={route.id} />
                  <polygon
                    points={buildArrowPolygon(route.points)}
                    className="semantic-overview__write-arrow"
                    data-write-arrow-id={route.id}
                  />
                  <circle cx={route.label.x} cy={route.label.y} r="14" className="semantic-overview__write-marker" />
                </g>
              ))}
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
              const hotspot = hotspotBounds(region)

              return (
                <button
                  key={region.id}
                  type="button"
                  className={clsx('semantic-overview__hotspot', `semantic-overview__hotspot--${region.accent}`)}
                  style={{
                    left: `${(hotspot.x / canvas.width) * 100}%`,
                    top: `${(hotspot.y / canvas.height) * 100}%`,
                    width: `${(hotspot.width / canvas.width) * 100}%`,
                    height: `${(hotspot.height / canvas.height) * 100}%`,
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
                onClick={() => fitNodesToPreset(nodes, fitView, option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <SemanticLegend />
        </div>
      ) : null}
    </div>
  )
}
