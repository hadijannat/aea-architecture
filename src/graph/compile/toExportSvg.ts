import { graphManifest, resolveGraphNode } from '@/graph/spec/manifest'
import type { EdgeSpec, GraphManifest, ProjectionOverrides, ProjectionTheme } from '@/graph/spec/schema'
import { resolveEdgeHandles } from '@/layout/ports'
import { buildBoardEdgeRoute, resolveBoardLabelPosition } from '@/layout/board'
import type { DiagramStore } from '@/state/diagramStore'

import { compileSequenceBoard, type SequenceBoardModel } from './sequenceBoard'
import { resolveNodeVisual } from './nodeVisuals'
import {
  getSemanticMarkerGeometry,
  getSemanticMarkerRefX,
  getSemanticMarkerTokens,
  getSemanticPresentation,
  getSemanticStrokeDash,
} from './semanticPresentation'
import { deriveDiagramState } from './toReactFlow'

export type ExportMode = 'viewport' | 'publication'

export interface ExportPanelMetrics {
  width: number
  height: number
}

export interface ExportViewportMetrics {
  architecture: ExportPanelMetrics
  sequence?: ExportPanelMetrics
}

export interface ExportSvgDocument {
  svg: string
  pdf: {
    width: number
    height: number
    unit: 'px' | 'pt'
  }
}

interface ExportTokens {
  titleSize?: string
  nodeTitleSize: string
  structuralTitleSize: string
  subtitleSize: string
  badgeSize: string
  edgeLabelSize: string
  stepTitleSize: string
  stepSummarySize: string
  eyebrowSize: string
  strokeWidths: Record<EdgeSpec['style'], number>
}

interface ExportRenderState {
  effectiveState: DiagramStore
  derivedState: ReturnType<typeof deriveDiagramState>
  includeSequencePanel: boolean
}

interface Point {
  x: number
  y: number
}

interface ExportTransform {
  offsetX: number
  offsetY: number
  scale: number
}

