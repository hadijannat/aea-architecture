interface ExportBarProps {
  onExportSvg(mode: 'current' | 'full'): void
  onExportPdf(mode: 'current' | 'full'): void
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
      <button type="button" onClick={() => onExportSvg('current')}>
        SVG current
      </button>
      <button type="button" onClick={() => onExportSvg('full')}>
        SVG full
      </button>
      <button type="button" onClick={() => onExportPdf('current')}>
        PDF current
      </button>
      <button type="button" onClick={() => onExportPdf('full')}>
        PDF full
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

