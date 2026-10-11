import { byId, createElement, isFloating } from './utils.js';

const INDICATOR_DELAY = 3000;
const FONT_URL = 'https://fonts.googleapis.com/css2?family=Quicksand:wght@300..700&display=swap';

let hideTimer = 0;

const ensureFont = () => byId('kg-font-import') ?? document.head.appendChild(
  createElement('link', { id: 'kg-font-import', rel: 'stylesheet', href: FONT_URL }));

// Value of something changed by dragging or wheel, shown for a moment under the block
export function showNumericIndicator(value, title = '') {
  const mainBlock = isFloating() ? byId('main-block') : null;
  if (!mainBlock) return;
  ensureFont();
  const indicator = byId('kg-numeric-indicator')
    ?? mainBlock.appendChild(createElement('span', { id: 'kg-numeric-indicator', className: 'kg-btn' }));
  indicator.title = title;
  indicator.textContent = String(value);
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => indicator.remove(), INDICATOR_DELAY);
}
