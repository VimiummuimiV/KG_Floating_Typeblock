import { SCHEMA, getSetting, setSetting, toggleModeSettings as toggleMode } from './settings.js';
import { THEME_NAMES } from './theme.js';
import { byId, createElement, formatToggle } from './utils.js';

const TOAST_DURATION = 1500;
let toastTimeout = null;

// Short message at the bottom, feedback for actions that have no visible effect
export function showToast(message) {
  const toast = byId('kg-toast') ?? document.body.appendChild(createElement('div', { id: 'kg-toast' }));
  toast.textContent = message;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.remove(), TOAST_DURATION);
}

// The effect of a changed setting is applied by the change listener, here only the flip and the feedback
export function toggleSetting(key) {
  setSetting(key, !getSetting(key));
  showToast(formatToggle(SCHEMA[key].label, getSetting(key)));
}

export function toggleTheme() {
  const next = getSetting('theme') === 'dark' ? 'light' : 'dark';
  setSetting('theme', next);
  showToast(`Тема: ${THEME_NAMES[next]}`);
}

export function toggleModeSettings() {
  const saved = toggleMode();
  if (saved !== null) showToast(saved ? 'Настройки режима запомнены' : 'Настройки режима забыты');
}
