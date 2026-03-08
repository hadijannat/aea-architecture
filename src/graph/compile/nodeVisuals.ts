import type { NodeSpec } from '@/graph/spec/schema'

import {
  resolveBandVisual,
  resolveKindGlyph,
  resolveLaneVisual,
  resolveNodeBandAccent,
} from './visualSystem'

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
  bandAccent: string
  badgeStyle: NodeSpec['visual']['badgeStyle']
  icon?: string
  badgeText: string
  glyphPath: string
  glyphViewBox: string
  glyphLabel: string
  isStructural: boolean
}

export function isStructuralNodeSpec(node: Pick<NodeSpec, 'kind'>): boolean {
  return node.kind === 'lane' || node.kind === 'container' || node.kind === 'band'
}

export function resolveNodeVisual(node: NodeSpec): ResolvedNodeVisual {
  const laneVisual = node.lane ? resolveLaneVisual(node) : undefined
  const bandVisual = node.band ? resolveBandVisual(node) : undefined
  const glyph = resolveKindGlyph(node.kind)
  const fill = laneVisual?.fill ?? bandVisual?.fill ?? node.visual.fill
  const border = laneVisual?.border ?? bandVisual?.accent ?? node.visual.border
  const accent = node.visual.accent ?? border
  const bandAccent = resolveNodeBandAccent(node)

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
    fill,
    border,
    accent,
    bandAccent,
    badgeStyle: node.visual.badgeStyle,
    icon: node.visual.icon,
    badgeText,
    glyphPath: glyph.path,
    glyphViewBox: glyph.viewBox ?? '0 0 16 16',
    glyphLabel: glyph.label,
    isStructural: isStructuralNodeSpec(node),
  }
}
