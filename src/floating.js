import { showToast } from './actions.js';
import { showNumericIndicator, updateButtons } from './buttons.js';
import { createDrag } from './drag.js';
import { destroyMatrix, updateMatrixEffect } from './matrix.js';
import { syncPanelAnchors } from './panel.js';
import { dimmingPath, getSetting, isSettingsReady, loadSettings, setSetting, setSettings } from './settings.js';
import { removeStats, updateStats } from './stats.js';
import { applyTheme, getElementsFilter } from './theme.js';
import { refreshTextView } from './text-view.js';
import {
  FADE_MS, FLOATING_CLASS, byId, clamp, createElement, createListenerScope, eventHits, formatToggle,
  isFloating, setCssVars, setImportant
} from './utils.js';

const DIMMING_SENSITIVITY = 0.5;
const INPUT_PADDING = 8;
const READY_CLASS = 'kg-ready';
const DRAG_IGNORED = ['inputtext', 'kg-stats-wrap', 'kg-buttons-wrap'];
const INLINE_RESET = ['typeblock', 'typetext', 'inputtext', 'inputtextblock', 'typefocus'];

// scope: listeners of the floating mode, removed together on exit
const floating = { scope: createListenerScope(), backdrop: null, fadeTimer: 0 };

// ─── Layout ──────────────────────────────────────────────────────────────────

// Everything the stylesheet needs to know about the current settings
export function syncLayoutVars() {
  setCssVars({
    '--kg-fade': `${FADE_MS}ms`,
    '--kg-dimming': getSetting(dimmingPath()) / 100,
    '--kg-main-width': `${getSetting('mainBlockWidth')}vw`,
    '--kg-main-top': `${getSetting('mainBlockPosition')}vh`,
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
    onStart: () => ({
      width: getSetting('mainBlockWidth'),
      top: getSetting('mainBlockPosition'),
      height: mainBlock.offsetHeight
    }),
    onMove: (dx, dy, start) => {
      const { innerWidth, innerHeight } = window;
      const maxTop = 100 - (start.height / innerHeight) * 100;
      setSettings({
        mainBlockWidth: start.width + (dx / innerWidth) * 100,
        mainBlockPosition: clamp(start.top + (dy / innerHeight) * 100, 0, maxTop)
      });
    }
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
  updateButtons();
  updateMatrixEffect();
  // Input color transitions are enabled after the first paint
  setTimeout(() => document.documentElement.classList.add(READY_CLASS), 0);
}

export function exitFloating() {
  if (!isFloating()) return;
  floating.scope.dispose();
  floating.backdrop?.remove();
  floating.backdrop = null;
  destroyMatrix();
  byId('kg-numeric-indicator')?.remove();
  removeStats();
  // Remove all inline styles of the floating mode for a full reset
  INLINE_RESET.forEach((id) => byId(id)?.removeAttribute('style'));
  document.documentElement.classList.remove(FLOATING_CLASS, READY_CLASS);
  syncLayoutVars();
  updateButtons();
  // Native mode keeps the line-by-line view and the progress bar
  syncContent();
}

export function toggleFloating() {
  if (isFloating()) exitFloating();
  else enterFloating();
  showToast(formatToggle('Плавающий режим', isFloating()));
}