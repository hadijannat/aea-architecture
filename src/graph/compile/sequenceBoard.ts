import { buildNodeAriaLabel, buildStepAriaLabel } from '@/a11y/aria'
import { graphManifest } from '@/graph/spec/manifest'
import type {
  EdgeSpec,
  GraphManifest,
  NodeSpec,
  SequenceStep,
} from '@/graph/spec/schema'
import type { DiagramStore } from '@/state/diagramStore'

import type { DerivedDiagramState } from './toReactFlow'
import { sortSequenceEdges, sortSequenceSteps } from './sequence'

export interface BoardRect {
  x: number
  y: number
  width: number
  height: number
}

export interface SequenceBoardStepModel {
  step: SequenceStep
  rect: BoardRect
  ariaLabel: string
  selected: boolean
  highlighted: boolean
  dimmed: boolean
  hidden: boolean
}

export interface SequenceBoardTerminalModel {
  node: NodeSpec
  rect: BoardRect
  ariaLabel: string
  selected: boolean
  highlighted: boolean
  dimmed: boolean
  hidden: boolean
}

export interface SequenceBoardEdgeModel {
  edge: EdgeSpec
  path: string
  labelX: number
  labelY: number
  selected: boolean
  highlighted: boolean
  dimmed: boolean
  hidden: boolean
}

export interface SequenceBoardModel {
  width: number
  height: number
  ribbonY: number
  ackRouteY: number
  steps: SequenceBoardStepModel[]
  edges: SequenceBoardEdgeModel[]
  terminals: SequenceBoardTerminalModel[]
}

interface Point {
  x: number
  y: number
}

function point(x: number, y: number): Point {
  return { x, y }
}

function polyline(points: Point[]): string {
  return points.map((entry, index) => `${index === 0 ? 'M' : 'L'} ${entry.x} ${entry.y}`).join(' ')
}

function segmentMidpoint(points: Point[]): Point {
  let longestDistance = -1
  let longestMidpoint = points[0] ?? { x: 0, y: 0 }

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const distance = Math.abs(current.x - next.x) + Math.abs(current.y - next.y)
    if (distance > longestDistance) {
      longestDistance = distance
      longestMidpoint = {
        x: (current.x + next.x) / 2,
        y: (current.y + next.y) / 2,
      }
    }
  }

  return longestMidpoint
}

function isSequenceTerminal(node: NodeSpec) {
  return node.panel.includes('vor-sequence')
}

function terminalSort(left: NodeSpec, right: NodeSpec) {
  if (left.id === 'PB_AEA') {
    return -1
  }
  if (right.id === 'PB_AEA') {
    return 1
  }
  if (left.id === 'PB_REJECT_OUT') {
    return 1
  }
  if (right.id === 'PB_REJECT_OUT') {
    return -1
  }
  return left.id.localeCompare(right.id)
}

function edgeRoute(
  edge: EdgeSpec,
  stepRects: Record<string, BoardRect>,
  terminalRects: Record<string, BoardRect>,
  ackRouteY: number,
) {
  const sourceRect = stepRects[edge.source] ?? terminalRects[edge.source]
  const targetRect = stepRects[edge.target] ?? terminalRects[edge.target]

  if (!sourceRect || !targetRect) {
    return {
      path: '',
      labelX: 0,
      labelY: 0,
    }
  }

  const sourceRight = point(sourceRect.x + sourceRect.width, sourceRect.y + sourceRect.height / 2)
  const sourceBottom = point(sourceRect.x + sourceRect.width / 2, sourceRect.y + sourceRect.height)
  const targetLeft = point(targetRect.x, targetRect.y + targetRect.height / 2)
  const targetTop = point(targetRect.x + targetRect.width / 2, targetRect.y)
  const targetRight = point(targetRect.x + targetRect.width, targetRect.y + targetRect.height / 2)

  let points: Point[]

  switch (edge.id) {
    case 'PB_F1':
    case 'PB_F2':
    case 'PB_F3':
    case 'PB_F4':
      points = [sourceRight, targetLeft]
      break
    case 'PB_ACK':
      points = [
        sourceBottom,
        point(sourceBottom.x, ackRouteY),
        point(targetRight.x + 14, ackRouteY),
        point(targetRight.x + 14, targetRight.y),
        targetRight,
      ]
      break
    case 'PB_REJECT':
      points = [
        sourceBottom,
        point(sourceBottom.x, targetTop.y - 18),
        point(targetTop.x, targetTop.y - 18),
        targetTop,
      ]
      break
    default:
      points = [sourceRight, targetLeft]
  }

  const label = segmentMidpoint(points)
  return {
    path: polyline(points),
    labelX: label.x,
    labelY: label.y,
  }
}

