import { getModeKey } from './game.js';
import { FALL_OPTIONS, GLYPH_OPTIONS } from './matrix-presets.js';
import { clamp, isPlainObject, readStorage, writeStorage } from './utils.js';

// ─── Schema ──────────────────────────────────────────────────────────────────
// One description per setting: defaults, limits, validation and the settings panel are all driven by it.
// Nested paths ('matrix.fontSize') are stored as nested objects.

const bool = (label, def, extra) => ({ type: 'bool', label, default: def, ...extra });
const number = (label, def, min, max, step, unit = '', extra) => ({ type: 'number', label, default: def, min, max, step, unit, ...extra });
const color = (label, def, extra) => ({ type: 'color', label, default: def, ...extra });
const choice = (label, def, options, extra) => ({ type: 'choice', label, default: def, options, ...extra });
const text = (label, def, maxLength, extra) => ({ type: 'text', label, default: def, maxLength, ...extra });

export const SCHEMA = {
  theme: choice('Тема', 'dark', { dark: 'тёмная', light: 'светлая' }),
  showButtons: bool('Панель кнопок', true),
  autoEnterFloating: bool('Автовход в плавающий режим', true),
  alignInputWithFocus: bool('Выравнивание ввода', true),
  isPartialMode: bool('Построчное отображение', false),
  visibleLines: number('Видимых строк', 1, 1, 50, 1, '', { visibleIf: ['isPartialMode', true] }),
  showProgress: bool('Прогресс-бар', true),
  showStats: bool('Скорость и ошибки', true),
  fontSize: number('Размер шрифта', 16, 12, 48, 2, 'px'),
  mainBlockWidth: number('Ширина блока', 90, 20, 95, 0.1, 'vw'),
  mainBlockPosition: number('Положение блока', 25, 0, 100, 0.1, 'vh'),
  dimming: number('Затемнение фона', 50, 0, 100, 1, '%'),
  matrixEffect: bool('Эффект матрицы', false),
  'matrix.dimming': number('Затемнение при матрице', 50, 0, 100, 1, '%'),
  'matrix.glyphSet': choice('Набор символов', 'katakana', GLYPH_OPTIONS),
  'matrix.digits': bool('Добавить цифры', false),
  'matrix.customGlyphs': text('Свои символы', '', 100, { visibleIf: ['matrix.glyphSet', 'custom'] }),
  'matrix.fallStyle': choice('Стиль падения', 'classic', FALL_OPTIONS),
  'matrix.fontSize': number('Размер символов', 16, 8, 48, 1, 'px'),
  'matrix.stepInterval': number('Интервал шага', 60, 20, 200, 5, 'мс'),
  'matrix.opacity': number('Прозрачность', 0.6, 0.1, 1, 0.05),
  'matrix.trailFade': number('Затухание шлейфа', 0.03, 0.01, 0.2, 0.01),
  'matrix.wordChance': number('Шанс слова', 0.01, 0, 0.1, 0.005),
  'matrix.minWordLength': number('Мин. длина слова', 3, 1, 12, 1),
  'matrix.glyphColor': color('Цвет символов', '#00ff00'),
  'matrix.wordColor': color('Цвет слов', '#ccffcc'),
  'matrix.brightHead': bool('Яркая «голова» потока', false),
  'matrix.headColor': color('Цвет «головы»', '#ffffff', { visibleIf: ['matrix.brightHead', true] })
};

// Layout of the settings panel
export const SECTIONS = [
  {
    title: 'Общие',
    fields: [
      'dimming', 'fontSize', 'mainBlockWidth', 'mainBlockPosition', 'autoEnterFloating',
      'alignInputWithFocus', 'isPartialMode', 'visibleLines', 'showProgress', 'showStats'
    ]
  },
  {
    title: 'Матрица',
    fields: [
      'matrixEffect', 'matrix.dimming', 'matrix.glyphSet', 'matrix.customGlyphs', 'matrix.digits', 'matrix.fallStyle',
      'matrix.fontSize', 'matrix.stepInterval', 'matrix.opacity', 'matrix.trailFade',
      'matrix.wordChance', 'matrix.minWordLength', 'matrix.glyphColor', 'matrix.wordColor',
      'matrix.brightHead', 'matrix.headColor'
    ]
  }
];

// ─── Validation ──────────────────────────────────────────────────────────────

const decimals = (step) => (String(step).split('.')[1] || '').length;
const snap = (value, { min, step }) => Number((min + Math.round((value - min) / step) * step).toFixed(decimals(step)));

const NORMALIZERS = {
  bool: (value, field) => (typeof value === 'boolean' ? value : field.default),
  number: (value, field) => (Number.isFinite(value) ? clamp(snap(value, field), field.min, field.max) : field.default),
  color: (value, field) => (/^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : field.default),
  choice: (value, field) => (Object.hasOwn(field.options, value) ? value : field.default),
  text: (value, field) => (typeof value === 'string' ? value.slice(0, field.maxLength) : field.default)
};

