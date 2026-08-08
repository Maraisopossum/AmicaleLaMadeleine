import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

// Le navigateur attend la clé VAPID en Uint8Array, Supabase/web-push la
// fournissent en base64 URL-safe : conversion standard recommandée par la
// spec Push API.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64Safe)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function pushSupporte(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY
}

export async function statutAbonnementPush(): Promise<boolean> {
  if (!pushSupporte()) return false
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  return !!subscription
}

export async function activerPush(membreId: string): Promise<{ ok: boolean; erreur?: string }> {
  if (!pushSupporte()) return { ok: false, erreur: 'Notifications non supportées sur cet appareil/navigateur.' }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, erreur: 'Permission refusée.' }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
  })

  const json = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert({
    membre_id: membreId,
    endpoint: json.endpoint!,
    p256dh: json.keys!.p256dh,
    auth: json.keys!.auth,
  }, { onConflict: 'endpoint' })

  if (error) return { ok: false, erreur: error.message }
  return { ok: true }
}

export async function desactiverPush(): Promise<void> {
  if (!pushSupporte()) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return

  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}
