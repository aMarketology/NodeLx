// FILE: app/api/admin/login/route.ts
// Add this file to the client repo (williamb_constuction).
//
// POST /api/admin/login → validates the submitted password against the
// ADMIN_PASSWORD env var, then sets the httpOnly `nodelx_admin_session` cookie
// to ADMIN_SECRET. The NodelxBridge checks this cookie via GET /api/admin/me to
// decide whether to activate inline editing.
//
// This route is deliberately simple: the client site has a single admin
// password (stored in ADMIN_PASSWORD). The cookie value is a separate secret
// (ADMIN_SECRET) so the stored credential never travels in the cookie.

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const { password } = await request.json().catch(() => ({ password: null }))

  const expected = process.env.ADMIN_PASSWORD
  const secret = process.env.ADMIN_SECRET

  if (!expected) {
    return NextResponse.json(
      { error: 'ADMIN_PASSWORD is not configured on the server' },
      { status: 500 }
    )
  }
  if (!secret) {
    return NextResponse.json(
      { error: 'ADMIN_SECRET is not configured on the server' },
      { status: 500 }
    )
  }

  if (!password || password !== expected) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const cookieStore = await cookies()
  cookieStore.set('nodelx_admin_session', secret, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })

  return NextResponse.json({ ok: true })
}
