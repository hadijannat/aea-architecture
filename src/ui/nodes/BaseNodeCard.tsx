import {
  memo,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { Handle, Position, useViewport, type NodeProps } from '@xyflow/react'
import clsx from 'clsx'

import type { DiagramFlowNode } from '@/graph/compile/toReactFlow'
import { nodeEntityKey } from '@/graph/spec/manifest'
import type { ClaimId, NodeSpec } from '@/graph/spec/schema'
import { focusRingClassName } from '@/a11y/focus'
import { getHandleOffset, getHandlePosition, type HandleId } from '@/layout/ports'

function handleStyle(handleId: HandleId) {
  const position = getHandlePosition(handleId)
  const offset = getHandleOffset(handleId)
  const base = { opacity: 0, width: 10, height: 10 } satisfies CSSProperties

  if (position === Position.Left || position === Position.Right) {
    return {
      ...base,
      top: `calc(50% + ${offset}px)`,
    } satisfies CSSProperties
  }

  return {
    ...base,
    left: `calc(50% + ${offset}px)`,
  } satisfies CSSProperties
}

function NodeHandles({
  sourceHandleIds,
  targetHandleIds,
}: {
  sourceHandleIds: HandleId[]
  targetHandleIds: HandleId[]
}) {
  return (
    <>
      {sourceHandleIds.map((handleId) => (
        <Handle
          key={`source-${handleId}`}
          id={handleId}
          type="source"
          position={getHandlePosition(handleId)}
          isConnectable={false}
          style={handleStyle(handleId)}
        />
      ))}
      {targetHandleIds.map((handleId) => (
        <Handle
          key={`target-${handleId}`}
          id={handleId}
          type="target"
          position={getHandlePosition(handleId)}
          isConnectable={false}
          style={handleStyle(handleId)}
        />
      ))}
    </>
  )
}

function stopNodeClick(event: ReactMouseEvent | FocusEvent) {
  event.stopPropagation()
}

function resolveStructuralNarrative(spec: NodeSpec) {
  switch (spec.id) {
    case 'LANE_A':
      return 'OT boundary'
    case 'LANE_B':
      return 'AEA runtime layer'
    case 'LANE_C':
      return 'Cloud telemetry layer'
    case 'GW':
      return 'Boundary enforcement'
    case 'AEA':
      return 'Agent subsystem'
    case 'BAND_SENSE':
      return 'Read-only ingress'
    case 'BAND_DECIDE':
      return 'Guarded reasoning'
    case 'BAND_ACT':
      return 'Validated actuation'
    default:
      return undefined
  }
}

function structuralHeaderLabel(spec: NodeSpec) {
  if (spec.kind === 'band' && spec.band) {
    return spec.band
  }
  if (spec.id === 'GW') {
    return 'NE177 Gateway'
  }
  if (spec.id === 'AEA') {
    return 'AEA'
  }
  return spec.title
}

function KindGlyph({
  path,
  viewBox,
  label,
  className,
}: {
  path: string
  viewBox: string
  label: string
  className?: string
}) {
  return (
    <svg className={clsx('node-card__glyph', className)} viewBox={viewBox} aria-hidden="true" focusable="false">
      <title>{label}</title>
      <path d={path} />
    </svg>
  )
}

function ClaimDots({
  nodeTitle,
  claimDots,
  claims,
  onBadgeClaim,
}: {
  nodeTitle: string
  claimDots: string[]
  claims: NonNullable<DiagramFlowNode['data']['claims']>
  onBadgeClaim(id: ClaimId): void
}) {
  if (claims.length === 0) {
    return null
  }

  return (
    <div className="node-card__claim-dots" aria-label={`Claims for ${nodeTitle}`}>
      {claims.map((claim, index) => (
        <button
          key={claim.id}
          type="button"
          className="node-card__claim-dot"
          title={`${claim.id} · ${claim.label}`}
          style={{ '--claim-dot': claimDots[index] } as CSSProperties}
          onClick={(event) => {
            event.stopPropagation()
            onBadgeClaim(claim.id)
          }}
        >
          <span className="node-card__claim-dot-core" aria-hidden="true" />
          <span className="node-card__claim-dot-label">{claim.id}</span>
        </button>
      ))}
    </div>
  )
}

export const BaseNodeCard = memo(function BaseNodeCard({
  data,
  selected,
  variant,
}: NodeProps<DiagramFlowNode> & { variant: string }) {
  const { spec, claims, standards, annotation, visual } = data
  const isStructural = visual.isStructural
  const { zoom } = useViewport()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const menuId = useId()
  const renderMode = data.renderMode
  const showDetail = renderMode === 'detail'
  const showNavigation = renderMode === 'navigation'
  const showIconMode = renderMode === 'icon'
  const showCollapsed = renderMode === 'collapsed'
  const showSubtitle = showDetail && zoom >= 1.2
  const showIdBadge = showDetail && zoom >= 1.2
  const showMenu = !isStructural && !showIconMode && !showCollapsed
  const structuralNarrative = isStructural ? resolveStructuralNarrative(spec) : undefined
  const expandedNotes = showDetail && (data.notesExpanded || annotation)

  useEffect(() => {
    if (!menuOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) {
        return
      }
      setMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) {
      return
    }

    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
  }, [menuOpen])

  const handleBlur = useCallback((event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return
    }
    setMenuOpen(false)
  }, [])

  const handleMenuKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') {
      return
    }

    event.stopPropagation()
    setMenuOpen(false)
    menuButtonRef.current?.focus()
  }, [])

  const handleMenuItemKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return
    }

    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
    if (items.length === 0) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)
    const nextIndex =
      currentIndex === -1
        ? event.key === 'ArrowDown'
          ? 0
          : items.length - 1
        : event.key === 'ArrowDown'
          ? (currentIndex + 1) % items.length
          : (currentIndex - 1 + items.length) % items.length

    items[nextIndex]?.focus()
  }, [])

  const handleMouseEnter = useCallback(() => {
    data.callbacks.onHover(nodeEntityKey(spec.id))
  }, [data.callbacks, spec.id])

  const handleMouseLeave = useCallback(() => {
    data.callbacks.onHover(undefined)
  }, [data.callbacks])

  const handleMenuToggle = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    data.callbacks.onSelectNode(spec.id)
    setMenuOpen((current) => !current)
  }, [data.callbacks, spec.id])

  const runMenuAction = useCallback((event: ReactMouseEvent<HTMLButtonElement>, action: () => void) => {
    event.stopPropagation()
    setMenuOpen(false)
    action()
  }, [])

  const handleNodeClick = useCallback(() => {
    setMenuOpen(false)
    data.callbacks.onSelectNode(spec.id)
  }, [data.callbacks, spec.id])

  return (
    <div
      className={clsx(
        'node-card',
        `node-card--${variant}`,
        `node-card--kind-${spec.kind}`,
        `node-card--${renderMode}`,
        focusRingClassName,
        data.highlighted && 'is-highlighted',
        (selected || data.selected) && 'is-selected',
        data.dimmed && 'is-dimmed',
        isStructural && 'is-structural',
        spec.id === 'VOI' && 'is-write-bridge',
      )}
      data-node-id={spec.id}
      data-node-density={renderMode}
      data-node-kind={spec.kind}
      aria-label={data.ariaLabel}
      style={
        {
          backgroundColor: visual.fill,
          borderColor: visual.border,
          '--node-fill': visual.fill,
          '--node-border': visual.border,
          '--node-accent': visual.accent,
          '--node-band-accent': visual.bandAccent,
        } as CSSProperties
      }
      onClick={handleNodeClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocusCapture={handleMouseEnter}
      onBlurCapture={handleBlur}
    >
      {!isStructural && !showCollapsed ? (
        <NodeHandles sourceHandleIds={data.sourceHandleIds} targetHandleIds={data.targetHandleIds} />
      ) : null}

      {showIconMode ? (
        <div className="node-card__icon-tile">
          <KindGlyph
            path={visual.glyphPath}
            viewBox={visual.glyphViewBox}
            label={visual.glyphLabel}
            className="node-card__glyph--tile"
          />
        </div>
      ) : null}

      {showCollapsed ? (
        <div className="node-card__collapsed-pill">
          <KindGlyph path={visual.glyphPath} viewBox={visual.glyphViewBox} label={visual.glyphLabel} />
          <strong>{spec.title}</strong>
          <span className="node-card__collapse-chevron" aria-hidden="true">
            ▾
          </span>
        </div>
      ) : null}

      {!showIconMode && !showCollapsed ? (
        <>
          <div className="node-card__header">
            <div className="node-card__header-main">
              <div className="node-card__heading">
                {isStructural ? (
                  <div className="node-card__structural-strip">
                    <span className="node-card__structural-strip-label">{structuralHeaderLabel(spec)}</span>
                  </div>
                ) : null}
                <div className="node-card__eyebrow-row">
                  {showIdBadge ? <div className="node-card__id-badge">{spec.id}</div> : null}
                  {structuralNarrative ? <span className="node-card__structural-tagline">{structuralNarrative}</span> : null}
                </div>
                <h3 className="node-card__title">{showNavigation || showDetail ? spec.title : structuralHeaderLabel(spec)}</h3>
                {showSubtitle && spec.subtitle ? <p className="node-card__subtitle">{spec.subtitle}</p> : null}
              </div>
            </div>
            {showMenu ? (
              <div className="node-card__menu" ref={menuRef} onClick={(event) => event.stopPropagation()} onKeyDown={handleMenuKeyDown}>
                <button
                  ref={menuButtonRef}
                  type="button"
                  className="node-card__menu-trigger"
                  aria-label={`Open actions for ${spec.title}`}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-controls={menuId}
                  data-node-action-menu-trigger
                  onClick={handleMenuToggle}
                >
                  ⋯
                </button>
                {menuOpen ? (
                  <div
                    id={menuId}
                    className="node-card__menu-panel"
                    role="menu"
                    aria-label={`Actions for ${spec.title}`}
                    data-node-action-menu
                    onKeyDown={handleMenuItemKeyDown}
                  >
                    <button type="button" role="menuitem" onClick={(event) => runMenuAction(event, () => data.callbacks.onSelectNode(spec.id))}>
                      Focus
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={(event) => runMenuAction(event, () => data.callbacks.onPathAction(spec.id, 'upstream'))}
                    >
                      Show upstream
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={(event) => runMenuAction(event, () => data.callbacks.onPathAction(spec.id, 'downstream'))}
                    >
                      Show downstream
                    </button>
                    {spec.inspector.relatedStepIds[0] ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(event) => runMenuAction(event, () => data.callbacks.onSelectStep(spec.inspector.relatedStepIds[0]))}
                      >
                        Open in sequence
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="node-card__kind-badge" aria-hidden="true">
                <KindGlyph path={visual.glyphPath} viewBox={visual.glyphViewBox} label={visual.glyphLabel} />
              </div>
            )}
          </div>

          {!isStructural && showDetail ? <p className="node-card__description">{spec.inspector.role}</p> : null}

          {!isStructural && showDetail ? (
            <div className="node-card__meta">
              {standards.length > 0 ? (
                <div className="node-card__meta-group">
                  <span className="node-card__meta-label">Standards</span>
                  <div className="node-card__meta-rail" aria-label={`Standards for ${spec.title}`}>
                    {standards.map((standard) => (
                      <button
                        key={standard.id}
                        type="button"
                        className="badge badge--standard"
                        title={`${standard.label}${standard.version ? ` ${standard.version}` : ''}`}
                        onClick={(event) => {
                          stopNodeClick(event)
                          data.callbacks.onBadgeStandard(standard.id)
                        }}
                      >
                        {standard.label}
                        {standard.version ? ` ${standard.version}` : ''}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {expandedNotes && spec.inspector.notes[0] ? (
            <div className="node-card__annotation">{spec.inspector.notes[0]}</div>
          ) : null}
          {annotation && showDetail ? <div className="node-card__annotation">Author note: {annotation}</div> : null}
          {!isStructural ? (
            <ClaimDots
              nodeTitle={spec.title}
              claimDots={data.claimDots}
              claims={claims}
              onBadgeClaim={data.callbacks.onBadgeClaim}
            />
          ) : null}
        </>
      ) : null}
    </div>
  )
})
