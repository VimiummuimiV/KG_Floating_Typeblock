import { hideDown, showFromDown } from './animations.js';
import { getSetting } from './settings.js';
import { byId, clamp, createElement, times } from './utils.js';

const WRAP_ID = 'kg-stats-wrap';
const SLIDE = { distance: 24 };
const SPEED_SCALE = { maxSpeed: 1000, hueRange: 130, cells: 16 };
const ERRORS_HIT = {
  keyframes: [
    { transform: 'scale(1.3)', filter: 'brightness(1.6)' },
    { transform: 'scale(1)', filter: 'none' }
  ],
  duration: 350
};

function createStats() {
  const cells = times(SPEED_SCALE.cells, () => createElement('div', { className: 'kg-speed-cell' }));
  const panel = createElement('div', { id: 'kg-stats' },
    createElement('div', { className: 'kg-speed' },
      createElement('div', { className: 'kg-speed-readout' },
        createElement('span', { className: 'kg-speed-value', textContent: '0' }),
        createElement('span', { className: 'kg-speed-unit', textContent: 'скорость' })),
      createElement('div', { className: 'kg-speed-bar' }, ...cells)),
    createElement('div', { className: 'kg-errors' },
      createElement('span', { className: 'kg-errors-value', textContent: '0' }),
      createElement('span', { className: 'kg-errors-label', textContent: 'ошибки' })));

  // Wrapper owns position; panel stays free of transform so slide animation works
  return createElement('div', { id: WRAP_ID }, panel);
}

const readNumber = (id) => Number.parseInt(byId(id)?.textContent, 10) || 0;

function setText(element, value) {
  const text = String(value);
  if (element.textContent === text) return false;
  element.textContent = text;
  return true;
}

function renderStats(stats) {
  const speed = readNumber('speed-label');
  const errors = readNumber('errors-label');
  const ratio = clamp(speed / SPEED_SCALE.maxSpeed, 0, 1);
  stats.style.setProperty('--kg-speed-hue', Math.round((1 - ratio) * SPEED_SCALE.hueRange));
  setText(stats.querySelector('.kg-speed-value'), speed);

  const litCells = Math.round(ratio * SPEED_SCALE.cells);
  stats.querySelectorAll('.kg-speed-cell').forEach((cell, index) => {
    cell.classList.toggle('kg-speed-cell-lit', index < litCells);
  });

  const errorsBox = stats.querySelector('.kg-errors');
  const errorsValue = errorsBox.querySelector('.kg-errors-value');
  const previousErrors = Number(errorsValue.textContent);
  if (setText(errorsValue, errors) && errors > previousErrors && stats.dataset.ready) {
    errorsValue.animate(ERRORS_HIT.keyframes, ERRORS_HIT.duration);
  }
  stats.dataset.ready = '1';
  errorsBox.classList.toggle('kg-errors-active', errors > 0);
}

function reveal(wrap) {
  wrap.dataset.state = 'shown';
  showFromDown(wrap, SLIDE);
}

// Runs on every DOM change of the page, so it must be idempotent:
// a hide that is already under way is never started again
function conceal(wrap) {
  if (wrap.dataset.state === 'hiding') return;
  wrap.dataset.state = 'hiding';
  hideDown(wrap, SLIDE);
}

export function updateStats() {
  const wrap = byId(WRAP_ID);
  if (!getSetting('showStats')) {
    if (wrap) conceal(wrap);
    return;
  }
  if (wrap) {
    if (wrap.dataset.state === 'hiding') reveal(wrap);
    renderStats(wrap.firstElementChild);
    return;
  }
  const mainBlock = byId('main-block');
  if (!mainBlock) return;
  const created = createStats();
  mainBlock.prepend(created);
  renderStats(created.firstElementChild);
  reveal(created);
}

export const removeStats = () => byId(WRAP_ID)?.remove();