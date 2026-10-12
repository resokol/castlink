export default function NotFound() {
  return <main className="graphite-entry status-page">
    <section className="panel stack status-card">
      <p className="eyebrow">CASTLINK · 404</p>
      <h1>Страница не найдена</h1>
      <p className="muted">Проверьте адрес ссылки или вернитесь на главную страницу.</p>
      <div className="actions"><a className="button-link" href="/">На главную</a></div>
    </section>
  </main>;
}
