import { useEffect, useMemo, useRef, useState } from 'react'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
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
import { Breadcrumbs } from '@/ui/controls/Breadcrumbs'
import { ClaimChips } from '@/ui/controls/ClaimChips'
import { ExportBar } from '@/ui/controls/ExportBar'
import { FilterPanel } from '@/ui/controls/FilterPanel'
import { SearchBar } from '@/ui/controls/SearchBar'
import { SearchResults } from '@/ui/controls/SearchResults'
import { StandardChips } from '@/ui/controls/StandardChips'
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

export default function App() {
  const store = useDiagramStore()
  const { actions } = store
  const architectureCanvasRef = useRef<HTMLDivElement>(null)
  const sequencePanelRef = useRef<HTMLElement>(null)
  const [snapshotName, setSnapshotName] = useState('')

  const overviewMetrics = useMemo(
    () => [
      {
        label: 'Graph',
        value: `${graphManifest.nodes.filter((node) => !['lane', 'container', 'band'].includes(node.kind)).length} blocks`,
        detail: `${graphManifest.edges.length} flows and ${graphManifest.steps.length} sequence steps`,
      },
      {
        label: 'Coverage',
        value: `${Object.keys(graphManifest.claims).length} claims`,
        detail: `${Object.keys(graphManifest.standards).length} standard anchors`,
      },
      {
        label: 'Source',
        value: graphManifest.sourceSpec.authority,
        detail: graphManifest.sourceSpec.path,
      },
      {
        label: 'Mode',
        value: store.ui.mode === 'author' ? 'Author projection' : 'Explore semantics',
        detail: store.ui.panelBVisible ? 'Panel B synced' : 'Panel B hidden',
      },
    ],
    [store.ui.mode, store.ui.panelBVisible],
  )
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
  }

  const selectedNode = store.ui.selectedNodeId ? resolveGraphNode(store.ui.selectedNodeId) : undefined
  const selectedEdge = store.ui.selectedEdgeId ? resolveGraphEdge(store.ui.selectedEdgeId) : undefined
  const selectedStep = store.ui.selectedStepId ? resolveSequenceStep(store.ui.selectedStepId) : undefined

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

  const onNodeDragStop: OnNodeDrag = (_, node) => {
    if (store.ui.mode !== 'author') {
      return
    }
    actions.updateNodePosition(node.id, node.position)
  }

  function openSearchResult(result: SearchResult) {
    actions.setSearch('')

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

  return (
    <div className={`app-shell app-shell--${store.ui.mode} app-shell--theme-${store.projection.theme}`}>
      <header className="app-header">
        <div className="app-header__intro">
          <p className="eyebrow">AEA Architecture Figure</p>
          <h1>Interactive Graph Application</h1>
          <p className="app-header__summary">
            Canonical graph manifest, fixed board layout, and synchronized VoR sequence rendered from one audited runtime model.
          </p>
          <div className="app-header__metrics" aria-label="Application overview metrics">
            {overviewMetrics.map((metric) => (
              <article key={metric.label} className="metric-card">
                <span className="metric-card__label">{metric.label}</span>
                <strong>{metric.value}</strong>
                <p>{metric.detail}</p>
              </article>
            ))}
          </div>
        </div>
        <div className="app-header__actions">
          <span className="toolbar__label">Export</span>
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
      </header>

      <section className="toolbar">
        <SearchBar
          value={store.ui.filters.search}
          resultsCount={searchResults.length}
          onChange={actions.setSearch}
          onSubmitFirst={() => {
            if (searchResults[0]) {
              openSearchResult(searchResults[0])
            }
          }}
          onClear={() => actions.setSearch('')}
        />
        <SearchResults query={store.ui.filters.search} results={searchResults} onOpenResult={openSearchResult} />
        <Breadcrumbs items={derivedState.breadcrumbs} />
        <FilterPanel
          filters={store.ui.filters}
          mode={store.ui.mode}
          theme={store.projection.theme}
          panelBVisible={store.ui.panelBVisible}
          viewportLocked={store.ui.viewportLocked}
          reduceMotion={store.ui.reduceMotion}
          hasExpandedNotes={store.projection.expandedNoteIds.length > 0}
          onPathPreset={(value) => actions.setFilter('pathPreset', value)}
          onLaneToggle={(value) => actions.setFilter('lanes', toggleInList(store.ui.filters.lanes, value))}
          onSemanticFamilyToggle={(value) =>
            actions.setFilter('semanticFamilies', toggleInList(store.ui.filters.semanticFamilies, value))
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
        <div className="toolbar__chips">
          <div>
            <span className="toolbar__label">Claims</span>
            <ClaimChips
              manifest={graphManifest}
              selected={store.ui.filters.claims}
              onToggle={(claimId) => actions.setFilter('claims', toggleInList(store.ui.filters.claims, claimId))}
            />
          </div>
          <div>
            <span className="toolbar__label">Standards</span>
            <StandardChips
              manifest={graphManifest}
              selected={store.ui.filters.standards}
              onToggle={(standardId) =>
                actions.setFilter('standards', toggleInList(store.ui.filters.standards, standardId))
              }
            />
          </div>
        </div>
      </section>

      <main className="workspace">
        <div className="workspace__panels">
          <PanelGroup
            orientation="vertical"
            onLayoutChanged={(layout: Record<string, number>) => {
              const panelBSize = layout.sequence
              if (store.ui.panelBVisible && typeof panelBSize === 'number') {
                actions.setPanelBSize(panelBSize)
              }
            }}
          >
            <Panel id="architecture" defaultSize={100 - store.ui.panelBSize} minSize={48}>
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
                <Panel id="sequence" defaultSize={store.ui.panelBSize} minSize={18} maxSize={42}>
                  <SequencePanel
                    containerRef={sequencePanelRef}
                    model={sequenceModel}
                    theme={store.projection.theme}
                    onSelectNode={actions.selectNode}
                    onSelectStep={actions.selectStep}
                    onSelectEdge={actions.selectEdge}
                    onHover={actions.hoverEntity}
                  />
                </Panel>
              </>
            ) : null}
          </PanelGroup>
          {hoverSummary ? (
            <aside className="hover-card" aria-live="polite">
              <strong>{hoverSummary.title}</strong>
              <span>{hoverSummary.summary}</span>
            </aside>
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
              <h2>Inspector</h2>
              <p className="inspector-section__title">Selection-aware architecture details</p>
              <p>
                Select a node, edge, or sequence step to inspect semantics, claims, standards, and linked panel mappings.
              </p>
              <div className="inspector-grid">
                <div>
                  <strong>Spec version</strong>
                  <p>{graphManifest.specVersion}</p>
                </div>
                <div>
                  <strong>Source</strong>
                  <p>{graphManifest.sourceSpec.path}</p>
                </div>
                <div>
                  <strong>Mode</strong>
                  <p>{store.ui.mode}</p>
                </div>
                <div>
                  <strong>Layout</strong>
                  <p>{store.layout.ready ? 'Ready' : store.layout.running ? 'Running' : 'Pending'}</p>
                </div>
              </div>
            </section>
          ) : null}
          <section className="inspector-section">
            <h2>Projection snapshots</h2>
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
                <button type="button" onClick={() => setSnapshotName('')} disabled={snapshotName.length === 0}>
                  Cancel
                </button>
              </div>
            </form>
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
        </aside>
      </main>
    </div>
  )
}
