import { z } from 'zod'

export const panelIdSchema = z.enum(['architecture', 'vor-sequence'])
export const laneIdSchema = z.enum(['A', 'B', 'C'])
export const bandIdSchema = z.enum(['Sense', 'Decide', 'Act'])
export const nodeKindSchema = z.enum([
  'lane',
  'band',
  'container',
  'gateway-module',
  'gateway-interface',
  'cpc-block',
  'aea-block',
  'repository',
  'policy',
  'agent',
  'publisher',
  'broker',
  'audit',
])
export const nodeTypeSchema = z.enum([
  'LaneNode',
  'ContainerNode',
  'GatewayModuleNode',
  'GatewayInterfaceNode',
  'SystemNode',
  'RepositoryNode',
  'PolicyNode',
  'AgentNode',
  'PublisherNode',
  'BrokerNode',
  'AuditNode',
])
export const edgeSemanticSchema = z.enum([
  'read-only',
  'gateway-internal',
  'normalization',
  'retrieval',
  'policy-soft',
  'policy-hard',
  'proposal',
  'validation',
  'tool-call',
  'subscription',
  'writeback',
  'status-ack',
  'rejection',
  'kpi',
  'audit',
  'sequence',
])
export const edgeSemanticFamilySchema = z.enum([
  'context',
  'policy',
  'runtime',
  'write',
  'feedback',
  'telemetry',
  'sequence',
])
export const edgeStyleSchema = z.enum(['bold', 'medium', 'thin', 'dashed', 'dotted'])
export const claimIdSchema = z.enum(['C1', 'C2', 'C3', 'C4', 'C5', 'C6'])
export const handlePositionSchema = z.enum(['left', 'right', 'top', 'bottom'])
export const projectionThemeSchema = z.enum(['default', 'analysis'])

export const standardRefSchema = z.object({
  id: z.string(),
  label: z.string(),
  version: z.string().optional(),
  url: z.string().url().optional(),
})

export const claimRefSchema = z.object({
  id: claimIdSchema,
  label: z.string(),
  summary: z.string(),
})

export const sourceSpecSchema = z.object({
  title: z.string(),
  path: z.string(),
  authority: z.enum(['markdown']),
  importedAt: z.string(),
  notes: z.array(z.string()).default([]),
  aliases: z
    .array(
      z.object({
        original: z.string(),
        canonical: z.string(),
        rationale: z.string(),
      }),
    )
    .default([]),
})

export const nodeInspectorSchema = z.object({
  role: z.string(),
  rationale: z.string(),
  risks: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
  relatedEdgeIds: z.array(z.string()).default([]),
  relatedStepIds: z.array(z.string()).default([]),
})

export const nodeVisualSchema = z.object({
  fill: z.string(),
  border: z.string(),
  accent: z.string().optional(),
  icon: z.string().optional(),
  badgeStyle: z.enum(['pill', 'inline']).default('pill'),
})

export const nodeSpecSchema = z.object({
  id: z.string(),
  aliases: z.array(z.string()).default([]),
  panel: z.array(panelIdSchema).min(1),
  lane: laneIdSchema.optional(),
  band: bandIdSchema.optional(),
  kind: nodeKindSchema,
  nodeType: nodeTypeSchema,
  title: z.string(),
  subtitle: z.string().optional(),
  description: z.string(),
  standardIds: z.array(z.string()).default([]),
  claimIds: z.array(claimIdSchema).default([]),
  tags: z.array(z.string()).default([]),
  parentId: z.string().optional(),
  width: z.number(),
  height: z.number(),
  collapsed: z.boolean().optional(),
  fixed: z.boolean().default(false),
  visual: nodeVisualSchema,
  inspector: nodeInspectorSchema,
})

export const edgeInspectorSchema = z.object({
  rationale: z.string(),
  constraints: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
})

export const edgeSpecSchema = z.object({
  id: z.string(),
  aliases: z.array(z.string()).default([]),
  panel: z.array(panelIdSchema).min(1),
  band: bandIdSchema.optional(),
  source: z.string(),
  target: z.string(),
  semantic: edgeSemanticSchema,
  style: edgeStyleSchema,
  label: z.string(),
  displayLabel: z.string().optional(),
  detail: z.string().optional(),
  direction: z.enum(['ltr', 'rtl', 'ttb', 'btt']),
  standardIds: z.array(z.string()).default([]),
  claimIds: z.array(claimIdSchema).default([]),
  tags: z.array(z.string()).default([]),
  markers: z.array(z.enum(['diode'])).default([]),
  interactive: z.object({
    relatedStepIds: z.array(z.string()).default([]),
    sourceHandle: handlePositionSchema.optional(),
    targetHandle: handlePositionSchema.optional(),
    highlightGroup: z.string().optional(),
    optional: z.boolean().default(false),
  }),
  inspector: edgeInspectorSchema,
})

