import { byId, createElement, isFloating } from './utils.js';

const INDICATOR_DELAY = 3000;
// Space under the block the indicator needs (see #kg-numeric-indicator); without it the indicator goes above the block
const INDICATOR_ROOM = 40;
const FONT_URL = 'https://fonts.googleapis.com/css2?family=Quicksand:wght@300..700&display=swap';

let hideTimer = 0;

const ensureFont = () => byId('kg-font-import') ?? document.head.appendChild(
  createElement('link', { id: 'kg-font-import', rel: 'stylesheet', href: FONT_URL }));

// Under the block, or above it when the block is too close to the bottom edge. Called on every move of the block.
export function placeIndicator() {
  const mainBlock = byId('main-block');
  byId('kg-numeric-indicator')?.classList.toggle('kg-above',
    document.documentElement.clientHeight - mainBlock.getBoundingClientRect().bottom < INDICATOR_ROOM);
}

// Value of something changed by dragging or wheel, shown for a moment next to the block
export function showNumericIndicator(value, title = '') {
  const mainBlock = isFloating() ? byId('main-block') : null;
  if (!mainBlock) return;
  ensureFont();
  const indicator = byId('kg-numeric-indicator')
    ?? mainBlock.appendChild(createElement('span', { id: 'kg-numeric-indicator', className: 'kg-btn' }));
  indicator.title = title;
  indicator.textContent = String(value);
  placeIndicator();
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => indicator.remove(), INDICATOR_DELAY);
}
