// FILE: app/api/admin/logout/route.ts
// Add this file to the client repo (williamb_constuction).
//
// POST /api/admin/logout → clears the httpOnly `nodelx_admin_session` cookie
// and redirects the visitor back to the homepage. The live SignOutButton POSTs
// here; the NodelxBridge "Sign out" link should also POST (or navigate to a
// small form that POSTs).

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()
  cookieStore.set('nodelx_admin_session', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0, // expire immediately
  })

  return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_SITE_URL || 'https://www.diamondbctx.com'))
}
