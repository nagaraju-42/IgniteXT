// ============================================================
// IGNITEXT — Firebase Push Notifications
// Handles web push for browser + Capacitor FCM for Android app
// ============================================================

import { initializeApp, getApps, getApp } from 'firebase/app'
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging'

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Initialize Firebase (singleton)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

let messaging: Messaging | null = null

function getFirebaseMessaging(): Messaging | null {
  if (typeof window === 'undefined') return null
  if (!('Notification' in window)) return null
  if (!messaging) {
    messaging = getMessaging(app)
  }
  return messaging
}

// ── Request notification permission & get FCM token ──────────
export async function requestNotificationPermission(): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.log('[FCM] Notification permission denied')
      return null
    }

    const msg = getFirebaseMessaging()
    if (!msg) return null

    const token = await getToken(msg, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    })

    if (token) {
      console.log('[FCM] Token obtained:', token.substring(0, 20) + '...')
      // Save token to Supabase profile if user is logged in
      await saveTokenToProfile(token)
      return token
    }
    return null
  } catch (error) {
    console.error('[FCM] Error getting token:', error)
    return null
  }
}

// ── Save FCM token to Supabase profile ───────────────────────
async function saveTokenToProfile(token: string) {
  try {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('profiles')
        .update({ fcm_token: token })
        .eq('id', user.id)
    }
    // Also store in localStorage for anonymous users
    localStorage.setItem('ignitext_fcm_token', token)
  } catch (err) {
    console.error('[FCM] Failed to save token:', err)
  }
}

// ── Handle foreground messages ────────────────────────────────
export function onForegroundMessage(callback: (payload: any) => void) {
  const msg = getFirebaseMessaging()
  if (!msg) return () => {}
  return onMessage(msg, callback)
}

// ── Send notification via server (API route) ─────────────────
export async function sendPushNotification(payload: {
  title: string
  body: string
  type: string
  ref_id?: string
  target_tokens?: string[]  // specific device tokens
  topic?: string            // FCM topic (e.g. 'all_students')
}) {
  const res = await fetch('/api/notifications/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

export { app }
