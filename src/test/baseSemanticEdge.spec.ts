// @vitest-environment jsdom

import { createElement, Fragment, type CSSProperties, type ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { edgeStrokeWidth } from '@/graph/compile/semanticPresentation'
import { resolveGraphEdge } from '@/graph/spec/manifest'
import type { CompiledEdgeData } from '@/graph/compile/toReactFlow'
import { BaseSemanticEdge } from '@/ui/edges/BaseSemanticEdge'

vi.mock('@xyflow/react', () => ({
  Position: {
    Left: 'left',
    Right: 'right',
    Top: 'top',
    Bottom: 'bottom',
  },
  BaseEdge: ({
    path,
    interactionWidth,
    style,
    markerEnd,
  }: {
    path: string
    interactionWidth: number
    style: CSSProperties
    markerEnd?: string
  }) =>
    createElement('path', {
      'data-testid': 'base-edge',
      d: path,
      'data-interaction-width': interactionWidth,
      markerEnd,
      style,
    }),
  EdgeLabelRenderer: ({ children }: { children: ReactNode }) => createElement(Fragment, null, children),
  useViewport: () => ({ zoom: 1 }),
}))

afterEach(() => {
  cleanup()
})

describe('BaseSemanticEdge', () => {
  const spec = resolveGraphEdge('F4')

  if (!spec) {
    throw new Error('Expected F4 edge spec to exist')
  }

  const callbacks = {
    onSelectNode() {},
    onHover() {},
    onSelectEdge() {},
    onSelectStep() {},
    onBadgeClaim() {},
    onBadgeStandard() {},
    onPathAction() {},
  }

  const baseData: CompiledEdgeData = {
    spec,
    ariaLabel: 'F4 test edge',
    sourceTitle: spec.source,
    targetTitle: spec.target,
    standards: [],
    claims: [],
    sourceHandle: 'bottom:validation:0',
    targetHandle: 'top:validation:0',
    callbacks,
    optional: false,
    selected: false,
    hovered: false,
    searchMatched: false,
    localNeighborhood: false,
    highlighted: false,
    groupHighlighted: false,
    dimmed: false,
    supportive: false,
    narrativeMatched: false,
    sharedTagFocused: false,
    labelMode: 'hidden',
    canvasLod: 'navigation',
    routeChannels: {
      gatewayApproachX: 400,
      gatewayLabelX: 360,
      laneReturnX: 200,
      telemetryY: 500,
      policyY: 600,
      contextY: 550,
      rejectionY: 700,
      validationY: 650,
      toolCrossY: 750,
      toolEntryY: 800,
      actTelemetryY: 1500,
      writeY: 1400,
      ackY: 1450,
      monitorSpineX: 1300,
      laneCSpineX: 1100,
      cpcSpineX: 130,
      decideCol01GapX: 1060,
      decideCol12GapX: 1390,
      decideCol23GapX: 1720,
      decideAboveGridY: 526,
      decideRow12GapY: 1091,
      decideBelowGridY: 1340,
    },
    route: {
      path: 'M 0 0 L 10 10',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      label: {
        x: 5,
        y: 5,
        side: 'top',
        offset: 10,
      },
      bridges: [],
    },
  }

  const renderEdge = (overrides: Partial<typeof baseData> = {}) =>
    render(
      createElement(
        'svg',
        null,
        createElement(BaseSemanticEdge as never, {
          id: spec.id,
          source: spec.source,
          target: spec.target,
          sourceX: 1588,
          sourceY: 894,
          targetX: 779,
          targetY: 770,
          data: {
            ...baseData,
            ...overrides,
          },
        } as never),
      ),
    )
  const renderedStrokeWidth = () => Number.parseFloat(screen.getAllByTestId('base-edge')[1]?.style.strokeWidth ?? '0')

  it('pins the transparent hit path and interaction width to 12px', () => {
    const { container } = renderEdge()

    const hitPath = container.querySelector('path[data-edge-path]')
    expect(hitPath).not.toBeNull()
    expect(hitPath?.getAttribute('stroke-width')).toBe('12')

    expect(screen.getAllByTestId('base-edge')).toHaveLength(2)
    expect(screen.getAllByTestId('base-edge').every((edge) => edge.getAttribute('data-interaction-width') === '12')).toBe(
      true,
    )
  })

  it('keeps edge labels hidden in overview mode', () => {
    renderEdge({ labelMode: 'hidden' })

    expect(screen.queryByText('Await approval')).toBeNull()
    expect(screen.queryByText('F4 · Await approval')).toBeNull()
    expect(screen.getAllByTestId('base-edge')).toHaveLength(2)
  })

  it('renders chip and detail labels from the shared label state', () => {
    renderEdge({ labelMode: 'chip' })

    expect(screen.getByRole('button', { name: 'F4 test edge' })).toHaveAttribute('data-edge-label-mode', 'chip')
    expect(screen.getByText('Await approval')).toBeInTheDocument()

    cleanup()
    renderEdge({ labelMode: 'detail' })

    expect(screen.getByRole('button', { name: 'F4 test edge' })).toHaveAttribute('data-edge-label-mode', 'detail')
    expect(screen.getByText('F4 · Await approval')).toBeInTheDocument()
  })

  it('renders bridge hops for crossed secondary routes without changing interaction width', () => {
    const { container } = renderEdge({
      route: {
        ...baseData.route,
        bridges: [{ x: 6, y: 6, orientation: 'horizontal' }],
      },
    })

    const hitPath = container.querySelector('path[data-edge-path]')
    expect(hitPath).not.toBeNull()
    expect(hitPath?.getAttribute('stroke-width')).toBe('12')
    expect(screen.getAllByTestId('base-edge')).toHaveLength(2)
    expect(container.querySelectorAll('path')).toHaveLength(5)
  })

  it('scales dimmed and supportive strokes from the semantic width instead of subtracting fixed pixels', () => {
    const baseWidth = edgeStrokeWidth(spec.style, spec.semantic, baseData.canvasLod)

    renderEdge({ dimmed: true })
    expect(renderedStrokeWidth()).toBeCloseTo(Math.max(baseWidth * 0.7, 0.8))

    cleanup()
    renderEdge({ supportive: true })
    expect(renderedStrokeWidth()).toBeCloseTo(Math.max(baseWidth * 0.82, 0.9))
  })
})
