// API Route: POST /api/notifications/send
// Sends Firebase push notifications to all devices or specific tokens
// Server-side only — uses Firebase Admin SDK

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, body: msgBody, type, ref_id, target_tokens, topic } = body

    if (!title || !msgBody) {
      return NextResponse.json({ error: 'title and body required' }, { status: 400 })
    }

    const serverKey = process.env.FIREBASE_SERVER_KEY
    if (!serverKey) {
      return NextResponse.json({ error: 'FCM server key not configured' }, { status: 500 })
    }

    const notification = {
      title,
      body: msgBody,
      icon: '/icons/icon-192x192.png',
      click_action: ref_id ? `/${type === 'announcement' ? 'updates' : 'subject'}/${ref_id}` : '/',
    }

    const data = { type: type || 'system', ref_id: ref_id || '' }

    let fcmPayload: any

    if (topic) {
      // Send to FCM topic (e.g. /topics/all_students)
      fcmPayload = { to: `/topics/${topic}`, notification, data }
    } else if (target_tokens && target_tokens.length > 0) {
      // Send to specific device tokens
      fcmPayload = {
        registration_ids: target_tokens,
        notification,
        data,
      }
    } else {
      // Broadcast to all — use 'all_students' topic
      fcmPayload = { to: '/topics/all_students', notification, data }
    }

    // Send via FCM Legacy API
    const fcmRes = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        Authorization: `key=${serverKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fcmPayload),
    })

    const fcmData = await fcmRes.json()

    // Log notification to Supabase
    const supabase = createAdminClient()
    await supabase.from('notification_logs').insert({
      title,
      body: msgBody,
      type: type || 'system',
      ref_id: ref_id || null,
      sent_count: fcmData.success || 1,
    })

    return NextResponse.json({ success: true, fcm: fcmData })
  } catch (err: any) {
    console.error('[Notification API] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
