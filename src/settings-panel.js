import { showToast } from './actions.js';
import { ICONS } from './icons.js';
import { createPanel } from './panel.js';
import { SCHEMA, SECTIONS, exportSettings, getSetting, importSettings, isSettingsReady, resetSettings, setSetting } from './settings.js';
import { createElement, downloadJson, pickTextFile } from './utils.js';

const FILE_NAME = 'kg-typeblock-settings.json';
const KEY_EVENTS = ['keydown', 'keypress', 'keyup'];

// Every control writes to the settings right away and reports back how to show a value;
// the change listener refreshes all other controls and the game itself
const NUMBER_HINT = 'Двойной клик — ввести значение';
const RESET_HINT = 'Двойной клик — значение по умолчанию';

// The value readout turns into an input for an exact value: Enter or leaving applies, Escape cancels
function editExactValue(path, { min, max, step }, output) {
  const entry = createElement('input', { type: 'number', className: 'kg-range-entry', min, max, step, value: getSetting(path) });
  KEY_EVENTS.forEach((type) => entry.addEventListener(type, (event) => event.stopPropagation()));
  let isDone = false;
  const finish = (isApplied) => {
    if (isDone) return;
    isDone = true;
    if (isApplied && entry.value !== '') setSetting(path, Number(entry.value));
    entry.replaceWith(output);
  };
  entry.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') finish(true);
    else if (event.key === 'Escape') finish(false);
  });
  entry.addEventListener('blur', () => finish(true));
  output.replaceWith(entry);
  entry.focus();
  entry.select();
}

const CONTROLS = {
  bool: (path) => {
    const input = createElement('input', { type: 'checkbox' });
    input.addEventListener('change', () => setSetting(path, input.checked));
    return { element: input, set: (value) => { input.checked = value; } };
  },

  number: (path, field) => {
    const { min, max, step, unit } = field;
    const input = createElement('input', { type: 'range', min, max, step, title: RESET_HINT });
    const output = createElement('output', { title: NUMBER_HINT });
    input.addEventListener('input', () => setSetting(path, Number(input.value)));
    input.addEventListener('dblclick', () => setSetting(path, field.default));
    output.addEventListener('dblclick', () => editExactValue(path, field, output));
    return {
      element: createElement('div', { className: 'kg-range' }, input, output),
      set: (value) => {
        input.value = value;
        output.textContent = value + unit;
      }
    };
  },

  color: (path) => {
    const input = createElement('input', { type: 'color' });
    input.addEventListener('input', () => setSetting(path, input.value));
    return { element: input, set: (value) => { input.value = value; } };
  },

  choice: (path, { options }) => {
    const select = createElement('select', {}, ...Object.entries(options).map(([value, label]) =>
      createElement('option', { value, textContent: label })));
    select.addEventListener('change', () => setSetting(path, select.value));
    return { element: select, set: (value) => { select.value = value; } };
  },

  text: (path, { maxLength }) => {
    const input = createElement('input', { type: 'text', maxLength, spellcheck: false });
    // The site must not treat typed characters as game input
    KEY_EVENTS.forEach((type) => input.addEventListener(type, (event) => event.stopPropagation()));
    input.addEventListener('input', () => setSetting(path, input.value));
    return { element: input, set: (value) => { if (document.activeElement !== input) input.value = value; } };
  }
};

const rows = [];

const isVisible = ({ visibleIf }) => !visibleIf || getSetting(visibleIf[0]) === visibleIf[1];

function build(content) {
  SECTIONS.forEach(({ title, fields }) => {
    content.append(createElement('div', { className: 'kg-settings-heading', textContent: title }));
    fields.forEach((path) => {
      const field = SCHEMA[path];
      const control = CONTROLS[field.type](path, field);
      const row = createElement('label', { className: `kg-setting kg-setting-${field.type}` },
        createElement('span', { className: 'kg-setting-label', textContent: field.label }),
        control.element);
      content.append(row);
      rows.push({ field, path, row, set: control.set });
    });
  });
  content.append(createElement('button', {
    type: 'button',
    className: 'kg-settings-reset',
    textContent: 'Сбросить настройки',
    onclick: () => window.confirm('Вернуть все настройки к значениям по умолчанию?') && resetSettings()
  }));
}

// Built once, afterwards only the values are synced, so a control being dragged is never recreated
function render(content) {
  if (!rows.length) build(content);
  rows.forEach(({ field, path, row, set }) => {
    set(getSetting(path));
    row.hidden = !isVisible(field);
  });
}

async function importFromFile() {
  const json = await pickTextFile('.json,application/json');
  if (json == null) return;
  try {
    importSettings(json);
    showToast('Настройки импортированы');
  } catch (error) {
    showToast(error.message);
  }
}

function exportToFile() {
  downloadJson(FILE_NAME, exportSettings());
  showToast('Настройки экспортированы');
}

export const settingsPanel = createPanel({
  name: 'settings',
  storageKey: 'kg-typeblock-settings-panel',
  align: 'right',
  canOpen: isSettingsReady,
  render,
  actions: [
    { className: 'kg-panel-import', title: 'Импорт настроек (JSON)', icon: ICONS.import, onClick: importFromFile },
    { className: 'kg-panel-export', title: 'Экспорт настроек (JSON)', icon: ICONS.export, onClick: exportToFile }
  ]
});