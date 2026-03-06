import { type CSSProperties, type RefObject } from 'react'
import clsx from 'clsx'

import { type SequenceBoardModel } from '@/graph/compile/sequenceBoard'
import { edgeEntityKey, nodeEntityKey, stepEntityKey } from '@/graph/spec/manifest'
import type { EntityKey } from '@/graph/spec/schema'

interface SequencePanelProps {
  containerRef?: RefObject<HTMLElement | null>
  model: SequenceBoardModel
  onSelectNode(nodeId: string): void
  onSelectStep(stepId: string): void
  onSelectEdge(edgeId: string): void
  onHover(key?: EntityKey): void
}

function edgeStroke(semantic: string) {
  switch (semantic) {
    case 'status-ack':
    case 'rejection':
      return '#7d8597'
    default:
      return '#455a75'
  }
}

function edgeStrokeWidth(style: string) {
  switch (style) {
    case 'medium':
      return 2.4
    case 'dashed':
      return 1.9
    default:
      return 1.6
  }
}

function edgeDash(style: string) {
  if (style === 'dashed') {
    return '8 4'
  }
  return undefined
}

export function SequencePanel({
  containerRef,
  model,
  onSelectNode,
  onSelectStep,
  onSelectEdge,
  onHover,
}: SequencePanelProps) {
  const visibleSteps = model.steps.filter((step) => !step.hidden)
  const visibleTerminals = model.terminals.filter((terminal) => !terminal.hidden)
  const visibleEdges = model.edges.filter((edge) => !edge.hidden)

  return (
    <section ref={containerRef} className="sequence-panel" aria-label="VoR domain transition sequence">
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
              <marker id="sequence-arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="strokeWidth">
                <path d="M 0 0 L 10 4 L 0 8 z" fill="#455a75" />
              </marker>
              <marker id="sequence-arrow-status" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="strokeWidth">
                <path d="M 0 0 L 10 4 L 0 8 z" fill="#7d8597" />
              </marker>
            </defs>
            <rect x="0" y="0" width={model.width} height={model.height} rx="26" fill="#fff9f1" />
            <path
              d={`M 24 ${model.ribbonY + 48} L ${model.width - 24} ${model.ribbonY + 48}`}
              fill="none"
              stroke="rgba(211, 161, 109, 0.3)"
              strokeWidth="1"
            />
            {visibleEdges.map((edge) => (
              <g
                key={edge.edge.id}
                className={clsx(
                  'sequence-board__edge',
                  edge.selected && 'is-selected',
                  edge.highlighted && 'is-highlighted',
                  edge.dimmed && 'is-dimmed',
                )}
              >
                <path
                  d={edge.path}
                  fill="none"
                  stroke={edgeStroke(edge.edge.semantic)}
                  strokeWidth={edgeStrokeWidth(edge.edge.style)}
                  strokeDasharray={edgeDash(edge.edge.style)}
                  markerEnd={`url(#${edge.edge.semantic === 'status-ack' || edge.edge.semantic === 'rejection' ? 'sequence-arrow-status' : 'sequence-arrow'})`}
                />
              </g>
            ))}
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
            const labelY =
              edge.edge.semantic === 'sequence'
                ? edge.labelY - 18
                : edge.edge.semantic === 'rejection'
                  ? edge.labelY + 18
                  : edge.labelY - 10

            return (
              <button
                key={edge.edge.id}
                type="button"
                className={clsx(
                  'sequence-edge-label',
                  `sequence-edge-label--${edge.edge.semantic}`,
                  edge.selected && 'is-selected',
                  edge.highlighted && 'is-highlighted',
                  edge.dimmed && 'is-dimmed',
                )}
                style={
                  {
                    left: edge.labelX,
                    top: labelY,
                  } as CSSProperties
                }
                aria-label={`${edge.edge.id}: ${edge.edge.label}`}
                onClick={() => onSelectEdge(edge.edge.id)}
                onFocus={() => onHover(edgeEntityKey(edge.edge.id))}
                onBlur={() => onHover(undefined)}
                onMouseEnter={() => onHover(edgeEntityKey(edge.edge.id))}
                onMouseLeave={() => onHover(undefined)}
              >
                {edge.edge.id}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
