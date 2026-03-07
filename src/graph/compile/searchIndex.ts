import { describeSemanticForSearch } from '@/graph/compile/semanticPresentation'
import type { ClaimRef, GraphManifest, StandardRef } from '@/graph/spec/schema'

export type SearchResultKind = 'node' | 'edge' | 'step' | 'claim' | 'standard'

export interface SearchResult {
  key: string
  kind: SearchResultKind
  id: string
  title: string
  subtitle: string
  summary: string
  score: number
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

function scoreCandidate(query: string, values: string[]) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return 0
  }

  let best = 0
  for (const rawValue of unique(values)) {
    const value = rawValue.toLowerCase()
    if (value === normalizedQuery) {
      best = Math.max(best, 130)
      continue
    }
    if (value.startsWith(normalizedQuery)) {
      best = Math.max(best, 95)
      continue
    }
    if (value.includes(normalizedQuery)) {
      best = Math.max(best, 72)
      continue
    }

    const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean)
    if (queryTokens.length > 1 && queryTokens.every((token) => value.includes(token))) {
      best = Math.max(best, 54)
    }
  }

  return best
}

function scoreSupplement(values: string[], query: string, amount: number) {
  return scoreCandidate(query, values) > 0 ? amount : 0
}

function summarizeStandard(standard: StandardRef) {
  return standard.version ? `${standard.label} ${standard.version}` : standard.label
}

function summarizeClaim(claim: ClaimRef) {
  return `${claim.id} · ${claim.label}`
}

export function buildSearchResults(
  query: string,
  manifest: GraphManifest,
  limit = 12,
): SearchResult[] {
  const normalizedQuery = query.trim()
  if (!normalizedQuery) {
    return []
  }

  const results: SearchResult[] = []

  for (const node of manifest.nodes) {
    const score =
      scoreCandidate(normalizedQuery, [node.id, ...node.aliases, node.title, node.subtitle ?? '']) +
      scoreSupplement([node.description, node.inspector.role, ...node.tags], normalizedQuery, 18) +
      scoreSupplement(
        [
          ...node.standardIds.map((id) => manifest.standards[id]?.label ?? ''),
          ...node.claimIds.map((id) => manifest.claims[id]?.label ?? ''),
        ],
        normalizedQuery,
        12,
      )

    if (score === 0) {
      continue
    }

    results.push({
      key: `node:${node.id}`,
      kind: 'node',
      id: node.id,
      title: `${node.id} · ${node.title}`,
      subtitle: [node.lane ? `Lane ${node.lane}` : 'Boundary', node.band].filter(Boolean).join(' · '),
      summary: node.inspector.role,
      score,
    })
  }

  for (const edge of manifest.edges) {
    const sourceTitle = manifest.nodes.find((node) => node.id === edge.source)?.title ?? edge.source
    const targetTitle = manifest.nodes.find((node) => node.id === edge.target)?.title ?? edge.target
    const score =
      scoreCandidate(normalizedQuery, [edge.id, ...edge.aliases, edge.label]) +
      scoreSupplement([edge.semantic, edge.detail ?? '', ...edge.tags], normalizedQuery, 16) +
      scoreSupplement([sourceTitle, targetTitle], normalizedQuery, 12)

    if (score === 0) {
      continue
    }

    results.push({
      key: `edge:${edge.id}`,
      kind: 'edge',
      id: edge.id,
      title: `${edge.id} · ${edge.label}`,
      subtitle: describeSemanticForSearch(edge.semantic),
      summary: `${sourceTitle} -> ${targetTitle}`,
      score,
    })
  }

  for (const step of manifest.steps) {
    const score =
      scoreCandidate(normalizedQuery, [step.id, step.title]) +
      scoreSupplement([step.summary, ...step.notes], normalizedQuery, 18)

    if (score === 0) {
      continue
    }

    results.push({
      key: `step:${step.id}`,
      kind: 'step',
      id: step.id,
      title: `${step.id} · ${step.title}`,
      subtitle: `Sequence step ${step.order}`,
      summary: step.summary,
      score,
    })
  }

  for (const claim of Object.values(manifest.claims)) {
    const score =
      scoreCandidate(normalizedQuery, [claim.id, claim.label]) +
      scoreSupplement([claim.summary], normalizedQuery, 20)

    if (score === 0) {
      continue
    }

    results.push({
      key: `claim:${claim.id}`,
      kind: 'claim',
      id: claim.id,
      title: summarizeClaim(claim),
      subtitle: 'Claim filter',
      summary: claim.summary,
      score,
    })
  }

  for (const standard of Object.values(manifest.standards)) {
    const score =
      scoreCandidate(normalizedQuery, [standard.id, standard.label, standard.version ?? '']) +
      scoreSupplement([standard.url ?? ''], normalizedQuery, 10)

    if (score === 0) {
      continue
    }

    results.push({
      key: `standard:${standard.id}`,
      kind: 'standard',
      id: standard.id,
      title: summarizeStandard(standard),
      subtitle: standard.id,
      summary: standard.url ?? 'Standard anchor filter',
      score,
    })
  }

  return results
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, limit)
}
