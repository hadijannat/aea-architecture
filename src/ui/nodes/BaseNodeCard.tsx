import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { Handle, useViewport, type NodeProps } from '@xyflow/react'
import clsx from 'clsx'

import { resolveNodeVisual } from '@/graph/compile/nodeVisuals'
import type { DiagramFlowNode } from '@/graph/compile/toReactFlow'
import { nodeEntityKey } from '@/graph/spec/manifest'
import type { NodeSpec } from '@/graph/spec/schema'
import { focusRingClassName } from '@/a11y/focus'
import { getHandlePosition, type HandleId } from '@/layout/ports'

const handleIds: HandleId[] = ['left', 'right', 'top', 'bottom']

function NodeHandles() {
  return (
    <>
      {handleIds.map((handleId) => (
        <Handle
          key={`source-${handleId}`}
          id={handleId}
          type="source"
          position={getHandlePosition(handleId)}
          isConnectable={false}
          style={{ opacity: 0, width: 10, height: 10 }}
        />
      ))}
      {handleIds.map((handleId) => (
        <Handle
          key={`target-${handleId}`}
          id={handleId}
          type="target"
          position={getHandlePosition(handleId)}
          isConnectable={false}
          style={{ opacity: 0, width: 10, height: 10 }}
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
      return 'Read-only CPC boundary'
    case 'LANE_B':
      return 'Agent runtime and gateway corridor'
    case 'LANE_C':
      return 'Publish-only central consumption'
    case 'GW':
      return 'Gateway diode and VoR boundary'
    case 'AEA':
      return 'Sense -> Decide -> Act pipeline'
    case 'BAND_SENSE':
      return 'Read-only telemetry ingress'
    case 'BAND_DECIDE':
      return 'Grounding, planning, and policy gates'
    case 'BAND_ACT':
      return 'Validated write and publish split'
    default:
      return undefined
  }
}

export function BaseNodeCard({
  data,
  selected,
  variant,
}: NodeProps<DiagramFlowNode> & { variant: string }) {
  const { spec, claims, standards, annotation } = data
  const visual = resolveNodeVisual(spec)
  const isStructural = visual.isStructural
  const { zoom } = useViewport()
  const [compactMetaVisible, setCompactMetaVisible] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const menuId = useId()
  const structuralZoomMode =
    !isStructural ? undefined : zoom >= 0.96 ? 'full' : zoom >= 0.72 ? 'balanced' : 'overview'
  const density =
    isStructural
      ? structuralZoomMode
      : selected || data.selected
        ? 'full'
        : zoom >= 1.08
          ? 'full'
          : zoom >= 0.88
            ? 'balanced'
            : 'compact'
  const showExpandedNotes = density === 'full'
  const showRole = !isStructural
  const showMetaLabels = density !== 'compact'
  const showCompactMetaSummary = density === 'compact' && !isStructural
  const hasCompactMeta = showCompactMetaSummary && (standards.length > 0 || claims.length > 0)
  const structuralNarrative = isStructural ? resolveStructuralNarrative(spec) : undefined
  const showStructuralOverview = structuralZoomMode === 'overview'
  const showStructuralBadge = !isStructural || structuralZoomMode !== 'overview'
  const showEyebrowId = !isStructural || structuralZoomMode !== 'overview'
  const showLeadingBadge = visual.badgeStyle === 'pill' && !isStructural
  const showInlineBadge = (visual.badgeStyle === 'inline' || isStructural) && showStructuralBadge

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

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return
    }
    setCompactMetaVisible(false)
    setMenuOpen(false)
  }

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape') {
      return
    }

    event.stopPropagation()
    setMenuOpen(false)
    menuButtonRef.current?.focus()
  }

  function handleMenuItemKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
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
  }

  function handleMenuToggle(event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    data.callbacks.onSelectNode(spec.id)
    setMenuOpen((current) => !current)
  }

  function runMenuAction(event: ReactMouseEvent<HTMLButtonElement>, action: () => void) {
    event.stopPropagation()
    setMenuOpen(false)
    action()
  }

  function handleNodeClick() {
    setMenuOpen(false)
    data.callbacks.onSelectNode(spec.id)
  }

  const badge = (
    <span
      className={clsx(
        'node-card__badge',
        `node-card__badge--${visual.badgeStyle}`,
        isStructural && 'node-card__badge--structural',
      )}
      aria-hidden="true"
    >
      {visual.badgeText}
    </span>
  )

  return (
    <div
      className={clsx(
        'node-card',
        `node-card--${variant}`,
        `node-card--kind-${spec.kind}`,
        `node-card--${density}`,
        focusRingClassName,
        data.highlighted && 'is-highlighted',
        (selected || data.selected) && 'is-selected',
        data.dimmed && 'is-dimmed',
        isStructural && 'is-structural',
      )}
      data-node-id={spec.id}
      data-node-density={density}
      data-node-kind={spec.kind}
      data-node-badge-style={visual.badgeStyle}
      data-node-structural-zoom={isStructural ? structuralZoomMode : undefined}
      aria-label={data.ariaLabel}
      style={
        {
          backgroundColor: visual.fill,
          borderColor: visual.border,
          '--node-fill': visual.fill,
          '--node-border': visual.border,
          '--node-accent': visual.accent,
        } as CSSProperties
      }
      onClick={handleNodeClick}
      onMouseEnter={() => {
        setCompactMetaVisible(true)
        data.callbacks.onHover(nodeEntityKey(spec.id))
      }}
      onMouseLeave={() => {
        setCompactMetaVisible(false)
        data.callbacks.onHover(undefined)
      }}
      onFocusCapture={() => setCompactMetaVisible(true)}
      onBlurCapture={handleBlur}
    >
      {!isStructural ? <NodeHandles /> : null}
      <div className="node-card__header">
        <div className="node-card__header-main">
          {showLeadingBadge ? badge : null}
          <div className="node-card__heading">
            <div className="node-card__eyebrow-row">
              {showEyebrowId ? <div className="node-card__eyebrow">{spec.id}</div> : null}
              {showInlineBadge ? badge : null}
              {structuralNarrative ? <span className="node-card__structural-tagline">{structuralNarrative}</span> : null}
            </div>
            <h3 className="node-card__title">{spec.title}</h3>
            {showStructuralOverview && spec.subtitle ? <p className="node-card__subtitle">{spec.subtitle}</p> : null}
          </div>
          {!showStructuralOverview && spec.subtitle ? <p className="node-card__subtitle">{spec.subtitle}</p> : null}
        </div>
        {!isStructural ? (
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
        ) : null}
      </div>
      {showRole ? <p className="node-card__description">{spec.inspector.role}</p> : null}
      {!isStructural ? (
        <div className="node-card__meta">
          {standards.length > 0 ? (
            <div className="node-card__meta-group">
              {showMetaLabels ? <span className="node-card__meta-label">Standards</span> : null}
              {showCompactMetaSummary ? (
                <button
                  type="button"
                  className="badge badge--standard badge--summary"
                  data-node-meta-summary="standards"
                  onClick={(event) => {
                    stopNodeClick(event)
                    setCompactMetaVisible((current) => !current)
                  }}
                  onFocus={() => setCompactMetaVisible(true)}
                >
                  {standards.length} standard{standards.length === 1 ? '' : 's'}
                </button>
              ) : (
                <div className="node-card__meta-rail" aria-label={`Standards for ${spec.title}`}>
                  {standards.map((standard: NonNullable<typeof standards[number]>) => (
                    <button
                      key={standard.id}
                      type="button"
                      className="badge badge--standard"
                      title={`${standard.label}${standard.version ? ` ${standard.version}` : ''}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        data.callbacks.onBadgeStandard(standard.id)
                      }}
                    >
                      {density === 'compact' ? standard.id : standard.label}
                      {density !== 'compact' && standard.version ? ` ${standard.version}` : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
          {claims.length > 0 ? (
            <div className="node-card__meta-group">
              {showMetaLabels ? <span className="node-card__meta-label">Claims</span> : null}
              {showCompactMetaSummary ? (
                <button
                  type="button"
                  className="badge badge--claim badge--summary"
                  data-node-meta-summary="claims"
                  onClick={(event) => {
                    stopNodeClick(event)
                    setCompactMetaVisible((current) => !current)
                  }}
                  onFocus={() => setCompactMetaVisible(true)}
                >
                  {claims.length} claim{claims.length === 1 ? '' : 's'}
                </button>
              ) : (
                <div className="node-card__meta-rail" aria-label={`Claims for ${spec.title}`}>
                  {claims.map((claim: NonNullable<typeof claims[number]>) => (
                    <button
                      key={claim.id}
                      type="button"
                      className="badge badge--claim"
                      title={claim.label}
                      onClick={(event) => {
                        event.stopPropagation()
                        data.callbacks.onBadgeClaim(claim.id)
                      }}
                    >
                      {claim.id}
                      {density === 'full' ? ` · ${claim.label}` : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
          {hasCompactMeta && compactMetaVisible ? (
            <div className="node-card__meta-popover" data-node-meta-popover>
              {standards.length > 0 ? (
                <div className="node-card__meta-group">
                  <span className="node-card__meta-label">Standards</span>
                  <div className="node-card__meta-rail" aria-label={`Standards for ${spec.title}`}>
                    {standards.map((standard: NonNullable<typeof standards[number]>) => (
                      <button
                        key={standard.id}
                        type="button"
                        className="badge badge--standard"
                        title={`${standard.label}${standard.version ? ` ${standard.version}` : ''}`}
                        onClick={(event) => {
                          event.stopPropagation()
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
              {claims.length > 0 ? (
                <div className="node-card__meta-group">
                  <span className="node-card__meta-label">Claims</span>
                  <div className="node-card__meta-rail" aria-label={`Claims for ${spec.title}`}>
                    {claims.map((claim: NonNullable<typeof claims[number]>) => (
                      <button
                        key={claim.id}
                        type="button"
                        className="badge badge--claim"
                        title={claim.label}
                        onClick={(event) => {
                          event.stopPropagation()
                          data.callbacks.onBadgeClaim(claim.id)
                        }}
                      >
                        {claim.id} · {claim.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {data.notesExpanded && showExpandedNotes && spec.inspector.notes[0] ? (
        <div className="node-card__annotation">{spec.inspector.notes[0]}</div>
      ) : null}
      {annotation && showExpandedNotes ? <div className="node-card__annotation">Author note: {annotation}</div> : null}
    </div>
  )
}
