import { svgIcon, ICONS } from './icons.js';

export function createIndicatorsController({
  themes,
  getCurrentTheme,
  isFloatingMode,
  getSetting,
  setSetting,
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

  // title/icon may be string or () => string
  // noOpacity: keep full opacity regardless of isActive
  // alwaysVisible: shown even when the bar is collapsed (chevron)
  // pinRight: pushed to the right edge of the block
  const INDICATORS = [
    {
      id: 'kg-saved-indicator',
      title: () => getSettingsForMode(getCurrentModeKey())
        ? 'Забыть настройки режима'
        : 'Запомнить настройки режима',
      isActive: () => !!getSettingsForMode(getCurrentModeKey()),
      toggle: () => toggleCustomSettings(),
      icon: ICONS.saved
    },
    {
      id: 'kg-partial-indicator',
      title: 'Построчное отображение',
      isActive: isPartialMode,
      toggle: () => toggleTextVisibilityMode(),
      icon: ICONS.partial
    },
    {
      id: 'kg-alignment-indicator',
      title: 'Выравнивание ввода',
      isActive: () => isFloatingMode() && getSetting('alignInputWithFocus'),
      toggle: () => toggleInputAlignment(),
      icon: ICONS.alignment
    },
    {
      id: 'kg-stats-indicator',
      title: 'Скорость и ошибки',
      isActive: () => isFloatingMode() && getSetting('showStats'),
      toggle: () => toggleStats(),
      icon: ICONS.stats
    },
    {
      id: 'kg-progress-indicator',
      title: 'Прогресс-бар',
      isActive: () => getSetting('showProgress'),
      toggle: () => toggleProgressBar(),
      icon: ICONS.progress
    },
    {
      id: 'kg-matrix-indicator',
      title: 'Эффект матрицы',
      isActive: () => isFloatingMode() && getSetting('matrixEffect'),
      toggle: () => toggleMatrixEffect(),
      icon: ICONS.matrix
    },
    {
      id: 'kg-theme-indicator',
      title: () => THEME_NAMES[getCurrentTheme()] || 'Тема',
      isActive: () => true,
      noOpacity: true,
      toggle: () => toggleTheme(),
      icon: () => getCurrentTheme() === 'dark' ? ICONS.moon : ICONS.sun
    },
    {
      id: 'kg-autoenter-indicator',
      title: 'Автовход в плавающий режим',
      isActive: () => !!getSetting('autoEnterFloating'),
      toggle: () => toggleAutoEnterFloating(),
      icon: ICONS.autoEnter
    },
    {
      id: 'kg-collapse-indicator',
      title: () => getSetting('showIndicators') ? 'Скрыть кнопки' : 'Показать кнопки',
      isActive: () => true,
      noOpacity: true,
      alwaysVisible: true,
      pinRight: true,
      toggle: () => {
        setSetting('showIndicators', !getSetting('showIndicators'));
        updateIndicators();
      },
      icon: () => getSetting('showIndicators') ? ICONS.chevronDown : ICONS.chevronUp
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
        right: '0',
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

  function syncIndicator({ id, title, icon, isActive, toggle, noOpacity, alwaysVisible, pinRight }) {
    const container = getIndicatorContainer();
    if (!container) return;
    if (!isFloatingMode()) {
      document.getElementById(id)?.remove();
      return;
    }
    const barOpen = getSetting('showIndicators') !== false;
    if (!alwaysVisible && !barOpen) {
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
    // Chevron stays on the right edge of the block
    span.style.marginLeft = pinRight ? 'auto' : '';
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
    if (getSetting('showIndicators') === false) {
      span?.remove();
      return;
    }
    const container = getIndicatorContainer();
    if (!container) return;
    ensureFontImport();
    if (!span) {
      span = document.createElement('span');
      span.id = 'kg-numeric-indicator';
      // Insert before the right-pinned chevron if present
      const chevron = document.getElementById('kg-collapse-indicator');
      if (chevron) container.insertBefore(span, chevron);
      else container.appendChild(span);
    }
    span.title = title;
    applyIndicatorBaseStyles(span);
    Object.assign(span.style, {
      fontFamily: '"Quicksand", sans-serif',
      fontWeight: '600',
      fontSize: '1.1em',
      marginLeft: ''
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
