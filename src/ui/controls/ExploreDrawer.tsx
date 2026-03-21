import type { ButtonHTMLAttributes, ReactNode } from 'react'

import {
  getSemanticFamilyLabel,
  semanticFamilyOrder,
} from '@/graph/compile/semanticPresentation'
import type { ClaimId, GraphManifest, ProjectionTheme } from '@/graph/spec/schema'
import type { DiagramStore } from '@/state/diagramStore'

interface ExploreDrawerProps {
  manifest: GraphManifest
  filters: DiagramStore['ui']['filters']
  mode: DiagramStore['ui']['mode']
  theme: ProjectionTheme
  panelBVisible: boolean
  viewportLocked: boolean
  reduceMotion: boolean
  hasExpandedNotes: boolean
  layoutReady: boolean
  onClose(): void
  onPathPreset(value: DiagramStore['ui']['filters']['pathPreset']): void
  onLaneToggle(value: 'A' | 'B' | 'C'): void
  onSemanticFamilyToggle(value: DiagramStore['ui']['filters']['semanticFamilies'][number]): void
  onClaimToggle(value: ClaimId): void
  onStandardToggle(value: string): void
  onModeToggle(): void
  onThemeToggle(): void
  onTogglePanelB(): void
  onToggleViewportLock(): void
  onToggleReduceMotion(): void
  onResetLayout(): void
  onToggleNotes(): void
}

const laneDescriptions: Record<'A' | 'B' | 'C', string> = {
  A: 'Lane A: CPC / external systems',
  B: 'Lane B: AEA / gateway / decisioning',
  C: 'Lane C: central analytics / historian',
}

