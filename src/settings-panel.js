import { showToast } from './actions.js';
import { createCheckbox, createColorPicker, createSelect, createSlider } from './controls.js';
import { ICONS } from './icons.js';
import { createPanel } from './panel.js';
import { SCHEMA, SECTIONS, exportSettings, getSetting, importSettings, isSettingsReady, resetSettings, setSetting } from './settings.js';
import { createElement, downloadJson, isolateKeys, pickTextFile, readStorage, writeStorage } from './utils.js';

const FILE_NAME = 'kg-typeblock-settings.json';
// Shared with the panel: { open, left, top, collapsed: [section ids] }
const STORAGE_KEY = 'kg-typeblock-settings-panel';
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
const sections = [];
const subheadings = [];
const collapsed = new Set();

// visibleIf: [path, value or list of values]
const isVisible = ({ visibleIf }) => !visibleIf || [].concat(visibleIf[1]).includes(getSetting(visibleIf[0]));

// Hidden: the condition of the setting is not met, or its section is collapsed.
// A subheading goes together with the last of its settings.
function syncRows() {
  sections.forEach(({ id, heading }) => heading.classList.toggle('kg-collapsed', collapsed.has(id)));
  rows.forEach(({ field, row, sectionId }) => { row.hidden = !isVisible(field) || collapsed.has(sectionId); });
  subheadings.forEach(({ element, members }) => { element.hidden = members.every(({ row }) => row.hidden); });
}

function toggleSection(id) {
  if (!collapsed.delete(id)) collapsed.add(id);
  writeStorage(STORAGE_KEY, { ...readStorage(STORAGE_KEY), collapsed: [...collapsed] });
  syncRows();
}

function createRow(path, field) {
  const control = CONTROLS[field.type](path, field);
  const row = createElement('div', { className: `kg-setting kg-setting-${field.type}` },
    createElement('span', { className: 'kg-setting-label', textContent: field.label }),
    control.element);
  // Alt + click anywhere on the row resets this one setting
  row.addEventListener('click', (event) => {
    if (!event.altKey) return;
    event.preventDefault();
    event.stopPropagation();
    setSetting(path, field.default);
  }, true);
  return { field, path, row, set: control.set };
}

function build(content) {
  const stored = readStorage(STORAGE_KEY).collapsed;
  if (Array.isArray(stored)) stored.forEach((id) => collapsed.add(id));

  SECTIONS.forEach(({ id, title, fields }) => {
    const heading = createElement('button', { type: 'button', className: 'kg-settings-heading', textContent: title });
    heading.addEventListener('click', () => toggleSection(id));
    sections.push({ id, heading });
    content.append(heading);
    let subheading = null;
    fields.forEach((entry) => {
      if (entry.subheading) {
        subheading = { element: createElement('div', { className: 'kg-settings-subheading', textContent: entry.subheading }), members: [] };
        subheadings.push(subheading);
        content.append(subheading.element);
        return;
      }
      const setting = { ...createRow(entry, SCHEMA[entry]), sectionId: id };
      subheading?.members.push(setting);
      rows.push(setting);
      content.append(setting.row);
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
  storageKey: STORAGE_KEY,
  align: 'center',
  canOpen: isSettingsReady,
  render,
  actions: [
    { className: 'kg-panel-import', title: 'Импорт настроек (JSON)', icon: ICONS.import, onClick: importFromFile },
    { className: 'kg-panel-export', title: 'Экспорт настроек (JSON)', icon: ICONS.export, onClick: exportToFile }
  ]
});