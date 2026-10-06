// FILE: app/api/admin/content/route.ts
// Add this file to the client repo (williamb_constuction).
//
// GET /api/admin/content → returns the current content/home.json (read from
// NodeLx, which reads it from GitHub). Used by NodelxBridge to fetch the
// current content before applying staged edits.

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  // Auth check
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  const secret = process.env.ADMIN_SECRET
  if (!session || !secret || session !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const nodelxUrl = process.env.NODELX_URL
  const apiKey = process.env.NODELX_API_KEY
  const siteId = process.env.NODELX_SITE_ID

  if (!nodelxUrl || !apiKey || !siteId) {
    return NextResponse.json({ error: 'NODELX_URL, NODELX_API_KEY, NODELX_SITE_ID not set' }, { status: 500 })
  }

  try {
    const res = await fetch(`${nodelxUrl}/api/sites/${siteId}/content/home`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return NextResponse.json({ error: body.error || res.status }, { status: res.status })
    }
    const data = await res.json()
    return NextResponse.json({ content: data.content })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}