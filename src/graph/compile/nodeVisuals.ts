import type { NodeSpec } from '@/graph/spec/schema'

const kindBadgeMap: Record<NodeSpec['kind'], string> = {
  lane: 'Lane',
  band: 'Band',
  container: 'Zone',
  'gateway-module': 'Gateway',
  'gateway-interface': 'Interface',
  'cpc-block': 'System',
  'aea-block': 'Process',
  repository: 'Store',
  policy: 'Policy',
  agent: 'Agent',
  publisher: 'Publish',
  broker: 'Queue',
  audit: 'Audit',
}

const bandBadgeMap: Record<NonNullable<NodeSpec['band']>, string> = {
  Sense: 'Sense',
  Decide: 'Decide',
  Act: 'Act',
}

export interface ResolvedNodeVisual {
  fill: string
  border: string
  accent: string
  badgeStyle: NodeSpec['visual']['badgeStyle']
  icon?: string
  badgeText: string
  isStructural: boolean
}

export function isStructuralNodeSpec(node: Pick<NodeSpec, 'kind'>): boolean {
  return node.kind === 'lane' || node.kind === 'container' || node.kind === 'band'
}

export function resolveNodeVisual(node: NodeSpec): ResolvedNodeVisual {
  const accent = node.visual.accent ?? node.visual.border

  let badgeText = node.visual.icon?.trim()
  if (!badgeText) {
    if (node.kind === 'lane' && node.lane) {
      badgeText = `Lane ${node.lane}`
    } else if (node.kind === 'band' && node.band) {
      badgeText = bandBadgeMap[node.band]
    } else if (node.kind === 'container' && node.id === 'GW') {
      badgeText = 'Gateway'
    } else if (node.kind === 'container' && node.id === 'AEA') {
      badgeText = 'AEA'
    } else {
      badgeText = kindBadgeMap[node.kind]
    }
  }

  return {
    fill: node.visual.fill,
    border: node.visual.border,
    accent,
    badgeStyle: node.visual.badgeStyle,
    icon: node.visual.icon,
    badgeText,
    isStructural: isStructuralNodeSpec(node),
  }
}
