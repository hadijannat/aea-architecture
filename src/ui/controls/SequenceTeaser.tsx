interface SequenceTeaserProps {
  relatedSelectionLabel?: string
  onOpen(): void
}

export function SequenceTeaser({ relatedSelectionLabel, onOpen }: SequenceTeaserProps) {
  return (
    <section className="sequence-teaser" aria-label="VoR sequence teaser">
      <div className="sequence-teaser__copy">
        <span className="sequence-teaser__kicker">Panel B</span>
        <strong>VoR sequence</strong>
        <p>
          {relatedSelectionLabel
            ? `A linked sequence is available for ${relatedSelectionLabel}.`
            : 'Keep the sequence collapsed until a mapped selection or explicit reader intent calls for it.'}
        </p>
      </div>
      <button type="button" className="chip sequence-teaser__action" onClick={onOpen}>
        {relatedSelectionLabel ? 'Open linked sequence' : 'Open sequence'}
      </button>
    </section>
  )
}
