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
  onPathPreset(value: DiagramStore['ui']['filters']['pathPreset']): void
  onLaneToggle(value: 'A' | 'B' | 'C'): void
  onSemanticFamilyToggle(value: DiagramStore['ui']['filters']['semanticFamilies'][number]): void
  onModeToggle(): void
  onThemeToggle(): void
  onTogglePanelB(): void
  onToggleViewportLock(): void
  onResetLayout(): void
  onExpandNotes(): void
}

export function FilterPanel({
  filters,
  mode,
  theme,
  panelBVisible,
  viewportLocked,
  onPathPreset,
  onLaneToggle,
  onSemanticFamilyToggle,
  onModeToggle,
  onThemeToggle,
  onTogglePanelB,
  onToggleViewportLock,
  onResetLayout,
  onExpandNotes,
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
            onClick={() => onLaneToggle(lane)}
          >
            {lane}
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
            onClick={() => onSemanticFamilyToggle(family)}
          >
            {getSemanticFamilyLabel(family)}
          </button>
        ))}
      </div>
      <div className="filter-group">
        <span className="filter-group__label">View</span>
        <button type="button" className={mode === 'author' ? 'chip is-active' : 'chip'} onClick={onModeToggle}>
          {mode === 'author' ? 'Author mode' : 'Explore mode'}
        </button>
        <button type="button" className={panelBVisible ? 'chip is-active' : 'chip'} onClick={onTogglePanelB}>
          {panelBVisible ? 'Hide Panel B' : 'Show Panel B'}
        </button>
        <button type="button" className={theme === 'analysis' ? 'chip is-active' : 'chip'} onClick={onThemeToggle}>
          Analysis theme
        </button>
        <button
          type="button"
          className={viewportLocked ? 'chip is-active' : 'chip'}
          onClick={onToggleViewportLock}
        >
          {viewportLocked ? 'Unlock viewport' : 'Lock viewport'}
        </button>
        <button type="button" className="chip" onClick={onResetLayout}>
          Reset layout
        </button>
        <button type="button" className="chip" onClick={onExpandNotes}>
          Expand all notes
        </button>
      </div>
    </section>
  )
}
