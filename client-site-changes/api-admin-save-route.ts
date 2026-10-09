// FILE: app/api/admin/save/route.ts
// Add this file to the client repo (williamb_constuction).
//
// POST /api/admin/save → the in-context editor's "Save Changes" endpoint.
//
// Body: { mutations: Record<string, string> }
//   mutations use dot-notation ids matching the `data-editable` attributes:
//     "hero.badge", "hero.h1_0", "hero.body", "projects.0.title", "projects.0.img"
//
// Flow:
//   1. Verify admin session cookie (nodelx_admin_session === ADMIN_SECRET).
//   2. Load current content (GitHub in prod, local file in dev).
//   3. Apply each mutation onto the content tree.
//   4. PUT the full content to NodeLx, which commits to GitHub + revalidates.

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getHomeContentCMS } from '@/lib/cms'
import type { HomeContent } from '@/lib/content'

/**
 * Apply a dot-notation mutation path onto the content object.
 * Handles:
 *   - "hero.badge"         → obj.hero.badge
 *   - "hero.h1_0"          → obj.hero.h1[0]        (h1_N → array index)
 *   - "projects.0.title"   → obj.projects[0].title
 *   - "about.paragraphs.0" → obj.about.paragraphs[0]
 */
function applyMutation(obj: any, path: string, value: string) {
  const segments = path.split('.')
  let cursor = obj

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]

    // "h1_0" → array "h1" index 0
    const arrayMatch = /^(.+)_(\d+)$/.exec(seg)
    if (arrayMatch && Array.isArray(cursor[arrayMatch[1]])) {
      cursor = cursor[arrayMatch[1]][Number(arrayMatch[2])]
      continue
    }

    // numeric segment → array index
    if (/^\d+$/.test(seg) && Array.isArray(cursor)) {
      cursor = cursor[Number(seg)]
      continue
    }

    cursor = cursor[seg]
    if (cursor === undefined || cursor === null) return
  }

  const last = segments[segments.length - 1]
  const lastArrayMatch = /^(.+)_(\d+)$/.exec(last)
  if (lastArrayMatch && Array.isArray(cursor[lastArrayMatch[1]])) {
    cursor[lastArrayMatch[1]][Number(lastArrayMatch[2])] = value
    return
  }

  cursor[last] = value
}

export async function POST(request: Request) {
  // Auth check
  const cookieStore = await cookies()
  const session = cookieStore.get('nodelx_admin_session')?.value
  const secret = process.env.ADMIN_SECRET
  if (!session || !secret || session !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { mutations?: Record<string, string> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const mutations = body.mutations
  if (!mutations || typeof mutations !== 'object' || Object.keys(mutations).length === 0) {
    return NextResponse.json({ error: 'No mutations provided' }, { status: 400 })
  }

  const nodelxUrl = process.env.NODELX_URL
  const apiKey = process.env.NODELX_API_KEY
  const siteId = process.env.NODELX_SITE_ID

  if (!nodelxUrl || !apiKey || !siteId) {
    return NextResponse.json(
      { error: 'NODELX_URL, NODELX_API_KEY, NODELX_SITE_ID not set' },
      { status: 500 }
    )
  }

  try {
    // Load current content and deep-clone so we don't mutate the cached object
    const content: HomeContent = JSON.parse(JSON.stringify(await getHomeContentCMS()))

    // Apply each dot-notation mutation onto the content tree
    for (const [path, value] of Object.entries(mutations)) {
      applyMutation(content, path, value)
    }

    // Send the full content to NodeLx, which commits to GitHub + revalidates
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
      const errBody = await res.json().catch(() => ({}))
      return NextResponse.json({ error: errBody.error || res.status }, { status: res.status })
    }

    const data = await res.json()

    // Belt-and-suspenders: also revalidate locally
    revalidatePath('/')

    return NextResponse.json({ ok: true, commit: data.commit, revalidate: data.revalidate })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}