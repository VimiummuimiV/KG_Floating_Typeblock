import { showNumericIndicator, updateButtons } from './buttons.js';
import { toggleSetting, toggleTheme } from './actions.js';
import {
  alignInput, enterFloating, exitFloating, syncContent, syncLayoutVars, toggleFloating
} from './floating.js';
import { openReplay } from './game.js';
import { helpPanel, setupHelpHover } from './help.js';
import { updateMatrixEffect } from './matrix.js';
import { syncPanelAnchors } from './panel.js';
import { SCHEMA, getSetting, isSettingsReady, loadSettings, onChange, setSetting } from './settings.js';
import { settingsPanel } from './settings-panel.js';
import { updateStats } from './stats.js';
import styles from './styles/main.scss';
import { applyTheme } from './theme.js';
import { adjustVisibleLines, refreshTextView, scheduleProgressUpdate, updateProgressBar } from './text-view.js';
import { byId, createElement, eventHits, isFloating } from './utils.js';

// ─── Reactions to the settings ───────────────────────────────────────────────
// A setting changes from anywhere (button, hotkey, drag, panel, import); what that means for the page is decided here

const refreshLayout = () => {
  syncLayoutVars();
  refreshTextView();
  syncPanelAnchors();
};

// Keyed by the first part of the path: 'matrix.glyphSet' runs REACTIONS.matrix
const REACTIONS = {
  theme: () => {
    applyTheme();
    syncLayoutVars();
    updateButtons();
  },
  dimming: syncLayoutVars,
  mainBlockWidth: refreshLayout,
  mainBlockPosition: refreshLayout,
  fontSize: () => {
    refreshLayout();
    alignInput();
  },
  visibleLines: refreshTextView,
  isPartialMode: () => {
    refreshTextView();
    updateButtons();
  },
  showProgress: () => {
    updateProgressBar();
    updateButtons();
  },
  showStats: () => {
    updateStats();
    updateButtons();
  },
  alignInputWithFocus: () => {
    alignInput();
    updateButtons();
  },
  matrixEffect: () => {
    updateMatrixEffect();
    syncLayoutVars();
    updateButtons();
  },
  matrix: () => {
    updateMatrixEffect();
    syncLayoutVars();
  },
  autoEnterFloating: updateButtons
};

// Settings were replaced as a whole (import, reset, per-mode snapshot)
function applyAll() {
  applyTheme();
  syncLayoutVars();
  updateMatrixEffect();
  syncContent();
  updateButtons();
}

function onSettingChange(paths) {
  if (paths) new Set(paths.map((path) => REACTIONS[path.split('.')[0]])).forEach((react) => react?.());
  else applyAll();
  helpPanel.refresh();
  settingsPanel.refresh();
}

// ─── Global listeners (always active) ────────────────────────────────────────

const toggle = (key) => () => toggleSetting(key);

// Alt + key hotkeys of both modes
const HOTKEYS = {
  KeyW: { action: toggleFloating },
  KeyA: { action: toggle('autoEnterFloating') },
  KeyL: { action: toggle('isPartialMode') },
  KeyP: { action: toggle('showProgress') },
  KeyM: { action: toggle('matrixEffect'), floatingOnly: true },
  KeyH: { action: () => helpPanel.toggle() },
  KeyO: { action: () => settingsPanel.toggle() },
  KeyS: { action: toggle('showStats'), floatingOnly: true },
  KeyT: { action: toggleTheme, floatingOnly: true },
  KeyQ: { action: toggle('alignInputWithFocus'), floatingOnly: true }
};