function esc(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function mmToPt(value: number) {
  return (value / 25.4) * 72
}

function ptToMm(value: number) {
  return (value / 72) * 25.4
}

function numericFontSize(value: string) {
  return Number.parseFloat(value)
}

function wrapText(value: string, maxChars: number, maxLines = 3) {
  const words = value.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word
    if (nextLine.length <= maxChars || currentLine.length === 0) {
      currentLine = nextLine
      continue
    }

    lines.push(currentLine)
    currentLine = word

    if (lines.length === maxLines - 1) {
      break
    }
  }

  if (lines.length < maxLines && currentLine) {
    lines.push(currentLine)
  }

  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[.,;:!?]*$/, '')}…`
  }

  return lines
}

function formatPathNumber(value: number) {
  return Number.isInteger(value) ? `${value}` : `${Number(value.toFixed(2))}`
}

function scaledPoint(point: Point, transform: ExportTransform): Point {
  return {
    x: transform.offsetX + point.x * transform.scale,
    y: transform.offsetY + point.y * transform.scale,
  }
}

function anchorPoint(nodeId: string, handleId: 'left' | 'right' | 'top' | 'bottom', state: DiagramStore) {
  const node = resolveGraphNode(nodeId)
  const position = state.layout.positions[nodeId]
  if (!node || !position) {
    return { x: 0, y: 0 }
  }

  switch (handleId) {
    case 'left':
      return { x: position.x, y: position.y + node.height / 2 }
    case 'right':
      return { x: position.x + node.width, y: position.y + node.height / 2 }
    case 'top':
      return { x: position.x + node.width / 2, y: position.y }
    case 'bottom':
      return { x: position.x + node.width / 2, y: position.y + node.height }
  }
}

function buildArchitectureEdgePath(edge: EdgeSpec, state: DiagramStore, projection: ProjectionOverrides) {
  const handles = resolveEdgeHandles(edge, projection.edgeHandles)
  const source = anchorPoint(edge.source, handles.sourceHandle, state)
  const target = anchorPoint(edge.target, handles.targetHandle, state)
  return buildBoardEdgeRoute(edge, source, target)
}

function edgeStroke(edge: EdgeSpec) {
  return getSemanticPresentation(edge.semantic).stroke
}

function edgeWidth(edge: EdgeSpec, tokens: ExportTokens) {
  return tokens.strokeWidths[edge.style]
}

function edgeDash(edge: EdgeSpec) {
  const dash = getSemanticStrokeDash(edge.semantic, edge.style)
  return dash ? `stroke-dasharray="${dash}"` : ''
}

function edgeMarker(edge: EdgeSpec) {
  const markerKind = edge.markers.includes('diode') ? 'diode' : getSemanticPresentation(edge.semantic).marker
  return `marker-${edge.semantic}-${markerKind}`
}

function edgeOpacity(edge: EdgeSpec) {
  return edge.interactive.optional ? 0.6 : 1
}

function architectureEdgeLabel(edge: EdgeSpec) {
  return `${edge.id}${edge.markers.includes('diode') ? ' ⊘' : ''} · ${edge.label}${edge.interactive.optional ? ' (optional)' : ''}`
}

function markerMarkup(marker: ReturnType<typeof getSemanticPresentation>['marker'], color: string) {
  const geometry = getSemanticMarkerGeometry(marker)

  if (geometry.element === 'circle') {
    return `<circle cx="${geometry.cx}" cy="${geometry.cy}" r="${geometry.r}" fill="${color}" />`
  }

  const stroke = geometry.stroke === 'currentColor' ? ` stroke="${color}"` : ''
  const strokeWidth = geometry.strokeWidth ? ` stroke-width="${geometry.strokeWidth}"` : ''
  const strokeLinecap = geometry.strokeLinecap ? ` stroke-linecap="${geometry.strokeLinecap}"` : ''
  const fill = geometry.fill === 'currentColor' ? color : geometry.fill

  return `<path d="${geometry.d}" fill="${fill}"${stroke}${strokeWidth}${strokeLinecap} />`
}

function renderMarkerDefs(surface: 'export-viewport' | 'export-publication', manifest: GraphManifest) {
  const markerDefinitions = [
    ...new Map(
      manifest.edges.map((edge) => {
        const presentation = getSemanticPresentation(edge.semantic)
        const markerKind = edge.markers.includes('diode') ? 'diode' : presentation.marker
        return [
          `${edge.semantic}-${markerKind}`,
          {
            id: `marker-${edge.semantic}-${markerKind}`,
            marker: markerKind,
            stroke: presentation.stroke,
          },
        ] as const
      }),
    ).values(),
  ]
  const markerTokens = getSemanticMarkerTokens(surface)

  return `
  <defs>
    ${markerDefinitions
      .map((definition) => {
        return `<marker id="${definition.id}" viewBox="${markerTokens.viewBox}" markerWidth="${markerTokens.width}" markerHeight="${markerTokens.height}" refX="${getSemanticMarkerRefX(definition.marker)}" refY="${markerTokens.refY}" orient="auto" markerUnits="${markerTokens.units}">
      ${markerMarkup(definition.marker, definition.stroke)}
    </marker>`
      })
      .join('\n')}
  </defs>`
}

interface ExportThemePalette {
  boardBackground: string
  sequenceBackground: string
  pageBackground: string
}

function exportThemePalette(theme: ProjectionTheme): ExportThemePalette {
  if (theme === 'analysis') {
    return {
      boardBackground: '#f8fafc',
      sequenceBackground: '#ffffff',
      pageBackground: '#f8fafc',
    }
  }

  return {
    boardBackground: '#eef3fa',
    sequenceBackground: '#fff6ea',
    pageBackground: '#eef3fa',
  }
}

function buildExportState(
  state: DiagramStore,
  mode: ExportMode,
  manifest: GraphManifest,
): ExportRenderState {
  const effectiveState =
    mode === 'publication'
      ? ({
          ...state,
          ui: {
            ...state.ui,
            selectedNodeId: undefined,
            selectedEdgeId: undefined,
            selectedStepId: undefined,
            hoveredEntityKey: undefined,
            highlightedEntityKeys: [],
            panelBVisible: true,
            filters: {
              claims: [],
              standards: [],
              semanticFamilies: [],
              lanes: [],
              search: '',
              pathPreset: 'all' as const,
            },
          },
          projection: {
            ...state.projection,
            theme: 'analysis',
          },
        } satisfies DiagramStore)
      : state

  return {
    effectiveState,
    derivedState: deriveDiagramState(effectiveState, manifest),
    includeSequencePanel: mode === 'publication' || state.ui.panelBVisible,
  }
}

function viewportTokens(): ExportTokens {
  return {
    nodeTitleSize: '15',
    structuralTitleSize: '18',
    subtitleSize: '12',
    badgeSize: '11',
    edgeLabelSize: '11',
    stepTitleSize: '15',
    stepSummarySize: '12',
    eyebrowSize: '11',
    strokeWidths: {
      bold: 3.6,
      medium: 2.7,
      thin: 1.7,
      dashed: 2.2,
      dotted: 1.8,
    },
  }
}

function publicationTokens(): ExportTokens {
  return {
    titleSize: '9pt',
    nodeTitleSize: '6.5pt',
    structuralTitleSize: '6.5pt',
    subtitleSize: '5.5pt',
    badgeSize: '5pt',
    edgeLabelSize: '5pt',
    stepTitleSize: '6.5pt',
    stepSummarySize: '5.5pt',
    eyebrowSize: '5pt',
    strokeWidths: {
      bold: 1.7,
      medium: 1.2,
      thin: 0.7,
      dashed: 1.2,
      dotted: 0.7,
    },
  }
}

function renderArchitectureNodes(
  state: DiagramStore,
  manifest: GraphManifest,
  visibleNodeIds: Set<string>,
  transform: ExportTransform,
  tokens: ExportTokens,
) {
  return manifest.nodes
    .filter((node) => node.panel.includes('architecture') && visibleNodeIds.has(node.id))
    .map((node) => {
      const position = state.layout.positions[node.id]
      if (!position) {
        return ''
      }

      const visual = resolveNodeVisual(node)
      const isStructural = node.kind === 'lane' || node.kind === 'container' || node.kind === 'band'
      const x = transform.offsetX + position.x * transform.scale
      const y = transform.offsetY + position.y * transform.scale
      const width = node.width * transform.scale
      const height = node.height * transform.scale
      const titleY = y + (isStructural ? 28 : 24) * transform.scale
      const subtitleY = titleY + 20 * transform.scale
      const badgeY = subtitleY + 18 * transform.scale
      const standards = node.standardIds
        .map((id) => manifest.standards[id]?.label)
        .filter(Boolean)
        .slice(0, 2)
        .join(' · ')

      return `
  <g id="node-${node.id}">
    <title>${esc(node.id)}: ${esc(node.title)}</title>
    <desc>${esc(node.description)}</desc>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${Math.max(4, (isStructural ? 20 : 16) * transform.scale)}" fill="${visual.fill}" stroke="${visual.border}" stroke-width="${isStructural ? 1.1 : 1.3}" />
    <text x="${x + 16 * transform.scale}" y="${y + 15 * transform.scale}" fill="${visual.accent}" font-size="${tokens.badgeSize}" font-family="Arial, sans-serif" font-weight="700">${esc(visual.badgeText)}</text>
    <text x="${x + 16 * transform.scale}" y="${titleY}" fill="#1f2937" font-size="${isStructural ? tokens.structuralTitleSize : tokens.nodeTitleSize}" font-family="Arial, sans-serif" font-weight="700">${esc(node.id === node.title ? node.title : `${node.id} · ${node.title}`)}</text>
    ${node.subtitle ? `<text x="${x + 16 * transform.scale}" y="${subtitleY}" fill="#4b5563" font-size="${tokens.subtitleSize}" font-family="Arial, sans-serif">${esc(node.subtitle)}</text>` : ''}
    ${standards ? `<text x="${x + 16 * transform.scale}" y="${badgeY}" fill="${visual.accent}" font-size="${tokens.badgeSize}" font-family="Arial, sans-serif">${esc(standards)}</text>` : ''}
  </g>`
    })
    .join('\n')
}

function renderArchitectureEdges(
  state: DiagramStore,
  manifest: GraphManifest,
  visibleEdgeIds: Set<string>,
  transform: ExportTransform,
  tokens: ExportTokens,
) {
  return manifest.edges
    .filter((edge) => edge.panel.includes('architecture') && visibleEdgeIds.has(edge.id))
    .map((edge) => {
      const route = buildArchitectureEdgePath(edge, state, state.projection)
      const labelPoint = scaledPoint(resolveBoardLabelPosition(route.label), transform)

      return `
  <g id="edge-${edge.id}" data-edge-optional="${edge.interactive.optional ? 'true' : 'false'}" opacity="${edgeOpacity(edge)}">
    <title>${esc(edge.id)}: ${esc(edge.label)}</title>
    <desc>${esc(edge.inspector.rationale)}</desc>
    <path d="${translateScaledPath(route.path, transform)}" fill="none" stroke="${edgeStroke(edge)}" stroke-width="${edgeWidth(edge, tokens)}" ${edgeDash(edge)} marker-end="url(#${edgeMarker(edge)})" />
    <text id="edge-label-${edge.id}" x="${labelPoint.x}" y="${labelPoint.y}" text-anchor="middle" fill="${edgeStroke(edge)}" font-size="${tokens.edgeLabelSize}" font-family="Arial, sans-serif">${esc(architectureEdgeLabel(edge))}</text>
  </g>`
    })
    .join('\n')
}

function translateScaledPath(path: string, transform: ExportTransform) {
  const tokens = path.match(/[MLQ]|-?\d+(?:\.\d+)?/g) ?? []
  const segments: string[] = []

  for (let index = 0; index < tokens.length;) {
    const command = tokens[index]
    index += 1

    if (command === 'M' || command === 'L') {
      const x = Number(tokens[index]) * transform.scale + transform.offsetX
      const y = Number(tokens[index + 1]) * transform.scale + transform.offsetY
      index += 2
      segments.push(`${command} ${formatPathNumber(x)} ${formatPathNumber(y)}`)
      continue
    }

    if (command === 'Q') {
      const controlX = Number(tokens[index]) * transform.scale + transform.offsetX
      const controlY = Number(tokens[index + 1]) * transform.scale + transform.offsetY
      const endX = Number(tokens[index + 2]) * transform.scale + transform.offsetX
      const endY = Number(tokens[index + 3]) * transform.scale + transform.offsetY
      index += 4
      segments.push(
        `${command} ${formatPathNumber(controlX)} ${formatPathNumber(controlY)} ${formatPathNumber(endX)} ${formatPathNumber(endY)}`,
      )
      continue
    }

    throw new Error(`Unsupported path command in export transform: ${command}`)
  }

  return segments.join(' ')
}

function renderSequenceBoard(
  model: SequenceBoardModel,
  transform: ExportTransform,
  tokens: ExportTokens,
) {
  const visibleSteps = model.steps.filter((step) => !step.hidden)
  const visibleTerminals = model.terminals.filter((terminal) => !terminal.hidden)
  const visibleEdges = model.edges.filter((edge) => !edge.hidden)

  const terminals = visibleTerminals
    .map((terminal) => {
      const visual = resolveNodeVisual(terminal.node)
      const x = transform.offsetX + terminal.rect.x * transform.scale
      const y = transform.offsetY + terminal.rect.y * transform.scale
      const width = terminal.rect.width * transform.scale
      const height = terminal.rect.height * transform.scale
      const subtitleLines = terminal.node.subtitle
        ? wrapText(
            terminal.node.subtitle,
            Math.max(16, Math.floor(((width - 28 * transform.scale) / numericFontSize(tokens.stepSummarySize)) * 1.6)),
            2,
          )
        : []

      return `
  <g id="sequence-node-${terminal.node.id}">
    <title>${esc(terminal.node.id)}: ${esc(terminal.node.title)}</title>
    <desc>${esc(terminal.node.description)}</desc>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${Math.max(4, 18 * transform.scale)}" fill="${visual.fill}" stroke="${visual.border}" stroke-width="1.2" />
    <text x="${x + 14 * transform.scale}" y="${y + 22 * transform.scale}" fill="${visual.accent}" font-size="${tokens.eyebrowSize}" font-family="Arial, sans-serif" letter-spacing="0.16em">${esc(terminal.node.id)}</text>
    <text x="${x + 14 * transform.scale}" y="${y + 42 * transform.scale}" fill="#1f2937" font-size="${tokens.stepTitleSize}" font-family="Arial, sans-serif" font-weight="700">${esc(terminal.node.title)}</text>
    ${
      subtitleLines.length > 0
        ? `<text x="${x + 14 * transform.scale}" y="${y + 58 * transform.scale}" fill="#4b5563" font-size="${tokens.stepSummarySize}" font-family="Arial, sans-serif">${subtitleLines
            .map(
              (line, index) =>
                `<tspan x="${x + 14 * transform.scale}" dy="${index === 0 ? 0 : 11 * transform.scale}">${esc(line)}</tspan>`,
            )
            .join('')}</text>`
        : ''
    }
  </g>`
    })
    .join('\n')

  const steps = visibleSteps
    .map((step) => {
      const x = transform.offsetX + step.rect.x * transform.scale
      const y = transform.offsetY + step.rect.y * transform.scale
      const width = step.rect.width * transform.scale
      const height = step.rect.height * transform.scale
      const summaryLines = wrapText(
        step.step.summary,
        Math.max(16, Math.floor(((width - 36 * transform.scale) / numericFontSize(tokens.stepSummarySize)) * 1.6)),
        3,
      )

      return `
  <g id="sequence-step-${step.step.id}">
    <title>${esc(step.step.id)}: ${esc(step.step.title)}</title>
    <desc>${esc(step.step.summary)}</desc>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${Math.max(4, 22 * transform.scale)}" fill="#fffdf9" stroke="#d7a16d" stroke-width="1.2" />
    <text x="${x + 18 * transform.scale}" y="${y + 22 * transform.scale}" fill="#7c5a32" font-size="${tokens.eyebrowSize}" font-family="Arial, sans-serif" letter-spacing="0.16em">${esc(step.step.id)}</text>
    <text x="${x + 18 * transform.scale}" y="${y + 46 * transform.scale}" fill="#1f2937" font-size="${tokens.stepTitleSize}" font-family="Arial, sans-serif" font-weight="700">${esc(step.step.title)}</text>
    <text x="${x + 18 * transform.scale}" y="${y + 68 * transform.scale}" fill="#4b5563" font-size="${tokens.stepSummarySize}" font-family="Arial, sans-serif">${summaryLines
      .map(
        (line, index) =>
          `<tspan x="${x + 18 * transform.scale}" dy="${index === 0 ? 0 : 12 * transform.scale}">${esc(line)}</tspan>`,
      )
      .join('')}</text>
  </g>`
    })
    .join('\n')

  const edges = visibleEdges
    .map((edge) => {
      const semanticStroke = edgeStroke(edge.edge)
      const labelPoint = scaledPoint({ x: edge.labelX, y: edge.labelY }, transform)
      const labelY =
        edge.edge.semantic === 'sequence'
          ? labelPoint.y - 12 * transform.scale
          : edge.edge.semantic === 'rejection'
            ? labelPoint.y + 16 * transform.scale
            : labelPoint.y - 6 * transform.scale

      return `
  <g id="sequence-edge-${edge.edge.id}">
    <title>${esc(edge.edge.id)}: ${esc(edge.edge.label)}</title>
    <desc>${esc(edge.edge.inspector.rationale)}</desc>
    <path d="${translateScaledPath(edge.path, transform)}" fill="none" stroke="${semanticStroke}" stroke-width="${edgeWidth(edge.edge, tokens)}" ${edgeDash(edge.edge)} marker-end="url(#${edgeMarker(edge.edge)})" />
    <text x="${labelPoint.x}" y="${labelY}" text-anchor="middle" fill="${semanticStroke}" font-size="${tokens.edgeLabelSize}" font-family="Arial, sans-serif">${esc(edge.edge.id)}</text>
  </g>`
    })
    .join('\n')

  return `${terminals}\n${edges}\n${steps}`
}

function viewportCropRect(
  viewport: DiagramStore['ui']['viewport'],
  metrics: ExportPanelMetrics,
) {
  return {
    x: -viewport.x / viewport.zoom,
    y: -viewport.y / viewport.zoom,
    width: metrics.width / viewport.zoom,
    height: metrics.height / viewport.zoom,
  }
}

function buildViewportSvgDocument(
  state: DiagramStore,
  manifest: GraphManifest,
  metrics: ExportViewportMetrics,
): ExportSvgDocument {
  const tokens = viewportTokens()
  const { effectiveState, derivedState, includeSequencePanel } = buildExportState(state, 'viewport', manifest)
  const palette = exportThemePalette(effectiveState.projection.theme)
  const boardModel = includeSequencePanel ? compileSequenceBoard(effectiveState, derivedState, manifest) : undefined
  const architectureMetrics = metrics.architecture
  const sequenceMetrics =
    includeSequencePanel
      ? metrics.sequence ?? { width: architectureMetrics.width, height: 240 }
      : undefined
  const cropRect = viewportCropRect(effectiveState.ui.viewport, architectureMetrics)
  const totalHeight = architectureMetrics.height + (sequenceMetrics?.height ?? 0)

  return {
    svg: `
