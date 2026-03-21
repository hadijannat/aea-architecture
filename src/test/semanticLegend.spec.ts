// @vitest-environment jsdom

import { createElement } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SemanticLegend } from '@/ui/canvas/SemanticLegend'

function legendStrokeWidth(container: HTMLElement, semantic: string) {
  const item = container.querySelector(`[data-legend-item="${semantic}"]`)
  const path = item?.querySelector('svg > path')

  return Number.parseFloat(path?.getAttribute('stroke-width') ?? '0')
}

describe('SemanticLegend', () => {
  it('renders distinct stroke tiers for writeback, read-only, and KPI semantics', () => {
    const { container } = render(createElement(SemanticLegend))

    const writebackWidth = legendStrokeWidth(container, 'writeback')
    const readOnlyWidth = legendStrokeWidth(container, 'read-only')
    const kpiWidth = legendStrokeWidth(container, 'kpi')

    expect(writebackWidth).toBeGreaterThan(readOnlyWidth)
    expect(readOnlyWidth).toBeGreaterThan(kpiWidth)
    expect(kpiWidth).toBeCloseTo(1.2)
  })
})
