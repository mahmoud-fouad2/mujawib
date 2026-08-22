export default function SignInLoading() {
  return (
    <div className="auth auth-loading" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">جارٍ تجهيز تسجيل الدخول…</span>
      <div className="auth-loading__form" aria-hidden="true">
        <span className="skeleton auth-loading__logo" />
        <span className="skeleton auth-loading__title" />
        <span className="skeleton auth-loading__copy" />
        <span className="skeleton auth-loading__field" />
        <span className="skeleton auth-loading__field" />
        <span className="skeleton auth-loading__button" />
      </div>
      <div className="auth-loading__preview on-ink" aria-hidden="true">
        <span className="skeleton auth-loading__preview-title" />
        <span className="skeleton auth-loading__record" />
      </div>
    </div>
  )
}
