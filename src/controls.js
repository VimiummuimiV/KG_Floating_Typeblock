import { createDrag } from './drag.js';
import { clamp, createElement, isolateKeys } from './utils.js';

// Own form controls: the browser ones look different in every browser.
// Each factory returns { element, set }: set(value) shows a value, the callback reports a change made by the user.

const POPUP_GAP = 4;
const POPUP_MARGIN = 8;
const HEX_PATTERN = /^#?([0-9a-f]{6})$/i;

// ─── Dragging ────────────────────────────────────────────────────────────────

// Reports the pointer inside the element as fractions 0..1 while it is pressed and dragged
function createFractionDrag(element, apply, canStart) {
  const report = (x, y) => {
    const rect = element.getBoundingClientRect();
    apply(clamp((x - rect.left) / rect.width, 0, 1), clamp((y - rect.top) / rect.height, 0, 1));
  };
  createDrag({
    element,
    canStart,
    onStart: (event) => {
      report(event.clientX, event.clientY);
      return {};
    },
    onMove: (dx, dy, start) => report(start.x + dx, start.y + dy)
  });
}

// ─── Popup (one at a time, shared by the select and the color picker) ────────

const popup = { element: null, anchor: null };

const onPointerDown = (event) => {
  if (!popup.element.contains(event.target) && !popup.anchor.contains(event.target)) closePopup();
};
const onKeydown = (event) => event.key === 'Escape' && closePopup();
const onScroll = (event) => popup.element.contains(event.target) || closePopup();
const POPUP_LISTENERS = [
  [document, 'pointerdown', onPointerDown],
  [document, 'keydown', onKeydown],
  [document, 'scroll', onScroll],
  [window, 'resize', () => closePopup()]
];

function closePopup() {
  if (!popup.anchor) return;
  popup.element.hidden = true;
  popup.anchor = null;
  POPUP_LISTENERS.forEach(([target, type, handler]) => target.removeEventListener(type, handler, true));
}

// Below the anchor, above it when there is no room
function openPopup(anchor, content) {
  closePopup();
  popup.element ??= document.body.appendChild(createElement('div', { className: 'kg-popup', hidden: true }));
  popup.anchor = anchor;
  popup.element.replaceChildren(content);
  popup.element.hidden = false;

  const rect = anchor.getBoundingClientRect();
  popup.element.style.minWidth = `${rect.width}px`;
  const { offsetWidth: width, offsetHeight: height } = popup.element;
  const below = rect.bottom + POPUP_GAP;
  const fitsBelow = below + height <= window.innerHeight - POPUP_MARGIN;
  popup.element.style.left = `${clamp(rect.left, POPUP_MARGIN, Math.max(POPUP_MARGIN, window.innerWidth - width - POPUP_MARGIN))}px`;
  popup.element.style.top = `${fitsBelow ? below : Math.max(POPUP_MARGIN, rect.top - POPUP_GAP - height)}px`;
  POPUP_LISTENERS.forEach(([target, type, handler]) => target.addEventListener(type, handler, true));
}

// ─── Checkbox ────────────────────────────────────────────────────────────────

export function createCheckbox(onChange) {
  const box = createElement('button', { type: 'button', className: 'kg-checkbox' });
  const set = (value) => box.setAttribute('aria-pressed', value);
  box.addEventListener('click', () => {
    const value = box.getAttribute('aria-pressed') !== 'true';
    set(value);
    onChange(value);
  });
  return { element: box, set };
}

// ─── Slider ──────────────────────────────────────────────────────────────────

const ARROW_DIRECTION = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };

// Values are reported raw: snapping to the step belongs to whoever stores them
export function createSlider({ min, max, step }, onChange) {
  const track = createElement('div', { className: 'kg-slider', tabIndex: 0 }, createElement('span', { className: 'kg-slider-thumb' }));
  let value = min;

  // Alt + click is a reset of the parameter (handled by the owner), not a drag
  createFractionDrag(track, (fraction) => onChange(min + fraction * (max - min)), (event) => !event.altKey);
  track.addEventListener('keydown', (event) => {
    const direction = ARROW_DIRECTION[event.key];
    if (!direction) return;
    event.preventDefault();
    event.stopPropagation();
    onChange(value + direction * step);
  });

  return {
    element: track,
    set: (next) => {
      value = next;
      track.style.setProperty('--kg-slider-fill', (next - min) / (max - min));
    }
  };
}