<svg xmlns="http://www.w3.org/2000/svg" width="${architectureMetrics.width}" height="${totalHeight}" viewBox="0 0 ${architectureMetrics.width} ${totalHeight}" role="img" data-export-theme="${effectiveState.projection.theme}">
  <title>AEA Architecture Viewport Export</title>
  <desc>${esc(
    includeSequencePanel
      ? 'Viewport export of the live AEA architecture canvas with the synchronized VoR sequence panel.'
      : 'Viewport export of the live AEA architecture canvas.',
  )}</desc>
  ${renderMarkerDefs('export-viewport', manifest)}
  <svg x="0" y="0" width="${architectureMetrics.width}" height="${architectureMetrics.height}" viewBox="${cropRect.x} ${cropRect.y} ${cropRect.width} ${cropRect.height}">
    <rect x="${cropRect.x - 1000}" y="${cropRect.y - 1000}" width="${cropRect.width + 2000}" height="${cropRect.height + 2000}" fill="${palette.boardBackground}" />
    ${renderArchitectureNodes(
      effectiveState,
      manifest,
      derivedState.visibleNodeIds,
      { offsetX: 0, offsetY: 0, scale: 1 },
      tokens,
    )}
    ${renderArchitectureEdges(
      effectiveState,
      manifest,
      derivedState.visibleEdgeIds,
      { offsetX: 0, offsetY: 0, scale: 1 },
      tokens,
    )}
  </svg>
  ${
    includeSequencePanel && boardModel && sequenceMetrics
      ? `<svg x="0" y="${architectureMetrics.height}" width="${sequenceMetrics.width}" height="${sequenceMetrics.height}" viewBox="0 0 ${boardModel.width} ${boardModel.height}" preserveAspectRatio="xMidYMid meet">
    <rect x="0" y="0" width="${boardModel.width}" height="${boardModel.height}" fill="${palette.sequenceBackground}" />
    ${renderSequenceBoard(boardModel, { offsetX: 0, offsetY: 0, scale: 1 }, tokens)}
  </svg>`
      : ''
  }
