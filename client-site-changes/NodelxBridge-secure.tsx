'use client'

/**
 * NodelxBridge.tsx — Client-Side Visual Editor Overlay
 *
 * A lightweight, no-op-on-public-site overlay that turns the live site into an
 * editable canvas when an admin session is active.
 *
 * This is a ONE-WAY connection: the client site is the editing surface, and
 * NodeLx is only the headless save backend (GitHub commit + revalidate). There
 * is no iframe and no postMessage round-trip — edits accumulate in a local
 * store and are flushed to NodeLx via POST /api/admin/save when the user
 * clicks "Save Changes" in the AdminBar.
 *
 * Activation:
 *   - a valid admin session cookie (checked via /api/admin/session).
 *   - There is NO `?edit=true` bypass. The session cookie is the single
 *     source of truth for whether editing is allowed.
 *
 * Element identification (three compatible formats):
 *   Format A (preferred): `data-editable="hero.badge"` for text,
 *                         `data-editable="projects.0.img" data-editable-type="image"` for images.
 *   Format B (legacy):    `data-nodelx-id="hero.heroImage" data-nodelx-type="image"`.
 *   Format C (legacy):    `[data-nodelx-section="hero"] > [data-nodelx-field="badge"]`
 *                         → id derived as "hero.badge" at click time.
 */

import { useEffect, useState } from 'react'
import ImageSwapModal from './ImageSwapModal'
import { setMutation } from './editorStore'

// ── Types ─────────────────────────────────────────────────────────────────────

type ElementType = 'text' | 'image'

interface ResolvedElement {
  id: string
  elementType: ElementType
  el: HTMLElement
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NodelxBridge() {
  const [imageTarget, setImageTarget] = useState<ResolvedElement | null>(null)

  function activate(): (() => void) | undefined {

    // ── Visual outlines for editable elements ──────────────────────────────
    const style = document.createElement('style')
    style.id = 'nodelx-bridge-styles'
    style.textContent = `
      [data-editable],
      [data-nodelx-id],
      [data-nodelx-field] {
        cursor: pointer !important;
        outline: 2px dashed transparent;
        outline-offset: 3px;
        transition: outline-color 0.15s ease;
      }
      [data-editable]:hover,
      [data-nodelx-id]:hover,
      [data-nodelx-field]:hover {
        outline-color: #3b82f6 !important;
      }
      [data-editable].nodelx-selected,
      [data-nodelx-id].nodelx-selected,
      [data-nodelx-field].nodelx-selected {
        outline-color: #2563eb !important;
        outline-style: solid;
      }
      [data-editable].nodelx-editing,
      [data-nodelx-id].nodelx-editing,
      [data-nodelx-field].nodelx-editing {
        outline-color: #22c55e !important;
        outline-style: solid;
      }
    `
    document.head.appendChild(style)

    // ── Helpers ────────────────────────────────────────────────────────────

    function clearSelected() {
      document.querySelectorAll('.nodelx-selected').forEach(el => el.classList.remove('nodelx-selected'))
    }

    /**
     * Resolve a clicked target to an editable element + stable id.
     * Priority: data-editable > data-nodelx-id > data-nodelx-field (in section).
     */
    function resolveElement(target: HTMLElement): ResolvedElement | null {
      // Format A — data-editable
      const editableEl = target.closest('[data-editable]') as HTMLElement | null
      if (editableEl) {
        const id = editableEl.dataset.editable!
        const elementType: ElementType =
          editableEl.dataset.editableType === 'image' ? 'image' : 'text'
        return { id, elementType, el: editableEl }
      }

      // Format B — data-nodelx-id
      const idEl = target.closest('[data-nodelx-id]') as HTMLElement | null
      if (idEl) {
        const elementType: ElementType =
          idEl.dataset.nodelxType === 'image' ? 'image' : 'text'
        return { id: idEl.dataset.nodelxId!, elementType, el: idEl }
      }

      // Format C — data-nodelx-field inside data-nodelx-section
      const fieldEl = target.closest('[data-nodelx-field]') as HTMLElement | null
      const sectionEl = (fieldEl ?? target).closest('[data-nodelx-section]') as HTMLElement | null
      if (fieldEl && sectionEl) {
        const id = `${sectionEl.dataset.nodelxSection}.${fieldEl.dataset.nodelxField}`
        return { id, elementType: 'text', el: fieldEl }
      }

      return null
    }

    // ── Inline text editing ────────────────────────────────────────────────

    function beginTextEdit(resolved: ResolvedElement) {
      const { el } = resolved
      el.setAttribute('contenteditable', 'true')
      el.classList.add('nodelx-editing')
      el.focus()

      // Select existing text for quick replacement
      const range = document.createRange()
      range.selectNodeContents(el)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }

    function endTextEdit(resolved: ResolvedElement) {
      const { el } = resolved
      el.removeAttribute('contenteditable')
      el.classList.remove('nodelx-editing')
    }

    // ── Click handler ──────────────────────────────────────────────────────

    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      const resolved = resolveElement(target)
      if (!resolved) return

      e.preventDefault()
      e.stopPropagation()
      clearSelected()
      resolved.el.classList.add('nodelx-selected')

      if (resolved.elementType === 'image') {
        // Open the in-context image swap modal
        setImageTarget(resolved)
        return
      }

      // Text: enable inline editing
      beginTextEdit(resolved)
    }

    // ── Input / blur handlers for inline text editing ──────────────────────

    function handleInput(e: Event) {
      const el = e.target as HTMLElement
      const resolved = resolveElement(el)
      if (!resolved) return
      const value = el.textContent?.trim() ?? ''
      setMutation(resolved.id, value)
    }

    function handleBlur(e: FocusEvent) {
      const el = e.target as HTMLElement
      const resolved = resolveElement(el)
      if (!resolved) return
      const value = el.textContent?.trim() ?? ''
      setMutation(resolved.id, value)
      endTextEdit(resolved)
    }

    // ── Wire up listeners ──────────────────────────────────────────────────

    window.addEventListener('click', handleClick, true)
    window.addEventListener('input', handleInput, true)
    window.addEventListener('focusout', handleBlur, true)

    return () => {
      window.removeEventListener('click', handleClick, true)
      window.removeEventListener('input', handleInput, true)
      window.removeEventListener('focusout', handleBlur, true)
      document.getElementById('nodelx-bridge-styles')?.remove()
    }
  }

  useEffect(() => {
    // The session cookie is the single source of truth. No ?edit=true bypass.
    let cancelled = false
    fetch('/api/admin/session')
      .then((r) => r.json())
      .then((d: { authed: boolean }) => {
        if (!cancelled && d.authed) activate()
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  function handleImageSelect(url: string) {
    if (!imageTarget) return
    const { el } = imageTarget
    const img = el.querySelector('img')
    if (img) img.src = url
    setMutation(imageTarget.id, url)
    setImageTarget(null)
  }

  return (
    <ImageSwapModal
      open={imageTarget !== null}
      onSelect={handleImageSelect}
      onClose={() => setImageTarget(null)}
    />
  )
}