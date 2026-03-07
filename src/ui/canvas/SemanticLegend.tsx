import type { CSSProperties } from 'react'
import clsx from 'clsx'

import {
  getSemanticPresentationsForFamily,
  semanticFamilyOrder,
} from '@/graph/compile/semanticPresentation'

const stateItems = [
  { id: 'selected', label: 'Selected state' },
  { id: 'highlighted', label: 'Highlighted state' },
  { id: 'dimmed', label: 'Dimmed context' },
  { id: 'write-overlay', label: 'Write-path overview overlay' },
] as const

export function SemanticLegend() {
  return (
    <section className="semantic-legend" aria-label="Semantic legend">
      <div className="semantic-legend__header">
        <span className="semantic-overview__eyebrow">Legend</span>
        <strong>Visual grammar</strong>
      </div>

      <div className="semantic-legend__families">
        {semanticFamilyOrder.map((family) => (
          <div key={family} className="semantic-legend__family" data-legend-family={family}>
            <div className="semantic-legend__family-header">
              <strong>{getSemanticPresentationsForFamily(family)[0]?.familyLabel}</strong>
              <span>{getSemanticPresentationsForFamily(family).map((item) => item.semantic).join(' · ')}</span>
            </div>
            <div className="semantic-legend__items">
              {getSemanticPresentationsForFamily(family).map((presentation) => (
                <div
                  key={presentation.semantic}
                  className="semantic-legend__item"
                  data-legend-item={presentation.semantic}
                >
                  <span
                    className={clsx(
                      'semantic-legend__swatch',
                      `semantic-legend__swatch--${presentation.semantic}`,
                      `semantic-legend__swatch-marker--${presentation.marker}`,
                    )}
                    style={{ '--legend-stroke': presentation.stroke } as CSSProperties}
                    aria-hidden="true"
                  />
                  <div>
                    <strong>{presentation.label}</strong>
                    <span>{presentation.semantic}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="semantic-legend__states">
        {stateItems.map((item) => (
          <div key={item.id} className="semantic-legend__state" data-legend-state={item.id}>
            <span className={`semantic-legend__state-chip semantic-legend__state-chip--${item.id}`} aria-hidden="true" />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
