import type { ClaimId, GraphManifest } from '@/graph/spec/schema'

interface ClaimChipsProps {
  manifest: GraphManifest
  selected: ClaimId[]
  onToggle(claimId: ClaimId): void
}

export function ClaimChips({ manifest, selected, onToggle }: ClaimChipsProps) {
  return (
    <div className="chip-row">
      {Object.values(manifest.claims).map((claim) => (
        <button
          key={claim.id}
          type="button"
          className={selected.includes(claim.id) ? 'chip is-active' : 'chip'}
          aria-pressed={selected.includes(claim.id)}
          onClick={() => onToggle(claim.id)}
        >
          {claim.id}
        </button>
      ))}
    </div>
  )
}
