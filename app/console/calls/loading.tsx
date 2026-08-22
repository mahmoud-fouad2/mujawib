const CALL_ROW_SKELETONS = ['call-1', 'call-2', 'call-3', 'call-4', 'call-5', 'call-6']

export default function CallsLoading() {
  return (
    <div className="skeleton-page" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">جارٍ تحميل سجل المكالمات…</span>
      <div className="skeleton skeleton-head" />
      <div className="skeleton skeleton-toolbar" />
      <div className="skeleton-master-detail">
        <div className="skeleton-list" aria-hidden="true">
          {CALL_ROW_SKELETONS.map((row) => (
            <div className="skeleton skeleton-row" key={row} />
          ))}
        </div>
        <div className="skeleton-detail" aria-hidden="true">
          <div className="skeleton skeleton-detail-head" />
          <div className="skeleton skeleton-detail-body" />
        </div>
      </div>
    </div>
  )
}
