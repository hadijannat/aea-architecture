import React, { memo, useCallback, useMemo, type CSSProperties } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
} from '@xyflow/react'
import clsx from 'clsx'

import {
  edgeStrokeWidth,
  getSemanticPresentation,
  getSemanticStrokeDash,
} from '@/graph/compile/semanticPresentation'
import type { DiagramFlowEdge } from '@/graph/compile/toReactFlow'
import { edgeEntityKey } from '@/graph/spec/manifest'
import { resolveBoardLabelPosition } from '@/layout/board'
import { resolveSemanticVisual } from '@/graph/compile/visualSystem'

function bridgePath(
  bridge: NonNullable<NonNullable<DiagramFlowEdge['data']>['route']['bridges']>[number],
  radius = 7,
) {
  if (bridge.orientation === 'horizontal') {
    return `M ${bridge.x - radius} ${bridge.y} Q ${bridge.x} ${bridge.y - radius} ${bridge.x + radius} ${bridge.y}`
  }

  return `M ${bridge.x} ${bridge.y - radius} Q ${bridge.x + radius} ${bridge.y} ${bridge.x} ${bridge.y + radius}`
}

export const BaseSemanticEdge = memo(function BaseSemanticEdge({
  id,
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
}: EdgeProps<DiagramFlowEdge>) {
  void sourceX
  void sourceY
  void targetX
  void targetY

  const route = data?.route ?? null
  const edgePath = route?.path ?? ''
  const labelPosition = useMemo(() => route ? resolveBoardLabelPosition(route.label) : { x: 0, y: 0 }, [route])
  const edgePoints = useMemo(
    () => route?.points.map((point) => `${point.x},${point.y}`).join(' ') ?? '',
    [route],
  )

  const presentation = useMemo(() => data ? getSemanticPresentation(data.spec.semantic) : null, [data])
  const visual = useMemo(() => data ? resolveSemanticVisual(data.spec.semantic) : null, [data])

  const strokeWidth = useMemo(
    () => data && presentation ? edgeStrokeWidth(data.spec.style, data.spec.semantic, data.canvasLod) : 0,
    [data, presentation],
  )
  const effectiveStrokeWidth = useMemo(() => {
    if (!data) {
      return 0
    }

    if (data.dimmed) {
      return Math.max(strokeWidth * 0.7, 0.8)
    }

    if (data.supportive && !data.selected && !data.highlighted && !data.groupHighlighted) {
      return Math.max(strokeWidth * 0.82, 0.9)
    }

    return strokeWidth
  }, [data, strokeWidth])
  const strokeDasharray = useMemo(
    () => data ? getSemanticStrokeDash(data.spec.semantic, data.spec.style) : undefined,
    [data],
  )

  const haloStyle = useMemo<CSSProperties>(() => ({
    stroke: visual?.halo,
    strokeWidth: effectiveStrokeWidth + 2.4,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    vectorEffect: 'non-scaling-stroke',
  }), [effectiveStrokeWidth, visual?.halo])

  const strokeStyle = useMemo<CSSProperties>(() => ({
    stroke: presentation?.stroke,
    strokeWidth: effectiveStrokeWidth,
    strokeDasharray,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    vectorEffect: 'non-scaling-stroke',
  }), [effectiveStrokeWidth, presentation?.stroke, strokeDasharray])

  const groupStyle = useMemo(() => ({ '--semantic-stroke': presentation?.stroke } as CSSProperties), [presentation?.stroke])

  const labelStyle = useMemo(() => ({
    '--semantic-stroke': presentation?.stroke,
    '--semantic-chip-text': visual?.chipText,
    transform: `translate(-50%, -50%) translate(${labelPosition.x}px, ${labelPosition.y}px)`,
  } as CSSProperties), [presentation?.stroke, visual?.chipText, labelPosition.x, labelPosition.y])

  const handleMouseEnter = useCallback(() => {
    data?.callbacks.onHover(edgeEntityKey(id))
  }, [data, id])

  const handleMouseLeave = useCallback(() => {
    data?.callbacks.onHover(undefined)
  }, [data])

  const handleClick = useCallback(() => {
    data?.callbacks.onSelectEdge(id)
  }, [data, id])

  const handleLabelPointerDown = useCallback((event: React.PointerEvent) => {
    event.stopPropagation()
    data?.callbacks.onSelectEdge(id)
  }, [data, id])

  const handleLabelClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation()
    data?.callbacks.onSelectEdge(id)
  }, [data, id])

  if (!data || !route || !presentation || !visual) {
    return null
  }

  const isT0Edge = data.spec.tags.includes('t0')
  const labelMode = data.labelMode
  const displayLabel = data.spec.displayLabel ?? data.spec.label
  const usesCanonicalDetailLabel = labelMode === 'detail' && data.selected
  const labelText =
    usesCanonicalDetailLabel
      ? `${data.spec.id} · ${data.spec.label}${data.optional ? ' (optional)' : ''}`
      : labelMode === 'detail'
        ? `${data.spec.id} · ${displayLabel}${data.optional ? ' (optional)' : ''}`
        : displayLabel
  const labelDetailText = usesCanonicalDetailLabel ? data.spec.detail : undefined
  const labelVariant = usesCanonicalDetailLabel ? 'canonical' : 'compact'
  const showT0Badge = isT0Edge && labelMode !== 'hidden'
  const markerKind = data.spec.markers.includes('diode') ? 'diode' : presentation.marker
  const writePathActive =
    data.highlightGroup === 'write' &&
    (data.selected || data.highlighted || data.groupHighlighted)

  return (
    <g
      className={clsx(
        'semantic-edge',
        `semantic-edge--${data.spec.semantic}`,
        `semantic-edge-family--${presentation.family}`,
        data.optional && 'is-optional',
        data.selected && 'is-selected',
        data.highlighted && 'is-highlighted',
        data.groupHighlighted && 'is-group-highlighted',
        data.supportive && 'is-supportive',
        data.narrativeMatched && 'is-narrative-matched',
        writePathActive && 'is-write-path-active',
        data.dimmed && 'is-dimmed',
        data.sharedTagFocused && 'is-shared-tag-focused',
      )}
      data-edge-id={id}
      data-edge-optional={data.optional ? 'true' : 'false'}
      data-edge-semantic={data.spec.semantic}
      data-edge-family={presentation.family}
      data-edge-style={data.spec.style}
      data-edge-tag-t0={isT0Edge ? 'true' : 'false'}
      data-edge-shared-tag-focus={data.sharedTagFocused ? 'true' : 'false'}
      data-edge-supportive={data.supportive ? 'true' : 'false'}
      data-edge-narrative-matched={data.narrativeMatched ? 'true' : 'false'}
      data-edge-points={edgePoints}
      data-label-position={`${labelPosition.x},${labelPosition.y}`}
      style={groupStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <title>{data.ariaLabel}</title>
      <desc>{data.spec.inspector.rationale}</desc>
      <path d={edgePath} data-edge-id={id} data-edge-path={edgePath} fill="none" stroke="transparent" strokeWidth={12} />
      <BaseEdge
        path={edgePath}
        interactionWidth={12}
        style={haloStyle}
      />
      <BaseEdge
        path={edgePath}
        markerEnd={`url(#architecture-marker-${data.spec.semantic}-${markerKind})`}
        interactionWidth={12}
        style={strokeStyle}
      />
      {route.bridges?.map((bridge, index) => (
        <React.Fragment key={`${id}-bridge-${bridge.orientation}-${bridge.x}-${bridge.y}-${index}`}>
          <path d={bridgePath(bridge)} fill="none" style={haloStyle} />
          <path d={bridgePath(bridge)} fill="none" style={strokeStyle} />
        </React.Fragment>
      ))}
      {labelMode !== 'hidden' ? (
        <EdgeLabelRenderer>
          <button
            type="button"
            className={clsx(
              'edge-label',
              `edge-label--${data.spec.semantic}`,
              data.optional && 'is-optional',
              data.selected && 'is-selected',
              (data.highlighted || data.groupHighlighted) && 'is-highlighted',
              data.groupHighlighted && 'is-group-highlighted',
              data.supportive && 'is-supportive',
              data.dimmed && 'is-dimmed',
              data.sharedTagFocused && 'is-shared-tag-focused',
            )}
            aria-label={data.ariaLabel}
            data-edge-id={id}
            data-edge-family={presentation.family}
            data-edge-optional={data.optional ? 'true' : 'false'}
            data-edge-tag-t0={isT0Edge ? 'true' : 'false'}
            data-edge-shared-tag-focus={data.sharedTagFocused ? 'true' : 'false'}
            data-edge-label-mode={labelMode}
            data-edge-label-variant={labelVariant}
            style={labelStyle}
            onFocus={handleMouseEnter}
            onBlur={handleMouseLeave}
            onPointerDown={handleLabelPointerDown}
            onClick={handleLabelClick}
          >
            <span className="edge-label__body">
              <span className={clsx('edge-label__text', usesCanonicalDetailLabel && 'edge-label__text--primary')}>
                {labelText}
              </span>
              {labelDetailText ? <span className="edge-label__text edge-label__text--secondary">{labelDetailText}</span> : null}
            </span>
            {showT0Badge ? (
              <span className="edge-label__tag edge-label__tag--t0" data-edge-tag="t0" aria-hidden="true">
                T0
              </span>
            ) : null}
          </button>
        </EdgeLabelRenderer>
      ) : null}
    </g>
  )
})
