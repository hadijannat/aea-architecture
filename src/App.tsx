import { useEffect, useMemo, useRef, useState } from 'react'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle, type PanelImperativeHandle } from 'react-resizable-panels'
import type { OnNodeDrag } from '@xyflow/react'
import { jsPDF } from 'jspdf'
import { svg2pdf } from 'svg2pdf.js'

import { buildSearchResults, type SearchResult } from '@/graph/compile/searchIndex'
import { compileSequenceBoard } from '@/graph/compile/sequenceBoard'
import { buildExportSvgDocument, type ExportMode } from '@/graph/compile/toExportSvg'
import { compileArchitectureEdges, compileArchitectureNodes, deriveDiagramState, getEntityPathHighlights } from '@/graph/compile/toReactFlow'
import { toMermaid } from '@/graph/compile/toMermaid'
import { getGraphManifestJson, graphManifest, resolveGraphEdge, resolveGraphNode, resolveSequenceStep } from '@/graph/spec/manifest'
import { useDiagramStore } from '@/state/diagramStore'
import type { ClaimId } from '@/graph/spec/schema'
import { buildUiSearchParams, parseUiSearchParams } from '@/state/urlState'
import { ArchitectureCanvas } from '@/ui/canvas/ArchitectureCanvas'
import { SequencePanel } from '@/ui/canvas/SequencePanel'
import { ExploreDrawer } from '@/ui/controls/ExploreDrawer'
import { ExportBar } from '@/ui/controls/ExportBar'
import { SequenceTeaser } from '@/ui/controls/SequenceTeaser'
import { EdgeInspector } from '@/ui/inspectors/EdgeInspector'
import { NodeInspector } from '@/ui/inspectors/NodeInspector'
import { StepInspector } from '@/ui/inspectors/StepInspector'

function toggleInList<T extends string>(list: T[], value: T) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

