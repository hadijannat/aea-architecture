import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'

import { defaultProjectionOverrides, graphManifest } from '@/graph/spec/manifest'
import type {
  ClaimId,
  EdgeSemanticFamily,
  EntityKey,
  GraphManifest,
  LaneId,
  ProjectionOverrides,
  ProjectionTheme,
} from '@/graph/spec/schema'
import { computeBoardNodePositions, type NodePositionMap } from '@/layout/boardLayout'

export interface DiagramFilters {
  claims: ClaimId[]
  standards: string[]
  semanticFamilies: EdgeSemanticFamily[]
  lanes: LaneId[]
  search: string
  pathPreset: 'all' | 'write' | 'policy' | 'telemetry'
}

export interface DiagramUiState {
  mode: 'explore' | 'author'
  selectedNodeId?: string
  selectedEdgeId?: string
  selectedStepId?: string
  hoveredEntityKey?: EntityKey
  highlightedEntityKeys: EntityKey[]
  filters: DiagramFilters
  viewport: {
    x: number
    y: number
    zoom: number
  }
  panelBVisible: boolean
  panelBSize: number
  viewportLocked: boolean
  reduceMotion: boolean
  systemReduceMotion: boolean
}

interface LayoutState {
  ready: boolean
  running: boolean
  positions: NodePositionMap
  error?: string
}

interface DiagramActions {
  initialize(): Promise<void>
  selectNode(id?: string): void
  selectEdge(id?: string): void
  selectStep(id?: string): void
  hoverEntity(key?: EntityKey): void
  setHighlighted(keys: EntityKey[]): void
  clearSelection(): void
  setFilter<K extends keyof DiagramFilters>(key: K, value: DiagramFilters[K]): void
  setSearch(value: string): void
  setViewport(viewport: DiagramUiState['viewport']): void
  togglePanelB(): void
  setPanelBSize(size: number): void
  toggleViewportLock(): void
  toggleReduceMotion(): void
  setSystemReduceMotion(value: boolean): void
  setMode(mode: DiagramUiState['mode']): void
  setTheme(theme: ProjectionTheme): void
  updateNodePosition(nodeId: string, position: { x: number; y: number }): void
  updateEdgeHandles(
    edgeId: string,
    handles: ProjectionOverrides['edgeHandles'][string],
  ): void
  toggleCollapsed(nodeId: string): void
  setAnnotation(entityId: string, note: string): void
  setExpandedNoteIds(ids: string[]): void
  saveSnapshot(name: string): void
  loadSnapshot(snapshotId: string): Promise<void>
  deleteSnapshot(snapshotId: string): void
  resetLayout(): Promise<void>
}

export interface DiagramStore {
  graph: GraphManifest
  ui: DiagramUiState
  projection: ProjectionOverrides
  layout: LayoutState
  actions: DiagramActions
}

const initialFilters: DiagramFilters = {
  claims: [],
  standards: [],
  semanticFamilies: [],
  lanes: [],
  search: '',
  pathPreset: 'all',
}

const minPanelBPercent = 28
const maxPanelBPercent = 54

function clampPanelBPercent(size?: number) {
  if (typeof size !== 'number' || !Number.isFinite(size)) {
    return defaultProjectionOverrides.panelBSize
  }

  return Math.min(maxPanelBPercent, Math.max(minPanelBPercent, size))
}