export function compileSequenceBoard(
  state: DiagramStore,
  derivedState: DerivedDiagramState,
  manifest: GraphManifest = graphManifest,
): SequenceBoardModel {
  const hasHighlights =
    derivedState.highlightedNodeIds.size > 0 ||
    derivedState.highlightedEdgeIds.size > 0 ||
    derivedState.highlightedStepIds.size > 0

  const boardPaddingX = 32
  const ribbonY = 56
  const stepWidth = 206
  const stepHeight = 96
  const stepGap = 18
  const leftTerminalRect: BoardRect = {
    x: boardPaddingX,
    y: ribbonY + 14,
    width: 156,
    height: 68,
  }
  const firstStepX = leftTerminalRect.x + leftTerminalRect.width + 34
  const stepRects = Object.fromEntries(
    sortSequenceSteps(manifest.steps).map((step, index) => [
      step.id,
      {
        x: firstStepX + index * (stepWidth + stepGap),
        y: ribbonY,
        width: stepWidth,
        height: stepHeight,
      } satisfies BoardRect,
    ]),
  ) as Record<string, BoardRect>
  const pb4Rect = stepRects.PB4
  const rejectRect: BoardRect = {
    x: (pb4Rect?.x ?? firstStepX) + 44,
    y: ribbonY + stepHeight + 74,
    width: 184,
    height: 70,
  }
  const terminalRects: Record<string, BoardRect> = {
    PB_AEA: leftTerminalRect,
    PB_REJECT_OUT: rejectRect,
  }
  const ackRouteY = ribbonY + stepHeight + 54
  const width = (stepRects.PB5?.x ?? firstStepX) + stepWidth + boardPaddingX
  const height = rejectRect.y + rejectRect.height + 28

  const steps = sortSequenceSteps(manifest.steps).map((step) => {
    const highlighted = derivedState.highlightedStepIds.has(step.id)

    return {
      step,
      rect: stepRects[step.id],
      ariaLabel: buildStepAriaLabel(step),
      selected: state.ui.selectedStepId === step.id,
      highlighted,
      dimmed: hasHighlights && !highlighted,
      hidden: !derivedState.visibleStepIds.has(step.id),
    }
  })

  const terminals = manifest.nodes
    .filter((node) => isSequenceTerminal(node))
    .sort(terminalSort)
    .map((node) => {
      const highlighted = derivedState.highlightedNodeIds.has(node.id)

      return {
        node,
        rect: terminalRects[node.id],
        ariaLabel: buildNodeAriaLabel(node, manifest),
        selected: state.ui.selectedNodeId === node.id,
        highlighted,
        dimmed: hasHighlights && !highlighted,
        hidden: !derivedState.visibleNodeIds.has(node.id),
      }
    })

  const edges = sortSequenceEdges(
    manifest.edges.filter((edge) => edge.panel.includes('vor-sequence')),
    manifest,
  ).map((edge) => {
    const highlighted = derivedState.highlightedEdgeIds.has(edge.id)
    const route = edgeRoute(edge, stepRects, terminalRects, ackRouteY)

    return {
      edge,
      ...route,
      selected: state.ui.selectedEdgeId === edge.id,
      highlighted,
      dimmed: hasHighlights && !highlighted,
      hidden: !derivedState.visibleEdgeIds.has(edge.id),
    }
  })

  return {
    width,
    height,
    ribbonY,
    ackRouteY,
    steps,
    edges,
    terminals,
  }
}
