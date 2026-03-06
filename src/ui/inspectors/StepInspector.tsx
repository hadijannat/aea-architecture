import type { ClaimId, GraphManifest, SequenceStep } from '@/graph/spec/schema'

interface StepInspectorProps {
  step: SequenceStep
  manifest: GraphManifest
  onSelectNode(nodeId: string): void
  onSelectEdge(edgeId: string): void
  onApplyClaimFilter(claimId: ClaimId): void
  onApplyStandardFilter(standardId: string): void
}

export function StepInspector({
  step,
  manifest,
  onSelectNode,
  onSelectEdge,
  onApplyClaimFilter,
  onApplyStandardFilter,
}: StepInspectorProps) {
  const linkedNodes = step.linkedNodeIds
    .map((nodeId) => manifest.nodes.find((node) => node.id === nodeId))
    .filter((node): node is GraphManifest['nodes'][number] => Boolean(node))
  const linkedEdges = step.linkedEdgeIds
    .map((edgeId) => manifest.edges.find((edge) => edge.id === edgeId))
    .filter((edge): edge is GraphManifest['edges'][number] => Boolean(edge))
  const claims = [...new Set([...linkedNodes.flatMap((node) => node.claimIds), ...linkedEdges.flatMap((edge) => edge.claimIds)])]
    .map((claimId) => manifest.claims[claimId])
    .filter((claim): claim is NonNullable<typeof claim> => Boolean(claim))
  const standards = [
    ...new Set([...linkedNodes.flatMap((node) => node.standardIds), ...linkedEdges.flatMap((edge) => edge.standardIds)]),
  ]
    .map((standardId) => manifest.standards[standardId])
    .filter((standard): standard is NonNullable<typeof standard> => Boolean(standard))

  return (
    <section className="inspector-section">
      <h2>{step.id}</h2>
      <p className="inspector-section__title">{step.title}</p>
      <p>{step.summary}</p>
      <div className="inspector-grid">
        <div>
          <strong>Sequence order</strong>
          <p>{step.order}</p>
        </div>
        <div>
          <strong>Linked entities</strong>
          <p>
            {linkedNodes.length} blocks · {linkedEdges.length} flows
          </p>
        </div>
      </div>
      {step.notes.length > 0 ? (
        <div>
          <strong>Notes</strong>
          <ul className="inspector-list">
            {step.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {claims.length > 0 ? (
        <div className="inspector-subsection">
          <strong>Claim trace</strong>
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
          <strong>Standards trace</strong>
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
      <div>
        <strong>Linked blocks</strong>
        <div className="inspector-chip-list">
          {linkedNodes.map((node) => (
            <button key={node.id} type="button" className="chip" onClick={() => onSelectNode(node.id)}>
              {node.id} · {node.title}
            </button>
          ))}
        </div>
      </div>
      <div>
        <strong>Linked edges</strong>
        <div className="inspector-chip-list">
          {linkedEdges.map((edge) => (
            <button key={edge.id} type="button" className="chip" onClick={() => onSelectEdge(edge.id)}>
              {edge.id} · {edge.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
