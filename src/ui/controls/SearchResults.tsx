import type { SearchResult } from '@/graph/compile/searchIndex'

interface SearchResultsProps {
  query: string
  results: SearchResult[]
  onOpenResult(result: SearchResult): void
}

const kindLabels: Record<SearchResult['kind'], string> = {
  node: 'Block',
  edge: 'Flow',
  step: 'Step',
  claim: 'Claim',
  standard: 'Standard',
}

export function SearchResults({ query, results, onOpenResult }: SearchResultsProps) {
  if (!query) {
    return null
  }

  return (
    <section className="search-results" aria-label="Direct search results">
      <header className="search-results__header">
        <div>
          <strong>Direct matches</strong>
          <p>Open a graph object or apply a standard or claim filter directly from the query index.</p>
        </div>
        <span>{results.length} shown</span>
      </header>

      {results.length === 0 ? (
        <p className="search-results__empty">No direct matches. Keep the query to use it as a broader graph filter.</p>
      ) : (
        <div className="search-results__grid">
          {results.map((result) => (
            <button
              key={result.key}
              type="button"
              className="search-result-card"
              aria-label={`${kindLabels[result.kind]} result ${result.title}`}
              onClick={() => onOpenResult(result)}
            >
              <span className="search-result-card__kind">{kindLabels[result.kind]}</span>
              <strong>{result.title}</strong>
              <span className="search-result-card__subtitle">{result.subtitle}</span>
              <p>{result.summary}</p>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
