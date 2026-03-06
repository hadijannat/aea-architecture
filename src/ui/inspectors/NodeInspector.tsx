import type { ClaimId, GraphManifest, NodeSpec } from '@/graph/spec/schema'

interface NodeInspectorProps {
  node: NodeSpec
  manifest: GraphManifest
  annotation?: string
  onAnnotationChange(value: string): void
  onPathAction(nodeId: string, direction: 'upstream' | 'downstream'): void
  onSelectEdge(edgeId: string): void
  onSelectStep(stepId: string): void
  onApplyClaimFilter(claimId: ClaimId): void
  onApplyStandardFilter(standardId: string): void
}

export function NodeInspector({
  node,
  manifest,
  annotation,
  onAnnotationChange,
  onPathAction,
  onSelectEdge,
  onSelectStep,
  onApplyClaimFilter,
  onApplyStandardFilter,
}: NodeInspectorProps) {
  const relatedEdges = node.inspector.relatedEdgeIds
    .map((edgeId) => manifest.edges.find((edge) => edge.id === edgeId))
    .filter((edge): edge is GraphManifest['edges'][number] => Boolean(edge))
  const relatedSteps = node.inspector.relatedStepIds
    .map((stepId) => manifest.steps.find((step) => step.id === stepId))
    .filter((step): step is GraphManifest['steps'][number] => Boolean(step))
  const standards = node.standardIds
    .map((id) => manifest.standards[id])
    .filter((standard): standard is NonNullable<typeof standard> => Boolean(standard))
  const claims = node.claimIds
    .map((id) => manifest.claims[id])
    .filter((claim): claim is NonNullable<typeof claim> => Boolean(claim))

  return (
    <section className="inspector-section">
      <h2>{node.id}</h2>
      <p className="inspector-section__title">{node.title}</p>
      <p>{node.description}</p>
      <div className="inspector-grid">
        <div>
          <strong>Role</strong>
          <p>{node.inspector.role}</p>
        </div>
        <div>
          <strong>Lane / Band</strong>
          <p>
            {node.lane ?? 'Boundary'}
            {node.band ? ` / ${node.band}` : ''}
          </p>
        </div>
      </div>
      <div className="inspector-tags">
        {node.standardIds.map((id) => (
          <span key={id} className="badge badge--standard">
            {manifest.standards[id]?.label}
          </span>
        ))}
        {node.claimIds.map((id) => (
          <span key={id} className="badge badge--claim">
            {id}
          </span>
        ))}
      </div>
      <p>{node.inspector.rationale}</p>
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
      {relatedEdges.length > 0 || relatedSteps.length > 0 ? (
        <div className="inspector-subsection">
          <strong>Participation map</strong>
          {relatedEdges.length > 0 ? (
            <div className="inspector-chip-list">
              {relatedEdges.map((edge) => (
                <button key={edge.id} type="button" className="chip" onClick={() => onSelectEdge(edge.id)}>
                  {edge.id} · {edge.label}
                </button>
              ))}
            </div>
          ) : null}
          {relatedSteps.length > 0 ? (
            <div className="inspector-chip-list">
              {relatedSteps.map((step) => (
                <button key={step.id} type="button" className="chip" onClick={() => onSelectStep(step.id)}>
                  {step.id} · {step.title}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {node.inspector.notes.length > 0 ? (
        <div>
          <strong>Notes</strong>
          <ul className="inspector-list">
            {node.inspector.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {node.inspector.risks.length > 0 ? (
        <div>
          <strong>Risks</strong>
          <ul className="inspector-list">
            {node.inspector.risks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="inspector-actions">
        <button type="button" onClick={() => onPathAction(node.id, 'upstream')}>
          Show upstream
        </button>
        <button type="button" onClick={() => onPathAction(node.id, 'downstream')}>
          Show downstream
        </button>
        {node.inspector.relatedStepIds[0] ? (
          <button type="button" onClick={() => onSelectStep(node.inspector.relatedStepIds[0])}>
            Open linked step
          </button>
        ) : null}
      </div>
      <label className="annotation-field">
        <span>Author note</span>
        <textarea value={annotation ?? ''} onChange={(event) => onAnnotationChange(event.target.value)} rows={4} />
      </label>
    </section>
  )
}
