import { DARK_THEME_LABEL, MODE_SETTINGS_LABEL, toggleModeSettings, toggleSetting, toggleTheme } from './actions.js';
import { closePopup, openPopup } from './controls.js';
import { openReplay } from './game.js';
import { helpPanel } from './help.js';
import { ICONS } from './icons.js';
import { SCHEMA, getSetting, hasModeSettings } from './settings.js';
import { settingsPanel } from './settings-panel.js';
import { createElement, readStorage, writeStorage } from './utils.js';

const settingToggle = (key, icon) => ({
  icon,
  label: SCHEMA[key].label,
  isActive: () => getSetting(key),
  onClick: () => toggleSetting(key)
});

// icon may be a string or () => string; a row with isActive is a toggle, the others are plain actions
const TOGGLES = [
  { icon: ICONS.saved, label: MODE_SETTINGS_LABEL, isActive: hasModeSettings, onClick: toggleModeSettings },
  settingToggle('isPartialMode', ICONS.partial),
  settingToggle('alignInputWithFocus', ICONS.alignment),
  settingToggle('showStats', ICONS.stats),
  settingToggle('showProgress', ICONS.progress),
  settingToggle('matrixEffect', ICONS.matrix),
  {
    icon: () => (getSetting('theme') === 'dark' ? ICONS.moon : ICONS.sun),
    label: DARK_THEME_LABEL,
    isActive: () => getSetting('theme') === 'dark',
    onClick: toggleTheme
  },
  settingToggle('autoEnterFloating', ICONS.autoEnter)
];

const ACTIONS = [
  { icon: ICONS.settings, label: 'Настройки', onClick: () => settingsPanel.toggle() },
  { icon: ICONS.help, label: 'Справка', onClick: () => helpPanel.toggle() },
  { icon: ICONS.play, label: 'Следующая игра', onClick: openReplay }
];

const resolve = (value) => (typeof value === 'function' ? value() : value);

// The popup is placed against an anchor rectangle: the pointer is a zero-size one
const pointAnchor = (x, y) => ({ contains: () => false, getBoundingClientRect: () => new DOMRect(x, y) });

// The menu opens with the row clicked last under the pointer (kept between pages)
const STORAGE_KEY = 'kg-typeblock-context-menu';
const rows = [];
let menu = null;

function createRow(def, index) {
  const row = createElement('button', { type: 'button', className: 'kg-context-item' },
    createElement('span', { className: 'kg-context-icon' }),
    createElement('span', { className: 'kg-context-label', textContent: def.label }));
  row.setAttribute('role', def.isActive ? 'menuitemcheckbox' : 'menuitem');
  row.style.setProperty('--kg-index', index);
  if (def.isActive) row.append(createElement('span', { className: 'kg-switch' }));
  // A toggle keeps the menu open to flip several in a row, an action closes it
  row.addEventListener('click', () => {
    writeStorage(STORAGE_KEY, { last: index });
    if (!def.isActive) closePopup();
    def.onClick();
  });
  rows.push({ def, row });
  return row;
}

function syncRow({ def, row }) {
  const icon = resolve(def.icon);
  if (row.kgIcon !== icon) {
    row.firstChild.innerHTML = icon;
    row.kgIcon = icon;
  }
  if (def.isActive) row.setAttribute('aria-checked', def.isActive());
}

function build() {
  menu = createElement('div', { className: 'kg-context', role: 'menu' },
    ...TOGGLES.map(createRow),
    createElement('div', { className: 'kg-context-divider' }),
    ...ACTIONS.map((def, index) => createRow(def, TOGGLES.length + index)));
  // The typing input keeps its focus while the menu is used
  menu.addEventListener('mousedown', (event) => event.preventDefault());
}

export const refreshContextMenu = () => rows.forEach(syncRow);

export function openContextMenu(x, y) {
  if (!menu) build();
  refreshContextMenu();
  const last = rows[readStorage(STORAGE_KEY).last]?.row;
  // The row clicked last blinks, so it is easy to find when the menu could not be placed right under the pointer
  rows.forEach(({ row }) => row.classList.toggle('kg-last', row === last));
  openPopup(pointAnchor(x, y), menu, () => last);
}