export const useDiagramStore = create<DiagramStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        graph: graphManifest,
        ui: {
          mode: 'explore',
          filters: initialFilters,
          highlightedEntityKeys: [],
          viewport: graphManifest.layoutDefaults.viewport,
          panelBVisible: false,
          panelBSize: clampPanelBPercent(defaultProjectionOverrides.panelBSize),
          viewportLocked: false,
          reduceMotion: false,
          systemReduceMotion: false,
        },
        projection: defaultProjectionOverrides,
        layout: {
          ready: false,
          running: false,
          positions: {},
        },
        actions: {
          async initialize() {
            if (get().layout.ready || get().layout.running) {
              return
            }

            set((state) => ({
              ...state,
              layout: {
                ...state.layout,
                running: true,
                error: undefined,
              },
            }))

            try {
              const positions = await computeBoardNodePositions(get().graph, get().projection)
              set((state) => ({
                ...state,
                layout: {
                  ready: true,
                  running: false,
                  positions,
                },
              }))
            } catch (error) {
              set((state) => ({
                ...state,
                layout: {
                  ...state.layout,
                  running: false,
                  error: error instanceof Error ? error.message : 'Layout failed',
                },
              }))
            }
          },
          selectNode(id) {
            set((state) => ({
              ...state,
              ui: {
                ...state.ui,
                selectedNodeId: id,
                selectedEdgeId: undefined,
                selectedStepId: undefined,
              },
            }))
          },
          selectEdge(id) {
            set((state) => ({
              ...state,
              ui: {
                ...state.ui,
                selectedEdgeId: id,
                selectedNodeId: undefined,
                selectedStepId: undefined,
              },
            }))
          },
          selectStep(id) {
            set((state) => ({
              ...state,
              ui: {
                ...state.ui,
                selectedStepId: id,
                selectedNodeId: undefined,
                selectedEdgeId: undefined,
              },
            }))
          },
          hoverEntity(key) {
            set((state) => ({
              ...state,
              ui: {
                ...state.ui,
                hoveredEntityKey: key,
              },
            }))
          },
          setHighlighted(keys) {
            set((state) => ({
              ...state,
              ui: {
                ...state.ui,
                highlightedEntityKeys: keys,
              },
            }))
          },
          clearSelection() {
            set((state) => ({
              ...state,
              ui: {
                ...state.ui,
                selectedNodeId: undefined,
                selectedEdgeId: undefined,
                selectedStepId: undefined,
                highlightedEntityKeys: [],
              },
            }))
          },
          setFilter(key, value) {
            set((state) => ({
              ...state,
              ui: {
                ...state.ui,
                filters: {
                  ...state.ui.filters,
                  [key]: value,
                },
              },
            }))
          },
          setSearch(value) {
            set((state) => ({
              ...state,
              ui: {
                ...state.ui,
                filters: {
                  ...state.ui.filters,
                  search: value,
                },
              },
            }))
          },
          setViewport(viewport) {
            set((state) => ({
              ...state,
              ui: {
                ...state.ui,
                viewport,
              },
            }))
          },
          togglePanelB() {
            set((state) => ({
              ...state,
              ui: {
                ...state.ui,
                panelBVisible: !state.ui.panelBVisible,
                panelBSize: clampPanelBPercent(state.ui.panelBSize),
              },
            }))
          },
          setPanelBSize(size) {
            set((state) => ({
              ...state,
              ui: {
                ...state.ui,
                panelBSize: clampPanelBPercent(size),
              },
            }))
          },
          toggleViewportLock() {
            set((state) => ({
              ...state,
              ui: {
                ...state.ui,
                viewportLocked: !state.ui.viewportLocked,
              },
            }))
          },
          toggleReduceMotion() {
            set((state) => ({
              ...state,
              ui: {
                ...state.ui,
                reduceMotion: !state.ui.reduceMotion,
              },
            }))
          },
          setSystemReduceMotion(value) {
            set((state) => ({
              ...state,
              ui: {
                ...state.ui,
                systemReduceMotion: value,
              },
            }))
          },
          setMode(mode) {
            set((state) => ({
              ...state,
              ui: {
                ...state.ui,
                mode,
              },
            }))
          },
          setTheme(theme) {
            set((state) => ({
              ...state,
              projection: {
                ...state.projection,
                theme,
              },
            }))
          },
          updateNodePosition(nodeId, position) {
            set((state) => ({
              ...state,
              projection: {
                ...state.projection,
                nodePositions: {
                  ...state.projection.nodePositions,
                  [nodeId]: position,
                },
              },
              layout: {
                ...state.layout,
                positions: {
                  ...state.layout.positions,
                  [nodeId]: position,
                },
              },
            }))
          },
          updateEdgeHandles(edgeId, handles) {
            set((state) => ({
              ...state,
              projection: {
                ...state.projection,
                edgeHandles: {
                  ...state.projection.edgeHandles,
                  [edgeId]: handles,
                },
              },
            }))
          },
          toggleCollapsed(nodeId) {
            set((state) => {
              const isCollapsed = state.projection.collapsedNodeIds.includes(nodeId)
              return {
                ...state,
                projection: {
                  ...state.projection,
                  collapsedNodeIds: isCollapsed
                    ? state.projection.collapsedNodeIds.filter((id) => id !== nodeId)
                    : [...state.projection.collapsedNodeIds, nodeId],
                },
              }
            })
          },
          setAnnotation(entityId, note) {
            set((state) => ({
              ...state,
              projection: {
                ...state.projection,
                annotations: {
                  ...state.projection.annotations,
                  [entityId]: note,
                },
              },
            }))
          },
          setExpandedNoteIds(ids) {
            set((state) => ({
              ...state,
              projection: {
                ...state.projection,
                expandedNoteIds: ids,
              },
            }))
          },
          saveSnapshot(name) {
            const snapshotId = `snapshot-${Date.now()}`
            const state = get()
            set({
              ...state,
              projection: {
                ...state.projection,
                snapshots: [
                  ...state.projection.snapshots,
                  {
                    id: snapshotId,
                    name,
                    createdAt: new Date().toISOString(),
                    state: {
                      nodePositions: state.projection.nodePositions,
                      edgeHandles: state.projection.edgeHandles,
                      panelBSize: clampPanelBPercent(state.ui.panelBSize),
                      panelBVisible: state.ui.panelBVisible,
                      theme: state.projection.theme,
                    },
                  },
                ],
              },
            })
          },
          async loadSnapshot(snapshotId) {
            const snapshot = get().projection.snapshots.find((item) => item.id === snapshotId)
            if (!snapshot) {
              return
            }
            set((state) => ({
              ...state,
              projection: {
                ...state.projection,
                nodePositions: snapshot.state.nodePositions,
                edgeHandles: snapshot.state.edgeHandles,
                theme: snapshot.state.theme,
              },
              ui: {
                ...state.ui,
                panelBSize: clampPanelBPercent(snapshot.state.panelBSize),
                panelBVisible: snapshot.state.panelBVisible,
              },
              layout: {
                ...state.layout,
                ready: false,
              },
            }))
            await get().actions.initialize()
          },
          deleteSnapshot(snapshotId) {
            set((state) => ({
              ...state,
              projection: {
                ...state.projection,
                snapshots: state.projection.snapshots.filter((item) => item.id !== snapshotId),
              },
            }))
          },
          async resetLayout() {
            set((state) => ({
              ...state,
              projection: {
                ...state.projection,
                nodePositions: {},
                edgeHandles: {},
              },
              layout: {
                ...state.layout,
                ready: false,
                positions: {},
              },
            }))
            await get().actions.initialize()
          },
        },
      }),
      {
        name: 'aea-architecture-ui-v2',
        partialize: (state) => ({
          ui: {
            mode: state.ui.mode,
            filters: state.ui.filters,
            viewport: state.ui.viewport,
            panelBVisible: state.ui.panelBVisible,
            panelBSize: clampPanelBPercent(state.ui.panelBSize),
            viewportLocked: state.ui.viewportLocked,
            reduceMotion: state.ui.reduceMotion,
          },
          projection: state.projection,
        }),
        merge: (persisted, current) => {
          const typedPersisted = persisted as Partial<DiagramStore>
          return {
            ...current,
            ui: {
              ...current.ui,
              ...typedPersisted.ui,
              panelBSize: clampPanelBPercent(typedPersisted.ui?.panelBSize ?? current.ui.panelBSize),
              filters: {
                ...current.ui.filters,
                ...typedPersisted.ui?.filters,
              },
            },
            projection: {
              ...current.projection,
              ...typedPersisted.projection,
            },
          }
        },
      },
    ),
  ),
)
