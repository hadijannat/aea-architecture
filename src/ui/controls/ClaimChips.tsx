import type { ClaimId, GraphManifest } from '@/graph/spec/schema'

interface ClaimChipsProps {
  manifest: GraphManifest
  selected: ClaimId[]
  onToggle(claimId: ClaimId): void
}

export function ClaimChips({ manifest, selected, onToggle }: ClaimChipsProps) {
  return (
    <div className="chip-row claim-chip-row">
      {Object.values(manifest.claims).map((claim) => (
        <button
          key={claim.id}
          type="button"
          className={selected.includes(claim.id) ? 'chip claim-chip is-active' : 'chip claim-chip'}
          aria-pressed={selected.includes(claim.id)}
          aria-label={`${claim.id}: ${claim.label}`}
          aria-description={claim.summary}
          title={claim.summary}
          onClick={() => onToggle(claim.id)}
        >
          <span className="claim-chip__id">{claim.id}</span>
          <span className="claim-chip__label">{claim.label}</span>
        </button>
      ))}
    </div>
  )
}