function downloadText(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function mermaidDownloadName(panel: 'architecture' | 'vor-sequence') {
  return panel === 'architecture' ? 'architecture-topology.mmd' : 'vor-sequence-topology.mmd'
}

const minSequencePanelPercent = 28
const defaultSequencePanelPercent = 34
const maxSequencePanelPercent = 54
const searchKindLabels: Record<SearchResult['kind'], string> = {
  node: 'Block',
  edge: 'Flow',
  step: 'Step',
  claim: 'Claim',
  standard: 'Standard',
}

function toPanelPercent(percent: number) {
  return `${percent}%`
}

export default function App() {
  const store = useDiagramStore()
  const { actions } = store
  const commandShellRef = useRef<HTMLDivElement>(null)
  const architectureCanvasRef = useRef<HTMLDivElement>(null)
  const sequencePanelRef = useRef<HTMLElement>(null)
  const sequencePanelHandleRef = useRef<PanelImperativeHandle | null>(null)
  const lastAutoRevealSelectionRef = useRef<string | undefined>(undefined)
  const [snapshotName, setSnapshotName] = useState('')
  const [snapshotComposerOpen, setSnapshotComposerOpen] = useState(false)
  const [exploreOpen, setExploreOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [stackedPanels, setStackedPanels] = useState(() => window.matchMedia('(max-width: 1180px)').matches)
  const noteNodeIds = useMemo(
    () => graphManifest.nodes.filter((node) => node.inspector.notes.length > 0).map((node) => node.id),
    [],
  )

  useEffect(() => {
    void actions.initialize()
  }, [actions])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExploreOpen(false)
        setExportOpen(false)
        actions.clearSelection()
        actions.hoverEntity(undefined)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [actions])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncReduceMotion = () => actions.setSystemReduceMotion(mediaQuery.matches)

    syncReduceMotion()
    mediaQuery.addEventListener('change', syncReduceMotion)
    return () => mediaQuery.removeEventListener('change', syncReduceMotion)
  }, [actions])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1180px)')
    const syncLayout = () => setStackedPanels(mediaQuery.matches)

    syncLayout()
    mediaQuery.addEventListener('change', syncLayout)
    return () => mediaQuery.removeEventListener('change', syncLayout)
  }, [])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) {
        return
      }

      if (commandShellRef.current?.contains(event.target)) {
        return
      }

      setExploreOpen(false)
      setExportOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  useEffect(() => {
    const { selectedNodeId, selectedEdgeId, selectedStepId, filters } = parseUiSearchParams(
      new URLSearchParams(window.location.search),
    )

    actions.setFilter('claims', filters.claims)
    actions.setFilter('standards', filters.standards)
    actions.setFilter('semanticFamilies', filters.semanticFamilies)
    actions.setFilter('lanes', filters.lanes)
    actions.setSearch(filters.search)
    actions.setFilter('pathPreset', filters.pathPreset)
    if (selectedNodeId) {
      actions.selectNode(selectedNodeId)
    } else if (selectedEdgeId) {
      actions.selectEdge(selectedEdgeId)
    } else if (selectedStepId) {
      actions.selectStep(selectedStepId)
    }
  }, [actions])

  useEffect(() => {
    const params = buildUiSearchParams(store.ui)
    window.history.replaceState(null, '', `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`)
  }, [store.ui])

  const callbacks = useMemo(
    () => ({
      onSelectNode: actions.selectNode,
      onSelectEdge: actions.selectEdge,
      onSelectStep: actions.selectStep,
      onBadgeClaim: (claimId: ClaimId) => actions.setFilter('claims', [claimId]),
      onBadgeStandard: (standardId: string) => actions.setFilter('standards', [standardId]),
      onPathAction: (nodeId: string, direction: 'upstream' | 'downstream') =>
        actions.setHighlighted(getEntityPathHighlights(nodeId, direction)),
      onHover: actions.hoverEntity,
    }),
    [actions],
  )

  const derivedState = useMemo(
    () => deriveDiagramState(store),
    [store],
  )

  const architectureNodes = useMemo(
    () => compileArchitectureNodes(store, callbacks, derivedState),
    [callbacks, derivedState, store],
  )

  const architectureEdges = useMemo(
    () => compileArchitectureEdges(store, callbacks, derivedState),
    [callbacks, derivedState, store],
  )

  const sequenceModel = useMemo(
    () => compileSequenceBoard(store, derivedState),
    [derivedState, store],
  )

  const searchResults = useMemo(
    () => buildSearchResults(store.ui.filters.search, graphManifest),
    [store.ui.filters.search],
  )

  function saveSnapshot() {
    const trimmedName = snapshotName.trim()
    if (!trimmedName) {
      return
    }

    actions.saveSnapshot(trimmedName)
    setSnapshotName('')
    setSnapshotComposerOpen(false)
  }

  const selectedNode = store.ui.selectedNodeId ? resolveGraphNode(store.ui.selectedNodeId) : undefined
  const selectedEdge = store.ui.selectedEdgeId ? resolveGraphEdge(store.ui.selectedEdgeId) : undefined
  const selectedStep = store.ui.selectedStepId ? resolveSequenceStep(store.ui.selectedStepId) : undefined
  const mappedSelectionKey = selectedStep
    ? `step:${selectedStep.id}`
    : selectedEdge?.interactive.relatedStepIds.length
      ? `edge:${selectedEdge.id}`
      : selectedNode?.inspector.relatedStepIds.length
        ? `node:${selectedNode.id}`
        : undefined

  useEffect(() => {
    if (!mappedSelectionKey) {
      lastAutoRevealSelectionRef.current = undefined
      return
    }

    const selectionChanged = lastAutoRevealSelectionRef.current !== mappedSelectionKey
    lastAutoRevealSelectionRef.current = mappedSelectionKey

    if (!store.ui.panelBVisible) {
      if (!selectionChanged) {
        return
      }
      if (store.ui.panelBSize < defaultSequencePanelPercent) {
        actions.setPanelBSize(defaultSequencePanelPercent)
      }
      actions.togglePanelB()
      return
    }

    const currentPercent = sequencePanelHandleRef.current?.getSize().asPercentage ?? store.ui.panelBSize
    if (currentPercent < defaultSequencePanelPercent) {
      sequencePanelHandleRef.current?.resize(toPanelPercent(defaultSequencePanelPercent))
    }
  }, [
    actions,
    mappedSelectionKey,
    store.ui.panelBVisible,
    store.ui.panelBSize,
  ])

  const hoverSummary = useMemo(() => {
    const key = store.ui.hoveredEntityKey
    if (!key) {
      return undefined
    }
    if (key.startsWith('node:')) {
      const node = resolveGraphNode(key.replace('node:', ''))
      return node ? { title: `${node.id} · ${node.title}`, summary: node.inspector.role } : undefined
    }
    if (key.startsWith('edge:')) {
      const edge = resolveGraphEdge(key.replace('edge:', ''))
      return edge ? { title: `${edge.id} · ${edge.label}`, summary: edge.semantic } : undefined
    }
    const step = resolveSequenceStep(key.replace('step:', ''))
    return step ? { title: `${step.id} · ${step.title}`, summary: step.summary } : undefined
  }, [store.ui.hoveredEntityKey])

  const sequencePanelPercent = Math.min(maxSequencePanelPercent, Math.max(minSequencePanelPercent, store.ui.panelBSize))

  const onNodeDragStop: OnNodeDrag = (_, node) => {
    if (store.ui.mode !== 'author') {
      return
    }
    actions.updateNodePosition(node.id, node.position)
  }

  function openSearchResult(result: SearchResult) {
    actions.setSearch('')
    setExportOpen(false)
    setExploreOpen(false)

    if (result.kind === 'node') {
      actions.selectNode(result.id)
      return
    }
    if (result.kind === 'edge') {
      actions.selectEdge(result.id)
      return
    }
    if (result.kind === 'step') {
      actions.selectStep(result.id)
      return
    }
    if (result.kind === 'claim') {
      actions.clearSelection()
      actions.setFilter('claims', [result.id as ClaimId])
      return
    }
    actions.clearSelection()
    actions.setFilter('standards', [result.id])
  }

  function clearActiveFilters() {
    actions.setSearch('')
    actions.setFilter('claims', [])
    actions.setFilter('standards', [])
    actions.setFilter('semanticFamilies', [])
    actions.setFilter('lanes', [])
    actions.setFilter('pathPreset', 'all')
  }

  function openPanelBFromTeaser() {
    if (store.ui.panelBVisible) {
      return
    }

    if (store.ui.panelBSize < defaultSequencePanelPercent) {
      actions.setPanelBSize(defaultSequencePanelPercent)
    }

    actions.togglePanelB()
  }

  function buildExportDocument(mode: ExportMode) {
    const architectureElement = architectureCanvasRef.current
    const sequenceElement = sequencePanelRef.current
    const viewportMetrics =
      mode === 'viewport'
        ? {
            architecture: {
              width: architectureElement?.clientWidth || graphManifest.layoutDefaults.canvas.width,
              height: architectureElement?.clientHeight || graphManifest.layoutDefaults.canvas.height,
            },
            sequence:
              store.ui.panelBVisible && sequenceElement
                ? {
                    width: sequenceElement.clientWidth || graphManifest.layoutDefaults.canvas.width,
                    height: sequenceElement.clientHeight || 240,
                  }
                : undefined,
          }
        : undefined

    return buildExportSvgDocument(
      store,
      {
        mode,
        viewportMetrics,
      },
      graphManifest,
    )
  }

  async function exportPdf(mode: ExportMode) {
    const exportDocument = buildExportDocument(mode)
    const parser = new DOMParser()
    const svgDoc = parser.parseFromString(exportDocument.svg, 'image/svg+xml')
    const pdf = new jsPDF({
      orientation: exportDocument.pdf.width >= exportDocument.pdf.height ? 'landscape' : 'portrait',
      unit: exportDocument.pdf.unit,
      format: [exportDocument.pdf.width, exportDocument.pdf.height],
    })
    await svg2pdf(svgDoc.documentElement, pdf, {
      x: 0,
      y: 0,
      width: exportDocument.pdf.width,
      height: exportDocument.pdf.height,
    })
    pdf.save(`aea-architecture-${mode}.pdf`)
  }

  const breadcrumbLabel = useMemo(
    () => derivedState.breadcrumbs.map((item) => item.label).join(' / '),
    [derivedState.breadcrumbs],
  )

  const commandFocus = useMemo(() => {
    if (selectedNode) {
      return {
        label: 'Selection',
        title: selectedNode.title,
        summary: breadcrumbLabel || selectedNode.id,
      }
    }

    if (selectedEdge) {
      return {
        label: 'Selection',
        title: selectedEdge.displayLabel ?? selectedEdge.label,
        summary: breadcrumbLabel || selectedEdge.id,
      }
    }

    if (selectedStep) {
      return {
        label: 'Selection',
        title: selectedStep.title,
        summary: breadcrumbLabel || selectedStep.id,
      }
    }

    return {
      label: 'Current focus',
      title: 'Canonical architecture figure',
      summary: 'Panel A is the primary explainer; use search or Explore to jump into specifics.',
    }
  }, [breadcrumbLabel, selectedEdge, selectedNode, selectedStep])

  const activeSummaryItems = useMemo(() => {
    const items: string[] = []
    if (store.ui.filters.search.trim()) {
      items.push(`Query: ${store.ui.filters.search.trim()}`)
    }
    if (store.ui.filters.pathPreset !== 'all') {
      items.push(store.ui.filters.pathPreset === 'write' ? 'Write corridor focus' : `${store.ui.filters.pathPreset} path`)
    }
    if (store.ui.filters.lanes.length > 0) {
      items.push(`${store.ui.filters.lanes.length} lane${store.ui.filters.lanes.length === 1 ? '' : 's'}`)
    }
    if (store.ui.filters.semanticFamilies.length > 0) {
      items.push(`${store.ui.filters.semanticFamilies.length} semantic famil${store.ui.filters.semanticFamilies.length === 1 ? 'y' : 'ies'}`)
    }
    if (store.ui.filters.claims.length > 0) {
      items.push(`${store.ui.filters.claims.length} claim${store.ui.filters.claims.length === 1 ? '' : 's'}`)
    }
    if (store.ui.filters.standards.length > 0) {
      items.push(`${store.ui.filters.standards.length} standard${store.ui.filters.standards.length === 1 ? '' : 's'}`)
    }
    return items
  }, [store.ui.filters])

  const relatedSequenceLabel = useMemo(() => {
    if (!mappedSelectionKey) {
      return undefined
    }

    if (selectedStep) {
      return selectedStep.title
    }
    if (selectedEdge) {
      return selectedEdge.displayLabel ?? selectedEdge.label
    }
    return selectedNode?.title
  }, [mappedSelectionKey, selectedEdge, selectedNode, selectedStep])

  const activeDisclosureCount =
    (store.ui.filters.pathPreset !== 'all' ? 1 : 0) +
    store.ui.filters.lanes.length +
    store.ui.filters.semanticFamilies.length +
    store.ui.filters.claims.length +
    store.ui.filters.standards.length

  return (
    <div className={`app-shell app-shell--${store.ui.mode} app-shell--theme-${store.projection.theme}`}>
      <header className="app-hero">
        <div className="app-hero__copy">
          <h1>AEA Architecture</h1>
          <p className="app-hero__summary">
            A publication-grade explorer for the canonical audited architecture figure, synchronized VoR sequence, and evidence-backed inspection path.
          </p>
        </div>
      </header>

      <section className="command-shell" ref={commandShellRef}>
        <div className="command-bar">
          <div className="command-bar__search-shell">
            <label className="command-bar__search">
              <span className="command-bar__label">Jump</span>
              <input
                type="search"
                value={store.ui.filters.search}
                onChange={(event) => actions.setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && searchResults[0]) {
                    event.preventDefault()
                    openSearchResult(searchResults[0])
                  }
                }}
                placeholder="Jump by ID, title, standard, claim, or sequence step"
                aria-label="Search nodes, edges, standards, and claims"
              />
            </label>
            {store.ui.filters.search.trim() ? (
              <div className="command-bar__search-results" aria-label="Direct search results">
                <div className="command-bar__search-results-header">
                  <strong>Direct matches</strong>
                  <span>{searchResults.length} shown</span>
                </div>
                {searchResults.length === 0 ? (
                  <p className="command-bar__search-empty">No direct matches. Keep typing to use the broader graph filter.</p>
                ) : (
                  <div className="command-bar__search-result-list">
                    {searchResults.map((result) => (
                      <button
                        key={result.key}
                        type="button"
                        className="command-bar__search-result"
                        aria-label={`${searchKindLabels[result.kind]} result ${result.title}`}
                        onClick={() => openSearchResult(result)}
                      >
                        <span className="command-bar__search-kind">{searchKindLabels[result.kind]}</span>
                        <strong>{result.title}</strong>
                        <span>{result.subtitle}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="command-bar__context">
            <span className="command-bar__label">{commandFocus.label}</span>
            <strong>{commandFocus.title}</strong>
            <p>{commandFocus.summary}</p>
          </div>

          <div className="command-bar__actions">
            <button
              type="button"
              className={exploreOpen ? 'chip is-active' : 'chip'}
              aria-expanded={exploreOpen}
              onClick={() => {
                setExploreOpen((current) => !current)
                setExportOpen(false)
              }}
            >
              Explore
              {activeDisclosureCount > 0 ? <span className="command-bar__count">{activeDisclosureCount}</span> : null}
            </button>
            <div className="command-bar__export-shell">
              <button
                type="button"
                className={exportOpen ? 'chip is-active' : 'chip'}
                aria-expanded={exportOpen}
                onClick={() => {
                  setExportOpen((current) => !current)
                  setExploreOpen(false)
                }}
              >
                Export
              </button>
              {exportOpen ? (
                <div className="command-menu command-menu--export">
                  <span className="command-menu__label">Export artifacts</span>
                  <ExportBar
                    onExportSvg={(mode) => {
                      const exportDocument = buildExportDocument(mode)
                      downloadText(`aea-architecture-${mode}.svg`, exportDocument.svg, 'image/svg+xml')
                    }}
                    onExportPdf={(mode) => void exportPdf(mode)}
                    onExportMermaid={(panel) => downloadText(mermaidDownloadName(panel), toMermaid(panel), 'text/plain')}
                    onExportGraphJson={() => downloadText('graph.json', getGraphManifestJson(), 'application/json')}
                    onExportProjection={() => downloadText('projection.json', JSON.stringify(store.projection, null, 2), 'application/json')}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {activeSummaryItems.length > 0 ? (
          <div className="filter-summary" aria-label="Active filters">
            <div className="filter-summary__items">
              {activeSummaryItems.map((item) => (
                <span key={item} className="filter-summary__item">
                  {item}
                </span>
              ))}
            </div>
            <button type="button" className="chip" onClick={clearActiveFilters}>
              Clear all
            </button>
          </div>
        ) : null}

        {exploreOpen ? (
          <ExploreDrawer
            manifest={graphManifest}
            filters={store.ui.filters}
            mode={store.ui.mode}
            theme={store.projection.theme}
            panelBVisible={store.ui.panelBVisible}
            viewportLocked={store.ui.viewportLocked}
            reduceMotion={store.ui.reduceMotion}
            hasExpandedNotes={store.projection.expandedNoteIds.length > 0}
            layoutReady={store.layout.ready}
            onClose={() => setExploreOpen(false)}
            onPathPreset={(value) => actions.setFilter('pathPreset', value)}
            onLaneToggle={(value) => actions.setFilter('lanes', toggleInList(store.ui.filters.lanes, value))}
            onSemanticFamilyToggle={(value) =>
              actions.setFilter('semanticFamilies', toggleInList(store.ui.filters.semanticFamilies, value))
            }
            onClaimToggle={(claimId) => actions.setFilter('claims', toggleInList(store.ui.filters.claims, claimId))}
            onStandardToggle={(standardId) =>
              actions.setFilter('standards', toggleInList(store.ui.filters.standards, standardId))
            }
            onModeToggle={() => actions.setMode(store.ui.mode === 'author' ? 'explore' : 'author')}
            onThemeToggle={() => actions.setTheme(store.projection.theme === 'analysis' ? 'default' : 'analysis')}
            onTogglePanelB={actions.togglePanelB}
            onToggleViewportLock={actions.toggleViewportLock}
            onToggleReduceMotion={actions.toggleReduceMotion}
            onResetLayout={() => void actions.resetLayout()}
            onToggleNotes={() =>
              actions.setExpandedNoteIds(store.projection.expandedNoteIds.length > 0 ? [] : noteNodeIds)
            }
          />
        ) : null}
      </section>

      <main className="workspace">
        <div className="workspace__figure">
          <div className="workspace__panels">
            {!stackedPanels ? (
              <PanelGroup
                key={store.ui.panelBVisible ? 'workspace-panels--with-sequence' : 'workspace-panels--architecture-only'}
                orientation="vertical"
                onLayoutChanged={(layout: Record<string, number>) => {
                  const panelBSize = layout.sequence
                  if (store.ui.panelBVisible && typeof panelBSize === 'number') {
                    actions.setPanelBSize(panelBSize)
                  }
                }}
              >
                <Panel id="architecture" defaultSize={toPanelPercent(100 - sequencePanelPercent)} minSize={48}>
                  <ArchitectureCanvas
                    containerRef={architectureCanvasRef}
                    nodes={architectureNodes}
                    edges={architectureEdges}
                    ui={store.ui}
                    theme={store.projection.theme}
                    layoutReady={store.layout.ready}
                    onViewport={actions.setViewport}
                    onClearSelection={actions.clearSelection}
                    onNodeDragStop={onNodeDragStop}
                    onResetLayout={() => void actions.resetLayout()}
                  />
                </Panel>
                {store.ui.panelBVisible ? (
                  <>
                    <PanelResizeHandle className="panel-resize-handle" />
                    <Panel
                      id="sequence"
                      panelRef={sequencePanelHandleRef}
                      defaultSize={toPanelPercent(sequencePanelPercent)}
                      minSize={toPanelPercent(minSequencePanelPercent)}
                      maxSize={toPanelPercent(maxSequencePanelPercent)}
                    >
                      <SequencePanel
                        containerRef={sequencePanelRef}
                        model={sequenceModel}
                        theme={store.projection.theme}
                        layout="split"
                        onSelectNode={actions.selectNode}
                        onSelectStep={actions.selectStep}
                        onSelectEdge={actions.selectEdge}
                        onHover={actions.hoverEntity}
                      />
                    </Panel>
                  </>
                ) : null}
              </PanelGroup>
            ) : (
              <ArchitectureCanvas
                containerRef={architectureCanvasRef}
                nodes={architectureNodes}
                edges={architectureEdges}
                ui={store.ui}
                theme={store.projection.theme}
                layoutReady={store.layout.ready}
                onViewport={actions.setViewport}
                onClearSelection={actions.clearSelection}
                onNodeDragStop={onNodeDragStop}
                onResetLayout={() => void actions.resetLayout()}
              />
            )}

            {hoverSummary ? (
              <aside className="hover-card" aria-live="polite">
                <strong>{hoverSummary.title}</strong>
                <span>{hoverSummary.summary}</span>
              </aside>
            ) : null}
          </div>

          {!store.ui.panelBVisible ? (
            <SequenceTeaser relatedSelectionLabel={relatedSequenceLabel} onOpen={openPanelBFromTeaser} />
          ) : null}

          {stackedPanels && store.ui.panelBVisible ? (
            <div className="workspace__sequence-stack">
              <SequencePanel
                containerRef={sequencePanelRef}
                model={sequenceModel}
                theme={store.projection.theme}
                layout="stacked"
                onSelectNode={actions.selectNode}
                onSelectStep={actions.selectStep}
                onSelectEdge={actions.selectEdge}
                onHover={actions.hoverEntity}
              />
            </div>
          ) : null}
        </div>

        <aside className="inspector">
          {selectedNode ? (
            <NodeInspector
              node={selectedNode}
              manifest={graphManifest}
              annotation={store.projection.annotations[selectedNode.id]}
              onAnnotationChange={(value) => actions.setAnnotation(selectedNode.id, value)}
              onPathAction={(nodeId, direction) => actions.setHighlighted(getEntityPathHighlights(nodeId, direction))}
              onSelectEdge={actions.selectEdge}
              onSelectStep={actions.selectStep}
              onApplyClaimFilter={(claimId) => actions.setFilter('claims', [claimId])}
              onApplyStandardFilter={(standardId) => actions.setFilter('standards', [standardId])}
            />
          ) : null}
          {selectedEdge ? (
            <EdgeInspector
              edge={selectedEdge}
              manifest={graphManifest}
              onPathAction={(nodeId, direction) => actions.setHighlighted(getEntityPathHighlights(nodeId, direction))}
              onSelectNode={actions.selectNode}
              onSelectStep={actions.selectStep}
              onApplyClaimFilter={(claimId) => actions.setFilter('claims', [claimId])}
              onApplyStandardFilter={(standardId) => actions.setFilter('standards', [standardId])}
            />
          ) : null}
          {selectedStep ? (
            <StepInspector
              step={selectedStep}
              manifest={graphManifest}
              onSelectNode={actions.selectNode}
              onSelectEdge={actions.selectEdge}
              onApplyClaimFilter={(claimId) => actions.setFilter('claims', [claimId])}
              onApplyStandardFilter={(standardId) => actions.setFilter('standards', [standardId])}
            />
          ) : null}
          {!selectedNode && !selectedEdge && !selectedStep ? (
            <section className="inspector-section">
              <h2>What this figure shows</h2>
              <p className="inspector-section__title">Select a block, flow, or sequence step to read the architecture in context.</p>
              <p>
                Panel A is the primary architecture explainer. Panel B opens contextually when a mapped selection reveals the VoR sequence.
              </p>
              <div className="inspector-grid">
                <div>
                  <strong>Current focus</strong>
                  <p>{breadcrumbLabel || 'Overview / All paths'}</p>
                </div>
                <div>
                  <strong>Sequence state</strong>
                  <p>{store.ui.panelBVisible ? 'Expanded' : 'Collapsed to teaser'}</p>
                </div>
                <div>
                  <strong>Source</strong>
                  <p>{graphManifest.sourceSpec.path}</p>
                </div>
                <div>
                  <strong>Layout</strong>
                  <p>{store.layout.ready ? 'Ready' : store.layout.running ? 'Running' : 'Pending'}</p>
                </div>
              </div>
            </section>
          ) : null}

          <details className="inspector-disclosure">
            <summary>Author tools and snapshots</summary>
            <section className="inspector-section inspector-section--advanced">
              {snapshotComposerOpen ? (
                <form
                  className="snapshot-composer"
                  onSubmit={(event) => {
                    event.preventDefault()
                    saveSnapshot()
                  }}
                >
                  <label className="snapshot-composer__field">
                    <span>Snapshot name</span>
                    <input
                      type="text"
                      value={snapshotName}
                      placeholder="Name this projection state"
                      onChange={(event) => setSnapshotName(event.target.value)}
                    />
                  </label>
                  <div className="inspector-actions">
                    <button type="submit" disabled={snapshotName.trim().length === 0}>
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSnapshotName('')
                        setSnapshotComposerOpen(false)
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="inspector-actions">
                  <button type="button" onClick={() => setSnapshotComposerOpen(true)}>
                    Save snapshot
                  </button>
                </div>
              )}

              <div className="snapshot-list">
                {store.projection.snapshots.length === 0 ? <p>No saved snapshots yet.</p> : null}
                {store.projection.snapshots.map((snapshot) => (
                  <div key={snapshot.id} className="snapshot-card">
                    <strong>{snapshot.name}</strong>
                    <span>{new Date(snapshot.createdAt).toLocaleString()}</span>
                    <div className="inspector-actions">
                      <button type="button" onClick={() => void actions.loadSnapshot(snapshot.id)}>
                        Load
                      </button>
                      <button type="button" onClick={() => actions.deleteSnapshot(snapshot.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </details>
        </aside>
      </main>
    </div>
  )
}
