import type { ClaimId, EdgeSpec, GraphManifest } from '@/graph/spec/schema'

interface EdgeInspectorProps {
  edge: EdgeSpec
  manifest: GraphManifest
  onPathAction(nodeId: string, direction: 'upstream' | 'downstream'): void
  onSelectNode(nodeId: string): void
  onSelectStep(stepId: string): void
  onApplyClaimFilter(claimId: ClaimId): void
  onApplyStandardFilter(standardId: string): void
}

export function EdgeInspector({
  edge,
  manifest,
  onPathAction,
  onSelectNode,
  onSelectStep,
  onApplyClaimFilter,
  onApplyStandardFilter,
}: EdgeInspectorProps) {
  const sourceTitle = manifest.nodes.find((node) => node.id === edge.source)?.title ?? edge.source
  const targetTitle = manifest.nodes.find((node) => node.id === edge.target)?.title ?? edge.target
  const standards = edge.standardIds
    .map((id) => manifest.standards[id])
    .filter((standard): standard is NonNullable<typeof standard> => Boolean(standard))
  const claims = edge.claimIds
    .map((id) => manifest.claims[id])
    .filter((claim): claim is NonNullable<typeof claim> => Boolean(claim))
  const linkedSteps = edge.interactive.relatedStepIds
    .map((stepId) => manifest.steps.find((step) => step.id === stepId))
    .filter((step): step is GraphManifest['steps'][number] => Boolean(step))
  const primaryTitle = edge.displayLabel ?? edge.label
  const showRawLabel = Boolean(edge.displayLabel)
  const renderingSemantics = [
    ...(edge.interactive.optional
      ? [
          {
            label: 'Optional path',
            description: 'Rendered with reduced emphasis because this flow is documentation-only or conditional.',
          },
        ]
      : []),
    ...edge.markers.map((marker) => {
      if (marker === 'diode') {
        return {
          label: 'Diode marker',
          description: 'One-way boundary; the edge must not imply a return path.',
        }
      }

      return {
        label: `${marker} marker`,
        description: 'Additional edge annotation.',
      }
    }),
  ]

  return (
    <section className="inspector-section">
      <h2>{edge.id}</h2>
      <p className="inspector-section__title">{primaryTitle}</p>
      {showRawLabel ? (
        <div className="inspector-section__detail">
          <p>{edge.label}</p>
          {edge.detail ? <p>{edge.detail}</p> : null}
        </div>
      ) : null}
      <div className="inspector-grid">
        <div>
          <strong>Source</strong>
          <p>{sourceTitle}</p>
        </div>
        <div>
          <strong>Target</strong>
          <p>{targetTitle}</p>
        </div>
        <div>
          <strong>Semantic</strong>
          <p>{edge.semantic}</p>
        </div>
        <div>
          <strong>Direction</strong>
          <p>{edge.direction}</p>
        </div>
      </div>
      {!showRawLabel && edge.detail ? <p>{edge.detail}</p> : null}
      <div className="inspector-actions">
        <button type="button" onClick={() => onSelectNode(edge.source)}>
          Open source block
        </button>
        <button type="button" onClick={() => onSelectNode(edge.target)}>
          Open target block
        </button>
      </div>
      <div className="inspector-tags">
        {edge.standardIds.map((id) => (
          <span key={id} className="badge badge--standard">
            {manifest.standards[id]?.label}
          </span>
        ))}
        {edge.claimIds.map((id) => (
          <span key={id} className="badge badge--claim">
            {id}
          </span>
        ))}
      </div>
      <p>{edge.inspector.rationale}</p>
      {renderingSemantics.length > 0 ? (
        <div className="inspector-subsection">
          <strong>Rendering semantics</strong>
          <ul className="inspector-list">
            {renderingSemantics.map((item) => (
              <li key={item.label}>
                <strong>{item.label}:</strong> {item.description}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {linkedSteps.length > 0 ? (
        <div className="inspector-subsection">
          <strong>Sequence mapping</strong>
          <div className="inspector-chip-list">
            {linkedSteps.map((step) => (
              <button key={step.id} type="button" className="chip" onClick={() => onSelectStep(step.id)}>
                {step.id} · {step.title}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {claims.length > 0 ? (
        <div className="inspector-subsection">
          <strong>Claim coverage</strong>
          <div className="inspector-detail-grid">
            {claims.map((claim) => (
              <button
                key={claim.id}
                type="button"
                className="inspector-detail-card inspector-detail-card--interactive"
                onClick={() => onApplyClaimFilter(claim.id)}
              >
                <span className="inspector-detail-card__eyebrow">Claim {claim.id}</span>
                <strong>{claim.label}</strong>
                <p>{claim.summary}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {standards.length > 0 ? (
        <div className="inspector-subsection">
          <strong>Standards anchors</strong>
          <div className="inspector-detail-grid">
            {standards.map((standard) => (
              <button
                key={standard.id}
                type="button"
                className="inspector-detail-card inspector-detail-card--interactive"
                onClick={() => onApplyStandardFilter(standard.id)}
              >
                <span className="inspector-detail-card__eyebrow">{standard.id}</span>
                <strong>{standard.label}</strong>
                <p>{standard.version ?? 'Version not specified in the manifest.'}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {edge.inspector.constraints.length > 0 ? (
        <div>
          <strong>Constraints</strong>
          <ul className="inspector-list">
            {edge.inspector.constraints.map((constraint) => (
              <li key={constraint}>{constraint}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {edge.inspector.notes.length > 0 ? (
        <div>
          <strong>Notes</strong>
          <ul className="inspector-list">
            {edge.inspector.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {edge.inspector.risks.length > 0 ? (
        <div>
          <strong>Risks</strong>
          <ul className="inspector-list">
            {edge.inspector.risks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="inspector-actions">
        <button type="button" onClick={() => onPathAction(edge.source, 'upstream')}>
          Show upstream path
        </button>
        <button type="button" onClick={() => onPathAction(edge.target, 'downstream')}>
          Show downstream path
        </button>
      </div>
    </section>
  )
}
