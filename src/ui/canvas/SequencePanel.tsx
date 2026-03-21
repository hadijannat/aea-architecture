import { type CSSProperties, type RefObject } from 'react'
import clsx from 'clsx'

import {
  edgeStrokeWidth,
  getSemanticMarkerGeometry,
  getSemanticMarkerRefX,
  getSemanticMarkerTokens,
  getSemanticPresentation,
  getSemanticStrokeDash,
} from '@/graph/compile/semanticPresentation'
import { type SequenceBoardModel } from '@/graph/compile/sequenceBoard'
import { edgeEntityKey, nodeEntityKey, stepEntityKey } from '@/graph/spec/manifest'
import type { EntityKey, ProjectionTheme } from '@/graph/spec/schema'
import { resolveSemanticVisual } from '@/graph/compile/visualSystem'

interface SequencePanelProps {
  containerRef?: RefObject<HTMLElement | null>
  model: SequenceBoardModel
  theme: ProjectionTheme
  layout?: 'split' | 'stacked'
  onSelectNode(nodeId: string): void
  onSelectStep(stepId: string): void
  onSelectEdge(edgeId: string): void
  onHover(key?: EntityKey): void
}

const sequenceMarkerTokens = getSemanticMarkerTokens('sequence')

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

export function SequencePanel({
  containerRef,
  model,
  theme,
  layout = 'split',
  onSelectNode,
  onSelectStep,
  onSelectEdge,
  onHover,
}: SequencePanelProps) {
  const visibleSteps = model.steps.filter((step) => !step.hidden)
  const visibleTerminals = model.terminals.filter((terminal) => !terminal.hidden)
  const visibleEdges = model.edges.filter((edge) => !edge.hidden)
  const visibleSemantics = [...new Set(visibleEdges.map((edge) => edge.edge.semantic))]
  const hasActiveHighlights =
    visibleSteps.some((step) => step.highlighted || step.selected) ||
    visibleEdges.some((edge) => edge.highlighted || edge.selected) ||
    visibleTerminals.some((terminal) => terminal.highlighted || terminal.selected)

  return (
    <section
      ref={containerRef}
      className={`sequence-panel sequence-panel--${theme} sequence-panel--${layout}`}
      data-theme={theme}
      aria-label="VoR domain transition sequence"
    >
      <header className={clsx('sequence-panel__header', hasActiveHighlights && 'sequence-panel__header--active')}>
        <div>
          <p className="sequence-panel__eyebrow">Panel B</p>
          <h2>VoR sequence</h2>
        </div>
        <p>Five-stage validation path enforcing the NE178 boundary before CPC actuation.</p>
      </header>

      <div className="sequence-board-shell">
        <div
          className="sequence-board"
          style={
            {
              '--sequence-board-width': `${model.width}px`,
              '--sequence-board-height': `${model.height}px`,
            } as CSSProperties
          }
        >
          <svg
            className="sequence-board__paths"
            viewBox={`0 0 ${model.width} ${model.height}`}
            aria-hidden="true"
          >
            <defs>
              {visibleSemantics.map((semantic) => {
                const presentation = getSemanticPresentation(semantic)
                return (
                  <marker
                    key={semantic}
                    id={`sequence-marker-${semantic}`}
                    viewBox={sequenceMarkerTokens.viewBox}
                    markerWidth={sequenceMarkerTokens.width}
                    markerHeight={sequenceMarkerTokens.height}
                    refX={getSemanticMarkerRefX(presentation.marker)}
                    refY={sequenceMarkerTokens.refY}
                    orient="auto"
                    markerUnits={sequenceMarkerTokens.units}
                  >
                    {renderMarkerShape(presentation.marker, presentation.stroke)}
                  </marker>
                )
              })}
            </defs>
            <rect
              x="0"
              y="0"
              width={model.width}
              height={model.height}
              rx="26"
              data-sequence-background
              style={{ fill: 'var(--sequence-bg, #fff9f1)' }}
            />
            <path
              d={`M 24 ${model.ribbonY + 48} L ${model.width - 24} ${model.ribbonY + 48}`}
              fill="none"
              stroke="rgba(107, 114, 128, 0.2)"
              strokeWidth="1"
            />
            <text x="36" y={model.ribbonY + 42} className="sequence-board__ribbon-label">
              VoR boundary
            </text>
            {visibleEdges.map((edge) => {
              const presentation = getSemanticPresentation(edge.edge.semantic)

              return (
                <g
                  key={edge.edge.id}
                  className={clsx(
                    'sequence-board__edge',
                    `sequence-board__edge--${edge.edge.semantic}`,
                    edge.selected && 'is-selected',
                    edge.highlighted && 'is-highlighted',
                    edge.dimmed && 'is-dimmed',
                  )}
                  data-edge-id={edge.edge.id}
                  data-edge-semantic={edge.edge.semantic}
                >
                  <path
                    d={edge.path}
                    fill="none"
                    stroke={presentation.stroke}
                    strokeWidth={edgeStrokeWidth(edge.edge.style, edge.edge.semantic)}
                    strokeDasharray={getSemanticStrokeDash(edge.edge.semantic, edge.edge.style)}
                    markerEnd={`url(#sequence-marker-${edge.edge.semantic})`}
                  />
                </g>
              )
            })}
          </svg>

          {visibleTerminals.map((terminal) => (
            <button
              key={terminal.node.id}
              type="button"
              className={clsx(
                'sequence-terminal',
                terminal.node.id === 'PB_AEA' && 'sequence-terminal--origin',
                terminal.node.id === 'PB_REJECT_OUT' && 'sequence-terminal--reject',
                terminal.selected && 'is-selected',
                terminal.highlighted && 'is-highlighted',
                terminal.dimmed && 'is-dimmed',
              )}
              style={
                {
                  left: terminal.rect.x,
                  top: terminal.rect.y,
                  width: terminal.rect.width,
                  height: terminal.rect.height,
                } as CSSProperties
              }
              aria-label={terminal.ariaLabel}
              onClick={() => onSelectNode(terminal.node.id)}
              onMouseEnter={() => onHover(nodeEntityKey(terminal.node.id))}
              onMouseLeave={() => onHover(undefined)}
            >
              {terminal.node.id === 'PB_AEA' ? (
                <span className="sequence-terminal__origin">Origin context</span>
              ) : null}
              <span className="sequence-terminal__eyebrow">
                {terminal.node.id === 'PB_REJECT_OUT' ? 'Reject out' : terminal.node.id}
              </span>
              <strong>{terminal.node.title}</strong>
              {terminal.node.id === 'PB_REJECT_OUT' ? <span className="sequence-terminal__terminator">X</span> : null}
              {terminal.node.subtitle ? <span>{terminal.node.subtitle}</span> : null}
            </button>
          ))}

          {visibleSteps.map((step) => (
            <button
              key={step.step.id}
              type="button"
              className={clsx(
                'sequence-step',
                step.selected && 'is-selected',
                step.highlighted && 'is-highlighted',
                step.dimmed && 'is-dimmed',
              )}
              style={
                {
                  left: step.rect.x,
                  top: step.rect.y,
                  width: step.rect.width,
                  height: step.rect.height,
                } as CSSProperties
              }
              aria-label={step.ariaLabel}
              onClick={() => onSelectStep(step.step.id)}
              onMouseEnter={() => onHover(stepEntityKey(step.step.id))}
              onMouseLeave={() => onHover(undefined)}
            >
              <div className="sequence-step__header">
                <span className="sequence-step__index">
                  <span className="sequence-step__ordinal">{step.step.order}</span>
                  {step.step.id}
                </span>
                <strong>{step.step.title}</strong>
                <span className="sequence-step__status" aria-hidden="true" />
              </div>
              <div className="sequence-step__body">
                <span>{step.step.summary}</span>
              </div>
            </button>
          ))}

          {visibleEdges.map((edge) => {
            const presentation = getSemanticPresentation(edge.edge.semantic)
            const visual = resolveSemanticVisual(edge.edge.semantic)
            const labelY =
              edge.edge.id === 'PB_ACK'
                ? edge.labelY - 10
                : edge.edge.semantic === 'rejection'
                  ? edge.labelY + 22
                  : edge.labelY - 16
            const expanded = edge.selected || edge.highlighted
            const displayLabel =
              edge.edge.id === 'PB_ACK' ? 'ACK signal' : edge.edge.displayLabel ?? edge.edge.label

            return (
              <button
                key={edge.edge.id}
                type="button"
                className={clsx(
                  'sequence-edge-label',
                  `sequence-edge-label--${edge.edge.semantic}`,
                  `sequence-edge-label-family--${presentation.family}`,
                  edge.selected && 'is-selected',
                  edge.highlighted && 'is-highlighted',
                  edge.dimmed && 'is-dimmed',
                )}
                data-edge-id={edge.edge.id}
                data-edge-label-mode={expanded ? 'expanded' : 'compact'}
                style={
                  {
                    '--semantic-stroke': presentation.stroke,
                    '--semantic-chip-text': visual.chipText,
                    left: edge.labelX,
                    top: labelY,
                  } as CSSProperties
                }
                aria-label={`${edge.edge.id}: ${displayLabel}. ${edge.edge.label}`}
                onClick={() => onSelectEdge(edge.edge.id)}
                onFocus={() => onHover(edgeEntityKey(edge.edge.id))}
                onBlur={() => onHover(undefined)}
                onMouseEnter={() => onHover(edgeEntityKey(edge.edge.id))}
                onMouseLeave={() => onHover(undefined)}
              >
                {expanded || edge.edge.id === 'PB_ACK' ? displayLabel : edge.edge.id}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
