// FILE: app/admin/login/page.tsx
// Add this file to the client repo (williamb_constuction).
//
// Password-only login page for the client site. On successful login, the
// /api/admin/login route sets the httpOnly `nodelx_admin_session` cookie, and
// we do a HARD redirect (window.location.href = '/') so the full document
// reloads and NodelxBridge re-evaluates the cookie on mount — immediately
// showing the top "Editing Mode" bar.

'use client'

import { useState } from 'react'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Invalid password')
        setSubmitting(false)
        return
      }

      // Hard redirect → full document reload so NodelxBridge re-checks the
      // cookie on mount and immediately shows the editing bar.
      window.location.href = '/'
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0d0d0d',
        fontFamily: 'system-ui, sans-serif',
        padding: '1rem',
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: '100%',
          maxWidth: 360,
          background: '#161616',
          border: '1px solid #242424',
          borderRadius: 12,
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.2rem 0.7rem',
              borderRadius: '999px',
              background: 'rgba(59,130,246,0.15)',
              color: '#60a5fa',
              fontWeight: 600,
              fontSize: '0.8rem',
              marginBottom: '0.75rem',
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
            Admin Access
          </div>
          <h1 style={{ color: '#e5e5e5', fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
            Sign in to edit your site
          </h1>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.35)',
              color: '#fca5a5',
              borderRadius: 8,
              padding: '0.6rem 0.8rem',
              fontSize: '0.85rem',
            }}
          >
            {error}
          </div>
        )}

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          autoComplete="current-password"
          required
          style={{
            background: '#0d0d0d',
            border: '1px solid #242424',
            borderRadius: 8,
            color: '#e5e5e5',
            padding: '0.7rem 0.9rem',
            fontSize: '0.95rem',
            outline: 'none',
          }}
        />

        <button
          type="submit"
          disabled={submitting || !password}
          style={{
            background: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '0.7rem 0.9rem',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: submitting || !password ? 'not-allowed' : 'pointer',
            opacity: submitting || !password ? 0.5 : 1,
          }}
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}