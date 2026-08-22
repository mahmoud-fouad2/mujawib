const JOURNEY_ROW_SKELETONS = ['journey-1', 'journey-2', 'journey-3', 'journey-4']

export default function ClientLoading() {
  return (
    <div className="skeleton-page" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">جارٍ تحميل ملف العميل…</span>
      <div className="skeleton skeleton-head" />
      <div className="skeleton skeleton-strip" />
      <div className="skeleton-journey" aria-hidden="true">
        <div className="skeleton skeleton-journey-head" />
        {JOURNEY_ROW_SKELETONS.map((row) => (
          <div className="skeleton skeleton-row" key={row} />
        ))}
      </div>
      <div className="skeleton-split">
        <div className="skeleton skeleton-panel" />
        <div className="skeleton skeleton-panel" />
      </div>
    </div>
  )
}
