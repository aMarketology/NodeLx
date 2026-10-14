import React, { useEffect, useState, useRef } from 'react';
import { getEntries, clearLog, subscribe } from '../debugLog';

/**
 * DebugPanel — the left-hand traffic inspector for the NodeLx editor.
 *
 * Shows a live, append-only log of every request/response and postMessage
 * event between NodeLx and the client site, so a super admin can see exactly
 * what is being sent/received and where anything is breaking.
 */

const KIND_LABEL = {
  request: 'REQ',
  response: 'RES',
  message: 'MSG',
  info: 'INFO',
};

const KIND_COLOR = {
  request: 'var(--accent)',
  response: 'var(--green)',
  message: 'var(--gold)',
  info: 'var(--muted)',
};

function EntryRow({ entry }) {
  const [expanded, setExpanded] = useState(false);
  const hasBody = entry.body || entry.payload || entry.detail;

  const time = new Date(entry.ts).toLocaleTimeString('en-US', { hour12: false });

  let summary = '';
  if (entry.kind === 'request') summary = `${entry.method} ${entry.url}`;
  else if (entry.kind === 'response') summary = `${entry.status} ${entry.method} ${entry.url}${entry.durationMs != null ? ` · ${entry.durationMs}ms` : ''}`;
  else if (entry.kind === 'message') summary = `${entry.direction === 'out' ? '→' : '←'} ${entry.type}`;
  else summary = entry.title || '';

  const isError = entry.kind === 'response' && entry.status >= 400;
  const isWarn = entry.kind === 'info' && entry.level === 'warn';
  const isErrInfo = entry.kind === 'info' && entry.level === 'error';

  return (
    <div className={`debug-row ${isError || isErrInfo ? 'debug-row-error' : ''} ${isWarn ? 'debug-row-warn' : ''}`}>
      <button className="debug-row-head" onClick={() => hasBody && setExpanded(!expanded)}>
        <span className="debug-row-time">{time}</span>
        <span className="debug-row-kind" style={{ color: KIND_COLOR[entry.kind] }}>
          {KIND_LABEL[entry.kind]}
        </span>
        <span className="debug-row-summary">{summary}</span>
        {hasBody && <span className="debug-row-caret">{expanded ? '▾' : '▸'}</span>}
      </button>
      {expanded && hasBody && (
        <pre className="debug-row-body">
          {entry.body || entry.payload || entry.detail}
        </pre>
      )}
    </div>
  );
}

export default function DebugPanel() {
  const [entries, setEntries] = useState(getEntries());
  const [filter, setFilter] = useState('all'); // all | request | response | message | info
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef(null);

  useEffect(() => {
    return subscribe(() => setEntries(getEntries()));
  }, []);

  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [entries, autoScroll]);

  const filtered = filter === 'all' ? entries : entries.filter((e) => e.kind === filter);

  return (
    <div className="debug-panel">
      <div className="debug-panel-head">
        <span className="debug-panel-title">Debug · Traffic</span>
        <div className="debug-panel-actions">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="debug-filter">
            <option value="all">All</option>
            <option value="request">Requests</option>
            <option value="response">Responses</option>
            <option value="message">Messages</option>
            <option value="info">Info</option>
          </select>
          <button
            className={`debug-toggle ${autoScroll ? 'active' : ''}`}
            onClick={() => setAutoScroll(!autoScroll)}
            title="Auto-scroll"
          >
            ⤓
          </button>
          <button className="debug-clear" onClick={clearLog} title="Clear log">
            Clear
          </button>
        </div>
      </div>
      <div className="debug-panel-list" ref={listRef}>
        {filtered.length === 0 ? (
          <div className="debug-empty">No traffic yet. Interact with the site to see events.</div>
        ) : (
          filtered.map((e) => <EntryRow key={e.seq} entry={e} />)
        )}
      </div>
    </div>
  );
}
