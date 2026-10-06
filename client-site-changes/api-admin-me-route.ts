// FILE: app/api/admin/me/route.ts
// Add this file to the client repo (williamb_constuction).
//
// Returns whether the current visitor is logged in as admin, by checking the
// httpOnly `admin_session` cookie (which client-side JS can't read directly).
// The NodelxBridge uses this to decide whether to activate inline editing.

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  const secret = process.env.ADMIN_SECRET

  const loggedIn = Boolean(session && secret && session === secret)

  return NextResponse.json({ loggedIn })
}