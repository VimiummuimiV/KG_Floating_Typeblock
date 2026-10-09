export function createIndicatorsController({
  themes,
  getCurrentTheme,
  isFloatingMode,
  getSetting,
  getSettingsForMode,
  getCurrentModeKey,
  isPartialMode,
  toggleTextVisibilityMode,
  toggleInputAlignment,
  toggleStats,
  toggleProgressBar,
  toggleMatrixEffect,
  toggleTheme,
  toggleAutoEnterFloating,
  toggleCustomSettings,
  getFontSize,
  THEME_NAMES
}) {
  let numericIndicatorTimeout = null;

  const svgIcon = (content) => `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;

  const ICON_SUN = svgIcon(`
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`);

  const ICON_MOON = svgIcon(`
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`);

  // title/icon may be string or () => string for dynamic values
  // noOpacity: keep full opacity regardless of isActive (theme)
  const INDICATORS = [
    {
      id: 'kg-saved-indicator',
      title: () => getSettingsForMode(getCurrentModeKey())
        ? 'Забыть настройки режима'
        : 'Запомнить настройки режима',
      isActive: () => !!getSettingsForMode(getCurrentModeKey()),
      toggle: () => toggleCustomSettings(),
      icon: svgIcon(`
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
        <polyline points="17 21 17 13 7 13 7 21"></polyline>
        <polyline points="7 3 7 8 15 8"></polyline>`)
    },
    {
      id: 'kg-partial-indicator',
      title: 'Построчное отображение',
      isActive: isPartialMode,
      toggle: () => toggleTextVisibilityMode(),
      icon: svgIcon(`
        <line x1="17" y1="10" x2="3" y2="10"></line>
        <line x1="21" y1="6" x2="3" y2="6"></line>
        <line x1="21" y1="14" x2="3" y2="14"></line>
        <line x1="17" y1="18" x2="3" y2="18"></line>`)
    },
    {
      id: 'kg-alignment-indicator',
      title: 'Выравнивание ввода по фокусу',
      isActive: () => isFloatingMode() && getSetting('alignInputWithFocus'),
      toggle: () => toggleInputAlignment(),
      icon: svgIcon(`
        <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"></path>`)
    },
    {
      id: 'kg-stats-indicator',
      title: 'Скорость и ошибки',
      isActive: () => isFloatingMode() && getSetting('showStats'),
      toggle: () => toggleStats(),
      icon: svgIcon(`
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>`)
    },
    {
      id: 'kg-progress-indicator',
      title: 'Прогресс-бар',
      isActive: () => getSetting('showProgress'),
      toggle: () => toggleProgressBar(),
      icon: svgIcon(`
        <rect x="2" y="9" width="20" height="6" rx="3"></rect>
        <line x1="6" y1="12" x2="12" y2="12"></line>`)
    },
    {
      id: 'kg-matrix-indicator',
      title: 'Эффект матрицы',
      isActive: () => isFloatingMode() && getSetting('matrixEffect'),
      toggle: () => toggleMatrixEffect(),
      icon: svgIcon(`
        <path d="M5 3v3m0 3v4m0 3v5"/>
        <path d="M10 6v4m0 3v3m0 3v2" opacity=".6"/>
        <path d="M15 3v5m0 3v3m0 3v4"/>
        <path d="M20 7v3m0 3v4m0 3v1" opacity=".6"/>
      `)
    },
    {
      id: 'kg-theme-indicator',
      title: () => THEME_NAMES[getCurrentTheme()] || 'Тема',
      isActive: () => true,
      noOpacity: true,
      toggle: () => toggleTheme(),
      icon: () => getCurrentTheme() === 'dark' ? ICON_MOON : ICON_SUN
    },
    {
      id: 'kg-autoenter-indicator',
      title: 'Автовход в плавающий режим',
      isActive: () => !!getSetting('autoEnterFloating'),
      toggle: () => toggleAutoEnterFloating(),
      icon: svgIcon(`
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
        <polyline points="10 17 15 12 10 7"/>
        <line x1="15" y1="12" x2="3" y2="12"/>`)
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
        left: '0',
        bottom: '-40px',
        gap: '8px',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        zIndex: '2100'
      });
      mainBlock.appendChild(container);
    }
    return container;
  }

  function applyIndicatorBaseStyles(span) {
    const theme = themes[getCurrentTheme()];
    if (!theme) return;
    const { text, background } = theme.input.normal;
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
    span.style.setProperty('box-shadow', theme.shadowSmall, 'important');
  }

  function resolve(value) {
    return typeof value === 'function' ? value() : value;
  }

  function syncIndicator({ id, title, icon, isActive, toggle, noOpacity }) {
    const container = getIndicatorContainer();
    if (!container) return;
    if (!isFloatingMode()) {
      document.getElementById(id)?.remove();
      return;
    }
    let span = document.getElementById(id);
    if (!span) {
      span = document.createElement('span');
      span.id = id;
      if (toggle) {
        span.style.cursor = 'pointer';
        span.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle();
        });
      }
      container.appendChild(span);
    }
    span.title = resolve(title);
    span.innerHTML = resolve(icon);
    applyIndicatorBaseStyles(span);
    span.style.opacity = noOpacity || isActive() ? '1' : '0.4';
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

  function showNumericIndicator(value, title = '', updateOnly = false) {
    let span = document.getElementById('kg-numeric-indicator');
    if (!span && updateOnly) return;
    const container = getIndicatorContainer();
    if (!container) return;
    ensureFontImport();
    if (!span) {
      span = document.createElement('span');
      span.id = 'kg-numeric-indicator';
      container.appendChild(span);
    }
    span.title = title;
    applyIndicatorBaseStyles(span);
    Object.assign(span.style, {
      fontFamily: '"Quicksand", sans-serif',
      fontWeight: '600',
      fontSize: '1.1em'
    });
    span.innerText = String(value);
    if (updateOnly) return;
    clearTimeout(numericIndicatorTimeout);
    numericIndicatorTimeout = setTimeout(() => span.remove(), 3000);
  }

  function showFontSizeIndicator(updateOnly = false) {
    showNumericIndicator(getFontSize(), 'Текущий размер шрифта', updateOnly);
  }

  return {
    updateIndicators,
    showNumericIndicator,
    showFontSizeIndicator,
    applyIndicatorBaseStyles,
    svgIcon
  };
}