const laneLabels: Record<'A' | 'B' | 'C', string> = {
  A: 'CPC',
  B: 'psM+O',
  C: 'Central M+O',
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="explore-drawer__section">
      <div className="explore-drawer__section-copy">
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function ToggleButton({
  active,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean
}) {
  return (
    <button
      type="button"
      className={active ? 'chip is-active' : 'chip'}
      {...props}
    >
      {children}
    </button>
  )
}

export function ExploreDrawer({
  manifest,
  filters,
  mode,
  theme,
  panelBVisible,
  viewportLocked,
  reduceMotion,
  hasExpandedNotes,
  layoutReady,
  onClose,
  onPathPreset,
  onLaneToggle,
  onSemanticFamilyToggle,
  onClaimToggle,
  onStandardToggle,
  onModeToggle,
  onThemeToggle,
  onTogglePanelB,
  onToggleViewportLock,
  onToggleReduceMotion,
  onResetLayout,
  onToggleNotes,
}: ExploreDrawerProps) {
  const graphNodeCount = manifest.nodes.filter((node) => !['lane', 'container', 'band'].includes(node.kind)).length

  return (
    <section className="explore-drawer" aria-label="Explore the architecture figure">
      <div className="explore-drawer__header">
        <div>
          <span className="explore-drawer__kicker">Explore the figure</span>
          <h2>Filters, references, and utilities</h2>
          <p>Reader-facing controls stay here so Panel A can remain the primary composition.</p>
        </div>
        <button type="button" className="chip explore-drawer__close" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="explore-drawer__grid">
        <Section
          title="Focus"
          description="Jump between core paths, lanes, and semantic families without crowding the hero."
        >
          <div className="explore-drawer__group">
            <span className="explore-drawer__label">Path</span>
            <div className="explore-drawer__chip-row">
              {(['all', 'write', 'policy', 'telemetry'] as const).map((option) => (
                <ToggleButton
                  key={option}
                  active={filters.pathPreset === option}
                  aria-pressed={filters.pathPreset === option}
                  onClick={() => onPathPreset(option)}
                >
                  {option === 'all' ? 'All paths' : option === 'write' ? 'Write corridor focus' : option}
                </ToggleButton>
              ))}
            </div>
          </div>

          <div className="explore-drawer__group">
            <span className="explore-drawer__label">Lane</span>
            <div className="explore-drawer__chip-row">
              {(['A', 'B', 'C'] as const).map((lane) => (
                <ToggleButton
                  key={lane}
                  active={filters.lanes.includes(lane)}
                  title={laneDescriptions[lane]}
                  aria-label={laneDescriptions[lane]}
                  aria-pressed={filters.lanes.includes(lane)}
                  onClick={() => onLaneToggle(lane)}
                >
                  {laneLabels[lane]}
                </ToggleButton>
              ))}
            </div>
          </div>

          <div className="explore-drawer__group">
            <span className="explore-drawer__label">Semantic families</span>
            <div className="explore-drawer__chip-row">
              {semanticFamilyOrder.map((family) => (
                <ToggleButton
                  key={family}
                  active={filters.semanticFamilies.includes(family)}
                  aria-pressed={filters.semanticFamilies.includes(family)}
                  onClick={() => onSemanticFamilyToggle(family)}
                >
                  {getSemanticFamilyLabel(family)}
                </ToggleButton>
              ))}
            </div>
          </div>
        </Section>

        <Section
          title="Claims and standards"
          description="Apply evidence filters directly, then use the summary row to clear them."
        >
          <div className="explore-drawer__group">
            <span className="explore-drawer__label">Claims</span>
            <div className="explore-drawer__chip-row explore-drawer__chip-row--multiline">
              {Object.values(manifest.claims).map((claim) => (
                <ToggleButton
                  key={claim.id}
                  active={filters.claims.includes(claim.id)}
                  aria-pressed={filters.claims.includes(claim.id)}
                  aria-label={`${claim.id}: ${claim.label}`}
                  title={claim.summary}
                  onClick={() => onClaimToggle(claim.id)}
                >
                  <span className="explore-drawer__claim-id">{claim.id}</span>
                  <span>{claim.label}</span>
                </ToggleButton>
              ))}
            </div>
          </div>

          <div className="explore-drawer__group">
            <span className="explore-drawer__label">Standards</span>
            <div className="explore-drawer__chip-row explore-drawer__chip-row--multiline">
              {Object.values(manifest.standards).map((standard) => (
                <ToggleButton
                  key={standard.id}
                  active={filters.standards.includes(standard.id)}
                  aria-pressed={filters.standards.includes(standard.id)}
                  onClick={() => onStandardToggle(standard.id)}
                >
                  {standard.label}
                </ToggleButton>
              ))}
            </div>
          </div>
        </Section>

        <Section title="View settings" description="Adjust reading aids without changing the canonical model.">
          <div className="explore-drawer__group">
            <span className="explore-drawer__label">Presentation</span>
            <div className="explore-drawer__chip-row">
              <ToggleButton active={panelBVisible} aria-pressed={panelBVisible} onClick={onTogglePanelB}>
                {panelBVisible ? 'Hide VoR sequence' : 'Show VoR sequence'}
              </ToggleButton>
              <ToggleButton active={theme === 'analysis'} aria-pressed={theme === 'analysis'} onClick={onThemeToggle}>
                Analysis theme
              </ToggleButton>
              <ToggleButton active={viewportLocked} aria-pressed={viewportLocked} onClick={onToggleViewportLock}>
                {viewportLocked ? 'Unlock viewport' : 'Lock viewport'}
              </ToggleButton>
              <ToggleButton active={reduceMotion} aria-pressed={reduceMotion} onClick={onToggleReduceMotion}>
                Reduce motion
              </ToggleButton>
            </div>
          </div>
        </Section>

        <details className="explore-drawer__details">
          <summary>Figure metadata</summary>
          <div className="explore-drawer__metadata-grid">
            <div>
              <strong>Source</strong>
              <p>{manifest.sourceSpec.authority}</p>
            </div>
            <div>
              <strong>Manifest path</strong>
              <p>{manifest.sourceSpec.path}</p>
            </div>
            <div>
              <strong>Coverage</strong>
              <p>
                {graphNodeCount} blocks · {manifest.edges.length} flows · {manifest.steps.length} sequence steps
              </p>
            </div>
            <div>
              <strong>Evidence</strong>
              <p>{Object.keys(manifest.claims).length} claims · {Object.keys(manifest.standards).length} standards</p>
            </div>
            <div>
              <strong>Spec version</strong>
              <p>{manifest.specVersion}</p>
            </div>
            <div>
              <strong>Layout</strong>
              <p>{layoutReady ? 'Ready' : 'Preparing layout'}</p>
            </div>
          </div>
        </details>

        <details className="explore-drawer__details">
          <summary>Author tools</summary>
          <div className="explore-drawer__group">
            <span className="explore-drawer__label">Projection controls</span>
            <div className="explore-drawer__chip-row">
              <ToggleButton active={mode === 'author'} aria-pressed={mode === 'author'} onClick={onModeToggle}>
                {mode === 'author' ? 'Author mode' : 'Explore mode'}
              </ToggleButton>
              <ToggleButton active={hasExpandedNotes} aria-pressed={hasExpandedNotes} onClick={onToggleNotes}>
                {hasExpandedNotes ? 'Collapse all notes' : 'Expand all notes'}
              </ToggleButton>
              <button type="button" className="chip" onClick={onResetLayout}>
                Reset layout
              </button>
            </div>
          </div>
        </details>
      </div>
    </section>
  )
}
