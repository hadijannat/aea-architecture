import type { GraphManifest } from '@/graph/spec/schema'

interface StandardChipsProps {
  manifest: GraphManifest
  selected: string[]
  onToggle(standardId: string): void
}

export function StandardChips({ manifest, selected, onToggle }: StandardChipsProps) {
  return (
    <div className="chip-row chip-row--standards">
      {Object.values(manifest.standards).map((standard) => (
        <button
          key={standard.id}
          type="button"
          className={selected.includes(standard.id) ? 'chip is-active' : 'chip'}
          onClick={() => onToggle(standard.id)}
        >
          {standard.label}
        </button>
      ))}
    </div>
  )
}

