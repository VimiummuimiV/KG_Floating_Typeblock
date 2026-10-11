import { showToast } from './actions.js';
import { closePopup } from './controls.js';
import { createDrag } from './drag.js';
import { showNumericIndicator } from './indicator.js';
import { destroyMatrix, updateMatrixEffect } from './matrix.js';
import { updateModeMark } from './mode-mark.js';
import { syncPanelAnchors } from './panel.js';
import { dimmingPath, getSetting, isSettingsReady, loadSettings, setSetting, setSettings } from './settings.js';
import { removeStats, updateStats } from './stats.js';
import { applyTheme, getElementsFilter } from './theme.js';
import { refreshTextView } from './text-view.js';
import {
  FADE_MS, FLOATING_CLASS, byId, createElement, createListenerScope, eventHits, formatToggle,
  isFloating, setCssVars, setImportant
} from './utils.js';

const DIMMING_SENSITIVITY = 0.5;
const INPUT_PADDING = 8;
// The block keeps this distance to the viewport edges; the speed and errors pill above it needs room too
const VIEWPORT_MARGIN = 8;
const STATS_RESERVE = 56;
const READY_CLASS = 'kg-ready';
const DRAG_IGNORED = ['inputtext', 'kg-stats-wrap'];
const INLINE_RESET = ['typeblock', 'typetext', 'inputtext', 'inputtextblock', 'typefocus'];

// scope: listeners of the floating mode, removed together on exit
const floating = { scope: createListenerScope(), backdrop: null, fadeTimer: 0 };

// ─── Layout ──────────────────────────────────────────────────────────────────

// Space the block leaves free at the top and at the bottom of the viewport
const getInsets = () => ({
  top: VIEWPORT_MARGIN + (getSetting('showStats') ? STATS_RESERVE : 0),
  bottom: VIEWPORT_MARGIN
});

// Everything the stylesheet needs to know about the current settings
export function syncLayoutVars() {
  const insets = getInsets();
  setCssVars({
    '--kg-fade': `${FADE_MS}ms`,
    '--kg-dimming': getSetting(dimmingPath()) / 100,
    '--kg-main-width': `${getSetting('mainBlockWidth')}%`,
    // 0 is the top edge of the free space, 100 the bottom one: the block never leaves the viewport
    '--kg-main-position': getSetting('mainBlockPosition'),
    '--kg-inset-top': `${insets.top}px`,
    '--kg-inset-bottom': `${insets.bottom}px`,
    '--kg-font-size': `${getSetting('fontSize')}px`,
    '--kg-input-padding': `${INPUT_PADDING}px`,
    '--kg-elements-filter': getElementsFilter()
  });
}

export function alignInput() {
  const inputBlock = byId('inputtextblock');
  const typeFocus = byId('typefocus');
  const typeText = byId('typetext');
  if (!inputBlock) return;
  if (!isFloating() || !getSetting('alignInputWithFocus') || !typeFocus || !typeText) {
    inputBlock.style.removeProperty('margin-left');
    return;
  }
  const typeTextRect = typeText.getBoundingClientRect();
  const offset = typeFocus.getBoundingClientRect().left - typeTextRect.left - INPUT_PADDING;
  inputBlock.style.setProperty('margin-left', `${(offset / typeTextRect.width) * 100}%`, 'important');
}

// Inline !important wins over the stylesheets of other scripts (a dark-theme script must not strip these).
// Values are variables, so the states of the input (error, disabled) are switched by the stylesheet alone.
function applyInline() {
  const typeBlock = byId('typeblock');
  if (typeBlock) setImportant(typeBlock, { border: '2px solid var(--kg-border-color)' });
  const input = byId('inputtext');
  if (!input) return;
  setImportant(input, {
    color: 'var(--kg-input-color)',
    'background-color': 'var(--kg-input-background)',
    'caret-color': 'var(--kg-input-caret)'
  });
  // Remove unwanted placeholder value if present and input is disabled
  if (input.classList.contains('disabled')) input.value = '';
}

