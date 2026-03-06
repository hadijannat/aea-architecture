import clsx from 'clsx'

import { edgeEntityKey, nodeEntityKey, stepEntityKey } from '@/graph/spec/manifest'
import type { EntityKey } from '@/graph/spec/schema'
import type { SequencePanelModel } from '@/graph/compile/toReactFlow'

interface SequencePanelProps {
  model: SequencePanelModel
  onSelectNode(nodeId: string): void
  onSelectStep(stepId: string): void
  onSelectEdge(edgeId: string): void
  onHover(key?: EntityKey): void
}

export function SequencePanel({
  model,
  onSelectNode,
  onSelectStep,
  onSelectEdge,
  onHover,
}: SequencePanelProps) {
  const visibleSteps = model.steps.filter((step) => !step.hidden)
  const visibleTerminals = model.terminals.filter((terminal) => !terminal.hidden)
  const terminalMap = new Map(visibleTerminals.map((terminal) => [terminal.node.id, terminal]))
  const flowEdgeMap = new Map(
    model.edges
      .filter((edge) => !edge.hidden && edge.edge.semantic === 'sequence')
      .map((edge) => [`${edge.edge.source}->${edge.edge.target}`, edge]),
  )
  const statusEdges = model.edges.filter((edge) => !edge.hidden && edge.edge.semantic !== 'sequence')
  const leftTerminal = terminalMap.get('PB_AEA')
  const rejectTerminal = terminalMap.get('PB_REJECT_OUT')

  return (
    <section className="sequence-panel" aria-label="VoR domain transition sequence">
      <header className="sequence-panel__header">
        <div>
          <p className="eyebrow">(b)</p>
          <h2>VoR Domain-Transition Sequence</h2>
        </div>
        <p>Panel A and Panel B stay synchronized through interaction rules, not duplicated UI logic.</p>
      </header>
      <div className="sequence-panel__rail">
        {leftTerminal ? (
          <button
            type="button"
            className={clsx(
              'sequence-terminal',
              leftTerminal.selected && 'is-selected',
              leftTerminal.highlighted && 'is-highlighted',
              leftTerminal.dimmed && 'is-dimmed',
            )}
            aria-label={leftTerminal.ariaLabel}
            onClick={() => onSelectNode(leftTerminal.node.id)}
            onMouseEnter={() => onHover(nodeEntityKey(leftTerminal.node.id))}
            onMouseLeave={() => onHover(undefined)}
          >
            <span className="sequence-terminal__eyebrow">{leftTerminal.node.id}</span>
            <strong>{leftTerminal.node.title}</strong>
            {leftTerminal.node.subtitle ? <span>{leftTerminal.node.subtitle}</span> : null}
          </button>
        ) : null}
        {visibleSteps.map((step, index) => (
          <div key={step.step.id} className="sequence-panel__step-wrap">
            <button
              type="button"
              className={clsx(
                'sequence-step',
                step.selected && 'is-selected',
                step.highlighted && 'is-highlighted',
                step.dimmed && 'is-dimmed',
              )}
              aria-label={step.ariaLabel}
              onClick={() => onSelectStep(step.step.id)}
              onMouseEnter={() => onHover(stepEntityKey(step.step.id))}
              onMouseLeave={() => onHover(undefined)}
            >
              <span className="sequence-step__index">{step.step.id}</span>
              <strong>{step.step.title}</strong>
              <span>{step.step.summary}</span>
            </button>
            {index < visibleSteps.length - 1 ? (() => {
              const nextStep = visibleSteps[index + 1]
              const flowEdge = nextStep
                ? flowEdgeMap.get(`${step.step.id}->${nextStep.step.id}`)
                : undefined
              return flowEdge ? (
              <button
                type="button"
                className={clsx(
                  'sequence-arrow',
                  flowEdge.selected && 'is-selected',
                  flowEdge.highlighted && 'is-highlighted',
                  flowEdge.dimmed && 'is-dimmed',
                )}
                aria-label={flowEdge.edge.label ?? flowEdge.edge.id}
                onClick={() => onSelectEdge(flowEdge.edge.id)}
                onMouseEnter={() => onHover(edgeEntityKey(flowEdge.edge.id))}
                onMouseLeave={() => onHover(undefined)}
              >
                {flowEdge.edge.id}
              </button>
              ) : null
            })() : null}
          </div>
        ))}
      </div>
      <div className="sequence-panel__terminals">
        {rejectTerminal ? (
          <button
            type="button"
            className={clsx(
              'sequence-terminal',
              'sequence-terminal--reject',
              rejectTerminal.selected && 'is-selected',
              rejectTerminal.highlighted && 'is-highlighted',
              rejectTerminal.dimmed && 'is-dimmed',
            )}
            aria-label={rejectTerminal.ariaLabel}
            onClick={() => onSelectNode(rejectTerminal.node.id)}
            onMouseEnter={() => onHover(nodeEntityKey(rejectTerminal.node.id))}
            onMouseLeave={() => onHover(undefined)}
          >
            <span className="sequence-terminal__eyebrow">{rejectTerminal.node.id}</span>
            <strong>{rejectTerminal.node.title}</strong>
            {rejectTerminal.node.subtitle ? <span>{rejectTerminal.node.subtitle}</span> : null}
          </button>
        ) : null}
      </div>
      <div className="sequence-panel__status">
        {statusEdges.map((edge) => (
          <button
            key={edge.edge.id}
            type="button"
            className={clsx(
              'sequence-status',
              edge.selected && 'is-selected',
              edge.highlighted && 'is-highlighted',
              edge.dimmed && 'is-dimmed',
            )}
            aria-label={`${edge.edge.id}: ${edge.edge.label}`}
            onClick={() => onSelectEdge(edge.edge.id)}
            onMouseEnter={() => onHover(edgeEntityKey(edge.edge.id))}
            onMouseLeave={() => onHover(undefined)}
          >
            <strong>{edge.edge.id}</strong>
            <span>{edge.edge.label}</span>
            <small>
              {(terminalMap.get(edge.edge.source)?.node.title ??
                visibleSteps.find((step) => step.step.id === edge.edge.source)?.step.title ??
                edge.edge.source)}
              {' -> '}
              {(terminalMap.get(edge.edge.target)?.node.title ??
                visibleSteps.find((step) => step.step.id === edge.edge.target)?.step.title ??
                edge.edge.target)}
            </small>
          </button>
        ))}
      </div>
    </section>
  )
}
