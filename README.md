# AEA Architecture Graph Application

Interactive React application that projects the AEA Architecture Figure master specification into a canonical graph model, a React Flow architecture canvas, and a synchronized VoR sequence panel.

## Stack

- Vite + React + TypeScript
- React Flow for Panel A
- Fixed board layout for Panel A
- Zustand for UI, selection, projection overrides, and persistence
- Mermaid and SVG/PDF export from the same graph model

## Source of Truth

- `docs/AEA_Figure_Specification.md` is the semantic authority copied from the provided source file.
- `src/graph/spec/architecture.graph.json` is the audited runtime mirror used by the app.
- `src/graph/spec/projection.defaults.json` and persisted browser state hold author-mode projection overrides only.

The UI does not allow semantic node or edge creation, deletion, or retargeting. Author mode is limited to layout and presentation concerns.

## Commands

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run test:e2e`

## Exports

The header export bar supports:

- SVG viewport
- SVG publication
- PDF viewport
- PDF publication
- Mermaid export for Panel A and Panel B
- raw `graph.json`
- raw `projection.json`

## Test Coverage

- Unit tests validate manifest integrity, semantic invariants, Mermaid generation, and SVG export metadata.
- Playwright covers F5 -> Panel B synchronization and C4 write-path filtering.