export const sequenceStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  linkedNodeIds: z.array(z.string()).default([]),
  linkedEdgeIds: z.array(z.string()).default([]),
  order: z.number(),
  notes: z.array(z.string()).default([]),
})

export const interactionRuleSchema = z.object({
  id: z.string(),
  title: z.string(),
  triggerIds: z.array(z.string()).min(1),
  relatedNodeIds: z.array(z.string()).default([]),
  relatedEdgeIds: z.array(z.string()).default([]),
  relatedStepIds: z.array(z.string()).default([]),
  focusPath: z.enum(['write', 'policy', 'telemetry', 'all']).default('all'),
})

export const layoutDefaultsSchema = z.object({
  canvas: z.object({
    width: z.number(),
    height: z.number(),
  }),
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number(),
  }),
  lanes: z.record(
    laneIdSchema,
    z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    }),
  ),
  gateway: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    ne177Height: z.number(),
    ne178Height: z.number(),
  }),
  aea: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    bandHeights: z.record(bandIdSchema, z.number()),
  }),
})

export const graphManifestSchema = z.object({
  specVersion: z.string(),
  sourceSpec: sourceSpecSchema,
  standards: z.record(z.string(), standardRefSchema),
  claims: z.record(claimIdSchema, claimRefSchema),
  nodes: z.array(nodeSpecSchema),
  edges: z.array(edgeSpecSchema),
  steps: z.array(sequenceStepSchema),
  interactionRules: z.array(interactionRuleSchema),
  layoutDefaults: layoutDefaultsSchema,
})

export const projectionSnapshotStateSchema = z.object({
  nodePositions: z.record(z.string(), z.object({ x: z.number(), y: z.number() })).default({}),
  edgeHandles: z
    .record(
      z.string(),
      z.object({
        sourceHandle: handlePositionSchema.optional(),
        targetHandle: handlePositionSchema.optional(),
      }),
    )
    .default({}),
  panelBSize: z.number().default(24),
  panelBVisible: z.boolean().default(true),
  theme: projectionThemeSchema.default('default'),
})

export const projectionSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  state: projectionSnapshotStateSchema,
})

export const projectionOverridesSchema = z.object({
  version: z.string(),
  nodePositions: z.record(z.string(), z.object({ x: z.number(), y: z.number() })).default({}),
  edgeHandles: z
    .record(
      z.string(),
      z.object({
        sourceHandle: handlePositionSchema.optional(),
        targetHandle: handlePositionSchema.optional(),
      }),
    )
    .default({}),
  collapsedNodeIds: z.array(z.string()).default([]),
  expandedNoteIds: z.array(z.string()).default([]),
  annotations: z.record(z.string(), z.string()).default({}),
  theme: projectionThemeSchema.default('default'),
  exportPreset: z.enum(['viewport', 'publication']).default('viewport'),
  panelBSize: z.number().default(24),
  panelBVisible: z.boolean().default(true),
  snapshots: z.array(projectionSnapshotSchema).default([]),
})

export type PanelId = z.infer<typeof panelIdSchema>
export type LaneId = z.infer<typeof laneIdSchema>
export type BandId = z.infer<typeof bandIdSchema>
export type NodeKind = z.infer<typeof nodeKindSchema>
export type NodeType = z.infer<typeof nodeTypeSchema>
export type EdgeSemantic = z.infer<typeof edgeSemanticSchema>
export type EdgeSemanticFamily = z.infer<typeof edgeSemanticFamilySchema>
export type EdgeStyle = z.infer<typeof edgeStyleSchema>
export type ClaimId = z.infer<typeof claimIdSchema>
export type StandardRef = z.infer<typeof standardRefSchema>
export type ClaimRef = z.infer<typeof claimRefSchema>
export type NodeSpec = z.infer<typeof nodeSpecSchema>
export type EdgeSpec = z.infer<typeof edgeSpecSchema>
export type SequenceStep = z.infer<typeof sequenceStepSchema>
export type InteractionRule = z.infer<typeof interactionRuleSchema>
export type LayoutDefaults = z.infer<typeof layoutDefaultsSchema>
export type GraphManifest = z.infer<typeof graphManifestSchema>
export type ProjectionSnapshot = z.infer<typeof projectionSnapshotSchema>
export type ProjectionOverrides = z.infer<typeof projectionOverridesSchema>
export type ProjectionTheme = z.infer<typeof projectionThemeSchema>

export type EntityKind = 'node' | 'edge' | 'step' | 'claim' | 'standard'
export type EntityKey = `${EntityKind}:${string}`
