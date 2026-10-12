"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="graphite-entry status-page">
    <section className="panel stack status-card" role="alert">
      <p className="eyebrow">CASTLINK</p>
      <h1>Не удалось открыть страницу</h1>
      <p className="muted">Попробуйте ещё раз. Если ошибка повторяется, вернитесь на главную страницу.</p>
      <div className="actions">
        <button type="button" className="button-primary" onClick={reset}>Попробовать снова</button>
        <a className="button-link" href="/">На главную</a>
      </div>
    </section>
  </main>;
}
