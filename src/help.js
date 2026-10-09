export function createHelpController({
  createElement,
  readStorage,
  clamp,
  onOff,
  svgIcon,
  applyIndicatorBaseStyles,
  themes,
  getCurrentTheme,
  getSetting,
  isFloatingMode,
  isPartialMode,
  THEME_NAMES,
  ensureStyleElement,
  updateStyles,
  defaultSettings,
  isSettingsReady
}) {
  const HELP_PANEL_KEY = 'kg-typeblock-help-panel';
  const HELP_MARGIN = 8;

  const helpPanel = {
    popup: null,
    pinned: false,
    position: null,
    anchor: null
  };

  // Hotkeys show the current state: boolean is drawn as on/off, string as a plain value
  const HELP_SECTIONS = [
    {
      title: 'Горячие клавиши',
      items: [
        { text: '[Плавающий режим:] (Alt + W) вход/выход.', status: () => isFloatingMode() },
        { text: '[Помощь:] (Alt + H).' },
        { text: '[Выход:] (ESC) в плавающем режиме.' },
        { text: '[Автовход:] (Alt + A) в плавающий режим.', status: () => getSetting('autoEnterFloating') },
        { text: '[Тема:] (Alt + T).', status: () => THEME_NAMES[getCurrentTheme()] },
        { text: '[Режим отображения текста:] (Alt + L).', status: () => isPartialMode() ? 'построчно' : 'полностью' },
        { text: '[Выравнивание ввода:] (Alt + Q) + в плавающем режиме.', status: () => getSetting('alignInputWithFocus') },
        { text: '[Прогресс-бар:] (Alt + P) (виден, только пока текст обрезан).', status: () => getSetting('showProgress') },
        { text: '[Матрица:] (Alt + M) эффект падающих символов.', status: () => getSetting('matrixEffect') },
        { text: '[Скорость и ошибки:] (Alt + S) над блоком в плавающем режиме.', status: () => getSetting('showStats') },
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
        { text: '[Кастомные настройки:] (ПКМ) по строке ввода (Запомнить/Забыть).' }
      ]
    }
  ];

  function renderHelp(theme) {
    const { help } = theme;
    const colored = (text, color) => `<span style="color: ${color}; font-weight: bold">${text}</span>`;
    const renderStatus = (value) => typeof value === 'boolean'
      ? colored(onOff(value), value ? help.on : help.off)
      : colored(value, help.value);
    return HELP_SECTIONS.map(({ title, items }, i) => {
      const rows = items.map(({ text, status }) =>
        text.replace(/\[(.+?:)\]/g, (_m, keyword) => colored(keyword, help.value)) + (status ? ` — ${renderStatus(status())}` : '')
      ).join('<br>');
      const heading = `<div style="margin: ${i ? 10 : 0}px 0 4px; border-bottom: 1px solid ${theme.borderColor}">${colored(title, help.heading)}</div>`;
      return heading + rows;
    }).join('');
  }

  function readHelpPanelState() {
    const saved = readStorage(HELP_PANEL_KEY);
    return {
      open: !!saved.open,
      left: Number(saved.left),
      top: Number(saved.top)
    };
  }

  function saveHelpPanelState() {
    localStorage.setItem(HELP_PANEL_KEY, JSON.stringify({
      open: helpPanel.pinned,
      left: helpPanel.position?.left,
      top: helpPanel.position?.top
    }));
  }

  function createHelpAction(className, title, icon, onClick) {
    const button = createElement('button', {
      type: 'button',
      className: `kg-help-action ${className}`,
      title,
      innerHTML: svgIcon(icon)
    });
    button.addEventListener('mousedown', (event) => event.stopPropagation());
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    });
    return button;
  }

  function ensureHelpPopup() {
    if (helpPanel.popup) return helpPanel.popup;
    const actions = createElement('div', { className: 'kg-help-actions' },
      createHelpAction('kg-help-reset', 'Сбросить положение', `
        <polyline points="1 4 1 10 7 10"></polyline>
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>`, resetHelpPosition),
      createHelpAction('kg-help-close', 'Закрыть', `
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>`, closePinnedHelp));
    helpPanel.popup = createElement('div', { className: 'kg-help-popup', hidden: true },
      actions,
      createElement('div', { className: 'kg-help-content' }));
    document.body.appendChild(helpPanel.popup);
    setupHelpDrag(helpPanel.popup);
    return helpPanel.popup;
  }

  function applyHelpActionStyles() {
    const currentTheme = getCurrentTheme();
    if (!helpPanel.popup || !currentTheme) return;
    const { background, text } = themes[currentTheme].input.normal;
    helpPanel.popup.querySelectorAll('.kg-help-action').forEach(button => {
      applyIndicatorBaseStyles(button);
      button.style.setProperty('--kg-action-hover-bg', text);
      button.style.setProperty('--kg-action-hover-color', background);
    });
    syncResetButton();
  }

  // Measure away from the right edge: fit-content would otherwise shrink into the leftover gap
  function measureHelpPanel() {
    const popup = helpPanel.popup;
    const previousLeft = popup.style.left;
    popup.style.left = HELP_MARGIN + 'px';
    const size = { width: popup.offsetWidth, height: popup.offsetHeight };
    popup.style.left = previousLeft;
    return size;
  }

  // Intended position stays put; only the drawn point is clamped into the viewport
  function clampHelpPoint(left, top) {
    const { width, height } = measureHelpPanel();
    return {
      left: clamp(left, HELP_MARGIN, Math.max(HELP_MARGIN, window.innerWidth - width - HELP_MARGIN)),
      top: clamp(top, HELP_MARGIN, Math.max(HELP_MARGIN, window.innerHeight - height - HELP_MARGIN))
    };
  }

  function applyHelpPosition() {
    if (!helpPanel.pinned || !helpPanel.popup || helpPanel.popup.hidden || !helpPanel.position) return;
    const point = clampHelpPoint(helpPanel.position.left, helpPanel.position.top);
    helpPanel.popup.style.left = point.left + 'px';
    helpPanel.popup.style.top = point.top + 'px';
  }

  function getDefaultHelpPoint() {
    const input = document.getElementById('inputtext');
    const rect = input?.getBoundingClientRect();
    const { width, height } = measureHelpPanel();
    let top = rect ? rect.bottom + HELP_MARGIN : HELP_MARGIN;
    if (top + height > window.innerHeight) {
      top = (rect ? rect.top : window.innerHeight) - height - HELP_MARGIN;
    }
    const left = rect ? rect.left : (window.innerWidth - width) / 2;
    return clampHelpPoint(left, top);
  }

  function placeNearInput(popup) {
    const point = getDefaultHelpPoint();
    popup.style.left = point.left + 'px';
    popup.style.top = point.top + 'px';
    return point;
  }

  function readHelpAnchor() {
    const input = document.getElementById('inputtext');
    if (!input || !input.getClientRects().length) return null;
    const rect = input.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  }

  function isSameHelpAnchor(next) {
    const anchor = helpPanel.anchor;
    if (!anchor || !next) return anchor === next;
    return Math.abs(anchor.left - next.left) < 1 && Math.abs(anchor.top - next.top) < 1
      && Math.abs(anchor.width - next.width) < 1 && Math.abs(anchor.height - next.height) < 1;
  }

  // The input can move or leave the DOM. Missing input must not flip the button.
  function syncHelpAnchor() {
    const next = readHelpAnchor();
    if (isSameHelpAnchor(next)) return;
    helpPanel.anchor = next;
    if (next) syncResetButton();
  }

  function isHelpAtDefaultPosition() {
    if (!helpPanel.position || !readHelpAnchor()) return true;
    const point = getDefaultHelpPoint();
    return Math.abs(point.left - helpPanel.position.left) < 1
      && Math.abs(point.top - helpPanel.position.top) < 1;
  }

  function syncResetButton() {
    const button = helpPanel.popup?.querySelector('.kg-help-reset');
    if (!button || !readHelpAnchor()) return;
    button.hidden = isHelpAtDefaultPosition();
  }

  function renderHelpPanel() {
    const currentTheme = getCurrentTheme();
    if (!helpPanel.popup || helpPanel.popup.hidden || !currentTheme) return;
    helpPanel.popup.querySelector('.kg-help-content').innerHTML = renderHelp(themes[currentTheme]);
    applyHelpActionStyles();
    if (helpPanel.pinned) applyHelpPosition();
  }

  function showHelpPanel() {
    if (!isSettingsReady()) return;
    ensureStyleElement();
    updateStyles();
    const popup = ensureHelpPopup();
    const wasHidden = popup.hidden;
    popup.hidden = false;
    popup.classList.toggle('kg-help-pinned', helpPanel.pinned);
    renderHelpPanel();
    if (!wasHidden) return;
    if (helpPanel.pinned && helpPanel.position) applyHelpPosition();
    else placeNearInput(popup);
  }

  function showTransientHelp() {
    if (helpPanel.pinned) return;
    showHelpPanel();
  }

  function hideTransientHelp() {
    if (helpPanel.pinned || !helpPanel.popup || helpPanel.popup.hidden) return;
    helpPanel.popup.hidden = true;
  }

  function resetHelpPosition() {
    if (!helpPanel.popup) return;
    helpPanel.position = placeNearInput(helpPanel.popup);
    saveHelpPanelState();
    syncResetButton();
  }

  function toggleHelpPanel() {
    if (helpPanel.pinned) closePinnedHelp();
    else pinHelpPanel();
  }

  function closePinnedHelp() {
    helpPanel.pinned = false;
    if (helpPanel.popup) {
      helpPanel.popup.hidden = true;
      helpPanel.popup.classList.remove('kg-help-pinned');
    }
    saveHelpPanelState();
  }

  function pinHelpPanel() {
    const popup = ensureHelpPopup();
    const adoptCurrent = !helpPanel.pinned && !popup.hidden;
    helpPanel.pinned = true;
    showHelpPanel();
    if (adoptCurrent || !helpPanel.position) {
      helpPanel.position = { left: popup.offsetLeft, top: popup.offsetTop };
    }
    saveHelpPanelState();
    syncResetButton();
  }

  function restoreHelpPanel() {
    const saved = readHelpPanelState();
    if (Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
      helpPanel.position = { left: saved.left, top: saved.top };
    }
    if (!saved.open) return;
    helpPanel.pinned = true;
    showHelpPanel();
  }

  function setupHelpDrag(popup) {
    let dragStart = null;
    popup.addEventListener('mousedown', (event) => {
      if (!helpPanel.pinned || event.button !== 0) return;
      dragStart = {
        x: event.clientX,
        y: event.clientY,
        left: popup.offsetLeft,
        top: popup.offsetTop
      };
      event.preventDefault();
    });
    document.addEventListener('mousemove', (event) => {
      if (!dragStart) return;
      const point = clampHelpPoint(
        dragStart.left + event.clientX - dragStart.x,
        dragStart.top + event.clientY - dragStart.y
      );
      popup.style.left = point.left + 'px';
      popup.style.top = point.top + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (!dragStart) return;
      dragStart = null;
      helpPanel.position = { left: popup.offsetLeft, top: popup.offsetTop };
      saveHelpPanelState();
      syncResetButton();
    });
  }

  function setupHelpPopup() {
    let ctrlDown = false;
    const getInput = () => document.getElementById('inputtext');

    const onModifierChange = (event) => {
      ctrlDown = event.ctrlKey;
      if (ctrlDown && getInput()?.matches(':hover')) showTransientHelp();
      else hideTransientHelp();
    };

    window.addEventListener('keydown', onModifierChange);
    window.addEventListener('keyup', onModifierChange);
    window.addEventListener('resize', () => {
      applyHelpPosition();
      syncHelpAnchor();
    });
    document.addEventListener('mouseover', (event) => {
      if (ctrlDown && event.target === getInput()) showTransientHelp();
    });
    document.addEventListener('mouseout', (event) => {
      if (event.target === getInput()) hideTransientHelp();
    });
  }

  function getHelpCss(getElementsBrightness) {
    const theme = themes[getCurrentTheme() || defaultSettings.theme];
    return `
      .kg-help-popup {
        position: fixed !important;
        z-index: 2150 !important;
        background: ${theme.background} !important;
        color: ${theme.text.after} !important;
        border: 2px solid ${theme.borderColor} !important;
        border-radius: 0.4em !important;
        box-shadow: ${theme.shadow} !important;
        padding: 12px 18px !important;
        font-size: 15px !important;
        font-family: Tahoma, Arial, sans-serif !important;
        white-space: pre-line !important;
        user-select: none !important;
        width: max-content !important;
        min-width: min(280px, calc(100vw - ${HELP_MARGIN * 2}px)) !important;
        max-width: calc(100vw - ${HELP_MARGIN * 2}px) !important;
        filter: ${getElementsBrightness()} !important;
      }

      .kg-help-popup.kg-help-pinned {
        cursor: move !important;
      }

      .kg-help-popup[hidden] {
        display: none !important;
      }

      .kg-help-actions {
        display: none !important;
        justify-content: flex-end !important;
        gap: 8px !important;
        margin: 0 0 8px !important;
      }

      .kg-help-popup.kg-help-pinned .kg-help-actions {
        display: flex !important;
      }

      .kg-help-popup .kg-help-reset[hidden] {
        display: none !important;
      }

      .kg-help-popup .kg-help-action {
        padding: 0 !important;
        margin: 0 !important;
        border: none !important;
        cursor: pointer !important;
        line-height: 0 !important;
      }

      .kg-help-popup .kg-help-action:hover {
        background-color: var(--kg-action-hover-bg) !important;
        color: var(--kg-action-hover-color) !important;
        stroke: var(--kg-action-hover-color) !important;
      }
    `;
  }

  return {
    toggleHelpPanel,
    renderHelpPanel,
    restoreHelpPanel,
    setupHelpPopup,
    syncHelpAnchor,
    getHelpCss
  };
}