function onKeydown(event) {
  // Typing in the panels must not trigger the game hotkeys
  if (event.repeat || (!event.altKey && event.target.closest?.('.kg-panel, .kg-popup'))) return;
  if (event.ctrlKey && (event.key === 'Enter' || event.code === 'Enter')) openReplay();
  if (!isSettingsReady()) return;

  if (isFloating() && (event.key === 'Escape' || event.key === 'Enter')) {
    exitFloating();
    return;
  }
  const hotkey = event.altKey && HOTKEYS[event.code];
  if (!hotkey || (hotkey.floatingOnly && !isFloating())) return;
  hotkey.action();
  event.preventDefault();
  event.stopPropagation();
}

// Double click: on the input toggles floating mode, on the text block toggles text view
function onDblclick(event) {
  if (eventHits(event, 'kg-stats-wrap') || eventHits(event, 'kg-buttons-wrap')) return;
  const textArea = byId(isFloating() ? 'main-block' : 'typetext');
  if (event.target === byId('inputtext')) toggleFloating();
  else if (isSettingsReady() && textArea?.contains(event.target)) toggleSetting('isPartialMode');
  else return;
  event.preventDefault();
  event.stopPropagation();
}

// Wheel over the text block: Ctrl changes font size (floating), plain changes visible lines
function onWheel(event) {
  if (!isSettingsReady()) return;
  const area = byId(isFloating() ? 'main-block' : 'typetext');
  if (!area?.contains(event.target)) return;
  const direction = Math.sign(-event.deltaY);
  if (event.ctrlKey) {
    if (!isFloating()) return;
    event.preventDefault();
    if (!direction) return;
    setSetting('fontSize', getSetting('fontSize') + direction * SCHEMA.fontSize.step);
    showNumericIndicator(getSetting('fontSize'), 'Текущий размер шрифта');
  } else if (getSetting('isPartialMode')) {
    showNumericIndicator(adjustVisibleLines(direction), 'Количество строк');
    event.preventDefault();
    event.stopPropagation();
  }
}

function setupGlobalListeners() {
  // Marker for other scripts
  document.body.classList.add('kg-typeblock-registered');
  document.addEventListener('keydown', onKeydown, true);
  document.addEventListener('dblclick', onDblclick);
  document.addEventListener('wheel', onWheel, { passive: false });
  // Capture phase: the site cannot stop these events before we see them
  document.addEventListener('input', () => isSettingsReady() && scheduleProgressUpdate(), true);
  document.addEventListener('keyup', () => isSettingsReady() && scheduleProgressUpdate(), true);
  setupHelpHover();
}

// ─── Typeblock tracking ──────────────────────────────────────────────────────

function isTypeblockVisible() {
  const typetext = byId('typetext');
  if (!typetext) return false;
  const { display, visibility } = window.getComputedStyle(typetext);
  return display !== 'none' && visibility !== 'hidden' && typetext.offsetParent !== null;
}

function startObserver() {
  // The auto enter is attempted once per game, so a manual exit is respected
  let autoEnterTried = false;

  const sync = () => {
    const bookInfo = byId('bookinfo');
    if (bookInfo && isFloating() && bookInfo.style.display === '') {
      exitFloating();
      autoEnterTried = false;
      return;
    }

    if (!autoEnterTried && isTypeblockVisible()) {
      autoEnterTried = true;
      if (!isSettingsReady()) {
        loadSettings();
        applyTheme();
        syncLayoutVars();
        helpPanel.restore();
        settingsPanel.restore();
      }
      if (getSetting('autoEnterFloating')) enterFloating();
      updateButtons();
    }
    syncContent();
  };

  // characterData: the site may update typed words by changing text nodes in place
  new MutationObserver(sync).observe(document.body, { childList: true, subtree: true, characterData: true });
  sync();
}

// ─── Init ────────────────────────────────────────────────────────────────────

function init() {
  document.head.appendChild(createElement('style', { className: 'kg-typeblock-styles', textContent: styles }));
  applyTheme();
  syncLayoutVars();
  onChange(onSettingChange);
  setupGlobalListeners();
  startObserver();
}

// Script may run before <body> exists (early injection)
if (document.body) init();
else document.addEventListener('DOMContentLoaded', init);