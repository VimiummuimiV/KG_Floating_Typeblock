import { SCHEMA, getSetting, setSetting, toggleModeSettings as toggleMode } from './settings.js';
import { byId, createElement, formatToggle } from './utils.js';

// Labels of toggles that are not a plain setting: shared by the toast and the context menu
export const MODE_SETTINGS_LABEL = 'Настройки режима';
export const DARK_THEME_LABEL = 'Тёмная тема';

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
  showToast(formatToggle(DARK_THEME_LABEL, next === 'dark'));
}

export function toggleModeSettings() {
  const saved = toggleMode();
  if (saved !== null) showToast(formatToggle(MODE_SETTINGS_LABEL, saved));
}
