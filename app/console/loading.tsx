/**
 * Shown while a console route streams its queries. Sized to the real layout so
 * the page does not jump when data lands.
 */
export default function ConsoleLoading() {
  return (
    <div className="skeleton-page" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">جارٍ تحميل البيانات…</span>
      <div className="skeleton skeleton-head" />
      <div className="skeleton skeleton-strip" />
      <div className="skeleton-split">
        <div className="skeleton skeleton-panel" />
        <div className="skeleton skeleton-panel" />
      </div>
    </div>
  )
}
