/**
 * NodeLx Pencil Launcher — floating "edit" button for client sites.
 * ------------------------------------------------------------------
 * Include this script on a client site to show a floating pencil icon that
 * routes the user to the NodeLx admin editor for the current page.
 *
 *   <script src="https://nodelx.example.com/nodelx-launcher.js"
 *           data-nodelx-admin="https://nodelx.example.com"
 *           data-nodelx-page="home"></script>
 *
 * Configuration (via data attributes or a global `window.NODELX` object):
 *   data-nodelx-admin  — base URL of the NodeLx admin (default: same origin)
 *   data-nodelx-page   — page id to open (default: derived from pathname)
 *
 * The button is a fixed-position pencil in the bottom-right corner. Clicking
 * it opens the NodeLx editor in a new tab:
 *   {admin}/admin/editor?page={page}
 */
(function () {
  'use strict';

  var script = document.currentScript;
  var cfg = window.NODELX || {};

  var adminBase = (script && script.getAttribute('data-nodelx-admin')) || cfg.admin || '';
  var pageId =
    (script && script.getAttribute('data-nodelx-page')) ||
    cfg.page ||
    derivePageId();

  function derivePageId() {
    var path = window.location.pathname.replace(/^\/+|\/+$/g, '');
    if (!path) return 'home';
    return path.replace(/\//g, '-') || 'home';
  }

  // Don't inject on the admin itself.
  if (window.location.pathname.indexOf('/admin') === 0) return;

  var STYLE_ID = 'nodelx-launcher-style';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '#nodelx-launcher {',
      '  position: fixed;',
      '  bottom: 24px;',
      '  right: 24px;',
      '  width: 52px;',
      '  height: 52px;',
      '  border-radius: 50%;',
      '  background: #3b82f6;',
      '  color: #fff;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  box-shadow: 0 8px 24px rgba(59,130,246,0.45);',
      '  cursor: pointer;',
      '  z-index: 2147483000;',
      '  border: none;',
      '  transition: transform 0.15s, box-shadow 0.15s;',
      '  text-decoration: none;',
      '}',
      '#nodelx-launcher:hover {',
      '  transform: translateY(-2px) scale(1.05);',
      '  box-shadow: 0 12px 30px rgba(59,130,246,0.6);',
      '}',
      '#nodelx-launcher svg {',
      '  width: 24px;',
      '  height: 24px;',
      '  fill: #fff;',
      '}',
      '#nodelx-launcher .nodelx-tooltip {',
      '  position: absolute;',
      '  right: 60px;',
      '  top: 50%;',
      '  transform: translateY(-50%);',
      '  background: #0a0a0a;',
      '  color: #e5e5e5;',
      '  font-size: 12px;',
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
      '  padding: 6px 10px;',
      '  border-radius: 6px;',
      '  white-space: nowrap;',
      '  opacity: 0;',
      '  pointer-events: none;',
      '  transition: opacity 0.15s;',
      '  border: 1px solid #242424;',
      '}',
      '#nodelx-launcher:hover .nodelx-tooltip { opacity: 1; }',
    ].join('\n');
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function buildUrl() {
    var base = adminBase.replace(/\/$/, '');
    return base + '/admin/editor?page=' + encodeURIComponent(pageId);
  }

  function mount() {
    injectStyles();

    var a = document.createElement('a');
    a.id = 'nodelx-launcher';
    a.href = buildUrl();
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', 'Edit this page with NodeLx');

    a.innerHTML =
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>' +
      '</svg>' +
      '<span class="nodelx-tooltip">Edit with NodeLx</span>';

    document.body.appendChild(a);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();