import { useState, useEffect } from 'react'

export function useUpdateSW() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [sw, setSw] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    const reg = (navigator as any).serviceWorker
    reg.ready.then((registration: ServiceWorkerRegistration) => {
      setSw(registration.waiting ?? null)
    })
    const onWaiting = (registration: ServiceWorkerRegistration) => {
      setSw(registration.waiting)
      setNeedRefresh(true)
    }
    reg.addEventListener('controllerchange', () => window.location.reload())
    reg.getRegistration().then((registration: ServiceWorkerRegistration | undefined) => {
      if (registration?.waiting) {
        setSw(registration.waiting)
        setNeedRefresh(true)
      }
      registration?.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && reg.controller) {
            setSw(newWorker)
            setNeedRefresh(true)
          }
        })
      })
    })
    return () => {
      reg.getRegistration().then((r: ServiceWorkerRegistration | undefined) => {
        r?.removeEventListener('updatefound', onWaiting as any)
      })
    }
  }, [])

  const updateServiceWorker = () => {
    if (sw) {
      sw.postMessage({ type: 'SKIP_WAITING' })
    } else {
      window.location.reload()
    }
  }

  return { needRefresh, updateServiceWorker }
}
