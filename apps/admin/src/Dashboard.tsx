/**
 * Admin dashboard. Sits behind Cloudflare Access — there is no login here on
 * purpose; Access is the only gate. See docs/deployment.md.
 *
 * Scaffold: the panels below are the ones section 11 of the spec calls for.
 * Each needs a matching read endpoint on the proxy Worker before it shows data.
 */
export function Dashboard() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '60rem', margin: '0 auto', padding: '2rem 1rem' }}>
      <h1>Олимп — админ-панель</h1>

      <section>
        <h2>Стоимость API</h2>
        <p>
          Расход по <code>proxy_requests</code>, сверка с Anthropic Admin API (usage/cost).
          <em> Не реализовано.</em>
        </p>
      </section>

      <section>
        <h2>Качество генерации</h2>
        <p>
          Доля брака верификации по <code>verification_verdicts</code>, разбивка по темам и уровням.
          <em> Не реализовано.</em>
        </p>
      </section>

      <section>
        <h2>Пакеты контента</h2>
        <p>
          Версии, checksums, статусы публикации, откат версии по <code>package_versions</code>.
          <em> Не реализовано.</em>
        </p>
      </section>

      <section>
        <h2>Телеметрия</h2>
        <p>
          Решаемость задач по агрегатам <code>telemetry_daily</code> — без идентификаторов установок.
          <em> Не реализовано.</em>
        </p>
      </section>
    </main>
  )
}
