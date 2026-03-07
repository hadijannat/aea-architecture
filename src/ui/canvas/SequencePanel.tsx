import { type CSSProperties, type RefObject } from 'react'
import clsx from 'clsx'

import {
  edgeStrokeDash,
  edgeStrokeWidth,
  getSemanticPresentation,
} from '@/graph/compile/semanticPresentation'
import { type SequenceBoardModel } from '@/graph/compile/sequenceBoard'
import { edgeEntityKey, nodeEntityKey, stepEntityKey } from '@/graph/spec/manifest'
import type { EntityKey, ProjectionTheme } from '@/graph/spec/schema'

interface SequencePanelProps {
  containerRef?: RefObject<HTMLElement | null>
  model: SequenceBoardModel
  theme: ProjectionTheme
  onSelectNode(nodeId: string): void
  onSelectStep(stepId: string): void
  onSelectEdge(edgeId: string): void
  onHover(key?: EntityKey): void
}

function markerPath(marker: ReturnType<typeof getSemanticPresentation>['marker']) {
  switch (marker) {
    case 'arrow':
      return <path d="M 1 1 L 9 4 L 1 7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    case 'circle':
      return <circle cx="5" cy="4" r="3" fill="currentColor" />
    case 'tee':
      return <path d="M 1 1 L 1 7 M 1 4 L 9 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    case 'diamond':
      return <path d="M 5 0.8 L 9.2 4 L 5 7.2 L 0.8 4 z" fill="currentColor" />
    case 'arrowclosed':
    default:
      return <path d="M 0 0 L 10 4 L 0 8 z" fill="currentColor" />
  }
}

function markerRefX(marker: ReturnType<typeof getSemanticPresentation>['marker']) {
  if (marker === 'tee') {
    return 2
  }
  if (marker === 'circle') {
    return 5
  }
  return 9
}

export function SequencePanel({
  containerRef,
  model,
  theme,
  onSelectNode,
  onSelectStep,
  onSelectEdge,
  onHover,
}: SequencePanelProps) {
  const visibleSteps = model.steps.filter((step) => !step.hidden)
  const visibleTerminals = model.terminals.filter((terminal) => !terminal.hidden)
  const visibleEdges = model.edges.filter((edge) => !edge.hidden)

  return (
    <section
      ref={containerRef}
      className={`sequence-panel sequence-panel--${theme}`}
      data-theme={theme}
      aria-label="VoR domain transition sequence"
    >
      <header className="sequence-panel__header">
        <div>
          <p className="eyebrow">(b)</p>
          <h2>VoR Domain-Transition Sequence</h2>
        </div>
        <p>Shared board geometry keeps runtime and export paths aligned.</p>
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
              {visibleEdges.map((edge) => {
                const presentation = getSemanticPresentation(edge.edge.semantic)
                return (
                  <marker
                    key={edge.edge.id}
                    id={`sequence-marker-${edge.edge.id}`}
                    markerWidth="10"
                    markerHeight="8"
                    refX={markerRefX(presentation.marker)}
                    refY="4"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    <g style={{ color: presentation.stroke }}>{markerPath(presentation.marker)}</g>
                  </marker>
                )
              })}
            </defs>
            <rect x="0" y="0" width={model.width} height={model.height} rx="26" fill="#fff9f1" />
            <path
              d={`M 24 ${model.ribbonY + 48} L ${model.width - 24} ${model.ribbonY + 48}`}
              fill="none"
              stroke="rgba(211, 161, 109, 0.3)"
              strokeWidth="1"
            />
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
                    strokeWidth={edgeStrokeWidth(edge.edge.style)}
                    strokeDasharray={edgeStrokeDash(edge.edge.style)}
                    markerEnd={`url(#sequence-marker-${edge.edge.id})`}
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
              <span className="sequence-terminal__eyebrow">{terminal.node.id}</span>
              <strong>{terminal.node.title}</strong>
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
              <span className="sequence-step__index">{step.step.id}</span>
              <strong>{step.step.title}</strong>
              <span>{step.step.summary}</span>
            </button>
          ))}

          {visibleEdges.map((edge) => {
            const presentation = getSemanticPresentation(edge.edge.semantic)
            const labelY =
              edge.edge.semantic === 'sequence'
                ? edge.labelY - 18
                : edge.edge.semantic === 'rejection'
                  ? edge.labelY + 18
                  : edge.labelY - 10
            const expanded = edge.selected || edge.highlighted
            const displayLabel = edge.edge.displayLabel ?? edge.edge.label

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
                {expanded ? `${edge.edge.id} · ${displayLabel}` : edge.edge.id}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
