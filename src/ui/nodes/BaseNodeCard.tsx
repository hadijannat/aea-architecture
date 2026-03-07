import { Handle, useViewport, type NodeProps } from '@xyflow/react'
import clsx from 'clsx'

import type { DiagramFlowNode } from '@/graph/compile/toReactFlow'
import { nodeEntityKey } from '@/graph/spec/manifest'
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

export function BaseNodeCard({
  data,
  selected,
  variant,
}: NodeProps<DiagramFlowNode> & { variant: string }) {
  const { spec, claims, standards, annotation } = data
  const isStructural = spec.kind === 'lane' || spec.kind === 'container' || spec.kind === 'band'
  const { zoom } = useViewport()
  const density =
    isStructural || selected || data.selected
      ? 'full'
      : zoom >= 1.08
        ? 'full'
        : zoom >= 0.88
          ? 'balanced'
          : 'compact'
  const showExpandedNotes = density === 'full'
  const showRole = !isStructural
  const showMetaLabels = density !== 'compact'

  return (
    <div
      className={clsx(
        'node-card',
        `node-card--${variant}`,
        `node-card--${density}`,
        focusRingClassName,
        data.highlighted && 'is-highlighted',
        (selected || data.selected) && 'is-selected',
        data.dimmed && 'is-dimmed',
        isStructural && 'is-structural',
      )}
      data-node-id={spec.id}
      aria-label={data.ariaLabel}
      title={data.ariaLabel}
      onClick={() => data.callbacks.onSelectNode(spec.id)}
      onMouseEnter={() => data.callbacks.onHover(nodeEntityKey(spec.id))}
      onMouseLeave={() => data.callbacks.onHover(undefined)}
    >
      {!isStructural ? <NodeHandles /> : null}
      <div className="node-card__header">
        <div>
          <div className="node-card__eyebrow">{spec.id}</div>
          <h3 className="node-card__title">{spec.title}</h3>
          {spec.subtitle ? <p className="node-card__subtitle">{spec.subtitle}</p> : null}
        </div>
        {!isStructural ? (
          <details className="node-card__menu" onClick={(event) => event.stopPropagation()}>
            <summary aria-label={`Actions for ${spec.title}`}>...</summary>
            <div className="node-card__menu-panel">
              <button type="button" onClick={() => data.callbacks.onSelectNode(spec.id)}>
                Focus
              </button>
              <button type="button" onClick={() => data.callbacks.onPathAction(spec.id, 'upstream')}>
                Show upstream
              </button>
              <button type="button" onClick={() => data.callbacks.onPathAction(spec.id, 'downstream')}>
                Show downstream
              </button>
              {spec.inspector.relatedStepIds[0] ? (
                <button type="button" onClick={() => data.callbacks.onSelectStep(spec.inspector.relatedStepIds[0])}>
                  Open in sequence
                </button>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>
      {showRole ? <p className="node-card__description">{spec.inspector.role}</p> : null}
      {!isStructural ? (
        <div className="node-card__meta">
          {standards.length > 0 ? (
            <div className="node-card__meta-group">
              {showMetaLabels ? <span className="node-card__meta-label">Standards</span> : null}
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
            </div>
          ) : null}
          {claims.length > 0 ? (
            <div className="node-card__meta-group">
              {showMetaLabels ? <span className="node-card__meta-label">Claims</span> : null}
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
            </div>
          ) : null}
        </div>
      ) : null}
      {(data.notesExpanded && showExpandedNotes && spec.inspector.notes[0]) ? (
        <div className="node-card__annotation">{spec.inspector.notes[0]}</div>
      ) : null}
      {(annotation && showExpandedNotes) ? <div className="node-card__annotation">Author note: {annotation}</div> : null}
    </div>
  )
}
