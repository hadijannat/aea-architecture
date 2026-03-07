import clsx from 'clsx'

import {
  edgeStrokeWidth,
  getSemanticLegendStyle,
  getSemanticMarkerGeometry,
  getSemanticMarkerRefX,
  getSemanticPresentationsForFamily,
  getSemanticStrokeDash,
  semanticFamilyOrder,
  semanticMarkerDimensions,
} from '@/graph/compile/semanticPresentation'

const stateItems = [
  { id: 'selected', label: 'Selected state' },
  { id: 'highlighted', label: 'Highlighted state' },
  { id: 'dimmed', label: 'Dimmed context' },
  { id: 'write-overlay', label: 'Write-path overview overlay' },
] as const

function renderMarkerShape(
  marker: ReturnType<typeof getSemanticPresentationsForFamily>[number],
  color: string,
) {
  const geometry = getSemanticMarkerGeometry(marker.marker)

  if (geometry.element === 'circle') {
    return <circle cx={geometry.cx} cy={geometry.cy} r={geometry.r} fill={color} />
  }

  return (
    <path
      d={geometry.d}
      fill={geometry.fill === 'currentColor' ? color : geometry.fill}
      stroke={geometry.stroke === 'currentColor' ? color : undefined}
      strokeWidth={geometry.strokeWidth}
      strokeLinecap={geometry.strokeLinecap}
    />
  )
}

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
                  <svg
                    className={clsx('semantic-legend__swatch', `semantic-legend__swatch--${presentation.semantic}`)}
                    viewBox="0 0 44 16"
                    aria-hidden="true"
                  >
                    <defs>
                      <marker
                        id={`legend-marker-${presentation.semantic}`}
                        viewBox={semanticMarkerDimensions.viewBox}
                        markerWidth={semanticMarkerDimensions.width}
                        markerHeight={semanticMarkerDimensions.height}
                        refX={getSemanticMarkerRefX(presentation.marker)}
                        refY={semanticMarkerDimensions.refY}
                        orient="auto"
                        markerUnits="userSpaceOnUse"
                      >
                        {renderMarkerShape(presentation, presentation.stroke)}
                      </marker>
                    </defs>
                    <path
                      d="M 3 8 L 35 8"
                      fill="none"
                      stroke={presentation.stroke}
                      strokeWidth={Math.max(2.2, edgeStrokeWidth(getSemanticLegendStyle(presentation.semantic)))}
                      strokeLinecap="round"
                      strokeDasharray={getSemanticStrokeDash(
                        presentation.semantic,
                        getSemanticLegendStyle(presentation.semantic),
                      )}
                      markerEnd={`url(#legend-marker-${presentation.semantic})`}
                    />
                  </svg>
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
