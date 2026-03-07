import { graphManifest } from '@/graph/spec/manifest'
import type { EdgeSpec, GraphManifest, NodeSpec } from '@/graph/spec/schema'

import { sortSequenceEdges, sortSequenceSteps } from './sequence'

const mermaidExportNotice = '%% Canonical topology export only; schematic and not viewport/state-aware.'

function sanitizeId(id: string) {
  return id.replace(/[^a-zA-Z0-9_]/g, '_')
}

function mermaidText(value: string) {
  return value.replaceAll('"', "'").replaceAll('\n', ' ')
}

function nodeLabel(node: NodeSpec) {
  return mermaidText(`${node.id}: ${node.title}${node.subtitle ? ` · ${node.subtitle}` : ''}`)
}

function subgraphLabel(node: NodeSpec) {
  return mermaidText(`${node.id}: ${node.title}${node.subtitle ? ` · ${node.subtitle}` : ''}`)
}

function edgeConnector(edge: EdgeSpec) {
  if (edge.style === 'dashed') {
    return '-.->'
  }
  if (edge.style === 'dotted') {
    return '-..->'
  }
  return '-->'
}

function edgeColor(edge: EdgeSpec) {
  switch (edge.semantic) {
    case 'writeback':
      return '#d35400'
    case 'status-ack':
    case 'rejection':
      return '#7d8597'
    case 'tool-call':
      return '#148a8a'
    case 'subscription':
    case 'kpi':
    case 'read-only':
      return '#2d6cdf'
    case 'audit':
      return '#8d6e63'
    default:
      return '#455a75'
  }
}

function edgeWidth(edge: EdgeSpec) {
  switch (edge.style) {
    case 'bold':
      return '3.2px'
    case 'medium':
      return '2.2px'
    case 'thin':
      return '1.3px'
    case 'dashed':
      return '1.8px'
    case 'dotted':
      return '1.4px'
  }
}

function edgeLabel(edge: EdgeSpec) {
  const annotations: string[] = []
  if (edge.markers.includes('diode')) {
    annotations.push('diode')
  }
  if (edge.style === 'bold') {
    annotations.push('bold')
  } else if (edge.style === 'medium') {
    annotations.push('medium')
  } else if (edge.style === 'thin') {
    annotations.push('thin')
  }

  const annotationSuffix = annotations.length > 0 ? ` [${annotations.join(', ')}]` : ''
  return mermaidText(`${edge.id}: ${edge.label}${annotationSuffix}`)
}

function renderNode(lines: string[], node: NodeSpec, indent: number) {
  lines.push(`${'  '.repeat(indent)}${sanitizeId(node.id)}["${nodeLabel(node)}"]`)
}

function renderSubgraph(lines: string[], id: string, label: string, direction: 'LR' | 'TB', indent: number, body: () => void) {
  const pad = '  '.repeat(indent)
  lines.push(`${pad}subgraph ${sanitizeId(id)}["${mermaidText(label)}"]`)
  lines.push(`${pad}  direction ${direction}`)
  body()
  lines.push(`${pad}end`)
}

function renderChildrenByParent(
  parentId: string,
  nodes: NodeSpec[],
  lines: string[],
  indent: number,
) {
  const children = nodes.filter((node) => node.parentId === parentId)
  for (const child of children) {
    if (child.kind === 'band' || child.kind === 'container') {
      renderSubgraph(lines, child.id, subgraphLabel(child), child.kind === 'band' ? 'LR' : 'TB', indent, () => {
        renderChildrenByParent(child.id, nodes, lines, indent + 1)
      })
      continue
    }
    renderNode(lines, child, indent)
  }
}

