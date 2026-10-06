// FILE: app/api/admin/save/route.ts
// Add this file to the client repo (williamb_constuction).
//
// POST /api/admin/save → sends the full content object to NodeLx, which
// commits content/home.json to GitHub and revalidates the live site.
// Used by NodelxBridge's "Publish" button.

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function POST(request: Request) {
  // Auth check
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  const secret = process.env.ADMIN_SECRET
  if (!session || !secret || session !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { content } = await request.json().catch(() => ({ content: null }))
  if (!content) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  const nodelxUrl = process.env.NODELX_URL
  const apiKey = process.env.NODELX_API_KEY
  const siteId = process.env.NODELX_SITE_ID

  if (!nodelxUrl || !apiKey || !siteId) {
    return NextResponse.json({ error: 'NODELX_URL, NODELX_API_KEY, NODELX_SITE_ID not set' }, { status: 500 })
  }

  try {
    const res = await fetch(`${nodelxUrl}/api/sites/${siteId}/content/home`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        content,
        authorEmail: 'admin@williambconstruction.com',
        revalidatePaths: ['/'],
      }),
      cache: 'no-store',
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return NextResponse.json({ error: body.error || res.status }, { status: res.status })
    }

    const data = await res.json()

    // Belt-and-suspenders: also revalidate locally
    revalidatePath('/')

    return NextResponse.json({ ok: true, commit: data.commit, revalidate: data.revalidate })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}