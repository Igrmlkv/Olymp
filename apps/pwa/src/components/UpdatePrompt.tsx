import { useRegisterSW } from 'virtual:pwa-register/react'

/** Look for a new version once an hour; a tablet can stay open all evening. */
const UPDATE_CHECK_MS = 60 * 60 * 1000

/**
 * Registers the service worker and offers the update when one is waiting.
 *
 * The worker is configured `registerType: 'prompt'`, which means a new build
 * waits for someone to accept it. Nothing did: the plugin injected a
 * registration script, `onNeedRefresh` had no listener, and an installed app
 * kept serving the version it first cached — forever. Either this component
 * exists or the config has to become `autoUpdate`, and autoUpdate reloads the
 * page under a child who is in the middle of a task.
 */
export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      setInterval(() => void registration.update(), UPDATE_CHECK_MS)
    },
  })

  /**
   * Hand over to the new worker, then reload ourselves.
   *
   * `updateServiceWorker(true)` promises the reload, but it binds that to a
   * workbox event that never arrived when the update had been found by
   * `registration.update()` — which is how our hourly check finds it. The
   * waiting worker activated and the page stayed on the old assets with the
   * banner still up. Waiting for `controllerchange` is the honest signal;
   * the timeout is there so a browser that never fires it still reloads.
   */
  async function applyUpdate() {
    const swapped = new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })
    })

    await updateServiceWorker(false)
    await Promise.race([swapped, new Promise((resolve) => setTimeout(resolve, 3000))])
    window.location.reload()
  }

  if (!offlineReady && !needRefresh) return null

  return (
    <div className="sw-toast" role="status">
      {needRefresh ? (
        <>
          <span>Есть новая версия задач и приложения.</span>
          <button className="primary" onClick={() => void applyUpdate()}>
            Обновить
          </button>
          <button onClick={() => setNeedRefresh(false)}>Позже</button>
        </>
      ) : (
        <>
          <span>Готово: приложение работает без интернета.</span>
          <button onClick={() => setOfflineReady(false)}>Понятно</button>
        </>
      )}
    </div>
  )
}
