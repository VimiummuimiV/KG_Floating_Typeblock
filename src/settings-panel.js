import { showToast } from './actions.js';
import { createCheckbox, createColorPicker, createSelect, createSlider } from './controls.js';
import { ICONS } from './icons.js';
import { createPanel } from './panel.js';
import { SCHEMA, SECTIONS, exportSettings, getSetting, importSettings, isSettingsReady, resetSettings, setSetting } from './settings.js';
import { createElement, downloadJson, isolateKeys, pickTextFile } from './utils.js';

const FILE_NAME = 'kg-typeblock-settings.json';
const RESET_LABEL = 'Сбросить настройки';
const RESET_CONFIRM_LABEL = 'Нажмите ещё раз, чтобы сбросить всё';
const RESET_CONFIRM_DELAY = 3000;

// The value readout turns into an input for an exact value: Enter or leaving applies, Escape cancels
function editExactValue(path, { min, max, step }, output) {
  const entry = createElement('input', { type: 'number', className: 'kg-range-entry', min, max, step, value: getSetting(path) });
  isolateKeys(entry);
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

// Every control writes to the settings right away; the change listener refreshes all other controls and the game itself
const CONTROLS = {
  bool: (path) => createCheckbox((value) => setSetting(path, value)),

  number: (path, field) => {
    const slider = createSlider(field, (value) => setSetting(path, value));
    const output = createElement('output');
    output.addEventListener('dblclick', () => editExactValue(path, field, output));
    return {
      element: createElement('div', { className: 'kg-range' }, slider.element, output),
      set: (value) => {
        slider.set(value);
        output.textContent = value + field.unit;
      }
    };
  },

  color: (path) => createColorPicker((value) => setSetting(path, value)),

  choice: (path, { options }) => createSelect(options, (value) => setSetting(path, value)),

  text: (path, { maxLength }) => {
    const input = createElement('input', { type: 'text', maxLength, spellcheck: false });
    isolateKeys(input);
    input.addEventListener('input', () => setSetting(path, input.value));
    return { element: input, set: (value) => { if (document.activeElement !== input) input.value = value; } };
  }
};

// The first click arms the button, the second one resets everything
function createResetButton() {
  let timer = 0;
  const button = createElement('button', { type: 'button', className: 'kg-settings-reset', textContent: RESET_LABEL });
  const disarm = () => {
    clearTimeout(timer);
    timer = 0;
    button.textContent = RESET_LABEL;
  };
  button.addEventListener('click', () => {
    if (timer) {
      disarm();
      resetSettings();
      return;
    }
    button.textContent = RESET_CONFIRM_LABEL;
    timer = setTimeout(disarm, RESET_CONFIRM_DELAY);
  });
  return button;
}

const rows = [];

const isVisible = ({ visibleIf }) => !visibleIf || getSetting(visibleIf[0]) === visibleIf[1];

// Hidden: the condition of the setting is not met, or its section is collapsed
const syncRows = () => rows.forEach(({ field, row, heading }) => {
  row.hidden = !isVisible(field) || heading.classList.contains('kg-collapsed');
});

function build(content) {
  SECTIONS.forEach(({ title, fields }) => {
    const heading = createElement('button', { type: 'button', className: 'kg-settings-heading', textContent: title });
    heading.addEventListener('click', () => {
      heading.classList.toggle('kg-collapsed');
      syncRows();
    });
    content.append(heading);
    fields.forEach((path) => {
      const field = SCHEMA[path];
      const control = CONTROLS[field.type](path, field);
      const row = createElement('label', { className: `kg-setting kg-setting-${field.type}` },
        createElement('span', { className: 'kg-setting-label', textContent: field.label }),
        control.element);
      // Alt + click anywhere on the row resets this one setting
      row.addEventListener('click', (event) => {
        if (!event.altKey) return;
        event.preventDefault();
        event.stopPropagation();
        setSetting(path, field.default);
      }, true);
      content.append(row);
      rows.push({ field, path, row, heading, set: control.set });
    });
  });
  content.append(createResetButton());
}

// Built once, afterwards only the values are synced, so a control being dragged is never recreated
function render(content) {
  if (!rows.length) build(content);
  rows.forEach(({ path, set }) => set(getSetting(path)));
  syncRows();
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
  align: 'center',
  canOpen: isSettingsReady,
  render,
  actions: [
    { className: 'kg-panel-import', title: 'Импорт настроек (JSON)', icon: ICONS.import, onClick: importFromFile },
    { className: 'kg-panel-export', title: 'Экспорт настроек (JSON)', icon: ICONS.export, onClick: exportToFile }
  ]
});