const normalize = (path, value) => NORMALIZERS[SCHEMA[path].type](value, SCHEMA[path]);

const getPath = (object, path) => path.split('.').reduce((node, key) => node?.[key], object);

function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((node, key) => (node[key] ??= {}), object)[last] = value;
}

// Full valid settings object from anything: unknown keys dropped, missing and invalid values defaulted
function sanitize(raw) {
  const result = {};
  Object.keys(SCHEMA).forEach((path) => setPath(result, path, normalize(path, getPath(raw, path))));
  return result;
}

// Before 1.3.0 dimming was { backdrop, matrix }
function migrate(raw) {
  if (!isPlainObject(raw?.dimming)) return raw;
  const { backdrop, matrix } = raw.dimming;
  return { ...raw, dimming: backdrop, matrix: { dimming: matrix, ...raw.matrix } };
}

function deepMerge(base, extra) {
  const [first, second] = [base ?? {}, extra ?? {}];
  return Object.keys({ ...first, ...second }).reduce((merged, key) => {
    const [a, b] = [first[key], second[key]];
    merged[key] = isPlainObject(a) && isPlainObject(b) ? deepMerge(a, b) : (b ?? a);
    return merged;
  }, {});
}

// ─── Storage ─────────────────────────────────────────────────────────────────

const KEYS = { defaults: 'kg-typeblock-settings', modes: 'kg-typeblock-custom-settings' };
const FILE = { format: 'kg-floating-typeblock-settings', version: 1 };

const readDefaults = () => migrate(readStorage(KEYS.defaults));
const readModes = () => readStorage(KEYS.modes);

// values:  the active settings
// modeKey: set when the active settings are the personal snapshot of this game mode
const store = { values: sanitize({}), modeKey: null, ready: false, listeners: new Set() };

function persist() {
  if (store.modeKey) writeStorage(KEYS.modes, { ...readModes(), [store.modeKey]: store.values });
  else writeStorage(KEYS.defaults, store.values);
}

// listeners get the list of changed paths, null means "everything may have changed"
const emit = (paths) => store.listeners.forEach((listener) => listener(paths));

export function onChange(listener) {
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const isSettingsReady = () => store.ready;
export const getSetting = (path) => getPath(store.values, path);

export function loadSettings() {
  const modeKey = getModeKey();
  const snapshot = modeKey ? readModes()[modeKey] : null;
  store.values = sanitize(deepMerge(readDefaults(), migrate(snapshot)));
  store.modeKey = snapshot ? modeKey : null;
  store.ready = true;
}

export function setSettings(changes) {
  const changed = [];
  for (const [path, value] of Object.entries(changes)) {
    const next = normalize(path, value);
    if (Object.is(getSetting(path), next)) continue;
    setPath(store.values, path, next);
    changed.push(path);
  }
  if (!changed.length) return;
  persist();
  emit(changed);
}

export const setSetting = (path, value) => setSettings({ [path]: value });

export function resetSettings() {
  store.values = sanitize({});
  persist();
  emit(null);
}

// Backdrop dimming and matrix dimming are independent: the active one depends on the effect
export const dimmingPath = () => (getSetting('matrixEffect') ? 'matrix.dimming' : 'dimming');

// ─── Per-mode settings ───────────────────────────────────────────────────────

export const hasModeSettings = () => !!store.modeKey;

// Saves the active settings as the personal snapshot of this game mode, or forgets it.
// Returns true when saved, false when forgotten, null when the mode is unknown.
export function toggleModeSettings() {
  const modeKey = getModeKey();
  if (!modeKey) return null;
  const modes = readModes();
  if (store.modeKey) {
    delete modes[modeKey];
    writeStorage(KEYS.modes, modes);
    loadSettings();
  } else {
    writeStorage(KEYS.modes, { ...modes, [modeKey]: store.values });
    store.modeKey = modeKey;
  }
  emit(null);
  return hasModeSettings();
}

// ─── Import / export ─────────────────────────────────────────────────────────

export function exportSettings() {
  const modes = Object.fromEntries(Object.entries(readModes()).map(([key, snapshot]) => [key, sanitize(migrate(snapshot))]));
  return { ...FILE, settings: sanitize(readDefaults()), modes };
}

// Throws an Error with a readable message on a bad file; replaces the stored settings otherwise
export function importSettings(json) {
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Файл не является JSON');
  }
  if (data?.format !== FILE.format || !isPlainObject(data.settings)) throw new Error('Неверный формат файла настроек');
  if (data.version > FILE.version) throw new Error('Файл создан более новой версией скрипта');

  const modes = Object.entries(isPlainObject(data.modes) ? data.modes : {})
    .filter(([, snapshot]) => isPlainObject(snapshot))
    .map(([key, snapshot]) => [key, sanitize(migrate(snapshot))]);
  writeStorage(KEYS.defaults, sanitize(migrate(data.settings)));
  writeStorage(KEYS.modes, Object.fromEntries(modes));
  loadSettings();
  emit(null);
}