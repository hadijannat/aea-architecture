import type { NodeSpec } from '@/graph/spec/schema'

const kindBadgeMap: Record<NodeSpec['kind'], string> = {
  lane: 'LANE',
  band: 'BAND',
  container: 'ZONE',
  'gateway-module': 'GW',
  'gateway-interface': 'IF',
  'cpc-block': 'SYS',
  'aea-block': 'MOD',
  repository: 'REP',
  policy: 'POL',
  agent: 'AG',
  publisher: 'PUB',
  broker: 'MQ',
  audit: 'LOG',
}

const bandBadgeMap: Record<NonNullable<NodeSpec['band']>, string> = {
  Sense: 'SNS',
  Decide: 'DEC',
  Act: 'ACT',
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
      badgeText = `L${node.lane}`
    } else if (node.kind === 'band' && node.band) {
      badgeText = bandBadgeMap[node.band]
    } else if (node.kind === 'container' && (node.id === 'GW' || node.id === 'AEA')) {
      badgeText = node.id
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
