// @vitest-environment jsdom

import { createElement, Fragment, type CSSProperties, type ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveGraphEdge } from '@/graph/spec/manifest'
import { BaseSemanticEdge } from '@/ui/edges/BaseSemanticEdge'

vi.mock('@xyflow/react', () => ({
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
  it('pins the transparent hit path and interaction width to 12px', () => {
    const spec = resolveGraphEdge('F4')

    if (!spec) {
      throw new Error('Expected F4 edge spec to exist')
    }

    const callbacks = {
      onHover() {},
      onSelectEdge() {},
    }

    const { container } = render(
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
            spec,
            ariaLabel: 'F4 test edge',
            callbacks,
            optional: false,
            selected: false,
            highlighted: false,
            dimmed: false,
            sharedTagFocused: false,
          } as never,
        } as never),
      ),
    )

    const hitPath = container.querySelector('path[data-edge-path]')
    expect(hitPath).not.toBeNull()
    expect(hitPath?.getAttribute('stroke-width')).toBe('12')

    expect(screen.getByTestId('base-edge')).toHaveAttribute('data-interaction-width', '12')
  })
})
