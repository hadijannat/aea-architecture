interface SearchBarProps {
  value: string
  resultsCount: number
  onChange(value: string): void
  onSubmitFirst(): void
  onClear(): void
}

export function SearchBar({ value, resultsCount, onChange, onSubmitFirst, onClear }: SearchBarProps) {
  return (
    <label className="search-bar">
      <div className="search-bar__meta">
        <span>Search</span>
        {value ? (
          <span className="search-bar__hint">
            {resultsCount} direct {resultsCount === 1 ? 'match' : 'matches'} · Enter opens the first result
          </span>
        ) : null}
      </div>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && resultsCount > 0) {
            event.preventDefault()
            onSubmitFirst()
          }
        }}
        placeholder="Jump by ID, title, standard, claim, or sequence step"
        aria-label="Search nodes, edges, standards, and claims"
      />
      {value ? (
        <div className="search-bar__actions">
          <button type="button" className="chip" onClick={onClear}>
            Clear query
          </button>
        </div>
      ) : null}
    </label>
  )
}
