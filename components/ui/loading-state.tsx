export function OperationsLoading({ label = 'جارٍ تحميل بيانات التشغيل…' }: { label?: string }) {
  const metricSlots = ['live', 'calls', 'bookings', 'review']
  const queueSlots = ['one', 'two', 'three', 'four', 'five', 'six']

  return (
    <div className="skeleton-page" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      <div className="skeleton-heading" aria-hidden="true">
        <span className="skeleton skeleton-kicker" />
        <span className="skeleton skeleton-title" />
      </div>
      <div className="skeleton-metrics" aria-hidden="true">
        {metricSlots.map((slot) => (
          <span className="skeleton skeleton-metric" key={slot} />
        ))}
      </div>
      <div className="skeleton-master-detail" aria-hidden="true">
        <div className="skeleton-list">
          {queueSlots.map((slot) => (
            <span className="skeleton skeleton-row" key={slot} />
          ))}
        </div>
        <div className="skeleton-detail">
          <span className="skeleton skeleton-detail-head" />
          <span className="skeleton skeleton-detail-body" />
        </div>
      </div>
    </div>
  )
}
