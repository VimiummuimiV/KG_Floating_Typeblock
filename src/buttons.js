import { toggleModeSettings, toggleSetting, toggleTheme } from './actions.js';
import { hideUp, showFromUp } from './animations.js';
import { openReplay } from './game.js';
import { helpPanel } from './help.js';
import { ICONS } from './icons.js';
import { SCHEMA, getSetting, hasModeSettings, setSetting } from './settings.js';
import { settingsPanel } from './settings-panel.js';
import { THEME_NAMES } from './theme.js';
import { byId, createElement, isFloating } from './utils.js';

const COLLAPSE_HIDE_DELAY = 2000;
const INDICATOR_DELAY = 3000;
const SLIDE = { distance: 36 };
const FONT_URL = 'https://fonts.googleapis.com/css2?family=Quicksand:wght@300..700&display=swap';

const state = { hideTimer: null, indicatorTimer: null, busy: false };

// title/icon may be a string or () => string; isActive defaults to true
const settingButton = (id, key, icon) => ({
  id,
  icon,
  title: SCHEMA[key].label,
  isActive: () => getSetting(key),
  onClick: () => toggleSetting(key)
});

const BUTTONS = [
  {
    id: 'kg-btn-saved',
    icon: ICONS.saved,
    title: () => (hasModeSettings() ? 'Забыть настройки режима' : 'Запомнить настройки режима'),
    isActive: hasModeSettings,
    onClick: toggleModeSettings
  },
  settingButton('kg-btn-partial', 'isPartialMode', ICONS.partial),
  settingButton('kg-btn-alignment', 'alignInputWithFocus', ICONS.alignment),
  settingButton('kg-btn-stats', 'showStats', ICONS.stats),
  settingButton('kg-btn-progress', 'showProgress', ICONS.progress),
  settingButton('kg-btn-matrix', 'matrixEffect', ICONS.matrix),
  {
    id: 'kg-btn-theme',
    icon: () => (getSetting('theme') === 'dark' ? ICONS.moon : ICONS.sun),
    title: () => THEME_NAMES[getSetting('theme')],
    onClick: toggleTheme
  },
  settingButton('kg-btn-autoenter', 'autoEnterFloating', ICONS.autoEnter),
  { id: 'kg-btn-settings', icon: ICONS.settings, title: 'Настройки', onClick: () => settingsPanel.toggle() },
  { id: 'kg-btn-help', icon: ICONS.help, title: 'Справка', onClick: () => helpPanel.toggle() },
  { id: 'kg-btn-next', icon: ICONS.play, title: 'Следующая игра', onClick: openReplay }
];

const resolve = (value) => (typeof value === 'function' ? value() : value);

// ─── Collapse button visibility ──────────────────────────────────────────────

const setCollapseVisible = (visible) => byId('kg-btn-collapse')?.classList.toggle('kg-hidden', !visible);
const cancelCollapseHide = () => clearTimeout(state.hideTimer);

function scheduleCollapseHide() {
  cancelCollapseHide();
  if (getSetting('showButtons') || state.busy) return;
  state.hideTimer = setTimeout(() => {
    if (!getSetting('showButtons') && !state.busy) setCollapseVisible(false);
  }, COLLAPSE_HIDE_DELAY);
}

// ─── Bar ─────────────────────────────────────────────────────────────────────

function ensureBar() {
  const wrap = byId('kg-buttons-wrap');
  if (wrap) return { left: byId('kg-buttons-left'), right: byId('kg-buttons-right') };

  const mainBlock = byId('main-block');
  if (!mainBlock) return null;
  const left = createElement('div', { id: 'kg-buttons-left' });
  const right = createElement('div', { id: 'kg-buttons-right' });
  const created = createElement('div', { id: 'kg-buttons-wrap' }, createElement('div', { id: 'kg-buttons' }, left, right));
  created.addEventListener('mouseenter', () => {
    cancelCollapseHide();
    if (!getSetting('showButtons')) setCollapseVisible(true);
  });
  created.addEventListener('mouseleave', () => {
    if (!getSetting('showButtons')) scheduleCollapseHide();
  });
  mainBlock.appendChild(created);
  return { left, right };
}

function syncButton(def, parent) {
  let button = byId(def.id);
  if (!button) {
    button = createElement('span', { id: def.id, className: 'kg-btn' });
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      def.onClick();
    });
  }
  if (button.parentElement !== parent) parent.appendChild(button);
  const icon = resolve(def.icon);
  if (button.kgIcon !== icon) {
    button.innerHTML = icon;
    button.kgIcon = icon;
  }
  button.title = resolve(def.title);
  button.classList.toggle('kg-off', !(def.isActive?.() ?? true));
}

function syncCollapse(right, animate = false) {
  let button = byId('kg-btn-collapse');
  if (!button) {
    button = createElement('span', { id: 'kg-btn-collapse', className: 'kg-btn', innerHTML: ICONS.chevronUp });
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleCollapse();
    });
    right.appendChild(button);
  }
  const open = getSetting('showButtons');
  button.title = open ? 'Скрыть кнопки' : 'Показать кнопки';
  button.classList.toggle('kg-collapsed', !open);
  if (animate) {
    // Round while it turns
    button.classList.add('kg-spinning');
    button.addEventListener('transitionend', () => button.classList.remove('kg-spinning'), { once: true });
  }
  // Open: always visible. Collapsed: hidden until hover; right after the toggle it shows briefly
  cancelCollapseHide();
  setCollapseVisible(open || animate);
  if (!open && animate) scheduleCollapseHide();
}

async function toggleCollapse() {
  const parts = ensureBar();
  if (state.busy || !isFloating() || !parts) return;
  state.busy = true;
  cancelCollapseHide();
  if (getSetting('showButtons')) {
    setSetting('showButtons', false);
    await hideUp(parts.left, { ...SLIDE, remove: false });
    parts.left.replaceChildren();
  } else {
    setSetting('showButtons', true);
    BUTTONS.forEach((def) => syncButton(def, parts.left));
    await showFromUp(parts.left, SLIDE);
  }
  syncCollapse(parts.right, true);
  state.busy = false;
}

export function updateButtons() {
  if (!isFloating()) {
    cancelCollapseHide();
    byId('kg-buttons-wrap')?.remove();
    return;
  }
  const parts = ensureBar();
  if (!parts) return;
  if (getSetting('showButtons')) {
    if (!state.busy) parts.left.getAnimations().forEach((animation) => animation.cancel());
    BUTTONS.forEach((def) => syncButton(def, parts.left));
  } else {
    parts.left.replaceChildren();
  }
  syncCollapse(parts.right);
}

// ─── Numeric indicator ───────────────────────────────────────────────────────

const ensureFont = () => byId('kg-font-import') ?? document.head.appendChild(
  createElement('link', { id: 'kg-font-import', rel: 'stylesheet', href: FONT_URL }));

// Value of something changed by dragging or wheel, shown for a moment next to the buttons
export function showNumericIndicator(value, title = '') {
  const parts = isFloating() && getSetting('showButtons') ? ensureBar() : null;
  if (!parts) return;
  ensureFont();
  const indicator = byId('kg-numeric-indicator')
    ?? parts.left.appendChild(createElement('span', { id: 'kg-numeric-indicator', className: 'kg-btn' }));
  indicator.title = title;
  indicator.textContent = String(value);
  clearTimeout(state.indicatorTimer);
  state.indicatorTimer = setTimeout(() => indicator.remove(), INDICATOR_DELAY);
}