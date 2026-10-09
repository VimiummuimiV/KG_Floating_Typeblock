// Two display modes of the typing block:
//   native   - the block stays where the site puts it
//   floating - the block is detached, dimmed background, resizable, movable, themed

import { createMatrixController } from './matrix.js';
import { createHelpController } from './help.js';

(function () {
  'use strict';

  // ─── Constants ─────────────────────────────────────────────────────────────

  const CUSTOM_SETTINGS_KEY = 'kg-typeblock-custom-settings';
  const DEFAULT_SETTINGS_KEY = 'kg-typeblock-settings';
  const PROGRESS_BAR_ID = 'kg-progress-bar';
  const FONT_SIZE = { min: 12, max: 48, step: 2 };
  const DIMMING_SENSITIVITY = 0.5;
  // The light theme starts to lose brightness only when the backdrop dimming (%) passes this level,
  // i.e. when the bright block really starts to glare on the dark backdrop
  const DIMMING_ELEMENTS_THRESHOLD = 70;
  // Share of brightness the light theme loses on a fully black backdrop
  const DIMMING_ELEMENTS_STRENGTH = 0.25;
  const INPUT_PADDING = 8;
  const TOAST_DURATION = 1500;

  const defaultSettings = {
    // false: floating mode is entered manually only (Alt + W or double click on the input)
    autoEnterFloating: true,
    // Independent levels: backdrop (matrix off) and matrix (matrix on)
    dimming: { backdrop: 50, matrix: 50 },
    mainBlockWidth: 90,
    mainBlockPosition: 25,
    visibleLines: 1,
    fontSize: 16,
    alignInputWithFocus: true,
    isPartialMode: false,
    showProgress: true,
    showStats: true,
    theme: 'dark',
    matrixEffect: false
  };

  // ─── Themes ────────────────────────────────────────────────────────────────

  const disabledLight = 'hsl(0, 0%, 85%)';
  const disabledDark = 'hsl(0, 0%, 10%)';

  // Input colors for one state: caret follows text, selection inverts the pair
  const createInputState = (background, text) => ({
    background,
    text,
    caret: text,
    selection: { background: text, text: background }
  });

  const themes = {
    dark: {
      background: 'hsl(0, 0%, 15%)',
      borderColor: 'hsl(0, 0%, 20%)',
      // Two-layer drop shadow: the surface looks lifted
      shadow: '0 1px 3px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.35)',
      shadowSmall: '0 1px 2px rgba(0,0,0,0.5), 0 3px 8px rgba(0,0,0,0.3)',
      text: {
        before: 'hsl(200, 10%, 40%)',
        focus: 'hsl(120, 70%, 70%)',
        after: 'hsl(200, 10%, 70%)',
        error: 'hsl(0, 85%, 70%)'
      },
      help: {
        heading: 'hsl(40, 80%, 70%)',
        on: 'hsl(140, 80%, 60%)',
        off: 'hsl(0, 85%, 65%)',
        value: 'hsl(200, 70%, 70%)'
      },
      input: {
        normal: createInputState('hsl(120, 15%, 25%)', 'hsl(120, 15%, 75%)'),
        disabled: createInputState(disabledDark, disabledDark),
        error: createInputState('hsl(350, 80%, 50%)', 'hsl(350, 80%, 20%)')
      }
    },
    light: {
      background: 'hsl(0, 0%, 95%)',
      borderColor: 'hsl(0, 0%, 70%)',
      shadow: '0 1px 3px rgba(0,0,0,0.25), 0 8px 24px rgba(0,0,0,0.2)',
      shadowSmall: '0 1px 2px rgba(0,0,0,0.3), 0 3px 8px rgba(0,0,0,0.2)',
      text: {
        before: 'hsl(200, 15%, 70%)',
        focus: 'hsl(150, 30%, 30%)',
        after: 'hsl(200, 15%, 40%)',
        error: 'hsl(350, 80%, 45%)'
      },
      help: {
        heading: 'hsl(30, 80%, 35%)',
        on: 'hsl(140, 70%, 30%)',
        off: 'hsl(0, 75%, 45%)',
        value: 'hsl(210, 70%, 40%)'
      },
      input: {
        normal: createInputState('hsl(150, 30%, 70%)', 'hsl(150, 30%, 20%)'),
        disabled: createInputState(disabledLight, disabledLight),
        error: createInputState('hsl(350, 80%, 60%)', 'hsl(350, 80%, 30%)')
      }
    }
  };

  const THEME_NAMES = { dark: 'тёмная', light: 'светлая' };

  // ─── State ─────────────────────────────────────────────────────────────────

  let settings = null;
  let isFloatingMode = false;
  let currentTheme = null;
  let dimmingBg = null;
  let styleElement = null;
  let inputObserver = null;
  let fontSizeIndicatorTimeout = null;
  let toastTimeout = null;

  // ─── Utils ─────────────────────────────────────────────────────────────────

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const randomItem = (list) => list[Math.floor(Math.random() * list.length)];

  // Element with the given properties and children
  function createElement(tag, properties = {}, ...children) {
    const element = Object.assign(document.createElement(tag), properties);
    element.append(...children);
    return element;
  }

  // Tracked listeners of the floating mode, all removed when it exits
  const eventListeners = [];
  function addEvent(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    eventListeners.push({ target, type, handler, options });
  }
  function removeEvents() {
    eventListeners.forEach(({ target, type, handler, options }) => {
      target.removeEventListener(type, handler, options);
    });
    eventListeners.length = 0;
  }

  // Short message at the bottom, feedback for toggles that have no visible effect
  function showToast(message) {
    let toast = document.getElementById('kg-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'kg-toast';
      document.body.appendChild(toast);
    }
    const theme = themes[currentTheme || defaultSettings.theme];
    toast.textContent = message;
    Object.assign(toast.style, {
      position: 'fixed',
      left: '50%',
      bottom: '24px',
      transform: 'translateX(-50%)',
      zIndex: '2200',
      padding: '8px 16px',
      fontSize: '15px',
      fontFamily: 'Tahoma, Arial, sans-serif',
      background: theme.background,
      color: theme.text.after,
      border: `2px solid ${theme.borderColor}`,
      borderRadius: '0.4em',
      boxShadow: theme.shadowSmall,
      pointerEvents: 'none'
    });
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.remove(), TOAST_DURATION);
  }

  const onOff = (isOn) => isOn ? 'вкл' : 'выкл';
  const formatToggle = (label, isOn) => `${label}: ${onOff(isOn)}`;

  // ─── Game API ──────────────────────────────────────────────────────────────

  const getGameId = () => new URL(location.href).searchParams.get('gmid');

  async function fetchGameText(gameId) {
    const body = new URLSearchParams({ need_text: '1' });
    const res = await fetch(`${location.origin}/g/${gameId}.info`, { method: 'POST', body });
    return (await res.json()).text?.text ?? '';
  }

  // ─── Settings ──────────────────────────────────────────────────────────────

  function readStorage(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || '{}');
    } catch {
      return {};
    }
  }

  function getCurrentModeKey() {
    const gamedesc = document.getElementById('gamedesc');
    if (!gamedesc) return null;
    const modeClass = Array.from(gamedesc.querySelectorAll('[class^="gametype-"]'))
      .map(el => Array.from(el.classList).find(cls => cls.startsWith('gametype-')))
      .find(Boolean);
    if (!modeClass) return null;
    if (modeClass === 'gametype-voc') {
      // Compact: get voc id from first /vocs/\d+ in href
      const a = gamedesc.querySelector('.gametype-voc a[href*="/vocs/"]');
      const id = a && a.href.match(/\/vocs\/(\d+)/)?.[1];
      if (id) return modeClass + '-' + id;
    }
    return modeClass;
  }

  // Personal settings per game mode
  const loadCustomSettings = () => readStorage(CUSTOM_SETTINGS_KEY);
  const saveCustomSettings = (custom) => localStorage.setItem(CUSTOM_SETTINGS_KEY, JSON.stringify(custom));

  function getSettingsForMode(modeKey) {
    return (modeKey && loadCustomSettings()[modeKey]) || null;
  }
  function setSettingsForMode(modeKey, newSettings) {
    saveCustomSettings({ ...loadCustomSettings(), [modeKey]: newSettings });
  }
  function removeSettingsForMode(modeKey) {
    const custom = loadCustomSettings();
    delete custom[modeKey];
    saveCustomSettings(custom);
  }

  function getCurrentSettings() {
    return {
      ...defaultSettings,
      ...readStorage(DEFAULT_SETTINGS_KEY),
      ...getSettingsForMode(getCurrentModeKey())
    };
  }

  function saveCurrentSettings(settingsObj) {
    const modeKey = getCurrentModeKey();
    if (getSettingsForMode(modeKey)) {
      setSettingsForMode(modeKey, settingsObj);
    } else {
      localStorage.setItem(DEFAULT_SETTINGS_KEY, JSON.stringify(settingsObj));
    }
  }

  function reloadSettings() {
    settings = getCurrentSettings();
    currentTheme = settings.theme;
  }

  const getSetting = (key) => settings[key];

  function setSetting(key, value) {
    settings[key] = value;
    if (key === 'theme') currentTheme = value;
    saveCurrentSettings(settings);
  }

  // Active dimming depends on whether matrix effect is on
  function getActiveDimmingLevel() {
    const dimming = getSetting('dimming') || defaultSettings.dimming;
    return getSetting('matrixEffect') ? dimming.matrix : dimming.backdrop;
  }

  function setActiveDimmingLevel(value) {
    const dimming = { ...(getSetting('dimming') || defaultSettings.dimming) };
    if (getSetting('matrixEffect')) dimming.matrix = value;
    else dimming.backdrop = value;
    setSetting('dimming', dimming);
  }

  // Flip a boolean setting and confirm the new state with a toast
  function toggleSetting(key, label) {
    setSetting(key, !getSetting(key));
    showToast(formatToggle(label, getSetting(key)));
    helpController.renderHelpPanel();
  }

  const isPartialMode = () => getSetting('isPartialMode');

  // ─── Matrix controller (see matrix.js) ─────────────────────────────────────

  const matrixController = createMatrixController({
    getSetting,
    isFloatingMode: () => isFloatingMode,
    addEvent,
    getGameId,
    fetchGameText,
    randomItem,
    createElement
  });

  // ─── Text visibility (both modes) ──────────────────────────────────────────

  function getLineHeight() {
    const typeFocus = document.getElementById('typefocus');
    if (!typeFocus) return 0;
    const lineHeight = parseFloat(window.getComputedStyle(typeFocus).lineHeight);
    return lineHeight > 0 ? lineHeight : typeFocus.offsetHeight;
  }

  function getMaxLines() {
    const typeText = document.getElementById('typetext');
    const lineHeight = getLineHeight();
    return typeText && lineHeight > 0 ? Math.floor(typeText.scrollHeight / lineHeight) : 1;
  }

  // Inline properties that cut the text block to N lines (also work in native mode)
  const PARTIAL_MODE_PROPERTIES = ['height', 'overflow', 'position'];

  function updateTextVisibility() {
    const typeText = document.getElementById('typetext');
    const typeFocus = document.getElementById('typefocus');
    if (!typeText || !typeFocus) return;

    if (!isPartialMode()) {
      PARTIAL_MODE_PROPERTIES.forEach(property => typeText.style.removeProperty(property));
      return;
    }

    const lineHeight = getLineHeight();
    if (lineHeight <= 0) return;
    // Clamp only for display, the saved value stays as is
    const visibleLines = clamp(getSetting('visibleLines'), 1, getMaxLines());
    const visibleHeight = visibleLines * lineHeight;
    typeText.style.setProperty('height', `${visibleHeight}px`, 'important');
    typeText.style.setProperty('overflow', 'hidden', 'important');
    typeText.style.setProperty('position', 'relative', 'important');
    const maxScroll = typeText.scrollHeight - visibleHeight;
    const targetScroll = visibleLines === 1 ? typeFocus.offsetTop : Math.min(typeFocus.offsetTop, maxScroll);
    typeText.scrollTop = Math.max(0, targetScroll);
  }

  // Text layout changed: re-apply visibility and everything that depends on it
  function refreshTextView() {
    updateTextVisibility();
    updateProgressBar();
  }

  function adjustVisibleLines(step) {
    if (!isPartialMode()) return;
    setSetting('visibleLines', clamp(getSetting('visibleLines') + step, 1, getMaxLines()));
    refreshTextView();
  }

  function toggleTextVisibilityMode() {
    toggleSetting('isPartialMode', 'Построчное отображение');
    refreshTextView();
    updateIndicators();
  }

  // ─── Progress bar (both modes) ─────────────────────────────────────────────

  // Site hides decoy characters in display:none spans, count only displayed text
  function getVisibleText(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
    if (node.nodeType !== Node.ELEMENT_NODE || node.style.display === 'none') return '';
    return [...node.childNodes].map(getVisibleText).join('');
  }

  function getCommonPrefixLength(a, b) {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i;
  }

  // Share of typed text: finished words + correctly typed start of the current word.
  // Characters after the first mismatch are ignored, so errors never add progress.
  function getTypingProgress() {
    const textOf = (id) => {
      const el = document.getElementById(id);
      return el ? getVisibleText(el) : '';
    };
    const before = textOf('beforefocus');
    const focus = textOf('typefocus');
    const total = before.length + focus.length + textOf('afterfocus').length;
    if (!total) return 0;
    const input = document.getElementById('inputtext');
    // A disabled input holds the site placeholder, not typed text
    const typed = input && !input.classList.contains('disabled') ? input.value : '';
    return (before.length + getCommonPrefixLength(typed, focus)) / total;
  }

  function isTextClipped() {
    const typeText = document.getElementById('typetext');
    return !!typeText && typeText.scrollHeight > typeText.clientHeight + 1;
  }

  function ensureProgressBar() {
    let bar = document.getElementById(PROGRESS_BAR_ID);
    if (bar) return bar;
    const inputBlock = document.getElementById('inputtextblock');
    if (!inputBlock) return null;
    bar = document.createElement('div');
    bar.id = PROGRESS_BAR_ID;
    bar.appendChild(document.createElement('div'));
    inputBlock.before(bar);
    return bar;
  }

  // Shown only when enabled and part of the text is hidden beyond the edge
  function updateProgressBar() {
    const bar = ensureProgressBar();
    if (!bar) return;
    bar.hidden = !(getSetting('showProgress') && isTextClipped());
    bar.firstElementChild.style.transform = `scaleX(${getTypingProgress()})`;
  }

  function toggleProgressBar() {
    toggleSetting('showProgress', 'Прогресс-бар');
    updateProgressBar();
    updateIndicators();
  }

  // ─── Race stats (floating) ─────────────────────────────────────────────────

  // The site status panel is covered by the dimming, so speed and errors are redrawn above the block
  const STATS_ID = 'kg-stats';
  const SPEED_SCALE = { maxSpeed: 1000, hueRange: 130, cells: 16 };
  const ERRORS_HIT_ANIMATION = [{ transform: 'scale(1.3)', filter: 'brightness(1.6)' }, { transform: 'scale(1)', filter: 'none' }];
  const ERRORS_HIT_DURATION = 350;

  function createStatsElement() {
    const cells = [...Array(SPEED_SCALE.cells)].map(() => createElement('div', { className: 'kg-speed-cell' }));
    return createElement('div', { id: STATS_ID },
      createElement('div', { className: 'kg-speed' },
        createElement('div', { className: 'kg-speed-readout' },
          createElement('span', { className: 'kg-speed-value', textContent: '0' }),
          createElement('span', { className: 'kg-speed-unit', textContent: 'скорость' })),
        createElement('div', { className: 'kg-speed-bar' }, ...cells)),
      createElement('div', { className: 'kg-errors' },
        createElement('span', { className: 'kg-errors-value', textContent: '0' }),
        createElement('span', { className: 'kg-errors-label', textContent: 'ошибки' })));
  }

  function ensureStatsElement() {
    let stats = document.getElementById(STATS_ID);
    if (stats) return stats;
    const mainBlock = document.getElementById('main-block');
    if (!mainBlock) return null;
    stats = createStatsElement();
    mainBlock.prepend(stats);
    return stats;
  }

  const removeStats = () => document.getElementById(STATS_ID)?.remove();

  const readNumber = (id) => Number.parseInt(document.getElementById(id)?.textContent, 10) || 0;

  // The text is assigned only when changed: the observer of the page reacts to every DOM change
  function setText(element, value) {
    const text = String(value);
    if (element.textContent === text) return false;
    element.textContent = text;
    return true;
  }

  function updateStats() {
    if (!getSetting('showStats')) {
      removeStats();
      return;
    }
    const stats = ensureStatsElement();
    if (!stats) return;

    const speed = readNumber('speed-label');
    const errors = readNumber('errors-label');
    const ratio = clamp(speed / SPEED_SCALE.maxSpeed, 0, 1);
    stats.style.setProperty('--kg-speed-hue', Math.round((1 - ratio) * SPEED_SCALE.hueRange));
    setText(stats.querySelector('.kg-speed-value'), speed);

    // A cell is either fully lit or off, never partially filled
    const litCells = Math.round(ratio * SPEED_SCALE.cells);
    stats.querySelectorAll('.kg-speed-cell').forEach((cell, index) => {
      cell.classList.toggle('kg-speed-cell-lit', index < litCells);
    });

    const errorsBox = stats.querySelector('.kg-errors');
    const errorsValue = errorsBox.querySelector('.kg-errors-value');
    const previousErrors = Number(errorsValue.textContent);
    if (setText(errorsValue, errors) && errors > previousErrors) {
      errorsBox.animate(ERRORS_HIT_ANIMATION, ERRORS_HIT_DURATION);
    }
    errorsBox.classList.toggle('kg-errors-active', errors > 0);
  }

  function toggleStats() {
    toggleSetting('showStats', 'Скорость и ошибки');
    updateStats();
    updateIndicators();
  }

  // ─── Auto enter ────────────────────────────────────────────────────────────

  function toggleAutoEnterFloating() {
    toggleSetting('autoEnterFloating', 'Автовход в плавающий режим');
  }

  // ─── Input alignment (floating) ────────────────────────────────────────────

  function alignInputWithTypeFocus() {
    if (!isFloatingMode || !getSetting('alignInputWithFocus')) return;
    const inputTextBlock = document.getElementById('inputtextblock');
    const typeFocus = document.getElementById('typefocus');
    const typeText = document.getElementById('typetext');
    if (!inputTextBlock || !typeFocus || !typeText) return;
    const typeTextRect = typeText.getBoundingClientRect();
    const offsetLeft = typeFocus.getBoundingClientRect().left - typeTextRect.left - INPUT_PADDING;
    inputTextBlock.style.setProperty('margin-left', `${(offsetLeft / typeTextRect.width) * 100}%`, 'important');
  }

  function resetInputAlignment() {
    document.getElementById('inputtextblock')?.style.removeProperty('margin-left');
  }

  function toggleInputAlignment() {
    toggleSetting('alignInputWithFocus', 'Выравнивание ввода');
    if (getSetting('alignInputWithFocus')) alignInputWithTypeFocus();
    else resetInputAlignment();
    updateIndicators();
  }

  // ─── Theme (floating) ──────────────────────────────────────────────────────

  // Re-apply everything that depends on current settings or theme
  function applySettings() {
    updateStyles();
    setInputColorState(document.getElementById('inputtext'));
    handleContentChanges();
    updateIndicators();
  }

  function toggleTheme() {
    setSetting('theme', currentTheme === 'dark' ? 'light' : 'dark');
    applySettings();
    showFontSizeIndicator(true); // Only update if present
    showToast(`Тема: ${THEME_NAMES[currentTheme]}`);
    helpController.renderHelpPanel();
  }

  // ─── Input colors (floating) ───────────────────────────────────────────────

  function setSelectionStyle(bg, color) {
    let selStyle = document.getElementById('kg-inputtext-selection-style');
    if (!selStyle) {
      selStyle = document.createElement('style');
      selStyle.id = 'kg-inputtext-selection-style';
      document.head.appendChild(selStyle);
    }
    selStyle.textContent = `#inputtext::selection { background: ${bg} !important; color: ${color} !important; }`;
  }

  function setInputColorState(el) {
    const { input } = themes[currentTheme];
    const isDisabled = el.classList.contains('disabled');
    const state = isDisabled ? input.disabled : el.classList.contains('error') ? input.error : input.normal;
    // Remove unwanted placeholder value if present and input is disabled
    if (isDisabled) el.value = '';
    el.style.setProperty('color', state.text, 'important');
    el.style.setProperty('background-color', state.background, 'important');
    el.style.caretColor = state.caret;
    setSelectionStyle(state.selection.background, state.selection.text);
  }

  function observeInput() {
    if (inputObserver) return;
    const el = document.getElementById('inputtext');
    if (!el) return;
    const updateColors = () => {
      if (isFloatingMode) setInputColorState(el);
    };
    updateColors();
    inputObserver = new MutationObserver(updateColors);
    inputObserver.observe(el, { attributes: true, attributeFilter: ['class'] });
  }

  // ─── Font size (floating) ──────────────────────────────────────────────────

  function getFontSize() {
    const size = getSetting('fontSize');
    return clamp(Number.isFinite(size) ? size : defaultSettings.fontSize, FONT_SIZE.min, FONT_SIZE.max);
  }

  function applyFontSize() {
    const typetext = document.getElementById('typetext');
    const inputtext = document.getElementById('inputtext');
    const size = getFontSize();
    if (typetext) {
      typetext.style.fontSize = size + 'px';
      typetext.style.lineHeight = (size * 1.2) + 'px';
    }
    if (inputtext) inputtext.style.fontSize = size + 'px';
  }

  // Inline important beats stylesheet rules, so an external dark-theme script cannot strip the border
  function applyTypeblockBorder() {
    document.getElementById('typeblock')?.style.setProperty('border', `2px solid ${themes[currentTheme].borderColor}`, 'important');
  }

  function setFontSize(size) {
    setSetting('fontSize', clamp(size, FONT_SIZE.min, FONT_SIZE.max));
    applyFontSize();
    refreshTextView();
    showFontSizeIndicator();
  }

  // ─── Indicators (both modes) ───────────────────────────────────────────────

  const svgIcon = (content) => `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;

  // Persistent indicators: shown while isActive() is true
  const INDICATORS = [
    {
      id: 'kg-saved-indicator',
      title: 'Применены кастомные настройки',
      isActive: () => !!getSettingsForMode(getCurrentModeKey()),
      icon: svgIcon(`
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
        <polyline points="17 21 17 13 7 13 7 21"></polyline>
        <polyline points="7 3 7 8 15 8"></polyline>`)
    },
    {
      id: 'kg-partial-indicator',
      title: 'Частичное отображение текста',
      isActive: isPartialMode,
      icon: svgIcon(`
        <line x1="17" y1="10" x2="3" y2="10"></line>
        <line x1="21" y1="6" x2="3" y2="6"></line>
        <line x1="21" y1="14" x2="3" y2="14"></line>
        <line x1="17" y1="18" x2="3" y2="18"></line>`)
    },
    {
      id: 'kg-alignment-indicator',
      title: 'Выравнивание ввода по фокусу',
      isActive: () => isFloatingMode && getSetting('alignInputWithFocus'),
      icon: svgIcon(`
        <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"></path>`)
    },
    {
      id: 'kg-stats-indicator',
      title: 'Скорость и ошибки',
      isActive: () => isFloatingMode && getSetting('showStats'),
      icon: svgIcon(`
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>`)
    },
    {
      id: 'kg-progress-indicator',
      title: 'Прогресс-бар',
      isActive: () => getSetting('showProgress'),
      icon: svgIcon(`
        <rect x="2" y="9" width="20" height="6" rx="3"></rect>
        <line x1="6" y1="12" x2="12" y2="12"></line>`)
    },
    {
      id: 'kg-matrix-indicator',
      title: 'Эффект матрицы',
      isActive: () => isFloatingMode && getSetting('matrixEffect'),
      icon: svgIcon(`
        <circle cx="5" cy="5" r="1.5" fill="currentColor" stroke="none"/>
        <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/>
        <circle cx="19" cy="5" r="1.5" fill="currentColor" stroke="none"/>
        <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/>
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
        <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>
        <circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none"/>
        <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none"/>
        <circle cx="19" cy="19" r="1.5" fill="currentColor" stroke="none"/>`)
    }
  ];

  function getIndicatorContainer() {
    const mainBlock = document.getElementById('main-block');
    if (!mainBlock) return null;
    let container = document.getElementById('kg-indicator-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'kg-indicator-container';
      Object.assign(container.style, {
        position: 'absolute',
        right: '-35px',
        top: '50%',
        gap: '8px',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '2100'
      });
      mainBlock.appendChild(container);
    }
    return container;
  }

  function applyIndicatorBaseStyles(span) {
    const { text, background } = themes[currentTheme].input.normal;
    Object.assign(span.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '28px',
      height: '28px',
      backgroundColor: background,
      color: text,
      stroke: text
    });
    span.style.setProperty('border-radius', '0.2em', 'important');
    span.style.setProperty('box-shadow', themes[currentTheme].shadowSmall, 'important');
  }

  function syncIndicator({ id, title, icon, isActive }) {
    const container = getIndicatorContainer();
    if (!container) return;
    let span = document.getElementById(id);
    if (!isActive()) {
      span?.remove();
      return;
    }
    if (!span) {
      span = document.createElement('span');
      span.id = id;
      span.title = title;
      span.innerHTML = icon;
      container.appendChild(span);
    }
    applyIndicatorBaseStyles(span);
  }

  const updateIndicators = () => INDICATORS.forEach(syncIndicator);

  function ensureFontImport() {
    if (document.getElementById('kg-font-import')) return;
    const link = document.createElement('link');
    link.id = 'kg-font-import';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Quicksand:wght@300..700&display=swap';
    document.head.appendChild(link);
  }

  // Temporary indicator with the current font size
  function showFontSizeIndicator(updateOnly = false) {
    let span = document.getElementById('kg-fontsize-indicator');
    if (!span && updateOnly) return;
    const container = getIndicatorContainer();
    if (!container) return;
    ensureFontImport();
    if (!span) {
      span = document.createElement('span');
      span.id = 'kg-fontsize-indicator';
      span.title = 'Текущий размер шрифта';
      container.appendChild(span);
    }
    applyIndicatorBaseStyles(span);
    Object.assign(span.style, { fontFamily: '"Quicksand", sans-serif', fontWeight: '600', fontSize: '1.1em' });
    span.innerText = getFontSize();
    if (updateOnly) return;
    clearTimeout(fontSizeIndicatorTimeout);
    fontSizeIndicatorTimeout = setTimeout(() => span.remove(), 3000);
  }

  // ─── Dimming background (floating) ─────────────────────────────────────────

  function createDimmingBackground() {
    dimmingBg = document.createElement('div');
    dimmingBg.id = 'kg-dimming-background';
    let dragStart = null;

    addEvent(dimmingBg, 'mousedown', (e) => {
      if (e.button !== 0) return;
      dragStart = { y: e.clientY, level: getActiveDimmingLevel() };
      e.preventDefault();
    });
    addEvent(dimmingBg, 'mousemove', (e) => {
      if (!dragStart) return;
      const level = dragStart.level + (dragStart.y - e.clientY) * DIMMING_SENSITIVITY;
      setActiveDimmingLevel(clamp(level, 0, 100));
      updateStyles();
      e.preventDefault();
    });
    addEvent(dimmingBg, 'mouseup', (e) => {
      if (e.button === 0) dragStart = null;
    });

    document.body.appendChild(dimmingBg);
  }

  // ─── Matrix effect toggle (floating) ───────────────────────────────────────

  function toggleMatrixEffect() {
    toggleSetting('matrixEffect', 'Эффект матрицы');
    matrixController.updateMatrixEffect();
    updateStyles();
    updateIndicators();
  }

  // ─── Main block drag (floating) ────────────────────────────────────────────

  function setupDragInteraction(element, onDrag, dragDataFactory, condition) {
    let isDragging = false;
    let data = null;

    const handleMouseMove = (e) => {
      if (isDragging && data) {
        onDrag(e, data);
        e.preventDefault();
      } else if (!isDragging) {
        element.style.cursor = condition(e) ? 'default' : 'move';
      }
    };

    const handleMouseDown = (e) => {
      if (e.button !== 0 || condition(e)) return;
      isDragging = true;
      // Capture state when drag starts, not when setup happens
      data = { startX: e.clientX, startY: e.clientY, ...dragDataFactory() };
      document.body.style.userSelect = 'none';
      e.preventDefault();
    };

    const handleMouseUp = (e) => {
      if (isDragging && e.button === 0) {
        isDragging = false;
        document.body.style.userSelect = '';
        element.style.cursor = '';
      }
    };

    addEvent(element, 'mousemove', handleMouseMove);
    addEvent(element, 'mousedown', handleMouseDown);
    addEvent(element, 'mouseleave', () => element.style.cursor = '');
    addEvent(document, 'mousemove', handleMouseMove);
    addEvent(document, 'mouseup', handleMouseUp);
  }

  // Resize (horizontal) and move (vertical) the block
  function setupMainBlockDrag() {
    const mainBlock = document.getElementById('main-block');
    if (!mainBlock) return;

    const isOverInput = (e) => {
      const input = document.getElementById('inputtext');
      if (!input) return false;
      const rect = input.getBoundingClientRect();
      return e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom;
    };

    setupDragInteraction(mainBlock, (e, data) => {
      const { innerWidth, innerHeight } = window;
      const maxTop = 100 - (data.blockHeight / innerHeight) * 100;
      const newWidth = clamp(data.startWidth + ((e.clientX - data.startX) / innerWidth) * 100, 20, 95);
      const newTop = clamp(data.startTop + ((e.clientY - data.startY) / innerHeight) * 100, 0, maxTop);
      setSetting('mainBlockWidth', Math.round(newWidth * 10) / 10);
      setSetting('mainBlockPosition', Math.round(newTop * 10) / 10);
      updateStyles();
      refreshTextView();
      helpController.syncHelpAnchor();
    }, () => ({
      startWidth: getSetting('mainBlockWidth'),
      startTop: getSetting('mainBlockPosition'),
      blockHeight: mainBlock.offsetHeight
    }), isOverInput);
  }

  // ─── Remember button (floating) ────────────────────────────────────────────

  // Right click on input: remember or forget settings for the current mode
  function setupRememberButton() {
    const input = document.getElementById('inputtext');
    if (!input) return;
    let btn = null;
    const removeBtn = () => {
      btn?.remove();
      btn = null;
    };

    addEvent(input, 'contextmenu', (e) => {
      e.preventDefault();
      removeBtn();
      const modeKey = getCurrentModeKey();
      const hasCustom = !!getSettingsForMode(modeKey);
      const theme = themes[currentTheme];

      btn = document.createElement('button');
      btn.textContent = hasCustom ? 'Забыть' : 'Запомнить';
      Object.assign(btn.style, {
        position: 'absolute',
        zIndex: '2020',
        fontSize: '16px',
        padding: '6px 16px',
        background: theme.input.normal.background,
        color: theme.input.normal.text,
        cursor: 'pointer'
      });
      btn.style.setProperty('border', `2px solid ${theme.borderColor}`, 'important');
      btn.style.setProperty('border-radius', '0.4em', 'important');
      btn.style.setProperty('box-shadow', theme.shadowSmall, 'important');
      btn.onmousedown = ev => ev.stopPropagation();
      btn.onclick = (ev) => {
        ev.preventDefault();
        if (hasCustom) {
          removeSettingsForMode(modeKey);
          reloadSettings();
          saveCurrentSettings(settings);
          applySettings();
        } else {
          setSettingsForMode(modeKey, { ...settings });
          updateIndicators();
        }
        removeBtn();
      };
      document.body.appendChild(btn);
      btn.addEventListener('mouseleave', removeBtn);
      const rect = btn.getBoundingClientRect();
      btn.style.left = (e.pageX - rect.width / 2) + 'px';
      btn.style.top = (e.pageY - rect.height / 2) + 'px';
    });
  }


  // ─── Styles ────────────────────────────────────────────────────────────────

  // Styles of both modes. Colors fall back to neutral ones outside the floating theme.
  function getBaseCss() {
    return `
      #fixtypo {
        display: none !important;
      }

      #${PROGRESS_BAR_ID} {
        height: 3px !important;
        margin: 8px 0 0 !important;
        border-radius: 2px !important;
        overflow: hidden !important;
        background-color: var(--kg-progress-track, rgba(128, 128, 128, 0.3)) !important;
      }

      #${PROGRESS_BAR_ID} > div {
        width: 100% !important;
        height: 100% !important;
        background-color: var(--kg-progress-fill, rgb(95, 160, 95)) !important;
        transform-origin: left center !important;
        transition: transform 0.15s ease-out !important;
      }
    `;
  }

  // Light theme only, and only once the backdrop is dark enough to make the block glare
  function getElementsBrightness() {
    if (!isFloatingMode || currentTheme !== 'light' || !settings) return 'none';
    const dimmingLevel = getActiveDimmingLevel();
    const elementsDimming = clamp((dimmingLevel - DIMMING_ELEMENTS_THRESHOLD) / (100 - DIMMING_ELEMENTS_THRESHOLD), 0, 1);
    return `brightness(${(1 - DIMMING_ELEMENTS_STRENGTH * elementsDimming).toFixed(2)})`;
  }

  function getFloatingCss(inputTransition) {
    const theme = themes[currentTheme];
    const isDark = currentTheme === 'dark';
    const dimmingLevel = getActiveDimmingLevel();
    return `
      #kg-dimming-background {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background-color: rgba(0, 0, 0, ${dimmingLevel / 100}) !important;
        z-index: 1999 !important;
        cursor: ns-resize !important;
        user-select: none !important;
      }

      #main-block {
        position: fixed !important;
        width: ${getSetting('mainBlockWidth')}vw !important;
        left: 50% !important;
        top: ${getSetting('mainBlockPosition')}vh !important;
        transform: translateX(-50%) !important;
        z-index: 2000 !important;
        pointer-events: auto !important;
        min-width: 566px !important;
        filter: ${getElementsBrightness()} !important;
      }

      #typeblock {
        width: 100% !important;
        border-radius: 18px !important;
        background-color: ${theme.background} !important;
        box-shadow: ${theme.shadow} !important;
      }

      #typeblock .rc {
        padding: 10px 10px 10px 20px !important;
      }

      #typeblock #param_keyboard {
        border-bottom: none !important;
        color: burlywood !important;
      }

      #typetext {
        position: relative !important;
        overflow: hidden !important;
      }

      #typetext img {
        width: 100% !important;
        height: auto !important;
        border-radius: 14px !important;
        filter: ${isDark ? 'invert(93.3%) grayscale(1)' : 'none'};
      }

      #typetext #beforefocus {
        color: ${theme.text.before} !important;
      }

      #typetext #typefocus {
        color: ${theme.text.focus} !important;
      }

      #typetext #afterfocus {
        color: ${theme.text.after} !important;
      }

      #typetext #typefocus.highlight_error {
        color: ${theme.text.error} !important;
      }

      #${PROGRESS_BAR_ID} {
        --kg-progress-track: ${theme.borderColor};
        --kg-progress-fill: ${theme.text.focus};
      }

      #${STATS_ID} {
        position: absolute !important;
        bottom: 100% !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        margin-bottom: 8px !important;
        display: flex !important;
        align-items: center !important;
        gap: 14px !important;
        padding: 6px 18px !important;
        border: 2px solid ${theme.borderColor} !important;
        border-radius: 999px !important;
        background-color: ${theme.background} !important;
        box-shadow: ${theme.shadow} !important;
        font-family: Tahoma, Arial, sans-serif !important;
        white-space: nowrap !important;
        user-select: none !important;
        --kg-speed-lightness: ${isDark ? '65%' : '40%'};
        color: hsl(var(--kg-speed-hue, 130) 70% var(--kg-speed-lightness)) !important;
        transition: color 0.25s !important;
      }

      #${STATS_ID} .kg-speed {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      #${STATS_ID} .kg-speed-readout,
      #${STATS_ID} .kg-errors {
        display: flex;
        align-items: baseline;
        gap: 5px;
      }

      #${STATS_ID} .kg-speed-value,
      #${STATS_ID} .kg-errors-value {
        font-size: 22px;
        font-weight: 700;
        line-height: 1;
        font-variant-numeric: tabular-nums;
      }

      #${STATS_ID} .kg-speed-value {
        min-width: 3ch;
        text-align: right;
      }

      #${STATS_ID} .kg-speed-unit,
      #${STATS_ID} .kg-errors-label {
        font-size: 12px;
        color: ${theme.text.after};
      }

      #${STATS_ID} .kg-speed-bar {
        display: flex;
        gap: 2px;
        width: 128px;
      }

      #${STATS_ID} .kg-speed-cell {
        flex: 1;
        height: 4px;
        border-radius: 1px;
        background-color: ${theme.borderColor};
      }

      #${STATS_ID} .kg-speed-cell-lit {
        background-color: currentColor;
      }

      #${STATS_ID} .kg-errors {
        padding-left: 14px;
        border-left: 2px solid ${theme.borderColor};
        color: ${theme.text.after};
      }

      #${STATS_ID} .kg-errors-value {
        transition: color 0.2s;
      }

      #${STATS_ID} .kg-errors-active .kg-errors-value {
        color: ${theme.text.error};
      }

      #inputtextblock {
        display: flex !important;
        justify-content: flex-start !important;
        align-items: center !important;
        transition: margin-left 0.1s ease !important;
      }

      #typeblock #inputtext {
        width: 100% !important;
        position: relative !important;
        box-shadow: none !important;
        border: none !important;
        margin: 0.5em 0 0 !important;
        padding: ${INPUT_PADDING}px !important;
        border-radius: 0.4em !important;
        outline: none !important;
        ${inputTransition ? 'transition: background-color 0.2s ease, color 0.2s ease !important;' : ''}
      }

      #main-block .handle,
      #report,
      #entertip,
      #param_keyboard {
        display: none !important;
      }

      #typeblock .r.tl,
      #typeblock .r .tr,
      #typeblock .r .bl,
      #typeblock .r .br {
        background: transparent !important;
      }

      #keyboard {
        filter: ${isDark ? 'invert(1) sepia(0) hue-rotate(40deg) grayscale(0.3)' : 'none'};
      }

      #keyboard_cont {
        margin-top: 0 !important;
      }
    `;
  }

  function ensureStyleElement() {
    if (styleElement) return;
    styleElement = document.createElement('style');
    styleElement.className = 'kg-typeblock-styles';
    document.head.appendChild(styleElement);
  }

  function updateStyles(opts = {}) {
    if (!styleElement) return;
    styleElement.textContent = getBaseCss() + helpController.getHelpCss(getElementsBrightness) +
      (isFloatingMode ? getFloatingCss(opts.inputTransition !== false) : '');
  }

  function resetStyles() {
    // Remove all inline styles of the floating mode for a full reset
    ['typeblock', 'typetext', 'inputtext', 'inputtextblock', 'typefocus'].forEach(id => {
      document.getElementById(id)?.removeAttribute('style');
    });
    document.getElementById('kg-inputtext-selection-style')?.remove();
  }

  // ─── Help controller (see help.js) ─────────────────────────────────────────

  const helpController = createHelpController({
    createElement,
    readStorage,
    clamp,
    onOff,
    svgIcon,
    applyIndicatorBaseStyles,
    themes,
    getCurrentTheme: () => currentTheme,
    getSetting,
    isFloatingMode: () => isFloatingMode,
    isPartialMode,
    THEME_NAMES,
    ensureStyleElement,
    updateStyles,
    defaultSettings,
    isSettingsReady: () => !!settings
  });

  // ─── Floating mode ─────────────────────────────────────────────────────────

  function enterFloatingMode() {
    if (isFloatingMode) return;

    const mainBlock = document.getElementById('main-block');
    const typeblock = document.getElementById('typeblock');
    const inputtext = document.getElementById('inputtext');
    if (!mainBlock || !typeblock || !inputtext) return;
    if (!settings) reloadSettings();

    ensureStyleElement();
    isFloatingMode = true;
    updateStyles({ inputTransition: false });

    createDimmingBackground();
    setupMainBlockDrag();
    setupRememberButton();

    setInputColorState(inputtext);
    observeInput();

    handleContentChanges();
    updateIndicators();
    matrixController.updateMatrixEffect();

    // Enable input color transition after the first paint
    setTimeout(updateStyles, 0);
    helpController.renderHelpPanel();
  }

  function exitFloatingMode() {
    if (!isFloatingMode) return;
    removeEvents();
    dimmingBg?.remove();
    dimmingBg = null;
    matrixController.destroyMatrix();
    document.getElementById('kg-fontsize-indicator')?.remove();
    removeStats();
    resetStyles();
    isFloatingMode = false;
    updateStyles();
    updateIndicators();
    // Native mode keeps the line-by-line view and the progress bar
    handleContentChanges();
    helpController.renderHelpPanel();
  }

  function toggleFloatingMode() {
    if (isFloatingMode) exitFloatingMode();
    else enterFloatingMode();
    showToast(formatToggle('Плавающий режим', isFloatingMode));
  }

  function handleContentChanges() {
    if (!settings) return;
    if (isFloatingMode) {
      applyFontSize();
      applyTypeblockBorder();
      alignInputWithTypeFocus();
      updateStats();
    }
    refreshTextView();
    helpController.syncHelpAnchor();
  }

  // ─── Global listeners (always active) ──────────────────────────────────────

  // Alt + key hotkeys of both modes
  const HOTKEYS = {
    KeyW: { action: toggleFloatingMode },
    KeyA: { action: toggleAutoEnterFloating },
    KeyL: { action: toggleTextVisibilityMode },
    KeyP: { action: toggleProgressBar },
    KeyM: { action: toggleMatrixEffect, floatingOnly: true },
    KeyH: { action: helpController.toggleHelpPanel },
    KeyS: { action: toggleStats, floatingOnly: true },
    KeyT: { action: toggleTheme, floatingOnly: true },
    KeyQ: { action: toggleInputAlignment, floatingOnly: true }
  };

  const isShown = (id) => {
    const el = document.getElementById(id);
    return !!el && el.style.display !== 'none';
  };

  // Ctrl+Enter during waiting/race opens the replay of the current game
  function openReplay() {
    if (document.body.classList.contains('latest-games-registered')) return;
    if (!isShown('waiting') && !isShown('racing')) return;
    const gmid = getGameId();
    if (gmid) location.href = `https://klavogonki.ru/g/${gmid}.replay`;
  }

  function onKeydown(e) {
    if (e.ctrlKey && (e.key === 'Enter' || e.code === 'Enter')) openReplay();
    if (!settings) return; // The typeblock has not appeared yet

    if (isFloatingMode && (e.key === 'Escape' || e.key === 'Enter')) {
      exitFloatingMode();
      return;
    }
    const hotkey = e.altKey && HOTKEYS[e.code];
    if (!hotkey || (hotkey.floatingOnly && !isFloatingMode)) return;
    hotkey.action();
    e.preventDefault();
    e.stopPropagation();
  }

  // Double click: on the input toggles floating mode, on the text block toggles text view
  function onDblclick(e) {
    const textArea = document.getElementById(isFloatingMode ? 'main-block' : 'typetext');
    if (e.target === document.getElementById('inputtext')) toggleFloatingMode();
    else if (settings && textArea?.contains(e.target)) toggleTextVisibilityMode();
    else return;
    e.preventDefault();
    e.stopPropagation();
  }

  // Wheel over the text block: Ctrl changes font size (floating), plain changes visible lines
  function onWheel(e) {
    if (!settings) return;
    const area = document.getElementById(isFloatingMode ? 'main-block' : 'typetext');
    if (!area?.contains(e.target)) return;
    const direction = Math.sign(-e.deltaY);
    if (e.ctrlKey) {
      if (!isFloatingMode) return;
      e.preventDefault();
      if (direction) setFontSize(getFontSize() + direction * FONT_SIZE.step);
    } else if (isPartialMode()) {
      adjustVisibleLines(direction);
      e.preventDefault();
      e.stopPropagation();
    }
  }

  // Typing moves the progress bar between DOM updates (inside a word).
  // Runs in the next frame, after the site has handled the same key press.
  let progressFrame = 0;
  function onTyping() {
    if (!settings || progressFrame) return;
    progressFrame = requestAnimationFrame(() => {
      progressFrame = 0;
      updateProgressBar();
    });
  }

  function setupGlobalListeners() {
    // Marker for other scripts
    document.body.classList.add('kg-typeblock-registered');
    document.addEventListener('keydown', onKeydown, true);
    document.addEventListener('dblclick', onDblclick);
    document.addEventListener('wheel', onWheel, { passive: false });
    // Capture phase: the site cannot stop these events before we see them
    document.addEventListener('input', onTyping, true);
    document.addEventListener('keyup', onTyping, true);
    helpController.setupHelpPopup();
  }

  // ─── Typeblock tracking ────────────────────────────────────────────────────

  function checkTypeblockVisibility() {
    const typetext = document.getElementById('typetext');
    if (!typetext) return false;
    const { display, visibility } = window.getComputedStyle(typetext);
    return display !== 'none' && visibility !== 'hidden' && typetext.offsetParent !== null;
  }

  function startObserver() {
    // The auto enter is attempted once per game, so a manual exit is respected
    let autoEnterTried = false;

    const sync = () => {
      const bookInfo = document.getElementById('bookinfo');
      if (bookInfo && isFloatingMode && bookInfo.style.display === '') {
        exitFloatingMode();
        autoEnterTried = false;
        return;
      }

      if (!autoEnterTried && checkTypeblockVisibility()) {
        autoEnterTried = true;
        if (!settings) {
          reloadSettings();
          ensureStyleElement();
          updateStyles();
          helpController.restoreHelpPanel();
        }
        if (getSetting('autoEnterFloating')) enterFloatingMode();
        updateIndicators();
      }
      handleContentChanges();
    };

    // characterData: the site may update typed words by changing text nodes in place
    new MutationObserver(sync).observe(document.body, { childList: true, subtree: true, characterData: true });
    sync();
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  setupGlobalListeners();
  startObserver();

})();