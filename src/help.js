import { createPanel } from './panel.js';
import { getSetting, isSettingsReady } from './settings.js';
import { THEME_NAMES } from './theme.js';
import { byId, isFloating, onOff } from './utils.js';

const flag = (key) => () => getSetting(key);

// Hotkeys show the current state: boolean is drawn as on/off, string as a plain value
const HELP_SECTIONS = [
  {
    title: 'Горячие клавиши',
    items: [
      { text: '[Плавающий режим:] (Alt + W) вход/выход.', status: isFloating },
      { text: '[Помощь:] (Alt + H).' },
      { text: '[Настройки:] (Alt + O).' },
      { text: '[Выход:] (ESC) в плавающем режиме.' },
      { text: '[Автовход:] (Alt + A) в плавающий режим.', status: flag('autoEnterFloating') },
      { text: '[Тема:] (Alt + T).', status: () => THEME_NAMES[getSetting('theme')] },
      { text: '[Режим отображения текста:] (Alt + L).', status: () => (getSetting('isPartialMode') ? 'построчно' : 'полностью') },
      { text: '[Выравнивание ввода:] (Alt + Q) + в плавающем режиме.', status: flag('alignInputWithFocus') },
      { text: '[Прогресс-бар:] (Alt + P) (виден, только пока текст обрезан).', status: flag('showProgress') },
      { text: '[Матрица:] (Alt + M) эффект падающих символов.', status: flag('matrixEffect') },
      { text: '[Скорость и ошибки:] (Alt + S) над блоком в плавающем режиме.', status: flag('showStats') },
      { text: '[Следующая игра:] (Ctrl + Enter) если (Ожидание/Гонка).' }
    ]
  },
  {
    title: 'Мышь',
    items: [
      { text: '[Помощь:] (Ctrl) + (наведите курсор) на строку ввода.' },
      { text: '[Плавающий режим:] (двойной клик) по строке ввода.' },
      { text: '[Режим отображения текста:] (двойной клик) по блоку.' },
      { text: '[Затемнение:] зажмите (ЛКМ) и тяните (вверх/вниз) по фону.' },
      { text: '[Ширина блока:] зажмите (ЛКМ) и тяните (влево/вправо) по блоку.' },
      { text: '[Положение блока:] зажмите (ЛКМ) и тяните (вверх/вниз) по блоку.' },
      { text: '[Количество строк:] (прокрутите колесо) мыши (вверх/вниз) по блоку.' },
      { text: '[Размер шрифта:] (Ctrl) + (колесо мыши) (вверх/вниз) по блоку.' },
      { text: '[Сброс параметра:] (Alt) + (ЛКМ) по параметру в настройках.' }
    ]
  }
];

const tag = (type, text) => `<span class="kg-help-${type}">${text}</span>`;
const renderStatus = (value) => (typeof value === 'boolean' ? tag(value ? 'on' : 'off', onOff(value)) : tag('value', value));

const renderItem = ({ text, status }) =>
  text.replace(/\[(.+?:)\]/g, (_match, keyword) => tag('key', keyword)) + (status ? ` — ${renderStatus(status())}` : '');

const renderHelp = () => HELP_SECTIONS.map(({ title, items }) =>
  `<div class="kg-help-heading">${title}</div>${items.map(renderItem).join('<br>')}`).join('');

export const helpPanel = createPanel({
  name: 'help',
  storageKey: 'kg-typeblock-help-panel',
  canOpen: isSettingsReady,
  render: (content) => { content.innerHTML = renderHelp(); }
});

// Ctrl + hover over the input shows the help for as long as it lasts
export function setupHelpHover() {
  let ctrlDown = false;
  const getInput = () => byId('inputtext');

  const onModifierChange = (event) => {
    ctrlDown = event.ctrlKey;
    if (ctrlDown && getInput()?.matches(':hover')) helpPanel.showTransient();
    else helpPanel.hideTransient();
  };

  window.addEventListener('keydown', onModifierChange);
  window.addEventListener('keyup', onModifierChange);
  document.addEventListener('mouseover', (event) => {
    if (ctrlDown && event.target === getInput()) helpPanel.showTransient();
  });
  document.addEventListener('mouseout', (event) => {
    if (event.target === getInput()) helpPanel.hideTransient();
  });
}