function buildArchitectureMermaid(manifest: GraphManifest) {
  const lines: string[] = [mermaidExportNotice, 'flowchart LR']
  const architectureNodes = manifest.nodes.filter((node) => node.panel.includes('architecture'))
  const laneA = architectureNodes.find((node) => node.id === 'LANE_A')
  const laneB = architectureNodes.find((node) => node.id === 'LANE_B')
  const laneC = architectureNodes.find((node) => node.id === 'LANE_C')
  const gateway = architectureNodes.find((node) => node.id === 'GW')
  const aea = architectureNodes.find((node) => node.id === 'AEA')
  const bandOrder = ['BAND_SENSE', 'BAND_DECIDE', 'BAND_ACT']

  if (laneA) {
    renderSubgraph(lines, laneA.id, subgraphLabel(laneA), 'TB', 0, () => {
      const laneNodes = architectureNodes.filter(
        (node) => node.lane === 'A' && !node.parentId && node.kind !== 'lane',
      )
      for (const node of laneNodes) {
        renderNode(lines, node, 1)
      }
    })
  }

  if (gateway) {
    const gatewayChildren = architectureNodes.filter((node) => node.parentId === gateway.id)
    const ne177Nodes = gatewayChildren.filter((node) => node.kind === 'gateway-module')
    const ne178Nodes = gatewayChildren.filter((node) => node.kind === 'gateway-interface')

    renderSubgraph(lines, gateway.id, subgraphLabel(gateway), 'TB', 0, () => {
      renderSubgraph(lines, 'GW_NE177', 'NE 177 read-only chain', 'TB', 1, () => {
        for (const node of ne177Nodes) {
          renderNode(lines, node, 2)
        }
      })
      renderSubgraph(lines, 'GW_NE178', 'NE 178 VoR interface', 'TB', 1, () => {
        for (const node of ne178Nodes) {
          renderNode(lines, node, 2)
        }
      })
    })
  }

  if (laneB) {
    renderSubgraph(lines, laneB.id, subgraphLabel(laneB), 'TB', 0, () => {
      if (aea) {
        renderSubgraph(lines, aea.id, subgraphLabel(aea), 'TB', 1, () => {
          for (const bandId of bandOrder) {
            const band = architectureNodes.find((node) => node.id === bandId)
            if (!band) {
              continue
            }
            renderSubgraph(lines, band.id, subgraphLabel(band), 'LR', 2, () => {
              renderChildrenByParent(band.id, architectureNodes, lines, 3)
            })
          }
        })
      }

      const laneNodes = architectureNodes.filter(
        (node) =>
          node.lane === 'B' &&
          !node.parentId &&
          node.kind !== 'lane' &&
          node.id !== 'AEA',
      )
      for (const node of laneNodes) {
        renderNode(lines, node, 1)
      }
    })
  }

  if (laneC) {
    renderSubgraph(lines, laneC.id, subgraphLabel(laneC), 'TB', 0, () => {
      const laneNodes = architectureNodes.filter(
        (node) => node.lane === 'C' && !node.parentId && node.kind !== 'lane',
      )
      for (const node of laneNodes) {
        renderNode(lines, node, 1)
      }
    })
  }

  const architectureEdges = manifest.edges.filter((edge) => edge.panel.includes('architecture'))
  architectureEdges.forEach((edge, index) => {
    lines.push(
      `${sanitizeId(edge.source)} ${edgeConnector(edge)}|"${edgeLabel(edge)}"| ${sanitizeId(edge.target)}`,
    )
    lines.push(
      `linkStyle ${index} stroke:${edgeColor(edge)},stroke-width:${edgeWidth(edge)},color:${edgeColor(edge)}`,
    )
  })

  return lines.join('\n')
}

function buildSequenceMermaid(manifest: GraphManifest) {
  const lines: string[] = [mermaidExportNotice, 'flowchart LR']
  const terminalNodes = manifest.nodes.filter((node) => node.panel.includes('vor-sequence'))
  for (const node of terminalNodes) {
    renderNode(lines, node, 0)
  }

  for (const step of sortSequenceSteps(manifest.steps)) {
    lines.push(`${sanitizeId(step.id)}["${mermaidText(`${step.id}: ${step.title}`)}"]`)
  }

  const sequenceEdges = sortSequenceEdges(
    manifest.edges.filter((edge) => edge.panel.includes('vor-sequence')),
    manifest,
  )

  sequenceEdges.forEach((edge, index) => {
    lines.push(`${sanitizeId(edge.source)} ${edgeConnector(edge)}|"${edgeLabel(edge)}"| ${sanitizeId(edge.target)}`)
    lines.push(
      `linkStyle ${index} stroke:${edgeColor(edge)},stroke-width:${edgeWidth(edge)},color:${edgeColor(edge)}`,
    )
  })

  return lines.join('\n')
}

export function toMermaid(panel: 'architecture' | 'vor-sequence', manifest: GraphManifest = graphManifest): string {
  if (panel === 'vor-sequence') {
    return buildSequenceMermaid(manifest)
  }

  return buildArchitectureMermaid(manifest)
}
