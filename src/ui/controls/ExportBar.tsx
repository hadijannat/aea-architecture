import type { ExportMode } from '@/graph/compile/toExportSvg'

interface ExportBarProps {
  onExportSvg(mode: ExportMode): void
  onExportPdf(mode: ExportMode): void
  onExportMermaid(panel: 'architecture' | 'vor-sequence'): void
  onExportGraphJson(): void
  onExportProjection(): void
}

export function ExportBar({
  onExportSvg,
  onExportPdf,
  onExportMermaid,
  onExportGraphJson,
  onExportProjection,
}: ExportBarProps) {
  return (
    <div className="export-bar">
      <button type="button" onClick={() => onExportSvg('viewport')}>
        SVG viewport
      </button>
      <button type="button" onClick={() => onExportSvg('publication')}>
        SVG publication
      </button>
      <button type="button" onClick={() => onExportPdf('viewport')}>
        PDF viewport
      </button>
      <button type="button" onClick={() => onExportPdf('publication')}>
        PDF publication
      </button>
      <button type="button" onClick={() => onExportMermaid('architecture')}>
        Mermaid A
      </button>
      <button type="button" onClick={() => onExportMermaid('vor-sequence')}>
        Mermaid B
      </button>
      <button type="button" onClick={onExportGraphJson}>
        graph.json
      </button>
      <button type="button" onClick={onExportProjection}>
        projection.json
      </button>
    </div>
  )
}