</svg>`,
    pdf: {
      width: architectureMetrics.width,
      height: totalHeight,
      unit: 'px',
    },
  }
}

function buildPublicationSvgDocument(
  state: DiagramStore,
  manifest: GraphManifest,
): ExportSvgDocument {
  const tokens = publicationTokens()
  const { effectiveState, derivedState } = buildExportState(state, 'publication', manifest)
  const palette = exportThemePalette(effectiveState.projection.theme)
  const boardModel = compileSequenceBoard(effectiveState, derivedState, manifest)
  const figureWidthPt = mmToPt(183)
  const architectureScale = figureWidthPt / manifest.layoutDefaults.canvas.width
  const architectureHeightPt = manifest.layoutDefaults.canvas.height * architectureScale
  const sequenceHeightPt = boardModel.height * architectureScale
  const architectureFrameY = 34
  const sequenceTitleY = architectureFrameY + architectureHeightPt + 20
  const sequenceFrameY = sequenceTitleY + 14
  const totalHeightPt = sequenceFrameY + sequenceHeightPt + 18

  return {
    svg: `
<svg xmlns="http://www.w3.org/2000/svg" width="183mm" height="${ptToMm(totalHeightPt)}mm" viewBox="0 0 ${figureWidthPt} ${totalHeightPt}" role="img" data-export-theme="${effectiveState.projection.theme}">
  <title>AEA Architecture Publication Export</title>
  <desc>${esc(
    'Publication export of the AEA architecture figure including the full architecture board and the VoR domain-transition sequence.',
  )}</desc>
  ${renderMarkerDefs('export-publication', manifest)}
  <rect x="0" y="0" width="${figureWidthPt}" height="${totalHeightPt}" fill="${palette.pageBackground}" />
  <text x="9" y="18" fill="#1f2937" font-size="${tokens.titleSize}" font-family="Arial, sans-serif" font-weight="700">(a) Architecture Across NOA Zones</text>
  ${renderArchitectureNodes(
    effectiveState,
    manifest,
    derivedState.visibleNodeIds,
    { offsetX: 0, offsetY: architectureFrameY, scale: architectureScale },
    tokens,
  )}
  ${renderArchitectureEdges(
    effectiveState,
    manifest,
    derivedState.visibleEdgeIds,
    { offsetX: 0, offsetY: architectureFrameY, scale: architectureScale },
    tokens,
  )}
  <text x="9" y="${sequenceTitleY}" fill="#1f2937" font-size="${tokens.titleSize}" font-family="Arial, sans-serif" font-weight="700">(b) VoR Domain-Transition Sequence (NE 178, 2025)</text>
  <rect x="0" y="${sequenceFrameY - 8}" width="${figureWidthPt}" height="${sequenceHeightPt + 12}" fill="${palette.sequenceBackground}" />
  ${renderSequenceBoard(
    boardModel,
    { offsetX: 0, offsetY: sequenceFrameY, scale: architectureScale },
    tokens,
  )}
</svg>`,
    pdf: {
      width: figureWidthPt,
      height: totalHeightPt,
      unit: 'pt',
    },
  }
}

export function buildExportSvgDocument(
  state: DiagramStore,
  options: {
    mode: ExportMode
    viewportMetrics?: ExportViewportMetrics
  },
  manifest: GraphManifest = graphManifest,
): ExportSvgDocument {
  if (options.mode === 'publication') {
    return buildPublicationSvgDocument(state, manifest)
  }

  const viewportMetrics = options.viewportMetrics ?? {
    architecture: {
      width: manifest.layoutDefaults.canvas.width,
      height: manifest.layoutDefaults.canvas.height,
    },
    sequence: state.ui.panelBVisible
      ? {
          width: manifest.layoutDefaults.canvas.width,
          height: 240,
        }
      : undefined,
  }

  return buildViewportSvgDocument(state, manifest, viewportMetrics)
}
