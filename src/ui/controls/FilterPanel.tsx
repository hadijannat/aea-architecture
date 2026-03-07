import {
  getSemanticFamilyLabel,
  semanticFamilyOrder,
} from '@/graph/compile/semanticPresentation'
import type { ProjectionTheme } from '@/graph/spec/schema'
import type { DiagramStore } from '@/state/diagramStore'

interface FilterPanelProps {
  filters: DiagramStore['ui']['filters']
  mode: DiagramStore['ui']['mode']
  theme: ProjectionTheme
  panelBVisible: boolean
  viewportLocked: boolean
  reduceMotion: boolean
  hasExpandedNotes: boolean
  onPathPreset(value: DiagramStore['ui']['filters']['pathPreset']): void
  onLaneToggle(value: 'A' | 'B' | 'C'): void
  onSemanticFamilyToggle(value: DiagramStore['ui']['filters']['semanticFamilies'][number]): void
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

export function FilterPanel({
  filters,
  mode,
  theme,
  panelBVisible,
  viewportLocked,
  reduceMotion,
  hasExpandedNotes,
  onPathPreset,
  onLaneToggle,
  onSemanticFamilyToggle,
  onModeToggle,
  onThemeToggle,
  onTogglePanelB,
  onToggleViewportLock,
  onToggleReduceMotion,
  onResetLayout,
  onToggleNotes,
}: FilterPanelProps) {
  return (
    <section className="filter-panel">
      <div className="filter-group">
        <span className="filter-group__label">Path</span>
        {(['all', 'write', 'policy', 'telemetry'] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={filters.pathPreset === option ? 'chip is-active' : 'chip'}
            aria-pressed={filters.pathPreset === option}
            onClick={() => onPathPreset(option)}
          >
            {option === 'all' ? 'All' : option}
          </button>
        ))}
      </div>
      <div className="filter-group">
        <span className="filter-group__label">Lane</span>
        {(['A', 'B', 'C'] as const).map((lane) => (
          <button
            key={lane}
            type="button"
            className={filters.lanes.includes(lane) ? 'chip is-active' : 'chip'}
            title={laneDescriptions[lane]}
            aria-label={laneDescriptions[lane]}
            aria-pressed={filters.lanes.includes(lane)}
            onClick={() => onLaneToggle(lane)}
          >
            {laneLabels[lane]}
          </button>
        ))}
      </div>
      <div className="filter-group">
        <span className="filter-group__label">Semantic families</span>
        {semanticFamilyOrder.map((family) => (
          <button
            key={family}
            type="button"
            className={filters.semanticFamilies.includes(family) ? 'chip is-active' : 'chip'}
            aria-pressed={filters.semanticFamilies.includes(family)}
            onClick={() => onSemanticFamilyToggle(family)}
          >
            {getSemanticFamilyLabel(family)}
          </button>
        ))}
      </div>
      <div className="filter-group">
        <span className="filter-group__label">View</span>
        <button
          type="button"
          className={mode === 'author' ? 'chip is-active' : 'chip'}
          aria-pressed={mode === 'author'}
          onClick={onModeToggle}
        >
          {mode === 'author' ? 'Author mode' : 'Explore mode'}
        </button>
        <button
          type="button"
          className={panelBVisible ? 'chip is-active' : 'chip'}
          aria-pressed={panelBVisible}
          onClick={onTogglePanelB}
        >
          {panelBVisible ? 'Hide VoR sequence' : 'Show VoR sequence'}
        </button>
        <button
          type="button"
          className={theme === 'analysis' ? 'chip is-active' : 'chip'}
          aria-pressed={theme === 'analysis'}
          onClick={onThemeToggle}
        >
          Analysis theme
        </button>
        <button
          type="button"
          className={viewportLocked ? 'chip is-active' : 'chip'}
          aria-pressed={viewportLocked}
          onClick={onToggleViewportLock}
        >
          {viewportLocked ? 'Unlock viewport' : 'Lock viewport'}
        </button>
        <button
          type="button"
          className={reduceMotion ? 'chip is-active' : 'chip'}
          aria-pressed={reduceMotion}
          onClick={onToggleReduceMotion}
        >
          Reduce motion
        </button>
        <button type="button" className="chip" onClick={onResetLayout}>
          Reset layout
        </button>
        <button
          type="button"
          className={hasExpandedNotes ? 'chip is-active' : 'chip'}
          aria-pressed={hasExpandedNotes}
          onClick={onToggleNotes}
        >
          {hasExpandedNotes ? 'Collapse all notes' : 'Expand all notes'}
        </button>
      </div>
    </section>
  )
}