// Text layout changed: re-apply everything that depends on it (both modes)
export function syncContent() {
  if (!isSettingsReady()) return;
  if (isFloating()) {
    applyInline();
    alignInput();
    updateStats();
    updateModeMark();
  }
  refreshTextView();
  syncPanelAnchors();
}

// The backdrop changes its dimming level softly for a moment (not while it is dragged, that must follow the pointer)
export function softenBackdrop() {
  const { backdrop } = floating;
  if (!backdrop) return;
  backdrop.classList.add('kg-fading');
  clearTimeout(floating.fadeTimer);
  floating.fadeTimer = setTimeout(() => backdrop.classList.remove('kg-fading'), FADE_MS);
}

// ─── Backdrop and block drag ─────────────────────────────────────────────────

function createBackdrop() {
  floating.backdrop = createElement('div', { id: 'kg-dimming-background' });
  createDrag({
    element: floating.backdrop,
    on: floating.scope.on,
    onStart: () => ({ level: getSetting(dimmingPath()) }),
    onMove: (dx, dy, start) => {
      const path = dimmingPath();
      setSetting(path, start.level - dy * DIMMING_SENSITIVITY);
      showNumericIndicator(getSetting(path), getSetting('matrixEffect') ? 'Затемнение матрицы' : 'Затемнение фона');
    }
  });
  document.body.appendChild(floating.backdrop);
}

// Resize (horizontal) and move (vertical) the block
function setupBlockDrag(mainBlock) {
  createDrag({
    element: mainBlock,
    on: floating.scope.on,
    cursor: 'move',
    canStart: (event) => !DRAG_IGNORED.some((id) => eventHits(event, id)),
    onStart: () => {
      const insets = getInsets();
      return {
        width: getSetting('mainBlockWidth'),
        position: getSetting('mainBlockPosition'),
        // Pixels the block can travel: it follows the pointer exactly
        freeSpace: window.innerHeight - insets.top - insets.bottom - mainBlock.offsetHeight
      };
    },
    onMove: (dx, dy, start) => setSettings({
      mainBlockWidth: start.width + (dx / document.documentElement.clientWidth) * 100,
      mainBlockPosition: start.freeSpace > 0 ? start.position + (dy / start.freeSpace) * 100 : start.position
    })
  });
}

// ─── Enter / exit ────────────────────────────────────────────────────────────

export function enterFloating() {
  if (isFloating()) return;
  const mainBlock = byId('main-block');
  if (!mainBlock || !byId('typeblock') || !byId('inputtext')) return;
  if (!isSettingsReady()) loadSettings();

  document.documentElement.classList.add(FLOATING_CLASS);
  applyTheme();
  syncLayoutVars();
  createBackdrop();
  setupBlockDrag(mainBlock);
  syncContent();
  updateMatrixEffect();
  // Input color transitions are enabled after the first paint
  setTimeout(() => document.documentElement.classList.add(READY_CLASS), 0);
}

export function exitFloating() {
  if (!isFloating()) return;
  floating.scope.dispose();
  floating.backdrop?.remove();
  floating.backdrop = null;
  closePopup();
  destroyMatrix();
  byId('kg-numeric-indicator')?.remove();
  byId('kg-mode-mark')?.remove();
  removeStats();
  // Remove all inline styles of the floating mode for a full reset
  INLINE_RESET.forEach((id) => byId(id)?.removeAttribute('style'));
  document.documentElement.classList.remove(FLOATING_CLASS, READY_CLASS);
  syncLayoutVars();
  // Native mode keeps the line-by-line view and the progress bar
  syncContent();
}

export function toggleFloating() {
  if (isFloating()) exitFloating();
  else enterFloating();
  showToast(formatToggle('Плавающий режим', isFloating()));
}