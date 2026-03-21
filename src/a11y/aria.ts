import type { EdgeSpec, GraphManifest, NodeSpec, SequenceStep } from '@/graph/spec/schema'

export function buildNodeAriaLabel(node: NodeSpec, manifest: GraphManifest): string {
  const lane = node.lane ? `lane ${node.lane}` : 'shared boundary'
  const band = node.band ? `, ${node.band} band` : ''
  const standards = node.standardIds
    .map((id) => manifest.standards[id]?.label)
    .filter(Boolean)
    .join(', ')

  return `${node.id}: ${node.title}, ${lane}${band}. ${node.description}${standards ? ` Standards: ${standards}.` : ''}`
}

export function buildEdgeAriaLabel(edge: EdgeSpec, manifest: GraphManifest): string {
  const source = manifest.nodes.find((node) => node.id === edge.source)?.title ?? edge.source
  const target = manifest.nodes.find((node) => node.id === edge.target)?.title ?? edge.target
  const t0Suffix = edge.tags.includes('t0') ? ' Shared t0 snapshot.' : ''
  const semanticText = edge.detail ? `${edge.label}. ${edge.detail}` : edge.label
  return `${edge.id}: ${edge.semantic} edge from ${source} to ${target}, direction ${edge.direction}. ${semanticText}${t0Suffix}`
}

export function buildStepAriaLabel(step: SequenceStep): string {
  return `${step.id}: ${step.title}. ${step.summary}`
}
