/**
 * debugLog.js — in-memory traffic log for the NodeLx editor's Debug panel.
 *
 * Captures every request/response and postMessage event between NodeLx and the
 * client site, so a super admin can see exactly what is being sent/received and
 * where anything is breaking.
 *
 * This is a tiny module-level store with pub/sub (same pattern as the client's
 * editorStore). It is intentionally side-effect-free: it only records, never
 * mutates the actual traffic.
 */

let entries = [];
let seq = 0;
const listeners = new Set();
const MAX_ENTRIES = 500;

function notify() {
  listeners.forEach((fn) => fn());
}

function push(entry) {
  seq += 1;
  entries.push({ seq, ts: Date.now(), ...entry });
  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(entries.length - MAX_ENTRIES);
  }
  notify();
}

/**
 * Record an outbound request (NodeLx → client site / GitHub / Supabase).
 * @param {object} e { method, url, body?, meta? }
 */
export function logRequest({ method, url, body, meta }) {
  push({
    kind: 'request',
    direction: 'out',
    method,
    url,
    body: safeStringify(body),
    meta,
  });
}

/**
 * Record an inbound response.
 * @param {object} e { method, url, status, body?, durationMs?, error? }
 */
export function logResponse({ method, url, status, body, durationMs, error }) {
  push({
    kind: 'response',
    direction: 'in',
    method,
    url,
    status,
    body: safeStringify(body),
    durationMs,
    error,
  });
}

/**
 * Record a postMessage event (either direction).
 * @param {object} e { direction: 'out'|'in', type, payload? }
 */
export function logMessage({ direction, type, payload }) {
  push({
    kind: 'message',
    direction,
    type,
    payload: safeStringify(payload),
  });
}

/**
 * Record a diagnostic/info event (e.g. CSP verdict, editable-element scan).
 * @param {object} e { level: 'info'|'warn'|'error', title, detail? }
 */
export function logInfo({ level = 'info', title, detail }) {
  push({ kind: 'info', level, title, detail });
}

function safeStringify(value) {
  if (value === undefined) return undefined;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function getEntries() {
  return entries;
}

export function clearLog() {
  entries = [];
  seq = 0;
  notify();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
