// @vitest-environment jsdom

import { cleanup, render, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DiagramFlowNode } from '@/graph/compile/toReactFlow'
import { AutoFocusSelection } from '@/ui/canvas/ArchitectureCanvas'

const reactFlowMock = vi.hoisted(() => ({
  fitView: vi.fn(),
  getNodesBounds: vi.fn(),
  getViewport: vi.fn(),
}))

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react')

  return {
    ...actual,
    useReactFlow: () => reactFlowMock,
  }
})

function makeNode(id: string) {
  return {
    id,
    position: { x: 420, y: 260 },
    width: 180,
    height: 96,
    data: {
      spec: {
        width: 180,
        height: 96,
      },
    },
  } as DiagramFlowNode
}

describe('AutoFocusSelection', () => {
  beforeEach(() => {
    reactFlowMock.fitView.mockReset().mockResolvedValue(true)
    reactFlowMock.getNodesBounds.mockReset().mockReturnValue({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    })
    reactFlowMock.getViewport.mockReset().mockReturnValue({
      x: 0,
      y: 0,
      zoom: 1,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('retries focus when the selected node appears after the initial effect', async () => {
    const selectedNodeId = 'ACT1'
    const { rerender } = render(createElement(AutoFocusSelection, { nodes: [], selectedNodeId }))

    expect(reactFlowMock.fitView).not.toHaveBeenCalled()

    rerender(createElement(AutoFocusSelection, { nodes: [makeNode(selectedNodeId)], selectedNodeId }))

    await waitFor(() => {
      expect(reactFlowMock.fitView).toHaveBeenCalledTimes(1)
    })

    expect(reactFlowMock.fitView).toHaveBeenCalledWith({
      nodes: [{ id: selectedNodeId }],
      duration: 320,
      padding: 0.16,
      maxZoom: 1.48,
    })
  })
})
