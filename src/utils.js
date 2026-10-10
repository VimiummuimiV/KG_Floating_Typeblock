export const FLOATING_CLASS = 'kg-floating';
// Short softening of abrupt switches (the matrix effect on and off)
export const FADE_MS = 300;

// ─── Math / data ─────────────────────────────────────────────────────────────

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
// The site runs Prototype.js, which replaces Array.from (it ignores array-likes and the map callback):
// never use Array.from here, spread works on strings and iterables
export const times = (count, create) => [...Array(count).keys()].map((index) => create(index));
export const randomItem = (list) => list[Math.floor(Math.random() * list.length)];
export const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

export const onOff = (isOn) => (isOn ? 'вкл' : 'выкл');
export const formatToggle = (label, isOn) => `${label}: ${onOff(isOn)}`;

// ─── DOM ─────────────────────────────────────────────────────────────────────

export const byId = (id) => document.getElementById(id);

// The class on <html> is the single source of truth for the floating mode (CSS keys off it too)
export const isFloating = () => document.documentElement.classList.contains(FLOATING_CLASS);

export const eventHits = (event, id) => byId(id)?.contains(event.target) ?? false;

export function createElement(tag, properties = {}, ...children) {
  const element = Object.assign(document.createElement(tag), properties);
  element.append(...children);
  return element;
}

// The site must not treat characters typed into our inputs as game input
export const isolateKeys = (input) => ['keydown', 'keypress', 'keyup'].forEach((type) =>
  input.addEventListener(type, (event) => event.stopPropagation()));

export function setCssVars(vars) {
  const { style } = document.documentElement;
  Object.entries(vars).forEach(([name, value]) => style.setProperty(name, value));
}

// Inline !important beats any stylesheet rule of the site
export function setImportant(element, properties) {
  Object.entries(properties).forEach(([name, value]) => element.style.setProperty(name, value, 'important'));
}

// ─── Listeners ───────────────────────────────────────────────────────────────

export const addListener = (target, type, handler, options) => target.addEventListener(type, handler, options);

// Tracked listeners of one lifetime (floating mode), all removed by dispose()
export function createListenerScope() {
  const entries = [];
  return {
    on(target, type, handler, options) {
      addListener(target, type, handler, options);
      entries.push([target, type, handler, options]);
    },
    dispose() {
      entries.forEach(([target, type, handler, options]) => target.removeEventListener(type, handler, options));
      entries.length = 0;
    }
  };
}

// ─── Storage ─────────────────────────────────────────────────────────────────

export function readStorage(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return isPlainObject(value) ? value : {};
  } catch {
    return {};
  }
}

export const writeStorage = (key, value) => localStorage.setItem(key, JSON.stringify(value));

// ─── Files ───────────────────────────────────────────────────────────────────

export function downloadJson(filename, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  createElement('a', { href: url, download: filename }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Resolves with the text of the chosen file; stays pending when the dialog is cancelled
export function pickTextFile(accept) {
  return new Promise((resolve) => {
    const input = createElement('input', { type: 'file', accept });
    input.addEventListener('change', () => resolve(input.files[0]?.text()), { once: true });
    input.click();
  });
}