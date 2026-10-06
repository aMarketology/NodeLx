/**
 * NodeLx Edit Mode — client-side script
 * -------------------------------------
 * Include this script on the client site (e.g. in the <head> or before </body>):
 *
 *   <script src="https://nodelx.example.com/edit-mode.js" data-nodelx-edit="true"></script>
 *
 * When the page is loaded with ?edit=true (or the data-nodelx-edit attribute is
 * present), it:
 *   1. Marks every text element (h1-h6, p, a, button, li, span, label) and
 *      <img> as editable with a dashed outline + hover highlight.
 *   2. Click a text element → contenteditable inline editing.
 *   3. Click an <img> → file picker; the chosen file is read as a data URL.
 *   4. On text change, posts a message to the parent window:
  *        { type: 'NODELX_CONTENT_CHANGED', key, value, tag }
 *      where `key` is the element's data-editable id, or a stable fallback
 *      derived from its tag + position.
  *   5. On image click, posts an upload request:
  *        { type: 'NODELX_IMAGE_UPLOAD_REQUEST', key, dataUrl }
  *      and listens for { type: 'NODELX_IMAGE_UPLOAD_RESPONSE', key, url } to
  *      swap the <img src> live.
  *   6. Listens for { type: 'NODELX_SAVE' } / { type: 'NODELX_DISCARD' } from
  *      the parent to flash a saving state.
  *
  * The parent (NodeLx admin shell) batches these and PATCHes /api/content/:pageId.
  */
(function () {
  'use strict';

  var EDIT_PARAM = 'edit';
  var isEditMode =
    new URLSearchParams(window.location.search).get(EDIT_PARAM) === 'true' ||
    document.querySelector('script[data-nodelx-edit]') !== null;

  if (!isEditMode) return;

  var TEXT_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'button', 'li', 'span', 'label', 'blockquote', 'figcaption'];
  var IMG_TAGS = ['img'];

  var STYLE_ID = 'nodelx-edit-style';
  var pending = {}; // key -> { value, tag }

  // ── Inject overlay styles ─────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '[data-editable] { outline: 2px dashed rgba(59,130,246,0.55); outline-offset: 2px; cursor: text; }',
      '[data-editable]:hover { outline-color: #3b82f6; background: rgba(59,130,246,0.06); }',
      '[data-editable].nodelx-editing { outline: 2px solid #3b82f6; background: rgba(59,130,246,0.08); }',
      'img[data-editable] { outline: 2px dashed rgba(59,130,246,0.55); cursor: pointer; }',
      'img[data-editable]:hover { outline-color: #3b82f6; }',
      '.nodelx-saving { outline: 2px dashed rgba(74,222,128,0.7); }',
      '.nodelx-saved { outline: 2px solid rgba(74,222,128,0.8); transition: outline-color 0.3s; }'
    ].join('\n');
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ── Key resolution ────────────────────────────────────────────────────
  function resolveKey(el) {
    var explicit = el.getAttribute('data-editable');
    if (explicit) return explicit;
    // Fallback: tag + index among siblings of the same tag
    var tag = el.tagName.toLowerCase();
    var parent = el.parentElement;
    var idx = 0;
    if (parent) {
      var siblings = Array.prototype.filter.call(parent.children, function (c) {
        return c.tagName && c.tagName.toLowerCase() === tag;
      });
      idx = siblings.indexOf(el);
    }
    return tag + '-' + (idx + 1);
  }

  // ── Emit change to parent ─────────────────────────────────────────────
  function emitChange(key, value, tag) {
    pending[key] = { value: value, tag: tag };
    window.parent.postMessage({
        type: 'NODELX_CONTENT_CHANGED',
      key: key,
      value: value,
      tag: tag
    }, '*');
  }

  // ── Text editing ──────────────────────────────────────────────────────
  function makeTextEditable(el) {
    if (el.getAttribute('data-nodelx-bound') === '1') return;
    el.setAttribute('data-nodelx-bound', '1');

    el.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (el.getAttribute('contenteditable') === 'true') return;

      // Remove editing state from others
      document.querySelectorAll('.nodelx-editing').forEach(function (n) {
        n.setAttribute('contenteditable', 'false');
        n.classList.remove('nodelx-editing');
      });

      el.setAttribute('contenteditable', 'true');
      el.classList.add('nodelx-editing');
      el.focus();
    });

    el.addEventListener('blur', function () {
      if (el.getAttribute('contenteditable') !== 'true') return;
      var value = el.textContent.trim();
      el.setAttribute('contenteditable', 'false');
      el.classList.remove('nodelx-editing');
      if (value) emitChange(resolveKey(el), value, el.tagName.toLowerCase());
    });

    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        el.blur();
      }
      if (e.key === 'Escape') {
        el.blur();
      }
    });
  }

  // ── Image editing ─────────────────────────────────────────────────────
  function makeImageEditable(el) {
    if (el.getAttribute('data-nodelx-bound') === '1') return;
    el.setAttribute('data-nodelx-bound', '1');

    el.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
          var dataUrl = ev.target.result;
            var key = resolveKey(el);
            // Live preview immediately, then ask the parent to persist it.
            el.src = dataUrl;
            pending[key] = { value: dataUrl, tag: 'img' };
            window.parent.postMessage({
              type: 'NODELX_IMAGE_UPLOAD_REQUEST',
              key: key,
              dataUrl: dataUrl
            }, '*');
          };
          reader.readAsDataURL(file);
        });
        document.body.appendChild(input);
        input.click();
        document.body.removeChild(input);
      });
    }

  // ── Scan + bind ───────────────────────────────────────────────────────
  function bindAll() {
    var els = document.querySelectorAll('[data-editable]');
    Array.prototype.forEach.call(els, function (el) {
      var tag = el.tagName.toLowerCase();
      if (IMG_TAGS.indexOf(tag) !== -1) {
        makeImageEditable(el);
      } else if (TEXT_TAGS.indexOf(tag) !== -1) {
        makeTextEditable(el);
      }
    });
  }

  // ── Parent commands ───────────────────────────────────────────────────
  window.addEventListener('message', function (e) {
    var data = e.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'NODELX_SAVE') {
      document.querySelectorAll('[data-editable]').forEach(function (el) {
        el.classList.add('nodelx-saving');
      });
    } else if (data.type === 'NODELX_DISCARD') {
      document.querySelectorAll('[data-editable]').forEach(function (el) {
        el.classList.remove('nodelx-saving', 'nodelx-saved');
      });
      } else if (data.type === 'NODELX_IMAGE_UPLOAD_RESPONSE' && data.key && data.url) {
        // Parent persisted the image; swap the live <img> src to the final URL.
        var el = document.querySelector('[data-editable="' + data.key + '"]');
        if (el && el.tagName.toLowerCase() === 'img') {
          el.src = data.url;
          el.classList.add('nodelx-saved');
        }
      }
    });

  // ── Init ──────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      injectStyles();
      bindAll();
    });
  } else {
    injectStyles();
    bindAll();
  }

  // Expose for debugging
  window.__nodelx = { pending: pending, isEditMode: true };
})();