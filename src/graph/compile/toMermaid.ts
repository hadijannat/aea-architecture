import { graphManifest, resolveGraphNode } from '@/graph/spec/manifest'
import type { GraphManifest } from '@/graph/spec/schema'

function sanitizeId(id: string) {
  return id.replace(/[^a-zA-Z0-9_]/g, '_')
}

export function toMermaid(panel: 'architecture' | 'vor-sequence', manifest: GraphManifest = graphManifest): string {
  if (panel === 'vor-sequence') {
    const orderedSteps = [...manifest.steps].sort(
      (left, right) => left.order - right.order || left.id.localeCompare(right.id),
    )
    const terminalLines = manifest.nodes
      .filter((node) => node.panel.includes('vor-sequence'))
      .map((node) => `${sanitizeId(node.id)}["${node.id}: ${node.title}"]`)
    const stepLines = orderedSteps.map((step) => `${sanitizeId(step.id)}["${step.id}: ${step.title}"]`)
    const edgeLines = manifest.edges
      .filter((edge) => edge.panel.includes('vor-sequence'))
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((edge) => {
        const connector = edge.style === 'dashed' ? '-.->' : '-->'
        return `${sanitizeId(edge.source)} ${connector}|"${edge.label}"| ${sanitizeId(edge.target)}`
      })

    return ['flowchart LR', ...terminalLines, ...stepLines, ...edgeLines].join('\n')
  }

  const laneIds = ['LANE_A', 'LANE_B', 'LANE_C']
  const lines: string[] = ['flowchart LR']

  for (const laneId of laneIds) {
    const lane = manifest.nodes.find((node) => node.id === laneId)
    if (!lane) {
      continue
    }
    lines.push(`subgraph ${sanitizeId(lane.id)}["${lane.title}: ${lane.subtitle ?? ''}"]`)
    for (const node of manifest.nodes.filter(
      (item) => item.panel.includes('architecture') && item.lane === lane.lane && item.kind !== 'lane' && item.kind !== 'container' && item.kind !== 'band',
    )) {
      lines.push(`  ${sanitizeId(node.id)}["${node.id}: ${node.title}"]`)
    }
    lines.push('end')
  }

  for (const edge of manifest.edges.filter((item) => item.panel.includes('architecture'))) {
    const sourceNode = resolveGraphNode(edge.source)
    const targetNode = resolveGraphNode(edge.target)
    if (!sourceNode || !targetNode) {
      continue
    }
    const connector = edge.style === 'dashed' ? '-.->' : edge.style === 'dotted' ? '-..->' : '-->'
    lines.push(
      `${sanitizeId(edge.source)} ${connector}|"${edge.id}: ${edge.label}"| ${sanitizeId(edge.target)}`,
    )
  }

  return lines.join('\n')
}
