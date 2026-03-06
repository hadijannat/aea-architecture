import architectureGraphJson from './architecture.graph.json' with { type: 'json' }
import projectionDefaultsJson from './projection.defaults.json' with { type: 'json' }
import {
  graphManifestSchema,
  projectionOverridesSchema,
  type EdgeSpec,
  type EntityKey,
  type GraphManifest,
  type NodeSpec,
  type ProjectionOverrides,
  type SequenceStep,
} from './schema'
import { assertValidGraphManifest } from './validators'

export const nodeEntityKey = (id: string): EntityKey => `node:${id}`
export const edgeEntityKey = (id: string): EntityKey => `edge:${id}`
export const stepEntityKey = (id: string): EntityKey => `step:${id}`
export const claimEntityKey = (id: string): EntityKey => `claim:${id}`
export const standardEntityKey = (id: string): EntityKey => `standard:${id}`

export const graphManifest: GraphManifest = assertValidGraphManifest(
  graphManifestSchema.parse(architectureGraphJson),
)

export const defaultProjectionOverrides: ProjectionOverrides =
  projectionOverridesSchema.parse(projectionDefaultsJson)

export const nodeMap = Object.fromEntries(
  graphManifest.nodes.map((node) => [node.id, node] satisfies [string, NodeSpec]),
) as Record<string, NodeSpec>

export const edgeMap = Object.fromEntries(
  graphManifest.edges.map((edge) => [edge.id, edge] satisfies [string, EdgeSpec]),
) as Record<string, EdgeSpec>

export const stepMap = Object.fromEntries(
  graphManifest.steps.map((step) => [step.id, step] satisfies [string, SequenceStep]),
) as Record<string, SequenceStep>

export const entityLabelMap = {
  ...Object.fromEntries(graphManifest.nodes.map((node) => [nodeEntityKey(node.id), node.title])),
  ...Object.fromEntries(graphManifest.edges.map((edge) => [edgeEntityKey(edge.id), edge.label])),
  ...Object.fromEntries(graphManifest.steps.map((step) => [stepEntityKey(step.id), step.title])),
}

export function resolveGraphNode(id: string): NodeSpec | undefined {
  return nodeMap[id]
}

export function resolveGraphEdge(id: string): EdgeSpec | undefined {
  return edgeMap[id]
}

export function resolveSequenceStep(id: string): SequenceStep | undefined {
  return stepMap[id]
}

export function getGraphManifestJson(): string {
  return JSON.stringify(graphManifest, null, 2)
}
