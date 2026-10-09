'use client'

/**
 * NodelxBridge.tsx — inline editing on the LIVE site.
 *
 * Activates when the visitor is logged in as admin (nodelx_admin_session
 * cookie, checked via GET /api/admin/me). When active:
 *   1. Shows a fixed "Editing Mode" bar at the top of the page.
 *   2. Outlines every editable element on hover.
 *   3. Click a text element → contenteditable inline editing.
 *   4. Click an image element → file picker → uploads → swaps src.
 *   5. Edits are staged locally; the bar's "Publish" button sends the staged
 *      mutations to POST /api/admin/save, which applies them onto the current
 *      content and PUTs the full content to NodeLx (GitHub commit + revalidate).
 *
 * Element identification (three compatible formats, in priority order):
 *   Format A (primary):  data-editable="hero.badge"
 *                        data-editable-type="image"  (for images)
 *   Format B (legacy):   data-nodelx-id="hero.heroImage" data-nodelx-type="image"
 *   Format C (legacy):   [data-nodelx-section="hero"] > [data-nodelx-field="badge"]
 *     The bridge derives id "hero.badge" at click time.
 */

import { useEffect, useState, useCallback } from 'react'

export default function NodelxBridge() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [pending, setPending] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  const dirtyCount = Object.keys(pending).length

  // ── Check admin login state ──────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/admin/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setIsAdmin(Boolean(d.loggedIn)))
      .catch(() => setIsAdmin(false))
  }, [])

  // ── Activate editing UI when admin ───────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return

    // Inject outline styles
    const style = document.createElement('style')
    style.id = 'nodelx-bridge-styles'
    style.textContent = `
      [data-editable], [data-nodelx-id], [data-nodelx-field] {
        cursor: pointer !important;
        outline: 2px solid transparent;
        outline-offset: 3px;
        transition: outline-color 0.15s ease;
      }
      [data-editable]:hover, [data-nodelx-id]:hover, [data-nodelx-field]:hover {
        outline-color: #3b82f6 !important;
      }
      [data-editable].nodelx-editing, [data-nodelx-id].nodelx-editing, [data-nodelx-field].nodelx-editing {
        outline-color: #2563eb !important;
        outline-width: 2px;
        background: rgba(59,130,246,0.06);
      }
      [data-editable].nodelx-staged, [data-nodelx-id].nodelx-staged, [data-nodelx-field].nodelx-staged {
        outline-color: #4ade80 !important;
      }
    `
    document.head.appendChild(style)

    function resolveId(el: HTMLElement): string | null {
      // Format A (primary): data-editable
      const editable = el.getAttribute('data-editable')
      if (editable) return editable
      // Format B (legacy): data-nodelx-id
      const explicit = el.getAttribute('data-nodelx-id')
      if (explicit) return explicit
      // Format C (legacy): data-nodelx-field inside data-nodelx-section
      const field = el.getAttribute('data-nodelx-field')
      const section = el.closest('[data-nodelx-section]')?.getAttribute('data-nodelx-section')
      if (field && section) return `${section}.${field}`
      return null
    }

    function isImage(el: HTMLElement): boolean {
      return (
        el.getAttribute('data-editable-type') === 'image' ||
        el.getAttribute('data-nodelx-type') === 'image'
      )
    }

    function readValue(el: HTMLElement): string {
      if (isImage(el)) {
        return el.querySelector('img')?.getAttribute('src') ?? ''
      }
      return el.textContent?.trim() ?? ''
    }

    function clearEditing() {
      document.querySelectorAll('.nodelx-editing').forEach((n) => {
        n.setAttribute('contenteditable', 'false')
        n.classList.remove('nodelx-editing')
      })
    }

    // ── Click handler: text → contenteditable, image → file picker ─────────
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      const el = (target.closest('[data-editable]') ||
        target.closest('[data-nodelx-id]') ||
        target.closest('[data-nodelx-field]')) as HTMLElement | null
      if (!el) return

      e.preventDefault()
      e.stopPropagation()
      clearEditing()

      const id = resolveId(el)
      if (!id) return

      if (isImage(el)) {
        // Image: open file picker → upload to NodeLx → swap src
        const input = document.createElement('input')
                input.type = 'file'
                input.accept = 'image/jpeg,image/png,image/webp'
                input.onchange = async () => {
                  const file = input.files?.[0]
                  if (!file) return
                  // Upload via the existing multipart route (proxies to NodeLx → Supabase)
                  try {
                    const formData = new FormData()
                    formData.append('file', file)
                    formData.append('folder', 'uploads')
                    const res = await fetch('/api/admin/upload', {
                      method: 'POST',
                      body: formData,
                    })
                    const up = await res.json()
                    if (res.ok && up.url) {
                      const img = el.querySelector('img')
                      if (img) img.src = up.url
                      setPending((prev) => ({ ...prev, [id]: up.url }))
                      el.classList.add('nodelx-staged')
                      setStatus('Image staged — click Publish to commit')
                    } else {
                      setStatus('Upload failed: ' + (up.error || 'unknown'))
                    }
                  } catch (err: any) {
                    setStatus('Upload failed: ' + err.message)
                  }
                }
                input.click()
      } else {
        // Text: contenteditable inline editing
        el.setAttribute('contenteditable', 'true')
        el.classList.add('nodelx-editing')
        el.focus()

        const onBlur = () => {
          el.setAttribute('contenteditable', 'false')
          el.classList.remove('nodelx-editing')
          const value = el.textContent?.trim() ?? ''
          if (value) {
            setPending((prev) => ({ ...prev, [id]: value }))
            el.classList.add('nodelx-staged')
            setStatus('Change staged — click Publish to commit')
          }
          el.removeEventListener('blur', onBlur)
        }
        el.addEventListener('blur', onBlur)

        const onKey = (ev: KeyboardEvent) => {
          if (ev.key === 'Enter' && !ev.shiftKey) {
            ev.preventDefault()
            el.blur()
          }
          if (ev.key === 'Escape') {
            el.blur()
          }
        }
        el.addEventListener('keydown', onKey)
      }
    }

    document.addEventListener('click', handleClick, true)

    return () => {
      document.removeEventListener('click', handleClick, true)
      document.getElementById('nodelx-bridge-styles')?.remove()
    }
  }, [isAdmin])

  // ── Publish: send staged mutations to /api/admin/save ────────────────────
  const publish = useCallback(async () => {
    if (dirtyCount === 0 || saving) return
    setSaving(true)
    setStatus('Publishing…')

    try {
      // Send the staged dot-notation mutations. The save route re-reads the
      // current content, applies these, and PUTs the full content to NodeLx.
      const saveRes = await fetch('/api/admin/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mutations: pending }),
      })
      const saveData = await saveRes.json()

      if (!saveRes.ok) throw new Error(saveData.error || 'Save failed')

      setPending({})
      setStatus('✓ Published — live in ~5 seconds')
      document.querySelectorAll('.nodelx-staged').forEach((n) => n.classList.remove('nodelx-staged'))
      setTimeout(() => setStatus(''), 4000)
    } catch (err: any) {
      setStatus('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }, [pending, dirtyCount, saving])

  const discard = useCallback(() => {
    setPending({})
    setStatus('Discarded')
    document.querySelectorAll('.nodelx-staged').forEach((n) => n.classList.remove('nodelx-staged'))
    setTimeout(() => setStatus(''), 2000)
  }, [])

  if (!isAdmin) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: '#0d0d0d',
        borderBottom: '1px solid #242424',
        color: '#e5e5e5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.5rem 1.25rem',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '0.85rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.2rem 0.7rem',
            borderRadius: '999px',
            background: 'rgba(59,130,246,0.15)',
            color: '#60a5fa',
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#3b82f6',
            }}
          />
          Editing Mode
        </span>
        {dirtyCount > 0 && (
          <span style={{ color: '#fbbf24', fontSize: '0.75rem' }}>{dirtyCount} unsaved</span>
        )}
        {status && <span style={{ color: '#888', fontSize: '0.75rem' }}>{status}</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          onClick={publish}
          disabled={dirtyCount === 0 || saving}
          style={{
            background: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 7,
            padding: '0.4rem 0.9rem',
            fontWeight: 600,
            cursor: dirtyCount === 0 || saving ? 'not-allowed' : 'pointer',
            opacity: dirtyCount === 0 || saving ? 0.5 : 1,
          }}
        >
          {saving ? 'Publishing…' : 'Publish'}
        </button>
        <button
          onClick={discard}
          disabled={dirtyCount === 0 || saving}
          style={{
            background: 'transparent',
            color: '#888',
            border: '1px solid #242424',
            borderRadius: 7,
            padding: '0.4rem 0.9rem',
            cursor: dirtyCount === 0 || saving ? 'not-allowed' : 'pointer',
          }}
        >
          Discard
        </button>
        <a
          href="/admin"
          style={{ color: '#888', textDecoration: 'none', fontSize: '0.75rem' }}
        >
          Dashboard
        </a>
        <form action="/api/admin/logout" method="POST" style={{ display: 'inline' }}>
          <button
            type="submit"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              fontSize: '0.75rem',
              padding: 0,
            }}
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}