import { createDrag } from './drag.js';
import { ICONS } from './icons.js';
import { byId, clamp, createElement, readStorage, setCssVars, writeStorage } from './utils.js';

const MARGIN = 8;
const INTERACTIVE = 'input, select, textarea, button, label';
const POSITION_EPSILON = 1;

const panels = new Set();

// Anchor (the typing input) moved: panels re-check whether they still sit at the default point
export const syncPanelAnchors = () => panels.forEach((panel) => panel.syncAnchor());

/**
 * A floating panel shared by help and settings: draggable when pinned, position and open state remembered.
 * @param {object} options
 * @param {string} options.name - suffix of the CSS class
 * @param {string} options.storageKey
 * @param {'left'|'right'} [options.align] - which edge of the input the default position aligns to
 * @param {Array<{className, title, icon, onClick}>} [options.actions] - extra buttons of the header
 * @param {() => boolean} [options.canOpen]
 * @param {(content: HTMLElement) => void} options.render - fills (or updates) the content
 */
export function createPanel({ name, storageKey, align = 'left', actions = [], canOpen = () => true, render }) {
  // pinned: opened on purpose (stays, draggable); otherwise only shown transiently
  const state = { popup: null, pinned: false, position: null, anchor: null, frame: 0 };

  // ─── Geometry ──────────────────────────────────────────────────────────────

  // Measure away from the right edge: fit-content would otherwise shrink into the leftover gap
  function measure() {
    const { popup } = state;
    const previousLeft = popup.style.left;
    popup.style.left = MARGIN + 'px';
    const size = { width: popup.offsetWidth, height: popup.offsetHeight };
    popup.style.left = previousLeft;
    return size;
  }

  // Intended position stays put; only the drawn point is clamped into the viewport
  function clampPoint(left, top) {
    const { width, height } = measure();
    return {
      left: clamp(left, MARGIN, Math.max(MARGIN, window.innerWidth - width - MARGIN)),
      top: clamp(top, MARGIN, Math.max(MARGIN, window.innerHeight - height - MARGIN))
    };
  }

  function place(point) {
    state.popup.style.left = point.left + 'px';
    state.popup.style.top = point.top + 'px';
    return point;
  }

  function applyPosition() {
    if (!state.pinned || !state.popup || state.popup.hidden || !state.position) return;
    place(clampPoint(state.position.left, state.position.top));
  }

  function getDefaultPoint() {
    const rect = byId('inputtext')?.getBoundingClientRect();
    const { width, height } = measure();
    let top = rect ? rect.bottom + MARGIN : MARGIN;
    if (top + height > window.innerHeight) top = (rect ? rect.top : window.innerHeight) - height - MARGIN;
    let left = (window.innerWidth - width) / 2;
    if (rect) left = align === 'right' ? rect.right - width : rect.left;
    return clampPoint(left, top);
  }

  // ─── Anchor and reset button ───────────────────────────────────────────────

  function readAnchor() {
    const input = byId('inputtext');
    if (!input || !input.getClientRects().length) return null;
    const { left, top, width, height } = input.getBoundingClientRect();
    return { left, top, width, height };
  }

  const isSameAnchor = (a, b) => (!a || !b ? a === b : Object.keys(a).every((key) => Math.abs(a[key] - b[key]) < POSITION_EPSILON));

  function isAtDefaultPosition() {
    if (!state.position || !readAnchor()) return true;
    const point = getDefaultPoint();
    return Math.abs(point.left - state.position.left) < POSITION_EPSILON
      && Math.abs(point.top - state.position.top) < POSITION_EPSILON;
  }

  function syncResetButton() {
    const button = state.popup?.querySelector('.kg-panel-reset');
    if (button && readAnchor()) button.hidden = isAtDefaultPosition();
  }

  // The input can move or leave the DOM. Missing input must not flip the button.
  function syncAnchor() {
    const next = readAnchor();
    if (isSameAnchor(state.anchor, next)) return;
    state.anchor = next;
    if (next) syncResetButton();
  }

  // ─── Persistence ───────────────────────────────────────────────────────────

  const save = () => writeStorage(storageKey, { open: state.pinned, left: state.position?.left, top: state.position?.top });

  function restore() {
    const { open, left, top } = readStorage(storageKey);
    if (Number.isFinite(left) && Number.isFinite(top)) state.position = { left, top };
    if (!open) return;
    state.pinned = true;
    show();
  }

  // ─── Popup ─────────────────────────────────────────────────────────────────

  function createAction({ className, title, icon, onClick }) {
    const button = createElement('button', { type: 'button', className: `kg-btn kg-panel-action ${className}`, title, innerHTML: icon });
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    });
    return button;
  }

  function ensurePopup() {
    if (state.popup) return state.popup;
    const header = createElement('div', { className: 'kg-panel-actions' },
      ...actions.map(createAction),
      createAction({ className: 'kg-panel-reset', title: 'Сбросить положение', icon: ICONS.reset, onClick: resetPosition }),
      createAction({ className: 'kg-panel-close', title: 'Закрыть', icon: ICONS.close, onClick: closePinned }));
    const popup = createElement('div', { className: `kg-panel kg-panel-${name}`, hidden: true }, header, createElement('div', { className: 'kg-panel-content' }));
    state.popup = popup;
    document.body.appendChild(popup);
    setCssVars({ '--kg-panel-margin': MARGIN + 'px' });

    createDrag({
      element: popup,
      canStart: (event) => state.pinned && !event.target.closest(INTERACTIVE),
      onStart: () => ({ left: popup.offsetLeft, top: popup.offsetTop }),
      onMove: (dx, dy, start) => place(clampPoint(start.left + dx, start.top + dy)),
      onEnd: () => {
        state.position = { left: popup.offsetLeft, top: popup.offsetTop };
        save();
        syncResetButton();
      }
    });
    window.addEventListener('resize', () => {
      applyPosition();
      syncAnchor();
    });
    return popup;
  }

  function renderNow() {
    if (!state.popup || state.popup.hidden) return;
    render(state.popup.querySelector('.kg-panel-content'));
    applyPosition();
  }

  // At most once per frame, however many settings change in it
  function refresh() {
    if (state.frame) return;
    state.frame = requestAnimationFrame(() => {
      state.frame = 0;
      renderNow();
    });
  }

  function show() {
    if (!canOpen()) return;
    const popup = ensurePopup();
    const wasHidden = popup.hidden;
    popup.hidden = false;
    popup.classList.toggle('kg-pinned', state.pinned);
    renderNow();
    if (!wasHidden) return;
    if (state.pinned && state.position) applyPosition();
    else place(getDefaultPoint());
  }

  function showTransient() {
    if (!state.pinned) show();
  }

  function hideTransient() {
    if (state.pinned || !state.popup || state.popup.hidden) return;
    state.popup.hidden = true;
  }

  function resetPosition() {
    if (!state.popup) return;
    state.position = place(getDefaultPoint());
    save();
    syncResetButton();
  }

  function pin() {
    if (!canOpen()) return;
    const popup = ensurePopup();
    const adoptCurrent = !state.pinned && !popup.hidden;
    state.pinned = true;
    show();
    if (adoptCurrent || !state.position) state.position = { left: popup.offsetLeft, top: popup.offsetTop };
    save();
    syncResetButton();
  }

  function closePinned() {
    state.pinned = false;
    if (state.popup) {
      state.popup.hidden = true;
      state.popup.classList.remove('kg-pinned');
    }
    save();
  }

  const toggle = () => (state.pinned ? closePinned() : pin());

  const panel = { toggle, refresh, restore, syncAnchor, showTransient, hideTransient };
  panels.add(panel);
  return panel;
}