// ─── Select ──────────────────────────────────────────────────────────────────

export function createSelect(options, onChange) {
  const values = Object.keys(options);
  const button = createElement('button', { type: 'button', className: 'kg-select' });
  let current;

  const set = (value) => {
    current = value;
    button.textContent = options[value];
  };
  const menu = createElement('div', { className: 'kg-menu' }, ...values.map((value) => createElement('button', {
    type: 'button',
    className: 'kg-menu-item',
    textContent: options[value],
    onclick: () => {
      set(value);
      onChange(value);
      closePopup();
    }
  })));

  button.addEventListener('click', () => {
    if (popup.anchor === button) return closePopup();
    [...menu.children].forEach((item, index) => item.classList.toggle('kg-selected', values[index] === current));
    openPopup(button, menu);
  });
  return { element: button, set };
}

// ─── Color picker ────────────────────────────────────────────────────────────

function hsvToHex({ h, s, v }) {
  const channel = (n) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return '#' + [5, 3, 1].map((n) => Math.round(channel(n) * 255).toString(16).padStart(2, '0')).join('');
}

function hexToHsv(hex) {
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let h = 0;
  if (delta) h = 60 * (max === r ? ((g - b) / delta + 6) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4);
  return { h, s: max ? delta / max : 0, v: max };
}

// One picker for all colors: load() points it at a color and the callback that receives changes.
// The state is HSV, so the hue survives while the color is black or gray.
function createPicker() {
  let hsv;
  let onChange;
  const areaCursor = createElement('span', { className: 'kg-picker-cursor' });
  const hueCursor = createElement('span', { className: 'kg-picker-cursor' });
  const area = createElement('div', { className: 'kg-picker-area' }, areaCursor);
  const hue = createElement('div', { className: 'kg-picker-hue' }, hueCursor);
  const hexInput = createElement('input', { type: 'text', className: 'kg-picker-hex', maxLength: 7, spellcheck: false });
  isolateKeys(hexInput);

  const render = () => {
    area.style.setProperty('--kg-picker-hue', hsv.h);
    areaCursor.style.left = `${hsv.s * 100}%`;
    areaCursor.style.top = `${(1 - hsv.v) * 100}%`;
    hueCursor.style.left = `${(hsv.h / 360) * 100}%`;
    if (document.activeElement !== hexInput) hexInput.value = hsvToHex(hsv);
  };
  const update = (next) => {
    hsv = next;
    render();
    onChange(hsvToHex(hsv));
  };

  createFractionDrag(area, (x, y) => update({ ...hsv, s: x, v: 1 - y }));
  createFractionDrag(hue, (x) => update({ ...hsv, h: x * 360 }));
  hexInput.addEventListener('input', () => {
    const match = HEX_PATTERN.exec(hexInput.value.trim());
    if (match) update(hexToHsv(`#${match[1]}`));
  });
  hexInput.addEventListener('blur', render);

  return {
    element: createElement('div', { className: 'kg-picker' }, area, hue, hexInput),
    load: (hex, callback) => {
      onChange = callback;
      if (!hsv || hex !== hsvToHex(hsv)) hsv = hexToHsv(hex);
      render();
    }
  };
}

let picker;

export function createColorPicker(onChange) {
  const swatch = createElement('button', { type: 'button', className: 'kg-swatch' });
  let current;

  swatch.addEventListener('click', () => {
    if (popup.anchor === swatch) return closePopup();
    picker ??= createPicker();
    picker.load(current, onChange);
    openPopup(swatch, picker.element);
  });
  return {
    element: swatch,
    set: (hex) => {
      current = hex;
      swatch.style.backgroundColor = hex;
      if (popup.anchor === swatch) picker.load(hex, onChange);
    }
  };
}
